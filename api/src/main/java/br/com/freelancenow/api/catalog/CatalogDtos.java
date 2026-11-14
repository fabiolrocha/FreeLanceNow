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

    public record ImageView(UUID id, String contentType) {
        public static ImageView from(ServiceImageSummary i) {
            return new ImageView(i.id(), i.contentType());
        }
    }

    public record ServiceView(
            UUID id,
            String title,
            String description,
            BigDecimal price,
            int deliveryDays,
            ServiceStatus status,
            boolean moderated,
            CategoryView category,
            UserDtos.PublicProfile freelancer,
            List<ImageView> images) {
        public static ServiceView from(
                ServiceListing s, Double averageRating, long reviewCount, List<ImageView> images) {
            return new ServiceView(
                    s.getId(),
                    s.getTitle(),
                    s.getDescription(),
                    s.getPrice(),
                    s.getDeliveryDays(),
                    s.getStatus(),
                    s.isModerated(),
                    CategoryView.from(s.getCategory()),
                    UserDtos.PublicProfile.from(s.getFreelancer(), averageRating, reviewCount),
                    List.copyOf(images));
        }
    }

    public record PageView<T>(
            List<T> items, int page, int size, long totalElements, int totalPages) {}
}
