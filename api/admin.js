const { getDb } = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { getRoundInfo, jsonResponse, handleCors } = require('./lib/game');
const { ensureRound } = require('./lib/resolve');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const auth = requireAuth(req);
  if (!auth || !auth.isAdmin) return jsonResponse(res, 403, { error: 'Admin only' });

  try {
    const db = getDb();
    const { data: house } = await db.from('house_stats').select('*').eq('id', 1).single();
    const { data: users } = await db.from('users').select('id, username, balance, wins, rounds, referred_by, is_admin').order('created_at', { ascending: false });
    const { data: rounds } = await db.from('rounds').select('*').eq('resolved', true).order('id', { ascending: false }).limit(15);

    const info = getRoundInfo();
    const current = await ensureRound(info.roundId);
    const bets = (current.bets || [0, 0, 0, 0, 0, 0]).map(Number);

    if (req.method === 'POST') {
      const { username, amount } = req.body || {};
      const amt = parseInt(amount);
      if (!username || !amt || amt <= 0) return jsonResponse(res, 400, { error: 'Invalid fund request' });

      const { data: user } = await db.from('users').select('*').ilike('username', username).single();
      if (!user) return jsonResponse(res, 404, { error: 'User not found' });

      await db.from('users').update({ balance: Number(user.balance) + amt }).eq('id', user.id);
      return jsonResponse(res, 200, { success: true, newBalance: Number(user.balance) + amt });
    }

    jsonResponse(res, 200, {
      house: {
        profit: Number(house?.profit || 0),
        todayProfit: Number(house?.today_profit || 0),
        totalRounds: house?.total_rounds || 0
      },
      currentExposure: bets,
      users: users || [],
      rounds: (rounds || []).map(r => ({
        id: r.id,
        winner: r.winner,
        pool: Number(r.pool),
        housePL: Number(r.house_pl),
        resolvedAt: r.resolved_at
      }))
    });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
};
