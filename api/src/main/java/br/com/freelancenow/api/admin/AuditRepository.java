package br.com.freelancenow.api.admin;

import org.springframework.data.jpa.repository.*;

import java.util.*;

public interface AuditRepository extends JpaRepository<AuditEvent, UUID> {
    @EntityGraph(attributePaths = "actor")
    List<AuditEvent> findTop200ByOrderByCreatedAtDescIdDesc();
}
