/* BATIG v3 — Role permissions */
const ROLES = {
  DEFAULT_PERMS: {
    can_view_admin: false, can_manage_users: false, can_add_funds: false,
    can_withdraw_funds: false, can_view_financials: false, can_manage_rounds: false,
    can_edit_cms: false, can_manage_roles: false, can_manage_infrastructure: false,
    can_view_logs: false, can_ban_users: false
  },

  async fetchPermissions(role) {
    if (!role || role === 'player') return { ...this.DEFAULT_PERMS };
    try {
      const db = DirectAuth.db();
      const { data } = await db.from('role_permissions').select('*').eq('role', role).maybeSingle();
      if (!data) return { ...this.DEFAULT_PERMS };
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
    } catch {
      if (role === 'owner' || role === 'admin') {
        return {
          can_view_admin: true, can_manage_users: true, can_add_funds: true,
          can_withdraw_funds: role === 'owner', can_view_financials: true,
          can_manage_rounds: true, can_edit_cms: role === 'owner',
          can_manage_roles: role === 'owner', can_manage_infrastructure: role === 'owner',
          can_view_logs: true, can_ban_users: role !== 'operator'
        };
      }
      return { ...this.DEFAULT_PERMS };
    }
  },

  buildAdminPanel(role, permissions) {
    const sections = {
      metrics: permissions.can_view_financials,
      exposure: permissions.can_view_admin,
      rounds: permissions.can_manage_rounds || permissions.can_view_admin,
      users: permissions.can_manage_users,
      addFunds: permissions.can_add_funds,
      withdrawals: permissions.can_withdraw_funds,
      cms: permissions.can_edit_cms,
      roleManager: permissions.can_manage_roles,
      logs: permissions.can_view_logs,
      infrastructure: permissions.can_manage_infrastructure
    };

    Object.entries(sections).forEach(([section, allowed]) => {
      const el = document.getElementById('admin-section-' + section);
      if (el) el.style.display = allowed ? '' : 'none';
    });

    const badge = document.getElementById('admin-role-badge');
    if (badge) badge.textContent = (role || 'player').toUpperCase().replace(/_/g, ' ');

    const adminTab = document.getElementById('admin-tab');
    const adminBnav = document.getElementById('admin-bnav');
    const show = permissions.can_view_admin;

    if (adminTab) {
      if (show) adminTab.classList.remove('hidden');
      else adminTab.remove();
    }
    if (adminBnav) {
      if (show) adminBnav.classList.remove('hidden');
      else adminBnav.remove();
    }
  }
};
