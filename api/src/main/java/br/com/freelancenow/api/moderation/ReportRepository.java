package br.com.freelancenow.api.moderation;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface ReportRepository extends JpaRepository<ContentReport, UUID> {
    @EntityGraph(attributePaths = {"reporter", "decidedBy"})
    List<ContentReport> findAllByOrderByCreatedAtDescIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ContentReport r where r.id=:id")
    Optional<ContentReport> lockById(@Param("id") UUID id);
}
