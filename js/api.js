const API = {
  token: localStorage.getItem('batig_token') || null,

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

  register(body) { return this.request('register', { method: 'POST', body: JSON.stringify(body) }); },
  login(body) { return this.request('login', { method: 'POST', body: JSON.stringify(body) }); },
  me() { return this.request('me'); },
  round() { return this.request('round'); },
  bet(body) { return this.request('bet', { method: 'POST', body: JSON.stringify(body) }); },
  leaderboard() { return this.request('leaderboard'); },
  health() { return this.request('health'); },
  admin(method, body) {
    return this.request('admin', {
      method: method || 'GET',
      body: body ? JSON.stringify(body) : undefined
    });
  }
};
