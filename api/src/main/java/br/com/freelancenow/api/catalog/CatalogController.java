package br.com.freelancenow.api.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class CatalogController {
    private final CatalogService catalog;

    public CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/categories")
    public List<CatalogDtos.CategoryView> categories() {
        return catalog.categories();
    }

    @GetMapping("/services")
    public CatalogDtos.PageView<CatalogDtos.ServiceView> search(
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) @Size(max = 100) String city,
            @RequestParam(required = false) @DecimalMin("0") BigDecimal minPrice,
            @RequestParam(required = false) @DecimalMin("0") BigDecimal maxPrice,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "12") @Min(1) @Max(50) int size) {
        return catalog.search(q, categoryId, city, minPrice, maxPrice, page, size);
    }

    @GetMapping("/services/{id}")
    public CatalogDtos.ServiceView detail(@PathVariable UUID id) {
        return catalog.detail(id);
    }

    @GetMapping("/freelancer/services")
    @PreAuthorize("hasRole('FREELANCER')")
    public List<CatalogDtos.ServiceView> mine(@AuthenticationPrincipal Jwt jwt) {
        return catalog.mine(jwt);
    }

    @PostMapping("/services")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('FREELANCER')")
    public CatalogDtos.ServiceView create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CatalogDtos.SaveService r) {
        return catalog.create(jwt, r);
    }

    @PutMapping("/services/{id}")
    @PreAuthorize("hasRole('FREELANCER')")
    public CatalogDtos.ServiceView update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody CatalogDtos.SaveService r) {
        return catalog.update(jwt, id, r);
    }

    @PatchMapping("/services/{id}/status")
    @PreAuthorize("hasRole('FREELANCER')")
    public CatalogDtos.ServiceView status(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody CatalogDtos.ChangeStatus r) {
        return catalog.status(jwt, id, r.status());
    }
}
