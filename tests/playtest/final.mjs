// Phase 7 final screenshots and ship checks that need no scripted save: the title screen (1280 and a 375x812 touch phone), the loading screen on a slow connection
// (the bar fills while the scripts arrive; no failure), the teacher page (screen, phone, print), and the river with its HUD showing FLOW (not tide or swell).
// Usage: URL=http://localhost:8451/ node tests/playtest/final.mjs      Screenshots in playtest-shots/final/. Exits 0 only if every check passed.
import { launch, getPlaywright } from './harness.mjs';
import path from 'node:path';

const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; console.log(cond ? 'ok  ' : 'FAIL', msg); };
const base = process.env.URL ?? 'http://localhost:8451/';
const out = 'playtest-shots/final';

// ---- the title, desktop
{
  const t = await launch({ query: 'quality=high&time=day', outDir: out, width: 1280, height: 800 });
  await t.wait(1500);
  const info = await t.page.evaluate(() => { const h = document.querySelector('.hub-link').getBoundingClientRect(); return { hub: h.width > 0 && h.top >= 0 && h.top < 60, btns: ['#btn-play', '#btn-settings', '#btn-teacher', '#btn-credits'].every(s => document.querySelector(s).getBoundingClientRect().width > 0) }; });
  check(info.hub, 'the "← Learning Hub" link is visible at the top left of the title'); check(info.btns, 'Start fishing, Settings, Teacher page and Credits are on the title');
  await t.shot('title-1280');
  check(t.errors.length === 0, `title: zero console errors (${t.errors.length})`);
  await t.close();
}
// ---- the title on a phone (375x812, touch)
{
  const t = await launch({ query: 'quality=low&time=day', outDir: out, phone: { w: 375, h: 812 } });
  await t.wait(1500);
  await t.shot('title-phone-375x812');
  check(await t.page.evaluate(() => document.documentElement.scrollWidth <= 376), 'the phone title does not scroll sideways');
  await t.page.tap('#btn-credits'); await t.wait(500);
  check(await t.page.evaluate(() => /pending AEO\/AECG review/.test(document.querySelector('.credits')?.innerText ?? '')), 'Credits opens by touch and names the AEO/AECG note');
  await t.shot('credits-phone-375x812');
  check(t.errors.length === 0, `phone title: zero console errors (${t.errors.length})`);
  await t.close();
}
// ---- loading on a slow connection: throttle the network and watch the bar
{
  const pw = getPlaywright();
  const browser = await pw.chromium.launch({ channel: 'chrome', args: [process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });   // "fast 3G" (about 1.6 Mbit/s)
  const t0 = Date.now(); const widths = [];
  await page.goto(`${base}?quality=low&time=day`, { waitUntil: 'commit' });
  const sample = setInterval(async () => { try { const w = await page.evaluate(() => parseFloat(document.querySelector('#load-bar')?.style.width || '0')); widths.push(w); } catch { /* navigating */ } }, 1500);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(out, 'loading-slow-connection.png') });
  await page.waitForFunction(() => window.__game?.mode === 'menu', null, { timeout: 280000 });
  clearInterval(sample);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  check(true, `first load on fast 3G (1.6 Mbit/s, 150 ms) reached the title in ${secs} s`);
  check(widths.length >= 2 && widths.some((w, i) => i && w > widths[i - 1]), `the loading bar moved while downloading: ${widths.map(w => Math.round(w) + '%').join(' ')}`);
  check(errors.length === 0, `slow load: zero console errors (${errors.length}${errors.length ? ': ' + errors[0].slice(0, 200) : ''})`);
  await browser.close();
}
// ---- the teacher page: desktop, phone and print
{
  const pw = getPlaywright();
  const browser = await pw.chromium.launch({ channel: 'chrome' });
  const errors = [];
  for (const [name, vp, mobile] of [['1280', { width: 1280, height: 900 }, false], ['phone-375x812', { width: 375, height: 812 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}teacher.html`); await page.waitForTimeout(1500);
    const r = await page.evaluate(() => ({ qr: document.querySelectorAll('.t-card canvas').length, sections: ['glance', 'lessons', 'links', 'export', 'syllabus', 'sources'].every(id => document.getElementById(id)), sea: /Sea Country content pending AEO\/AECG review/.test(document.body.innerText), over: document.documentElement.scrollWidth - document.documentElement.clientWidth, sources: ['DPIRD', 'SAFS', 'GoodFish', 'carp'].every(w => document.body.innerText.includes(w)) }));
    check(r.qr >= 5 && r.sections && r.sea && r.sources, `teacher page (${name}): sections, QR codes, sources and the AEO/AECG note are there`);
    check(r.over <= 2, `teacher page (${name}): no sideways scroll (${r.over}px)`);
    await page.screenshot({ path: path.join(out, `teacher-${name}.png`), fullPage: name === '1280' });
    if (name === '1280') {
      await page.screenshot({ path: path.join(out, 'teacher-top-1280.png') });
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: path.join(out, 'teacher-print.pdf'), format: 'A4', printBackground: true });
      await page.screenshot({ path: path.join(out, 'teacher-print-preview.png'), fullPage: true });
      const hidden = await page.evaluate(() => ['nav.toc', '.builder', '.top .btns'].every(s => getComputedStyle(document.querySelector(s)).display === 'none'));
      check(hidden, 'print CSS hides the navigation, the link builder and the buttons');
    }
    await ctx.close();
  }
  check(errors.length === 0, `teacher page: zero console errors (${errors.length})`);
  await browser.close();
}
// ---- the river: the HUD shows flow, not tide or swell
for (const flow of ['normal', 'high']) {
  const t = await launch({ query: `eco=river&play=1&quality=high&time=day&season=summer&flow=${flow}&tide=rising&swell=1.4`, outDir: out, width: 1280, height: 800 });
  await t.wait(1500);
  await t.page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
  const chip = await t.page.evaluate(() => document.querySelector('#cond-chip b')?.innerText ?? '');
  check(/flow/i.test(chip) && !/tide|swell/i.test(chip), `river HUD (${flow}): "${chip}"`);
  const lic = await t.page.evaluate(() => !!document.querySelector('.licence'));
  if (lic) { await t.page.click('#lic-ok'); await t.wait(300); }
  await t.page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
  await t.shot(`river-hud-${flow}-flow`);
  check(t.errors.length === 0, `river (${flow}): zero console errors (${t.errors.length})`);
  await t.close();
}
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
