/* BATIG v3 — Role permissions */
const ROLES = {
  DEFAULT_PERMS: {
    can_view_admin: false, can_manage_users: false, can_add_funds: false,
    can_withdraw_funds: false, can_view_financials: false, can_manage_rounds: false,
    can_edit_cms: false, can_manage_roles: false, can_manage_infrastructure: false,
    can_view_logs: false, can_ban_users: false
  },

  FALLBACK: {
    owner: {
      can_view_admin: true, can_manage_users: true, can_add_funds: true,
      can_withdraw_funds: true, can_view_financials: true, can_manage_rounds: true,
      can_edit_cms: true, can_manage_roles: true, can_manage_infrastructure: true,
      can_view_logs: true, can_ban_users: true
    },
    per_admin: {
      can_view_admin: true, can_manage_users: true, can_add_funds: true,
      can_withdraw_funds: true, can_view_financials: true, can_manage_rounds: false,
      can_edit_cms: false, can_manage_roles: false, can_manage_infrastructure: false,
      can_view_logs: true, can_ban_users: true
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
    }
  },

  mapRow(data) {
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
  },

  async fetchPermissions(role) {
    if (!role || role === 'player') return { ...this.DEFAULT_PERMS };
    const fallback = this.FALLBACK[role];
    try {
      const db = DirectAuth.db();
      const { data } = await db.from('role_permissions').select('*').eq('role', role).maybeSingle();
      if (data) return this.mapRow(data);
      if (fallback) return { ...fallback };
      return { ...this.DEFAULT_PERMS };
    } catch {
      if (fallback) return { ...fallback };
      return { ...this.DEFAULT_PERMS };
    }
  },

  ensureAdminNav() {
    if (!document.getElementById('admin-tab')) {
      const nav = document.getElementById('desktop-nav');
      if (nav) {
        const btn = document.createElement('button');
        btn.className = 'dnav-item hidden';
        btn.id = 'admin-tab';
        btn.dataset.tab = 'admin';
        btn.onclick = () => switchTab('admin');
        btn.innerHTML = '<i class="ti ti-shield"></i> Admin';
        nav.appendChild(btn);
      }
    }
    if (!document.getElementById('admin-bnav')) {
      const nav = document.querySelector('.bottom-nav');
      if (nav) {
        const btn = document.createElement('button');
        btn.className = 'bnav-item hidden';
        btn.id = 'admin-bnav';
        btn.dataset.tab = 'admin';
        btn.onclick = () => switchTab('admin');
        btn.innerHTML = '<i class="ti ti-shield"></i>Admin';
        nav.appendChild(btn);
      }
    }
  },

  buildAdminPanel(role, permissions) {
    this.ensureAdminNav();

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

    const show = permissions.can_view_admin;
    const adminTab = document.getElementById('admin-tab');
    const adminBnav = document.getElementById('admin-bnav');
    if (adminTab) adminTab.classList.toggle('hidden', !show);
    if (adminBnav) adminBnav.classList.toggle('hidden', !show);
  }
};
