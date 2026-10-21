package br.com.freelancenow.api.admin;

import br.com.freelancenow.api.catalog.Category;
import br.com.freelancenow.api.users.*;

import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.UUID;

public final class AdminDtos {
    private AdminDtos() {}

    public record UserView(
            UUID id,
            String name,
            String email,
            String phone,
            Role role,
            boolean active,
            String city,
            String bio,
            Instant createdAt) {
        public static UserView from(User u) {
            return new UserView(
                    u.getId(),
                    u.getName(),
                    u.getEmail(),
                    u.getPhone(),
                    u.getRole(),
                    u.isActive(),
                    u.getCity(),
                    u.getBio(),
                    u.getCreatedAt());
        }
    }

    public record UserStatus(@NotNull Boolean active, @NotBlank @Size(max = 1000) String reason) {}

    public record CreateCategory(@NotBlank @Size(max = 80) String name) {}

    public record UpdateCategory(@NotBlank @Size(max = 80) String name, @NotNull Boolean active) {}

    public record CategoryView(UUID id, String name, String slug, boolean active) {
        public static CategoryView from(Category c) {
            return new CategoryView(c.getId(), c.getName(), c.getSlug(), c.isActive());
        }
    }
}
