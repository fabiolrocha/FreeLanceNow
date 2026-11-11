package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import br.com.freelancenow.api.contracts.ContractService;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.web.client.*;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MessagesAndNotificationsIntegrationTests {
    private static final String CATEGORY = "10000000-0000-0000-0000-000000000001";

    @Value("${local.server.port}")
    int port;

    @Autowired ContractService contractService;
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
        if (body != null)
            req.contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(body);
        return req.retrieve().body(Map.class);
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> list(String path, String token) {
        return RestClient.create("http://localhost:" + port)
                .get()
                .uri("/api/v1" + path)
                .headers(h -> h.setBearerAuth(token))
                .retrieve()
                .body(List.class);
    }

    String register(String name, String role) {
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
                        null)
                .get("accessToken")
                .toString();
    }

    void expect(int code, Runnable work) {
        var e = assertThrows(HttpClientErrorException.class, work::run);
        assertEquals(code, e.getStatusCode().value(), e.getResponseBodyAsString());
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> inbox(String token) {
        return (List<Map<String, Object>>) call(HttpMethod.GET, "/notifications", null, token).get("items");
    }

    long unread(String token) {
        return ((Number) call(HttpMethod.GET, "/notifications/unread-count", null, token).get("unread"))
                .longValue();
    }

    String requestContract() {
        return call(
                        HttpMethod.POST,
                        "/contracts",
                        Map.of(
                                "serviceId",
                                serviceId,
                                "date",
                                LocalDate.now(ZoneId.of("America/Sao_Paulo")).plusDays(3).toString(),
                                "description",
                                "Troca de tomada da cozinha.",
                                "address",
                                "Asa Sul"),
                        client)
                .get("id")
                .toString();
    }

    @BeforeEach
    void actors() {
        client = register("Cliente Chat", "CLIENT");
        freelancer = register("Freelancer Chat", "FREELANCER");
        outsider = register("Outra Pessoa", "CLIENT");
        serviceId =
                call(
                                HttpMethod.POST,
                                "/services",
                                Map.of(
                                        "title",
                                        "Troca de tomada",
                                        "description",
                                        "Instalação e troca de tomadas.",
                                        "categoryId",
                                        CATEGORY,
                                        "price",
                                        90,
                                        "deliveryDays",
                                        1,
                                        "status",
                                        "ACTIVE"),
                                freelancer)
                        .get("id")
                        .toString();
    }

    @Test
    void contractEventsNotifyTheOtherPartyAndChatStaysBetweenParticipants() {
        var contractId = requestContract();

        var freelaInbox = inbox(freelancer);
        assertEquals(1, freelaInbox.size());
        assertEquals("CONTRACT_REQUESTED", freelaInbox.get(0).get("type"));
        assertEquals("/contratacoes/" + contractId, freelaInbox.get(0).get("link"));
        assertEquals(1, unread(freelancer));
        assertEquals(0, unread(client), "Quem age não recebe aviso da própria ação");

        call(HttpMethod.PATCH, "/contracts/" + contractId + "/status", Map.of("status", "ACEITO"), freelancer);
        var clientInbox = inbox(client);
        assertEquals(1, clientInbox.size());
        assertEquals("CONTRACT_STATUS", clientInbox.get(0).get("type"));
        assertTrue(clientInbox.get(0).get("title").toString().endsWith("aceita"));

        var sent =
                call(
                        HttpMethod.POST,
                        "/contracts/" + contractId + "/messages",
                        Map.of("text", "  Posso levar a tomada nova?  "),
                        client);
        assertEquals("Posso levar a tomada nova?", sent.get("text"));
        call(
                HttpMethod.POST,
                "/contracts/" + contractId + "/messages",
                Map.of("text", "Pode sim, levo as ferramentas."),
                freelancer);

        var thread = list("/contracts/" + contractId + "/messages", freelancer);
        assertEquals(2, thread.size());
        assertEquals("Cliente Chat", thread.get(0).get("authorName"));
        assertEquals("Freelancer Chat", thread.get(1).get("authorName"));
        assertEquals("MESSAGE_RECEIVED", inbox(freelancer).get(0).get("type"));
        assertEquals("MESSAGE_RECEIVED", inbox(client).get(0).get("type"));

        expect(403, () -> list("/contracts/" + contractId + "/messages", outsider));
        expect(
                403,
                () ->
                        call(
                                HttpMethod.POST,
                                "/contracts/" + contractId + "/messages",
                                Map.of("text", "Intrometido"),
                                outsider));
        expect(
                400,
                () ->
                        call(
                                HttpMethod.POST,
                                "/contracts/" + contractId + "/messages",
                                Map.of("text", "   "),
                                client));
        expect(
                400,
                () ->
                        call(
                                HttpMethod.POST,
                                "/contracts/" + contractId + "/messages",
                                Map.of("text", "x".repeat(1001)),
                                client));

        var first = inbox(client).get(0).get("id").toString();
        expect(404, () -> call(HttpMethod.POST, "/notifications/" + first + "/read", null, freelancer));
        var read = call(HttpMethod.POST, "/notifications/" + first + "/read", null, client);
        assertNotNull(read.get("readAt"));
        assertEquals(1, unread(client));
        call(HttpMethod.POST, "/notifications/read-all", null, client);
        assertEquals(0, unread(client));
        assertTrue(unread(freelancer) > 0, "Marcar como lido não afeta outra conta");
    }

    @Test
    void refusedContractClosesTheChat() {
        var contractId = requestContract();
        call(HttpMethod.PATCH, "/contracts/" + contractId + "/status", Map.of("status", "RECUSADO"), freelancer);
        expect(
                409,
                () ->
                        call(
                                HttpMethod.POST,
                                "/contracts/" + contractId + "/messages",
                                Map.of("text", "Ainda dá?"),
                                client));
        assertTrue(inbox(client).get(0).get("title").toString().endsWith("recusada"));
    }

    @Test
    void deadlineJobNotifiesBothSides() {
        var contractId = requestContract();
        contractService.processExpiredDeadlines(Instant.now().plus(Duration.ofHours(49)));
        assertEquals("CONTRACT_EXPIRED", inbox(client).get(0).get("type"));
        assertEquals("CONTRACT_EXPIRED", inbox(freelancer).get(0).get("type"));
        assertEquals("/contratacoes/" + contractId, inbox(client).get(0).get("link"));
        expect(401, () -> RestClient.create("http://localhost:" + port).get().uri("/api/v1/notifications").retrieve().toBodilessEntity());
    }
}
