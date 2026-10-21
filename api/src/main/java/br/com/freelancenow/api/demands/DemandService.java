package br.com.freelancenow.api.demands;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.catalog.Category;
import br.com.freelancenow.api.catalog.CategoryRepository;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.contracts.Contract;
import br.com.freelancenow.api.contracts.ContractDtos;
import br.com.freelancenow.api.contracts.ContractEvent;
import br.com.freelancenow.api.contracts.ContractEventRepository;
import br.com.freelancenow.api.contracts.ContractRepository;
import br.com.freelancenow.api.contracts.ContractStatus;
import br.com.freelancenow.api.users.Role;
import br.com.freelancenow.api.users.User;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class DemandService {
    private static final ZoneId BRAZIL_ZONE = ZoneId.of("America/Sao_Paulo");

    private final DemandRepository demands;
    private final ProposalRepository proposals;
    private final CategoryRepository categories;
    private final ContractRepository contracts;
    private final ContractEventRepository contractEvents;
    private final CurrentUser current;
    private final Clock clock;

    public DemandService(
            DemandRepository demands,
            ProposalRepository proposals,
            CategoryRepository categories,
            ContractRepository contracts,
            ContractEventRepository contractEvents,
            CurrentUser current,
            Clock clock) {
        this.demands = demands;
        this.proposals = proposals;
        this.categories = categories;
        this.contracts = contracts;
        this.contractEvents = contractEvents;
        this.current = current;
        this.clock = clock;
    }

    public List<DemandDtos.DemandView> listDemands(Jwt jwt) {
        var u = current.require(jwt);
        List<Demand> items =
                switch (u.getRole()) {
                    case CLIENT -> demands.findByClientIdOrderByCreatedAtDesc(u.getId());
                    case FREELANCER, ADMIN -> demands.findAllByOrderByCreatedAtDesc();
                };
        return items.stream().map(DemandDtos.DemandView::from).toList();
    }

    public DemandDtos.DemandView getDemand(Jwt jwt, UUID id) {
        var u = current.require(jwt);
        var d = demands.findWithDetailsById(id).orElseThrow(this::demandNotFound);
        ensureCanViewDemand(u, d);
        return DemandDtos.DemandView.from(d);
    }

    @Transactional
    public DemandDtos.DemandView createDemand(Jwt jwt, DemandDtos.CreateDemand r) {
        var u = current.require(jwt);
        if (u.getRole() != Role.CLIENT)
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Somente clientes podem publicar demandas.");
        Category category =
                categories
                        .findById(r.categoryId())
                        .filter(Category::isActive)
                        .orElseThrow(
                                () ->
                                        new ApiException(
                                                HttpStatus.BAD_REQUEST, "Categoria inválida."));
        var now = Instant.now(clock);
        var saved =
                demands.save(
                        new Demand(
                                u,
                                category,
                                r.title(),
                                r.description(),
                                r.budget(),
                                r.days(),
                                r.city(),
                                now));
        return DemandDtos.DemandView.from(saved);
    }

    public List<DemandDtos.ProposalView> listProposals(Jwt jwt) {
        var u = current.require(jwt);
        List<Proposal> items =
                switch (u.getRole()) {
                    case CLIENT -> proposals.findByDemandClientIdOrderByCreatedAtAsc(u.getId());
                    case FREELANCER -> proposals.findByFreelancerIdOrderByCreatedAtAsc(u.getId());
                    case ADMIN -> proposals.findAllByOrderByCreatedAtAsc();
                };
        return items.stream().map(DemandDtos.ProposalView::from).toList();
    }

    public List<DemandDtos.ProposalView> listProposalsByDemand(Jwt jwt, UUID demandId) {
        var u = current.require(jwt);
        var d = demands.findWithDetailsById(demandId).orElseThrow(this::demandNotFound);
        List<Proposal> items =
                switch (u.getRole()) {
                    case ADMIN -> proposals.findByDemandIdOrderByCreatedAtAsc(d.getId());
                    case CLIENT -> {
                        if (!d.getClient().getId().equals(u.getId()))
                            throw new ApiException(
                                    HttpStatus.FORBIDDEN,
                                    "Você não tem permissão para ver as propostas desta demanda.");
                        yield proposals.findByDemandIdOrderByCreatedAtAsc(d.getId());
                    }
                    case FREELANCER ->
                            proposals.findByDemandIdAndFreelancerIdOrderByCreatedAtAsc(
                                    d.getId(), u.getId());
                };
        return items.stream().map(DemandDtos.ProposalView::from).toList();
    }

    @Transactional
    public DemandDtos.ProposalView createProposal(
            Jwt jwt, UUID demandId, DemandDtos.CreateProposal r) {
        var u = current.require(jwt);
        if (u.getRole() != Role.FREELANCER)
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Somente freelancers podem enviar propostas.");
        var d = demands.lockById(demandId).orElseThrow(this::demandNotFound);
        if (d.getStatus() != DemandStatus.OPEN)
            throw new ApiException(
                    HttpStatus.CONFLICT, "Esta demanda não recebe novas propostas.");
        if (proposals.existsByDemandIdAndFreelancerIdAndStatus(
                d.getId(), u.getId(), ProposalStatus.PENDING))
            throw new ApiException(
                    HttpStatus.CONFLICT, "Você já enviou uma proposta para esta demanda.");
        var now = Instant.now(clock);
        var saved = proposals.save(new Proposal(d, u, r.price(), r.days(), r.message(), now));
        return DemandDtos.ProposalView.from(saved);
    }

    @Transactional
    public DemandDtos.ProposalAcceptance acceptProposal(Jwt jwt, UUID proposalId) {
        var u = current.require(jwt);
        var p = proposals.lockById(proposalId).orElseThrow(this::proposalNotFound);
        var d = demands.lockById(p.getDemand().getId()).orElseThrow(this::demandNotFound);
        if (u.getRole() != Role.CLIENT || !d.getClient().getId().equals(u.getId()))
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Somente o cliente que publicou a demanda pode aceitar propostas.");
        if (d.getStatus() != DemandStatus.OPEN || p.getStatus() != ProposalStatus.PENDING)
            throw new ApiException(HttpStatus.CONFLICT, "Esta proposta não pode ser aceita.");
        var now = Instant.now(clock);
        p.accept(now);
        var allProposals = proposals.findByDemandIdOrderByCreatedAtAsc(d.getId());
        for (var other : allProposals) {
            if (!other.getId().equals(p.getId()) && other.getStatus() == ProposalStatus.PENDING) {
                other.reject(now);
            }
        }
        d.close(now);

        var scheduledDate = LocalDate.now(clock.withZone(BRAZIL_ZONE)).plusDays(p.getDays());
        var contract = contracts.save(new Contract(d, p, scheduledDate, now));
        String note = p.getMessage().trim();
        if (note.length() > 500) note = note.substring(0, 500);
        var event =
                contractEvents.save(
                        new ContractEvent(
                                contract, u, null, ContractStatus.ACEITO, note, now));
        return new DemandDtos.ProposalAcceptance(
                DemandDtos.DemandView.from(d),
                DemandDtos.ProposalView.from(p),
                ContractDtos.ContractView.from(contract, List.of(event)));
    }

    @Transactional
    public DemandDtos.ProposalView rejectProposal(Jwt jwt, UUID proposalId) {
        var u = current.require(jwt);
        var p = proposals.lockById(proposalId).orElseThrow(this::proposalNotFound);
        var d = demands.lockById(p.getDemand().getId()).orElseThrow(this::demandNotFound);
        if (u.getRole() != Role.CLIENT || !d.getClient().getId().equals(u.getId()))
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Somente o cliente que publicou a demanda pode recusar propostas.");
        if (d.getStatus() != DemandStatus.OPEN || p.getStatus() != ProposalStatus.PENDING)
            throw new ApiException(HttpStatus.CONFLICT, "Esta proposta não pode ser recusada.");
        p.reject(Instant.now(clock));
        return DemandDtos.ProposalView.from(p);
    }

    private void ensureCanViewDemand(User u, Demand d) {
        boolean allowed =
                switch (u.getRole()) {
                    case ADMIN -> true;
                    case CLIENT -> d.getClient().getId().equals(u.getId());
                    case FREELANCER ->
                            d.getStatus() == DemandStatus.OPEN
                                    || proposals.existsByDemandIdAndFreelancerId(
                                            d.getId(), u.getId());
                };
        if (!allowed)
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Você não tem permissão para acessar esta demanda.");
    }

    private ApiException demandNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Demanda não encontrada.");
    }

    private ApiException proposalNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Proposta não encontrada.");
    }
}
