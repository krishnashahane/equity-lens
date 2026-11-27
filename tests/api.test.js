'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const { computeDCF, PRESETS, validateAssumptions, summarize } = require('../lib/dcf');
const { answer } = require('../lib/research');

// ---- pure logic ----
test('base-case DCF matches the published fair value', () => {
  const r = computeDCF(PRESETS.base);
  assert.equal(r.invalid, false);
  assert.ok(Math.abs(r.perShare - 119.84) < 0.01, `got ${r.perShare}`);
});

test('bear < base < bull', () => {
  const [b, m, u] = ['bear', 'base', 'bull'].map(k => computeDCF(PRESETS[k]).perShare);
  assert.ok(b < m && m < u);
});

test('terminal growth >= WACC is flagged invalid', () => {
  const s = summarize({ ...PRESETS.base, wacc: 5, termGrowth: 5 });
  assert.equal(s.valid, false);
});

test('assumption validation rejects bad input', () => {
  assert.ok(validateAssumptions({ ...PRESETS.base, growth: 99 }).errors.length > 0);
  assert.ok(validateAssumptions({ ...PRESETS.base, wacc: 'abc' }).errors.length > 0);
  assert.ok(validateAssumptions(null).errors.length > 0);
  assert.equal(validateAssumptions(PRESETS.bull).errors.length, 0);
});

test('research cites the filing for revenue questions', () => {
  const a = answer('What drove revenue growth?');
  assert.equal(a.insufficient, false);
  assert.ok(a.evidence.some(e => e.doc === 'ar2025' && e.hl === 'h1'));
});

test('research refuses questions the sources cannot answer', () => {
  assert.equal(answer("What is management's compensation structure?").insufficient, true);
});

// ---- HTTP endpoints through the dev server ----
let server, base;
test.before(async () => {
  server = http.createServer((req, res) => {
    const m = req.url.match(/^\/api\/([a-z-]+)/);
    require(path.join(__dirname, '..', 'api', `${m[1]}.js`))(req, res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('GET /api/health', async () => {
  const r = await fetch(base + '/api/health');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});

test('GET /api/valuation?scenario=base', async () => {
  const j = await (await fetch(base + '/api/valuation?scenario=base')).json();
  assert.equal(j.fairValuePerShare, 119.84);
  assert.equal(j.forecast.length, 5);
});

test('GET /api/valuation unknown scenario → 404', async () => {
  assert.equal((await fetch(base + '/api/valuation?scenario=moon')).status, 404);
});

test('POST /api/valuation validates input', async () => {
  assert.equal((await post('/api/valuation', { assumptions: { ...PRESETS.base, tax: 90 } })).status, 422);
  const ok = await post('/api/valuation', { assumptions: PRESETS.bull });
  assert.equal(ok.status, 200);
});

test('POST /api/research', async () => {
  const j = await (await post('/api/research', { question: 'What are the main risks to margin?' })).json();
  assert.equal(j.ok, true);
  assert.ok(j.answer.evidence.some(e => e.hl === 'h3'));
});

test('POST /api/contact validates fields', async () => {
  const bad = await post('/api/contact', { name: '', email: 'nope', subject: '', message: 'hi' });
  assert.equal(bad.status, 422);
  const j = await bad.json();
  assert.ok(j.fields.email && j.fields.name && j.fields.message);
});

test('POST /api/contact accepts a valid message', async () => {
  const r = await post('/api/contact', { name: 'Test', email: 't@example.com', subject: 'Hello', message: 'This is a test message.' });
  assert.equal(r.status, 201);
});

test('POST /api/demo rejects bad email, accepts good one', async () => {
  assert.equal((await post('/api/demo', { email: 'x' })).status, 422);
  assert.equal((await post('/api/demo', { email: 'a@b.co' })).status, 201);
});

test('malformed JSON → 400, wrong method → 405', async () => {
  assert.equal((await post('/api/contact', '{oops')).status, 400);
  assert.equal((await fetch(base + '/api/contact')).status, 405);
});

test('oversized body → 413', async () => {
  assert.equal((await post('/api/research', { question: 'x'.repeat(20000) })).status, 413);
});
