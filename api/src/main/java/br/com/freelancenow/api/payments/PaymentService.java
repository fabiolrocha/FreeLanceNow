package br.com.freelancenow.api.payments;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.contracts.Contract;
import br.com.freelancenow.api.contracts.ContractRepository;
import br.com.freelancenow.api.contracts.ContractStatus;
import br.com.freelancenow.api.notifications.NotificationService;
import br.com.freelancenow.api.users.Role;
import br.com.freelancenow.api.users.User;
import br.com.freelancenow.api.users.UserRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * F09 (ADR33). The client pays through Stripe Checkout after the freelancer accepts; the money
 * stays in escrow until the contract is completed, then becomes the freelancer's balance minus
 * the platform fee. Cancellation, or a dispute decided for the client, refunds it. Withdrawals are
 * simulated. Every money movement is a {@code ledger_entry}.
 *
 * <p>Lock order is always contract first, then payment, the same as {@code ContractService}, so
 * a webhook and a status change on the same contract never deadlock.
 */
@Service
@Transactional(readOnly = true)
public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    private static final String LIVE = "('PENDING','PROCESSING','PAID','RELEASED')";
    private static final String COLUMNS =
            "p.id, p.contract_id, p.client_id, p.freelancer_id, p.provider, p.method, p.status,"
                    + " p.gross_amount, p.fee_amount, p.net_amount, p.external_reference,"
                    + " p.checkout_url, p.checkout_expires_at, p.provider_payment_id,"
                    + " p.created_at, p.paid_at, p.released_at, p.refunded_at,"
                    + " c.title, cu.name as client_name, fu.name as freelancer_name";
    private static final String FROM =
            " from payment p join contract c on c.id = p.contract_id"
                    + " join app_user cu on cu.id = p.client_id"
                    + " join app_user fu on fu.id = p.freelancer_id";

    private final JdbcTemplate db;
    private final PaymentGateway gateway;
    private final ContractRepository contracts;
    private final UserRepository users;
    private final CurrentUser current;
    private final NotificationService notifications;
    private final Clock clock;
    private final BigDecimal feePercent;
    private final List<PaymentMethod> methods;
    private final String webBaseUrl;

    public PaymentService(
            JdbcTemplate db,
            PaymentGateway gateway,
            ContractRepository contracts,
            UserRepository users,
            CurrentUser current,
            NotificationService notifications,
            Clock clock,
            @Value("${app.stripe.platform-fee-percent:10}") BigDecimal feePercent,
            @Value("${app.stripe.methods:CARD,PIX,BOLETO}") String methods,
            @Value("${app.web-base-url}") String webBaseUrl) {
        this.db = db;
        this.gateway = gateway;
        this.contracts = contracts;
        this.users = users;
        this.current = current;
        this.notifications = notifications;
        this.clock = clock;
        this.feePercent = feePercent;
        this.methods =
                Arrays.stream(methods.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(s -> PaymentMethod.valueOf(s.toUpperCase()))
                        .distinct()
                        .toList();
        this.webBaseUrl = webBaseUrl.replaceAll("/+$", "");
    }

    /** One payment row, with the contract title and both names for display. */
    record Row(
            UUID id,
            UUID contractId,
            UUID clientId,
            UUID freelancerId,
            String provider,
            PaymentMethod method,
            String status,
            BigDecimal gross,
            BigDecimal fee,
            BigDecimal net,
            String sessionId,
            String checkoutUrl,
            Instant checkoutExpiresAt,
            String providerPaymentId,
            Instant createdAt,
            Instant paidAt,
            Instant releasedAt,
            Instant refundedAt,
            String title,
            String clientName,
            String freelancerName) {
        PaymentDtos.PaymentView view() {
            return new PaymentDtos.PaymentView(
                    id,
                    contractId,
                    title,
                    clientName,
                    freelancerName,
                    provider,
                    method,
                    status,
                    gross,
                    fee,
                    net,
                    createdAt,
                    paidAt,
                    releasedAt,
                    refundedAt);
        }
    }

    private static final RowMapper<Row> ROW = PaymentService::mapRow;

    private static Row mapRow(ResultSet rs, int n) throws SQLException {
        return new Row(
                rs.getObject("id", UUID.class),
                rs.getObject("contract_id", UUID.class),
                rs.getObject("client_id", UUID.class),
                rs.getObject("freelancer_id", UUID.class),
                rs.getString("provider"),
                PaymentMethod.valueOf(rs.getString("method")),
                rs.getString("status"),
                rs.getBigDecimal("gross_amount"),
                rs.getBigDecimal("fee_amount"),
                rs.getBigDecimal("net_amount"),
                rs.getString("external_reference"),
                rs.getString("checkout_url"),
                instant(rs, "checkout_expires_at"),
                rs.getString("provider_payment_id"),
                instant(rs, "created_at"),
                instant(rs, "paid_at"),
                instant(rs, "released_at"),
                instant(rs, "refunded_at"),
                rs.getString("title"),
                rs.getString("client_name"),
                rs.getString("freelancer_name"));
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp t = rs.getTimestamp(column);
        return t == null ? null : t.toInstant();
    }

    public boolean enabled() {
        return gateway.enabled();
    }

    // ---------------------------------------------------------------- client checkout

    public PaymentDtos.ContractPayment contractPayment(Jwt jwt, UUID contractId) {
        var u = current.require(jwt);
        var c = contracts.findById(contractId).orElseThrow(PaymentService::contractNotFound);
        ensureParticipantOrAdmin(u, c);
        var latest =
                db.query(
                        "select " + COLUMNS + FROM
                                + " where p.contract_id = ? order by p.created_at desc limit 1",
                        ROW,
                        contractId);
        return new PaymentDtos.ContractPayment(
                gateway.enabled(),
                methods,
                feePercent,
                latest.isEmpty() ? null : latest.get(0).view());
    }

    @Transactional
    public PaymentDtos.CheckoutStarted checkout(
            Jwt jwt, UUID contractId, PaymentDtos.StartCheckout r) {
        var u = current.require(jwt);
        if (u.getRole() != Role.CLIENT)
            throw new ApiException(HttpStatus.FORBIDDEN, "Somente o cliente paga a contratação.");
        var c = contracts.lockById(contractId).orElseThrow(PaymentService::contractNotFound);
        if (!c.getClient().getId().equals(u.getId()))
            throw new ApiException(HttpStatus.FORBIDDEN, "Você não participa desta contratação.");
        if (!gateway.enabled())
            throw new ApiException(
                    HttpStatus.CONFLICT, "Pagamentos pela plataforma ainda não estão disponíveis.");
        if (c.getStatus() != ContractStatus.ACEITO)
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "O pagamento é feito depois do aceite do profissional e antes do início.");
        if (!methods.contains(r.method()))
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "Esta forma de pagamento não está disponível.");
        var now = Instant.now(clock);
        var live = livePayment(contractId);
        if (live != null) {
            switch (live.status()) {
                case "PAID", "RELEASED" ->
                        throw new ApiException(
                                HttpStatus.CONFLICT, "Esta contratação já foi paga.");
                case "PROCESSING" ->
                        throw new ApiException(
                                HttpStatus.CONFLICT,
                                "Já existe um pagamento em processamento. Aguarde a confirmação"
                                        + " do boleto ou do Pix.");
                default -> {
                    // An open checkout for the same method is reused; otherwise it is closed.
                    if (live.method() == r.method()
                            && live.checkoutUrl() != null
                            && live.checkoutExpiresAt() != null
                            && live.checkoutExpiresAt().isAfter(now.plus(Duration.ofMinutes(5))))
                        return new PaymentDtos.CheckoutStarted(live.id(), live.checkoutUrl());
                    closeCheckout(live);
                    setStatus(live.id(), "CANCELED", now);
                }
            }
        }
        BigDecimal gross = c.getPrice().setScale(2, RoundingMode.HALF_UP);
        BigDecimal fee =
                gross.multiply(feePercent)
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        var id = UUID.randomUUID();
        db.update(
                "insert into payment (id, contract_id, client_id, freelancer_id, provider, method,"
                        + " status, gross_amount, fee_amount, net_amount, created_at, updated_at)"
                        + " values (?, ?, ?, ?, 'STRIPE', ?, 'PENDING', ?, ?, ?, ?, ?)",
                id,
                c.getId(),
                c.getClient().getId(),
                c.getFreelancer().getId(),
                r.method().name(),
                gross,
                fee,
                gross.subtract(fee),
                Timestamp.from(now),
                Timestamp.from(now));
        PaymentGateway.Checkout session;
        try {
            session =
                    gateway.createCheckout(
                            new PaymentGateway.CheckoutRequest(
                                    id,
                                    c.getId(),
                                    c.getTitle(),
                                    gross,
                                    r.method(),
                                    u.getEmail(),
                                    webBaseUrl + "/pagamento/confirmado?contratacao=" + c.getId(),
                                    webBaseUrl + "/contratacoes/" + c.getId()));
        } catch (PaymentGateway.GatewayFailure e) {
            log.warn("Checkout não criado para a contratação {}: {}", c.getId(), e.getMessage());
            throw new ApiException(
                    HttpStatus.BAD_GATEWAY,
                    "Não foi possível abrir o pagamento agora. Tente novamente em instantes.");
        }
        db.update(
                "update payment set external_reference = ?, checkout_url = ?,"
                        + " checkout_expires_at = ?, updated_at = ? where id = ?",
                session.sessionId(),
                session.url(),
                session.expiresAt() == null ? null : Timestamp.from(session.expiresAt()),
                Timestamp.from(now),
                id);
        return new PaymentDtos.CheckoutStarted(id, session.url());
    }

    // ---------------------------------------------------------------- webhook

    /** Applies one verified Stripe event. Repeated deliveries of the same event do nothing. */
    @Transactional
    public void handle(PaymentGateway.GatewayEvent e) {
        int fresh =
                db.update(
                        "insert into payment_webhook_event (event_id, event_type, received_at)"
                                + " values (?, ?, ?) on conflict do nothing",
                        e.id(),
                        e.type(),
                        Timestamp.from(Instant.now(clock)));
        if (fresh == 0 || e.paymentId() == null) return;
        UUID paymentId;
        try {
            paymentId = UUID.fromString(e.paymentId());
        } catch (IllegalArgumentException ex) {
            return;
        }
        var contractIds =
                db.queryForList(
                        "select contract_id from payment where id = ?", UUID.class, paymentId);
        if (contractIds.isEmpty()) {
            log.warn("Evento {} para pagamento desconhecido {}", e.id(), paymentId);
            return;
        }
        var c = contracts.lockById(contractIds.get(0)).orElseThrow();
        var p = lockPayment(paymentId);
        var now = Instant.now(clock);
        switch (e.type()) {
            case "checkout.session.completed" -> {
                if ("paid".equals(e.paymentStatus())) markPaid(c, p, e.providerPaymentId(), now);
                else if (p.status().equals("PENDING")) {
                    db.update(
                            "update payment set status = 'PROCESSING', provider_payment_id = ?,"
                                    + " updated_at = ? where id = ?",
                            e.providerPaymentId(),
                            Timestamp.from(now),
                            p.id());
                }
            }
            case "checkout.session.async_payment_succeeded" ->
                    markPaid(c, p, e.providerPaymentId(), now);
            case "checkout.session.async_payment_failed" -> {
                if (p.status().equals("PENDING") || p.status().equals("PROCESSING")) {
                    setStatus(p.id(), "FAILED", now);
                    notifications.notify(
                            c.getClient(),
                            "PAYMENT_FAILED",
                            "Pagamento não confirmado: " + c.getTitle(),
                            "O boleto ou Pix não foi pago a tempo. Você pode tentar de novo.",
                            link(c));
                }
            }
            case "checkout.session.expired" -> {
                if (p.status().equals("PENDING")) setStatus(p.id(), "CANCELED", now);
            }
            default -> {}
        }
    }

    private void markPaid(Contract c, Row p, String providerPaymentId, Instant now) {
        boolean open = p.status().equals("PENDING") || p.status().equals("PROCESSING");
        boolean closed = p.status().equals("CANCELED") || p.status().equals("FAILED");
        if (!open && !closed) return;
        String providerId = providerPaymentId != null ? providerPaymentId : p.providerPaymentId();
        if (closed || c.getStatus() != ContractStatus.ACEITO) {
            // Money arrived for a payment the contract no longer expects (an old checkout paid
            // anyway, or a boleto paid after a cancellation): record it and give it back.
            db.update(
                    "update payment set paid_at = ?, provider_payment_id = ?, updated_at = ?"
                            + " where id = ?",
                    Timestamp.from(now),
                    providerId,
                    Timestamp.from(now),
                    p.id());
            ledger(p, "CHARGE", c.getClient().getId(), p.gross(), "Pagamento recebido", now);
            refund(
                    c,
                    lockPayment(p.id()),
                    "Reembolso: pagamento recebido depois que a contratação deixou de esperá-lo",
                    now);
            return;
        }
        db.update(
                "update payment set status = 'PAID', paid_at = ?, provider_payment_id = ?,"
                        + " updated_at = ? where id = ?",
                Timestamp.from(now),
                providerId,
                Timestamp.from(now),
                p.id());
        ledger(p, "CHARGE", c.getClient().getId(), p.gross(), "Pagamento recebido", now);
        ledger(p, "PLATFORM_FEE", null, p.fee(), "Comissão da plataforma", now);
        ledger(
                p,
                "ESCROW_HOLD",
                c.getFreelancer().getId(),
                p.net(),
                "Valor em custódia até a conclusão",
                now);
        notifications.notify(
                c.getFreelancer(),
                "PAYMENT_CONFIRMED",
                "Pagamento confirmado: " + c.getTitle(),
                "O valor está em custódia. Você já pode iniciar o serviço.",
                link(c));
        notifications.notify(
                c.getClient(),
                "PAYMENT_CONFIRMED",
                "Pagamento confirmado: " + c.getTitle(),
                "O valor fica em custódia e só é liberado ao profissional depois da conclusão.",
                link(c));
    }

    // ---------------------------------------------------------------- contract lifecycle

    /** Called before ACEITO becomes EM_ANDAMENTO. */
    public void requirePaidToStart(Contract c) {
        if (!gateway.enabled()) return;
        var live = livePayment(c.getId());
        if (live == null || !live.status().equals("PAID"))
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "O serviço começa depois que o pagamento do cliente for confirmado.");
    }

    /** Contract canceled (by a party before the start, or by the team in a dispute). */
    @Transactional
    public void onCanceled(Contract c, Instant now) {
        var p = livePayment(c.getId());
        if (p == null) return;
        switch (p.status()) {
            case "PAID" ->
                    refund(c, p, "Reembolso: contratação cancelada", now);
            case "PENDING" -> {
                closeCheckout(p);
                setStatus(p.id(), "CANCELED", now);
            }
            // PROCESSING is refunded when (and if) the money arrives; see markPaid.
            default -> {}
        }
    }

    /** Contract concluded (client, automatic confirmation or dispute decision). */
    @Transactional
    public void onCompleted(Contract c, Instant now) {
        var p = livePayment(c.getId());
        if (p == null || !p.status().equals("PAID")) return;
        db.update(
                "update payment set status = 'RELEASED', released_at = ?, updated_at = ?"
                        + " where id = ?",
                Timestamp.from(now),
                Timestamp.from(now),
                p.id());
        ledger(
                p,
                "PAYOUT_RELEASE",
                c.getFreelancer().getId(),
                p.net(),
                "Valor liberado após a conclusão",
                now);
        notifications.notify(
                c.getFreelancer(),
                "PAYMENT_RELEASED",
                "Valor liberado: " + c.getTitle(),
                "O valor do serviço, já descontada a comissão, está disponível na sua carteira.",
                "/carteira");
    }

    private void refund(Contract c, Row p, String reason, Instant now) {
        if ("STRIPE".equals(p.provider())) {
            if (p.providerPaymentId() == null)
                throw new IllegalStateException("Pagamento sem PaymentIntent: " + p.id());
            try {
                gateway.refund(p.providerPaymentId(), "refund-" + p.id());
            } catch (PaymentGateway.GatewayFailure e) {
                log.warn("Reembolso do pagamento {} falhou: {}", p.id(), e.getMessage());
                throw new ApiException(
                        HttpStatus.BAD_GATEWAY,
                        "Não foi possível estornar o pagamento agora. Tente novamente.");
            }
        }
        db.update(
                "update payment set status = 'REFUNDED', refunded_at = ?, updated_at = ?"
                        + " where id = ?",
                Timestamp.from(now),
                Timestamp.from(now),
                p.id());
        ledger(p, "REFUND", c.getClient().getId(), p.gross(), reason, now);
        notifications.notify(
                c.getClient(),
                "PAYMENT_REFUNDED",
                "Reembolso iniciado: " + c.getTitle(),
                "O valor pago volta pelo mesmo meio de pagamento. O prazo depende do banco.",
                link(c));
    }

    // ---------------------------------------------------------------- wallet

    public PaymentDtos.Wallet wallet(Jwt jwt) {
        var u = current.require(jwt);
        if (u.getRole() == Role.ADMIN)
            throw new ApiException(HttpStatus.FORBIDDEN, "Use o painel de transações.");
        var payments =
                db.query(
                        "select " + COLUMNS + FROM
                                + " where (p.client_id = ? or p.freelancer_id = ?)"
                                + " and p.status not in ('PENDING','CANCELED')"
                                + " order by p.created_at desc limit 200",
                        ROW,
                        u.getId(),
                        u.getId());
        var zero = BigDecimal.ZERO.setScale(2);
        if (u.getRole() == Role.FREELANCER) {
            var held =
                    sum(
                            "select sum(net_amount) from payment where freelancer_id = ?"
                                    + " and status = 'PAID'",
                            u.getId());
            var released = released(u.getId());
            var withdrawn = withdrawn(u.getId());
            return new PaymentDtos.Wallet(
                    gateway.enabled(),
                    feePercent,
                    held,
                    released.subtract(withdrawn),
                    released,
                    withdrawn,
                    zero,
                    zero,
                    payments.stream().map(Row::view).toList(),
                    withdrawals(u.getId()));
        }
        return new PaymentDtos.Wallet(
                gateway.enabled(),
                feePercent,
                sum(
                        "select sum(gross_amount) from payment where client_id = ?"
                                + " and status = 'PAID'",
                        u.getId()),
                zero,
                zero,
                zero,
                sum(
                        "select sum(gross_amount) from payment where client_id = ?"
                                + " and status in ('PAID','RELEASED')",
                        u.getId()),
                sum(
                        "select sum(gross_amount) from payment where client_id = ?"
                                + " and status = 'REFUNDED'",
                        u.getId()),
                payments.stream().map(Row::view).toList(),
                List.of());
    }

    @Transactional
    public PaymentDtos.WithdrawalView withdraw(Jwt jwt, PaymentDtos.RequestWithdrawal r) {
        var u = current.require(jwt);
        if (u.getRole() != Role.FREELANCER)
            throw new ApiException(HttpStatus.FORBIDDEN, "Somente profissionais fazem saques.");
        // Serialises withdrawals of the same account so two requests cannot spend one balance.
        users.lockById(u.getId()).orElseThrow();
        var amount = r.amount().setScale(2, RoundingMode.HALF_UP);
        var available = released(u.getId()).subtract(withdrawn(u.getId()));
        if (amount.compareTo(available) > 0)
            throw new ApiException(HttpStatus.CONFLICT, "Saldo disponível insuficiente.");
        var id = UUID.randomUUID();
        var now = Instant.now(clock);
        db.update(
                "insert into withdrawal (id, user_id, amount, status, created_at)"
                        + " values (?, ?, ?, 'SIMULATED', ?)",
                id,
                u.getId(),
                amount,
                Timestamp.from(now));
        return new PaymentDtos.WithdrawalView(id, amount, "SIMULATED", now);
    }

    public PaymentDtos.PaymentDetail detail(Jwt jwt, UUID id) {
        var u = current.require(jwt);
        var rows = db.query("select " + COLUMNS + FROM + " where p.id = ?", ROW, id);
        if (rows.isEmpty()) throw paymentNotFound();
        var p = rows.get(0);
        boolean allowed =
                u.getRole() == Role.ADMIN
                        || p.clientId().equals(u.getId())
                        || p.freelancerId().equals(u.getId());
        if (!allowed) throw paymentNotFound();
        var entries =
                db.query(
                        "select entry_type, amount, description, created_at from ledger_entry"
                                + " where payment_id = ? order by created_at, entry_type",
                        (rs, n) ->
                                new PaymentDtos.LedgerView(
                                        rs.getString("entry_type"),
                                        rs.getBigDecimal("amount"),
                                        rs.getString("description"),
                                        rs.getTimestamp("created_at").toInstant()),
                        id);
        return new PaymentDtos.PaymentDetail(p.view(), entries);
    }

    public PaymentDtos.AdminSummary admin(Jwt jwt) {
        var u = current.require(jwt);
        if (u.getRole() != Role.ADMIN)
            throw new ApiException(HttpStatus.FORBIDDEN, "Esta área é exclusiva da administração.");
        var payments =
                db.query(
                        "select " + COLUMNS + FROM
                                + " where p.status not in ('PENDING','CANCELED')"
                                + " order by p.created_at desc limit 500",
                        ROW);
        return new PaymentDtos.AdminSummary(
                sum("select sum(amount) from ledger_entry where entry_type = 'CHARGE'"),
                sum("select sum(fee_amount) from payment where status in ('PAID','RELEASED')"),
                sum("select sum(gross_amount) from payment where status = 'PAID'"),
                sum("select sum(net_amount) from payment where status = 'RELEASED'"),
                sum("select sum(gross_amount) from payment where status = 'REFUNDED'"),
                sum("select sum(amount) from withdrawal"),
                payments.stream().map(Row::view).toList());
    }

    // ---------------------------------------------------------------- demo data

    /**
     * Demo seed only: records a payment that went through the escrow flow without Stripe
     * (provider SIMULATED), so wallets and the admin panel have history. Does nothing if the
     * contract already has a live payment.
     */
    @Transactional
    public void recordSimulated(Contract c, boolean released, Instant paidAt, Instant releasedAt) {
        if (livePayment(c.getId()) != null) return;
        BigDecimal gross = c.getPrice().setScale(2, RoundingMode.HALF_UP);
        BigDecimal fee =
                gross.multiply(feePercent)
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        var id = UUID.randomUUID();
        db.update(
                "insert into payment (id, contract_id, client_id, freelancer_id, provider, method,"
                        + " status, gross_amount, fee_amount, net_amount, created_at, updated_at,"
                        + " paid_at) values (?, ?, ?, ?, 'SIMULATED', 'PIX', 'PAID', ?, ?, ?, ?,"
                        + " ?, ?)",
                id,
                c.getId(),
                c.getClient().getId(),
                c.getFreelancer().getId(),
                gross,
                fee,
                gross.subtract(fee),
                Timestamp.from(paidAt),
                Timestamp.from(paidAt),
                Timestamp.from(paidAt));
        var p = lockPayment(id);
        ledger(p, "CHARGE", c.getClient().getId(), gross, "Pagamento recebido", paidAt);
        ledger(p, "PLATFORM_FEE", null, fee, "Comissão da plataforma", paidAt);
        ledger(
                p,
                "ESCROW_HOLD",
                c.getFreelancer().getId(),
                p.net(),
                "Valor em custódia até a conclusão",
                paidAt);
        if (!released) return;
        db.update(
                "update payment set status = 'RELEASED', released_at = ?, updated_at = ?"
                        + " where id = ?",
                Timestamp.from(releasedAt),
                Timestamp.from(releasedAt),
                id);
        ledger(
                p,
                "PAYOUT_RELEASE",
                c.getFreelancer().getId(),
                p.net(),
                "Valor liberado após a conclusão",
                releasedAt);
    }

    // ---------------------------------------------------------------- helpers

    private Row livePayment(UUID contractId) {
        var rows =
                db.query(
                        "select " + COLUMNS + FROM
                                + " where p.contract_id = ? and p.status in " + LIVE
                                + " for update of p",
                        ROW,
                        contractId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Row lockPayment(UUID id) {
        return db.query("select " + COLUMNS + FROM + " where p.id = ? for update of p", ROW, id)
                .get(0);
    }

    private void setStatus(UUID id, String status, Instant now) {
        db.update(
                "update payment set status = ?, updated_at = ? where id = ?",
                status,
                Timestamp.from(now),
                id);
    }

    private void closeCheckout(Row p) {
        if (p.sessionId() == null || !"STRIPE".equals(p.provider())) return;
        try {
            gateway.expireCheckout(p.sessionId());
        } catch (PaymentGateway.GatewayFailure e) {
            // If the old session is paid anyway, the webhook sees a payment that is no longer
            // live for the contract and refunds it.
            log.warn("Checkout {} não foi encerrado: {}", p.sessionId(), e.getMessage());
        }
    }

    private void ledger(
            Row p, String type, UUID userId, BigDecimal amount, String description, Instant at) {
        if (amount.signum() <= 0) return;
        db.update(
                "insert into ledger_entry (id, payment_id, contract_id, user_id, entry_type,"
                        + " amount, description, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
                UUID.randomUUID(),
                p.id(),
                p.contractId(),
                userId,
                type,
                amount,
                description,
                Timestamp.from(at));
    }

    private BigDecimal released(UUID userId) {
        return sum(
                "select sum(amount) from ledger_entry where user_id = ?"
                        + " and entry_type = 'PAYOUT_RELEASE'",
                userId);
    }

    private BigDecimal withdrawn(UUID userId) {
        return sum("select sum(amount) from withdrawal where user_id = ?", userId);
    }

    private List<PaymentDtos.WithdrawalView> withdrawals(UUID userId) {
        return db.query(
                "select id, amount, status, created_at from withdrawal where user_id = ?"
                        + " order by created_at desc limit 100",
                (rs, n) ->
                        new PaymentDtos.WithdrawalView(
                                rs.getObject("id", UUID.class),
                                rs.getBigDecimal("amount"),
                                rs.getString("status"),
                                rs.getTimestamp("created_at").toInstant()),
                userId);
    }

    private BigDecimal sum(String sql, Object... args) {
        var value = db.queryForObject(sql, BigDecimal.class, args);
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private static void ensureParticipantOrAdmin(User u, Contract c) {
        boolean allowed =
                switch (u.getRole()) {
                    case ADMIN -> true;
                    case CLIENT -> c.getClient().getId().equals(u.getId());
                    case FREELANCER -> c.getFreelancer().getId().equals(u.getId());
                };
        if (!allowed)
            throw new ApiException(HttpStatus.FORBIDDEN, "Você não participa desta contratação.");
    }

    private static String link(Contract c) {
        return "/contratacoes/" + c.getId();
    }

    private static ApiException contractNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Contratação não encontrada.");
    }

    private static ApiException paymentNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Pagamento não encontrado.");
    }
}
