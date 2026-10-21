package br.com.freelancenow.api.admin;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {
    private final AdminService admin;

    public AdminController(AdminService admin) {
        this.admin = admin;
    }

    @GetMapping("/users")
    public List<AdminDtos.UserView> users(@AuthenticationPrincipal Jwt jwt) {
        return admin.users(jwt);
    }

    @PatchMapping("/users/{id}/status")
    public AdminDtos.UserView status(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody AdminDtos.UserStatus r) {
        return admin.status(jwt, id, r);
    }

    @GetMapping("/categories")
    public List<AdminDtos.CategoryView> categories(@AuthenticationPrincipal Jwt jwt) {
        return admin.categories(jwt);
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDtos.CategoryView create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AdminDtos.CreateCategory r) {
        return admin.create(jwt, r);
    }

    @PutMapping("/categories/{id}")
    public AdminDtos.CategoryView update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody AdminDtos.UpdateCategory r) {
        return admin.update(jwt, id, r);
    }

    @GetMapping("/metrics")
    public Map<String, Long> metrics(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false)
                    @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
                    java.time.LocalDate from,
            @RequestParam(required = false)
                    @org.springframework.format.annotation.DateTimeFormat(
                            iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE)
                    java.time.LocalDate to) {
        return admin.metrics(jwt, from, to);
    }

    @GetMapping("/audit")
    public List<AuditEvent.View> audit(@AuthenticationPrincipal Jwt jwt) {
        return admin.audit(jwt);
    }
}
