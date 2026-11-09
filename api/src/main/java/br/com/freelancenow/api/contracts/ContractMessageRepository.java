package br.com.freelancenow.api.contracts;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ContractMessageRepository extends JpaRepository<ContractMessage, UUID> {
    @EntityGraph(attributePaths = {"author"})
    List<ContractMessage> findByContractIdOrderByCreatedAtAsc(UUID contractId);
}
