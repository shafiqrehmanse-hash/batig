const { getDb } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { getRoundInfo, jsonResponse, handleCors } = require('../../lib/game');
const { ensureRound, resolveRound } = require('../../lib/resolve');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });

  try {
    const info = getRoundInfo();
    let round = await ensureRound(info.roundId);

    if (!round.resolved && info.phase === 'rolling' && info.sec >= 50) {
      round = await resolveRound(info.roundId);
    }

    const prevRound = await ensureRound(info.roundId - 1);
    if (!prevRound.resolved) {
      await resolveRound(info.roundId - 1).catch(() => {});
    }

    let myBet = null;
    const auth = requireAuth(req);
    if (auth) {
      const db = getDb();
      const { data: bet } = await db.from('bets').select('*').eq('user_id', auth.id).eq('round_id', info.roundId).single();
      if (bet) myBet = { number: bet.number, amount: Number(bet.amount), won: bet.won, payout: Number(bet.payout) };
    }

    const bets = (round.bets || [0, 0, 0, 0, 0, 0]).map(Number);

    jsonResponse(res, 200, {
      roundId: info.roundId,
      phase: info.phase,
      sec: info.sec,
      secLeft: info.secLeft,
      bets,
      pool: Number(round.pool) || bets.reduce((a, b) => a + b, 0),
      players: round.player_count || 0,
      winner: round.resolved ? round.winner : null,
      resolved: round.resolved,
      lastWinner: prevRound.resolved ? prevRound.winner : null,
      myBet,
      utc: new Date().toISOString()
    });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
};
