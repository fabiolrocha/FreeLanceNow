package br.com.freelancenow.api;

import static org.junit.jupiter.api.Assertions.*;

import br.com.freelancenow.api.mail.MailSender;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AuthFlowIntegrationTests {
    @TestConfiguration
    static class CapturingMail {
        static final BlockingQueue<MailSender.Mail> SENT = new LinkedBlockingQueue<>();

        @Bean
        @Primary
        MailSender capturingMailSender() {
            return SENT::add;
        }
    }

    @Value("${local.server.port}")
    int port;

    private final String prefix = UUID.randomUUID().toString().substring(0, 8);

    private RestClient http() {
        return RestClient.create("http://localhost:" + port);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> send(String method, String path, Object body, String token) {
        var spec =
                http().method(org.springframework.http.HttpMethod.valueOf(method))
                        .uri(path)
                        .headers(
                                h -> {
                                    if (token != null) h.setBearerAuth(token);
                                });
        if (body != null) spec = spec.contentType(MediaType.APPLICATION_JSON).body(body);
        return spec.retrieve().body(Map.class);
    }

    private int status(Runnable request) {
        var e = assertThrows(HttpClientErrorException.class, request::run);
        return e.getStatusCode().value();
    }

    private Map<String, Object> register(String name, String password) {
        return send(
                "POST",
                "/api/v1/auth/register",
                Map.of(
                        "name", name,
                        "email", prefix + name + "@example.test",
                        "password", password,
                        "phone", "61999990000",
                        "role", "CLIENT",
                        "acceptedTerms", true),
                null);
    }

    private Map<String, Object> login(String name, String password) {
        return send(
                "POST",
                "/api/v1/auth/login",
                Map.of("email", prefix + name + "@example.test", "password", password),
                null);
    }

    private String resetTokenFor(String email) throws InterruptedException {
        MailSender.Mail sent;
        do {
            sent = CapturingMail.SENT.poll(5, TimeUnit.SECONDS);
            assertNotNull(sent, "reset e-mail was not sent to " + email);
        } while (!sent.to().equals(email) || !sent.text().contains("redefinir-senha"));
        var m = Pattern.compile("redefinir-senha\\?token=([^\\s\"]+)").matcher(sent.text());
        assertTrue(m.find());
        return URLDecoder.decode(m.group(1), StandardCharsets.UTF_8);
    }

    @Test
    void sessionIncludesRefreshTokenThatRotatesButCannotAuthenticateRequests() {
        var session = register("refresh", "Strong12345");
        var refreshToken = session.get("refreshToken").toString();
        assertTrue(((Number) session.get("refreshExpiresIn")).longValue() > 900);

        var renewed = send("POST", "/api/v1/auth/refresh", Map.of("refreshToken", refreshToken), null);
        assertNotEquals(session.get("accessToken"), renewed.get("accessToken"));
        assertNotEquals(refreshToken, renewed.get("refreshToken"));
        assertEquals(
                prefix + "refresh@example.test",
                send("GET", "/api/v1/users/me", null, renewed.get("accessToken").toString())
                        .get("email"));

        // A refresh token is not a bearer credential, and an access token cannot refresh.
        assertEquals(401, status(() -> send("GET", "/api/v1/users/me", null, refreshToken)));
        assertEquals(
                401,
                status(
                        () ->
                                send(
                                        "POST",
                                        "/api/v1/auth/refresh",
                                        Map.of("refreshToken", session.get("accessToken")),
                                        null)));
        assertEquals(
                401,
                status(
                        () ->
                                send(
                                        "POST",
                                        "/api/v1/auth/refresh",
                                        Map.of("refreshToken", "not-a-token"),
                                        null)));
    }

    @Test
    void changePasswordRequiresCurrentPasswordAndRevokesOlderRefreshTokens() {
        var session = register("change", "Strong12345");
        var access = session.get("accessToken").toString();
        var oldRefresh = session.get("refreshToken").toString();

        assertEquals(
                400,
                status(
                        () ->
                                send(
                                        "PUT",
                                        "/api/v1/users/me/password",
                                        Map.of(
                                                "currentPassword", "Wrong12345",
                                                "newPassword", "Newer12345"),
                                        access)));
        assertEquals(
                400,
                status(
                        () ->
                                send(
                                        "PUT",
                                        "/api/v1/users/me/password",
                                        Map.of(
                                                "currentPassword", "Strong12345",
                                                "newPassword", "short"),
                                        access)));
        assertEquals(
                401,
                status(
                        () ->
                                send(
                                        "PUT",
                                        "/api/v1/users/me/password",
                                        Map.of(
                                                "currentPassword", "Strong12345",
                                                "newPassword", "Newer12345"),
                                        null)));

        var renewed =
                send(
                        "PUT",
                        "/api/v1/users/me/password",
                        Map.of("currentPassword", "Strong12345", "newPassword", "Newer12345"),
                        access);
        assertNotNull(renewed.get("refreshToken"));
        assertEquals(
                401,
                status(
                        () ->
                                send(
                                        "POST",
                                        "/api/v1/auth/refresh",
                                        Map.of("refreshToken", oldRefresh),
                                        null)));
        send("POST", "/api/v1/auth/refresh", Map.of("refreshToken", renewed.get("refreshToken")), null);
        assertEquals(401, status(() -> login("change", "Strong12345")));
        assertNotNull(login("change", "Newer12345").get("accessToken"));
    }

    @Test
    void forgotPasswordSendsSingleUseLinkWithoutRevealingAccounts() throws InterruptedException {
        register("forgot", "Strong12345");
        var email = prefix + "forgot@example.test";

        // Unknown addresses get the same 202 and no e-mail.
        send("POST", "/api/v1/auth/password/forgot", Map.of("email", prefix + "nobody@example.test"), null);
        send("POST", "/api/v1/auth/password/forgot", Map.of("email", email.toUpperCase()), null);
        var token = resetTokenFor(email);

        // A reset token cannot be used as a bearer credential or refresh token.
        assertEquals(401, status(() -> send("GET", "/api/v1/users/me", null, token)));
        assertEquals(
                401,
                status(
                        () ->
                                send(
                                        "POST",
                                        "/api/v1/auth/refresh",
                                        Map.of("refreshToken", token),
                                        null)));
        assertEquals(
                400,
                status(
                        () ->
                                send(
                                        "POST",
                                        "/api/v1/auth/password/reset",
                                        Map.of("token", token, "password", "nodigits"),
                                        null)));

        http().post()
                .uri("/api/v1/auth/password/reset")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("token", token, "password", "Reset12345"))
                .retrieve()
                .toBodilessEntity();
        assertNotNull(login("forgot", "Reset12345").get("accessToken"));
        assertEquals(401, status(() -> login("forgot", "Strong12345")));

        // The same link cannot be used twice.
        assertEquals(
                400,
                status(
                        () ->
                                send(
                                        "POST",
                                        "/api/v1/auth/password/reset",
                                        Map.of("token", token, "password", "Again12345"),
                                        null)));
        assertEquals(
                400,
                status(
                        () ->
                                send(
                                        "POST",
                                        "/api/v1/auth/password/reset",
                                        Map.of("token", "bogus", "password", "Again12345"),
                                        null)));
    }

    @Test
    void forgotPasswordIsThrottledPerAddress() throws InterruptedException {
        register("throttle", "Strong12345");
        var email = prefix + "throttle@example.test";
        send("POST", "/api/v1/auth/password/forgot", Map.of("email", email), null);
        resetTokenFor(email);
        send("POST", "/api/v1/auth/password/forgot", Map.of("email", email), null);
        var second = CapturingMail.SENT.poll(1, TimeUnit.SECONDS);
        assertTrue(
                second == null
                        || !second.to().equals(email)
                        || !second.text().contains("redefinir-senha"));
    }

    private String verifyTokenFor(String email) throws InterruptedException {
        MailSender.Mail sent;
        do {
            sent = CapturingMail.SENT.poll(5, TimeUnit.SECONDS);
            assertNotNull(sent, "confirmation e-mail was not sent to " + email);
        } while (!sent.to().equals(email) || !sent.text().contains("verificar-email"));
        var m = Pattern.compile("verificar-email\\?token=([^\\s\"]+)").matcher(sent.text());
        assertTrue(m.find());
        return URLDecoder.decode(m.group(1), StandardCharsets.UTF_8);
    }

    @Test
    void registrationSendsConfirmationLinkThatVerifiesTheAddress() throws InterruptedException {
        var session = register("verify", "Strong12345");
        var access = session.get("accessToken").toString();
        var email = prefix + "verify@example.test";
        assertEquals(false, ((Map<?, ?>) session.get("user")).get("emailVerified"));
        var token = verifyTokenFor(email);

        // A reset or access token cannot confirm an address.
        assertEquals(
                400,
                status(
                        () ->
                                send(
                                        "POST",
                                        "/api/v1/auth/email/verify",
                                        Map.of("token", access),
                                        null)));

        send("POST", "/api/v1/auth/email/verify", Map.of("token", token), null);
        assertEquals(true, send("GET", "/api/v1/users/me", null, access).get("emailVerified"));
        // Using the link again is harmless, and asking for a new one does nothing now.
        send("POST", "/api/v1/auth/email/verify", Map.of("token", token), null);
        send("POST", "/api/v1/users/me/email-verification", null, access);
        var again = CapturingMail.SENT.poll(1, TimeUnit.SECONDS);
        assertTrue(again == null || !again.to().equals(email));
    }

    @Test
    void confirmationLinkCanBeResentOnlyOncePerMinute() throws InterruptedException {
        var session = register("resend", "Strong12345");
        var access = session.get("accessToken").toString();
        var email = prefix + "resend@example.test";
        verifyTokenFor(email);
        send("POST", "/api/v1/users/me/email-verification", null, access);
        verifyTokenFor(email);
        assertEquals(
                429,
                status(() -> send("POST", "/api/v1/users/me/email-verification", null, access)));
        assertEquals(
                401, status(() -> send("POST", "/api/v1/users/me/email-verification", null, null)));
    }
}
