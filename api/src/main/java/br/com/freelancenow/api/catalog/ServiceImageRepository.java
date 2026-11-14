package br.com.freelancenow.api.catalog;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface ServiceImageRepository extends JpaRepository<ServiceImage, UUID> {
    @Query(
            "select new br.com.freelancenow.api.catalog.ServiceImageSummary(i.id, i.service.id,"
                    + " i.contentType) from ServiceImage i where i.service.id in :ids"
                    + " order by i.createdAt asc, i.id asc")
    List<ServiceImageSummary> summaries(@Param("ids") Collection<UUID> ids);

    @Query("select count(i) from ServiceImage i where i.service.id = :serviceId")
    long countByService(@Param("serviceId") UUID serviceId);

    @Query("select i from ServiceImage i where i.id = :id and i.service.id = :serviceId")
    Optional<ServiceImage> findInService(
            @Param("serviceId") UUID serviceId, @Param("id") UUID id);

    @Modifying
    @Query("delete from ServiceImage i where i.id = :id and i.service.id = :serviceId")
    int deleteInService(@Param("serviceId") UUID serviceId, @Param("id") UUID id);
}
