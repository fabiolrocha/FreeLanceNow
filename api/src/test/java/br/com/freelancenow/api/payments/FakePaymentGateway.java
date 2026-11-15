package br.com.freelancenow.api.payments;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * In-memory Stripe for integration tests. Webhook bodies use a pipe format instead of Stripe's
 * JSON ({@code id|type|sessionId|paymentIntent|paymentStatus|paymentId}) and the only valid
 * signature is {@code valid}; the real signature check is covered by StripePaymentGatewayTests.
 */
public class FakePaymentGateway implements PaymentGateway {
    public final List<CheckoutRequest> checkouts = new CopyOnWriteArrayList<>();
    public final List<String> expired = new CopyOnWriteArrayList<>();
    public final List<String> refunds = new CopyOnWriteArrayList<>();

    @Override
    public boolean enabled() {
        return true;
    }

    @Override
    public Checkout createCheckout(CheckoutRequest r) {
        checkouts.add(r);
        return new Checkout(
                sessionId(r.paymentId().toString()),
                "https://checkout.test/" + r.paymentId(),
                Instant.now().plus(1, ChronoUnit.DAYS));
    }

    @Override
    public void expireCheckout(String sessionId) {
        expired.add(sessionId);
    }

    @Override
    public void refund(String providerPaymentId, String idempotencyKey) {
        refunds.add(providerPaymentId);
    }

    @Override
    public GatewayEvent parseWebhook(String payload, String signatureHeader) {
        if (!"valid".equals(signatureHeader)) throw new InvalidWebhook("Assinatura inválida");
        var p = payload.split("\\|", -1);
        return new GatewayEvent(p[0], p[1], p[2], p[3], p[4], p[5]);
    }

    public static String sessionId(String paymentId) {
        return "cs_test_" + paymentId;
    }

    public static String intentId(String paymentId) {
        return "pi_test_" + paymentId;
    }
}
