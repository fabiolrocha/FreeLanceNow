package br.com.freelancenow.api.payments;

import com.stripe.StripeClient;
import com.stripe.exception.InvalidRequestException;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.StripeObject;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.checkout.SessionCreateParams;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;

/** Stripe Checkout (hosted page): card, Pix and boleto data never touch this API. */
@Component
public class StripePaymentGateway implements PaymentGateway {
    private static final Logger log = LoggerFactory.getLogger(StripePaymentGateway.class);

    private final StripeClient stripe;
    private final String webhookSecret;

    public StripePaymentGateway(
            @Value("${app.stripe.secret-key:}") String secretKey,
            @Value("${app.stripe.webhook-secret:}") String webhookSecret) {
        String key = secretKey == null ? "" : secretKey.trim();
        // The example files ship a placeholder; treat it as "no Stripe" instead of failing later.
        if (key.contains("placeholder")) key = "";
        if (key.startsWith("sk_live_") || key.startsWith("rk_live_"))
            // This delivery runs in the Stripe sandbox only (ADR11, ADR33).
            throw new IllegalStateException("STRIPE_SECRET_KEY de produção não é aceita.");
        this.stripe = key.isEmpty() ? null : new StripeClient(key);
        this.webhookSecret = webhookSecret == null ? "" : webhookSecret.trim();
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

    @Override
    public GatewayEvent parseWebhook(String payload, String signatureHeader) {
        if (webhookSecret.isEmpty()) throw new InvalidWebhook("STRIPE_WEBHOOK_SECRET ausente");
        if (signatureHeader == null || signatureHeader.isBlank())
            throw new InvalidWebhook("Assinatura ausente");
        try {
            var event = Webhook.constructEvent(payload, signatureHeader, webhookSecret);
            String type = event.getType();
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
}
