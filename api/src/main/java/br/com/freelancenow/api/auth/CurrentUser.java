package br.com.freelancenow.api.auth;

import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.users.*;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class CurrentUser {
    private final UserRepository users;

    public CurrentUser(UserRepository users) {
        this.users = users;
    }

    public User require(Jwt jwt) {
        var u =
                users.findById(UUID.fromString(jwt.getSubject()))
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.UNAUTHORIZED,
                                                "Entre novamente para continuar."));
        if (!u.isActive())
            throw new ApiException(HttpStatus.FORBIDDEN, "Esta conta está suspensa.");
        return u;
    }
}
