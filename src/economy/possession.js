// The fishing day, the esky and the fridge at home: ONE simulated day for bag limits, the "only one bass over 35 cm" count, possession, bait collecting
// limits and the daily credit caps. Pure functions on the saved progress object (no DOM), unit-tested in tests/possession.test.mjs.
//
// THE MODEL (explained to the player in one line in the help panel)
//   * The simulated day is progress.npc.day. It moves on when you head home after a day of fishing, and at midnight on the game clock. Everything per-day
//     (bag limit, bass over 35 cm, bait collecting limits, daily credit caps, failed quizzes) resets together, never on the computer's calendar date.
//   * What you hold is tracked explicitly: the esky (fish kept on this outing) and the fridge at home (progress.fridge, filled when you head home).
//     Possession (dataset C6) counts both, "at any time, fridge and freezer included". Fish are eaten, shared or used up after FRIDGE_DAYS simulated days,
//     so possession clears on simulated days, never on real ones.
//   * A fish a Fisheries Officer took is gone: it is in neither list, so it never counts toward possession.
//   * Heading home with nothing done (no fish, no bait, no credits) does not use up the day, so you cannot reset the limits by walking home and back.
import { bagGroupIds } from '../fishing/catches.js';
import { ensureNpc } from '../npc/requests.js';
import { today } from './coins.js';

/** A fish in the fridge is eaten or given away after this many simulated days (the day it was kept counts as day 1). */
export const FRIDGE_DAYS = 3;
export const dayOf = p => ensureNpc(p).day;

export function ensureFridge(p) { if (!Array.isArray(p.fridge)) p.fridge = []; return p.fridge; }
/** The fish in the fridge that have not been eaten yet. */
export function fridgeNow(p) { const d = dayOf(p); return ensureFridge(p).filter(f => d - (f.day ?? d) < FRIDGE_DAYS); }
/** Throw away the eaten ones (call after the day moves on). */
export function pruneFridge(p) { const keep = fridgeNow(p); p.fridge = keep; return keep; }

const inGroup = (ids, x) => ids.includes(x.id);
/** Fish of this species group that you kept on the current simulated day (the bag limit counts these). */
export function keptToday(p, id) {
  const ids = bagGroupIds(id), d = dayOf(p);
  return (p.catches ?? []).filter(x => x.kept && inGroup(ids, x) && x.day === d).length;
}
/** How many you kept today that are longer than cm (the "only one over 35 cm" bass rule). */
export function keptOverToday(p, id, cm) {
  const ids = bagGroupIds(id), d = dayOf(p);
  return (p.catches ?? []).filter(x => x.kept && inGroup(ids, x) && x.day === d && x.length > cm).length;
}
/** Everything you hold of this species group right now: the esky plus the fridge at home. */
export function inPossession(p, id) {
  const ids = bagGroupIds(id);
  return (p.esky ?? []).filter(x => inGroup(ids, x)).length + fridgeNow(p).filter(x => inGroup(ids, x)).length;
}

/** Heading home: what was in the esky goes in the fridge, except fish the officer took. Returns the fish that went home. */
export function stowEsky(p, officerResult = 'none') {
  const d = dayOf(p), fridge = pruneFridge(p), esky = p.esky ?? [];
  const home = esky.filter(x => x.legal || officerResult === 'none' || officerResult === 'clean');   // a check that fined you took every illegal fish
  for (const x of home) fridge.push({ id: x.id, label: x.label, length: x.length, legal: x.legal, day: x.day ?? d, time: x.time });
  p.esky = [];
  return home;
}

/** Has anything happened today that the day's limits are counting? If not, heading home does not start a new day. */
export function dayUsed(p) {
  const d = dayOf(p), e = today(p), n = ensureNpc(p);   // today() first: it clears the counters of an earlier day
  return (p.esky?.length ?? 0) > 0
    || (p.catches ?? []).some(x => x.day === d)
    || Object.keys(e.collected ?? {}).length > 0 || Object.keys(e.speciesToday ?? {}).length > 0 || (e.tagsToday ?? 0) > 0 || (e.litterToday ?? 0) > 0
    || Object.values(n.quizFail ?? {}).some(v => v >= d);
}
