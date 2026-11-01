// Local progress: the Fish Guide, the logbook (every fish you handled), the esky, steward record and stock health. No accounts, nothing leaves the device.
const KEY = 'tideline.progress.v1';
// v2 (phase 1b), all additive so old saves still load:
//   guide: { nextN, e: { speciesId: { seen, caught, photo, best, keys, ident, meas, dec, mastered } } }  (fishing/guide.js)
//   catches: the logbook, one row per fish: { eco, id, length, kept, correct, time, spot, tide, daytime, rig, bait, n, label, measured, accurate, legal, kind, outing, wet, air }
//   esky: fish kept this outing { id, label, length, legal, kind, time }.  outing: the outing in progress { id, t0, bay0, steward0, ... }.
//   steward: { points, litter, checks, clean, fines }.  tips: one-line tips already shown.  stock: stock health (0-100) per 'spot:species'.
//   angler (phase 2): { name, skin, hairStyle, hair, hatStyle, hat, sunnies, pattern, shirt, shorts, rod } from the character creator; null = not made yet
//   (an older save has none, so the creator opens once before the next outing).
//   journal: the old field guide (kept for the animal cards).  gear: last rig and bait.
const blank = () => ({ v: 2, journal: {}, catches: [], stock: {}, steward: { points: 0, litter: 0, checks: 0, clean: 0, fines: 0 }, gear: null, guide: { nextN: 1, e: {} }, esky: [], outing: null, tips: {}, angler: null });

export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}'), p = { ...blank(), ...saved };
    p.steward = { ...blank().steward, ...(saved.steward ?? {}) };
    p.v = 2;
    return p;
  } catch { return blank(); }
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
  const rows = [['angler', 'date', 'spot', 'tide', 'time of day', 'species', 'length cm', 'your measure cm', 'accurate', 'kept or released', 'legal to keep', 'why not', 'rig', 'bait']];
  for (const c of p.catches ?? []) {
    rows.push([who, day(c.time), spotLabel(c.spot), c.tide ?? '', c.daytime ?? '', c.label ?? c.id, c.length, c.measured ?? '', c.measured == null ? '' : c.accurate ? 'yes' : 'no', c.kept ? 'kept' : 'released', c.legal === undefined ? (c.correct ? 'yes' : 'no') : c.legal ? 'yes' : 'no', c.legal === false ? c.kind ?? '' : '', c.rig ?? '', c.bait ?? '']);
  }
  return csv(rows);
}
/** The Fish Guide as CSV: one row per species with its tier (class data). */
export function guideCSV(p, rowsFn) { return csv([['species', 'scientific name', 'tier', 'longest cm', 'accurate measures', 'correct decisions'], ...rowsFn(p)]); }
/** Older name kept for callers: the logbook export. */
export const progressCSV = logbookCSV;
