package br.com.freelancenow.api.demands;

import br.com.freelancenow.api.users.User;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "proposal")
public class Proposal {
    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "demand_id")
    private Demand demand;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "freelancer_id")
    private User freelancer;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(nullable = false)
    private int days;

    @Column(nullable = false, length = 600)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProposalStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "decided_at")
    private Instant decidedAt;

    protected Proposal() {}

    public Proposal(
            Demand demand,
            User freelancer,
            BigDecimal price,
            int days,
            String message,
            Instant now) {
        this.id = UUID.randomUUID();
        this.demand = demand;
        this.freelancer = freelancer;
        this.price = price;
        this.days = days;
        this.message = message.trim();
        this.status = ProposalStatus.PENDING;
        this.createdAt = now;
    }

    public void accept(Instant now) {
        this.status = ProposalStatus.ACCEPTED;
        this.decidedAt = now;
    }

    public void reject(Instant now) {
        this.status = ProposalStatus.REJECTED;
        this.decidedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public Demand getDemand() {
        return demand;
    }

    public User getFreelancer() {
        return freelancer;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public int getDays() {
        return days;
    }

    public String getMessage() {
        return message;
    }

    public ProposalStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }
}
