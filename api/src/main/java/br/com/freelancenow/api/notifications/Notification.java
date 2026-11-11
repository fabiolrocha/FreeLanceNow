package br.com.freelancenow.api.notifications;

import br.com.freelancenow.api.users.User;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notification")
public class Notification {
    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, length = 300)
    private String body;

    @Column(nullable = false, length = 200)
    private String link;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    protected Notification() {}

    public Notification(
            User user, String type, String title, String body, String link, Instant now) {
        this.id = UUID.randomUUID();
        this.user = user;
        this.type = type;
        this.title = cut(title, 150);
        this.body = cut(body == null ? "" : body, 300);
        this.link = cut(link == null ? "" : link, 200);
        this.createdAt = now;
    }

    private static String cut(String value, int max) {
        var clean = value.trim();
        return clean.length() > max ? clean.substring(0, max) : clean;
    }

    public void markRead(Instant now) {
        if (readAt == null) readAt = now;
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getType() {
        return type;
    }

    public String getTitle() {
        return title;
    }

    public String getBody() {
        return body;
    }

    public String getLink() {
        return link;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getReadAt() {
        return readAt;
    }
}
