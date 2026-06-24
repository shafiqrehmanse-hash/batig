const PAYOUT_MULTIPLIER = 5;
const BETTING_SECONDS = 45;
const LOCKED_SECONDS = 5;
const ROLL_SECONDS = 10;

function getRoundInfo(now = Date.now()) {
  const roundId = Math.floor(now / 60000);
  const roundStart = roundId * 60000;
  const sec = Math.floor((now - roundStart) / 1000);
  const secLeft = 60 - sec;

  let phase;
  if (sec < BETTING_SECONDS) phase = 'betting';
  else if (sec < BETTING_SECONDS + LOCKED_SECONDS) phase = 'locked';
  else phase = 'rolling';

  return { roundId, roundStart, sec, secLeft, phase };
}

function genReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function pickWinner(bets, houseProfit = 0) {
  const total = bets.reduce((a, b) => a + b, 0);
  if (total === 0) return Math.ceil(Math.random() * 6);

  const weights = [];
  for (let i = 0; i < 6; i++) {
    const exposure = bets[i] * PAYOUT_MULTIPLIER;
    let w = 1 / (exposure + 100);

    if (bets[i] === 0) w *= 4;
    else if (bets[i] < total * 0.08) w *= 2.5;
    else if (bets[i] > total * 0.35) w *= 0.3;

    if (houseProfit < 0) {
      const lossFactor = 1 + Math.min(Math.abs(houseProfit) / 2000, 3);
      w *= lossFactor;
      if (exposure === 0) w *= 3;
    }

    if (houseProfit > 5000 && exposure > total * 0.2) w *= 1.5;
    weights.push(Math.max(w, 0.01));
  }

  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < 6; i++) {
    r -= weights[i];
    if (r <= 0) return i + 1;
  }
  return 6;
}

function simulateBotBets(bets) {
  const amounts = [50, 100, 200, 500, 1000];
  const botCount = 15 + Math.floor(Math.random() * 25);
  let pool = 0;
  for (let i = 0; i < botCount; i++) {
    const num = Math.ceil(Math.random() * 6) - 1;
    const amt = amounts[Math.floor(Math.random() * amounts.length)];
    bets[num] += amt;
    pool += amt;
  }
  return { bets, pool, playerCount: botCount };
}

function jsonResponse(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  res.status(status).json(data);
}

function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = {
  PAYOUT_MULTIPLIER, BETTING_SECONDS, LOCKED_SECONDS, ROLL_SECONDS,
  getRoundInfo, genReferralCode, pickWinner, simulateBotBets,
  jsonResponse, handleCors
};
