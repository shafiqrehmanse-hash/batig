const fs = require('fs');
const path = require('path');

const pairs = [
  ['index.html', 'public/index.html'],
  ['css/elite.css', 'public/css/elite.css'],
  ['js/api.js', 'public/js/api.js'],
  ['js/app.js', 'public/js/app.js'],
];

for (const [src, dest] of pairs) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log('Static files copied to public/');
