package br.com.freelancenow.api.users;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_user")
public class User {
    @Id private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(nullable = false, length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, length = 100)
    private String city = "";

    @Column(nullable = false, length = 600)
    private String bio = "";

    @Column(name = "terms_version", nullable = false, length = 30)
    private String termsVersion;

    @Column(name = "terms_accepted_at", nullable = false)
    private Instant termsAcceptedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected User() {}

    public User(String name, String email, String passwordHash, String phone, Role role) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.phone = phone;
        this.role = role;
        this.createdAt = Instant.now();
        this.termsAcceptedAt = createdAt;
        this.termsVersion = "academic-v1";
    }

    public void updateProfile(String name, String phone, String city, String bio) {
        this.name = name;
        this.phone = phone;
        this.city = city;
        this.bio = bio;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getPhone() {
        return phone;
    }

    public Role getRole() {
        return role;
    }

    public boolean isActive() {
        return active;
    }

    public String getCity() {
        return city;
    }

    public String getBio() {
        return bio;
    }
}
