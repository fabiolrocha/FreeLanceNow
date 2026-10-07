package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import br.com.freelancenow.api.catalog.*;
import br.com.freelancenow.api.config.DemoData;
import br.com.freelancenow.api.users.UserRepository;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.*;

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

    @Test
    @Order(30)
    void emptyDatabaseIsMigratedAndDemoSeedIsIdempotent() {
        assertEquals(
                2,
                db.queryForObject(
                        "select count(*) from flyway_schema_history where success", Integer.class));
        var seed = new DemoData(users, categories, services, passwords);
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
