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

  hash(password) {
    return new Promise((resolve, reject) => {
      dcodeIO.bcrypt.hash(password, 10, (err, h) => (err ? reject(err) : resolve(h)));
    });
  },

  check(password, hash) {
    return new Promise((resolve, reject) => {
      dcodeIO.bcrypt.compare(password, hash, (err, ok) => (err ? reject(err) : resolve(ok)));
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
  }
};
