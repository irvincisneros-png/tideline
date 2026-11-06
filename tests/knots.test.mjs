// The knot mini-game: the pull-test table, the content (every still exists, sources and the worksheet are credited), quick re-tie rules, best-by-rank, the re-tie rate limit, ?knots= precedence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { KNOTS, KNOT_ORDER, stepsFor } from '../src/content/knots.js';
import { knotResult, resultReason, RESULT_WORDS, recordKnot, quickAllowed, canPromptRetie, markRetie, RETIE_GAP_MS, SPARE_TOAST, knotsMode, chooseMode } from '../src/fishing/knots.js';
import { knotRank, progressOf } from '../src/npc/requests.js';
import { migrateProgress } from '../src/core/save.js';

const INDEX = JSON.parse(readFileSync(new URL('../assets/knots/index.json', import.meta.url), 'utf8')).knots;
const byId = Object.fromEntries(INDEX.map(k => [k.id, k]));
const fresh = () => migrateProgress({});

test('the four knots, in the owner\'s order', () => {
  assert.deepEqual(KNOT_ORDER, ['uni', 'blood', 'palomar', 'surgeon']);
  assert.equal(KNOTS.uni.wraps, 6); assert.equal(KNOTS.blood.wraps, 5);
  assert.equal(KNOTS.palomar.wraps, undefined); assert.equal(KNOTS.surgeon.wraps, undefined);
  assert.deepEqual(RESULT_WORDS, { hold: 'Hold', slip: 'Slip', break: 'Break' });
});

test('knotResult: wraps and wet, every knot', () => {
  for (const [knot, need] of [['uni', 6], ['blood', 5]]) {
    assert.equal(knotResult({ knot, wraps: need, wet: true }), 'hold', `${knot} right wraps, wet`);
    assert.equal(knotResult({ knot, wraps: need + 1, wet: true }), 'hold', `${knot} extra wraps are fine`);
    assert.equal(knotResult({ knot, wraps: need, wet: false }), 'slip', `${knot} dry`);
    for (let w = Math.ceil(need / 2); w < need; w++) assert.equal(knotResult({ knot, wraps: w, wet: true }), 'slip', `${knot} ${w} wraps`);
    for (let w = 0; w < need / 2; w++) { assert.equal(knotResult({ knot, wraps: w, wet: true }), 'break', `${knot} ${w} wraps`); assert.equal(knotResult({ knot, wraps: w, wet: false }), 'break', `${knot} ${w} wraps dry`); }
    assert.equal(knotResult({ knot, wet: true }), 'break', `${knot} no wraps counted`);
  }
  for (const knot of ['palomar', 'surgeon']) {
    assert.equal(knotResult({ knot, wet: true }), 'hold');
    assert.equal(knotResult({ knot, wet: false }), 'slip');
    assert.equal(knotResult({ knot, wraps: 0, wet: true }), 'hold', 'wraps do not apply');
  }
  assert.equal(knotResult({ knot: 'uni', wraps: 3, wet: true }), 'slip', 'exactly half is a slip, under half a break');
  assert.equal(knotResult({ knot: 'uni', wraps: 2, wet: true }), 'break');
});

test('resultReason always says why, and a hold says nothing is wrong', () => {
  assert.match(resultReason({ knot: 'uni', wraps: 6, wet: true }), /holds/);
  assert.match(resultReason({ knot: 'uni', wraps: 6, wet: false }), /not wetted/);
  assert.match(resultReason({ knot: 'uni', wraps: 2, wet: true }), /2 of 6 wraps/);
  assert.match(resultReason({ knot: 'palomar', wet: false }), /not wetted/);
});

test('content: every step picture exists on disk and is in index.json; stages match', () => {
  for (const id of KNOT_ORDER) {
    const k = KNOTS[id], idx = byId[id], files = new Set(idx.stages.map(s => s.img.replace(/\.webp$/, '')));
    assert.ok(idx, `${id} in index.json`);
    const used = new Set();
    for (const s of k.steps) {
      for (const n of [s.img, ...s.imgs]) {
        assert.ok(files.has(n), `${id}: ${n} is in index.json`);
        assert.ok(existsSync(new URL(`../assets/knots/${n}.webp`, import.meta.url)), `${n}.webp on disk`);
        used.add(n);
      }
      assert.ok(['drag', 'taps', 'wet', 'hold'].includes(s.gesture), `${id} gesture`);
      assert.ok(s.say && s.say.length > 10, `${id} step text`);
      if (s.gesture === 'drag') for (const pt of [s.from, s.to]) assert.ok(pt.length === 2 && pt.every(v => v >= 0 && v <= 1), `${id} drag point in 0..1`);
      if (s.gesture === 'taps') { assert.ok(s.n >= 1); assert.equal(s.imgs.length, s.wrap ? s.n : 1, `${id}: a wrap step has a picture per wrap`); }
    }
    assert.ok(existsSync(new URL(`../assets/knots/${k.final}.webp`, import.meta.url)));
    // every stage still is used somewhere, so the steps walk the whole picture series
    for (const f of files) assert.ok(used.has(f), `${id}: ${f} is never shown`);
    // the wraps in the data agree with the picture series
    const wrapSteps = k.steps.filter(s => s.wrap);
    assert.equal(wrapSteps.length, k.wraps ? (id === 'blood' ? 2 : 1) : 0);
    for (const w of wrapSteps) assert.equal(w.n, k.wraps);
  }
});

test('content: each knot has a name, job, quiz line, source, overUnder and worksheet, matching index.json', () => {
  for (const id of KNOT_ORDER) {
    const k = KNOTS[id], idx = byId[id];
    assert.equal(k.name, id === 'surgeon' ? 'Surgeon\'s loop' : idx.name);
    for (const f of ['job', 'where', 'quiz']) assert.ok(k[f] && k[f].length > 8, `${id}.${f}`);
    assert.equal(k.source, idx.source, `${id} source`);
    assert.deepEqual(k.overUnder, idx.overUnder, `${id} overUnder`);
    assert.equal(k.worksheet, '2.1.6');
  }
  const quizzes = KNOT_ORDER.map(id => KNOTS[id].quiz); assert.equal(new Set(quizzes).size, 4);
  assert.match(KNOTS.blood.quiz, /joins? two lines/i);
  assert.match(KNOTS.blood.job, /joins/i);
});

test('quick steps: one gesture plus the wrap taps; never empty', () => {
  for (const id of KNOT_ORDER) {
    const q = stepsFor(id, 'quick'), full = stepsFor(id, 'full');
    assert.ok(q.length >= 1 && q.length < full.length, `${id} quick is shorter`);
    assert.equal(q.filter(s => s.gesture === 'drag' || s.gesture === 'hold').length, { uni: 1, blood: 1, palomar: 2, surgeon: 2 }[id], `${id} gestures`);
    for (const w of full.filter(s => s.wrap)) assert.ok(q.includes(w), `${id} keeps the wrap taps`);
  }
  assert.equal(stepsFor('uni', 'full').length, 6);
});

test('quickAllowed needs a prior Hold; recordKnot keeps the best by rank and counts practices', () => {
  const p = fresh();
  assert.equal(quickAllowed(p, 'uni'), false);
  recordKnot(p, 'uni', 'break'); assert.deepEqual(p.skills.knots.uni, { best: 'break', n: 1 });
  recordKnot(p, 'uni', 'slip'); assert.equal(p.skills.knots.uni.best, 'slip');
  assert.equal(quickAllowed(p, 'uni'), false, 'a slip is not a hold');
  recordKnot(p, 'uni', 'hold'); assert.deepEqual(p.skills.knots.uni, { best: 'hold', n: 3 });
  recordKnot(p, 'uni', 'break'); recordKnot(p, 'uni', 'slip');
  assert.deepEqual(p.skills.knots.uni, { best: 'hold', n: 5 }, 'a later worse result never lowers the best');
  assert.equal(quickAllowed(p, 'uni'), true); assert.equal(quickAllowed(p, 'blood'), false, 'per knot');
  recordKnot(p, 'palomar', 'hold', { count: false }); assert.deepEqual(p.skills.knots.palomar, { best: 'hold', n: 0 }, 'knots=off records a Hold without a practice');
  assert.deepEqual(recordKnot({}, 'uni', 'slip'), { best: 'slip', n: 1 }, 'works on an empty progress object');
});

test('recordKnot writes what the missions and the quest log read', () => {
  const p = fresh();
  const need = { type: 'knot', id: 'uni', result: 'hold' };
  assert.equal(progressOf(need, p).done, false);
  recordKnot(p, 'uni', 'slip'); assert.equal(progressOf(need, p).done, false);
  recordKnot(p, 'uni', 'hold'); assert.equal(progressOf(need, p).done, true);
  for (const r of Object.keys(RESULT_WORDS)) assert.ok(knotRank(r) >= 0, `${r} is a rank the requests code knows`);
  assert.ok(knotRank('hold') > knotRank('slip') && knotRank('slip') > knotRank('break'));
});

test('canPromptRetie: one prompt per 3 minutes', () => {
  const p = fresh(), t0 = 1_000_000;
  assert.equal(canPromptRetie(p, t0), true, 'the first is allowed');
  markRetie(p, t0);
  assert.equal(canPromptRetie(p, t0 + 1000), false);
  assert.equal(canPromptRetie(p, t0 + RETIE_GAP_MS - 1), false);
  assert.equal(canPromptRetie(p, t0 + RETIE_GAP_MS), true);
  assert.equal(canPromptRetie(p, t0 - 5000), true, 'a clock that went backwards does not lock the player out');
  assert.equal(canPromptRetie({}, t0), true);
  assert.match(SPARE_TOAST, /spare/);
  assert.equal(RETIE_GAP_MS, 180000);
});

test('knotsMode: ?knots= first, then settings.knots, default full', () => {
  const P = s => new URLSearchParams(s);
  assert.equal(knotsMode({}, P('')), 'full');
  assert.equal(knotsMode(undefined, undefined), 'full');
  assert.equal(knotsMode({ knots: 'quick' }, P('')), 'quick');
  assert.equal(knotsMode({ knots: 'quick' }, P('knots=off')), 'off');
  assert.equal(knotsMode({ knots: 'off' }, P('knots=full')), 'full');
  assert.equal(knotsMode({ knots: 'quick' }, P('knots=banana')), 'quick', 'an unknown URL value falls through to the setting');
  assert.equal(knotsMode({ knots: 'banana' }, P('')), 'full');
  assert.equal(knotsMode({}, { knots: 'off' }), 'off', 'a plain object works too');
});

test('chooseMode: first time full, a held knot re-ties quick, board and missions stay full, the teacher setting wins', () => {
  const p = fresh();
  assert.equal(chooseMode({ reason: 'retie', p, id: 'uni' }), 'full');
  recordKnot(p, 'uni', 'hold');
  assert.equal(chooseMode({ reason: 'retie', p, id: 'uni' }), 'quick');
  assert.equal(chooseMode({ reason: 'board', p, id: 'uni' }), 'full');
  assert.equal(chooseMode({ reason: 'mission', p, id: 'uni' }), 'full');
  assert.equal(chooseMode({ setting: 'quick', reason: 'board', p, id: 'blood' }), 'quick');
  assert.equal(chooseMode({ setting: 'off', reason: 'retie', p, id: 'uni' }), 'off');
});
