package br.com.freelancenow.api.demands;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class DemandController {
    private final DemandService demands;

    public DemandController(DemandService demands) {
        this.demands = demands;
    }

    @GetMapping("/demands")
    public List<DemandDtos.DemandView> listDemands(@AuthenticationPrincipal Jwt jwt) {
        return demands.listDemands(jwt);
    }

    @GetMapping("/demands/{id}")
    public DemandDtos.DemandView getDemand(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return demands.getDemand(jwt, id);
    }

    @PostMapping("/demands")
    @ResponseStatus(HttpStatus.CREATED)
    public DemandDtos.DemandView createDemand(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DemandDtos.CreateDemand request) {
        return demands.createDemand(jwt, request);
    }

    @GetMapping("/proposals")
    public List<DemandDtos.ProposalView> listProposals(@AuthenticationPrincipal Jwt jwt) {
        return demands.listProposals(jwt);
    }

    @GetMapping("/demands/{id}/proposals")
    public List<DemandDtos.ProposalView> listProposalsByDemand(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return demands.listProposalsByDemand(jwt, id);
    }

    @PostMapping("/demands/{id}/proposals")
    @ResponseStatus(HttpStatus.CREATED)
    public DemandDtos.ProposalView createProposal(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody DemandDtos.CreateProposal request) {
        return demands.createProposal(jwt, id, request);
    }

    @PostMapping("/proposals/{id}/accept")
    public DemandDtos.ProposalAcceptance acceptProposal(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return demands.acceptProposal(jwt, id);
    }

    @PostMapping("/proposals/{id}/reject")
    public DemandDtos.ProposalView rejectProposal(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return demands.rejectProposal(jwt, id);
    }
}
