// Knot mini-game rules (pure; no DOM). The pull test is the worksheet's (2.1.6): the result is one of three words and never touches the fight.
import { KNOTS } from '../content/knots.js';

/** The three pull-test words. The owner will confirm the wording against worksheet 2.1.6 (H/S/B); change it here and nowhere else. */
export const RESULT_WORDS = { hold: 'Hold', slip: 'Slip', break: 'Break' };
const RANK = { break: 0, slip: 1, hold: 2 };
const rank = r => RANK[r] ?? -1;

/** One re-tie prompt per this long; inside it the player gets SPARE_TOAST instead. */
export const RETIE_GAP_MS = 3 * 60 * 1000;
export const SPARE_TOAST = 'You already tied a spare a moment ago, so this one is ready to go.';
export const KNOT_MODES = ['full', 'quick', 'off'];

/**
 * The pull test. `wraps` is how many wraps were made (for the blood knot, the smaller of the two sides); `wet` whether it was wetted before tightening.
 * Right wraps and wet = hold; too few wraps or dry = slip; under half the wraps = break (a dry knot with too few wraps too). A knot without wraps: dry = slip.
 */
export function knotResult({ knot, wraps, wet }) {
  const need = KNOTS[knot]?.wraps;
  if (need) {
    const w = Number.isFinite(wraps) ? wraps : 0;
    if (w < need / 2) return 'break';
    if (w < need || !wet) return 'slip';
    return 'hold';
  }
  return wet ? 'hold' : 'slip';
}

/** Why a pull test came out as it did: one plain line. */
export function resultReason({ knot, wraps, wet }) {
  const need = KNOTS[knot]?.wraps, r = knotResult({ knot, wraps, wet }), w = wraps ?? 0;
  if (r === 'hold') return need ? `All ${need} wraps and wetted first, so the coils bite into each other and the knot holds.` : 'Wetted first and pulled tight, so the knot holds.';
  const bits = [];
  if (need && w < need) bits.push(w < need / 2 ? `only ${w} of ${need} wraps, far too few for the coils to grip` : `${w} of ${need} wraps, so the coils grip less than they should`);
  if (!wet) bits.push('it was not wetted, and dry line heats from friction as it tightens, which weakens it');
  return `${r === 'break' ? 'It broke' : 'It slipped'}: ${bits.join(', and ')}.`;
}

const ensure = p => { p.skills ??= {}; p.skills.knots ??= {}; return p.skills.knots; };

/** Store a pull-test result: best by rank (hold > slip > break), n counts practices. `count: false` records a best without counting a practice (?knots=off). */
export function recordKnot(p, id, result, { count = true } = {}) {
  const all = ensure(p), e = all[id] ?? { best: null, n: 0 };
  if (rank(result) > rank(e.best)) e.best = result;
  if (count) e.n = (e.n ?? 0) + 1;
  all[id] = { ...e, best: e.best, n: e.n ?? 0 };
  return all[id];
}

export const knotBest = (p, id) => p?.skills?.knots?.[id]?.best ?? null;
export const knotCount = (p, id) => p?.skills?.knots?.[id]?.n ?? 0;
/** The quick 10 s re-tie is only for a knot already tied to a Hold. */
export const quickAllowed = (p, id) => knotBest(p, id) === 'hold';

/** Whether a re-tie prompt may show now (one per 3 minutes). `now` is a ms timestamp. Call markRetie when the prompt does show. */
export function canPromptRetie(p, now = Date.now()) {
  const last = p?.skills?.retieAt;
  return !(typeof last === 'number' && now - last < RETIE_GAP_MS && now >= last);
}
export function markRetie(p, now = Date.now()) { p.skills ??= {}; p.skills.retieAt = now; }

/** Teacher control: `?knots=full|quick|off` first (params is a URLSearchParams or { knots }), then settings.knots, default 'full'. */
export function knotsMode(settings, params) {
  const q = params?.get ? params.get('knots') : params?.knots;
  if (KNOT_MODES.includes(q)) return q;
  return KNOT_MODES.includes(settings?.knots) ? settings.knots : 'full';
}

/** The version to run: setting off/quick wins; otherwise a re-tie of a knot already held is quick and everything else (first time, board, mission) is full. */
export function chooseMode({ setting = 'full', reason, p, id }) {
  if (setting === 'off') return 'off';
  if (setting === 'quick') return 'quick';
  return reason === 'retie' && quickAllowed(p, id) ? 'quick' : 'full';
}
