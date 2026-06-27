const { createClient } = require('@supabase/supabase-js');

let client;

function assertServiceRoleKey(key) {
  const parts = key.split('.');
  if (parts.length !== 3) return;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.role && payload.role !== 'service_role') {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY must be the service_role secret from Supabase → Settings → API (not the anon public key)'
      );
    }
  } catch (e) {
    if (e.message.includes('service_role')) throw e;
  }
}

function getDb() {
  if (!client) {
    const url = (process.env.SUPABASE_URL || '').trim();
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anon = (process.env.SUPABASE_ANON_KEY || '').trim();
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables');
    }
    if (anon && key === anon) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY must not be the same as SUPABASE_ANON_KEY');
    }
    assertServiceRoleKey(key);
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

module.exports = { getDb };
