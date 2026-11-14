package br.com.freelancenow.api.contracts;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ContractEventRepository extends JpaRepository<ContractEvent, UUID> {
    // The history shows who made each change, so the actor is loaded with the event.
    @EntityGraph(attributePaths = "actor")
    List<ContractEvent> findByContractIdOrderByCreatedAtAsc(UUID contractId);

    @EntityGraph(attributePaths = "actor")
    List<ContractEvent> findByContractIdInOrderByCreatedAtAsc(Collection<UUID> contractIds);
}
