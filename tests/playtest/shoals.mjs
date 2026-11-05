// A close look at the castable shoals: stands beside each school in turn and saves a screenshot, into playtest-shots/polish/. Usage: node tests/playtest/shoals.mjs [label] [low|high] [site]
import { launch } from './harness.mjs';
const [label = 'a', q = 'high', site = 'seagrass'] = process.argv.slice(2);
const t = await launch({ query: `eco=${site}&quality=${q}&play=1&time=day&swell=1&tide=rising&season=summer`, outDir: 'playtest-shots/polish', width: 1280, height: 800 });
await t.wait(2500);
await t.page.evaluate(() => { const g = window.__game; g.panels.close?.(true); document.querySelector('#toast').innerHTML = ''; document.querySelectorAll('#hud, .hud, #prompt, #toast').forEach(e => { e.style.visibility = 'hidden'; }); });
for (let i = 0; i < 2; i++) {
  await t.page.evaluate(() => { const g = window.__game, w = g.walker, s = g.shoals.schools.find(s => s.ready); if (!s) return; w.pos.set(s.c.x - 6, g.world.walkAt(s.c.x - 6, s.c.y), s.c.y); g.rig.pitch = g.rig.pitchGoal = 1; g.rig.zoom = g.rig.dist = 15; });
  await t.wait(1200);
  await t.page.screenshot({ path: `playtest-shots/polish/shoal-${site}-${q}-${label}${i}.png` });
}
const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) console.log('ERRORS', errs.slice(0, 3));
await t.close(); console.log(errs.length ? 'problems' : 'shoals ok');
