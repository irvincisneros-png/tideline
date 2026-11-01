// Phase 7: the commercial post-game (nets lab maths, quota, prices, the licence) and THE rule: fish can be sold only at the co-op, only with the commercial
// licence, and only a commercial haul. The recreational esky never sells, and the Club-credit economy has no path from a fish to credits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as K from '../src/economy/commercial.js';
import * as C from '../src/economy/coins.js';
import { COOP, GEARS, GEAR_ORDER, SCENARIOS, GROUPS, MARKET, STATUS, UPGRADES, LAB_GOALS, SAFS_NUMBERS } from '../src/content/coop.js';
import { migrateProgress } from '../src/core/save.js';
import { SPECIES } from '../src/fishing/species.js';
import { nextDay } from '../src/npc/requests.js';

const fresh = () => migrateProgress({});
const identifyAll = p => { for (const s of SPECIES) { const e = (p.guide.e[s.id] ??= {}); e.seen = { t: 1 }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; } };
const licensed = () => { const p = fresh(); p.ending.awards = 1; assert.ok(K.grantLicence(p).ok); return p; };
const sim = o => K.simulateHaul({ scenario: 'shelf', mesh: 60, ...o });

// ---------------------------------------------------------------- nets lab maths
test('nets lab: the open gap is half the stretched mesh, and a fish is kept only if it is wider than the gap', () => {
  assert.equal(K.gapOf(60), 30); assert.equal(K.gapOf(20), 10);
  assert.equal(K.retained('trawl', 40, 30), true); assert.equal(K.retained('trawl', 25, 30), false); assert.equal(K.retained('trawl', 30, 30), false, 'a fish exactly the gap size slips through');
  assert.equal(K.retained('gillnet', 40, 40), true); assert.equal(K.retained('gillnet', 10, 40), false, 'a gill net lets small fish through'); assert.equal(K.retained('gillnet', 70, 40), false, 'and bounces big fish off');
});
test('nets lab: mesh size decides who escapes (dataset E2 mesh size: too small catches the young, too big loses the target)', () => {
  const small = sim({ gear: 'trawl', mesh: 20 }), right = sim({ gear: 'trawl', mesh: 60, brd: true, ted: true }), big = sim({ gear: 'trawl', mesh: 100, brd: true, ted: true });
  assert.ok(small.counts.young > 10, 'a tiny mesh keeps the young fish');
  assert.equal(right.counts.young, 0, 'a mesh wider than the young but narrower than the adults lets the young escape');
  assert.ok(right.targetN > 40);
  assert.equal(big.targetN, 0, 'a mesh that is too big loses the target');
  // Monotonic: a bigger mesh never keeps MORE young fish.
  let prev = Infinity;
  for (let mesh = 10; mesh <= 120; mesh += 5) { const r = sim({ gear: 'trawl', mesh }); assert.ok(r.counts.young <= prev, `mesh ${mesh}`); prev = r.counts.young; }
  // The smallest mesh is for sardines.
  const sard = K.simulateHaul({ scenario: 'sardine', gear: 'purseseine', mesh: 10 }), sardBig = K.simulateHaul({ scenario: 'sardine', gear: 'purseseine', mesh: 40 });
  assert.ok(sard.targetN > 100 && sardBig.targetN === 0);
});
test('nets lab: a BRD lets non-target animals escape (and costs a little target), a TED stops turtles', () => {
  const plain = sim({ gear: 'trawl', mesh: 20 }), brd = sim({ gear: 'trawl', mesh: 20, brd: true }), ted = sim({ gear: 'trawl', mesh: 60, ted: true });
  assert.ok(brd.counts.young < plain.counts.young && brd.bycatchN < plain.bycatchN, 'BRD: less bycatch');
  assert.ok(brd.targetN >= plain.targetN * 0.9, 'and the target barely changes');
  assert.ok(plain.protectedN > 0 && sim({ gear: 'trawl', mesh: 60 }).protectedN > 0, 'a trawl without a TED catches turtles and seabirds');
  assert.equal(ted.protectedN, 0, 'a TED keeps them out');
  assert.ok(ted.counts.big < sim({ gear: 'trawl', mesh: 60 }).counts.big, 'and most big animals too');
  // The devices only apply to the gear that can carry them.
  assert.equal(sim({ gear: 'handline', brd: true, ted: true }).brd, false); assert.equal(sim({ gear: 'handline', brd: true, ted: true }).ted, false);
});
test('nets lab: gear differences follow the worksheet levels (seabed High / Low, bycatch Low / Medium-High / High)', () => {
  const r = Object.fromEntries(GEAR_ORDER.map(g => [g, sim({ gear: g, mesh: 60 })]));
  assert.equal(GEARS.trawl.seabed, 'High'); assert.equal(GEARS.handline.seabed, 'Low'); assert.equal(GEARS.longline.seabed, 'Low'); assert.equal(GEARS.trap.bycatch, 'Low'); assert.equal(GEARS.longline.bycatch, 'Medium to High');
  assert.ok(r.trawl.seabedScore > r.handline.seabedScore && r.trawl.seabedScore > r.trap.seabedScore);
  assert.ok(r.handline.bycatchShare < r.trawl.bycatchShare, 'handline is more selective than a trawl');
  assert.ok(r.handline.targetN < r.trawl.targetN, 'but lands fewer fish');
  assert.ok(r.longline.protectedN > 0 && r.handline.protectedN === 0 && r.trap.protectedN === 0, 'longline hooks seabirds and turtles; handline and trap do not');
  assert.equal(r.trap.releasedAlive, true, 'trap bycatch is released alive');
  // A purse seine is best on a school of one species.
  assert.ok(K.simulateHaul({ scenario: 'sardine', gear: 'purseseine', mesh: 10 }).bycatchShare < sim({ gear: 'purseseine', mesh: 60 }).bycatchShare + 0.05);
});
test('nets lab: the goals can be met (handline; trawl with the right mesh, BRD and TED; gill net) and are failed by a bad design', () => {
  assert.ok(K.labGoals(sim({ gear: 'handline' })).pass);
  assert.ok(K.labGoals(sim({ gear: 'trawl', mesh: 60, brd: true, ted: true })).pass);
  assert.ok(K.labGoals(sim({ gear: 'gillnet', mesh: 70 })).pass);
  assert.ok(K.labGoals(K.simulateHaul({ scenario: 'sardine', gear: 'purseseine', mesh: 10 })).pass);
  assert.equal(K.labGoals(sim({ gear: 'trawl', mesh: 60 })).pass, false, 'no TED: turtles caught');
  assert.equal(K.labGoals(sim({ gear: 'trawl', mesh: 20, brd: true, ted: true })).pass, false, 'a tiny mesh keeps young fish');
  assert.equal(K.labGoals(sim({ gear: 'longline' })).pass, false);
  // Deterministic: the same settings give the same haul.
  assert.deepEqual(sim({ gear: 'trawl', mesh: 45 }).counts, sim({ gear: 'trawl', mesh: 45 }).counts);
  // The lab certificate is saved once a design passes.
  const p = fresh(); K.markLab(p, sim({ gear: 'trawl', mesh: 60 })); assert.equal(p.coop?.labPassed?.shelf, undefined);
  K.markLab(p, sim({ gear: 'handline' })); assert.ok(p.coop.labPassed.shelf);
  for (const sc of Object.values(SCENARIOS)) for (const grp of Object.keys(sc.water)) assert.ok(GROUPS[grp], `${sc.id}.${grp}`);
  assert.deepEqual(Object.keys(LAB_GOALS).sort(), Object.keys(SCENARIOS).sort());
  assert.deepEqual([GROUPS.small.width, GROUPS.young.width, GROUPS.adult.width, GROUPS.big.width], [10, 25, 40, 70], 'the fish cards are the dataset E3 widths');
  assert.equal(SAFS_NUMBERS.sustainable + SAFS_NUMBERS.recovering + SAFS_NUMBERS.depleting + SAFS_NUMBERS.depleted + SAFS_NUMBERS.undefined + SAFS_NUMBERS.negligible, SAFS_NUMBERS.stocks, 'the six statuses add up to 503 stocks');
  assert.ok(Math.abs(316 / 503 - 0.628) < 0.001);
});

// ---------------------------------------------------------------- the licence
test('the co-op licence: offered only after a real ceremony (the 100% Caught celebration or awards night), never by 100% Identified; the start-up advance is co-op credits, not Club credits', () => {
  const p = fresh();
  assert.equal(K.coopEligible(p), false); assert.equal(K.grantLicence(p).ok, false); assert.equal(K.hasLicence(p), false);
  identifyAll(p); assert.equal(K.coopEligible(p), false, '100% Identified does NOT open it'); assert.equal(K.grantLicence(p).ok, false);
  const m = fresh(); m.ending.milestone = Date.now(); assert.equal(K.coopEligible(m), true, 'the 100% Caught celebration opens it');
  const q = fresh(); q.ending.awards = Date.now(); assert.equal(K.coopEligible(q), true, 'so does awards night');
  const clubBefore = q.coins, r = K.grantLicence(q);
  assert.ok(r.ok && K.hasLicence(q));
  assert.equal(q.coins, clubBefore, 'Club credits are untouched');
  assert.equal(q.coop.credits, K.START_ADVANCE);
  assert.equal(K.grantLicence(q).ok, false, 'signing twice does nothing');
  assert.equal(K.coopProgress(p).eligible, false);
});
test('co-op credits are a separate currency: they can come only from a sale or an advance, and they cannot be spent as Club credits', () => {
  const p = licensed(), club = p.coins;
  for (const bad of ['record', 'tag', 'comp', 'mission', 'litter', 'grant', 'fish', '', undefined]) assert.throws(() => K.addCommercial(p, 5, bad), /cannot come from/);
  assert.throws(() => K.addCommercial(p, 0, 'sale'));
  assert.deepEqual([...K.COMMERCIAL_SOURCES], ['sale', 'advance']);
  assert.throws(() => C.addCoins(p, 5, 'sale'), /cannot come from/, 'Club credits cannot be paid by a sale either');
  assert.equal(p.coins, club);
  assert.equal(K.spendCommercial(p, 9999), false);
});

// ---------------------------------------------------------------- the sell gate
test('the sell gate: impossible without the commercial licence', () => {
  const p = fresh();
  p.coop = { hold: [{ origin: 'commercial', species: 'snapper', qty: 5 }] };   // even a lot somehow in the hold
  assert.equal(K.canSell(p, p.coop.hold[0]).ok, false); assert.equal(K.canSell(p, p.coop.hold[0]).reason, 'licence');
  const r = K.sellHold(p);
  assert.equal(r.ok, false); assert.equal(r.revenue, 0);
  assert.equal(K.ensureCoop(p).credits, 0, 'nothing was paid');
  // And you cannot go fishing commercially without it either.
  const q = fresh(); assert.equal(K.runHaul(q, 'snapper').ok, false); assert.equal(K.runHaul(q, 'snapper').reason, 'licence');
});
test('the sell gate: a recreational catch never sells, with or without the licence; the esky is never an input', () => {
  const p = licensed();
  p.esky.push({ id: 'duskyflathead', label: 'Dusky flathead', length: 50, legal: true }, { id: 'snapper', label: 'Snapper', length: 40, legal: true });
  const esky0 = JSON.stringify(p.esky), coins0 = p.coins, co0 = p.coop.credits;
  assert.equal(K.canSell(p, { origin: 'recreational', species: 'snapper', qty: 2 }).reason, 'recreational');
  assert.equal(K.canSell(p, { species: 'snapper', qty: 2 }).reason, 'recreational', 'a lot with no commercial origin is refused');
  for (const lot of p.esky) assert.equal(K.canSell(p, lot).ok, false);
  const r = K.refuseEskySale(p);
  assert.equal(r.ok, false); assert.equal(r.reason, 'recreational'); assert.equal(r.sold, 0);
  p.coop.hold.push({ origin: 'recreational', species: 'snapper', qty: 5 });
  assert.equal(K.sellHold(p).revenue, 0, 'a recreational lot smuggled into the hold is not paid for');
  assert.equal(JSON.stringify(p.esky), esky0, 'the esky is untouched'); assert.equal(p.coins, coins0); assert.equal(p.coop.credits, co0);
  // The rec path still never sells: the Club-credit sources do not include a sale, and no fish-to-credit export exists anywhere.
  assert.ok(!C.SOURCES.some(s => /sale|sell|fish|esky|market/i.test(s)));
  for (const k of Object.keys(C)) assert.ok(!/sell|sale|vendor|market|fishvalue|worth/i.test(k), `coins.js export ${k}`);
});
test('static check: only economy/commercial.js can sell, only through the co-op panel, and it never touches Club credits or the esky', () => {
  const walk = (d, out = []) => { for (const f of readdirSync(new URL(d, import.meta.url), { withFileTypes: true })) { if (f.isDirectory()) walk(`${d}${f.name}/`, out); else if (f.name.endsWith('.js')) out.push(`${d}${f.name}`); } return out; };
  const files = walk('../src/'), src = f => readFileSync(new URL(f, import.meta.url), 'utf8');
  const sellers = files.filter(f => /\bsellHold\(/.test(src(f)));
  assert.deepEqual(sellers.sort(), ['../src/economy/commercial.js', '../src/ui/coop.js'].sort(), 'sellHold is defined in commercial.js and called only from the co-op panel');
  const com = src('../src/economy/commercial.js');
  assert.ok(!/addCoins|spendCoins|\.coins\b|\.esky\b/.test(com.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'commercial.js never reads or writes Club credits or the esky');
  const coins = src('../src/economy/coins.js'), store = src('../src/economy/store.js');
  assert.ok(!/commercial|coop/i.test(coins.replace(/\/\/.*$/gm, '')) && !/commercial|coop/i.test(store.replace(/\/\/.*$/gm, '')), 'the Club-credit economy knows nothing about the co-op');
  const shop = src('../src/ui/shop.js') + src('../src/economy/store.js'); assert.ok(!/from '[^']*(commercial|coop)[^']*'/.test(shop), "Mitra's shop does not import the co-op: it cannot sell fish or take co-op credits");
});

// ---------------------------------------------------------------- hauls, quota, price, sustainability
test('a haul needs a method, lands the target, costs fuel, and the hold sells for co-op credits', () => {
  const p = licensed();
  assert.equal(K.runHaul(p, 'snapper').reason, 'method');
  K.setMethod(p, { gear: 'handline', mesh: 60 });
  const c0 = p.coop.credits, r = K.runHaul(p, 'snapper');
  assert.ok(r.ok && r.landed > 0 && r.landed === r.qty);
  assert.equal(p.coop.credits, c0 - K.haulCost(p, 'handline'), 'the haul cost fuel and crew');
  assert.equal(p.coop.hold.length, 1); assert.equal(p.coop.hold[0].origin, 'commercial');
  const before = p.coop.credits, sold = K.sellHold(p);
  assert.ok(sold.ok && sold.revenue > 0); assert.equal(p.coop.credits, before + sold.revenue); assert.equal(p.coop.hold.length, 0);
  assert.equal(p.coop.landed.snapper, r.landed, 'the quota was used up when the haul was landed, and selling does not count it again');
  assert.equal(p.coins, 20, 'Club credits never move');
});
test('quota: a sustainable stock gets a bigger quota than a recovering one, a depleted stock is closed, and the quota year resets', () => {
  assert.ok(STATUS.sustainable.quota > STATUS.recovering.quota && STATUS.recovering.quota > 0 && STATUS.depleted.quota === 0);
  const p = licensed(); K.setMethod(p, { gear: 'longline', mesh: 60 });
  assert.equal(K.marketInfo('snapper').status, 'sustainable'); assert.equal(K.marketInfo('mulloway').status, 'recovering'); assert.equal(K.marketInfo('jackassmorwong').status, 'depleted');
  const closed = K.runHaul(p, 'jackassmorwong');
  assert.equal(closed.ok, false); assert.equal(closed.reason, 'closed'); assert.match(closed.text, /closure/);
  assert.equal(K.quotaLeft(p, 'jackassmorwong'), 0);
  // swaps come from dataset B1
  assert.equal(K.marketInfo('jackassmorwong').swap.id, 'snapper'); assert.equal(K.marketInfo('mulloway').swap.id, 'tailor');
  // Fill the mulloway quota: the haul that goes over is cut to what is left, then refused.
  K.addCommercial(p, 500, 'advance');
  let landed = 0;
  for (let i = 0; i < 3 && K.haulsLeftToday(p) > 0; i++) { const r = K.runHaul(p, 'mulloway'); if (!r.ok) break; landed += r.landed; K.sellHold(p); }
  assert.ok(landed <= STATUS.recovering.quota, `landed ${landed} mulloway`);
  assert.equal(K.quotaLeft(p, 'mulloway'), STATUS.recovering.quota - landed);
  // hauls per day
  nextDay(p); assert.equal(K.haulsLeftToday(p), COOP.haulsPerDay);
  for (let i = 0; i < COOP.quotaDays; i++) nextDay(p);
  assert.equal(K.quotaLeft(p, 'mulloway'), STATUS.recovering.quota, 'a new quota year resets the landed counts');
});
test('hauls are limited to three a day; a broke crew with an empty hold gets a fuel advance', () => {
  const p = licensed(); K.setMethod(p, { gear: 'handline', mesh: 60 });
  p.coop.credits = 3;
  const r = K.runHaul(p, 'seamullet'); assert.ok(r.ok, 'the advance lets a broke crew go out'); assert.ok(p.coop.log.some(l => l.note === 'fuel advance'));
  K.sellHold(p); K.addCommercial(p, 100, 'advance');
  K.runHaul(p, 'australiansalmon'); K.sellHold(p);
  K.runHaul(p, 'tailor'); assert.equal(K.runHaul(p, 'tailor').reason, 'species', 'the co-op does not buy tailor');
  K.runHaul(p, 'snapper'); K.sellHold(p);
  assert.equal(K.haulsLeftToday(p), 0);
  assert.equal(K.runHaul(p, 'kingfish').reason, 'hauls');
});
test('prices follow sustainability (sustainable pays more per fish than recovering or depleting), and refrigeration adds a premium', () => {
  const p = licensed();
  const base = id => MARKET.find(m => m.id === id).base;
  assert.ok(K.priceOf(p, 'snapper') > base('snapper'), 'a sustainable stock earns a premium');
  assert.ok(K.priceOf(p, 'mulloway') < base('mulloway'), 'a recovering stock is paid less');
  assert.ok(STATUS.sustainable.price > STATUS.recovering.price && STATUS.recovering.price > STATUS.depleting.price && STATUS.depleting.price > STATUS.depleted.price);
  const cheap = K.priceOf(p, 'snapper'); K.addCommercial(p, 500, 'advance');
  assert.ok(K.buyUpgrade(p, 'fridge').ok); assert.ok(K.priceOf(p, 'snapper') > cheap);
  assert.equal(K.buyUpgrade(p, 'fridge').reason, 'owned');
  const costBefore = K.haulCost(p, 'trawl'); assert.ok(K.buyUpgrade(p, 'gps').ok); assert.ok(K.haulCost(p, 'trawl') < costBefore);
  assert.equal(K.buyUpgrade(licensed(), 'sonar').ok, false, 'too poor');
  assert.equal(UPGRADES.length, 4);
});
test('the content is sourced: no ITQ claims, no invented GoodFish ratings', () => {
  const all = readFileSync(new URL('../src/content/coop.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/ui/coop.js', import.meta.url), 'utf8');
  assert.ok(!/ITQ|individual transferable/i.test(all), 'ITQs are not in the dataset');
  assert.ok(!/GoodFish[^.]{0,40}(green|red|amber|orange|"Eat Less"|Better Choice)/i.test(all), 'no GoodFish colour ratings');
  assert.match(all, /goodfish\.org\.au/);
  assert.match(all, /Game numbers/, 'the invented numbers are labelled');
  for (const g of Object.values(GEARS)) assert.ok(g.src && g.how, g.id);
});

test('quota is reserved at landing, including fish still in the hold: haul, haul, haul, then sell cannot beat the quota', () => {
  const p = licensed(); K.setMethod(p, { gear: 'handline', mesh: 60 }); K.addCommercial(p, 500, 'advance');
  const quota = STATUS.recovering.quota, id = 'mulloway';
  assert.equal(K.marketInfo(id).status, 'recovering');
  // The reported sequence: three handline hauls of mulloway (about 8 each) with nothing sold in between, against a quota of 8.
  const first = K.runHaul(p, id);
  assert.ok(first.ok && first.landed > 0);
  assert.equal(K.quotaLeft(p, id), quota - first.landed, 'the quota drops the moment the haul is landed, before anything is sold');
  let landed = first.landed;
  for (let i = 0; i < 2; i++) {
    const r = K.runHaul(p, id);
    if (r.ok) landed += r.landed; else assert.equal(r.reason, 'quota', 'the later hauls are stopped by the quota');
  }
  assert.ok(landed <= quota, `${landed} landed against a quota of ${quota}`);
  assert.equal(p.coop.hold.reduce((s, l) => s + l.qty, 0), landed, 'every landed fish is in the hold');
  const sold = K.sellHold(p), soldQty = sold.lines.reduce((s, l) => s + l.qty, 0);
  assert.equal(soldQty, landed); assert.ok(soldQty <= quota, 'selling never pays for more than the quota');
  assert.equal(p.coop.landed[id], landed, 'selling does not count the fish a second time');
  assert.equal(K.quotaLeft(p, id), quota - landed);
  // A bigger quota: hauls that go out together are cut to what is left, counting the fish already in the hold.
  const q = licensed(); K.setMethod(q, { gear: 'handline', mesh: 60 }); K.addCommercial(q, 500, 'advance');
  q.coop.landed.snapper = STATUS.sustainable.quota - 10;                     // 10 left in the year
  const a = K.runHaul(q, 'snapper'), b = K.runHaul(q, 'snapper');
  assert.ok(a.ok); assert.equal(a.landed, Math.min(a.qty, 10));
  assert.ok(a.landed + (b.ok ? b.landed : 0) <= 10, 'the second haul only gets what the first left');
  if (a.landed === 10) { assert.equal(b.ok, false); assert.equal(b.reason, 'quota'); }
  // An older save with an uncounted lot in the hold still has it counted against the quota.
  const old = licensed(); old.coop.hold.push({ origin: 'commercial', species: id, qty: 3, day: 1 });
  assert.equal(K.quotaLeft(old, id), quota - 3);
});
