# EquityLens

An equity research and valuation workspace: company overview, financial statements, a live DCF valuation lab with bear/base/bull scenarios, source-cited research, watchlist and portfolio — with a small serverless backend.

**Live:** https://equity-lens-app.vercel.app

> Demo site. All companies, prices and filings (e.g. *Solvane Industrial*, ticker SOLV) are fictional. Nothing here is investment advice.

## What's inside

**Marketing site**
- Home, For Analysts, Pricing and Company pages
- Scroll-driven product tour with live app screens rendered from the DCF engine
- Interactive "try it yourself" valuation widget
- Contact and demo-request forms (sent to the API)
- Terms and Privacy pages

**App workspace** (`/#app`, or "Continue as Guest" on sign-in)
- **Overview** — key metrics, price chart (1M–5Y), valuation summary, research pulse, peers
- **Financials** — income statement, balance sheet and cash flow; annual/quarterly; absolute or % of revenue
- **Valuation lab** — 5-year FCFF DCF with Gordon growth terminal value, editable assumptions, valuation bridge, forecast table, WACC × terminal-growth sensitivity grid, scenario comparison and CSV export
- **AI research** — questions are answered from the indexed annual report and reported financials, with evidence tags and citations that jump to the highlighted source passage; unanswerable questions are flagged instead of guessed
- **Watchlist, Saved reports (print / save as PDF), Portfolio**
- Light / dark theme, 38 currencies, ⌘K / Ctrl+K command palette

## API

Vercel serverless functions (Node 18+, no dependencies) in `api/`, with shared logic in `api/_lib/` (underscore-prefixed, so it is never exposed as a route or file).

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Liveness check |
| `/api/valuation` | GET | Company data, scenario presets and input limits |
| `/api/valuation?scenario=base` | GET | Valuation for `bear`, `base` or `bull` |
| `/api/valuation` | POST | Valuation for custom inputs: `{"assumptions": {growth, margin, tax, reinvest, wacc, termGrowth}}` (percentages) |
| `/api/research` | POST | `{"question": "..."}` → findings, evidence with citations, limitations |
| `/api/contact` | POST | `{name, email, subject, message}` |
| `/api/demo` | POST | `{email}` |

All endpoints validate input, cap request bodies at 16 KB, apply a per-IP rate limit, return JSON errors (`400`, `405`, `413`, `422`, `429`) and are never cached. Forms include a honeypot field for bots.

**Where form submissions go:** set these environment variables in Vercel to receive them by email via [Resend](https://resend.com):

| Variable | Example |
| --- | --- |
| `RESEND_API_KEY` | `re_...` |
| `NOTIFY_TO` | `you@example.com` |
| `NOTIFY_FROM` (optional) | `EquityLens <hello@yourdomain.com>` |

Without them, submissions are written to the function logs (Vercel → Project → Logs).

Sign-up and sign-in are still simulated in the browser (no accounts or database).

## Project structure

```
index.html            marketing site + app workspace (HTML, CSS, vanilla JS)
terms.html            terms and conditions
privacy.html          privacy policy
api/                  serverless endpoints
  health.js  valuation.js  research.js  contact.js  demo.js
  _lib/               shared code (not exposed as routes)
    dcf.js            DCF model (same maths as the browser)
    research.js       source retrieval for research answers
    http.js           JSON, validation, body limits, rate limiting
    notify.js         email delivery (Resend) or log fallback
scripts/dev-server.js local server: static files + /api, like Vercel
tests/
  api.test.js         unit + HTTP tests for the API (node:test)
  e2e.js              headless-Chrome check of every page and flow
vercel.json           security headers, cache rules, function limits
```

## Run locally

```bash
npm run dev            # http://localhost:3000 — site + API, no install needed
```

## Tests

```bash
npm test                               # API tests, no install needed
npm install                            # installs puppeteer-core (uses your local Chrome)
npm run dev &                          # start the site
npm run test:e2e -- http://localhost:3000/
```

`test:e2e` clicks through every page, link, form and app screen in light and dark mode and fails on any console error. Set `SHOTS=./shots` to save screenshots, or `CHROME_PATH` if Chrome isn't in the default macOS location.

## Deploy

```bash
vercel deploy --prod --force   # --force skips the build cache
```

`vercel.json` sets a Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and Permissions-Policy, serves HTML with `max-age=0, must-revalidate`, and marks API responses `no-store`.

## Privacy

See [privacy.html](privacy.html). In short: contact/demo messages are delivered to the team; research questions are processed and not stored; sign-in details and uploaded files never leave the browser; the only thing saved locally is the theme preference (`el-theme`). No analytics, trackers or cookies.
