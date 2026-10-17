package br.com.freelancenow.api.contracts;

import br.com.freelancenow.api.users.User;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "contract_event")
public class ContractEvent {
    @Id private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contract_id")
    private Contract contract;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", length = 30)
    private ContractStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ContractStatus status;

    @Column(length = 500)
    private String note;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ContractEvent() {}

    public ContractEvent(
            Contract contract,
            User actor,
            ContractStatus previousStatus,
            ContractStatus status,
            String note,
            Instant createdAt) {
        this.id = UUID.randomUUID();
        this.contract = contract;
        this.actor = actor;
        this.previousStatus = previousStatus;
        this.status = status;
        this.note = note != null && !note.isBlank() ? note.trim() : null;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public Contract getContract() {
        return contract;
    }

    public User getActor() {
        return actor;
    }

    public ContractStatus getPreviousStatus() {
        return previousStatus;
    }

    public ContractStatus getStatus() {
        return status;
    }

    public String getNote() {
        return note;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
