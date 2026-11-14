package br.com.freelancenow.api.users;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@org.hibernate.annotations.DynamicUpdate
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

    @Column(name = "service_area", nullable = false, length = 150)
    private String serviceArea = "";

    @Column(name = "avatar_updated_at")
    private Instant avatarUpdatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

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

    public void updateProfile(
            String name, String phone, String city, String bio, String serviceArea) {
        this.name = name;
        this.phone = phone;
        this.city = city;
        this.bio = bio;
        this.serviceArea = serviceArea;
    }

    public void setAvatarUpdatedAt(Instant avatarUpdatedAt) {
        this.avatarUpdatedAt = avatarUpdatedAt;
    }

    /**
     * Removes personal data while keeping the row, so contracts, reviews and audit history stay
     * consistent. The e-mail becomes free for a new registration.
     */
    public void anonymize(String unusablePasswordHash, Instant now) {
        this.name = "Conta excluída";
        this.email = "excluida-" + id + "@freelancenow.invalid";
        this.phone = "0000000000";
        this.city = "";
        this.bio = "";
        this.serviceArea = "";
        this.passwordHash = unusablePasswordHash;
        this.avatarUpdatedAt = null;
        this.active = false;
        this.deletedAt = now;
    }

    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
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

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
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

    public String getServiceArea() {
        return serviceArea;
    }

    /** Changes whenever the avatar changes, so clients can cache the image by version. */
    public Long getAvatarVersion() {
        return avatarUpdatedAt == null ? null : avatarUpdatedAt.toEpochMilli();
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }
}
