// The fish trail (src/fishing/trail.js): one next fish, its recipe, the live checklist and the next step; and the bite boost it earns (catches.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_BY_ID, REGIONS } from '../src/fishing/species.js';
import { TRAIL, SITE_ORDER, SITE_REGION, recipeFor, nextTarget, checklist, nextStep, targetName, minutesUntil } from '../src/fishing/trail.js';
import { biteWeights, TARGET_BOOST, goodRig, goodBait } from '../src/fishing/catches.js';
import * as G from '../src/fishing/guide.js';

const starter = { rig: k => ['paternoster', 'runningsinker', 'unweighted'].includes(k), bait: k => ['prawn', 'beachworm'].includes(k) };
const blank = () => { const p = {}; G.ensureGuide(p); return p; };
const caught = (p, id) => G.recordCatch(p, id, { length: 30 });

test('the trail holds every species once, site by site in opening order, each at a spot it lives at', () => {
  assert.equal(TRAIL.length, SPECIES.length);
  assert.equal(new Set(TRAIL.map(e => e.id)).size, SPECIES.length);
  const order = TRAIL.map(e => SITE_ORDER.indexOf(e.site));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  for (const e of TRAIL) { assert.ok(REGIONS[SITE_REGION[e.site]].spots.includes(e.spot), e.id); assert.ok(SPECIES_BY_ID[e.id].spots[e.spot] > 0, e.id); }
});
test('a recipe names a rig and bait that really suit the fish, and prefers what is in the tackle box', () => {
  for (const e of TRAIL) {
    const sp = SPECIES_BY_ID[e.id], r = recipeFor(e, { rig: () => true, bait: () => true });
    assert.ok(goodRig(sp, r.rig.id), `${e.id} rig ${r.rig.id}`);
    if (r.bait) assert.ok(goodBait(sp, r.bait.id), `${e.id} bait ${r.bait.id}`);
    // following the recipe always earns the boost
    const w = c => biteWeights(e.spot, c).find(x => x.sp.id === e.id).w, ctx = { rig: r.rig.id, bait: r.bait?.id ?? 'none' };
    assert.ok(w({ ...ctx, target: e.id }) > w(ctx) * 3.9, `${e.id} boost`);
    if (sp.gate?.rig) assert.ok(sp.gate.rig.includes(r.rig.id));
  }
  const whiting = recipeFor(TRAIL.find(e => e.id === 'sandwhiting'), starter);
  assert.ok(whiting.rig.owned && whiting.bait.owned);
  const lud = recipeFor(TRAIL.find(e => e.id === 'luderick'), starter);
  assert.equal(lud.rig.owned && lud.bait.owned, false, 'luderick needs gear a new angler has not earned');
});
test('the next target is the first uncaught fish at an open site; ready ones first, skipped ones last, locked sites only when nothing else is left', () => {
  const p = blank(), has = starter, ready = e => { const r = recipeFor(e, has); return r.rig.owned && (!r.bait || r.bait.owned); };
  const open = s => s === 'seagrass';
  let t = nextTarget(p, { open, ready });
  assert.equal(t.entry.site, 'seagrass'); assert.equal(t.n, 0); assert.equal(t.total, SPECIES.length); assert.ok(ready(t.entry));
  const first = t.entry.id;
  caught(p, first);
  t = nextTarget(p, { open, ready });
  assert.notEqual(t.entry.id, first); assert.equal(t.n, 1);
  const skipped = nextTarget(p, { open, ready, skipped: [t.entry.id] });
  assert.notEqual(skipped.entry.id, t.entry.id);
  for (const e of TRAIL.filter(e => e.site === 'seagrass')) caught(p, e.id);
  t = nextTarget(p, { open, ready });
  assert.ok(t.lockedSite); assert.notEqual(t.entry.site, 'seagrass');
  for (const e of TRAIL) caught(p, e.id);
  assert.equal(nextTarget(p, { open, ready }), null);
});
test('the checklist and the next step walk travel, rig, bait, spot, then cast', () => {
  const p = blank(), e = TRAIL.find(x => x.id === 'sandwhiting'), r = recipeFor(e, starter), t = { entry: e, n: 0, total: 25, lockedSite: false };
  const step = now => nextStep(t, checklist(r, now));
  assert.match(step({ site: 'rocky', spot: 'beach', rig: 'paternoster', bait: 'prawn', time: 'day', tide: 'rising' }), /travel to Lake Illawarra/);
  assert.match(step({ site: 'seagrass', spot: 'jetty', rig: 'softplastic', bait: 'prawn', time: 'day', tide: 'rising' }), /switch to the runningsinker rig/);
  assert.match(step({ site: 'seagrass', spot: 'jetty', rig: r.rig.id, bait: 'pilchard', time: 'day', tide: 'rising' }), /bait up with/);
  assert.match(step({ site: 'seagrass', spot: 'jetty', rig: r.rig.id, bait: r.bait.id, time: 'day', tide: 'rising' }), /cast at the sand flats/);
  assert.match(step({ site: 'seagrass', spot: 'flats', rig: r.rig.id, bait: r.bait.id, time: 'day', tide: 'rising' }), /cast here!/);
  assert.match(step({ site: 'seagrass', spot: 'flats', rig: r.rig.id, bait: r.bait.id, time: 'night', tide: 'rising' }), /cast here \(best at/);
  assert.match(nextStep({ ...t, lockedSite: true }, [], { lockText: 'Opens when you identify 5 species.' }), /Opens when/);
  assert.match(nextStep(null, []), /finished/);
  assert.equal(targetName(p, 'sandwhiting'), 'a new fish', 'the name is not given away before the key');
});
test('with the recipe on, the target bites far more often; with the wrong rig the boost is off', () => {
  const e = TRAIL.find(x => x.id === 'sandwhiting'), r = recipeFor(e, starter);
  const ctx = { rig: r.rig.id, bait: r.bait.id, tide: 'rising', time: 'day', season: 'summer' };
  const w = c => biteWeights(e.spot, c).find(x => x.sp.id === e.id).w;
  assert.ok(Math.abs(w({ ...ctx, target: e.id }) / w(ctx) - TARGET_BOOST) < 1e-9);
  assert.equal(w({ ...ctx, rig: 'squidjig', target: e.id }), w({ ...ctx, rig: 'squidjig' }));
  const share = c => { const ws = biteWeights(e.spot, c); return ws.find(x => x.sp.id === e.id).w / ws.reduce((s, x) => s + x.w, 0); };
  assert.ok(share({ ...ctx, target: e.id }) > 0.5, 'more than half the bites are the target');
});
test('waiting for the best time moves the clock forward to it', () => {
  assert.equal(minutesUntil([], 10), 0);
  assert.equal(minutesUntil(['dusk'], 10), Math.round(7.2 * 60));
  assert.equal(minutesUntil(['dawn', 'dusk'], 21), Math.round(8.2 * 60));
});
