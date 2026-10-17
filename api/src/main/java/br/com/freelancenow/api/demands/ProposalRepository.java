package br.com.freelancenow.api.demands;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProposalRepository extends JpaRepository<Proposal, UUID> {
    boolean existsByDemandIdAndFreelancerIdAndStatus(
            UUID demandId, UUID freelancerId, ProposalStatus status);

    boolean existsByDemandIdAndFreelancerId(UUID demandId, UUID freelancerId);

    @EntityGraph(attributePaths = {"demand", "freelancer"})
    List<Proposal> findByDemandIdOrderByCreatedAtAsc(UUID demandId);

    @EntityGraph(attributePaths = {"demand", "freelancer"})
    List<Proposal> findByDemandIdAndFreelancerIdOrderByCreatedAtAsc(
            UUID demandId, UUID freelancerId);

    @EntityGraph(attributePaths = {"demand", "freelancer"})
    List<Proposal> findByDemandClientIdOrderByCreatedAtAsc(UUID clientId);

    @EntityGraph(attributePaths = {"demand", "freelancer"})
    List<Proposal> findByFreelancerIdOrderByCreatedAtAsc(UUID freelancerId);

    @EntityGraph(attributePaths = {"demand", "freelancer"})
    List<Proposal> findAllByOrderByCreatedAtAsc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"demand", "freelancer"})
    @Query("select p from Proposal p where p.id = :id")
    Optional<Proposal> lockById(UUID id);
}
