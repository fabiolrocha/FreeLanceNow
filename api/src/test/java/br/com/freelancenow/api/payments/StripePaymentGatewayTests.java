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
        var gateway = new StripePaymentGateway("sk_test_dummy", SECRET, "");
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
        var gateway = new StripePaymentGateway("sk_test_dummy", SECRET, "");
        var payload = sessionEvent("checkout.session.completed", "paid");

        assertThrows(
                PaymentGateway.InvalidWebhook.class,
                () -> gateway.parseWebhook(payload, sign(payload, "whsec_other")));
        var header = sign(payload, SECRET);
        assertThrows(
                PaymentGateway.InvalidWebhook.class,
                () -> gateway.parseWebhook(payload.replace("paid", "unpaid"), header));
        assertThrows(PaymentGateway.InvalidWebhook.class, () -> gateway.parseWebhook(payload, ""));
        var noSecret = new StripePaymentGateway("sk_test_dummy", "", "");
        assertThrows(
                PaymentGateway.InvalidWebhook.class,
                () -> noSecret.parseWebhook(payload, header));
    }

    @Test
    void connectSecretVerifiesPayoutEventsOfConnectedAccounts() throws Exception {
        var gateway = new StripePaymentGateway("sk_test_dummy", SECRET, "whsec_connect_only");
        var payload =
                """
                {"id":"evt_3","object":"event","api_version":"%s","type":"payout.failed",
                 "account":"acct_test_1",
                 "data":{"object":{"id":"po_1","object":"payout","amount":8100,
                  "failure_message":"Conta bancária fechada."}}}
                """
                        .formatted(Stripe.API_VERSION);
        var event = gateway.parseWebhook(payload, sign(payload, "whsec_connect_only"));
        assertEquals("payout.failed", event.type());
        assertEquals("acct_test_1", event.account());
        assertEquals("po_1", event.objectId());
        assertEquals(new java.math.BigDecimal("81.00"), event.amount());
        assertEquals("Conta bancária fechada.", event.detail());
        assertThrows(
                PaymentGateway.InvalidWebhook.class,
                () -> gateway.parseWebhook(payload, sign(payload, "whsec_other")));
    }

    @Test
    void chargeRefundAndDisputeEventsCarryPaymentIntentAndAmounts() {
        var refunded =
                StripePaymentGateway.chargeEvent(
                        "evt_4",
                        "charge.refunded",
                        """
                        {"data":{"object":{"id":"ch_1","object":"charge","payment_intent":"pi_1",
                         "amount":9000,"amount_refunded":3000}}}
                        """);
        assertEquals("pi_1", refunded.providerPaymentId());
        assertEquals("ch_1", refunded.chargeId());
        assertEquals(new java.math.BigDecimal("30.00"), refunded.amount());

        var dispute =
                StripePaymentGateway.chargeEvent(
                        "evt_5",
                        "charge.dispute.closed",
                        """
                        {"data":{"object":{"id":"dp_1","object":"dispute","charge":"ch_1",
                         "payment_intent":"pi_1","amount":9000,"status":"lost"}}}
                        """);
        assertEquals("dp_1", dispute.objectId());
        assertEquals("ch_1", dispute.chargeId());
        assertEquals("lost", dispute.detail());
        assertEquals(new java.math.BigDecimal("90.00"), dispute.amount());

        var failed =
                StripePaymentGateway.chargeEvent(
                        "evt_6",
                        "refund.failed",
                        """
                        {"data":{"object":{"id":"re_1","object":"refund","charge":"ch_1",
                         "payment_intent":"pi_1","amount":9000,"failure_reason":"lost_or_stolen_card"}}}
                        """);
        assertEquals("re_1", failed.objectId());
        assertEquals("lost_or_stolen_card", failed.detail());
    }

    @Test
    void otherEventTypesCarryNoSession() throws Exception {
        var gateway = new StripePaymentGateway("sk_test_dummy", SECRET, "");
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
        assertFalse(new StripePaymentGateway("", "", "").enabled());
        assertTrue(new StripePaymentGateway("sk_test_dummy", "", "").enabled());
        assertThrows(
                IllegalStateException.class, () -> new StripePaymentGateway("sk_live_x", "", ""));
    }

    @Test
    void readsReadinessFromAnAccountsV2Object() {
        var pending =
                com.google.gson.JsonParser.parseString(
                                """
                                {"id": "acct_1",
                                 "configuration": {"recipient": {"capabilities": {"stripe_balance": {
                                   "stripe_transfers": {"status": "restricted"},
                                   "payouts": {"status": "restricted"}}}}},
                                 "requirements": {"entries": [
                                   {"awaiting_action_from": "user", "description": "identity.individual.id_numbers"},
                                   {"awaiting_action_from": "stripe", "description": "identity.individual.verification"}]}}
                                """)
                        .getAsJsonObject();
        var a = StripePaymentGateway.connectedAccount(pending);
        assertEquals("acct_1", a.id());
        assertFalse(a.transfersEnabled());
        assertFalse(a.detailsSubmitted());
        assertEquals(java.util.List.of("identity.individual.id_numbers"), a.currentlyDue());

        var ready =
                com.google.gson.JsonParser.parseString(
                                """
                                {"id": "acct_2",
                                 "configuration": {"recipient": {"capabilities": {"stripe_balance": {
                                   "stripe_transfers": {"status": "active"},
                                   "payouts": {"status": "active"}}}}},
                                 "requirements": {"entries": []}}
                                """)
                        .getAsJsonObject();
        var b = StripePaymentGateway.connectedAccount(ready);
        assertTrue(b.transfersEnabled());
        assertTrue(b.payoutsEnabled());
        assertTrue(b.detailsSubmitted());
    }
}
