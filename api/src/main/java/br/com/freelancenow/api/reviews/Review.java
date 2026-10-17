package br.com.freelancenow.api.reviews;

import br.com.freelancenow.api.catalog.ServiceListing;
import br.com.freelancenow.api.contracts.Contract;
import br.com.freelancenow.api.users.User;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "review")
public class Review {
    @Id private UUID id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contract_id")
    private Contract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id")
    private ServiceListing service;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id")
    private User client;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "freelancer_id")
    private User freelancer;

    @Column(nullable = false)
    private int rating;

    @Column(nullable = false, length = 500)
    private String comment = "";

    @Column(length = 200)
    private String reply;

    @Column(name = "replied_at")
    private Instant repliedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected Review() {}

    public Review(Contract contract, int rating, String comment, Instant now) {
        this.id = UUID.randomUUID();
        this.contract = contract;
        this.service = contract.getService();
        this.client = contract.getClient();
        this.freelancer = contract.getFreelancer();
        this.rating = rating;
        this.comment = comment == null ? "" : comment.trim();
        this.createdAt = now;
    }

    public void registerReply(String replyText, Instant now) {
        this.reply = replyText.trim();
        this.repliedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public Contract getContract() {
        return contract;
    }

    public ServiceListing getService() {
        return service;
    }

    public User getClient() {
        return client;
    }

    public User getFreelancer() {
        return freelancer;
    }

    public int getRating() {
        return rating;
    }

    public String getComment() {
        return comment;
    }

    public String getReply() {
        return reply;
    }

    public Instant getRepliedAt() {
        return repliedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
