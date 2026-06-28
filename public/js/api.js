const API = {
  token: localStorage.getItem('batig_token') || null,
  _cache: {},

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem('batig_token', t);
    else localStorage.removeItem('batig_token');
  },

  requireToken() {
    if (!this.token) throw new Error('Session expired — sign out and sign in again');
  },

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch('/api/' + path, { ...options, headers });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch {
      const plain = (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (res.status === 403 && /vercel security checkpoint/i.test(plain)) {
        throw new Error('Vercel security checkpoint blocked login. In Vercel → Project → Settings → Security, turn off Attack Challenge Mode (or allow /api). Then hard refresh and retry.');
      }
      if (res.status === 403) {
        throw new Error('Server blocked request (403). Sign out, sign in again, then retry.');
      }
      throw new Error(plain.slice(0, 120) || ('Server error ' + res.status));
    }

    if (!res.ok) {
      const err = new Error(data.error || data.message || ('Error ' + res.status));
      if (data.retryAfter != null) err.retryAfter = Number(data.retryAfter);
      throw err;
    }
    return data;
  },

  cached(key, ttlMs, fetcher) {
    const hit = this._cache[key];
    if (hit && Date.now() - hit.t < ttlMs) return Promise.resolve(hit.v);
    return fetcher().then(v => {
      this._cache[key] = { v, t: Date.now() };
      return v;
    });
  },

  register(body) { return this.request('register', { method: 'POST', body: JSON.stringify(body) }); },
  login(body) { return this.request('login', { method: 'POST', body: JSON.stringify(body) }); },
  me() { return this.request('me'); },
  profile() { return this.request('profile'); },
  round(durationMin = 1) {
    return this.request('round?duration=' + encodeURIComponent(durationMin));
  },
  bet(body) { return this.request('bet', { method: 'POST', body: JSON.stringify(body) }); },
  leaderboard() {
    return this.cached('leaderboard', 30000, () => this.request('leaderboard'));
  },
  resolveRound(roundId) {
    return this.request('resolve-round', { method: 'POST', body: JSON.stringify({ roundId }) });
  },
  fetchCMSSettings() {
    return this.cached('cms', 300000, () => this.request('cms'));
  },
  saveCMSSetting(key, value) {
    this._cache.cms = null;
    return this.request('cms', { method: 'POST', body: JSON.stringify({ key, value }) });
  },
  fetchRolePermissions(role) {
    return this.cached('role-' + role, 600000, () => this.request('role-permissions?role=' + encodeURIComponent(role)));
  },
  admin(method, body) {
    return this.request('admin', {
      method: method || 'GET',
      body: body ? JSON.stringify(body) : undefined
    });
  },
  adminRoles(method, body) {
    return this.request('admin/roles', {
      method: method || 'GET',
      body: body ? JSON.stringify(body) : undefined
    });
  },
  adminBan(userId, ban) {
    return this.request('admin/ban', { method: 'POST', body: JSON.stringify({ userId, ban }) });
  },
  auditLogs() {
    return this.request('admin/logs');
  },
  deposits(action, body) {
    const q = action ? '?action=' + encodeURIComponent(action) : '';
    const method = action === 'pending' || action === 'mine' ? 'GET' : 'POST';
    return this.request('deposits' + q, {
      method,
      body: method === 'POST' ? JSON.stringify({ action, ...body }) : undefined
    });
  },
  withdrawals(action, body) {
    const q = action ? '?action=' + encodeURIComponent(action) : '';
    const method = action === 'pending' || action === 'mine' ? 'GET' : 'POST';
    return this.request('withdrawals' + q, {
      method,
      body: method === 'POST' ? JSON.stringify({ action, ...body }) : undefined
    });
  }
};
