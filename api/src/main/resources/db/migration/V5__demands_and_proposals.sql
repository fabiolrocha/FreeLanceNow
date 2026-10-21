CREATE TABLE demand (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES app_user(id),
  category_id UUID NOT NULL REFERENCES category(id),
  title VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL,
  budget NUMERIC(12,2) NOT NULL CHECK (budget > 0),
  days INT NOT NULL CHECK (days BETWEEN 1 AND 365),
  city VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  created_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ
);

CREATE INDEX idx_demand_client ON demand(client_id, created_at DESC);
CREATE INDEX idx_demand_status ON demand(status, created_at DESC);

CREATE TABLE proposal (
  id UUID PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES demand(id) ON DELETE CASCADE,
  freelancer_id UUID NOT NULL REFERENCES app_user(id),
  price NUMERIC(12,2) NOT NULL CHECK (price > 0),
  days INT NOT NULL CHECK (days BETWEEN 1 AND 365),
  message VARCHAR(600) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_proposal_pending_demand_freelancer ON proposal(demand_id, freelancer_id) WHERE status = 'PENDING';
CREATE INDEX idx_proposal_demand ON proposal(demand_id, created_at ASC);
CREATE INDEX idx_proposal_freelancer ON proposal(freelancer_id, created_at DESC);

ALTER TABLE contract ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE contract ADD COLUMN demand_id UUID REFERENCES demand(id);
ALTER TABLE contract ADD COLUMN proposal_id UUID UNIQUE REFERENCES proposal(id);

ALTER TABLE review ALTER COLUMN service_id DROP NOT NULL;
