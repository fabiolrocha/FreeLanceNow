CREATE TABLE feed_post (
  id UUID PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES app_user(id),
  text VARCHAR(500) NOT NULL CHECK (length(trim(text)) > 0),
  category_id UUID REFERENCES category(id),
  service_id UUID REFERENCES service_listing(id),
  created_at TIMESTAMPTZ NOT NULL,
  hidden BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_feed_post_created ON feed_post(created_at DESC,id DESC) WHERE hidden=FALSE;
CREATE INDEX idx_service_feed_created ON service_listing(created_at DESC,id DESC) WHERE status='ACTIVE' AND moderated=FALSE;
CREATE INDEX idx_demand_feed_created ON demand(created_at DESC,id DESC) WHERE status='OPEN';
ALTER TABLE content_report DROP CONSTRAINT content_report_target_type_check;
ALTER TABLE content_report ADD CONSTRAINT content_report_target_type_check CHECK (target_type IN ('SERVICE','REVIEW','POST'));
