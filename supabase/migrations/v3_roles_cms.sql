-- BATIG v3 — Roles, CMS, Exposure Summary
-- Run in Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player'
  CHECK (role IN ('owner', 'per_admin', 'admin', 'admin_assistant', 'operator', 'player'));

UPDATE users SET role = 'owner' WHERE is_admin = true AND role = 'player';

CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT PRIMARY KEY,
  can_view_admin BOOLEAN DEFAULT false,
  can_manage_users BOOLEAN DEFAULT false,
  can_add_funds BOOLEAN DEFAULT false,
  can_withdraw_funds BOOLEAN DEFAULT false,
  can_view_financials BOOLEAN DEFAULT false,
  can_manage_rounds BOOLEAN DEFAULT false,
  can_edit_cms BOOLEAN DEFAULT false,
  can_manage_roles BOOLEAN DEFAULT false,
  can_manage_infrastructure BOOLEAN DEFAULT false,
  can_view_logs BOOLEAN DEFAULT false,
  can_ban_users BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO role_permissions VALUES
('owner',          true, true, true, true, true, true, true, true, true, true, true),
('per_admin',      true, true, true, true, true, false, false, false, false, true, true),
('admin',          true, true, true, false, true, true, false, false, false, true, true),
('admin_assistant',true, false, true, false, false, false, false, false, false, false, false),
('operator',       true, false, false, false, false, false, false, false, false, false, false),
('player',         false,false,false,false,false,false,false,false,false,false,false)
ON CONFLICT (role) DO NOTHING;

CREATE TABLE IF NOT EXISTS cms_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  setting_type TEXT NOT NULL DEFAULT 'text',
  category TEXT NOT NULL DEFAULT 'general',
  label TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO cms_settings (setting_key, setting_value, setting_type, category, label) VALUES
('theme.color.brand_primary', '#f4d03f', 'color', 'theme', 'Primary Gold Color'),
('theme.color.brand_secondary', '#00e676', 'color', 'theme', 'Secondary Green Color'),
('theme.color.bg_base', '#030508', 'color', 'theme', 'Background Color'),
('theme.color.brand_accent', '#7c3aed', 'color', 'theme', 'Accent Color'),
('game.odds_multiplier', '5', 'number', 'game', 'Win Multiplier'),
('game.min_bet', '50', 'number', 'game', 'Minimum Bet PKR'),
('game.max_bet', '10000', 'number', 'game', 'Maximum Bet PKR'),
('game.welcome_bonus', '500', 'number', 'game', 'Welcome Bonus PKR'),
('game.referral_bonus', '100', 'number', 'game', 'Referral Bonus PKR'),
('content.site_name', 'BATIG', 'text', 'content', 'Site Name'),
('content.tagline', 'Premium Dice Betting', 'text', 'content', 'Tagline'),
('content.deposit_contact', 'Contact admin on WhatsApp to deposit', 'text', 'content', 'Deposit Instructions'),
('content.withdraw_info', 'Withdrawals processed within 24h', 'text', 'content', 'Withdrawal Info'),
('limits.max_exposure_per_number', '50000', 'number', 'limits', 'Max Exposure Per Number'),
('limits.maintenance_mode', 'false', 'boolean', 'limits', 'Maintenance Mode'),
('limits.betting_open', 'true', 'boolean', 'limits', 'Allow Betting')
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS round_bets_summary (
  round_id BIGINT PRIMARY KEY,
  number_1_total BIGINT DEFAULT 0,
  number_2_total BIGINT DEFAULT 0,
  number_3_total BIGINT DEFAULT 0,
  number_4_total BIGINT DEFAULT 0,
  number_5_total BIGINT DEFAULT 0,
  number_6_total BIGINT DEFAULT 0,
  total_pool BIGINT DEFAULT 0,
  house_profit BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE rounds DISABLE ROW LEVEL SECURITY;
ALTER TABLE bets DISABLE ROW LEVEL SECURITY;
ALTER TABLE referrals DISABLE ROW LEVEL SECURITY;
ALTER TABLE house_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE cms_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE round_bets_summary DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
