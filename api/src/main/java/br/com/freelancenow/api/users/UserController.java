package br.com.freelancenow.api.users;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.common.ApiException;

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

    public UserController(CurrentUser current, UserRepository users) {
        this.current = current;
        this.users = users;
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

    @GetMapping("/freelancers")
    public List<UserDtos.PublicProfile> freelancers() {
        return users.findByRoleAndActiveTrue(Role.FREELANCER).stream()
                .map(UserDtos.PublicProfile::from)
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
        return UserDtos.PublicProfile.from(u);
    }
}
