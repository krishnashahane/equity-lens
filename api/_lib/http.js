'use strict';

const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function send(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(payload));
}

function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  send(res, 405, { ok: false, error: `Method ${req.method} not allowed` }, { Allow: methods.join(', ') });
  return false;
}

// Vercel parses JSON bodies into req.body; fall back to reading the stream
// (local `vercel dev`, tests) with a hard size cap.
async function readJson(req) {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    const text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw httpError(413, 'Request body too large');
    return parse(text);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw httpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? parse(text) : {};
}

function parse(text) {
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw httpError(400, 'Body must be a JSON object');
  }
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// Best-effort, per-instance limiter. Serverless instances are short-lived, so
// this blunts bursts from one client rather than enforcing a global quota.
const buckets = new Map();
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    if (buckets.size > 5000) buckets.clear();
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

function cleanString(v, max) {
  if (typeof v !== 'string') return '';
  // strip control chars except newline/tab, collapse surrounding whitespace
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      const status = err && err.status ? err.status : 500;
      if (status >= 500) console.error('[api] unexpected error', err);
      send(res, status, { ok: false, error: status >= 500 ? 'Internal server error' : err.message });
    }
  };
}

module.exports = { send, allowMethods, readJson, httpError, clientIp, rateLimit, cleanString, handler, EMAIL_RE };
