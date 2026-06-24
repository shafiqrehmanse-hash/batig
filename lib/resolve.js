const { getDb } = require('../db');
const { pickWinner, simulateBotBets, PAYOUT_MULTIPLIER } = require('../game');

async function ensureRound(roundId) {
  const db = getDb();
  const { data } = await db.from('rounds').select('*').eq('id', roundId).single();
  if (data) return data;

  const { data: created, error } = await db.from('rounds').insert({ id: roundId }).select().single();
  if (error && error.code !== '23505') throw error;
  if (created) return created;

  const { data: existing } = await db.from('rounds').select('*').eq('id', roundId).single();
  return existing;
}

async function resolveRound(roundId) {
  const db = getDb();
  let round = await ensureRound(roundId);
  if (round.resolved) return round;

  let bets = [...(round.bets || [0, 0, 0, 0, 0, 0])].map(Number);
  let pool = Number(round.pool) || 0;
  let playerCount = round.player_count || 0;

  const sim = simulateBotBets([...bets]);
  bets = sim.bets;
  pool += sim.pool;
  playerCount += sim.playerCount;

  const { data: houseRow } = await db.from('house_stats').select('*').eq('id', 1).single();
  const houseProfit = Number(houseRow?.profit || 0);
  const winner = pickWinner(bets, houseProfit);

  const { data: roundBets } = await db.from('bets').select('*').eq('round_id', roundId);
  let totalPayout = 0;

  for (const bet of roundBets || []) {
    const won = bet.number === winner;
    const payout = won ? Number(bet.amount) * PAYOUT_MULTIPLIER : 0;
    totalPayout += payout;

    await db.from('bets').update({ won, payout }).eq('id', bet.id);

    if (won) {
      const { data: user } = await db.from('users').select('balance, wins').eq('id', bet.user_id).single();
      await db.from('users').update({
        balance: Number(user.balance) + payout,
        wins: user.wins + 1
      }).eq('id', bet.user_id);
    }
  }

  const housePL = pool - totalPayout;
  const today = new Date().toISOString().substr(0, 10);

  await db.from('rounds').update({
    winner,
    bets,
    pool,
    player_count: playerCount,
    house_pl: housePL,
    resolved: true,
    resolved_at: new Date().toISOString()
  }).eq('id', roundId);

  const todayProfit = houseRow?.today_date === today
    ? Number(houseRow.today_profit) + housePL
    : housePL;

  await db.from('house_stats').update({
    profit: houseProfit + housePL,
    today_profit: todayProfit,
    today_date: today,
    total_rounds: (houseRow?.total_rounds || 0) + 1
  }).eq('id', 1);

  const { data: resolved } = await db.from('rounds').select('*').eq('id', roundId).single();
  return resolved;
}

module.exports = { ensureRound, resolveRound };
