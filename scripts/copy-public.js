const fs = require('fs');
const path = require('path');

const BUILD = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
  || process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 8)
  || Date.now().toString(36);

const pairs = [
  ['css/elite.css', 'public/css/elite.css'],
  ['js/api.js', 'public/js/api.js'],
  ['js/db-auth.js', 'public/js/db-auth.js'],
  ['js/cms.js', 'public/js/cms.js'],
  ['js/roles.js', 'public/js/roles.js'],
  ['js/image-compress.js', 'public/js/image-compress.js'],
  ['js/deposits.js', 'public/js/deposits.js'],
  ['js/withdrawals.js', 'public/js/withdrawals.js'],
  ['js/dice-3d.js', 'public/js/dice-3d.js'],
  ['js/dice-visual.js', 'public/js/dice-visual.js'],
  ['js/roll-suspense.js', 'public/js/roll-suspense.js'],
  ['js/gsap-ui.js', 'public/js/gsap-ui.js'],
  ['js/motion-ui.js', 'public/js/motion-ui.js'],
  ['js/result-fx.js', 'public/js/result-fx.js'],
  ['js/app.js', 'public/js/app.js'],
];

for (const [src, dest] of pairs) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/\?v=[^"']+/g, `?v=${BUILD}`);
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/index.html', html);

const config = `window.BATIG_CONFIG = {
  supabaseUrl: ${JSON.stringify((process.env.SUPABASE_URL || '').trim())},
  supabaseAnon: ${JSON.stringify((process.env.SUPABASE_ANON_KEY || '').trim())},
  build: ${JSON.stringify(BUILD)}
};`;

fs.writeFileSync('public/js/config.js', config);
console.log('Static files copied to public/');
console.log('Build cache version:', BUILD);
console.log('Config:', config.includes('supabase.co') ? 'Supabase URL set' : 'WARNING: SUPABASE_URL missing at build');
