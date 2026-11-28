package br.com.freelancenow.api.auth;

import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.users.Role;
import br.com.freelancenow.api.users.User;
import br.com.freelancenow.api.users.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.UUID;

@Service
class GoogleAuthService {
    private final AuthService auth;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final Clock clock;

    GoogleAuthService(
            AuthService auth, UserRepository users, PasswordEncoder passwords, Clock clock) {
        this.auth = auth;
        this.users = users;
        this.passwords = passwords;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public GoogleAuthDtos.Result signIn(GoogleIdTokens.Identity identity) {
        var linked = users.findByGoogleSubject(identity.subject());
        if (linked.isPresent()) {
            var user = linked.get();
            requireEligible(user);
            return new GoogleAuthDtos.Result(
                    GoogleAuthDtos.Next.SIGNED_IN, auth.session(user), null, null);
        }
        var existing = users.findByEmail(identity.email());
        existing.ifPresent(this::requireEligible);
        if (existing.filter(user -> user.getGoogleSubject() != null).isPresent())
            throw alreadyLinked();
        return new GoogleAuthDtos.Result(
                existing.isPresent() ? GoogleAuthDtos.Next.LINK : GoogleAuthDtos.Next.REGISTER,
                null,
                identity.email(),
                identity.name());
    }

    @Transactional
    public AuthDtos.Session register(
            GoogleIdTokens.Identity identity, GoogleAuthDtos.Register request) {
        if (request.role() == Role.ADMIN)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "Escolha o perfil de cliente ou freelancer.");
        if (users.existsByEmail(identity.email())
                || users.findByGoogleSubject(identity.subject()).isPresent())
            throw new ApiException(
                    HttpStatus.CONFLICT, "A conta já existe. Volte e tente entrar novamente.");

        // Existing password recovery can set a local password if the user needs one later.
        var user =
                new User(
                        request.name().trim(),
                        identity.email(),
                        passwords.encode(UUID.randomUUID().toString()),
                        request.phone(),
                        request.role());
        attach(user, identity);
        if (!user.isEmailVerified()) auth.sendVerification(user);
        return auth.session(user);
    }

    @Transactional
    public AuthDtos.Session link(GoogleIdTokens.Identity identity, GoogleAuthDtos.Link request) {
        var user =
                users.lockByEmail(identity.email()).orElseThrow(GoogleAuthService::invalidPassword);
        requireEligible(user);
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72
                || !passwords.matches(request.password(), user.getPasswordHash()))
            throw invalidPassword();

        var subject = user.getGoogleSubject();
        if (subject != null && !subject.equals(identity.subject())) throw alreadyLinked();
        attach(user, identity);
        return auth.session(user);
    }

    private void attach(User user, GoogleIdTokens.Identity identity) {
        user.linkGoogle(identity.subject());
        if (identity.authoritativeEmail()) user.markEmailVerified(clock.instant());
        users.saveAndFlush(user);
    }

    private void requireEligible(User user) {
        if (!user.isActive() || user.getRole() == Role.ADMIN)
            throw new ApiException(
                    HttpStatus.UNAUTHORIZED, "Esta conta não pode entrar com Google.");
    }

    private static ApiException invalidPassword() {
        return new ApiException(
                HttpStatus.UNAUTHORIZED, "A senha da sua conta FreeLanceNow não confere.");
    }

    private static ApiException alreadyLinked() {
        return new ApiException(
                HttpStatus.CONFLICT,
                "Este e-mail já está vinculado a outra conta Google. Entre com sua senha.");
    }
}
