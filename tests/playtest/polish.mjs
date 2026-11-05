// Polish views: inland and low-angle shots that realsites.mjs does not take (the skyline, lawns, shore foam from player height), into playtest-shots/polish/.
// Usage: URL=http://localhost:8451/ node tests/playtest/polish.mjs [label] [low|high] [sites] [hour]   e.g. polish.mjs a high rocky,harbour 18.2
import { launch } from './harness.mjs';
const label = process.argv[2] ?? 'a', q = process.argv[3] ?? 'high', sites = (process.argv[4] ?? 'rocky,harbour,seagrass,river').split(','), hour = process.argv[5];
const OUT = 'playtest-shots/polish';
// [name, x, z, yaw, pitch, zoom]: yaw 0 looks toward -z, pi/2 toward -x
const V = {
  rocky: [['inland', 30, 30, Math.PI, 0.42, 10], ['lawn', 34, 36, 2.6, 0.75, 16], ['cove', 2, 4, 0.1, 0.5, 9], ['platform', 48, -30, 0.8, 0.8, 14]],
  harbour: [['west', -70, 50, 1.9, 0.42, 10], ['lawn', 40, 70, 2.6, 0.8, 18], ['beach', -92, 34, 0.1, 0.5, 9]],
  seagrass: [['lake', 20, 16, 0.1, 0.42, 10], ['lawn', 10, 60, 3.0, 0.8, 16], ['flats', 30, 10, 0.3, 0.55, 9]],
  river: [['valley', -30, 18, 2.4, 0.42, 10]],
};
let fail = 0;
for (const site of sites) {
  const t = await launch({ query: `eco=${site}&quality=${q}&play=1&time=day&swell=1&tide=rising&season=summer`, outDir: OUT, width: 1280, height: 800 });
  await t.wait(2200);
  await t.page.evaluate(h => { const g = window.__game; g.panels.close?.(true); document.querySelector('#toast').innerHTML = ''; document.querySelectorAll('#hud, .hud, #prompt, #toast, .npc-label, .name-tag').forEach(e => { e.style.visibility = 'hidden'; }); if (h != null) { g.timeOfDay = +h; g.clock && (g.clock.hour = +h); } }, hour);
  for (const [name, x, z, yaw, pitch, zoom] of V[site]) {
    await t.page.evaluate(([x, z, yaw, pitch, zoom]) => { const g = window.__game, w = g.walker; w.pos.set(x, g.world.walkAt(x, z), z); w.vel.set(0, 0, 0); w.viewYaw = yaw; w.heading = Math.PI + yaw; g.rig.yaw = yaw; g.rig.pitch = g.rig.pitchGoal = pitch; g.rig.zoom = g.rig.dist = zoom; g.rig.focus.set(x, w.pos.y + 0.9, z); }, [x, z, yaw, pitch, zoom]);
    await t.wait(1400);
    await t.page.screenshot({ path: `${OUT}/${site}-${name}-${label}.png` });
  }
  const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) { console.log('ERRORS', site, errs.slice(0, 4)); fail++; }
  await t.close();
}
console.log(fail ? `${fail} problem(s)` : 'polish ok'); process.exit(fail ? 1 : 0);
