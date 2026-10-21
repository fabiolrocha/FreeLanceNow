package br.com.freelancenow.api.feed;

import br.com.freelancenow.api.catalog.CatalogDtos;

import jakarta.validation.Valid;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/feed")
public class FeedController {
    private final FeedService feed;

    public FeedController(FeedService feed) {
        this.feed = feed;
    }

    @GetMapping
    public CatalogDtos.PageView<FeedDtos.Item> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) FeedDtos.Kind type,
            @RequestParam(required = false) UUID categoryId) {
        return feed.list(jwt, page, size, type, categoryId);
    }

    @PostMapping("/posts")
    public FeedDtos.Item create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody FeedDtos.Create r) {
        return feed.create(jwt, r);
    }

    @PatchMapping("/posts/{id}/hide")
    public java.util.Map<String, Boolean> hide(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        feed.hide(jwt, id);
        return java.util.Map.of("hidden", true);
    }
}
