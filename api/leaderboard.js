const { getDb } = require('../../lib/db');
const { jsonResponse, handleCors } = require('../../lib/game');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });

  try {
    const db = getDb();
    const { data: users } = await db
      .from('users')
      .select('username, balance, wins, rounds')
      .order('balance', { ascending: false })
      .limit(20);

    jsonResponse(res, 200, { leaderboard: users || [] });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
};
