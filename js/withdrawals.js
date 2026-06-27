/* BATIG — Withdrawal requests */
const Withdrawals = {
  async submit({ amount, accountName, accountNumber, method }) {
    const amt = parseInt(amount);
    if (!amt || amt < 100) throw new Error('Minimum withdrawal PKR 100');
    if (!accountName?.trim()) throw new Error('Enter account holder name');
    if (!accountNumber?.trim()) throw new Error('Enter account number');
    if (!['easypaisa', 'jazzcash'].includes(method)) throw new Error('Select Easypaisa or JazzCash');

    const result = await API.withdrawals('submit', {
      amount: amt,
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      method
    });

    const session = DirectAuth.getSession();
    if (session) DirectAuth.saveSession({ ...session, balance: result.balance });
    return { ok: true, balance: result.balance };
  },

  async fetchPending() {
    const { requests } = await API.withdrawals('pending');
    return requests || [];
  },

  async fetchMyRequests() {
    const { requests } = await API.withdrawals('mine');
    return requests || [];
  },

  async markSent(id, adminUsername, proofFile) {
    if (!proofFile) throw new Error('Upload payment proof screenshot');
    const { dataUrl, sizeKB } = await ImageCompress.compressFile(proofFile, { maxKB: 120 });
    const result = await API.withdrawals('sent', {
      id,
      proofData: dataUrl,
      proofSizeKb: sizeKB
    });
    return { username: result.username, amount: result.amount, sizeKB: result.sizeKB };
  },

  async reject(id, adminUsername, note) {
    const result = await API.withdrawals('reject', { id, note: note || '' });
    return { refunded: result.refunded, username: result.username };
  },

  subscribePending(onNew) {
    try {
      const db = DirectAuth.db();
      return db.channel('withdrawal_requests_live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'withdrawal_requests' }, () => onNew())
        .subscribe();
    } catch (_) {
      return null;
    }
  }
};
