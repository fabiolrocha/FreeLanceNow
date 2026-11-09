package br.com.freelancenow.api.contracts;

import br.com.freelancenow.api.auth.CurrentUser;
import br.com.freelancenow.api.common.ApiException;
import br.com.freelancenow.api.notifications.NotificationService;
import br.com.freelancenow.api.users.Role;
import br.com.freelancenow.api.users.User;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ContractMessageService {
    // Refused or cancelled requests never became a job, so there is nothing left to discuss.
    private static final Set<ContractStatus> CLOSED =
            Set.of(ContractStatus.RECUSADO, ContractStatus.CANCELADO);

    private final ContractRepository contracts;
    private final ContractMessageRepository messages;
    private final NotificationService notifications;
    private final CurrentUser current;
    private final Clock clock;

    public ContractMessageService(
            ContractRepository contracts,
            ContractMessageRepository messages,
            NotificationService notifications,
            CurrentUser current,
            Clock clock) {
        this.contracts = contracts;
        this.messages = messages;
        this.notifications = notifications;
        this.current = current;
        this.clock = clock;
    }

    /** Participants read and write; an admin can read the conversation to decide a dispute. */
    public List<ContractDtos.MessageView> list(Jwt jwt, UUID contractId) {
        var u = current.require(jwt);
        var c = contracts.findWithDetailsById(contractId).orElseThrow(this::notFound);
        if (u.getRole() != Role.ADMIN && !participant(u, c))
            throw new ApiException(HttpStatus.FORBIDDEN, "Você não participa desta contratação.");
        return messages.findByContractIdOrderByCreatedAtAsc(c.getId()).stream()
                .map(ContractDtos.MessageView::from)
                .toList();
    }

    @Transactional
    public ContractDtos.MessageView send(Jwt jwt, UUID contractId, ContractDtos.SendMessage r) {
        var u = current.require(jwt);
        var c = contracts.findWithDetailsById(contractId).orElseThrow(this::notFound);
        if (!participant(u, c))
            throw new ApiException(
                    HttpStatus.FORBIDDEN, "Somente cliente e profissional podem conversar aqui.");
        if (CLOSED.contains(c.getStatus()))
            throw new ApiException(
                    HttpStatus.CONFLICT, "A conversa foi encerrada com esta contratação.");
        var saved = messages.save(new ContractMessage(c, u, r.text(), Instant.now(clock)));
        var other = c.getClient().getId().equals(u.getId()) ? c.getFreelancer() : c.getClient();
        var text = saved.getText();
        var preview = text.length() > 120 ? text.substring(0, 120) + "…" : text;
        notifications.notify(
                other,
                "MESSAGE_RECEIVED",
                "Nova mensagem de " + u.getName(),
                preview,
                "/mensagens?contratacao=" + c.getId());
        return ContractDtos.MessageView.from(saved);
    }

    private static boolean participant(User u, Contract c) {
        return c.getClient().getId().equals(u.getId())
                || c.getFreelancer().getId().equals(u.getId());
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Contratação não encontrada.");
    }
}
