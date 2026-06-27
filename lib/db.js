const { createClient } = require('@supabase/supabase-js');

let client;

function getDb() {
  if (!client) {
    const url = (process.env.SUPABASE_URL || '').trim();
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

module.exports = { getDb };
