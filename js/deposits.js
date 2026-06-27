/* BATIG — Deposit requests (Easypaisa / JazzCash) */
const Deposits = {
  PAYMENT_KEYS: [
    'payment.easypaisa_name', 'payment.easypaisa_number',
    'payment.jazzcash_name', 'payment.jazzcash_number'
  ],

  getAccounts() {
    const g = window.GAME_CONFIG || {};
    return {
      easypaisa: { name: g.easypaisaName || '—', number: g.easypaisaNumber || '—' },
      jazzcash: { name: g.jazzcashName || '—', number: g.jazzcashNumber || '—' }
    };
  },

  async loadPaymentSettings(db) {
    const { data } = await db.from('cms_settings').select('setting_key, setting_value')
      .in('setting_key', this.PAYMENT_KEYS);
    const s = {};
    (data || []).forEach(r => { s[r.setting_key] = r.setting_value; });
    if (!window.GAME_CONFIG) window.GAME_CONFIG = {};
    window.GAME_CONFIG.easypaisaName = s['payment.easypaisa_name'] || '';
    window.GAME_CONFIG.easypaisaNumber = s['payment.easypaisa_number'] || '';
    window.GAME_CONFIG.jazzcashName = s['payment.jazzcash_name'] || '';
    window.GAME_CONFIG.jazzcashNumber = s['payment.jazzcash_number'] || '';
    return this.getAccounts();
  },

  async savePaymentAccounts(values, updatedBy) {
    for (const [key, val] of Object.entries(values)) {
      await CMS.save(key, val, updatedBy);
    }
    await this.loadPaymentSettings(DirectAuth.db());
  },

  async compressScreenshot(file) {
    return ImageCompress.compressFile(file, { maxWidth: 1200, maxKB: 120 });
  },

  async submit({ method, amount, screenshotFile }) {
    const session = DirectAuth.getSession();
    if (!session) throw new Error('Please sign in again');
    const amt = parseInt(amount);
    if (!amt || amt < 50) throw new Error('Minimum deposit PKR 50');
    if (!['easypaisa', 'jazzcash'].includes(method)) throw new Error('Select Easypaisa or JazzCash');

    const { dataUrl, sizeKB } = await this.compressScreenshot(screenshotFile);
    const db = DirectAuth.db();
    const { error } = await db.from('deposit_requests').insert({
      user_id: session.id,
      username: session.username,
      amount: amt,
      method,
      screenshot_data: dataUrl,
      screenshot_size_kb: sizeKB,
      status: 'pending'
    });
    if (error) throw new Error(error.message);
    return { ok: true, sizeKB };
  },

  async fetchPending() {
    const db = DirectAuth.db();
    const { data, error } = await db.from('deposit_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async fetchMyRequests() {
    const session = DirectAuth.getSession();
    if (!session) return [];
    const db = DirectAuth.db();
    const { data } = await db.from('deposit_requests')
      .select('id, amount, method, status, screenshot_size_kb, created_at, processed_at')
      .eq('user_id', session.id)
      .order('created_at', { ascending: false })
      .limit(20);
    return data || [];
  },

  async approve(id, adminUsername) {
    const db = DirectAuth.db();
    const { data: req, error: rErr } = await db.from('deposit_requests').select('*').eq('id', id).maybeSingle();
    if (rErr || !req) throw new Error('Request not found');
    if (req.status !== 'pending') throw new Error('Already processed');

    const { data: u, error: uErr } = await db.from('users').select('*').eq('id', req.user_id).maybeSingle();
    if (uErr || !u) throw new Error('User not found');

    const newBal = Number(u.balance) + Number(req.amount);
    const { error: balErr } = await db.from('users').update({ balance: newBal }).eq('id', u.id);
    if (balErr) throw new Error(balErr.message);

    const { error: upErr } = await db.from('deposit_requests').update({
      status: 'approved',
      processed_at: new Date().toISOString(),
      processed_by: adminUsername
    }).eq('id', id);
    if (upErr) throw new Error(upErr.message);

    return { newBalance: newBal, username: u.username, amount: req.amount };
  },

  async reject(id, adminUsername, note) {
    const db = DirectAuth.db();
    const { error } = await db.from('deposit_requests').update({
      status: 'rejected',
      processed_at: new Date().toISOString(),
      processed_by: adminUsername,
      admin_note: note || ''
    }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  subscribePending(onNew) {
    const db = DirectAuth.db();
    return db.channel('deposit_requests_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deposit_requests' }, () => onNew())
      .subscribe();
  }
};
