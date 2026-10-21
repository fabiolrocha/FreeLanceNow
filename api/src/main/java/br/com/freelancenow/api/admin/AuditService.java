package br.com.freelancenow.api.admin;

import br.com.freelancenow.api.users.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.UUID;

@Service
public class AuditService {
    private final AuditRepository events;
    private final Clock clock;

    public AuditService(AuditRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void record(
            User actor,
            String action,
            String type,
            UUID id,
            String before,
            String after,
            String reason) {
        events.save(
                new AuditEvent(actor, action, type, id, before, after, reason, Instant.now(clock)));
    }
}
