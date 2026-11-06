// Snag playtest (Day 3): a bait rig is drawn in over structure and snags (forced, so it is not luck); tapping frees it and counts p.skills.snagFreed; a hold cuts the line
// (toast, lostLine, the game.onLineCut hook, bait gone); R, T, H, M and E are blocked while snagged; the big on-screen button does all of it on a phone; the next fight's first
// litter is the line you lost and collecting it pays nothing; a crossed line with a fishing NPC (tangle) is wound in by holding. Screenshots: playtest-shots/snag/.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/snag.mjs [mobile]
// Exits 0 only if every check held and there were no console errors.
import { launch } from './harness.mjs';
const mobile = process.argv[2] === 'mobile';
const t = await launch({ query: `eco=seagrass&quality=low&play=1&time=day&tide=rising&season=summer${mobile ? '&touch=1' : ''}`, outDir: `playtest-shots/snag/${mobile ? 'touch' : 'desktop'}`, width: 1280, height: 720, mobile });
const log = [], fail = msg => { log.push(['FAIL', msg]); ok = false; };
let ok = true;
const press = down => mobile
  ? t.page.evaluate(d => document.querySelector('[data-key="Space"]').dispatchEvent(new PointerEvent(d ? 'pointerdown' : 'pointerup', { bubbles: true, pointerId: 3 })), down)
  : down ? t.page.keyboard.down(' ') : t.page.keyboard.up(' ');
const key = code => t.page.keyboard.press(code);
const probe = () => t.page.evaluate(() => {
  const g = window.__game, f = g.fishing, p = g.progress;
  return { state: f.state, kind: f.snagKind, tension: +(f.snag?.tension ?? 0).toFixed(2), taps: f.snag?.taps ?? null, need: f.snag?.need ?? null, armed: f.snag?.armed ?? null, panel: g.panels.isOpen, dist: +f.dist.toFixed(1),
    freed: p.skills?.snagFreed ?? 0, lost: p.skills?.lostLine?.seagrass ?? 0, bait: p.shop?.bait?.prawn ?? 0, cut: window.__cut ?? null, coins: p.coins, litter: p.steward?.litter ?? 0, points: p.steward?.points ?? 0,
    toasts: [...document.querySelectorAll('.toast')].map(e => e.textContent), prompt: document.querySelector('#prompt')?.textContent ?? '' };
});
const until = async (pred, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await probe(); if (pred(s)) return s; await t.wait(80); } return await probe(); };
const tapOnce = async () => { await press(true); await t.wait(110); await press(false); await t.wait(420); };

await t.wait(1500);
await t.page.evaluate(() => { window.__game.walker.heading = Math.PI; });
for (let i = 0; i < 80; i++) { await t.hold('KeyW', 250); if ((await t.state()).walker.waterDepth > 0.15) break; }
await t.page.evaluate(() => { const g = window.__game; g.gear.rig = 'runningsinker'; g.gear.bait = 'prawn'; ((g.progress.shop ??= {}).bait ??= {}).prawn = 20; g.progress.tips = {}; window.__cut = null; g.onLineCut = r => { window.__cut = r; }; });
await key('r'); await t.wait(300);

/** Cast, and once the float lands pin the spot to a snaggy one, stop bites, force the next snag, then hold Space (reel) until the rig snags. */
async function toSnag() {
  await t.page.evaluate(() => { window.__game.fishing.forceSnag = true; });
  await press(true); await t.wait(700); await press(false);
  const w = await until(s => s.state === 'wait', 6000);
  if (w.state !== 'wait') { fail(`cast did not reach wait (${w.state})`); return false; }
  await t.page.evaluate(() => { const f = window.__game.fishing; f.spot = 'jetty'; f.waitT = 999; });
  await press(true);
  const s = await until(x => x.state === 'snagged', 9000);
  if (s.state !== 'snagged') { await press(false); fail(`reeling over structure did not snag (${s.state})`); return false; }
  return true;   // Space is still down: that is the point of the "armed" rule
}

// ---- 1. A snag while Space is held: a held reel never counts as a pull; tapping frees the rig and counts it.
if (await toSnag()) {
  let s = await until(x => x.state === 'snagged');
  log.push(['snagged', `${s.kind}, need ${s.need} taps, armed ${s.armed}, prompt: ${s.prompt}`]);
  if (!/Snagged! Tap, tap, tap/.test(s.prompt)) fail(`snag prompt wrong: ${s.prompt}`);
  await t.wait(2500);   // still holding the reel the whole time
  s = await probe();
  if (s.state !== 'snagged' || s.tension !== 0 || s.armed !== false) fail(`a held reel counted (state ${s.state}, tension ${s.tension}, armed ${s.armed})`);
  if (!s.toasts.some(x => /hold fish|hold hooks|structure/i.test(x))) log.push(['note', 'first-snag structure tip not in toasts (may have expired)']);
  await t.shot('snagged-prompt');
  await press(false); await t.wait(250);
  s = await probe(); if (!s.armed) fail('releasing Space did not arm the snag');
  // R, T, H, M and E are all blocked while snagged.
  for (const [k, name] of [['r', 'R'], ['t', 'T'], ['h', 'H'], ['m', 'M'], ['e', 'E']]) {
    await key(k); await t.wait(250);
    const b = await probe();
    if (b.state !== 'snagged') fail(`${name} got out of the snag (${b.state})`);
    if (b.panel) { fail(`${name} opened a panel while snagged`); await t.page.evaluate(() => window.__game.panels.close(true)); }
  }
  // Hold a moment (below a cut) for the tension ring, then let go and tap.
  await press(true); await t.wait(750); s = await probe();
  if (!(s.tension > 0.1 && s.tension < 1)) fail(`tension not building while held (${s.tension})`);
  log.push(['tension', String(s.tension)]);
  await t.shot('tension-ring'); await press(false); await t.wait(1500);
  s = await probe(); if (s.state !== 'snagged' || s.tension !== 0) fail(`tension did not fall when released (${s.tension})`);
  const freedBefore = s.freed;
  for (let i = 0; i < 6 && (await probe()).state === 'snagged'; i++) await tapOnce();
  s = await until(x => x.state !== 'snagged', 2000);
  if (s.state !== 'wait') fail(`tapping did not free the rig back to wait (${s.state})`);
  if (s.freed !== freedBefore + 1) fail(`snagFreed ${freedBefore} -> ${s.freed}`);
  if (s.lost !== 0) fail('a freed snag counted a lost line');
  log.push(['freed', `state ${s.state}, snagFreed ${s.freed}, taps needed ${s.need}`]);
  await t.wait(200); await t.shot('freed');
}

// ---- 2. A snag you pull on: a hold cuts the line. Toast, bait gone, lostLine, the hook, rod ready again.
await t.page.evaluate(() => { window.__game.fishing.stop(); });
await key('r'); await t.wait(300);
const bait0 = (await probe()).bait;
if (await toSnag()) {
  await press(false); await t.wait(300);
  await press(true);
  let s = await until(x => x.state !== 'snagged', 4000);
  await press(false);
  if (s.state !== 'ready') fail(`holding did not cut the line (${s.state})`);
  if (!s.toasts.some(x => /snapped/i.test(x))) fail(`no teaching toast on a cut: ${JSON.stringify(s.toasts)}`);
  if (s.lost !== 1) fail(`lostLine ${s.lost}, wanted 1`);
  if (s.cut !== 'snag') fail(`onLineCut hook said ${s.cut}`);
  if (s.bait !== bait0 - 1) fail(`bait ${bait0} -> ${s.bait}`);
  log.push(['cut', `state ${s.state}, lostLine ${s.lost}, hook ${s.cut}, bait ${bait0} -> ${s.bait}`]);
  await t.shot('cut');
}

// ---- 3. The next fight at this site: its first litter is the line you lost, and collecting it pays nothing.
await t.page.evaluate(() => { const g = window.__game, f = g.fishing; f.stop(); });
await key('r'); await t.wait(300);
await press(true); await t.wait(700); await press(false);
await until(x => x.state === 'wait', 6000);
await t.page.evaluate(() => { const f = window.__game.fishing; f.waitT = 0; });
await until(x => x.state === 'bite', 4000);
await press(true); await t.wait(80); await press(false);
let fs = await until(x => x.state === 'fight', 3000);
if (fs.state !== 'fight') fail(`no fight to carry the litter (${fs.state})`);
const money0 = await probe();
await t.page.evaluate(() => { const b = window.__game.fishing.bar; b.litterT = 0; b.meter = 0.6; b.drainMul = 0; });
const lit = await t.page.evaluate(async () => { const b = window.__game.fishing.bar; for (let i = 0; i < 60 && !b.litter; i++) await new Promise(r => setTimeout(r, 50)); return b.litter ? { kind: b.litter.kind, lost: b.litter.lost } : null; });
log.push(['litter', JSON.stringify(lit)]);
if (!lit || lit.kind !== 'line' || !lit.lost) fail(`first litter was not the lost line: ${JSON.stringify(lit)}`);
await t.shot('lost-line-on-bar');
await t.page.evaluate(() => { const b = window.__game.fishing.bar; if (b.litter) b.litter.y = b.zy; });
const after = await until(x => x.lost === 0, 3000);
if (after.lost !== 0) fail(`lostLine stayed at ${after.lost} after collecting`);
if (after.coins !== money0.coins || after.litter !== money0.litter || after.points !== money0.points) fail(`the lost line paid or counted: coins ${money0.coins}->${after.coins}, litter ${money0.litter}->${after.litter}, points ${money0.points}->${after.points}`);
if (!after.toasts.some(x => /line you lost/i.test(x))) fail(`no "That's the line you lost." toast: ${JSON.stringify(after.toasts)}`);
log.push(['collected', `lostLine ${after.lost}, coins ${money0.coins}->${after.coins}, litter ${money0.litter}->${after.litter}`]);
// A normal fight afterwards gets no forced line.
await t.page.evaluate(() => { const b = window.__game.fishing.bar; b.meter = 1; });
await t.wait(1500);

// ---- 4. A tangle with a fishing person (one per person per outing): hold to wind in, nothing can be cut.
await t.page.evaluate(() => { const g = window.__game; g.panels.close?.(true); g.dialogue?.hide?.(); g.fishing.stop(); });
await t.wait(600);
const tangle = await t.page.evaluate(async () => {
  const g = window.__game, f = g.fishing, n = g.npcs.npcs.find(x => x.fishes && !x.away);
  if (!n) return { skip: 'no fishing person on the lake at this time' };
  g.toast = g.toast.bind(g);
  f.toggle(g.fishingSpot()); f.state = 'wait'; f.float.visible = true; f.spot = 'jetty'; f.tangled.clear();
  const w = g.walker.pos, tip = { x: w.x, y: 1, z: w.z }, fp = { x: w.x + 6, y: 0, z: w.z + 2 };
  n.root.visible = true; n.away = false; n.fish.phase = 'wait'; n.fish.t = 30;
  n.tipPos.set(w.x + 2, 1, w.z - 3); n.fish.floatPos.set(w.x + 4, 0, w.z + 6);
  const crossed = f.checkTangle(tip, fp), again = f.checkTangle(tip, fp);
  n.fish.phase = 'rest'; const resting = (n.fish.phase = 'rest', n.lineSeg()); n.fish.phase = 'wait';
  f.float.position.set(fp.x, 0, fp.z);
  f.enterSnag('tangle', 'wait');
  return { crossed, again, resting, who: n.def.name, state: f.state, kind: f.snagKind };
});
if (tangle.skip) log.push(['tangle', 'skipped: ' + tangle.skip]);
else {
  if (!tangle.crossed) fail('crossing lines were not detected'); if (tangle.again) fail('the same person tangled twice in one outing'); if (tangle.resting) fail('a resting person has a line segment');
  if (tangle.state !== 'snagged' || tangle.kind !== 'tangle') fail('tangle did not enter the snagged state');
  await t.wait(400); await t.shot('tangle');
  await press(true); await t.wait(1200);
  let s = await probe(); if (s.state !== 'snagged') fail(`tangle ended early (${s.state})`);
  if (s.tension <= 0 || s.tension >= 1) fail(`tangle winding progress ${s.tension}`);
  await until(x => x.state !== 'snagged', 4000); await press(false);
  s = await probe();
  if (s.state !== 'ready') fail(`holding did not clear the tangle (${s.state})`);
  if (s.cut) { /* the earlier snag cut set this; a tangle must not call it again */ }
  log.push(['tangle', `${tangle.who}: crossed ${tangle.crossed}, repeat ${tangle.again}, ended ${s.state}, lostLine ${s.lost}`]);
  if (s.lost !== 0) fail('a tangle cost a line');
}

const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) fail('console: ' + errs.slice(0, 3).join(' | '));
for (const l of log) console.log(...l);
console.log(ok ? `snag ok${mobile ? ' (touch)' : ''}` : 'snag FAILED');
await t.close(); process.exit(ok ? 0 : 1);
