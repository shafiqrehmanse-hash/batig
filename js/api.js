const API = {
  token: localStorage.getItem('batig_token') || null,
  _cache: {},

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem('batig_token', t);
    else localStorage.removeItem('batig_token');
  },

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch('/api/' + path, { ...options, headers });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text || 'Server error' }; }

    if (!res.ok) throw new Error(data.error || data.message || ('Error ' + res.status));
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
  round() { return this.request('round'); },
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
  }
};
