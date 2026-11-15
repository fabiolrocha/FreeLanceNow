package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import br.com.freelancenow.api.payments.FakePaymentGateway;
import br.com.freelancenow.api.users.Role;
import br.com.freelancenow.api.users.User;
import br.com.freelancenow.api.users.UserRepository;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

/** F09 with an in-memory gateway: escrow, release, refund, webhooks and withdrawals. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PaymentIntegrationTests.Gateway.class)
class PaymentIntegrationTests {
    private static final String CATEGORY = "10000000-0000-0000-0000-000000000001";

    @TestConfiguration
    static class Gateway {
        @Bean
        @Primary
        FakePaymentGateway fakePaymentGateway() {
            return new FakePaymentGateway();
        }
    }

    @Value("${local.server.port}")
    int port;

    @Autowired FakePaymentGateway gateway;
    @Autowired JdbcTemplate db;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;

    String client, freelancer, outsider, serviceId;

    @SuppressWarnings("unchecked")
    Map<String, Object> call(HttpMethod method, String path, Object body, String token) {
        var req =
                RestClient.create("http://localhost:" + port)
                        .method(method)
                        .uri("/api/v1" + path)
                        .headers(
                                h -> {
                                    if (token != null) h.setBearerAuth(token);
                                });
        if (body != null) req.contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(body);
        return req.retrieve().body(Map.class);
    }

    int webhook(String body, String signature) {
        return RestClient.create("http://localhost:" + port)
                .post()
                .uri("/api/v1/payments/webhook")
                .headers(
                        h -> {
                            if (signature != null) h.set("Stripe-Signature", signature);
                        })
                .contentType(org.springframework.http.MediaType.TEXT_PLAIN)
                .body(body)
                .exchange((req, res) -> res.getStatusCode().value());
    }

    /** Sends a Checkout Session event for the given payment, as Stripe would. */
    int event(String type, String paymentId, String paymentStatus) {
        return webhook(
                String.join(
                        "|",
                        "evt_" + UUID.randomUUID(),
                        type,
                        FakePaymentGateway.sessionId(paymentId),
                        FakePaymentGateway.intentId(paymentId),
                        paymentStatus,
                        paymentId),
                "valid");
    }

    String register(String name, String role) {
        return call(
                        HttpMethod.POST,
                        "/auth/register",
                        Map.of(
                                "name", name,
                                "email", UUID.randomUUID() + "@example.test",
                                "password", "Strong12345",
                                "phone", "61999990000",
                                "role", role,
                                "acceptedTerms", true),
                        null)
                .get("accessToken")
                .toString();
    }

    void expect(int code, Runnable work) {
        var e = assertThrows(HttpClientErrorException.class, work::run);
        assertEquals(code, e.getStatusCode().value(), e.getResponseBodyAsString());
    }

    String acceptedContract() {
        var id =
                call(
                                HttpMethod.POST,
                                "/contracts",
                                Map.of(
                                        "serviceId", serviceId,
                                        "date",
                                                LocalDate.now(ZoneId.of("America/Sao_Paulo"))
                                                        .plusDays(3)
                                                        .toString(),
                                        "description", "Troca de tomada da cozinha.",
                                        "address", "Asa Sul"),
                                client)
                        .get("id")
                        .toString();
        status(id, "ACEITO", null, freelancer);
        return id;
    }

    void status(String contractId, String status, String comment, String token) {
        var body = new HashMap<String, Object>();
        body.put("status", status);
        if (comment != null) body.put("comment", comment);
        call(HttpMethod.PATCH, "/contracts/" + contractId + "/status", body, token);
    }

    String pay(String contractId, String method) {
        var started =
                call(
                        HttpMethod.POST,
                        "/contracts/" + contractId + "/payment",
                        Map.of("method", method),
                        client);
        assertTrue(started.get("checkoutUrl").toString().startsWith("https://checkout.test/"));
        return started.get("paymentId").toString();
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> payment(String contractId, String token) {
        return (Map<String, Object>)
                call(HttpMethod.GET, "/contracts/" + contractId + "/payment", null, token)
                        .get("payment");
    }

    List<String> ledger(String paymentId) {
        return db.queryForList(
                "select entry_type from ledger_entry where payment_id = ?::uuid"
                        + " order by created_at, entry_type",
                String.class,
                paymentId);
    }

    BigDecimal money(Object value) {
        return new BigDecimal(value.toString()).setScale(2);
    }

    @BeforeEach
    void actors() {
        client = register("Cliente Pagamento", "CLIENT");
        freelancer = register("Freelancer Pagamento", "FREELANCER");
        outsider = register("Outro Cliente", "CLIENT");
        serviceId =
                call(
                                HttpMethod.POST,
                                "/services",
                                Map.of(
                                        "title", "Troca de tomada",
                                        "description", "Instalação e troca de tomadas.",
                                        "categoryId", CATEGORY,
                                        "price", 90,
                                        "deliveryDays", 1,
                                        "status", "ACTIVE"),
                                freelancer)
                        .get("id")
                        .toString();
    }

    @Test
    void paidContractStartsAndReleasesTheNetAmountOnCompletion() {
        var contractId = acceptedContract();
        var state = call(HttpMethod.GET, "/contracts/" + contractId + "/payment", null, client);
        assertEquals(true, state.get("enabled"));
        assertNull(state.get("payment"));

        // No start before the money is in escrow; only the client pays, only once accepted.
        expect(409, () -> status(contractId, "EM_ANDAMENTO", null, freelancer));
        expect(
                403,
                () ->
                        call(
                                HttpMethod.POST,
                                "/contracts/" + contractId + "/payment",
                                Map.of("method", "CARD"),
                                freelancer));
        expect(
                403,
                () ->
                        call(
                                HttpMethod.POST,
                                "/contracts/" + contractId + "/payment",
                                Map.of("method", "CARD"),
                                outsider));
        expect(403, () -> payment(contractId, outsider));

        var paymentId = pay(contractId, "CARD");
        var checkout = gateway.checkouts.get(gateway.checkouts.size() - 1);
        assertEquals(new BigDecimal("90.00"), checkout.amount());
        assertTrue(checkout.successUrl().endsWith("/pagamento/confirmado?contratacao=" + contractId));
        assertEquals("PENDING", payment(contractId, client).get("status"));
        // Asking again for the same method reuses the open checkout.
        assertEquals(paymentId, pay(contractId, "CARD"));

        assertEquals(400, webhook("evt_x|checkout.session.completed|s|pi|paid|" + paymentId, "bad"));
        assertEquals(200, event("checkout.session.completed", paymentId, "paid"));
        var paid = payment(contractId, freelancer);
        assertEquals("PAID", paid.get("status"));
        assertEquals(money("9.00"), money(paid.get("feeAmount")));
        assertEquals(money("81.00"), money(paid.get("netAmount")));
        assertEquals(List.of("CHARGE", "ESCROW_HOLD", "PLATFORM_FEE"), ledger(paymentId));
        expect(
                409,
                () ->
                        call(
                                HttpMethod.POST,
                                "/contracts/" + contractId + "/payment",
                                Map.of("method", "PIX"),
                                client));

        // Stripe retries: the same event id changes nothing.
        var replay =
                "evt_replay|checkout.session.async_payment_succeeded|s|pi|paid|" + paymentId;
        assertEquals(200, webhook(replay, "valid"));
        assertEquals(200, webhook(replay, "valid"));
        assertEquals(3, ledger(paymentId).size());

        var clientWallet = call(HttpMethod.GET, "/users/me/wallet", null, client);
        assertEquals(money("90.00"), money(clientWallet.get("held")));

        status(contractId, "EM_ANDAMENTO", null, freelancer);
        status(contractId, "AGUARDANDO_CONFIRMACAO", "Tomada trocada.", freelancer);
        var wallet = call(HttpMethod.GET, "/users/me/wallet", null, freelancer);
        assertEquals(money("81.00"), money(wallet.get("held")));
        assertEquals(money("0.00"), money(wallet.get("available")));

        status(contractId, "CONCLUIDO", null, client);
        assertEquals("RELEASED", payment(contractId, client).get("status"));
        assertTrue(ledger(paymentId).contains("PAYOUT_RELEASE"));
        wallet = call(HttpMethod.GET, "/users/me/wallet", null, freelancer);
        assertEquals(money("0.00"), money(wallet.get("held")));
        assertEquals(money("81.00"), money(wallet.get("available")));

        // Simulated withdrawal: never more than the available balance.
        expect(
                409,
                () ->
                        call(
                                HttpMethod.POST,
                                "/users/me/withdrawals",
                                Map.of("amount", "81.01"),
                                freelancer));
        expect(
                403,
                () ->
                        call(
                                HttpMethod.POST,
                                "/users/me/withdrawals",
                                Map.of("amount", "10"),
                                client));
        var withdrawal =
                call(
                        HttpMethod.POST,
                        "/users/me/withdrawals",
                        Map.of("amount", "50"),
                        freelancer);
        assertEquals("SIMULATED", withdrawal.get("status"));
        wallet = call(HttpMethod.GET, "/users/me/wallet", null, freelancer);
        assertEquals(money("31.00"), money(wallet.get("available")));
        assertEquals(money("50.00"), money(wallet.get("withdrawn")));

        var detail = call(HttpMethod.GET, "/payments/" + paymentId, null, freelancer);
        assertEquals(4, ((List<?>) detail.get("entries")).size());
        expect(404, () -> call(HttpMethod.GET, "/payments/" + paymentId, null, outsider));
    }

    @Test
    void cancellingAPaidContractRefundsTheClient() {
        var contractId = acceptedContract();
        var paymentId = pay(contractId, "PIX");
        event("checkout.session.completed", paymentId, "paid");

        status(contractId, "CANCELADO", "Imprevisto na agenda.", freelancer);

        var refunded = payment(contractId, client);
        assertEquals("REFUNDED", refunded.get("status"));
        assertNotNull(refunded.get("refundedAt"));
        assertTrue(gateway.refunds.contains(FakePaymentGateway.intentId(paymentId)));
        assertTrue(ledger(paymentId).contains("REFUND"));
        var wallet = call(HttpMethod.GET, "/users/me/wallet", null, client);
        assertEquals(money("90.00"), money(wallet.get("refunded")));
        assertEquals(money("0.00"), money(wallet.get("paid")));
    }

    @Test
    void boletoPaidAfterCancellationIsRefundedAndSwitchingMethodClosesTheOldCheckout() {
        var contractId = acceptedContract();
        var pixId = pay(contractId, "PIX");
        var boletoId = pay(contractId, "BOLETO");
        assertNotEquals(pixId, boletoId);
        assertTrue(gateway.expired.contains(FakePaymentGateway.sessionId(pixId)));
        assertEquals(
                "CANCELED",
                db.queryForObject(
                        "select status from payment where id = ?::uuid", String.class, pixId));

        // Boleto issued but not paid yet: processing, and no second checkout meanwhile.
        event("checkout.session.completed", boletoId, "unpaid");
        assertEquals("PROCESSING", payment(contractId, client).get("status"));
        expect(
                409,
                () ->
                        call(
                                HttpMethod.POST,
                                "/contracts/" + contractId + "/payment",
                                Map.of("method", "CARD"),
                                client));
        expect(409, () -> status(contractId, "EM_ANDAMENTO", null, freelancer));

        status(contractId, "CANCELADO", "Desisti do serviço.", client);
        assertEquals("PROCESSING", payment(contractId, client).get("status"));

        event("checkout.session.async_payment_succeeded", boletoId, "paid");
        assertEquals("REFUNDED", payment(contractId, client).get("status"));
        assertTrue(gateway.refunds.contains(FakePaymentGateway.intentId(boletoId)));
        assertEquals(List.of("CHARGE", "REFUND"), ledger(boletoId));

        // The abandoned Pix checkout paid anyway is refunded too.
        event("checkout.session.completed", pixId, "paid");
        assertTrue(gateway.refunds.contains(FakePaymentGateway.intentId(pixId)));
        assertEquals(
                "REFUNDED",
                db.queryForObject(
                        "select status from payment where id = ?::uuid", String.class, pixId));
    }

    @Test
    void adminSeesTotalsAndOthersCannot() {
        var contractId = acceptedContract();
        var paymentId = pay(contractId, "CARD");
        event("checkout.session.completed", paymentId, "paid");

        var a =
                users.saveAndFlush(
                        new User(
                                "Admin Pagamentos",
                                UUID.randomUUID() + "@example.test",
                                passwords.encode("Strong12345"),
                                "61999990000",
                                Role.ADMIN));
        var admin =
                call(
                                HttpMethod.POST,
                                "/auth/login",
                                Map.of("email", a.getEmail(), "password", "Strong12345"),
                                null)
                        .get("accessToken")
                        .toString();
        var summary = call(HttpMethod.GET, "/admin/payments", null, admin);
        assertTrue(money(summary.get("held")).compareTo(new BigDecimal("90.00")) >= 0);
        assertTrue(
                ((List<?>) summary.get("payments"))
                        .stream()
                                .map(p -> ((Map<?, ?>) p).get("id"))
                                .anyMatch(paymentId::equals));
        expect(403, () -> call(HttpMethod.GET, "/admin/payments", null, client));
        expect(403, () -> call(HttpMethod.GET, "/users/me/wallet", null, admin));
    }

    @Test
    void webhookNeedsNoTokenButRejectsBadSignatures() {
        assertEquals(400, webhook("evt|checkout.session.completed|s|pi|paid|x", null));
        // Unknown payments and unrelated events are acknowledged so Stripe stops retrying.
        assertEquals(
                200,
                webhook(
                        "evt_"
                                + UUID.randomUUID()
                                + "|checkout.session.completed|s|pi|paid|"
                                + UUID.randomUUID(),
                        "valid"));
        assertEquals(200, webhook("evt_" + UUID.randomUUID() + "|charge.updated||||", "valid"));
    }
}
