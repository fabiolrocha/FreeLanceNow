package br.com.freelancenow.api.admin;

import br.com.freelancenow.api.users.User;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_event")
public class AuditEvent {
    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Column(nullable = false, length = 80)
    private String action;

    @Column(name = "target_type", nullable = false, length = 30)
    private String targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Column(name = "before_value", nullable = false, columnDefinition = "text")
    private String beforeValue;

    @Column(name = "after_value", nullable = false, columnDefinition = "text")
    private String afterValue;

    @Column(nullable = false, length = 1000)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AuditEvent() {}

    public AuditEvent(
            User actor,
            String action,
            String targetType,
            UUID targetId,
            String beforeValue,
            String afterValue,
            String reason,
            Instant now) {
        id = UUID.randomUUID();
        this.actor = actor;
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.beforeValue = beforeValue;
        this.afterValue = afterValue;
        this.reason = reason == null ? "" : reason;
        createdAt = now;
    }

    public record View(
            UUID id,
            UUID actorId,
            String actorName,
            String action,
            String targetType,
            UUID targetId,
            String beforeValue,
            String afterValue,
            String reason,
            Instant createdAt) {}

    public View view() {
        return new View(
                id,
                actor.getId(),
                actor.getName(),
                action,
                targetType,
                targetId,
                beforeValue,
                afterValue,
                reason,
                createdAt);
    }
}
