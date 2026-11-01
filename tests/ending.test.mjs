// Phase 7: the endings (awards night and the 100%-Caught milestone), the award speeches quoting the player's own numbers, the river's flow in place of the tide,
// and the save migration to v4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/fishing/ending.js';
import * as G from '../src/fishing/guide.js';
import { AWARDS, MILESTONE, TAGLINE } from '../src/content/ceremony.js';
import { NPCS } from '../src/content/npcs.js';
import { migrateProgress, SAVE_VERSION, logbookCSV } from '../src/core/save.js';
import { SPECIES, SPECIES_BY_ID } from '../src/fishing/species.js';
import { DayConditions, FLOW_LABEL, FLOWS } from '../src/fishing/gear.js';
import { biteWeights, pickCatch, DEFAULT_CTX } from '../src/fishing/catches.js';
import { river } from '../src/ecosystems/river.js';
import { rocky } from '../src/ecosystems/rocky.js';
import { coopEligible } from '../src/economy/commercial.js';

const fresh = () => migrateProgress({});
const caught = (p, ids = SPECIES.map(s => s.id)) => { for (const id of ids) G.recordCatch(p, id, { length: 30 }); };
const master = (p, ids = SPECIES.map(s => s.id)) => { for (const id of ids) { const e = (p.guide.e[id] ??= {}); e.seen ??= { t: 1 }; e.caught ??= { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; e.meas = { n: 1, acc: 1 }; e.dec = { ok: 1, bad: 0 }; e.mastered = 1; } };
const healthy = (p, v = 90) => { p.stock = {}; for (const s of SPECIES) for (const spot of Object.keys(s.spots)) p.stock[`${spot}:${s.id}`] = v; };

// ---------------------------------------------------------------- ending triggers
test('ending: nothing is pending on a new save; the threshold is above where a new save starts', () => {
  const p = fresh(), s = E.endingStatus(p);
  assert.equal(E.pendingCeremony(p), null); assert.equal(s.milestone, false); assert.equal(s.awards, false);
  assert.ok(E.BAY_THRESHOLD > s.bay, `a new save (${s.bay.toFixed(1)}%) is below ${E.BAY_THRESHOLD}%`);
  assert.ok(E.BAY_THRESHOLD <= 75, 'and it is within reach (Thriving starts at 75)');
});
test('ending: the milestone fires at 100% Caught (not 24 of 25), and only once', () => {
  const p = fresh(); caught(p, SPECIES.slice(1).map(s => s.id));
  assert.equal(E.endingStatus(p).caught, SPECIES.length - 1); assert.equal(E.pendingCeremony(p), null, '24 of 25 is not enough');
  caught(p, [SPECIES[0].id]);
  assert.equal(E.pendingCeremony(p), 'milestone');
  E.markCeremony(p, 'milestone'); assert.equal(E.pendingCeremony(p), null, 'shown once');
  assert.ok(p.ending.milestone > 0 && p.ending.awards === null);
});
test('ending: awards night needs 100% Mastered AND Bay Health at the threshold', () => {
  const p = fresh(); master(p, SPECIES.slice(1).map(s => s.id)); healthy(p);
  assert.equal(E.endingStatus(p).awards, false, '24 of 25 Mastered is not enough even with a healthy bay');
  assert.equal(E.pendingCeremony(p), null, 'caught-all is also not met (one species not caught), so nothing at all');
  master(p, [SPECIES[0].id]);
  assert.equal(E.endingStatus(p).awards, true); assert.equal(E.pendingCeremony(p), 'awards', 'awards night wins over the milestone when both are due');
  // Everything Mastered but the bay is below the threshold (depleted stocks): no awards night, only the milestone.
  const q = fresh(); master(q); 
  assert.ok(E.endingStatus(q).bay < E.BAY_THRESHOLD);
  assert.equal(E.endingStatus(q).awards, false); assert.equal(E.pendingCeremony(q), 'milestone');
  // Just below and exactly at the threshold.
  healthy(q, 70); assert.equal(E.endingStatus(q).awards, false);
  healthy(q, E.BAY_THRESHOLD); assert.equal(E.endingStatus(q).awards, true);
  E.markCeremony(q, 'awards'); assert.equal(E.pendingCeremony(q), null, 'awards night covers the smaller milestone too');
  assert.ok(q.ending.awards > 0 && q.ending.milestone > 0);
});
test('ending: the co-op licence is offered after the awards ending (and not by the milestone alone)', () => {
  const p = fresh(); caught(p); E.markCeremony(p, 'milestone');
  assert.equal(coopEligible(p), false, 'caught is not identified');
  E.markCeremony(p, 'awards'); assert.equal(coopEligible(p), true);
});

// ---------------------------------------------------------------- the speeches
test('ceremony: every NPC gives an award that quotes the player\'s OWN numbers, and the cast is the whole coast', () => {
  const p = fresh();
  p.angler = { name: 'Kai' };
  p.catches = [
    { id: 'tailor', kept: false, legal: true, correct: true, accurate: true, measured: 30, wet: true, air: 6, time: 1 },
    { id: 'tailor', kept: false, legal: true, correct: true, accurate: false, measured: 31, wet: true, air: 14, time: 2 },
    { id: 'snapper', kept: true, legal: true, correct: true, accurate: true, measured: 40, time: 3 },
  ];
  p.steward.litter = 7; p.steward.safety = 0; p.econ.tags = [{ no: 'T-1' }, { no: 'T-2' }, { no: 'T-3' }];
  const s = E.playerStats(p);
  assert.equal(s.releases, 2); assert.equal(s.quickReleases, 1); assert.equal(s.accurate, 2); assert.equal(s.litter, 7); assert.equal(s.tags, 3); assert.equal(s.fish, 3); assert.equal(s.correct, 3);
  const lines = Object.fromEntries(AWARDS.map(a => [a.npc, a.line(s)]));
  assert.deepEqual(Object.keys(lines).sort(), Object.keys(NPCS).sort(), 'all ten people give an award');
  assert.match(lines.fatima, /7 pieces/); assert.match(lines.priya, /2 measures/); assert.match(lines.priya, /3 tagged fish/); assert.match(lines.tam, /2 fish put back/); assert.match(lines.tam, /1 of them/);
  assert.match(lines.nell, new RegExp(`${Math.round(s.bay)}%`)); assert.match(lines.mitra, /3 right calls out of 3/); assert.match(lines.sione, /Not one safety mark/);
  assert.match(lines.officer, /stars/); assert.match(lines.jo, /2 fish/);
  for (const a of AWARDS) { assert.ok(a.title && a.line(s).includes('{name}'), a.npc); assert.ok(NPCS[a.npc], a.npc); }
  // Edge cases: a record with nothing in it still reads properly (no "undefined", no "NaN").
  const z = E.playerStats(fresh());
  for (const a of [...AWARDS, ...MILESTONE]) assert.ok(!/undefined|NaN|\[object/.test(a.line(z)), `${a.npc} with an empty record: ${a.line(z)}`);
  assert.match(AWARDS.find(a => a.npc === 'sione').line({ ...s, safety: 2 }), /2 safety marks/);
  assert.match(AWARDS.find(a => a.npc === 'fatima').line({ ...s, litter: 1 }), /1 piece of litter/);
  assert.equal(TAGLINE, 'Gotta catch ’em all… and release the small.');
  assert.ok(MILESTONE.length >= 3 && MILESTONE.every(a => NPCS[a.npc]));
});
test('ceremony: Ranger Jo\'s award says nothing about First Nations practices (the Sea Country content is pending review)', () => {
  const jo = AWARDS.find(a => a.npc === 'jo').line(E.playerStats(fresh()));
  assert.ok(!/Dharawal|Aboriginal|First Nations|traditional|ancestor|Elder|cultur|Dreaming/i.test(jo), jo);
});

// ---------------------------------------------------------------- the river: flow, not tide
test('river: a river has flow, not tide or swell (chip, bite context, clarity)', () => {
  assert.equal(river.fresh, true); assert.ok(!rocky.fresh);
  const d = new DayConditions({ flow: 'high', tide: 'rising', swell: 2.2 });
  assert.equal(d.flow, 'high');
  const sea = d.chip(); assert.match(sea, /Rising tide/); assert.match(sea, /swell \d\.\d m/);
  d.setFresh(true);
  const chip = d.chip();
  assert.match(chip, /After rain: high flow/); assert.ok(!/tide|swell/i.test(chip), chip);
  assert.equal(FLOW_LABEL.normal, 'Normal flow');
  const ctx = d.context({ rig: 'softplastic', bait: 'none' }, null);
  assert.equal(ctx.tide, null, 'the bite model gets no tide on a river'); assert.equal(ctx.flow, 'high');
  assert.equal(d.clarity, 'murky'); assert.equal(new DayConditions({ flow: 'low' }).flow, 'low');
  d.setFresh(false);
  assert.equal(d.context({ rig: 'softplastic', bait: 'none' }, null).tide, 'rising', 'back at sea the tide returns'); assert.equal(d.context({}, null).flow, null);
  for (const f of FLOWS) assert.ok(FLOW_LABEL[f]);
  const rnd = new DayConditions({}, () => 0.7); assert.ok(FLOWS.includes(rnd.flow));
});
test('river: the tide does not change a river bite, but the flow can (bass feed harder after rain)', () => {
  const base = { rig: 'softplastic', bait: 'none', time: 'dusk', season: 'summer', stock: null };
  const w = ctx => Object.fromEntries(biteWeights('snags', { ...DEFAULT_CTX, ...base, ...ctx }).map(x => [x.sp.id, x.w]));
  const a = w({ tide: null, flow: 'normal' });
  for (const tide of ['rising', 'falling', 'high', 'low']) assert.deepEqual(w({ tide, flow: 'normal' }), a, `tide ${tide} changes nothing at the river`);
  assert.deepEqual(w({ tide: null, flow: 'low' }), a, 'low and normal flow are the same');
  const hi = w({ tide: null, flow: 'high' });
  assert.ok(hi.australianbass > a.australianbass, 'bass bite harder in the rain-fed rise'); assert.ok(hi.shortfineel > a.shortfineel); assert.equal(hi.carp, a.carp);
  assert.deepEqual(SPECIES_BY_ID.australianbass.tide, [], 'bass have no tide preference');
  assert.deepEqual(SPECIES_BY_ID.australianbass.flow, ['high']);
  // the sea species are unchanged by flow
  assert.deepEqual(SPECIES_BY_ID.yellowfinbream.flow, []);
  assert.equal(pickCatch('snags', { ...DEFAULT_CTX, ...base, flow: 'high' }, () => 0.5).id.length > 0, true);
});
test('river: the logbook reads the river\'s flow where the sea has a tide (CSV column "tide or river flow")', () => {
  const p = fresh();
  p.catches = [{ id: 'australianbass', label: 'Australian bass', length: 30, kept: false, spot: 'snags', flow: 'high', daytime: 'dusk', time: 1 }, { id: 'tailor', label: 'Tailor', length: 30, kept: false, spot: 'jetty', tide: 'rising', daytime: 'day', time: 2 }];
  const rows = logbookCSV(p).split('\n');
  assert.match(rows[0], /"tide or river flow"/); assert.match(rows[1], /"high"/); assert.match(rows[2], /"rising"/);
});

// ---------------------------------------------------------------- the save: v3 -> v4
test('save: v3 migrates to v4 keeping everything and adding ending + coop; a new save has them blank; it is idempotent', () => {
  assert.equal(SAVE_VERSION, 4);
  const v3 = { v: 3, coins: 77, catches: [{ id: 'tailor', spot: 'jetty', tide: 'rising', daytime: 'day', time: 5, length: 30 }], guide: { nextN: 2, e: { tailor: { ident: true } } }, shop: { owned: { 'rod-2': 5 }, equip: { rod: 'rod-2' }, bait: { prawn: 3 } }, angler: { name: 'Kai' } };
  const p = migrateProgress(structuredClone(v3));
  assert.equal(p.v, 4); assert.equal(p.coins, 77); assert.equal(p.catches.length, 1); assert.equal(p.angler.name, 'Kai'); assert.equal(p.shop.equip.rod, 'rod-2'); assert.equal(p.guide.e.tailor.ident, true);
  assert.deepEqual(p.ending, { milestone: null, awards: null });
  assert.equal(p.coop.licence, null); assert.equal(p.coop.credits, 0); assert.deepEqual(p.coop.hold, []); assert.deepEqual(p.coop.upgrades, {});
  assert.deepEqual(migrateProgress(JSON.parse(JSON.stringify(p))), p, 'idempotent');
  // A v4 save keeps its endings and co-op state; a damaged co-op block is repaired.
  const v4 = migrateProgress({ v: 4, ending: { awards: 123 }, coop: { licence: { t: 1, day: 2 }, credits: 55, hold: 'oops', landed: null, upgrades: { gps: 1 } } });
  assert.equal(v4.ending.awards, 123); assert.equal(v4.ending.milestone, null); assert.equal(v4.coop.credits, 55); assert.deepEqual(v4.coop.hold, []); assert.deepEqual(v4.coop.landed, {}); assert.equal(v4.coop.upgrades.gps, 1);
  const n = fresh(); assert.equal(n.v, 4); assert.deepEqual(n.ending, { milestone: null, awards: null }); assert.equal(n.coop.licence, null);
  // The earn-combo keys read the river's flow where there is no tide, so an old river row is not paid twice.
  const old = migrateProgress({ v: 2, catches: [{ id: 'australianbass', spot: 'snags', flow: 'normal', daytime: 'dusk', time: 4, length: 30 }] });
  assert.ok(old.econ.combos['australianbass|snags|normal|dusk']);
});
