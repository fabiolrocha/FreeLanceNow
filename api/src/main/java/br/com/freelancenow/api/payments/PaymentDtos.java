package br.com.freelancenow.api.payments;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class PaymentDtos {
    private PaymentDtos() {}

    public record StartCheckout(@NotNull PaymentMethod method) {}

    public record CheckoutStarted(UUID paymentId, String checkoutUrl) {}

    public record RequestWithdrawal(
            @NotNull
                    @DecimalMin(value = "1.00", message = "O valor mínimo é R$ 1,00.")
                    @DecimalMax(value = "100000.00")
                    @Digits(integer = 10, fraction = 2)
                    BigDecimal amount) {}

    public record PaymentView(
            UUID id,
            UUID contractId,
            String contractTitle,
            String clientName,
            String freelancerName,
            String provider,
            PaymentMethod method,
            String status,
            BigDecimal grossAmount,
            BigDecimal feeAmount,
            BigDecimal netAmount,
            Instant createdAt,
            Instant paidAt,
            Instant releasedAt,
            Instant refundedAt,
            Instant transferredAt,
            boolean transferPending,
            BigDecimal refundedAmount,
            /** OPEN, WON or LOST when the client opened a chargeback, else null. */
            String disputeStatus) {}

    /**
     * What a contract page needs: whether payment is required at all, which methods the client
     * can pick, the fee and the latest payment (null if none was started).
     */
    public record ContractPayment(
            boolean enabled,
            List<PaymentMethod> methods,
            BigDecimal feePercent,
            PaymentView payment) {}

    public record LedgerView(String type, BigDecimal amount, String description, Instant at) {}

    public record PaymentDetail(PaymentView payment, List<LedgerView> entries) {}

    public record WithdrawalView(UUID id, BigDecimal amount, String status, Instant createdAt) {}

    /**
     * Balances in reais. Freelancer: {@code held} is paid and still in escrow, {@code released}
     * is everything released, {@code available} is released demo money (provider SIMULATED)
     * minus simulated withdrawals, {@code transferred} already went to the Stripe receiving
     * account and {@code awaitingAccount} is released through Stripe but waiting for that
     * account. Client: {@code paid} covers payments not refunded, {@code held} the part still in
     * escrow.
     */
    public record Wallet(
            boolean enabled,
            BigDecimal feePercent,
            BigDecimal held,
            BigDecimal available,
            BigDecimal released,
            BigDecimal withdrawn,
            BigDecimal paid,
            BigDecimal refunded,
            BigDecimal transferred,
            BigDecimal awaitingAccount,
            List<PaymentView> payments,
            List<WithdrawalView> withdrawals) {}

    /**
     * The freelancer's receiving account. {@code status}: DISABLED (no Stripe in this
     * environment), NOT_STARTED, INCOMPLETE (form not finished or Stripe asks for more), IN_REVIEW
     * (submitted, Stripe still verifying) or READY (released money can be transferred).
     */
    public record PayoutAccountView(
            boolean enabled,
            String status,
            boolean transfersEnabled,
            boolean payoutsEnabled,
            List<String> currentlyDue) {
        static PayoutAccountView disabled() {
            return new PayoutAccountView(false, "DISABLED", false, false, List.of());
        }

        static PayoutAccountView notStarted() {
            return new PayoutAccountView(true, "NOT_STARTED", false, false, List.of());
        }
    }

    /** What the browser needs to load Stripe's embedded components (both values are public). */
    public record AccountSessionStarted(String clientSecret, String publishableKey) {}

    /**
     * Admin totals. {@code transferred} went to freelancers' Stripe accounts, {@code reversed}
     * came back from them, {@code inChargeback} is under an open chargeback; {@code issues} lists
     * what needs attention.
     */
    public record AdminSummary(
            BigDecimal received,
            BigDecimal fees,
            BigDecimal held,
            BigDecimal released,
            BigDecimal refunded,
            BigDecimal withdrawn,
            BigDecimal transferred,
            BigDecimal reversed,
            BigDecimal inChargeback,
            List<AdminIssue> issues,
            List<PaymentView> payments) {}

    /**
     * A payment that needs the team: AWAITING_ACCOUNT (released, the freelancer has no ready
     * receiving account), TRANSFER_FAILED (Stripe refused the transfer; {@code retryable}),
     * REVERSAL_FAILED (money could not be taken back; the platform covers it), REFUND_FAILED or
     * CHARGEBACK_OPEN.
     */
    public record AdminIssue(
            UUID paymentId,
            UUID contractId,
            String kind,
            String contractTitle,
            String freelancerName,
            BigDecimal amount,
            String detail,
            boolean retryable) {}
}
