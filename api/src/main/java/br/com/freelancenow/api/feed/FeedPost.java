package br.com.freelancenow.api.feed;

import br.com.freelancenow.api.catalog.*;
import br.com.freelancenow.api.users.User;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "feed_post")
public class FeedPost {
    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id")
    private User author;

    @Column(nullable = false, length = 500)
    private String text;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private ServiceListing service;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private boolean hidden;

    protected FeedPost() {}

    public FeedPost(
            User author, String text, Category category, ServiceListing service, Instant now) {
        this.id = UUID.randomUUID();
        this.author = author;
        this.text = text.trim();
        this.category = category;
        this.service = service;
        this.createdAt = now;
    }

    public UUID getId() {
        return id;
    }

    public User getAuthor() {
        return author;
    }

    public String getText() {
        return text;
    }

    public ServiceListing getService() {
        return service;
    }

    public boolean isHidden() {
        return hidden;
    }

    public void hide() {
        hidden = true;
    }

    public boolean isVisible() {
        return !hidden
                && author.isActive()
                && (service == null
                        || (!service.isModerated()
                                && service.getStatus() == ServiceStatus.ACTIVE
                                && service.getFreelancer().isActive()));
    }
}
