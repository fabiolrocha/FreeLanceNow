package br.com.freelancenow.api.auth;

import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.config.JwtSecretValidator;
import br.com.freelancenow.api.users.User;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Issues the three kinds of signed tokens used by the API.
 *
 * <p>Access tokens carry no {@code purpose} claim and are the only ones accepted as bearer
 * credentials (see {@code SecurityConfig}). Refresh and password-reset tokens carry a {@code
 * purpose} and a fingerprint of the current password hash, so changing the password invalidates
 * every outstanding refresh/reset token without storing them.
 */
@Service
public class TokenService {
    public static final String PURPOSE = "purpose";
    public static final String REFRESH = "refresh";
    public static final String PASSWORD_RESET = "password-reset";
    private static final String PASSWORD_VERSION = "pv";

    private final JwtEncoder encoder;
    private final JwtDecoder purposeDecoder;
    private final String issuer;
    private final long accessTtl;
    private final long refreshTtl;
    private final long resetTtl;

    public TokenService(
            JwtEncoder encoder,
            JwtSecretValidator secretValidator,
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.issuer}") String issuer,
            @Value("${app.jwt.ttl-seconds}") long accessTtl,
            @Value("${app.jwt.refresh-ttl-seconds}") long refreshTtl,
            @Value("${app.jwt.reset-ttl-seconds}") long resetTtl) {
        this.encoder = encoder;
        var decoder =
                NimbusJwtDecoder.withSecretKey(secretValidator.key(secret))
                        .macAlgorithm(MacAlgorithm.HS256)
                        .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
        this.purposeDecoder = decoder;
        this.issuer = issuer;
        this.accessTtl = accessTtl;
        this.refreshTtl = refreshTtl;
        this.resetTtl = resetTtl;
    }

    public long accessTtl() {
        return accessTtl;
    }

    public long refreshTtl() {
        return refreshTtl;
    }

    public long resetTtl() {
        return resetTtl;
    }

    public String access(User u) {
        return encode(base(u, accessTtl).claim("role", u.getRole().name()).build());
    }

    public String refresh(User u) {
        return encode(
                base(u, refreshTtl)
                        .claim(PURPOSE, REFRESH)
                        .claim(PASSWORD_VERSION, passwordVersion(u))
                        .build());
    }

    public String passwordReset(User u) {
        return encode(
                base(u, resetTtl)
                        .claim(PURPOSE, PASSWORD_RESET)
                        .claim(PASSWORD_VERSION, passwordVersion(u))
                        .build());
    }

    /**
     * Validates signature, issuer, expiry and purpose, returning the subject. The caller must then
     * load the user and call {@link #matchesPassword(Jwt, User)}.
     */
    public Jwt decode(String token, String purpose, HttpStatus failure, String message) {
        try {
            var jwt = purposeDecoder.decode(token);
            if (!purpose.equals(jwt.getClaimAsString(PURPOSE)))
                throw new ApiException(failure, message);
            UUID.fromString(jwt.getSubject());
            return jwt;
        } catch (JwtException | IllegalArgumentException e) {
            throw new ApiException(failure, message);
        }
    }

    public boolean matchesPassword(Jwt jwt, User u) {
        var claim = jwt.getClaimAsString(PASSWORD_VERSION);
        return claim != null
                && MessageDigest.isEqual(
                        claim.getBytes(StandardCharsets.UTF_8),
                        passwordVersion(u).getBytes(StandardCharsets.UTF_8));
    }

    private JwtClaimsSet.Builder base(User u, long ttl) {
        var now = Instant.now();
        return JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(u.getId().toString())
                .id(UUID.randomUUID().toString())
                .issuedAt(now)
                .expiresAt(now.plusSeconds(ttl));
    }

    private String encode(JwtClaimsSet claims) {
        var header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    private static String passwordVersion(User u) {
        try {
            var digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(u.getPasswordHash().getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest).substring(0, 22);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
