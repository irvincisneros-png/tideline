// Local progress: the Fish Guide, the logbook (every fish you handled), the esky, steward record and stock health. No accounts, nothing leaves the device.
const KEY = 'tideline.progress.v1';
// v2 (phase 1b), all additive so old saves still load:
//   guide: { nextN, e: { speciesId: { seen, caught, photo, best, keys, ident, meas, dec, mastered, assisted?, clean?, help? } } }  (fishing/guide.js)
//     assisted/clean/help (key hints, added later) are optional: an entry without them counts as keyed cleanly, so old saves are unchanged.
//   catches: the logbook, one row per fish: { eco, id, length, kept, correct, time, spot, tide, daytime, rig, bait, n, label, measured, accurate, legal, kind, outing, wet, air }
//   esky: fish kept this outing { id, label, length, legal, kind, time }.  outing: the outing in progress { id, t0, bay0, steward0, ... }.
//   steward: { points, litter, checks, clean, fines }.  tips: one-line tips already shown.  stock: stock health (0-100) per 'spot:species'.
//   angler (phase 2): { name, skin, hairStyle, hair, beard (none|stubble|moustache|short|big), beardColor (0xRRGGBB | null = matches hair), hatStyle, hat, sunnies, pattern, shirt, shorts, rod } from the character creator; null = not made yet
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
//   fridge (release fixes): fish taken home from the esky { id, label, length, legal, day, time }; they count toward possession for FRIDGE_DAYS simulated days (economy/possession.js). catches rows also gain `day` (the simulated day the fish was handled on).
//   missions (Day 1, additive, no version bump): { cur: mission id | null, done: { missionId: t }, pin: trade id | null, legacy?: true } — the mission spine (npc/missions.js).
//   `legacy` marks a save that already had catches or Guide entries before missions existed (it gets one welcome radio line at the lake, tips.missionsHello).
//   skills (additive): { knots: { knotId: { best, ... } }, lostLine: {}, snagFreed?: n } — written by the knot and snag mechanics when they are built.
//   intro (additive): { step } — where the teachers' opening is up to ('meet' for a new save; 'done' for a save that already has catches or Guide entries).
//   catches rows gain `flow` (low | normal | high) on the river, where there is no tide: the logbook column "tide or flow" reads r.tide ?? r.flow.
import { RATES, START_BAIT_STOCK } from '../content/shop.js';
import { BEARD_IDS } from '../land/angler-defaults.js';
export const SAVE_VERSION = 4;
const blankEcon = () => ({ day: 1, speciesToday: {}, tagsToday: 0, litterToday: 0, litterPaid: 0, first: {}, combos: {}, collected: {}, comp: null, compDone: null, tags: [], lastLetterDay: 0, earned: 0, log: [] });
const blankCoop = () => ({ licence: null, credits: 0, earned: 0, hold: [], landed: {}, yearStart: 1, haulsDay: { day: 0, n: 0 }, hauls: 0, upgrades: {}, method: null, labPassed: {}, log: [] });
const blankShop = () => ({ owned: {}, equip: { rod: 'rod-1', line: 'line-std' }, worn: {}, bait: { ...START_BAIT_STOCK } });
const blank = () => ({ v: SAVE_VERSION, journal: {}, catches: [], stock: {}, steward: { points: 0, litter: 0, checks: 0, clean: 0, fines: 0 }, gear: null, guide: { nextN: 1, e: {} }, esky: [], fridge: [], outing: null, tips: {}, angler: null, inventory: { have: {}, cards: {}, worn: null, lure: null }, npc: { day: 1, met: {}, accepted: {}, done: {}, quizFail: {}, rot: {} }, coins: RATES.startGrant, econ: blankEcon(), shop: blankShop(), ending: { milestone: null, awards: null }, coop: blankCoop(), missions: { cur: null, done: {}, pin: null }, skills: { knots: {}, lostLine: {} }, intro: { step: 'meet' } });

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
/** A repair note: which field fell back to its blank value (progress.repaired, shown nowhere but kept for support and the tests). */
const note = (notes, where) => { notes.push(where); };
/** A plain object field: the saved one if it is an object, else the fallback. */
const objOr = (v, fallback, notes, where) => { if (isObj(v)) return v; if (v !== undefined) note(notes, where); return fallback; };
const arrOr = (v, notes, where) => { if (Array.isArray(v)) return v; if (v !== undefined) note(notes, where); return []; };
/** An object whose values must all pass `ok`: bad entries are dropped one by one, the good ones stay. */
const mapOf = (v, ok, notes, where) => {
  if (!isObj(v)) { if (v !== undefined) note(notes, where); return {}; }
  const out = {};
  for (const [k, x] of Object.entries(v)) { if (ok(x)) out[k] = x; else note(notes, `${where}.${k}`); }
  return out;
};
const any = () => true;

/**
 * Bring any saved progress (v1 to v4, or nothing) up to the current version. Pure: no storage.
 * Every nested field is validated on its own with a fallback to its blank value, so one malformed field (an `econ.first: null`) costs only that field and never the whole save.
 * The names of the fields that fell back are listed in `p.repaired`.
 */
export function migrateProgress(saved) {
  saved = isObj(saved) ? saved : {};
  const notes = [], fresh = Object.keys(saved).length === 0, b = blank(), p = { ...b, ...saved };
  const run = (where, fn) => { try { fn(); } catch { note(notes, where); } };
  // --- the simple top-level fields
  p.journal = objOr(saved.journal, b.journal, notes, 'journal');
  p.catches = arrOr(saved.catches, notes, 'catches').filter(isObj);
  p.stock = mapOf(saved.stock, isNum, notes, 'stock');
  p.esky = arrOr(saved.esky, notes, 'esky').filter(isObj);
  p.fridge = arrOr(saved.fridge, notes, 'fridge').filter(isObj);
  p.tips = objOr(saved.tips, b.tips, notes, 'tips');
  p.gear = isObj(saved.gear) ? saved.gear : null;
  p.outing = isObj(saved.outing) ? saved.outing : null;
  p.angler = isObj(saved.angler) ? saved.angler : null;
  // Facial hair (added after v4, additive): a saved angler from before it gets no beard, and a bad value falls back the same way. beardColor null = matches the hair.
  if (p.angler) {
    const a = p.angler, okColour = isNum(a.beardColor) && a.beardColor >= 0 && a.beardColor <= 0xffffff;
    p.angler = { ...a, beard: BEARD_IDS.includes(a.beard) ? a.beard : 'none', beardColor: okColour ? a.beardColor : null };
  }
  p.steward = { ...b.steward, ...objOr(saved.steward, {}, notes, 'steward') };
  // --- the Fish Guide
  run('guide', () => {
    const g = objOr(saved.guide, null, notes, 'guide') ?? {};
    p.guide = { ...b.guide, ...g, nextN: isNum(g.nextN) ? g.nextN : 1, e: mapOf(g.e, isObj, notes, 'guide.e') };
  });
  // --- the inventory and the people
  run('inventory', () => {
    const v = objOr(saved.inventory, {}, notes, 'inventory');
    p.inventory = { ...b.inventory, ...v, have: mapOf(v.have, any, notes, 'inventory.have'), cards: mapOf(v.cards, any, notes, 'inventory.cards') };
    if (typeof p.inventory.worn !== 'string') p.inventory.worn = null;
    if (typeof p.inventory.lure !== 'string') p.inventory.lure = null;
  });
  run('npc', () => {
    const v = objOr(saved.npc, {}, notes, 'npc');
    p.npc = { ...b.npc, ...v, day: isNum(v.day) && v.day >= 1 ? v.day : 1 };
    for (const k of ['met', 'accepted', 'done', 'quizFail', 'rot']) p.npc[k] = mapOf(v[k], any, notes, `npc.${k}`);
    if (isObj(v.heard)) p.npc.heard = v.heard; else delete p.npc.heard;
  });
  // --- the economy
  run('econ', () => {
    const v = objOr(saved.econ, {}, notes, 'econ');
    p.econ = { ...b.econ, ...v };
    p.econ.day = isNum(v.day) && v.day >= 1 ? v.day : 1;
    for (const k of ['tagsToday', 'litterToday', 'litterPaid', 'lastLetterDay', 'earned']) if (!isNum(p.econ[k])) { if (v[k] !== undefined) note(notes, `econ.${k}`); p.econ[k] = 0; }
    p.econ.speciesToday = mapOf(v.speciesToday, isNum, notes, 'econ.speciesToday');
    p.econ.first = mapOf(v.first, any, notes, 'econ.first');
    p.econ.combos = mapOf(v.combos, any, notes, 'econ.combos');
    p.econ.collected = mapOf(v.collected, isNum, notes, 'econ.collected');
    p.econ.tags = arrOr(v.tags, notes, 'econ.tags').filter(isObj);
    p.econ.log = arrOr(v.log, notes, 'econ.log').filter(isObj);
    p.econ.comp = isObj(v.comp) ? v.comp : null; p.econ.compDone = isObj(v.compDone) ? v.compDone : null;
  });
  run('shop', () => {
    const v = objOr(saved.shop, {}, notes, 'shop');
    p.shop = { ...b.shop, ...v };
    p.shop.equip = { ...b.shop.equip, ...mapOf(v.equip, x => typeof x === 'string', notes, 'shop.equip') };
    p.shop.owned = mapOf(v.owned, any, notes, 'shop.owned'); p.shop.worn = mapOf(v.worn, any, notes, 'shop.worn');
    p.shop.bait = isObj(v.bait) ? mapOf(v.bait, isNum, notes, 'shop.bait') : { ...START_BAIT_STOCK };
  });
  // --- missions, skills and the intro (added after v4; each field is checked on its own, a bad one falls back to its blank value)
  run('missions', () => {
    const v = objOr(saved.missions, {}, notes, 'missions'), had = p.catches.length > 0 || Object.keys(p.guide?.e ?? {}).length > 0;
    p.missions = { cur: typeof v.cur === 'string' ? v.cur : null, done: mapOf(v.done, isNum, notes, 'missions.done'), pin: typeof v.pin === 'string' ? v.pin : null };
    if (v.legacy === true || (!isObj(saved.missions) && !fresh && had)) p.missions.legacy = true;
  });
  run('skills', () => {
    const v = objOr(saved.skills, {}, notes, 'skills');
    p.skills = { ...v, knots: mapOf(v.knots, isObj, notes, 'skills.knots'), lostLine: mapOf(v.lostLine, any, notes, 'skills.lostLine') };
    if (v.snagFreed !== undefined) { if (isNum(v.snagFreed) && v.snagFreed >= 0) p.skills.snagFreed = v.snagFreed; else { delete p.skills.snagFreed; note(notes, 'skills.snagFreed'); } }
  });
  run('intro', () => {
    const v = objOr(saved.intro, null, notes, 'intro');
    const had = p.catches.length > 0 || Object.keys(p.guide?.e ?? {}).length > 0;
    p.intro = v && typeof v.step === 'string' ? { ...v } : { step: had ? 'done' : 'meet' };
    if (v && v.step !== undefined && typeof v.step !== 'string') note(notes, 'intro.step');
  });
  run('ending', () => {
    const v = objOr(saved.ending, {}, notes, 'ending');
    p.ending = { milestone: isNum(v.milestone) ? v.milestone : null, awards: isNum(v.awards) ? v.awards : null };
  });
  run('coop', () => {
    const v = objOr(saved.coop, {}, notes, 'coop');
    p.coop = { ...b.coop, ...v };
    p.coop.haulsDay = { ...b.coop.haulsDay, ...objOr(v.haulsDay, {}, notes, 'coop.haulsDay') };
    for (const k of ['hold', 'log']) p.coop[k] = arrOr(v[k], notes, `coop.${k}`).filter(isObj);
    for (const k of ['landed', 'upgrades', 'labPassed']) p.coop[k] = mapOf(v[k], any, notes, `coop.${k}`);
    p.coop.licence = isObj(v.licence) ? v.licence : null; p.coop.method = isObj(v.method) ? v.method : null;
    if (!isNum(p.coop.credits)) p.coop.credits = 0; if (!isNum(p.coop.earned)) p.coop.earned = 0;
  });
  if (!fresh && (saved.v ?? 1) < 3) {
    // v2 -> v3: keep everything, add a small credit grant and the starting bait, and mark what the logbook already covers so it does not pay again.
    run('v3', () => {
      p.coins = Math.max(Number.isFinite(saved.coins) ? saved.coins : 0, RATES.migrationGrant);
      p.shop.bait = { ...START_BAIT_STOCK, ...(isObj(saved.shop?.bait) ? p.shop.bait : {}) };
      for (const c of p.catches) {
        if (c.id && !p.econ.first[c.id]) p.econ.first[c.id] = c.time ?? 1;
        if (c.id) p.econ.combos[`${c.id}|${c.spot}|${c.tide ?? c.flow}|${c.daytime}`] = c.time ?? 1;
      }
      p.migratedFrom = saved.v ?? 1;
    });
  }
  if (!Number.isFinite(p.coins)) { if (saved.coins !== undefined) note(notes, 'coins'); p.coins = fresh ? RATES.startGrant : 0; }
  if (notes.length) p.repaired = [...new Set([...(Array.isArray(saved.repaired) ? saved.repaired : []), ...notes])].slice(-40); else if (!Array.isArray(saved.repaired)) delete p.repaired;
  p.v = SAVE_VERSION;
  return p;
}

const BACKUPS = 3;
/** Keep the raw text of a save we could not read under its own key (never the live one), so nothing is lost when the blank game later overwrites the live key. Keeps the newest few. */
export function backupRaw(raw, reason = '', storage = globalThis.localStorage) {
  try {
    if (!raw || !storage) return null;
    const key = `${KEY}.backup.${Date.now()}`;
    storage.setItem(key, JSON.stringify({ at: Date.now(), reason: String(reason).slice(0, 200), raw }));
    const old = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(k => k?.startsWith(`${KEY}.backup.`)).sort();
    for (const k of old.slice(0, Math.max(0, old.length - BACKUPS))) storage.removeItem(k);
    return key;
  } catch { return null; }
}

/** Load the saved progress. If the save cannot be read or migrated, the original raw text is copied to a separate backup key BEFORE anything is written, then a blank game starts. */
export function loadProgress() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    return migrateProgress(JSON.parse(raw || '{}'));
  } catch (e) {
    if (raw) backupRaw(raw, e?.message ?? 'unreadable save');
    return blank();
  }
}
export function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); return true; }
  catch {
    // Quota: drop the oldest photos and retry once.
    try {
      const photos = [...Object.values(p.journal ?? {}), ...Object.values(p.guide?.e ?? {})].filter(e => e.photo).sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
      for (const e of photos.slice(0, Math.ceil(photos.length / 2))) delete e.photo;
      localStorage.setItem(KEY, JSON.stringify(p)); return 'trimmed';   // saved, but only after dropping the older half of the photos
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
