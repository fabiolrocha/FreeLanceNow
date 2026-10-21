package br.com.freelancenow.api.feed;

import br.com.freelancenow.api.users.Role;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class FeedDtos {
    private FeedDtos() {}

    public enum Kind {
        UPDATE,
        SERVICE,
        DEMAND
    }

    public record Create(@NotBlank @Size(max = 500) String text, UUID categoryId, UUID serviceId) {}

    public record Author(UUID id, String name, Role role, String city) {}

    public record CategoryView(UUID id, String name) {}

    public record Item(
            UUID id,
            Kind type,
            Author author,
            String title,
            String text,
            Instant createdAt,
            CategoryView category,
            UUID serviceId,
            BigDecimal price,
            Integer days,
            String city) {}
}
