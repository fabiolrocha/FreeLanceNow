CREATE TABLE payment (
  id UUID PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES contract(id),
  client_id UUID NOT NULL REFERENCES app_user(id),
  freelancer_id UUID NOT NULL REFERENCES app_user(id),
  provider VARCHAR(30) NOT NULL DEFAULT 'STRIPE' CHECK (provider IN ('STRIPE', 'SIMULATED')),
  method VARCHAR(20) NOT NULL CHECK (method IN ('PIX', 'CARD', 'BOLETO')),
  status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING', 'AUTHORIZED', 'PAID', 'RELEASED', 'REFUNDED', 'FAILED', 'CANCELED')),
  gross_amount NUMERIC(12,2) NOT NULL CHECK (gross_amount > 0),
  fee_amount NUMERIC(12,2) NOT NULL CHECK (fee_amount >= 0),
  net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount >= 0 AND gross_amount = fee_amount + net_amount),
  external_reference VARCHAR(120) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_contract ON payment(contract_id, created_at DESC);
CREATE INDEX idx_payment_client ON payment(client_id, created_at DESC);
CREATE INDEX idx_payment_freelancer ON payment(freelancer_id, created_at DESC);

CREATE TABLE ledger_entry (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payment(id),
  contract_id UUID NOT NULL REFERENCES contract(id),
  user_id UUID REFERENCES app_user(id),
  entry_type VARCHAR(30) NOT NULL CHECK (entry_type IN ('CHARGE', 'PLATFORM_FEE', 'ESCROW_HOLD', 'PAYOUT_RELEASE', 'REFUND')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  external_event_id VARCHAR(120) UNIQUE,
  description VARCHAR(300) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_ledger_payment ON ledger_entry(payment_id, created_at ASC);
CREATE INDEX idx_ledger_user ON ledger_entry(user_id, created_at DESC);
