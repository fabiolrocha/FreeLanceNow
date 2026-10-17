package br.com.freelancenow.api.contracts;

import br.com.freelancenow.api.catalog.ServiceListing;
import br.com.freelancenow.api.users.User;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "contract")
public class Contract {
    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_id")
    private ServiceListing service;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "client_id")
    private User client;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "freelancer_id")
    private User freelancer;

    @Column(nullable = false, length = 80)
    private String title;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;

    @Column(name = "scheduled_date", nullable = false)
    private LocalDate scheduledDate;

    @Column(nullable = false, length = 300)
    private String description;

    @Column(nullable = false, length = 200)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ContractStatus status;

    @Column(length = 500)
    private String observations;

    @Column(length = 300)
    private String dispute;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "status_updated_at", nullable = false)
    private Instant statusUpdatedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    protected Contract() {}

    public Contract(
            ServiceListing service,
            User client,
            LocalDate scheduledDate,
            String description,
            String address,
            Instant now) {
        this.id = UUID.randomUUID();
        this.service = service;
        this.client = client;
        this.freelancer = service.getFreelancer();
        this.title = service.getTitle();
        this.price = service.getPrice();
        this.scheduledDate = scheduledDate;
        this.description = description.trim();
        this.address = address == null ? "" : address.trim();
        this.status = ContractStatus.PENDENTE;
        this.createdAt = now;
        this.statusUpdatedAt = now;
    }

    public void transitionTo(ContractStatus next, String comment, Instant now) {
        this.status = next;
        this.statusUpdatedAt = now;
        String clean = comment == null ? null : comment.trim();
        if (next == ContractStatus.AGUARDANDO_CONFIRMACAO && clean != null && !clean.isEmpty()) {
            this.observations = clean;
        }
        if (next == ContractStatus.EM_DISPUTA && clean != null && !clean.isEmpty()) {
            this.dispute = clean;
        }
        if (next == ContractStatus.CONCLUIDO) {
            this.completedAt = now;
        }
    }

    public UUID getId() {
        return id;
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

    public String getTitle() {
        return title;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public LocalDate getScheduledDate() {
        return scheduledDate;
    }

    public String getDescription() {
        return description;
    }

    public String getAddress() {
        return address;
    }

    public ContractStatus getStatus() {
        return status;
    }

    public String getObservations() {
        return observations;
    }

    public String getDispute() {
        return dispute;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getStatusUpdatedAt() {
        return statusUpdatedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }
}
