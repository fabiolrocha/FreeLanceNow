-- F09 with Stripe Connect in test mode (ADR34): freelancers receive through a connected account,
-- released money becomes a Stripe transfer, and refunds or chargebacks made outside the app are
-- recorded.

-- One connected account per freelancer. Identity and bank data stay with Stripe; this table keeps
-- only the account id and what the app needs to decide whether it can transfer.
CREATE TABLE payout_account (
  user_id UUID PRIMARY KEY REFERENCES app_user(id),
  stripe_account_id VARCHAR(60) NOT NULL UNIQUE,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  transfers_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  currently_due VARCHAR(2000) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Charge id (needed for source_transaction and to match charge/dispute events), the transfer to
-- the freelancer, refunds made from the Stripe Dashboard (possibly partial) and chargebacks.
ALTER TABLE payment ADD COLUMN provider_charge_id VARCHAR(120);
ALTER TABLE payment ADD COLUMN transfer_id VARCHAR(120);
ALTER TABLE payment ADD COLUMN transferred_at TIMESTAMPTZ;
ALTER TABLE payment ADD COLUMN transfer_error VARCHAR(500);
ALTER TABLE payment ADD COLUMN reversed_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (reversed_amount >= 0);
ALTER TABLE payment ADD COLUMN refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0);
ALTER TABLE payment ADD COLUMN dispute_id VARCHAR(120);
ALTER TABLE payment ADD COLUMN dispute_status VARCHAR(10) CHECK (dispute_status IN ('OPEN', 'WON', 'LOST'));

-- REFUND_FAILED: Stripe could not return the money; the team follows up.
-- CHARGED_BACK: the client's bank took the money back and the platform lost the dispute.
ALTER TABLE payment DROP CONSTRAINT payment_status_check;
ALTER TABLE payment ADD CONSTRAINT payment_status_check
  CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'RELEASED', 'REFUNDED', 'FAILED', 'CANCELED',
                    'REFUND_FAILED', 'CHARGED_BACK'));

CREATE INDEX idx_payment_intent ON payment(provider_payment_id);
CREATE INDEX idx_payment_charge ON payment(provider_charge_id);
-- Released money still waiting for the freelancer's account (or for a retry after an error).
CREATE INDEX idx_payment_pending_transfer ON payment(freelancer_id)
  WHERE status = 'RELEASED' AND provider = 'STRIPE' AND transfer_id IS NULL;

ALTER TABLE ledger_entry DROP CONSTRAINT ledger_entry_entry_type_check;
ALTER TABLE ledger_entry ADD CONSTRAINT ledger_entry_entry_type_check
  CHECK (entry_type IN ('CHARGE', 'PLATFORM_FEE', 'ESCROW_HOLD', 'PAYOUT_RELEASE', 'REFUND',
                        'TRANSFER', 'TRANSFER_REVERSAL', 'CHARGEBACK', 'CHARGEBACK_REVERSAL'));
