package br.com.freelancenow.api.notifications;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.users.User;

import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class NotificationService {
    private static final int INBOX_SIZE = 50;

    private final NotificationRepository notifications;
    private final CurrentUser current;
    private final Clock clock;

    public NotificationService(
            NotificationRepository notifications, CurrentUser current, Clock clock) {
        this.notifications = notifications;
        this.current = current;
        this.clock = clock;
    }

    /** Joins the caller's transaction, so the notice is saved only if the action commits. */
    @Transactional
    public void notify(User to, String type, String title, String body, String link) {
        if (to == null) return;
        notifications.save(new Notification(to, type, title, body, link, Instant.now(clock)));
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
