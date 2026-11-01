// What you can catch where (NSW Illawarra coast), and the recreational rules that apply.
// Teacher note: size and bag limits follow NSW DPI recreational saltwater rules as understood in October 2026.
// They change from time to time — check https://www.dpi.nsw.gov.au/fishing/recreational/fishing-rules-and-regs
// before using the numbers in class.
import { registerLook } from '../life/life.js';
import { paint as P } from '../life/looks.js';

const { C, mix, sm, withEye, counter } = P;

/** Rules: minLength in cm (null = no legal minimum), bag = daily bag limit, protected = must be released. */
export const RULES = {
  australiansalmon: { minLength: null, bag: 5, note: 'No legal minimum length; daily bag limit 5.' },
  tailor: { minLength: 30, bag: 10, note: 'Legal length 30 cm; daily bag limit 10.' },
  sandwhiting: { minLength: 27, bag: 20, note: 'Legal length 27 cm; daily bag limit 20 (all whiting combined).' },
  yellowfinbream: { minLength: 25, bag: 10, note: 'Legal length 25 cm; daily bag limit 10 (all bream combined).' },
  luderick: { minLength: 27, bag: 10, note: 'Legal length 27 cm; daily bag limit 10.' },
  snapper: { minLength: 30, bag: 4, note: 'Legal length 30 cm; daily bag limit 4.' },
  kingfish: { minLength: 65, bag: 5, note: 'Legal length 65 cm; daily bag limit 5.' },
  bluegroper: { protected: true, bag: 0, note: 'Eastern blue groper: line fishing for blue groper is banned in NSW — release it carefully.' },
};

/** Catch tables by fishing spot: [species id, weight, length range cm]. */
export const SPOTS = {
  beach: { label: 'Surf beach', fish: [['australiansalmon', 4, [25, 60]], ['tailor', 3, [20, 55]], ['sandwhiting', 4, [18, 38]], ['yellowfinbream', 2, [16, 34]]] },
  rock: { label: 'Rock platform', fish: [['luderick', 4, [20, 42]], ['yellowfinbream', 3, [16, 36]], ['snapper', 1, [22, 55]], ['tailor', 2, [22, 55]], ['bluegroper', 1, [35, 80]]] },
  estuary: { label: 'Estuary bank', fish: [['yellowfinbream', 4, [16, 36]], ['sandwhiting', 4, [18, 38]], ['luderick', 3, [20, 42]], ['tailor', 1, [20, 50]]] }, // placeholder table until Lake Illawarra
};

/** How hard each species fights (pull strength 0..1, stamina in seconds of runs). */
export const FIGHT = {
  australiansalmon: { pull: 0.75, stamina: 9 }, tailor: { pull: 0.65, stamina: 7 }, sandwhiting: { pull: 0.35, stamina: 4 },
  yellowfinbream: { pull: 0.45, stamina: 5 }, luderick: { pull: 0.5, stamina: 6 }, snapper: { pull: 0.6, stamina: 8 },
  kingfish: { pull: 0.95, stamina: 13 }, bluegroper: { pull: 0.8, stamina: 9 },
};

export function pickCatch(spot, rnd = Math.random) {
  const t = SPOTS[spot].fish, total = t.reduce((s, f) => s + f[1], 0);
  let r = rnd() * total;
  for (const [id, w, [lo, hi]] of t) { if ((r -= w) <= 0) return { id, length: Math.round(lo + (hi - lo) * Math.pow(rnd(), 1.4)) }; }
  const [id, , [lo]] = t[0]; return { id, length: lo };
}

/** Is this catch legal to keep, given how many of the species you've already kept today? */
export function judge(id, length, keptToday) {
  const r = RULES[id];
  if (!r) return { legal: true, reason: '' };
  if (r.protected) return { legal: false, reason: r.note };
  if (r.minLength && length < r.minLength) return { legal: false, reason: `Undersize: ${length} cm is under the ${r.minLength} cm legal length. Release it so it can grow and breed.` };
  if (keptToday >= r.bag) return { legal: false, reason: `Bag limit reached: you may keep only ${r.bag} per day.` };
  return { legal: true, reason: r.note };
}

// Looks for the line-caught species that don't swim in the dive scenes.
registerLook('australiansalmon', {
  length: 0.5, depth: 0.25, width: 0.13, peak: 0.55, snout: 0.85, tailFrac: 0.2, tail: 'forked', tailSpan: 1.3, pectoral: 0.13,
  dorsal: { from: 0.35, to: 0.6, height: 0.08, shape: 'tri' }, anal: { from: 0.2, to: 0.35, height: 0.06 },
  paint: { body: withEye((u, s) => (s > 0.15 && Math.sin(u * 70 + s * 9) > 0.55 ? C(0x3a4a3a) : mix(C(0xe8eef0), C(0x6a8a98), sm(-0.2, 0.8, s))), 0.88, 0.25, 0.05), fin: (u, part) => part === 'tail' ? C(0x4a5a5a) : C(0xc8c8a0) },
  swim: { freq: 6, amp: 0.7 }, metal: 0.5,
});
registerLook('tailor', {
  length: 0.45, depth: 0.25, width: 0.12, peak: 0.55, snout: 0.75, tailFrac: 0.2, tail: 'forked', tailSpan: 1.2, pectoral: 0.12,
  dorsal: { from: 0.25, to: 0.65, height: 0.07 }, anal: { from: 0.2, to: 0.45, height: 0.06 },
  paint: { body: withEye(counter(0x5a8a9a, 0xdce6e2, 0.9), 0.88, 0.25, 0.05), fin: (u, part) => part === 'tail' ? C(0x6a7a6a) : C(0xc8c890) },
  swim: { freq: 6, amp: 0.7 }, metal: 0.45,
});
registerLook('sandwhiting', {
  length: 0.3, depth: 0.18, width: 0.1, peak: 0.5, snout: 1.2, tailFrac: 0.16, tail: 'truncate', pectoral: 0.11,
  dorsal: { from: 0.2, to: 0.7, height: 0.06 }, anal: { from: 0.15, to: 0.45, height: 0.05 },
  paint: { body: withEye((u, s) => mix(C(0xf2ecd8), C(0xc8b890), sm(-0.2, 0.9, s)), 0.9, 0.25, 0.04), fin: () => C(0xd8c890) },
  swim: { freq: 6, amp: 0.6 }, metal: 0.3,
});
registerLook('yellowfinbream', {
  length: 0.3, depth: 0.42, width: 0.13, peak: 0.55, snout: 0.75, tailFrac: 0.16, tail: 'forked', tailSpan: 1.1, pectoral: 0.13,
  dorsal: { from: 0.2, to: 0.75, height: 0.09 }, anal: { from: 0.2, to: 0.4, height: 0.07 },
  paint: { body: withEye((u, s) => mix(C(0xdcdad0), C(0x8a8a6a), sm(-0.3, 0.9, s)), 0.88, 0.25, 0.045), fin: (u, part) => part === 'anal' || part === 'pectoral' ? C(0xf0d040) : C(0x9a9a7a) },
  swim: { freq: 5, amp: 0.6 }, metal: 0.4,
});
