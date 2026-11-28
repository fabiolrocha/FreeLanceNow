package br.com.freelancenow.api.auth;

import br.com.freelancenow.api.users.AccountService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = "/api/v1/auth/google", consumes = MediaType.APPLICATION_JSON_VALUE)
class GoogleAuthController {
    private final GoogleAuthService auth;
    private final GoogleIdTokens google;
    private final CurrentUser current;
    private final AccountService account;

    GoogleAuthController(
            GoogleAuthService auth,
            GoogleIdTokens google,
            CurrentUser current,
            AccountService account) {
        this.auth = auth;
        this.google = google;
        this.current = current;
        this.account = account;
    }

    @PostMapping
    GoogleAuthDtos.Result signIn(@Valid @RequestBody GoogleAuthDtos.Credential request) {
        return auth.signIn(google.verify(request.credential(), request.verifier()));
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    AuthDtos.Session register(@Valid @RequestBody GoogleAuthDtos.Register request) {
        return auth.register(google.verify(request.credential(), request.verifier()), request);
    }

    @PostMapping("/link")
    AuthDtos.Session link(@Valid @RequestBody GoogleAuthDtos.Link request) {
        return auth.link(google.verify(request.credential(), request.verifier()), request);
    }

    @PostMapping("/delete-account")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteAccount(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody GoogleAuthDtos.Credential request) {
        var user = current.require(jwt);
        var identity = google.verifyDeletion(request.credential(), request.verifier());
        account.deleteAccountWithGoogle(user, identity.subject());
    }
}
