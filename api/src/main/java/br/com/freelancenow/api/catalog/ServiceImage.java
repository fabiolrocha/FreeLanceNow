package br.com.freelancenow.api.catalog;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "service_image")
public class ServiceImage {
    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id")
    private ServiceListing service;

    @Column(name = "content_type", nullable = false, length = 20)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(nullable = false)
    private byte[] data;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ServiceImage() {}

    public ServiceImage(ServiceListing service, String contentType, byte[] data, Instant now) {
        this.id = UUID.randomUUID();
        this.service = service;
        this.contentType = contentType;
        this.sizeBytes = data.length;
        this.data = data;
        this.createdAt = now;
    }

    public UUID getId() {
        return id;
    }

    public ServiceListing getService() {
        return service;
    }

    public String getContentType() {
        return contentType;
    }

    public byte[] getData() {
        return data;
    }
}
