package br.com.freelancenow.api.moderation;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class ReportController {
    private final ModerationService moderation;

    public ReportController(ModerationService moderation) {
        this.moderation = moderation;
    }

    @PostMapping("/reports")
    @ResponseStatus(HttpStatus.CREATED)
    public ContentReport.View create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ReportDtos.Create r) {
        return moderation.create(jwt, r);
    }

    @GetMapping("/admin/reports")
    public List<ContentReport.View> list(@AuthenticationPrincipal Jwt jwt) {
        return moderation.list(jwt);
    }

    @PatchMapping("/admin/reports/{id}")
    public ContentReport.View decide(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ReportDtos.Decision r) {
        return moderation.decide(jwt, id, r);
    }
}
