package br.com.freelancenow.api.contracts;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/contracts")
public class ContractController {
    private final ContractService contracts;

    public ContractController(ContractService contracts) {
        this.contracts = contracts;
    }

    @GetMapping
    public List<ContractDtos.ContractView> list(@AuthenticationPrincipal Jwt jwt) {
        return contracts.list(jwt);
    }

    @GetMapping("/{id}")
    public ContractDtos.ContractView detail(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return contracts.detail(jwt, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('CLIENT')")
    public ContractDtos.ContractView create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ContractDtos.CreateContract r) {
        return contracts.create(jwt, r);
    }

    @PatchMapping("/{id}/status")
    public ContractDtos.ContractView transition(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ContractDtos.TransitionContract r) {
        return contracts.transition(jwt, id, r);
    }
}
