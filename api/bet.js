const { getDb } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { getRoundInfo, jsonResponse, handleCors } = require('../../lib/game');
const { ensureRound } = require('../../lib/resolve');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });

  const auth = requireAuth(req);
  if (!auth) return jsonResponse(res, 401, { error: 'Unauthorized' });

  try {
    const { number, amount } = req.body || {};
    const num = parseInt(number);
    const amt = parseInt(amount);

    if (!num || num < 1 || num > 6) return jsonResponse(res, 400, { error: 'Pick a number 1–6' });
    if (!amt || amt < 10) return jsonResponse(res, 400, { error: 'Minimum bet is PKR 10' });

    const info = getRoundInfo();
    if (info.phase !== 'betting') return jsonResponse(res, 400, { error: 'Betting is closed for this round' });

    const db = getDb();
    const { data: user } = await db.from('users').select('*').eq('id', auth.id).single();
    if (!user) return jsonResponse(res, 404, { error: 'User not found' });
    if (Number(user.balance) < amt) return jsonResponse(res, 400, { error: 'Insufficient balance' });

    const { data: existing } = await db.from('bets').select('id').eq('user_id', auth.id).eq('round_id', info.roundId).single();
    if (existing) return jsonResponse(res, 400, { error: 'You already bet this round' });

    await db.from('users').update({
      balance: Number(user.balance) - amt,
      rounds: user.rounds + 1
    }).eq('id', auth.id);

    await db.from('bets').insert({
      user_id: auth.id,
      round_id: info.roundId,
      number: num,
      amount: amt
    });

    const round = await ensureRound(info.roundId);
    const bets = [...(round.bets || [0, 0, 0, 0, 0, 0])].map(Number);
    bets[num - 1] += amt;
    const pool = Number(round.pool) + amt;
    const playerCount = (round.player_count || 0) + 1;

    await db.from('rounds').update({ bets, pool, player_count: playerCount }).eq('id', info.roundId);

    const { data: updated } = await db.from('users').select('*').eq('id', auth.id).single();

    jsonResponse(res, 200, {
      success: true,
      bet: { number: num, amount: amt },
      balance: Number(updated.balance)
    });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
};
