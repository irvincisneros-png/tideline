// Phase 7: the GitHub Pages simulation. Serve the PARENT folder so the game lives under a /tideline/ sub-path (exactly how Pages serves it), then load the title,
// every site, the teacher page and confirm: zero 404s or failed requests, zero console errors, every asset path relative, vendor/ served (.nojekyll).
// It also reports the first-load payload (raw and gzipped, as Pages serves text gzipped).
// Usage:  (cd .. && python3 tideline/devserver.py 8452) &   then   URL=http://localhost:8452/ node tests/playtest/pages.mjs
import { launch } from './harness.mjs';
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';

const base = process.env.URL ?? 'http://localhost:8452/';
const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; };
const sites = ['rocky', 'seagrass', 'harbour', 'reef', 'river'];
let bad = [], bytes = 0, files = new Map(), gz = 0;
const watch = page => {
  page.on('response', async r => {
    const u = r.url();
    if (!u.startsWith(base)) return;
    if (r.status() >= 400) bad.push(`${r.status()} ${u}`);
    try { const b = await r.body(); files.set(u, b.length); } catch { /* redirects */ }
  });
  page.on('requestfailed', q => { if (q.url().startsWith(base) && q.failure()?.errorText !== 'net::ERR_ABORTED') bad.push(`FAILED ${q.url()} ${q.failure()?.errorText}`); });   // (ERR_ABORTED = we navigated away mid-download)
};
// ---- 1. the title, from the sub-path
const t = await launch({ url: base, path: 'tideline/', query: 'quality=low', outDir: 'playtest-shots/final/pages', onPage: watch });
const page = t.page;
await t.wait(1500);
check(await page.evaluate(() => location.pathname === '/tideline/'), 'served under /tideline/');
check(bad.length === 0, `title screen: zero 404s or failed requests ${bad.slice(0, 5).join(' | ')}`);
const firstLoad = [...files.entries()];
const total = firstLoad.reduce((a, [, n]) => a + n, 0);
for (const [u, n] of firstLoad) { if (/\.(js|css|html|svg|json|mjs)(\?|$)/.test(u)) { const f = new URL(u).pathname.replace(/^\/tideline\//, ''); const local = f === '' ? 'index.html' : f; gz += existsSync(local) ? gzipSync(readFileSync(local)).length : n; } else gz += n; }
check(firstLoad.some(([u]) => /vendor\/three\/build\/three\.module\.js/.test(u)), 'vendor/ is served (.nojekyll is working)');
const mb = n => (n / 1048576).toFixed(2);
console.log(`FIRST LOAD (rocky, title): ${firstLoad.length} files, ${mb(total)} MB raw, about ${mb(gz)} MB over the wire (text gzipped by Pages)`);
const byType = {}; for (const [u, n] of firstLoad) { const k = /\.glb/.test(u) ? 'glb models' : /\.js/.test(u) ? (/vendor/.test(u) ? 'vendor js' : 'game js') : /\.css/.test(u) ? 'css' : 'other'; byType[k] = (byType[k] ?? 0) + n; }
console.log('  by type:', Object.entries(byType).map(([k, n]) => `${k} ${mb(n)} MB`).join(', '));
await t.shot('title');
// ---- 2. every site (a deep link, ?play)
for (const s of sites) {
  bad = [];
  await page.goto(`${base}tideline/?eco=${s}&play=1&quality=low&time=day`);
  await page.waitForFunction(id => window.__game?.mode === 'land' && window.__game.eco.id === id && !window.__game.loading, s, { timeout: 120000 }).catch(() => {});
  await t.wait(1200);
  check(await page.evaluate(id => window.__game?.mode === 'land' && window.__game.eco.id === id, s), `${s}: loads and plays under /tideline/`);
  check(bad.length === 0, `${s}: zero 404s or failed requests ${bad.slice(0, 4).join(' | ')}`);
}
// ---- 3. the ceremony and the co-op (their own scripts, models and styles)
bad = [];
await page.goto(`${base}tideline/?ceremony=awards&quality=low`);
await page.waitForFunction(() => window.__game?.mode === 'ceremony', null, { timeout: 120000 }).catch(() => {});
await t.wait(1500);
check(await page.evaluate(() => window.__game?.mode === 'ceremony'), 'the ceremony runs under /tideline/'); check(bad.length === 0, `ceremony: zero 404s ${bad.slice(0, 4).join(' | ')}`);
// ---- 4. the teacher page
bad = [];
await page.goto(`${base}tideline/teacher.html`); await t.wait(1500);
check(bad.length === 0, `teacher.html: zero 404s ${bad.slice(0, 4).join(' | ')}`);
check(await page.evaluate(() => document.querySelectorAll('.t-card canvas').length >= 5 && !!document.querySelector('#b-qr')), 'teacher.html draws its QR codes');
check(await page.evaluate(() => [...document.querySelectorAll('input[readonly]')].every(i => i.value.includes('/tideline/'))), 'teacher links point under /tideline/');
await t.shot('teacher');
// ---- 5. paths
const html = readFileSync('index.html', 'utf8') + readFileSync('teacher.html', 'utf8');
check(!/(src|href)="\/(?!\/)/.test(html), 'index.html and teacher.html use no root-absolute paths');
check(!/url\(\s*['"]?\//.test(readFileSync('styles.css', 'utf8')), 'styles.css uses no root-absolute urls');
check(existsSync('.nojekyll'), '.nojekyll exists');
check(t.errors.length === 0, `zero console errors (${t.errors.length}${t.errors.length ? ': ' + t.errors.slice(0, 3).join(' || ').slice(0, 300) : ''})`);
for (const l of log) console.log(...l);
await t.close();
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
