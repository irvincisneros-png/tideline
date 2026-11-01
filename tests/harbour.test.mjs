// Phase 5: Belmore Basin (the harbour site), night squid, the new species and the key, the co-op fisher, unlock gating, the survival ranges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_BY_ID, FEATURES, SPOT_INFO, REGIONS, speciesInRegion } from '../src/fishing/species.js';
import { KEY, walk, pathTo } from '../src/fishing/key.js';
import { biteWeights, pickCatch, judge, bagGroupIds, gateOpen, DEFAULT_CTX, SPOTS, RULES, FIGHT } from '../src/fishing/catches.js';
import { PROFILES, barParams } from '../src/fishing/catchbar.js';
import { ECOSYSTEMS, ecoById } from '../src/ecosystems/index.js';
import { harbour, heightAt, deckAt, spotAt, LAMPS, WHARF, QY, QUAY_Z, EBW, NBW, moundAt, litAt, POOL_R } from '../src/ecosystems/harbour.js';
import { siteLock } from '../src/ecosystems/unlock.js';
import { daylightAt, NIGHT } from '../src/ocean/daylight.js';
import { SURVIVAL, SURVIVAL_RANGE, survivalNote, CUT_LINE, releaseSurvival } from '../src/economy/effects.js';
import { NPCS } from '../src/content/npcs.js';
import { QUIZ_BY_N } from '../src/content/quiz.js';
import { ITEMS } from '../src/content/items.js';
import { SHOP, SHOP_BY_ID, SHOP_CATS } from '../src/content/shop.js';
import { buy, owns } from '../src/economy/store.js';
import { progressOf, tradeStatus } from '../src/npc/requests.js';
import { rigUnlocked } from '../src/npc/inventory.js';
import { migrateProgress } from '../src/core/save.js';
import { LOOKS } from '../src/life/looks.js';
import { PLACES } from '../src/npc/places.js';
import { slotAt, presentAt, resolveSlot, placesOf, isAway } from '../src/npc/schedule.js';
import * as G from '../src/fishing/guide.js';

const night = { ...DEFAULT_CTX, time: 'night', rig: 'squidjig', bait: 'none' };
const share = (spot, ctx, id, n = 4000) => { let k = 0; for (let i = 0; i < n; i++) if (pickCatch(spot, ctx).id === id) k++; return k / n; };

// ---------------------------------------------------------------- species and the key
test('the new harbour species exist with sources, rules from the dataset and a feature signature', () => {
  for (const id of ['yakka', 'slimymackerel', 'cuttlefish']) {
    const s = SPECIES_BY_ID[id];
    assert.ok(s, id); assert.ok(s.feat && FEATURES[id], `${id} has FEATURES`); assert.ok(s.src.rules && s.src.biology === 'unverified', `${id} says where its rules came from`);
    assert.ok(s.spots.wharf, `${id} lives at the wharf`);
  }
  assert.equal(RULES.yakka.bag, 50); assert.equal(RULES.yakka.min, null);               // dataset: 50 per species, no minimum [DPIRD]
  assert.equal(RULES.slimymackerel.bag, 50); assert.equal(RULES.cuttlefish.bag, 20);
  assert.match(SPECIES_BY_ID.yakka.sci, /^Trachurus/); assert.match(SPECIES_BY_ID.squid.name, /calamari/i);
  for (const spot of ['wharf', 'breakwall', 'basin']) { assert.ok(SPOT_INFO[spot].label.startsWith('Belmore')); assert.ok(SPOTS[spot].fish.length >= 8, `${spot} has a catch table`); }
});

test('the key grows by one couplet per species and every species still reaches its own unique leaf', () => {
  assert.equal(Object.keys(KEY.couplets).length, SPECIES.length - 1);
  const leaves = new Set();
  for (const s of SPECIES) { const end = walk(KEY, pathTo(KEY, s)); assert.equal(end.leaf, s.id); leaves.add(end.leaf); }
  assert.equal(leaves.size, SPECIES.length); assert.ok(SPECIES.length >= 22);
  const sig = new Set(SPECIES.map(s => Object.values(s.feat).filter(v => typeof v === 'string' && !v.includes(' ')).join('|')));
  assert.equal(sig.size, SPECIES.length, 'no two species share every visible feature');
  assert.ok(KEY.depth <= 8, `deepest path ${KEY.depth}`);
  // the look-alikes the new species must be told apart from
  for (const [a, b] of [['yakka', 'kingfish'], ['yakka', 'silvertrevally'], ['slimymackerel', 'bonito'], ['cuttlefish', 'squid']]) assert.notDeepEqual(FEATURES[a], FEATURES[b], `${a} vs ${b}`);
});

test('every new species has a registered look whose tail matches the key, and the cephalopods have arms', () => {
  for (const id of ['yakka', 'slimymackerel', 'cuttlefish', 'squid']) assert.ok(LOOKS[id], `${id} look`);
  assert.equal(LOOKS.squid.cephalopod, 'squid'); assert.equal(LOOKS.cuttlefish.cephalopod, 'cuttle'); assert.ok(LOOKS.squid.arms >= 8);
  assert.equal(LOOKS.yakka.tail, 'forked'); assert.equal(FEATURES.yakka.yellow, 'tail');
  assert.ok(LOOKS.bluegroper.hump && LOOKS.bluegroper.hump.h > 0.1, 'the blue groper has its forehead hump');
  assert.ok(speciesInRegion('harbour').length >= 14 && REGIONS.harbour.label === 'Belmore Basin harbour');
});

// ---------------------------------------------------------------- squid bite model
test('squid and cuttlefish bite ONLY on a squid jig and ONLY at dusk and night', () => {
  const at = (ctx, id) => biteWeights('wharf', ctx).find(x => x.sp.id === id).w;
  for (const id of ['squid', 'cuttlefish']) {
    assert.ok(at(night, id) > 0, `${id} bites a jig at night`);
    assert.ok(at({ ...night, time: 'dusk' }, id) > 0, `${id} bites a jig at dusk`);
    assert.equal(at({ ...night, time: 'day' }, id), 0, `no ${id} by day`); assert.equal(at({ ...night, time: 'dawn' }, id), 0, `no ${id} at dawn`);
    for (const rig of ['runningsinker', 'float', 'paternoster', 'softplastic']) assert.equal(at({ ...night, rig, bait: 'prawn' }, id), 0, `${id} ignores a ${rig}`);
  }
  assert.ok(share('wharf', night, 'squid') > 0.3, 'a jig at night on the wharf lands squid');
  assert.equal(share('wharf', { ...night, time: 'day' }, 'squid'), 0);
  assert.equal(share('wharf', { ...night, rig: 'runningsinker', bait: 'prawn' }, 'squid'), 0);
  assert.ok(gateOpen(SPECIES_BY_ID.squid, { rig: 'squidjig', time: null }), 'an unknown time does not block (old callers)');
  assert.ok(!gateOpen(SPECIES_BY_ID.squid, { rig: 'float', time: 'night' }));
});

test('a wharf lamp pool draws the baitfish, the squid and the fish that hunt them', () => {
  const w = (lit, id) => biteWeights('wharf', { ...night, rig: 'unweighted', bait: 'prawn', lit }).find(x => x.sp.id === id)?.w ?? 0;
  assert.ok(w(1, 'yakka') > w(0, 'yakka') * 2, 'yakka gather in the light');
  const sq = lit => biteWeights('wharf', { ...night, lit }).find(x => x.sp.id === 'squid').w;
  assert.ok(sq(1) > sq(0) * 1.5, 'squid come up into the light');
});

test('squid and cuttlefish share one bag limit of 20 (DPIRD), and nothing else shares it', () => {
  assert.deepEqual(bagGroupIds('squid').sort(), ['cuttlefish', 'squid']); assert.deepEqual(bagGroupIds('cuttlefish').sort(), ['cuttlefish', 'squid']);
  assert.deepEqual(bagGroupIds('tailor'), ['tailor']);
  assert.equal(RULES.squid.bagLabel, 'squid and cuttlefish together');
  assert.equal(judge('squid', 20, 19).legal, true); assert.equal(judge('squid', 20, 20).kind, 'bag'); assert.equal(judge('cuttlefish', 25, 20).kind, 'bag');
  assert.equal(judge('squid', 5, 0).legal, true, 'no minimum size');
  assert.match(SPECIES_BY_ID.squid.rules.note, /spikes only/i);
});

test('the squid fights with its own profile: a soft pull, a squeeze warning, then jets', () => {
  assert.equal(FIGHT.squid.profile, 'jet'); assert.equal(FIGHT.cuttlefish.profile, 'jet');
  const p = PROFILES.jet, p2 = barParams({ gear: 1, power: FIGHT.squid.power, size: 25 });
  const bar = { fy: 0.5, zy: 0.5, k: p2.k, jetMul: 1, time: 0, warn: false, squeeze: false, ink: false, power: 0.3 }, s = {};
  p.init(s, bar);
  const seen = { pull: 0, squeeze: 0, jet: 0, glide: 0 }; let inkPuffs = 0, squeezed = 0, maxJump = 0;
  for (let i = 0, last = bar.fy; i < 60 * 40; i++) {
    bar.time += 1 / 60; p.step(s, 1 / 60, bar); seen[s.mode]++;
    if (bar.squeeze) squeezed++; if (bar.ink) { inkPuffs++; bar.ink = false; }
    const d = Math.max(-s.speed / 60, Math.min(s.speed / 60, s.tgt - bar.fy)); bar.fy = Math.max(0.02, Math.min(0.98, bar.fy + d)); maxJump = Math.max(maxJump, Math.abs(bar.fy - last)); last = bar.fy;
  }
  assert.ok(seen.pull > seen.jet * 3, 'mostly a soft pull'); assert.ok(inkPuffs >= 6, `jets squirt ink (${inkPuffs})`); assert.ok(squeezed > 0, 'a squeeze warns first');
  assert.ok(seen.squeeze > 0 && seen.glide > 0);
});

// ---------------------------------------------------------------- the harbour site
test('the harbour site config is valid and registered', () => {
  assert.equal(ecoById('harbour'), harbour); assert.ok(ECOSYSTEMS.includes(harbour) && ECOSYSTEMS.length >= 3);
  for (const k of ['id', 'name', 'place', 'blurb', 'heightAt', 'colorAt', 'reefiness', 'decorate', 'bounds', 'water', 'sound', 'land', 'fishing', 'menuCam', 'life', 'coral', 'speciesInfo', 'cosyModels']) assert.ok(harbour[k] != null, `harbour.${k}`);
  assert.equal(harbour.daylight, true); assert.equal(harbour.unlock.type, 'identifiedCount'); assert.equal(harbour.unlock.n, 5);
  const w = harbour.water; for (const k of ['absorb', 'fog', 'fogDeep', 'shallow', 'mid', 'deep', 'skyTop', 'skyHorizon', 'sun', 'sunColor', 'hemiSky', 'hemiGround']) assert.ok(w[k] != null, `water.${k}`);
  // life: every species it lists has a look
  for (const id of Object.keys(harbour.life)) assert.ok(LOOKS[id], `${id} has a look`);
  // the spawn is dry, walkable ground; the wharf deck is walkable and level; the quay is above the water
  const sp = harbour.land.spawn; assert.ok(heightAt(sp.x, sp.z) > 0.5, 'spawn on the quay');
  assert.equal(deckAt(WHARF.x, 20), QY); assert.equal(deckAt(WHARF.x + 20, 20), null); assert.equal(deckAt(WHARF.x, QUAY_Z + 5), null, 'on the quay itself the ground is the quay');
  assert.ok(heightAt(0, QUAY_Z + 8) > 1, 'the quay is dry'); assert.ok(heightAt(-20, 20) < -1, 'the basin is water');
  assert.ok(moundAt(EBW, 0) > 2 && heightAt(EBW, 0) > 2, 'the breakwall crest is walkable and above the water'); assert.ok(heightAt(EBW, NBW) > 2, 'the lighthouse stands on a pad');
  for (let x = -60; x < 60; x += 7) for (let z = -40; z < 90; z += 7) assert.ok(Number.isFinite(heightAt(x, z)), `height ${x},${z}`);
  // the home point is on the quay; the walker's bounds contain the spawn, the wharf end and the lighthouse
  const b = harbour.land.bounds; for (const [x, z] of [[sp.x, sp.z], [WHARF.x, WHARF.z1 + 1], [EBW, NBW]]) assert.ok(x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax, `${x},${z} in bounds`);
  assert.ok(heightAt(harbour.land.home.x, harbour.land.home.z) > 1);
});

test('the three spots resolve from where the float lands', () => {
  assert.equal(spotAt(12, 44, 12, 14), 'wharf'); assert.equal(spotAt(12, 30, 20, 20), 'wharf');
  assert.equal(spotAt(EBW, 0, EBW - 8, -4), 'breakwall'); assert.equal(spotAt(0, NBW, -3, NBW + 6), 'breakwall');
  assert.equal(spotAt(-20, 44, -22, 24), 'basin'); assert.equal(spotAt(-30, 44, -30, 30), 'basin');
  for (const s of ['wharf', 'breakwall', 'basin']) assert.ok(SPOTS[s]);
  assert.equal(harbour.fishing.spotAt, spotAt);
});

test('six wharf lamps: lit pools sit on the water beside the wharf, inside the lamp radius', () => {
  assert.equal(LAMPS.length, 6);
  for (const L of LAMPS) { assert.ok(Math.abs(L.head[0] - WHARF.x) > WHARF.w / 2, 'the lantern hangs out over the water'); assert.ok(L.head[1] > WHARF.z1 && L.head[1] < QUAY_Z); assert.ok(heightAt(L.head[0], L.head[1]) < 0, 'the pool is on the water'); }
  assert.equal(litAt(LAMPS[0].head[0], LAMPS[0].head[1]), 0, 'lamps are off by day (uLampOn = 0)');
});

test('time of day: the harbour is dark blue at night (not black), warm at dusk, bright by day, and the lamps follow', () => {
  const noon = daylightAt(12), dusk = daylightAt(19), mid = daylightAt(23), dawn = daylightAt(6.2);
  assert.equal(noon.light, 1); assert.equal(noon.lamps, 0); assert.equal(mid.light, 0); assert.equal(mid.lamps, 1);
  assert.ok(dusk.glow > 0.8 && dusk.light > 0 && dusk.light < 0.5 && dusk.lamps > 0.2, 'dusk: sunset glow, lamps coming on');
  assert.ok(dawn.glow > 0.5 && dawn.lamps < 1);
  let prev = 1; for (let h = 16; h <= 21; h += 0.25) { const l = daylightAt(h).light; assert.ok(l <= prev + 1e-9, 'light falls smoothly into the evening'); prev = l; }
  const lum = hex => { const r = (hex >> 16) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const k of ['skyTop', 'skyHorizon', 'shallow', 'mid', 'deep', 'hemiSky']) { const c = NIGHT[k], r = c >> 16, b = c & 255; assert.ok(b > r, `${k} is blue at night`); assert.ok(lum(c) > 0.05 || k === 'deep', `${k} is not black`); }
  assert.ok(NIGHT.skyHorizon > NIGHT.skyTop, 'a lighter horizon');
});

// ---------------------------------------------------------------- unlocking the site
test('Belmore Basin opens after five species are Identified, and the picker can say what is missing', () => {
  const p = migrateProgress({});
  let L = siteLock(p, harbour); assert.equal(L.locked, true); assert.equal(L.need, 5); assert.equal(L.have, 0); assert.match(L.text, /5 species/i);
  assert.equal(siteLock(p, ecoById('seagrass')).locked, false, 'the first two sites are always open'); assert.equal(siteLock(p, ecoById('rocky')).locked, false);
  const ident = ids => { for (const id of ids) { const e = (p.guide.e[id] ??= {}); e.seen = { t: 1, src: 'x' }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; } };
  ident(['tailor', 'bonito', 'garfish', 'luderick']); L = siteLock(p, harbour); assert.equal(L.locked, true); assert.equal(L.have, 4);
  ident(['sandwhiting']); L = siteLock(p, harbour); assert.equal(L.locked, false); assert.equal(L.have, 5);
  // a species that is only Caught (not Identified) does not count
  const q = migrateProgress({}); q.guide.e.tailor = { caught: { t: 1, n: 1, count: 1 } }; assert.equal(siteLock(q, harbour).have, 0);
});

// ---------------------------------------------------------------- the squid jig and the shop
test('the squid jig is for sale at Mitra\'s shop (a lure), and buying it unlocks the rig', () => {
  const item = SHOP_BY_ID['rig-squidjig']; assert.ok(item && item.cat === 'lure' && item.grants === 'rig-squidjig'); assert.ok(SHOP_CATS.some(c => c.id === 'lure'));
  assert.match(item.why, /spikes only|barbed/i);
  const p = migrateProgress({}); p.coins = 100; assert.equal(rigUnlocked(p, 'squidjig'), false);
  assert.equal(buy(p, 'rig-squidjig').ok, true); assert.equal(rigUnlocked(p, 'squidjig'), true); assert.equal(owns(p, item), true); assert.equal(p.coins, 100 - item.price);
  assert.equal(buy(p, 'rig-squidjig').ok, false, 'one jig is enough');
  const r = migrateProgress({}); r.coins = 5; assert.equal(buy(r, 'rig-squidjig').ok, false);
});

// ---------------------------------------------------------------- people
test('Old Tam moves to the harbour wharf at night; the co-op fisher lives there and teaches commercial fishing', () => {
  assert.ok(isAway(slotAt(NPCS.tam, 'seagrass', 'night')) && !isAway(slotAt(NPCS.tam, 'seagrass', 'dusk')));
  const night = slotAt(NPCS.tam, 'harbour', 'night'); assert.equal(night.act, 'fishing'); assert.ok(PLACES.harbour[night.at]);
  assert.ok(presentAt(NPCS, 'harbour', 'night').some(x => x.id === 'tam') && !presentAt(NPCS, 'harbour', 'day').some(x => x.id === 'tam'));
  const nell = NPCS.nell; assert.ok(nell && /co-op/i.test(nell.role));
  for (const t of ['dawn', 'day', 'dusk', 'night']) assert.ok(slotAt(nell, 'harbour', t), `nell ${t}`);
  assert.ok(!slotAt(nell, 'seagrass', 'day'), 'she does not live at the lake');
  for (const t of ['dawn', 'day', 'dusk']) for (const place of placesOf(slotAt(nell, 'harbour', t))) assert.ok(PLACES.harbour[place], `place ${place}`);
  const all = JSON.stringify(nell.topics);
  assert.match(all, /recreational fishers cannot sell/i); assert.match(all, /commercial/i); assert.match(all, /co-op/i); assert.match(all, /quota/i); assert.match(all, /bycatch/i);
  assert.match(all, /every kind of fish in your Fish Guide is Identified|awards night/i);   // the commercial licence is teased, not unlocked
  assert.ok(nell.topics.some(t => t.teaser === 'commercial'));
  assert.ok(nell.gossip.length >= 3 && nell.tips.length >= 3);
  // one show-me trade and one quiz trade (drawing on the worksheet quiz bank), rewards that exist and come from her
  const kinds = nell.trades.map(t => t.kind).sort(); assert.deepEqual(kinds, ['quiz', 'show']);
  const quiz = nell.trades.find(t => t.kind === 'quiz'); for (const n of quiz.quiz) { assert.ok(QUIZ_BY_N[n], `quiz ${n}`); assert.match(QUIZ_BY_N[n].src, /worksheet 2\.2/, 'commercial questions only'); }
  for (const t of nell.trades) { assert.ok(ITEMS[t.reward], t.reward); assert.equal(ITEMS[t.reward].from, 'nell'); assert.match(ITEMS[t.reward].ask, /Nell/); }
  assert.ok(!/unlock|licence is yours|you now have a commercial/i.test(all.replace(/not unlocked/gi, '')), 'no claim that a commercial licence is available');
});

test('"Name a squid at the wharf": the show-me checks the Fish Guide', () => {
  const p = migrateProgress({}), t = NPCS.nell.trades.find(x => x.kind === 'show');
  assert.equal(t.need.type, 'identified'); assert.equal(progressOf(t.need, p).done, false); assert.equal(tradeStatus(p, t), 'new');
  p.guide.e.squid = { seen: { t: 1 }, caught: { t: 1, n: 1, count: 1 } }; assert.equal(progressOf(t.need, p).done, false, 'caught is not identified');
  p.guide.e.squid.ident = true; assert.equal(progressOf(t.need, p).done, true); assert.equal(tradeStatus(p, t), 'ready');
  assert.match(progressOf(t.need, p).text, /squid/i);
});

// ---------------------------------------------------------------- the accuracy fix: release survival ranges (C13) kept apart from the cut-the-line figure (C15)
test('release survival is shown as the DPIRD range (C13); the 85% for a cut line on a deeply hooked bream (C15) is a separate lesson', () => {
  assert.deepEqual(SURVIVAL_RANGE.yellowfinbream, [72, 97], 'bream 72-97%, not 85%');
  const n = survivalNote('yellowfinbream'); assert.equal(n.mid, 84.5); assert.match(n.text, /72 and 97/); assert.equal(n.single, false);
  assert.equal(CUT_LINE.id, 'yellowfinbream'); assert.equal(CUT_LINE.pulled, 12); assert.equal(CUT_LINE.cut, 85); assert.match(CUT_LINE.text, /12%.*85%/);
  // the audit of every other C13 figure: flathead 91-96, luderick 99, mulloway 73-81, sand whiting 93, snapper 67-92, tailor 92, kingfish 85
  const C13 = { duskyflathead: [91, 96], luderick: [99, 99], mulloway: [73, 81], sandwhiting: [93, 93], snapper: [67, 92], tailor: [92, 92], kingfish: [85, 85] };
  for (const [id, r] of Object.entries(C13)) { assert.deepEqual(SURVIVAL_RANGE[id], r, id); assert.ok(Math.abs(SURVIVAL[id] * 100 - (r[0] + r[1]) / 2) < 1e-9, `${id} base is the midpoint`); }
  assert.equal(survivalNote('tailor').single, true); assert.match(survivalNote('tailor').text, /92%/);
  const sv = releaseSurvival('yellowfinbream', { wet: true, air: 5 }); assert.deepEqual(sv.range, [72, 97]); assert.ok(sv.pct >= 84 && sv.pct <= 85);
  assert.equal(survivalNote('squid'), null, 'no published figure: no claim');
});
