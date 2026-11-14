package br.com.freelancenow.api.users;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_avatar")
public class UserAvatar {
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "content_type", nullable = false, length = 20)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(nullable = false)
    private byte[] data;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserAvatar() {}

    public UserAvatar(UUID userId) {
        this.userId = userId;
    }

    public void replace(String contentType, byte[] data, Instant now) {
        this.contentType = contentType;
        this.data = data;
        this.sizeBytes = data.length;
        this.updatedAt = now;
    }

    public String getContentType() {
        return contentType;
    }

    public byte[] getData() {
        return data;
    }
}
