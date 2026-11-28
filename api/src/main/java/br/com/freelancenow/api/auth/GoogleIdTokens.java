package br.com.freelancenow.api.auth;

import br.com.freelancenow.api.common.ApiException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

@Component
class GoogleIdTokens {
    private static final String GOOGLE_KEYS = "https://www.googleapis.com/oauth2/v3/certs";
    private static final List<String> ISSUERS =
            List.of("https://accounts.google.com", "accounts.google.com");
    private static final Duration MAX_AGE = Duration.ofMinutes(10);
    private static final String INVALID =
            "A identificação do Google é inválida ou expirou. Entre com o Google novamente.";

    private final String clientId;
    private final Clock clock;
    private final JwtDecoder decoder;

    @Autowired
    GoogleIdTokens(@Value("${app.google.client-id}") String clientId, Clock clock) {
        this(clientId.trim(), clock, NimbusJwtDecoder.withJwkSetUri(GOOGLE_KEYS).build());
    }

    GoogleIdTokens(String clientId, Clock clock, JwtDecoder decoder) {
        this.clientId = clientId;
        this.clock = clock;
        this.decoder = decoder;
    }

    Identity verify(String credential, String verifier) {
        return verify(credential, verifier, "");
    }

    Identity verifyDeletion(String credential, String verifier) {
        return verify(credential, verifier, "delete-account-");
    }

    private Identity verify(String credential, String verifier, String noncePrefix) {
        if (clientId.isBlank())
            throw new ApiException(
                    HttpStatus.NOT_FOUND, "O login com Google não está configurado.");

        Jwt jwt;
        try {
            jwt = decoder.decode(credential);
        } catch (JwtException | IllegalArgumentException e) {
            throw invalid();
        }

        var now = clock.instant();
        var claims = jwt.getClaims();
        var issuer = jwt.getClaimAsString("iss");
        var subject = jwt.getSubject();
        var authorizedParty = claims.get("azp");
        var expectedNonce = (noncePrefix + nonce(verifier)).getBytes(StandardCharsets.US_ASCII);
        if (issuer == null
                || !ISSUERS.contains(issuer)
                || !List.of(clientId).equals(jwt.getAudience())
                || (authorizedParty != null && !clientId.equals(authorizedParty))
                || jwt.getExpiresAt() == null
                || !jwt.getExpiresAt().isAfter(now)
                || jwt.getIssuedAt() == null
                || jwt.getIssuedAt().isBefore(now.minus(MAX_AGE))
                || jwt.getIssuedAt().isAfter(now.plusSeconds(60))
                || subject == null
                || subject.isBlank()
                || subject.length() > 255
                || !Boolean.TRUE.equals(claims.get("email_verified"))
                || !(claims.get("email") instanceof String address)
                || address.isBlank()
                || address.length() > 254
                || !(claims.get("nonce") instanceof String receivedNonce)
                || !MessageDigest.isEqual(
                        expectedNonce, receivedNonce.getBytes(StandardCharsets.UTF_8)))
            throw invalid();

        var email = address.trim().toLowerCase(Locale.ROOT);
        // For other domains, Google may have verified the address when the Google account was
        // created.
        boolean authoritative =
                email.endsWith("@gmail.com")
                        || (claims.get("hd") instanceof String domain && !domain.isBlank());
        var name = claims.get("name") instanceof String value ? value : "";
        return new Identity(subject, email, name, authoritative);
    }

    private static String nonce(String verifier) {
        try {
            var secret = Base64.getUrlDecoder().decode(verifier);
            var digest = MessageDigest.getInstance("SHA-256").digest(secret);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (IllegalArgumentException e) {
            throw invalid();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.UNAUTHORIZED, INVALID);
    }

    record Identity(String subject, String email, String name, boolean authoritativeEmail) {}
}
