'use strict';

// Same model the browser runs (index.html → computeDCF), kept server-side so
// valuations can be reproduced and checked independently of the UI.

const COMPANY = {
  name: 'Solvane Industrial',
  ticker: 'SOLV',
  exchange: 'NYSE',
  sector: 'Industrial Equipment & Machinery',
  price: 100.0,
  shares: 92.0, // millions
  netDebt: -400, // $M; negative = net cash
  baseYear: 2025,
  years: [2021, 2022, 2023, 2024, 2025],
  revenue: [4200, 4550, 4890, 5310, 5720],
  grossProfit: [1764, 1911, 2054, 2230, 2402],
  opIncome: [672, 764, 856, 977, 1087],
  netIncome: [487.9, 559.4, 631.6, 725.8, 810.9],
  eps: [5.3, 6.08, 6.87, 7.89, 8.82],
};

const PRESETS = {
  bear: { growth: 4.0, margin: 17.0, tax: 24.0, reinvest: 35.0, wacc: 10.0, termGrowth: 2.0 },
  base: { growth: 6.5, margin: 19.5, tax: 24.0, reinvest: 33.0, wacc: 9.0, termGrowth: 2.5 },
  bull: { growth: 8.0, margin: 21.0, tax: 24.0, reinvest: 31.0, wacc: 8.7, termGrowth: 2.7 },
};

// Same bounds as the sliders in the valuation lab.
const LIMITS = {
  growth: [-5, 20],
  margin: [5, 35],
  tax: [10, 35],
  reinvest: [10, 60],
  wacc: [5, 15],
  termGrowth: [0, 5],
};

function validateAssumptions(input) {
  const assumptions = {};
  const errors = [];
  if (!input || typeof input !== 'object') {
    return { assumptions, errors: ['assumptions must be an object'] };
  }
  for (const key of Object.keys(LIMITS)) {
    const raw = input[key];
    const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      errors.push(`${key} must be a number`);
      continue;
    }
    const [lo, hi] = LIMITS[key];
    if (n < lo || n > hi) errors.push(`${key} must be between ${lo} and ${hi}`);
    assumptions[key] = n;
  }
  return { assumptions, errors };
}

function computeDCF(a) {
  const rev0 = COMPANY.revenue[COMPANY.revenue.length - 1];
  const g = a.growth / 100, m = a.margin / 100, tax = a.tax / 100;
  const ri = a.reinvest / 100, w = a.wacc / 100, tg = a.termGrowth / 100;
  const invalid = tg >= w;
  const years = [];
  let rev = rev0, sumPV = 0, lastFCFF = 0;
  for (let t = 1; t <= 5; t++) {
    rev = rev * (1 + g);
    const nopat = rev * m * (1 - tax);
    const fcff = nopat * (1 - ri);
    const df = 1 / Math.pow(1 + w, t);
    const pv = fcff * df;
    sumPV += pv;
    lastFCFF = fcff;
    years.push({ year: COMPANY.baseYear + t, revenue: rev, nopat, fcff, df, pv });
  }
  let tv = 0, pvTV = 0, ev = 0, equity = 0, perShare = 0;
  if (!invalid) {
    tv = (lastFCFF * (1 + tg)) / (w - tg);
    pvTV = tv / Math.pow(1 + w, 5);
    ev = sumPV + pvTV;
    equity = ev - COMPANY.netDebt;
    perShare = equity / COMPANY.shares;
  }
  return { years, sumPV, tv, pvTV, ev, equity, perShare, invalid, shares: COMPANY.shares, netDebt: COMPANY.netDebt };
}

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// Compact, JSON-friendly summary of a valuation.
function summarize(a) {
  const r = computeDCF(a);
  if (r.invalid) {
    return { valid: false, error: 'termGrowth must be lower than wacc', assumptions: a };
  }
  return {
    valid: true,
    assumptions: a,
    fairValuePerShare: round(r.perShare),
    marketPrice: COMPANY.price,
    upsidePct: round((r.perShare / COMPANY.price - 1) * 100, 1),
    bridge: {
      sumPvFcff: round(r.sumPV, 1),
      pvTerminalValue: round(r.pvTV, 1),
      enterpriseValue: round(r.ev, 1),
      netCash: -COMPANY.netDebt,
      equityValue: round(r.equity, 1),
      sharesOutstanding: COMPANY.shares,
    },
    forecast: r.years.map(y => ({
      year: y.year,
      revenue: round(y.revenue, 1),
      nopat: round(y.nopat, 1),
      fcff: round(y.fcff, 1),
      discountFactor: round(y.df, 4),
      pv: round(y.pv, 1),
    })),
  };
}

module.exports = { COMPANY, PRESETS, LIMITS, validateAssumptions, computeDCF, summarize };
