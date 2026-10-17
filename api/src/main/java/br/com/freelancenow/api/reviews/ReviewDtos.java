package br.com.freelancenow.api.reviews;

import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.UUID;

public final class ReviewDtos {
    private ReviewDtos() {}

    public record CreateReview(
            @NotNull @Min(1) @Max(5) Integer rating, @Size(max = 500) String comment) {}

    public record ReplyReview(@NotBlank @Size(max = 200) String reply) {}

    public record ReviewView(
            UUID id,
            UUID contractId,
            UUID serviceId,
            String serviceTitle,
            UUID freelancerId,
            UUID clientId,
            String clientName,
            int rating,
            String comment,
            String reply,
            Instant repliedAt,
            Instant createdAt) {
        public static ReviewView from(Review r) {
            return new ReviewView(
                    r.getId(),
                    r.getContract().getId(),
                    r.getService().getId(),
                    r.getContract().getTitle(),
                    r.getFreelancer().getId(),
                    r.getClient().getId(),
                    r.getClient().getName(),
                    r.getRating(),
                    r.getComment(),
                    r.getReply(),
                    r.getRepliedAt(),
                    r.getCreatedAt());
        }
    }
}
