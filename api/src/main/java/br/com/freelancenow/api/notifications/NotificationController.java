package br.com.freelancenow.api.notifications;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public NotificationDtos.Inbox inbox(@AuthenticationPrincipal Jwt jwt) {
        return notifications.inbox(jwt);
    }

    @GetMapping("/unread-count")
    public NotificationDtos.Unread unread(@AuthenticationPrincipal Jwt jwt) {
        return notifications.unread(jwt);
    }

    @PostMapping("/{id}/read")
    public NotificationDtos.NotificationView read(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return notifications.markRead(jwt, id);
    }

    @PostMapping("/read-all")
    public NotificationDtos.Unread readAll(@AuthenticationPrincipal Jwt jwt) {
        return notifications.markAllRead(jwt);
    }
}
