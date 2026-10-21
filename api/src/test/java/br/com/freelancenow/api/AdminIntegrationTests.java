package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import br.com.freelancenow.api.users.*;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.*;

import java.util.*;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "app.admin-bootstrap.enabled=true",
                    "app.admin-bootstrap.email=bootstrap-admin@example.test",
            "app.admin-bootstrap.password=AdminStrong12345",
                    "app.admin-bootstrap.name=Admin de teste"
        })
class AdminIntegrationTests {
    @Value("${local.server.port}")
    int port;

    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired JdbcTemplate db;
    @Autowired ApplicationContext context;
    String admin, client, freelancer, userId, freelaId;
    final String prefix = UUID.randomUUID().toString();

    Map<String, Object> call(HttpMethod method, String path, Object body, String token) {
        var req =
                RestClient.create("http://localhost:" + port)
                        .method(method)
                        .uri("/api/v1" + path)
                        .headers(
                                h -> {
                                    if (token != null) h.setBearerAuth(token);
                                });
        if (body != null)
            req.contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(body);
        return req.retrieve().body(Map.class);
    }

    List<Map<String, Object>> list(String path, String token) {
        return RestClient.create("http://localhost:" + port)
                .get()
                .uri("/api/v1" + path)
                .headers(
                        h -> {
                            if (token != null) h.setBearerAuth(token);
                        })
                .retrieve()
                .body(List.class);
    }

    Map<String, Object> register(String name, String role) {
        return call(
                HttpMethod.POST,
                "/auth/register",
                Map.of(
                        "name",
                        name,
                        "email",
                        UUID.randomUUID() + "@example.test",
                        "password",
                        "Strong12345",
                        "phone",
                        "61999990000",
                        "role",
                        role,
                        "acceptedTerms",
                        true),
                null);
    }

    void expect(int code, Runnable work) {
        var e = assertThrows(HttpClientErrorException.class, work::run);
        assertEquals(code, e.getStatusCode().value(), e.getResponseBodyAsString());
    }

    @BeforeEach
    void actors() {
        var a =
                users.saveAndFlush(
                        new User(
                                "Admin teste",
                                UUID.randomUUID() + "@example.test",
                                passwords.encode("Strong12345"),
                                "61999990000",
                                Role.ADMIN));
        admin =
                call(
                                HttpMethod.POST,
                                "/auth/login",
                                Map.of("email", a.getEmail(), "password", "Strong12345"),
                                null)
                        .get("accessToken")
                        .toString();
        var c = register("Cliente " + prefix, "CLIENT");
        client = c.get("accessToken").toString();
        userId = ((Map<?, ?>) c.get("user")).get("id").toString();
        var f = register("Freelancer " + prefix, "FREELANCER");
        freelancer = f.get("accessToken").toString();
        freelaId = ((Map<?, ?>) f.get("user")).get("id").toString();
    }

    @Test
    void adminEndpointsRequireActiveAdministratorAndSuspensionBlocksOldToken() {
        expect(401, () -> list("/admin/users", null));
        expect(403, () -> list("/admin/users", client));
        expect(403, () -> list("/admin/categories", freelancer));
        var view =
                list("/admin/users", admin).stream()
                        .filter(u -> u.get("id").equals(userId))
                        .findFirst()
                        .orElseThrow();
        assertFalse(view.containsKey("passwordHash"));
        assertFalse(view.containsKey("password"));
        call(
                HttpMethod.PATCH,
                "/admin/users/" + userId + "/status",
                Map.of("active", false, "reason", "Suspensão de teste"),
                admin);
        expect(403, () -> call(HttpMethod.GET, "/users/me", null, client));
        call(
                HttpMethod.PATCH,
                "/admin/users/" + userId + "/status",
                Map.of("active", true, "reason", "Reativação de teste"),
                admin);
        assertEquals(userId, call(HttpMethod.GET, "/users/me", null, client).get("id"));
        var adminId =
                list("/admin/users", admin).stream()
                        .filter(u -> u.get("role").equals("ADMIN"))
                        .findFirst()
                        .orElseThrow()
                        .get("id");
        expect(
                409,
                () ->
                        call(
                                HttpMethod.PATCH,
                                "/admin/users/" + adminId + "/status",
                                Map.of("active", false, "reason", "Tentativa"),
                                admin));
        assertEquals(
                2,
                list("/admin/audit", admin).stream()
                        .filter(e -> userId.equals(e.get("targetId")))
                        .count());
        expect(403, () -> list("/admin/audit", client));
    }

    @Test
    void categoryChangesPersistPreserveListingsAndAreAudited() {
        var category =
                call(
                        HttpMethod.POST,
                        "/admin/categories",
                        Map.of("name", "Categoria " + UUID.randomUUID()),
                        admin);
        String id = category.get("id").toString();
        var listing =
                call(
                        HttpMethod.POST,
                        "/services",
                        Map.of(
                                "title",
                                "Serviço preservado",
                                "description",
                                "Descrição de teste",
                                "categoryId",
                                id,
                                "price",
                                100,
                                "deliveryDays",
                                2,
                                "status",
                                "ACTIVE"),
                        freelancer);
        call(
                HttpMethod.PUT,
                "/admin/categories/" + id,
                Map.of("name", "Categoria renomeada " + UUID.randomUUID(), "active", false),
                admin);
        assertFalse(list("/categories", null).stream().anyMatch(c -> id.equals(c.get("id"))));
        assertEquals(
                listing.get("id"),
                call(HttpMethod.GET, "/services/" + listing.get("id"), null, null).get("id"));
        expect(
                400,
                () ->
                        call(
                                HttpMethod.POST,
                                "/services",
                                Map.of(
                                        "title",
                                        "Novo serviço",
                                        "description",
                                        "Teste",
                                        "categoryId",
                                        id,
                                        "price",
                                        100,
                                        "deliveryDays",
                                        2,
                                        "status",
                                        "ACTIVE"),
                                freelancer));
        assertEquals(
                2,
                list("/admin/audit", admin).stream()
                        .filter(e -> id.equals(e.get("targetId")))
                        .count());
        expect(400, () -> call(HttpMethod.POST, "/admin/categories", Map.of("name", "   "), admin));
        expect(
                409,
                () ->
                        call(
                                HttpMethod.POST,
                                "/admin/categories",
                                Map.of(
                                        "name",
                                        list("/admin/categories", admin).stream()
                                                .filter(c -> id.equals(c.get("id")))
                                                .findFirst()
                                                .orElseThrow()
                                                .get("name")),
                                admin));
    }

    @Test
    void configuredAdminBootstrapIsIdempotentAndNeverPublicRegistration() throws Exception {
        var login =
                call(
                        HttpMethod.POST,
                        "/auth/login",
                        Map.of(
                                "email",
                                "bootstrap-admin@example.test",
                                "password",
                                "AdminStrong12345"),
                        null);
        assertEquals("ADMIN", ((Map<?, ?>) login.get("user")).get("role"));
        var id = ((Map<?, ?>) login.get("user")).get("id");
        context.getBean("adminBootstrap", CommandLineRunner.class).run();
        assertEquals(
                1,
                db.queryForObject(
                        "select count(*) from app_user where email='bootstrap-admin@example.test'",
                        Integer.class));
        assertEquals(
                id,
                ((Map<?, ?>)
                                call(
                                                HttpMethod.POST,
                                                "/auth/login",
                                                Map.of(
                                                        "email",
                                                        "bootstrap-admin@example.test",
                                                        "password",
                                                        "AdminStrong12345"),
                                                null)
                                        .get("user"))
                        .get("id"));
        expect(400, () -> register("Admin público", "ADMIN"));
    }

    Map<String, Object> newService() {
        return call(
                HttpMethod.POST,
                "/services",
                Map.of(
                        "title",
                        "Serviço reportado " + UUID.randomUUID(),
                        "description",
                        "Descrição de teste",
                        "categoryId",
                        "10000000-0000-0000-0000-000000000001",
                        "price",
                        100,
                        "deliveryDays",
                        2,
                        "status",
                        "ACTIVE"),
                freelancer);
    }

    Map<String, Object> report(String type, String id) {
        return call(
                HttpMethod.POST,
                "/reports",
                Map.of(
                        "targetType",
                        type,
                        "targetId",
                        id,
                        "reason",
                        "Conteúdo ofensivo",
                        "comment",
                        "Relato detalhado que constitui a evidência textual para a moderação."),
                client);
    }

    @Test
    void reportsPersistArePrivateAndRemovalCannotBeUndoneByListingOwner() {
        var service = newService();
        String id = service.get("id").toString();
        expect(403, () -> list("/admin/reports", client));
        expect(404, () -> report("SERVICE", UUID.randomUUID().toString()));
        var r = report("SERVICE", id);
        String rid = r.get("id").toString();
        expect(409, () -> report("SERVICE", id));
        assertTrue(
                list("/admin/reports", admin).stream()
                        .anyMatch(x -> rid.equals(x.get("id")) && id.equals(x.get("targetId"))));
        expect(
                403,
                () ->
                        call(
                                HttpMethod.PATCH,
                                "/admin/reports/" + rid,
                                Map.of("status", "REMOVED", "note", "Remover conteúdo"),
                                client));
        call(
                HttpMethod.PATCH,
                "/admin/reports/" + rid,
                Map.of("status", "REMOVED", "note", "Confirmado conteúdo inadequado"),
                admin);
        expect(404, () -> call(HttpMethod.GET, "/services/" + id, null, null));
        expect(
                409,
                () ->
                        call(
                                HttpMethod.PATCH,
                                "/services/" + id + "/status",
                                Map.of("status", "ACTIVE"),
                                freelancer));
        expect(
                409,
                () ->
                        call(
                                HttpMethod.PUT,
                                "/services/" + id,
                                Map.of(
                                        "title",
                                        "Tentativa de republicação",
                                        "description",
                                        "Teste",
                                        "categoryId",
                                        "10000000-0000-0000-0000-000000000001",
                                        "price",
                                        100,
                                        "deliveryDays",
                                        2,
                                        "status",
                                        "ACTIVE"),
                                freelancer));
        expect(
                409,
                () ->
                        call(
                                HttpMethod.PATCH,
                                "/admin/reports/" + rid,
                                Map.of("status", "KEPT", "note", "Decisão repetida"),
                                admin));
        assertTrue(
                list("/admin/audit", admin).stream()
                        .anyMatch(
                                e ->
                                        rid.equals(e.get("targetId"))
                                                && "REPORT_DECIDED".equals(e.get("action"))));
        assertEquals(
                1,
                db.queryForObject(
                        "select count(*) from service_listing where id=?::uuid",
                        Integer.class,
                        id));
    }

    @Test
    void reviewRemovalPreservesHistoryButExcludesPublicReputationAndDisputeIsAudited() {
        var service = newService();
        String sid = service.get("id").toString();
        var c =
                call(
                        HttpMethod.POST,
                        "/contracts",
                        Map.of(
                                "serviceId",
                                sid,
                                "date",
                                java.time.LocalDate.now().plusDays(5).toString(),
                                "description",
                                "Teste de moderação"),
                        client);
        String cid = c.get("id").toString();
        for (String status : List.of("ACEITO", "EM_ANDAMENTO", "AGUARDANDO_CONFIRMACAO"))
            call(
                    HttpMethod.PATCH,
                    "/contracts/" + cid + "/status",
                    Map.of("status", status),
                    freelancer);
        call(
                HttpMethod.PATCH,
                "/contracts/" + cid + "/status",
                Map.of("status", "EM_DISPUTA", "comment", "Evidência textual da contestação"),
                client);
        call(
                HttpMethod.PATCH,
                "/contracts/" + cid + "/status",
                Map.of("status", "CONCLUIDO", "comment", "Decisão administrativa fundamentada"),
                admin);
        assertTrue(
                list("/admin/audit", admin).stream()
                        .anyMatch(
                                e ->
                                        cid.equals(e.get("targetId"))
                                                && "DISPUTE_DECIDED".equals(e.get("action"))));
        var review =
                call(
                        HttpMethod.POST,
                        "/contracts/" + cid + "/review",
                        Map.of("rating", 5, "comment", "Comentário reportado"),
                        client);
        var r = report("REVIEW", review.get("id").toString());
        call(
                HttpMethod.PATCH,
                "/admin/reports/" + r.get("id"),
                Map.of("status", "REMOVED", "note", "Avaliação removida após análise"),
                admin);
        assertTrue(list("/freelancers/" + freelaId + "/reviews", null).isEmpty());
        assertEquals(
                0,
                ((Number)
                                call(HttpMethod.GET, "/freelancers/" + freelaId, null, null)
                                        .get("reviewCount"))
                        .intValue());
        assertTrue(
                ((List<?>) call(HttpMethod.GET, "/services?minRating=5", null, null).get("items"))
                        .stream().noneMatch(x -> sid.equals(((Map<?, ?>) x).get("id"))));
        expect(
                409,
                () ->
                        call(
                                HttpMethod.POST,
                                "/contracts/" + cid + "/review",
                                Map.of("rating", 4, "comment", "Reenvio"),
                                client));
        assertEquals(
                5,
                ((Number) call(HttpMethod.GET, "/contracts/" + cid, null, client).get("rating"))
                        .intValue());
    }

    @Test
    void metricsRequireAdminAndValidatePeriod() {
        expect(403, () -> call(HttpMethod.GET, "/admin/metrics", null, client));
        var metrics = call(HttpMethod.GET, "/admin/metrics", null, admin);
        assertTrue(((Number) metrics.get("users")).longValue() >= 3);
        expect(
                400,
                () ->
                        call(
                                HttpMethod.GET,
                                "/admin/metrics?from=2026-11-10&to=2026-10-01",
                                null,
                                admin));
        assertEquals(
                0,
                ((Number)
                                call(
                                                HttpMethod.GET,
                                                "/admin/metrics?from=2099-01-01&to=2099-01-02",
                                                null,
                                                admin)
                                        .get("users"))
                        .intValue());
    }

    @Test
    void bootstrapRejectsExistingOrdinaryAccountAndWeakOrOversizedPassword() {
        var audit = context.getBean(br.com.freelancenow.api.admin.AuditService.class);
        var validator = context.getBean(jakarta.validation.Validator.class);
        String email = users.findById(UUID.fromString(userId)).orElseThrow().getEmail();
        var collision =
                new br.com.freelancenow.api.config.AdminBootstrap(
                        users, passwords, audit, validator, email, "Strong12345", "Admin");
        assertThrows(IllegalStateException.class, () -> collision.run());
        assertEquals(Role.CLIENT, users.findById(UUID.fromString(userId)).orElseThrow().getRole());
        for (String password : List.of("short", "a1" + "é".repeat(36))) {
            var invalid =
                    new br.com.freelancenow.api.config.AdminBootstrap(
                            users,
                            passwords,
                            audit,
                            validator,
                            "new-" + UUID.randomUUID() + "@example.test",
                            password,
                            "Admin");
            assertThrows(IllegalStateException.class, () -> invalid.run());
        }
    }

    @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
    @Autowired br.com.freelancenow.api.reviews.ReviewRepository reviewRecords;

    private void await(java.util.concurrent.CountDownLatch latch) {
        try {
            assertTrue(
                    latch.await(5, java.util.concurrent.TimeUnit.SECONDS),
                    "A transação concorrente não alcançou a barreira");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssertionError(e);
        }
    }

    @Test
    void inFlightProfileUpdateCannotUndoAdministrativeSuspension() throws Exception {
        var loaded = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        var pending =
                java.util.concurrent.CompletableFuture.runAsync(
                        () ->
                                new org.springframework.transaction.support.TransactionTemplate(
                                                transactions)
                                        .executeWithoutResult(
                                                tx -> {
                                                    var u =
                                                            users.findById(UUID.fromString(userId))
                                                                    .orElseThrow();
                                                    u.updateProfile(
                                                            "Perfil editado concorrentemente",
                                                            u.getPhone(),
                                                            "Brasília, DF",
                                                            "Bio editada");
                                                    loaded.countDown();
                                                    await(release);
                                                }));
        try {
            await(loaded);
            call(
                    HttpMethod.PATCH,
                    "/admin/users/" + userId + "/status",
                    Map.of("active", false, "reason", "Suspensão durante edição"),
                    admin);
        } finally {
            release.countDown();
        }
        pending.get(10, java.util.concurrent.TimeUnit.SECONDS);
        assertFalse(
                db.queryForObject(
                        "select active from app_user where id=?::uuid", Boolean.class, userId));
        expect(403, () -> call(HttpMethod.GET, "/users/me", null, client));
    }

    @Test
    void inFlightReplyCannotMakeModeratedReviewPublicAgain() throws Exception {
        var service = newService();
        var c =
                call(
                        HttpMethod.POST,
                        "/contracts",
                        Map.of(
                                "serviceId",
                                service.get("id"),
                                "date",
                                java.time.LocalDate.now().plusDays(5).toString(),
                                "description",
                                "Teste de resposta concorrente"),
                        client);
        String cid = c.get("id").toString();
        for (String status : List.of("ACEITO", "EM_ANDAMENTO", "AGUARDANDO_CONFIRMACAO"))
            call(
                    HttpMethod.PATCH,
                    "/contracts/" + cid + "/status",
                    Map.of("status", status),
                    freelancer);
        call(
                HttpMethod.PATCH,
                "/contracts/" + cid + "/status",
                Map.of("status", "CONCLUIDO"),
                client);
        var review =
                call(
                        HttpMethod.POST,
                        "/contracts/" + cid + "/review",
                        Map.of("rating", 5, "comment", "Avaliação reportada"),
                        client);
        String rid = review.get("id").toString();
        var report = report("REVIEW", rid);
        var loaded = new java.util.concurrent.CountDownLatch(1);
        var release = new java.util.concurrent.CountDownLatch(1);
        var pending =
                java.util.concurrent.CompletableFuture.runAsync(
                        () ->
                                new org.springframework.transaction.support.TransactionTemplate(
                                                transactions)
                                        .executeWithoutResult(
                                                tx -> {
                                                    var r =
                                                            reviewRecords
                                                                    .findById(UUID.fromString(rid))
                                                                    .orElseThrow();
                                                    r.registerReply(
                                                            "Resposta em andamento",
                                                            java.time.Instant.now());
                                                    loaded.countDown();
                                                    await(release);
                                                }));
        try {
            await(loaded);
            call(
                    HttpMethod.PATCH,
                    "/admin/reports/" + report.get("id"),
                    Map.of("status", "REMOVED", "note", "Remoção durante resposta"),
                    admin);
        } finally {
            release.countDown();
        }
        pending.get(10, java.util.concurrent.TimeUnit.SECONDS);
        assertTrue(
                db.queryForObject(
                        "select hidden from review where id=?::uuid", Boolean.class, rid));
        assertTrue(list("/freelancers/" + freelaId + "/reviews", null).isEmpty());
    }
}
