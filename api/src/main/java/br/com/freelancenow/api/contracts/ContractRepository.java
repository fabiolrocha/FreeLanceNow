package br.com.freelancenow.api.contracts;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ContractRepository extends JpaRepository<Contract, UUID> {
    boolean existsByClientIdAndServiceIdAndStatus(
            UUID clientId, UUID serviceId, ContractStatus status);

    @EntityGraph(attributePaths = {"client", "freelancer", "service"})
    List<Contract> findByClientIdOrderByCreatedAtDesc(UUID clientId);

    @EntityGraph(attributePaths = {"client", "freelancer", "service"})
    List<Contract> findByFreelancerIdOrderByCreatedAtDesc(UUID freelancerId);

    @EntityGraph(attributePaths = {"client", "freelancer", "service"})
    List<Contract> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"client", "freelancer", "service"})
    Optional<Contract> findWithDetailsById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"client", "freelancer", "service"})
    @Query("select c from Contract c where c.id = :id")
    Optional<Contract> lockById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "select c from Contract c where c.status = :status and c.statusUpdatedAt <= :cutoff"
                    + " order by c.statusUpdatedAt asc")
    List<Contract> findExpiredForUpdate(ContractStatus status, Instant cutoff);
}
