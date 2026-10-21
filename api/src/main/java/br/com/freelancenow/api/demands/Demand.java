package br.com.freelancenow.api.demands;

import br.com.freelancenow.api.catalog.Category;
import br.com.freelancenow.api.users.User;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "demand")
public class Demand {
    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id")
    private User client;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, length = 80)
    private String title;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal budget;

    @Column(nullable = false)
    private int days;

    @Column(nullable = false, length = 100)
    private String city;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DemandStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    protected Demand() {}

    public Demand(
            User client,
            Category category,
            String title,
            String description,
            BigDecimal budget,
            int days,
            String city,
            Instant now) {
        this.id = UUID.randomUUID();
        this.client = client;
        this.category = category;
        this.title = title.trim();
        this.description = description.trim();
        this.budget = budget;
        this.days = days;
        this.city = city.trim();
        this.status = DemandStatus.OPEN;
        this.createdAt = now;
    }

    public void close(Instant now) {
        this.status = DemandStatus.CLOSED;
        this.closedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public User getClient() {
        return client;
    }

    public Category getCategory() {
        return category;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getBudget() {
        return budget;
    }

    public int getDays() {
        return days;
    }

    public String getCity() {
        return city;
    }

    public DemandStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }
}
