package br.com.freelancenow.api.config;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Set;

class JwtSecretValidatorTests {
    private static final String ISSUER = "freelancenow-api";
    private static final String LOCAL_COMPOSE_SECRET =
            "freelancenow-local-development-key-change-before-deploy-2026";

    @Test
    void productionRejectsMissingOrBlankSecret() {
        var validator = validator("prod");

        assertAll(
                () -> assertThrows(IllegalArgumentException.class, () -> validator.key(null)),
                () -> assertThrows(IllegalArgumentException.class, () -> validator.key("")),
                () -> assertThrows(IllegalArgumentException.class, () -> validator.key("   ")));
    }

    @Test
    void productionRejectsSecretShorterThan32Bytes() {
        assertThrows(IllegalArgumentException.class, () -> validator("prod").key("short"));
    }

    @Test
    void productionRejectsLocalComposeSecret() {
        assertThrows(
                IllegalArgumentException.class,
                () -> validator("prod").key(LOCAL_COMPOSE_SECRET));
    }

    @Test
    void productionRejectsExplicitPredictableValues() {
        var validator = validator("prod");
        Set.of(
                        "freelancenow-production-change-this-default-key",
                        "01234567890123456789012345678901",
                        "this-is-a-known-insecure-default-key")
                .forEach(
                        value ->
                                assertThrows(
                                        IllegalArgumentException.class,
                                        () -> validator.key(value)));
    }

    @Test
    void productionAcceptsRandomSecretOfAtLeast32Bytes() {
        assertDoesNotThrow(() -> validator("prod").key(randomSecret()));
    }

    @Test
    void devContinuesAcceptingLocalComposeSecret() {
        assertDoesNotThrow(() -> validator("dev").key(LOCAL_COMPOSE_SECRET));
    }

    @Test
    void encoderEmitsHs256TokenThatDecoderValidatesWithSameSecretAndIssuer() {
        var validator = validator("prod");
        var config = new SecurityConfig();
        var secret = randomSecret();
        JwtEncoder encoder = config.jwtEncoder(secret, validator);
        JwtDecoder decoder = config.jwtDecoder(secret, ISSUER, validator);
        var now = Instant.now();
        var claims =
                JwtClaimsSet.builder()
                        .issuer(ISSUER)
                        .subject("user-123")
                        .issuedAt(now)
                        .expiresAt(now.plusSeconds(60))
                        .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).build();

        String token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        Jwt decoded = decoder.decode(token);

        assertEquals("HS256", decoded.getHeaders().get("alg"));
        assertEquals(ISSUER, decoded.getClaims().get("iss"));
        assertEquals("user-123", decoded.getSubject());
    }

    private static JwtSecretValidator validator(String profile) {
        var environment = new StandardEnvironment();
        environment.setActiveProfiles(profile);
        return new JwtSecretValidator(environment);
    }

    private static String randomSecret() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }
}
