const fs = require('fs');
const path = require('path');

const pairs = [
  ['index.html', 'public/index.html'],
  ['css/elite.css', 'public/css/elite.css'],
  ['js/api.js', 'public/js/api.js'],
  ['js/db-auth.js', 'public/js/db-auth.js'],
  ['js/app.js', 'public/js/app.js'],
];

for (const [src, dest] of pairs) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const config = `window.BATIG_CONFIG = {
  supabaseUrl: ${JSON.stringify((process.env.SUPABASE_URL || '').trim())},
  supabaseAnon: ${JSON.stringify((process.env.SUPABASE_ANON_KEY || '').trim())}
};`;

fs.writeFileSync('public/js/config.js', config);
console.log('Static files copied to public/');
console.log('Config:', config.includes('supabase.co') ? 'Supabase URL set' : 'WARNING: SUPABASE_URL missing at build');
