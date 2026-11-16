package br.com.freelancenow.api.payments;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.notifications.NotificationService;
import br.com.freelancenow.api.users.Role;
import br.com.freelancenow.api.users.User;
import br.com.freelancenow.api.users.UserRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * The freelancer's receiving account (ADR34). The account is a Stripe Connect account; the
 * freelancer fills Stripe's own form, embedded in the app, so identity and bank data never reach
 * this API. Only the account id and its readiness are stored.
 */
@Service
public class PayoutAccountService {
    private static final Logger log = LoggerFactory.getLogger(PayoutAccountService.class);

    private final PayoutAccountStore store;
    private final PayoutTransferService transfers;
    private final PaymentGateway gateway;
    private final UserRepository users;
    private final CurrentUser current;
    private final NotificationService notifications;
    private final String publishableKey;

    public PayoutAccountService(
            PayoutAccountStore store,
            PayoutTransferService transfers,
            PaymentGateway gateway,
            UserRepository users,
            CurrentUser current,
            NotificationService notifications,
            @Value("${app.stripe.publishable-key:}") String publishableKey) {
        this.store = store;
        this.transfers = transfers;
        this.gateway = gateway;
        this.users = users;
        this.current = current;
        this.notifications = notifications;
        this.publishableKey = publishableKey == null ? "" : publishableKey.trim();
    }

    /**
     * Readiness as stored, refreshed from Stripe when the account is not ready yet (there is no
     * account webhook for local runs). When the account turns ready, released money that was
     * waiting for it is transferred right after this request commits.
     */
    @Transactional
    public PaymentDtos.PayoutAccountView status(Jwt jwt) {
        var u = requireFreelancer(jwt);
        if (!gateway.enabled()) return PaymentDtos.PayoutAccountView.disabled();
        var stored = store.find(u.getId());
        if (stored == null) return PaymentDtos.PayoutAccountView.notStarted();
        if (!stored.transfersEnabled() || !stored.payoutsEnabled()) {
            try {
                stored = store.save(u.getId(), gateway.retrieveAccount(stored.accountId()));
            } catch (PaymentGateway.GatewayFailure e) {
                log.warn("Conta {} não consultada: {}", stored.accountId(), e.getMessage());
            }
        }
        if (stored.transfersEnabled()) {
            var userId = u.getId();
            PayoutTransferService.afterCommit(() -> transfers.transferPending(userId));
        }
        return view(stored);
    }

    /** Creates the account on first use and opens a session for the embedded components. */
    @Transactional
    public PaymentDtos.AccountSessionStarted session(Jwt jwt) {
        var u = requireFreelancer(jwt);
        if (!gateway.enabled())
            throw new ApiException(HttpStatus.CONFLICT, "Pagamentos desligados neste ambiente.");
        if (publishableKey.isEmpty())
            throw new ApiException(
                    HttpStatus.CONFLICT, "STRIPE_PUBLISHABLE_KEY não configurada na API.");
        // Serialises two clicks so the second one reuses the account created by the first.
        users.lockById(u.getId()).orElseThrow();
        var stored = store.find(u.getId());
        try {
            String accountId =
                    stored != null
                            ? stored.accountId()
                            : store.save(
                                            u.getId(),
                                            gateway.retrieveAccount(
                                                    gateway.createConnectedAccount(
                                                            u.getId(), u.getEmail(), u.getName())))
                                    .accountId();
            return new PaymentDtos.AccountSessionStarted(
                    gateway.createAccountSession(accountId), publishableKey);
        } catch (PaymentGateway.GatewayFailure e) {
            log.warn("Conta de recebimento de {}: {}", u.getId(), e.getMessage());
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "Não foi possível abrir o cadastro agora. Tente novamente em instantes.");
        }
    }

    /**
     * An event of a freelancer's Stripe account, from the Connect webhook. Payouts are Stripe's
     * automatic deposits to the bank account (Brazil has no manual payouts), so the app only
     * tells the freelancer how each one ended. Runs inside the webhook transaction, after the
     * event id was recorded, so a repeated delivery does nothing.
     */
    void onAccountEvent(PaymentGateway.GatewayEvent e) {
        UUID userId = e.account() == null ? null : store.ownerOf(e.account());
        if (userId == null) {
            log.info("Evento {} de conta desconhecida {}", e.type(), e.account());
            return;
        }
        switch (e.type()) {
            case "payout.paid" ->
                    users.findById(userId)
                            .ifPresent(
                                    u ->
                                            notifications.notify(
                                                    u,
                                                    "PAYOUT_PAID",
                                                    "Saque depositado",
                                                    money(e.amount())
                                                            + " foi depositado na sua conta"
                                                            + " bancária.",
                                                    "/saque"));
            case "payout.failed" ->
                    users.findById(userId)
                            .ifPresent(
                                    u ->
                                            notifications.notify(
                                                    u,
                                                    "PAYOUT_FAILED",
                                                    "Saque não realizado",
                                                    "A Stripe não conseguiu depositar "
                                                            + money(e.amount())
                                                            + reason(e.detail())
                                                            + " Confira a conta bancária em Conta"
                                                            + " de recebimento.",
                                                    "/conta-recebimento"));
            case "account.updated" -> {
                try {
                    var stored = store.save(userId, gateway.retrieveAccount(e.account()));
                    if (stored.transfersEnabled())
                        PayoutTransferService.afterCommit(() -> transfers.transferPending(userId));
                } catch (PaymentGateway.GatewayFailure ex) {
                    log.warn("Conta {} não consultada: {}", e.account(), ex.getMessage());
                }
            }
            default -> {}
        }
    }

    /** Stripe's failure message, short enough for the notification body. */
    private static String reason(String detail) {
        if (detail == null || detail.isBlank()) return ".";
        String d = detail.strip();
        if (d.length() > 150) d = d.substring(0, 150) + "…";
        return d.endsWith(".") ? ": " + d : ": " + d + ".";
    }

    private static String money(BigDecimal amount) {
        return amount == null ? "O valor" : PaymentIncidentService.money(amount);
    }

    /** Asks Stripe again whether this freelancer's account is ready (admin retry). */
    void refresh(UUID userId) {
        var stored = store.find(userId);
        if (stored == null || stored.transfersEnabled()) return;
        try {
            store.save(userId, gateway.retrieveAccount(stored.accountId()));
        } catch (PaymentGateway.GatewayFailure e) {
            log.warn("Conta {} não consultada: {}", stored.accountId(), e.getMessage());
        }
    }

    private User requireFreelancer(Jwt jwt) {
        var u = current.require(jwt);
        if (u.getRole() != Role.FREELANCER)
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Somente profissionais têm conta de recebimento.");
        return u;
    }

    private static PaymentDtos.PayoutAccountView view(PayoutAccountStore.Stored s) {
        String status;
        if (s.transfersEnabled()) status = "READY";
        else if (s.detailsSubmitted() && s.currentlyDue().isEmpty()) status = "IN_REVIEW";
        else status = "INCOMPLETE";
        return new PaymentDtos.PayoutAccountView(
                true, status, s.transfersEnabled(), s.payoutsEnabled(), s.currentlyDue());
    }
}
