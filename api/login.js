const { getDb } = require('./lib/db');
const { checkPassword, signToken, publicUser } = require('./lib/auth');
const { jsonResponse, handleCors, parseBody } = require('./lib/game');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
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

    const token = signToken(user);
    jsonResponse(res, 200, { token, user: publicUser(user) });
  } catch (e) {
    jsonResponse(res, 500, { error: e.message });
  }
};
