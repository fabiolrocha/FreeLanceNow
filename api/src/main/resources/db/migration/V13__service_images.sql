CREATE TABLE service_image (
    id SERIAL PRIMARY KEY,
    service_id BIGINT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_service_image_service_id ON service_image(service_id);