package br.com.freelancenow.api.users;

import br.com.freelancenow.api.auth.AuthDtos;
import br.com.freelancenow.api.auth.AuthService;
import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.catalog.ServiceRepository;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.reviews.ReviewService;

import jakarta.validation.Valid;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;

import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class UserController {
    private final CurrentUser current;
    private final UserRepository users;
    private final ReviewService reviews;
    private final AuthService auth;
    private final AccountService account;
    private final ServiceRepository services;

    public UserController(
            CurrentUser current,
            UserRepository users,
            ReviewService reviews,
            AuthService auth,
            AccountService account,
            ServiceRepository services) {
        this.current = current;
        this.users = users;
        this.reviews = reviews;
        this.auth = auth;
        this.account = account;
        this.services = services;
    }

    @GetMapping("/users/me")
    public UserDtos.Me me(@AuthenticationPrincipal Jwt jwt) {
        return UserDtos.Me.from(current.require(jwt));
    }

    @PutMapping("/users/me")
    @Transactional
    public UserDtos.Me update(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UserDtos.UpdateProfile r) {
        var u = current.require(jwt);
        u.updateProfile(
                r.name().trim(),
                r.phone(),
                r.city().trim(),
                r.bio().trim(),
                r.serviceArea() == null ? "" : r.serviceArea().trim());
        return UserDtos.Me.from(u);
    }

    @PutMapping(value = "/users/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UserDtos.Me uploadAvatar(
            @AuthenticationPrincipal Jwt jwt, @RequestPart("file") MultipartFile file) {
        return account.uploadAvatar(current.require(jwt), file);
    }

    @DeleteMapping("/users/me/avatar")
    public UserDtos.Me deleteAvatar(@AuthenticationPrincipal Jwt jwt) {
        return account.deleteAvatar(current.require(jwt));
    }

    /** Public, like service photos: an {@code <img>} cannot send the token. */
    @GetMapping("/users/{id}/avatar")
    public ResponseEntity<byte[]> avatar(@PathVariable UUID id) {
        var avatar = account.avatar(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(avatar.getContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Disposition", "inline")
                .body(avatar.getData());
    }

    @DeleteMapping("/users/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UserDtos.DeleteAccount r) {
        account.deleteAccount(current.require(jwt), r.password());
    }

    /** Sends a new e-mail confirmation link; does nothing once the address is confirmed. */
    @PostMapping("/users/me/email-verification")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void resendVerification(@AuthenticationPrincipal Jwt jwt) {
        auth.resendVerification(current.require(jwt));
    }

    /** Changes the password and returns a fresh session; older refresh tokens stop working. */
    @PutMapping("/users/me/password")
    public AuthDtos.Session changePassword(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AuthDtos.ChangePassword r) {
        return auth.changePassword(current.require(jwt), r);
    }

    @GetMapping("/freelancers")
    public List<UserDtos.PublicProfile> freelancers() {
        var items = users.findByRoleAndActiveTrue(Role.FREELANCER);
        var ids = items.stream().map(User::getId).toList();
        var stats = reviews.ratingSummaries(ids);
        var specialties = specialties(ids);
        return items.stream()
                .map(
                        u -> {
                            var s =
                                    stats.getOrDefault(
                                            u.getId(), ReviewService.RatingSummary.EMPTY);
                            return UserDtos.PublicProfile.from(
                                    u,
                                    s.averageRating(),
                                    s.reviewCount(),
                                    specialties.getOrDefault(u.getId(), List.of()));
                        })
                .toList();
    }

    @GetMapping("/freelancers/{id}")
    public UserDtos.PublicProfile freelancer(@PathVariable UUID id) {
        var u =
                users.findById(id)
                        .filter(x -> x.isActive() && x.getRole() == Role.FREELANCER)
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.NOT_FOUND,
                                                "Profissional não encontrado."));
        var s = reviews.ratingSummary(u.getId());
        return UserDtos.PublicProfile.from(
                u,
                s.averageRating(),
                s.reviewCount(),
                specialties(List.of(u.getId())).getOrDefault(u.getId(), List.of()));
    }

    private Map<UUID, List<String>> specialties(List<UUID> ids) {
        if (ids.isEmpty()) return Map.of();
        var result = new HashMap<UUID, List<String>>();
        for (var row : services.activeCategories(ids))
            result.computeIfAbsent((UUID) row[0], k -> new ArrayList<>()).add((String) row[1]);
        result.values().forEach(Collections::sort);
        return result;
    }
}
