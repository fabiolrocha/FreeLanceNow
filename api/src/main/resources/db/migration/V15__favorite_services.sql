-- Services a user saved to find again later. Removing the user or the listing removes the entry.
CREATE TABLE favorite_service (
  user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES service_listing(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, service_id)
);
