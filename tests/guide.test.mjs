import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES } from '../src/fishing/species.js';
import { adjustStock, judge } from '../src/fishing/catches.js';
import * as G from '../src/fishing/guide.js';
import { logbookCSV, loadProgress } from '../src/core/save.js';

const fresh = () => ({ journal: {}, catches: [], stock: {}, steward: { points: 0, litter: 0, checks: 0, clean: 0, fines: 0 }, guide: { nextN: 1, e: {} } });

test('tiers climb seen -> caught -> identified -> mastered, and mastery needs all three things', () => {
  const p = fresh();
  assert.equal(G.tierOf(p, 'tailor'), 'unseen'); assert.equal(G.labelOf(p, 'tailor'), '???');
  assert.ok(G.markSeen(p, 'tailor', 'school')); assert.ok(!G.markSeen(p, 'tailor', 'school'));
  assert.equal(G.tierOf(p, 'tailor'), 'seen');
  G.recordCatch(p, 'tailor', { length: 31, photo: 'img' });
  assert.equal(G.tierOf(p, 'tailor'), 'caught'); assert.equal(G.labelOf(p, 'tailor'), 'Unknown fish #1');
  G.recordCatch(p, 'snapper', { length: 35 });
  assert.equal(G.labelOf(p, 'snapper'), 'Unknown fish #2');
  G.recordMeasure(p, 'tailor', true); G.recordDecision(p, 'tailor', true);
  assert.equal(G.tierOf(p, 'tailor'), 'caught', 'measure and decision alone do not master an unidentified fish');
  assert.equal(G.recordKey(p, 'tailor', 'tailor').correct, true);
  assert.equal(G.tierOf(p, 'tailor'), 'mastered'); assert.equal(G.labelOf(p, 'tailor'), 'Tailor');
  // An inaccurate measure or a wrong decision does not master.
  G.recordKey(p, 'snapper', 'snapper'); G.recordMeasure(p, 'snapper', false); G.recordDecision(p, 'snapper', true);
  assert.equal(G.tierOf(p, 'snapper'), 'identified');
  G.recordMeasure(p, 'snapper', true); assert.equal(G.tierOf(p, 'snapper'), 'mastered');
});

test('a wrong key is named wrongly, then flagged when a second catch disagrees or the mastery check fails', () => {
  const p = fresh();
  G.recordCatch(p, 'tailor', { length: 40 });
  assert.equal(G.recordKey(p, 'tailor', 'seamullet').correct, false);
  assert.equal(G.tierOf(p, 'tailor'), 'caught'); assert.equal(G.keyedAs(p, 'tailor'), 'Sea mullet');
  assert.equal(G.needsRekey(p, 'tailor'), null, 'no flag after one wrong key');
  G.recordKey(p, 'tailor', 'bonito'); // a second catch keyed differently
  assert.match(G.needsRekey(p, 'tailor'), /do not agree/);
  // Re-keying correctly from the guide fixes it for good.
  G.recordKey(p, 'tailor', 'tailor', 'guide');
  assert.equal(G.tierOf(p, 'tailor'), 'identified'); assert.equal(G.needsRekey(p, 'tailor'), null);
  // Mastery check failing: consistently wrong key + accurate measure + correct decision.
  G.recordCatch(p, 'luderick', { length: 30 }); G.recordKey(p, 'luderick', 'rockblackfish');
  G.recordMeasure(p, 'luderick', true); G.recordDecision(p, 'luderick', true);
  assert.match(G.needsRekey(p, 'luderick'), /Mastery check failed/);
  assert.equal(G.tierOf(p, 'luderick'), 'caught');
});

test('protected species are mastered only by a correct release', () => {
  const p = fresh();
  G.recordCatch(p, 'bluegroper', { length: 60 }); G.recordKey(p, 'bluegroper', 'bluegroper'); G.recordMeasure(p, 'bluegroper', true);
  const keep = judge('bluegroper', 60, 0), correctKeep = keep.legal; // keeping is never correct
  G.recordDecision(p, 'bluegroper', correctKeep);
  assert.equal(G.tierOf(p, 'bluegroper'), 'identified');
  G.recordDecision(p, 'bluegroper', true); // released
  assert.equal(G.tierOf(p, 'bluegroper'), 'mastered');
});

test('Mastery: a legal keep or a correct release of an illegal fish counts; releasing a legal fish is neutral', () => {
  assert.equal(G.masteryDecision(true, true), true);    // legal keep
  assert.equal(G.masteryDecision(true, false), false);  // illegal keep: wrong
  assert.equal(G.masteryDecision(false, false), true);  // released an illegal fish: correct release
  assert.equal(G.masteryDecision(false, true), false);  // released a legal fish: allowed, neutral
  const p = fresh();
  G.recordCatch(p, 'tailor', { length: 40 }); G.recordKey(p, 'tailor', 'tailor'); G.recordMeasure(p, 'tailor', true);
  for (let i = 0; i < 5; i++) G.recordDecision(p, 'tailor', true, G.masteryDecision(false, true)); // release-everything loophole
  assert.equal(G.tierOf(p, 'tailor'), 'identified', 'releasing legal fish never masters');
  assert.equal(p.guide.e.tailor.dec.neutral, 5); assert.equal(p.guide.e.tailor.dec.ok, 0);
  G.recordDecision(p, 'tailor', true, G.masteryDecision(true, true));
  assert.equal(G.tierOf(p, 'tailor'), 'mastered');
  // Correct release of an undersize fish masters too.
  const q = fresh(), und = judge('tailor', 10, 0); assert.equal(und.legal, false);
  G.recordCatch(q, 'tailor', { length: 10 }); G.recordKey(q, 'tailor', 'tailor'); G.recordMeasure(q, 'tailor', true);
  G.recordDecision(q, 'tailor', true, G.masteryDecision(false, und.legal));
  assert.equal(G.tierOf(q, 'tailor'), 'mastered');
  // An illegal keep never counts.
  const r = fresh(); G.recordCatch(r, 'tailor', {}); G.recordKey(r, 'tailor', 'tailor'); G.recordMeasure(r, 'tailor', true);
  G.recordDecision(r, 'tailor', false, G.masteryDecision(true, false));
  assert.equal(G.tierOf(r, 'tailor'), 'identified'); assert.equal(r.guide.e.tailor.dec.bad, 1);
  assert.match(G.MASTERY_HINT, /legal keep, or a correct release/);
});

test('completion %, region counters, Bay Health and the Steward rating', () => {
  const p = fresh();
  assert.equal(G.completion(p), 0);
  const lake = G.regionCounts(p).find(r => r.key === 'lake'); assert.equal(lake.label, 'Lake Illawarra'); assert.ok(lake.total >= 10 && lake.done === 0);
  G.recordCatch(p, 'tailor', {}); G.recordKey(p, 'tailor', 'tailor');
  assert.equal(G.regionCounts(p).find(r => r.key === 'lake').done, 1);
  assert.ok(G.completion(p) > 0 && G.completion(p) < 10);
  for (const s of SPECIES) { G.recordCatch(p, s.id, {}); G.recordKey(p, s.id, s.id); G.recordMeasure(p, s.id, true); G.recordDecision(p, s.id, true); }
  assert.equal(G.completion(p), 100);
  // Bay Health: the mean stock over species and spots; releasing nudges it up, illegal keeps pull it down.
  const q = fresh(), h0 = G.bayHealth(q);
  assert.ok(h0 > 55 && h0 < 80);
  adjustStock(q, 'flats', 'tailor', -10); assert.ok(G.bayHealth(q) < h0);
  adjustStock(q, 'flats', 'tailor', 30); assert.ok(G.bayHealth(q) > h0);
  // Steward: a new player sits near 3 stars; good practice raises it, illegal keeps and fines lower it, litter helps.
  const r0 = G.stewardRating(fresh()).value; assert.ok(r0 > 2.8 && r0 < 3.8, String(r0));
  const good = fresh(); good.catches = Array.from({ length: 10 }, () => ({ correct: true, kept: false, wet: true, air: 5 })); assert.ok(G.stewardRating(good).value > r0 + 0.4);
  const bad = fresh(); bad.catches = Array.from({ length: 10 }, () => ({ correct: false, kept: true })); bad.steward.fines = 3; assert.ok(G.stewardRating(bad).value < r0 - 0.6);
  const litter = fresh(); litter.steward.litter = 10; assert.ok(G.stewardRating(litter).value > r0);
  const v = G.stewardRating(bad).value; assert.ok(v >= 1 && v <= 5);
  assert.equal(G.starsText(3.4), '★★★☆☆');
});

test('logbook CSV, the angler name first: header, one row per fish, quotes escaped', () => {
  const p = fresh();
  p.catches = [{ time: Date.UTC(2026, 10, 1), spot: 'jetty', tide: 'rising', daytime: 'dawn', id: 'tailor', label: 'Tailor', length: 31, measured: 30, accurate: true, kept: true, legal: true, rig: 'float', bait: 'prawn' },
    { time: Date.UTC(2026, 10, 1), spot: 'rock', id: 'x', label: 'Unknown fish #2 "big"', length: 20, kept: false, correct: true }];
  const lines = logbookCSV(p, k => k.toUpperCase()).split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^"angler","date","spot","tide"/);
  assert.match(lines[1], /^"Angler","2026-11-01","JETTY","rising","dawn","Tailor","31","30","yes","kept","yes"/);
  assert.match(lines[2], /Unknown fish #2 ""big""/);
  p.angler = { name: 'Sam "Tide" Lee' };
  assert.match(logbookCSV(p).split('\n')[1], /^"Sam ""Tide"" Lee","2026-11-01"/);
});
