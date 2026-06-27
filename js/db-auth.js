/* Direct Supabase auth — works without Vercel API */
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

  genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  toPublicUser(u) {
    return {
      id: u.id,
      username: u.username,
      phone: u.phone || '',
      balance: Number(u.balance),
      referralCode: u.referral_code,
      referredBy: u.referred_by,
      wins: u.wins,
      rounds: u.rounds,
      isAdmin: u.is_admin,
      createdAt: u.created_at
    };
  },

  bcryptLib() {
    if (typeof bcrypt !== 'undefined') return bcrypt;
    if (typeof dcodeIO !== 'undefined' && dcodeIO.bcrypt) return dcodeIO.bcrypt;
    throw new Error('Page still loading — wait 2 seconds and try again');
  },

  hash(password) {
    const b = this.bcryptLib();
    return new Promise((resolve, reject) => {
      b.hash(password, 10, (err, h) => (err ? reject(err) : resolve(h)));
    });
  },

  check(password, hash) {
    const b = this.bcryptLib();
    return new Promise((resolve, reject) => {
      b.compare(password, hash, (err, ok) => (err ? reject(err) : resolve(ok)));
    });
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

  async syncApiToken(username, password) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token && typeof API !== 'undefined') API.setToken(data.token);
    } catch (_) {}
  },

  async register({ username, password, phone, referralCode }) {
    const db = this.db();
    if (!username || username.length < 3) throw new Error('Username must be at least 3 characters');
    if (!password || password.length < 4) throw new Error('Password must be at least 4 characters');

    const { data: existing } = await db.from('users').select('id').ilike('username', username).maybeSingle();
    if (existing) throw new Error('Username already taken');

    let referrer = null;
    if (referralCode) {
      const { data: ref } = await db.from('users').select('*').eq('referral_code', referralCode.toUpperCase()).maybeSingle();
      if (!ref) throw new Error('Invalid referral code');
      referrer = ref;
    }

    const { count } = await db.from('users').select('*', { count: 'exact', head: true });
    const isFirst = (count || 0) === 0;
    const passwordHash = await this.hash(password);

    const { data: user, error } = await db.from('users').insert({
      username,
      password_hash: passwordHash,
      phone: phone || '',
      balance: 500,
      referral_code: this.genCode(),
      referred_by: referrer?.id || null,
      is_admin: isFirst
    }).select().single();

    if (error) {
      if (error.message.includes('does not exist')) throw new Error('Run supabase/schema.sql in Supabase SQL Editor first');
      throw new Error(error.message);
    }

    let referralBonus = 0;
    if (referrer) {
      referralBonus = 100;
      await db.from('users').update({ balance: Number(referrer.balance) + 100 }).eq('id', referrer.id);
      await db.from('referrals').insert({ referrer_id: referrer.id, referred_id: user.id, bonus: 100 });
    }

    const pub = this.toPublicUser(user);
    this.saveSession(pub);
    await this.syncApiToken(username, password);
    return { user: pub, referralBonus };
  },

  async login({ username, password }) {
    const db = this.db();
    const { data: user, error } = await db.from('users').select('*').ilike('username', username).maybeSingle();
    if (error) throw new Error(error.message);
    if (!user || !(await this.check(password, user.password_hash))) {
      throw new Error('Invalid username or password');
    }
    const pub = this.toPublicUser(user);
    this.saveSession(pub);
    await this.syncApiToken(username, password);
    return { user: pub };
  },

  async refreshUser() {
    const s = this.getSession();
    if (!s) return null;
    const { data: user, error } = await this.db().from('users').select('*').eq('id', s.id).maybeSingle();
    if (error || !user) throw new Error('Session expired — please sign in again');
    const pub = this.toPublicUser(user);
    this.saveSession(pub);
    return pub;
  },

  async loadProfile() {
    const u = await this.refreshUser();
    const db = this.db();

    const { data: bets } = await db.from('bets')
      .select('number, amount, won, payout, round_id, rounds(winner)')
      .eq('user_id', u.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const history = (bets || []).map(b => ({
      number: b.number,
      amount: Number(b.amount),
      won: b.won,
      payout: Number(b.payout),
      roundId: b.round_id,
      winner: b.rounds?.winner
    }));

    const { data: refs } = await db.from('referrals').select('bonus, referred_id').eq('referrer_id', u.id);
    const referrals = [];
    for (const r of refs || []) {
      const { data: ru } = await db.from('users').select('username').eq('id', r.referred_id).maybeSingle();
      referrals.push({ username: ru?.username || 'User', bonus: Number(r.bonus) });
    }

    return { user: u, history, referrals };
  },

  async placeBet({ number, amount }) {
    const session = this.getSession();
    if (!session) throw new Error('Please sign in again');

    const num = parseInt(number);
    const amt = parseInt(amount);
    if (!num || num < 1 || num > 6) throw new Error('Pick a number 1–6');
    if (!amt || amt < 10) throw new Error('Minimum bet is PKR 10');

    const roundId = Math.floor(Date.now() / 60000);
    const sec = Math.floor((Date.now() - roundId * 60000) / 1000);
    if (sec >= 45) throw new Error('Betting is closed for this round');

    const db = this.db();
    const { data: user, error: uErr } = await db.from('users').select('*').eq('id', session.id).single();
    if (uErr || !user) throw new Error('User not found');
    if (Number(user.balance) < amt) throw new Error('Insufficient balance');

    const { data: existing } = await db.from('bets').select('id').eq('user_id', session.id).eq('round_id', roundId).maybeSingle();
    if (existing) throw new Error('You already bet this round');

    const { error: balErr } = await db.from('users').update({
      balance: Number(user.balance) - amt,
      rounds: user.rounds + 1
    }).eq('id', session.id);
    if (balErr) throw new Error(balErr.message);

    const { error: betErr } = await db.from('bets').insert({
      user_id: session.id,
      round_id: roundId,
      number: num,
      amount: amt
    });
    if (betErr) throw new Error(betErr.message);

    const { data: round } = await db.from('rounds').select('*').eq('id', roundId).maybeSingle();
    const bets = [...(round?.bets || [0, 0, 0, 0, 0, 0])].map(Number);
    bets[num - 1] += amt;

    if (!round) {
      const { error: rErr } = await db.from('rounds').insert({
        id: roundId,
        bets,
        pool: amt,
        player_count: 1
      });
      if (rErr) throw new Error(rErr.message);
    } else {
      const { error: rErr } = await db.from('rounds').update({
        bets,
        pool: Number(round.pool) + amt,
        player_count: (round.player_count || 0) + 1
      }).eq('id', roundId);
      if (rErr) throw new Error(rErr.message);
    }

    const newBalance = Number(user.balance) - amt;
    this.saveSession({ ...session, balance: newBalance, rounds: user.rounds + 1 });
    return { success: true, bet: { number: num, amount: amt }, balance: newBalance };
  }
};
