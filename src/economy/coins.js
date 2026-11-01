// Club credits: where they come from and how they are capped. Pure functions on the saved progress object (no DOM), unit-tested in tests/economy.test.mjs.
//
// THE RULE THE GAME TEACHES: NSW recreational fishers cannot sell their catch. So there is NO function here, or anywhere, that turns a fish into credits.
// Credits are paid only for the sources in SOURCES: records (citizen science), tags, recaptures, club comps, missions and litter. `addCoins` refuses any other source,
// and a kept fish pays exactly the same as a released one (the record pays for the data and the right decision, not for the fish).
//
//   progress.coins           credits in hand
//   progress.econ            { day, speciesToday: {id: n}, tagsToday, litterToday, litterPaid, first: {id: t}, combos: {key: t}, collected: {bait: n},
//                              comp: { day, id, at } | null, compDone: { day, id, place, prize } | null, tags: [..], lastLetterDay, earned, log: [..] }
//   progress.shop            { owned: {itemId: t}, equip: { rod, line }, worn: { hat, shirt, rodcol }, bait: {baitId: n} }   (economy/store.js)
import { RATES } from '../content/shop.js';
import { SPECIES_BY_ID } from '../fishing/species.js';
import { ensureNpc } from '../npc/requests.js';

export const SOURCES = ['record', 'tag', 'recapture', 'comp', 'mission', 'litter', 'grant'];
export const SOURCE_LABEL = { record: 'Logbook record', tag: 'Tag and release', recapture: 'Tag recapture', comp: 'Club comp', mission: 'Mission', litter: 'Litter pulled', grant: 'Starting credits' };

export function ensureEcon(p) {
  p.coins = Number.isFinite(p.coins) ? p.coins : 0;
  const e = p.econ ??= {};
  e.day ??= 1; e.speciesToday ??= {}; e.tagsToday ??= 0; e.litterToday ??= 0; e.litterPaid ??= 0;
  e.first ??= {}; e.combos ??= {}; e.collected ??= {}; e.tags ??= []; e.earned ??= 0; e.log ??= [];
  e.comp ??= null; e.compDone ??= null; e.lastLetterDay ??= 0;
  return e;
}
/** The economy counters for the current in-game day (they reset when the day number moves on: heading home, or midnight). */
export function today(p) {
  const e = ensureEcon(p), day = ensureNpc(p).day;
  if (e.day !== day) { e.day = day; e.speciesToday = {}; e.tagsToday = 0; e.litterToday = 0; e.collected = {}; }
  return e;
}

/** Pay credits. Only a named SOURCE may pay, and only a positive whole amount. Returns the new balance. */
export function addCoins(p, amount, source, note = '') {
  if (!SOURCES.includes(source)) throw new Error(`Credits cannot come from "${source}"`);
  amount = Math.round(amount);
  if (!(amount > 0)) throw new Error('A payment must be a positive number of credits');
  const e = ensureEcon(p);
  p.coins += amount; e.earned += amount;
  e.log.push({ t: Date.now(), day: e.day, src: source, amt: amount, note });
  if (e.log.length > 60) e.log.splice(0, e.log.length - 60);
  return p.coins;
}
/** Spend credits (the shop). Returns false (and changes nothing) if you cannot afford it. */
export function spendCoins(p, amount) {
  ensureEcon(p); amount = Math.round(amount);
  if (!(amount >= 0) || p.coins < amount) return false;
  p.coins -= amount; return true;
}

// ================================================================== 1. logbook records (citizen science)
/**
 * Pay for one finished logbook row. row = { id, measured, accurate, correct, spot, tide, daytime }; identified = the species is named (Identified or Mastered in the guide).
 * A complete record = species identified + a measure within 1 cm + the right keep-or-release call. Bonuses: the first record of a species, and a new
 * spot / tide / time-of-day combination for that species. At most RATES.speciesDailyCap records of one species pay per in-game day.
 * Returns { amount, parts: [[label, n]], why }. `why` says what was missing (or that the day's cap is reached).
 */
export function payRecord(p, row, identified) {
  const e = today(p), sp = SPECIES_BY_ID[row.id];
  if (!identified) return { amount: 0, parts: [], why: 'Name the fish with the key first: only an identified species counts as a record.' };
  if (row.measured == null || !row.accurate) return { amount: 0, parts: [], why: 'Measure within 1 cm to earn the record payment. Scientists need accurate numbers.' };
  if (!row.correct) return { amount: 0, parts: [], why: 'A record needs the right keep-or-release call.' };
  const n = e.speciesToday[row.id] ?? 0;
  if (n >= RATES.speciesDailyCap) return { amount: 0, parts: [], capped: true, why: `Scientists already have ${RATES.speciesDailyCap} ${sp?.name ?? row.id} records for today. Log a different species, or come back tomorrow.` };
  e.speciesToday[row.id] = n + 1;
  const parts = [['Logbook record', RATES.recordBase]];
  if (!e.first[row.id]) { e.first[row.id] = Date.now(); parts.push(['First record of this species', RATES.firstSpecies]); }
  const key = comboKey(row);
  if (!e.combos[key]) { e.combos[key] = Date.now(); parts.push(['New spot, tide and time', RATES.newCombo]); }
  const amount = parts.reduce((s, x) => s + x[1], 0);
  addCoins(p, amount, 'record', `${sp?.name ?? row.id} ${row.length} cm`);
  return { amount, parts, why: '' };
}
export const comboKey = r => `${r.id}|${r.spot}|${r.tide}|${r.daytime}`;

// ================================================================== 2. tag and release
/** A tagged fish counts for pay when it is legal size, released (not kept), and handled well: wet hands and 10 s or less out of the water. */
export const sizeLegal = kind => !['undersize', 'oversize', 'protected'].includes(kind);
export function payTag(p, row) {
  const e = today(p), sp = SPECIES_BY_ID[row.id];
  if (!row.tagged || row.kept) return { amount: 0, parts: [], why: '' };
  if (!sizeLegal(row.kind)) return { amount: 0, parts: [], why: 'Tagging pays for legal-size fish: an undersize or protected fish is left alone and released.' };
  const no = `T-${1000 + e.tags.length + 1}`;
  e.tags.push({ no, id: row.id, day: ensureNpc(p).day, t: row.time, length: row.length, spot: row.spot, recaptured: false });
  if (!row.wet || (row.air ?? 99) > 10) return { amount: 0, parts: [], tag: no, why: 'Tagged, but it was handled roughly (wet hands, 10 s or less), so there is no tagging payment.' };
  if (e.tagsToday >= RATES.tagDailyCap) return { amount: 0, parts: [], tag: no, capped: true, why: `Tagging pays for ${RATES.tagDailyCap} fish a day. Tag no. ${no} still goes in the database.` };
  e.tagsToday++;
  addCoins(p, RATES.tagPay, 'tag', `${sp?.name ?? row.id} tag ${no}`);
  return { amount: RATES.tagPay, parts: [['Tag and release', RATES.tagPay]], tag: no, why: '' };
}

/**
 * A tag recapture letter. Tagged fish from an earlier in-game day may be caught again by another angler. Chance per outing (rnd() < RATES.recaptureChance),
 * at most one letter a day. Returns the letter (and pays the bonus) or null.
 */
export function recaptureLetter(p, rnd = Math.random) {
  const e = today(p), day = ensureNpc(p).day;
  if (e.lastLetterDay === day) return null;
  const open = e.tags.filter(t => !t.recaptured && t.day < day);
  if (!open.length || rnd() >= RATES.recaptureChance) return null;
  const tag = open[Math.floor(rnd() * open.length) % open.length];
  tag.recaptured = true; e.lastLetterDay = day;
  const sp = SPECIES_BY_ID[tag.id], days = day - tag.day;
  const grew = Math.min(3, Math.max(0, Math.round(days * 0.4 + rnd())));
  const km = Math.round(1 + rnd() * (sp?.habitat === 'pelagic' ? 120 : 14));
  const place = ['Port Kembla', 'Shellharbour', 'Kiama', 'Wollongong Harbour', 'Bulli', 'Lake Illawarra entrance'][Math.floor(rnd() * 6) % 6];
  addCoins(p, RATES.recapture, 'recapture', `tag ${tag.no}`);
  return { tag, species: sp?.name ?? tag.id, days, grew, km, place, bonus: RATES.recapture };
}

// ================================================================== 3. club comps (Bev)
/** The comp of the day rotates with the in-game day. score(rows) works on the logbook rows from this entry on. */
const released = r => r.kept === false && r.wet === true && (r.air ?? 99) <= 10;
export const COMPS = [
  { id: 'species', title: 'Most species released', unit: 'species',
    blurb: 'Catch and release as many different species as you can this outing. Each one must be released with wet hands and in 10 seconds or less.',
    score: rows => new Set(rows.filter(released).map(r => r.id)).size, rivals: [3, 2, 1] },
  { id: 'flathead', title: 'Longest legal dusky flathead, measured', unit: 'cm',
    blurb: 'The longest dusky flathead inside the legal slot (36 to 70 cm), measured within 1 cm on the brag mat. Release it or keep it, as long as the call is right.',
    score: rows => Math.max(0, ...rows.filter(r => r.id === 'duskyflathead' && r.accurate && r.correct && r.legal !== false).map(r => r.length)), rivals: [52, 44, 38] },
  { id: 'accurate', title: 'Most accurate measures', unit: 'measures',
    blurb: 'Every measure within 1 cm counts, on any species. In a comp, a centimetre lost on the ruler can lose you the day.',
    score: rows => rows.filter(r => r.accurate === true).length, rivals: [4, 3, 2] },
];
export const RIVALS = ['Kerry', 'Gaz', 'Jun'];
export const compOfDay = day => COMPS[(day - 1) % COMPS.length];
/** Rival scores for the day (a small deterministic wobble so the board is not the same every time). */
export function rivalScores(comp, day) {
  return comp.rivals.map((s, i) => Math.max(1, s + ((day * (i + 2)) % 3) - 1));
}
/** Enter today's comp (free, once a day). Returns the entry, or null if you already entered or finished today. */
export function enterComp(p, now = Date.now()) {
  const e = today(p), day = ensureNpc(p).day, c = compOfDay(day);
  if (e.comp?.day === day || e.compDone?.day === day) return null;
  e.comp = { day, id: c.id, at: now, outing: p.outing?.id ?? null };
  return e.comp;
}
export const compRows = (p, comp) => (p.catches ?? []).filter(r => r.time >= comp.at);
export function compStanding(p) {
  const e = today(p), day = ensureNpc(p).day;
  const entry = e.comp && e.comp.day === day ? e.comp : null;
  const c = compOfDay(day), rivals = rivalScores(c, day);
  if (!entry) return { entered: false, comp: c, rivals };
  const score = c.score(compRows(p, entry));
  const place = 1 + rivals.filter(r => r > score).length;
  return { entered: true, comp: c, rivals, score, place, prize: score > 0 ? RATES.compPrizes[Math.min(place, RATES.compPrizes.length) - 1] : 0 };
}
/** End of the outing: score the comp, place you against the rivals and pay the prize. Returns the result or null (no entry). One payout per comp. */
export function settleComp(p) {
  const e = today(p), day = ensureNpc(p).day;
  if (!e.comp || e.comp.day !== day) return null;
  const st = compStanding(p);
  const res = { id: st.comp.id, title: st.comp.title, unit: st.comp.unit, score: st.score, place: st.place, rivals: st.rivals, prize: st.prize };
  e.compDone = { day, ...res }; e.comp = null;
  if (res.prize > 0) addCoins(p, res.prize, 'comp', `${st.comp.title}, place ${st.place}`);
  return res;
}

// ================================================================== 4. missions
/** Modest credits on top of a mission's item reward. trade.coins overrides. */
export function missionCoins(trade) {
  if (trade.coins != null) return trade.coins;
  if (trade.kind === 'quiz') return RATES.quizPerQuestion * trade.quiz.length;
  const n = trade.need ?? {};
  const bonus = { masteredCount: 10, mastered: 10, identifiedCount: 5, accurateSlot: 5, taggedReleases: 5, catchSize: 5, caughtSpecies: 5 }[n.type] ?? 0;
  return RATES.showBase + bonus;
}
export function payMission(p, trade) { const n = missionCoins(trade); addCoins(p, n, 'mission', trade.title); return n; }

// ================================================================== 5. litter (Fatima's clean-up tally)
/** Pieces of litter you have pulled out of the water that Fatima has not paid for yet (today's cap not yet applied). */
export const litterUnpaid = p => Math.max(0, (p.steward?.litter ?? 0) - ensureEcon(p).litterPaid);
export function payLitter(p) {
  const e = today(p), room = Math.max(0, RATES.litterDailyCap - e.litterToday), n = Math.min(litterUnpaid(p), room);
  if (n <= 0) return { pieces: 0, amount: 0, unpaid: litterUnpaid(p), capped: litterUnpaid(p) > 0 && room === 0 };
  e.litterToday += n; e.litterPaid += n;
  const amount = n * RATES.litterPiece;
  addCoins(p, amount, 'litter', `${n} pieces`);
  return { pieces: n, amount, unpaid: litterUnpaid(p), capped: litterUnpaid(p) > 0 };
}
