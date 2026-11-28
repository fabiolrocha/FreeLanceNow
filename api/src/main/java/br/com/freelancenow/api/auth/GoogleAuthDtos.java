package br.com.freelancenow.api.auth;

import br.com.freelancenow.api.users.Role;

import jakarta.validation.constraints.*;

final class GoogleAuthDtos {
    private static final String VERIFIER = "[A-Za-z0-9_-]{43}";

    private GoogleAuthDtos() {}

    record Credential(
            @NotBlank @Size(max = 4096) String credential,
            @NotBlank @Pattern(regexp = VERIFIER) String verifier) {}

    record Register(
            @NotBlank @Size(max = 4096) String credential,
            @NotBlank @Pattern(regexp = VERIFIER) String verifier,
            @NotBlank @Size(max = 100) String name,
            @NotBlank @Pattern(regexp = AuthDtos.PHONE_PATTERN) String phone,
            @NotNull Role role,
            @NotNull @AssertTrue Boolean acceptedTerms) {}

    record Link(
            @NotBlank @Size(max = 4096) String credential,
            @NotBlank @Pattern(regexp = VERIFIER) String verifier,
            @NotBlank @Size(max = 72) String password) {}

    enum Next {
        SIGNED_IN,
        REGISTER,
        LINK
    }

    record Result(Next next, AuthDtos.Session session, String email, String name) {}
}
