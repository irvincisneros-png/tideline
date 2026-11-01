// Lake Illawarra jetty playtest: walk from the spawn point along the bank, out along the plank jetty to its end (real WASD input),
// then cast off the end and check the catch table is the `jetty` spot. Exits 0 on success.
// Usage: URL=http://localhost:8451/ node tests/playtest/jetty.mjs [high|low]
import { launch } from './harness.mjs';

const quality = process.argv[2] ?? 'low';
const t = await launch({ query: `eco=seagrass&quality=${quality}&play=1&time=day&tide=rising&season=summer`, outDir: 'playtest-shots/jetty', width: 1280, height: 720 });
let ok = true;
const fail = m => { ok = false; console.log('FAIL:', m); };
await t.wait(1200);
const J = await t.page.evaluate(() => ({ x: 16, tip: window.__game.eco.land.bounds.zMin }));
const pos = async () => (await t.state()).walker.pos;
// Steer toward the jetty's centre line, then walk out to its tip.
const held = new Set();
const key = async (k, down) => { if (down === held.has(k)) return; down ? held.add(k) : held.delete(k); await (down ? t.page.keyboard.down(k) : t.page.keyboard.up(k)); };
let reached = false;
for (let i = 0; i < 400 && !reached; i++) {
  const [x, y, z] = await pos();
  const aligned = Math.abs(x - J.x) < 0.5;
  await key('d', x < J.x - 0.3); await key('a', x > J.x + 0.3);
  await key('w', aligned && z > J.tip + 1.2); // line up with the deck first, then walk straight out along it
  if (z <= J.tip + 1.3) reached = true;
  await t.wait(120);
}
for (const k of [...held]) await key(k, false);
await t.wait(500);
const end = await pos();
if (!reached) fail(`never reached the end of the jetty (stopped at ${end})`);
if (end[1] < 0.6) fail(`not standing on the deck (y=${end[1]})`);
await t.page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
await t.shot('jetty-end');
// Cast off the end: the float should land in the jetty spot.
await t.tap('KeyR'); await t.wait(300);
await t.page.keyboard.down(' '); await t.wait(1000); await t.page.keyboard.up(' ');
await t.wait(1500);
const s = (await t.state()).fishing;
if (s.state !== 'wait' || s.spot !== 'jetty') fail(`expected a cast off the jetty end to be the jetty spot, got state=${s.state} spot=${s.spot}`);
await t.shot('jetty-cast');
const errs = t.errors.filter(e => !/favicon/.test(e));
if (errs.length) fail(`console errors: ${errs.slice(0, 3)}`);
console.log(JSON.stringify({ end, fishing: s }), ok ? 'OK' : 'FAILED');
await t.close();
process.exit(ok ? 0 : 1);
