/* Direct Supabase auth — sensitive ops go through API */
const DirectAuth = {
  _client: null,

  db() {
    const cfg = window.BATIG_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnon) {
      throw new Error('Database not connected — add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel, then Redeploy');
    }
    if (!this._client) {
      this._client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnon);
    }
    return this._client;
  },

  toPublicUser(u) {
    const role = u.role || (u.is_admin ? 'admin' : 'player');
    return {
      id: u.id,
      username: u.username,
      phone: u.phone || '',
      balance: Number(u.balance),
      referralCode: u.referral_code,
      referredBy: u.referred_by,
      wins: u.wins,
      rounds: u.rounds,
      isAdmin: u.is_admin || ['owner', 'per_admin', 'admin'].includes(role),
      role,
      createdAt: u.created_at
    };
  },

  saveSession(u) {
    localStorage.setItem('batig_user', JSON.stringify(u));
  },

  getSession() {
    try { return JSON.parse(localStorage.getItem('batig_user')); } catch { return null; }
  },

  clearSession() {
    localStorage.removeItem('batig_user');
    localStorage.removeItem('batig_token');
  },

  async register({ username, password, phone, referralCode }) {
    const data = await API.register({ username, password, phone, referralCode });
    if (data.token) API.setToken(data.token);
    this.saveSession(data.user);
    return { user: data.user, referralBonus: data.referralBonus || 0 };
  },

  async login({ username, password }) {
    const data = await API.login({ username, password });
    if (data.token) API.setToken(data.token);
    this.saveSession(data.user);
    return { user: data.user };
  },

  async refreshUser() {
    const s = this.getSession();
    if (!s) return null;
    try {
      const data = await API.me();
      this.saveSession(data.user);
      return data.user;
    } catch {
      throw new Error('Session expired — please sign in again');
    }
  },

  async loadProfile() {
    const data = await API.profile();
    this.saveSession(data.user);
    return data;
  }
};
