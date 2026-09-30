package br.com.freelancenow.api.auth;

import br.com.freelancenow.api.users.*;

import jakarta.validation.constraints.*;

public final class AuthDtos {
    private AuthDtos() {}

    public record Register(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank
                    @Size(min = 8, max = 72)
                    @Pattern(
                            regexp = "(?s)^(?=.*\\p{L})(?=.*\\d).{8,72}$",
                            message = "Use pelo menos 8 caracteres com letras e números.")
                    String password,
            @NotBlank @Pattern(regexp = "\\+?[0-9 ()-]{10,20}") String phone,
            @NotNull Role role,
            @NotNull @AssertTrue Boolean acceptedTerms) {}

    public record Login(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 72) String password) {}

    public record Session(String accessToken, String tokenType, long expiresIn, UserDtos.Me user) {}
}
