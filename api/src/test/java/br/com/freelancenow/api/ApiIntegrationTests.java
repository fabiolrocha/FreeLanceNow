package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import br.com.freelancenow.api.catalog.*;
import br.com.freelancenow.api.config.DemoData;
import br.com.freelancenow.api.contracts.ContractService;
import br.com.freelancenow.api.demands.DemandRepository;
import br.com.freelancenow.api.demands.ProposalRepository;
import br.com.freelancenow.api.users.UserRepository;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.*;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ApiIntegrationTests {
    @Value("${local.server.port}")
    int port;

    @Autowired JdbcTemplate db;
    @Autowired UserRepository users;
    @Autowired CategoryRepository categories;
    @Autowired ServiceRepository services;
    @Autowired DemandRepository demands;
    @Autowired ProposalRepository proposals;
    @Autowired ContractService contractService;
    @Autowired PasswordEncoder passwords;
    private final String prefix = UUID.randomUUID().toString();
    private String freelancerToken, clientToken, otherToken, serviceId;
    private static final String CATEGORY = "10000000-0000-0000-0000-000000000001";

    private RestClient http() {
        return RestClient.create("http://localhost:" + port);
    }

    private Map<String, Object> registration(String name, String role) {
        return Map.of(
                "name",
                name,
                "email",
                prefix + name + "@example.test",
                "password",
                "Strong12345",
                "phone",
                "61999990000",
                "role",
                role,
                "acceptedTerms",
                true);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> post(String path, Map<String, Object> body, String token) {
        return http().post()
                .uri(path)
                .headers(
                        h -> {
                            if (token != null) h.setBearerAuth(token);
                        })
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);
    }

    private Map<String, Object> listing(String title, String status) {
        return Map.of(
                "title",
                title,
                "description",
                "Instalação com teste de funcionamento.",
                "categoryId",
                CATEGORY,
                "price",
                180,
                "deliveryDays",
                1,
                "status",
                status);
    }

    private void expect(int code, Runnable request) {
        var e = assertThrows(HttpClientErrorException.class, request::run);
        assertEquals(code, e.getStatusCode().value());
        assertTrue(e.getResponseBodyAsString().contains("status"));
    }

    @Test
    @Order(1)
    void registrationCreatesHashedPasswordAndSession() {
        var result = post("/api/v1/auth/register", registration("freela", "FREELANCER"), null);
        freelancerToken = result.get("accessToken").toString();
        clientToken =
                post("/api/v1/auth/register", registration("client", "CLIENT"), null)
                        .get("accessToken")
                        .toString();
        otherToken =
                post("/api/v1/auth/register", registration("other", "FREELANCER"), null)
                        .get("accessToken")
                        .toString();
        assertEquals("Bearer", result.get("tokenType"));
        assertEquals(3, freelancerToken.split("\\.").length);
        var hash =
                db.queryForObject(
                        "select password_hash from app_user where email = ?",
                        String.class,
                        prefix + "freela@example.test");
        assertNotEquals("Strong12345", hash);
        assertTrue(hash.startsWith("$2"));
        assertFalse(result.toString().contains("passwordHash"));
        assertFalse(result.toString().contains("Strong12345"));
    }

    @Test
    @Order(2)
    void emailIsNormalizedBeforeDuplicateCheck() {
        var body = new HashMap<>(registration("freela", "FREELANCER"));
        body.put("email", (prefix + "freela@example.test").toUpperCase(Locale.ROOT));
        expect(409, () -> post("/api/v1/auth/register", body, null));
        var login =
                post(
                        "/api/v1/auth/login",
                        Map.of(
                                "email",
                                (prefix + "freela@example.test").toUpperCase(Locale.ROOT),
                                "password",
                                "Strong12345"),
                        null);
        assertNotNull(login.get("accessToken"));
    }

    @Test
    @Order(2)
    void duplicateEmailAndAdminRegistrationAreRejected() {
        expect(
                409,
                () -> post("/api/v1/auth/register", registration("freela", "FREELANCER"), null));
        expect(400, () -> post("/api/v1/auth/register", registration("admin", "ADMIN"), null));
        var body = new HashMap<>(registration("noTerms", "CLIENT"));
        body.put("acceptedTerms", false);
        expect(400, () -> post("/api/v1/auth/register", body, null));
        body.put("acceptedTerms", true);
        body.put("password", "12345678");
        expect(400, () -> post("/api/v1/auth/register", body, null));
    }

    @Test
    @Order(3)
    void loginAndProtectedProfileRequireValidCredentials() {
        var login =
                post(
                        "/api/v1/auth/login",
                        Map.of("email", prefix + "freela@example.test", "password", "Strong12345"),
                        null);
        assertNotNull(login.get("accessToken"));
        expect(
                401,
                () ->
                        post(
                                "/api/v1/auth/login",
                                Map.of(
                                        "email",
                                        prefix + "freela@example.test",
                                        "password",
                                        "wrong123"),
                                null));
        expect(401, () -> http().get().uri("/api/v1/users/me").retrieve().toBodilessEntity());
        expect(
                401,
                () ->
                        http().get()
                                .uri("/api/v1/users/me")
                                .headers(h -> h.setBearerAuth("invalid"))
                                .retrieve()
                                .toBodilessEntity());
        var me =
                http().get()
                        .uri("/api/v1/users/me")
                        .headers(h -> h.setBearerAuth(freelancerToken))
                        .retrieve()
                        .body(Map.class);
        assertEquals("FREELANCER", me.get("role"));
    }

    @Test
    @Order(4)
    void onlyFreelancerCanCreateAndOwnerCanChangeService() {
        expect(403, () -> post("/api/v1/services", listing("Chuveiro", "ACTIVE"), clientToken));
        serviceId =
                post("/api/v1/services", listing("Chuveiro", "ACTIVE"), freelancerToken)
                        .get("id")
                        .toString();
        expect(
                403,
                () ->
                        http().put()
                                .uri("/api/v1/services/" + serviceId)
                                .headers(h -> h.setBearerAuth(otherToken))
                                .body(listing("Outra pessoa", "ACTIVE"))
                                .retrieve()
                                .toBodilessEntity());
        assertEquals(
                200,
                http().get()
                        .uri("/api/v1/services/" + serviceId)
                        .retrieve()
                        .toBodilessEntity()
                        .getStatusCode()
                        .value());
    }

    @Test
    @Order(5)
    void draftsArePrivateAndSearchIsValidated() {
        var draftId =
                post("/api/v1/services", listing("Rascunho", "DRAFT"), freelancerToken)
                        .get("id")
                        .toString();
        expect(
                404,
                () ->
                        http().get()
                                .uri("/api/v1/services/" + draftId)
                                .retrieve()
                                .toBodilessEntity());
        expect(
                400,
                () -> http().get().uri("/api/v1/services?size=1000").retrieve().toBodilessEntity());
        expect(
                400,
                () -> http().get().uri("/api/v1/services?page=-1").retrieve().toBodilessEntity());
        expect(
                400,
                () ->
                        http().get()
                                .uri("/api/v1/services?minPrice=500&maxPrice=10")
                                .retrieve()
                                .toBodilessEntity());
        var found = http().get().uri("/api/v1/services?q=Chuveiro").retrieve().body(Map.class);
        assertTrue(found.get("items").toString().contains(serviceId));
    }

    @Test
    @Order(6)
    void activeServicesHaveLimitOfTwenty() {
        for (int i = 1; i < 20; i++)
            post("/api/v1/services", listing("Serviço " + i, "ACTIVE"), freelancerToken);
        expect(
                409,
                () ->
                        post(
                                "/api/v1/services",
                                listing("Excede limite", "ACTIVE"),
                                freelancerToken));
        http().patch()
                .uri("/api/v1/services/" + serviceId + "/status")
                .headers(h -> h.setBearerAuth(freelancerToken))
                .body(Map.of("status", "INACTIVE"))
                .retrieve()
                .toBodilessEntity();
        assertNotNull(
                post("/api/v1/services", listing("Vaga liberada", "ACTIVE"), freelancerToken)
                        .get("id"));
    }

    @Test
    @Order(7)
    void publicProfileDoesNotExposeContactOrPassword() {
        var response = http().get().uri("/api/v1/freelancers").retrieve().body(String.class);
        assertFalse(response.contains("email"));
        assertFalse(response.contains("phone"));
        assertFalse(response.contains("password"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> send(
            HttpMethod method, String path, Map<String, Object> body, String token) {
        return http().method(method)
                .uri(path)
                .headers(h -> h.setBearerAuth(token))
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getJson(String path, String token, Object... vars) {
        return http().get()
                .uri(path, vars)
                .headers(
                        h -> {
                            if (token != null) h.setBearerAuth(token);
                        })
                .retrieve()
                .body(Map.class);
    }

    private String userId(String token) {
        return getJson("/api/v1/users/me", token).get("id").toString();
    }

    @Test
    @Order(8)
    void profileUpdateValidatesFieldsAndKeepsEmailAndRole() {
        var updated =
                send(
                        HttpMethod.PUT,
                        "/api/v1/users/me",
                        Map.of(
                                "name", "  Freela Atualizado  ",
                                "phone", "(61) 98888-7777",
                                "city", "Taguatinga, DF",
                                "bio", "Instalações elétricas.",
                                "email", "outro@example.test",
                                "role", "ADMIN"),
                        freelancerToken);
        assertEquals("Freela Atualizado", updated.get("name"));
        assertEquals(prefix + "freela@example.test", updated.get("email"));
        assertEquals("FREELANCER", updated.get("role"));
        var e =
                assertThrows(
                        HttpClientErrorException.class,
                        () ->
                                send(
                                        HttpMethod.PUT,
                                        "/api/v1/users/me",
                                        Map.of(
                                                "name", "",
                                                "phone", "abc",
                                                "city", "DF",
                                                "bio", ""),
                                        freelancerToken));
        assertEquals(400, e.getStatusCode().value());
        assertTrue(e.getResponseBodyAsString().contains("phone"));
        assertTrue(e.getResponseBodyAsString().contains("name"));
        assertEquals("Freela Atualizado", getJson("/api/v1/users/me", freelancerToken).get("name"));
    }

    @Test
    @Order(9)
    void publicFreelancerDetailHidesContactAndNonFreelancers() {
        var id = userId(freelancerToken);
        var body = http().get().uri("/api/v1/freelancers/" + id).retrieve().body(String.class);
        assertTrue(body.contains("Freela Atualizado"));
        assertFalse(body.contains("email"));
        assertFalse(body.contains("phone"));
        var clientId = userId(clientToken);
        expect(
                404,
                () ->
                        http().get()
                                .uri("/api/v1/freelancers/" + clientId)
                                .retrieve()
                                .toBodilessEntity());
    }

    @Test
    @Order(10)
    void onlyOwnerCanChangeStatusAndClientCannotListServices() {
        expect(
                403,
                () ->
                        send(
                                HttpMethod.PATCH,
                                "/api/v1/services/" + serviceId + "/status",
                                Map.of("status", "DRAFT"),
                                otherToken));
        expect(
                403,
                () ->
                        http().get()
                                .uri("/api/v1/freelancer/services")
                                .headers(h -> h.setBearerAuth(clientToken))
                                .retrieve()
                                .toBodilessEntity());
        expect(401, () -> post("/api/v1/services", listing("Sem token", "ACTIVE"), null));
    }

    @Test
    @Order(11)
    @SuppressWarnings("unchecked")
    void searchFiltersByCityCategoryPriceAndHidesDraftsAndInactive() {
        var token =
                post("/api/v1/auth/register", registration("search", "FREELANCER"), null)
                        .get("accessToken")
                        .toString();
        var city = "Cidade " + prefix;
        send(
                HttpMethod.PUT,
                "/api/v1/users/me",
                Map.of("name", "Busca", "phone", "61999990000", "city", city, "bio", ""),
                token);
        var cheap = new HashMap<>(listing("Barato 50%_off", "ACTIVE"));
        cheap.put("price", 100);
        var expensive = new HashMap<>(listing("Caro", "ACTIVE"));
        expensive.put("price", 900);
        expensive.put("categoryId", "10000000-0000-0000-0000-000000000004");
        var cheapId = post("/api/v1/services", cheap, token).get("id").toString();
        var expensiveId = post("/api/v1/services", expensive, token).get("id").toString();
        var draftId =
                post("/api/v1/services", listing("Rascunho busca", "DRAFT"), token)
                        .get("id")
                        .toString();
        var inactiveId =
                post("/api/v1/services", listing("Inativo busca", "INACTIVE"), token)
                        .get("id")
                        .toString();
        var cityParam = city.toUpperCase(Locale.ROOT);

        var byCity = getJson("/api/v1/services?size=50&city={c}", null, cityParam);
        var items = byCity.get("items").toString();
        assertEquals(2, ((Number) byCity.get("totalElements")).intValue());
        assertTrue(items.contains(cheapId) && items.contains(expensiveId));
        assertFalse(items.contains(draftId) || items.contains(inactiveId));

        var byCategory =
                getJson(
                        "/api/v1/services?city={c}&categoryId=10000000-0000-0000-0000-000000000004",
                        null,
                        cityParam);
        assertEquals(List.of(expensiveId), ids(byCategory));

        var byPrice =
                getJson("/api/v1/services?city={c}&minPrice=50&maxPrice=150", null, cityParam);
        assertEquals(List.of(cheapId), ids(byPrice));

        var byText = getJson("/api/v1/services?city={c}&q={q}", null, cityParam, "50%_");
        assertEquals(List.of(cheapId), ids(byText));

        var paged = getJson("/api/v1/services?city={c}&size=1&page=1", null, cityParam);
        assertEquals(1, ((List<?>) paged.get("items")).size());
        assertEquals(2, ((Number) paged.get("totalPages")).intValue());

        var mine =
                http().get()
                        .uri("/api/v1/freelancer/services")
                        .headers(h -> h.setBearerAuth(token))
                        .retrieve()
                        .body(List.class);
        assertEquals(4, mine.size());
        expect(
                400,
                () ->
                        http().get()
                                .uri("/api/v1/services?categoryId=nao-e-uuid")
                                .retrieve()
                                .toBodilessEntity());
    }

    @SuppressWarnings("unchecked")
    private List<String> ids(Map<String, Object> page) {
        return ((List<Map<String, Object>>) page.get("items"))
                .stream().map(i -> i.get("id").toString()).toList();
    }

    @Test
    @Order(20)
    void suspendedAccountCannotUseExistingToken() {
        db.update(
                "update app_user set active = false where email = ?",
                prefix + "other@example.test");
        expect(
                403,
                () ->
                        http().get()
                                .uri("/api/v1/users/me")
                                .headers(h -> h.setBearerAuth(otherToken))
                                .retrieve()
                                .toBodilessEntity());
        expect(
                401,
                () ->
                        post(
                                "/api/v1/auth/login",
                                Map.of(
                                        "email",
                                        prefix + "other@example.test",
                                        "password",
                                        "Strong12345"),
                                null));
    }

    @Test
    @Order(21)
    void suspendedFreelancerDisappearsFromPublicProfiles() {
        var id =
                db.queryForObject(
                        "select id::text from app_user where email = ?",
                        String.class,
                        prefix + "other@example.test");
        expect(
                404,
                () -> http().get().uri("/api/v1/freelancers/" + id).retrieve().toBodilessEntity());
        assertFalse(
                http().get().uri("/api/v1/freelancers").retrieve().body(String.class).contains(id));
    }

    private String contractFreelaToken, contractServiceId;

    @Test
    @Order(12)
    @SuppressWarnings("unchecked")
    void clientRequestsContractAndFreelancerCompletesCycleWithPersistentHistory() {
        contractFreelaToken =
                post("/api/v1/auth/register", registration("contractfreela", "FREELANCER"), null)
                        .get("accessToken")
                        .toString();
        contractServiceId =
                post("/api/v1/services", listing("Chuveiro", "ACTIVE"), contractFreelaToken)
                        .get("id")
                        .toString();
        var futureDate = LocalDate.now(ZoneId.of("America/Sao_Paulo")).plusDays(5).toString();
        var todayDate = LocalDate.now(ZoneId.of("America/Sao_Paulo")).toString();

        // Freelancer cannot request service
        expect(
                403,
                () ->
                        post(
                                "/api/v1/contracts",
                                Map.of(
                                        "serviceId", contractServiceId,
                                        "date", futureDate,
                                        "description", "Tentativa de freelancer",
                                        "address", "Asa Sul"),
                                contractFreelaToken));

        // Past/today date is rejected
        expect(
                400,
                () ->
                        post(
                                "/api/v1/contracts",
                                Map.of(
                                        "serviceId", contractServiceId,
                                        "date", todayDate,
                                        "description", "Data de hoje inválida",
                                        "address", "Asa Sul"),
                                clientToken));

        var created =
                post(
                        "/api/v1/contracts",
                        Map.of(
                                "serviceId", contractServiceId,
                                "date", futureDate,
                                "description", "Troca de disjuntor e revisão de tomada.",
                                "address", "QNA 12, Taguatinga"),
                        clientToken);
        var contractId = created.get("id").toString();
        assertEquals("PENDENTE", created.get("status"));
        assertEquals("Chuveiro", created.get("title"));
        assertEquals(0, new java.math.BigDecimal("180").compareTo(new java.math.BigDecimal(created.get("price").toString())));

        // Duplicate pending request by same client for same service returns 409
        expect(
                409,
                () ->
                        post(
                                "/api/v1/contracts",
                                Map.of(
                                        "serviceId", contractServiceId,
                                        "date", futureDate,
                                        "description", "Duplicada",
                                        "address", ""),
                                clientToken));

        // Non-participant cannot read or transition contract
        expect(
                403,
                () ->
                        http().get()
                                .uri("/api/v1/contracts/" + contractId)
                                .headers(h -> h.setBearerAuth(otherToken))
                                .retrieve()
                                .toBodilessEntity());
        expect(
                403,
                () ->
                        send(
                                HttpMethod.PATCH,
                                "/api/v1/contracts/" + contractId + "/status",
                                Map.of("status", "ACEITO"),
                                otherToken));

        // Client cannot accept own request (invalid role transition)
        expect(
                409,
                () ->
                        send(
                                HttpMethod.PATCH,
                                "/api/v1/contracts/" + contractId + "/status",
                                Map.of("status", "ACEITO"),
                                clientToken));

        // Changing service title/price afterwards preserves contract snapshot
        send(
                HttpMethod.PUT,
                "/api/v1/services/" + contractServiceId,
                Map.of(
                        "title", "Chuveiro Editado",
                        "description", "Descrição atualizada",
                        "categoryId", CATEGORY,
                        "price", 350,
                        "deliveryDays", 2,
                        "status", "ACTIVE"),
                contractFreelaToken);

        var accepted =
                send(
                        HttpMethod.PATCH,
                        "/api/v1/contracts/" + contractId + "/status",
                        Map.of("status", "ACEITO"),
                        contractFreelaToken);
        assertEquals("ACEITO", accepted.get("status"));
        assertEquals("Chuveiro", accepted.get("title"));
        assertEquals(0, new java.math.BigDecimal("180").compareTo(new java.math.BigDecimal(accepted.get("price").toString())));

        var inProgress =
                send(
                        HttpMethod.PATCH,
                        "/api/v1/contracts/" + contractId + "/status",
                        Map.of("status", "EM_ANDAMENTO"),
                        contractFreelaToken);
        assertEquals("EM_ANDAMENTO", inProgress.get("status"));

        var awaiting =
                send(
                        HttpMethod.PATCH,
                        "/api/v1/contracts/" + contractId + "/status",
                        Map.of(
                                "status",
                                "AGUARDANDO_CONFIRMACAO",
                                "comment",
                                "Instalação concluída e testada."),
                        contractFreelaToken);
        assertEquals("AGUARDANDO_CONFIRMACAO", awaiting.get("status"));
        assertEquals("Instalação concluída e testada.", awaiting.get("observations"));

        var completed =
                send(
                        HttpMethod.PATCH,
                        "/api/v1/contracts/" + contractId + "/status",
                        Map.of("status", "CONCLUIDO"),
                        clientToken);
        assertEquals("CONCLUIDO", completed.get("status"));
        assertNotNull(completed.get("completedAt"));
        var history = (List<Map<String, Object>>) completed.get("history");
        assertEquals(5, history.size());
        assertEquals("PENDENTE", history.get(0).get("status"));
        assertEquals("CONCLUIDO", history.get(4).get("status"));
    }

    @Test
    @Order(13)
    void clientContestsCompletionAndDisputeRequiresReason() {
        var futureDate = LocalDate.now(ZoneId.of("America/Sao_Paulo")).plusDays(6).toString();
        var contractId =
                post(
                                "/api/v1/contracts",
                                Map.of(
                                        "serviceId", contractServiceId,
                                        "date", futureDate,
                                        "description", "Serviço para teste de contestação.",
                                        "address", "Águas Claras"),
                                clientToken)
                        .get("id")
                        .toString();
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + contractId + "/status",
                Map.of("status", "ACEITO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + contractId + "/status",
                Map.of("status", "EM_ANDAMENTO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + contractId + "/status",
                Map.of("status", "AGUARDANDO_CONFIRMACAO"),
                contractFreelaToken);

        expect(
                400,
                () ->
                        send(
                                HttpMethod.PATCH,
                                "/api/v1/contracts/" + contractId + "/status",
                                Map.of("status", "EM_DISPUTA", "comment", "   "),
                                clientToken));

        var disputed =
                send(
                        HttpMethod.PATCH,
                        "/api/v1/contracts/" + contractId + "/status",
                        Map.of(
                                "status",
                                "EM_DISPUTA",
                                "comment",
                                "Equipamento apresentou mau contato após saída."),
                        clientToken);
        assertEquals("EM_DISPUTA", disputed.get("status"));
        assertEquals("Equipamento apresentou mau contato após saída.", disputed.get("dispute"));
    }

    @Test
    @Order(14)
    void deadlineJobsCancelPendingAfter48hAndConfirmAfter5DaysIdempotently() {
        var futureDate = LocalDate.now(ZoneId.of("America/Sao_Paulo")).plusDays(8).toString();
        var pendingId =
                post(
                                "/api/v1/contracts",
                                Map.of(
                                        "serviceId", contractServiceId,
                                        "date", futureDate,
                                        "description", "Solicitação para expirar em 48h.",
                                        "address", ""),
                                clientToken)
                        .get("id")
                        .toString();

        // Before 48h: nothing expires
        assertEquals(0, contractService.processExpiredDeadlines(Instant.now().plus(Duration.ofHours(47))));
        assertEquals(
                "PENDENTE",
                getJson("/api/v1/contracts/" + pendingId, clientToken).get("status"));

        // After 48h: pending contract is automatically cancelled, and second run is idempotent
        var after48h = Instant.now().plus(Duration.ofHours(49));
        assertTrue(contractService.processExpiredDeadlines(after48h) >= 1);
        assertEquals(0, contractService.processExpiredDeadlines(after48h));
        assertEquals(
                "CANCELADO",
                getJson("/api/v1/contracts/" + pendingId, clientToken).get("status"));

        // Create another contract and move to AGUARDANDO_CONFIRMACAO to test 5-day auto-confirmation
        var awaitingId =
                post(
                                "/api/v1/contracts",
                                Map.of(
                                        "serviceId", contractServiceId,
                                        "date", futureDate,
                                        "description", "Solicitação para confirmar em 5 dias.",
                                        "address", ""),
                                clientToken)
                        .get("id")
                        .toString();
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + awaitingId + "/status",
                Map.of("status", "ACEITO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + awaitingId + "/status",
                Map.of("status", "EM_ANDAMENTO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + awaitingId + "/status",
                Map.of("status", "AGUARDANDO_CONFIRMACAO"),
                contractFreelaToken);

        var after5Days = Instant.now().plus(Duration.ofDays(5).plusHours(1));
        assertTrue(contractService.processExpiredDeadlines(after5Days) >= 1);
        assertEquals(0, contractService.processExpiredDeadlines(after5Days));
        var autoConfirmed = getJson("/api/v1/contracts/" + awaitingId, clientToken);
        assertEquals("CONCLUIDO", autoConfirmed.get("status"));
        assertNotNull(autoConfirmed.get("completedAt"));
    }

    @Test
    @Order(15)
    void reviewRequiresCompletedContractValidatesRatingUniquenessAndFreelancerReply() {
        var futureDate = LocalDate.now(ZoneId.of("America/Sao_Paulo")).plusDays(9).toString();
        var pendingId =
                post(
                                "/api/v1/contracts",
                                Map.of(
                                        "serviceId", contractServiceId,
                                        "date", futureDate,
                                        "description", "Contrato para validar avaliação.",
                                        "address", "Asa Sul"),
                                clientToken)
                        .get("id")
                        .toString();

        // Cannot review before completion
        expect(
                409,
                () ->
                        post(
                                "/api/v1/contracts/" + pendingId + "/review",
                                Map.of("rating", 5, "comment", "Antes de concluir"),
                                clientToken));

        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + pendingId + "/status",
                Map.of("status", "ACEITO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + pendingId + "/status",
                Map.of("status", "EM_ANDAMENTO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + pendingId + "/status",
                Map.of("status", "AGUARDANDO_CONFIRMACAO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + pendingId + "/status",
                Map.of("status", "CONCLUIDO"),
                clientToken);

        // Non-client (freelancer or other user) cannot review
        expect(
                403,
                () ->
                        post(
                                "/api/v1/contracts/" + pendingId + "/review",
                                Map.of("rating", 5, "comment", "Autoavaliação"),
                                contractFreelaToken));
        expect(
                403,
                () ->
                        post(
                                "/api/v1/contracts/" + pendingId + "/review",
                                Map.of("rating", 5, "comment", "Outro usuário"),
                                otherToken));

        // Invalid rating (0 or 6) or comment > 500 chars -> 400
        expect(
                400,
                () ->
                        post(
                                "/api/v1/contracts/" + pendingId + "/review",
                                Map.of("rating", 0, "comment", "Nota inválida"),
                                clientToken));
        expect(
                400,
                () ->
                        post(
                                "/api/v1/contracts/" + pendingId + "/review",
                                Map.of("rating", 6, "comment", "Nota inválida"),
                                clientToken));
        expect(
                400,
                () ->
                        post(
                                "/api/v1/contracts/" + pendingId + "/review",
                                Map.of("rating", 5, "comment", "x".repeat(501)),
                                clientToken));

        // Valid review -> 201
        var created =
                post(
                        "/api/v1/contracts/" + pendingId + "/review",
                        Map.of("rating", 5, "comment", "Excelente atendimento e pontualidade."),
                        clientToken);
        assertEquals(5, ((Number) created.get("rating")).intValue());
        assertEquals("Excelente atendimento e pontualidade.", created.get("comment"));

        // Duplicate review on same contract -> 409
        expect(
                409,
                () ->
                        post(
                                "/api/v1/contracts/" + pendingId + "/review",
                                Map.of("rating", 4, "comment", "Segunda tentativa"),
                                clientToken));

        // Client cannot reply; reply > 200 chars -> 400
        expect(
                403,
                () ->
                        post(
                                "/api/v1/contracts/" + pendingId + "/review/reply",
                                Map.of("reply", "Cliente tentando responder"),
                                clientToken));
        expect(
                400,
                () ->
                        post(
                                "/api/v1/contracts/" + pendingId + "/review/reply",
                                Map.of("reply", "r".repeat(201)),
                                contractFreelaToken));

        var replied =
                post(
                        "/api/v1/contracts/" + pendingId + "/review/reply",
                        Map.of("reply", "Muito obrigado pela confiança!"),
                        contractFreelaToken);
        assertEquals("Muito obrigado pela confiança!", replied.get("reply"));
        assertNotNull(replied.get("repliedAt"));

        // Duplicate reply -> 409
        expect(
                409,
                () ->
                        post(
                                "/api/v1/contracts/" + pendingId + "/review/reply",
                                Map.of("reply", "Outra resposta"),
                                contractFreelaToken));

        // Contract detail reflects rating, review and reviewReply
        var contractDetail = getJson("/api/v1/contracts/" + pendingId, clientToken);
        assertEquals(5, ((Number) contractDetail.get("rating")).intValue());
        assertEquals("Excelente atendimento e pontualidade.", contractDetail.get("review"));
        assertEquals("Muito obrigado pela confiança!", contractDetail.get("reviewReply"));
    }

    @Test
    @Order(16)
    @SuppressWarnings("unchecked")
    void reviewSevenDayWindowAndOneDecimalAverageRatingAndMinRatingFilter() {
        var futureDate = LocalDate.now(ZoneId.of("America/Sao_Paulo")).plusDays(10).toString();
        var secondContractId =
                post(
                                "/api/v1/contracts",
                                Map.of(
                                        "serviceId", contractServiceId,
                                        "date", futureDate,
                                        "description", "Segundo contrato para média 4.5.",
                                        "address", "Guará"),
                                clientToken)
                        .get("id")
                        .toString();
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + secondContractId + "/status",
                Map.of("status", "ACEITO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + secondContractId + "/status",
                Map.of("status", "EM_ANDAMENTO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + secondContractId + "/status",
                Map.of("status", "AGUARDANDO_CONFIRMACAO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + secondContractId + "/status",
                Map.of("status", "CONCLUIDO"),
                clientToken);
        post(
                "/api/v1/contracts/" + secondContractId + "/review",
                Map.of("rating", 4, "comment", "Bom serviço."),
                clientToken);

        var freelaId = userId(contractFreelaToken);
        var profile = getJson("/api/v1/freelancers/" + freelaId, null);
        assertEquals(4.5, ((Number) profile.get("averageRating")).doubleValue(), 0.001);
        assertEquals(2, ((Number) profile.get("reviewCount")).intValue());

        var freelaReviews =
                http().get()
                        .uri("/api/v1/freelancers/" + freelaId + "/reviews")
                        .retrieve()
                        .body(List.class);
        assertEquals(2, freelaReviews.size());

        var serviceReviews =
                http().get()
                        .uri("/api/v1/services/" + contractServiceId + "/reviews")
                        .retrieve()
                        .body(List.class);
        assertEquals(2, serviceReviews.size());

        var matchingMinRating =
                getJson("/api/v1/services?size=50&minRating=4.5", null);
        assertTrue(ids(matchingMinRating).contains(contractServiceId));

        var higherMinRating =
                getJson("/api/v1/services?size=50&minRating=4.6", null);
        assertFalse(ids(higherMinRating).contains(contractServiceId));

        // Expired 7-day window test
        var expiredContractId =
                post(
                                "/api/v1/contracts",
                                Map.of(
                                        "serviceId", contractServiceId,
                                        "date", futureDate,
                                        "description", "Contrato concluído há mais de 7 dias.",
                                        "address", "Sudoeste"),
                                clientToken)
                        .get("id")
                        .toString();
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + expiredContractId + "/status",
                Map.of("status", "ACEITO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + expiredContractId + "/status",
                Map.of("status", "EM_ANDAMENTO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + expiredContractId + "/status",
                Map.of("status", "AGUARDANDO_CONFIRMACAO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + expiredContractId + "/status",
                Map.of("status", "CONCLUIDO"),
                clientToken);
        db.update(
                "update contract set completed_at = now() - interval '8 days' where id = ?::uuid",
                expiredContractId);
        expect(
                409,
                () ->
                        post(
                                "/api/v1/contracts/" + expiredContractId + "/review",
                                Map.of("rating", 5, "comment", "Fora da janela de 7 dias"),
                                clientToken));
    }

    @Test
    @Order(17)
    @SuppressWarnings("unchecked")
    void demandsAndProposalsLifecycleUniquenessAndGeneratedContract() {
        // Freelancer cannot publish a demand
        expect(
                403,
                () ->
                        post(
                                "/api/v1/demands",
                                Map.of(
                                        "title", "Demanda de freelancer",
                                        "description", "Não permitida",
                                        "categoryId", CATEGORY,
                                        "budget", 400,
                                        "days", 3,
                                        "city", "Brasília, DF"),
                                contractFreelaToken));

        var demand =
                post(
                        "/api/v1/demands",
                        Map.of(
                                "title", "Revisão elétrica do escritório",
                                "description", "Troca de 8 tomadas e revisão do quadro geral.",
                                "categoryId", CATEGORY,
                                "budget", 450,
                                "days", 3,
                                "city", "Asa Norte, DF"),
                        clientToken);
        var demandId = demand.get("id").toString();
        assertEquals("OPEN", demand.get("status"));
        assertEquals("Revisão elétrica do escritório", demand.get("title"));

        // Client cannot send proposal
        expect(
                403,
                () ->
                        post(
                                "/api/v1/demands/" + demandId + "/proposals",
                                Map.of("price", 400, "days", 2, "message", "Proposta inválida"),
                                clientToken));

        // First freelancer sends proposal
        var proposal1 =
                post(
                        "/api/v1/demands/" + demandId + "/proposals",
                        Map.of(
                                "price", 420,
                                "days", 2,
                                "message", "Atendo com emissão de laudo técnico."),
                        contractFreelaToken);
        var proposal1Id = proposal1.get("id").toString();
        assertEquals("PENDING", proposal1.get("status"));

        // Duplicate pending proposal from same freelancer -> 409
        expect(
                409,
                () ->
                        post(
                                "/api/v1/demands/" + demandId + "/proposals",
                                Map.of(
                                        "price", 390,
                                        "days", 2,
                                        "message", "Segunda proposta pendente duplicada."),
                                contractFreelaToken));

        // Second freelancer sends competing proposal
        var proposal2 =
                post(
                        "/api/v1/demands/" + demandId + "/proposals",
                        Map.of(
                                "price", 440,
                                "days", 3,
                                "message", "Disponível para início imediato."),
                        otherToken);
        var proposal2Id = proposal2.get("id").toString();
        assertEquals("PENDING", proposal2.get("status"));

        // Non-owner cannot accept proposal
        expect(
                403,
                () -> post("/api/v1/proposals/" + proposal1Id + "/accept", Map.of(), contractFreelaToken));

        // Client accepts proposal1 -> closes demand, rejects proposal2, creates contract in ACEITO
        var acceptance = post("/api/v1/proposals/" + proposal1Id + "/accept", Map.of(), clientToken);
        var closedDemand = (Map<String, Object>) acceptance.get("demand");
        var acceptedProposal = (Map<String, Object>) acceptance.get("proposal");
        var generatedContract = (Map<String, Object>) acceptance.get("contract");
        assertEquals("CLOSED", closedDemand.get("status"));
        assertEquals("ACCEPTED", acceptedProposal.get("status"));
        assertEquals("ACEITO", generatedContract.get("status"));
        assertEquals("Revisão elétrica do escritório", generatedContract.get("title"));
        assertEquals(
                0,
                new java.math.BigDecimal("420")
                        .compareTo(new java.math.BigDecimal(generatedContract.get("price").toString())));

        // Competing proposal2 was automatically rejected
        var demandProposals =
                http().get()
                        .uri("/api/v1/demands/" + demandId + "/proposals")
                        .headers(h -> h.setBearerAuth(clientToken))
                        .retrieve()
                        .body(List.class);
        assertEquals(2, demandProposals.size());
        var p2After =
                ((List<Map<String, Object>>) demandProposals)
                        .stream()
                        .filter(p -> proposal2Id.equals(p.get("id").toString()))
                        .findFirst()
                        .orElseThrow();
        assertEquals("REJECTED", p2After.get("status"));

        // Closed demand refuses new proposals -> 409
        expect(
                409,
                () ->
                        post(
                                "/api/v1/demands/" + demandId + "/proposals",
                                Map.of("price", 380, "days", 1, "message", "Tarde demais"),
                                otherToken));

        // Generated contract can progress to completion and be reviewed
        var generatedContractId = generatedContract.get("id").toString();
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + generatedContractId + "/status",
                Map.of("status", "EM_ANDAMENTO"),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + generatedContractId + "/status",
                Map.of("status", "AGUARDANDO_CONFIRMACAO", "comment", "Serviço finalizado."),
                contractFreelaToken);
        send(
                HttpMethod.PATCH,
                "/api/v1/contracts/" + generatedContractId + "/status",
                Map.of("status", "CONCLUIDO"),
                clientToken);
        var demandReview =
                post(
                        "/api/v1/contracts/" + generatedContractId + "/review",
                        Map.of("rating", 5, "comment", "Demanda atendida com perfeição."),
                        clientToken);
        assertEquals(5, ((Number) demandReview.get("rating")).intValue());
    }

    @Test
    @Order(30)
    void emptyDatabaseIsMigratedAndDemoSeedIsIdempotent() {
        assertEquals(
                5,
                db.queryForObject(
                        "select count(*) from flyway_schema_history where success", Integer.class));
        var seed = new DemoData(users, categories, services, demands, proposals, passwords);
        seed.run();
        seed.run();
        assertEquals(
                5,
                db.queryForObject(
                        "select count(*) from app_user where email like '%@demo.freelancenow.test'",
                        Integer.class));
        assertEquals(
                8,
                db.queryForObject(
                        "select count(*) from service_listing s join app_user u on u.id ="
                                + " s.freelancer_id where u.email like '%@demo.freelancenow.test'",
                        Integer.class));
    }
}
