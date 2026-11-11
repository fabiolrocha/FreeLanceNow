CREATE TABLE reviews (
    id BIGSERIAL PRIMARY KEY,
    contract_id BIGINT NOT NULL,
    reviewer_id BIGINT NOT NULL,
    reviewed_id BIGINT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );