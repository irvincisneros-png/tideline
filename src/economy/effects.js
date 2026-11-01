// What the Phase 3 "toys" now do: lure colours change the bite a little (with water clarity and time of day), and a released fish has a survival
// estimate that depends on how you handled it, with the release weight rescuing deep-water (barotrauma-prone) fish. Pure functions, unit-tested.
import { SPECIES_BY_ID } from '../fishing/species.js';

// ------------------------------------------------------------------ lure colours (tackle box, kept from Fatima's "Lure colours" pack)
/** Water clarity from the swell (wash stirs up sand and silt): clear below 1.1 m, stained to 2 m, murky above. */
export const clarityOf = swell => (swell < 1.1 ? 'clear' : swell < 2.0 ? 'stained' : 'murky');
export const CLARITY_LABEL = { clear: 'clear water', stained: 'stained water', murky: 'murky water' };
/** Each colour's small bite bonus (+) or penalty (-) by water clarity and time of day. Sum is clamped to +-0.15. */
export const LURE_FX = {
  pink: { stained: 0.08, dawn: 0.04, dusk: 0.03, clear: -0.02, hint: 'Pink is good in stained water and at dawn.' },
  chartreuse: { murky: 0.1, day: 0.02, clear: -0.04, hint: 'Chartreuse glows in murky water.' },
  white: { clear: 0.08, day: 0.02, night: 0.06, murky: -0.05, hint: 'Pearl white shows up best in clear water and at night.' },
  orange: { stained: 0.05, dusk: 0.06, dawn: 0.02, clear: -0.02, hint: 'Orange works in stained water, especially at dusk.' },
};
/** Bite multiplier for a lure of this colour right now (applies to lure rigs only): about 0.85 to 1.15. */
export function lureMod(colour, clarity, time) {
  const f = LURE_FX[colour] ?? LURE_FX.pink;
  const v = (f[clarity] ?? 0) + (f[time] ?? 0);
  return 1 + Math.max(-0.15, Math.min(0.15, v));
}

// ------------------------------------------------------------------ release survival
/**
 * Release survival by species, % when handled well (dataset C13, DPIRD): flathead 91-96, luderick 99, mulloway 73-81, sand whiting 93, snapper 67-92,
 * tailor 92, bream 72-97, kingfish 85. A single figure is [n, n]. The estimate uses the MIDPOINT of the range (bream 84.5, snapper 79.5), and the card says so.
 * Anything else: 90 (no figure in the dataset). The 12% to over 85% for a DEEPLY HOOKED bream is a different thing (C15, cut the line): see CUT_LINE.
 */
export const SURVIVAL_RANGE = { duskyflathead: [91, 96], luderick: [99, 99], mulloway: [73, 81], sandwhiting: [93, 93], snapper: [67, 92], tailor: [92, 92], yellowfinbream: [72, 97], kingfish: [85, 85] };
export const SURVIVAL = Object.fromEntries(Object.entries(SURVIVAL_RANGE).map(([id, [lo, hi]]) => [id, (lo + hi) / 200]));
/** The cut-the-line lesson (C15, DPIRD and worksheet 2.1.12): separate from the survival range above. */
export const CUT_LINE = { id: 'yellowfinbream', pulled: 12, cut: 85, text: 'If a bream is hooked deeply, cut the line close to the mouth: survival jumps from 12% (hook ripped out) to over 85% (line cut).' };
/** The wording for the release card: { range, mid, text } for a species with a published range, or null. */
export function survivalNote(id) {
  const r = SURVIVAL_RANGE[id];
  if (!r) return null;
  const mid = (r[0] + r[1]) / 2, single = r[0] === r[1];
  return { range: r, mid, single, text: single ? `about ${r[0]}%` : `between ${r[0]} and ${r[1]}%, depending on how they are hooked and handled` };
}
export const AIR_LIMIT = 10;
/** Barotrauma becomes a concern for fish brought up from about this depth (m), dataset C17. */
export const BAROTRAUMA_DEPTH = 10;
/**
 * The estimated survival of a fish you release, and why. h = { wet, air (seconds out of the water), weighted, tagged, net }.
 * A deep-water fish (snapper, kingfish, morwong: barotrauma, C17) loses about 30% unless it is returned to depth with a release weight.
 * Returns { pct, base, parts: [{ label, good, delta }], weightHelped (extra % points the weight gave), bayBonus (stock points) }.
 */
export function releaseSurvival(id, h = {}) {
  const sp = SPECIES_BY_ID[id], base = SURVIVAL[id] ?? 0.9, deep = !!sp?.deepWater && (h.depth == null || h.depth >= BAROTRAUMA_DEPTH);   // h.depth (m): where it was caught; unknown = assume deep
  let s = base; const parts = [];
  if (h.wet === false) { s *= 0.88; parts.push({ label: 'Dry hands strip the protective slime', good: false, delta: -12 }); }
  else if (h.wet) parts.push({ label: 'Wet hands protect the slime', good: true, delta: 0 });
  if (h.air > AIR_LIMIT) { s *= Math.max(0.7, 1 - 0.04 * (h.air - AIR_LIMIT)); parts.push({ label: `${h.air.toFixed(1)} s out of the water is too long`, good: false, delta: -Math.round(Math.min(30, 4 * (h.air - AIR_LIMIT))) }); }
  else if (h.air != null) parts.push({ label: 'Back in the water quickly', good: true, delta: 0 });
  if (!h.net && h.air > AIR_LIMIT * 1.5) { s *= 0.85; parts.push({ label: 'The fish slipped from your hands and was dropped (a landing net would have kept it in the water)', good: false, delta: -15 }); }
  if (h.net) parts.push({ label: 'Landing net: kept in the water while unhooked', good: true, delta: 0 });
  let weightHelped = 0, bayBonus = 0;
  if (deep) {
    if (h.weighted) { weightHelped = Math.round(base * 0.3 * 100); bayBonus = 1; parts.push({ label: 'Release weight returned it to depth (no barotrauma)', good: true, delta: weightHelped }); }
    else { s *= 0.7; parts.push({ label: 'Pulled from deep water: swollen gas bladder (barotrauma), no release weight', good: false, delta: -Math.round(base * 30) }); }
  }
  return { pct: Math.max(5, Math.min(99, Math.round(s * 100))), base: Math.round(base * 100), range: SURVIVAL_RANGE[id] ?? null, parts, weightHelped, bayBonus, deep };
}
