CREATE TABLE app_user (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('CLIENT','FREELANCER','ADMIN')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  city VARCHAR(100) NOT NULL DEFAULT '',
  bio VARCHAR(600) NOT NULL DEFAULT '',
  terms_version VARCHAR(30) NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE category (
  id UUID PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  slug VARCHAR(80) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE service_listing (
  id UUID PRIMARY KEY,
  freelancer_id UUID NOT NULL REFERENCES app_user(id),
  category_id UUID NOT NULL REFERENCES category(id),
  title VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price > 0),
  delivery_days INTEGER NOT NULL CHECK (delivery_days BETWEEN 1 AND 365),
  status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT','ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_service_owner_status ON service_listing(freelancer_id, status);
CREATE INDEX idx_service_search ON service_listing(category_id, price) WHERE status = 'ACTIVE';
