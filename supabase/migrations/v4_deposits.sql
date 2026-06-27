-- BATIG v4 — Deposit requests + payment account settings
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS deposit_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('easypaisa', 'jazzcash')),
  screenshot_data TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  admin_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_user ON deposit_requests(user_id);

INSERT INTO cms_settings (setting_key, setting_value, setting_type, category, label) VALUES
('payment.easypaisa_name', 'BATIG Official', 'text', 'payment', 'Easypaisa Account Name'),
('payment.easypaisa_number', '03001234567', 'text', 'payment', 'Easypaisa Account Number'),
('payment.jazzcash_name', 'BATIG Official', 'text', 'payment', 'JazzCash Account Name'),
('payment.jazzcash_number', '03001234567', 'text', 'payment', 'JazzCash Account Number')
ON CONFLICT (setting_key) DO NOTHING;

ALTER TABLE deposit_requests DISABLE ROW LEVEL SECURITY;
GRANT ALL ON deposit_requests TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE deposit_requests_id_seq TO anon, authenticated, service_role;
