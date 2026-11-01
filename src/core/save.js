// Local progress: the Fish Guide, the logbook (every fish you handled), the esky, steward record and stock health. No accounts, nothing leaves the device.
const KEY = 'tideline.progress.v1';
// v2 (phase 1b), all additive so old saves still load:
//   guide: { nextN, e: { speciesId: { seen, caught, photo, best, keys, ident, meas, dec, mastered } } }  (fishing/guide.js)
//   catches: the logbook, one row per fish: { eco, id, length, kept, correct, time, spot, tide, daytime, rig, bait, n, label, measured, accurate, legal, kind, outing, wet, air }
//   esky: fish kept this outing { id, label, length, legal, kind, time }.  outing: the outing in progress { id, t0, bay0, steward0, ... }.
//   steward: { points, litter, checks, clean, fines }.  tips: one-line tips already shown.  stock: stock health (0-100) per 'spot:species'.
//   angler (phase 2): { name, skin, hairStyle, hair, hatStyle, hat, sunnies, pattern, shirt, shorts, rod } from the character creator; null = not made yet
//   (an older save has none, so the creator opens once before the next outing).
//   inventory (phase 3): { have: { itemId: t }, cards: { sea country card id: t }, worn: hat item id | null, lure: lure colour id | null } — rewards from the coast's people
//   (content/items.js). New saves start with only paternoster, running sinker, unweighted + prawn and beach worm; the rest unlock through trades.
//   npc (phase 3): { day, met: { npcId: t }, accepted: { tradeId: t }, done: { tradeId: t }, quizFail: { tradeId: day }, rot: { key: n } } — the people's conversations and requests.
//   steward.safety (phase 3): marks for staying on the rock platform in a big swell after the lifeguard's warning.
//   journal: the old field guide (kept for the animal cards).  gear: last rig and bait.
//   v3 (phase 4, the economy; migrated from v2, which keeps all its progress):
//   coins: Club credits in hand (earned only from records, tags, comps, missions and litter: economy/coins.js; there is no way to sell a fish).
//   econ: the earning counters (economy/coins.js ensureEcon).   shop: { owned, equip: { rod, line }, worn: { hat, shirt, rodcol }, bait: { baitId: n } } (economy/store.js).
//   An older save gets RATES.migrationGrant credits and the starting bait stock; its logbook seeds the "first record" and "new combination" bonuses so nothing is paid twice.
//   v4 (phase 7, the endings and the commercial post-game; migrated from v3, which keeps everything and only gains these two fields):
//   ending: { milestone: t | null, awards: t | null } — the club ceremonies already shown (fishing/ending.js). A save that already meets a trigger shows its ceremony at the next head-home.
//   coop: the co-op licence, co-op credits (a SEPARATE currency from Club credits), the hold, quota counters, boat upgrades and the chosen fishing method (economy/commercial.js ensureCoop).
//   catches rows gain `flow` (low | normal | high) on the river, where there is no tide: the logbook column "tide or flow" reads r.tide ?? r.flow.
import { RATES, START_BAIT_STOCK } from '../content/shop.js';
export const SAVE_VERSION = 4;
const blankEcon = () => ({ day: 1, speciesToday: {}, tagsToday: 0, litterToday: 0, litterPaid: 0, first: {}, combos: {}, collected: {}, comp: null, compDone: null, tags: [], lastLetterDay: 0, earned: 0, log: [] });
const blankCoop = () => ({ licence: null, credits: 0, earned: 0, hold: [], landed: {}, yearStart: 1, haulsDay: { day: 0, n: 0 }, hauls: 0, upgrades: {}, method: null, labPassed: {}, log: [] });
const blankShop = () => ({ owned: {}, equip: { rod: 'rod-1', line: 'line-std' }, worn: {}, bait: { ...START_BAIT_STOCK } });
const blank = () => ({ v: SAVE_VERSION, journal: {}, catches: [], stock: {}, steward: { points: 0, litter: 0, checks: 0, clean: 0, fines: 0 }, gear: null, guide: { nextN: 1, e: {} }, esky: [], outing: null, tips: {}, angler: null, inventory: { have: {}, cards: {}, worn: null, lure: null }, npc: { day: 1, met: {}, accepted: {}, done: {}, quizFail: {}, rot: {} }, coins: RATES.startGrant, econ: blankEcon(), shop: blankShop(), ending: { milestone: null, awards: null }, coop: blankCoop() });

/** Bring any saved progress (v1 to v4, or nothing) up to the current version. Pure: no storage. */
export function migrateProgress(saved) {
  saved = saved && typeof saved === 'object' ? saved : {};
  const fresh = !saved || Object.keys(saved).length === 0, b = blank(), p = { ...b, ...saved };
  p.steward = { ...b.steward, ...(saved.steward ?? {}) };
  p.econ = { ...b.econ, ...(saved.econ ?? {}) };
  p.shop = { ...b.shop, ...(saved.shop ?? {}) };
  p.shop.equip = { ...b.shop.equip, ...(saved.shop?.equip ?? {}) };
  p.shop.owned ??= {}; p.shop.worn ??= {}; p.shop.bait ??= { ...START_BAIT_STOCK };
  p.ending = { ...b.ending, ...(saved.ending ?? {}) };
  p.coop = { ...b.coop, ...(saved.coop ?? {}) };
  p.coop.haulsDay = { ...b.coop.haulsDay, ...(saved.coop?.haulsDay ?? {}) };
  for (const k of ['hold', 'log']) if (!Array.isArray(p.coop[k])) p.coop[k] = [];
  for (const k of ['landed', 'upgrades', 'labPassed']) if (!p.coop[k] || typeof p.coop[k] !== 'object') p.coop[k] = {};
  if (!fresh && (saved.v ?? 1) < 3) {
    // v2 -> v3: keep everything, add a small credit grant and the starting bait, and mark what the logbook already covers so it does not pay again.
    p.coins = Math.max(Number.isFinite(saved.coins) ? saved.coins : 0, RATES.migrationGrant);
    p.shop.bait = { ...START_BAIT_STOCK, ...(saved.shop?.bait ?? {}) };
    for (const c of saved.catches ?? []) {
      if (c.id && !p.econ.first[c.id]) p.econ.first[c.id] = c.time ?? 1;
      if (c.id) p.econ.combos[`${c.id}|${c.spot}|${c.tide ?? c.flow}|${c.daytime}`] = c.time ?? 1;
    }
    p.migratedFrom = saved.v ?? 1;
  }
  if (!Number.isFinite(p.coins)) p.coins = 0;
  p.v = SAVE_VERSION;
  return p;
}

export function loadProgress() {
  try { return migrateProgress(JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { return blank(); }
}
export function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); return true; }
  catch {
    // Quota: drop the oldest photos and retry once.
    try {
      const photos = [...Object.values(p.journal ?? {}), ...Object.values(p.guide?.e ?? {})].filter(e => e.photo).sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
      for (const e of photos.slice(0, Math.ceil(photos.length / 2))) delete e.photo;
      localStorage.setItem(KEY, JSON.stringify(p)); return true;
    } catch { return false; }
  }
}
export function resetProgress() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = rows => rows.map(r => r.map(q).join(',')).join('\n');
const day = t => new Date(t ?? Date.now()).toISOString().slice(0, 10);

/** The logbook as CSV (numeracy: length vs measured, legal size, where, when, kept or released). Row = one fish. */
export function logbookCSV(p, spotLabel = k => k) {
  const who = p.angler?.name?.trim() || 'Angler';
  const rows = [['angler', 'date', 'spot', 'tide or river flow', 'time of day', 'species', 'length cm', 'your measure cm', 'accurate', 'kept or released', 'legal to keep', 'why not', 'rig', 'bait']];
  for (const c of p.catches ?? []) {
    rows.push([who, day(c.time), spotLabel(c.spot), c.tide ?? c.flow ?? '', c.daytime ?? '', c.label ?? c.id, c.length, c.measured ?? '', c.measured == null ? '' : c.accurate ? 'yes' : 'no', c.kept ? 'kept' : 'released', c.legal === undefined ? (c.correct ? 'yes' : 'no') : c.legal ? 'yes' : 'no', c.legal === false ? c.kind ?? '' : '', c.rig ?? '', c.bait ?? '']);
  }
  return csv(rows);
}
/** The Fish Guide as CSV: one row per species with its tier (class data). */
export function guideCSV(p, rowsFn) { return csv([['species', 'scientific name', 'tier', 'longest cm', 'accurate measures', 'correct decisions'], ...rowsFn(p)]); }
/** Older name kept for callers: the logbook export. */
export const progressCSV = logbookCSV;
