package br.com.freelancenow.api.reviews;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID> {
    interface RatingStats {
        UUID getFreelancerId();

        Double getAverageRating();

        long getReviewCount();
    }

    @EntityGraph(attributePaths = {"contract", "service", "client", "freelancer"})
    Optional<Review> findByContractId(UUID contractId);

    boolean existsByContractId(UUID contractId);

    @EntityGraph(attributePaths = {"contract", "service", "client", "freelancer"})
    List<Review> findByContractIdIn(Collection<UUID> contractIds);

    @EntityGraph(attributePaths = {"contract", "service", "client", "freelancer"})
    List<Review> findByFreelancerIdOrderByCreatedAtDesc(UUID freelancerId);

    @EntityGraph(attributePaths = {"contract", "service", "client", "freelancer"})
    List<Review> findByServiceIdOrderByCreatedAtDesc(UUID serviceId);

    @Query(
            """
            select r.freelancer.id as freelancerId,
                   avg(r.rating) as averageRating,
                   count(r.id) as reviewCount
            from Review r
            where r.freelancer.id in :freelancerIds
            group by r.freelancer.id
            """)
    List<RatingStats> statsByFreelancerIds(Collection<UUID> freelancerIds);
}
