const { getDb } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { getRoundInfo, jsonResponse, handleCors } = require('../../lib/game');
const { resolveRound } = require('../../lib/resolve');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (req.headers['x-vercel-cron'] !== '1') {
      return jsonResponse(res, 401, { error: 'Unauthorized' });
    }
  }

  try {
    const info = getRoundInfo();
    const targetId = info.phase === 'rolling' && info.sec >= 50 ? info.roundId : info.roundId - 1;

    const db = getDb();
    const { data: round } = await db.from('rounds').select('resolved').eq('id', targetId).single();

    if (round && !round.resolved) {
      await resolveRound(targetId);
    }

    jsonResponse(res, 200, { ok: true, resolved: targetId });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
};
