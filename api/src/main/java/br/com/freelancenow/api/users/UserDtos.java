package br.com.freelancenow.api.users;

import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class UserDtos {
    private UserDtos() {}

    public record Me(
            UUID id,
            String name,
            String email,
            String phone,
            Role role,
            String city,
            String bio,
            String serviceArea,
            Long avatarVersion,
            Instant createdAt) {
        public static Me from(User u) {
            return new Me(
                    u.getId(),
                    u.getName(),
                    u.getEmail(),
                    u.getPhone(),
                    u.getRole(),
                    u.getCity(),
                    u.getBio(),
                    u.getServiceArea(),
                    u.getAvatarVersion(),
                    u.getCreatedAt());
        }
    }

    /**
     * What anyone can see about a freelancer. {@code specialties} are the categories of the
     * freelancer's active services; it is empty where it is not computed (e.g. inside a service).
     */
    public record PublicProfile(
            UUID id,
            String name,
            Role role,
            String city,
            String bio,
            Double averageRating,
            long reviewCount,
            String serviceArea,
            Long avatarVersion,
            Instant memberSince,
            List<String> specialties) {
        public static PublicProfile from(User u) {
            return from(u, null, 0L);
        }

        public static PublicProfile from(User u, Double averageRating, long reviewCount) {
            return from(u, averageRating, reviewCount, List.of());
        }

        public static PublicProfile from(
                User u, Double averageRating, long reviewCount, List<String> specialties) {
            return new PublicProfile(
                    u.getId(),
                    u.getName(),
                    u.getRole(),
                    u.getCity(),
                    u.getBio(),
                    averageRating,
                    reviewCount,
                    u.getServiceArea(),
                    u.getAvatarVersion(),
                    u.getCreatedAt(),
                    specialties);
        }
    }

    public record UpdateProfile(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Pattern(regexp = "\\+?[0-9 ()-]{10,20}") String phone,
            @NotBlank @Size(max = 100) String city,
            @NotNull @Size(max = 600) String bio,
            @Size(max = 150) String serviceArea) {}

    public record DeleteAccount(@NotBlank @Size(max = 72) String password) {}
}
