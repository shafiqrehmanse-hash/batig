-- BATIG v11 — Per-user trade cooldown tracking (5s between trades)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_trade_at timestamptz;
