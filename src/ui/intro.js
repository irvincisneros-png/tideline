// The teachers' opening ("Day 2"): a new save starts at the school's corner by the cleaning table at Lake Illawarra, hears the goal from Mr Cisneros and Mr Wilson,
// walks to a glowing ring on the shore, casts, gets a bite within a few seconds, plays a fish that cannot be lost, keys it on its own in the usual panel, measures it,
// is shown that the board says it is undersize, releases it with wet hands and then hears about Mission 1, the radio, "you can't sell your catch" and credits.
// It replaces the old premise card (ui/firstRun.js, gone). Under 4 minutes after the creator, with a fish on the line about 60 s after the first word.
//
//   progress.intro = { step: 'meet' | 'cast' | 'fight' | 'flow' | 'send' | 'done', bev?: 'due' | 'told' }
//   meet   the four opening lines            cast   walk to the ring, rod out, cast, bite, strike         fight  the catch bar (tutorial: cannot be lost)
//   flow   key, measure, decide, release     send   the send-off lines                                      done   over (also after a skip)
// A reload resumes at the last safe step (resumeStep). Every write here is idempotent. The pure functions come first and are unit-tested (tests/intro.test.mjs).
import * as THREE from 'three';
import { INTRO_HINTS, INTRO_GOALS, BEV_CALL, TUTORIAL_FISH } from '../content/teachers.js';
import { beatLines, fill } from './introText.js';
import { CORNER } from '../ecosystems/seagrass.js';
import { nameOf } from '../core/anglerData.js';
import { esc } from './panels.js';
import { ensureMissions } from '../npc/missions.js';
import { ensureNpc } from '../npc/requests.js';

export const STEPS = ['meet', 'cast', 'fight', 'flow', 'send', 'done'];
export const TEACHERS = ['mrcisneros', 'mrwilson'];

// ---------------------------------------------------------------------------------------------------------------------------------- pure state
const guideIds = p => Object.keys(p.guide?.e ?? {});
/** The saved step, or 'meet' for anything unknown. */
export const introStep = p => (STEPS.includes(p.intro?.step) ? p.intro.step : 'meet');
/** Is there a tutorial row in the logbook? */
export const hasTutorialRow = p => (p.catches ?? []).some(c => c.tutorial);
/** Nothing exists yet but the opening's own fish (its logbook row and its bream entry in the Fish Guide). */
export const onlyTutorial = p => (p.catches ?? []).every(c => c.tutorial) && guideIds(p).every(id => id === TUTORIAL_FISH.id);

/**
 * Should this player see the opening? A new save (no catches, no Fish Guide entries) whose step is not 'done'; a save part-way through the opening
 * (it has only the tutorial fish) is also due, so a reload resumes. A ?play deep link skips it unless it also has ?intro=1 (?firstrun=1 is an alias).
 */
export function introDue(p, params = new URLSearchParams()) {
  const step = introStep(p);
  if (step === 'done') return false;
  if (params.has('play') && !params.has('intro') && !params.has('firstrun')) return false;
  if (step === 'meet') return !(p.catches?.length) && guideIds(p).length === 0;
  return onlyTutorial(p);
}
/** Where a reload resumes: a fight cannot be resumed, and the flow resumes at the send-off once the tutorial row is in the logbook. */
export function resumeStep(p) {
  const s = introStep(p);
  if (s === 'fight') return 'cast';
  if (s === 'flow') return hasTutorialRow(p) ? 'send' : 'cast';
  return s;
}
const intro = p => (p.intro = p.intro && typeof p.intro === 'object' ? p.intro : { step: 'meet' });
/** Move to a step (never backwards past 'done'). */
export function setStep(p, step) { const i = intro(p); if (i.step !== 'done') i.step = step; return i.step; }
/** The teachers have been met: a talk with them later is a friendly hello, not an introduction. Idempotent (the first time stays). */
export function markTeachersMet(p, teachers = TEACHERS) {
  const met = ensureNpc(p).met;
  for (const id of teachers) if (!met[id]) met[id] = Date.now();
  return met;
}
/** The opening is over (finished or skipped): step 'done', Mission 1 current, Bev's first call due. Idempotent. */
export function finishIntro(p, now = Date.now()) {
  const i = intro(p);
  i.step = 'done'; i.doneAt ??= now;
  if (!i.bev && !p.tips?.bevTiers) i.bev = 'due';
  ensureMissions(p);
  return i;
}
/** A guide entry for the tutorial fish that holds nothing but "caught" (the fish was landed, then the page was reloaded before the key): remove it so the fish can be caught afresh. */
export function clearBareTutorialEntry(p) {
  const g = p.guide, e = g?.e?.[TUTORIAL_FISH.id];
  if (!e || p.catches?.length || e.ident || e.keys?.length || e.meas || e.dec || e.mastered) return false;
  delete g.e[TUTORIAL_FISH.id];
  if (!Object.keys(g.e).length) g.nextN = 1;
  return true;
}
/** Bev's first radio call: once, after the opening (finished or skipped). */
export const bevCallDue = p => p.intro?.step === 'done' && p.intro.bev === 'due' && !p.tips?.bevTiers;
export function markBevCall(p) { (p.tips ??= {}).bevTiers = true; if (p.intro) p.intro.bev = 'told'; }
/** Bev's call as { who: 'bev', text } lines. */
export const bevLines = (name = 'angler') => BEV_CALL.map(t => ({ who: 'bev', text: t.replaceAll('{name}', name) }));

/** Which key is switched off by the opening, and why (a key of INTRO_HINTS). null = allowed. Pure so it can be tested. */
export function lockReason(code, { step, rodOut, nearRing }) {
  if (!['meet', 'cast', 'fight', 'flow', 'send'].includes(step)) return null;
  switch (code) {
    case 'KeyM': return 'map';
    case 'KeyH': return 'home';
    case 'KeyT': return 'tackle';
    case 'KeyE': return 'talk';
    case 'KeyR': return rodOut ? 'rod' : nearRing ? null : 'rodFar';
    default: return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------- the opening
const RING_R = CORNER.ring.r;

export class Intro {
  constructor(game) {
    this.g = game; this.active = false; this.ring = null; this.talkers = new Set(); this.lastHint = -99; this.facing = false;
    const fade = this.fadeEl = document.createElement('div'); fade.id = 'intro-fade'; fade.setAttribute('aria-hidden', 'true'); document.body.appendChild(fade);
    const goal = this.goalEl = document.createElement('div'); goal.id = 'intro-goal'; goal.setAttribute('aria-live', 'polite'); document.body.appendChild(goal);
    const skip = this.skipEl = document.createElement('button'); skip.id = 'intro-skip'; skip.className = 'btn small'; skip.textContent = 'Skip lesson'; skip.hidden = true;
    skip.onclick = () => this.skip(); document.body.appendChild(skip);
  }
  get p() { return this.g.progress; }
  get step() { return introStep(this.p); }

  /** Start (or resume) the opening on the lake. Called once the land mode has started. */
  async begin() {
    const g = this.g, p = this.p;
    if (this.active) return;
    const step = resumeStep(p);
    this.active = true; document.body.classList.add('intro-on');
    this.fadeEl.style.transition = 'none'; this.fadeEl.style.opacity = '1';
    setStep(p, step);
    if (step === 'cast') clearBareTutorialEntry(p);
    markTeachersMet(p, g.npcs.byId.mrwilson ? TEACHERS : ['mrcisneros']);
    document.getElementById('toast')?.replaceChildren();   // the lake's own welcome toast says "press R for your rod": the teachers say it better
    g.persist();
    // A new save stands by the corner facing the teachers; a resumed one stands at the ring.
    const at = step === 'meet' ? CORNER.start : CORNER.ring;
    const pos = new THREE.Vector3(at.x, g.world.walkAt(at.x, at.z), at.z);
    const yaw = at.heading - Math.PI;   // walker.spawn takes the camera yaw: heading = PI + yaw
    g.walker.spawn(pos, yaw); g.rig.reset(pos, yaw);
    requestAnimationFrame(() => requestAnimationFrame(() => { this.fadeEl.style.transition = 'opacity 1.4s ease'; this.fadeEl.style.opacity = '0'; }));
    await new Promise(r => setTimeout(r, 900));
    if (!this.active) return;
    if (step === 'meet') await this.runMeet();
    else if (step === 'send') await this.runSend();
    else this.setupCast();
  }

  // -------------------------------------------------------------------------------------------------------------- dialogue
  who(id) { const g = this.g; return { ...g.npcs.whoOf(id), name: id === 'mrwilson' ? 'Mr Wilson' : 'Mr Cisneros' }; }
  /** Say lines in order, each with Next and Skip. Resolves 'ok' or 'skip'. */
  async talk(lines, lastLabel = 'Next') {
    const g = this.g, dlg = g.dialogue, name = nameOf(this.p);
    try {
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i], npc = g.npcs.byId[l.who];
        if (npc) { npc.talking = true; npc.faceAt = g.walker.pos; this.talkers.add(npc); }
        const c = await dlg.say({ who: this.who(l.who), text: esc(fill(l.text, { name })), choices: [i === lines.length - 1 ? lastLabel : 'Next', 'Skip'], cancel: 1 });
        if (npc) { npc.talking = false; npc.faceAt = null; }
        if (!this.active) return 'skip';
        if (c === 1) return 'skip';
      }
    } finally { dlg.hide(); this.releaseTalkers(); }
    return 'ok';
  }
  releaseTalkers() { for (const n of this.talkers) { n.talking = false; n.faceAt = null; } this.talkers.clear(); }

  async runMeet() {
    const r = await this.talk(beatLines('meet'), 'Let’s go!');
    if (r === 'skip') return this.skip();
    this.setStep('cast'); this.setupCast();
  }
  async runSend() {
    this.g.fishing.tutorial = false; this.setRing(false);
    await this.talk(beatLines('send'), 'Thanks!');   // Next, Thanks or Skip all end the same way: the opening is over and the rod stays out
    this.finish(true);
  }

  // -------------------------------------------------------------------------------------------------------------- the cast
  setStep(step) { setStep(this.p, step); this.g.persist(); }
  /** The ring is up, the fishing code is in tutorial mode and the gates are on. */
  setupCast() {
    const g = this.g;
    g.fishing.tutorial = true;
    this.setRing(true);
    this.skipEl.hidden = false;
    this.updateGoal();
  }
  setRing(on) {
    if (!on) { if (this.ring) { this.ring.parent?.remove(this.ring); this.ring.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); this.ring = null; } return; }
    if (this.ring) return;
    const g = this.g, R = CORNER.ring, grp = this.ring = new THREE.Group();
    const mat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(R.r - 0.22, R.r, 40), mat(0xffe27a, 0.95)); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 6;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R.r - 0.22, 36), mat(0xfff3b0, 0.28)); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.01; disc.renderOrder = 5;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(R.r * 0.8, R.r * 0.8, 3.2, 24, 1, true), mat(0xffe27a, 0.16)); beam.position.y = 1.6; beam.renderOrder = 5;
    grp.add(disc, ring, beam); grp.userData.parts = { ring, beam };
    const y = Math.max(g.world.walkAt(R.x, R.z), g.world.surfaceAt(R.x, R.z)) + 0.07;
    grp.position.set(R.x, y, R.z); g.scene.add(grp);
  }
  get nearRing() { const w = this.g.walker.pos, R = CORNER.ring; return Math.hypot(w.x - R.x, w.z - R.z) < RING_R + 1.1; }
  /** Walking is limited to the corner and the shore in front of it while the opening runs. */
  get bounds() {
    if (!this.active || !['cast', 'fight', 'flow'].includes(this.step)) return null;
    const R = CORNER.ring, T = CORNER.table;
    return { xMin: R.x - 6, xMax: T.x + 7, zMin: R.z - 3, zMax: T.z + 5 };
  }

  // -------------------------------------------------------------------------------------------------------------- per frame
  update(dt, t) {
    if (!this.active) return;
    const g = this.g, w = g.walker, ring = this.ring;
    if (ring) {
      const k = 0.5 + 0.5 * Math.sin(t * 3);
      ring.userData.parts.ring.material.opacity = 0.65 + 0.3 * k; ring.userData.parts.beam.material.opacity = 0.1 + 0.1 * k;
      ring.scale.setScalar(1 + 0.04 * k);
    }
    const gated = ['cast', 'fight', 'flow'].includes(this.step);
    if (gated && !g.fishing.active && this.nearRing && w.speed < 0.3) w.face(Math.sin(CORNER.ring.heading), Math.cos(CORNER.ring.heading), dt, 6);   // arrive facing the water
    const b = this.bounds;
    if (b && !g.fishing.active && (w.pos.x <= b.xMin + 0.05 || w.pos.x >= b.xMax - 0.05 || w.pos.z <= b.zMin + 0.05 || w.pos.z >= b.zMax - 0.05) && t - this.lastHint > 6) { this.lastHint = t; g.toast(INTRO_HINTS.walk, 'warn'); }
    if (g.frame % 10 === 0) this.updateGoal();
  }
  updateGoal() {
    const g = this.g, f = g.fishing;
    let text = '';
    if (this.active && this.step === 'cast' && !f.active && !g.dialogue.isOpen && !g.panels.isOpen) text = this.nearRing ? INTRO_GOALS.rod : INTRO_GOALS.walk;
    if (this.goalEl.dataset.v !== text) { this.goalEl.dataset.v = text; this.goalEl.innerHTML = text ? g.hint(esc(text).replace(/\bR\b/, '<kbd>R</kbd>')) : ''; this.goalEl.classList.toggle('show', !!text); }
    this.skipEl.hidden = !(this.active && ['cast', 'fight'].includes(this.step));
  }

  // -------------------------------------------------------------------------------------------------------------- gates
  /** Is this key switched off right now? Shows the one-line hint and returns true when it is. */
  refuse(code) {
    if (!this.active) return false;
    const g = this.g, why = lockReason(code, { step: this.step, rodOut: g.fishing.active, nearRing: this.nearRing });
    if (!why) return false;
    g.toast(INTRO_HINTS[why], 'warn');
    return true;
  }

  // -------------------------------------------------------------------------------------------------------------- hooks from the fishing code
  /** The strike landed: the fight begins (a reload now resumes at the cast). */
  onStrike() { if (this.active && this.step === 'cast') this.setStep('fight'); }
  /** The fish is landed and the catch panel is about to open. */
  onLanded() { if (this.active) { this.setStep('flow'); this.skipEl.hidden = true; this.setRing(false); } }
  /** The catch panel has closed after the release. */
  async onFlowDone() {
    if (!this.active) return;
    this.g.persist();
    this.setStep('send');
    await this.runSend();
  }

  // -------------------------------------------------------------------------------------------------------------- the end
  /** The student left for the title screen mid-way: put the scene dressing away. The saved step stays, so Continue resumes it. */
  abort() {
    if (!this.active) return;
    this.active = false; document.body.classList.remove('intro-on');
    this.releaseTalkers(); this.setRing(false); this.g.dialogue.hide();
    this.g.fishing.tutorial = false;
    this.skipEl.hidden = true; this.goalEl.classList.remove('show'); this.goalEl.dataset.v = '';
    this.fadeEl.style.opacity = '0';
  }
  /** Skip (or finish): nothing is left half-done. The player stays at the corner with Mission 1 on the HUD. */
  skip() { if (!this.active) return; this.g.dialogue.hide(); this.finish(this.step === 'send'); }
  /** keepRod: the opening ran to its end, so the rod stays out and ready. A skip puts a rod that is out away (the fish line is cut cleanly). */
  finish(keepRod = false) {
    const g = this.g;
    this.active = false; document.body.classList.remove('intro-on');
    this.releaseTalkers(); this.setRing(false);
    g.dialogue.hide();
    g.fishing.tutorial = false;
    if (!keepRod && g.fishing.active && !g.panels.isOpen) g.fishing.stop();
    this.skipEl.hidden = true; this.goalEl.classList.remove('show'); this.goalEl.dataset.v = '';
    finishIntro(this.p);
    g.persist(); g.missionsDirty = true; g.updateMissionHud();
    const chip = document.getElementById('mission-btn'); chip?.classList.remove('pulse'); void chip?.offsetWidth; chip?.classList.add('pulse');
  }
}
