# EquityLens

An equity research and valuation workspace: company overview, financial statements, a live DCF valuation lab with bear/base/bull scenarios, source-cited AI research, watchlist and portfolio — all in one page.

**Live:** https://equity-lens-app.vercel.app

> Demo site. All companies, prices and filings (e.g. *Solvane Industrial*, ticker SOLV) are fictional. Nothing here is investment advice.

## What's inside

**Marketing site**
- Home, For Analysts, Pricing and Company pages
- Scroll-driven product tour with live app screens rendered from the same DCF engine
- Interactive "try it yourself" valuation widget
- Terms and Privacy pages

**App workspace** (`#app`, or "Continue as Guest" on sign-in)
- **Overview** — key metrics, price chart (1M–5Y), valuation summary, research pulse, peers
- **Financials** — income statement, balance sheet and cash flow; annual/quarterly; absolute or % of revenue
- **Valuation lab** — 5-year FCFF DCF with Gordon growth terminal value, editable assumptions, valuation bridge, forecast table and WACC × terminal-growth sensitivity grid
- **AI research** — Q&A with findings, evidence tags and citations that jump to the highlighted source passage
- **Watchlist, Saved reports, Portfolio**
- Light / dark theme, 38 currencies, ⌘K / Ctrl+K command palette

## Tech

A single static `index.html` — plain HTML, CSS and vanilla JavaScript. No framework, no build step, no dependencies beyond the Inter font from Google Fonts.

Each screen has its own URL, so back/forward, refresh and new tabs work:

| URL | Screen |
| --- | --- |
| `/` | Home |
| `/#platform` | For Analysts |
| `/#pricing` | Pricing |
| `/#contact` | Company / contact |
| `/#signin`, `/#signup` | Auth (simulated) |
| `/#app` | App workspace |

## Project structure

```
index.html     marketing site + app workspace
terms.html     terms and conditions
privacy.html   privacy policy
vercel.json    security headers and cache rules
```

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly in a browser also works, but the Terms/Privacy links expect to be served from a web root.

## Deploy

Hosted on Vercel as a static site.

```bash
vercel deploy --prod --force   # --force skips the build cache
```

`vercel.json` sets a Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a locked-down Permissions-Policy, and serves HTML with `max-age=0, must-revalidate` so updates show up immediately.

## Privacy

Forms (sign-up, contact, demo requests, research questions) are simulated and never leave the browser. The only thing stored is the theme preference in `localStorage` (`el-theme`). No analytics, trackers or cookies.
