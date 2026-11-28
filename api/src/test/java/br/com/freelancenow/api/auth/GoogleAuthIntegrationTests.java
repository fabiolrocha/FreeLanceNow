package br.com.freelancenow.api.auth;

import static org.junit.jupiter.api.Assertions.*;

import br.com.freelancenow.api.users.UserRepository;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GoogleAuthIntegrationTests {
    private static final String CLIENT_ID = "fln-tests.apps.googleusercontent.com";
    private static final String VERIFIER = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
    private static final String NONCE = "Yw3NKWbEM2aRElRIu7JbT_QSpJxzLbLIq8G4WBvXEN0";
    private static final String PASSWORD = "LocalPassword123";

    @TestConfiguration
    static class GoogleSigningKey {
        static final com.nimbusds.jose.jwk.RSAKey KEY = key();

        private static com.nimbusds.jose.jwk.RSAKey key() {
            try {
                return new RSAKeyGenerator(2048).generate();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        @Bean
        @Primary
        GoogleIdTokens testGoogleIdTokens(Clock clock) throws Exception {
            return new GoogleIdTokens(
                    CLIENT_ID, clock, NimbusJwtDecoder.withPublicKey(KEY.toRSAPublicKey()).build());
        }
    }

    @Value("${local.server.port}")
    int port;

    @Autowired UserRepository users;
    @Autowired TokenService tokens;

    @Test
    void newUserMustFinishRegistrationAndCanSignInWithTheSameGoogleSubject() throws Exception {
        var email = "google-" + UUID.randomUUID() + "@gmail.com";
        var subject = UUID.randomUUID().toString();
        var proof = proof(subject, email, CLIENT_ID, true, NONCE);
        assertEquals("REGISTER", post("/google", proof).get("next"));
        assertFalse(users.existsByEmail(email));

        var form = new HashMap<String, Object>(proof);
        form.putAll(
                Map.of(
                        "name",
                        "Pessoa Google",
                        "phone",
                        "61999990000",
                        "role",
                        "ADMIN",
                        "acceptedTerms",
                        true));
        assertStatus(400, "/google/register", form);
        form.put("role", "FREELANCER");
        form.put("acceptedTerms", false);
        assertStatus(400, "/google/register", form);
        form.put("acceptedTerms", true);
        var session = post("/google/register", form);
        assertEquals(email, me(session).get("email"));
        assertEquals("FREELANCER", me(session).get("role"));
        assertEquals(true, me(session).get("emailVerified"));
        assertStatus(409, "/google/register", form);

        var returned = post("/google", proof(subject, "outro@gmail.com", CLIENT_ID, true, NONCE));
        assertEquals("SIGNED_IN", returned.get("next"));
        assertEquals(me(session).get("id"), me((Map<?, ?>) returned.get("session")).get("id"));
        var refresh = post("/refresh", Map.of("refreshToken", session.get("refreshToken")));
        assertEquals(email, me(refresh).get("email"));

        var saved = users.findByEmail(email).orElseThrow();
        saved.setActive(false);
        users.saveAndFlush(saved);
        assertStatus(401, "/google", proof);
    }

    @Test
    void accountWithSameEmailRequiresItsPasswordAndRetainsTheSameUser() throws Exception {
        var email = "local-" + UUID.randomUUID() + "@example.com";
        var local =
                post(
                        "/register",
                        Map.of(
                                "name",
                                "Pessoa Local",
                                "email",
                                email,
                                "phone",
                                "61999990000",
                                "role",
                                "CLIENT",
                                "password",
                                PASSWORD,
                                "acceptedTerms",
                                true));
        var subject = UUID.randomUUID().toString();
        var proof = proof(subject, email, CLIENT_ID, true, NONCE);
        var pending = post("/google", proof);
        assertEquals("LINK", pending.get("next"));
        assertNull(pending.get("session"));

        var link = new HashMap<String, Object>(proof);
        link.put("password", "WrongPassword123");
        assertStatus(401, "/google/link", link);
        link.put("password", PASSWORD);
        var linked = post("/google/link", link);
        assertEquals(me(local).get("id"), me(linked).get("id"));
        assertEquals(false, me(linked).get("emailVerified"));

        var other =
                new HashMap<String, Object>(
                        proof(UUID.randomUUID().toString(), email, CLIENT_ID, true, NONCE));
        other.put("password", PASSWORD);
        assertStatus(409, "/google/link", other);

        var localAgain = post("/login", Map.of("email", email, "password", PASSWORD));
        assertEquals(me(local).get("id"), me(localAgain).get("id"));

        http().method(org.springframework.http.HttpMethod.DELETE)
                .uri("/api/v1/users/me")
                .headers(h -> h.setBearerAuth((String) local.get("accessToken")))
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("password", PASSWORD))
                .retrieve()
                .toBodilessEntity();
        assertEquals("REGISTER", post("/google", proof).get("next"));
    }

    @Test
    void passwordRecoverySupersedesTheGoogleLinkEvenAfterConfirmingAThirdPartyAddress()
            throws Exception {
        var email = "external-" + UUID.randomUUID() + "@example.com";
        var proof = proof(UUID.randomUUID().toString(), email, CLIENT_ID, true, NONCE);
        var form = new HashMap<String, Object>(proof);
        form.putAll(
                Map.of(
                        "name",
                        "Pessoa Google",
                        "phone",
                        "61999990000",
                        "role",
                        "CLIENT",
                        "acceptedTerms",
                        true));
        var registered = post("/google/register", form);
        assertEquals(false, me(registered).get("emailVerified"));
        var user = users.findByEmail(email).orElseThrow();
        post("/email/verify", Map.of("token", tokens.emailVerification(user)));
        assertEquals(true, me(registered).get("emailVerified"));
        post("/password/reset", Map.of("token", tokens.passwordReset(user), "password", PASSWORD));

        assertEquals("LINK", post("/google", proof).get("next"));
        assertEquals(
                me(registered).get("id"),
                me(post("/login", Map.of("email", email, "password", PASSWORD))).get("id"));
    }

    @Test
    void googleOnlyAccountCanBeDeletedOnlyWithTheLinkedGoogleIdentity() throws Exception {
        var email = "delete-" + UUID.randomUUID() + "@gmail.com";
        var subject = UUID.randomUUID().toString();
        var proof = proof(subject, email, CLIENT_ID, true, NONCE);
        var form = new HashMap<String, Object>(proof);
        form.putAll(
                Map.of(
                        "name",
                        "Pessoa Google",
                        "phone",
                        "61999990000",
                        "role",
                        "CLIENT",
                        "acceptedTerms",
                        true));
        var session = post("/google/register", form);
        assertEquals(true, me(session).get("googleLinked"));
        assertStatus(401, "/google/delete-account", proof);

        var deletion = proof(subject, email, CLIENT_ID, true, "delete-account-" + NONCE);
        var wrongGoogle =
                proof(
                        UUID.randomUUID().toString(),
                        email,
                        CLIENT_ID,
                        true,
                        "delete-account-" + NONCE);
        var bearer = (String) session.get("accessToken");
        var failure =
                assertThrows(
                        HttpClientErrorException.class,
                        () -> deleteGoogleAccount(bearer, wrongGoogle));
        assertEquals(403, failure.getStatusCode().value());
        assertEquals(
                401,
                assertThrows(
                                HttpClientErrorException.class,
                                () -> deleteGoogleAccount(bearer, proof))
                        .getStatusCode()
                        .value());
        assertEquals(204, deleteGoogleAccount(bearer, deletion));
        assertFalse(users.existsByEmail(email));
        assertEquals("REGISTER", post("/google", proof).get("next"));
    }

    private int deleteGoogleAccount(String bearer, Map<String, Object> proof) {
        return http().post()
                .uri("/api/v1/auth/google/delete-account")
                .headers(h -> h.setBearerAuth(bearer))
                .contentType(MediaType.APPLICATION_JSON)
                .body(proof)
                .retrieve()
                .toBodilessEntity()
                .getStatusCode()
                .value();
    }

    @Test
    void rejectsInvalidGoogleProofsBeforeLookingUpAnAccount() throws Exception {
        var email = "invalid-" + UUID.randomUUID() + "@gmail.com";
        assertStatus(401, "/google", Map.of("credential", "invalid", "verifier", VERIFIER));
        assertStatus(401, "/google", proof("subject", email, "other-client", true, NONCE));
        assertStatus(401, "/google", proof("subject", email, CLIENT_ID, false, NONCE));
        assertStatus(401, "/google", proof("subject", email, CLIENT_ID, true, "wrong-nonce"));
        assertStatus(
                401,
                "/google",
                proof(
                        "subject",
                        email,
                        CLIENT_ID,
                        true,
                        NONCE,
                        "https://example.com",
                        Instant.now()));
        assertStatus(
                401,
                "/google",
                proof(
                        "subject",
                        email,
                        CLIENT_ID,
                        true,
                        NONCE,
                        "https://accounts.google.com",
                        Instant.now().minusSeconds(700)));
        assertFalse(users.existsByEmail(email));
    }

    private static Map<String, Object> proof(
            String subject, String email, String audience, boolean verified, String nonce)
            throws Exception {
        return proof(
                subject,
                email,
                audience,
                verified,
                nonce,
                "https://accounts.google.com",
                Instant.now());
    }

    private static Map<String, Object> proof(
            String subject,
            String email,
            String audience,
            boolean verified,
            String nonce,
            String issuer,
            Instant now)
            throws Exception {
        var claims =
                new JWTClaimsSet.Builder()
                        .issuer(issuer)
                        .subject(subject)
                        .audience(audience)
                        .issueTime(Date.from(now))
                        .expirationTime(Date.from(now.plusSeconds(300)))
                        .claim("email", email)
                        .claim("email_verified", verified)
                        .claim("nonce", nonce)
                        .build();
        var credential = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims);
        credential.sign(new RSASSASigner(GoogleSigningKey.KEY));
        return Map.of("credential", credential.serialize(), "verifier", VERIFIER);
    }

    private RestClient http() {
        return RestClient.create("http://localhost:" + port);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> post(String path, Object body) {
        return http().post()
                .uri("/api/v1/auth" + path)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);
    }

    private Map<?, ?> me(Map<?, ?> session) {
        return http().get()
                .uri("/api/v1/users/me")
                .headers(h -> h.setBearerAuth((String) session.get("accessToken")))
                .retrieve()
                .body(Map.class);
    }

    private void assertStatus(int expected, String path, Object body) {
        assertEquals(
                expected,
                assertThrows(HttpClientErrorException.class, () -> post(path, body))
                        .getStatusCode()
                        .value());
    }
}
