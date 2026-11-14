package br.com.freelancenow.api.demands;

import br.com.freelancenow.api.contracts.ContractDtos;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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

    /**
     * Date and address of the contract created when the client accepts a proposal. Both are
     * optional: without a date the contract is scheduled after the proposal's delivery days, and
     * without an address it uses the demand's city.
     */
    public record AcceptProposal(LocalDate date, @Size(max = 200) String address) {}

    public record DemandView(
            UUID id,
            UUID clientId,
            String title,
            String description,
            UUID categoryId,
            String categoryName,
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
                    d.getCategory().getName(),
                    d.getBudget(),
                    d.getDays(),
                    d.getCity(),
                    d.getStatus(),
                    d.getCreatedAt(),
                    d.getClosedAt());
        }
    }

    /**
     * A proposal with what each side needs to decide: the demand it answers, the freelancer's
     * reputation and, once accepted, the contract it created.
     */
    public record ProposalView(
            UUID id,
            UUID demandId,
            String demandTitle,
            DemandStatus demandStatus,
            UUID freelancerId,
            String freelancerName,
            Double freelancerAverageRating,
            long freelancerReviewCount,
            Long freelancerAvatarVersion,
            BigDecimal price,
            int days,
            String message,
            ProposalStatus status,
            Instant createdAt,
            Instant decidedAt,
            UUID contractId) {
        public static ProposalView from(Proposal p) {
            return from(p, null, 0L, null);
        }

        public static ProposalView from(
                Proposal p, Double averageRating, long reviewCount, UUID contractId) {
            var f = p.getFreelancer();
            return new ProposalView(
                    p.getId(),
                    p.getDemand().getId(),
                    p.getDemand().getTitle(),
                    p.getDemand().getStatus(),
                    f.getId(),
                    f.getName(),
                    averageRating,
                    reviewCount,
                    f.getAvatarVersion(),
                    p.getPrice(),
                    p.getDays(),
                    p.getMessage(),
                    p.getStatus(),
                    p.getCreatedAt(),
                    p.getDecidedAt(),
                    contractId);
        }
    }

    public record ProposalAcceptance(
            DemandView demand, ProposalView proposal, ContractDtos.ContractView contract) {}
}
