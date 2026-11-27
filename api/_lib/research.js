'use strict';

const { COMPANY, PRESETS, computeDCF } = require('./dcf');
const { metrics, QUALITATIVE } = require('./analysis');

// Passages from the indexed FY2025 annual report. Ids match the citation
// targets in the browser (DOCS.ar2025.passages), so a cited answer jumps to
// the highlighted passage in the document viewer.
const PASSAGES = [
  {
    doc: 'ar2025', hl: 'h1', page: 14,
    text: "Automation segment volumes grew 11% year-over-year, outpacing the company's legacy components segment, as customers accelerated capacity expansion projects across North America.",
    keywords: ['revenue', 'growth', 'grow', 'sales', 'volume', 'volumes', 'demand', 'automation', 'segment', 'drove', 'driver', 'drivers', 'top-line', 'topline'],
  },
  {
    doc: 'ar2025', hl: 'h2', page: 14,
    text: 'Average selling prices rose approximately 3% following renegotiated multi-year supply agreements executed in the second half of fiscal 2024.',
    keywords: ['price', 'prices', 'pricing', 'asp', 'selling', 'contract', 'contracts', 'agreement', 'agreements', 'revenue', 'growth', 'drove', 'driver', 'drivers'],
  },
  {
    doc: 'ar2025', hl: 'h3', page: 32,
    text: 'Raw-material input cost inflation, particularly in specialty alloys, remains an ongoing risk to gross margin over the next twelve months.',
    keywords: ['risk', 'risks', 'cost', 'costs', 'inflation', 'input', 'alloy', 'alloys', 'raw', 'material', 'materials', 'margin', 'margins', 'gross', 'headwind', 'headwinds', 'supply'],
  },
];

const pct = (a, b) => ((a / b - 1) * 100).toFixed(1);
const last = arr => arr[arr.length - 1];

// Facts computed from the reported financial statements.
function financialFacts() {
  const r = COMPANY.revenue, op = COMPANY.opIncome, ni = COMPANY.netIncome, eps = COMPANY.eps;
  const n = r.length;
  const base = computeDCF(PRESETS.base), bear = computeDCF(PRESETS.bear), bull = computeDCF(PRESETS.bull);
  return [
    {
      keywords: ['revenue', 'growth', 'grow', 'sales', 'top-line', 'topline'],
      text: `Revenue grew ${pct(r[n - 1], r[n - 2])}% in FY2025 to $${last(r).toLocaleString('en-US')}M, and at a ${(((r[n - 1] / r[0]) ** (1 / (n - 1)) - 1) * 100).toFixed(1)}% CAGR since FY2021.`,
    },
    {
      keywords: ['margin', 'margins', 'operating', 'profit', 'profitability', 'ebit'],
      text: `Operating margin expanded from ${(op[0] / r[0] * 100).toFixed(1)}% in FY2021 to ${(last(op) / last(r) * 100).toFixed(1)}% in FY2025.`,
    },
    {
      keywords: ['earnings', 'eps', 'income', 'net', 'profit'],
      text: `Net income rose to $${last(ni).toFixed(0)}M in FY2025 (diluted EPS $${last(eps).toFixed(2)}, up ${pct(last(eps), eps[n - 2])}% year over year).`,
    },
    {
      keywords: ['cash', 'debt', 'balance', 'leverage', 'liquidity', 'net'],
      text: `The balance sheet carries net cash of $${(-COMPANY.netDebt).toLocaleString('en-US')}M at FY2025 year-end.`,
    },
    {
      keywords: ['valuation', 'value', 'fair', 'dcf', 'worth', 'upside', 'downside', 'undervalued', 'overvalued', 'cheap', 'expensive', 'target'],
      interp: true,
      text: `The base-case DCF implies about $${base.perShare.toFixed(0)} per share versus a $${COMPANY.price.toFixed(0)} market price (${pct(base.perShare, COMPANY.price)}%); bear and bull cases span $${bear.perShare.toFixed(0)}–$${bull.perShare.toFixed(0)}.`,
    },
    ...checklistFacts(),
  ];
}

// Facts from the business analysis checklist (returns, EBITDA, dividends, moat).
function checklistFacts() {
  const m = metrics();
  const f1 = v => v.toFixed(1);
  const q = key => QUALITATIVE.find(x => x.key === key).text;
  return [
    { keywords: ['roe', 'return', 'returns', 'equity'], text: `Return on equity was ${f1(last(m.roe))}% in FY2025, up from ${f1(m.roe[0])}% in FY2021.` },
    { keywords: ['roce', 'return', 'returns', 'capital', 'employed'], text: `Return on capital employed (EBIT ÷ total assets less current liabilities) was ${f1(last(m.roce))}% in FY2025.` },
    { keywords: ['ebitda'], text: `EBITDA was $${Math.round(last(m.ebitda)).toLocaleString('en-US')}M in FY2025, a ${f1(last(m.ebitdaMargin))}% margin.` },
    { keywords: ['debt', 'leverage', 'gearing', 'de', 'debt-to-equity'], text: `Debt-to-equity fell from ${m.de[0].toFixed(2)}x in FY2021 to ${last(m.de).toFixed(2)}x in FY2025.` },
    { keywords: ['dividend', 'dividends', 'payout', 'yield', 'dps', 'shareholder', 'shareholders'], text: `The dividend was raised every year, from $${m.dps[0].toFixed(2)} to $${last(m.dps).toFixed(2)} per share (${f1(last(m.payout))}% payout in FY2025).` },
    { keywords: ['moat', 'competitive', 'advantage', 'competition', 'competitors', 'edge'], interp: true, text: q('competitive-advantage') },
    { keywords: ['model', 'business', 'customers', 'sells'], interp: true, text: q('business-model') },
    { keywords: ['quality'], interp: true, text: q('business-quality') },
  ];
}

function tokenize(q) {
  return (q.toLowerCase().match(/[a-z][a-z-]*/g) || []).filter(w => w.length > 1);
}

function score(tokens, keywords) {
  let s = 0;
  for (const t of tokens) if (keywords.includes(t)) s += 1;
  return s;
}

// Retrieval over the indexed filing + reported financials. Answers only what
// the sources support; otherwise says so instead of guessing.
function answer(question) {
  const tokens = tokenize(question);
  const passages = PASSAGES.map(p => ({ ...p, s: score(tokens, p.keywords) })).filter(p => p.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
  const facts = financialFacts().map(f => ({ ...f, s: score(tokens, f.keywords) })).filter(f => f.s > 0).sort((a, b) => b.s - a.s).slice(0, 2);

  if (!passages.length && !facts.length) {
    return { insufficient: true, findings: '', evidence: [], limitations: '', sources: [] };
  }

  const evidence = [
    ...passages.map(p => ({ tag: 'reported', text: p.text, doc: p.doc, hl: p.hl })),
    ...facts.map(f => ({ tag: f.interp ? 'interp' : 'reported', text: f.text, doc: null })),
  ];

  const lead = passages.length
    ? `The FY2025 annual report points to ${passages.length === 1 ? 'one relevant disclosure' : `${passages.length} relevant disclosures`}`
    : 'The filings do not discuss this directly, but the reported financials are relevant';
  const firstSentence = (passages[0] || facts[0]).text.replace(/\.$/, '');
  const findings = `${lead}. Most directly: ${firstSentence.charAt(0).toLowerCase()}${firstSentence.slice(1)}.`;

  const limitations = passages.length
    ? 'Only the FY2025 annual report has been indexed; the Q2 FY2026 earnings call transcript is still processing.'
    : 'No passage in the indexed filings addresses this question directly; figures come from the reported statements and the DCF model.';

  return {
    insufficient: false,
    findings,
    evidence,
    limitations,
    sources: passages.map(p => ({ doc: p.doc, hl: p.hl, page: p.page })),
  };
}

module.exports = { answer, PASSAGES };
