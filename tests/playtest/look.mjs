// Hero-shot capture for the visual pass: the shots that say whether the game reads as a cosy, sunny, top-down fishing diorama.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/look.mjs [high|low]
// Writes playtest-shots/look/<viewport>/NN-name.png for a 1280x720 desktop view and a 375x812 phone-width view:
//   title, beach from above (wrack, shells, umbrellas, footprints), the beach-access path, rock platform, Lake Illawarra jetty, angler winding up and casting, catch bar mid-fight,
//   angler holding the catch, the dichotomous-key inspection panel, the brag mat and the keep/release card.
// Exits 0 if every shot was taken with no console errors.
import { launch } from './harness.mjs';

const quality = process.argv[2] ?? 'high';
const VIEWS = [['1280x720', 1280, 720], ['375x812', 375, 812]];
let ok = true;
const errors = [];

for (const [tag, width, height] of VIEWS) {
  const out = `playtest-shots/look/${tag}`;
  let n = 0; // one running number per viewport, across every browser launch below
  const snap = async (t, name) => t.page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` });
  // ---- Title screen (the angler idling at the water's edge, the camera slowly swinging round).
  let t = await launch({ query: `eco=rocky&quality=${quality}`, outDir: out, width, height });
  await t.wait(2500);
  await snap(t, 'title');
  errors.push(...t.errors); await t.close();

  // ---- Bellambi: the beach from above, then the rock platform with its pools.
  t = await launch({ query: `eco=rocky&quality=${quality}&play=1&time=day&tide=rising&season=summer`, outDir: out, width, height });
  await t.wait(1200);
  await t.page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
  // places on Bellambi's real-shaped shore (world/bellambi.js): the beach north of the point, the access path, the tower, the platform at the tip
  const P = await t.page.evaluate(async () => { const B = await import('/src/world/bellambi.js'), at = (s, off) => { const b = B.beachAt(s, off); return { x: b.x, z: b.z, yaw: Math.atan2(-b.nx, -b.nz) }; }; return { beach: at(B.S_TOWER + 8, 9), path: at(B.S_ACCESS, 22), tower: at(B.S_TOWER, 12), platform: at(B.S_TIP, -4) }; });
  await t.teleport(P.beach.x, P.beach.z, { camYaw: P.beach.yaw - 0.5, heading: P.beach.yaw, zoom: 14 });
  await t.page.evaluate(() => { window.__game.walker.heading = 0; });
  for (let i = 0; i < 4; i++) await t.hold('KeyS', 350); // leave a trail of footprints
  await t.page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
  await snap(t, 'beach-from-above');
  await t.teleport(P.path.x, P.path.z, { camYaw: P.path.yaw + 0.2, heading: P.path.yaw + Math.PI, zoom: 15, pitch: 1.0 });
  await t.page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
  await snap(t, 'beach-access-path');
  await t.teleport(P.tower.x, P.tower.z, { camYaw: P.tower.yaw + 3.0, heading: P.tower.yaw + Math.PI, zoom: 21, pitch: 1.0 });
  await snap(t, 'beach-dunes-tower-pines');
  await t.teleport(P.platform.x, P.platform.z, { camYaw: P.platform.yaw - 0.3, heading: P.platform.yaw + Math.PI, zoom: 19 });
  await snap(t, 'rock-platform');
  errors.push(...t.errors); await t.close();

  // ---- Lake Illawarra: the jetty, then the cast, the fight and the catch.
  t = await launch({ query: `eco=seagrass&quality=${quality}&play=1&time=day&tide=rising&season=summer`, outDir: out, width, height });
  await t.wait(1200);
  await t.page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
  await t.teleport(16, 36, { camYaw: 0, heading: Math.PI, zoom: 16 });
  await snap(t, 'lake-jetty');
  // Walk to the end of the jetty and cast off it.
  await t.teleport(16, 21, { camYaw: 0.15, heading: Math.PI, zoom: 16 });
  await t.page.evaluate(() => document.querySelector('#toast').innerHTML = '');
  await t.tap('KeyR'); await t.wait(400);
  await t.page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
  await t.page.keyboard.down(' '); await t.wait(900);
  await snap(t, 'angler-windup');
  await t.page.keyboard.up(' '); await t.wait(260);
  await snap(t, 'angler-cast');
  await t.wait(1400);
  const spot = await t.page.evaluate(() => window.__game.fishing.spot);
  if (spot !== 'jetty') { ok = false; console.log('FAIL: a cast off the jetty end should be the jetty spot, got', spot); }
  // Make the fish bite now, strike and let the fight run for a bit.
  await t.page.evaluate(() => { window.__game.fishing.waitT = 0.05; });
  for (let i = 0; i < 60; i++) { if ((await t.state()).fishing.state === 'bite') break; await t.wait(50); }
  await t.tap('Space'); await t.wait(1800);
  await t.page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
  await snap(t, 'catch-bar');
  // Land it: the angler holds the fish up, then the keep or release card opens.
  await t.page.evaluate(() => window.__game.fishing.land());
  await t.wait(700);
  await snap(t, 'angler-holding-catch');
  await t.page.waitForSelector('.key-grid', { timeout: 6000 }).catch(() => { ok = false; console.log('FAIL: the key panel did not open'); });
  await t.wait(900);
  await snap(t, 'key-inspect');
  const path = await t.page.evaluate(async () => { const K = await import('/src/fishing/key.js'), S = await import('/src/fishing/species.js'); return K.pathTo(K.KEY, S.SPECIES_BY_ID[window.__game.catchFlow.id]); });
  for (const a of path) await t.page.click(`.opt[data-a="${a}"]`);
  await t.page.click('#key-ok'); await t.wait(500);
  await t.page.click('#m-lock').catch(() => { ok = false; console.log('FAIL: brag mat did not open'); });
  await t.wait(400);
  await snap(t, 'brag-mat');
  await t.page.click('#m-next'); await t.wait(400);
  await t.page.waitForSelector('#fx-keep', { timeout: 6000 }).catch(() => { ok = false; console.log('FAIL: keep/release card did not open'); });
  await snap(t, 'keep-release');
  errors.push(...t.errors); await t.close();
}

const errs = errors.filter(e => !/favicon/.test(e));
if (errs.length) { ok = false; console.log('console errors:', errs.slice(0, 3)); }
console.log('look.mjs', quality, ok ? 'OK' : 'FAILED', 'console errors:', errs.length);
process.exit(ok ? 0 : 1);
