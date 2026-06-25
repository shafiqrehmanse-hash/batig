const { getDb } = require('./lib/db');
const { jsonResponse, handleCors } = require('./lib/game');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const status = {
    ok: false,
    supabaseUrl: !!(process.env.SUPABASE_URL || '').trim(),
    supabaseKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    jwtSecret: !!(process.env.JWT_SECRET || '').trim(),
    database: false,
    message: ''
  };

  if (!status.supabaseUrl || !status.supabaseKey) {
    status.message = 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then Redeploy';
    return jsonResponse(res, 200, status);
  }

  if (!status.jwtSecret) {
    status.message = 'Add JWT_SECRET in Vercel, then Redeploy';
    return jsonResponse(res, 200, status);
  }

  try {
    const db = getDb();
    const { error } = await db.from('users').select('id', { count: 'exact', head: true });
    if (error) {
      status.message = error.message.includes('schema cache') || error.message.includes('does not exist')
        ? 'Run supabase/schema.sql in Supabase SQL Editor first'
        : error.message;
      return jsonResponse(res, 200, status);
    }
    status.database = true;
    status.ok = true;
    status.message = 'All good — you can register';
    jsonResponse(res, 200, status);
  } catch (e) {
    status.message = e.message;
    jsonResponse(res, 200, status);
  }
};
