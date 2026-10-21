package br.com.freelancenow.api.feed;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface FeedPostRepository extends JpaRepository<FeedPost, UUID> {}
