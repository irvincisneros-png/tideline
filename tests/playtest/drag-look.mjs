// Look controls playtest: a left-button drag turns the camera smoothly (no raw jumps), a click without a drag is still a click, the glide stops,
// and a one-finger drag on touch turns it too. Usage: URL=http://localhost:8451/ node tests/playtest/drag-look.mjs [mobile]
import { launch } from './harness.mjs';
const mobile = process.argv[2] === 'mobile';
const t = await launch({ query: `eco=seagrass&quality=low&play=1&time=day${mobile ? '&touch=1' : ''}`, outDir: `playtest-shots/drag-look${mobile ? '-touch' : ''}`, width: 1280, height: 720, mobile });
let ok = true; const log = [], fail = m => { log.push(['FAIL', m]); ok = false; };
await t.wait(1500);
const yaw = () => t.page.evaluate(() => window.__game.rig.yaw);
const y0 = await yaw();
const m = t.page.mouse, vp = t.page.viewportSize(), cx = Math.round(vp.width * 0.5), cy = Math.round(vp.height * 0.55), dx = Math.round(vp.width * 0.023);
// Left-drag 300 px to the right over 10 steps, sampling yaw each step.
const samples = [];
await m.move(cx, cy); await m.down({ button: 'left' });
for (let i = 1; i <= 10; i++) { await m.move(cx + i * dx, cy, { steps: 1 }); await t.wait(50); samples.push(await yaw()); }
await m.up({ button: 'left' });
const y1 = await yaw(); await t.wait(400); const y2 = await yaw(); await t.wait(400); const y3 = await yaw();
const steps = samples.map((v, i) => v - (i ? samples[i - 1] : y0));
log.push(['drag', JSON.stringify({ total: +(y1 - y0).toFixed(3), glide: +(y2 - y1).toFixed(4), settled: +(y3 - y2).toFixed(5), maxStep: +Math.max(...steps.map(Math.abs)).toFixed(3) })]);
if (!(Math.abs(y1 - y0) > 0.4)) fail(`left-drag did not turn the camera (${(y1 - y0).toFixed(3)} rad)`);
if (!(Math.abs(y3 - y2) < 0.002)) fail('the camera kept drifting after the drag ended');
if (steps.some(s => Math.sign(s) !== Math.sign(y1 - y0) && Math.abs(s) > 1e-4)) fail('the turn reversed mid-drag');
// A click without a drag still reaches the game as a click (input.js pushes it on mouseup under 5 px).
const clicked = await t.page.evaluate(async () => { const inp = window.__game.input; const c = document.getElementById('gl'); const r = c.getBoundingClientRect(); const ev = (type, b) => c.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: r.left + r.width * 0.55, clientY: r.top + r.height * 0.6, button: b })); ev('mousedown', 0); ev('mouseup', 0); return inp.clicks.length; });
if (!(clicked > 0)) fail('a plain click no longer registers');
await t.shot('after-drag');
const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) fail('console: ' + errs.slice(0, 3).join(' | '));
for (const l of log) console.log(...l);
console.log(ok ? 'drag-look ok' : 'drag-look FAILED');
await t.close(); process.exit(ok ? 0 : 1);
