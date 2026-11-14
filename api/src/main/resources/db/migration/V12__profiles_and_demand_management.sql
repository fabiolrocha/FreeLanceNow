-- Professional profile details and account removal (LGPD).
ALTER TABLE app_user ADD COLUMN service_area VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE app_user ADD COLUMN avatar_updated_at TIMESTAMPTZ;
ALTER TABLE app_user ADD COLUMN deleted_at TIMESTAMPTZ;

-- Avatars live apart from app_user so loading a user never loads the image bytes.
CREATE TABLE user_avatar (
  user_id UUID PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
  data BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Clients cancel open demands; freelancers withdraw pending proposals.
ALTER TABLE demand DROP CONSTRAINT demand_status_check;
ALTER TABLE demand ADD CONSTRAINT demand_status_check CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED'));
ALTER TABLE proposal DROP CONSTRAINT proposal_status_check;
ALTER TABLE proposal ADD CONSTRAINT proposal_status_check CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'));

-- A freelancer may delete a draft or inactive listing that never had contracts; feed posts keep their text.
ALTER TABLE feed_post DROP CONSTRAINT feed_post_service_id_fkey;
ALTER TABLE feed_post ADD CONSTRAINT feed_post_service_id_fkey
  FOREIGN KEY (service_id) REFERENCES service_listing(id) ON DELETE SET NULL;
