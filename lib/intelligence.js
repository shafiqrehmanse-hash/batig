const PAYOUT_MULTIPLIER = 5;
const TARGET_MARGIN_MIN = 0.10;
const TARGET_MARGIN_MAX = 0.15;
const TARGET_MARGIN_MID = 0.125;
const NEW_USER_ROUND_LIMIT = 15;

function getMarginRate(houseStats) {
  const pool = Number(houseStats?.recent_pool || 0);
  const profit = Number(houseStats?.recent_profit || 0);
  if (pool <= 0) return TARGET_MARGIN_MID;
  return profit / pool;
}

/**
 * Intelligent winner selection:
 * - Steers house margin toward 10–15% over recent rounds
 * - Slightly favors numbers where new users (< 15 rounds) placed bets
 * - Uses weighted randomness so outcomes feel natural
 */
function pickWinnerIntelligent(bets, roundId = 0, context = {}) {
  const total = bets.reduce((a, b) => a + b, 0);
  if (total === 0) return Math.ceil(Math.random() * 6);

  const { houseStats = {}, roundBets = [] } = context;
  const margin = getMarginRate(houseStats);
  const weights = [];

  for (let n = 1; n <= 6; n++) {
    const exposure = bets[n - 1] || 0;
    const payout = exposure * PAYOUT_MULTIPLIER;
    const housePL = total - payout;

    let w = Math.max(0.08, (housePL / total) + 0.45);

    if (margin < TARGET_MARGIN_MIN) {
      w *= 1 + (TARGET_MARGIN_MID - margin) * 3;
    } else if (margin > TARGET_MARGIN_MAX) {
      w *= 0.78;
      if (exposure > 0) w += 0.12;
    }

    const newUserStake = (roundBets || [])
      .filter(b => b.number === n && Number(b.user_rounds ?? 99) <= NEW_USER_ROUND_LIMIT)
      .reduce((s, b) => s + Number(b.amount), 0);
    if (newUserStake > 0) {
      w += (newUserStake / total) * 0.55;
    }

    const jitter = ((Math.sin(roundId * 13.7 + n * 2.3) + 1) / 2) * 0.06;
    weights.push({ n, w: Math.max(0.02, w + jitter) });
  }

  const sum = weights.reduce((s, x) => s + x.w, 0);
  let r = (((Math.abs(roundId) * 0.6180339887) % 1) + 0.001) * sum;
  for (const { n, w } of weights) {
    r -= w;
    if (r <= 0) return n;
  }
  return weights.sort((a, b) => b.w - a.w)[0].n;
}

function buildIntelligenceSnapshot(houseRow, recentRounds) {
  const rounds = recentRounds || [];
  const recentPool = rounds.reduce((s, r) => s + Number(r.pool || 0), 0);
  const recentProfit = rounds.reduce((s, r) => s + Number(r.house_pl || 0), 0);
  const recentPayouts = recentPool - recentProfit;
  const margin = recentPool > 0 ? recentProfit / recentPool : TARGET_MARGIN_MID;

  return {
    recent_pool: recentPool,
    recent_profit: recentProfit,
    recent_rounds: rounds.length,
    total_payouts: Number(houseRow?.total_payouts || 0) + recentPayouts,
    target_margin: TARGET_MARGIN_MID,
    margin_rate: margin,
    active_players: Number(houseRow?.active_players || 0)
  };
}

module.exports = {
  PAYOUT_MULTIPLIER,
  TARGET_MARGIN_MIN,
  TARGET_MARGIN_MAX,
  pickWinnerIntelligent,
  getMarginRate,
  buildIntelligenceSnapshot,
  NEW_USER_ROUND_LIMIT
};
