package br.com.freelancenow.api.admin;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.users.*;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class AdminAccess {
    private final CurrentUser current;

    public AdminAccess(CurrentUser current) {
        this.current = current;
    }

    public User require(Jwt jwt) {
        var u = current.require(jwt);
        if (u.getRole() != Role.ADMIN)
            throw new ApiException(HttpStatus.FORBIDDEN, "Acesso exclusivo de administradores.");
        return u;
    }
}
