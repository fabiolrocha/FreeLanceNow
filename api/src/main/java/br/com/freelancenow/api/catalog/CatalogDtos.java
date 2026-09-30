package br.com.freelancenow.api.catalog;

import br.com.freelancenow.api.users.UserDtos;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.*;

public final class CatalogDtos {
    private CatalogDtos() {}

    public record CategoryView(UUID id, String name, String slug) {
        public static CategoryView from(Category c) {
            return new CategoryView(c.getId(), c.getName(), c.getSlug());
        }
    }

    public record SaveService(
            @NotBlank @Size(max = 80) String title,
            @NotBlank @Size(max = 500) String description,
            @NotNull UUID categoryId,
            @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal price,
            @NotNull @Min(1) @Max(365) Integer deliveryDays,
            @NotNull ServiceStatus status) {}

    public record ChangeStatus(@NotNull ServiceStatus status) {}

    public record ServiceView(
            UUID id,
            String title,
            String description,
            BigDecimal price,
            int deliveryDays,
            ServiceStatus status,
            CategoryView category,
            UserDtos.PublicProfile freelancer) {
        public static ServiceView from(ServiceListing s) {
            return new ServiceView(
                    s.getId(),
                    s.getTitle(),
                    s.getDescription(),
                    s.getPrice(),
                    s.getDeliveryDays(),
                    s.getStatus(),
                    CategoryView.from(s.getCategory()),
                    UserDtos.PublicProfile.from(s.getFreelancer()));
        }
    }

    public record PageView<T>(
            List<T> items, int page, int size, long totalElements, int totalPages) {}
}
