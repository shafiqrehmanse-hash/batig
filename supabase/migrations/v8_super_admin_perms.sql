-- BATIG v8 — Super Admin: dashboard, users, deposits, withdrawals, logs, ban
-- Run in Supabase SQL Editor

UPDATE role_permissions SET
  can_view_admin = true,
  can_manage_users = true,
  can_add_funds = true,
  can_withdraw_funds = true,
  can_view_financials = true,
  can_manage_rounds = false,
  can_edit_cms = false,
  can_manage_roles = false,
  can_manage_infrastructure = false,
  can_view_logs = true,
  can_ban_users = true
WHERE role = 'per_admin';
