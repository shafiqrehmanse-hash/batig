const { pickWinnerIntelligent } = require('./intelligence');

const PAYOUT_MULTIPLIER = 5;
const MAX_TRADES_PER_ROUND = 3;

/** Universal UTC-aligned trade durations (seconds per full cycle). */
const TRADE_DURATIONS = {
  1: { periodSec: 60, bettingSec: 45, lockEndSec: 55, rollStartSec: 55 },
  2: { periodSec: 120, bettingSec: 90, lockEndSec: 110, rollStartSec: 110 },
  3: { periodSec: 180, bettingSec: 135, lockEndSec: 170, rollStartSec: 170 }
};

const BETTING_SECONDS = TRADE_DURATIONS[1].bettingSec;
const LOCK_END_SECOND = TRADE_DURATIONS[1].lockEndSec;

function normalizeDuration(min) {
  const n = parseInt(min, 10) || 1;
  return TRADE_DURATIONS[n] ? n : 1;
}

/** slotId * 100 + durationMin — suffix 1–3 encodes mode; legacy ids have no suffix. */
function encodeRoundId(slotId, durationMin) {
  return Number(slotId) * 100 + normalizeDuration(durationMin);
}

function decodeRoundId(roundId) {
  const id = Number(roundId);
  const suffix = ((id % 100) + 100) % 100;
  if (suffix >= 1 && suffix <= 3) {
    return { slotId: Math.floor(id / 100), durationMin: suffix };
  }
  return { slotId: id, durationMin: 1 };
}

function prevEncodedRoundId(roundId) {
  const { slotId, durationMin } = decodeRoundId(roundId);
  return encodeRoundId(slotId - 1, durationMin);
}

function getRoundInfo(now = Date.now(), durationMin = 1) {
  const dur = normalizeDuration(durationMin);
  const cfg = TRADE_DURATIONS[dur];
  const periodMs = cfg.periodSec * 1000;
  const slotId = Math.floor(now / periodMs);
  const roundId = encodeRoundId(slotId, dur);
  const roundStart = slotId * periodMs;
  const sec = Math.floor((now - roundStart) / 1000);
  const secLeft = cfg.periodSec - sec;

  let phase;
  let phaseSecondsLeft;
  if (sec < cfg.bettingSec) {
    phase = 'betting';
    phaseSecondsLeft = cfg.bettingSec - sec;
  } else if (sec < cfg.lockEndSec) {
    phase = 'locked';
    phaseSecondsLeft = cfg.lockEndSec - sec;
  } else {
    phase = 'rolling';
    phaseSecondsLeft = secLeft;
  }

  return {
    roundId,
    slotId,
    durationMin: dur,
    periodSec: cfg.periodSec,
    bettingSec: cfg.bettingSec,
    lockEndSec: cfg.lockEndSec,
    rollStartSec: cfg.rollStartSec,
    roundStart,
    sec,
    secLeft,
    phase,
    phaseSecondsLeft
  };
}

/** Legacy 1-min round id (pre multi-duration). */
function legacyRoundId(slotId) {
  return Number(slotId);
}

function pickWinner(bets, roundId = 0, context = {}) {
  return pickWinnerIntelligent(bets, roundId, context);
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

function parseDurationParam(req) {
  const q = req.query || {};
  if (q.duration != null) return q.duration;
  if (q.d != null) return q.d;
  const raw = req.url || '';
  const m = raw.match(/[?&]duration=(\d)/);
  return m ? m[1] : 1;
}

module.exports = {
  PAYOUT_MULTIPLIER,
  MAX_TRADES_PER_ROUND,
  BETTING_SECONDS,
  LOCK_END_SECOND,
  TRADE_DURATIONS,
  normalizeDuration,
  encodeRoundId,
  decodeRoundId,
  prevEncodedRoundId,
  legacyRoundId,
  getRoundInfo,
  pickWinner,
  simulateBotBets,
  jsonResponse,
  handleCors,
  parseBody,
  parseDurationParam
};
