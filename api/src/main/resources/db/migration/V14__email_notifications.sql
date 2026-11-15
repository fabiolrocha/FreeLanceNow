-- E-mail copies of important notices (F07, ADR28). On by default; the owner can turn them off.
ALTER TABLE app_user ADD COLUMN email_notifications BOOLEAN NOT NULL DEFAULT TRUE;
