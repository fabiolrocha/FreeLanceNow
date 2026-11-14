package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

/** Demand management, proposal withdrawal, avatars, account deletion and other self-service. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProfilesAndDemandsIntegrationTests {
    private static final String CATEGORY = "10000000-0000-0000-0000-000000000001";
    private static final String OTHER_CATEGORY = "10000000-0000-0000-0000-000000000002";

    @Value("${local.server.port}")
    int port;

    @Autowired JdbcTemplate jdbc;

    String freelancer, otherFreelancer, client;
    String clientEmail;

    RestClient http() {
        return RestClient.create("http://localhost:" + port);
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> call(HttpMethod method, String path, Object body, String token) {
        var req =
                http().method(method)
                        .uri("/api/v1" + path)
                        .headers(
                                h -> {
                                    if (token != null) h.setBearerAuth(token);
                                });
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).body(body);
        return req.retrieve().body(Map.class);
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> list(String path, String token) {
        return http().get()
                .uri("/api/v1" + path)
                .headers(
                        h -> {
                            if (token != null) h.setBearerAuth(token);
                        })
                .retrieve()
                .body(List.class);
    }

    int status(HttpMethod method, String path, Object body, String token) {
        var req =
                http().method(method)
                        .uri("/api/v1" + path)
                        .headers(
                                h -> {
                                    if (token != null) h.setBearerAuth(token);
                                });
        if (body != null) req.contentType(MediaType.APPLICATION_JSON).body(body);
        return req.retrieve().toBodilessEntity().getStatusCode().value();
    }

    void expect(int code, Runnable work) {
        var e = assertThrows(RestClientResponseException.class, work::run);
        assertEquals(code, e.getStatusCode().value(), e.getResponseBodyAsString());
    }

    Map<String, Object> registration(String role, String email) {
        return Map.of(
                "name", "Pessoa " + role,
                "email", email,
                "password", "Strong12345",
                "phone", "61999990000",
                "role", role,
                "acceptedTerms", true);
    }

    String register(String role) {
        return register(role, UUID.randomUUID() + "@example.test");
    }

    String register(String role, String email) {
        return call(HttpMethod.POST, "/auth/register", registration(role, email), null)
                .get("accessToken")
                .toString();
    }

    String login(String email) {
        return call(
                        HttpMethod.POST,
                        "/auth/login",
                        Map.of("email", email, "password", "Strong12345"),
                        null)
                .get("accessToken")
                .toString();
    }

    String id(String token) {
        return call(HttpMethod.GET, "/users/me", null, token).get("id").toString();
    }

    Map<String, Object> demandBody(String title) {
        return Map.of(
                "title", title,
                "description", "Troca de seis tomadas e revisão do quadro.",
                "categoryId", CATEGORY,
                "budget", 300,
                "days", 2,
                "city", "Taguatinga, DF");
    }

    String demand(String title) {
        return call(HttpMethod.POST, "/demands", demandBody(title), client).get("id").toString();
    }

    String propose(String demandId, String token) {
        return call(
                        HttpMethod.POST,
                        "/demands/" + demandId + "/proposals",
                        Map.of("price", 280, "days", 2, "message", "Faço com garantia de 90 dias."),
                        token)
                .get("id")
                .toString();
    }

    String service(String token, String status) {
        return call(
                        HttpMethod.POST,
                        "/services",
                        Map.of(
                                "title", "Instalação elétrica",
                                "description", "Instalação com teste de funcionamento.",
                                "categoryId", CATEGORY,
                                "price", 180,
                                "deliveryDays", 1,
                                "status", status),
                        token)
                .get("id")
                .toString();
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> uploadAvatar(String token, byte[] data, String name) {
        var parts = new LinkedMultiValueMap<String, Object>();
        parts.add(
                "file",
                new ByteArrayResource(data) {
                    @Override
                    public String getFilename() {
                        return name;
                    }
                });
        return http().put()
                .uri("/api/v1/users/me/avatar")
                .headers(h -> h.setBearerAuth(token))
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(parts)
                .retrieve()
                .body(Map.class);
    }

    @BeforeEach
    void actors() {
        freelancer = register("FREELANCER");
        otherFreelancer = register("FREELANCER");
        clientEmail = UUID.randomUUID() + "@example.test";
        client = register("CLIENT", clientEmail);
    }

    @Test
    void clientEditsDemandOnlyBeforeProposalsAndCancelRejectsPendingOnes() {
        var demandId = demand("Revisão elétrica");
        var edited = new HashMap<>(demandBody("Revisão elétrica completa"));
        edited.put("categoryId", OTHER_CATEGORY);
        edited.put("budget", 350);
        var updated = call(HttpMethod.PUT, "/demands/" + demandId, edited, client);
        assertEquals("Revisão elétrica completa", updated.get("title"));
        assertEquals(OTHER_CATEGORY, updated.get("categoryId"));
        assertNotNull(updated.get("categoryName"));

        // Another client or a freelancer cannot edit or cancel it.
        var otherClient = register("CLIENT");
        expect(403, () -> call(HttpMethod.PUT, "/demands/" + demandId, edited, otherClient));
        expect(403, () -> call(HttpMethod.POST, "/demands/" + demandId + "/cancel", null, freelancer));

        // Once a proposal arrives the text is locked, but the client can still cancel.
        var proposalId = propose(demandId, freelancer);
        expect(409, () -> call(HttpMethod.PUT, "/demands/" + demandId, edited, client));
        var cancelled = call(HttpMethod.POST, "/demands/" + demandId + "/cancel", null, client);
        assertEquals("CANCELLED", cancelled.get("status"));
        var mine = list("/proposals", freelancer);
        var proposal =
                mine.stream().filter(p -> proposalId.equals(p.get("id"))).findFirst().orElseThrow();
        assertEquals("REJECTED", proposal.get("status"));
        assertEquals("CANCELLED", proposal.get("demandStatus"));

        // A cancelled demand takes no proposals and cannot be cancelled twice.
        expect(409, () -> propose(demandId, otherFreelancer));
        expect(409, () -> call(HttpMethod.POST, "/demands/" + demandId + "/cancel", null, client));
        var freelancerId = id(freelancer);
        assertEquals(
                1,
                jdbc.queryForObject(
                        "select count(*) from notification where user_id = ?::uuid and link = '/propostas'",
                        Integer.class,
                        freelancerId));
    }

    @Test
    void freelancerWithdrawsPendingProposalAndCanSendAnother() {
        var demandId = demand("Pintura da sala");
        var proposalId = propose(demandId, freelancer);
        expect(403, () -> call(HttpMethod.POST, "/proposals/" + proposalId + "/withdraw", null, otherFreelancer));
        var withdrawn = call(HttpMethod.POST, "/proposals/" + proposalId + "/withdraw", null, freelancer);
        assertEquals("WITHDRAWN", withdrawn.get("status"));
        expect(409, () -> call(HttpMethod.POST, "/proposals/" + proposalId + "/withdraw", null, freelancer));
        expect(409, () -> call(HttpMethod.POST, "/proposals/" + proposalId + "/accept", null, client));
        // The withdrawal frees the slot for a new proposal.
        assertNotNull(propose(demandId, freelancer));
    }

    @Test
    void acceptingWithDateAndAddressSchedulesContractAndShowsProposalDetails() {
        var demandId = demand("Instalação de chuveiro");
        var proposalId = propose(demandId, freelancer);
        var today = LocalDate.now(ZoneId.of("America/Sao_Paulo"));
        expect(
                400,
                () ->
                        call(
                                HttpMethod.POST,
                                "/proposals/" + proposalId + "/accept",
                                Map.of("date", today.toString()),
                                client));
        var proposals = list("/demands/" + demandId + "/proposals", client);
        assertEquals(id(freelancer), proposals.getFirst().get("freelancerId"));
        assertTrue(proposals.getFirst().containsKey("freelancerAverageRating"));

        var date = today.plusDays(4).toString();
        var accepted =
                call(
                        HttpMethod.POST,
                        "/proposals/" + proposalId + "/accept",
                        Map.of("date", date, "address", "QNA 12 casa 3"),
                        client);
        @SuppressWarnings("unchecked")
        var contract = (Map<String, Object>) accepted.get("contract");
        assertEquals(date, contract.get("date"));
        assertEquals("QNA 12 casa 3", contract.get("address"));
        var after = list("/proposals", freelancer).getFirst();
        assertEquals("ACCEPTED", after.get("status"));
        assertEquals(contract.get("id"), after.get("contractId"));
    }

    @Test
    void avatarIsValidatedServedPubliclyAndRemoved() {
        var png = ServiceImagesIntegrationTests.image("png", 32, 32);
        expect(415, () -> uploadAvatar(freelancer, "not an image".getBytes(), "a.png"));
        var me = uploadAvatar(freelancer, png, "me.png");
        assertNotNull(me.get("avatarVersion"));
        var userId = me.get("id").toString();
        var response =
                http().get()
                        .uri("/api/v1/users/" + userId + "/avatar")
                        .retrieve()
                        .toEntity(byte[].class);
        assertEquals(MediaType.IMAGE_PNG, response.getHeaders().getContentType());
        assertEquals("nosniff", response.getHeaders().getFirst("X-Content-Type-Options"));
        assertArrayEquals(png, response.getBody());
        var profile = call(HttpMethod.GET, "/freelancers/" + userId, null, null);
        assertEquals(me.get("avatarVersion"), profile.get("avatarVersion"));

        var removed = call(HttpMethod.DELETE, "/users/me/avatar", null, freelancer);
        assertNull(removed.get("avatarVersion"));
        expect(404, () -> http().get().uri("/api/v1/users/" + userId + "/avatar").retrieve().toEntity(byte[].class));
    }

    @Test
    void publicProfileListsSpecialtiesAndServiceArea() {
        call(
                HttpMethod.PUT,
                "/users/me",
                Map.of(
                        "name", "Pessoa Freelancer",
                        "phone", "61999990000",
                        "city", "Taguatinga, DF",
                        "bio", "Eletricista.",
                        "serviceArea", "Taguatinga, Ceilândia e Águas Claras"),
                freelancer);
        service(freelancer, "ACTIVE");
        service(freelancer, "DRAFT");
        var profile = call(HttpMethod.GET, "/freelancers/" + id(freelancer), null, null);
        assertEquals("Taguatinga, Ceilândia e Águas Claras", profile.get("serviceArea"));
        assertEquals(1, ((List<?>) profile.get("specialties")).size());
        assertNotNull(profile.get("memberSince"));
        assertFalse(profile.containsKey("email"));
    }

    @Test
    void freelancerDeletesOnlyNeverHiredDraftsOrInactiveServices() {
        var draft = service(freelancer, "DRAFT");
        var active = service(freelancer, "ACTIVE");
        expect(403, () -> call(HttpMethod.DELETE, "/services/" + draft, null, otherFreelancer));
        expect(409, () -> call(HttpMethod.DELETE, "/services/" + active, null, freelancer));
        assertEquals(204, status(HttpMethod.DELETE, "/services/" + draft, null, freelancer));
        expect(404, () -> call(HttpMethod.GET, "/services/" + draft, null, freelancer));

        // A listing that was hired stays in the history even after it is paused.
        call(
                HttpMethod.POST,
                "/contracts",
                Map.of(
                        "serviceId", active,
                        "date", LocalDate.now(ZoneId.of("America/Sao_Paulo")).plusDays(5).toString(),
                        "description", "Trocar o disjuntor do chuveiro.",
                        "address", ""),
                client);
        call(HttpMethod.PATCH, "/services/" + active + "/status", Map.of("status", "INACTIVE"), freelancer);
        expect(409, () -> call(HttpMethod.DELETE, "/services/" + active, null, freelancer));
    }

    @Test
    void reporterSeesOwnReportsAndDecisionWithoutAdminName() {
        var serviceId = service(freelancer, "ACTIVE");
        call(
                HttpMethod.POST,
                "/reports",
                Map.of(
                        "targetType", "SERVICE",
                        "targetId", serviceId,
                        "reason", "Conteúdo enganoso",
                        "comment", "O anúncio promete garantia que o profissional não oferece."),
                client);
        var mine = list("/reports/mine", client);
        assertEquals(1, mine.size());
        assertEquals("PENDING", mine.getFirst().get("status"));
        assertFalse(mine.getFirst().containsKey("decidedByName"));
        assertFalse(mine.getFirst().containsKey("reporterName"));
        assertTrue(list("/reports/mine", freelancer).isEmpty());
    }

    @Test
    void accountDeletionIsBlockedByOpenContractsThenAnonymizesAndFreesEmail() {
        var serviceId = service(freelancer, "ACTIVE");
        var contractId =
                call(
                                HttpMethod.POST,
                                "/contracts",
                                Map.of(
                                        "serviceId", serviceId,
                                        "date",
                                                LocalDate.now(ZoneId.of("America/Sao_Paulo"))
                                                        .plusDays(5)
                                                        .toString(),
                                        "description", "Trocar o disjuntor do chuveiro.",
                                        "address", ""),
                                client)
                        .get("id")
                        .toString();
        var openDemand = demand("Demanda que será cancelada");
        expect(400, () -> call(HttpMethod.DELETE, "/users/me", Map.of("password", "Errada12345"), client));
        expect(409, () -> call(HttpMethod.DELETE, "/users/me", Map.of("password", "Strong12345"), client));

        call(HttpMethod.PATCH, "/contracts/" + contractId + "/status", Map.of("status", "RECUSADO"), freelancer);
        var clientId = id(client);
        assertEquals(204, status(HttpMethod.DELETE, "/users/me", Map.of("password", "Strong12345"), client));

        // The old session and the old password stop working; open demands are cancelled.
        expect(401, () -> call(HttpMethod.GET, "/users/me", null, client));
        expect(401, () -> login(clientEmail));
        assertEquals(
                "CANCELLED",
                jdbc.queryForObject(
                        "select status from demand where id = ?::uuid", String.class, openDemand));
        var row =
                jdbc.queryForMap(
                        "select name, email, active, deleted_at from app_user where id = ?::uuid",
                        clientId);
        assertEquals("Conta excluída", row.get("name"));
        assertFalse((Boolean) row.get("active"));
        assertNotNull(row.get("deleted_at"));
        assertFalse(row.get("email").toString().contains(clientEmail));
        assertEquals(
                1,
                jdbc.queryForObject(
                        "select count(*) from audit_event where target_id = ?::uuid and action = 'ACCOUNT_DELETED'",
                        Integer.class,
                        clientId));

        // The e-mail can be used again by a new account.
        assertNotNull(register("CLIENT", clientEmail));
    }
}
