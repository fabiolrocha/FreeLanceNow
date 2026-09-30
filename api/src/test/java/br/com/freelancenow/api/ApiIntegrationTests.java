package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.client.*;

import java.util.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ApiIntegrationTests {
    @Value("${local.server.port}")
    int port;

    @Autowired JdbcTemplate db;
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

    @Test
    @Order(8)
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
}
