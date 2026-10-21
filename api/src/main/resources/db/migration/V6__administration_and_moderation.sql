CREATE TABLE audit_event (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES app_user(id),
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(30) NOT NULL,
  target_id UUID NOT NULL,
  before_value TEXT NOT NULL,
  after_value TEXT NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_audit_created ON audit_event(created_at DESC, id DESC);
CREATE UNIQUE INDEX uq_category_name_ci ON category(lower(name));
