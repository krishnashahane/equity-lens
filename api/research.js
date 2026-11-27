'use strict';
const { send, allowMethods, readJson, clientIp, rateLimit, cleanString, handler } = require('../lib/http');
const { answer } = require('../lib/research');

module.exports = handler(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!rateLimit(`research:${clientIp(req)}`, 60, 60 * 1000)) {
    return send(res, 429, { ok: false, error: 'Too many questions. Please slow down.' });
  }
  const body = await readJson(req);
  const question = cleanString(body.question, 500);
  if (question.length < 3) return send(res, 422, { ok: false, error: 'Ask a question of at least 3 characters' });
  send(res, 200, { ok: true, question, answer: answer(question) });
});
