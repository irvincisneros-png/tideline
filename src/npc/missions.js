// The mission spine's logic (data: content/missions.js). Pure functions on the saved progress object, unit-tested in tests/missions.test.mjs.
//
//   progress.missions = { cur: missionId | null, done: { missionId: t }, pin: tradeId | null, legacy?: true }
//
// A mission is a pointer over things the game already tracks, so nothing here keeps a counter:
//   a { need } step is done when progressOf(need, p).done (logbook and Fish Guide), a { trade } step when progress.npc.done[tradeId] is set.
// A mission pays NO credits and gives NO functional item: finishing one grants its single cosmetic hat, once. A trade step never pays: the trade's own
// hand-in (npc/talk.js) pays its reward as before, and the mission only reads that the trade is done.
import { MISSIONS, MISSION_BY_ID, FEATURES, GIVERS } from '../content/missions.js';
import { WILSON_OK } from '../content/teachers.js';
import { NPCS } from '../content/npcs.js';
import { progressOf, tradeById, tradeStatus, ensureNpc } from './requests.js';
import { grant } from './inventory.js';

export const WILSON = 'mrwilson';

export function ensureMissionState(p) {
  const m = (p.missions = p.missions && typeof p.missions === 'object' ? p.missions : {});
  if (!m.done || typeof m.done !== 'object') m.done = {};
  if (typeof m.cur !== 'string') m.cur = null;
  if (typeof m.pin !== 'string') m.pin = null;
  return m;
}

/** Is this mission part of the chain right now? Hidden: Mr Wilson's missions while WILSON_OK is false, and any mission with a step whose mechanic is not built (FEATURES). */
export const isActive = (m, wilsonOk = WILSON_OK) => (m.giver !== WILSON || wilsonOk) && m.steps.every(s => !s.requires || FEATURES[s.requires]);
/** The chain, in order, without the hidden missions. */
export const chain = (wilsonOk = WILSON_OK) => MISSIONS.filter(m => isActive(m, wilsonOk));

/** One step: { done, have, need, text, kind }. */
export function stepState(p, step) {
  if (step.trade) {
    const found = tradeById(step.trade);
    if (!found) throw new Error(`Mission step names an unknown trade "${step.trade}"`);
    const done = !!ensureNpc(p).done[step.trade];
    return { kind: 'trade', done, have: +done, need: 1, text: done ? `Done: ${found.trade.title}` : tradeText(p, found), trade: found.trade, npc: found.npc };
  }
  const pr = progressOf(step.need, p);
  return { kind: 'need', done: pr.done, have: pr.have, need: pr.need, text: pr.text, hint: step.hint };
}
/** What to do about a trade step (the person, and where it stands). */
function tradeText(p, { npc, trade }) {
  const who = NPCS[npc].name, st = tradeStatus(p, trade);
  if (st === 'wait') return `${who}: try the quiz again tomorrow`;
  if (st === 'ready') return trade.kind === 'quiz' ? `Ask ${who} for the quiz: ${trade.title}` : `Hand in to ${who}: ${trade.title}`;
  if (st === 'active') { const pr = progressOf(trade.need, p); return `${trade.title}: ${pr.text}${pr.need > 1 ? ` (${pr.have}/${pr.need})` : ''}`; }
  return `Talk to ${who}: ${trade.title}`;
}

/** { mission, steps: [stepState], count (steps done), done (all steps done) } */
export function missionProgress(p, id) {
  const mission = MISSION_BY_ID[id];
  if (!mission) throw new Error(`Unknown mission "${id}"`);
  const steps = mission.steps.map(s => stepState(p, s)), count = steps.filter(s => s.done).length;
  return { mission, steps, count, done: count === steps.length };
}

const grantHat = (p, m) => grant(p, m.reward);

/**
 * After a load: walk the chain, mark every finished mission done and give its hat, silently (no scenes, no credits), and point `cur` at the first
 * unfinished one. Idempotent. Returns the ids it marked this time.
 */
export function ensureMissions(p, now = Date.now()) {
  const st = ensureMissionState(p), marked = [];
  for (const m of chain()) {
    if (st.done[m.id]) { grantHat(p, m); continue; }   // a done mission always has its hat (a save repaired from a backup, say)
    if (missionProgress(p, m.id).done) { st.done[m.id] = now; grantHat(p, m); marked.push(m.id); }
  }
  st.cur = chain().find(m => !st.done[m.id])?.id ?? null;
  return marked;
}

/**
 * Call when the player's progress may have moved (a catch is logged, a trade handed in). Marks missions that have just been finished, gives their hat
 * (once: it is a grant) and returns them in chain order so the caller can play the radio lines. Pays nothing else.
 */
export function advanceMissions(p, now = Date.now()) {
  const st = ensureMissionState(p), out = [];
  for (const m of chain()) {
    if (st.done[m.id] || !missionProgress(p, m.id).done) continue;
    st.done[m.id] = now; grantHat(p, m); out.push(m);
  }
  st.cur = chain().find(m => !st.done[m.id])?.id ?? null;
  return out;
}

/** The current mission and its steps, the chain so far, and the pin: what the quest log's missions section shows. */
export function missionsView(p) {
  const st = ensureMissionState(p), list = chain();
  const first = list.find(m => !st.done[m.id]), cur = first ? missionProgress(p, first.id) : null;   // always derived: `cur` in the save is only a record of it
  return {
    current: cur,
    chain: list.map(m => ({ id: m.id, title: m.title, chapter: m.chapter, done: !!st.done[m.id], current: m.id === first?.id, reward: m.reward, giver: m.giver })),
    pin: pinnedTrade(p),
    allDone: !cur && list.every(m => st.done[m.id]),
  };
}

/** The pinned trade ({ npc, trade }) while it is still worth showing: accepted and not yet handed in. */
export function pinnedTrade(p) {
  const id = ensureMissionState(p).pin, found = id ? tradeById(id) : null;
  if (!found || ensureNpc(p).done[id] || !ensureNpc(p).accepted[id]) return null;
  return found;
}
/** Put an accepted trade on the HUD line instead of the mission (null or the same trade again unpins). Returns the pin now set. */
export function setPin(p, tradeId) {
  const st = ensureMissionState(p);
  if (tradeId == null || tradeId === st.pin) { st.pin = null; return null; }
  const found = tradeById(tradeId);
  if (!found || ensureNpc(p).done[tradeId] || !ensureNpc(p).accepted[tradeId]) return st.pin;   // only a request you have accepted and not finished
  st.pin = tradeId; return st.pin;
}

/** The HUD line: { text, pinned }. The pinned trade's progress, else the current mission's next unfinished step. '' when there is nothing to do. */
export function hudInfo(p) {
  const pin = pinnedTrade(p);
  if (pin) return { text: tradeText(p, pin), pinned: true, title: pin.trade.title };
  const v = missionsView(p);
  if (!v.current) return { text: '', pinned: false };
  const step = v.current.steps.find(s => !s.done);
  const body = step.kind === 'need' ? `${step.text}${step.need > 1 ? ` (${step.have}/${step.need})` : ''}` : step.text;
  return { text: `${v.current.mission.title}: ${body}`, pinned: false, title: v.current.mission.title };
}
export const hudLine = p => hudInfo(p).text;

/** A mission's radio lines as { who, text } (the giver unless the line names another voice); Mr Wilson's are dropped while WILSON_OK is false. */
export function radioLines(m, name = 'angler', wilsonOk = WILSON_OK) {
  return (m.radio ?? []).map(l => (typeof l === 'string' ? { who: m.giver, text: l } : l))
    .filter(l => l.who !== WILSON || wilsonOk)
    .map(l => ({ who: l.who, text: l.text.replaceAll('{name}', name) }));
}
/** Who is speaking: a radio voice for a teacher or one of the coast's people (the caller adds the portrait render for the latter). */
export const speakerOf = id => GIVERS[id] ?? (NPCS[id] ? { name: NPCS[id].name, role: 'on the radio', npc: id } : { name: 'The club', role: 'on the radio' });

/** The one welcome line for a save that played before missions existed: once, the next time it is at the lake (seagrass). */
export const HELLO_LINE = 'G\'day {name}, Mr Cisneros on the radio. The club has put some jobs in your quest log (Q), with a hat for each one you finish. Everything you have already done counts.';
export const helloDue = (p, ecoId) => ecoId === 'seagrass' && ensureMissionState(p).legacy === true && !p.tips?.missionsHello;
export function markHello(p) { (p.tips ??= {}).missionsHello = true; }

