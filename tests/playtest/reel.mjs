// Reel playtest: casts, strikes and plays the catch bar with real input while capturing the angler: a screenshot series from the gameplay camera,
// a close-up series, and a 10-frame sequence at 100 ms (playtest-shots/reel/seq) for checking the pose is smooth. Also asserts the angler keeps
// facing the line (heading never drifts more than ~0.35 rad from the cast bearing) and cranks while Space is held.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/reel.mjs [rocky|seagrass] [close]
import { mkdirSync } from 'node:fs';
import { launch } from './harness.mjs';
const site = process.argv[2] ?? 'rocky', rigs = { rocky: ['paternoster', 'beachworm'], seagrass: ['runningsinker', 'prawn'] }[site];
const t = await launch({ query: `eco=${site}&quality=high&play=1&time=day&tide=rising&season=summer`, outDir: 'playtest-shots/reel', width: 1280, height: 720 });
mkdirSync('playtest-shots/reel/seq', { recursive: true });
let ok = true; const log = [], fail = m => { ok = false; log.push(['FAIL', m]); };
const fs = () => t.state().then(s => s.fishing);
await t.wait(1500);
await t.page.evaluate(() => { window.__game.walker.heading = Math.PI; });
for (let i = 0; i < 80; i++) { await t.hold('KeyW', 250); if ((await t.state()).walker.waterDepth > 0.15) break; }
await t.page.evaluate(([r, b]) => { Object.assign(window.__game.gear, { rig: r, bait: b }); }, rigs);
let fought = false;
for (let round = 0; round < 8 && !fought; round++) {
  await t.tap('KeyR'); await t.wait(300);
  if ((await fs()).state === 'off') await t.tap('KeyR');
  await t.page.keyboard.down(' '); await t.wait(1100); await t.page.keyboard.up(' ');
  await t.wait(1200);
  let struck = false;
  for (let i = 0; i < 400; i++) { const s = await fs(); if (s.state === 'bite') { await t.shot('strike-wait'); await t.tap('Space'); struck = true; break; } await t.wait(100); }
  if (!struck) continue;
  fought = true;
  const bearing = await t.page.evaluate(() => { const g = window.__game, w = g.walker, f = g.fishing; return Math.atan2(f.lineDir.x, f.lineDir.z); });
  await t.wait(150);
  let holding = false, shots = 0, maxDev = 0; const t0 = Date.now(); let seqN = 0, lastSeq = 0, cranks = [];
  const closeUp = process.argv[3] === 'close';
  if (closeUp) await t.page.evaluate(() => { const g = window.__game, o = g.rig.update.bind(g.rig); g.rig.update = (dt, w, tg, also, a) => { g.rig.zoom = 5.5; g.rig.pitch = 0.95; return o(dt, w, tg, null, a); }; });
  while (Date.now() - t0 < 60000) {
    const s = await fs(); if (s.state !== 'fight' || !s.bar) break;
    const want = s.bar.fish - s.bar.zone - 0.3 * s.bar.zv > 0;
    if (want !== holding) { holding = want; await (want ? t.page.keyboard.down(' ') : t.page.keyboard.up(' ')); }
    const info = await t.page.evaluate(() => { const g = window.__game, a = g.angler; return { h: g.walker.heading, crank: a.crank, hold: a.hold_, pull: a.pull, lean: a.joints.torso.rotation.x, tension: a.tension, speed: g.walker.speed }; });
    let dev = Math.abs(((info.h - bearing + Math.PI * 3) % (Math.PI * 2)) - Math.PI); maxDev = Math.max(maxDev, dev); cranks.push(info);
    const el = Date.now() - t0;
    if (shots < 8 && el > 700 * (shots + 1)) { await t.shot(`reel-${closeUp ? 'close' : 'top'}-${s.bar.profile}`); shots++; }
    if (seqN < 10 && el > 4000 && Date.now() - lastSeq >= 100) { lastSeq = Date.now(); await t.page.screenshot({ path: `playtest-shots/reel/seq/${closeUp ? 'close' : 'top'}-${String(seqN++).padStart(2, '0')}.png`, clip: { x: 380, y: 160, width: 520, height: 400 } }); }
    await t.wait(30);
  }
  await t.page.keyboard.up(' ');
  // Smoothness: frame-to-frame change of the torso lean between samples and of the crank speed.
  let jerk = 0; for (let i = 2; i < cranks.length; i++) jerk = Math.max(jerk, Math.abs(cranks[i].lean - cranks[i - 1].lean));
  const moved = new Set(cranks.map(c => c.crank.toFixed(2))).size;
  log.push(['fight', { samples: cranks.length, maxHeadingDev: +maxDev.toFixed(3), maxLeanStep: +jerk.toFixed(3), distinctCrank: moved, maxSpeed: Math.max(...cranks.map(c => c.speed)) }]);
  if (maxDev > 0.35) fail(`heading drifted ${maxDev}`);
  if (moved < 5) fail('crank did not turn');
}
if (!fought) fail('never hooked a fish');
const errs = t.errors.filter(e => !/favicon/.test(e));
if (errs.length) fail(`console errors: ${errs.slice(0, 3).join(' || ')}`);
console.log(JSON.stringify(log, null, 1), '\nOK:', ok, 'console errors:', errs.length);
await t.close(); process.exit(ok ? 0 : 1);
