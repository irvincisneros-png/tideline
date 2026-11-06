// Day 1 missions: the spine's data, the pure logic (npc/missions.js), the new need checkers, the save fields, the next-up nudge, the personal best test
// and the Guide counter. The review's "Missions" and "Save" risk rows (docs/specs/2026-11-06-purpose-onboarding-review.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, MISSION_BY_ID, FEATURES, GIVERS } from '../src/content/missions.js';
import { MISSION_RADIO, WILSON_OK } from '../src/content/teachers.js';
import { ITEMS, CARDS, START_RIGS } from '../src/content/items.js';
import { NPCS } from '../src/content/npcs.js';
import { PALETTES, STYLES } from '../src/core/anglerData.js';
import { progressOf, tradeById, allTrades, accept, complete, questLog, ensureNpc } from '../src/npc/requests.js';
import * as M from '../src/npc/missions.js';
import { grant, hasItem, ownedItems } from '../src/npc/inventory.js';
import { payMission } from '../src/economy/coins.js';
import { migrateProgress } from '../src/core/save.js';
import * as G from '../src/fishing/guide.js';
import { SPECIES } from '../src/fishing/species.js';
import { pickCatch, SPOT_INFO } from '../src/fishing/catches.js';
import { RIGS } from '../src/fishing/gear.js';

const fresh = () => migrateProgress({});
const row = o => ({ eco: 'seagrass', id: 'yellowfinbream', length: 30, kept: true, time: 1, spot: 'jetty', rig: 'runningsinker', ...o });
const acc = n => Array.from({ length: n }, () => row({ accurate: true, measured: 30 }));
const withFeatures = (on, fn) => { const was = { ...FEATURES }; Object.assign(FEATURES, on); try { return fn(); } finally { Object.assign(FEATURES, was); } };
const master = (p, id) => { const e = (p.guide.e[id] ??= {}); e.seen ??= { t: 1 }; e.caught ??= { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; e.meas = { n: 1, acc: 1 }; e.dec = { ok: 1, bad: 0 }; e.mastered = 1; };
const identify = (p, id) => { const e = (p.guide.e[id] ??= {}); e.seen ??= { t: 1 }; e.caught ??= { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; };

// ---------------------------------------------------------------- the data
test('missions: ids are unique, chapters ascend, every step names a real trade or a need progressOf can check, `next` resolves', () => {
  const ids = new Set();
  let last = 0;
  for (const m of MISSIONS) {
    assert.ok(!ids.has(m.id), `duplicate ${m.id}`); ids.add(m.id);
    assert.ok(m.chapter > last, `${m.id} chapter order`); last = m.chapter;
    assert.ok(m.title.length > 2 && m.steps.length >= 1, m.id);
    assert.ok(m.giver in GIVERS || NPCS[m.giver], `${m.id} giver ${m.giver}`);
    assert.ok(m.next === null || MISSION_BY_ID[m.next], `${m.id} next ${m.next}`);
    assert.ok(Array.isArray(m.radio) && m.radio.length >= 1, `${m.id} has radio lines`);
    for (const s of m.steps) {
      assert.ok(!!s.trade !== !!s.need, `${m.id}: a step is a trade or a need`);
      if (s.trade) assert.ok(tradeById(s.trade), `${m.id}: trade ${s.trade} exists`);
      else assert.doesNotThrow(() => progressOf(s.need, fresh()), `${m.id}: need ${s.need.type}`);
      if (s.requires) assert.ok(['knots', 'snags'].includes(s.requires), `${m.id} requires ${s.requires}`);
    }
  }
  assert.equal(MISSIONS.length, 10, 'missions 1 to 5 and the five coast chapters');
  assert.deepEqual(MISSIONS.slice(5).flatMap(m => m.steps.map(s => s.trade)), ['sione-rock', 'fatima-litter3', 'nell-squid', 'priya-measure', 'priya-tag']);
  assert.deepEqual(Object.keys(FEATURES).sort(), ['knots', 'snags']);
  assert.equal(FEATURES.knots, true, 'Day 4: the knot game is built, so Mission 2 is on'); assert.equal(FEATURES.snags, true, 'Day 3: snags are built, so Mission 4 is on');
});

test('missions: every reward is one cosmetic hat in ITEMS, not a trade reward, not functional, and each is used once', () => {
  const tradeRewards = new Set(allTrades().map(x => x.trade.reward)), used = new Set();
  for (const m of MISSIONS) {
    const it = ITEMS[m.reward];
    assert.ok(it, `${m.id} reward ${m.reward} resolves`);
    assert.equal(it.kind, 'hat'); assert.equal(it.mission, true); assert.ok(!it.unlocks, 'no functional unlock');
    assert.ok(!tradeRewards.has(m.reward), `${m.reward} is not also a trade reward (no double pay)`);
    assert.ok(!used.has(m.reward), `${m.reward} used twice`); used.add(m.reward);
    assert.ok(STYLES.hatStyle.some(s => s.id === it.hat.hatStyle && s.id !== 'none') && PALETTES.hat.some(c => c.v === it.hat.hat), `${m.reward} is a real hat look`);
    assert.ok(!CARDS[m.reward]);
  }
  // Every mission hat in ITEMS belongs to a mission.
  for (const [id, it] of Object.entries(ITEMS)) if (it.mission) assert.ok(used.has(id), `${id} belongs to a mission`);
});

test('missions: Ranger Jo is never on the spine (not the giver, no step trade of hers)', () => {
  const jo = new Set(NPCS.jo.trades.map(t => t.id));
  assert.ok(jo.size > 0);
  for (const m of MISSIONS) {
    assert.notEqual(m.giver, 'jo');
    for (const s of m.steps) assert.ok(!s.trade || !jo.has(s.trade), `${m.id} uses Jo's ${s.trade}`);
    assert.ok(!/\bjo\b|ranger/i.test(JSON.stringify([m.title, m.radio])), `${m.id} does not mention her`);
  }
  assert.ok(!/\bjo\b|ranger/i.test(JSON.stringify(MISSION_RADIO)));
});

test('missions: no step needs an item the player cannot reach, in the chain order', () => {
  const unlockerOf = rig => Object.entries(ITEMS).find(([, it]) => it.unlocks?.rig === rig)?.[0];
  const earned = new Set();   // trade rewards earned by steps so far, walking the chain in order
  for (const m of MISSIONS) for (const s of m.steps) {
    if (s.trade) { earned.add(tradeById(s.trade).trade.reward); continue; }
    if (s.need.type === 'rigCatch') {
      assert.ok(RIGS[s.need.rig], `${m.id}: rig ${s.need.rig} exists`);
      assert.ok(START_RIGS.includes(s.need.rig) || earned.has(unlockerOf(s.need.rig)), `${m.id}: the ${s.need.rig} rig is earned by an earlier step`);
    }
  }
  // Mission 2's float rig comes from tam-bream, the step before it.
  const km = MISSION_BY_ID['know-tackle'].steps;
  assert.ok(km.findIndex(s => s.trade === 'tam-bream') < km.findIndex(s => s.need?.type === 'rigCatch'));
});

test('missions: the words are kind, never about selling a catch, and keep clear of First Nations content', () => {
  const text = JSON.stringify([MISSIONS.map(m => [m.title, m.radio, m.steps.map(s => s.hint)]), MISSION_RADIO, M.HELLO_LINE]);
  assert.ok(!/\bsell|\bsold\b|\bcash\b|\bprice|\bprofit/i.test(text), 'no selling');
  assert.ok(!/aborigin|first nations|indigenous|dharawal|d'harawal|country\b|dreaming|torres/i.test(text), 'no First Nations content');
  for (const m of MISSIONS) for (const l of m.radio) assert.ok((typeof l === 'string' ? l : l.text).length < 230, `${m.id}: lines stay short`);
});

test('missions: steps that need unbuilt mechanics hide their mission until FEATURES say so (Mr Wilson missions 2 and 4)', () => {
  const ids = () => M.chain().map(m => m.id);
  assert.deepEqual(ids(), ['first-lines', 'know-tackle', 'the-rules', 'structure', 'the-guide', 'coast-rock', 'coast-litter', 'coast-squid', 'coast-measure', 'coast-tag']);
  withFeatures({ knots: false }, () => assert.ok(!ids().includes('know-tackle') && ids().includes('structure')));
  withFeatures({ snags: false, knots: false }, () => assert.ok(!ids().includes('structure') && !ids().includes('know-tackle')));
  withFeatures({ knots: true, snags: true }, () => assert.equal(ids().length, 10));
  assert.deepEqual(M.chain(false).map(m => m.id).filter(id => MISSION_BY_ID[id].giver === 'mrwilson'), [], 'no Wilson missions when WILSON_OK is off');
  withFeatures({ knots: true, snags: true }, () => assert.deepEqual(M.chain(false).map(m => m.id), ['first-lines', 'the-rules', 'the-guide', 'coast-rock', 'coast-litter', 'coast-squid', 'coast-measure', 'coast-tag']));
});

test('missions: Mr Wilson goes through WILSON_OK (his lines are dropped when it is off, all of them kept when it is on)', () => {
  assert.equal(typeof WILSON_OK, 'boolean');
  const guide = MISSION_BY_ID['the-guide'];
  const on = M.radioLines(guide, 'Sam', true), off = M.radioLines(guide, 'Sam', false);
  assert.ok(on.some(l => l.who === 'mrwilson') && off.length === on.length - 1 && off.every(l => l.who !== 'mrwilson'));
  assert.ok(on.every(l => !l.text.includes('{name}')) && on[0].text.includes('Sam'));
  assert.ok(M.radioLines(MISSION_BY_ID['know-tackle'], 'Sam', false).length === 0, 'a Wilson-only call is silent when off');
  assert.equal(M.radioLines(MISSION_BY_ID['coast-rock'], 'Sam', false)[0].who, 'sione');
  // Nothing outside the ITEMS ids and the giver field names him in the data the player reads when he is off.
  assert.ok(!/wilson/i.test(JSON.stringify(M.radioLines(guide, 'Sam', false))));
  assert.ok(!/wilson/i.test(JSON.stringify(Object.values(ITEMS).map(i => [i.name, i.blurb, i.ask]))));
});

// ---------------------------------------------------------------- the new need types
test('need rigCatch: a logbook row on that rig', () => {
  const p = fresh(), n = { type: 'rigCatch', rig: 'float', label: 'float rig' };
  assert.deepEqual([progressOf(n, p).done, progressOf(n, p).have], [false, 0]);
  p.catches.push(row({ rig: 'paternoster' })); assert.equal(progressOf(n, p).done, false);
  p.catches.push(row({ rig: 'float' })); assert.equal(progressOf(n, p).done, true);
  assert.match(progressOf(n, p).text, /float rig/);
  assert.match(progressOf({ type: 'rigCatch', rig: 'float' }, p).text, /float/);
});

test('need undersizeRelease: undersize, released, hands not dry, quick; the old `releases` need is unchanged', () => {
  const p = fresh(), n = { type: 'undersizeRelease', n: 2, maxAir: 10 };
  const good = o => row({ kind: 'undersize', kept: false, wet: true, air: 6, ...o });
  p.catches.push(good(), good({ kept: true }), good({ wet: false }), good({ air: 10.1 }), good({ kind: 'ok' }), good({ kind: 'bag' }), good({ air: undefined }));
  assert.equal(progressOf(n, p).have, 1, 'only the one that was undersize, released, wet and quick counts');
  p.catches.push(good({ air: 10, wet: undefined }));
  assert.equal(progressOf(n, p).have, 2); assert.equal(progressOf(n, p).done, true, 'air exactly at the limit counts; wet unknown is not dry');
  assert.match(progressOf(n, p).text, /undersize/);
  // `releases` still accepts dry hands and legal fish (unchanged, so tam-release and jo-care do not move for existing saves).
  const q = fresh(); q.catches.push(row({ kind: 'ok', kept: false, wet: false, air: 3 }), row({ kind: 'undersize', kept: false, wet: false, air: 3 }));
  assert.equal(progressOf({ type: 'releases', n: 2, maxAir: 10 }, q).have, 2);
  assert.equal(progressOf(n, q).have, 0);
});

test('need knot: reads p.skills.knots[id].best (hold beats slip beats break; H/S/B letters work too); a stub until the knot game exists', () => {
  const p = fresh(), n = { type: 'knot', id: 'uni', result: 'hold' };
  assert.equal(progressOf(n, p).done, false);
  p.skills.knots.uni = { best: 'slip' }; assert.equal(progressOf(n, p).done, false);
  p.skills.knots.uni = { best: 'hold' }; assert.equal(progressOf(n, p).done, true);
  p.skills.knots.uni = { best: 'H' }; assert.equal(progressOf(n, p).done, true);
  p.skills.knots.uni = { best: 'B' }; assert.equal(progressOf(n, p).done, false);
  assert.equal(progressOf({ type: 'knot', id: 'uni', result: 'slip' }, p).done, false, 'a break is below slip');
  p.skills.knots.uni = { best: 'S' }; assert.equal(progressOf({ type: 'knot', id: 'uni', result: 'slip' }, p).done, true);
  assert.equal(progressOf({ type: 'knot', id: 'blood', result: 'hold' }, p).done, false, 'a different knot');
  assert.equal(progressOf(n, { catches: [] }).done, false, 'no skills object at all');
  assert.match(progressOf(n, p).text, /uni/);
});

test('need snagFreed: p.skills.snagFreed against n; a stub until snags exist', () => {
  const p = fresh(), n = { type: 'snagFreed', n: 2 };
  assert.deepEqual([progressOf(n, p).have, progressOf(n, p).done], [0, false]);
  p.skills.snagFreed = 1; assert.equal(progressOf(n, p).have, 1);
  p.skills.snagFreed = 3; assert.deepEqual([progressOf(n, p).have, progressOf(n, p).done], [2, true]);
  assert.equal(progressOf(n, { catches: [] }).done, false);
});

// ---------------------------------------------------------------- the logic
test('a new save: the current mission is First lines, step 1 first, and nothing is marked done', () => {
  const p = fresh();
  assert.deepEqual(M.ensureMissions(p), []);
  assert.equal(p.missions.cur, 'first-lines'); assert.deepEqual(p.missions.done, {});
  const pr = M.missionProgress(p, 'first-lines');
  assert.equal(pr.done, false); assert.equal(pr.count, 0); assert.equal(pr.steps.length, 2);
  assert.deepEqual([pr.steps[0].have, pr.steps[0].need, pr.steps[0].kind, pr.steps[1].kind], [0, 2, 'need', 'trade']);
  assert.equal(M.hudLine(p), 'First lines: Log 2 measures within 1 cm (0/2)');
  p.catches.push(...acc(1));
  assert.equal(M.hudLine(p), 'First lines: Log 2 measures within 1 cm (1/2)', 'one accurate measure moves step 1');
  assert.equal(M.missionProgress(p, 'first-lines').steps[0].have, 1);
});

test('steps derive from the logbook and npc.done, never from counters', () => {
  const p = fresh(); p.catches.push(...acc(2));
  assert.equal(M.missionProgress(p, 'first-lines').count, 1);
  assert.equal(M.hudLine(p), 'First lines: Talk to Mitra: Licence and fees quiz');
  accept(p, 'mitra-licence');
  assert.match(M.hudLine(p), /^First lines: Ask Mitra for the quiz/);
  complete(p, 'mitra-licence');
  assert.equal(M.missionProgress(p, 'first-lines').done, true);
  p.catches.length = 0;   // the progress is read, not remembered
  assert.equal(M.missionProgress(p, 'first-lines').count, 1);
  assert.throws(() => M.missionProgress(p, 'nope'));
});

test('advanceMissions: returns the newly finished missions once, grants only the hat, pays no credits, and a trade step never pays twice', () => {
  const p = fresh(); M.ensureMissions(p);
  p.catches.push(...acc(2));
  assert.deepEqual(M.advanceMissions(p), [], 'one step is not enough');
  // The hand-in as npc/talk.js does it: complete, credits, the trade's own reward.
  accept(p, 'mitra-licence');
  const t = tradeById('mitra-licence').trade;
  complete(p, t.id); const paid = payMission(p, t); grant(p, t.reward);
  assert.ok(paid > 0 && p.coins > 0);
  const coins = p.coins, econ = JSON.stringify(p.econ), had = { ...p.inventory.have };
  const done = M.advanceMissions(p);
  assert.deepEqual(done.map(m => m.id), ['first-lines']);
  assert.equal(p.coins, coins, 'the mission pays no credits'); assert.equal(JSON.stringify(p.econ), econ, 'and records no earnings');
  assert.deepEqual(Object.keys(p.inventory.have).sort(), [...Object.keys(had), 'hat-measuring'].sort(), 'it adds only its hat');
  assert.ok(hasItem(p, 'bait-nipper') && hasItem(p, 'hat-measuring'));
  assert.equal(p.missions.cur, 'know-tackle'); assert.ok(p.missions.done['first-lines'] > 0);
  assert.deepEqual(M.advanceMissions(p), [], 'once only'); assert.deepEqual(M.ensureMissions(p), []);
  assert.equal(p.coins, coins); assert.equal(Object.keys(p.inventory.have).length, Object.keys(had).length + 1);
  // The mission's own hat is never the trade's reward, and the trade's reward is unchanged.
  assert.notEqual(MISSION_BY_ID['first-lines'].reward, t.reward);
});

test('advanceMissions: a later mission finished early still counts, in chain order', () => {
  const p = fresh(); M.ensureMissions(p);
  complete(p, 'bev-ident');   // the Guide mission's only step
  const done = M.advanceMissions(p);
  assert.deepEqual(done.map(m => m.id), ['the-guide']);
  assert.equal(p.missions.cur, 'first-lines', 'the pointer stays on the first unfinished');
});

// Old saves, v1 to v4 shapes: they fast-forward silently.
const OLD_SAVES = {
  v1: () => ({ journal: {}, catches: [...acc(3), row({ kind: 'undersize', kept: false, wet: true, air: 5 }), row({ kind: 'undersize', kept: false, wet: true, air: 4 })], stock: {}, steward: { points: 0, litter: 0, checks: 0, clean: 0, fines: 0 } }),
  v2: () => ({ v: 2, journal: {}, catches: acc(3), guide: { nextN: 4, e: { yellowfinbream: { seen: { t: 1 }, caught: { t: 1, n: 1, count: 3 }, ident: true, meas: { n: 3, acc: 3 }, dec: { ok: 1, bad: 0 }, best: 30 } } }, npc: { day: 3, met: {}, accepted: { 'mitra-licence': 1 }, done: { 'mitra-licence': 5 }, quizFail: {}, rot: {} }, inventory: { have: { 'bait-nipper': 5 }, cards: {}, worn: null, lure: null } }),
  v3: () => ({ v: 3, coins: 120, catches: acc(4), npc: { day: 2, met: {}, accepted: {}, done: { 'mitra-licence': 5, 'mitra-flathead': 6, 'bev-ident': 7 }, quizFail: {}, rot: {} }, guide: { nextN: 1, e: {} } }),
  v4: () => ({ v: 4, coins: 40, catches: [], guide: { nextN: 1, e: {} }, angler: { name: 'Sam' }, npc: { day: 1, met: {}, accepted: {}, done: {}, quizFail: {}, rot: {} } }),
};
test('old saves v1 to v4 fast-forward silently: finished missions marked done with their hat, no credits, cur on the first unfinished, idempotent', () => {
  // v1: five logbook rows. Missions need a trade for each, so only a mission with every step in the logbook could finish: none do.
  const p1 = migrateProgress(OLD_SAVES.v1()), c1 = p1.coins;
  assert.deepEqual(M.ensureMissions(p1), []); assert.equal(p1.missions.cur, 'first-lines'); assert.equal(p1.coins, c1);
  // v2: 3 accurate measures + the licence quiz handed in: Mission 1 is done.
  const p2 = migrateProgress(OLD_SAVES.v2()), c2 = p2.coins;
  assert.deepEqual(M.ensureMissions(p2), ['first-lines']);
  assert.equal(p2.missions.cur, 'know-tackle'); assert.ok(hasItem(p2, 'hat-measuring')); assert.equal(p2.coins, c2, 'no credits');
  const snap = JSON.stringify(p2); assert.deepEqual(M.ensureMissions(p2), []); assert.equal(JSON.stringify(p2), snap, 'idempotent');
  // v3: Mission 1 and Mission 5 trades done, plus the flathead quiz trade without its undersize releases: missions 1 and 5 are done, 3 is not.
  const p3 = migrateProgress(OLD_SAVES.v3());
  assert.deepEqual(M.ensureMissions(p3), ['first-lines', 'the-guide']);
  assert.deepEqual(Object.keys(p3.inventory.have).sort(), ['hat-guide', 'hat-measuring']);
  assert.equal(p3.missions.cur, 'know-tackle'); assert.equal(p3.coins, 120);
  // v4 with nothing done.
  const p4 = migrateProgress(OLD_SAVES.v4());
  assert.deepEqual(M.ensureMissions(p4), []); assert.equal(p4.missions.cur, 'first-lines');
  // No reward storm: everything was marked without a hand-in, and nothing is returned for the radio.
  for (const p of [p2, p3]) assert.deepEqual(M.advanceMissions(p), [], 'nothing left to announce');
});

test('an old save with everything done ends with cur null and an empty HUD line, hats owned once each', () => {
  const p = fresh();
  p.catches.push(...acc(3), ...[1, 2].map(() => row({ kind: 'undersize', kept: false, wet: true, air: 3 })));
  for (const { trade } of allTrades()) complete(p, trade.id);
  p.skills.snagFreed = 1;   // Mission 4 (Structure) is on now that snags are built
  p.skills.knots.uni = { best: 'hold', n: 1 }; p.catches.push(row({ rig: 'float' }));   // Mission 2 (Know your tackle) is on now that the knot game is built
  const marked = M.ensureMissions(p);
  assert.equal(marked.length, M.chain().length); assert.equal(p.missions.cur, null);
  assert.equal(M.hudLine(p), ''); assert.equal(M.missionsView(p).allDone, true);
  assert.equal(ownedItems(p, 'hat').length, M.chain().length);
  // Switching a feature on later adds a mission that is not done yet; the older ones stay done.
  // A feature switched off later hides its mission; the older ones stay done and the chain still ends.
  withFeatures({ knots: false }, () => { M.ensureMissions(p); assert.equal(p.missions.cur, null); assert.ok(p.missions.done['first-lines']); });
});

test('a mission that was done keeps its hat even if the inventory lost it (ensureMissions re-grants, once)', () => {
  const p = fresh(); p.missions.done['first-lines'] = 5; p.missions.cur = 'x';
  M.ensureMissions(p); assert.ok(hasItem(p, 'hat-measuring')); assert.equal(p.missions.cur, 'know-tackle');
});

// ---------------------------------------------------------------- pin, HUD, quest log
test('pin: only an accepted, unfinished trade; the HUD line follows it; tapping again unpins; a finished pin falls back to the mission', () => {
  const p = fresh(); M.ensureMissions(p);
  assert.equal(M.setPin(p, 'tam-bream'), null, 'not accepted yet');
  accept(p, 'tam-bream');
  assert.equal(M.setPin(p, 'tam-bream'), 'tam-bream'); assert.equal(p.missions.pin, 'tam-bream');
  const h = M.hudInfo(p); assert.equal(h.pinned, true);
  assert.match(h.text, /yellowfin bream/i); assert.ok(!h.text.startsWith('First lines'));
  assert.equal(M.setPin(p, 'nonsense'), 'tam-bream', 'an unknown trade changes nothing');
  assert.equal(M.setPin(p, 'tam-bream'), null); assert.equal(p.missions.pin, null);
  assert.equal(M.hudInfo(p).pinned, false);
  M.setPin(p, 'tam-bream'); complete(p, 'tam-bream');
  assert.equal(M.hudInfo(p).pinned, false, 'a handed-in trade is no longer shown'); assert.match(M.hudLine(p), /^First lines/);
  assert.equal(M.missionsView(p).pin, null);
  // A quiz can be pinned too, and the quest log's own list is unchanged by the pin.
  accept(p, 'mitra-licence'); M.setPin(p, 'mitra-licence');
  assert.match(M.hudLine(p), /Mitra/);
  assert.equal(questLog(p).ready.some(e => e.trade.id === 'mitra-licence'), true);
});

test('missionsView: the current mission with its steps, the chain so far, and the pin, for the quest log', () => {
  const p = fresh(); M.ensureMissions(p); p.catches.push(...acc(2));
  const v = M.missionsView(p);
  assert.equal(v.current.mission.id, 'first-lines'); assert.deepEqual(v.current.steps.map(s => s.done), [true, false]);
  assert.deepEqual(v.chain.map(c => c.id), M.chain().map(m => m.id));
  assert.deepEqual(v.chain.filter(c => c.current).map(c => c.id), ['first-lines']);
  assert.equal(v.allDone, false);
});

test('hudLine is plain text, short enough for the HUD (it is cut with an ellipsis, never wrapped)', () => {
  const p = fresh(); M.ensureMissions(p);
  for (const m of M.chain()) for (const s of m.steps) { const st = M.stepState(p, s); assert.equal(typeof st.text, 'string'); assert.ok(st.text.length < 160, st.text); assert.ok(!/[<>]/.test(st.text)); }
});

test('hello: only a save that played before missions, only at the lake, only once', () => {
  const old = migrateProgress(OLD_SAVES.v2());
  assert.equal(old.missions.legacy, true);
  assert.equal(M.helloDue(old, 'rocky'), false); assert.equal(M.helloDue(old, 'seagrass'), true);
  M.markHello(old); assert.equal(M.helloDue(old, 'seagrass'), false); assert.equal(old.tips.missionsHello, true);
  assert.equal(M.helloDue(fresh(), 'seagrass'), false, 'a new save never gets it');
  assert.ok(M.HELLO_LINE.includes('{name}'));
});

// ---------------------------------------------------------------- the save fields
test('save: a new save has missions, skills and intro; old saves with catches or Guide entries get intro done, others meet', () => {
  const p = fresh();
  assert.deepEqual(p.missions, { cur: null, done: {}, pin: null }); assert.deepEqual(p.skills, { knots: {}, lostLine: {} }); assert.deepEqual(p.intro, { step: 'meet' });
  assert.deepEqual(migrateProgress(OLD_SAVES.v1()).intro, { step: 'done' });
  assert.deepEqual(migrateProgress(OLD_SAVES.v2()).intro, { step: 'done' });
  assert.deepEqual(migrateProgress({ v: 4, guide: { nextN: 2, e: { tailor: { seen: { t: 1 } } } } }).intro, { step: 'done' }, 'a Guide entry counts');
  assert.deepEqual(migrateProgress(OLD_SAVES.v4()).intro, { step: 'meet' }, 'an angler alone is not progress');
  assert.equal(migrateProgress(OLD_SAVES.v4()).v, 4, 'no version bump');
  assert.equal(migrateProgress(OLD_SAVES.v3()).missions.legacy, true);
  assert.equal(fresh().missions.legacy, undefined);
});

test('save: missions, skills and intro are repaired one field at a time, the good fields survive', () => {
  const bad = migrateProgress({ v: 4, catches: acc(1), missions: { cur: 7, done: { a: 1, b: 'x', c: null }, pin: ['x'] }, skills: { knots: 'no', lostLine: { l: 1 }, snagFreed: -2 }, intro: { step: 5, seen: true } });
  assert.deepEqual(bad.missions, { cur: null, done: { a: 1 }, pin: null });
  assert.deepEqual(bad.skills, { knots: {}, lostLine: { l: 1 } }); assert.deepEqual(bad.intro, { step: 'done' }, 'a bad step falls back to the derived one');
  for (const w of ['missions.done.b', 'missions.done.c', 'skills.knots', 'skills.snagFreed', 'intro.step']) assert.ok(bad.repaired.includes(w), `repaired lists ${w}`);
  assert.ok(!bad.repaired.includes('missions.done.a'));
  // A whole field of the wrong type.
  const wrong = migrateProgress({ missions: 'x', skills: 5, intro: [] });
  assert.deepEqual(wrong.missions, { cur: null, done: {}, pin: null }); assert.deepEqual(wrong.skills, { knots: {}, lostLine: {} }); assert.deepEqual(wrong.intro, { step: 'meet' });
  assert.ok(['missions', 'skills', 'intro'].every(f => wrong.repaired.includes(f)));
  // Good values are kept, including the knot game's own fields.
  const good = migrateProgress({ missions: { cur: 'the-rules', done: { 'first-lines': 9 }, pin: 'tam-bream' }, skills: { knots: { uni: { best: 'hold', tied: 3 } }, lostLine: {}, snagFreed: 2 }, intro: { step: 'tutorial', fish: 1 } });
  assert.deepEqual(good.missions, { cur: 'the-rules', done: { 'first-lines': 9 }, pin: 'tam-bream' });
  assert.deepEqual(good.skills, { knots: { uni: { best: 'hold', tied: 3 } }, lostLine: {}, snagFreed: 2 }); assert.deepEqual(good.intro, { step: 'tutorial', fish: 1 });
  assert.equal(good.repaired, undefined);
  // One malformed mission field does not cost the rest of the save.
  assert.equal(migrateProgress({ v: 4, coins: 33, missions: 3 }).coins, 33);
  // migrateProgress then ensureMissions never throws on a repaired save.
  assert.doesNotThrow(() => M.ensureMissions(bad));
});

// ---------------------------------------------------------------- Guide counter, next-up nudge, personal best
test('Guide counter: identified or better over SPECIES.length (never a typed number)', () => {
  const p = fresh();
  assert.deepEqual(G.guideCount(p), { n: 0, total: SPECIES.length }); assert.equal(G.guideCountText(p), `Guide 0/${SPECIES.length}`);
  G.recordCatch(p, 'tailor', { length: 30 }); assert.equal(G.guideCount(p).n, 0, 'caught is not identified');
  identify(p, 'tailor'); master(p, 'snapper'); assert.equal(G.guideCountText(p), `Guide 2/${SPECIES.length}`);
});

test('nextUp: the closest Mastery for a fish you have caught, with what is done and what is missing', () => {
  const p = fresh();
  assert.equal(G.nextUp(p), null, 'nothing caught');
  // Dusky flathead keyed and measured, no legal keep yet.
  identify(p, 'duskyflathead'); p.guide.e.duskyflathead.meas = { n: 1, acc: 1 };
  let nu = G.nextUp(p);
  assert.equal(nu.id, 'duskyflathead'); assert.equal(nu.text, 'Dusky flathead: keyed and measured. Needs a legal keep.');
  assert.deepEqual(nu.missing, ['a legal keep']);
  // A fish with two things missing loses to it; a caught fish with all three missing is named "Unknown fish #n".
  G.recordCatch(p, 'tailor', { length: 30 });
  assert.equal(G.nextUp(p).id, 'duskyflathead');
  p.guide.e.duskyflathead.dec = { ok: 1, bad: 0 }; G.checkMastery(p, 'duskyflathead');
  nu = G.nextUp(p); assert.equal(nu.id, 'tailor'); assert.match(nu.text, /^Unknown fish #\d+: caught\. Needs to be keyed, an accurate measure and a legal keep\.$/);
  assert.ok(!nu.text.includes('Tailor'), 'does not give the name away');
  G.recordKey(p, 'tailor', 'tailor'); assert.match(G.nextUp(p).text, /^Tailor: keyed\. Needs an accurate measure and a legal keep\.$/);
  // Mastered species are skipped; when all are, null.
  master(p, 'tailor'); assert.equal(G.nextUp(p), null);
});

test('nextUp: a helped key asks for one unaided key; a protected fish asks for a correct release; ties go to the latest catch', () => {
  const p = fresh();
  identify(p, 'yellowfinbream'); const e = p.guide.e.yellowfinbream; e.assisted = true; e.meas = { n: 1, acc: 1 }; e.dec = { ok: 1, bad: 0 };
  assert.equal(G.nextUp(p).text, 'Yellowfin bream: measured and decided. Needs one unaided key.');
  const prot = SPECIES.find(s => s.rules.protected);
  if (prot) { const q = fresh(); identify(q, prot.id); q.guide.e[prot.id].meas = { n: 1, acc: 1 }; assert.match(G.nextUp(q).text, /Needs a correct release\.$/); }
  const t = fresh(); identify(t, 'tailor'); identify(t, 'snapper'); t.guide.e.tailor.caught.t = 100; t.guide.e.snapper.caught.t = 200;
  assert.equal(G.nextUp(t).id, 'snapper', 'same number missing: the most recent catch');
});

test('personal best: only a fish longer than an existing record, asked before recordCatch overwrites it', () => {
  const p = fresh();
  assert.equal(G.isPersonalBest(p, 'tailor', 40), false, 'the first catch has no record to beat');
  G.recordCatch(p, 'tailor', { length: 30 });
  assert.equal(G.isPersonalBest(p, 'tailor', 30), false, 'equal is not longer'); assert.equal(G.isPersonalBest(p, 'tailor', 29), false);
  assert.equal(G.isPersonalBest(p, 'tailor', 31), true);
  const before = G.isPersonalBest(p, 'tailor', 35); G.recordCatch(p, 'tailor', { length: 35 });
  assert.equal(before, true); assert.equal(G.isPersonalBest(p, 'tailor', 35), false, 'after recordCatch the record is the fish itself: that is why the flow asks first');
  assert.equal(G.isPersonalBest(p, 'snapper', 99), false, 'per species');
});

// ---------------------------------------------------------------- content sanity that touches the rules
test('the lake gives undersize fish often enough for "The rules" (every lake spot, the starter rig, seeded draws)', () => {
  let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const lake = Object.keys(SPOT_INFO).filter(k => /^Lake/.test(SPOT_INFO[k].label)), out = {};
  assert.ok(lake.length >= 4);
  for (const spot of lake) {
    let under = 0; const N = 6000;
    for (let i = 0; i < N; i++) { const c = pickCatch(spot, { rig: 'runningsinker', bait: 'prawn' }, rnd); const r = SPECIES.find(x => x.id === c.id).rules; if (r.min && c.length < r.min) under++; }
    out[spot] = +(under / N).toFixed(3);
    assert.ok(under / N > 0.04, `${spot}: ${(under / N * 100).toFixed(1)}% of bites are undersize`);
  }
  console.log('undersize share of lake bites (starter rig, prawn):', JSON.stringify(out));
});
