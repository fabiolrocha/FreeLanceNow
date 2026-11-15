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
import br.com.freelancenow.api.notifications.NotificationService;
import br.com.freelancenow.api.reviews.ReviewService;
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
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final NotificationService notifications;
    private final ReviewService reviews;

    public DemandService(
            DemandRepository demands,
            ProposalRepository proposals,
            CategoryRepository categories,
            ContractRepository contracts,
            ContractEventRepository contractEvents,
            CurrentUser current,
            Clock clock,
            NotificationService notifications,
            ReviewService reviews) {
        this.notifications = notifications;
        this.reviews = reviews;
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
        var counts = new java.util.HashMap<UUID, Long>();
        for (var row : proposals.countActiveByDemand()) counts.put((UUID) row[0], (Long) row[1]);
        return items.stream()
                .map(d -> DemandDtos.DemandView.from(d, counts.getOrDefault(d.getId(), 0L)))
                .toList();
    }

    public DemandDtos.DemandView getDemand(Jwt jwt, UUID id) {
        var u = current.require(jwt);
        var d = demands.findWithDetailsById(id).orElseThrow(this::demandNotFound);
        ensureCanViewDemand(u, d);
        return DemandDtos.DemandView.from(d, proposals.countActive(d.getId()));
    }

    @Transactional
    public DemandDtos.DemandView createDemand(Jwt jwt, DemandDtos.CreateDemand r) {
        var u = current.require(jwt);
        if (u.getRole() != Role.CLIENT)
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Somente clientes podem publicar demandas.");
        Category category = activeCategory(r.categoryId());
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
        return DemandDtos.DemandView.from(saved, 0);
    }

    /** The owner edits an open demand only before anyone has answered it. */
    @Transactional
    public DemandDtos.DemandView updateDemand(Jwt jwt, UUID id, DemandDtos.CreateDemand r) {
        var u = current.require(jwt);
        var d = ownedOpenDemand(u, id);
        if (proposals.existsByDemandId(d.getId()))
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "A demanda já recebeu propostas e não pode mais ser editada. Cancele-a e"
                            + " publique outra, se precisar mudar o pedido.");
        d.update(
                activeCategory(r.categoryId()),
                r.title(),
                r.description(),
                r.budget(),
                r.days(),
                r.city());
        return DemandDtos.DemandView.from(d, proposals.countActive(d.getId()));
    }

    /** Cancels an open demand and declines its pending proposals. */
    @Transactional
    public DemandDtos.DemandView cancelDemand(Jwt jwt, UUID id) {
        var u = current.require(jwt);
        var d = ownedOpenDemand(u, id);
        var now = Instant.now(clock);
        for (var p : proposals.findByDemandIdOrderByCreatedAtAsc(d.getId())) {
            if (p.getStatus() != ProposalStatus.PENDING) continue;
            p.reject(now);
            notifications.notify(
                    p.getFreelancer(),
                    "PROPOSAL_REJECTED",
                    "Demanda cancelada: " + d.getTitle(),
                    "O cliente cancelou a demanda e não vai contratar por ela.",
                    "/propostas");
        }
        d.cancel(now);
        return DemandDtos.DemandView.from(d, proposals.countActive(d.getId()));
    }

    /** The freelancer takes back a proposal the client has not decided yet. */
    @Transactional
    public DemandDtos.ProposalView withdrawProposal(Jwt jwt, UUID proposalId) {
        var u = current.require(jwt);
        var p = proposals.lockById(proposalId).orElseThrow(this::proposalNotFound);
        if (u.getRole() != Role.FREELANCER || !p.getFreelancer().getId().equals(u.getId()))
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Somente o autor pode retirar a proposta.");
        var d = demands.lockById(p.getDemand().getId()).orElseThrow(this::demandNotFound);
        if (p.getStatus() != ProposalStatus.PENDING || d.getStatus() != DemandStatus.OPEN)
            throw new ApiException(
                    HttpStatus.CONFLICT, "Somente propostas aguardando decisão podem ser retiradas.");
        p.withdraw(Instant.now(clock));
        notifications.notify(
                d.getClient(),
                "PROPOSAL_WITHDRAWN",
                "Proposta retirada: " + d.getTitle(),
                u.getName() + " retirou a proposta enviada.",
                "/demandas/" + d.getId());
        return views(List.of(p)).getFirst();
    }

    public List<DemandDtos.ProposalView> listProposals(Jwt jwt) {
        var u = current.require(jwt);
        List<Proposal> items =
                switch (u.getRole()) {
                    case CLIENT -> proposals.findByDemandClientIdOrderByCreatedAtAsc(u.getId());
                    case FREELANCER -> proposals.findByFreelancerIdOrderByCreatedAtAsc(u.getId());
                    case ADMIN -> proposals.findAllByOrderByCreatedAtAsc();
                };
        return views(items);
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
        return views(items);
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
        notifications.notify(
                d.getClient(),
                "PROPOSAL_RECEIVED",
                "Nova proposta: " + d.getTitle(),
                u.getName() + " enviou uma proposta para sua demanda.",
                "/demandas/" + d.getId());
        return views(List.of(saved)).getFirst();
    }

    @Transactional
    public DemandDtos.ProposalAcceptance acceptProposal(
            Jwt jwt, UUID proposalId, DemandDtos.AcceptProposal r) {
        var u = current.require(jwt);
        var p = proposals.lockById(proposalId).orElseThrow(this::proposalNotFound);
        var d = demands.lockById(p.getDemand().getId()).orElseThrow(this::demandNotFound);
        if (u.getRole() != Role.CLIENT || !d.getClient().getId().equals(u.getId()))
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "Somente o cliente que publicou a demanda pode aceitar propostas.");
        if (d.getStatus() != DemandStatus.OPEN || p.getStatus() != ProposalStatus.PENDING)
            throw new ApiException(HttpStatus.CONFLICT, "Esta proposta não pode ser aceita.");
        var today = LocalDate.now(clock.withZone(BRAZIL_ZONE));
        var date = r == null ? null : r.date();
        if (date != null && !date.isAfter(today))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Selecione uma data futura.");
        var now = Instant.now(clock);
        p.accept(now);
        var allProposals = proposals.findByDemandIdOrderByCreatedAtAsc(d.getId());
        for (var other : allProposals) {
            if (!other.getId().equals(p.getId()) && other.getStatus() == ProposalStatus.PENDING) {
                other.reject(now);
                notifications.notify(
                        other.getFreelancer(),
                        "PROPOSAL_REJECTED",
                        "Proposta não selecionada: " + d.getTitle(),
                        "O cliente escolheu outra proposta.",
                        "/demandas/" + d.getId());
            }
        }
        d.close(now);

        var scheduledDate = date != null ? date : today.plusDays(p.getDays());
        var contract =
                contracts.save(
                        new Contract(d, p, scheduledDate, r == null ? null : r.address(), now));
        String note = p.getMessage().trim();
        if (note.length() > 500) note = note.substring(0, 500);
        var event =
                contractEvents.save(
                        new ContractEvent(
                                contract, u, null, ContractStatus.ACEITO, note, now));
        notifications.notify(
                p.getFreelancer(),
                "PROPOSAL_ACCEPTED",
                "Proposta aceita: " + d.getTitle(),
                "A contratação foi criada e já está aceita.",
                "/contratacoes/" + contract.getId());
        return new DemandDtos.ProposalAcceptance(
                DemandDtos.DemandView.from(d, proposals.countActive(d.getId())),
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
        notifications.notify(
                p.getFreelancer(),
                "PROPOSAL_REJECTED",
                "Proposta recusada: " + d.getTitle(),
                "O cliente recusou sua proposta.",
                "/demandas/" + d.getId());
        return views(List.of(p)).getFirst();
    }

    private List<DemandDtos.ProposalView> views(List<Proposal> items) {
        if (items.isEmpty()) return List.of();
        var ratings =
                reviews.ratingSummaries(
                        items.stream().map(p -> p.getFreelancer().getId()).distinct().toList());
        var accepted =
                items.stream()
                        .filter(p -> p.getStatus() == ProposalStatus.ACCEPTED)
                        .map(Proposal::getId)
                        .toList();
        Map<UUID, UUID> contractByProposal =
                accepted.isEmpty()
                        ? Map.of()
                        : contracts.findByProposalIdIn(accepted).stream()
                                .collect(
                                        Collectors.toMap(
                                                c -> c.getProposal().getId(), Contract::getId));
        return items.stream()
                .map(
                        p -> {
                            var s =
                                    ratings.getOrDefault(
                                            p.getFreelancer().getId(),
                                            ReviewService.RatingSummary.EMPTY);
                            return DemandDtos.ProposalView.from(
                                    p,
                                    s.averageRating(),
                                    s.reviewCount(),
                                    contractByProposal.get(p.getId()));
                        })
                .toList();
    }

    private Demand ownedOpenDemand(User u, UUID id) {
        var d = demands.lockById(id).orElseThrow(this::demandNotFound);
        if (u.getRole() != Role.CLIENT || !d.getClient().getId().equals(u.getId()))
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Somente o cliente que publicou a demanda pode alterá-la.");
        if (d.getStatus() != DemandStatus.OPEN)
            throw new ApiException(HttpStatus.CONFLICT, "Esta demanda já foi encerrada.");
        return d;
    }

    private Category activeCategory(UUID id) {
        return categories
                .findById(id)
                .filter(Category::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Categoria inválida."));
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
