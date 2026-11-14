CREATE TABLE service_image (
  id UUID PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES service_listing(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_service_image_service ON service_image(service_id, created_at ASC);
