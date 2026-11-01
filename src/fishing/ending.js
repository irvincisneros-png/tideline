// The endings, as pure functions on the saved progress object (no DOM). Unit-tested in tests/ending.test.mjs.
//
//   * MILESTONE (a softer ceremony): every kind of fish in the Fish Guide has been Caught at least once (100% Caught).
//   * AWARDS NIGHT (the ending): every kind of fish Mastered (100% Mastered) AND Bay Health at or above BAY_THRESHOLD. Depleted stocks keep the last rare fish
//     out of reach until the bay recovers, so releasing the small ones is part of the finish.
// Both ceremonies are shown once (progress.ending = { milestone: t, awards: t }) and can be replayed from Bev's menu. After either, the player keeps playing.
import { SPECIES } from './species.js';
import * as G from './guide.js';

/** Bay Health (0-100) needed for awards night. A new save starts at about 70.4 (the native stocks, no Steward bonus yet). Good practice (releases handled well, tagging, litter,
 *  legal keeps only) earns a Steward bonus of up to +5.4, so a player who masters every kind of fish the right way clears it without any grinding (tests/ending.test.mjs plays one through). */
export const BAY_THRESHOLD = 73;

export function ensureEnding(p) { p.ending ??= { milestone: null, awards: null }; p.ending.milestone ??= null; p.ending.awards ??= null; return p.ending; }

const count = (p, min) => SPECIES.filter(s => G.atLeast(G.tierOf(p, s.id), min)).length;
export const caughtAll = p => count(p, 'caught') === SPECIES.length;
export const masteredAll = p => count(p, 'mastered') === SPECIES.length;

/** Where the player stands on both endings. */
export function endingStatus(p) {
  const total = SPECIES.length, parts = G.bayParts(p), bay = parts.total, caught = count(p, 'caught'), mastered = count(p, 'mastered');
  const milestone = caught === total, bayOk = bay >= BAY_THRESHOLD;
  return { total, caught, mastered, bay, bayStock: parts.stock, bayBonus: parts.bonus, bayNeed: BAY_THRESHOLD, bayOk, milestone, awards: mastered === total && bayOk,
    missing: SPECIES.filter(s => G.tierOf(p, s.id) !== 'mastered').map(s => s.id) };
}
/** Which ceremony is waiting to be shown (awards first), or null. Each one is offered once. */
export function pendingCeremony(p) {
  const e = ensureEnding(p), s = endingStatus(p);
  if (s.awards && !e.awards) return 'awards';
  if (s.milestone && !e.milestone) return 'milestone';
  return null;
}
/** Remember a ceremony was shown. Awards night covers the milestone too (you have obviously caught every fish), so the smaller one is never owed after it. */
export function markCeremony(p, kind, now = Date.now()) { const e = ensureEnding(p); e[kind] ??= now; if (kind === 'awards') e.milestone ??= now; }

/** The player's own numbers for the award speeches. */
export function playerStats(p) {
  const rows = p.catches ?? [], st = p.steward ?? {}, s = endingStatus(p);
  const releases = rows.filter(c => c.kept === false);
  const best = SPECIES.reduce((m, sp) => { const b = G.entryOf(p, sp.id)?.best ?? 0; return b > m.cm ? { cm: b, id: sp.id } : m; }, { cm: 0, id: null });
  return {
    fish: rows.length, releases: releases.length, quickReleases: releases.filter(c => c.wet !== false && typeof c.air === 'number' && c.air <= 10).length,
    accurate: rows.filter(c => c.accurate === true).length, measured: rows.filter(c => c.measured != null).length,
    correct: rows.filter(c => c.correct).length, litter: st.litter ?? 0, tags: p.econ?.tags?.length ?? 0, safety: st.safety ?? 0,
    clean: st.clean ?? 0, fines: st.fines ?? 0, stars: G.stewardRating(p).value, bay: s.bay, mastered: s.mastered, caught: s.caught, total: s.total,
    identified: count(p, 'identified'), best, name: p.angler?.name?.trim() || 'Angler',
  };
}
