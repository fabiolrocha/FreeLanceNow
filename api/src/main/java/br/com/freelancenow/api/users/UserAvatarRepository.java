package br.com.freelancenow.api.users;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserAvatarRepository extends JpaRepository<UserAvatar, UUID> {}
