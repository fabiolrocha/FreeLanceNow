package br.com.freelancenow.api.moderation;

import br.com.freelancenow.api.users.User;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "content_report")
public class ContentReport {
    public enum Target {
        SERVICE,
        REVIEW,
        POST
    }

    public enum Status {
        PENDING,
        KEPT,
        REMOVED
    }

    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reporter_id")
    private User reporter;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private Target targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    @Column(name = "target_title", nullable = false, length = 100)
    private String targetTitle;

    @Column(name = "target_content", nullable = false, length = 1000)
    private String targetContent;

    @Column(nullable = false, length = 80)
    private String reason;

    @Column(nullable = false, length = 1000)
    private String comment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by")
    private User decidedBy;

    @Column(name = "decision_note", length = 1000)
    private String decisionNote;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "decided_at")
    private Instant decidedAt;

    protected ContentReport() {}

    public ContentReport(
            User reporter, ReportDtos.Create r, String title, String content, Instant now) {
        id = UUID.randomUUID();
        this.reporter = reporter;
        targetType = r.targetType();
        targetId = r.targetId();
        targetTitle = title;
        targetContent = content;
        reason = r.reason().trim();
        comment = r.comment().trim();
        createdAt = now;
    }

    public void decide(User actor, Status status, String note, Instant now) {
        decidedBy = actor;
        this.status = status;
        decisionNote = note.trim();
        decidedAt = now;
    }

    public Target getTargetType() {
        return targetType;
    }

    public UUID getTargetId() {
        return targetId;
    }

    public Status getStatus() {
        return status;
    }

    public record View(
            UUID id,
            UUID reporterId,
            String reporterName,
            Target targetType,
            UUID targetId,
            String targetTitle,
            String targetContent,
            String reason,
            String comment,
            Status status,
            String decisionNote,
            String decidedByName,
            Instant createdAt,
            Instant decidedAt) {}

    public View view() {
        return new View(
                id,
                reporter.getId(),
                reporter.getName(),
                targetType,
                targetId,
                targetTitle,
                targetContent,
                reason,
                comment,
                status,
                decisionNote,
                decidedBy == null ? null : decidedBy.getName(),
                createdAt,
                decidedAt);
    }
}
