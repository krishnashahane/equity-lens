const puppeteer = require('puppeteer-core');
// End-to-end check of the site in headless Chrome.
// Usage: npm run test:e2e -- [url]   (default http://localhost:3000/)
// Set SHOTS=<dir> to save screenshots, CHROME_PATH to override the browser.
const SHOTS = process.env.SHOTS || '';
const BASE = (process.argv[2] || 'http://localhost:3000/').replace(/index\.html$/, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new', args: ['--hide-scrollbars'],
  });
  const errors = [];
  const page = await browser.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  page.on('requestfailed', r => errors.push('[reqfail] ' + r.url()));
  await page.setViewport({ width: 1440, height: 900 });
  const shot = async (name, full) => { await sleep(SHOTS ? 1200 : 300); if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: !!full }); };

  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await shot('home');
  // hero buttons
  const hero = await page.$$eval('.hero-ctas a', as => as.map(a => [a.textContent.trim(), a.getAttribute('href'), getComputedStyle(a).color, getComputedStyle(a).backgroundColor]));
  console.log('HERO', JSON.stringify(hero));
  console.log('PILL in hero:', await page.$$eval('.hero .eyebrow-pill', e => e.length));
  // scroll showcase: each slide
  const sec = await page.$eval('.scroll-product-section', el => ({ top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }));
  for (let i = 0; i < 4; i++) {
    const y = sec.top + (sec.h - 900) * (i + 0.5) / 4;
    await page.evaluate(y => window.scrollTo(0, y), y);
    await shot('slide' + i);
  }
  // all anchors without href / href="#"
  const bad = await page.$$eval('a', as => as.filter(a => !a.getAttribute('href') || a.getAttribute('href') === '#').map(a => a.outerHTML.slice(0, 120)));
  console.log('BAD ANCHORS', bad.length, bad);

  // routing via clicks
  const nav = async (sel, expectHash, name) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click(sel);
    await sleep(400);
    const h = await page.evaluate(() => location.hash);
    console.log('CLICK', sel, '->', JSON.stringify(h), h === expectHash ? 'OK' : 'MISMATCH expected ' + expectHash);
    if (h !== expectHash) errors.push('route mismatch ' + sel);
    if (name) await shot(name);
  };
  await nav('.hero-ctas a:nth-child(2)', '#pricing', 'pricing');
  await nav('.price-card:nth-child(3) a', '#contact', 'contact');
  await nav('#nav-links a[data-arg="mkt-platform"]', '#platform', 'platform');
  await nav('#nav-links a[data-arg="mkt-pricing"]', '#pricing');
  await nav('.price-card.pop a', '#signup', 'signup');
  await page.goBack(); await sleep(400);
  console.log('BACK ->', await page.evaluate(() => location.hash), await page.evaluate(() => document.querySelector('#page-pricing.active') ? 'pricing visible' : 'pricing NOT visible'));
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await nav('.hero-ctas a:nth-child(1)', '#signup');
  await page.click('[data-action="forgot-pw"]').catch(() => console.log('no forgot on signup (expected)'));
  await nav('.auth-sub a', '#signin', 'signin');
  await page.click('[data-action="forgot-pw"]'); await sleep(300);
  console.log('TOAST', await page.$eval('#toast', t => t.textContent));

  // demo form validation
  await page.goto(BASE + '#pricing', { waitUntil: 'networkidle0' }); await sleep(500);
  await page.click('#book-demo-btn'); await sleep(200);
  console.log('DEMO empty ->', await page.$eval('#toast', t => t.textContent));
  await page.type('#demo-email', 'a@b.co'); await page.click('#book-demo-btn'); await sleep(200);
  console.log('DEMO ok ->', await page.$eval('#toast', t => t.textContent));

  // app
  await page.goto(BASE + '#app', { waitUntil: 'networkidle0' });
  await shot('app');
  console.log('ACCOUNT NAME COLOR', await page.$eval('.account-name', e => getComputedStyle(e).color));
  // xss check in chat
  await page.click('[data-action="nav"][data-arg="ai"]'); await sleep(300);
  await page.type('#chat-input', '<img src=x onerror="window.__xss=1">'); await page.keyboard.press('Enter'); await sleep(400);
  console.log('XSS fired?', await page.evaluate(() => !!window.__xss));
  // valuation slider drag survives
  await page.click('[data-action="nav"][data-arg="valuation"]'); await sleep(400);
  const slider = await page.$('input[data-action="assump-slider"][data-arg="growth"]');
  const bb = await slider.boundingBox();
  await page.mouse.move(bb.x + bb.width * 0.46, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + bb.width * 0.6, bb.y + bb.height / 2, { steps: 5 });
  await page.mouse.move(bb.x + bb.width * 0.75, bb.y + bb.height / 2, { steps: 5 }); await page.mouse.up();
  console.log('GROWTH after drag', await page.evaluate(() => state.assumptions.growth), 'same element?', await page.evaluate(el => el.isConnected, slider));
  const opRows = await page.$$eval('.fin-table tr td.row-label', tds => tds.filter(t => t.textContent.trim() === 'Operating margin').length);
  console.log('Operating margin rows', opRows);
  await shot('valuation');
  // backend-backed features
  await page.click('[data-action="compare-scenarios"]'); await sleep(300);
  console.log('Compare modal rows', await page.$$eval('#modal-root .fin-table tbody tr', r => r.length));
  const dl = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'el-dl-'));
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  await page.click('#modal-root [data-action="export-valuation"]'); await sleep(1500);
  const files = require('fs').readdirSync(dl);
  console.log('CSV downloaded', files, files[0] ? require('fs').readFileSync(require('path').join(dl, files[0]), 'utf8').split('\n').find(l => l.startsWith('Fair value')) : '');
  await page.click('#modal-root .modal-foot [data-action="close-modal"]'); await sleep(300);
  console.log('Compare closed by button', await page.evaluate(() => !document.getElementById('modal-root')));
  await page.click('[data-action="nav"][data-arg="ai"]'); await sleep(300);
  await page.type('#chat-input', 'What are the main risks to margins?'); await page.keyboard.press('Enter'); await sleep(1500);
  console.log('Research answer cites h3', await page.evaluate(() => { const last = state.chat[state.chat.length - 1].a; return !!(last.evidence || []).find(e => e.hl === 'h3'); }));
  await page.click('[data-action="nav"][data-arg="overview"]'); await sleep(300);
  await page.click('[data-action="watchlist-add"]'); await sleep(200);
  console.log('Watchlist badge after remove', await page.$eval('.nav-badge', b => b.textContent));
  await page.click('[data-action="watchlist-add"]'); await sleep(200);
  await page.click('[data-action="nav"][data-arg="valuation"]'); await sleep(300);
  // theme toggle
  await page.click('#theme-toggle'); await sleep(300);
  console.log('THEME', await page.evaluate(() => document.documentElement.dataset.theme), await page.evaluate(() => localStorage.getItem('el-theme')));
  await shot('valuation-dark');
  await page.click('[data-action="nav"][data-arg="overview"]'); await shot('app-dark');
  await page.click('[data-action="company-tab"][data-arg="financials"]'); await shot('fin-dark');
  await page.click('[data-action="nav"][data-arg="ai"]'); await shot('ai-dark');
  await page.click('[data-action="nav"][data-arg="watchlist"]'); await sleep(300);
  await page.type('#wl-search', 'mr'); await sleep(200);
  console.log('WL focus kept', await page.evaluate(() => document.activeElement.id), 'value', await page.$eval('#wl-search', e => e.value));
  await shot('wl-dark');
  await page.click('[data-action="nav"][data-arg="saved"]'); await sleep(300);
  await page.click('.report-card'); await shot('modal-dark');
  await page.keyboard.press('Escape'); await sleep(200);
  console.log('Modal closed by Esc', await page.evaluate(() => !document.getElementById('modal-root')));
  await page.reload({ waitUntil: 'networkidle0' }); await sleep(900);
  console.log('After reload theme', await page.evaluate(() => document.documentElement.dataset.theme), 'hash', await page.evaluate(() => location.hash));
  await page.click('#theme-toggle');

  // mobile
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await shot('m-home');
  await page.click('.nav-burger'); await shot('m-menu');
  await page.click('#nav-links a[data-arg="mkt-pricing"]'); await sleep(300);
  console.log('M menu closed', await page.$eval('#nav-links', n => !n.classList.contains('open')), await page.evaluate(() => location.hash));
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  const s3 = await page.$eval('.scroll-product-section', el => ({ top: el.getBoundingClientRect().top + scrollY, h: el.offsetHeight }));
  await sleep(800); await page.evaluate(y => window.scrollTo(0, y), s3.top + (s3.h - 844) * 0.6); await sleep(600);
  await shot('m-slide2');
  console.log('M horiz overflow', await page.evaluate(() => document.documentElement.scrollWidth));
  await page.goto(BASE + '#app', { waitUntil: 'networkidle0' }); await shot('m-app');

  // contact form → /api/contact
  await page.setViewport({ width: 1440, height: 900, isMobile: false });
  await page.goto(BASE + '#contact', { waitUntil: 'networkidle0' }); await sleep(500);
  await page.type('#contact-name', 'E2E Test'); await page.type('#contact-email', 'e2e@example.com');
  await page.type('#contact-subject', 'Automated check'); await page.type('#contact-message', 'Automated end-to-end test message.');
  const [resp] = await Promise.all([page.waitForResponse(r => r.url().includes('/api/contact')), page.click('#send-msg-btn')]);
  await sleep(300);
  console.log('Contact API', resp.status(), await page.$eval('#toast', t => t.textContent));

  // legal pages
  for (const p of ['terms.html', 'privacy.html']) {
    const r = await page.goto(BASE + p); console.log(p, r.status());
  }
  console.log('ERRORS', errors.length ? errors : 'none');
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
