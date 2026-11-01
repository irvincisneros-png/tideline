// Frame-rate probe: loads each site at a quality tier, walks a little, and reports frames per second over a few seconds.
// Usage: URL=http://localhost:8451/ node tests/playtest/perf.mjs [low|medium|high ...]   (default: low high)
import { launch } from './harness.mjs';
const tiers = process.argv.slice(2).length ? process.argv.slice(2) : ['low', 'high'];
for (const quality of tiers) for (const site of ['rocky', 'seagrass']) {
  const t = await launch({ query: `eco=${site}&quality=${quality}&play=1&time=day`, outDir: 'playtest-shots/perf', width: 1280, height: 720 });
  await t.wait(2500);
  const ps = await t.page.evaluate(() => { const g = window.__game; return { frame: g.frame, pr: g.renderer.getPixelRatio(), calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }; });
  await t.page.keyboard.down('w');
  const t0 = Date.now(), f0 = (await t.page.evaluate(() => window.__game.frame));
  await t.wait(5000);
  const f1 = await t.page.evaluate(() => window.__game.frame), dt = (Date.now() - t0) / 1000;
  await t.page.keyboard.up('w');
  const end = await t.page.evaluate(() => { const g = window.__game; return { pr: +g.renderer.getPixelRatio().toFixed(2), calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles }; });
  console.log(`${quality.padEnd(6)} ${site.padEnd(9)} ${((f1 - f0) / dt).toFixed(1)} fps  pixelRatio ${end.pr}  draw calls ${end.calls}  tris ${(end.tris / 1000).toFixed(0)}k  errors ${t.errors.length}`);
  await t.close();
}
