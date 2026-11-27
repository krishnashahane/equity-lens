'use strict';
const { send, allowMethods, readJson, handler } = require('./_lib/http');
const { COMPANY, PRESETS, LIMITS, validateAssumptions, summarize } = require('./_lib/dcf');

// GET  /api/valuation                 → company, presets, limits
// GET  /api/valuation?scenario=bull   → valuation for a preset
// POST /api/valuation {assumptions}   → valuation for custom inputs
module.exports = handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET', 'POST'])) return;

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const scenario = url.searchParams.get('scenario');
    if (!scenario) {
      return send(res, 200, {
        ok: true,
        company: { name: COMPANY.name, ticker: COMPANY.ticker, price: COMPANY.price, shares: COMPANY.shares, netDebt: COMPANY.netDebt },
        presets: PRESETS,
        limits: LIMITS,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(PRESETS, scenario)) {
      return send(res, 404, { ok: false, error: `Unknown scenario "${String(scenario).slice(0, 20)}". Use bear, base or bull.` });
    }
    return send(res, 200, { ok: true, scenario, ...summarize(PRESETS[scenario]) });
  }

  const body = await readJson(req);
  const { assumptions, errors } = validateAssumptions(body.assumptions);
  if (errors.length) return send(res, 422, { ok: false, error: 'Invalid assumptions', details: errors });
  const result = summarize(assumptions);
  if (!result.valid) return send(res, 422, { ok: false, error: result.error });
  send(res, 200, { ok: true, ...result });
});
