-- BATIG v13 — Control Player role (promo / social media wins ~80–90%)

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'owner', 'per_admin', 'admin', 'admin_assistant', 'operator',
    'player', 'control_player'
  ));

ALTER TABLE users ADD COLUMN IF NOT EXISTS control_win_rate INT NOT NULL DEFAULT 85;
ALTER TABLE users ADD COLUMN IF NOT EXISTS control_wins INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS control_rounds INT NOT NULL DEFAULT 0;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_control_win_rate_check;
ALTER TABLE users ADD CONSTRAINT users_control_win_rate_check
  CHECK (control_win_rate >= 50 AND control_win_rate <= 99);
