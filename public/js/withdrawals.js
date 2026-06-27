/* BATIG — Withdrawal requests */
const Withdrawals = {
  async submit({ amount, accountName, accountNumber, method }) {
    const session = DirectAuth.getSession();
    if (!session) throw new Error('Please sign in again');

    const amt = parseInt(amount);
    if (!amt || amt < 100) throw new Error('Minimum withdrawal PKR 100');
    if (!accountName?.trim()) throw new Error('Enter account holder name');
    if (!accountNumber?.trim()) throw new Error('Enter account number');
    if (!['easypaisa', 'jazzcash'].includes(method)) throw new Error('Select Easypaisa or JazzCash');

    const db = DirectAuth.db();
    const { data: u, error: uErr } = await db.from('users').select('*').eq('id', session.id).single();
    if (uErr || !u) throw new Error('User not found');
    if (Number(u.balance) < amt) throw new Error('Insufficient balance');

    const newBal = Number(u.balance) - amt;
    const { error: balErr } = await db.from('users').update({ balance: newBal }).eq('id', session.id);
    if (balErr) throw new Error(balErr.message);

    const { error } = await db.from('withdrawal_requests').insert({
      user_id: session.id,
      username: session.username,
      amount: amt,
      account_name: accountName.trim(),
      account_number: accountNumber.trim(),
      method,
      status: 'pending'
    });
    if (error) {
      await db.from('users').update({ balance: Number(u.balance) }).eq('id', session.id);
      throw new Error(error.message);
    }

    DirectAuth.saveSession({ ...session, balance: newBal });
    return { ok: true, balance: newBal };
  },

  async fetchPending() {
    const db = DirectAuth.db();
    const { data, error } = await db.from('withdrawal_requests')
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
    const { data } = await db.from('withdrawal_requests')
      .select('id, amount, method, account_name, account_number, status, created_at, processed_at, proof_data')
      .eq('user_id', session.id)
      .order('created_at', { ascending: false })
      .limit(20);
    return data || [];
  },

  async markSent(id, adminUsername, proofFile) {
    const db = DirectAuth.db();
    const { data: req, error: rErr } = await db.from('withdrawal_requests').select('*').eq('id', id).maybeSingle();
    if (rErr || !req) throw new Error('Request not found');
    if (req.status !== 'pending') throw new Error('Already processed');
    if (!proofFile) throw new Error('Upload payment proof screenshot');

    const { dataUrl, sizeKB } = await ImageCompress.compressFile(proofFile, { maxKB: 120 });

    const { error } = await db.from('withdrawal_requests').update({
      status: 'sent',
      proof_data: dataUrl,
      proof_size_kb: sizeKB,
      processed_at: new Date().toISOString(),
      processed_by: adminUsername
    }).eq('id', id);
    if (error) throw new Error(error.message);
    return { username: req.username, amount: req.amount, sizeKB };
  },

  async reject(id, adminUsername, note) {
    const db = DirectAuth.db();
    const { data: req, error: rErr } = await db.from('withdrawal_requests').select('*').eq('id', id).maybeSingle();
    if (rErr || !req) throw new Error('Request not found');
    if (req.status !== 'pending') throw new Error('Already processed');

    const { data: u } = await db.from('users').select('*').eq('id', req.user_id).maybeSingle();
    if (u) {
      await db.from('users').update({ balance: Number(u.balance) + Number(req.amount) }).eq('id', u.id);
    }

    const { error } = await db.from('withdrawal_requests').update({
      status: 'rejected',
      processed_at: new Date().toISOString(),
      processed_by: adminUsername,
      admin_note: note || ''
    }).eq('id', id);
    if (error) throw new Error(error.message);
    return { refunded: Number(req.amount), username: req.username };
  },

  subscribePending(onNew) {
    const db = DirectAuth.db();
    return db.channel('withdrawal_requests_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'withdrawal_requests' }, () => onNew())
      .subscribe();
  }
};
