package br.com.freelancenow.api.auth;

import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.users.*;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;

@Service
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtEncoder tokens;
    private final String issuer;
    private final long ttl;
    private final String dummyHash;

    public AuthService(
            UserRepository users,
            PasswordEncoder passwords,
            JwtEncoder tokens,
            @Value("${app.jwt.issuer}") String issuer,
            @Value("${app.jwt.ttl-seconds}") long ttl) {
        this.users = users;
        this.passwords = passwords;
        this.tokens = tokens;
        this.issuer = issuer;
        this.ttl = ttl;
        this.dummyHash = passwords.encode("unregistered-account-dummy");
    }

    @Transactional
    public AuthDtos.Session register(AuthDtos.Register r) {
        if (r.role() == Role.ADMIN)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Administrador não pode ser criado no cadastro público.");
        if (r.password().getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "A senha deve ocupar no máximo 72 bytes.");
        var email = normalize(r.email());
        if (users.existsByEmail(email))
            throw new ApiException(
                    HttpStatus.CONFLICT, "Este e-mail já está cadastrado. Deseja fazer login?");
        var u =
                users.saveAndFlush(
                        new User(
                                r.name().trim(),
                                email,
                                passwords.encode(r.password()),
                                r.phone(),
                                r.role()));
        return session(u);
    }

    @Transactional(readOnly = true)
    public AuthDtos.Session login(AuthDtos.Login r) {
        var u = users.findByEmail(normalize(r.email())).orElse(null);
        boolean valid =
                r.password().getBytes(StandardCharsets.UTF_8).length <= 72
                        && passwords.matches(
                                r.password(), u == null ? dummyHash : u.getPasswordHash());
        if (!valid || u == null || !u.isActive())
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED,
                    "E-mail ou senha incorretos. Verifique e tente novamente.");
        return session(u);
    }

    private AuthDtos.Session session(User u) {
        var now = Instant.now();
        var claims =
                JwtClaimsSet.builder()
                        .issuer(issuer)
                        .subject(u.getId().toString())
                        .issuedAt(now)
                        .expiresAt(now.plusSeconds(ttl))
                        .claim("role", u.getRole().name())
                        .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).build();
        var token = tokens.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new AuthDtos.Session(token, "Bearer", ttl, UserDtos.Me.from(u));
    }

    private String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
