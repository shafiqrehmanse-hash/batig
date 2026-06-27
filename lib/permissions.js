const FALLBACK = {
  owner: {
    can_view_admin: true, can_manage_users: true, can_add_funds: true,
    can_withdraw_funds: true, can_view_financials: true, can_manage_rounds: true,
    can_edit_cms: true, can_manage_roles: true, can_manage_infrastructure: true,
    can_view_logs: true, can_ban_users: true
  },
  per_admin: {
    can_view_admin: true, can_manage_users: false, can_add_funds: true,
    can_withdraw_funds: false, can_view_financials: false, can_manage_rounds: false,
    can_edit_cms: false, can_manage_roles: false, can_manage_infrastructure: false,
    can_view_logs: false, can_ban_users: false
  },
  admin: {
    can_view_admin: true, can_manage_users: true, can_add_funds: true,
    can_withdraw_funds: false, can_view_financials: true, can_manage_rounds: true,
    can_edit_cms: false, can_manage_roles: false, can_manage_infrastructure: false,
    can_view_logs: true, can_ban_users: true
  },
  admin_assistant: {
    can_view_admin: true, can_manage_users: false, can_add_funds: true,
    can_withdraw_funds: false, can_view_financials: false, can_manage_rounds: false,
    can_edit_cms: false, can_manage_roles: false, can_manage_infrastructure: false,
    can_view_logs: false, can_ban_users: false
  },
  operator: {
    can_view_admin: true, can_manage_users: false, can_add_funds: false,
    can_withdraw_funds: false, can_view_financials: false, can_manage_rounds: false,
    can_edit_cms: false, can_manage_roles: false, can_manage_infrastructure: false,
    can_view_logs: false, can_ban_users: false
  },
  player: {
    can_view_admin: false, can_manage_users: false, can_add_funds: false,
    can_withdraw_funds: false, can_view_financials: false, can_manage_rounds: false,
    can_edit_cms: false, can_manage_roles: false, can_manage_infrastructure: false,
    can_view_logs: false, can_ban_users: false
  }
};

const STAFF_ROLES = ['owner', 'per_admin', 'admin', 'admin_assistant', 'operator'];

function mapRow(data) {
  return {
    can_view_admin: !!data.can_view_admin,
    can_manage_users: !!data.can_manage_users,
    can_add_funds: !!data.can_add_funds,
    can_withdraw_funds: !!data.can_withdraw_funds,
    can_view_financials: !!data.can_view_financials,
    can_manage_rounds: !!data.can_manage_rounds,
    can_edit_cms: !!data.can_edit_cms,
    can_manage_roles: !!data.can_manage_roles,
    can_manage_infrastructure: !!data.can_manage_infrastructure,
    can_view_logs: !!data.can_view_logs,
    can_ban_users: !!data.can_ban_users
  };
}

async function getRolePermissions(db, role) {
  const r = role || 'player';
  if (r === 'player') return { ...FALLBACK.player };
  try {
    const { data } = await db.from('role_permissions').select('*').eq('role', r).maybeSingle();
    if (data) return mapRow(data);
  } catch (_) {}
  return { ...(FALLBACK[r] || FALLBACK.player) };
}

function requireStaff(auth) {
  return auth && STAFF_ROLES.includes(auth.role);
}

module.exports = { getRolePermissions, requireStaff, STAFF_ROLES, FALLBACK };
