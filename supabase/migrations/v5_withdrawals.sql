-- BATIG v5 — Withdrawals + deposit screenshot size
-- Run in Supabase SQL Editor

ALTER TABLE deposit_requests
  ADD COLUMN IF NOT EXISTS screenshot_size_kb INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('easypaisa', 'jazzcash')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'rejected')),
  proof_data TEXT,
  proof_size_kb INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  admin_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON withdrawal_requests(user_id);

ALTER TABLE withdrawal_requests DISABLE ROW LEVEL SECURITY;
GRANT ALL ON withdrawal_requests TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE withdrawal_requests_id_seq TO anon, authenticated, service_role;
