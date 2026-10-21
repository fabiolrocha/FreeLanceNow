package br.com.freelancenow.api.demands;

import br.com.freelancenow.api.contracts.ContractDtos;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class DemandDtos {
    private DemandDtos() {}

    public record CreateDemand(
            @NotBlank @Size(max = 80) String title,
            @NotBlank @Size(max = 500) String description,
            @NotNull UUID categoryId,
            @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal budget,
            @NotNull @Min(1) @Max(365) Integer days,
            @NotBlank @Size(max = 100) String city) {}

    public record CreateProposal(
            @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal price,
            @NotNull @Min(1) @Max(365) Integer days,
            @NotBlank @Size(max = 600) String message) {}

    public record DemandView(
            UUID id,
            UUID clientId,
            String title,
            String description,
            UUID categoryId,
            BigDecimal budget,
            int days,
            String city,
            DemandStatus status,
            Instant createdAt,
            Instant closedAt) {
        public static DemandView from(Demand d) {
            return new DemandView(
                    d.getId(),
                    d.getClient().getId(),
                    d.getTitle(),
                    d.getDescription(),
                    d.getCategory().getId(),
                    d.getBudget(),
                    d.getDays(),
                    d.getCity(),
                    d.getStatus(),
                    d.getCreatedAt(),
                    d.getClosedAt());
        }
    }

    public record ProposalView(
            UUID id,
            UUID demandId,
            UUID freelancerId,
            String freelancerName,
            BigDecimal price,
            int days,
            String message,
            ProposalStatus status,
            Instant createdAt,
            Instant decidedAt) {
        public static ProposalView from(Proposal p) {
            return new ProposalView(
                    p.getId(),
                    p.getDemand().getId(),
                    p.getFreelancer().getId(),
                    p.getFreelancer().getName(),
                    p.getPrice(),
                    p.getDays(),
                    p.getMessage(),
                    p.getStatus(),
                    p.getCreatedAt(),
                    p.getDecidedAt());
        }
    }

    public record ProposalAcceptance(
            DemandView demand, ProposalView proposal, ContractDtos.ContractView contract) {}
}
