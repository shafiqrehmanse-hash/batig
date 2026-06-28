const { getDb } = require('./db');
const { pickWinner, simulateBotBets, PAYOUT_MULTIPLIER } = require('./game');
const { buildIntelligenceSnapshot } = require('./intelligence');
const { buildControlPlayerContext, updateControlPlayerStats } = require('./control-player');
const { isPromoUser, splitRoundTotals, walletField } = require('./promo-wallet');

async function ensureRound(roundId) {
  const db = getDb();
  const { data } = await db.from('rounds').select('*').eq('id', roundId).maybeSingle();
  if (data) return data;

  const { data: created, error } = await db.from('rounds').insert({ id: roundId }).select().single();
  if (error && error.code !== '23505') throw error;
  if (created) return created;

  const { data: existing } = await db.from('rounds').select('*').eq('id', roundId).maybeSingle();
  return existing;
}

async function syncRoundSummary(roundId, bets, pool, houseProfit = 0) {
  const db = getDb();
  await db.from('round_bets_summary').upsert({
    round_id: roundId,
    number_1_total: bets[0] || 0,
    number_2_total: bets[1] || 0,
    number_3_total: bets[2] || 0,
    number_4_total: bets[3] || 0,
    number_5_total: bets[4] || 0,
    number_6_total: bets[5] || 0,
    total_pool: pool,
    house_profit: houseProfit,
    updated_at: new Date().toISOString()
  }, { onConflict: 'round_id' });
}

async function resolveRound(roundId) {
  const db = getDb();
  let round = await ensureRound(roundId);
  if (round.resolved) return round;

  let bets = [...(round.bets || [0, 0, 0, 0, 0, 0])].map(Number);
  let pool = Number(round.pool) || 0;
  let playerCount = round.player_count || 0;

  if (pool === 0) {
    const sim = simulateBotBets([...bets]);
    bets = sim.bets;
    pool += sim.pool;
    playerCount += sim.playerCount;
  }

  const { data: houseRow } = await db.from('house_stats').select('*').eq('id', 1).maybeSingle();
  const { data: recentRounds } = await db.from('rounds')
    .select('pool, real_pool, house_pl')
    .eq('resolved', true)
    .order('id', { ascending: false })
    .limit(20);

  const { data: roundBetsRaw } = await db.from('bets').select('user_id, number, amount, is_promo').eq('round_id', roundId);
  const userIds = [...new Set((roundBetsRaw || []).map(b => b.user_id))];
  const usersMap = new Map();

  if (userIds.length) {
    const { data: usersData } = await db.from('users')
      .select('id, role, rounds, balance, promo_balance, control_wins, control_rounds, control_win_rate')
      .in('id', userIds);
    (usersData || []).forEach(u => usersMap.set(u.id, u));
  }

  const roundBets = [];
  for (const b of roundBetsRaw || []) {
    const u = usersMap.get(b.user_id);
    roundBets.push({ ...b, user_rounds: u?.rounds ?? 99 });
  }

  const controlPlayers = buildControlPlayerContext(roundBetsRaw, usersMap);
  const uniquePlayers = new Set((roundBetsRaw || []).map(b => b.user_id)).size;

  const winner = pickWinner(bets, roundId, {
    houseStats: {
      recent_pool: houseRow?.recent_pool,
      recent_profit: houseRow?.recent_profit
    },
    roundBets,
    controlPlayers
  });

  const { data: roundBetsAll } = await db.from('bets').select('*').eq('round_id', roundId);
  const totals = splitRoundTotals(roundBetsAll, usersMap, winner, PAYOUT_MULTIPLIER);

  for (const bet of roundBetsAll || []) {
    const won = bet.number === winner;
    const payout = won ? Number(bet.amount) * PAYOUT_MULTIPLIER : 0;
    const u = usersMap.get(bet.user_id);

    await db.from('bets').update({ won, payout }).eq('id', bet.id);

    if (won && u) {
      if (isPromoUser(u)) {
        const { data: fresh } = await db.from('users').select('promo_balance, wins').eq('id', bet.user_id).single();
        if (fresh) {
          await db.from('users').update({
            promo_balance: Number(fresh.promo_balance || 0) + payout,
            wins: fresh.wins + 1
          }).eq('id', bet.user_id);
        }
      } else {
        const { data: fresh } = await db.from('users').select('balance, wins').eq('id', bet.user_id).single();
        if (fresh) {
          await db.from('users').update({
            balance: Number(fresh.balance || 0) + payout,
            wins: fresh.wins + 1
          }).eq('id', bet.user_id);
        }
      }
    }
  }

  const realHousePL = totals.realHousePL;
  const today = new Date().toISOString().substr(0, 10);

  const roundPatch = {
    winner,
    bets,
    pool,
    player_count: playerCount,
    house_pl: realHousePL,
    resolved: true,
    resolved_at: new Date().toISOString()
  };
  if (totals.promoStake || totals.promoPayout) {
    roundPatch.promo_pool = totals.promoStake;
    roundPatch.promo_pl = totals.promoNet;
  }
  if (totals.realStake) {
    roundPatch.real_pool = totals.realStake;
  }

  await db.from('rounds').update(roundPatch).eq('id', roundId);
  await syncRoundSummary(roundId, bets, pool, realHousePL);

  if (controlPlayers.length) {
    await updateControlPlayerStats(db, roundId, winner, controlPlayers);
  }

  const updatedRecent = [
    { pool: totals.realStake || Number(round.real_pool) || 0, house_pl: realHousePL },
    ...(recentRounds || []).map(r => ({
      pool: Number(r.real_pool ?? r.pool) || 0,
      house_pl: Number(r.house_pl) || 0
    }))
  ].slice(0, 20);
  const intel = buildIntelligenceSnapshot(houseRow, updatedRecent);

  const houseProfit = Number(houseRow?.profit || 0);
  const todayProfit = houseRow?.today_date === today
    ? Number(houseRow.today_profit) + realHousePL
    : realHousePL;

  const housePatch = {
    id: 1,
    profit: houseProfit + realHousePL,
    today_profit: todayProfit,
    today_date: today,
    total_rounds: (houseRow?.total_rounds || 0) + 1,
    recent_pool: intel.recent_pool,
    recent_profit: intel.recent_profit,
    recent_rounds: intel.recent_rounds,
    total_payouts: Number(houseRow?.total_payouts || 0) + totals.realPayout,
    target_margin: intel.target_margin,
    active_players: uniquePlayers
  };

  if (totals.promoStake || totals.promoPayout) {
    housePatch.promo_pool = Number(houseRow?.promo_pool || 0) + totals.promoStake;
    housePatch.promo_payouts = Number(houseRow?.promo_payouts || 0) + totals.promoPayout;
    housePatch.promo_net = Number(houseRow?.promo_net || 0) + totals.promoNet;
  }

  await db.from('house_stats').upsert(housePatch, { onConflict: 'id' });

  const { data: resolved } = await db.from('rounds').select('*').eq('id', roundId).single();
  return resolved;
}

module.exports = { ensureRound, resolveRound, syncRoundSummary };
