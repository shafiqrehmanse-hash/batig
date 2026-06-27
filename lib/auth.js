const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = () => process.env.JWT_SECRET || 'batig-dev-secret-change-me';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, isAdmin: user.is_admin },
    JWT_SECRET(),
    { expiresIn: '30d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET());
  } catch {
    return null;
  }
}

async function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function getTokenFromReq(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-auth-token'] || null;
}

function requireAuth(req) {
  const token = getTokenFromReq(req);
  if (!token) return null;
  return verifyToken(token);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    phone: user.phone || '',
    balance: Number(user.balance),
    referralCode: user.referral_code,
    referredBy: user.referred_by,
    wins: user.wins,
    rounds: user.rounds,
    isAdmin: user.is_admin,
    createdAt: user.created_at
  };
}

module.exports = {
  signToken, verifyToken, checkPassword,
  getTokenFromReq, requireAuth, publicUser
};
