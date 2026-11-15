package br.com.freelancenow.api.auth;

import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.mail.MailSender;
import br.com.freelancenow.api.users.*;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class AuthService {
    static final Duration RESET_COOLDOWN = Duration.ofSeconds(60);
    private static final String INVALID_REFRESH = "Sua sessão terminou. Entre novamente.";
    private static final String INVALID_RESET =
            "Este link de redefinição é inválido ou expirou. Peça um novo link.";
    private static final String INVALID_VERIFY =
            "Este link de confirmação é inválido ou expirou. Entre na sua conta e peça um novo.";

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final TokenService tokens;
    private final MailSender mail;
    private final Clock clock;
    private final String webBaseUrl;
    private final String dummyHash;
    private final Map<String, Instant> lastResetRequest = new ConcurrentHashMap<>();
    private final Map<UUID, Instant> lastVerifyRequest = new ConcurrentHashMap<>();
    // Mail goes out in the background so the response time does not reveal whether an
    // account exists for the requested address.
    private final ExecutorService mailExecutor = Executors.newVirtualThreadPerTaskExecutor();

    public AuthService(
            UserRepository users,
            PasswordEncoder passwords,
            TokenService tokens,
            MailSender mail,
            Clock clock,
            @Value("${app.web-base-url}") String webBaseUrl) {
        this.users = users;
        this.passwords = passwords;
        this.tokens = tokens;
        this.mail = mail;
        this.clock = clock;
        this.webBaseUrl = webBaseUrl.replaceAll("/+$", "");
        this.dummyHash = passwords.encode("unregistered-account-dummy");
    }

    @Transactional
    public AuthDtos.Session register(AuthDtos.Register r) {
        if (r.role() == Role.ADMIN)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Administrador não pode ser criado no cadastro público.");
        requireBytes(r.password());
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
        mailExecutor.execute(() -> mail.send(verificationMail(u)));
        return session(u);
    }

    /** Confirms the address the link was sent to. Using a link twice is harmless. */
    @Transactional
    public void verifyEmail(AuthDtos.VerifyEmail r) {
        var jwt =
                tokens.decode(
                        r.token(),
                        TokenService.EMAIL_VERIFY,
                        HttpStatus.BAD_REQUEST,
                        INVALID_VERIFY);
        var u =
                users.lockById(UUID.fromString(jwt.getSubject()))
                        .filter(User::isActive)
                        .filter(x -> tokens.matchesEmail(jwt, x))
                        .orElseThrow(
                                () -> new ApiException(HttpStatus.BAD_REQUEST, INVALID_VERIFY));
        u.markEmailVerified(clock.instant());
    }

    /** Sends a new confirmation link, at most once a minute per account. */
    public void resendVerification(User u) {
        if (u.isEmailVerified()) return;
        var now = clock.instant();
        var previous = lastVerifyRequest.get(u.getId());
        if (previous != null && previous.plus(RESET_COOLDOWN).isAfter(now))
            throw new ApiException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Enviamos um link há menos de um minuto. Confira sua caixa de entrada e o spam.");
        lastVerifyRequest.put(u.getId(), now);
        lastVerifyRequest.values().removeIf(at -> at.plus(RESET_COOLDOWN).isBefore(now));
        mailExecutor.execute(() -> mail.send(verificationMail(u)));
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

    /** Exchanges a valid refresh token for a new access/refresh pair (rotation). */
    @Transactional(readOnly = true)
    public AuthDtos.Session refresh(AuthDtos.Refresh r) {
        var jwt =
                tokens.decode(
                        r.refreshToken(),
                        TokenService.REFRESH,
                        HttpStatus.UNAUTHORIZED,
                        INVALID_REFRESH);
        var u =
                users.findById(UUID.fromString(jwt.getSubject()))
                        .filter(User::isActive)
                        .filter(x -> tokens.matchesPassword(jwt, x))
                        .orElseThrow(
                                () -> new ApiException(HttpStatus.UNAUTHORIZED, INVALID_REFRESH));
        return session(u);
    }

    /**
     * Always succeeds from the caller's point of view, so the endpoint cannot be used to find out
     * which e-mails are registered. Active accounts receive a link valid for {@code
     * app.jwt.reset-ttl-seconds}.
     */
    @Transactional(readOnly = true)
    public void forgotPassword(AuthDtos.ForgotPassword r) {
        var email = normalize(r.email());
        var now = clock.instant();
        var previous = lastResetRequest.get(email);
        if (previous != null && previous.plus(RESET_COOLDOWN).isAfter(now)) return;
        lastResetRequest.put(email, now);
        lastResetRequest.values().removeIf(at -> at.plus(RESET_COOLDOWN).isBefore(now));
        users.findByEmail(email)
                .filter(User::isActive)
                .ifPresent(u -> mailExecutor.execute(() -> mail.send(resetMail(u))));
    }

    @Transactional
    public void resetPassword(AuthDtos.ResetPassword r) {
        requireBytes(r.password());
        var jwt =
                tokens.decode(
                        r.token(),
                        TokenService.PASSWORD_RESET,
                        HttpStatus.BAD_REQUEST,
                        INVALID_RESET);
        var u =
                users.lockById(UUID.fromString(jwt.getSubject()))
                        .filter(User::isActive)
                        .filter(x -> tokens.matchesPassword(jwt, x))
                        .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, INVALID_RESET));
        // A new hash changes the password fingerprint, so this link and all refresh tokens
        // issued before it stop working.
        u.changePassword(passwords.encode(r.password()));
    }

    @Transactional
    public AuthDtos.Session changePassword(User current, AuthDtos.ChangePassword r) {
        requireBytes(r.newPassword());
        var u =
                users.lockById(current.getId())
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.UNAUTHORIZED, INVALID_REFRESH));
        if (!passwords.matches(r.currentPassword(), u.getPasswordHash()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "A senha atual não confere.");
        if (passwords.matches(r.newPassword(), u.getPasswordHash()))
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "A nova senha deve ser diferente da atual.");
        u.changePassword(passwords.encode(r.newPassword()));
        users.flush();
        return session(u);
    }

    private MailSender.Mail verificationMail(User u) {
        var link =
                webBaseUrl
                        + "/verificar-email?token="
                        + URLEncoder.encode(tokens.emailVerification(u), StandardCharsets.UTF_8);
        long hours = tokens.verifyTtl() / 3600;
        var text =
                "Olá, "
                        + u.getName()
                        + ".\n\nBoas-vindas ao FreeLanceNow! Confirme seu e-mail pelo link abaixo"
                        + " em até "
                        + hours
                        + " horas:\n\n"
                        + link
                        + "\n\nSe você não criou esta conta, ignore este e-mail.";
        var html =
                "<p>Olá, "
                        + escape(u.getName())
                        + ".</p><p>Boas-vindas ao FreeLanceNow! Confirme seu e-mail para receber"
                        + " os avisos das suas contratações. O link vale por "
                        + hours
                        + " horas.</p><p><a href=\""
                        + escape(link)
                        + "\">Confirmar e-mail</a></p><p>Se você não criou esta conta, ignore"
                        + " este e-mail.</p>";
        return new MailSender.Mail(u.getEmail(), "Confirme seu e-mail — FreeLanceNow", text, html);
    }

    private MailSender.Mail resetMail(User u) {
        var link =
                webBaseUrl
                        + "/redefinir-senha?token="
                        + URLEncoder.encode(tokens.passwordReset(u), StandardCharsets.UTF_8);
        long minutes = tokens.resetTtl() / 60;
        var text =
                "Olá, "
                        + u.getName()
                        + ".\n\nRecebemos um pedido para redefinir a senha da sua conta no"
                        + " FreeLanceNow. Use o link abaixo em até "
                        + minutes
                        + " minutos:\n\n"
                        + link
                        + "\n\nSe você não fez esse pedido, ignore este e-mail. Sua senha"
                        + " continua a mesma.";
        var html =
                "<p>Olá, "
                        + escape(u.getName())
                        + ".</p><p>Recebemos um pedido para redefinir a senha da sua conta no"
                        + " FreeLanceNow. O link vale por "
                        + minutes
                        + " minutos.</p><p><a href=\""
                        + escape(link)
                        + "\">Definir nova senha</a></p><p>Se você não fez esse pedido, ignore"
                        + " este e-mail. Sua senha continua a mesma.</p>";
        return new MailSender.Mail(u.getEmail(), "Redefinição de senha — FreeLanceNow", text, html);
    }

    private AuthDtos.Session session(User u) {
        return new AuthDtos.Session(
                tokens.access(u),
                "Bearer",
                tokens.accessTtl(),
                tokens.refresh(u),
                tokens.refreshTtl(),
                UserDtos.Me.from(u));
    }

    private static void requireBytes(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "A senha deve ocupar no máximo 72 bytes.");
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
