package br.com.freelancenow.api.auth;

import br.com.freelancenow.api.users.*;

import jakarta.validation.constraints.*;

public final class AuthDtos {
    private AuthDtos() {}

    static final String PHONE_PATTERN = "\\+?[0-9 ()-]{10,20}";
    static final String PASSWORD_PATTERN = "(?s)^(?=.*\\p{L})(?=.*\\d).{8,72}$";
    static final String PASSWORD_MESSAGE = "Use pelo menos 8 caracteres com letras e números.";

    public record Register(
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank
                    @Size(min = 8, max = 72)
                    @Pattern(regexp = PASSWORD_PATTERN, message = PASSWORD_MESSAGE)
                    String password,
            @NotBlank @Pattern(regexp = PHONE_PATTERN) String phone,
            @NotNull Role role,
            @NotNull @AssertTrue Boolean acceptedTerms) {}

    public record Login(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 72) String password) {}

    public record Refresh(@NotBlank @Size(max = 2048) String refreshToken) {}

    public record ForgotPassword(@NotBlank @Email @Size(max = 254) String email) {}

    public record ResetPassword(
            @NotBlank @Size(max = 2048) String token,
            @NotBlank
                    @Size(min = 8, max = 72)
                    @Pattern(regexp = PASSWORD_PATTERN, message = PASSWORD_MESSAGE)
                    String password) {}

    public record ChangePassword(
            @NotBlank @Size(max = 72) String currentPassword,
            @NotBlank
                    @Size(min = 8, max = 72)
                    @Pattern(regexp = PASSWORD_PATTERN, message = PASSWORD_MESSAGE)
                    String newPassword) {}

    public record VerifyEmail(@NotBlank @Size(max = 4096) String token) {}

    public record Session(
            String accessToken,
            String tokenType,
            long expiresIn,
            String refreshToken,
            long refreshExpiresIn,
            UserDtos.Me user) {}
}
