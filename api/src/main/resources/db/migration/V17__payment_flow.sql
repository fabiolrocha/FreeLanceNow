-- F09: Stripe Checkout in sandbox, escrow until completion, simulated withdrawals.

-- Checkout session data. external_reference keeps the Checkout Session id; the PaymentIntent id
-- is needed for refunds.
ALTER TABLE payment ADD COLUMN checkout_url VARCHAR(1000);
ALTER TABLE payment ADD COLUMN checkout_expires_at TIMESTAMPTZ;
ALTER TABLE payment ADD COLUMN provider_payment_id VARCHAR(120);

-- PROCESSING: Checkout finished but the money has not arrived yet (boleto, delayed Pix).
-- AUTHORIZED was never used: the flow captures immediately.
ALTER TABLE payment DROP CONSTRAINT payment_status_check;
ALTER TABLE payment ADD CONSTRAINT payment_status_check
  CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'RELEASED', 'REFUNDED', 'FAILED', 'CANCELED'));

-- At most one live payment per contract, so a client can never pay twice.
CREATE UNIQUE INDEX uq_payment_live ON payment(contract_id)
  WHERE status IN ('PENDING', 'PROCESSING', 'PAID', 'RELEASED');

-- Stripe retries webhooks; each event id is processed once.
CREATE TABLE payment_webhook_event (
  event_id VARCHAR(120) PRIMARY KEY,
  event_type VARCHAR(80) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL
);

-- Withdrawals are simulated: they lower the freelancer's balance but move no money, and no bank
-- or Pix data is collected.
CREATE TABLE withdrawal (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_user(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('SIMULATED')),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_withdrawal_user ON withdrawal(user_id, created_at DESC);
