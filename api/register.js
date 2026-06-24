const { getDb } = require('../../lib/db');
const { hashPassword, checkPassword, signToken, publicUser } = require('../../lib/auth');
const { genReferralCode, jsonResponse, handleCors } = require('../../lib/game');

const SIGNUP_BONUS = 500;
const REFERRAL_BONUS = 100;

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' });

  try {
    const { username, password, phone, referralCode } = req.body || {};
    if (!username || username.length < 3) return jsonResponse(res, 400, { error: 'Username must be at least 3 characters' });
    if (!password || password.length < 4) return jsonResponse(res, 400, { error: 'Password must be at least 4 characters' });

    const db = getDb();
    const { data: existing } = await db.from('users').select('id').ilike('username', username).single();
    if (existing) return jsonResponse(res, 400, { error: 'Username already taken' });

    let referrer = null;
    if (referralCode) {
      const { data: ref } = await db.from('users').select('*').eq('referral_code', referralCode.toUpperCase()).single();
      if (!ref) return jsonResponse(res, 400, { error: 'Invalid referral code' });
      referrer = ref;
    }

    const { count } = await db.from('users').select('*', { count: 'exact', head: true });
    const isFirst = (count || 0) === 0;

    let code = genReferralCode();
    for (let i = 0; i < 5; i++) {
      const { data: dup } = await db.from('users').select('id').eq('referral_code', code).single();
      if (!dup) break;
      code = genReferralCode();
    }

    const passwordHash = await hashPassword(password);
    const { data: user, error } = await db.from('users').insert({
      username,
      password_hash: passwordHash,
      phone: phone || '',
      balance: SIGNUP_BONUS,
      referral_code: code,
      referred_by: referrer?.id || null,
      is_admin: isFirst
    }).select().single();

    if (error) return jsonResponse(res, 500, { error: error.message });

    if (referrer) {
      await db.from('users').update({ balance: Number(referrer.balance) + REFERRAL_BONUS }).eq('id', referrer.id);
      await db.from('referrals').insert({
        referrer_id: referrer.id,
        referred_id: user.id,
        bonus: REFERRAL_BONUS
      });
    }

    const token = signToken(user);
    jsonResponse(res, 201, { token, user: publicUser(user), referralBonus: referrer ? REFERRAL_BONUS : 0 });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
};
