// "Show me" request checkers and trade bookkeeping. A request's `need` is checked against what the saved progress already records (the Fish Guide
// and the logbook), so a fish you caught earlier counts. Pure functions on the progress object, unit-tested in tests/npc.test.mjs.
//
//   need types:  mastered {id} · masteredCount {n} · identifiedCount {n} · caughtSpecies {n} · releases {n, maxAir} (logbook rows released with
//   no more than maxAir seconds out of the water) · accurateMeasures {n} · accurateSlot {id} (an accurate measure of a fish inside its legal
//   slot) · identified {id} (that species is Identified or Mastered) · protectedRelease · taggedReleases {n} · catchSize {id, minCm} · litter {n}
//   progress.npc = { day, met: {npcId: t}, accepted: {tradeId: t}, done: {tradeId: t}, quizFail: {tradeId: day}, rot: {key: n}, heard: {key: n} }
import { SPECIES, SPECIES_BY_ID } from '../fishing/species.js';
import * as G from '../fishing/guide.js';
import { RULES } from '../fishing/catches.js';
import { NPCS } from '../content/npcs.js';

export const ensureNpc = p => {
  p.npc ??= { day: 1, met: {}, accepted: {}, done: {}, quizFail: {}, rot: {} };
  for (const k of ['met', 'accepted', 'done', 'quizFail', 'rot']) p.npc[k] ??= {};
  p.npc.day ??= 1;
  return p.npc;
};

const rows = p => p.catches ?? [];
const count = (list, n) => ({ have: Math.min(n, list), need: n, done: list >= n });
const tiers = (p, min) => SPECIES.filter(s => G.atLeast(G.tierOf(p, s.id), min)).length;

/** How far along a `need` is: { have, need, done, text }. */
export function progressOf(need, p) {
  switch (need.type) {
    case 'mastered': { const ok = G.tierOf(p, need.id) === 'mastered'; return { have: +ok, need: 1, done: ok, text: `Master the ${SPECIES_BY_ID[need.id].name}${ok ? '' : ` (now: ${G.TIER_LABEL[G.tierOf(p, need.id)]})`}` }; }
    case 'identified': { const ok = G.atLeast(G.tierOf(p, need.id), 'identified'); return { have: +ok, need: 1, done: ok, text: `Identify the ${SPECIES_BY_ID[need.id].name} with the key${ok ? '' : ` (now: ${G.TIER_LABEL[G.tierOf(p, need.id)]})`}` }; }
    case 'masteredCount': return { ...count(tiers(p, 'mastered'), need.n), text: `Master ${need.n} species` };
    case 'identifiedCount': return { ...count(tiers(p, 'identified'), need.n), text: `Identify ${need.n} species` };
    case 'caughtSpecies': return { ...count(tiers(p, 'caught'), need.n), text: `Catch ${need.n} different species` };
    case 'releases': return { ...count(rows(p).filter(c => c.kept === false && typeof c.air === 'number' && c.air <= need.maxAir).length, need.n), text: `Release ${need.n} fish, each out of the water ${need.maxAir} s or less` };
    case 'accurateMeasures': return { ...count(rows(p).filter(c => c.accurate === true).length, need.n), text: `Log ${need.n} measures within 1 cm` };
    case 'accurateSlot': {
      const r = RULES[need.id], sp = SPECIES_BY_ID[need.id];
      const ok = rows(p).some(c => c.id === need.id && c.accurate === true && c.length >= (r.min ?? 0) && c.length <= (r.slotMax ?? 999));
      return { have: +ok, need: 1, done: ok, text: `Measure a ${sp.name.toLowerCase()} inside its slot (${r.min}–${r.slotMax} cm) within 1 cm` };
    }
    case 'protectedRelease': { const ok = rows(p).some(c => c.kind === 'protected' && c.kept === false); return { have: +ok, need: 1, done: ok, text: 'Release a protected species' }; }
    case 'taggedReleases': return { ...count(rows(p).filter(c => c.kept === false && c.tagged === true).length, need.n), text: `Tag and release ${need.n} fish` };
    case 'catchSize': { const ok = rows(p).some(c => c.id === need.id && c.length >= need.minCm); return { have: +ok, need: 1, done: ok, text: `Catch a ${SPECIES_BY_ID[need.id].name.toLowerCase()} of ${need.minCm} cm or more` }; }
    case 'litter': return { ...count(p.steward?.litter ?? 0, need.n), text: `Pull ${need.n} pieces of litter out of the water` };
    default: throw new Error(`Unknown need type "${need.type}"`);
  }
}

export const tradeById = id => { for (const [npc, def] of Object.entries(NPCS)) { const t = def.trades.find(x => x.id === id); if (t) return { npc, trade: t }; } return null; };
export const allTrades = () => Object.entries(NPCS).flatMap(([npc, def]) => def.trades.map(trade => ({ npc, trade })));

/**
 * Where a trade stands:
 *   done   already handed in            wait   a failed quiz, retry tomorrow (in-game day)
 *   ready  a show-me whose need is met (hand it in), or a quiz you have accepted and may try now
 *   active accepted, not yet met        new    not offered yet
 */
export function tradeStatus(p, trade) {
  const n = ensureNpc(p);
  if (n.done[trade.id]) return 'done';
  if (trade.kind === 'quiz') {
    if (n.quizFail[trade.id] != null && n.quizFail[trade.id] >= n.day) return 'wait';
    return n.accepted[trade.id] ? 'ready' : 'new';
  }
  const pr = progressOf(trade.need, p);
  if (pr.done) return 'ready';
  return n.accepted[trade.id] ? 'active' : 'new';
}

/** Everything for the quest log: accepted (or already satisfied) requests grouped by state. */
export function questLog(p) {
  const n = ensureNpc(p), out = { ready: [], active: [], waiting: [], done: [] };
  for (const { npc, trade } of allTrades()) {
    const st = tradeStatus(p, trade), pr = trade.kind === 'show' ? progressOf(trade.need, p) : null;
    const entry = { npc, trade, status: st, progress: pr };
    if (st === 'done') out.done.push({ ...entry, t: n.done[trade.id] });
    else if (st === 'wait') out.waiting.push(entry);
    else if (st === 'ready' && n.accepted[trade.id]) out.ready.push(entry);
    else if (st === 'ready') out.ready.push(entry);   // a show-me you have already satisfied: still worth handing in
    else if (st === 'active') out.active.push(entry);
  }
  out.done.sort((a, b) => b.t - a.t);
  return out;
}
/** How many things are waiting to be handed in (for the HUD dot on the quest log). */
export const readyCount = p => questLog(p).ready.length;

export function accept(p, tradeId, now = Date.now()) { ensureNpc(p).accepted[tradeId] ??= now; }
export function complete(p, tradeId, now = Date.now()) { ensureNpc(p).done[tradeId] = now; }
export function failQuiz(p, tradeId) { const n = ensureNpc(p); n.quizFail[tradeId] = n.day; }
/** A new in-game day: failed quizzes can be tried again. */
export function nextDay(p) { ensureNpc(p).day++; return p.npc.day; }
