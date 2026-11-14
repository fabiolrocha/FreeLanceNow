-- E-mail confirmation (ADR25). Accounts created before this migration were registered without
-- the step, so they are treated as confirmed instead of being asked to confirm retroactively.
ALTER TABLE app_user ADD COLUMN email_verified_at TIMESTAMPTZ;
UPDATE app_user SET email_verified_at = created_at;
