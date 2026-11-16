package br.com.freelancenow.api.payments;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
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
    /** Connected accounts by id; tests replace an entry to simulate onboarding progress. */
    public final Map<String, ConnectedAccount> accounts = new ConcurrentHashMap<>();
    public final List<String> accountSessions = new CopyOnWriteArrayList<>();
    /** Transfers by idempotency key (the payment), as Stripe would deduplicate them. */
    public final Map<java.util.UUID, TransferRequest> transfers = new ConcurrentHashMap<>();
    /** Number of next transfer calls that fail, to exercise retries. */
    public final java.util.concurrent.atomic.AtomicInteger failNextTransfers =
            new java.util.concurrent.atomic.AtomicInteger();

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
    public String createConnectedAccount(UUID userId, String email, String name) {
        String id = accountId(userId);
        accounts.putIfAbsent(id, new ConnectedAccount(id, false, false, false, List.of("individual.id_number")));
        return id;
    }

    @Override
    public String createAccountSession(String accountId) {
        if (!accounts.containsKey(accountId)) throw new GatewayFailure("Conta desconhecida", null);
        String secret = "accs_secret_" + UUID.randomUUID();
        accountSessions.add(accountId);
        return secret;
    }

    @Override
    public ConnectedAccount retrieveAccount(String accountId) {
        var a = accounts.get(accountId);
        if (a == null) throw new GatewayFailure("Conta desconhecida", null);
        return a;
    }

    @Override
    public String chargeOf(String paymentIntentId) {
        return "ch_test_" + paymentIntentId;
    }

    @Override
    public String transfer(TransferRequest r) {
        if (failNextTransfers.getAndUpdate(n -> Math.max(0, n - 1)) > 0)
            throw new GatewayFailure("Stripe recusou a transferência", null);
        transfers.putIfAbsent(r.paymentId(), r);
        return "tr_test_" + r.paymentId();
    }

    /** Marks the account as fully onboarded, as Stripe would after the form is submitted. */
    public void completeOnboarding(String accountId) {
        accounts.put(accountId, new ConnectedAccount(accountId, true, true, true, List.of()));
    }

    public static String accountId(UUID userId) {
        return "acct_test_" + userId.toString().replace("-", "").substring(0, 16);
    }

    @Override
    public GatewayEvent parseWebhook(String payload, String signatureHeader) {
        if (!"valid".equals(signatureHeader)) throw new InvalidWebhook("Assinatura inválida");
        var p = payload.split("\\|", -1);
        if (p.length > 6)
            // Extended: ...|account|objectId|amount|detail|chargeId (empty means null).
            return new GatewayEvent(
                    p[0],
                    p[1],
                    blank(p[2]),
                    blank(p[3]),
                    blank(p[4]),
                    blank(p[5]),
                    blank(p[6]),
                    blank(p[7]),
                    p[8].isEmpty() ? null : new java.math.BigDecimal(p[8]),
                    blank(p[9]),
                    p.length > 10 ? blank(p[10]) : null);
        return new GatewayEvent(p[0], p[1], p[2], p[3], p[4], p[5]);
    }

    private static String blank(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    /** Transfer reversals by idempotency key. */
    public final Map<String, java.math.BigDecimal> reversals = new ConcurrentHashMap<>();

    /** Number of next reversal calls that fail (connected balance too low, for example). */
    public final java.util.concurrent.atomic.AtomicInteger failNextReversals =
            new java.util.concurrent.atomic.AtomicInteger();

    @Override
    public String reverseTransfer(String transferId, java.math.BigDecimal amount, String key) {
        if (failNextReversals.getAndUpdate(n -> Math.max(0, n - 1)) > 0)
            throw new GatewayFailure("Saldo insuficiente na conta conectada", null);
        reversals.putIfAbsent(key, amount);
        return "trr_test_" + key;
    }

    public static String sessionId(String paymentId) {
        return "cs_test_" + paymentId;
    }

    public static String intentId(String paymentId) {
        return "pi_test_" + paymentId;
    }
}
