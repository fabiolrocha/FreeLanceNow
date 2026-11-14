package br.com.freelancenow.api.auth;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthDtos.Session register(@Valid @RequestBody AuthDtos.Register request) {
        return auth.register(request);
    }

    @PostMapping("/login")
    public AuthDtos.Session login(@Valid @RequestBody AuthDtos.Login request) {
        return auth.login(request);
    }

    @PostMapping("/refresh")
    public AuthDtos.Session refresh(@Valid @RequestBody AuthDtos.Refresh request) {
        return auth.refresh(request);
    }

    @PostMapping("/password/forgot")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void forgotPassword(@Valid @RequestBody AuthDtos.ForgotPassword request) {
        auth.forgotPassword(request);
    }

    @PostMapping("/email/verify")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verifyEmail(@Valid @RequestBody AuthDtos.VerifyEmail request) {
        auth.verifyEmail(request);
    }

    @PostMapping("/password/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody AuthDtos.ResetPassword request) {
        auth.resetPassword(request);
    }
}
