// The Illawarra Fish Guide: tiers per species, completion, Bay Health and the Steward rating. Pure functions on the saved progress object
// (core/save.js), so they are unit-tested without a browser (tests/guide.test.mjs).
//
// Tiers: seen (silhouette and a where/when hint) -> caught ("Unknown fish #n") -> identified (named by solving the key) -> mastered
// (an accurate brag-mat measure, within 1 cm, AND a correct keep/release decision; reveals status, swap, rules and fact).
// The decision that counts toward Mastery is either keeping a legal fish, or releasing a fish that was illegal to keep (undersize, over the
// slot, over the bag or possession limit, protected). Releasing a legal fish is always allowed and neutral, but does not count, so Mastery
// cannot be won by releasing everything. Protected species are mastered by a correct release only (keeping one is never correct).
import { SPECIES, SPECIES_BY_ID, SPOT_INFO, REGIONS, speciesInRegion } from './species.js';
import { stockOf } from './catches.js';

export const TIERS = ['unseen', 'seen', 'caught', 'identified', 'mastered'];
export const TIER_LABEL = { unseen: 'Not seen yet', seen: 'Seen', caught: 'Caught', identified: 'Identified', mastered: 'Mastered' };
export const TIER_POINTS = { unseen: 0, seen: 0.1, caught: 0.3, identified: 0.6, mastered: 1 };
export const ACCURATE_CM = 1; // a reading within 1 cm of the true length is "Accurate"

/** The guide record (created on demand): progress.guide = { nextN, e: { speciesId: entry } }.
 *  entry = { seen: { t, src }, caught: { t, n, count }, photo, best, keys: [{ as, t }], ident, meas: { n, acc }, dec: { ok, bad }, mastered: t } */
export function ensureGuide(p) {
  p.guide ??= { nextN: 1, e: {} };
  p.guide.e ??= {}; p.guide.nextN ??= 1;
  return p.guide;
}
export const entryOf = (p, id) => p.guide?.e?.[id] ?? null;
const entryFor = (p, id) => (ensureGuide(p).e[id] ??= {});

/** Mark a species as Seen (a school nearby, an NPC's gossip later). Returns true if it is new. src: 'school' | 'npc:<name>' | ... */
export function markSeen(p, id, src = 'school') {
  if (!SPECIES_BY_ID[id]) return false;
  const e = entryFor(p, id);
  if (e.seen) return false;
  e.seen = { t: Date.now(), src };
  return true;
}

/** Record a landed fish. Gives the species its "Unknown fish #n" number the first time. Returns the entry. */
export function recordCatch(p, id, { length, photo } = {}) {
  const g = ensureGuide(p), e = entryFor(p, id);
  if (!e.caught) e.caught = { t: Date.now(), n: g.nextN++, count: 0 };
  e.caught.count++;
  if (!e.seen) e.seen = { t: Date.now(), src: 'caught' };
  if (length && length > (e.best ?? 0)) { e.best = length; if (photo) e.photo = photo; } else if (photo && !e.photo) e.photo = photo;
  return e;
}

/** Attach the picture taken as the fish was held up: the first one, or one for a catch at least as long as the best so far. */
export function setPhoto(p, id, photo, length = 0) {
  const e = entryOf(p, id);
  if (!e || !photo || (e.photo && length < (e.best ?? 0))) return false;
  e.photo = photo; return true;
}

/** Record one run through the key ('catch' or 'guide' re-key). Returns { correct }. A correct key names the species for good; a wrong one
 *  is kept as that wrong name until the player re-keys it. */
export function recordKey(p, id, as, src = 'catch') {
  const e = entryFor(p, id);
  (e.keys ??= []).push({ as, t: Date.now(), src });
  if (as === id) e.ident = true;
  checkMastery(p, id);
  return { correct: as === id };
}

export function recordMeasure(p, id, accurate) {
  const e = entryFor(p, id);
  e.meas ??= { n: 0, acc: 0 };
  e.meas.n++; if (accurate) e.meas.acc++;
  checkMastery(p, id);
}
/** Does this keep-or-release call count toward Mastery? A legal keep, or a release of a fish that was not legal to keep. */
export const masteryDecision = (keep, legal) => (keep ? !!legal : !legal);
export const MASTERY_HINT = 'Mastery needs a legal keep, or a correct release of a fish you couldn\'t keep.';

/** correct = the call was not wrong (steward practice). counts = it also qualifies for Mastery (default: same as correct). A neutral call
 *  (releasing a legal fish) is tallied separately as dec.neutral. */
export function recordDecision(p, id, correct, counts = correct) {
  const e = entryFor(p, id);
  e.dec ??= { ok: 0, bad: 0 };
  if (counts) e.dec.ok++; else if (correct) e.dec.neutral = (e.dec.neutral ?? 0) + 1; else e.dec.bad++;
  checkMastery(p, id);
}

/** Mastered = identified (the key was solved) + an accurate measure + a qualifying decision (see masteryDecision). */
export function checkMastery(p, id) {
  const e = entryOf(p, id);
  if (!e || e.mastered) return;
  if (e.ident && (e.meas?.acc ?? 0) > 0 && (e.dec?.ok ?? 0) > 0) e.mastered = Date.now();
}

/** The "doesn't match: re-key it" flag: the player's key answers disagree between catches, or all the other mastery checks are done
 *  but the fish was never identified correctly. */
export function needsRekey(p, id) {
  const e = entryOf(p, id);
  if (!e || e.ident || !e.keys?.length) return null;
  if (new Set(e.keys.map(k => k.as)).size > 1) return 'Your keyed answers do not agree between catches.';
  if ((e.meas?.acc ?? 0) > 0 && (e.dec?.ok ?? 0) > 0) return 'Mastery check failed: your measure and your decision were good, but the name you keyed does not match the fish.';
  return null;
}

export function tierOf(p, id) {
  const e = entryOf(p, id);
  if (!e) return 'unseen';
  if (e.mastered) return 'mastered';
  if (e.ident) return 'identified';
  if (e.caught) return 'caught';
  if (e.seen) return 'seen';
  return 'unseen';
}
export const atLeast = (tier, min) => TIERS.indexOf(tier) >= TIERS.indexOf(min);

/** What the guide calls this species: its real name once identified, else "Unknown fish #n" (or "Not seen yet"). */
export function labelOf(p, id) {
  const e = entryOf(p, id), t = tierOf(p, id);
  if (atLeast(t, 'identified')) return SPECIES_BY_ID[id].name;
  if (e?.caught) return `Unknown fish #${e.caught.n}`;
  return t === 'seen' ? 'Unseen fish' : '???';
}
/** The name the player gave it (their latest key answer) while it is not identified, else null. */
export function keyedAs(p, id) {
  const e = entryOf(p, id);
  if (!e || e.ident || !e.keys?.length) return null;
  return SPECIES_BY_ID[e.keys.at(-1).as]?.name ?? null;
}

/** Per-region counters ("Lake Illawarra 3/12": species Identified or better) and the overall completion % (tier points, 0..100). */
export function regionCounts(p) {
  return Object.entries(REGIONS).map(([key, r]) => {
    const list = speciesInRegion(key), tiers = list.map(s => tierOf(p, s.id));
    return { key, label: r.label, total: list.length, done: tiers.filter(t => atLeast(t, 'identified')).length, mastered: tiers.filter(t => t === 'mastered').length };
  });
}
export function completion(p) {
  const sum = SPECIES.reduce((a, s) => a + TIER_POINTS[tierOf(p, s.id)], 0);
  return Math.round(sum / SPECIES.length * 100);
}

/** Bay Health (0-100): the mean stock health over every species at every spot where it lives. */
export function bayHealth(p) {
  let sum = 0, n = 0;
  for (const s of SPECIES) for (const spot of Object.keys(s.spots)) { sum += stockOf(p.stock, spot, s.id); n++; }
  return n ? sum / n : 0;
}
export const bayLabel = v => (v >= 75 ? 'Thriving' : v >= 60 ? 'Healthy' : v >= 45 ? 'Under pressure' : 'Struggling');

/**
 * Steward rating 1..5. Built from the good-practice ratio of every fish handled (a correct keep or release, and a proper wet-hands release),
 * litter pulled out of the water, and Fisheries Officer checks. A starting prior (3 good of 4) keeps a new player near 3 stars.
 *   score = 0.6 * practice + 0.15 * litter (10 pieces = full marks) + 0.25 * officer (clean checks), stars = 1 + 4 * score, less a fifth of a star for each fine beyond your clean checks.
 */
export function stewardRating(p) {
  const rows = p.catches ?? [], st = p.steward ?? {};
  let good = 3, total = 4;
  for (const c of rows) {
    total++; if (c.correct) good++;
    if (c.kept === false && c.wet !== undefined) { total++; if (c.wet && (c.air ?? 0) <= 10) good++; } // handled the release well
  }
  const practice = good / total, litter = Math.min(1, (st.litter ?? 0) / 10);
  const officer = ((st.clean ?? 0) + 1) / ((st.clean ?? 0) + (st.fines ?? 0) + 2);
  const score = Math.max(0, Math.min(1, 0.6 * practice + 0.15 * litter + 0.25 * officer));
  const fined = Math.min(1, 0.2 * Math.max(0, (st.fines ?? 0) - (st.clean ?? 0)));   // each fine beyond your clean checks costs a fifth of a star
  return { value: Math.max(1, 1 + 4 * score - fined), practice, litter, officer };
}
export const starsText = v => { const n = Math.max(1, Math.min(5, Math.round(v))); return '★'.repeat(n) + '☆'.repeat(5 - n); };
