'use strict';
const { send, allowMethods, readJson, clientIp, rateLimit, cleanString, handler, EMAIL_RE } = require('./_lib/http');
const { deliver } = require('./_lib/notify');

module.exports = handler(async (req, res) => {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!rateLimit(`contact:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return send(res, 429, { ok: false, error: 'Too many messages. Please try again in a few minutes.' });
  }
  const body = await readJson(req);
  // Honeypot: real users never see or fill this field.
  if (cleanString(body.website, 200)) return send(res, 200, { ok: true });

  const name = cleanString(body.name, 120);
  const email = cleanString(body.email, 200);
  const subject = cleanString(body.subject, 200);
  const message = cleanString(body.message, 5000);
  const errors = {};
  if (!name) errors.name = 'Enter your name';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
  if (!subject) errors.subject = 'Enter a subject';
  if (message.length < 10) errors.message = 'Message should be at least 10 characters';
  if (Object.keys(errors).length) return send(res, 422, { ok: false, error: 'Please check the highlighted fields', fields: errors });

  const result = await deliver('contact', { name, email, subject, message });
  send(res, 201, { ok: true, id: result.id });
});
