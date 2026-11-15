package br.com.freelancenow.api.payments;

import java.math.BigDecimal;
import java.time.Instant;
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

    /**
     * A Checkout Session event. {@code paymentId} comes from the session metadata; {@code
     * paymentStatus} is Stripe's ("paid", "unpaid", "no_payment_required").
     */
    record GatewayEvent(
            String id,
            String type,
            String sessionId,
            String providerPaymentId,
            String paymentStatus,
            String paymentId) {}

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
