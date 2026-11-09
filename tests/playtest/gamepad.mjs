// Controller playtest: a fake standard gamepad is fed to the page (navigator.getGamepads is stubbed) and drives the real game.
// Walk with the stick, open the pause menu with Start, steer the focus with the D-pad, confirm, back out, rod out and cast with the face buttons.
// Usage: URL=http://localhost:8451/ node tests/playtest/gamepad.mjs [xbox|nintendo]
import { launch } from './harness.mjs';
const fam = process.argv[2] ?? 'xbox';
const id = fam === 'nintendo' ? 'Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)' : 'Xbox Wireless Controller (STANDARD GAMEPAD)';
const OK = fam === 'nintendo' ? 1 : 0, BACK = fam === 'nintendo' ? 0 : 1;
const t = await launch({ query: 'eco=seagrass&quality=low&play=1&time=day&tide=rising&season=summer', outDir: `playtest-shots/gamepad/${fam}`, width: 1280, height: 720 });
await t.page.evaluate(id => { const pad = window.__pad = { id, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }; Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true }); }, id);
let ok = true; const check = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) ok = false; };
const ev = (f, a) => t.page.evaluate(f, a);
const btn = (i, down) => ev(([i, d]) => { window.__pad.buttons[i] = { pressed: d, value: d ? 1 : 0 }; }, [i, down]);
const tap = async (i, ms = 90) => { await btn(i, true); await t.wait(ms); await btn(i, false); await t.wait(160); };
const stick = (x, y) => ev(([x, y]) => { window.__pad.axes[0] = x; window.__pad.axes[1] = y; }, [x, y]);
await t.wait(1200);
const p0 = (await t.state()).walker.pos;
await stick(0, -0.8); await t.wait(1200); await stick(0, 0); await t.wait(200);
const p1 = (await t.state()).walker.pos;
check(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 1.5, `the left stick walks the angler (${Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(1)} m)`);
check(await ev(() => document.body.classList.contains('pad')), 'the game notices the pad');
const hints = await ev(() => document.querySelector('#keys').innerText.replace(/\s+/g, ' '));
check(/Rod/.test(hints) && !/\bEsc\b|\bR Rod/.test(hints), `the hint bar shows pad buttons: "${hints}"`);
await t.shot('walk');
const yaw0 = (await t.state()).walker.camYaw; await ev(() => { window.__pad.axes[2] = 1; }); await t.wait(500); await ev(() => { window.__pad.axes[2] = 0; }); await t.wait(300);
check(Math.abs((await t.state()).walker.camYaw - yaw0) > 0.1, 'the right stick turns the camera');
await tap(9);
check(await ev(() => !!document.querySelector('#p-resume')), 'Start opens the pause menu');
await t.wait(200);
check(await ev(() => document.activeElement?.id === 'p-resume'), 'Resume has the focus');
await tap(15); check(await ev(() => document.activeElement?.id === 'p-map'), `D-pad right moves to Map (${await ev(() => document.activeElement?.id)})`);
await tap(13); check(await ev(() => document.activeElement?.id === 'p-tackle'), `D-pad down moves to the tile below (${await ev(() => document.activeElement?.id)})`);
await tap(12); await t.shot('pause');
await tap(OK); await t.wait(500);
check(await ev(() => window.__game.mapOpen && window.__game.panels.isOpen), 'confirm on Map opens the map');
await tap(BACK); await t.wait(300);
check(await ev(() => !window.__game.panels.isOpen), 'back closes it');
// Fishing: to the water, rod out, hold confirm to wind up, release to cast.
await ev(() => { const g = window.__game, w = g.walker; w.heading = Math.PI; g.rig.yaw = 0; });
for (let i = 0; i < 80; i++) { await t.hold('KeyW', 250); if ((await t.state()).walker.waterDepth > 0.15) break; }
await stick(0, -0.3); await t.wait(150); await stick(0, 0); await t.wait(150);   // (the keyboard walk handed the hints back; a nudge of the stick takes them again)
await tap(2); await t.wait(300);
check((await t.state()).fishing.state === 'ready', 'the rod button takes the rod out');
check(/A/.test(await ev(() => document.querySelector('#prompt').innerText)), `the cast prompt names the pad button: "${await ev(() => document.querySelector('#prompt').innerText)}"`);
await btn(OK, true); await t.wait(700);
check((await t.state()).fishing.state === 'charge', 'holding confirm winds up the cast');
await btn(OK, false); await t.wait(1800);
check(['wait', 'retrieve', 'flying', 'bite'].includes((await t.state()).fishing.state), `releasing it casts (${(await t.state()).fishing.state})`);
console.log('    toasts', JSON.stringify((await t.state()).toasts)); await t.shot('cast');
const errs = t.errors.filter(e => !/favicon/.test(e)); check(!errs.length, `no console errors ${errs.slice(0, 3)}`);
await t.close(); console.log(ok ? 'gamepad ok' : 'gamepad FAILED'); process.exit(ok ? 0 : 1);
