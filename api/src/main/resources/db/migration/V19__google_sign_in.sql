ALTER TABLE app_user
    ADD COLUMN google_subject VARCHAR(255),
    ADD CONSTRAINT uq_app_user_google_subject UNIQUE (google_subject);
