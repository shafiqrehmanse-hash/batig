const { handleCors, jsonResponse } = require('../lib/game');
const routes = require('../lib/routes');

function getRoute(req) {
  const q = req.query || {};
  if (q.path) {
    const p = q.path;
    return Array.isArray(p) ? p.join('/') : String(p);
  }
  const raw = req.url || '';
  const pathname = raw.split('?')[0];
  const m = pathname.match(/\/api\/(.+)$/);
  if (m) return decodeURIComponent(m[1]);
  return '';
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const route = getRoute(req);
  const fn = routes[route];

  if (!fn) return jsonResponse(res, 404, { error: 'Not found: ' + (route || '(empty)') });
  return fn(req, res);
};
