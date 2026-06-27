-- BATIG v10 — Multiple bets per round + house intelligence tracking
-- Run in Supabase SQL Editor

ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_user_id_round_id_key;
DROP INDEX IF EXISTS bets_user_round_number_unique;
CREATE UNIQUE INDEX IF NOT EXISTS bets_user_round_number_unique
  ON bets(user_id, round_id, number);

ALTER TABLE house_stats ADD COLUMN IF NOT EXISTS recent_pool NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE house_stats ADD COLUMN IF NOT EXISTS recent_profit NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE house_stats ADD COLUMN IF NOT EXISTS recent_rounds INT NOT NULL DEFAULT 0;
ALTER TABLE house_stats ADD COLUMN IF NOT EXISTS target_margin NUMERIC NOT NULL DEFAULT 0.125;
ALTER TABLE house_stats ADD COLUMN IF NOT EXISTS active_players INT NOT NULL DEFAULT 0;
ALTER TABLE house_stats ADD COLUMN IF NOT EXISTS total_payouts NUMERIC NOT NULL DEFAULT 0;
