package br.com.freelancenow.api.catalog;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "category")
public class Category {
    @Id private UUID id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, length = 80)
    private String slug;

    @Column(nullable = false)
    private boolean active;

    protected Category() {}

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getSlug() {
        return slug;
    }

    public boolean isActive() {
        return active;
    }
}
