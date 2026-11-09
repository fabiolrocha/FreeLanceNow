package br.com.freelancenow.api.contracts;

import br.com.freelancenow.api.admin.AuditService;
import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.catalog.ServiceListing;
import br.com.freelancenow.api.catalog.ServiceRepository;
import br.com.freelancenow.api.catalog.ServiceStatus;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.notifications.NotificationService;
import br.com.freelancenow.api.reviews.ReviewRepository;
import br.com.freelancenow.api.users.Role;
import br.com.freelancenow.api.users.User;
import br.com.freelancenow.api.users.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ContractService {
    private static final ZoneId BRAZIL_ZONE = ZoneId.of("America/Sao_Paulo");

    private static final Map<ContractStatus, Map<Role, Set<ContractStatus>>> TRANSITIONS =
            Map.of(
                    ContractStatus.PENDENTE,
                    Map.of(
                            Role.CLIENT, Set.of(ContractStatus.CANCELADO),
                            Role.FREELANCER,
                                    Set.of(ContractStatus.ACEITO, ContractStatus.RECUSADO)),
                    ContractStatus.ACEITO,
                    Map.of(Role.FREELANCER, Set.of(ContractStatus.EM_ANDAMENTO)),
                    ContractStatus.EM_ANDAMENTO,
                    Map.of(Role.FREELANCER, Set.of(ContractStatus.AGUARDANDO_CONFIRMACAO)),
                    ContractStatus.AGUARDANDO_CONFIRMACAO,
                    Map.of(
                            Role.CLIENT,
                            Set.of(ContractStatus.CONCLUIDO, ContractStatus.EM_DISPUTA)),
                    ContractStatus.EM_DISPUTA,
                    Map.of(
                            Role.ADMIN,
                            Set.of(ContractStatus.CONCLUIDO, ContractStatus.EM_ANDAMENTO)));

    private final ContractRepository contracts;
    private final ContractEventRepository events;
    private final ReviewRepository reviews;
    private final ServiceRepository services;
    private final UserRepository users;
    private final CurrentUser current;
    private final Clock clock;
    private final AuditService audit;
    private final NotificationService notifications;

    public ContractService(
            ContractRepository contracts,
            ContractEventRepository events,
            ReviewRepository reviews,
            ServiceRepository services,
            UserRepository users,
            CurrentUser current,
            Clock clock,
            AuditService audit,
            NotificationService notifications) {
        this.contracts = contracts;
        this.events = events;
        this.reviews = reviews;
        this.services = services;
        this.users = users;
        this.current = current;
        this.clock = clock;
        this.audit = audit;
        this.notifications = notifications;
    }

    public List<ContractDtos.ContractView> list(Jwt jwt) {
        var u = current.require(jwt);
        List<Contract> items =
                switch (u.getRole()) {
                    case CLIENT -> contracts.findByClientIdOrderByCreatedAtDesc(u.getId());
                    case FREELANCER -> contracts.findByFreelancerIdOrderByCreatedAtDesc(u.getId());
                    case ADMIN -> contracts.findAllByOrderByCreatedAtDesc();
                };
        if (items.isEmpty()) return List.of();
        var ids = items.stream().map(Contract::getId).toList();
        var grouped =
                events.findByContractIdInOrderByCreatedAtAsc(ids).stream()
                        .collect(Collectors.groupingBy(e -> e.getContract().getId()));
        var reviewMap =
                reviews.findByContractIdIn(ids).stream()
                        .collect(
                                Collectors.toMap(
                                        r -> r.getContract().getId(), Function.identity()));
        return items.stream()
                .map(
                        c ->
                                ContractDtos.ContractView.from(
                                        c,
                                        grouped.getOrDefault(c.getId(), List.of()),
                                        reviewMap.get(c.getId())))
                .toList();
    }

    public ContractDtos.ContractView detail(Jwt jwt, UUID id) {
        var u = current.require(jwt);
        var c = contracts.findWithDetailsById(id).orElseThrow(this::notFound);
        ensureParticipantOrAdmin(u, c);
        return ContractDtos.ContractView.from(
                c,
                events.findByContractIdOrderByCreatedAtAsc(c.getId()),
                reviews.findByContractId(c.getId()).orElse(null));
    }

    @Transactional
    public ContractDtos.ContractView create(Jwt jwt, ContractDtos.CreateContract r) {
        var u = current.require(jwt);
        if (u.getRole() != Role.CLIENT)
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Somente clientes podem solicitar serviços.");
        var client = users.lockById(u.getId()).orElseThrow(this::notFound);
        var service = activeService(r.serviceId());
        var today = LocalDate.now(clock.withZone(BRAZIL_ZONE));
        if (!r.date().isAfter(today))
            throw new ApiException(HttpStatus.BAD_REQUEST, "Selecione uma data futura.");
        if (contracts.existsByClientIdAndServiceIdAndStatus(
                client.getId(), service.getId(), ContractStatus.PENDENTE))
            throw new ApiException(
                    HttpStatus.CONFLICT, "Você já tem uma solicitação pendente para este serviço.");
        var now = Instant.now(clock);
        var contract =
                contracts.save(
                        new Contract(service, client, r.date(), r.description(), r.address(), now));
        var initialEvent =
                events.save(
                        new ContractEvent(
                                contract,
                                client,
                                null,
                                ContractStatus.PENDENTE,
                                r.description(),
                                now));
        notifications.notify(
                contract.getFreelancer(),
                "CONTRACT_REQUESTED",
                "Nova solicitação: " + contract.getTitle(),
                client.getName() + " pediu este serviço. Responda em até 48 horas.",
                link(contract));
        return ContractDtos.ContractView.from(contract, List.of(initialEvent));
    }

    @Transactional
    public ContractDtos.ContractView transition(
            Jwt jwt, UUID id, ContractDtos.TransitionContract r) {
        var u = current.require(jwt);
        var c = contracts.lockById(id).orElseThrow(this::notFound);
        ensureParticipantOrAdmin(u, c);
        if (!canTransition(c.getStatus(), r.status(), u.getRole()))
            throw new ApiException(
                    HttpStatus.CONFLICT, "Esta mudança de status não é permitida para seu perfil.");
        if (r.status() == ContractStatus.EM_DISPUTA
                && (r.comment() == null
                        || r.comment().isBlank()
                        || r.comment().trim().length() > 300))
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Informe o motivo da contestação (até 300 caracteres).");
        var previous = c.getStatus();
        var now = Instant.now(clock);
        c.transitionTo(r.status(), r.comment(), now);
        if (u.getRole() == Role.ADMIN)
            audit.record(
                    u,
                    "DISPUTE_DECIDED",
                    "CONTRACT",
                    id,
                    previous.name(),
                    r.status().name(),
                    r.comment());
        events.save(new ContractEvent(c, u, previous, r.status(), r.comment(), now));
        var title = c.getTitle() + ": " + STATUS_LABELS.get(r.status());
        var body = u.getName() + " atualizou a contratação.";
        // Everyone involved except the person who made the change hears about it.
        if (!c.getClient().getId().equals(u.getId()))
            notifications.notify(c.getClient(), "CONTRACT_STATUS", title, body, link(c));
        if (!c.getFreelancer().getId().equals(u.getId()))
            notifications.notify(c.getFreelancer(), "CONTRACT_STATUS", title, body, link(c));
        return ContractDtos.ContractView.from(
                c,
                events.findByContractIdOrderByCreatedAtAsc(c.getId()),
                reviews.findByContractId(c.getId()).orElse(null));
    }

    private static final Map<ContractStatus, String> STATUS_LABELS =
            Map.of(
                    ContractStatus.PENDENTE, "pendente",
                    ContractStatus.ACEITO, "aceita",
                    ContractStatus.EM_ANDAMENTO, "em andamento",
                    ContractStatus.AGUARDANDO_CONFIRMACAO, "aguardando confirmação",
                    ContractStatus.CONCLUIDO, "concluída",
                    ContractStatus.EM_DISPUTA, "em disputa",
                    ContractStatus.RECUSADO, "recusada",
                    ContractStatus.CANCELADO, "cancelada");

    private static String link(Contract c) {
        return "/contratacoes/" + c.getId();
    }

    @Scheduled(fixedDelayString = "${app.contracts.deadline-check-ms:60000}")
    @Transactional
    public void scheduledDeadlineCheck() {
        processExpiredDeadlines(Instant.now(clock));
    }

    @Transactional
    public int processExpiredDeadlines(Instant now) {
        var pendingCutoff = now.minus(Duration.ofHours(48));
        var expiredPending = contracts.findExpiredForUpdate(ContractStatus.PENDENTE, pendingCutoff);
        for (var c : expiredPending) {
            c.transitionTo(ContractStatus.CANCELADO, null, now);
            events.save(
                    new ContractEvent(
                            c,
                            null,
                            ContractStatus.PENDENTE,
                            ContractStatus.CANCELADO,
                            "Cancelada automaticamente após 48 horas sem resposta.",
                            now));
            var title = c.getTitle() + ": cancelada automaticamente";
            var body = "A solicitação ficou 48 horas sem resposta.";
            notifications.notify(c.getClient(), "CONTRACT_EXPIRED", title, body, link(c));
            notifications.notify(c.getFreelancer(), "CONTRACT_EXPIRED", title, body, link(c));
        }

        var confirmCutoff = now.minus(Duration.ofDays(5));
        var expiredConfirm =
                contracts.findExpiredForUpdate(
                        ContractStatus.AGUARDANDO_CONFIRMACAO, confirmCutoff);
        for (var c : expiredConfirm) {
            c.transitionTo(ContractStatus.CONCLUIDO, null, now);
            events.save(
                    new ContractEvent(
                            c,
                            null,
                            ContractStatus.AGUARDANDO_CONFIRMACAO,
                            ContractStatus.CONCLUIDO,
                            "Confirmada automaticamente após 5 dias corridos.",
                            now));
            var title = c.getTitle() + ": conclusão confirmada automaticamente";
            notifications.notify(
                    c.getClient(),
                    "CONTRACT_AUTO_CONFIRMED",
                    title,
                    "Você tem 7 dias para avaliar o serviço.",
                    link(c));
            notifications.notify(
                    c.getFreelancer(),
                    "CONTRACT_AUTO_CONFIRMED",
                    title,
                    "O cliente não respondeu em 5 dias.",
                    link(c));
        }
        return expiredPending.size() + expiredConfirm.size();
    }

    public static boolean canTransition(ContractStatus from, ContractStatus to, Role role) {
        return TRANSITIONS.getOrDefault(from, Map.of()).getOrDefault(role, Set.of()).contains(to);
    }

    private void ensureParticipantOrAdmin(User u, Contract c) {
        boolean allowed =
                switch (u.getRole()) {
                    case ADMIN -> true;
                    case CLIENT -> c.getClient().getId().equals(u.getId());
                    case FREELANCER -> c.getFreelancer().getId().equals(u.getId());
                };
        if (!allowed)
            throw new ApiException(HttpStatus.FORBIDDEN, "Você não participa desta contratação.");
    }

    private ServiceListing activeService(UUID id) {
        return services.findById(id)
                .filter(s -> s.getStatus() == ServiceStatus.ACTIVE && s.getFreelancer().isActive())
                .orElseThrow(
                        () -> new ApiException(HttpStatus.NOT_FOUND, "Serviço não encontrado."));
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Contratação não encontrada.");
    }
}
