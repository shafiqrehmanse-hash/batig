-- BATIG v14 — Separate promo wallet for control players (excluded from real house finance)

ALTER TABLE users ADD COLUMN IF NOT EXISTS promo_balance BIGINT NOT NULL DEFAULT 0;

ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_promo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS real_pool BIGINT NOT NULL DEFAULT 0;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS promo_pool BIGINT NOT NULL DEFAULT 0;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS promo_pl BIGINT NOT NULL DEFAULT 0;

ALTER TABLE house_stats ADD COLUMN IF NOT EXISTS promo_pool BIGINT NOT NULL DEFAULT 0;
ALTER TABLE house_stats ADD COLUMN IF NOT EXISTS promo_payouts BIGINT NOT NULL DEFAULT 0;
ALTER TABLE house_stats ADD COLUMN IF NOT EXISTS promo_net BIGINT NOT NULL DEFAULT 0;

-- Move existing control player real balance into promo wallet (one-time)
UPDATE users
SET promo_balance = COALESCE(promo_balance, 0) + COALESCE(balance, 0),
    balance = 0
WHERE role = 'control_player' AND COALESCE(balance, 0) > 0;
