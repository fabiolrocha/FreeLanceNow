package br.com.freelancenow.api.contracts;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ContractEventRepository extends JpaRepository<ContractEvent, UUID> {
    List<ContractEvent> findByContractIdOrderByCreatedAtAsc(UUID contractId);

    List<ContractEvent> findByContractIdInOrderByCreatedAtAsc(Collection<UUID> contractIds);
}
