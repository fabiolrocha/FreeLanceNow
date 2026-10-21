ALTER TABLE service_listing ADD COLUMN moderated BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE review ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE content_report (
  id UUID PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES app_user(id),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('SERVICE','REVIEW')),
  target_id UUID NOT NULL,
  target_title VARCHAR(100) NOT NULL,
  target_content VARCHAR(1000) NOT NULL,
  reason VARCHAR(80) NOT NULL,
  comment VARCHAR(1000) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','KEPT','REMOVED')),
  decided_by UUID REFERENCES app_user(id),
  decision_note VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  CHECK ((status = 'PENDING' AND decided_by IS NULL AND decided_at IS NULL) OR
         (status <> 'PENDING' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_note IS NOT NULL))
);
CREATE UNIQUE INDEX uq_report_pending ON content_report(reporter_id,target_type,target_id) WHERE status='PENDING';
CREATE INDEX idx_report_created ON content_report(created_at DESC,id DESC);
