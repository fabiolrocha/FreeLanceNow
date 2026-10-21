package br.com.freelancenow.api.demands;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DemandRepository extends JpaRepository<Demand, UUID> {
    @EntityGraph(attributePaths = {"client", "category"})
    List<Demand> findByClientIdOrderByCreatedAtDesc(UUID clientId);

    @EntityGraph(attributePaths = {"client", "category"})
    List<Demand> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"client", "category"})
    Optional<Demand> findWithDetailsById(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"client", "category"})
    @Query("select d from Demand d where d.id = :id")
    Optional<Demand> lockById(UUID id);
}
