package br.com.freelancenow.api.config;

import br.com.freelancenow.api.admin.AuditService;
import br.com.freelancenow.api.auth.AuthDtos;
import br.com.freelancenow.api.users.*;

import jakarta.validation.Validator;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Component
@ConditionalOnProperty(name = "app.admin-bootstrap.enabled", havingValue = "true")
public class AdminBootstrap implements CommandLineRunner {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final AuditService audit;
    private final Validator validator;
    private final String email, password, name;

    public AdminBootstrap(
            UserRepository users,
            PasswordEncoder passwords,
            AuditService audit,
            Validator validator,
            @Value("${app.admin-bootstrap.email:}") String email,
            @Value("${app.admin-bootstrap.password:}") String password,
            @Value("${app.admin-bootstrap.name:Administrador}") String name) {
        this.users = users;
        this.passwords = passwords;
        this.audit = audit;
        this.validator = validator;
        this.email = email.trim().toLowerCase(Locale.ROOT);
        this.password = password;
        this.name = name.trim();
    }

    @Override
    @Transactional
    public void run(String... args) {
        var credentials =
                new AuthDtos.Register(name, email, password, "0000000000", Role.ADMIN, true);
        if (!validator.validate(credentials).isEmpty()
                || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new IllegalStateException(
                    "Configuração inválida de bootstrap ADMIN: confira nome, e-mail e senha (8"
                        + " caracteres, letras/números, até 72 bytes).");
        var existing = users.findByEmail(email).orElse(null);
        if (existing != null) {
            if (existing.getRole() != Role.ADMIN)
                throw new IllegalStateException(
                        "Bootstrap ADMIN não promove uma conta comum existente.");
            return;
        }
        var u =
                users.saveAndFlush(
                        new User(
                                name, email, passwords.encode(password), "0000000000", Role.ADMIN));
        audit.record(
                u,
                "ADMIN_CREATED",
                "USER",
                u.getId(),
                "",
                "ADMIN",
                "Provisionamento explícito na inicialização");
    }
}
