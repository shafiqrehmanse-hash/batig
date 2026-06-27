const { getDb } = require('./db');
const { requireAuth, checkPassword, signToken, publicUser } = require('./auth');
const { getRoundInfo, jsonResponse, parseBody, LOCK_END_SECOND } = require('./game');
const { ensureRound, resolveRound, syncRoundSummary } = require('./resolve');

async function login(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });
  try {
    const { username, password } = parseBody(req);
    if (!username || !password) return jsonResponse(res, 400, { error: 'Username and password required' });

    const db = getDb();
    const { data: user, error: userErr } = await db.from('users').select('*').ilike('username', username).maybeSingle();
    if (userErr) return jsonResponse(res, 500, { error: userErr.message });
    if (!user || !(await checkPassword(password, user.password_hash))) {
      return jsonResponse(res, 401, { error: 'Invalid username or password' });
    }

    jsonResponse(res, 200, { token: signToken(user), user: publicUser(user) });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function round(req, res) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });
  try {
    const info = getRoundInfo();
    let current = await ensureRound(info.roundId);

    if (!current.resolved && info.phase === 'rolling' && info.sec >= LOCK_END_SECOND) {
      current = await resolveRound(info.roundId);
    }

    const prevRound = await ensureRound(info.roundId - 1);
    if (!prevRound.resolved) await resolveRound(info.roundId - 1).catch(() => {});

    let myBet = null;
    const auth = requireAuth(req);
    if (auth) {
      const db = getDb();
      const { data: bet } = await db.from('bets').select('*').eq('user_id', auth.id).eq('round_id', info.roundId).maybeSingle();
      if (bet) myBet = { number: bet.number, amount: Number(bet.amount), won: bet.won, payout: Number(bet.payout) };
    }

    const bets = (current.bets || [0, 0, 0, 0, 0, 0]).map(Number);

    jsonResponse(res, 200, {
      roundId: info.roundId,
      phase: info.phase,
      sec: info.sec,
      secLeft: info.secLeft,
      bets,
      pool: Number(current.pool) || bets.reduce((a, b) => a + b, 0),
      players: current.player_count || 0,
      winner: current.resolved ? current.winner : null,
      resolved: current.resolved,
      lastWinner: prevRound.resolved ? prevRound.winner : null,
      myBet,
      utc: new Date().toISOString()
    });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function bet(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });

  const auth = requireAuth(req);
  if (!auth) return jsonResponse(res, 401, { error: 'Unauthorized — please sign in again' });

  try {
    const { number, amount } = parseBody(req);
    const num = parseInt(number);
    const amt = parseInt(amount);

    if (!num || num < 1 || num > 6) return jsonResponse(res, 400, { error: 'Pick a number 1–6' });
    if (!amt || amt < 10) return jsonResponse(res, 400, { error: 'Minimum bet is PKR 10' });

    const info = getRoundInfo();
    if (info.phase !== 'betting') return jsonResponse(res, 400, { error: 'Betting is closed for this round' });

    const db = getDb();
    const { data: user } = await db.from('users').select('*').eq('id', auth.id).maybeSingle();
    if (!user) return jsonResponse(res, 404, { error: 'User not found' });
    if (Number(user.balance) < amt) return jsonResponse(res, 400, { error: 'Insufficient balance' });

    const { data: existing } = await db.from('bets').select('id').eq('user_id', auth.id).eq('round_id', info.roundId).maybeSingle();
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

    const current = await ensureRound(info.roundId);
    const bets = [...(current.bets || [0, 0, 0, 0, 0, 0])].map(Number);
    bets[num - 1] += amt;

    await db.from('rounds').update({
      bets,
      pool: Number(current.pool) + amt,
      player_count: (current.player_count || 0) + 1
    }).eq('id', info.roundId);

    await syncRoundSummary(info.roundId, bets, Number(current.pool) + amt);

    const { data: updated } = await db.from('users').select('*').eq('id', auth.id).single();

    jsonResponse(res, 200, {
      success: true,
      bet: { number: num, amount: amt },
      balance: Number(updated.balance)
    });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function leaderboard(req, res) {
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
}

async function admin(req, res) {
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
      const { username, amount } = parseBody(req);
      const amt = parseInt(amount);
      if (!username || !amt || amt <= 0) return jsonResponse(res, 400, { error: 'Invalid fund request' });

      const { data: user } = await db.from('users').select('*').ilike('username', username).maybeSingle();
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
}

async function resolveRoundRoute(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });
  try {
    const body = parseBody(req);
    const roundId = parseInt(body.roundId) || getRoundInfo().roundId;
    const resolved = await resolveRound(roundId);
    jsonResponse(res, 200, { ok: true, winner: resolved.winner, roundId });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function cmsSettings(req, res) {
  if (req.method === 'GET') {
    try {
      const db = getDb();
      const { data } = await db.from('cms_settings').select('*');
      return jsonResponse(res, 200, { settings: data || [] });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }
  if (req.method === 'POST') {
    const auth = requireAuth(req);
    if (!auth || !['owner'].includes(auth.role)) return jsonResponse(res, 403, { error: 'Owner only' });
    try {
      const { key, value } = parseBody(req);
      const db = getDb();
      await db.from('cms_settings').upsert({
        setting_key: key,
        setting_value: String(value),
        updated_by: auth.username,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
      return jsonResponse(res, 200, { ok: true });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }
  return jsonResponse(res, 405, { error: 'Method not allowed' });
}

async function rolePermissions(req, res) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });
  try {
    const role = (req.query && req.query.role) || parseBody(req).role || 'player';
    const db = getDb();
    const { data } = await db.from('role_permissions').select('*').eq('role', role).maybeSingle();
    jsonResponse(res, 200, { permissions: data || null });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function cronResolve(req, res) {
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
    const targetId = info.phase === 'rolling' && info.sec >= LOCK_END_SECOND ? info.roundId : info.roundId - 1;

    const db = getDb();
    const { data: round } = await db.from('rounds').select('resolved').eq('id', targetId).maybeSingle();

    if (round && !round.resolved) await resolveRound(targetId);

    jsonResponse(res, 200, { ok: true, resolved: targetId });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

module.exports = {
  login,
  round,
  bet,
  leaderboard,
  admin,
  'cron/resolve': cronResolve,
  'resolve-round': resolveRoundRoute,
  cms: cmsSettings,
  'role-permissions': rolePermissions
};
