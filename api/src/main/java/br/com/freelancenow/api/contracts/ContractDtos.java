package br.com.freelancenow.api.contracts;

import br.com.freelancenow.api.reviews.Review;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ContractDtos {
    private ContractDtos() {}

    public record CreateContract(
            @NotNull UUID serviceId,
            @NotNull LocalDate date,
            @NotBlank @Size(max = 300) String description,
            @Size(max = 200) String address) {}

    public record TransitionContract(
            @NotNull ContractStatus status, @Size(max = 500) String comment) {}

    public record HistoryItem(ContractStatus status, Instant at) {
        public static HistoryItem from(ContractEvent e) {
            return new HistoryItem(e.getStatus(), e.getCreatedAt());
        }
    }

    public record ContractView(
            UUID id,
            UUID serviceId,
            String title,
            UUID freelancerId,
            UUID clientId,
            String clientName,
            String freelancerName,
            BigDecimal price,
            LocalDate date,
            String description,
            String address,
            ContractStatus status,
            List<HistoryItem> history,
            Instant completedAt,
            Integer rating,
            String review,
            String reviewReply,
            Instant reviewedAt,
            String dispute,
            String observations) {
        public static ContractView from(Contract c, List<ContractEvent> events) {
            return from(c, events, null);
        }

        public static ContractView from(
                Contract c, List<ContractEvent> events, Review r) {
            return new ContractView(
                    c.getId(),
                    c.getService() == null ? null : c.getService().getId(),
                    c.getTitle(),
                    c.getFreelancer().getId(),
                    c.getClient().getId(),
                    c.getClient().getName(),
                    c.getFreelancer().getName(),
                    c.getPrice(),
                    c.getScheduledDate(),
                    c.getDescription(),
                    c.getAddress(),
                    c.getStatus(),
                    events.stream().map(HistoryItem::from).toList(),
                    c.getCompletedAt(),
                    r == null ? null : r.getRating(),
                    r == null ? null : r.getComment(),
                    r == null ? null : r.getReply(),
                    r == null ? null : r.getCreatedAt(),
                    c.getDispute(),
                    c.getObservations());
        }
    }
}
