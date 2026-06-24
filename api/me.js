const { getDb } = require('../../lib/db');
const { requireAuth, publicUser } = require('../../lib/auth');
const { jsonResponse, handleCors } = require('../../lib/game');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  const auth = requireAuth(req);
  if (!auth) return jsonResponse(res, 401, { error: 'Unauthorized' });

  try {
    const db = getDb();
    const { data: user } = await db.from('users').select('*').eq('id', auth.id).single();
    if (!user) return jsonResponse(res, 404, { error: 'User not found' });

    const { data: rawRefs } = await db
      .from('referrals')
      .select('bonus, created_at, referred_id')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    const referrals = [];
    for (const r of rawRefs || []) {
      const { data: ru } = await db.from('users').select('username').eq('id', r.referred_id).single();
      referrals.push({ username: ru?.username || 'User', bonus: r.bonus, date: r.created_at });
    }

    const { data: history } = await db
      .from('bets')
      .select('*, rounds(winner)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    jsonResponse(res, 200, {
      user: publicUser(user),
      referrals: referrals,
      history: (history || []).map(h => ({
        roundId: h.round_id,
        number: h.number,
        amount: Number(h.amount),
        won: h.won,
        payout: Number(h.payout),
        winner: h.rounds?.winner,
        time: h.created_at
      }))
    });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
};
