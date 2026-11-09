package br.com.freelancenow.api.config;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Set;

import javax.crypto.spec.SecretKeySpec;

@Component
public class JwtSecretValidator {
    private static final String LOCAL_COMPOSE_SECRET =
            "freelancenow-local-development-key-change-before-deploy-2026";
    private static final Set<String> PREDICTABLE_SECRETS =
            Set.of(
                    "freelancenow-production-change-this-default-key",
                    "01234567890123456789012345678901",
                    "this-is-a-known-insecure-default-key");

    private final Environment environment;

    public JwtSecretValidator(Environment environment) {
        this.environment = environment;
    }

    SecretKeySpec key(String secret) {
        if (secret == null || secret.isBlank())
            throw new IllegalArgumentException("JWT_SECRET deve estar definido e não pode estar em branco.");

        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32)
            throw new IllegalArgumentException("JWT_SECRET precisa ter pelo menos 32 bytes.");

        if (environment.matchesProfiles("prod")
                && (secret.equals(LOCAL_COMPOSE_SECRET) || PREDICTABLE_SECRETS.contains(secret)))
            throw new IllegalArgumentException(
                    "JWT_SECRET não pode usar um valor local ou previsível no perfil prod.");

        return new SecretKeySpec(bytes, "HmacSHA256");
    }
}
