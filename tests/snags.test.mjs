// Day 3 snags and tangles: the pure logic (fishing/snags.js) and the bookkeeping. The review's "Snags", "Lure regression" and "Tangle" risk rows
// (docs/specs/2026-11-06-purpose-onboarding-review.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SNAG_SPOT, SNAG_RIG, SNAG, PER_METRE, snagRisk, SnagRoll, SnagState, TangleState, crosses, bookSnagFreed, bookLineCut, lostLineCount, collectLostLine, SNAG_TEXT } from '../src/fishing/snags.js';
import { SPOT_INFO } from '../src/fishing/species.js';
import { RIGS } from '../src/fishing/gear.js';
import { TAP_MAX } from '../src/fishing/lure.js';
import { NPCS, TANGLE_DEFAULT } from '../src/content/npcs.js';
import { FEATURES } from '../src/content/missions.js';
import { migrateProgress } from '../src/core/save.js';
import { stewardRating } from '../src/fishing/guide.js';
import { litterUnpaid, payLitter } from '../src/economy/coins.js';
import { progressOf } from '../src/npc/requests.js';
import * as M from '../src/npc/missions.js';

const DT = 1 / 60;
/** A small seeded RNG (mulberry32), so the rates below are the same every run. */
const seeded = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const fresh = () => migrateProgress({});

// ---------------------------------------------------------------- the tables and the risk
test('snag tables: every key is a real spot or rig, every weight is 0 to 1, and the numbers are the review\'s', () => {
  for (const [k, v] of Object.entries(SNAG_SPOT)) { assert.ok(SPOT_INFO[k], `spot ${k}`); assert.ok(v >= 0 && v <= 1); }
  for (const [k, v] of Object.entries(SNAG_RIG)) { assert.ok(RIGS[k], `rig ${k}`); assert.ok(v >= 0 && v <= 1); }
  for (const rig of Object.keys(RIGS)) assert.ok(rig in SNAG_RIG, `rig ${rig} has a weight`);
  assert.deepEqual(SNAG_SPOT, { snags: 1, reef: .8, mangrove: .8, rock: .7, breakwall: .7, jetty: .6, wharf: .6, reefedge: .6, pool: .4, weir: .4, seagrass: .25, channel: .1, basin: .1, flats: 0, beach: 0, reefsand: 0 });
  assert.deepEqual(SNAG_RIG, { runningsinker: 1, softplastic: 1, paternoster: .8, squidjig: .7, metalslug: .6, unweighted: .5, float: 0 });
});

test('snagRisk is 0 for a float rig and for flats, beach and reefsand, whatever the rig; unknown things are 0', () => {
  for (const spot of Object.keys(SNAG_SPOT)) assert.equal(snagRisk(spot, 'float'), 0, `float at ${spot}`);
  for (const spot of ['flats', 'beach', 'reefsand']) for (const rig of Object.keys(SNAG_RIG)) assert.equal(snagRisk(spot, rig), 0, `${rig} at ${spot}`);
  assert.equal(snagRisk('nowhere', 'runningsinker'), 0); assert.equal(snagRisk('snags', 'nothing'), 0);
  assert.equal(snagRisk('snags', 'runningsinker'), 1); assert.ok(Math.abs(snagRisk('reef', 'paternoster') - 0.64) < 1e-9); assert.ok(snagRisk('jetty', 'unweighted') > 0);
});

// ---------------------------------------------------------------- the roll
const reel = { spot: 'snags', rig: 'runningsinker', state: 'wait', move: 'reel', sink: 0, shadow: false, speed: 0.7 };
test('no roll in a still wait, with a twitch, or while a shadow fish is following; a float rig never rolls', () => {
  const r = new SnagRoll(() => 0);   // a roll that always wins, to prove only eligibility stops it
  r.newCast();
  for (let i = 0; i < 600; i++) {
    assert.equal(r.step(DT, { ...reel, move: 'pause' }), false, 'a still wait');
    assert.equal(r.step(DT, { ...reel, state: 'retrieve', move: 'pause', sink: 0.5 }), false, 'a pause that has not sunk');
    assert.equal(r.step(DT, { ...reel, state: 'retrieve', move: 'twitch' }), false, 'a twitch');
    assert.equal(r.step(DT, { ...reel, state: 'retrieve', shadow: true }), false, 'a fish is following (sh.on)');
    assert.equal(r.step(DT, { ...reel, state: 'retrieve', move: 'pause', sink: 1, shadow: true }), false, 'sunk, but a fish is following');
    assert.equal(r.step(DT, { ...reel, rig: 'float' }), false, 'a float rig');
    assert.equal(r.step(DT, { ...reel, spot: 'beach' }), false, 'a beach');
    assert.equal(r.step(DT, { ...reel, state: 'bite' }), false, 'any other state');
  }
  assert.equal(SnagRoll.eligible({ state: 'wait', move: 'reel' }), true);
  assert.equal(SnagRoll.eligible({ state: 'retrieve', move: 'pause', sink: 0.8 }), true, 'a sunk pause rolls');
  assert.equal(SnagRoll.eligible({ state: 'retrieve', move: 'reel', sink: 0 }), true);
  assert.equal(r.step(DT, reel), true, 'and a reeled bait rig at a snaggy spot does roll');
});

test('cooldown: after a snag the next 3 casts cannot snag, the 4th can; and no second snag in the same cast', () => {
  const r = new SnagRoll(() => 0);
  r.newCast(); assert.equal(r.step(DT, reel), true);
  assert.equal(r.step(DT, reel), false, 'once per cast');
  for (let c = 1; c <= 3; c++) { r.newCast(); assert.equal(r.step(DT, reel), false, `cast ${c} after a snag`); }
  r.newCast(); assert.equal(r.step(DT, reel), true, 'the fourth cast after');
});

test('force: the next eligible roll snags after a little movement, even in the cooldown, but never where risk is 0', () => {
  const r = new SnagRoll(() => 0.999);   // a roll that never wins by itself
  r.newCast(); r.cool = 3; r.newCast(); r.force = true;
  let frames = 0; while (!r.step(DT, reel) && frames < 600) frames++;
  assert.ok(frames > 30 && frames < 600, `it waits for ${SNAG.forceMetres} m of movement, not the first frame (${frames} frames)`);
  assert.equal(r.force, false, 'one forced snag only');
  const r2 = new SnagRoll(() => 0.999); r2.newCast(); r2.force = true;
  for (let i = 0; i < 600; i++) { assert.equal(r2.step(DT, { ...reel, rig: 'float' }), false); assert.equal(r2.step(DT, { ...reel, spot: 'flats' }), false); }
  assert.equal(r2.force, true, 'still waiting for a rig that can snag');
});

/** Simulate a cast that moves the rig about SNAG.cast metres (a bait rig drawn in at 0.7 m/s). Returns the number of snags in `casts` casts. */
function snagsIn(casts, spot, rig, seed, state = 'wait') {
  const r = new SnagRoll(seeded(seed)); let n = 0;
  const speed = state === 'wait' ? 0.7 : 1.7, frames = Math.round(SNAG.cast / speed / DT);
  for (let c = 0; c < casts; c++) {
    r.newCast();
    for (let f = 0; f < frames; f++) if (r.step(DT, { spot, rig, state, move: 'reel', sink: 0, shadow: false, speed })) { n++; break; }
  }
  return n;
}
test('tuning: about 1 snag in 8 casts at a high-risk spot, rare at a low-risk one (seeded, 3000 casts each)', () => {
  assert.ok(PER_METRE > 0 && PER_METRE < 0.05);
  const hi = snagsIn(3000, 'snags', 'runningsinker', 11) / 30, hiLure = snagsIn(3000, 'snags', 'softplastic', 12, 'retrieve') / 30, reefLure = snagsIn(3000, 'reef', 'softplastic', 14, 'retrieve') / 30;
  assert.ok(hi > 9 && hi < 16, `high-risk bait: ${hi.toFixed(1)} snags per 100 casts (target about 12)`);
  assert.ok(hiLure > 9 && hiLure < 16, `high-risk lure: ${hiLure.toFixed(1)} per 100`);
  assert.ok(reefLure > 7 && reefLure < 14, `reef with a lure: ${reefLure.toFixed(1)} per 100`);
  const lo = snagsIn(3000, 'seagrass', 'unweighted', 13) / 30, none = snagsIn(2000, 'flats', 'runningsinker', 15), float = snagsIn(2000, 'snags', 'float', 16);
  assert.ok(lo > 0.5 && lo < 5, `low-risk: ${lo.toFixed(1)} per 100`);
  assert.equal(none, 0); assert.equal(float, 0);
  assert.ok(hi > lo * 3);
});

// ---------------------------------------------------------------- the player's side
/** Feed a script of [down, seconds] pairs; returns the first non-null result and the state. */
function play(S, script) {
  for (const [down, secs] of script) for (let t = 0; t < secs - 1e-9; t += DT) { const r = S.step(DT, down); if (r) return { r, S }; }
  return { r: null, S };
}
const tap = [[true, 0.1], [false, 0.4]];   // a tap, then a gap longer than TAP_MAX and the 0.3 s counting gap

test('a held Space cannot count: nothing happens until it has been let go once', () => {
  const S = new SnagState(() => 0);   // 2 taps to free
  assert.equal(S.armed, false);
  assert.equal(play(S, [[true, 5]]).r, null, 'a reel held through the snag never cuts');
  assert.equal(S.tension, 0); assert.equal(S.taps, 0); assert.equal(S.armed, false);
  S.step(DT, false); assert.equal(S.armed, true);
  // And a tap that is already down when the snag starts is not a tap either: it must be released, then pressed again.
  const T = new SnagState(() => 0); T.step(DT, true); T.step(DT, true); T.step(DT, false);
  assert.equal(T.taps, 0, 'the release that arms it is not a counted tap');
});

test('2 to 4 counted taps free the rig, a different number each snag', () => {
  const needs = new Set();
  for (const [rnd, want] of [[0, 2], [0.4, 3], [0.99, 4]]) {
    const S = new SnagState(() => rnd); assert.equal(S.need, want); needs.add(S.need);
    S.step(DT, false);
    const res = play(S, Array.from({ length: want }, () => tap).flat());
    assert.equal(res.r, 'freed', `${want} taps`); assert.equal(S.taps, want);
  }
  assert.equal(needs.size, 3);
  for (let i = 0; i < 50; i++) { const n = new SnagState().need; assert.ok(n >= 2 && n <= 4); }
  const one = new SnagState(() => 0.99); one.step(DT, false);
  assert.equal(play(one, [...tap, ...tap, ...tap]).r, null, 'three taps do not free a four-tap snag');
});

test('taps faster than 0.3 s apart are ignored, with no penalty', () => {
  const S = new SnagState(() => 0.99); S.step(DT, false);   // 4 taps needed
  // Six quick taps: a press of 0.06 s and a gap of 0.1 s, a tap every ~0.16 s. Only those 0.3 s after the last COUNTED one count.
  const quick = Array.from({ length: 6 }, () => [[true, 0.06], [false, 0.1]]).flat();
  play(S, quick);
  assert.ok(S.taps >= 1 && S.taps <= 4 && S.taps < 6, `${S.taps} of 6 quick taps counted`);
  assert.equal(S.tension, 0, 'and no penalty');
  assert.equal(S.result, S.taps >= S.need ? 'freed' : null);
  const D = new SnagState(() => 0.99); D.step(DT, false);
  play(D, [[true, 0.1], [false, 0.12], [true, 0.1], [false, 0.12]]);   // the second tap lands 0.22 s after the first: too soon
  assert.equal(D.taps, 1);
  play(D, [[true, 0.1], [false, 0.4]]);
  assert.equal(D.taps, 2, 'a tap after the gap counts');
});

test('a press longer than a tap is a hold, never a tap', () => {
  const S = new SnagState(() => 0.99); S.step(DT, false);
  play(S, [[true, TAP_MAX + 0.1], [false, 1]]);
  assert.equal(S.taps, 0);
});

test('tension is deterministic: 0 to 1 over 1.6 s held, falls when let go, full tension cuts the line', () => {
  const S = new SnagState(() => 0.99); S.step(DT, false);
  play(S, [[true, 0.8]]);
  assert.ok(Math.abs(S.tension - (0.8 - TAP_MAX) / SNAG.holdSecs) < 0.03, `a hold only builds tension once it is longer than a tap (${S.tension.toFixed(2)})`);
  const before = S.tension; play(S, [[false, 0.3]]);
  assert.ok(S.tension < before, 'letting go lowers it');
  play(S, [[false, 2]]); assert.equal(S.tension, 0);
  const C = new SnagState(() => 0.99); C.step(DT, false);
  const res = play(C, [[true, 5]]);
  assert.equal(res.r, 'cut'); assert.equal(C.tension, 1);
  // The cut comes after a hold of TAP_MAX + 1.6 s (the reader needs the press to be longer than a tap first), not sooner, and it is the same every time.
  let t = 0; const D = new SnagState(() => 0.99); D.step(DT, false); while (!D.step(DT, true)) t += DT;
  assert.ok(t > SNAG.holdSecs && t < SNAG.holdSecs + TAP_MAX + 0.1, `cut after ${t.toFixed(2)} s`);
  let t2 = 0; const E = new SnagState(() => 0.5); E.step(DT, false); while (!E.step(DT, true)) t2 += DT;
  assert.equal(t.toFixed(3), t2.toFixed(3));
  // A student can ride the edge: hold, ease off, never cut.
  const R = new SnagState(() => 0.99); R.step(DT, false);
  for (let i = 0; i < 20; i++) { assert.equal(play(R, [[true, 0.9], [false, 0.9]]).r, null); }
  assert.ok(!R.result);
});

test('after the result the state stays put (no timers, no second result)', () => {
  const S = new SnagState(() => 0); S.step(DT, false);
  assert.equal(play(S, [...tap, ...tap]).r, 'freed');
  for (let i = 0; i < 300; i++) assert.equal(S.step(DT, true), 'freed');
});

// ---------------------------------------------------------------- tangles (1c)
test('crosses(): a proper crossing in x and z only', () => {
  const P = (x, z) => ({ x, z });
  assert.equal(crosses(P(0, 0), P(10, 10), P(0, 10), P(10, 0)), true, 'an X');
  assert.equal(crosses(P(0, 0), P(10, 0), P(0, 5), P(10, 5)), false, 'parallel');
  assert.equal(crosses(P(0, 0), P(10, 0), P(5, 1), P(5, 9)), false, 'a T that does not reach');
  assert.equal(crosses(P(0, 0), P(10, 0), P(5, -1), P(5, 1)), true, 'a plus');
  assert.equal(crosses(P(0, 0), P(10, 10), P(10, 10), P(20, 0)), false, 'sharing an end is not a crossing');
  assert.equal(crosses(P(0, 0), P(10, 0), P(5, 0), P(15, 0)), false, 'lying along each other');
  assert.equal(crosses(P(0, 0), P(4, 4), P(6, 0), P(10, 4)), false, 'two lines side by side');
  assert.equal(crosses(P(0, 0), P(10, 10), P(0, 10), P(10, 0)), crosses(P(10, 0), P(0, 10), P(10, 10), P(0, 0)), 'the order of the points does not matter');
  // With y present too (world points), only x and z are read.
  assert.equal(crosses({ x: 0, y: 5, z: 0 }, { x: 10, y: 0, z: 10 }, { x: 0, y: 9, z: 10 }, { x: 10, y: 0, z: 0 }), true);
});

test('a tangle: hold to wind in, it frees in 2.2 s, losing progress slowly when let go, and it can never cut', () => {
  const T = new TangleState();
  for (let t = 0; t < 1; t += DT) assert.equal(T.step(DT, true), null);
  const mid = T.progress; assert.ok(mid > 0.4 && mid < 0.5);
  for (let t = 0; t < 0.5; t += DT) T.step(DT, false);
  assert.ok(T.progress < mid && T.progress > 0.3, 'slow to lose');
  let t = 0; while (!T.step(DT, true)) { t += DT; assert.ok(t < 5); }
  assert.equal(T.result, 'freed');
  const U = new TangleState(); for (let i = 0; i < 6000; i++) assert.notEqual(U.step(DT, i % 7 < 3), 'cut');
  // Holding from before the tangle began is fine here (nothing can break), unlike a snag.
  assert.equal(new TangleState().step(DT, true), null);
});

test('tangle lines: three kind lines by default, and a fishing person may carry their own', () => {
  assert.equal(TANGLE_DEFAULT.length, 3); for (const l of TANGLE_DEFAULT) assert.ok(typeof l === 'string' && l.length > 10 && !/\{/.test(l));
  for (const id of ['tam', 'mika']) { assert.equal(NPCS[id].tangle.length, 3, id); for (const l of NPCS[id].tangle) assert.ok(!/\{|fault|stupid|idiot/i.test(l)); }
});

// ---------------------------------------------------------------- bookkeeping, and the lost line pays nothing
test('a freed snag counts up p.skills.snagFreed; a cut line counts up lostLine at that site only', () => {
  const p = fresh();
  assert.equal(bookSnagFreed(p), 1); assert.equal(bookSnagFreed(p), 2); assert.equal(p.skills.snagFreed, 2);
  assert.equal(bookLineCut(p, 'seagrass'), 1); assert.equal(bookLineCut(p, 'seagrass'), 2); assert.equal(bookLineCut(p, 'rocky'), 1);
  assert.deepEqual(p.skills.lostLine, { seagrass: 2, rocky: 1 });
  assert.equal(lostLineCount(p, 'seagrass'), 2); assert.equal(lostLineCount(p, 'reef'), 0);
  const old = {}; bookLineCut(old, 'rocky'); assert.equal(old.skills.lostLine.rocky, 1, 'copes with a progress object that has no skills yet');
});

test('collecting the line you lost pays no credits and adds nothing to the Steward points or the litter tally', () => {
  const p = fresh();
  bookLineCut(p, 'seagrass'); bookLineCut(p, 'seagrass');
  const snapshot = () => JSON.stringify({ coins: p.coins, steward: p.steward, econ: p.econ, rating: stewardRating(p), unpaid: litterUnpaid(p) });
  const before = snapshot();
  assert.equal(collectLostLine(p, 'rocky'), false, 'not your line at another site');
  assert.equal(collectLostLine(p, 'seagrass'), true); assert.equal(lostLineCount(p, 'seagrass'), 1);
  assert.equal(collectLostLine(p, 'seagrass'), true); assert.equal(lostLineCount(p, 'seagrass'), 0);
  assert.equal(collectLostLine(p, 'seagrass'), false, 'nothing left to collect: it cannot go negative');
  assert.equal(lostLineCount(p, 'seagrass'), 0);
  assert.equal(snapshot(), before, 'credits, Steward points, litter, the rating and what Fatima would pay are all unchanged');
  assert.equal(litterUnpaid(p), 0); assert.equal(payLitter(p).amount, 0);
  assert.equal(progressOf({ type: 'litter', n: 1 }, p).have, 0, 'and Fatima\'s litter quest does not move');
});

// ---------------------------------------------------------------- the mission and the words
test('Structure is on, needs one freed snag, and the snag it asks for is a real one (snagFreed)', () => {
  assert.equal(FEATURES.snags, true);
  const m = M.chain().find(x => x.id === 'structure'); assert.ok(m, 'Mission 4 is in the chain');
  const p = fresh();
  assert.equal(progressOf({ type: 'snagFreed', n: 1 }, p).done, false);
  bookSnagFreed(p); assert.equal(progressOf({ type: 'snagFreed', n: 1 }, p).done, true);
  assert.ok(M.missionProgress(p, 'structure').steps[0].done);
});

test('the words: short, kind, and the prompt is the review\'s', () => {
  assert.equal(SNAG_TEXT.prompt, 'Snagged! Tap, tap, tap to let it drop off. Don\'t pull.');
  for (const [k, v] of Object.entries(SNAG_TEXT)) assert.ok(v.length < 200, k);
  assert.ok(!/stupid|fail|fault/i.test(JSON.stringify(SNAG_TEXT)));
});
