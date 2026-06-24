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
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  register(body) { return this.request('register', { method: 'POST', body: JSON.stringify(body) }); },
  login(body) { return this.request('login', { method: 'POST', body: JSON.stringify(body) }); },
  me() { return this.request('me'); },
  round() { return this.request('round'); },
  bet(body) { return this.request('bet', { method: 'POST', body: JSON.stringify(body) }); },
  leaderboard() { return this.request('leaderboard'); },
  admin(method, body) {
    return this.request('admin', {
      method: method || 'GET',
      body: body ? JSON.stringify(body) : undefined
    });
  }
};
