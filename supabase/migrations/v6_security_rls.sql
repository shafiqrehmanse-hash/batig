-- BATIG v6 — Lock down sensitive tables (run in Supabase SQL Editor)
-- After this migration, user data is only accessible via server API (service role).

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_bets_summary ENABLE ROW LEVEL SECURITY;

-- Public read: live exposure bars + CMS theme (no user PII)
DROP POLICY IF EXISTS round_bets_summary_public_read ON round_bets_summary;
CREATE POLICY round_bets_summary_public_read ON round_bets_summary
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS cms_settings_public_read ON cms_settings;
CREATE POLICY cms_settings_public_read ON cms_settings
  FOR SELECT TO anon, authenticated USING (true);

-- No policies on users, deposits, withdrawals, etc. = blocked for anon/authenticated keys.
-- Server API uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
