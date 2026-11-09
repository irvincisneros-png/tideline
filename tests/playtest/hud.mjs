// HUD survey: one screenshot of each on-screen state (title, walking, rod out, line out, fight, pause, touch), into playtest-shots/hud/<label>/.
// Usage: URL=http://localhost:8451/ node tests/playtest/hud.mjs [label] [mobile]
import { launch } from './harness.mjs';
const label = process.argv[2] ?? 'a', mobile = process.argv[3] === 'mobile';
const out = `playtest-shots/hud/${label}${mobile ? '-touch' : ''}`;
const m = await launch({ query: `quality=high${mobile ? '&touch=1' : ''}`, outDir: out, width: 1280, height: 720, mobile });
await m.wait(1200); await m.shot('menu'); await m.close();

const t = await launch({ query: `eco=seagrass&quality=high&play=1&time=day&tide=rising&season=summer${mobile ? '&touch=1' : ''}`, outDir: out, width: 1280, height: 720, mobile });
const press = down => mobile
  ? t.page.evaluate(d => document.querySelector('[data-key="Space"]')?.dispatchEvent(new PointerEvent(d ? 'pointerdown' : 'pointerup', { bubbles: true, pointerId: 3 })), down)
  : down ? t.page.keyboard.down(' ') : t.page.keyboard.up(' ');
const key = code => t.page.evaluate(c => { dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })); dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })); }, code);
await t.wait(800); await t.shot('land-arrive');
await t.wait(7000); await t.shot('land-settled');
await t.page.evaluate(() => { const w = window.__game.walker; w.heading = Math.PI; });
if (mobile) await t.page.evaluate(() => { const g = window.__game, w = g.walker; for (let z = w.pos.z; z > -200; z -= 0.5) { if (g.world.heightAt?.(w.pos.x, z) < -0.2) { w.pos.set(w.pos.x, g.world.walkAt(w.pos.x, z + 1), z + 1); break; } } });
else for (let i = 0; i < 80; i++) { await t.hold('KeyW', 250); if ((await t.state()).walker.waterDepth > 0.15) break; }
await t.shot('walking');
await key('KeyP'); await t.wait(500); await t.shot('pause'); await t.page.evaluate(() => window.__game.panels.close()); await t.wait(300);
await key('KeyR'); await t.wait(500); await t.shot('rod-ready');
await press(true); await t.wait(500); await t.shot('charging'); await press(false);
await t.wait(2500); await t.shot('line-out');
// Force a bite and fight so the catch bar shows.
for (let i = 0; i < 200; i++) { const s = (await t.state()).fishing.state; if (s === 'bite') break; await t.page.evaluate(() => { const f = window.__game.fishing; if (f.state === 'wait') f.biteT = Math.min(f.biteT ?? 1, 0.2); }); await t.wait(150); }
await t.shot('bite'); await press(true); await t.wait(80); await press(false); await t.wait(700); await t.shot('fight');
for (let i = 0; i < 120; i++) { const s = await t.state(); if (s.fishing.state !== 'fight') break; const b = s.fishing.bar; if (b) await press(b.fish < b.zone); await t.wait(60); }
await press(false); await t.wait(1500); await t.shot('after-fight');
await t.wait(2500); await t.shot('catch-flow');
console.log(JSON.stringify(await t.state()), t.errors.slice(0, 5));
await t.close();
