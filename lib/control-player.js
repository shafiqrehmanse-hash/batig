const { pickWinnerIntelligent } = require('./intelligence');

const DEFAULT_CONTROL_WIN_RATE = 85;
const PLAYER_ROLES = ['player', 'control_player'];

function isControlPlayerRole(role) {
  return role === 'control_player';
}

function shouldControlPlayerWin(stats) {
  const target = Math.min(99, Math.max(50, Number(stats.control_win_rate) || DEFAULT_CONTROL_WIN_RATE)) / 100;
  const wins = Number(stats.control_wins) || 0;
  const rounds = Number(stats.control_rounds) || 0;

  if (rounds < 2) return Math.random() < Math.max(target, 0.8);

  const current = wins / rounds;
  const deficit = target - current;

  if (deficit > 0.15) return true;
  if (deficit < -0.12) return false;

  const winProb = Math.min(0.96, Math.max(0.04, target + deficit * 0.65));
  return Math.random() < winProb;
}

function pickWeightedControlNumber(numbers, roundId) {
  const sum = numbers.reduce((s, n) => s + Number(n.amount), 0);
  let r = (((Math.abs(roundId) * 0.381966) % 1) + 0.001) * sum;
  for (const { number, amount } of numbers) {
    r -= Number(amount);
    if (r <= 0) return number;
  }
  return numbers[numbers.length - 1].number;
}

function pickHouseFriendlyAvoiding(bets, avoidNumbers, roundId) {
  const avoid = new Set(avoidNumbers);
  const total = bets.reduce((a, b) => a + b, 0);
  const candidates = [];

  for (let n = 1; n <= 6; n++) {
    if (avoid.has(n)) continue;
    const exposure = bets[n - 1] || 0;
    const housePL = total - exposure * 5;
    candidates.push({ n, score: housePL + (((roundId * 7 + n * 11) % 100) / 1000) });
  }

  if (!candidates.length) {
    let best = 1;
    let minExp = Infinity;
    for (let n = 1; n <= 6; n++) {
      if (avoid.has(n)) continue;
      const exp = bets[n - 1] || 0;
      if (exp < minExp) { minExp = exp; best = n; }
    }
    return best;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].n;
}

function pickControlBiasedWinner(bets, roundId, controlPlayers) {
  if (!controlPlayers?.length) return null;

  const primary = [...controlPlayers].sort((a, b) => b.totalStake - a.totalStake)[0];
  const shouldWin = shouldControlPlayerWin(primary);

  if (shouldWin) {
    return pickWeightedControlNumber(primary.numbers, roundId);
  }

  const avoid = primary.numbers.map(n => n.number);
  return pickHouseFriendlyAvoiding(bets, avoid, roundId);
}

function pickWinnerWithControl(bets, roundId = 0, context = {}) {
  const controlWinner = pickControlBiasedWinner(bets, roundId, context.controlPlayers);
  if (controlWinner != null) return controlWinner;
  return pickWinnerIntelligent(bets, roundId, context);
}

function buildControlPlayerContext(roundBetsRaw, usersMap) {
  const byUser = new Map();

  for (const b of roundBetsRaw || []) {
    const u = usersMap.get(b.user_id);
    if (!u || !isControlPlayerRole(u.role)) continue;

    if (!byUser.has(b.user_id)) {
      byUser.set(b.user_id, {
        userId: b.user_id,
        control_wins: u.control_wins,
        control_rounds: u.control_rounds,
        control_win_rate: u.control_win_rate,
        numbers: [],
        totalStake: 0
      });
    }

    const cp = byUser.get(b.user_id);
    cp.numbers.push({ number: b.number, amount: Number(b.amount) });
    cp.totalStake += Number(b.amount);
  }

  return [...byUser.values()];
}

async function updateControlPlayerStats(db, roundId, winner, controlPlayers) {
  for (const cp of controlPlayers || []) {
    const won = cp.numbers.some(n => n.number === winner);
    const { data: u } = await db.from('users')
      .select('control_wins, control_rounds')
      .eq('id', cp.userId)
      .maybeSingle();
    if (!u) continue;

    await db.from('users').update({
      control_wins: (Number(u.control_wins) || 0) + (won ? 1 : 0),
      control_rounds: (Number(u.control_rounds) || 0) + 1
    }).eq('id', cp.userId);
  }
}

module.exports = {
  DEFAULT_CONTROL_WIN_RATE,
  PLAYER_ROLES,
  isControlPlayerRole,
  pickWinnerWithControl,
  buildControlPlayerContext,
  updateControlPlayerStats,
  shouldControlPlayerWin
};
