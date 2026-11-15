package br.com.freelancenow.api.payments;

import static org.junit.jupiter.api.Assertions.*;

import com.stripe.Stripe;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Signature and parsing of real Stripe webhook payloads, without network access. */
class StripePaymentGatewayTests {
    private static final String SECRET = "whsec_test_only_secret";

    private static String sign(String payload, String secret) throws Exception {
        long t = Instant.now().getEpochSecond();
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        var digest = mac.doFinal((t + "." + payload).getBytes(StandardCharsets.UTF_8));
        return "t=" + t + ",v1=" + HexFormat.of().formatHex(digest);
    }

    private static String sessionEvent(String type, String paymentStatus) {
        return """
                {
                  "id": "evt_test_1",
                  "object": "event",
                  "api_version": "%s",
                  "created": 1763200000,
                  "type": "%s",
                  "data": {
                    "object": {
                      "id": "cs_test_1",
                      "object": "checkout.session",
                      "payment_intent": "pi_test_1",
                      "payment_status": "%s",
                      "client_reference_id": "11111111-1111-1111-1111-111111111111",
                      "metadata": {
                        "paymentId": "22222222-2222-2222-2222-222222222222",
                        "contractId": "33333333-3333-3333-3333-333333333333"
                      }
                    }
                  }
                }
                """
                .formatted(Stripe.API_VERSION, type, paymentStatus);
    }

    @Test
    void validSignatureYieldsTheCheckoutSessionFields() throws Exception {
        var gateway = new StripePaymentGateway("sk_test_dummy", SECRET);
        var payload = sessionEvent("checkout.session.completed", "paid");

        var event = gateway.parseWebhook(payload, sign(payload, SECRET));

        assertEquals("evt_test_1", event.id());
        assertEquals("checkout.session.completed", event.type());
        assertEquals("cs_test_1", event.sessionId());
        assertEquals("pi_test_1", event.providerPaymentId());
        assertEquals("paid", event.paymentStatus());
        assertEquals("22222222-2222-2222-2222-222222222222", event.paymentId());
    }

    @Test
    void wrongSecretTamperedBodyOrMissingHeaderAreRejected() throws Exception {
        var gateway = new StripePaymentGateway("sk_test_dummy", SECRET);
        var payload = sessionEvent("checkout.session.completed", "paid");

        assertThrows(
                PaymentGateway.InvalidWebhook.class,
                () -> gateway.parseWebhook(payload, sign(payload, "whsec_other")));
        var header = sign(payload, SECRET);
        assertThrows(
                PaymentGateway.InvalidWebhook.class,
                () -> gateway.parseWebhook(payload.replace("paid", "unpaid"), header));
        assertThrows(PaymentGateway.InvalidWebhook.class, () -> gateway.parseWebhook(payload, ""));
        var noSecret = new StripePaymentGateway("sk_test_dummy", "");
        assertThrows(
                PaymentGateway.InvalidWebhook.class,
                () -> noSecret.parseWebhook(payload, header));
    }

    @Test
    void otherEventTypesCarryNoSession() throws Exception {
        var gateway = new StripePaymentGateway("sk_test_dummy", SECRET);
        var payload =
                """
                {"id":"evt_2","object":"event","api_version":"%s","type":"charge.updated",
                 "data":{"object":{"id":"ch_1","object":"charge"}}}
                """
                        .formatted(Stripe.API_VERSION);
        var event = gateway.parseWebhook(payload, sign(payload, SECRET));
        assertEquals("charge.updated", event.type());
        assertNull(event.paymentId());
    }

    @Test
    void disabledWithoutKeyAndRefusesLiveKeys() {
        assertFalse(new StripePaymentGateway("", "").enabled());
        assertTrue(new StripePaymentGateway("sk_test_dummy", "").enabled());
        assertThrows(
                IllegalStateException.class, () -> new StripePaymentGateway("sk_live_x", ""));
    }
}
