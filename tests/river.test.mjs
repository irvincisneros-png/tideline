// Phase 6: the freshwater river (site 5): the site config and terrain (casuarinas, rocky pool, weir), bass and carp, the bass closed season (?season= / ?month=), the carp best-practice flow, the licence note, the unlock gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_BY_ID, SPOT_INFO, REGIONS, speciesInRegion } from '../src/fishing/species.js';
import { SPOTS, biteWeights, judge, RULES, DEFAULT_CTX, closedNow, SEASON_MONTH } from '../src/fishing/catches.js';
import { DayConditions, seasonOfMonth } from '../src/fishing/gear.js';
import { ECOSYSTEMS, ecoById } from '../src/ecosystems/index.js';
import { river, heightAt, colorAt, bankDist, centre, halfWidth, WEIR_X, spotAt, bassClosed, rockiness } from '../src/ecosystems/river.js';
import { siteLock } from '../src/ecosystems/unlock.js';
import { LICENCE, BASS_SEASON } from '../src/content/river.js';
import { pestVerdict, recordPest, FORBIDDEN_PEST_WORDS, PEST_RULE } from '../src/fishing/pest.js';
import { LOOKS } from '../src/life/looks.js';
import { buildRiverModels } from '../src/world/riverProps.js';
import { loadProgress } from '../src/core/save.js';
import { stewardRating } from '../src/fishing/guide.js';

const identify = (p, n) => { p.guide ??= { nextN: 1, e: {} }; SPECIES.slice(0, n).forEach(s => { const e = (p.guide.e[s.id] ??= {}); e.seen = { t: 1 }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; }); };

test('the river site config is valid and registered fifth, with daylight on', () => {
  assert.equal(ecoById('river'), river); assert.equal(ECOSYSTEMS[4], river);
  for (const k of ['id', 'name', 'place', 'blurb', 'heightAt', 'colorAt', 'reefiness', 'decorate', 'bounds', 'water', 'sound', 'land', 'fishing', 'menuCam', 'life', 'coral', 'speciesInfo', 'cosyModels', 'unlock', 'onStart', 'chipExtra']) assert.ok(river[k] != null, k);
  assert.equal(river.daylight, true);
  const w = river.water; for (const k of ['absorb', 'fog', 'fogDeep', 'shallow', 'mid', 'deep', 'skyTop', 'skyHorizon', 'sun', 'sunColor', 'hemiSky', 'hemiGround']) assert.ok(w[k] != null, `water.${k}`);
  for (const id of Object.keys(river.life)) assert.ok(LOOKS[id], `${id} has a look`);
  for (const k of ['pool', 'weir', 'snags']) assert.ok(SPOT_INFO[k] && SPOTS[k].fish.length >= 2, `${k} has fish`);
  assert.deepEqual(REGIONS.river.spots, ['pool', 'weir', 'snags']);
  assert.deepEqual(river.speciesInfo.map(s => s.id).sort(), ['australianbass', 'carp', 'shortfineel']);
  for (const [k, g] of buildRiverModels()) assert.ok(g.attributes.position.array.every(Number.isFinite), `${k} has no NaN`);
});
test('the river runs between banks: a deep pool, a concrete weir across it with a walkable crest, and she-oak banks', () => {
  const sp = river.land.spawn; assert.ok(bankDist(sp.x, sp.z) > 0 && heightAt(sp.x, sp.z) > 0, 'you start on the bank');
  for (let x = -80; x <= 80; x += 8) { assert.ok(heightAt(x, centre(x)) < -0.2, `water at x=${x}`); assert.ok(heightAt(x, centre(x) + halfWidth(x) + 8) > 0.3, `bank at x=${x}`); }
  assert.ok(heightAt(-26, centre(-26)) < -2.4, 'a deep pool upstream'); assert.ok(heightAt(60, centre(60)) > -1.2, 'a shallow riffle below the weir');
  for (let z = -10; z <= 10; z += 2) assert.ok(Math.abs(heightAt(WEIR_X, centre(WEIR_X) + z) - 0.4) < 0.05, `the weir crest is level at z=${z}`);
  assert.ok(heightAt(WEIR_X - 8, centre(WEIR_X)) < -0.5, 'water above the weir'); assert.ok(heightAt(WEIR_X + 8, centre(WEIR_X)) < -0.1, 'water below it');
  assert.ok(rockiness(-26, centre(-26)) > 0.2 || rockiness(-24, centre(-24) + 4) > 0.2, 'boulders in the pool');
  for (let x = -90; x < 90; x += 9) for (let z = -60; z < 80; z += 9) { assert.ok(Number.isFinite(heightAt(x, z))); const c = colorAt(x, z, heightAt(x, z)); assert.ok(c.every(v => v >= 0 && v <= 1.2)); }
  assert.ok(river.coral.some(c => c[0] === 'rivercasuarina') && river.cosyModels.coral.rivercasuarina.length >= 2, 'casuarinas (river she-oaks)');
  assert.equal(spotAt(0, 0, WEIR_X + 3, 2), 'weir'); assert.equal(spotAt(0, 0, -26, centre(-26)), 'pool'); assert.equal(spotAt(0, 0, -30, centre(-30) + halfWidth(-30) - 1), 'snags');
});

// ---------------------------------------------------------------- the species and their limits
test('Australian bass: DPIRD limits (bag 2 with estuary perch, possession 4, one over 35 cm) and the May to August closed season', () => {
  const r = RULES.australianbass;
  assert.deepEqual([r.min, r.bag, r.possession, r.protected], [null, 2, 4, false]);
  assert.deepEqual(r.maxOver, { cm: 35, n: 1 }); assert.deepEqual(r.closed.months, [4, 5, 6, 7]); assert.match(r.closed.label, /May to August/);
  assert.match(r.note, /estuary perch/); assert.match(r.note, /35 cm/);
  assert.equal(judge('australianbass', 30, 2).kind, 'bag'); assert.equal(judge('australianbass', 30, 1).legal, true);
  // only one over 35 cm
  assert.equal(judge('australianbass', 40, 0, 0, { month: 0, keptOver: 0 }).legal, true); const big = judge('australianbass', 40, 1, 1, { month: 0, keptOver: 1 });
  assert.equal(big.kind, 'bigbag'); assert.match(big.reason, /35 cm/);
  assert.equal(judge('australianbass', 30, 1, 1, { month: 0, keptOver: 1 }).legal, true, 'a small bass is fine');
});
test('the bass closed season is enforced through ?season= (winter) and ?month=: catch and release only', () => {
  assert.equal(seasonOfMonth(4), 'autumn'); assert.equal(seasonOfMonth(5), 'winter'); assert.equal(seasonOfMonth(8), 'spring');
  for (const [season, closed] of [['winter', true], ['summer', false], ['spring', false], ['autumn', false]]) {
    const c = new DayConditions({ season, time: 'day', tide: 'high', swell: 1 }), j = judge('australianbass', 30, 0, 0, c.context({ rig: 'softplastic', bait: 'none' }));
    assert.equal(j.legal, !closed, season); assert.equal(bassClosed(c), closed); if (closed) { assert.equal(j.kind, 'closed'); assert.match(j.reason, /May to August/); assert.match(j.reason, /catch and release/i); }
  }
  // months: May to August closed, April and September open
  for (const [m, closed] of [[3, false], [4, true], [5, true], [6, true], [7, true], [8, false], [0, false]]) assert.equal(closedNow(RULES.australianbass, { month: m }), closed, `month ${m}`);
  const may = new DayConditions({ month: 4, time: 'day', swell: 1 }); assert.equal(may.month, 4); assert.equal(may.season, 'autumn'); assert.equal(bassClosed(may), true);
  const apr = new DayConditions({ month: 3, time: 'day', swell: 1 }); assert.equal(bassClosed(apr), false);
  assert.equal(new DayConditions({ season: 'winter' }).month, SEASON_MONTH.winter);
  // a closed bass is still released correctly: Mastery needs a correct release of a fish you could not keep, and a closed bass is one
  assert.equal(judge('australianbass', 30, 0, 0, { season: 'winter' }).legal, false);
  // other species are unaffected by the season
  assert.equal(judge('carp', 50, 0, 0, { season: 'winter' }).kind, 'pest'); assert.equal(judge('shortfineel', 40, 0, 0, { season: 'winter' }).legal, true);
  // the HUD chip says so
  assert.match(river.chipExtra({ cond: { month: 6, season: 'winter' } }), /catch and release/); assert.equal(river.chipExtra({ cond: { month: 0, season: 'summer' } }), '');
});
test('bass bite lures at the snags at dusk; carp take a bait on the bottom; eels come out at night', () => {
  const lure = { ...DEFAULT_CTX, rig: 'softplastic', bait: 'none', time: 'dusk', season: 'summer' };
  const w = biteWeights('snags', lure).filter(x => x.w > 0).sort((a, b) => b.w - a.w).map(x => x.sp.id);
  assert.equal(w[0], 'australianbass');
  const sink = biteWeights('pool', { ...DEFAULT_CTX, rig: 'runningsinker', bait: 'beachworm', time: 'day', season: 'summer' }).filter(x => x.w > 0).sort((a, b) => b.w - a.w).map(x => x.sp.id);
  assert.equal(sink[0], 'carp');
  const eel = biteWeights('snags', { ...DEFAULT_CTX, rig: 'runningsinker', bait: 'beachworm', time: 'night', season: 'summer' }).find(x => x.sp.id === 'shortfineel');
  assert.ok(eel.w > 0 && eel.condM > 1);
  assert.deepEqual(speciesInRegion('river').map(s => s.id).sort(), ['australianbass', 'carp', 'shortfineel']);
});

// ---------------------------------------------------------------- the carp best-practice flow (never law)
test('carp: no size or bag limit, a pest; the card says "best practice", never "illegal" or "must", and it is not a rule', () => {
  const r = RULES.carp, s = SPECIES_BY_ID.carp;
  assert.equal(r.pest, true); assert.equal(r.min, null); assert.ok(r.bag >= 100 && r.possession >= 100, 'no bag limit'); assert.equal(r.protected, false);
  assert.equal(r.note, PEST_RULE, 'the species note and the flow text agree');
  const j = judge('carp', 25, 0), tiny = judge('carp', 5, 0); assert.equal(j.legal, true); assert.equal(j.kind, 'pest'); assert.equal(tiny.legal, true);
  for (const text of [r.note, s.fact, s.statusNote, pestVerdict(true).text, pestVerdict(false).text, pestVerdict(true).title, pestVerdict(false).title, JSON.stringify(river.speciesInfo.find(x => x.id === 'carp'))]) {
    for (const bad of FORBIDDEN_PEST_WORDS) assert.doesNotMatch(text, bad, `"${text.slice(0, 60)}..." must not claim it is law`);
  }
  assert.match(pestVerdict(true).text, /dispatch/i); assert.match(pestVerdict(true).text, /bin/i); assert.match(pestVerdict(true).text, /never move live carp/i);
  assert.match(pestVerdict(false).text, /best practice/i); assert.match(pestVerdict(false).text, /DPIRD encourages/); assert.match(pestVerdict(false).text, /not a size or bag rule/);
  // keeping is the good call; returning is allowed but not best practice
  assert.equal(pestVerdict(true).cls, 'good'); assert.equal(pestVerdict(true).steward, true); assert.equal(pestVerdict(false).cls, 'warn'); assert.equal(pestVerdict(false).steward, false);
});
test('the carp flow counts pests removed or returned on the save, and returning one costs a little Steward rating', () => {
  const p = loadProgress(); assert.equal(p.pest, undefined);
  recordPest(p, true); recordPest(p, true); recordPest(p, false); assert.deepEqual(p.pest, { removed: 2, returned: 1 });
  // the Steward rating counts the right call: a returned carp is `correct: false`, a removed one `correct: true`
  const before = stewardRating(p).value, good = { catches: [{ correct: true }] }, bad = { catches: [{ correct: false }] };
  assert.ok(stewardRating(good).value > stewardRating(bad).value);
  assert.ok(before > 0);
});

// ---------------------------------------------------------------- the licence note (dataset C9, C10, C11, C12) and the unlock
test('the freshwater licence note comes straight from the dataset: the fee amounts, who is exempt, the Trusts and FishSmart', () => {
  const t = LICENCE.lines.join(' ');
  for (const m of [/3 days \$7/, /1 month \$14/, /1 year \$35/, /3 years \$85/, /under 18/i, /Recreational Fishing Trusts/, /saltwater and freshwater/, /FishSmart/, /check/i]) assert.match(t, m);
  assert.match(LICENCE.src, /C9/); assert.match(LICENCE.src, /C11/); assert.doesNotMatch(t, /\b(fine|penalty|offence)\b/i);
  assert.match(BASS_SEASON.text, /May to August/); assert.match(BASS_SEASON.text, /open all year in dams/); assert.deepEqual(BASS_SEASON.months, RULES.australianbass.closed.months);
});
test('the river opens once six species are Identified, and the picker shows the requirement', () => {
  const p = loadProgress(); let L = siteLock(p, river);
  assert.ok(L.locked && L.need === 6 && /6 species/.test(L.text) && /0 of 6/.test(L.detail));
  identify(p, 5); L = siteLock(p, river); assert.ok(L.locked && L.have === 5);
  identify(p, 6); L = siteLock(p, river); assert.equal(L.locked, false);
  assert.ok(river.unlock.n > ecoById('harbour').unlock.n, 'the river is gated after the harbour');
});
