package br.com.freelancenow.api.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class CatalogController {
    private final CatalogService catalog;
    private final ServiceImageService images;

    public CatalogController(CatalogService catalog, ServiceImageService images) {
        this.catalog = catalog;
        this.images = images;
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
            @RequestParam(required = false) @DecimalMin("1") @DecimalMax("5") BigDecimal minRating,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "12") @Min(1) @Max(50) int size) {
        return catalog.search(q, categoryId, city, minPrice, maxPrice, minRating, page, size);
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

    @PostMapping(path = "/services/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('FREELANCER')")
    public CatalogDtos.ServiceView uploadImages(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @RequestPart(name = "files", required = false) List<MultipartFile> files) {
        return images.upload(jwt, id, files);
    }

    @DeleteMapping("/services/{id}/images/{imageId}")
    @PreAuthorize("hasRole('FREELANCER')")
    public CatalogDtos.ServiceView deleteImage(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @PathVariable UUID imageId) {
        return images.delete(jwt, id, imageId);
    }

    @GetMapping("/services/{id}/images/{imageId}")
    public ResponseEntity<byte[]> image(@PathVariable UUID id, @PathVariable UUID imageId) {
        var image = images.find(id, imageId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline")
                .body(image.getData());
    }
}
