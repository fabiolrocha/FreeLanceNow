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
            Instant refundedAt) {}

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
     * Balances in reais. Freelancer: {@code held} is paid and still in escrow, {@code available}
     * is released minus withdrawals. Client: {@code paid} covers payments not refunded, {@code
     * held} the part still in escrow.
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
            List<PaymentView> payments,
            List<WithdrawalView> withdrawals) {}

    public record AdminSummary(
            BigDecimal received,
            BigDecimal fees,
            BigDecimal held,
            BigDecimal released,
            BigDecimal refunded,
            BigDecimal withdrawn,
            List<PaymentView> payments) {}
}
