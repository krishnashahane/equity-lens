'use strict';
const { send, allowMethods, readJson, clientIp, rateLimit, cleanString, handler, EMAIL_RE } = require('../lib/http');
const { deliver } = require('../lib/notify');

module.exports = handler(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!rateLimit(`demo:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return send(res, 429, { ok: false, error: 'Too many requests. Please try again in a few minutes.' });
  }
  const body = await readJson(req);
  if (cleanString(body.website, 200)) return send(res, 200, { ok: true });
  const email = cleanString(body.email, 200);
  if (!EMAIL_RE.test(email)) return send(res, 422, { ok: false, error: 'Enter a valid work email', fields: { email: 'Enter a valid work email' } });
  const result = await deliver('demo-request', { email });
  send(res, 201, { ok: true, id: result.id });
});
