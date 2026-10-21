package br.com.freelancenow.api.users;

import jakarta.validation.constraints.*;

import java.util.UUID;

public final class UserDtos {
    private UserDtos() {}

    public record Me(
            UUID id, String name, String email, String phone, Role role, String city, String bio) {
        public static Me from(User u) {
            return new Me(
                    u.getId(),
                    u.getName(),
                    u.getEmail(),
                    u.getPhone(),
                    u.getRole(),
                    u.getCity(),
                    u.getBio());
        }
    }

    public record PublicProfile(
            UUID id,
            String name,
            Role role,
            String city,
            String bio,
            Double averageRating,
            long reviewCount) {
        public static PublicProfile from(User u) {
            return from(u, null, 0L);
        }

        public static PublicProfile from(User u, Double averageRating, long reviewCount) {
            return new PublicProfile(
                    u.getId(),
                    u.getName(),
                    u.getRole(),
                    u.getCity(),
                    u.getBio(),
                    averageRating,
                    reviewCount);
        }
    }

    public record UpdateProfile(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Pattern(regexp = "\\+?[0-9 ()-]{10,20}") String phone,
            @NotBlank @Size(max = 100) String city,
            @NotNull @Size(max = 600) String bio) {}
}
