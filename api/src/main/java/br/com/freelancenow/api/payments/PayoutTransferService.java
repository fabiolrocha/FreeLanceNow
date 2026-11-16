package br.com.freelancenow.api.payments;

import br.com.freelancenow.api.contracts.ContractRepository;
import br.com.freelancenow.api.notifications.NotificationService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Sends released money to the freelancer's Stripe account (ADR34): a Transfer of the net amount,
 * tied to the original charge ({@code source_transaction}), so it never depends on the
 * platform's free balance. Runs after the release is committed: a Stripe failure never undoes a
 * completed contract, it is recorded and retried. Released payments of freelancers without a
 * ready account wait and are sent when the account becomes ready.
 */
@Service
public class PayoutTransferService {
    private static final Logger log = LoggerFactory.getLogger(PayoutTransferService.class);

    private final JdbcTemplate db;
    private final PaymentGateway gateway;
    private final PayoutAccountStore accounts;
    private final ContractRepository contracts;
    private final NotificationService notifications;
    private final Clock clock;
    private final TransactionTemplate tx;

    public PayoutTransferService(
            JdbcTemplate db,
            PaymentGateway gateway,
            PayoutAccountStore accounts,
            ContractRepository contracts,
            NotificationService notifications,
            Clock clock,
            PlatformTransactionManager transactions) {
        this.db = db;
        this.gateway = gateway;
        this.accounts = accounts;
        this.contracts = contracts;
        this.notifications = notifications;
        this.clock = clock;
        // Its own transaction: it runs after another one committed, and once per payment.
        this.tx = new TransactionTemplate(transactions);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Runs {@code work} once the current transaction commits (at once if there is none). A
     * failure is logged, never thrown: the request that committed already succeeded, and the
     * periodic catch-up retries.
     */
    static void afterCommit(Runnable work) {
        Runnable safe =
                () -> {
                    try {
                        work.run();
                    } catch (RuntimeException e) {
                        log.warn("Repasse após o commit falhou: {}", e.getMessage());
                    }
                };
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            safe.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        safe.run();
                    }
                });
    }

    /**
     * Transfers one released payment if it is still waiting and the freelancer's account is
     * ready. Safe to call any number of times: the row lock and Stripe's idempotency key
     * guarantee a single transfer. Returns true if the money was sent now.
     */
    public boolean transfer(UUID paymentId, boolean notify) {
        if (!gateway.enabled()) return false;
        return Boolean.TRUE.equals(tx.execute(status -> transferLocked(paymentId, notify)));
    }

    private boolean transferLocked(UUID paymentId, boolean notify) {
        var contractIds =
                db.queryForList(
                        "select contract_id from payment where id = ?", UUID.class, paymentId);
        if (contractIds.isEmpty()) return false;
        // Same lock order as everywhere else: contract, then payment.
        var c = contracts.lockById(contractIds.get(0)).orElseThrow();
        var rows =
                db.queryForList(
                        "select status, provider, transfer_id, dispute_status, net_amount,"
                                + " gross_amount, refunded_amount,"
                                + " provider_payment_id, provider_charge_id, freelancer_id"
                                + " from payment where id = ? for update",
                        paymentId);
        var p = rows.get(0);
        if (!"RELEASED".equals(p.get("status"))
                || !"STRIPE".equals(p.get("provider"))
                || p.get("transfer_id") != null
                // A chargeback is open: the money may go back to the client's bank.
                || "OPEN".equals(p.get("dispute_status"))) return false;
        var freelancerId = (UUID) p.get("freelancer_id");
        String destination = accounts.readyAccountId(freelancerId);
        if (destination == null) return false;
        // A partial refund made before the transfer lowers the freelancer's share.
        var net =
                ((BigDecimal) p.get("net_amount"))
                        .subtract(
                                PaymentIncidentService.freelancerLoss(
                                        (BigDecimal) p.get("refunded_amount"),
                                        (BigDecimal) p.get("gross_amount"),
                                        (BigDecimal) p.get("net_amount")));
        if (net.signum() <= 0) return false;
        var now = Instant.now(clock);
        try {
            String charge = (String) p.get("provider_charge_id");
            if (charge == null) {
                charge = gateway.chargeOf((String) p.get("provider_payment_id"));
                db.update(
                        "update payment set provider_charge_id = ? where id = ?",
                        charge,
                        paymentId);
            }
            String transferId =
                    gateway.transfer(
                            new PaymentGateway.TransferRequest(
                                    paymentId,
                                    destination,
                                    net,
                                    charge,
                                    transferGroup(c.getId())));
            db.update(
                    "update payment set transfer_id = ?, transferred_at = ?, transfer_error ="
                            + " null, updated_at = ? where id = ?",
                    transferId,
                    Timestamp.from(now),
                    Timestamp.from(now),
                    paymentId);
            db.update(
                    "insert into ledger_entry (id, payment_id, contract_id, user_id, entry_type,"
                            + " amount, description, created_at)"
                            + " values (?, ?, ?, ?, 'TRANSFER', ?, ?, ?)",
                    UUID.randomUUID(),
                    paymentId,
                    c.getId(),
                    freelancerId,
                    net,
                    "Transferido para a conta de recebimento",
                    Timestamp.from(now));
            if (notify)
                notifications.notify(
                        c.getFreelancer(),
                        "PAYMENT_TRANSFERRED",
                        "Valor transferido: " + c.getTitle(),
                        "O valor do serviço foi enviado para a sua conta de recebimento.",
                        "/carteira");
            return true;
        } catch (PaymentGateway.GatewayFailure e) {
            String message = e.getMessage();
            if (e.getCause() != null && e.getCause().getMessage() != null)
                message = message + ": " + e.getCause().getMessage();
            if (message.length() > 500) message = message.substring(0, 500);
            log.warn("Transferência do pagamento {} falhou: {}", paymentId, message);
            db.update(
                    "update payment set transfer_error = ?, updated_at = ? where id = ?",
                    message,
                    Timestamp.from(now),
                    paymentId);
            return false;
        }
    }

    /** Sends every released payment of this freelancer that is still waiting. */
    public int transferPending(UUID freelancerId) {
        int sent = 0;
        for (var id :
                db.queryForList(
                        "select id from payment where freelancer_id = ? and status = 'RELEASED'"
                                + " and provider = 'STRIPE' and transfer_id is null"
                                + " order by released_at",
                        UUID.class,
                        freelancerId)) if (transfer(id, true)) sent++;
        return sent;
    }

    /**
     * Periodic catch-up: refreshes accounts that were not ready (onboarding may have finished
     * without the freelancer coming back to the app) and retries failed transfers.
     */
    @Scheduled(
            fixedDelayString = "${app.stripe.transfer-check-ms:300000}",
            initialDelayString = "${app.stripe.transfer-check-ms:300000}")
    public void catchUp() {
        if (!gateway.enabled()) return;
        for (var freelancerId :
                db.queryForList(
                        "select distinct freelancer_id from payment where status = 'RELEASED'"
                                + " and provider = 'STRIPE' and transfer_id is null",
                        UUID.class)) {
            try {
                var stored = accounts.find(freelancerId);
                if (stored == null) continue;
                if (!stored.transfersEnabled())
                    accounts.save(freelancerId, gateway.retrieveAccount(stored.accountId()));
                transferPending(freelancerId);
            } catch (RuntimeException e) {
                log.warn("Repasses de {} não processados: {}", freelancerId, e.getMessage());
            }
        }
    }

    static String transferGroup(UUID contractId) {
        return "contract-" + contractId;
    }
}
