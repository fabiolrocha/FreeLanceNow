package br.com.freelancenow.api.users;

import br.com.freelancenow.api.auth.AuthDtos;
import br.com.freelancenow.api.auth.AuthService;
import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.reviews.ReviewService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class UserController {
    private final CurrentUser current;
    private final UserRepository users;
    private final ReviewService reviews;
    private final AuthService auth;

    public UserController(
            CurrentUser current, UserRepository users, ReviewService reviews, AuthService auth) {
        this.current = current;
        this.users = users;
        this.reviews = reviews;
        this.auth = auth;
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
        u.updateProfile(r.name().trim(), r.phone(), r.city().trim(), r.bio().trim());
        return UserDtos.Me.from(u);
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
        var stats = reviews.ratingSummaries(items.stream().map(User::getId).toList());
        return items.stream()
                .map(
                        u -> {
                            var s =
                                    stats.getOrDefault(
                                            u.getId(), ReviewService.RatingSummary.EMPTY);
                            return UserDtos.PublicProfile.from(
                                    u, s.averageRating(), s.reviewCount());
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
        return UserDtos.PublicProfile.from(u, s.averageRating(), s.reviewCount());
    }
}
