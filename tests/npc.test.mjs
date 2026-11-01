// The coast's people: schedules, tip/gossip rotation, "show me" request checkers, quiz trades, the inventory and content integrity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NPCS, NPC_ORDER, REACT_FALLBACK } from '../src/content/npcs.js';
import { ITEMS, CARDS, CARD_ORDER, START_RIGS, START_BAITS } from '../src/content/items.js';
import { QUIZ, QUIZ_BY_N } from '../src/content/quiz.js';
import { TIMES, slotAt, resolveSlot, presentAt, pathPosition, isAway, placesOf, WATER_HEADING } from '../src/npc/schedule.js';
import { PLACES } from '../src/npc/places.js';
import { pickLine, eligible } from '../src/npc/lines.js';
import { progressOf, tradeStatus, questLog, accept, complete, failQuiz, nextDay, ensureNpc, allTrades, readyCount } from '../src/npc/requests.js';
import { grant, hasItem, rigUnlocked, baitUnlocked, lockHint, earnedCards, ensureInventory, isCard } from '../src/npc/inventory.js';
import { SPECIES_BY_ID, SPECIES } from '../src/fishing/species.js';
import { RIGS, BAITS } from '../src/fishing/gear.js';
import { PALETTES, STYLES, sanitizeLook } from '../src/core/anglerData.js';
import * as G from '../src/fishing/guide.js';
import { loadProgress } from '../src/core/save.js';

const fresh = () => ({ journal: {}, catches: [], stock: {}, steward: { points: 0, litter: 0, checks: 0, clean: 0, fines: 0 }, guide: { nextN: 1, e: {} }, inventory: { have: {}, cards: {}, worn: null, lure: null }, npc: { day: 1, met: {}, accepted: {}, done: {}, quizFail: {}, rot: {} } });
const row = o => ({ eco: 'seagrass', id: 'tailor', length: 31, kept: false, time: Date.now(), spot: 'jetty', ...o });
const master = (p, id) => { const e = (p.guide.e[id] ??= {}); e.seen = { t: 1, src: 'x' }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; e.meas = { n: 1, acc: 1 }; e.dec = { ok: 1, bad: 0 }; e.mastered = 1; };

// ---------------------------------------------------------------- schedules
test('every NPC has a slot for every time of day at each site it lives at, and every place it names exists', () => {
  for (const [id, def] of Object.entries(NPCS)) {
    assert.ok(Object.keys(def.sites).length > 0, `${id} lives somewhere`);
    for (const [site, byTime] of Object.entries(def.sites)) {
      for (const time of TIMES) {
        const slot = slotAt(def, site, time);
        assert.ok(slot, `${id}@${site} has a ${time} slot`);
        assert.ok(['fishing', 'walking', 'standing', 'sitting', 'away'].includes(slot.act), `${id} ${time} act ${slot.act}`);
        if (isAway(slot)) continue;
        for (const place of placesOf(slot)) assert.ok(PLACES[site][place], `${id}@${site} ${time}: unknown place "${place}"`);
        if (slot.act === 'walking') assert.ok(slot.path?.length >= 2, `${id} walks along a path`);
      }
      assert.ok(Object.keys(byTime).every(t => TIMES.includes(t)));
    }
  }
});

test('schedule lookup: who is where when', () => {
  assert.equal(slotAt(NPCS.tam, 'seagrass', 'dawn').act, 'fishing');
  assert.equal(slotAt(NPCS.tam, 'seagrass', 'dawn').at, 'jettyEnd');
  assert.equal(slotAt(NPCS.tam, 'seagrass', 'day').act, 'sitting', 'Tam takes a break in the day');
  assert.equal(slotAt(NPCS.tam, 'rocky', 'day'), null, 'Tam does not live at Bellambi');
  assert.ok(isAway(slotAt(NPCS.mitra, 'seagrass', 'night')), 'the bait shop closes at night');
  assert.ok(!isAway(slotAt(NPCS.mitra, 'seagrass', 'day')));
  const lakeDay = presentAt(NPCS, 'seagrass', 'day').map(x => x.id), beachDay = presentAt(NPCS, 'rocky', 'day').map(x => x.id);
  for (const id of ['mitra', 'tam', 'priya', 'jo', 'mika', 'officer']) assert.ok(lakeDay.includes(id), `${id} at the lake by day`);
  assert.ok(presentAt(NPCS, 'harbour', 'day').some(x => x.id === 'nell'), 'the co-op fisher works the harbour by day');
  for (const id of ['sione', 'bev', 'fatima', 'mika', 'officer']) assert.ok(beachDay.includes(id), `${id} at Bellambi by day`);
  assert.ok(!beachDay.includes('mitra') && !lakeDay.includes('sione'));
  // Night: the shop owner and the club organiser go home, the lifeguard stays, and Old Tam walks up to Belmore Basin for the squid (phase 5).
  assert.ok(!presentAt(NPCS, 'seagrass', 'night').some(x => x.id === 'tam'), 'Tam has left the lake by night');
  assert.ok(presentAt(NPCS, 'harbour', 'night').some(x => x.id === 'tam'), 'Tam fishes the harbour wharf at night');
  assert.equal(slotAt(NPCS.tam, 'harbour', 'night').at, 'wharfEnd');
  assert.ok(isAway(slotAt(NPCS.tam, 'harbour', 'day')), 'Tam is not at the harbour by day');
  assert.ok(!presentAt(NPCS, 'seagrass', 'night').some(x => x.id === 'mitra'));
  assert.ok(presentAt(NPCS, 'rocky', 'night').some(x => x.id === 'sione'));
  // The kid angler moves between spots: a different place by day than at dawn.
  assert.notEqual(slotAt(NPCS.mika, 'seagrass', 'dawn').at, slotAt(NPCS.mika, 'seagrass', 'day').at);
});

test('slots resolve to coordinates and a facing', () => {
  const r = resolveSlot(slotAt(NPCS.tam, 'seagrass', 'dawn'), PLACES.seagrass);
  assert.equal(r.act, 'fishing'); assert.equal(r.points.length, 1); assert.equal(r.heading, WATER_HEADING);
  assert.ok(Number.isFinite(r.points[0].x) && Number.isFinite(r.points[0].z));
  const walk = resolveSlot(slotAt(NPCS.officer, 'rocky', 'day'), PLACES.rocky);
  assert.equal(walk.points.length, 2); assert.equal(walk.heading, null);
  assert.equal(resolveSlot(slotAt(NPCS.mitra, 'seagrass', 'night'), PLACES.seagrass).away, true);
  assert.throws(() => resolveSlot({ act: 'standing', at: 'nowhere' }, PLACES.seagrass));
});

test('walking paths ping-pong along their points', () => {
  const pts = [{ x: 0, z: 0 }, { x: 10, z: 0 }];
  assert.deepEqual([pathPosition(pts, 0).x, pathPosition(pts, 5).x, pathPosition(pts, 10).x, pathPosition(pts, 15).x, pathPosition(pts, 20).x], [0, 5, 10, 5, 0]);
  assert.ok(Math.abs(pathPosition(pts, 3).heading - Math.PI / 2) < 1e-9, 'heading +x');
  assert.ok(Math.abs(Math.abs(pathPosition(pts, 13).heading) - Math.PI / 2) < 1e-9, 'heading -x on the way back');
  const three = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }];
  const mid = pathPosition(three, 5.5); assert.ok(Math.abs(mid.x - 4) < 1e-9 && Math.abs(mid.z - 1.5) < 1e-9);
  assert.equal(pathPosition([{ x: 2, z: 3 }], 99).x, 2);
});

// ---------------------------------------------------------------- tips and gossip
test('tips rotate and respect the day\'s tide, time and season; specific tips come first', () => {
  const lines = [{ t: 'any' }, { t: 'rising', tide: ['rising'] }, { t: 'rising dawn', tide: ['rising'], time: ['dawn'] }, { t: 'winter', season: ['winter'] }];
  const dawnRising = { tide: 'rising', time: 'dawn', season: 'summer' };
  assert.deepEqual(eligible(lines, dawnRising).map(l => l.t), ['rising dawn', 'rising', 'any']);
  assert.equal(pickLine(lines, dawnRising, 0).line.t, 'rising dawn');
  assert.equal(pickLine(lines, dawnRising, 1).line.t, 'rising');
  assert.equal(pickLine(lines, dawnRising, 2).line.t, 'any');
  assert.equal(pickLine(lines, dawnRising, 3).line.t, 'rising dawn', 'wraps round');
  assert.deepEqual(eligible(lines, { tide: 'low', time: 'night', season: 'winter' }).map(l => l.t), ['winter', 'any']);
  assert.equal(pickLine([{ t: 'x', tide: ['high'] }], { tide: 'low', time: 'day', season: 'summer' }, 0), null, 'nothing to tell today');
});

test('every NPC has tips for every kind of day, and gossip lines name a real species, a place and a when', () => {
  const conds = [];
  for (const tide of ['rising', 'high', 'falling', 'low']) for (const time of TIMES) for (const season of ['summer', 'autumn', 'winter', 'spring']) conds.push({ tide, time, season });
  const PLACE_WORDS = /(lake|jetty|channel|flats|seagrass|mangrove|beach|platform|gutter|rock|surf|piles|pylons|sand|wharf|breakwall|basin)/i, WHEN_WORDS = /(dawn|dusk|night|day|daytime|midday|morning|tide|summer|autumn|winter|spring)/i;
  for (const [id, def] of Object.entries(NPCS)) {
    assert.ok(def.tips.length >= 3, `${id} has tips`);
    for (const c of conds) assert.ok(pickLine(def.tips, c, 0), `${id} has a tip for ${JSON.stringify(c)}`);
    for (const g of def.gossip) {
      const sp = SPECIES_BY_ID[g.species];
      assert.ok(sp, `${id} gossip species ${g.species}`);
      assert.ok(sp.name.toLowerCase().replace(/[()]/g, '').split(' ').some(w => w.length > 3 && g.t.toLowerCase().includes(w)), `${id} gossip names the ${sp.name}: ${g.t}`);
      assert.ok(PLACE_WORDS.test(g.t), `${id} gossip says where: ${g.t}`); assert.ok(WHEN_WORDS.test(g.t), `${id} gossip says when: ${g.t}`);
    }
  }
  // The talkative ones always have something to say as gossip.
  for (const id of ['mitra', 'tam', 'priya', 'sione', 'bev', 'mika']) assert.ok(NPCS[id].gossip.length >= 3, `${id} gossips`);
});

test('gossip marks the species Seen (source "gossip") once', () => {
  const p = fresh();
  assert.ok(G.markSeen(p, 'duskyflathead', 'gossip'));
  assert.equal(G.tierOf(p, 'duskyflathead'), 'seen'); assert.equal(p.guide.e.duskyflathead.seen.src, 'gossip');
  assert.ok(!G.markSeen(p, 'duskyflathead', 'gossip'), 'only the first time');
});

// ---------------------------------------------------------------- "show me" request checkers
test('request checkers read the Fish Guide and the logbook', () => {
  const p = fresh();
  // mastered
  assert.equal(progressOf({ type: 'mastered', id: 'yellowfinbream' }, p).done, false);
  master(p, 'yellowfinbream');
  assert.equal(progressOf({ type: 'mastered', id: 'yellowfinbream' }, p).done, true);
  assert.equal(progressOf({ type: 'masteredCount', n: 2 }, p).have, 1);
  master(p, 'tailor'); assert.equal(progressOf({ type: 'masteredCount', n: 2 }, p).done, true);
  assert.equal(progressOf({ type: 'identifiedCount', n: 2 }, p).done, true);
  assert.equal(progressOf({ type: 'caughtSpecies', n: 3 }, p).have, 2);
  // releases with air time <= 10 s
  p.catches = [row({ air: 4 }), row({ air: 12 }), row({ air: 9.9 }), row({ kept: true, air: 1 })];
  const rel = progressOf({ type: 'releases', n: 3, maxAir: 10 }, p);
  assert.deepEqual([rel.have, rel.done], [2, false]);
  p.catches.push(row({ air: 10 })); assert.equal(progressOf({ type: 'releases', n: 3, maxAir: 10 }, p).done, true, '10 s is allowed');
  // accurate measures
  p.catches = [row({ accurate: true }), row({ accurate: false }), row({ accurate: true }), row({ accurate: true })];
  assert.equal(progressOf({ type: 'accurateMeasures', n: 3 }, p).done, true);
  // an accurate measure of a flathead inside the 36-70 cm slot
  p.catches = [row({ id: 'duskyflathead', length: 30, accurate: true }), row({ id: 'duskyflathead', length: 75, accurate: true }), row({ id: 'duskyflathead', length: 50, accurate: false }), row({ id: 'tailor', length: 50, accurate: true })];
  assert.equal(progressOf({ type: 'accurateSlot', id: 'duskyflathead' }, p).done, false, 'undersize, oversize, inaccurate and wrong species do not count');
  p.catches.push(row({ id: 'duskyflathead', length: 36, accurate: true })); assert.equal(progressOf({ type: 'accurateSlot', id: 'duskyflathead' }, p).done, true);
  // a correct release of a protected species
  assert.equal(progressOf({ type: 'protectedRelease' }, p).done, false);
  p.catches.push(row({ id: 'wobbegong', kind: 'protected', kept: false })); assert.equal(progressOf({ type: 'protectedRelease' }, p).done, true);
  p.catches = [row({ id: 'wobbegong', kind: 'protected', kept: true })]; assert.equal(progressOf({ type: 'protectedRelease' }, p).done, false, 'keeping one is never right');
  // tagged releases, catch size, litter
  p.catches = [row({ tagged: true }), row({ tagged: true, kept: true }), row({ tagged: true })];
  assert.equal(progressOf({ type: 'taggedReleases', n: 2 }, p).done, true);
  p.catches = [row({ id: 'duskyflathead', length: 39 })]; assert.equal(progressOf({ type: 'catchSize', id: 'duskyflathead', minCm: 40 }, p).done, false);
  p.catches.push(row({ id: 'duskyflathead', length: 41 })); assert.equal(progressOf({ type: 'catchSize', id: 'duskyflathead', minCm: 40 }, p).done, true);
  p.steward.litter = 2; assert.equal(progressOf({ type: 'litter', n: 3 }, p).done, false); p.steward.litter = 3; assert.equal(progressOf({ type: 'litter', n: 3 }, p).done, true);
  assert.throws(() => progressOf({ type: 'nope' }, p));
});

test('every show-me trade has a checkable need with readable text', () => {
  const p = fresh();
  for (const { npc, trade } of allTrades().filter(x => x.trade.kind === 'show')) {
    const pr = progressOf(trade.need, p);
    assert.ok(pr.text.length > 8 && pr.need >= 1, `${npc}/${trade.id}`);
    assert.equal(pr.done, false, `${trade.id} is not done on a fresh save`);
  }
});

// ---------------------------------------------------------------- trades and quizzes
test('a show-me trade: new -> active -> ready -> done', () => {
  const p = fresh(), t = NPCS.tam.trades.find(x => x.id === 'tam-bream');
  assert.equal(tradeStatus(p, t), 'new');
  accept(p, t.id); assert.equal(tradeStatus(p, t), 'active');
  assert.equal(questLog(p).active.length, 1);
  master(p, 'yellowfinbream');
  assert.equal(tradeStatus(p, t), 'ready'); assert.equal(readyCount(p), 1);
  complete(p, t.id); assert.equal(tradeStatus(p, t), 'done');
  assert.equal(questLog(p).done.length, 1); assert.equal(readyCount(p), 0);
});

test('a request you already satisfied can be handed in without accepting it first', () => {
  const p = fresh(); master(p, 'yellowfinbream');
  assert.equal(tradeStatus(p, NPCS.tam.trades[0]), 'ready');
});

test('a failed quiz is retried on the next in-game day', () => {
  const p = fresh(), t = NPCS.mitra.trades.find(x => x.id === 'mitra-licence');
  assert.equal(tradeStatus(p, t), 'new');
  accept(p, t.id); assert.equal(tradeStatus(p, t), 'ready');
  failQuiz(p, t.id); assert.equal(tradeStatus(p, t), 'wait', 'not again the same day');
  assert.equal(questLog(p).waiting.length, 1);
  nextDay(p); assert.equal(tradeStatus(p, t), 'ready', 'tomorrow you may try again');
  complete(p, t.id); assert.equal(tradeStatus(p, t), 'done');
});

test('rewards: items unlock rigs and baits, cards go to the Sea Country list', () => {
  const p = fresh();
  for (const r of START_RIGS) assert.ok(rigUnlocked(p, r)); for (const b of START_BAITS) assert.ok(baitUnlocked(p, b));
  assert.ok(!rigUnlocked(p, 'float')); assert.ok(!baitUnlocked(p, 'nipper'));
  assert.equal(lockHint(p, 'rig', 'float'), 'Ask Old Tam on the jetty');
  assert.match(lockHint(p, 'rig', 'squidjig'), /Mitra/); assert.equal(lockHint(p, 'rig', 'paternoster'), '');
  assert.ok(grant(p, 'rig-float')); assert.ok(!grant(p, 'rig-float'), 'only once');
  assert.ok(rigUnlocked(p, 'float')); assert.equal(lockHint(p, 'rig', 'float'), ''); assert.ok(hasItem(p, 'rig-float'));
  assert.ok(grant(p, 'bait-nipper')); assert.ok(baitUnlocked(p, 'nipper'));
  assert.ok(isCard('sc-lake')); assert.ok(grant(p, 'sc-lake')); assert.deepEqual(earnedCards(p), ['sc-lake']);
  assert.throws(() => grant(p, 'nonsense'));
  assert.ok(!hasItem({}, 'rig-float'), 'a save with no inventory has nothing');
  assert.ok(ensureInventory({}).have);
});

test('a new save starts with only the starting kit; every other rig and bait can be earned', () => {
  const p = loadProgress();
  assert.deepEqual(p.inventory.have, {}); assert.equal(p.npc.day, 1);
  for (const id of Object.keys(RIGS)) if (!START_RIGS.includes(id)) assert.ok(!rigUnlocked(p, id), `${id} starts locked`);
  for (const id of Object.keys(BAITS)) if (!START_BAITS.includes(id)) assert.ok(!baitUnlocked(p, id), `${id} starts locked`);
  const earned = { rig: new Set(), bait: new Set() };
  for (const it of Object.values(ITEMS)) { if (it.unlocks?.rig) earned.rig.add(it.unlocks.rig); if (it.unlocks?.bait) earned.bait.add(it.unlocks.bait); }
  for (const id of Object.keys(RIGS)) assert.ok(START_RIGS.includes(id) || earned.rig.has(id), `${id} is unlocked by a trade`);
  for (const id of Object.keys(BAITS)) assert.ok(START_BAITS.includes(id) || earned.bait.has(id), `${id} is unlocked by a trade`);
});

// ---------------------------------------------------------------- content integrity
test('every reward, quiz and giver in the trade list exists', () => {
  const rewards = new Set(), ids = new Set();
  for (const { npc, trade } of allTrades()) {
    assert.ok(!ids.has(trade.id), `duplicate trade ${trade.id}`); ids.add(trade.id);
    assert.ok(ITEMS[trade.reward] || CARDS[trade.reward], `${trade.id} reward ${trade.reward}`); rewards.add(trade.reward);
    assert.ok(['show', 'quiz'].includes(trade.kind));
    assert.ok(trade.ask.length > 20 && trade.done.length > 10 && trade.title.length > 3);
    if (trade.kind === 'quiz') { assert.ok(trade.quiz.length >= 1 && trade.quiz.length <= 3, `${trade.id} 1-3 questions`); for (const n of trade.quiz) assert.ok(QUIZ_BY_N[n], `quiz ${n}`); }
    else assert.ok(trade.need?.type);
    if (ITEMS[trade.reward]) assert.equal(ITEMS[trade.reward].from, npc, `${trade.reward} says it comes from ${npc}`);
  }
  for (const [id, def] of Object.entries(NPCS)) assert.ok(def.trades.length <= 3, `${id} gives 1-3 requests`);
  for (const id of ['mitra', 'tam', 'priya', 'jo', 'sione', 'bev', 'fatima', 'mika']) assert.ok(NPCS[id].trades.length >= 1, `${id} has a request`);
  for (const id of Object.keys(ITEMS)) assert.ok(rewards.has(id), `${id} is a reward of some trade`);
});

test('the quiz bank: 30 questions, one right answer each, worksheet cited', () => {
  assert.equal(QUIZ.length, 30);
  for (const q of QUIZ) { assert.equal(q.options.length, 4, `Q${q.n}`); assert.ok(q.answer >= 0 && q.answer < 4); assert.match(q.src, /^worksheet \d/); assert.ok(q.q.length > 10); }
  assert.equal(QUIZ_BY_N[6].options[QUIZ_BY_N[6].answer], '$14', 'the 1-month fee');
  assert.equal(QUIZ_BY_N[27].options[QUIZ_BY_N[27].answer].startsWith('It is for culture'), true);
});

test('every NPC looks right: a valid look, props, and a full set of reactions', () => {
  for (const id of NPC_ORDER) {
    const d = NPCS[id], look = sanitizeLook(d.look);
    assert.ok(d.name && d.role && d.where, id); assert.ok(d.intro.length >= 1); assert.ok(d.greet.length >= 2 && d.greet.every(g => g.includes('{name}')), `${id} greets by name`);
    for (const k of ['skin', 'shirt', 'shorts']) assert.equal(look[k], d.look[k] ?? look[k]);
    assert.ok(STYLES.hatStyle.some(s => s.id === look.hatStyle) && STYLES.hairStyle.some(s => s.id === look.hairStyle));
    assert.ok(PALETTES.skin.some(c => c.v === d.look.skin), `${id} skin is one of the 8 tones`);
    for (const kind of Object.keys(REACT_FALLBACK.illegal)) assert.ok((d.react.illegal[kind] ?? REACT_FALLBACK.illegal[kind]).length > 8, `${id} reacts to ${kind}`);
    assert.ok(d.react.cheer.length >= 1);
  }
  // Diverse cast: at least 5 different skin tones.
  assert.ok(new Set(NPC_ORDER.map(id => NPCS[id].look.skin)).size >= 5);
});

test('items: hats are real hat looks, and every rig/bait unlock names a real rig or bait', () => {
  for (const [id, it] of Object.entries(ITEMS)) {
    assert.ok(NPCS[it.from], `${id} from ${it.from}`); assert.ok(it.ask.length > 5 && it.blurb.length > 10);
    if (it.hat) { assert.ok(STYLES.hatStyle.some(s => s.id === it.hat.hatStyle && s.id !== 'none')); assert.ok(PALETTES.hat.some(c => c.v === it.hat.hat), `${id} hat colour`); }
    if (it.unlocks?.rig) assert.ok(RIGS[it.unlocks.rig], id); if (it.unlocks?.bait) assert.ok(BAITS[it.unlocks.bait], id);
  }
});

// ---------------------------------------------------------------- the Sea Country ranger: worksheet content only
test('Sea Country content cites worksheets only and keeps out the [unverified] claims', () => {
  const dataset = '../tideline-content/species-and-rules.md';
  assert.ok(CARD_ORDER.length >= 5);
  for (const id of CARD_ORDER) {
    assert.match(CARDS[id].src, /^worksheets? [\d., ]+$/, `${id} cites worksheets`);
    assert.ok(CARDS[id].text.length > 100);
  }
  const all = JSON.stringify([NPCS.jo, CARDS]).toLowerCase();
  for (const banned of ['turban', 'totem', 'dreaming', 'creation story of the lake']) assert.ok(!all.includes(banned), `no "${banned}" (it is [unverified] in the dataset)`);
  // It speaks of living knowledge, names itself as not a Knowledge Holder and sends students to the AECG.
  const jo = JSON.stringify(NPCS.jo);
  assert.match(jo, /Knowledge Holder/); assert.match(jo, /AECG/); assert.match(jo, /living knowledge/i);
  // The calendar is summarised and linked, not copied.
  assert.match(CARDS['sc-seasons'].text, /bom\.gov\.au/); assert.ok(CARDS['sc-seasons'].text.length < 700, 'a short summary, not the calendar text');
  assert.ok(dataset);
});

// ---------------------------------------------------------------- the lifeguard and the Steward rating
test('ignoring the lifeguard costs Steward stars (safety marks)', () => {
  const p = fresh(); p.catches = []; p.steward.safety = 0;
  const base = G.stewardRating(p).value;
  p.steward.safety = 1; const one = G.stewardRating(p).value;
  p.steward.safety = 3; const three = G.stewardRating(p).value;
  assert.ok(base > one && one > three, `${base} > ${one} > ${three}`);
  assert.ok(Math.abs((base - one) - 0.15) < 1e-9, 'a safety mark is 0.15 of a star');
  p.steward.safety = 99; assert.ok(base - G.stewardRating(p).value <= 0.6 + 1e-9, 'capped');
  assert.ok(NPCS.sione.warn.swell.includes('{swell}') && NPCS.sione.warn.ignored.length > 20);
});
