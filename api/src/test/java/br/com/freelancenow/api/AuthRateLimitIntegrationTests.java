package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.util.Map;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "app.rate-limit.auth-per-minute=3")
class AuthRateLimitIntegrationTests {
    @Value("${local.server.port}")
    int port;

    private int login(String origin) {
        return RestClient.create("http://localhost:" + port)
                .post()
                .uri("/api/v1/auth/login")
                .header("Origin", origin)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", "ninguem@example.test", "password", "Errada12345"))
                .exchange((req, res) -> {
                    if (res.getStatusCode().value() == 429) {
                        assertEquals("60", res.getHeaders().getFirst("Retry-After"));
                        assertEquals(origin, res.getHeaders().getAccessControlAllowOrigin());
                        assertTrue(
                                new String(res.getBody().readAllBytes())
                                        .contains("Muitas tentativas"));
                    }
                    return res.getStatusCode().value();
                });
    }

    @Test
    void configuredOriginsGetCorsHeadersAndOthersAreRefused() {
        var http = RestClient.create("http://localhost:" + port);
        var allowed =
                http.options()
                        .uri("/api/v1/categories")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET")
                        .exchange((req, res) -> res.getHeaders().getAccessControlAllowOrigin());
        assertEquals("http://localhost:5173", allowed);
        var refused =
                http.get()
                        .uri("/api/v1/categories")
                        .header("Origin", "https://outro-site.example")
                        .exchange((req, res) -> res.getStatusCode().value());
        assertEquals(403, refused);
    }

    @Test
    void authPostsAreLimitedPerAddressAndOtherRoutesAreNot() {
        var origin = "http://localhost:5173";
        for (int i = 0; i < 3; i++) assertEquals(401, login(origin));
        assertEquals(429, login(origin));
        // Public reads are not counted.
        var categories =
                RestClient.create("http://localhost:" + port)
                        .get()
                        .uri("/api/v1/categories")
                        .exchange((req, res) -> res.getStatusCode());
        assertEquals(HttpStatusCode.valueOf(200), categories);
    }
}
