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
}
