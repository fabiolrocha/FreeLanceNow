package br.com.freelancenow.api.notifications;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.mail.MailSender;
import br.com.freelancenow.api.users.User;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
@Transactional(readOnly = true)
public class NotificationService {
    private static final int INBOX_SIZE = 50;
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    /**
     * Chat messages stay in the app: a conversation would turn into a stream of e-mails. Every
     * other notice is about a step with a deadline or a decision, so it also goes by e-mail.
     */
    private static final Set<String> IN_APP_ONLY = Set.of("MESSAGE_RECEIVED");

    private final NotificationRepository notifications;
    private final CurrentUser current;
    private final Clock clock;
    private final MailSender mail;
    private final String webBaseUrl;
    private final ExecutorService mailExecutor = Executors.newVirtualThreadPerTaskExecutor();

    public NotificationService(
            NotificationRepository notifications,
            CurrentUser current,
            Clock clock,
            MailSender mail,
            @Value("${app.web-base-url}") String webBaseUrl) {
        this.notifications = notifications;
        this.current = current;
        this.clock = clock;
        this.mail = mail;
        this.webBaseUrl = webBaseUrl.replaceAll("/+$", "");
    }

    /**
     * Joins the caller's transaction, so the notice is saved only if the action commits. The
     * e-mail copy (ADR28) is sent after the commit, in the background, and only to active accounts
     * with a confirmed address that kept e-mail notices on.
     */
    @Transactional
    public void notify(User to, String type, String title, String body, String link) {
        if (to == null) return;
        notifications.save(new Notification(to, type, title, body, link, Instant.now(clock)));
        if (IN_APP_ONLY.contains(type)
                || !to.isActive()
                || !to.isEmailVerified()
                || !to.isEmailNotifications()) return;
        var message = noticeMail(to, title, body, link);
        Runnable send =
                () ->
                        mailExecutor.execute(
                                () -> {
                                    try {
                                        mail.send(message);
                                    } catch (RuntimeException e) {
                                        // The in-app notice is already saved; e-mail is a copy.
                                        log.warn("Aviso por e-mail não enviado: {}", e.getMessage());
                                    }
                                });
        if (TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            send.run();
                        }
                    });
        else send.run();
    }

    private MailSender.Mail noticeMail(User to, String title, String body, String link) {
        var url = webBaseUrl + (link == null || link.isBlank() ? "/notificacoes" : link);
        var text =
                "Olá, "
                        + to.getName()
                        + ".\n\n"
                        + body
                        + "\n\nAbra no FreeLanceNow: "
                        + url
                        + "\n\nVocê pode desligar estes e-mails em Configurações da conta.";
        var html =
                "<p>Olá, "
                        + escape(to.getName())
                        + ".</p><p>"
                        + escape(body)
                        + "</p><p><a href=\""
                        + escape(url)
                        + "\">Abrir no FreeLanceNow</a></p><p style=\"color:#667\">Você pode"
                        + " desligar estes e-mails em Configurações da conta.</p>";
        return new MailSender.Mail(to.getEmail(), title + " — FreeLanceNow", text, html);
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    public NotificationDtos.Inbox inbox(Jwt jwt) {
        var u = current.require(jwt);
        var items =
                notifications
                        .findByUserIdOrderByCreatedAtDesc(u.getId(), PageRequest.of(0, INBOX_SIZE))
                        .stream()
                        .map(NotificationDtos.NotificationView::from)
                        .toList();
        return new NotificationDtos.Inbox(
                items, notifications.countByUserIdAndReadAtIsNull(u.getId()));
    }

    public NotificationDtos.Unread unread(Jwt jwt) {
        var u = current.require(jwt);
        return new NotificationDtos.Unread(notifications.countByUserIdAndReadAtIsNull(u.getId()));
    }

    @Transactional
    public NotificationDtos.NotificationView markRead(Jwt jwt, UUID id) {
        var u = current.require(jwt);
        var n =
                notifications
                        .findByIdAndUserId(id, u.getId())
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND, "Aviso não encontrado."));
        n.markRead(Instant.now(clock));
        return NotificationDtos.NotificationView.from(n);
    }

    @Transactional
    public NotificationDtos.Unread markAllRead(Jwt jwt) {
        var u = current.require(jwt);
        notifications.markAllRead(u.getId(), Instant.now(clock));
        return new NotificationDtos.Unread(0);
    }
}
