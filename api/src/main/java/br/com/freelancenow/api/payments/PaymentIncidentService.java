package br.com.freelancenow.api.payments;

import br.com.freelancenow.api.contracts.Contract;
import br.com.freelancenow.api.contracts.ContractRepository;
import br.com.freelancenow.api.contracts.ContractStatus;
import br.com.freelancenow.api.notifications.NotificationService;
import br.com.freelancenow.api.users.Role;
import br.com.freelancenow.api.users.UserRepository;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Events that start outside the app (ADR34): a refund made in the Stripe dashboard (total or
 * partial), a refund that failed, and chargebacks. Runs inside the webhook transaction, after the
 * event id was recorded, so a repeated delivery does nothing. Lock order: contract, then payment.
 *
 * <p>Money already transferred to the freelancer is taken back with a transfer reversal, so that
 * what the freelancer kept never exceeds their share: {@code net} minus the net part of what was
 * refunded ({@link #freelancerLoss}); the platform absorbs the fee part of a partial refund.
 */
@Service
public class PaymentIncidentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentIncidentService.class);

    private final JdbcTemplate db;
    private final PaymentGateway gateway;
    private final ContractRepository contracts;
    private final UserRepository users;
    private final NotificationService notifications;
    private final PayoutTransferService transfers;
    private final Clock clock;

    public PaymentIncidentService(
            JdbcTemplate db,
            PaymentGateway gateway,
            ContractRepository contracts,
            UserRepository users,
            NotificationService notifications,
            PayoutTransferService transfers,
            Clock clock) {
        this.db = db;
        this.gateway = gateway;
        this.contracts = contracts;
        this.users = users;
        this.notifications = notifications;
        this.transfers = transfers;
        this.clock = clock;
    }

    /** The freelancer's part of a refunded amount, rounded down to cents. */
    static BigDecimal freelancerLoss(BigDecimal refunded, BigDecimal gross, BigDecimal net) {
        if (refunded == null || refunded.signum() <= 0) return BigDecimal.ZERO.setScale(2);
        return refunded.multiply(net).divide(gross, 2, RoundingMode.DOWN).min(net);
    }

    void handle(PaymentGateway.GatewayEvent e) {
        var ids = findPayment(e.providerPaymentId(), e.chargeId());
        if (ids == null) {
            log.info("Evento {} sem pagamento conhecido ({})", e.type(), e.providerPaymentId());
            return;
        }
        var c = contracts.lockById(ids.contractId()).orElseThrow();
        var p =
                db.queryForMap(
                        "select id, status, gross_amount, net_amount, refunded_amount,"
                                + " reversed_amount, transfer_id, dispute_id, dispute_status,"
                                + " provider_payment_id, provider_charge_id"
                                + " from payment where id = ? for update",
                        ids.paymentId());
        if (p.get("provider_charge_id") == null && e.chargeId() != null)
            db.update(
                    "update payment set provider_charge_id = ? where id = ?",
                    e.chargeId(),
                    ids.paymentId());
        var now = Instant.now(clock);
        switch (e.type()) {
            case "charge.refunded" -> refunded(c, p, e, now);
            case "refund.failed" -> refundFailed(c, p, e, now);
            case "charge.dispute.created" -> disputeOpened(c, p, e, now);
            case "charge.dispute.closed" -> disputeClosed(c, p, e, now);
            default -> {}
        }
    }

    private record Ids(UUID paymentId, UUID contractId) {}

    private Ids findPayment(String paymentIntent, String charge) {
        var rows =
                db.query(
                        "select id, contract_id from payment where provider = 'STRIPE' and"
                                + " (provider_payment_id = ? or provider_charge_id = ?)"
                                + " order by created_at desc limit 1",
                        (rs, n) ->
                                new Ids(
                                        rs.getObject("id", UUID.class),
                                        rs.getObject("contract_id", UUID.class)),
                        paymentIntent,
                        charge);
        return rows.isEmpty() ? null : rows.get(0);
    }

    // ------------------------------------------------------------------ refunds

    /** {@code amount} is the total refunded so far, so a repeated or late event adds nothing. */
    private void refunded(Contract c, Map<String, Object> p, PaymentGateway.GatewayEvent e, Instant now) {
        if (e.amount() == null) return;
        var id = (UUID) p.get("id");
        var gross = (BigDecimal) p.get("gross_amount");
        var total = e.amount().min(gross);
        var before = (BigDecimal) p.get("refunded_amount");
        var added = total.subtract(before);
        // The app's own refund already wrote it (the column holds the full amount).
        if (added.signum() <= 0) return;
        boolean full = total.compareTo(gross) >= 0;
        String status = (String) p.get("status");
        db.update(
                "update payment set refunded_amount = ?,"
                        + " status = case when ? then 'REFUNDED' else status end,"
                        + " refunded_at = case when ? then ? else refunded_at end,"
                        + " updated_at = ? where id = ?",
                total,
                full,
                full,
                Timestamp.from(now),
                Timestamp.from(now),
                id);
        ledger(
                id,
                c,
                c.getClient().getId(),
                "REFUND",
                added,
                full ? "Reembolso feito pelo painel do Stripe" : "Reembolso parcial pelo painel do Stripe",
                now);
        notifications.notify(
                c.getClient(),
                "PAYMENT_REFUNDED",
                (full ? "Reembolso: " : "Reembolso parcial: ") + c.getTitle(),
                money(added) + " volta pelo mesmo meio de pagamento. O prazo depende do banco.",
                link(c));
        if (!"PAID".equals(status) && !"RELEASED".equals(status)) return;
        var net = (BigDecimal) p.get("net_amount");
        var loss = freelancerLoss(total, gross, net);
        if (loss.signum() > 0)
            notifications.notify(
                    c.getFreelancer(),
                    "PAYMENT_ADJUSTED",
                    "Valor ajustado: " + c.getTitle(),
                    "O cliente recebeu um reembolso pelo Stripe. A sua parte diminuiu "
                            + money(loss.subtract(freelancerLoss(before, gross, net)))
                            + ".",
                    "/carteira");
        reverseExcess(
                c,
                p,
                net.subtract(loss),
                "reversal-refund-" + id + "-" + total.movePointRight(2).toBigInteger(),
                "Estorno de transferência: reembolso ao cliente",
                now);
    }

    private void refundFailed(
            Contract c, Map<String, Object> p, PaymentGateway.GatewayEvent e, Instant now) {
        var id = (UUID) p.get("id");
        if ("REFUNDED".equals(p.get("status")))
            db.update(
                    "update payment set status = 'REFUND_FAILED', updated_at = ? where id = ?",
                    Timestamp.from(now),
                    id);
        String reason = e.detail() == null ? "" : " Motivo informado pelo Stripe: " + e.detail() + ".";
        notifications.notify(
                c.getClient(),
                "REFUND_FAILED",
                "Reembolso não concluído: " + c.getTitle(),
                "O banco recusou a devolução de "
                        + money(e.amount())
                        + ". A equipe do FreeLanceNow vai entrar em contato.",
                link(c));
        admins(
                "REFUND_FAILED",
                "Reembolso com falha: " + c.getTitle(),
                "Reembolso de " + money(e.amount()) + " recusado." + reason);
    }

    // ------------------------------------------------------------------ chargebacks

    private void disputeOpened(
            Contract c, Map<String, Object> p, PaymentGateway.GatewayEvent e, Instant now) {
        var id = (UUID) p.get("id");
        if (e.objectId() != null && e.objectId().equals(p.get("dispute_id"))) return;
        var amount = e.amount() == null ? (BigDecimal) p.get("gross_amount") : e.amount();
        if (e.detail() != null && e.detail().startsWith("warning_")) {
            // An inquiry: the bank asks questions but takes no money. Only the team acts.
            admins(
                    "CHARGEBACK_INQUIRY",
                    "Consulta do banco: " + c.getTitle(),
                    "O banco do cliente pediu informações sobre "
                            + money(amount)
                            + ". Responda pelo painel do Stripe; nenhum valor foi retirado.");
            return;
        }
        db.update(
                "update payment set dispute_id = ?, dispute_status = 'OPEN', updated_at = ?"
                        + " where id = ?",
                e.objectId(),
                Timestamp.from(now),
                id);
        ledger(id, c, c.getClient().getId(), "CHARGEBACK", amount, "Contestação aberta no banco", now);
        String body =
                "O cliente contestou "
                        + money(amount)
                        + " no banco. Enquanto o banco decide, o valor não é transferido.";
        notifications.notify(c.getFreelancer(), "CHARGEBACK_OPENED", "Contestação: " + c.getTitle(), body, link(c));
        notifications.notify(
                c.getClient(),
                "CHARGEBACK_OPENED",
                "Contestação registrada: " + c.getTitle(),
                "Recebemos a contestação do pagamento feita no seu banco. Vamos acompanhar o resultado.",
                link(c));
        admins("CHARGEBACK_OPENED", "Chargeback aberto: " + c.getTitle(), body + " Responda pelo painel do Stripe.");
    }

    private void disputeClosed(
            Contract c, Map<String, Object> p, PaymentGateway.GatewayEvent e, Instant now) {
        var id = (UUID) p.get("id");
        if (!"OPEN".equals(p.get("dispute_status"))) return;
        String result = e.detail() == null ? "" : e.detail();
        boolean won = result.equals("won") || result.equals("warning_closed");
        if (!won && !result.equals("lost")) {
            log.info("Chargeback {} terminou como {}", e.objectId(), result);
            return;
        }
        var amount = e.amount() == null ? (BigDecimal) p.get("gross_amount") : e.amount();
        if (won) {
            db.update(
                    "update payment set dispute_status = 'WON', updated_at = ? where id = ?",
                    Timestamp.from(now),
                    id);
            ledger(id, c, c.getClient().getId(), "CHARGEBACK_REVERSAL", amount, "Contestação decidida a favor da plataforma", now);
            if (c.getStatus() == ContractStatus.CANCELADO && "PAID".equals(p.get("status"))) {
                // Canceled while the chargeback was open: the refund was waiting for this.
                refundAfterDispute(c, p, now);
            } else if ("RELEASED".equals(p.get("status"))) {
                PayoutTransferService.afterCommit(() -> transfers.transfer(id, true));
            }
            String body = "O banco manteve o pagamento. Nada muda para você.";
            notifications.notify(c.getFreelancer(), "CHARGEBACK_CLOSED", "Contestação encerrada: " + c.getTitle(), body, link(c));
            admins("CHARGEBACK_CLOSED", "Chargeback ganho: " + c.getTitle(), "O banco manteve " + money(amount) + ".");
            return;
        }
        db.update(
                "update payment set dispute_status = 'LOST', status = 'CHARGED_BACK',"
                        + " updated_at = ? where id = ?",
                Timestamp.from(now),
                id);
        reverseExcess(
                c,
                p,
                BigDecimal.ZERO,
                "reversal-dispute-" + e.objectId(),
                "Estorno de transferência: contestação perdida",
                now);
        notifications.notify(
                c.getFreelancer(),
                "CHARGEBACK_CLOSED",
                "Contestação perdida: " + c.getTitle(),
                "O banco devolveu o pagamento ao cliente. O valor deste serviço não será pago.",
                link(c));
        notifications.notify(
                c.getClient(),
                "CHARGEBACK_CLOSED",
                "Contestação encerrada: " + c.getTitle(),
                "O banco decidiu a seu favor e devolveu " + money(amount) + ".",
                link(c));
        admins("CHARGEBACK_CLOSED", "Chargeback perdido: " + c.getTitle(), "O banco devolveu " + money(amount) + " ao cliente.");
    }

    /** Same as the app's own refund, for a contract canceled during a chargeback. */
    private void refundAfterDispute(Contract c, Map<String, Object> p, Instant now) {
        var id = (UUID) p.get("id");
        var gross = (BigDecimal) p.get("gross_amount");
        try {
            gateway.refund((String) p.get("provider_payment_id"), "refund-" + id);
        } catch (PaymentGateway.GatewayFailure ex) {
            log.warn("Reembolso do pagamento {} falhou: {}", id, ex.getMessage());
            admins(
                    "REFUND_FAILED",
                    "Reembolso pendente: " + c.getTitle(),
                    "A contratação foi cancelada e o chargeback foi ganho, mas o reembolso ao cliente falhou. Faça-o pelo painel do Stripe.");
            return;
        }
        db.update(
                "update payment set status = 'REFUNDED', refunded_amount = gross_amount,"
                        + " refunded_at = ?, updated_at = ? where id = ?",
                Timestamp.from(now),
                Timestamp.from(now),
                id);
        ledger(id, c, c.getClient().getId(), "REFUND", gross, "Reembolso: contratação cancelada", now);
        notifications.notify(
                c.getClient(),
                "PAYMENT_REFUNDED",
                "Reembolso iniciado: " + c.getTitle(),
                "O valor pago volta pelo mesmo meio de pagamento. O prazo depende do banco.",
                link(c));
    }

    // ------------------------------------------------------------------ helpers

    /**
     * Takes back from the freelancer's account whatever they received above {@code entitled}.
     * A failure (their Stripe balance may be too low) is recorded and shown to the admin: the
     * platform covers it, as Connect foresees.
     */
    private void reverseExcess(
            Contract c,
            Map<String, Object> p,
            BigDecimal entitled,
            String key,
            String description,
            Instant now) {
        var transferId = (String) p.get("transfer_id");
        if (transferId == null) return;
        var id = (UUID) p.get("id");
        var sent =
                db.queryForObject(
                        "select coalesce(sum(amount), 0) from ledger_entry where payment_id = ?"
                                + " and entry_type = 'TRANSFER'",
                        BigDecimal.class,
                        id);
        var reversed = (BigDecimal) p.get("reversed_amount");
        var excess = sent.subtract(reversed).subtract(entitled.max(BigDecimal.ZERO));
        if (excess.signum() <= 0) return;
        try {
            gateway.reverseTransfer(transferId, excess, key);
        } catch (PaymentGateway.GatewayFailure ex) {
            String message = "Estorno: " + ex.getMessage();
            if (message.length() > 500) message = message.substring(0, 500);
            log.warn("Estorno da transferência {} falhou: {}", transferId, ex.getMessage());
            db.update(
                    "update payment set transfer_error = ?, updated_at = ? where id = ?",
                    message,
                    Timestamp.from(now),
                    id);
            admins(
                    "TRANSFER_REVERSAL_FAILED",
                    "Estorno não feito: " + c.getTitle(),
                    "Não foi possível tirar "
                            + money(excess)
                            + " da conta do profissional. A plataforma arca com a diferença.");
            return;
        }
        db.update(
                "update payment set reversed_amount = reversed_amount + ?, updated_at = ?"
                        + " where id = ?",
                excess,
                Timestamp.from(now),
                id);
        ledger(id, c, c.getFreelancer().getId(), "TRANSFER_REVERSAL", excess, description, now);
    }

    private void ledger(
            UUID paymentId,
            Contract c,
            UUID userId,
            String type,
            BigDecimal amount,
            String description,
            Instant now) {
        if (amount == null || amount.signum() <= 0) return;
        db.update(
                "insert into ledger_entry (id, payment_id, contract_id, user_id, entry_type,"
                        + " amount, description, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
                UUID.randomUUID(),
                paymentId,
                c.getId(),
                userId,
                type,
                amount,
                description,
                Timestamp.from(now));
    }

    private void admins(String type, String title, String body) {
        for (var admin : users.findByRoleAndActiveTrue(Role.ADMIN))
            notifications.notify(admin, type, title, body, "/admin/transacoes");
    }

    static String money(BigDecimal amount) {
        if (amount == null) return "o valor";
        return "R$ " + String.format(Locale.of("pt", "BR"), "%,.2f", amount);
    }

    private static String link(Contract c) {
        return "/contratacoes/" + c.getId();
    }
}
