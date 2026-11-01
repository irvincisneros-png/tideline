// The commercial post-game, as pure functions on the saved progress object (no DOM): the co-op licence, the nets-lab simulation, the quota, and the
// ONE place in the whole game where a fish can be sold. Unit-tested in tests/commercial.test.mjs.
//
// THE RULES THE GAME TEACHES
//   * NSW recreational fishers can never sell their catch. Nothing in coins.js (Club credits) turns a fish into money, and nothing here does either:
//     the esky is never an input to a sale (`refuseEskySale` always refuses).
//   * A commercial licence is a different job. With the co-op licence you can land COMMERCIAL HAULS (made with your chosen gear in the nets lab) and sell them at
//     the co-op, inside a quota. Co-op credits are a separate currency (`progress.coop.credits`) from Club credits (`progress.coins`).
//
//   progress.coop = { licence: { t, day } | null, credits, earned, hold: [lot], landed: { speciesId: n }, yearStart, haulsDay, hauls, upgrades: { id: t },
//                     method: { gear, mesh, brd, ted } | null, labPassed: { scenario: t }, log: [] }
//   lot = { origin: 'commercial', species, qty, gear, day, cost, bycatch, discards }
import { COOP, GROUPS, SCENARIOS, GEARS, SEABED_SCORE, BRD_INFO, TED_INFO, MESH_TEXT, LAB_GOALS, MARKET, STATUS, UPGRADES, UPGRADE_FX } from '../content/coop.js';
import { SPECIES, SPECIES_BY_ID } from '../fishing/species.js';
import * as G from '../fishing/guide.js';
import { ensureNpc } from '../npc/requests.js';

export const COMMERCIAL_SOURCES = ['sale', 'advance'];
export const START_ADVANCE = 30;       // the co-op's start-up advance when you sign the licence
const RESCUE = 10;                      // if the crew is broke and the hold is empty, the co-op lends a day's fuel
const CHEAPEST = Math.min(...Object.values(GEARS).map(g => g.cost));

export function ensureCoop(p) {
  const c = p.coop ??= {};
  c.licence ??= null; c.credits = Number.isFinite(c.credits) ? c.credits : 0; c.earned ??= 0;
  c.hold ??= []; c.landed ??= {}; c.yearStart ??= 1; c.haulsDay ??= { day: 0, n: 0 }; c.hauls ??= 0;
  c.upgrades ??= {}; c.method ??= null; c.labPassed ??= {}; c.log ??= [];
  return c;
}
export const hasLicence = p => !!p.coop?.licence;
const day = p => ensureNpc(p).day;

// ------------------------------------------------------------------ who may apply
/** Every kind of fish is at least Identified in the Fish Guide. */
export function allIdentified(p) { return SPECIES.every(s => G.atLeast(G.tierOf(p, s.id), 'identified')); }
/** Nell offers the licence after the awards night, or once every species is Identified. */
export function coopEligible(p) { return !!p.ending?.awards || allIdentified(p); }
export function coopProgress(p) {
  const n = SPECIES.filter(s => G.atLeast(G.tierOf(p, s.id), 'identified')).length;
  return { identified: n, total: SPECIES.length, awards: !!p.ending?.awards, eligible: coopEligible(p) };
}
/** Sign the licence (only if eligible). The co-op lends a small start-up advance of co-op credits. */
export function grantLicence(p) {
  if (!coopEligible(p)) return { ok: false, reason: 'not-eligible' };
  const c = ensureCoop(p);
  if (c.licence) return { ok: false, reason: 'already' };
  c.licence = { t: Date.now(), day: day(p) }; c.yearStart = day(p);
  addCommercial(p, START_ADVANCE, 'advance', 'start-up advance');
  return { ok: true };
}

// ------------------------------------------------------------------ co-op credits (NOT Club credits)
/** Pay co-op credits. Only the named commercial sources may pay, and never Club credits (progress.coins is not touched). */
export function addCommercial(p, amount, source, note = '') {
  if (!COMMERCIAL_SOURCES.includes(source)) throw new Error(`Co-op credits cannot come from "${source}"`);
  amount = Math.round(amount);
  if (!(amount > 0)) throw new Error('A payment must be a positive number of credits');
  const c = ensureCoop(p);
  c.credits += amount; c.earned += amount;
  c.log.push({ t: Date.now(), day: day(p), src: source, amt: amount, note }); if (c.log.length > 40) c.log.splice(0, c.log.length - 40);
  return c.credits;
}
export function spendCommercial(p, amount) {
  const c = ensureCoop(p); amount = Math.round(amount);
  if (!(amount >= 0) || c.credits < amount) return false;
  c.credits -= amount; return true;
}

// ------------------------------------------------------------------ the nets lab
const clamp01 = v => Math.max(0, Math.min(1, v));
/** The open gap (mm) of the relaxed diamond for a stretched mesh size (a game simplification: half the stretched measure). */
export const gapOf = mesh => mesh * MESH_TEXT.gapShare;
export const groupName = (scenario, grp) => SCENARIOS[scenario].names?.[grp] ?? GROUPS[grp].name;

/** Does a fish of this width stay in a net with this gap? A gill net holds fish about the size of the gap; other nets keep anything wider than the gap. */
export function retained(gear, width, gap) {
  if (GEARS[gear].gill) return width >= gap * 0.85 && width <= gap * 1.5;
  return width > gap;
}

/**
 * Run one haul in the nets lab. Deterministic: the expected catch of a game sample of animals (SCENARIOS[..].water).
 * settings = { scenario, gear, mesh (stretched mm), brd, ted }. Returns the counts per group, the target and bycatch totals and the seabed impact.
 *   nets:  sweep × (kept by the mesh) for each group; a BRD lets non-target animals slip out; a TED stops turtles and most big animals.
 *   hooks and traps: the share of each group that takes the hook or enters the trap (game numbers; the worksheet gives only the levels Low / Medium-High).
 */
export function simulateHaul({ scenario = 'shelf', gear = 'trawl', mesh = 60, brd = false, ted = false } = {}) {
  const sc = SCENARIOS[scenario], g = GEARS[gear];
  if (!sc || !g) throw new Error('Unknown scenario or gear');
  const useBrd = !!(brd && g.brd), useTed = !!(ted && g.ted), gap = gapOf(mesh), counts = {};
  for (const [grp, n] of Object.entries(sc.water)) {
    const w = GROUPS[grp].width;
    let share;
    if (g.kind === 'net') {
      share = g.sweep * (retained(gear, w, gap) ? 1 : 0) * (g.groupMul?.[grp] ?? 1);
      if (useBrd) share *= grp === sc.target ? 1 - BRD_INFO.targetLoss : 1 - BRD_INFO.escape;
      if (useTed) { if (grp === 'protected') share = 0; else if (grp === 'big') share *= 1 - TED_INFO.bigEscape; }
    } else share = g.pick[grp] ?? 0;
    counts[grp] = Math.round(n * share);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0), targetN = counts[sc.target] ?? 0, bycatchN = total - targetN;
  const seabed = g.seabed ?? null, seabedScore = SEABED_SCORE[seabed] ?? 1;
  const res = {
    scenario, gear, mesh, brd: !!useBrd, ted: !!useTed, gap, counts, total, targetN, bycatchN,
    bycatchShare: total ? bycatchN / total : 0,
    youngN: counts.young,
    protectedN: counts.protected, seabed, seabedScore, releasedAlive: !!g.releasedAlive,
  };
  res.notes = hints(res);
  return res;
}

/** Plain-English lessons for a haul (each is the worksheet's own point). */
function hints(r) {
  const g = GEARS[r.gear], sc = SCENARIOS[r.scenario], tw = GROUPS[sc.target].width, out = [];
  if (g.kind === 'net' && !g.gill) {
    if (r.gap >= tw) out.push({ tone: 'bad', text: `The mesh is too big: the gap (${r.gap} mm) is wider than the fish you want (${tw} mm), so they swim straight through. A mesh that is too big loses the target.` });
    else if (r.gap < GROUPS.young.width && sc.target === 'adult') out.push({ tone: 'bad', text: `The mesh is too small: the gap (${r.gap} mm) is narrower than the young fish (${GROUPS.young.width} mm), so you keep fish that have not yet bred. A mesh that is too small catches unwanted small fish.` });
    else if (sc.target === 'adult') out.push({ tone: 'good', text: `The gap (${r.gap} mm) is wider than the young fish (${GROUPS.young.width} mm) but narrower than the adults (${tw} mm): the young escape to grow and breed.` });
    else if (sc.target === 'small' && r.gap < tw) out.push({ tone: 'good', text: `The smallest mesh is for sardines: a gap of ${r.gap} mm is narrower than a ${tw} mm sardine.` });
  }
  if (g.gill) out.push({ tone: 'neutral', text: 'A gill net holds the fish whose body is about as wide as the gap. Smaller fish swim through and bigger fish bump off, so the mesh decides the size you catch.' });
  if (r.gear === 'trawl') {
    if (!r.brd) out.push({ tone: 'bad', text: 'No bycatch reduction device. A BRD lets unwanted animals escape and is compulsory in all NSW ocean and estuary prawn trawl nets.' });
    if (!r.ted && r.protectedN > 0) out.push({ tone: 'bad', text: `${r.protectedN} turtles and seabirds in the net. A TED (a grid with an escape hole) stops turtles getting in.` });
    out.push({ tone: 'neutral', text: 'A trawl net is towed along the seabed, so it disturbs the seabed (High in the worksheets).' });
  }
  if (r.gear === 'longline' && r.protectedN > 0) out.push({ tone: 'bad', text: `The hooks caught ${r.protectedN} seabirds and turtles, and ${r.counts.big} sharks and rays (bycatch Medium to High).` });
  if (r.gear === 'purseseine') out.push({ tone: r.scenario === 'sardine' ? 'good' : 'bad', text: r.scenario === 'sardine' ? 'A purse seine round one species of schooling fish lands a lot with little bycatch. It can overfish, which is why quotas matter.' : 'A purse seine works best on a school of one species. In a mix of fish it keeps everything wider than the mesh.' });
  if (r.gear === 'handline') out.push({ tone: 'good', text: 'A handline is very selective: you choose what to keep and very little else is caught, but you land fewer fish.' });
  if (r.gear === 'trap') out.push({ tone: 'good', text: 'Animals you do not want can be released alive from a trap. Pots can be lost, though.' });
  if (r.youngN > LAB_GOALS[r.scenario].youngMax && sc.target === 'adult') out.push({ tone: 'bad', text: `${r.youngN} young fish caught. They have not bred yet; landing them hurts the stock.` });
  return out;
}

/** The lab's goals for a scenario and whether a result meets each (game targets). */
export function labGoals(r) {
  const goal = LAB_GOALS[r.scenario], sc = SCENARIOS[r.scenario];
  const list = [
    { id: 'target', text: `Land at least ${goal.target} ${groupName(r.scenario, sc.target).toLowerCase()}`, ok: r.targetN >= goal.target, have: r.targetN },
    { id: 'young', text: sc.target === 'adult' ? `Catch no more than ${goal.youngMax} young fish` : `Catch no more than ${goal.youngMax} ${groupName(r.scenario, 'young').toLowerCase()}`, ok: r.counts.young <= goal.youngMax, have: r.counts.young },
    { id: 'protected', text: 'Catch no turtles or seabirds', ok: r.protectedN <= goal.protectedMax, have: r.protectedN },
    { id: 'bycatch', text: `Keep bycatch under ${Math.round(goal.bycatchMax * 100)}% of the haul`, ok: r.bycatchShare <= goal.bycatchMax, have: Math.round(r.bycatchShare * 100) },
  ];
  return { list, pass: list.every(x => x.ok) };
}
/** Record that the player met a scenario's goals (the "lab certificate"). */
export function markLab(p, r) {
  const c = ensureCoop(p), gl = labGoals(r);
  if (gl.pass) c.labPassed[r.scenario] ??= Date.now();
  return gl;
}
/** Use these settings as the boat's fishing method for hauls. */
export function setMethod(p, { gear, mesh, brd, ted }) {
  if (!GEARS[gear]) return false;
  ensureCoop(p).method = { gear, mesh: Math.max(10, Math.min(120, Math.round(mesh))), brd: !!brd && GEARS[gear].brd, ted: !!ted && GEARS[gear].ted };
  return true;
}

// ------------------------------------------------------------------ the market, the quota and the price
/** What the co-op knows about a species it can land: name, SAFS status and what that means, the swap (dataset B1), base price. */
export function marketInfo(id) {
  const m = MARKET.find(x => x.id === id);
  if (!m) return null;
  const sp = SPECIES_BY_ID[id], status = m.status ?? sp?.status ?? 'undefined', st = STATUS[status] ?? STATUS.undefined;
  return { id, name: m.name ?? sp?.name ?? id, scenario: m.scenario, base: m.base, status, st, statusNote: m.statusNote ?? sp?.statusNote ?? '', swap: sp?.swap ?? null };
}
/** A new quota year starts every COOP.quotaDays in-game days: the landed counts reset. */
export function quotaTick(p) {
  const c = ensureCoop(p), d = day(p);
  if (d - c.yearStart >= COOP.quotaDays) { c.yearStart = d - ((d - c.yearStart) % COOP.quotaDays); c.landed = {}; }
  return c;
}
export function quotaDaysLeft(p) { const c = quotaTick(p); return Math.max(1, COOP.quotaDays - (day(p) - c.yearStart)); }
export function quotaLeft(p, id) {
  const c = quotaTick(p), m = marketInfo(id);
  if (!m) return 0;
  return Math.max(0, m.st.quota - (c.landed[id] ?? 0));
}
/** Credits per fish: base × the status price × fresh (refrigeration). */
export function priceOf(p, id) {
  const m = marketInfo(id), fx = ensureCoop(p).upgrades;
  return m.base * m.st.price * (fx.fridge ? UPGRADE_FX.fridge.price : 1);
}
export function haulCost(p, gear) {
  const fx = ensureCoop(p).upgrades;
  return Math.round(GEARS[gear].cost * (fx.gps ? UPGRADE_FX.gps.cost : 1) * (fx.autopilot ? UPGRADE_FX.autopilot.cost : 1));
}
export function haulsLeftToday(p) {
  const c = ensureCoop(p), d = day(p);
  return c.haulsDay.day === d ? Math.max(0, COOP.haulsPerDay - c.haulsDay.n) : COOP.haulsPerDay;
}

/**
 * Go out and land a commercial haul of `species` with the boat's method (set in the nets lab). The fish go into the hold; sell them at the co-op.
 * Refused without the licence, with no method, with a closed (depleted) species, out of hauls for the day, or without the fuel money.
 */
export function runHaul(p, speciesId) {
  const c = quotaTick(p);
  if (!c.licence) return { ok: false, reason: 'licence', text: 'You need the co-op licence to fish commercially.' };
  const m = marketInfo(speciesId);
  if (!m) return { ok: false, reason: 'species', text: 'The co-op does not buy that.' };
  if (!c.method) return { ok: false, reason: 'method', text: 'Choose your fishing method in the nets lab first.' };
  if (m.st.quota <= 0) return { ok: false, reason: 'closed', text: `${m.name} is ${m.st.label.toLowerCase()} in this fishery. The co-op will not land it: a closure protects the stock while it rebuilds.` };
  if (quotaLeft(p, speciesId) <= 0) return { ok: false, reason: 'quota', text: `You have used your ${m.st.quota}-fish quota for ${m.name} this quota year. It resets in ${quotaDaysLeft(p)} day${quotaDaysLeft(p) > 1 ? 's' : ''}.` };
  if (haulsLeftToday(p) <= 0) return { ok: false, reason: 'hauls', text: 'The crew has done three hauls today. Head home (end the outing) and start a new day.' };
  const cost = haulCost(p, c.method.gear);
  if (c.credits < cost) {
    if (!c.hold.length && c.credits < CHEAPEST) addCommercial(p, RESCUE, 'advance', 'fuel advance');
    if (c.credits < cost) return { ok: false, reason: 'afford', text: `A ${GEARS[c.method.gear].name.toLowerCase()} haul costs ${cost} co-op credits for fuel and crew. You have ${c.credits}.` };
  }
  const r = simulateHaul({ scenario: m.scenario, ...c.method });
  const qty = Math.round(r.targetN * (c.upgrades.sonar ? UPGRADE_FX.sonar.target : 1)), left = quotaLeft(p, speciesId), land = Math.min(qty, left);
  spendCommercial(p, cost);
  c.haulsDay = { day: day(p), n: (c.haulsDay.day === day(p) ? c.haulsDay.n : 0) + 1 }; c.hauls++;
  if (land > 0) c.hold.push({ origin: 'commercial', species: speciesId, qty: land, gear: c.method.gear, day: day(p), cost, bycatch: r.bycatchN, young: r.youngN, protectedN: r.protectedN });
  return { ok: true, haul: r, qty, landed: land, overQuota: qty - land, cost, speciesId, text: '' };
}

// ------------------------------------------------------------------ selling (the only place in the game)
/** Can this lot be sold? Only a commercial lot, and only with the licence. A recreational catch is refused with its own reason. */
export function canSell(p, lot) {
  if (!hasLicence(p)) return { ok: false, reason: 'licence', text: 'You need the co-op licence to sell fish.' };
  if (!lot || lot.origin !== 'commercial') return { ok: false, reason: 'recreational', text: 'Recreational catch can never be sold, even with a commercial licence.' };
  if (!(lot.qty > 0)) return { ok: false, reason: 'empty', text: 'Nothing to sell.' };
  return { ok: true };
}
/** Sell everything in the hold at the co-op. Quota was checked when the fish were landed. Returns { ok, lines, revenue }. */
export function sellHold(p) {
  const c = ensureCoop(p);
  if (!hasLicence(p)) return { ok: false, reason: 'licence', text: 'You need the co-op licence to sell fish.', lines: [], revenue: 0 };
  const lines = [];
  let revenue = 0;
  for (const lot of c.hold) {
    const gate = canSell(p, lot);
    if (!gate.ok) continue;
    const unit = priceOf(p, lot.species), amt = Math.round(unit * lot.qty), m = marketInfo(lot.species);
    revenue += amt; c.landed[lot.species] = (c.landed[lot.species] ?? 0) + lot.qty;
    lines.push({ species: lot.species, name: m.name, qty: lot.qty, unit, amount: amt, status: m.status });
  }
  c.hold = [];
  if (revenue > 0) addCommercial(p, revenue, 'sale', 'co-op sale');
  return { ok: true, lines, revenue };
}
/** The recreational esky is never for sale. Always refuses and changes nothing. */
export function refuseEskySale(p) {
  return { ok: false, reason: 'recreational', text: 'Recreational catch can never be sold, even with a commercial licence.', sold: 0 };
}

// ------------------------------------------------------------------ boat upgrades (on-board technology)
export function buyUpgrade(p, id) {
  const c = ensureCoop(p), u = UPGRADES.find(x => x.id === id);
  if (!u) return { ok: false, reason: 'unknown' };
  if (c.upgrades[id]) return { ok: false, reason: 'owned' };
  if (!spendCommercial(p, u.price)) return { ok: false, reason: 'afford', text: `${u.name} costs ${u.price} co-op credits. You have ${c.credits}.` };
  c.upgrades[id] = Date.now();
  return { ok: true };
}
