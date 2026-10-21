package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import br.com.freelancenow.api.users.*;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
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
class FeedIntegrationTests {
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

    Map<String, Object> post(String text, String token) {
        return call(HttpMethod.POST, "/feed/posts", Map.of("text", text), token);
    }

    List<Map<String, Object>> items(String query, String token) {
        return (List<Map<String, Object>>)
                call(HttpMethod.GET, "/feed" + query, null, token).get("items");
    }

    Map<String, Object> service(String category) {
        return call(
                HttpMethod.POST,
                "/services",
                Map.of(
                        "title",
                        "Trabalho no feed",
                        "description",
                        "Serviço de instalação",
                        "categoryId",
                        category,
                        "price",
                        150,
                        "deliveryDays",
                        3,
                        "status",
                        "ACTIVE"),
                freelancer);
    }

    @Test
    void publishesPersistentSafeTextAcrossAccountsAndEnforcesOwnership() {
        expect(401, () -> items("", null));
        var p = post("  Instalação concluída com cuidado.  ", freelancer);
        var id = p.get("id");
        var visible =
                items("?type=UPDATE", client).stream()
                        .filter(x -> id.equals(x.get("id")))
                        .findFirst()
                        .orElseThrow();
        assertEquals("Instalação concluída com cuidado.", visible.get("text"));
        assertEquals("FREELANCER", ((Map<?, ?>) visible.get("author")).get("role"));
        assertFalse(visible.toString().contains("@example.test"));
        assertFalse(visible.toString().contains("61999990000"));
        expect(403, () -> call(HttpMethod.PATCH, "/feed/posts/" + id + "/hide", null, client));
        call(HttpMethod.PATCH, "/feed/posts/" + id + "/hide", null, freelancer);
        assertFalse(items("?type=UPDATE", client).stream().anyMatch(x -> id.equals(x.get("id"))));
        expect(400, () -> post("   ", client));
        expect(400, () -> post("x".repeat(501), client));
        assertNotNull(post("x".repeat(500), client).get("id"));
    }

    @Test
    void paginationFiltersAndTiesAreStableAcrossMixedSources() {
        String cat = list("/categories", null).getFirst().get("id").toString();
        var listing = service(cat);
        var p =
                call(
                        HttpMethod.POST,
                        "/feed/posts",
                        Map.of("text", "Confira meu serviço", "serviceId", listing.get("id")),
                        freelancer);
        assertEquals(cat, ((Map<?, ?>) p.get("category")).get("id").toString());
        String at = "2040-01-01T00:00:00Z";
        db.update(
                "UPDATE service_listing SET created_at=?::timestamptz WHERE id=?::uuid",
                at,
                listing.get("id"));
        db.update(
                "UPDATE feed_post SET created_at=?::timestamptz WHERE id=?::uuid", at, p.get("id"));
        var page0 = items("?size=1&categoryId=" + cat, client);
        var page1 = items("?size=1&page=1&categoryId=" + cat, client);
        assertNotEquals(page0.getFirst().get("id"), page1.getFirst().get("id"));
        assertEquals(page0, items("?size=1&categoryId=" + cat, client));
        assertTrue(
                items("?type=SERVICE&categoryId=" + cat, client).stream()
                        .anyMatch(x -> listing.get("id").equals(x.get("id"))));
        assertFalse(
                items("?type=UPDATE", client).stream()
                        .anyMatch(x -> listing.get("id").equals(x.get("id"))));
        expect(400, () -> items("?page=-1", client));
        expect(400, () -> items("?size=101", client));
        expect(400, () -> items("?type=WRONG", client));
    }

    @Test
    void linkedServicesMustBeOwnedAndVisibleAndSuspensionHidesAllAuthorsContent() {
        String cat = list("/categories", null).getFirst().get("id").toString();
        var s = service(cat);
        expect(
                403,
                () ->
                        call(
                                HttpMethod.POST,
                                "/feed/posts",
                                Map.of("text", "Não é meu", "serviceId", s.get("id")),
                                client));
        var p =
                call(
                        HttpMethod.POST,
                        "/feed/posts",
                        Map.of("text", "Meu trabalho", "serviceId", s.get("id")),
                        freelancer);
        call(
                HttpMethod.PATCH,
                "/services/" + s.get("id") + "/status",
                Map.of("status", "INACTIVE"),
                freelancer);
        assertFalse(
                items("?type=UPDATE", client).stream()
                        .anyMatch(x -> p.get("id").equals(x.get("id"))));
        expect(
                400,
                () ->
                        call(
                                HttpMethod.POST,
                                "/feed/posts",
                                Map.of("text", "Inativo", "serviceId", s.get("id")),
                                freelancer));
        var plain = post("Trabalho independente", freelancer);
        call(
                HttpMethod.PATCH,
                "/admin/users/" + freelaId + "/status",
                Map.of("active", false, "reason", "Teste feed"),
                admin);
        assertFalse(
                items("?type=UPDATE", client).stream()
                        .anyMatch(x -> plain.get("id").equals(x.get("id"))));
        expect(403, () -> post("Suspenso", freelancer));
        expect(403, () -> items("", freelancer));
    }

    @Test
    void demandCardsPreserveClientPermissionsAndOnlyShowOpenActiveOpportunities() {
        String cat = list("/categories", null).getFirst().get("id").toString();
        var d =
                call(
                        HttpMethod.POST,
                        "/demands",
                        Map.of(
                                "title",
                                "Preciso de instalação",
                                "description",
                                "Instalação de tomadas",
                                "categoryId",
                                cat,
                                "budget",
                                250,
                                "days",
                                3,
                                "city",
                                "Brasília"),
                        client);
        var other = register("Outro cliente", "CLIENT").get("accessToken").toString();
        assertTrue(
                items("?type=DEMAND", freelancer).stream()
                        .anyMatch(x -> d.get("id").equals(x.get("id"))));
        assertFalse(
                items("?type=DEMAND", other).stream()
                        .anyMatch(x -> d.get("id").equals(x.get("id"))));
        assertTrue(
                items("?type=DEMAND", client).stream()
                        .anyMatch(x -> d.get("id").equals(x.get("id"))));
        var prop =
                call(
                        HttpMethod.POST,
                        "/demands/" + d.get("id") + "/proposals",
                        Map.of("price", 200, "days", 2, "message", "Posso fazer"),
                        freelancer);
        call(HttpMethod.POST, "/proposals/" + prop.get("id") + "/accept", null, client);
        assertFalse(
                items("?type=DEMAND", freelancer).stream()
                        .anyMatch(x -> d.get("id").equals(x.get("id"))));
    }

    @Test
    void reportsSnapshotPostAndRemovalIsAuditedAndCannotBeUndoneByAuthor() {
        var p = post("Relato do meu trabalho de instalação.", freelancer);
        var r =
                call(
                        HttpMethod.POST,
                        "/reports",
                        Map.of(
                                "targetType",
                                "POST",
                                "targetId",
                                p.get("id"),
                                "reason",
                                "Outro motivo",
                                "comment",
                                "Esta publicação precisa de análise da moderação de conteúdo."),
                        client);
        assertEquals(p.get("text"), r.get("targetContent"));
        call(
                HttpMethod.PATCH,
                "/admin/reports/" + r.get("id"),
                Map.of("status", "REMOVED", "note", "Remoção fundamentada de teste"),
                admin);
        assertFalse(
                items("?type=UPDATE", client).stream()
                        .anyMatch(x -> p.get("id").equals(x.get("id"))));
        assertTrue(
                list("/admin/audit", admin).stream()
                        .anyMatch(x -> r.get("id").equals(x.get("targetId"))));
        expect(
                404,
                () ->
                        call(
                                HttpMethod.POST,
                                "/reports",
                                Map.of(
                                        "targetType",
                                        "POST",
                                        "targetId",
                                        p.get("id"),
                                        "reason",
                                        "Outro",
                                        "comment",
                                        "Esta publicação precisa de análise da moderação"
                                            + " novamente."),
                                client));
    }
}
