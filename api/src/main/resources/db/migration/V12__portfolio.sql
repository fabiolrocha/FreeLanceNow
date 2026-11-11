CREATE TABLE portfolio_projects (
    id BIGSERIAL PRIMARY KEY,
    freelancer_id BIGINT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    project_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);