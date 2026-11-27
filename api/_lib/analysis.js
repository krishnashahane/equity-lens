'use strict';

// 12-point business analysis checklist. The browser runs the same rules
// (index.html → computeAnalysis); tests/e2e.js checks they agree.
const { COMPANY } = require('./dcf');

const QUALITATIVE = [
  { n: 1, key: 'business-quality', label: 'Business quality', verdict: 'pass',
    text: 'Industrial components maker with five straight years of revenue and earnings growth, expanding margins and net cash on the balance sheet. Demand is cyclical and tied to customer capital spending.' },
  { n: 2, key: 'product-relevance', label: 'Product/service relevance', verdict: 'pass', cite: 'h1',
    text: 'Automation components sit in a growing spend category: automation volumes grew 11% in FY2025, faster than the legacy components segment.' },
  { n: 3, key: 'competitive-advantage', label: 'Competitive advantage', verdict: 'watch', cite: 'h2',
    text: 'Multi-year supply agreements supported a ~3% price increase and the 19.0% operating margin beats most peers, but Meridian Fabrication earns more (21.0%) and the edge is contractual rather than structural.' },
  { n: 4, key: 'business-model', label: 'Business model', verdict: 'pass', cite: 'h3',
    text: 'Sells engineered components to heavy-industrial customers under multi-year contracts. Capex is about 5% of revenue and FY2025 free cash flow covered 64% of net profit. Specialty-alloy input costs are the main margin risk.' },
];

const f1 = v => v.toFixed(1);
const f2 = v => v.toFixed(2);
const last = a => a[a.length - 1];
const cagr = a => (Math.pow(last(a) / a[0], 1 / (a.length - 1)) - 1) * 100;
const risingEveryYear = a => a.every((v, i) => i === 0 || v > a[i - 1]);
const tier = (v, good, ok, higherBetter = true) =>
  higherBetter ? (v >= good ? 'pass' : v >= ok ? 'watch' : 'fail') : (v < good ? 'pass' : v < ok ? 'watch' : 'fail');

function metrics(C = COMPANY) {
  const idx = C.years.map((_, i) => i);
  const bs = C.bs;
  const totalAssets = idx.map(i => bs.cash[i] + bs.stInvest[i] + bs.receivables[i] + bs.inventory[i] + bs.otherCA[i] + bs.ppe[i] + bs.intangibles[i]);
  const totalCL = idx.map(i => bs.payables[i] + bs.debtST[i] + bs.otherCL[i]);
  const totalLiab = idx.map(i => totalCL[i] + bs.debtLT[i] + bs.otherLTL[i]);
  const equity = idx.map(i => totalAssets[i] - totalLiab[i]);
  const ebitda = idx.map(i => C.opIncome[i] + C.da[i]);
  return {
    revenue: C.revenue,
    netIncome: C.netIncome,
    ebitda,
    ebitdaMargin: idx.map(i => (ebitda[i] / C.revenue[i]) * 100),
    de: idx.map(i => (bs.debtST[i] + bs.debtLT[i]) / equity[i]),
    grossMargin: idx.map(i => (C.grossProfit[i] / C.revenue[i]) * 100),
    opMargin: idx.map(i => (C.opIncome[i] / C.revenue[i]) * 100),
    netMargin: idx.map(i => (C.netIncome[i] / C.revenue[i]) * 100),
    roe: idx.map(i => (C.netIncome[i] / equity[i]) * 100),
    roce: idx.map(i => (C.opIncome[i] / (totalAssets[i] - totalCL[i])) * 100),
    dps: C.dps,
    payout: idx.map(i => (C.dps[i] / C.eps[i]) * 100),
  };
}

function financialItems(m, C = COMPANY) {
  const om0 = m.opMargin[0], om = last(m.opMargin);
  return [
    { n: 5, key: 'revenue-profit', label: 'Revenue and profit (5 years)',
      verdict: risingEveryYear(m.revenue) && risingEveryYear(m.netIncome) ? 'pass' : last(m.netIncome) > m.netIncome[0] ? 'watch' : 'fail',
      note: `Revenue CAGR ${f1(cagr(m.revenue))}%, net profit CAGR ${f1(cagr(m.netIncome))}%${risingEveryYear(m.revenue) && risingEveryYear(m.netIncome) ? '; both grew every year' : ''}`,
      rows: [['Revenue', 'revenue', 'm'], ['Net profit', 'netIncome', 'm']] },
    { n: 6, key: 'ebitda', label: 'EBITDA', verdict: tier(last(m.ebitdaMargin), 15, 10),
      note: `EBITDA margin ${f1(last(m.ebitdaMargin))}% in FY2025 (pass ≥ 15%)`,
      rows: [['EBITDA', 'ebitda', 'm'], ['EBITDA margin', 'ebitdaMargin', '%']] },
    { n: 7, key: 'debt-to-equity', label: 'Debt-to-equity ratio', verdict: tier(last(m.de), 0.5, 1.0, false),
      note: `${f2(last(m.de))}x in FY2025 (pass < 0.5x)`,
      rows: [['Debt / equity', 'de', 'x']] },
    { n: 8, key: 'profitability', label: 'Profitability', verdict: tier(om, 15, 10),
      note: `Operating margin ${f1(om)}%, ${om >= om0 ? 'up' : 'down'} from ${f1(om0)}% (pass ≥ 15%)`,
      rows: [['Gross margin', 'grossMargin', '%'], ['Operating margin', 'opMargin', '%']] },
    { n: 9, key: 'roe', label: 'ROE (return on equity)', verdict: tier(last(m.roe), 15, 10),
      note: `${f1(last(m.roe))}% in FY2025 (pass ≥ 15%)`,
      rows: [['ROE', 'roe', '%']] },
    { n: 10, key: 'roce', label: 'ROCE (return on capital employed)', verdict: tier(last(m.roce), 15, 10),
      note: `${f1(last(m.roce))}% in FY2025 (pass ≥ 15%)`,
      rows: [['ROCE', 'roce', '%']] },
    { n: 11, key: 'net-margin', label: 'Net profit margin', verdict: tier(last(m.netMargin), 10, 5),
      note: `${f1(last(m.netMargin))}% in FY2025 (pass ≥ 10%)`,
      rows: [['Net profit margin', 'netMargin', '%']] },
    { n: 12, key: 'dividends', label: 'Dividend history',
      verdict: risingEveryYear(m.dps) ? 'pass' : last(m.dps) >= m.dps[0] ? 'watch' : 'fail',
      note: `${risingEveryYear(m.dps) ? 'Raised every year' : 'Not raised every year'}; ${f1((last(m.dps) / C.price) * 100)}% yield, ${f1(last(m.payout))}% payout`,
      rows: [['Dividend per share', 'dps', '$'], ['Payout ratio', 'payout', '%']] },
  ];
}

function analyze(C = COMPANY) {
  const m = metrics(C);
  const fin = financialItems(m, C);
  const all = [...QUALITATIVE, ...fin];
  const count = v => all.filter(x => x.verdict === v).length;
  return {
    years: C.years,
    score: { pass: count('pass'), watch: count('watch'), fail: count('fail'), total: all.length },
    qualitative: QUALITATIVE,
    financial: fin.map(item => ({
      ...item,
      rows: item.rows.map(([label, key, unit]) => ({ label, key, unit, values: m[key].map(v => Math.round(v * 10000) / 10000) })),
    })),
  };
}

module.exports = { analyze, metrics, QUALITATIVE };
