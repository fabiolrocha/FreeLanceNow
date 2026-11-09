package br.com.freelancenow.api.notifications;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class NotificationDtos {
    private NotificationDtos() {}

    public record NotificationView(
            UUID id,
            String type,
            String title,
            String body,
            String link,
            Instant createdAt,
            Instant readAt) {
        public static NotificationView from(Notification n) {
            return new NotificationView(
                    n.getId(),
                    n.getType(),
                    n.getTitle(),
                    n.getBody(),
                    n.getLink(),
                    n.getCreatedAt(),
                    n.getReadAt());
        }
    }

    public record Inbox(List<NotificationView> items, long unread) {}

    public record Unread(long unread) {}
}
