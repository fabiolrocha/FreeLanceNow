package br.com.freelancenow.api.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.*;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    @org.springframework.data.jpa.repository.Lock(
            jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from Category c where c.id = :id")
    Optional<Category> lockById(@org.springframework.data.repository.query.Param("id") UUID id);

    List<Category> findByActiveTrueOrderByNameAsc();
}
