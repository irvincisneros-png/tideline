// The sky by itself: points the camera straight at the sun (or moon) and along the horizon, at each time of day, into playtest-shots/polish/. Usage: node tests/playtest/skyview.mjs [label] [low|high] [site]
import { launch } from './harness.mjs';
const [label = 'a', q = 'high', site = 'harbour'] = process.argv.slice(2);
let bad = 0;
for (const time of ['dawn', 'day', 'dusk', 'night']) {
  const t = await launch({ query: `eco=${site}&quality=${q}&play=1&time=${time}&swell=1&tide=rising&season=summer`, outDir: 'playtest-shots/polish', width: 1280, height: 800 });
  await t.wait(2200);
  await t.page.evaluate(async () => {
    const { globalUniforms: G } = await import('/src/ocean/shaders.js'); const g = window.__game; g.panels.close?.(true); document.querySelectorAll('#hud, .hud, #prompt, #toast').forEach(e => { e.style.visibility = 'hidden'; });
    g.rig.update = () => {}; const c = g.camera, s = G.uSunDir.value; c.fov = 50; c.updateProjectionMatrix(); c.position.set(0, 12, 0); c.lookAt(s.x * 100, Math.max(0.1, s.y) * 100 + 10, s.z * 100);
  });
  await t.wait(800); await t.page.screenshot({ path: `playtest-shots/polish/sky-${site}-${time}-${label}.png` });
  if (t.errors.filter(e => !/favicon/.test(e)).length) { console.log('ERRORS', time, t.errors.slice(0, 3)); bad++; }
  await t.close();
}
console.log(bad ? 'problems' : 'skyview ok');
