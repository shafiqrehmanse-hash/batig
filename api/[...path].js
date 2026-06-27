const { handleCors, jsonResponse } = require('../lib/game');
const routes = require('../lib/routes');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  const segments = req.query.path || [];
  const route = Array.isArray(segments) ? segments.join('/') : String(segments);
  const fn = routes[route];

  if (!fn) return jsonResponse(res, 404, { error: 'Not found: ' + route });
  return fn(req, res);
};
