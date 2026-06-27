const PAYOUT_MULTIPLIER = 5;
const BETTING_SECONDS = 45;
const LOCK_END_SECOND = 55;

function getRoundInfo(now = Date.now()) {
  const roundId = Math.floor(now / 60000);
  const roundStart = roundId * 60000;
  const sec = Math.floor((now - roundStart) / 1000);
  const secLeft = 60 - sec;

  let phase, phaseSecondsLeft;
  if (sec < BETTING_SECONDS) {
    phase = 'betting';
    phaseSecondsLeft = BETTING_SECONDS - sec;
  } else if (sec < LOCK_END_SECOND) {
    phase = 'locked';
    phaseSecondsLeft = LOCK_END_SECOND - sec;
  } else {
    phase = 'rolling';
    phaseSecondsLeft = secLeft;
  }

  return { roundId, roundStart, sec, secLeft, phase, phaseSecondsLeft };
}

/** Lowest exposure wins; tie-break by roundId % candidates */
function pickWinner(bets, roundId = 0) {
  const total = bets.reduce((a, b) => a + b, 0);
  if (total === 0) return Math.ceil(Math.random() * 6);

  const minExposure = Math.min(...bets);
  const candidates = [];
  for (let i = 0; i < 6; i++) {
    if (bets[i] === minExposure) candidates.push(i + 1);
  }
  if (candidates.length === 1) return candidates[0];
  return candidates[Math.abs(roundId) % candidates.length];
}

function simulateBotBets(bets) {
  const amounts = [50, 100, 200, 500, 1000];
  const botCount = 8 + Math.floor(Math.random() * 12);
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
  const body = JSON.stringify(data);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  if (typeof res.status === 'function') res.status(status).end(body);
  else { res.statusCode = status; res.end(body); }
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

function parseBody(req) {
  if (!req.body) return {};
  if (Buffer.isBuffer(req.body)) {
    try { return JSON.parse(req.body.toString()); } catch { return {}; }
  }
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

module.exports = {
  PAYOUT_MULTIPLIER, BETTING_SECONDS, LOCK_END_SECOND,
  getRoundInfo, pickWinner, simulateBotBets,
  jsonResponse, handleCors, parseBody
};
