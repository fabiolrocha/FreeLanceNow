package br.com.freelancenow.api.catalog;

import org.springframework.data.jpa.repository.*;

import java.util.*;

public interface ServiceRepository
        extends JpaRepository<ServiceListing, UUID>, JpaSpecificationExecutor<ServiceListing> {
    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ServiceListing s where s.id = :id")
    Optional<ServiceListing> lockById(
            @org.springframework.data.repository.query.Param("id") UUID id);

    long countByFreelancerIdAndStatus(UUID freelancerId, ServiceStatus status);

    List<ServiceListing> findByFreelancerIdOrderByCreatedAtDesc(UUID freelancerId);

    /** Pairs of (freelancer id, category name) for the freelancers' active, visible services. */
    @Query(
            "select distinct s.freelancer.id, s.category.name from ServiceListing s"
                    + " where s.freelancer.id in :ids and s.moderated = false"
                    + " and s.status = br.com.freelancenow.api.catalog.ServiceStatus.ACTIVE")
    List<Object[]> activeCategories(
            @org.springframework.data.repository.query.Param("ids") Collection<UUID> ids);
}
