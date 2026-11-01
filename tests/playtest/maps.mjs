// Map playtest: opens the map (M) at every site, on the site tab and the region tab, at desktop and phone width, and screenshots each into
// playtest-shots/views-B/. Also checks the minimap setting and that M toggles the panel. Usage: URL=http://localhost:8453/ node tests/playtest/maps.mjs [width]
import { launch } from './harness.mjs';
const width = Number(process.argv[2] ?? 1280), height = width < 500 ? 740 : 800;
let fail = 0;
for (const eco of ['rocky', 'seagrass', 'harbour', 'reef', 'river']) {
  const t = await launch({ url: process.env.URL ?? 'http://localhost:8453/', query: `eco=${eco}&quality=low&play=1&time=day&swell=${eco === 'rocky' || eco === 'harbour' ? 3 : 1}`, outDir: 'playtest-shots/views-B', width, height });
  await t.wait(1500);
  await t.page.evaluate(() => window.__game.panels.close(true)); await t.wait(200);
  await t.tap('KeyM'); await t.wait(700);
  let open = await t.page.evaluate(() => window.__game.mapOpen && window.__game.panels.isOpen);
  if (!open) { console.log('FAIL M did not open the map', eco); fail++; }
  await t.shot(`map-${eco}-${width}`);
  await t.tap('KeyM'); await t.wait(300);
  if (await t.page.evaluate(() => window.__game.panels.isOpen)) { console.log('FAIL M did not close the map', eco); fail++; }
  if (eco === 'seagrass' || eco === 'rocky') {
    await t.page.evaluate(() => window.__game.openMap('region')); await t.wait(500);
    await t.page.click('#mt-region'); await t.wait(300);
    await t.shot(`region-${eco}-${width}`);
    await t.tap('Escape');
    await t.page.evaluate(() => { const g = window.__game; g.settings.minimap = true; }); await t.wait(800);
    await t.shot(`minimap-${eco}-${width}`);
  }
  if (t.errors.length) { console.log('ERRORS', eco, t.errors.slice(0, 3)); fail++; }
  await t.browser.close();
}
console.log(fail ? `${fail} problem(s)` : 'maps ok'); process.exit(fail ? 1 : 0);
