// Release fixes (the pre-release pass): zero stock never locks a species, possession is tracked explicitly, the Bay Health rebalance (a normal good-practice
// playthrough clears awards night), carp, the missed strike, save repair, and ONE simulated day for bags, bass, bait and credit caps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateProgress, backupRaw } from '../src/core/save.js';
import * as G from '../src/fishing/guide.js';
import * as E from '../src/fishing/ending.js';
import { SPECIES, SPECIES_BY_ID } from '../src/fishing/species.js';
import { biteWeights, pickCatch, DEFAULT_CTX, adjustStock, stockOf, stockDelta, seedOf, recoverStock, stockNote, judge, STOCK_FLOOR, STOCK_RECOVERY, RULES } from '../src/fishing/catches.js';
import { nextDay } from '../src/npc/requests.js';
import * as P from '../src/economy/possession.js';
import * as C from '../src/economy/coins.js';
import { collect } from '../src/economy/store.js';
import { Fishing } from '../src/fishing/fishing.js';
import { recordPest } from '../src/fishing/pest.js';

const fresh = () => migrateProgress({});

// ---------------------------------------------------------------- 2. zero stock
test('stock: a species at zero stock can still bite (a floor), and stock recovers toward its seed over in-game days', () => {
  const p = fresh();
  // Jackass morwong (depleted, seed 30): eight illegal keeps at each of its habitats drive every population to zero.
  const spots = Object.keys(SPECIES_BY_ID.jackassmorwong.spots);
  for (const spot of spots) for (let i = 0; i < 8; i++) adjustStock(p, spot, 'jackassmorwong', stockDelta(true, false));
  for (const spot of spots) assert.equal(stockOf(p.stock, spot, 'jackassmorwong'), 0);
  const w = biteWeights(spots[0], { ...DEFAULT_CTX, stock: p.stock }).find(x => x.sp.id === 'jackassmorwong');
  assert.ok(w.w > 0, 'a species with zero stock still has a bite weight');
  assert.ok(w.stock === 0 && Math.abs(w.w - w.base * w.rigM * w.baitM * w.condM * (STOCK_FLOOR / 100) * w.gearM * w.lampM) < 1e-9);
  // ... so it can actually be picked.
  let seen = 0; for (let i = 0; i < 4000; i++) if (pickCatch(spots[0], { ...DEFAULT_CTX, stock: p.stock }, Math.random).id === 'jackassmorwong') seen++;
  assert.ok(seen > 0, 'jackass morwong still turns up at zero stock');
  // Passive recovery: a day at a time, up to the seed and no further.
  const seed = seedOf(spots[0], 'jackassmorwong');
  nextDay(p); assert.equal(stockOf(p.stock, spots[0], 'jackassmorwong'), STOCK_RECOVERY, 'one day of recovery');
  for (let d = 0; d < 40; d++) nextDay(p);
  assert.equal(stockOf(p.stock, spots[0], 'jackassmorwong'), seed, 'recovers to its natural level and stops');
  // Recovery takes time: it is not instant, and a stock above its seed (earned by releasing) is not pulled down.
  const q = fresh(); adjustStock(q, 'beach', 'tailor', -80); const low = stockOf(q.stock, 'beach', 'tailor');
  assert.ok(recoverStock(q, 3) > 0 && stockOf(q.stock, 'beach', 'tailor') === low + 3 * STOCK_RECOVERY);
  adjustStock(q, 'beach', 'australiansalmon', +15); const hi = stockOf(q.stock, 'beach', 'australiansalmon'); recoverStock(q, 5);
  assert.equal(stockOf(q.stock, 'beach', 'australiansalmon'), hi);
  // The player is told that recovery takes time.
  assert.match(stockNote(p0(), 'beach', 'tailor'), /Recovery takes time/);
  assert.equal(stockNote(fresh(), 'beach', 'tailor'), '', 'no note for a healthy stock');
});
function p0() { const p = fresh(); adjustStock(p, 'beach', 'tailor', -80); return p; }

// ---------------------------------------------------------------- 3. possession
const keepRow = (p, id, length = 40, extra = {}) => { const day = P.dayOf(p), row = { id, kept: true, legal: true, length, time: Date.now(), day, ...extra }; (p.catches ??= []).push(row); (p.esky ??= []).push({ id, label: id, length, legal: row.legal, time: row.time, day }); return row; };
test('possession: the esky plus the fridge at home count, with no real-time expiry; a taken fish does not count; fish are eaten on simulated days', () => {
  const p = fresh();
  assert.equal(RULES.tailor.possession, 20); assert.equal(RULES.tailor.bag, 10);
  for (let i = 0; i < 10; i++) keepRow(p, 'tailor');
  assert.equal(P.keptToday(p, 'tailor'), 10); assert.equal(P.inPossession(p, 'tailor'), 10);
  // A kept fish is not forgotten because of how old its timestamp is (the old rule dropped fish after 3 REAL days).
  for (const x of [...p.catches, ...p.esky]) x.time -= 30 * 864e5;
  assert.equal(P.inPossession(p, 'tailor'), 10, 'a month of real time changes nothing');
  assert.equal(judge('tailor', 40, P.keptToday(p, 'tailor'), P.inPossession(p, 'tailor')).kind, 'bag');
  // Head home: the esky becomes the fridge at home. A new simulated day: a fresh bag, but the fridge still counts toward possession.
  P.stowEsky(p, 'none'); nextDay(p);
  assert.equal(p.esky.length, 0); assert.equal(P.fridgeNow(p).length, 10);
  assert.equal(P.keptToday(p, 'tailor'), 0, 'a new day, a new bag');
  assert.equal(P.inPossession(p, 'tailor'), 10, 'but the fridge still counts');
  for (let i = 0; i < 10; i++) keepRow(p, 'tailor');
  assert.equal(P.inPossession(p, 'tailor'), 20);
  assert.equal(judge('tailor', 40, P.keptToday(p, 'tailor'), P.inPossession(p, 'tailor')).kind, 'bag', 'bag is the first limit hit');
  // Possession bites on its own when the bag is not: snapper has bag 10 and possession 10.
  const s = fresh(); for (let i = 0; i < 10; i++) keepRow(s, 'snapper', 40); P.stowEsky(s, 'none'); nextDay(s);
  assert.equal(P.keptToday(s, 'snapper'), 0);
  assert.equal(judge('snapper', 40, P.keptToday(s, 'snapper'), P.inPossession(s, 'snapper')).kind, 'possession', 'a new day, but ten snapper are still in the fridge');
  // The fridge is eaten on simulated days (FRIDGE_DAYS), not real ones.
  for (let d = 0; d < P.FRIDGE_DAYS; d++) nextDay(s);
  assert.equal(P.inPossession(s, 'snapper'), 0, 'eaten after a few simulated days');
  assert.equal(judge('snapper', 40, 0, P.inPossession(s, 'snapper')).legal, true);
});
test('possession: a Fisheries Officer takes illegal fish, and taken fish never count toward possession', () => {
  const p = fresh();
  keepRow(p, 'snapper', 40); const bad = keepRow(p, 'snapper', 20, { legal: false }); p.esky.at(-1).legal = false;
  assert.equal(P.inPossession(p, 'snapper'), 2, 'in the esky both count');
  P.stowEsky(p, 'fine');                               // the officer fined you: the illegal fish was taken
  assert.equal(p.esky.length, 0); assert.equal(P.fridgeNow(p).length, 1, 'only the legal fish went home');
  assert.equal(P.inPossession(p, 'snapper'), 1, 'the taken fish is gone from possession, although its logbook row still says kept');
  assert.equal(bad.kept, true);
  // No check: the illegal fish went home too (still in your possession).
  const q = fresh(); keepRow(q, 'snapper', 40); keepRow(q, 'snapper', 20, { legal: false }); q.esky.at(-1).legal = false; P.stowEsky(q, 'none');
  assert.equal(P.inPossession(q, 'snapper'), 2);
  // squid and cuttlefish share one bag
  const s = fresh(); keepRow(s, 'squid'); assert.ok(P.inPossession(s, 'squid') >= 1);
});

// ---------------------------------------------------------------- 13. one simulated day
test('one day: bag, bass over 35 cm, bait collecting limits and credit caps all reset on the same simulated day, never on the calendar', () => {
  const p = fresh(); p.inventory.have['bait-nipper'] = 1;
  keepRow(p, 'australianbass', 40); keepRow(p, 'tailor', 35);
  assert.equal(P.keptOverToday(p, 'australianbass', 35), 1); assert.equal(P.keptToday(p, 'tailor'), 1);
  const col = collect(p, 'beachworm', 'rocky'); assert.ok(col.ok); assert.equal(C.today(p).collected.beachworm, 5);
  C.today(p).tagsToday = 5; C.today(p).litterToday = 10;
  // The computer's date moving on changes nothing: even rows stamped weeks ago still count while it is the same game day.
  for (const x of p.catches) x.time -= 20 * 864e5;
  assert.equal(P.keptToday(p, 'tailor'), 1);
  nextDay(p);
  assert.equal(P.keptToday(p, 'tailor'), 0); assert.equal(P.keptOverToday(p, 'australianbass', 35), 0);
  assert.equal(C.today(p).collected.beachworm, undefined); assert.equal(C.today(p).tagsToday, 0); assert.equal(C.today(p).litterToday, 0);
  assert.deepEqual(Object.keys(C.today(p).collected), [], 'the bait limit reset with the bag');
});
test('one day: heading home with nothing done does not start a new day, so walking home and back cannot reset the limits', () => {
  const p = fresh();
  assert.equal(P.dayUsed(p), false, 'a new save has used nothing');
  collect(p, 'beachworm', 'rocky'); assert.equal(P.dayUsed(p), true, 'collecting bait uses the day');
  nextDay(p); assert.equal(P.dayUsed(p), false, 'and the new day starts unused');
  keepRow(p, 'tailor'); assert.equal(P.dayUsed(p), true);
  const q = fresh(); q.npc.quizFail = { t: 1 }; assert.equal(P.dayUsed(q), true, 'a failed quiz is waiting for the next day');
});

// ---------------------------------------------------------------- 8. Bay Health pacing
/** One fish through the same steps as the catch flow (ui/catchFlow.js record): key, measure, decision, the stock change and the logbook row. */
function handle(p, id, spot, { keep, legal = true, tagged = false, wet = true, air = 6 } = {}) {
  const e = G.recordCatch(p, id, { length: 40 }); G.recordKey(p, id, id); G.recordMeasure(p, id, true);
  const sp = SPECIES_BY_ID[id];
  G.recordDecision(p, id, keep ? legal : !legal || sp.rules.pest, G.masteryDecision(keep, legal));
  if (!sp.rules.pest) adjustStock(p, spot, id, stockDelta(keep, legal, 0));
  p.catches.push({ id, kept: keep, legal, correct: true, accurate: true, measured: 40, length: 40, time: Date.now(), day: P.dayOf(p), spot, wet: keep ? undefined : wet, air: keep ? undefined : air, tagged: tagged || undefined, pest: sp.rules.pest || undefined });
  if (tagged) (p.econ.tags ??= []).push({ no: `T-${p.econ.tags.length + 1}`, id });
  return e;
}
const protectedIds = SPECIES.filter(s => s.rules.protected).map(s => s.id);
/** A class playing normally with good practice: every species Mastered (a legal keep, or the right release for a protected fish), plus plenty of releases, some tags and some litter. */
function goodPlaythrough({ extraReleases = 2, tags = 10, litter = 8 } = {}) {
  const p = fresh(); let tagged = 0, rel = 0;
  for (const s of SPECIES) {
    const spots = Object.keys(s.spots);
    if (s.rules.pest) { handle(p, s.id, spots[0], { keep: true }); recordPest(p, true); continue; }
    if (s.rules.protected) handle(p, s.id, spots[0], { keep: false, legal: false }); else handle(p, s.id, spots[0], { keep: true, legal: true });
    for (let i = 0; i < extraReleases && !s.rules.protected; i++) { handle(p, s.id, spots[(i + 1) % spots.length], { keep: false, tagged: tagged < tags }); if (tagged < tags) tagged++; rel++; }
  }
  p.steward.litter = litter;
  return { p, rel, tagged };
}
test('Bay Health: a player who masters every kind of fish with good practice clears awards night naturally (no release grind)', () => {
  const { p, rel, tagged } = goodPlaythrough();
  const s = E.endingStatus(p), parts = G.bayParts(p);
  console.log(`# simulated playthrough: ${p.catches.length} fish, ${rel + protectedIds.length} releases, ${tagged} tagged, ${p.steward.litter} litter -> stocks ${parts.stock.toFixed(2)} + bonus ${parts.bonus.toFixed(2)} = Bay Health ${parts.total.toFixed(2)} (needs ${E.BAY_THRESHOLD})`);
  assert.equal(s.mastered, SPECIES.length, 'every species is Mastered');
  assert.ok(p.catches.length <= 130, `${p.catches.length} fish in all: not a grind`);
  assert.ok(s.bayOk && s.awards, `Bay Health ${s.bay.toFixed(2)} clears ${E.BAY_THRESHOLD}`);
  assert.equal(E.pendingCeremony(p), 'awards');
  // Poor practice does not: the same species mastered but every fish kept illegally (the officer would have fined you each time).
  const bad = fresh();
  for (const s2 of SPECIES) for (const spot of Object.keys(s2.spots)) { if (s2.rules.pest) continue; for (let i = 0; i < 2; i++) handle(bad, s2.id, spot, { keep: true, legal: false }); }
  assert.ok(G.bayHealth(bad) < E.BAY_THRESHOLD, `poaching leaves Bay Health at ${G.bayHealth(bad).toFixed(1)}`);
  // A lighter but still sensible game (one extra release, a few tags, little litter) is close but must do more: the bonus is earned by practice, not handed out.
  const lite = goodPlaythrough({ extraReleases: 0, tags: 0, litter: 0 }).p;
  assert.ok(!E.endingStatus(lite).bayOk, `mastery by itself (one fish per kind) is not enough: ${G.bayHealth(lite).toFixed(1)}`);
});
test('Bay Health: shown to one decimal place and rounded down, so it never reads as the target while still ineligible', () => {
  assert.equal(G.bayText(72.96), '72.9%'); assert.equal(G.bayText(73), '73.0%'); assert.equal(G.bayText(70.4), '70.4%');
  const p = fresh(); G.bayHealth(p);
  for (const v of [72.5, 72.96, 72.999]) assert.notEqual(G.bayText(v), `${E.BAY_THRESHOLD.toFixed(1)}%`, `${v} must not read as ${E.BAY_THRESHOLD}`);
  // Exactly at the threshold is eligible, and the text agrees.
  const q = fresh(); q.stock = {}; for (const s of SPECIES) for (const spot of Object.keys(s.spots)) q.stock[`${spot}:${s.id}`] = E.BAY_THRESHOLD;
  assert.equal(G.bayText(G.bayHealth(q)), `${E.BAY_THRESHOLD.toFixed(1)}%`);
});

// ---------------------------------------------------------------- 9. carp
test('carp: taking a pest out never lowers Bay Health, putting it back never raises it, and pests are not part of the native stock mean', () => {
  const base = fresh(), b0 = G.bayHealth(base);
  const carp = SPECIES.find(s => s.rules.pest), spot = Object.keys(carp.spots)[0];
  // Removing carp (the catch flow does not touch native stocks for a pest, and counts it as removed).
  const removed = fresh(); for (let i = 0; i < 8; i++) { handle(removed, carp.id, spot, { keep: true }); recordPest(removed, true); }
  assert.ok(G.bayHealth(removed) >= b0, 'removing carp helps or is neutral');
  assert.ok(G.bayHealth(removed) > b0, 'and helps a little through the Steward bonus');
  // Returning carp.
  const returned = fresh(); for (let i = 0; i < 8; i++) { handle(returned, carp.id, spot, { keep: false }); recordPest(returned, false); }
  assert.ok(G.bayHealth(returned) <= b0, 'returning carp does not raise Bay Health');
  // The carp stock cells are not in the native aggregate at all.
  const p = fresh(); const before = G.stockHealth(p);
  for (const sp of Object.keys(carp.spots)) p.stock[`${sp}:${carp.id}`] = 0;
  assert.equal(G.stockHealth(p), before, 'zeroing the carp stock changes nothing');
  assert.equal(recordPest(fresh(), true).removed, 1);
});

// ---------------------------------------------------------------- 11. missed strike
test('fishing: a missed strike uses up the bait and returns to needing a recast (it never goes back to waiting with the old context)', () => {
  const toasts = [];
  const g = { toast: (t, k) => toasts.push([t, k]), baitReady: () => false };
  const f = Object.create(Fishing.prototype);
  Object.assign(f, { game: g, state: 'bite', ctx: { bait: 'prawn', rig: 'runningsinker' }, catch: { id: 'tailor', length: 30 }, float: { visible: true } });
  f.missStrike();
  assert.equal(f.state, 'ready', 'back to ready: the player must cast again');
  assert.equal(f.float.visible, false); assert.equal(f.ctx, null, 'the old tackle context is dropped'); assert.equal(f.catch, null);
  assert.match(toasts[0][0], /last bait/i);
  g.baitReady = () => true; f.state = 'bite'; f.float.visible = true; f.missStrike();
  assert.match(toasts.at(-1)[0], /bait is gone/i);
});

// ---------------------------------------------------------------- 12. save repair
test('save: one malformed nested field (econ.first: null) costs only that field, not the whole save', () => {
  const raw = {
    v: 2, coins: 90, angler: { name: 'Kai', skin: 0xc58c5e }, catches: [{ id: 'tailor', spot: 'jetty', tide: 'rising', daytime: 'day', time: 5, length: 30, kept: false }],
    guide: { nextN: 2, e: { tailor: { ident: true, caught: { t: 1, n: 1, count: 1 } } } }, econ: { first: null, combos: 'oops', tags: { no: 1 }, day: 'x' }, steward: { litter: 4 },
    shop: { owned: { 'rod-2': 5 }, equip: { rod: 'rod-2' }, bait: { prawn: 3 } }, stock: { 'beach:tailor': 55, 'beach:snapper': 'bad' },
  };
  const p = migrateProgress(structuredClone(raw));
  assert.equal(p.angler.name, 'Kai', 'the angler survives'); assert.equal(p.catches.length, 1, 'the catches survive'); assert.equal(p.guide.e.tailor.ident, true);
  assert.equal(p.steward.litter, 4); assert.equal(p.shop.equip.rod, 'rod-2'); assert.equal(p.stock['beach:tailor'], 55); assert.equal(p.stock['beach:snapper'], undefined, 'only the bad stock value is dropped');
  assert.ok(p.econ.first && typeof p.econ.first === 'object', 'econ.first fell back to {}');
  assert.ok(p.econ.first.tailor, 'and was rebuilt from the logbook, so nothing is paid twice'); assert.ok(Array.isArray(p.econ.tags)); assert.equal(p.econ.day, 1);
  assert.ok(p.repaired.includes('econ.first') && p.repaired.includes('econ.combos'), `repaired: ${p.repaired}`);
  assert.deepEqual(migrateProgress(JSON.parse(JSON.stringify(p))).catches, p.catches, 'and it is stable');
  // Other shapes: whole fields of the wrong type, strings, nulls inside arrays.
  const odd = migrateProgress({ v: 4, guide: 'x', catches: [null, 5, { id: 'tailor' }], npc: [], coop: 7, shop: 'no', econ: 9, ending: 'x', inventory: { have: null, cards: [] } });
  assert.deepEqual(odd.catches, [{ id: 'tailor' }]); assert.equal(odd.guide.nextN, 1); assert.equal(odd.npc.day, 1); assert.equal(odd.coop.licence, null); assert.ok(odd.shop.equip.rod); assert.equal(odd.ending.awards, null);
});
test('save: a save that cannot be read is backed up under its own key before anything is written', () => {
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), get length() { return store.size; }, key: i => [...store.keys()][i] };
  const stub = storage;
  const raw = '{"v":2,"angler":{"name":"Kai"},';   // truncated JSON
  const key = backupRaw(raw, 'bad json', stub);
  assert.ok(key && key.includes('.backup.')); assert.equal(JSON.parse(store.get(key)).raw, raw);
  for (let i = 0; i < 5; i++) { store.set(`tideline.progress.v1.backup.${1000 + i}`, '{}'); }
  backupRaw(raw, 'again', stub);
  assert.ok([...store.keys()].filter(k => k.includes('.backup.')).length <= 3, 'only the newest few backups are kept');
});
