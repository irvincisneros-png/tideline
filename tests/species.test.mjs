import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_BY_ID, SPOT_INFO, STOCK_SEED } from '../src/fishing/species.js';
import { judge, pickCatch, biteWeights, gearFit, waitFor, SPOTS, RULES, FIGHT, LURE_RIGS, adjustStock, stockOf, DEFAULT_CTX } from '../src/fishing/catches.js';
import { RIGS, BAITS, RIG_ORDER, rigDiagram, tackleBoxHTML, DayConditions } from '../src/fishing/gear.js';
import { LOOKS } from '../src/life/looks.js';
import { TUNING } from '../src/fishing/catchbar.js';
import '../src/ecosystems/index.js'; // registers the dive-scene looks some catches reuse

const HABITATS = ['pelagic', 'demersal', 'reef', 'estuarine', 'invertebrate'];
const PROFILES = ['dart', 'shake', 'bolt', 'twitch', 'jet'];

// Small deterministic random generator so the statistical checks never flake.
const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

test('species data: every species has a look, valid rules, fight profile, sources and real spots', () => {
  assert.ok(SPECIES.length >= 22, `${SPECIES.length} species`);   // no upper bound: sites add species, and every count in the tests is derived from SPECIES
  const ids = new Set();
  for (const s of SPECIES) {
    assert.ok(!ids.has(s.id), `duplicate ${s.id}`); ids.add(s.id);
    assert.ok(LOOKS[s.id], `${s.id} has no registerLook`);
    for (const k of ['name', 'sci', 'idFeature', 'fact', 'statusNote']) assert.ok(typeof s[k] === 'string' && s[k].length > 3, `${s.id} ${k}`);
    assert.ok(HABITATS.includes(s.habitat), `${s.id} habitat`);
    assert.ok(PROFILES.includes(s.fight) && s.power > 0 && s.power <= 1, `${s.id} fight`);
    assert.ok(STOCK_SEED[s.status] !== undefined, `${s.id} status ${s.status}`);
    assert.ok(Object.keys(s.spots).length > 0);
    for (const [spot, w] of Object.entries(s.spots)) assert.ok(SPOT_INFO[spot] && w > 0, `${s.id} spot ${spot}`);
    for (const r of Object.keys(s.rig)) assert.ok(RIGS[r], `${s.id} rig ${r}`);
    for (const b of Object.keys(s.bait)) assert.ok(BAITS[b], `${s.id} bait ${b}`);
    for (const m of Object.values({ ...s.rig, ...s.bait })) assert.ok(m >= 0 && m <= 1);
    const [lo, hi] = s.length; assert.ok(lo > 0 && hi > lo);
    const r = s.rules;
    assert.ok(typeof r.protected === 'boolean' && r.note.length > 5, `${s.id} rules`);
    assert.ok(Number.isInteger(r.bag) && r.bag >= 0 && Number.isInteger(r.possession) && r.possession >= r.bag, `${s.id} bag/possession`);
    if (r.protected) assert.equal(r.bag, 0);
    else assert.ok(r.bag > 0);
    if (r.min) assert.ok(r.min > lo && r.min <= hi, `${s.id}: min ${r.min} should sit inside ${lo}-${hi} so undersize fish exist`);
    if (r.slotMax) assert.ok(r.slotMax > r.min && hi > r.slotMax, `${s.id} slot`);
    assert.ok(s.src && s.src.rules && s.src.status, `${s.id} src`);
    if (s.swap) assert.ok(SPECIES_BY_ID[s.swap.id] && s.swap.reason.length > 10, `${s.id} swap`);
  }
});

test('species data: dataset rules that matter (snapper bag 10, flathead slot, mulloway, protected, possession)', () => {
  assert.equal(RULES.snapper.bag, 10);
  assert.deepEqual([RULES.duskyflathead.min, RULES.duskyflathead.slotMax, RULES.duskyflathead.bag, RULES.duskyflathead.possession], [36, 70, 5, 10]);
  assert.deepEqual([RULES.tailor.min, RULES.tailor.bag, RULES.tailor.possession], [30, 10, 20]);
  assert.deepEqual([RULES.mulloway.min, RULES.mulloway.bag], [70, 1]);
  assert.equal(RULES.australiansalmon.min, null);
  assert.ok(RULES.bluegroper.protected && RULES.wobbegong.protected);
  assert.equal(SPECIES_BY_ID.mulloway.status, 'recovering');
  assert.equal(SPECIES_BY_ID.mulloway.swap.id, 'tailor');
});

test('every spot table names real species, and has fish both big enough and under the minimum', () => {
  for (const [spot, t] of Object.entries(SPOTS)) {
    assert.ok(t.fish.length >= 3, `${spot} has too few species`);
    for (const [id] of t.fish) assert.ok(RULES[id], `${spot}: ${id}`);
    assert.ok(t.fish.some(([id]) => RULES[id].min), `${spot}: no species with a legal minimum`);
  }
});

test('judge(): undersize, slot, bag, possession and protected', () => {
  assert.equal(judge('tailor', 25, 0).kind, 'undersize');
  assert.equal(judge('tailor', 29, 0).legal, false);   // one cm under is still undersize
  assert.equal(judge('tailor', 30, 0).legal, true);    // exactly on the limit is legal
  assert.equal(judge('tailor', 35, 10).kind, 'bag');
  assert.equal(judge('tailor', 35, 5, 20).kind, 'possession'); // bag 10 but possession 20 reached
  assert.equal(judge('tailor', 35, 9, 19).legal, true);
  assert.equal(judge('duskyflathead', 30, 0).kind, 'undersize');
  assert.equal(judge('duskyflathead', 50, 0).legal, true);
  assert.equal(judge('duskyflathead', 70, 0).legal, true);   // 70 is inside the slot
  assert.equal(judge('duskyflathead', 71, 0).kind, 'oversize');
  assert.equal(judge('bluegroper', 60, 0).kind, 'protected');
  assert.equal(judge('wobbegong', 90, 0).legal, false);
  assert.equal(judge('snapper', 35, 9).legal, true);
  assert.equal(judge('snapper', 35, 10).kind, 'bag');
  assert.equal(judge('mulloway', 80, 1).kind, 'bag');
  assert.equal(judge('australiansalmon', 15, 0).legal, true);  // no minimum
  assert.equal(judge('australiansalmon', 15, 5).kind, 'bag');
  assert.equal(judge('nosuchfish', 5, 0).legal, true);
  const probes = { undersize: ['tailor', 20, 0], oversize: ['duskyflathead', 80, 0], bag: ['tailor', 40, 10], possession: ['tailor', 40, 0, 20], protected: ['bluegroper', 50, 0] };
  for (const [k, probe] of Object.entries(probes)) { const v = judge(...probe); assert.equal(v.kind, k); assert.ok(v.reason.length > 15, k); }
});

test('bite model: weight = base x rig x bait x conditions x stock/100', () => {
  const ctx = { rig: 'runningsinker', bait: 'beachworm', tide: 'rising', time: 'day', season: 'summer', stock: null };
  const w = biteWeights('flats', ctx).find(x => x.sp.id === 'sandwhiting');
  assert.equal(w.rigM, 1); assert.equal(w.baitM, 1);
  assert.ok(Math.abs(w.condM - 1.4 * 1.4 * 1.4) < 1e-9);       // rising, day, summer all match whiting
  assert.equal(w.stock, 80);                                     // sustainable seed
  assert.ok(Math.abs(w.w - 4 * 1 * 1 * w.condM * 0.8) < 1e-9);
  // Stock health scales the weight.
  const half = biteWeights('flats', { ...ctx, stock: () => 40 }).find(x => x.sp.id === 'sandwhiting');
  assert.ok(Math.abs(half.w / w.w - 0.5) < 1e-9);
  // Lures ignore bait; a bait rig with no bait is a poor match.
  assert.equal(biteWeights('beach', { ...DEFAULT_CTX, rig: 'metalslug', bait: 'none' }).find(x => x.sp.id === 'tailor').baitM, 1);
  assert.equal(biteWeights('beach', { ...DEFAULT_CTX, rig: 'runningsinker', bait: 'none' }).find(x => x.sp.id === 'sandwhiting').baitM, 0.1);
  assert.ok(LURE_RIGS.has('squidjig') && !LURE_RIGS.has('float'));
});

test('bite model: matched tackle bites sooner and catches the target; mismatch waits longer and skews small', () => {
  const good = { ...DEFAULT_CTX, rig: 'runningsinker', bait: 'beachworm' }, bad = { ...DEFAULT_CTX, rig: 'squidjig', bait: 'none' };
  assert.ok(gearFit('flats', good) > gearFit('flats', bad) * 3);
  const avgWait = ctx => { const r = seeded(7); let t = 0; for (let i = 0; i < 400; i++) t += waitFor('flats', ctx, r); return t / 400; };
  assert.ok(avgWait(bad) > avgWait(good) * 1.8, `${avgWait(bad)} vs ${avgWait(good)}`);
  // Float + green weed at the rocks should mostly land luderick; the squid jig should mostly land squid.
  const share = (spot, ctx, id) => { const r = seeded(11); let n = 0; for (let i = 0; i < 1500; i++) if (pickCatch(spot, ctx, r).id === id) n++; return n / 1500; };
  assert.ok(share('rock', { ...DEFAULT_CTX, rig: 'float', bait: 'greenweed' }, 'luderick') > 0.5);
  assert.ok(share('rock', { ...DEFAULT_CTX, rig: 'squidjig', bait: 'none' }, 'squid') > 0.5);
  assert.ok(share('rock', { ...DEFAULT_CTX, rig: 'float', bait: 'greenweed' }, 'squid') < 0.05);
  // Mean length of the same species is smaller with poorly matched gear.
  const meanLen = ctx => { const r = seeded(5); let s = 0, n = 0; for (let i = 0; i < 4000; i++) { const c = pickCatch('flats', ctx, r); if (c.id === 'yellowfinbream') { s += c.length; n++; } } return s / n; };
  assert.ok(meanLen({ ...DEFAULT_CTX, rig: 'unweighted', bait: 'prawn' }) > meanLen({ ...DEFAULT_CTX, rig: 'metalslug', bait: 'none' }) + 3);
  const c = pickCatch('flats', () => 0.5);   // old call style still works
  assert.ok(RULES[c.id] && c.length > 0 && c.gear >= 0 && c.gear <= 1);
});

test('every spot has a non-zero chance of undersize fish, and flathead can come over the slot', () => {
  for (const spot of Object.keys(SPOTS)) {
    const r = seeded(spot.length * 97); let under = 0;
    for (let i = 0; i < 1500; i++) { const c = pickCatch(spot, { ...DEFAULT_CTX, rig: 'runningsinker', bait: 'prawn' }, r); const m = RULES[c.id].min; if (m && c.length < m) under++; }
    assert.ok(under > 15, `${spot}: only ${under} undersize in 1500`);
  }
  const r = seeded(3); let over = 0;
  for (let i = 0; i < 3000; i++) { const c = pickCatch('channel', { ...DEFAULT_CTX, rig: 'softplastic', bait: 'none' }, r); if (c.id === 'duskyflathead' && c.length > 70) over++; }
  assert.ok(over > 0);
});

test('stock health is seeded from status, persisted by adjustStock and clamped', () => {
  assert.equal(stockOf(null, 'flats', 'tailor'), 80);
  assert.equal(stockOf(null, 'channel', 'mulloway'), 45);
  assert.equal(stockOf(null, 'rock', 'redmorwong'), 60);
  const p = {}; adjustStock(p, 'flats', 'tailor', -4);
  assert.equal(p.stock['flats:tailor'], 76);
  adjustStock(p, 'flats', 'tailor', 100); assert.equal(p.stock['flats:tailor'], 100);
  assert.equal(stockOf(p.stock, 'flats', 'tailor'), 100);
});

test('gear: every rig has a labelled diagram and a tackle-box card; conditions cycle', () => {
  for (const id of RIG_ORDER) {
    const svg = rigDiagram(id);
    assert.ok(svg.startsWith('<svg') && svg.includes('<text'), id);
    assert.ok(tackleBoxHTML({ rig: id, bait: 'prawn' }).includes(`data-rig="${id}"`));
  }
  assert.ok(['hook', 'sinker', 'swivel', 'float', 'leader'].every(w => RIG_ORDER.some(id => rigDiagram(id).includes(w))));
  const d = new DayConditions({ season: 'winter', time: 'dawn', tide: 'low', swell: 1.2 }, seeded(1));
  assert.equal(d.tide, 'low'); assert.equal(d.time, 'dawn'); assert.equal(d.season, 'winter');
  const seen = new Set(), times = new Set();
  for (let i = 0; i < 4000; i++) { d.update(0.25); seen.add(d.tide); times.add(d.time); }
  assert.equal(seen.size, 4); assert.equal(times.size, 4);
  assert.ok(d.swell > 0.2 && /swell/.test(d.chip()));
  assert.equal(Object.keys(FIGHT).length, SPECIES.length);
  assert.ok(TUNING.zoneMax > TUNING.zoneMin);
});
