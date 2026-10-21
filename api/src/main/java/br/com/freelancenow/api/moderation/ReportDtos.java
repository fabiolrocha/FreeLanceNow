package br.com.freelancenow.api.moderation;

import jakarta.validation.constraints.*;

import java.util.UUID;

public final class ReportDtos {
    private ReportDtos() {}

    public record Create(
            @NotNull ContentReport.Target targetType,
            @NotNull UUID targetId,
            @NotBlank @Size(max = 80) String reason,
            @NotBlank @Size(min = 40, max = 1000) String comment) {}

    public record Decision(
            @NotNull ContentReport.Status status, @NotBlank @Size(max = 1000) String note) {}
}
