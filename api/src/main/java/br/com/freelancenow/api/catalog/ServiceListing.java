package br.com.freelancenow.api.catalog;

import br.com.freelancenow.api.users.User;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "service_listing")
public class ServiceListing {
    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "freelancer_id")
    private User freelancer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, length = 80)
    private String title;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "delivery_days", nullable = false)
    private int deliveryDays;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ServiceStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ServiceListing() {}

    public ServiceListing(User freelancer, Category category, CatalogDtos.SaveService r) {
        this.id = UUID.randomUUID();
        this.freelancer = freelancer;
        this.createdAt = Instant.now();
        update(category, r);
    }

    public void update(Category category, CatalogDtos.SaveService r) {
        this.category = category;
        this.title = r.title().trim();
        this.description = r.description().trim();
        this.price = r.price();
        this.deliveryDays = r.deliveryDays();
        this.status = r.status();
    }

    public void setStatus(ServiceStatus status) {
        this.status = status;
    }

    public UUID getId() {
        return id;
    }

    public User getFreelancer() {
        return freelancer;
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

    public BigDecimal getPrice() {
        return price;
    }

    public int getDeliveryDays() {
        return deliveryDays;
    }

    public ServiceStatus getStatus() {
        return status;
    }
}
