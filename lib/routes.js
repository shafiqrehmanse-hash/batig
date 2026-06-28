const bcrypt = require('bcryptjs');
const { getDb } = require('./db');
const { requireAuth, checkPassword, signToken, publicUser } = require('./auth');
const { getRolePermissions, requireStaff, STAFF_ROLES } = require('./permissions');
const {
  getRoundInfo, jsonResponse, parseBody, parseDurationParam, normalizeDuration,
  encodeRoundId, prevEncodedRoundId, legacyRoundId, TRADE_DURATIONS, MAX_TRADES_PER_ROUND
} = require('./game');
const { ensureRound, resolveRound, syncRoundSummary } = require('./resolve');
const {
  filterOwnerRows,
  visibleUserCount,
  getHiddenOwnerCount,
  maskAuditLogs,
  filterOwnerRequests,
  filterLeaderboard
} = require('./privacy');

function genReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const ROLE_RANK = { owner: 100, per_admin: 90, admin: 70, admin_assistant: 50, operator: 40, player: 0 };

async function writeAudit(db, action, actor, target, details) {
  try {
    await db.from('audit_logs').insert({
      action,
      actor_username: actor,
      target_username: target || null,
      details: details || ''
    });
  } catch (_) {}
}

function canBanTarget(actorRole, targetRole) {
  if (targetRole === 'owner') return false;
  return (ROLE_RANK[actorRole] || 0) > (ROLE_RANK[targetRole] || 0);
}

async function register(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });
  try {
    const { username, password, phone, referralCode } = parseBody(req);
    if (!username || username.length < 3) return jsonResponse(res, 400, { error: 'Username must be at least 3 characters' });
    if (!password || password.length < 4) return jsonResponse(res, 400, { error: 'Password must be at least 4 characters' });

    const db = getDb();
    const { data: existing } = await db.from('users').select('id').ilike('username', username).maybeSingle();
    if (existing) return jsonResponse(res, 400, { error: 'Username already taken' });

    let referrer = null;
    if (referralCode) {
      const { data: ref } = await db.from('users').select('*').eq('referral_code', referralCode.toUpperCase()).maybeSingle();
      if (!ref) return jsonResponse(res, 400, { error: 'Invalid referral code' });
      referrer = ref;
    }

    const { count } = await db.from('users').select('*', { count: 'exact', head: true });
    const isFirst = (count || 0) === 0;
    const passwordHash = await bcrypt.hash(password, 10);

    const { data: user, error } = await db.from('users').insert({
      username,
      password_hash: passwordHash,
      phone: phone || '',
      balance: 500,
      referral_code: genReferralCode(),
      referred_by: referrer?.id || null,
      is_admin: isFirst,
      role: isFirst ? 'owner' : 'player'
    }).select().single();

    if (error) return jsonResponse(res, 500, { error: error.message });

    let referralBonus = 0;
    if (referrer) {
      referralBonus = 100;
      await db.from('users').update({ balance: Number(referrer.balance) + 100 }).eq('id', referrer.id);
      await db.from('referrals').insert({ referrer_id: referrer.id, referred_id: user.id, bonus: 100 });
    }

    jsonResponse(res, 200, { token: signToken(user), user: publicUser(user), referralBonus });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function me(req, res) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });
  const auth = requireAuth(req);
  if (!auth) return jsonResponse(res, 401, { error: 'Unauthorized' });
  try {
    const db = getDb();
    const { data: user, error } = await db.from('users').select('*').eq('id', auth.id).maybeSingle();
    if (error || !user) return jsonResponse(res, 401, { error: 'Session expired — please sign in again' });
    if (user.is_banned) return jsonResponse(res, 403, { error: 'Account suspended — contact support' });
    jsonResponse(res, 200, { user: publicUser(user) });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function profile(req, res) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });
  const auth = requireAuth(req);
  if (!auth) return jsonResponse(res, 401, { error: 'Unauthorized' });
  try {
    const db = getDb();
    const { data: user, error: uErr } = await db.from('users').select('*').eq('id', auth.id).maybeSingle();
    if (uErr || !user) return jsonResponse(res, 401, { error: 'Session expired' });
    if (user.is_banned) return jsonResponse(res, 403, { error: 'Account suspended — contact support' });

    const { data: bets } = await db.from('bets')
      .select('number, amount, won, payout, round_id, rounds(winner)')
      .eq('user_id', auth.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const history = (bets || []).map(b => ({
      number: b.number,
      amount: Number(b.amount),
      won: b.won,
      payout: Number(b.payout),
      roundId: b.round_id,
      winner: b.rounds?.winner
    }));

    const { data: refs } = await db.from('referrals').select('bonus, referred_id').eq('referrer_id', auth.id);
    const referrals = [];
    for (const r of refs || []) {
      const { data: ru } = await db.from('users').select('username').eq('id', r.referred_id).maybeSingle();
      referrals.push({ username: ru?.username || 'User', bonus: Number(r.bonus) });
    }

    jsonResponse(res, 200, { user: publicUser(user), history, referrals });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

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
    if (user.is_banned) {
      return jsonResponse(res, 403, { error: 'Account suspended — contact support' });
    }

    jsonResponse(res, 200, { token: signToken(user), user: publicUser(user) });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function fetchUserBetsForRound(db, userId, info) {
  const { data: userBets } = await db.from('bets')
    .select('number, amount, won, payout')
    .eq('user_id', userId)
    .eq('round_id', info.roundId)
    .order('created_at', { ascending: true });
  let rows = userBets || [];
  if (!rows.length && info.durationMin === 1) {
    const legacyId = legacyRoundId(info.slotId);
    if (legacyId !== info.roundId) {
      const { data: legacyBets } = await db.from('bets')
        .select('number, amount, won, payout')
        .eq('user_id', userId)
        .eq('round_id', legacyId)
        .order('created_at', { ascending: true });
      rows = legacyBets || [];
    }
  }
  return rows.map(b => ({
    number: b.number,
    amount: Number(b.amount),
    won: b.won,
    payout: Number(b.payout)
  }));
}

async function round(req, res) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });
  try {
    const durationMin = normalizeDuration(parseDurationParam(req));
    const info = getRoundInfo(Date.now(), durationMin);
    const current = await ensureRound(info.roundId);
    const prevRoundId = prevEncodedRoundId(info.roundId);
    const prevRound = await ensureRound(prevRoundId);

    let myBet = null;
    let myBets = [];
    const auth = requireAuth(req);
    if (auth) {
      const db = getDb();
      myBets = await fetchUserBetsForRound(db, auth.id, info);
      if (myBets.length) myBet = myBets[myBets.length - 1];
    }

    const bets = (current.bets || [0, 0, 0, 0, 0, 0]).map(Number);

    jsonResponse(res, 200, {
      roundId: info.roundId,
      durationMin: info.durationMin,
      periodSec: info.periodSec,
      bettingSec: info.bettingSec,
      lockEndSec: info.lockEndSec,
      rollStartSec: info.rollStartSec,
      phase: info.phase,
      sec: info.sec,
      secLeft: info.secLeft,
      bets,
      pool: Number(current.pool) || bets.reduce((a, b) => a + b, 0),
      players: current.player_count || 0,
      winner: current.resolved ? current.winner : null,
      resolved: current.resolved,
      lastWinner: prevRound?.resolved ? prevRound.winner : null,
      myBet,
      myBets,
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
    const body = parseBody(req);
    let numbers = body.numbers;
    if (!numbers && body.number != null) numbers = [body.number];
    if (!Array.isArray(numbers)) numbers = [numbers];
    numbers = [...new Set(numbers.map((n) => parseInt(n)).filter((n) => n >= 1 && n <= 6))];
    const amt = parseInt(body.amount);

    if (!numbers.length) return jsonResponse(res, 400, { error: 'Pick at least one number (1–6)' });
    if (!amt || amt < 10) return jsonResponse(res, 400, { error: 'Minimum bet is PKR 10' });

    const durationMin = normalizeDuration(body.duration);
    const info = getRoundInfo(Date.now(), durationMin);
    if (info.phase !== 'betting') return jsonResponse(res, 400, { error: 'Betting is closed for this round' });

    const db = getDb();
    const { data: user } = await db.from('users').select('*').eq('id', auth.id).maybeSingle();
    if (!user) return jsonResponse(res, 404, { error: 'User not found' });
    if (user.is_banned) return jsonResponse(res, 403, { error: 'Account suspended — contact support' });

    const { data: allBets } = await db.from('bets').select('id, number, amount')
      .eq('user_id', auth.id).eq('round_id', info.roundId);

    const existingByNum = new Map((allBets || []).map((b) => [b.number, b]));
    const existingNums = new Set((allBets || []).map((b) => b.number));
    const newNums = numbers.filter((n) => !existingNums.has(n));
    if (existingNums.size + newNums.length > MAX_TRADES_PER_ROUND) {
      return jsonResponse(res, 400, {
        error: `Maximum ${MAX_TRADES_PER_ROUND} trades per round`
      });
    }

    const totalCost = amt * numbers.length;
    if (Number(user.balance) < totalCost) {
      return jsonResponse(res, 400, { error: 'Insufficient balance for ' + numbers.length + ' trade(s)' });
    }

    const isFirstBetThisRound = !(allBets || []).length;
    let newBal = Number(user.balance) - totalCost;

    const userPatch = {
      balance: newBal,
      rounds: isFirstBetThisRound ? user.rounds + 1 : user.rounds,
      last_trade_at: new Date().toISOString()
    };
    const { error: userUpdErr } = await db.from('users').update(userPatch).eq('id', auth.id);
    if (userUpdErr && /last_trade_at/i.test(userUpdErr.message || '')) {
      await db.from('users').update({
        balance: newBal,
        rounds: isFirstBetThisRound ? user.rounds + 1 : user.rounds
      }).eq('id', auth.id);
    } else if (userUpdErr) {
      throw new Error(userUpdErr.message);
    }

    const placed = [];
    for (const num of numbers) {
      const existing = existingByNum.get(num);
      if (existing) {
        const newAmount = Number(existing.amount) + amt;
        await db.from('bets').update({ amount: newAmount }).eq('id', existing.id);
        existingByNum.set(num, { ...existing, amount: newAmount });
        placed.push({ number: num, amount: amt, stacked: true });
      } else {
        await db.from('bets').insert({
          user_id: auth.id,
          round_id: info.roundId,
          number: num,
          amount: amt
        });
        existingByNum.set(num, { number: num, amount: amt });
        placed.push({ number: num, amount: amt });
      }
    }

    const current = await ensureRound(info.roundId);
    const bets = [...(current.bets || [0, 0, 0, 0, 0, 0])].map(Number);
    numbers.forEach((num) => { bets[num - 1] += amt; });

    const isNewPlayerThisRound = !(allBets || []).length;
    await db.from('rounds').update({
      bets,
      pool: Number(current.pool) + totalCost,
      player_count: isNewPlayerThisRound ? (current.player_count || 0) + 1 : current.player_count
    }).eq('id', info.roundId);

    await syncRoundSummary(info.roundId, bets, Number(current.pool) + totalCost);

    const { data: updatedBets } = await db.from('bets')
      .select('number, amount')
      .eq('user_id', auth.id).eq('round_id', info.roundId)
      .order('created_at', { ascending: true });

    jsonResponse(res, 200, {
      success: true,
      placed,
      roundId: info.roundId,
      durationMin: info.durationMin,
      myBets: (updatedBets || []).map((b) => ({ number: b.number, amount: Number(b.amount) })),
      balance: newBal,
      cooldownSec: 0
    });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function leaderboard(req, res) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });
  try {
    const db = getDb();
    const viewer = requireAuth(req);
    const { data: users } = await db
      .from('users')
      .select('username, balance, wins, rounds, role, id')
      .order('balance', { ascending: false })
      .limit(20);

    const masked = await filterLeaderboard(users || [], db, viewer);
    jsonResponse(res, 200, { leaderboard: masked });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function admin(req, res) {
  const auth = requireAuth(req);
  if (!auth || !requireStaff(auth)) return jsonResponse(res, 403, { error: 'Admin only' });

  try {
    const db = getDb();
    const perms = await getRolePermissions(db, auth.role);
    const { data: house } = await db.from('house_stats').select('*').eq('id', 1).single();
    const { data: rounds } = await db.from('rounds').select('*').eq('resolved', true).order('id', { ascending: false }).limit(15);

    const info = getRoundInfo();
    const current = await ensureRound(info.roundId);
    const bets = (current.bets || [0, 0, 0, 0, 0, 0]).map(Number);

    if (req.method === 'POST') {
      if (!perms.can_add_funds) return jsonResponse(res, 403, { error: 'No permission to add funds' });
      const { username, amount } = parseBody(req);
      const amt = parseInt(amount);
      if (!username || !amt || amt <= 0) return jsonResponse(res, 400, { error: 'Invalid fund request' });

      const { data: user } = await db.from('users').select('*').ilike('username', username).maybeSingle();
      if (!user) return jsonResponse(res, 404, { error: 'User not found' });

      await db.from('users').update({ balance: Number(user.balance) + amt }).eq('id', user.id);
      return jsonResponse(res, 200, { success: true, newBalance: Number(user.balance) + amt });
    }

    let users = [];
    let usersCount = 0;
    if (perms.can_manage_users) {
      const { data } = await db.from('users')
        .select('id, username, balance, wins, rounds, referred_by, is_admin, role, is_banned')
        .order('created_at', { ascending: false });
      users = data || [];
      usersCount = filterOwnerRows(users, auth).length;
    } else if (perms.can_view_financials) {
      const { count } = await db.from('users').select('*', { count: 'exact', head: true });
      const hiddenOwners = auth.role === 'owner' ? 0 : await getHiddenOwnerCount(db);
      usersCount = visibleUserCount(count || 0, auth, hiddenOwners);
    }

    const payload = {
      currentExposure: bets
    };

    if (perms.can_view_financials) {
      payload.house = {
        profit: Number(house?.profit || 0),
        todayProfit: Number(house?.today_profit || 0),
        totalRounds: house?.total_rounds || 0
      };
      payload.usersCount = usersCount;
    }

    if (perms.can_manage_rounds || perms.can_view_financials) {
      payload.rounds = (rounds || []).map(r => ({
        id: r.id,
        winner: r.winner,
        pool: Number(r.pool),
        housePL: Number(r.house_pl),
        resolvedAt: r.resolved_at
      }));
    }

    if (perms.can_manage_users) payload.users = filterOwnerRows(users, auth);

    jsonResponse(res, 200, payload);
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function adminRoles(req, res) {
  const auth = requireAuth(req);
  if (!auth || !requireStaff(auth)) return jsonResponse(res, 403, { error: 'Admin only' });

  const db = getDb();
  const perms = await getRolePermissions(db, auth.role);

  if (req.method === 'GET') {
    if (!perms.can_manage_roles) return jsonResponse(res, 403, { error: 'Owner only' });
    try {
      let migrationRequired = false;
      let { data: users, error } = await db.from('users')
        .select('id, username, role, balance, created_at, control_win_rate, control_wins, control_rounds')
        .order('created_at', { ascending: false });

      if (error && /control_win_rate|control_wins|control_rounds/i.test(error.message || '')) {
        migrationRequired = true;
        const fallback = await db.from('users')
          .select('id, username, role, balance, created_at')
          .order('created_at', { ascending: false });
        if (fallback.error) return jsonResponse(res, 500, { error: fallback.error.message });
        users = (fallback.data || []).map(u => ({
          ...u,
          control_win_rate: 85,
          control_wins: 0,
          control_rounds: 0
        }));
      } else if (error) {
        return jsonResponse(res, 500, { error: error.message });
      }

      return jsonResponse(res, 200, { users: users || [], migrationRequired });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  if (req.method === 'POST') {
    if (!perms.can_manage_roles) return jsonResponse(res, 403, { error: 'Owner only' });
    try {
      const { userId, role, controlWinRate } = parseBody(req);
      if (!userId || !role) return jsonResponse(res, 400, { error: 'userId and role required' });
      const validRoles = [...STAFF_ROLES, 'player', 'control_player'];
      if (!validRoles.includes(role)) {
        return jsonResponse(res, 400, { error: 'Invalid role' });
      }

      const { data: currentUser } = await db.from('users').select('role').eq('id', userId).maybeSingle();
      const patch = {
        role,
        is_admin: STAFF_ROLES.includes(role)
      };

      if (role === 'control_player') {
        patch.control_win_rate = Math.min(99, Math.max(50, parseInt(controlWinRate, 10) || 85));
        if (currentUser?.role !== 'control_player') {
          patch.control_wins = 0;
          patch.control_rounds = 0;
        }
      }

      let { error } = await db.from('users').update(patch).eq('id', userId);
      if (error && role === 'control_player' && /control_win_rate|control_player|users_role_check/i.test(error.message || '')) {
        if (/control_win_rate|control_wins|control_rounds/i.test(error.message || '')) {
          return jsonResponse(res, 400, {
            error: 'Control Player needs DB migration — run supabase/migrations/v13_control_player.sql in Supabase SQL Editor, then try again.'
          });
        }
        return jsonResponse(res, 400, { error: error.message });
      }
      if (error) return jsonResponse(res, 500, { error: error.message });
      return jsonResponse(res, 200, { ok: true });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  return jsonResponse(res, 405, { error: 'Method not allowed' });
}

async function depositsRoute(req, res) {
  const auth = requireAuth(req);
  if (!auth) return jsonResponse(res, 401, { error: 'Unauthorized' });

  const db = getDb();
  const perms = await getRolePermissions(db, auth.role);
  const body = parseBody(req);
  const action = (req.query && req.query.action) || body.action || 'submit';

  try {
    if (action === 'submit' && req.method === 'POST') {
      const { method, amount, screenshotData, screenshotSizeKb } = body;
      const amt = parseInt(amount);
      if (!amt || amt < 50) return jsonResponse(res, 400, { error: 'Minimum deposit PKR 50' });
      if (!['easypaisa', 'jazzcash'].includes(method)) return jsonResponse(res, 400, { error: 'Select Easypaisa or JazzCash' });
      if (!screenshotData) return jsonResponse(res, 400, { error: 'Upload payment screenshot' });

      const { data: u } = await db.from('users').select('is_banned').eq('id', auth.id).maybeSingle();
      if (u?.is_banned) return jsonResponse(res, 403, { error: 'Account suspended — contact support' });

      const { error } = await db.from('deposit_requests').insert({
        user_id: auth.id,
        username: auth.username,
        amount: amt,
        method,
        screenshot_data: screenshotData,
        screenshot_size_kb: screenshotSizeKb || null,
        status: 'pending'
      });
      if (error) return jsonResponse(res, 500, { error: error.message });
      return jsonResponse(res, 200, { ok: true });
    }

    if (action === 'mine' && req.method === 'GET') {
      const { data } = await db.from('deposit_requests')
        .select('id, amount, method, status, screenshot_size_kb, created_at, processed_at')
        .eq('user_id', auth.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return jsonResponse(res, 200, { requests: data || [] });
    }

    if (action === 'pending' && req.method === 'GET') {
      if (!perms.can_add_funds) return jsonResponse(res, 403, { error: 'No permission' });
      const { data, error } = await db.from('deposit_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return jsonResponse(res, 500, { error: error.message });
      return jsonResponse(res, 200, { requests: await filterOwnerRequests(data || [], db, auth) });
    }

    if (action === 'approve' && req.method === 'POST') {
      if (!perms.can_add_funds) return jsonResponse(res, 403, { error: 'No permission' });
      const { id } = body;
      const { data: reqRow, error: rErr } = await db.from('deposit_requests').select('*').eq('id', id).maybeSingle();
      if (rErr || !reqRow) return jsonResponse(res, 404, { error: 'Request not found' });
      if (reqRow.status !== 'pending') return jsonResponse(res, 400, { error: 'Already processed' });

      const { data: u, error: uErr } = await db.from('users').select('*').eq('id', reqRow.user_id).maybeSingle();
      if (uErr || !u) return jsonResponse(res, 404, { error: 'User not found' });

      const newBal = Number(u.balance) + Number(reqRow.amount);
      await db.from('users').update({ balance: newBal }).eq('id', u.id);
      await db.from('deposit_requests').update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: auth.username
      }).eq('id', id);

      return jsonResponse(res, 200, {
        newBalance: newBal,
        username: u.username,
        amount: reqRow.amount
      });
    }

    if (action === 'reject' && req.method === 'POST') {
      if (!perms.can_add_funds) return jsonResponse(res, 403, { error: 'No permission' });
      const { id, note } = body;
      const { error } = await db.from('deposit_requests').update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
        processed_by: auth.username,
        admin_note: note || ''
      }).eq('id', id);
      if (error) return jsonResponse(res, 500, { error: error.message });
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 400, { error: 'Unknown deposit action' });
  } catch (e) {
    return jsonResponse(res, 500, { error: e.message });
  }
}

async function withdrawalsRoute(req, res) {
  const auth = requireAuth(req);
  if (!auth) return jsonResponse(res, 401, { error: 'Unauthorized' });

  const db = getDb();
  const perms = await getRolePermissions(db, auth.role);
  const body = parseBody(req);
  const action = (req.query && req.query.action) || body.action || 'submit';

  try {
    if (action === 'submit' && req.method === 'POST') {
      const { amount, accountName, accountNumber, method } = body;
      const amt = parseInt(amount);
      if (!amt || amt < 100) return jsonResponse(res, 400, { error: 'Minimum withdrawal PKR 100' });
      if (!accountName?.trim()) return jsonResponse(res, 400, { error: 'Enter account holder name' });
      if (!accountNumber?.trim()) return jsonResponse(res, 400, { error: 'Enter account number' });
      if (!['easypaisa', 'jazzcash'].includes(method)) return jsonResponse(res, 400, { error: 'Select Easypaisa or JazzCash' });

      const { data: u, error: uErr } = await db.from('users').select('*').eq('id', auth.id).single();
      if (uErr || !u) return jsonResponse(res, 404, { error: 'User not found' });
      if (u.is_banned) return jsonResponse(res, 403, { error: 'Account suspended — contact support' });
      if (Number(u.balance) < amt) return jsonResponse(res, 400, { error: 'Insufficient balance' });

      const newBal = Number(u.balance) - amt;
      await db.from('users').update({ balance: newBal }).eq('id', auth.id);

      const { error } = await db.from('withdrawal_requests').insert({
        user_id: auth.id,
        username: auth.username,
        amount: amt,
        account_name: accountName.trim(),
        account_number: accountNumber.trim(),
        method,
        status: 'pending'
      });
      if (error) {
        await db.from('users').update({ balance: Number(u.balance) }).eq('id', auth.id);
        return jsonResponse(res, 500, { error: error.message });
      }
      return jsonResponse(res, 200, { ok: true, balance: newBal });
    }

    if (action === 'mine' && req.method === 'GET') {
      const { data } = await db.from('withdrawal_requests')
        .select('id, amount, method, account_name, account_number, status, created_at, processed_at, proof_data')
        .eq('user_id', auth.id)
        .order('created_at', { ascending: false })
        .limit(20);
      return jsonResponse(res, 200, { requests: data || [] });
    }

    if (action === 'pending' && req.method === 'GET') {
      if (!perms.can_withdraw_funds) return jsonResponse(res, 403, { error: 'No permission' });
      const { data, error } = await db.from('withdrawal_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return jsonResponse(res, 500, { error: error.message });
      return jsonResponse(res, 200, { requests: await filterOwnerRequests(data || [], db, auth) });
    }

    if (action === 'sent' && req.method === 'POST') {
      if (!perms.can_withdraw_funds) return jsonResponse(res, 403, { error: 'No permission' });
      const { id, proofData, proofSizeKb } = body;
      if (!proofData) return jsonResponse(res, 400, { error: 'Upload payment proof screenshot' });

      const { data: reqRow, error: rErr } = await db.from('withdrawal_requests').select('*').eq('id', id).maybeSingle();
      if (rErr || !reqRow) return jsonResponse(res, 404, { error: 'Request not found' });
      if (reqRow.status !== 'pending') return jsonResponse(res, 400, { error: 'Already processed' });

      const { data: wu } = await db.from('users').select('id, username, role').eq('id', reqRow.user_id).maybeSingle();

      const { error } = await db.from('withdrawal_requests').update({
        status: 'sent',
        proof_data: proofData,
        proof_size_kb: proofSizeKb || null,
        processed_at: new Date().toISOString(),
        processed_by: auth.username
      }).eq('id', id);
      if (error) return jsonResponse(res, 500, { error: error.message });
      return jsonResponse(res, 200, {
        username: (wu || { username: reqRow.username }).username,
        amount: reqRow.amount,
        sizeKB: proofSizeKb
      });
    }

    if (action === 'reject' && req.method === 'POST') {
      if (!perms.can_withdraw_funds) return jsonResponse(res, 403, { error: 'No permission' });
      const { id, note } = body;
      const { data: reqRow, error: rErr } = await db.from('withdrawal_requests').select('*').eq('id', id).maybeSingle();
      if (rErr || !reqRow) return jsonResponse(res, 404, { error: 'Request not found' });
      if (reqRow.status !== 'pending') return jsonResponse(res, 400, { error: 'Already processed' });

      const { data: u } = await db.from('users').select('*').eq('id', reqRow.user_id).maybeSingle();
      if (u) {
        await db.from('users').update({ balance: Number(u.balance) + Number(reqRow.amount) }).eq('id', u.id);
      }
      const { error } = await db.from('withdrawal_requests').update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
        processed_by: auth.username,
        admin_note: note || ''
      }).eq('id', id);
      if (error) return jsonResponse(res, 500, { error: error.message });
      return jsonResponse(res, 200, {
        refunded: Number(reqRow.amount),
        username: (u || { username: reqRow.username }).username
      });
    }

    return jsonResponse(res, 400, { error: 'Unknown withdrawal action' });
  } catch (e) {
    return jsonResponse(res, 500, { error: e.message });
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
    if (!auth) return jsonResponse(res, 403, { error: 'Unauthorized' });
    try {
      const { key, value } = parseBody(req);
      const db = getDb();
      const perms = await getRolePermissions(db, auth.role);
      const isPaymentKey = String(key || '').startsWith('payment.');
      if (isPaymentKey) {
        if (!perms.can_add_funds) return jsonResponse(res, 403, { error: 'No permission' });
      } else if (!perms.can_edit_cms) {
        return jsonResponse(res, 403, { error: 'Owner only' });
      }
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
    const permissions = await getRolePermissions(db, role);
    jsonResponse(res, 200, { permissions });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

async function adminBan(req, res) {
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });
  const auth = requireAuth(req);
  if (!auth || !requireStaff(auth)) return jsonResponse(res, 403, { error: 'Admin only' });

  try {
    const db = getDb();
    const perms = await getRolePermissions(db, auth.role);
    if (!perms.can_ban_users) return jsonResponse(res, 403, { error: 'No permission to ban users' });

    const { userId, ban } = parseBody(req);
    if (!userId) return jsonResponse(res, 400, { error: 'userId required' });

    const { data: target, error: tErr } = await db.from('users').select('*').eq('id', userId).maybeSingle();
    if (tErr || !target) return jsonResponse(res, 404, { error: 'User not found' });
    if (target.id === auth.id) return jsonResponse(res, 400, { error: 'You cannot ban yourself' });
    if (!canBanTarget(auth.role, target.role || 'player')) {
      return jsonResponse(res, 403, { error: 'Cannot ban this user — insufficient rank' });
    }

    const shouldBan = ban !== false;
    const { error } = await db.from('users').update({
      is_banned: shouldBan,
      banned_at: shouldBan ? new Date().toISOString() : null,
      banned_by: shouldBan ? auth.username : null
    }).eq('id', userId);
    if (error) return jsonResponse(res, 500, { error: error.message });

    await writeAudit(db, shouldBan ? 'user_banned' : 'user_unbanned', auth.username, target.username,
      shouldBan ? 'Account suspended' : 'Account restored');

    return jsonResponse(res, 200, {
      ok: true,
      username: target.username,
      banned: shouldBan
    });
  } catch (e) {
    return jsonResponse(res, 500, { error: e.message });
  }
}

async function adminLogs(req, res) {
  if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'Method not allowed' });
  const auth = requireAuth(req);
  if (!auth || !requireStaff(auth)) return jsonResponse(res, 403, { error: 'Admin only' });

  try {
    const db = getDb();
    const perms = await getRolePermissions(db, auth.role);
    if (!perms.can_view_logs) return jsonResponse(res, 403, { error: 'No permission' });

    const { data, error } = await db.from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return jsonResponse(res, 500, { error: error.message });
    const logs = await maskAuditLogs(data || [], db, auth);
    return jsonResponse(res, 200, { logs });
  } catch (e) {
    return jsonResponse(res, 500, { error: e.message });
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
    const db = getDb();
    const resolvedIds = [];

    for (const dur of Object.keys(TRADE_DURATIONS).map(Number)) {
      const info = getRoundInfo(Date.now(), dur);
      const inRoll = info.phase === 'rolling' && info.sec >= info.lockEndSec;
      const targetId = inRoll ? info.roundId : prevEncodedRoundId(info.roundId);
      const { data: round } = await db.from('rounds').select('resolved').eq('id', targetId).maybeSingle();
      if (round && !round.resolved) {
        await resolveRound(targetId);
        resolvedIds.push(targetId);
      }
      if (dur === 1) {
        const legacyId = legacyRoundId(inRoll ? info.slotId : info.slotId - 1);
        if (legacyId !== targetId) {
          const { data: legacyRound } = await db.from('rounds').select('resolved').eq('id', legacyId).maybeSingle();
          if (legacyRound && !legacyRound.resolved) {
            await resolveRound(legacyId);
            resolvedIds.push(legacyId);
          }
        }
      }
    }

    jsonResponse(res, 200, { ok: true, resolved: resolvedIds });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
}

module.exports = {
  login,
  register,
  me,
  profile,
  round,
  bet,
  leaderboard,
  admin,
  'admin/roles': adminRoles,
  'admin/ban': adminBan,
  'admin/logs': adminLogs,
  deposits: depositsRoute,
  withdrawals: withdrawalsRoute,
  'cron/resolve': cronResolve,
  'resolve-round': resolveRoundRoute,
  cms: cmsSettings,
  'role-permissions': rolePermissions
};
