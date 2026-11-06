// Lure playtest: ties on a soft plastic, casts, works the lure with the cadence its shadow fish wants (read from the game's own lure styles),
// checks the shadow appears and its interest climbs to a strike, then that a wrong cadence spooks it. Screenshots go to playtest-shots/lure.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/lure.mjs [high|low] [rocky|seagrass] [mobile]
// Exits 0 only if both runs behaved and there were no console errors.
import { launch } from './harness.mjs';
const quality = process.argv[2] ?? 'high', site = process.argv[3] ?? 'seagrass', mobile = process.argv[4] === 'mobile';
const t = await launch({ query: `eco=${site}&quality=${quality}&play=1&time=day&tide=rising&season=summer${mobile ? '&touch=1' : ''}`, outDir: `playtest-shots/lure/${site}-${quality}${mobile ? '-touch' : ''}`, width: 1280, height: 720, mobile });
const log = [], fail = msg => { log.push(['FAIL', msg]); ok = false; };
let ok = true;
const press = down => mobile
  ? t.page.evaluate(d => document.querySelector('[data-key="Space"]').dispatchEvent(new PointerEvent(d ? 'pointerdown' : 'pointerup', { bubbles: true, pointerId: 3 })), down)
  : down ? t.page.keyboard.down(' ') : t.page.keyboard.up(' ');
const fish = () => t.page.evaluate(() => { const f = window.__game.fishing; return { state: f.state, shadow: f.sh.on, interest: f.interest?.interest ?? null, match: f.interest?.match ?? null, style: f.interest?.style ?? null, id: f.catch?.id ?? null, dist: +f.dist.toFixed(1), toasts: [...document.querySelectorAll('.toast')].map(e => e.textContent) }; });
await t.wait(1500);
// To the water, rod out, soft plastic on.
await t.page.evaluate(() => { const w = window.__game.walker; w.heading = Math.PI; });
for (let i = 0; i < 80; i++) { await t.hold('KeyW', 250); if ((await t.state()).walker.waterDepth > 0.15) break; }
await t.page.evaluate(() => { const g = window.__game; g.gear.rig = 'softplastic'; g.progress.lureTip = false; });
await t.tap('KeyR'); await t.wait(300);
async function cast() {
  await press(true); await t.wait(700); await press(false);
  for (let i = 0; i < 40; i++) { await t.wait(100); const f = await fish(); if (f.state === 'retrieve') return true; if (f.state === 'ready' && i > 12) break; }
  return false;
}
/** Work the lure with a cadence until the shadow strikes or leaves. `right` = the cadence the species wants, else the opposite. */
async function work(right, secs = 22) {
  let shadowSeen = false, best = -1, style = null, id = null, lastShot = 0, spookToast = false;
  const t0 = Date.now();
  while (Date.now() - t0 < secs * 1000) {
    const f = await fish();
    if (f.shadow) { shadowSeen = true; style ??= f.style; id ??= f.id; best = Math.max(best, f.interest ?? -1); if (!lastShot && f.interest > 0.3) { lastShot = 1; await t.shot(`following-${right ? 'right' : 'wrong'}`); await t.page.evaluate(() => { for (const e of document.querySelectorAll('#prompt, #toast, #hud, .hud')) e.style.visibility = 'hidden'; }); await t.shot(`following-${right ? 'right' : 'wrong'}-clean`); await t.page.evaluate(() => { for (const e of document.querySelectorAll('#prompt, #toast, #hud, .hud')) e.style.visibility = ''; }); } }
    if (f.toasts.some(x => /turned away/.test(x))) spookToast = true;
    if (f.state !== 'retrieve' || (!right && spookToast)) return { f, shadowSeen, best, style, id, spookToast };
    const st = f.style ?? 'slowroll';
    const twitch = async () => { await press(true); await t.wait(90); await press(false); };
    if (!f.shadow) { await twitch(); await t.wait(900); continue; }   // idle: twitch and wait for a fish to notice
    if (right) {
      if (st === 'fastroll') { await press(true); await t.wait(600); await press(false); }
      else if (st === 'slowroll') { await press(true); await t.wait(420); await press(false); await t.wait(1000); }
      else if (st === 'twitchpause') { await twitch(); await t.wait(1400); }
      else { await twitch(); await t.wait(250); await twitch(); await t.wait(1900); }
    } else {
      if (st === 'fastroll') await t.wait(800);                                   // stillness bores a pelagic
      else { await press(true); await t.wait(900); await press(false); }         // constant winding spooks the rest
    }
  }
  return { f: await fish(), shadowSeen, best, style, id, spookToast, timeout: true };
}
// Run 1: the right rhythm should bring a strike.
if (!(await cast())) fail('cast did not start a retrieve');
await t.wait(300); await t.shot('retrieve-start');
const a = await work(true);
log.push(['run1', JSON.stringify({ state: a.f.state, shadow: a.shadowSeen, best: +a.best.toFixed(2), style: a.style, id: a.id, timeout: !!a.timeout })]);
if (!a.shadowSeen) fail('no shadow followed the lure');
if (a.f.state !== 'bite') fail(`right cadence (${a.style}) did not end in a bite: ${a.f.state}, best interest ${a.best.toFixed(2)}`);
else { await t.shot('bite'); await press(true); await t.wait(80); await press(false); await t.wait(400); if ((await fish()).state !== 'fight') fail('strike did not open the fight'); else await t.shot('fight'); }
if (!(await fish()).toasts.some(x => /Lures only work/.test(x)) && !a.f.toasts.some(x => /Lures only work/.test(x))) log.push(['note', 'first-lure tip not seen in toasts (may have expired)']);
// Reset: put the rod away and out again for run 2.
await t.page.evaluate(() => { const g = window.__game; g.fishing.stop(); g.panels.close?.(true); });
await t.wait(300); await t.tap('KeyR'); await t.wait(300);
// Run 2: the wrong rhythm should spook it (a toast with the species-style hint), never bite.
if (!(await cast())) fail('second cast did not start a retrieve');
const b = await work(false, 26);
log.push(['run2', JSON.stringify({ state: b.f.state, shadow: b.shadowSeen, best: +b.best.toFixed(2), style: b.style, id: b.id, timeout: !!b.timeout })]);
const spooked = b.spookToast;
if (!b.shadowSeen) fail('run 2: no shadow');
if (b.f.state === 'bite' || b.f.state === 'fight') fail('wrong cadence still got a bite');
if (!spooked) fail('wrong cadence did not spook the fish');
await t.shot('after-spook');
// Run 3: bait, hold to draw in.
await t.page.evaluate(() => { const g = window.__game; g.fishing.stop(); g.gear.rig = 'runningsinker'; g.gear.bait = 'prawn'; g.progress.bait ??= {}; g.progress.baitTip = false; });
await t.wait(200); await t.tap('KeyR'); await t.wait(300);
await press(true); await t.wait(700); await press(false);
let d0 = null;
for (let i = 0; i < 40; i++) { await t.wait(100); const f = await fish(); if (f.state === 'wait') { d0 = f.dist; break; } }
if (d0 == null) fail('bait cast did not reach wait');
else { await press(true); await t.wait(1500); await press(false); const d1 = (await fish()).dist; log.push(['draw', `${d0} -> ${d1} m`]); if (!(d1 < d0 - 0.6)) fail(`holding Space did not draw the bait in (${d0} -> ${d1})`); if ((await fish()).state !== 'wait') fail('a long hold wound the bait right in'); }
await t.shot('bait-drawn');
// A tap on a bait rig winds in, and the first time says why (bait is not worked like a lure).
await press(true); await t.wait(80); await press(false); await t.wait(400);
{ const f = await fish(); if (f.state !== 'ready') fail(`a tap on bait did not wind in (${f.state})`); if (!f.toasts.some(x => /Bait sits still/.test(x))) fail('no bait-vs-lure tip on the first tap'); }
const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) fail('console: ' + errs.slice(0, 3).join(' | '));
for (const l of log) console.log(...l);
console.log(ok ? 'lure ok' : 'lure FAILED');
await t.close(); process.exit(ok ? 0 : 1);
