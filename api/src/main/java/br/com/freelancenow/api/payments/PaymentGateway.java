package br.com.freelancenow.api.payments;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The payment provider as the rest of the API sees it. Production uses Stripe Checkout; tests
 * replace it with an in-memory fake, so no test talks to Stripe.
 */
public interface PaymentGateway {
    /** False when no secret key is configured: contracts then work without payment. */
    boolean enabled();

    Checkout createCheckout(CheckoutRequest request);

    /** Closes an open Checkout Session. Does nothing if it already finished or expired. */
    void expireCheckout(String sessionId);

    /** Full refund of a captured payment. Same key, same refund: safe to retry. */
    void refund(String providerPaymentId, String idempotencyKey);

    /**
     * Creates the freelancer's connected account: Brazil, no Stripe Dashboard (the app embeds
     * Stripe's components). Same user, same account: safe to retry.
     */
    String createConnectedAccount(UUID userId, String email, String name);

    /** Client secret for the embedded onboarding, account management and payouts components. */
    String createAccountSession(String accountId);

    ConnectedAccount retrieveAccount(String accountId);

    /** The charge behind a PaymentIntent ({@code latest_charge}), needed to tie a transfer to it. */
    String chargeOf(String paymentIntentId);

    /**
     * Sends money from the platform to a connected account. Same payment, same transfer: safe to
     * retry. Returns the transfer id.
     */
    String transfer(TransferRequest request);

    /**
     * Gives back part or all of a transfer (a refund or a lost chargeback reached money already
     * sent to the freelancer). Returns the reversal id; the same key never reverses twice.
     */
    String reverseTransfer(String transferId, BigDecimal amount, String idempotencyKey);

    /** Verifies the signature and reads the event. Throws {@link InvalidWebhook} otherwise. */
    GatewayEvent parseWebhook(String payload, String signatureHeader);

    record CheckoutRequest(
            UUID paymentId,
            UUID contractId,
            String title,
            BigDecimal amount,
            PaymentMethod method,
            String customerEmail,
            String successUrl,
            String cancelUrl) {}

    record Checkout(String sessionId, String url, Instant expiresAt) {}

    /** {@code sourceCharge} makes Stripe wait for that charge's funds instead of failing. */
    record TransferRequest(
            UUID paymentId,
            String destination,
            BigDecimal amount,
            String sourceCharge,
            String transferGroup) {}

    /**
     * What the app needs from a connected account. {@code transfersEnabled} means the {@code
     * transfers} capability is active, so released money can be sent to it.
     */
    record ConnectedAccount(
            String id,
            boolean detailsSubmitted,
            boolean transfersEnabled,
            boolean payoutsEnabled,
            List<String> currentlyDue) {}

    /**
     * A verified Stripe event. Checkout Session events fill {@code sessionId} to {@code
     * paymentId} ({@code paymentId} comes from the session metadata; {@code paymentStatus} is
     * Stripe's "paid", "unpaid" or "no_payment_required"). Events of a connected account carry
     * its id in {@code account}; for those, {@code objectId}, {@code amount} (reais) and {@code
     * detail} (a failure message) describe the object, such as a payout. Charge, refund and
     * dispute events of the platform fill {@code providerPaymentId} (the PaymentIntent), {@code
     * chargeId}, {@code objectId} (the refund or dispute), {@code amount} (for {@code
     * charge.refunded}, the total refunded so far) and {@code detail} (dispute status or refund
     * failure reason).
     */
    record GatewayEvent(
            String id,
            String type,
            String sessionId,
            String providerPaymentId,
            String paymentStatus,
            String paymentId,
            String account,
            String objectId,
            BigDecimal amount,
            String detail,
            String chargeId) {
        public GatewayEvent(
                String id,
                String type,
                String sessionId,
                String providerPaymentId,
                String paymentStatus,
                String paymentId) {
            this(
                    id,
                    type,
                    sessionId,
                    providerPaymentId,
                    paymentStatus,
                    paymentId,
                    null,
                    null,
                    null,
                    null,
                    null);
        }
    }

    class InvalidWebhook extends RuntimeException {
        public InvalidWebhook(String message) {
            super(message);
        }
    }

    class GatewayFailure extends RuntimeException {
        public GatewayFailure(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
