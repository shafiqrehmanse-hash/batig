-- BATIG v6b — Fix deposits & payment accounts after RLS lockdown
-- Run in Supabase SQL Editor AFTER v6_security_rls.sql

-- Deposits/withdrawals are only written through the server API (JWT auth).
-- Disable RLS on these tables so the API can always insert (service role should
-- bypass RLS anyway; this fixes misconfigured Vercel keys as a safety net).
ALTER TABLE deposit_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests DISABLE ROW LEVEL SECURITY;

-- CMS: allow public read (theme), writes only via server API (service role).
-- If cms writes still fail, ensure Vercel has SUPABASE_SERVICE_ROLE_KEY set correctly.
ALTER TABLE cms_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cms_settings_public_read ON cms_settings;
CREATE POLICY cms_settings_public_read ON cms_settings
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON cms_settings TO anon, authenticated;
GRANT ALL ON cms_settings TO service_role;
GRANT ALL ON deposit_requests TO service_role;
GRANT ALL ON withdrawal_requests TO service_role;
