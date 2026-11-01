// Catch-bar playtest: opens the tackle box, picks a rig and bait, casts, strikes, and plays the catch bar with a simple
// controller (hold Space while the fish is above the zone centre) until a fish is landed. Screenshots go to playtest-shots/catchbar.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/catchbar.mjs [high|low] [rocky|seagrass] [mobile|narrow]
// Exits 0 only if a fish was landed, the tackle box and bar behaved, and there were no console errors.
import { launch } from './harness.mjs';
const quality = process.argv[2] ?? 'high', site = process.argv[3] ?? 'rocky', mobile = process.argv[4] === 'mobile', narrow = process.argv[4] === 'narrow'; // mobile: touch controls, held with pointer events on the bar; narrow: 375 px wide
const rigs = { rocky: ['float', 'greenweed'], seagrass: ['runningsinker', 'nipper'] }[site];
const tag = `${site}-${quality}${mobile ? '-touch' : narrow ? '-375' : ''}`;
const t = await launch({ query: `eco=${site}&quality=${quality}&play=1&time=day&tide=rising&season=summer${mobile ? '&touch=1' : ''}`, outDir: `playtest-shots/catchbar/${tag}`, width: narrow ? 375 : 1280, height: narrow ? 667 : 720, mobile });
const log = [], fail = msg => { log.push(['FAIL', msg]); ok = false; };
let ok = true;
const fs = () => t.state().then(s => s.fishing);
// Hold / release the bar: Space on desktop, a finger pressed on the bar on touch.
const hold = down => mobile ? t.page.evaluate(d => document.querySelector('#catchbar').dispatchEvent(new PointerEvent(d ? 'pointerdown' : 'pointerup', { bubbles: true, pointerId: 7 })), down) : down ? t.page.keyboard.down(' ') : t.page.keyboard.up(' ');
await t.wait(1500);
// Walk to the water.
await t.page.evaluate(() => { const w = window.__game.walker; w.heading = Math.PI; });
for (let i = 0; i < 80; i++) { await t.hold('KeyW', 250); if ((await t.state()).walker.waterDepth > 0.15) break; }
await t.shot('at-water');
// Tackle box: open with T (or the touch button), pick a rig and a bait, close with Done.
if (mobile) await t.page.evaluate(() => document.querySelector('[data-key="KeyT"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) && document.querySelector('[data-key="KeyT"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
else await t.tap('KeyT');
await t.wait(500);
if (!(await t.page.$('.tb'))) fail('tackle box did not open');
await t.shot('tackle-box');
await t.page.click(`.tb-rig[data-rig="${rigs[0]}"]`);
await t.page.click(`.tb-bait[data-bait="${rigs[1]}"]`);
await t.wait(200);
const picked = await t.page.evaluate(() => ({ ...window.__game.gear }));
if (picked.rig !== rigs[0] || picked.bait !== rigs[1]) fail(`gear not applied ${JSON.stringify(picked)}`);
await t.shot('tackle-picked');
await t.page.click('#tb-done'); await t.wait(400);
log.push(['gear', picked, 'chip', await t.page.evaluate(() => document.querySelector('#cond-chip')?.innerText.replace(/\s+/g, ' '))]);
// Cast, wait, strike, play the bar.
let landed = false, litter = 0, bars = [];
for (let round = 0; round < 8 && !landed; round++) {
  await t.tap('KeyR'); await t.wait(300);
  if ((await fs()).state === 'off') await t.tap('KeyR');
  await t.page.keyboard.down(' '); await t.wait(1100); await t.page.keyboard.up(' ');
  await t.wait(1200); if (round === 0) await t.shot('float-out');
  let struck = false;
  for (let i = 0; i < 400; i++) { const s = await fs(); if (s.state === 'bite') { await t.tap('Space'); struck = true; break; } await t.wait(100); }
  if (!struck) { log.push(['round', round, 'no bite']); continue; }
  await t.wait(200);
  let shots = 0, holding = false, lastLit = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const s = await fs(); if (s.state !== 'fight' || !s.bar) break;
    // Hold while the fish is above the zone centre (a touch of lead on the zone's speed stops it overshooting).
    const want = s.bar.fish - s.bar.zone - 0.3 * s.bar.zv > 0;
    if (want !== holding) { holding = want; await hold(want); }
    if (shots < 3 && Date.now() - t0 > 1500 * (shots + 1)) { await t.shot(`bar-${s.bar.profile}`); shots++; }
    await t.wait(30);
  }
  if (holding) await hold(false);
  await t.wait(600);
  const end = await fs();
  bars.push(await t.page.evaluate(() => ({ lit: window.__game.fishing.bar.litterCount, profile: window.__game.fishing.bar.profile })));
  log.push(['round', round, end.state, bars.at(-1)]);
  if (end.state === 'landed') {
    landed = true;
    await t.shot('landed');
    log.push(await t.page.evaluate(() => document.querySelector('#modal')?.innerText.replace(/\s+/g, ' ').slice(0, 160)));
    await t.page.click('#fx-release'); await t.wait(500);
  } else { await t.shot('lost'); log.push(await t.page.evaluate(() => [...document.querySelectorAll('.toast')].map(e => e.textContent).join(' | '))); await t.wait(500); }
}
if (!landed) fail('never landed a fish');
const prog = await t.page.evaluate(() => { const p = window.__game.progress; return { catches: (p.catches ?? []).map(c => `${c.id} ${c.length}cm ${c.spot} ${c.rig}/${c.bait} kept:${c.kept}`), steward: p.steward, stock: p.stock }; });
log.push(['progress', prog]);
const errs = t.errors.filter(e => !/Failed to load resource.*favicon/.test(e));
if (errs.length) fail(`console errors: ${errs.slice(0, 3).map(s => s.slice(0, 200)).join(' || ')}`);
console.log(JSON.stringify(log, null, 1), '\nOK:', ok, 'landed:', landed, 'console errors:', errs.length);
await t.close();
process.exit(ok ? 0 : 1);
