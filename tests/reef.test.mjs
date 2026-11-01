// Phase 6: the offshore reef (site 4): species, site config and terrain, the unlock rule, the fish finder (deterministic), the anchor rule, barotrauma by depth, the boat trip words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_BY_ID, SPOT_INFO, REGIONS, speciesInRegion, DEEP_WATER } from '../src/fishing/species.js';
import { SPOTS, biteWeights, judge, RULES, DEFAULT_CTX, pickCatch } from '../src/fishing/catches.js';
import { ECOSYSTEMS, ecoById } from '../src/ecosystems/index.js';
import { reef, heightAt, hardAt, depthAt, reefMask, spotAt, SITE, START, DRIFT_BOX, toggleAnchor, state as boat, driftSpeed, deckAt, resetBoat } from '../src/ecosystems/reef.js';
import { siteLock, rodTier } from '../src/ecosystems/unlock.js';
import * as SONAR from '../src/fishing/sonar.js';
import { releaseSurvival, survivalNote, BAROTRAUMA_DEPTH, SURVIVAL_RANGE } from '../src/economy/effects.js';
import { LOOKS } from '../src/life/looks.js';
import { TRIP_TEXT, tripText, BACK_BY } from '../src/ui/boatTrip.js';
import { buildBoatModels, BOAT_DECK, DECK_Y } from '../src/world/boatModels.js';
import { buy } from '../src/economy/store.js';
import { ensureEcon } from '../src/economy/coins.js';
import { loadProgress } from '../src/core/save.js';

const newProgress = () => { const p = loadProgress(); ensureEcon(p); return p; };
const identify = (p, n) => { p.guide ??= { nextN: 1, e: {} }; SPECIES.slice(0, n).forEach(s => { const e = (p.guide.e[s.id] ??= {}); e.seen = { t: 1 }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; }); };

// ---------------------------------------------------------------- the new species and their limits (dataset A2)
test('jackass morwong: DPIRD limits (30 cm, bag 10, possession 10), depleted stock, deep-water, swap to snapper', () => {
  const s = SPECIES_BY_ID.jackassmorwong;
  assert.ok(s && LOOKS.jackassmorwong, 'it exists and has a look');
  assert.deepEqual([s.rules.min, s.rules.bag, s.rules.possession, s.rules.protected], [30, 10, 10, false]);
  assert.equal(s.status, 'depleted'); assert.match(s.statusNote, /depleted/i);
  assert.equal(s.swap.id, 'snapper'); assert.match(s.swap.reason, /DEPLETED/);
  assert.ok(s.deepWater && DEEP_WATER.has('jackassmorwong'), 'it is a deep-water fish (barotrauma)');
  assert.equal(judge('jackassmorwong', 29, 0).kind, 'undersize'); assert.equal(judge('jackassmorwong', 30, 0).legal, true); assert.equal(judge('jackassmorwong', 40, 10).kind, 'bag');
});
test('the reef lists the dataset REEF species with their DPIRD limits, and reuses snapper', () => {
  const ids = speciesInRegion('reef').map(s => s.id);
  for (const id of ['snapper', 'kingfish', 'redmorwong', 'jackassmorwong', 'silvertrevally', 'bonito', 'bluegroper', 'wobbegong']) assert.ok(ids.includes(id), `${id} is on the reef`);
  for (const [id, min, bag, poss] of [['snapper', 30, 10, 10], ['kingfish', 65, 5, 5], ['redmorwong', 30, 5, 5], ['silvertrevally', 30, 10, 20], ['bonito', null, 10, 10]]) { const r = RULES[id]; assert.deepEqual([r.min, r.bag, r.possession], [min, bag, poss], id); }
  for (const id of ['bluegroper', 'wobbegong']) assert.equal(RULES[id].protected, true, `${id} is protected: release only`);
  // no species the dataset does not list for a reef (a leatherjacket is not in the dataset, so it is not in the game)
  assert.ok(!SPECIES.some(s => /leatherjacket/i.test(s.name)));
  for (const k of ['reef', 'reefedge', 'reefsand']) { assert.ok(SPOT_INFO[k] && SPOTS[k].fish.length >= 5, `${k} has a catch table`); }
  assert.deepEqual(REGIONS.reef.spots, ['reef', 'reefedge', 'reefsand']);
});
test('on the reef a paternoster with squid or pilchard suits the reef fish, and snapper is a top catch of the reef', () => {
  const ctx = { ...DEFAULT_CTX, rig: 'paternoster', bait: 'squidstrip', time: 'dawn', season: 'spring', tide: null };
  const w = biteWeights('reef', ctx).filter(x => x.w > 0).sort((a, b) => b.w - a.w).map(x => x.sp.id);
  assert.equal(w[0], 'snapper'); assert.ok(w.includes('redmorwong') && w.includes('kingfish'));
  // a fish finder mark under the bait raises that species' bite chance
  const base = biteWeights('reefedge', ctx).find(x => x.sp.id === 'jackassmorwong').w, marked = biteWeights('reefedge', { ...ctx, arch: 'jackassmorwong' }).find(x => x.sp.id === 'jackassmorwong').w;
  assert.ok(marked > base * 2, `a mark under the bait helps: ${base} -> ${marked}`);
});

// ---------------------------------------------------------------- barotrauma: the release weight matters from about 10 m (dataset C17); survival figures are C13 only
test('barotrauma starts at about 10 m: the release weight rescues a deep catch, and a shallow catch is not penalised', () => {
  assert.equal(BAROTRAUMA_DEPTH, 10);
  const deep = releaseSurvival('snapper', { wet: true, air: 5, weighted: false, depth: 18 }), kept = releaseSurvival('snapper', { wet: true, air: 5, weighted: true, depth: 18 }), shallow = releaseSurvival('snapper', { wet: true, air: 5, weighted: false, depth: 4 });
  assert.ok(deep.deep && deep.pct < kept.pct - 15, `no weight ${deep.pct}% vs weight ${kept.pct}%`);
  assert.ok(!shallow.deep && shallow.pct > deep.pct + 15, 'at 4 m there is no barotrauma');
  assert.ok(kept.weightHelped > 15 && kept.bayBonus === 1);
  assert.equal(releaseSurvival('snapper', { wet: true, air: 5, weighted: false }).deep, true, 'depth unknown: assume deep (the older sites)');
  // C13 figures only: the card shows the DPIRD range for snapper and kingfish, and invents none for the morwongs
  assert.deepEqual(SURVIVAL_RANGE.snapper, [67, 92]); assert.deepEqual(SURVIVAL_RANGE.kingfish, [85, 85]);
  assert.equal(survivalNote('jackassmorwong'), null); assert.equal(survivalNote('redmorwong'), null);
  assert.ok(Object.keys(SURVIVAL_RANGE).every(id => ['duskyflathead', 'luderick', 'mulloway', 'sandwhiting', 'snapper', 'tailor', 'yellowfinbream', 'kingfish'].includes(id)), 'only dataset C13 species have a range');
});

// ---------------------------------------------------------------- the site
test('the reef site config is valid, registered fourth, and daylight is on', () => {
  assert.equal(ecoById('reef'), reef); assert.equal(ECOSYSTEMS[3], reef);
  for (const k of ['id', 'name', 'place', 'blurb', 'heightAt', 'colorAt', 'reefiness', 'decorate', 'bounds', 'water', 'sound', 'land', 'fishing', 'menuCam', 'life', 'coral', 'speciesInfo', 'cosyModels', 'unlock', 'deckAt', 'tick', 'toggleAnchor']) assert.ok(reef[k] != null, k);
  assert.equal(reef.daylight, true); assert.equal(reef.travel, true);
  const w = reef.water; for (const k of ['absorb', 'fog', 'fogDeep', 'shallow', 'mid', 'deep', 'skyTop', 'skyHorizon', 'sun', 'sunColor', 'hemiSky', 'hemiGround']) assert.ok(w[k] != null, `water.${k}`);
  assert.ok(w.clear > 0, 'open, clear water: you can see the reef from the surface');
  for (const id of Object.keys(reef.life)) assert.ok(LOOKS[id], `${id} has a look`);
  for (const [spot] of Object.entries(SPOT_INFO)) assert.ok(SPOTS[spot]);
  assert.ok(reef.speciesInfo.some(s => s.id === 'jackassmorwong') && reef.speciesInfo.some(s => s.id === 'snapper'));
});
test('the seabed: about 18 m of sand with reef rising to about 7 m; the soft and hard bottoms are both there', () => {
  let minD = 99, maxD = 0, hard = 0, soft = 0, mid = 0, n = 0;
  for (let x = -70; x <= 70; x += 2.5) for (let z = -70; z <= 70; z += 2.5) {
    const d = depthAt(x, z), h = hardAt(x, z); assert.ok(Number.isFinite(d) && h >= 0 && h <= 1, `${x},${z}`);
    minD = Math.min(minD, d); maxD = Math.max(maxD, d); n++; if (h > 0.6) hard++; else if (h < 0.25) soft++; else mid++;
  }
  assert.ok(minD < 9 && minD > 4, `reef tops at ${minD.toFixed(1)} m`); assert.ok(maxD > 16 && maxD < 24, `sand floor to ${maxD.toFixed(1)} m`);
  assert.ok(hard / n > 0.08 && soft / n > 0.3 && mid / n > 0.05, `hard ${(hard / n).toFixed(2)} soft ${(soft / n).toFixed(2)} edge ${(mid / n).toFixed(2)}`);
  // deep water is not walkable and the cast spot follows the bottom
  assert.equal(spotAt(0, 0, -30, -24), 'reef'); assert.equal(spotAt(0, 0, -60, 60), 'reefsand');
  const edge = (() => { for (let x = -40; x < 40; x += 0.5) { const h = hardAt(x, -24 + 0.4 * x); if (h > 0.26 && h < 0.58) return [x, -24 + 0.4 * x]; } })();
  assert.equal(spotAt(0, 0, ...edge), 'reefedge');
});
test('a drift crosses both reef and sand, and starts clear of the reef', () => {
  const dir = [0.62, 0.78], len = Math.hypot(...dir); let hard = 0, soft = 0, steps = 0;
  for (let t = 0; ; t += 2) { const x = START.x + dir[0] / len * t, z = START.z + dir[1] / len * t; if (x > DRIFT_BOX.xMax || z > DRIFT_BOX.zMax) break; steps++; if (hardAt(x, z) > 0.6) hard++; else if (hardAt(x, z) < 0.25) soft++; }
  assert.ok(hard > 4 && soft > 8 && steps > 60, `a drift is ${steps} steps: ${hard} over reef, ${soft} over sand`);
  assert.ok(hardAt(START.x, START.z) < 0.25, 'the boat starts over sand');
  assert.ok(driftSpeed(1) > 0.4 && driftSpeed(1) < 1.2);
});

// ---------------------------------------------------------------- unlock gating: the Estuary spin rod (or better) AND 8 species Identified
test('the reef opens with the Estuary spin rod (or better) and 8 species Identified, and the picker says what is missing', () => {
  const p = newProgress(); let L = siteLock(p, reef);
  assert.ok(L.locked && L.have === 0 && L.need === 2 && /spin rod/i.test(L.text) && /8 species/.test(L.text));
  assert.match(L.detail, /✖ Estuary spin rod or better/); assert.match(L.detail, /✖ 8 species Identified \(0 of 8\)/);
  identify(p, 8); L = siteLock(p, reef);
  assert.ok(L.locked && L.have === 1, 'eight species but no rod: still locked'); assert.match(L.detail, /✔ 8 species Identified/); assert.match(L.progressText, /not yet/);
  // rod only: still locked
  const q = newProgress(); identify(q, 3); q.coins = 500; identify(q, 3);
  assert.equal(rodTier(q), 1); const r = buy(q, 'rod-2'); assert.ok(r.ok, r.reason); assert.equal(rodTier(q), 2);
  L = siteLock(q, reef); assert.ok(L.locked && L.have === 1, 'the rod but not 8 species: locked');
  // both: open
  identify(q, 8); L = siteLock(q, reef); assert.equal(L.locked, false); assert.equal(L.have, 2);
  // a better rod counts too
  const z = newProgress(); z.coins = 999; identify(z, 8); z.shop ??= {}; z.shop.owned ??= {}; z.shop.owned['rod-3'] = 1; assert.equal(rodTier(z), 3); assert.equal(siteLock(z, reef).locked, false);
  // the other sites keep their own gates, and a deep link (no progress check) is the picker's business, not siteLock's
  assert.equal(siteLock(newProgress(), ecoById('rocky')).locked, false); assert.equal(siteLock(newProgress(), ecoById('harbour')).locked, true);
});

// ---------------------------------------------------------------- the fish finder: deterministic given the seed
test('fish finder output is deterministic: same seed, place and time give the same picture; another seed does not', () => {
  const a = SONAR.ping(SITE, -30, -24, 12.5), b = SONAR.ping(SITE, -30, -24, 12.5);
  assert.deepEqual(a, b);
  const other = { ...SITE, seed: SITE.seed + 1 }, c = SONAR.ping(other, -30, -24, 12.5);
  const sig = p => JSON.stringify(p.fish.map(f => [f.id, f.len]));
  let differs = false; for (let x = -40; x < 40 && !differs; x += 3) differs = sig(SONAR.ping(SITE, x, 0, 3)) !== sig(SONAR.ping(other, x, 0, 3));
  assert.ok(differs, 'a different seed gives different fish');
  // a whole tape of pings is reproducible
  const tape = seed => Array.from({ length: 80 }, (_, i) => JSON.stringify(SONAR.ping({ ...SITE, seed }, START.x + i * 0.5, START.z + i * 0.6, i * 0.2)));
  assert.deepEqual(tape(97), tape(97)); assert.notDeepEqual(tape(97), tape(98));
});
test('a ping reports the depth, the bottom type and the fish: hard reef is a stronger, thicker bottom; soft sand is thin', () => {
  const reefPing = SONAR.ping(SITE, -30, -24, 0), sandPing = SONAR.ping(SITE, -60, 60, 0);
  assert.equal(reefPing.bottom, 'reef'); assert.ok(reefPing.hard > 0.6 && reefPing.second, 'hard bottom: a second echo');
  assert.equal(sandPing.bottom, 'sand'); assert.ok(sandPing.hard < 0.25 && !sandPing.second);
  assert.ok(Math.abs(reefPing.depth - depthAt(-30, -24)) < 1e-9 && reefPing.depth < sandPing.depth, 'the reef is shallower than the sand');
  assert.match(reefPing.label, /reef/i); assert.match(sandPing.label, /sand/i);
  assert.ok(reefPing.pingMs > 0 && reefPing.pingMs < 80, 'the pulse takes only a few hundredths of a second to come back');
  // over many pings there are fish (arches), more of them per ping over hard ground than soft
  let hs = 0, hn = 0, ss = 0, sn = 0;
  for (let x = -60; x < 60; x += 2) for (let z = -60; z < 60; z += 2) { const p = SONAR.ping(SITE, x, z, 5); if (p.hard > 0.6) { hs += p.fish.length; hn++; } else if (p.hard < 0.25) { ss += p.fish.length; sn++; } }
  assert.ok(hn > 50 && sn > 50 && hs / hn > ss / sn * 1.3, `marks per ping: hard ${(hs / hn).toFixed(2)}, soft ${(ss / sn).toFixed(2)}`);
  assert.ok(Object.keys(SPECIES_BY_ID).length && SONAR.ping(SITE, -30, -24, 0).fish.every(f => SPECIES_BY_ID[f.id] && f.range > 0 && f.range <= f.h + 20));
});
test('a boat drifting over a fish draws an ARCH: the echo is deepest at the edge of the cone and shallowest straight above', () => {
  // find a fish near the reef and pass over it in a straight line
  let best = null;
  for (let cx = -8; cx < 6 && !best; cx++) for (let cz = -8; cz < 2 && !best; cz++) { const f = SONAR.fishInCell(SITE, cx, cz)[0]; if (f && f.above != null) best = { f, cx, cz }; }
  assert.ok(best, 'found a bottom fish');
  const f = best.f, t = 0, p = SONAR.fishPos(SITE, f, t), echoes = [];
  for (let dx = -8; dx <= 8; dx += 0.25) { const pg = SONAR.ping(SITE, p.x + dx, p.z, t), m = pg.fish.find(q => q.id === f.id && Math.abs(q.len - f.len) < 1e-9); if (m) echoes.push({ dx, range: m.range }); }
  assert.ok(echoes.length >= 6, `${echoes.length} pings caught it`);
  const min = echoes.reduce((a, b) => (b.range < a.range ? b : a)); assert.ok(Math.abs(min.dx) <= 0.5, 'shallowest straight over it');
  assert.ok(echoes[0].range > min.range + 0.2 && echoes.at(-1).range > min.range + 0.2, 'deeper at both edges: an arch');
  assert.ok(Math.abs(echoes[0].range - echoes.at(-1).range) < 0.6, 'and symmetrical');
});
test('the screen teaches how it works: sound pulses echo off the bottom and swim bladders, and it is a harvesting technology', () => {
  const t = JSON.stringify(SONAR.HOW_IT_WORKS);
  assert.match(t, /pulse of sound/); assert.match(t, /echo/); assert.match(t, /swim bladder/); assert.match(t, /gas/); assert.match(t, /arch/i); assert.match(t, /thick/); assert.match(t, /dots/);
  assert.match(SONAR.HOW_IT_WORKS.tech, /harvesting technology/); assert.match(SONAR.HOW_IT_WORKS.tech, /bag and size limits apply/);
  assert.ok(SONAR.SOUND_SPEED > 1400 && SONAR.SOUND_SPEED < 1600);
});

// ---------------------------------------------------------------- the anchor rule: never on the reef
test('the anchor never goes down on reef: it is refused on hard bottom and rubble, allowed on sand', () => {
  const toasts = [], game = { toast: (t, k) => toasts.push([t, k]), scene: { add() {} } };
  resetBoat(); boat.x = -30; boat.z = -24; assert.ok(hardAt(boat.x, boat.z) > 0.6);
  let r = toggleAnchor(game); assert.equal(r.ok, false); assert.equal(boat.anchored, false); assert.match(toasts.at(-1)[0], /reef/i); assert.equal(toasts.at(-1)[1], 'warn');
  // on sand it holds, and lifting it works anywhere
  boat.x = -60; boat.z = 60; assert.ok(hardAt(boat.x, boat.z) < 0.25);
  globalThis.document = { createElement: () => ({}) }; // the rope mesh only needs a scene.add stub
  try { r = toggleAnchor(game); } catch { /* the rope is drawn with three meshes: the state change is what matters here */ }
  assert.equal(boat.anchored, true); boat.x = -30; boat.z = -24; r = toggleAnchor(game); assert.equal(boat.anchored, false);
  resetBoat();
});

// ---------------------------------------------------------------- the boat and the trip
test('the boat: a solid hull and a walkable deck that moves with it', () => {
  for (const [k, g] of buildBoatModels()) { const a = g.attributes.position.array; assert.ok(a.every(Number.isFinite), `${k} has no NaN`); assert.ok(g.attributes.normal && g.attributes.color); }
  assert.ok(DECK_Y > 0.3 && DECK_Y < 1 && BOAT_DECK.u > 0.8 && BOAT_DECK.v1 - BOAT_DECK.v0 > 3);
  resetBoat(); boat.boat = {};
  assert.equal(deckAt(boat.x, boat.z + 1), DECK_Y); assert.equal(deckAt(boat.x + 5, boat.z), null); assert.equal(deckAt(boat.x, boat.z - 4), null, 'the console and bow are not deck');
  boat.x += 10; assert.equal(deckAt(boat.x, boat.z + 1), DECK_Y, 'the deck follows the boat'); boat.boat = null; resetBoat();
});
test('the safety beat is lifejacket and logging your trip: general safety, the PFD line is dataset C28, no legal claims', () => {
  assert.match(TRIP_TEXT.jacket, /lifejacket/i); assert.match(TRIP_TEXT.jacket, /ears/); assert.match(TRIP_TEXT.log, /log your trip/i);
  for (const t of Object.values(TRIP_TEXT)) assert.doesNotMatch(t, /\b(law|illegal|fine|penalty|offence|must by law)\b/i, 'no legal claims');
  assert.match(tripText({ aboard: 2, back: BACK_BY[1][0] }), /2 aboard, back in 4 hours/);
});
test('the title view sits low so the Five Islands show on the horizon, and the fish finder is rod-and-boat tech', () => {
  assert.ok(reef.menuCam.pitch < 0.5);
  assert.ok(reef.land.intro.includes('fish finder') && /anchor/i.test(reef.land.intro) && /Never anchor on the reef/.test(reef.land.intro));
  assert.ok(reefMask(-30, -24) > 0.9);
});
