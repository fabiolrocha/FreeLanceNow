CREATE TABLE contract (
  id UUID PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES service_listing(id),
  client_id UUID NOT NULL REFERENCES app_user(id),
  freelancer_id UUID NOT NULL REFERENCES app_user(id),
  title VARCHAR(80) NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price > 0),
  scheduled_date DATE NOT NULL,
  description VARCHAR(300) NOT NULL,
  address VARCHAR(200) NOT NULL DEFAULT '',
  status VARCHAR(30) NOT NULL CHECK (status IN ('PENDENTE','ACEITO','EM_ANDAMENTO','AGUARDANDO_CONFIRMACAO','CONCLUIDO','EM_DISPUTA','RECUSADO','CANCELADO')),
  observations VARCHAR(500),
  dispute VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL,
  status_updated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_contract_pending_client_service ON contract(client_id, service_id) WHERE status = 'PENDENTE';
CREATE INDEX idx_contract_client ON contract(client_id, created_at DESC);
CREATE INDEX idx_contract_freelancer ON contract(freelancer_id, created_at DESC);
CREATE INDEX idx_contract_deadline ON contract(status, status_updated_at) WHERE status IN ('PENDENTE', 'AGUARDANDO_CONFIRMACAO');

CREATE TABLE contract_event (
  id UUID PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES contract(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES app_user(id),
  previous_status VARCHAR(30),
  status VARCHAR(30) NOT NULL CHECK (status IN ('PENDENTE','ACEITO','EM_ANDAMENTO','AGUARDANDO_CONFIRMACAO','CONCLUIDO','EM_DISPUTA','RECUSADO','CANCELADO')),
  note VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_contract_event_contract ON contract_event(contract_id, created_at ASC);
