// Phase 4: the economy (credits only from records, tags, comps, missions and litter; never from selling fish), the tackle shop (buy, equip, locks, bait),
// the gear stats that change the catch bar and the bite model, release survival, and the save migration v2 -> v3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as C from '../src/economy/coins.js';
import * as S from '../src/economy/store.js';
import * as FX from '../src/economy/effects.js';
import * as ECON from '../src/economy/coins.js';
import { RATES, SHOP, SHOP_BY_ID, COLLECT, START_BAIT_STOCK, SHY_SPECIES } from '../src/content/shop.js';
import { NPCS } from '../src/content/npcs.js';
import { barParams, TUNING } from '../src/fishing/catchbar.js';
import { biteWeights, pickCatch, DEFAULT_CTX } from '../src/fishing/catches.js';
import { migrateProgress, SAVE_VERSION } from '../src/core/save.js';
import { nextDay } from '../src/npc/requests.js';
import { grant, hasItem } from '../src/npc/inventory.js';
import { SPECIES } from '../src/fishing/species.js';

const fresh = () => migrateProgress({});
const identify = (p, ...ids) => { for (const id of ids) { const e = (p.guide.e[id] ??= {}); e.seen = { t: 1 }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; } };
const masterIt = (p, ...ids) => { identify(p, ...ids); for (const id of ids) p.guide.e[id].mastered = true; };
let T = 1_000;
const row = o => ({ id: 'yellowfinbream', length: 25, measured: 25, accurate: true, correct: true, kept: false, legal: true, kind: 'ok', spot: 'jetty', tide: 'rising', daytime: 'day', wet: true, air: 6, time: (T += 10), ...o });

// ---------------------------------------------------------------- 1. logbook records
test('a complete accurate record pays the base; the first record of a species and a new spot/tide/time pay bonuses', () => {
  const p = fresh(), c0 = p.coins;
  const r1 = C.payRecord(p, row(), true);
  assert.equal(r1.amount, RATES.recordBase + RATES.firstSpecies + RATES.newCombo);
  assert.equal(p.coins, c0 + r1.amount);
  const r2 = C.payRecord(p, row(), true);                       // same species, same spot/tide/time
  assert.equal(r2.amount, RATES.recordBase);
  const r3 = C.payRecord(p, row({ tide: 'falling' }), true);    // a new combination
  assert.equal(r3.amount, RATES.recordBase + RATES.newCombo);
  const r4 = C.payRecord(p, row({ id: 'tailor', length: 31 }), true);   // a different species: its own first-record bonus
  assert.equal(r4.amount, RATES.recordBase + RATES.firstSpecies + RATES.newCombo);
});

test('a record needs the species identified, a measure within 1 cm and the right keep-or-release call', () => {
  const p = fresh(), c0 = p.coins;
  assert.equal(C.payRecord(p, row(), false).amount, 0);                       // not identified
  assert.equal(C.payRecord(p, row({ accurate: false }), true).amount, 0);     // measure off by more than 1 cm
  assert.equal(C.payRecord(p, row({ measured: null, accurate: null }), true).amount, 0);
  assert.equal(C.payRecord(p, row({ correct: false, kept: true, legal: false, kind: 'undersize' }), true).amount, 0);   // kept an illegal fish
  assert.equal(p.coins, c0, 'nothing was paid for any of them');
  for (const x of [C.payRecord(p, row(), false), C.payRecord(p, row({ accurate: false }), true)]) assert.ok(x.why.length > 10, 'it says what was missing');
});

test('repeat-farming one species is capped per in-game day, and the cap resets on a new day', () => {
  const p = fresh(); let paid = 0;
  for (let i = 0; i < 12; i++) paid += C.payRecord(p, row({ tide: 'low' }), true).amount;
  assert.equal(paid, RATES.speciesDailyCap * RATES.recordBase + RATES.firstSpecies + RATES.newCombo, 'only the first 3 records pay');
  const capped = C.payRecord(p, row(), true);
  assert.equal(capped.amount, 0); assert.ok(capped.capped);
  const other = C.payRecord(p, row({ id: 'tailor' }), true);
  assert.ok(other.amount > 0, 'a different species still pays');
  nextDay(p);
  assert.equal(C.payRecord(p, row({ tide: 'low' }), true).amount, RATES.recordBase, 'a new in-game day pays again');
});

test('a kept fish pays exactly the same as a released one: nothing is paid for the fish itself', () => {
  const a = fresh(), b = fresh();
  const keep = C.payRecord(a, row({ kept: true }), true), rel = C.payRecord(b, row({ kept: false }), true);
  assert.equal(keep.amount, rel.amount);
  // Size, species rarity and how big the fish is change nothing.
  const c = fresh(), d = fresh();
  assert.equal(C.payRecord(c, row({ id: 'kingfish', length: 98, measured: 98 }), true).amount, C.payRecord(d, row({ id: 'garfish', length: 20, measured: 20 }), true).amount);
});

// ---------------------------------------------------------------- 2. there is no way to turn a fish into credits
test('there is no code path that converts fish to credits', () => {
  // (a) Credits can only be paid for the named sources; anything else throws.
  const p = fresh();
  for (const bad of ['sale', 'sell', 'fish', 'esky', 'market', '', undefined]) assert.throws(() => C.addCoins(p, 10, bad), /cannot come from/, `source ${bad}`);
  assert.throws(() => C.addCoins(p, 0, 'record'));
  assert.throws(() => C.addCoins(p, -5, 'record'));
  assert.deepEqual([...C.SOURCES].sort(), ['comp', 'grant', 'litter', 'mission', 'record', 'recapture', 'tag'].sort());
  // (b) The esky has no value: filling it, or emptying it by heading home, changes no credits.
  const c0 = p.coins;
  p.esky.push({ id: 'duskyflathead', label: 'Dusky flathead', length: 60, legal: true }, { id: 'kingfish', label: 'Yellowtail kingfish', length: 99, legal: true });
  p.esky = [];
  assert.equal(p.coins, c0);
  // (c) No exported function in the economy or shop modules is a sale, and no item has a sell price.
  for (const mod of [C, S, FX]) for (const k of Object.keys(mod)) assert.ok(!/sell|sale|vendor|market|fishvalue|worth/i.test(k), `export ${k}`);
  for (const it of SHOP) for (const k of Object.keys(it)) assert.ok(!/sell|sale|worth|value/i.test(k), `${it.id}.${k}`);
  // (d) Static check: no file in src/ prices a fish or pays credits from the esky or from Mitra's "Sell my fish" flow.
  const files = [];
  const walk = d => { for (const f of readdirSync(new URL(d, import.meta.url), { withFileTypes: true })) { if (f.isDirectory()) walk(`${d}${f.name}/`); else if (f.name.endsWith('.js')) files.push(`${d}${f.name}`); } };
  walk('../src/');
  for (const f of files) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/sellFish|sellCatch|fishPrice|priceOfFish|fishValue|sellPrice|sellEsky|esky[^\n]{0,60}addCoins|addCoins[^\n]{0,60}esky/i.test(src), `${f} must not turn fish into credits`);
  }
  const talk = readFileSync(new URL('../src/npc/talk.js', import.meta.url), 'utf8');
  const sellFn = talk.slice(talk.indexOf('async sell('), talk.indexOf("/** Mitra's tackle shop"));
  assert.ok(sellFn.length > 100 && !/addCoins|payRecord|payTag|earned\(|coins\s*[+-]?=/.test(sellFn), `Mitra's "Sell my fish" lesson pays nothing`);
  assert.match(sellFn, /cannot/, 'and it says she cannot buy it');
  // (e) Every coin source has its own cap or is once-only; none scales with a fish.
  assert.ok(RATES.speciesDailyCap > 0 && RATES.tagDailyCap > 0 && RATES.litterDailyCap > 0);
});

test('Mitra\'s lesson explains the law and points at every earning option', () => {
  const t = NPCS.mitra.topics.find(x => x.q.startsWith('Can I sell')).a.join(' ');
  assert.match(t, /cannot sell/i); assert.match(t, /commercial licence/i);
  for (const word of [/logbook/i, /tag/i, /comp/i, /litter/i, /jobs/i, /shop/i]) assert.match(t, word);
  assert.match(t, new RegExp(`${RATES.recordBase}`)); assert.match(t, new RegExp(`${RATES.tagPay}`));
});

// ---------------------------------------------------------------- 3. tag and release
test('tagging a legal-size fish and releasing it quickly pays; rough, undersize, kept and over-cap tags do not', () => {
  const p = fresh();
  assert.equal(C.payTag(p, row({ tagged: true })).amount, RATES.tagPay);
  assert.equal(C.payTag(p, row({ tagged: false })).amount, 0);
  assert.equal(C.payTag(p, row({ tagged: true, kept: true })).amount, 0, 'a kept fish is not tagged');
  assert.equal(C.payTag(p, row({ tagged: true, kind: 'undersize', legal: false })).amount, 0, 'tagging pays for legal-size fish');
  assert.equal(C.payTag(p, row({ tagged: true, kind: 'protected', legal: false })).amount, 0);
  assert.equal(C.payTag(p, row({ tagged: true, wet: false })).amount, 0, 'dry hands');
  assert.equal(C.payTag(p, row({ tagged: true, air: 14 })).amount, 0, 'too long out of the water');
  const before = p.coins; let n = 1;
  for (let i = 0; i < 10; i++) n += C.payTag(p, row({ tagged: true })).amount > 0 ? 1 : 0;
  assert.equal(n, RATES.tagDailyCap, 'tag payments are capped per day');
  assert.equal(p.coins - before, (RATES.tagDailyCap - 1) * RATES.tagPay);
});

test('a tag recapture letter arrives only on a later day, once, and pays the bonus', () => {
  const p = fresh();
  C.payTag(p, row({ tagged: true }));
  assert.equal(C.recaptureLetter(p, () => 0), null, 'not on the day you tagged it');
  nextDay(p);
  const c0 = p.coins;
  assert.equal(C.recaptureLetter(p, () => 0.99), null, 'the chance did not come up');
  const letter = C.recaptureLetter(p, () => 0.1);
  assert.ok(letter && letter.bonus === RATES.recapture && letter.tag.no.startsWith('T-'));
  assert.equal(p.coins, c0 + RATES.recapture);
  assert.equal(C.recaptureLetter(p, () => 0.1), null, 'one letter per tag, and one a day');
  nextDay(p);
  assert.equal(C.recaptureLetter(p, () => 0.1), null, 'the only tag has been recaptured');
});

// ---------------------------------------------------------------- 4. club comps
test('a club comp is scored from your catches and pays by place, once', () => {
  const p = fresh();
  assert.equal(C.settleComp(p), null, 'no entry, no result');
  const day = p.npc.day, comp = C.compOfDay(day);
  assert.equal(comp.id, 'species');
  const e = C.enterComp(p, 1);
  assert.ok(e); assert.equal(C.enterComp(p, 1), null, 'one entry a day');
  const rows = ['tailor', 'yellowfinbream', 'luderick', 'sandwhiting'].map(id => row({ id, time: 100 }));
  p.catches.push(...rows, row({ id: 'tailor', time: 101 }), row({ id: 'snapper', wet: false, time: 102 }), row({ id: 'squid', time: 0 }));   // a repeat, a rough release and a fish from before the entry do not count
  const st = C.compStanding(p);
  assert.equal(st.score, 4);
  const rivals = C.rivalScores(comp, day);
  assert.equal(st.place, 1 + rivals.filter(r => r > 4).length);
  const c0 = p.coins, res = C.settleComp(p);
  assert.equal(res.score, 4); assert.equal(res.prize, RATES.compPrizes[res.place - 1]);
  assert.equal(p.coins, c0 + res.prize);
  assert.equal(C.settleComp(p), null, 'settled once');
  assert.equal(C.enterComp(p, 2), null, 'and you cannot enter again the same day');
  nextDay(p);
  assert.ok(C.enterComp(p, 3), 'a new day, a new comp');
});

test('every comp has a score function, rivals and a prize ladder that rewards place', () => {
  assert.ok(RATES.compPrizes.every((v, i, a) => i === 0 || v < a[i - 1]), 'prizes fall with place');
  for (const c of C.COMPS) {
    assert.equal(c.rivals.length, 3);
    assert.equal(c.score([]), 0, `${c.id} scores nothing with no catches`);
  }
  const flat = C.COMPS.find(c => c.id === 'flathead');
  assert.equal(flat.score([row({ id: 'duskyflathead', length: 51, measured: 51 }), row({ id: 'duskyflathead', length: 72, measured: 72, legal: false, kind: 'oversize', correct: true }), row({ id: 'duskyflathead', length: 60, accurate: false })]), 51, 'the longest LEGAL, accurately measured flathead');
  assert.equal(C.COMPS.find(c => c.id === 'accurate').score([row(), row(), row({ accurate: false })]), 2);
  let paid = fresh(); C.enterComp(paid, 0);   // nothing caught: no prize even though you competed
  assert.equal(C.settleComp(paid).prize, 0);
});

// ---------------------------------------------------------------- 5. missions and litter
test('missions pay modest credits on top of the item reward', () => {
  for (const [, def] of Object.entries(NPCS)) for (const t of def.trades) {
    const n = C.missionCoins(t);
    assert.ok(n >= 6 && n <= 40, `${t.id} pays ${n}`);
    assert.equal(n, t.kind === 'quiz' ? RATES.quizPerQuestion * t.quiz.length : n);
  }
  const p = fresh(), c0 = p.coins, n = C.payMission(p, NPCS.fatima.trades[0]);
  assert.equal(p.coins, c0 + n);
  assert.equal(C.missionCoins({ coins: 7, kind: 'show', need: {} }), 7, 'a trade can set its own amount');
});

test('litter pays per piece through the clean-up tally, up to the daily cap', () => {
  const p = fresh();
  assert.equal(C.payLitter(p).pieces, 0);
  p.steward.litter = 3;
  const r = C.payLitter(p);
  assert.equal(r.pieces, 3); assert.equal(r.amount, 3 * RATES.litterPiece);
  assert.equal(C.payLitter(p).amount, 0, 'the same pieces are not paid twice');
  p.steward.litter = 3 + 15;
  const r2 = C.payLitter(p);
  assert.equal(r2.pieces, RATES.litterDailyCap - 3, 'only the rest of today\'s cap');
  assert.ok(r2.unpaid > 0 && C.payLitter(p).capped, 'the remainder waits for tomorrow');
  nextDay(p);
  assert.equal(C.payLitter(p).pieces, Math.min(RATES.litterDailyCap, 8));
});

// ---------------------------------------------------------------- 6. the shop
test('buying spends credits, equips a rod or line, and refuses what you cannot afford', () => {
  const p = fresh(); p.coins = 500;
  identify(p, 'tailor', 'yellowfinbream', 'luderick');
  assert.equal(S.gearStats(p).rodId, 'rod-1');
  const r = S.buy(p, 'rod-2');
  assert.ok(r.ok); assert.equal(p.coins, 500 - SHOP_BY_ID['rod-2'].price);
  assert.equal(S.gearStats(p).rodId, 'rod-2', 'a new rod goes straight on');
  assert.ok(S.owns(p, 'rod-2'));
  assert.equal(S.buy(p, 'rod-2').ok, false, 'you cannot buy it twice');
  assert.ok(S.equip(p, 'rod-1') && S.gearStats(p).rodId === 'rod-1', 'you can go back to the starter rod');
  assert.equal(S.equip(p, 'rod-3'), false, 'cannot equip what you do not own');
  const poor = fresh(); poor.coins = 10; identify(poor, 'tailor', 'yellowfinbream', 'luderick');
  const no = S.buy(poor, 'rod-2'); assert.equal(no.ok, false); assert.ok(no.poor); assert.equal(poor.coins, 10, 'nothing taken');
});

test('higher tiers are locked behind Guide progress: money alone does not unlock them', () => {
  const p = fresh(); p.coins = 5000;
  for (const id of ['rod-2', 'rod-3', 'rod-4', 'line-light', 'line-strong', 'tool-finemat']) {
    const r = S.buy(p, id); assert.equal(r.ok, false, id); assert.ok(r.locked, `${id} is locked`); assert.equal(p.coins, 5000);
  }
  identify(p, 'tailor', 'yellowfinbream', 'luderick');
  assert.ok(S.buy(p, 'rod-2').ok && S.buy(p, 'line-light').ok, 'three species Identified open tier 2');
  assert.equal(S.buy(p, 'rod-3').ok, false);
  identify(p, 'sandwhiting', 'snapper', 'squid');
  assert.ok(S.buy(p, 'rod-3').ok && S.buy(p, 'line-strong').ok && S.buy(p, 'tool-finemat').ok);
  assert.equal(S.buy(p, 'rod-4').ok, false, 'the top rod needs Mastery, not just names');
  masterIt(p, 'tailor', 'yellowfinbream');
  assert.ok(S.buy(p, 'rod-4').ok);
  // every locked item states its lock plainly
  assert.match(S.canBuy(fresh(), 'rod-3').reason, /Identify 6 species/);
});

test('bait packs add to the bait stock and unlock the bait; bait is used one per bite', () => {
  const p = fresh(); p.coins = 100;
  assert.deepEqual({ prawn: S.baitCount(p, 'prawn'), beachworm: S.baitCount(p, 'beachworm') }, START_BAIT_STOCK);
  assert.equal(S.baitCount(p, 'pilchard'), 0);
  assert.ok(S.buy(p, 'pack-pilchard').ok);
  assert.equal(S.baitCount(p, 'pilchard'), 10); assert.ok(hasItem(p, 'bait-pilchard'), 'the inventory unlocks pilchard');
  assert.ok(S.buy(p, 'pack-pilchard').ok, 'a pack can be bought again');
  assert.equal(S.baitCount(p, 'pilchard'), 20);
  assert.equal(S.useBait(p, 'pilchard'), 19);
  for (let i = 0; i < 40; i++) S.useBait(p, 'pilchard');
  assert.equal(S.baitCount(p, 'pilchard'), 0, 'never below zero');
  assert.equal(S.baitReady(p, 'pilchard'), false);
  p.shop.bait.prawn = 99; p.coins = 100;
  assert.equal(S.buy(p, 'pack-prawn').ok, false, 'the tub is full');
});

test('collected bait is free but needs the right spot and item, and respects the DPIRD daily limits', () => {
  const p = fresh();
  assert.equal(COLLECT.nipper.limit, 100); assert.equal(COLLECT.beachworm.limit, 20);
  assert.equal(S.canCollect(p, 'nipper', 'seagrass').ok, false, 'a nipper pump first');
  grant(p, 'bait-nipper');
  assert.equal(S.canCollect(p, 'nipper', 'rocky').ok, false, 'nippers come from the lake flats');
  assert.equal(S.canCollect(p, 'beachworm', 'seagrass').ok, false, 'beach worms come from the beach');
  let n = 0; while (S.collect(p, 'nipper', 'seagrass').ok) n++;
  assert.equal(p.econ.collected.nipper, 100, 'the nipper limit is 100 a day'); assert.equal(n, 10);
  const before = S.baitCount(p, 'beachworm');
  while (S.collect(p, 'beachworm', 'rocky').ok);
  assert.equal(p.econ.collected.beachworm, 20, 'the beach worm limit is 20 a day');
  assert.ok(S.baitCount(p, 'beachworm') >= before);
  const c = S.collect(p, 'beachworm', 'rocky'); assert.equal(c.ok, false); assert.match(c.reason, /daily limit/);
  nextDay(p); C.today(p);
  assert.ok(S.collect(p, 'beachworm', 'rocky').ok, 'a new day, a new allowance');
  assert.equal(p.coins, fresh().coins, 'collecting costs and pays no credits');
});

test('conservation gear and cosmetics: the release weight is the same item Dr Priya gives, cosmetics carry the creator look keys', () => {
  const p = fresh(); p.coins = 300; identify(p, 'tailor', 'yellowfinbream', 'luderick', 'sandwhiting');
  assert.equal(S.gearStats(p).net, false); assert.equal(S.gearStats(p).weight, false); assert.equal(S.gearStats(p).fineMat, false);
  assert.ok(S.buy(p, 'tool-landingnet').ok && S.buy(p, 'tool-releaseweight').ok && S.buy(p, 'tool-finemat').ok);
  const g = S.gearStats(p); assert.ok(g.net && g.weight && g.fineMat);
  assert.ok(hasItem(p, 'tool-releaseweight'), 'the release step reads the inventory item');
  for (const it of SHOP.filter(i => i.cat === 'conservation')) assert.ok(it.why.length > 30, `${it.id} says why it helps fish`);
  const hat = SHOP_BY_ID['hat-sunset'];
  assert.ok(S.buy(p, 'hat-sunset').ok);
  const w = S.wear(p, 'hat-sunset'); assert.deepEqual(w.look, hat.look); assert.ok(S.equipped(p, hat));
  assert.ok(S.wear(p, 'hat-sunset').off, 'wear again to take it off');
  for (const it of SHOP.filter(i => i.cat === 'style')) for (const k of Object.keys(it.look)) assert.ok(['hatStyle', 'hat', 'shirt', 'pattern', 'rod'].includes(k), `${it.id} uses creator key ${k}`);
});

test('shop data: every tier has a price that rises, every item reads cleanly', () => {
  const rods = SHOP.filter(i => i.cat === 'rod').sort((a, b) => a.tier - b.tier);
  assert.ok(rods.length >= 3 && rods.length <= 4);
  assert.ok(rods.every((r, i) => i === 0 || (r.price > rods[i - 1].price && r.rod.zoneMul >= rods[i - 1].rod.zoneMul && (r.rod.zoneMul > rods[i - 1].rod.zoneMul || r.rod.drainMul < rods[i - 1].rod.drainMul))), 'each rod tier is dearer and better');
  const lines = SHOP.filter(i => i.cat === 'line'); assert.ok(lines.length >= 2 && lines.length <= 3);
  const light = SHOP_BY_ID['line-light'], strong = SHOP_BY_ID['line-strong'], std = SHOP_BY_ID['line-std'];
  assert.ok(light.line.shy > std.line.shy && strong.line.shy < std.line.shy, 'a real trade-off: lighter line = more shy bites, stronger line = fewer');
  assert.ok(strong.line.save > std.line.save && light.line.turnMul > std.line.turnMul);
  assert.match(light.why + light.blurb, /shy|bream|luderick/i); assert.match(strong.why + strong.blurb, /break-off|bolt/i);
  assert.equal(new Set(SHOP.map(i => i.id)).size, SHOP.length);
  for (const i of SHOP) { assert.ok(i.price >= 0 && Number.isInteger(i.price), i.id); assert.ok(i.blurb.length > 10, i.id); if (i.req) assert.ok(i.req.n > 0); }
});

// ---------------------------------------------------------------- 7. gear stats change the catch bar and the bite model
test('gear stats change the catch-bar parameters: a better rod widens the zone and slows the fish; line changes break-offs', () => {
  const stats = (rodId, lineId) => { const p = fresh(); p.shop.owned[rodId] = p.shop.owned[lineId] = 1; p.shop.equip = { rod: rodId, line: lineId }; return S.gearStats(p); };
  const bp = (gs, o = {}) => barParams({ gear: 0.8, power: 0.7, size: 50, rod: gs.rod, line: gs.line, ...o });
  const base = bp(stats('rod-1', 'line-std'));
  assert.equal(base.zoneH, barParams({ gear: 0.8, power: 0.7, size: 50 }).zoneH, 'the starter kit is exactly the old behaviour');
  let prev = base;
  for (const id of ['rod-2', 'rod-3', 'rod-4']) {
    const b = bp(stats(id, 'line-std'));
    assert.ok(b.zoneH > prev.zoneH, `${id}: a wider zone`);
    assert.ok(b.drainMul <= prev.drainMul && b.k <= prev.k, `${id}: slower fish / slower drain`);
    prev = b;
  }
  assert.ok(prev.zoneH <= TUNING.zoneCap);
  assert.ok(bp(stats('rod-1', 'line-std'), { gear: 1, power: 0 }).zoneH <= TUNING.zoneCap && barParams({ gear: 1, power: 0, rod: { zoneMul: 9 } }).zoneH === TUNING.zoneCap, 'the zone never fills the track');
  const strong = bp(stats('rod-1', 'line-strong')), light = bp(stats('rod-1', 'line-light'));
  assert.ok(strong.save > base.save && strong.turnTime < base.turnTime && strong.jetMul < 1, 'strong line: holds a bolter, turns it sooner, a smaller jet');
  assert.ok(light.save === 0 && light.turnTime > base.turnTime && light.jetMul > 1, 'light line: no save, harder to turn, a bigger jet');
});

test('the bite model: light line gets more bites from shy species; a lure colour only changes lure rigs; gear never zeroes the table', () => {
  const share = (ctx, ids) => { const w = biteWeights('jetty', { ...DEFAULT_CTX, ...ctx }), t = w.reduce((s, x) => s + x.w, 0); return w.filter(x => ids.includes(x.sp.id)).reduce((s, x) => s + x.w, 0) / t; };
  const spot = SPECIES.find(s => SHY_SPECIES.includes(s.id) && s.spots.jetty) ? 'jetty' : Object.keys(SPECIES[0].spots)[0];
  const ws = biteWeights(spot, { ...DEFAULT_CTX, shy: 1.3 }), ws1 = biteWeights(spot, { ...DEFAULT_CTX, shy: 1 }), ws0 = biteWeights(spot, { ...DEFAULT_CTX, shy: 0.8 });
  const by = (arr, id) => arr.find(x => x.sp.id === id)?.w;
  for (const id of SHY_SPECIES) { if (by(ws1, id) == null) continue; assert.ok(by(ws, id) > by(ws1, id) && by(ws0, id) < by(ws1, id), `${id} bites more on light line`); }
  const nonShy = ws.find(x => !SHY_SPECIES.includes(x.sp.id)); assert.equal(nonShy.w, ws1.find(x => x.sp.id === nonShy.sp.id).w, 'other species are untouched by the line');
  const bait = biteWeights(spot, { ...DEFAULT_CTX, lureMod: 1.15 }), lure = biteWeights(spot, { ...DEFAULT_CTX, rig: 'softplastic', bait: 'none', lureMod: 1.15 }), lure1 = biteWeights(spot, { ...DEFAULT_CTX, rig: 'softplastic', bait: 'none', lureMod: 1 });
  assert.deepEqual(bait.map(x => x.w), biteWeights(spot, DEFAULT_CTX).map(x => x.w), 'a lure colour does nothing to a bait rig');
  assert.ok(lure.every((x, i) => Math.abs(x.w - lure1[i].w * 1.15) < 1e-9), 'on a lure rig it multiplies the bite');
  assert.ok(pickCatch(spot, { ...DEFAULT_CTX, shy: 1.3, lureMod: 0.85 }, () => 0.5).id);
});

test('lure colours: a small bite modifier that varies with water clarity and time of day', () => {
  for (const c of Object.keys(FX.LURE_FX)) for (const cl of ['clear', 'stained', 'murky']) for (const t of ['dawn', 'day', 'dusk', 'night']) {
    const m = FX.lureMod(c, cl, t); assert.ok(m >= 0.85 && m <= 1.15, `${c}/${cl}/${t} ${m}`);
  }
  assert.ok(FX.lureMod('white', 'clear', 'day') > FX.lureMod('white', 'murky', 'day'), 'white wants clear water');
  assert.ok(FX.lureMod('chartreuse', 'murky', 'day') > FX.lureMod('chartreuse', 'clear', 'day'), 'chartreuse wants murky water');
  assert.ok(FX.lureMod('orange', 'stained', 'dusk') > FX.lureMod('orange', 'stained', 'day'), 'orange is best at dusk');
  const vals = new Set(); for (const c of Object.keys(FX.LURE_FX)) for (const cl of ['clear', 'stained', 'murky']) vals.add(FX.lureMod(c, cl, 'day').toFixed(3));
  assert.ok(vals.size > 4, 'it really varies');
  assert.equal(FX.clarityOf(0.5), 'clear'); assert.equal(FX.clarityOf(1.5), 'stained'); assert.equal(FX.clarityOf(2.6), 'murky');
});

// ---------------------------------------------------------------- 8. release survival
test('a release weight rescues barotrauma-prone deep-water species; handling matters for everyone', () => {
  const noW = FX.releaseSurvival('snapper', { wet: true, air: 5, weighted: false }), wt = FX.releaseSurvival('snapper', { wet: true, air: 5, weighted: true });
  assert.ok(wt.pct > noW.pct + 15, `the weight lifts survival (${noW.pct} -> ${wt.pct})`);
  assert.ok(wt.bayBonus >= 1 && noW.bayBonus === 0); assert.ok(wt.weightHelped > 0);
  assert.ok(noW.parts.some(x => /barotrauma/i.test(x.label)) && wt.parts.some(x => /release weight/i.test(x.label)));
  const shallow = FX.releaseSurvival('luderick', { wet: true, air: 5, weighted: true });
  assert.equal(shallow.bayBonus, 0, 'a shallow fish gets no weight bonus');
  assert.equal(shallow.pct, FX.releaseSurvival('luderick', { wet: true, air: 5, weighted: false }).pct, 'and no change');
  assert.ok(FX.releaseSurvival('tailor', { wet: false, air: 5 }).pct < FX.releaseSurvival('tailor', { wet: true, air: 5 }).pct, 'dry hands hurt');
  assert.ok(FX.releaseSurvival('tailor', { wet: true, air: 16 }).pct < FX.releaseSurvival('tailor', { wet: true, air: 5 }).pct, 'too long out of the water hurts');
  assert.ok(FX.releaseSurvival('tailor', { wet: true, air: 16, net: true }).parts.length, 'a net is listed');
  assert.ok(FX.releaseSurvival('tailor', { wet: true, air: 16, net: false }).pct < FX.releaseSurvival('tailor', { wet: true, air: 11, net: false }).pct, 'a dropped fish costs more');
  assert.equal(FX.releaseSurvival('luderick', { wet: true, air: 5 }).base, 99, 'DPIRD: luderick 99%');
});

// ---------------------------------------------------------------- 9. the save: v2 -> v3
test('the save migrates v2 to v3: progress kept, a small credit grant, starting bait, no double-paying old records', () => {
  const v2 = { v: 2, catches: [{ id: 'tailor', spot: 'jetty', tide: 'rising', daytime: 'day', time: 5, length: 30 }], guide: { nextN: 3, e: { tailor: { ident: true } } }, steward: { points: 4, litter: 2, checks: 1, clean: 1, fines: 0 },
    esky: [{ id: 'bonito' }], inventory: { have: { 'tool-tagkit': 1 }, cards: {}, worn: null, lure: 'white' }, npc: { day: 4, met: { mitra: 1 }, accepted: {}, done: { 'mitra-licence': 1 }, quizFail: {}, rot: {} }, angler: { name: 'Kai' }, stock: { 'jetty:tailor': 55 }, gear: { rig: 'float', bait: 'prawn' } };
  const p = migrateProgress(structuredClone(v2));
  assert.equal(p.v, 4); assert.equal(SAVE_VERSION, 4);
  assert.equal(p.coins, RATES.migrationGrant);
  assert.equal(p.catches.length, 1); assert.equal(p.guide.e.tailor.ident, true); assert.equal(p.npc.day, 4); assert.equal(p.angler.name, 'Kai'); assert.equal(p.stock['jetty:tailor'], 55);
  assert.equal(p.steward.litter, 2); assert.equal(p.steward.safety, undefined); assert.deepEqual(p.gear, { rig: 'float', bait: 'prawn' }); assert.equal(p.inventory.lure, 'white'); assert.ok(p.inventory.have['tool-tagkit']);
  assert.equal(p.esky.length, 1); assert.ok(p.npc.done['mitra-licence']);
  assert.deepEqual(p.shop.bait, START_BAIT_STOCK); assert.deepEqual(p.shop.equip, { rod: 'rod-1', line: 'line-std' });
  assert.ok(p.econ.first.tailor, 'the first-record bonus for a species you already logged is not paid again');
  assert.equal(C.payRecord(p, row({ id: 'tailor', length: 30, measured: 30, spot: 'jetty', tide: 'rising', daytime: 'day' }), true).amount, RATES.recordBase, 'only the base');
  // And it is idempotent: loading a v3 save again changes nothing.
  const again = migrateProgress(JSON.parse(JSON.stringify(p)));
  assert.equal(again.coins, p.coins); assert.deepEqual(again.shop, p.shop); assert.deepEqual(again.econ.first, p.econ.first);
});

test('a brand-new save starts at the current version (v4) with the small starting grant, the starter kit and no gear it has not earned', () => {
  const p = fresh();
  assert.equal(p.v, 4); assert.equal(p.coins, RATES.startGrant);
  assert.equal(S.gearStats(p).rodId, 'rod-1'); assert.equal(S.gearStats(p).lineId, 'line-std');
  assert.deepEqual(p.inventory.have, {});
  assert.deepEqual(p.shop.owned, {});
  assert.equal(migrateProgress(null).v, 4, 'garbage in, a clean save out');
  // A v1 (very old) save also comes through.
  const old = migrateProgress({ journal: { a: 1 }, catches: [] });
  assert.equal(old.v, 4); assert.equal(old.coins, RATES.migrationGrant); assert.deepEqual(old.journal, { a: 1 });
  // A v3 save keeps its coins and shop.
  const v3 = migrateProgress({ v: 3, coins: 77, shop: { owned: { 'rod-2': 5 }, equip: { rod: 'rod-2' }, bait: { prawn: 3 } } });
  assert.equal(v3.coins, 77); assert.equal(v3.shop.equip.rod, 'rod-2'); assert.equal(v3.shop.equip.line, 'line-std'); assert.equal(v3.shop.bait.prawn, 3);
});

test('the economy is balanced: a decent outing can afford early gear but the top rod takes real play', () => {
  const outing = 6 * RATES.recordBase + 3 * RATES.firstSpecies + 4 * RATES.newCombo + 2 * RATES.tagPay + RATES.compPrizes[1];
  assert.ok(outing >= SHOP_BY_ID['rod-2'].price && outing < SHOP_BY_ID['rod-4'].price, `an early outing earns ${outing}`);
  assert.ok(SHOP_BY_ID['rod-4'].price >= 4 * SHOP_BY_ID['rod-2'].price);
  assert.ok(ECON.SOURCES.includes('grant'));
});
