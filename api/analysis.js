'use strict';
const { send, allowMethods, handler } = require('./_lib/http');
const { COMPANY } = require('./_lib/dcf');
const { analyze } = require('./_lib/analysis');

// GET /api/analysis → 12-point business analysis checklist for the company
module.exports = handler(async (req, res) => {
  if (!allowMethods(req, res, ['GET'])) return;
  send(res, 200, { ok: true, company: { name: COMPANY.name, ticker: COMPANY.ticker }, ...analyze() });
});
