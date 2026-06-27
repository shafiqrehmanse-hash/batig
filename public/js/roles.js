/* BATIG v3 — Role permissions */
const ROLES = {
  STAFF_ROLES: ['owner', 'per_admin', 'admin', 'admin_assistant', 'operator'],

  DEFAULT_PERMS: {
    can_view_admin: false, can_manage_users: false, can_add_funds: false,
    can_withdraw_funds: false, can_view_financials: false, can_manage_rounds: false,
    can_edit_cms: false, can_manage_roles: false, can_manage_infrastructure: false,
    can_view_logs: false, can_ban_users: false
  },

  isStaff(role) {
    return !!role && role !== 'player';
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
      const { permissions } = await API.fetchRolePermissions(role);
      if (permissions) return { ...this.DEFAULT_PERMS, ...permissions };
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
      rounds: permissions.can_manage_rounds,
      users: permissions.can_manage_users,
      addFunds: permissions.can_add_funds,
      deposits: permissions.can_add_funds,
      payments: permissions.can_add_funds,
      withdrawals: permissions.can_withdraw_funds,
      cms: permissions.can_edit_cms,
      roleManager: permissions.can_manage_roles,
      logs: permissions.can_view_logs,
      infrastructure: permissions.can_manage_infrastructure
    };

    Object.entries(sections).forEach(([section, allowed]) => {
      const nav = document.querySelector(`.admin-nav-item[data-admin-section="${section}"]`);
      if (nav) nav.classList.toggle('hidden', !allowed);
      const panel = document.getElementById('admin-section-' + section);
      if (panel) panel.classList.toggle('admin-panel-disabled', !allowed);
    });

    const badge = document.getElementById('admin-role-badge');
    if (badge) badge.textContent = (role || 'player').toUpperCase().replace(/_/g, ' ');

    const show = permissions.can_view_admin;
    const adminTab = document.getElementById('admin-tab');
    const adminBnav = document.getElementById('admin-bnav');
    if (adminTab) adminTab.classList.toggle('hidden', !show);
    if (adminBnav) adminBnav.classList.toggle('hidden', !show);

    const staff = this.isStaff(role);
    document.querySelectorAll('[data-tab="game"]').forEach(el => {
      el.classList.toggle('hidden', staff);
    });
    const gamePage = document.getElementById('page-game');
    if (gamePage) gamePage.classList.toggle('staff-hidden', staff);

    if (show && typeof switchAdminSection === 'function') {
      const first = document.querySelector('.admin-nav-item:not(.hidden)');
      if (first) switchAdminSection(first.dataset.adminSection);
    }
  }
};
