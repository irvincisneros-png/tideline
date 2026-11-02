// Map playtest: opens the map on every site (This place tab) and the Illawarra coast tab, at desktop 1280x800, phone portrait 390x844 and
// phone landscape 844x390, and saves PNGs to playtest-shots/map/. Also checks the map fits (no sideways pan) and nothing throws.
// Usage: node tests/playtest/map.mjs [desktop|portrait|landscape ...]   (dev server on :8451; run one playtest at a time)
import { launch } from './harness.mjs';
const SIZES = { desktop: { width: 1280, height: 800 }, portrait: { phone: { w: 390, h: 844 } }, landscape: { phone: { w: 844, h: 390 } } };
const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SIZES);
const url = process.env.URL ?? 'http://localhost:8451/';
const outDir = 'playtest-shots/map';
let fail = 0;
for (const size of which) {
  for (const eco of ['rocky', 'seagrass', 'harbour', 'reef', 'river']) {
    const t = await launch({ url, query: `eco=${eco}&quality=low&play=1&time=day&swell=${eco === 'rocky' || eco === 'harbour' ? 3 : 1}`, outDir, ...SIZES[size] });
    await t.wait(1500);
    await t.page.evaluate(() => window.__game.panels.close(true)); await t.wait(400);   // clear any first-run card (upright phones then fall back to the pause menu)
    // desktop: the M key. Phone sideways: the 🗺 touch button. Phone upright (the 'turn sideways' pause menu): its Map button.
    if (size === 'desktop') await t.tap('KeyM'); else if (size === 'landscape') await t.page.tap('button[data-key="KeyM"]'); else { await t.page.waitForSelector('#p-map'); await t.page.click('#p-map'); }
    await t.wait(900);
    if (!await t.page.evaluate(() => window.__game.mapOpen && window.__game.panels.isOpen)) { console.log('FAIL M did not open the map', size, eco); fail++; }
    const fit = await t.page.evaluate(() => { const c = document.querySelector('#map-cv'), s = c?.parentElement; return c ? { cw: c.clientWidth, ch: c.clientHeight, bw: c.width, bh: c.height, pan: Math.max(s.scrollWidth - s.clientWidth, (document.querySelector('#modal .panel')?.scrollWidth ?? 0) - (document.querySelector('#modal .panel')?.clientWidth ?? 0)), vw: innerWidth } : null; });
    console.log(size, eco, JSON.stringify(fit));
    if (!fit || fit.pan > 1) { console.log('FAIL map does not fit', size, eco); fail++; }
    await t.shot(`site-${size}-${eco}`);
    if (eco === 'seagrass') {   // the coast tab is the same at every site: shoot it once per size
      await t.page.click('#mt-region'); await t.wait(500);
      await t.shot(`coast-${size}`);
      await t.page.click('#mt-site'); await t.wait(300);
    }
    if (size === 'desktop') await t.tap('KeyM'); else await t.page.click('#modal-close');   // M toggles it shut on a keyboard; the X on a phone
    await t.wait(300);
    if (size === 'portrait') await t.page.waitForSelector('#p-map');   // closing the map drops back to the pause menu
    else if (await t.page.evaluate(() => window.__game.panels.isOpen)) { console.log('FAIL the map did not close', size, eco); fail++; }
    if (t.errors.length) { console.log('ERRORS', size, eco, t.errors.slice(0, 3)); fail++; }
    await t.browser.close();
  }
}
console.log(fail ? `${fail} problem(s)` : 'map ok'); process.exit(fail ? 1 : 0);
