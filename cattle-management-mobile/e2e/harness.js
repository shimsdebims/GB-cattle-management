/**
 * Shared setup for the walkthroughs: serves ../dist (run `npx expo export -p web`
 * first), opens it at iPhone 13 size, and routes every /api/ call to the fake API.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const DIST = path.resolve(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

async function start({ api, port = 4180, context = {} }) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    throw new Error('No web build found. Run `npx expo export -p web` in cattle-management-mobile first.');
  }
  const server = http.createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(port, resolve));

  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
  );
  const ctx = await browser.newContext({ ...devices['iPhone 13'], ...context });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());

  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.host === `localhost:${port}`) return route.continue();
    if (!url.pathname.startsWith('/api/')) return route.fulfill({ status: 204, body: '' });
    const raw = req.postData();
    const r = api.handle(req.method(), url.pathname.slice(4), url.searchParams, raw ? JSON.parse(raw) : undefined);
    return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
  });

  const results = [];
  const check = (name, cond, detail = '') => {
    results.push(Boolean(cond));
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  };
  const finish = async () => {
    check('No JavaScript errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    const passed = results.filter(Boolean).length;
    console.log(`\n${passed}/${results.length} passed`);
    await browser.close();
    server.close();
    return passed === results.length;
  };
  const setOnline = async (online) => {
    await ctx.setOffline(!online);
    await page.evaluate((on) => {
      window.dispatchEvent(new Event(on ? 'online' : 'offline'));
      if (navigator.connection) navigator.connection.dispatchEvent(new Event('change'));
    }, online);
  };

  return { page, ctx, check, finish, setOnline, url: `http://localhost:${port}/` };
}

/** Clicks a bottom tab by its label. */
const tab = (page, name) =>
  page.getByRole('tab', { name }).or(page.getByRole('button', { name })).first().click();

/** Any element on screen wider than the phone, outside horizontal scrollers. */
const overflow = (page) =>
  page.evaluate(() => {
    const w = window.innerWidth;
    const bad = [];
    document.querySelectorAll('#root *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || r.right <= w + 1) return;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') return;
      }
      bad.push((el.innerText || el.tagName).slice(0, 30));
    });
    return bad.slice(0, 5);
  });

module.exports = { start, tab, overflow };
