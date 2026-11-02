// Fish model check in the real game: swimming fish seen from the follow camera, and the brag mat with the fish drawn to its true length.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/fishpass2.mjs  -> playtest-shots/fishpass/game-*.png
import { launch } from './harness.mjs';
const out = 'playtest-shots/fishpass';
let t = await launch({ query: 'eco=harbour&quality=high&play=1&time=day&swell=1', outDir: out, width: 1100, height: 700 });
await t.wait(1500);
const ids = await t.page.evaluate(() => [...new Set(window.__game.world.life.agents.map(a => a.id))]);
console.log('agents', ids.join(','));
// Freeze the follow camera and fly a close one beside each fish (the angler's own view is high above the water).
await t.page.evaluate(() => { window.__game.rig.update = () => {}; });
for (const id of ['yellowfinbream', 'yakka', 'luderick', 'silvertrevally', 'garfish', 'slimymackerel']) {
  const ok = await t.page.evaluate(id => { const a = window.__game.world.life.agents.find(a => a.id === id && a.pos); window.__follow = a; return !!a; }, id);
  if (!ok) continue;
  for (let i = 0; i < 10; i++) {
    await t.page.evaluate(() => {
      const g = window.__game, a = window.__follow, d = a.dir ? a.dir.clone() : g.camera.position.clone().set(1, 0, 0);
      const side = d.clone().cross(g.camera.up).normalize(), L = g.world.life.kinds[a.id]?.length ?? 0.4;
      g.camera.position.copy(a.pos).addScaledVector(side, L * 2.6).add(g.camera.up.clone().multiplyScalar(L * 0.25)).addScaledVector(d, L * 0.3);
      g.camera.lookAt(a.pos); g.camera.updateMatrixWorld();
    });
    await t.wait(150);
  }
  await t.page.screenshot({ path: `${out}/game-swim-${id}.png` });
}
// The brag mat
for (const [id, len] of [['tailor', 46], ['yellowfinbream', 31]]) {
  await t.page.evaluate(([id, len]) => { const g = window.__game, cf = g.catchFlow; g.panels.close?.(); cf.run({ id, length: len }, 'jetty', () => {}); if (document.querySelector('.key-grid')) cf.stepMeasure(); }, [id, len]);
  await t.wait(700);
  await t.page.click('#m-lock').catch(() => {});
  await t.wait(400);
  await t.page.screenshot({ path: `${out}/game-mat-${id}.png` });
  await t.page.evaluate(() => { document.querySelector('#m-next')?.click(); });
  await t.wait(300);
}
console.log('errors', t.errors.slice(0, 5));
await t.close();
