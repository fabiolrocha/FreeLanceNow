package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import br.com.freelancenow.api.contracts.ContractRepository;
import br.com.freelancenow.api.payments.FakePaymentGateway;
import br.com.freelancenow.api.payments.PaymentService;
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
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "app.stripe.publishable-key=pk_test_fake")
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
    @Autowired ContractRepository contracts;
    @Autowired PaymentService paymentService;

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

        // Stripe money leaves by Stripe's payouts: the simulated withdrawal cannot spend it.
        assertEquals(money("0.00"), money(wallet.get("available")));
        assertEquals(money("81.00"), money(wallet.get("released")));
        assertEquals(money("81.00"), money(wallet.get("awaitingAccount")));
        expect(
                409,
                () ->
                        call(
                                HttpMethod.POST,
                                "/users/me/withdrawals",
                                Map.of("amount", "50"),
                                freelancer));
        expect(
                403,
                () ->
                        call(
                                HttpMethod.POST,
                                "/users/me/withdrawals",
                                Map.of("amount", "10"),
                                client));

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

    // ------------------------------------------------------------ payout account (ADR34)

    String userId(String token) {
        return call(HttpMethod.GET, "/users/me", null, token).get("id").toString();
    }

    @Test
    void payoutAccountStartsNotStarted() {
        var view = call(HttpMethod.GET, "/users/me/payout-account", null, freelancer);
        assertEquals(true, view.get("enabled"));
        assertEquals("NOT_STARTED", view.get("status"));
    }

    @Test
    void sessionCreatesOneAccountAndReusesIt() {
        var first = call(HttpMethod.POST, "/users/me/payout-account/session", null, freelancer);
        var second = call(HttpMethod.POST, "/users/me/payout-account/session", null, freelancer);
        assertEquals("pk_test_fake", first.get("publishableKey"));
        assertNotNull(first.get("clientSecret"));
        assertNotEquals(first.get("clientSecret"), second.get("clientSecret"));
        String account = FakePaymentGateway.accountId(UUID.fromString(userId(freelancer)));
        assertEquals(
                1,
                db.queryForObject(
                        "select count(*) from payout_account where stripe_account_id = ?",
                        Integer.class,
                        account));
        assertEquals(
                2, gateway.accountSessions.stream().filter(account::equals).count());
        var view = call(HttpMethod.GET, "/users/me/payout-account", null, freelancer);
        assertEquals("INCOMPLETE", view.get("status"));
        assertEquals(List.of("individual.id_number"), view.get("currentlyDue"));
    }

    @Test
    void onlyFreelancersHavePayoutAccounts() {
        expect(403, () -> call(HttpMethod.GET, "/users/me/payout-account", null, client));
        expect(
                403,
                () -> call(HttpMethod.POST, "/users/me/payout-account/session", null, client));
    }

    @Test
    void statusFollowsStripe() {
        call(HttpMethod.POST, "/users/me/payout-account/session", null, freelancer);
        gateway.completeOnboarding(
                FakePaymentGateway.accountId(UUID.fromString(userId(freelancer))));
        var view = call(HttpMethod.GET, "/users/me/payout-account", null, freelancer);
        assertEquals("READY", view.get("status"));
        assertEquals(true, view.get("transfersEnabled"));
    }

    /** Paid by card and completed by the client: the money is released to the freelancer. */
    String releasedPayment(String contractId) {
        var paymentId = pay(contractId, "CARD");
        assertEquals(200, event("checkout.session.completed", paymentId, "paid"));
        status(contractId, "EM_ANDAMENTO", null, freelancer);
        status(contractId, "AGUARDANDO_CONFIRMACAO", "Tomada trocada.", freelancer);
        status(contractId, "CONCLUIDO", null, client);
        return paymentId;
    }

    /** Creates the freelancer's account and marks it as onboarded; returns its id. */
    String readyAccount() {
        call(HttpMethod.POST, "/users/me/payout-account/session", null, freelancer);
        String account = FakePaymentGateway.accountId(UUID.fromString(userId(freelancer)));
        gateway.completeOnboarding(account);
        // The app asks for the status when the form closes; that is when it learns.
        assertEquals(
                "READY",
                call(HttpMethod.GET, "/users/me/payout-account", null, freelancer).get("status"));
        return account;
    }

    int transfersOf(String paymentId) {
        return db.queryForObject(
                "select count(*) from ledger_entry where payment_id = ?::uuid"
                        + " and entry_type = 'TRANSFER'",
                Integer.class,
                paymentId);
    }

    @Test
    void releaseTransfersTheNetAmountToAReadyAccount() {
        String account = readyAccount();
        var contractId = acceptedContract();
        var paymentId = releasedPayment(contractId);

        var transfer = gateway.transfers.get(UUID.fromString(paymentId));
        assertNotNull(transfer);
        assertEquals(account, transfer.destination());
        assertEquals(money("81.00"), money(transfer.amount()));
        assertEquals("ch_test_pi_test_" + paymentId, transfer.sourceCharge());
        assertEquals("contract-" + contractId, transfer.transferGroup());
        assertEquals(1, transfersOf(paymentId));

        var view = payment(contractId, freelancer);
        assertEquals("RELEASED", view.get("status"));
        assertNotNull(view.get("transferredAt"));
        assertEquals(false, view.get("transferPending"));
        var wallet = call(HttpMethod.GET, "/users/me/wallet", null, freelancer);
        assertEquals(money("81.00"), money(wallet.get("transferred")));
        assertEquals(money("0.00"), money(wallet.get("awaitingAccount")));

        // Asking again (the status page does) never sends the money twice.
        call(HttpMethod.GET, "/users/me/payout-account", null, freelancer);
        assertEquals(1, transfersOf(paymentId));
    }

    @Test
    void releasedMoneyWaitsForTheAccountAndGoesWhenItIsReady() {
        var contractId = acceptedContract();
        var paymentId = releasedPayment(contractId);
        assertNull(gateway.transfers.get(UUID.fromString(paymentId)));
        assertEquals(true, payment(contractId, freelancer).get("transferPending"));
        var wallet = call(HttpMethod.GET, "/users/me/wallet", null, freelancer);
        assertEquals(money("81.00"), money(wallet.get("awaitingAccount")));

        readyAccount();
        assertEquals("READY", call(HttpMethod.GET, "/users/me/payout-account", null, freelancer).get("status"));
        assertNotNull(gateway.transfers.get(UUID.fromString(paymentId)));
        assertEquals(1, transfersOf(paymentId));
        wallet = call(HttpMethod.GET, "/users/me/wallet", null, freelancer);
        assertEquals(money("81.00"), money(wallet.get("transferred")));
        assertEquals(money("0.00"), money(wallet.get("awaitingAccount")));
    }

    @Test
    void failedTransferIsRecordedAndRetried() {
        readyAccount();
        gateway.failNextTransfers.set(1);
        var contractId = acceptedContract();
        var paymentId = releasedPayment(contractId);
        // The contract is still completed: the failure only waits for a retry.
        assertEquals("RELEASED", payment(contractId, client).get("status"));
        assertNull(gateway.transfers.get(UUID.fromString(paymentId)));
        assertNotNull(
                db.queryForObject(
                        "select transfer_error from payment where id = ?::uuid",
                        String.class,
                        paymentId));

        call(HttpMethod.GET, "/users/me/payout-account", null, freelancer);
        assertNotNull(gateway.transfers.get(UUID.fromString(paymentId)));
        assertNull(
                db.queryForObject(
                        "select transfer_error from payment where id = ?::uuid",
                        String.class,
                        paymentId));
        assertEquals(1, transfersOf(paymentId));
    }

    @Test
    void openChargebackHoldsTheTransfer() {
        var contractId = acceptedContract();
        var paymentId = releasedPayment(contractId);
        db.update("update payment set dispute_status = 'OPEN' where id = ?::uuid", paymentId);
        readyAccount();
        call(HttpMethod.GET, "/users/me/payout-account", null, freelancer);
        assertNull(gateway.transfers.get(UUID.fromString(paymentId)));

        db.update("update payment set dispute_status = 'WON' where id = ?::uuid", paymentId);
        call(HttpMethod.GET, "/users/me/payout-account", null, freelancer);
        assertNotNull(gateway.transfers.get(UUID.fromString(paymentId)));
    }

    /** Sends an event of a connected account (Connect webhook). */
    int accountEvent(String id, String type, String account, String amount, String detail) {
        return webhook(
                String.join(
                        "|",
                        id,
                        type,
                        "",
                        "",
                        "",
                        "",
                        account,
                        "po_" + id,
                        amount,
                        detail),
                "valid");
    }

    List<String> notificationTitles(String token) {
        return db.queryForList(
                "select title from notification where user_id = ?::uuid order by created_at",
                String.class,
                userId(token));
    }

    @Test
    void simulatedWithdrawalSpendsOnlyDemoMoney() {
        var contractId = acceptedContract();
        var c = contracts.findById(UUID.fromString(contractId)).orElseThrow();
        var now = java.time.Instant.now();
        paymentService.recordSimulated(c, true, now.minusSeconds(3600), now);

        var wallet = call(HttpMethod.GET, "/users/me/wallet", null, freelancer);
        assertEquals(money("81.00"), money(wallet.get("available")));
        expect(
                409,
                () ->
                        call(
                                HttpMethod.POST,
                                "/users/me/withdrawals",
                                Map.of("amount", "81.01"),
                                freelancer));
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
    }

    @Test
    void payoutEventsNotifyTheFreelancerOnce() {
        String account = readyAccount();
        String paid = "evt_" + UUID.randomUUID();
        assertEquals(200, accountEvent(paid, "payout.paid", account, "81.00", ""));
        assertEquals(200, accountEvent(paid, "payout.paid", account, "81.00", ""));
        assertEquals(
                200,
                accountEvent(
                        "evt_" + UUID.randomUUID(),
                        "payout.failed",
                        account,
                        "40.50",
                        "Account closed."));
        var titles = notificationTitles(freelancer);
        assertEquals(1, titles.stream().filter("Saque depositado"::equals).count());
        assertEquals(1, titles.stream().filter("Saque não realizado"::equals).count());
        String body =
                db.queryForObject(
                        "select body from notification where user_id = ?::uuid"
                                + " and title = 'Saque não realizado'",
                        String.class,
                        userId(freelancer));
        assertTrue(body.contains("R$ 40,50"), body);
        assertTrue(body.contains("Account closed."), body);

        // An account this app does not know is ignored, not retried forever.
        assertEquals(
                200,
                accountEvent("evt_" + UUID.randomUUID(), "payout.paid", "acct_unknown", "1.00", ""));
    }

    @Test
    void accountUpdatedEventSendsWaitingMoney() {
        var contractId = acceptedContract();
        var paymentId = releasedPayment(contractId);
        call(HttpMethod.POST, "/users/me/payout-account/session", null, freelancer);
        String account = FakePaymentGateway.accountId(UUID.fromString(userId(freelancer)));
        gateway.completeOnboarding(account);
        assertNull(gateway.transfers.get(UUID.fromString(paymentId)));

        assertEquals(
                200, accountEvent("evt_" + UUID.randomUUID(), "account.updated", account, "", ""));
        assertNotNull(gateway.transfers.get(UUID.fromString(paymentId)));
        assertEquals(1, transfersOf(paymentId));
    }

    // ------------------------------------------------------------ incidents (etapa 4)

    /** A charge, refund or dispute event of the platform, as Stripe would send it. */
    int chargeEvent(String type, String paymentId, String objectId, String amount, String detail) {
        String pi = FakePaymentGateway.intentId(paymentId);
        return webhook(
                String.join(
                        "|",
                        "evt_" + UUID.randomUUID(),
                        type,
                        "",
                        pi,
                        "",
                        "",
                        "",
                        objectId == null ? "" : objectId,
                        amount,
                        detail == null ? "" : detail,
                        "ch_test_" + pi),
                "valid");
    }

    String paidPayment(String contractId) {
        var paymentId = pay(contractId, "CARD");
        assertEquals(200, event("checkout.session.completed", paymentId, "paid"));
        return paymentId;
    }

    long count(String paymentId, String type) {
        return ledger(paymentId).stream().filter(type::equals).count();
    }

    BigDecimal column(String paymentId, String column) {
        return db.queryForObject(
                "select " + column + " from payment where id = ?::uuid", BigDecimal.class, paymentId);
    }

    String text(String paymentId, String column) {
        return db.queryForObject(
                "select " + column + " from payment where id = ?::uuid", String.class, paymentId);
    }

    @Test
    void dashboardRefundOfEscrowIsRecordedOnce() {
        var contractId = acceptedContract();
        var paymentId = paidPayment(contractId);
        assertEquals(200, chargeEvent("charge.refunded", paymentId, null, "90.00", null));
        assertEquals(200, chargeEvent("charge.refunded", paymentId, null, "90.00", null));
        assertEquals("REFUNDED", payment(contractId, client).get("status"));
        assertEquals(1, count(paymentId, "REFUND"));
        assertEquals(money("90.00"), money(column(paymentId, "refunded_amount")));
    }

    @Test
    void appRefundIsNotRecordedAgainByItsEvent() {
        var contractId = acceptedContract();
        var paymentId = paidPayment(contractId);
        status(contractId, "CANCELADO", "Imprevisto na agenda.", freelancer);
        assertEquals(200, chargeEvent("charge.refunded", paymentId, null, "90.00", null));
        assertEquals(1, count(paymentId, "REFUND"));

        assertEquals(200, chargeEvent("refund.failed", paymentId, "re_1", "90.00", "expired_or_canceled_card"));
        assertEquals("REFUND_FAILED", payment(contractId, client).get("status"));
        assertTrue(notificationTitles(client).stream().anyMatch(t -> t.startsWith("Reembolso não concluído")));
    }

    @Test
    void partialThenFullRefundAfterTransferTakesBackTheFreelancerShare() {
        readyAccount();
        var contractId = acceptedContract();
        var paymentId = releasedPayment(contractId);
        assertNotNull(gateway.transfers.get(UUID.fromString(paymentId)));

        // R$ 30 of 90 back to the client: the freelancer loses 30 x 81/90 = 27.
        assertEquals(200, chargeEvent("charge.refunded", paymentId, null, "30.00", null));
        assertEquals("RELEASED", payment(contractId, client).get("status"));
        assertEquals(money("27.00"), money(column(paymentId, "reversed_amount")));
        assertEquals(money("27.00"), money(gateway.reversals.get("reversal-refund-" + paymentId + "-3000")));
        assertEquals(1, count(paymentId, "TRANSFER_REVERSAL"));
        var clientWallet = call(HttpMethod.GET, "/users/me/wallet", null, client);
        assertEquals(money("60.00"), money(clientWallet.get("paid")));
        assertEquals(money("30.00"), money(clientWallet.get("refunded")));
        var wallet = call(HttpMethod.GET, "/users/me/wallet", null, freelancer);
        assertEquals(money("54.00"), money(wallet.get("transferred")));

        assertEquals(200, chargeEvent("charge.refunded", paymentId, null, "90.00", null));
        assertEquals("REFUNDED", payment(contractId, client).get("status"));
        assertEquals(money("81.00"), money(column(paymentId, "reversed_amount")));
        assertEquals(money("54.00"), money(gateway.reversals.get("reversal-refund-" + paymentId + "-9000")));
        assertEquals(2, count(paymentId, "REFUND"));
        assertEquals(money("90.00"), money(payment(contractId, client).get("refundedAmount")));
    }

    @Test
    void partialRefundBeforeTheTransferLowersWhatIsSent() {
        var contractId = acceptedContract();
        var paymentId = paidPayment(contractId);
        assertEquals(200, chargeEvent("charge.refunded", paymentId, null, "10.00", null));
        assertEquals("PAID", payment(contractId, client).get("status"));
        status(contractId, "EM_ANDAMENTO", null, freelancer);
        status(contractId, "AGUARDANDO_CONFIRMACAO", "Tomada trocada.", freelancer);
        status(contractId, "CONCLUIDO", null, client);
        var wallet = call(HttpMethod.GET, "/users/me/wallet", null, freelancer);
        assertEquals(money("72.00"), money(wallet.get("awaitingAccount")));
        // The admin's pending list shows the same reduced share.
        var summary = call(HttpMethod.GET, "/admin/payments", null, adminToken());
        assertEquals(money("72.00"), money(issueAmount(summary, paymentId)));
        readyAccount();
        // 81 minus 10 x 81/90 = 9.
        assertEquals(money("72.00"), money(gateway.transfers.get(UUID.fromString(paymentId)).amount()));
    }

    @Test
    void chargebackHoldsTheTransferUntilItIsWon() {
        readyAccount();
        var contractId = acceptedContract();
        var paymentId = paidPayment(contractId);
        assertEquals(200, chargeEvent("charge.dispute.created", paymentId, "dp_1", "90.00", "needs_response"));
        assertEquals(200, chargeEvent("charge.dispute.created", paymentId, "dp_1", "90.00", "needs_response"));
        assertEquals(1, count(paymentId, "CHARGEBACK"));
        assertEquals("OPEN", payment(contractId, client).get("disputeStatus"));

        status(contractId, "EM_ANDAMENTO", null, freelancer);
        status(contractId, "AGUARDANDO_CONFIRMACAO", "Tomada trocada.", freelancer);
        status(contractId, "CONCLUIDO", null, client);
        assertNull(gateway.transfers.get(UUID.fromString(paymentId)));

        assertEquals(200, chargeEvent("charge.dispute.closed", paymentId, "dp_1", "90.00", "won"));
        assertEquals("WON", payment(contractId, client).get("disputeStatus"));
        assertEquals(1, count(paymentId, "CHARGEBACK_REVERSAL"));
        assertNotNull(gateway.transfers.get(UUID.fromString(paymentId)));
    }

    @Test
    void lostChargebackTakesBackTheWholeTransfer() {
        readyAccount();
        var contractId = acceptedContract();
        var paymentId = releasedPayment(contractId);
        assertEquals(200, chargeEvent("charge.dispute.created", paymentId, "dp_2", "90.00", "needs_response"));
        assertEquals(200, chargeEvent("charge.dispute.closed", paymentId, "dp_2", "90.00", "lost"));
        assertEquals("CHARGED_BACK", payment(contractId, client).get("status"));
        assertEquals("LOST", payment(contractId, client).get("disputeStatus"));
        assertEquals(money("81.00"), money(gateway.reversals.get("reversal-dispute-dp_2")));
        assertEquals(1, count(paymentId, "TRANSFER_REVERSAL"));
        var wallet = call(HttpMethod.GET, "/users/me/wallet", null, freelancer);
        assertEquals(money("0.00"), money(wallet.get("transferred")));
        // A late repeat of the result changes nothing.
        assertEquals(200, chargeEvent("charge.dispute.closed", paymentId, "dp_2", "90.00", "lost"));
        assertEquals(1, count(paymentId, "TRANSFER_REVERSAL"));
    }

    @Test
    void failedReversalIsRecordedForTheAdmin() {
        readyAccount();
        var contractId = acceptedContract();
        var paymentId = releasedPayment(contractId);
        gateway.failNextReversals.set(1);
        assertEquals(200, chargeEvent("charge.dispute.created", paymentId, "dp_3", "90.00", "needs_response"));
        assertEquals(200, chargeEvent("charge.dispute.closed", paymentId, "dp_3", "90.00", "lost"));
        assertEquals("CHARGED_BACK", payment(contractId, client).get("status"));
        assertTrue(text(paymentId, "transfer_error").startsWith("Estorno"));
        assertEquals(money("0.00"), money(column(paymentId, "reversed_amount")));

        var admin = adminToken();
        assertEquals(
                "REVERSAL_FAILED",
                issueKind(call(HttpMethod.GET, "/admin/payments", null, admin), paymentId));
        expect(
                403,
                () ->
                        call(
                                HttpMethod.POST,
                                "/admin/payments/" + paymentId + "/reversal-resolved",
                                null,
                                client));
        call(HttpMethod.POST, "/admin/payments/" + paymentId + "/reversal-resolved", null, admin);
        assertNull(issueKind(call(HttpMethod.GET, "/admin/payments", null, admin), paymentId));
        expect(
                409,
                () ->
                        call(
                                HttpMethod.POST,
                                "/admin/payments/" + paymentId + "/reversal-resolved",
                                null,
                                admin));
    }

    @Test
    void cancellationDuringAChargebackRefundsOnlyIfItIsWon() {
        var contractId = acceptedContract();
        var paymentId = paidPayment(contractId);
        assertEquals(200, chargeEvent("charge.dispute.created", paymentId, "dp_4", "90.00", "needs_response"));
        status(contractId, "CANCELADO", "Imprevisto na agenda.", freelancer);
        assertEquals("PAID", payment(contractId, client).get("status"));
        assertFalse(gateway.refunds.contains(FakePaymentGateway.intentId(paymentId)));

        assertEquals(200, chargeEvent("charge.dispute.closed", paymentId, "dp_4", "90.00", "won"));
        assertEquals("REFUNDED", payment(contractId, client).get("status"));
        assertTrue(gateway.refunds.contains(FakePaymentGateway.intentId(paymentId)));
        assertEquals(1, count(paymentId, "REFUND"));
    }

    // ------------------------------------------------------------ admin (etapa 5)

    String adminToken() {
        var a =
                users.saveAndFlush(
                        new User(
                                "Admin Pendências",
                                UUID.randomUUID() + "@example.test",
                                passwords.encode("Strong12345"),
                                "61999990000",
                                Role.ADMIN));
        return call(
                        HttpMethod.POST,
                        "/auth/login",
                        Map.of("email", a.getEmail(), "password", "Strong12345"),
                        null)
                .get("accessToken")
                .toString();
    }

    @SuppressWarnings("unchecked")
    String issueKind(Map<String, Object> summary, String paymentId) {
        return ((List<Map<String, Object>>) summary.get("issues"))
                .stream()
                        .filter(i -> paymentId.equals(i.get("paymentId")))
                        .map(i -> (String) i.get("kind"))
                        .findFirst()
                        .orElse(null);
    }

    @SuppressWarnings("unchecked")
    Object issueAmount(Map<String, Object> summary, String paymentId) {
        return ((List<Map<String, Object>>) summary.get("issues"))
                .stream()
                        .filter(i -> paymentId.equals(i.get("paymentId")))
                        .map(i -> i.get("amount"))
                        .findFirst()
                        .orElse(null);
    }

    @Test
    void adminSeesIssuesAndRetriesAFailedTransfer() {
        var admin = adminToken();
        readyAccount();
        gateway.failNextTransfers.set(2);
        var contractId = acceptedContract();
        var paymentId = releasedPayment(contractId);

        var summary = call(HttpMethod.GET, "/admin/payments", null, admin);
        assertEquals("TRANSFER_FAILED", issueKind(summary, paymentId));
        expect(
                403,
                () -> call(HttpMethod.POST, "/admin/payments/" + paymentId + "/transfer", null, client));
        // Stripe refuses once more: the admin sees why.
        expect(
                409,
                () -> call(HttpMethod.POST, "/admin/payments/" + paymentId + "/transfer", null, admin));

        var view = call(HttpMethod.POST, "/admin/payments/" + paymentId + "/transfer", null, admin);
        assertNotNull(view.get("transferredAt"));
        summary = call(HttpMethod.GET, "/admin/payments", null, admin);
        assertNull(issueKind(summary, paymentId));
        assertTrue(money(summary.get("transferred")).compareTo(new BigDecimal("81.00")) >= 0);
        // Already sent: nothing to retry.
        expect(
                409,
                () -> call(HttpMethod.POST, "/admin/payments/" + paymentId + "/transfer", null, admin));
    }

    @Test
    void adminSeesWaitingAccountsAndOpenChargebacks() {
        var admin = adminToken();
        var waiting = releasedPayment(acceptedContract());
        var disputedContract = acceptedContract();
        var disputed = paidPayment(disputedContract);
        assertEquals(200, chargeEvent("charge.dispute.created", disputed, "dp_adm", "90.00", "needs_response"));

        var summary = call(HttpMethod.GET, "/admin/payments", null, admin);
        assertEquals("AWAITING_ACCOUNT", issueKind(summary, waiting));
        assertEquals("CHARGEBACK_OPEN", issueKind(summary, disputed));
        assertTrue(money(summary.get("inChargeback")).compareTo(new BigDecimal("90.00")) >= 0);
        // An account that exists but is not ready: Stripe is asked again, still 409.
        call(HttpMethod.POST, "/users/me/payout-account/session", null, freelancer);
        expect(
                409,
                () -> call(HttpMethod.POST, "/admin/payments/" + waiting + "/transfer", null, admin));
    }

    @Test
    void bankInquiryDoesNotHoldTheMoney() {
        readyAccount();
        var contractId = acceptedContract();
        var paymentId = paidPayment(contractId);
        assertEquals(
                200,
                chargeEvent(
                        "charge.dispute.created", paymentId, "dp_inq", "90.00", "warning_needs_response"));
        assertNull(payment(contractId, client).get("disputeStatus"));
        assertEquals(0, count(paymentId, "CHARGEBACK"));
        status(contractId, "EM_ANDAMENTO", null, freelancer);
        status(contractId, "AGUARDANDO_CONFIRMACAO", "Tomada trocada.", freelancer);
        status(contractId, "CONCLUIDO", null, client);
        assertNotNull(gateway.transfers.get(UUID.fromString(paymentId)));
    }
}
