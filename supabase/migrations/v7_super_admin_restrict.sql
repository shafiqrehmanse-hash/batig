-- BATIG v7 — Restrict Super Admin to operations only (no Owner conflicts)
-- Run in Supabase SQL Editor

UPDATE role_permissions SET
  can_view_admin = true,
  can_manage_users = false,
  can_add_funds = true,
  can_withdraw_funds = false,
  can_view_financials = false,
  can_manage_rounds = false,
  can_edit_cms = false,
  can_manage_roles = false,
  can_manage_infrastructure = false,
  can_view_logs = false,
  can_ban_users = false
WHERE role = 'per_admin';
