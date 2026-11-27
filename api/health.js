'use strict';
const { send, allowMethods, handler } = require('./_lib/http');

module.exports = handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET', 'HEAD'])) return;
  send(res, 200, { ok: true, service: 'equitylens-api', time: new Date().toISOString() });
});
