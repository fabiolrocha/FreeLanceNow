package br.com.freelancenow.api.catalog;

import org.springframework.data.jpa.repository.*;

import java.util.*;

public interface ServiceRepository
        extends JpaRepository<ServiceListing, UUID>, JpaSpecificationExecutor<ServiceListing> {
    long countByFreelancerIdAndStatus(UUID freelancerId, ServiceStatus status);

    List<ServiceListing> findByFreelancerIdOrderByCreatedAtDesc(UUID freelancerId);
}
