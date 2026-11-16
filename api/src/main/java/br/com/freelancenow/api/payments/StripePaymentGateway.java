package br.com.freelancenow.api.payments;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.stripe.StripeClient;
import com.stripe.exception.InvalidRequestException;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.ApiResource;
import com.stripe.net.RawRequestOptions;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.AccountSessionCreateParams;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.TransferCreateParams;
import com.stripe.param.checkout.SessionCreateParams;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Stripe Checkout (hosted page): card, Pix and boleto data never touch this API. */
@Component
public class StripePaymentGateway implements PaymentGateway {
    private static final Logger log = LoggerFactory.getLogger(StripePaymentGateway.class);

    private final StripeClient stripe;
    private final String webhookSecret;
    private final String connectWebhookSecret;

    public StripePaymentGateway(
            @Value("${app.stripe.secret-key:}") String secretKey,
            @Value("${app.stripe.webhook-secret:}") String webhookSecret,
            @Value("${app.stripe.connect-webhook-secret:}") String connectWebhookSecret) {
        String key = secretKey == null ? "" : secretKey.trim();
        // The example files ship a placeholder; treat it as "no Stripe" instead of failing later.
        if (key.contains("placeholder")) key = "";
        if (key.startsWith("sk_live_") || key.startsWith("rk_live_"))
            // This delivery runs in the Stripe sandbox only (ADR11, ADR33).
            throw new IllegalStateException("STRIPE_SECRET_KEY de produção não é aceita.");
        this.stripe = key.isEmpty() ? null : new StripeClient(key);
        this.webhookSecret = webhookSecret == null ? "" : webhookSecret.trim();
        this.connectWebhookSecret =
                connectWebhookSecret == null ? "" : connectWebhookSecret.trim();
    }

    @Override
    public boolean enabled() {
        return stripe != null;
    }

    @Override
    public Checkout createCheckout(CheckoutRequest r) {
        var params =
                SessionCreateParams.builder()
                        .setMode(SessionCreateParams.Mode.PAYMENT)
                        .setLocale(SessionCreateParams.Locale.PT_BR)
                        .addAllowedPaymentMethodType(type(r.method()))
                        .setClientReferenceId(r.paymentId().toString())
                        .putMetadata("paymentId", r.paymentId().toString())
                        .putMetadata("contractId", r.contractId().toString())
                        .setCustomerEmail(r.customerEmail())
                        .setSuccessUrl(r.successUrl())
                        .setCancelUrl(r.cancelUrl())
                        .setPaymentIntentData(
                                SessionCreateParams.PaymentIntentData.builder()
                                        // Groups the charge with the transfer to the freelancer.
                                        .setTransferGroup(
                                                PayoutTransferService.transferGroup(
                                                        r.contractId()))
                                        .putMetadata("paymentId", r.paymentId().toString())
                                        .putMetadata("contractId", r.contractId().toString())
                                        .build())
                        .addLineItem(
                                SessionCreateParams.LineItem.builder()
                                        .setQuantity(1L)
                                        .setPriceData(
                                                SessionCreateParams.LineItem.PriceData.builder()
                                                        .setCurrency("brl")
                                                        .setUnitAmount(
                                                                r.amount()
                                                                        .movePointRight(2)
                                                                        .longValueExact())
                                                        .setProductData(
                                                                SessionCreateParams.LineItem
                                                                        .PriceData.ProductData
                                                                        .builder()
                                                                        .setName(r.title())
                                                                        .build())
                                                        .build())
                                        .build())
                        .build();
        var options =
                RequestOptions.builder().setIdempotencyKey("checkout-" + r.paymentId()).build();
        try {
            Session s = stripe.v1().checkout().sessions().create(params, options);
            return new Checkout(s.getId(), s.getUrl(), Instant.ofEpochSecond(s.getExpiresAt()));
        } catch (StripeException e) {
            throw new GatewayFailure("Stripe recusou a criação do checkout", e);
        }
    }

    private static SessionCreateParams.AllowedPaymentMethodType type(PaymentMethod m) {
        return switch (m) {
            case CARD -> SessionCreateParams.AllowedPaymentMethodType.CARD;
            case PIX -> SessionCreateParams.AllowedPaymentMethodType.PIX;
            case BOLETO -> SessionCreateParams.AllowedPaymentMethodType.BOLETO;
        };
    }

    @Override
    public void expireCheckout(String sessionId) {
        try {
            stripe.v1().checkout().sessions().expire(sessionId);
        } catch (InvalidRequestException e) {
            // Already complete or expired: nothing left to close.
            log.info("Checkout {} já encerrado: {}", sessionId, e.getCode());
        } catch (StripeException e) {
            throw new GatewayFailure("Não foi possível encerrar o checkout", e);
        }
    }

    @Override
    public void refund(String providerPaymentId, String idempotencyKey) {
        var options = RequestOptions.builder().setIdempotencyKey(idempotencyKey).build();
        try {
            stripe.v1()
                    .refunds()
                    .create(
                            RefundCreateParams.builder().setPaymentIntent(providerPaymentId).build(),
                            options);
        } catch (StripeException e) {
            throw new GatewayFailure("Stripe recusou o reembolso", e);
        }
    }

    /**
     * Accounts v2 (Stripe refuses v1 creation for new platforms). The account has the recipient
     * configuration, to receive transfers and pay out, and the merchant one, which lets Stripe
     * manage the account's own risk; this sandbox does not allow the platform to take it. No
     * Stripe Dashboard: the freelancer uses the components embedded in the app.
     */
    @Override
    public String createConnectedAccount(UUID userId, String email, String name) {
        var body = new JsonObject();
        body.addProperty("contact_email", email);
        body.addProperty("display_name", name);
        body.addProperty("dashboard", "none");
        var identity = new JsonObject();
        identity.addProperty("country", "br");
        body.add("identity", identity);
        var responsibilities = new JsonObject();
        responsibilities.addProperty("fees_collector", "application");
        responsibilities.addProperty("losses_collector", "stripe");
        var profile = new JsonObject();
        profile.addProperty(
                "product_description", "Serviços prestados por meio da plataforma FreeLanceNow");
        var defaults = new JsonObject();
        defaults.addProperty("currency", "brl");
        defaults.add("responsibilities", responsibilities);
        defaults.add("profile", profile);
        body.add("defaults", defaults);
        var merchant = new JsonObject();
        merchant.addProperty("mcc", "8999");
        merchant.add("capabilities", requested("card_payments"));
        var balance = new JsonObject();
        balance.add("stripe_balance", requested("stripe_transfers"));
        var recipient = new JsonObject();
        recipient.add("capabilities", balance);
        var configuration = new JsonObject();
        configuration.add("merchant", merchant);
        configuration.add("recipient", recipient);
        body.add("configuration", configuration);
        var metadata = new JsonObject();
        metadata.addProperty("userId", userId.toString());
        body.add("metadata", metadata);
        try {
            var response =
                    stripe.rawRequest(
                            ApiResource.RequestMethod.POST,
                            "/v2/core/accounts",
                            body.toString(),
                            RawRequestOptions.builder()
                                    .setIdempotencyKey("connected-account-" + userId)
                                    .build());
            return JsonParser.parseString(response.body())
                    .getAsJsonObject()
                    .get("id")
                    .getAsString();
        } catch (StripeException e) {
            throw new GatewayFailure("Stripe recusou a criação da conta de recebimento", e);
        }
    }

    private static JsonObject requested(String capability) {
        var flag = new JsonObject();
        flag.addProperty("requested", true);
        var capabilities = new JsonObject();
        capabilities.add(capability, flag);
        return capabilities;
    }

    @Override
    public String createAccountSession(String accountId) {
        var enabled = true;
        var components =
                AccountSessionCreateParams.Components.builder()
                        .setAccountOnboarding(
                                AccountSessionCreateParams.Components.AccountOnboarding.builder()
                                        .setEnabled(enabled)
                                        .build())
                        .setAccountManagement(
                                AccountSessionCreateParams.Components.AccountManagement.builder()
                                        .setEnabled(enabled)
                                        .build())
                        .setNotificationBanner(
                                AccountSessionCreateParams.Components.NotificationBanner.builder()
                                        .setEnabled(enabled)
                                        .build())
                        .setPayouts(
                                AccountSessionCreateParams.Components.Payouts.builder()
                                        .setEnabled(enabled)
                                        .setFeatures(
                                                AccountSessionCreateParams.Components.Payouts
                                                        .Features.builder()
                                                        .setStandardPayouts(true)
                                                        .setInstantPayouts(false)
                                                        .setEditPayoutSchedule(true)
                                                        .setExternalAccountCollection(true)
                                                        .build())
                                        .build())
                        .build();
        try {
            return stripe.v1()
                    .accountSessions()
                    .create(
                            AccountSessionCreateParams.builder()
                                    .setAccount(accountId)
                                    .setComponents(components)
                                    .build())
                    .getClientSecret();
        } catch (StripeException e) {
            throw new GatewayFailure("Stripe recusou a sessão da conta de recebimento", e);
        }
    }

    @Override
    public ConnectedAccount retrieveAccount(String accountId) {
        try {
            var response =
                    stripe.rawRequest(
                            ApiResource.RequestMethod.GET,
                            "/v2/core/accounts/"
                                    + accountId
                                    + "?include=configuration.recipient&include=requirements",
                            null,
                            RawRequestOptions.builder().build());
            return connectedAccount(JsonParser.parseString(response.body()).getAsJsonObject());
        } catch (StripeException e) {
            throw new GatewayFailure("Não foi possível consultar a conta de recebimento", e);
        }
    }

    /**
     * Reads a v2 Account: ready to receive when {@code stripe_transfers} is active; what the
     * freelancer still has to fill are the requirement entries awaiting the user.
     */
    static ConnectedAccount connectedAccount(JsonObject a) {
        var balance =
                path(a, "configuration", "recipient", "capabilities", "stripe_balance");
        boolean transfers = active(balance, "stripe_transfers");
        boolean payouts = active(balance, "payouts");
        var due = new ArrayList<String>();
        var requirements = path(a, "requirements");
        if (requirements != null && requirements.get("entries") instanceof JsonArray entries)
            for (var e : entries) {
                var entry = e.getAsJsonObject();
                if ("user".equals(string(entry, "awaiting_action_from")))
                    due.add(string(entry, "description"));
            }
        return new ConnectedAccount(
                a.get("id").getAsString(), due.isEmpty(), transfers, payouts, List.copyOf(due));
    }

    private static JsonObject path(JsonObject o, String... keys) {
        JsonObject current = o;
        for (var k : keys) {
            if (current == null || !(current.get(k) instanceof JsonObject next)) return null;
            current = next;
        }
        return current;
    }

    private static boolean active(JsonObject balance, String capability) {
        var c = balance == null ? null : path(balance, capability);
        return c != null && "active".equals(string(c, "status"));
    }

    private static String string(JsonObject o, String key) {
        var v = o.get(key);
        return v == null || v.isJsonNull() ? null : v.getAsString();
    }

    @Override
    public String chargeOf(String paymentIntentId) {
        try {
            String charge = stripe.v1().paymentIntents().retrieve(paymentIntentId).getLatestCharge();
            if (charge == null)
                throw new GatewayFailure("Pagamento sem cobrança: " + paymentIntentId, null);
            return charge;
        } catch (StripeException e) {
            throw new GatewayFailure("Não foi possível consultar o pagamento", e);
        }
    }

    @Override
    public String transfer(TransferRequest r) {
        var params =
                TransferCreateParams.builder()
                        .setAmount(r.amount().movePointRight(2).longValueExact())
                        .setCurrency("brl")
                        .setDestination(r.destination())
                        .setSourceTransaction(r.sourceCharge())
                        .setTransferGroup(r.transferGroup())
                        .putMetadata("paymentId", r.paymentId().toString())
                        .build();
        var options =
                RequestOptions.builder().setIdempotencyKey("transfer-" + r.paymentId()).build();
        try {
            return stripe.v1().transfers().create(params, options).getId();
        } catch (StripeException e) {
            throw new GatewayFailure("Stripe recusou a transferência", e);
        }
    }

    @Override
    public GatewayEvent parseWebhook(String payload, String signatureHeader) {
        if (webhookSecret.isEmpty() && connectWebhookSecret.isEmpty())
            throw new InvalidWebhook("STRIPE_WEBHOOK_SECRET ausente");
        if (signatureHeader == null || signatureHeader.isBlank())
            throw new InvalidWebhook("Assinatura ausente");
        try {
            var event = verified(payload, signatureHeader);
            String type = event.getType();
            if (event.getAccount() != null) return connectedAccountEvent(event.getId(), type, payload);
            if (type.startsWith("charge.") || type.startsWith("refund."))
                return chargeEvent(event.getId(), type, payload);
            if (!type.startsWith("checkout.session."))
                return new GatewayEvent(event.getId(), type, null, null, null, null);
            var data = event.getDataObjectDeserializer();
            StripeObject object = data.getObject().orElse(null);
            // The SDK refuses objects from another API version; the fields used here are stable.
            if (object == null) object = data.deserializeUnsafe();
            var session = (Session) object;
            var metadata = session.getMetadata();
            String paymentId =
                    metadata != null && metadata.get("paymentId") != null
                            ? metadata.get("paymentId")
                            : session.getClientReferenceId();
            return new GatewayEvent(
                    event.getId(),
                    type,
                    session.getId(),
                    session.getPaymentIntent(),
                    session.getPaymentStatus(),
                    paymentId);
        } catch (SignatureVerificationException e) {
            throw new InvalidWebhook("Assinatura inválida");
        } catch (Exception e) {
            throw new InvalidWebhook("Evento ilegível: " + e.getClass().getSimpleName());
        }
    }

    /**
     * Two Stripe endpoints may point here, each with its own secret: the platform's (Checkout)
     * and the Connect one (events of the freelancers' accounts, such as payouts).
     */
    private com.stripe.model.Event verified(String payload, String signatureHeader)
            throws SignatureVerificationException {
        SignatureVerificationException last = null;
        for (var secret : List.of(webhookSecret, connectWebhookSecret)) {
            if (secret.isEmpty()) continue;
            try {
                return Webhook.constructEvent(payload, signatureHeader, secret);
            } catch (SignatureVerificationException e) {
                last = e;
            }
        }
        throw last;
    }

    /** Reads the few fields used from an event of a connected account, by the raw JSON. */
    static GatewayEvent connectedAccountEvent(String id, String type, String payload) {
        var json = JsonParser.parseString(payload).getAsJsonObject();
        var object = path(json, "data", "object");
        String objectId = object == null ? null : string(object, "id");
        BigDecimal amount = null;
        if (object != null && object.get("amount") != null && !object.get("amount").isJsonNull())
            amount = BigDecimal.valueOf(object.get("amount").getAsLong(), 2);
        String detail = object == null ? null : string(object, "failure_message");
        return new GatewayEvent(
                id,
                type,
                null,
                null,
                null,
                null,
                string(json, "account"),
                objectId,
                amount,
                detail,
                null);
    }

    /**
     * Reads a charge, refund or dispute event of the platform by the raw JSON. For a charge the
     * amount is {@code amount_refunded} (cumulative); for a refund or dispute, its own amount.
     */
    static GatewayEvent chargeEvent(String id, String type, String payload) {
        var object = path(JsonParser.parseString(payload).getAsJsonObject(), "data", "object");
        if (object == null) return new GatewayEvent(id, type, null, null, null, null);
        boolean charge = "charge".equals(string(object, "object"));
        String amountField = charge ? "amount_refunded" : "amount";
        BigDecimal amount = null;
        if (object.get(amountField) != null && !object.get(amountField).isJsonNull())
            amount = BigDecimal.valueOf(object.get(amountField).getAsLong(), 2);
        String detail =
                "dispute".equals(string(object, "object"))
                        ? string(object, "status")
                        : string(object, "failure_reason");
        return new GatewayEvent(
                id,
                type,
                null,
                string(object, "payment_intent"),
                null,
                null,
                null,
                charge ? null : string(object, "id"),
                amount,
                detail,
                charge ? string(object, "id") : string(object, "charge"));
    }

    @Override
    public String reverseTransfer(String transferId, BigDecimal amount, String idempotencyKey) {
        var params =
                com.stripe.param.TransferReversalCreateParams.builder()
                        .setAmount(amount.movePointRight(2).longValueExact())
                        .build();
        var options = RequestOptions.builder().setIdempotencyKey(idempotencyKey).build();
        try {
            return stripe.v1().transfers().reversals().create(transferId, params, options).getId();
        } catch (StripeException e) {
            throw new GatewayFailure("Stripe recusou o estorno da transferência", e);
        }
    }
}
