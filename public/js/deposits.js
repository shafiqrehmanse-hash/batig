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

  async loadPaymentSettings() {
    if (!window.GAME_CONFIG) window.GAME_CONFIG = {};
    try {
      const { settings } = await API.fetchCMSSettings();
      const s = {};
      (settings || []).forEach(r => { s[r.setting_key] = r.setting_value; });
      window.GAME_CONFIG.easypaisaName = s['payment.easypaisa_name'] || '';
      window.GAME_CONFIG.easypaisaNumber = s['payment.easypaisa_number'] || '';
      window.GAME_CONFIG.jazzcashName = s['payment.jazzcash_name'] || '';
      window.GAME_CONFIG.jazzcashNumber = s['payment.jazzcash_number'] || '';
    } catch (_) {}
    return this.getAccounts();
  },

  async savePaymentAccounts(values, updatedBy) {
    for (const [key, val] of Object.entries(values)) {
      await API.saveCMSSetting(key, val);
    }
    await this.loadPaymentSettings();
  },

  async compressScreenshot(file) {
    return ImageCompress.compressFile(file, { maxWidth: 1200, maxKB: 120 });
  },

  async submit({ method, amount, screenshotFile }) {
    const amt = parseInt(amount);
    if (!amt || amt < 50) throw new Error('Minimum deposit PKR 50');
    if (!['easypaisa', 'jazzcash'].includes(method)) throw new Error('Select Easypaisa or JazzCash');

    const { dataUrl, sizeKB } = await this.compressScreenshot(screenshotFile);
    await API.deposits('submit', {
      method,
      amount: amt,
      screenshotData: dataUrl,
      screenshotSizeKb: sizeKB
    });
    return { ok: true, sizeKB };
  },

  async fetchPending() {
    const { requests } = await API.deposits('pending');
    return requests || [];
  },

  async fetchMyRequests() {
    const { requests } = await API.deposits('mine');
    return requests || [];
  },

  async approve(id, adminUsername) {
    const result = await API.deposits('approve', { id });
    return { newBalance: result.newBalance, username: result.username, amount: result.amount };
  },

  async reject(id, adminUsername, note) {
    await API.deposits('reject', { id, note: note || '' });
  },

  subscribePending(onNew) {
    try {
      const db = DirectAuth.db();
      return db.channel('deposit_requests_live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deposit_requests' }, () => onNew())
        .subscribe();
    } catch (_) {
      return null;
    }
  }
};
