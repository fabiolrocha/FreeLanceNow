package br.com.freelancenow.api.users;

import br.com.freelancenow.api.admin.AuditService;
import br.com.freelancenow.api.catalog.ServiceImageService;
import br.com.freelancenow.api.catalog.ServiceRepository;
import br.com.freelancenow.api.catalog.ServiceStatus;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.contracts.ContractRepository;
import br.com.freelancenow.api.contracts.ContractStatus;
import br.com.freelancenow.api.demands.DemandRepository;
import br.com.freelancenow.api.demands.DemandStatus;
import br.com.freelancenow.api.demands.ProposalRepository;
import br.com.freelancenow.api.demands.ProposalStatus;
import br.com.freelancenow.api.notifications.NotificationService;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Profile photo and removal of the person's own account. */
@Service
public class AccountService {
    public static final long MAX_AVATAR_BYTES = 2L * 1024 * 1024;
    private static final List<ContractStatus> OPEN_CONTRACTS =
            List.of(
                    ContractStatus.PENDENTE,
                    ContractStatus.ACEITO,
                    ContractStatus.EM_ANDAMENTO,
                    ContractStatus.AGUARDANDO_CONFIRMACAO,
                    ContractStatus.EM_DISPUTA);

    private final UserRepository users;
    private final UserAvatarRepository avatars;
    private final ContractRepository contracts;
    private final ServiceRepository services;
    private final DemandRepository demands;
    private final ProposalRepository proposals;
    private final NotificationService notifications;
    private final AuditService audit;
    private final PasswordEncoder passwords;
    private final Clock clock;

    public AccountService(
            UserRepository users,
            UserAvatarRepository avatars,
            ContractRepository contracts,
            ServiceRepository services,
            DemandRepository demands,
            ProposalRepository proposals,
            NotificationService notifications,
            AuditService audit,
            PasswordEncoder passwords,
            Clock clock) {
        this.users = users;
        this.avatars = avatars;
        this.contracts = contracts;
        this.services = services;
        this.demands = demands;
        this.proposals = proposals;
        this.notifications = notifications;
        this.audit = audit;
        this.passwords = passwords;
        this.clock = clock;
    }

    @Transactional
    public UserDtos.Me uploadAvatar(User current, MultipartFile file) {
        if (file == null || file.isEmpty())
            throw new ApiException(HttpStatus.BAD_REQUEST, "Selecione uma imagem.");
        if (file.getSize() > MAX_AVATAR_BYTES)
            throw new ApiException(
                    HttpStatus.PAYLOAD_TOO_LARGE, "A foto de perfil pode ter no máximo 2 MB.");
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Não foi possível ler a imagem.");
        }
        var type = ServiceImageService.detectType(data);
        ServiceImageService.checkReadable(data);
        var u = users.lockById(current.getId()).orElseThrow(this::missing);
        var now = Instant.now(clock);
        var avatar = avatars.findById(u.getId()).orElseGet(() -> new UserAvatar(u.getId()));
        avatar.replace(type, data, now);
        avatars.save(avatar);
        u.setAvatarUpdatedAt(now);
        return UserDtos.Me.from(u);
    }

    @Transactional
    public UserDtos.Me deleteAvatar(User current) {
        var u = users.lockById(current.getId()).orElseThrow(this::missing);
        avatars.deleteById(u.getId());
        u.setAvatarUpdatedAt(null);
        return UserDtos.Me.from(u);
    }

    @Transactional(readOnly = true)
    public UserAvatar avatar(UUID userId) {
        return users.findById(userId)
                .filter(u -> u.isActive() && u.getAvatarVersion() != null)
                .flatMap(u -> avatars.findById(u.getId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Foto não encontrada."));
    }

    /**
     * Deletes the account at the owner's request: personal data is erased, open demands,
     * proposals and listings are closed, and the history needed by the other party is kept.
     */
    @Transactional
    public void deleteAccount(User current, String password) {
        var u = users.lockById(current.getId()).orElseThrow(this::missing);
        if (u.getRole() == Role.ADMIN)
            throw new ApiException(
                    HttpStatus.CONFLICT, "Contas de administrador não podem ser excluídas aqui.");
        if (!passwords.matches(password, u.getPasswordHash()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "A senha não confere.");
        boolean busy =
                u.getRole() == Role.CLIENT
                        ? contracts.existsByClientIdAndStatusIn(u.getId(), OPEN_CONTRACTS)
                        : contracts.existsByFreelancerIdAndStatusIn(u.getId(), OPEN_CONTRACTS);
        if (busy)
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "Você tem contratações em aberto. Conclua ou cancele cada uma antes de"
                            + " excluir a conta.");
        var now = Instant.now(clock);
        if (u.getRole() == Role.FREELANCER) {
            for (var s : services.findByFreelancerIdOrderByCreatedAtDesc(u.getId()))
                if (s.getStatus() != ServiceStatus.INACTIVE) s.setStatus(ServiceStatus.INACTIVE);
            for (var p : proposals.findByFreelancerIdOrderByCreatedAtAsc(u.getId())) {
                if (p.getStatus() != ProposalStatus.PENDING) continue;
                p.withdraw(now);
                notifications.notify(
                        p.getDemand().getClient(),
                        "PROPOSAL_WITHDRAWN",
                        "Proposta retirada: " + p.getDemand().getTitle(),
                        "O profissional encerrou a conta.",
                        "/demandas/" + p.getDemand().getId());
            }
        } else {
            for (var d : demands.findByClientIdOrderByCreatedAtDesc(u.getId())) {
                if (d.getStatus() != DemandStatus.OPEN) continue;
                for (var p : proposals.findByDemandIdOrderByCreatedAtAsc(d.getId())) {
                    if (p.getStatus() != ProposalStatus.PENDING) continue;
                    p.reject(now);
                    notifications.notify(
                            p.getFreelancer(),
                            "PROPOSAL_REJECTED",
                            "Demanda cancelada: " + d.getTitle(),
                            "O cliente encerrou a conta.",
                            "/propostas");
                }
                d.cancel(now);
            }
        }
        avatars.deleteById(u.getId());
        audit.record(u, "ACCOUNT_DELETED", "USER", u.getId(), "true", "false", "Pedido do titular");
        u.anonymize(passwords.encode(UUID.randomUUID().toString()), now);
    }

    private ApiException missing() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Sua sessão terminou. Entre novamente.");
    }
}
