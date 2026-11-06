// Rod fishing (beach, rock platform, Lake Illawarra): the angler holds the rod, casts, you wait for a bite, strike, then play the
// fish on the catch bar. Your rig and bait (tackle box, T) and the day's conditions set the wait and what bites (catches.js).
// On the strike the catch bar opens (catchbar.js): hold Space to lift the green zone and keep the fish inside it.
// Seen from the high follow camera: the cast arcs out, a thin dark line sags to a red and white float, a ring marks the landing.
// On a lure rig the cast is followed by a retrieve instead of a wait (lure.js): tap Space to twitch, hold to reel, let go to pause; a fish
// shadows the lure and strikes when the rhythm suits it. With bait, holding Space draws the rig slowly toward you (to where the fish are).
import * as THREE from 'three';
import { pickCatch, waitFor, judge, RULES, FIGHT, SPOTS, SPECIES_BY_ID } from './catches.js';
import { CatchBar } from './catchbar.js';
import { buildFish } from '../life/fishModel.js';
import { LOOKS } from '../life/looks.js';
import { fishGeometry } from '../life/shoals.js';
import { LureInterest, MoveReader, STYLES, styleOf } from './lure.js';
import { RELEASE_AT } from '../land/anim.js';
import { RIGS } from './gear.js';
import { LURE_COLOURS } from '../npc/inventory.js';
import { tutorialCatch, tutorialWait, TUTORIAL_MIN_DEPTH } from './tutorial.js';
import { INTRO } from '../content/teachers.js';
import { TANGLE_DEFAULT } from '../content/npcs.js';
import { SnagRoll, SnagState, TangleState, SNAG_TEXT, crosses, bookSnagFreed, bookLineCut, lostLineCount } from './snags.js';
import { missionsView } from '../npc/missions.js';

const $ = s => document.querySelector(s);
const LINE_PTS = 20; // the line is drawn as a ribbon curve so it can sag and bend with the fight
const LINE_W = 0.03;
export const CAST_MIN = 5, CAST_MAX = 20; // metres from the angler at 0 and 100% power

export class Fishing {
  constructor(game) {
    this.game = game;
    this.state = 'off'; // off | ready | charge | flying | wait | retrieve | snagged | bite | fight | landed
    // The line: a camera-facing ribbon (2 vertices per point), dark and thin.
    const pos = new Float32Array(LINE_PTS * 2 * 3), idx = [];
    for (let i = 0; i < LINE_PTS - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); lineGeo.setIndex(idx);
    this.line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0x1f3239, side: THREE.DoubleSide, fog: false }));
    this.line.frustumCulled = false; this.line.visible = false;
    // The float: red body, white top, a short stalk.
    this.float = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf0442c, roughness: 0.4 }));
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.103, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    top.position.y = 0.002; top.rotation.x = Math.PI; top.position.y = 0;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    stalk.position.y = 0.16;
    this.bobber = new THREE.Group(); this.bobber.add(body, top, stalk);
    // The lure: a jig head with a soft tail, in the colour from the tackle box. Shown instead of the float on a lure rig (setLure).
    this.lureMesh = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9aa6ae, roughness: 0.35, metalness: 0.4 }));
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 4, 8), new THREE.MeshStandardMaterial({ color: 0xf0a0b8, roughness: 0.5 }));
    tail.rotation.z = Math.PI / 2; tail.position.x = -0.16;
    this.lureMesh.add(head, tail); this.lureTail = tail;
    this.float.add(this.bobber, this.lureMesh); this.float.visible = false; this.lureMesh.visible = false;
    // The shadow: one fish shape from the shoals, dark under the water, that follows a worked lure; a ring on the surface over it shows its interest.
    this.shadow = new THREE.Mesh(fishGeometry(), new THREE.MeshBasicMaterial({ color: 0x123a44, side: THREE.DoubleSide, fog: false }));
    this.shadow.visible = false; this.shadow.renderOrder = -1; this.shadow.userData.noShadow = true;
    this.interestRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, fog: false }));
    this.interestRing.rotation.x = -Math.PI / 2; this.interestRing.visible = false;
    this.sh = { on: false, x: 0, z: 0, hd: 0, len: 0.6, wait: 0, gone: 0 };
    // Ripple ring around the float, and the aim ring shown while winding up.
    this.ripple = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
    this.ripple.rotation.x = -Math.PI / 2; this.ripple.visible = false;
    this.aim = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    this.aim.rotation.x = -Math.PI / 2; this.aim.visible = false;
    this.aimLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.12), new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
    this.aimLine.rotation.x = -Math.PI / 2; this.aimLine.visible = false;
    // "!" over the float when a fish bites (readable from high up).
    this.bang = makeBang(); this.bang.visible = false;
    game.scene.add(this.line, this.float, this.ripple, this.aim, this.aimLine, this.bang, this.shadow, this.interestRing);
    this.mover = new MoveReader();
    this.target = new THREE.Vector3(); this.dist = 0; this.power = 0; this.sag = 0.3; this.bend = 0;
    this.bar = new CatchBar(game);
    this.tipW = new THREE.Vector3();
    this.reel = false; this.fightT = 0;
    this.tutorial = false;   // the teachers' opening (ui/intro.js): a bite within a few seconds, always the tutorial bream, no bait used, a fight that cannot be lost
    this.lineDir = new THREE.Vector3(0, 0, 1);   // unit bearing from the angler to the float while a line is out
    // Snags (snags.js): the roll runs while the rig moves, 'snagged' is the state; forceSnag guarantees the next eligible roll (the Structure mission sets it, so do tests).
    this.snagRoll = new SnagRoll(); this.snag = null; this.snagKind = null; this.snagFrom = 'wait'; this.snagWho = null; this.forceSnag = false; this.bendX = 0;
    this.tangled = new Set(); this._outingRef = null;   // fishing NPCs whose lines you have crossed this outing (one tangle each)
  }
  get active() { return this.state !== 'off'; }
  /** Is a lure tied on (the retrieve replaces the wait)? */
  get onLure() { return !!RIGS[this.game.gear?.rig]?.lure; }
  /** Show the lure (in the tackle-box colour) or the float at the end of the line. */
  setLure(on) {
    this.bobber.visible = !on; this.lureMesh.visible = on;
    if (on) { const id = this.game.progress?.inventory?.lure ?? 'pink'; this.lureTail.material.color.set(LURE_COLOURS.find(c => c.id === id)?.css ?? '#f0a0b8'); }
  }
  /** Put the shadow fish away (it fled, struck, or the line came in). */
  hideShadow() { this.sh.on = false; this.shadow.visible = false; this.interestRing.visible = false; this.interest = null; }
  get angler() { return this.game.angler; }
  /** 0..1 for the angler pose while a fish is on. */
  /** Signed angle (rad) from the facing to the float, + toward the angler's local +x (the model's left arm): the rod leans toward the fish. */
  get side() { const w = this.game.walker, f = this.float.position; return this.float.visible ? Math.atan2((f.x - w.pos.x) * Math.cos(w.heading) - (f.z - w.pos.z) * Math.sin(w.heading), (f.x - w.pos.x) * Math.sin(w.heading) + (f.z - w.pos.z) * Math.cos(w.heading)) : 0; }
  get act() { return this.state === 'fight' ? this.bar.activity : 0; }

  /** R: take the rod out or put it away. spot: a key of SPOTS (the cast re-checks it where the float lands). */
  toggle(spot) {
    if (this.state === 'snagged') { this.game.toast(this.snagKind === 'tangle' ? 'Wind the lines clear first: hold Space.' : 'Snagged! Tap Space to let it drop off before you put the rod away.', 'warn'); return; }
    if (this.active) { this.stop(); return; }
    this.spot = spot; this.state = 'ready';
    this.game.toast(`Rod out (${SPOTS[spot].label}). Hold Space to wind up, release to cast. Press T for your tackle box. R puts the rod away.`);
  }
  /** Can the player change tackle right now? Not while a fish is on. */
  get canChangeGear() { return !['bite', 'fight', 'snagged'].includes(this.state); }
  stop() {
    this.bar.stop(); this.angler?.setBend(0);
    this.snag = null; this.state = 'off'; this.landT = 0; this.line.visible = false; this.float.visible = false; this.ripple.visible = false; this.aim.visible = false; this.aimLine.visible = false; this.bang.visible = false;
    this.hideShadow();
    this.game.walker.frozen = false;
    this.angler?.hold(null); this.disposeHeld();
    $('#prompt').innerHTML = '';
  }

  /** Free the GPU resources of the fish held up for the camera: its geometry, its painted skin texture and its material are made fresh for every landing, so they must be disposed when it is put away. */
  disposeHeld() {
    const h = this.held; this.held = null;
    h?.traverse(o => {
      if (!o.isMesh) return;
      o.geometry?.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m?.map?.dispose(); m?.dispose(); }
    });
  }

  /** What the angler watches: the shadow fish behind a lure, else the float, else nothing. */
  lookAt() { return this.sh?.on ? this.shadow.position : this.float.visible ? this.float.position : null; }

  /** Where a cast of this power lands, along the way the angler faces. */
  castTarget(power, out = this.target) {
    const w = this.game.walker, f = w.facing, r = CAST_MIN + power * (CAST_MAX - CAST_MIN);
    return out.set(w.pos.x + f.x * r, 0, w.pos.z + f.z * r);
  }

  update(dt, t, input, world) {
    if (!this.active) return;
    const g = this.game, w = g.walker, ang = g.angler, space = input.down('Space'), hit = input.hit('Space');
    const eye = this._eye ??= new THREE.Vector3(); eye.set(w.pos.x, w.pos.y + 1, w.pos.z);
    ang.rodTip.getWorldPosition(this.tipW);
    const tipW = this.tipW;
    let prompt = '';
    const surf = (x, z) => world.surfaceAt(x, z);
    // On a drifting boat the bait drifts with it: carry the float and the cast target along (g.carry is set each frame by the site, eco.tick).
    if (g.carry && (g.carry.x || g.carry.z) && ['flying', 'wait', 'retrieve', 'snagged', 'bite'].includes(this.state)) { this.float.position.x += g.carry.x; this.float.position.z += g.carry.z; this.target.x += g.carry.x; this.target.z += g.carry.z; if (this.from) { this.from.x += g.carry.x; this.from.z += g.carry.z; } }
    // Once the line is out the angler plants their feet and faces the float: the bearing is locked (see lineDir), walk input is ignored.
    w.frozen = ['charge', 'flying', 'wait', 'retrieve', 'snagged', 'bite', 'fight', 'landed'].includes(this.state);
    if (this.state === 'flying') this.lineDir.set(this.target.x - w.pos.x, 0, this.target.z - w.pos.z).normalize();
    else if (this.state === 'wait' || this.state === 'retrieve' || this.state === 'snagged' || this.state === 'bite') { this.lineDir.set(this.float.position.x - w.pos.x, 0, this.float.position.z - w.pos.z); if (this.lineDir.lengthSq() > 0.25) this.lineDir.normalize(); else this.lineDir.copy(w.facing); }
    if (LINE_OUT.includes(this.state)) w.face(this.lineDir.x, this.lineDir.z, dt, 10);
    if (this.state === 'ready' || this.state === 'charge') g.aimAtCursor(dt); // desktop: face the pointer while the rod is out
    this.aim.visible = this.aimLine.visible = this.state === 'charge';
    if (this.state === 'ready') {
      prompt = 'Hold <kbd>Space</kbd> to wind up a cast';
      if (!space) this.needRelease = false;
      if (space && !this.needRelease) { this.state = 'charge'; this.power = 0; }   // (needRelease: the Space that cut a line or wound in a tangle does not start the next cast)
    } else if (this.state === 'charge') {
      this.power = Math.min(1, this.power + dt * 0.85);
      this.castTarget(this.power, this._aim ??= new THREE.Vector3());
      const a = this._aim, ay = surf(a.x, a.z) + 0.06, dir = w.facing, len = Math.hypot(a.x - w.pos.x, a.z - w.pos.z);
      this.aim.position.set(a.x, ay, a.z); this.aim.scale.setScalar(0.8 + this.power * 0.9 + Math.sin(t * 8) * 0.06);
      this.aimLine.position.set((a.x + w.pos.x) / 2, ay, (a.z + w.pos.z) / 2); this.aimLine.scale.set(len - 1.2, 1, 1); this.aimLine.rotation.z = Math.atan2(dir.z, dir.x);
      prompt = `Casting power ${Math.round(this.power * 100)}% — release <kbd>Space</kbd>`;
      if (!space) {
        this.castTarget(this.power);
        const depth = surf(this.target.x, this.target.z) - world.groundAt(this.target.x, this.target.z);
        if (depth < (this.tutorial ? TUTORIAL_MIN_DEPTH : 0.4)) { this.state = 'ready'; g.toast('That cast would land on dry ground — face the water and cast again.', 'warn'); }
        else if (!g.baitReady()) { this.state = 'ready'; g.toast('No bait left in your box. Buy some at Mitra\'s shop, collect your own, or switch to a lure (tackle box, T).', 'warn'); }
        else { this.state = 'flying'; this.flyT = 0; this.from = tipW.clone(); this.setLure(this.onLure); }
      }
    } else if (this.state === 'flying') {
      // The rig rides the rod tip through the wind-up and snap (anim.js CAST), leaves it at RELEASE_AT, then flies a high arc to the target.
      const held = this.flyT < RELEASE_AT;
      this.flyT += dt;
      if (held && this.flyT >= RELEASE_AT) g.audio.play('click');
      const k = Math.min(1, Math.max(0, (this.flyT - RELEASE_AT) / 0.75));
      if (this.flyT < RELEASE_AT) { this.from.copy(tipW); this.float.position.copy(tipW); }
      else { this.float.position.lerpVectors(this.from, this.target, k); this.float.position.y = THREE.MathUtils.lerp(this.from.y, surf(this.target.x, this.target.z), k) + Math.sin(k * Math.PI) * 2.6; }
      this.float.visible = true;
      if (k >= 1) {
        this.state = 'wait'; g.audio.play('smallSplash'); g.fx.splash?.(this.float.position, 6); this.dist = this.float.position.distanceTo(eye);
        const spot = g.fishingSpot(this.target);
        if (spot !== this.spot) { this.spot = spot; g.toast(`Fishing: ${SPOTS[spot].label}.`); }
        this.ctx = g.biteContext(this.target); // the tackle and conditions you cast with decide the wait and what bites
        this.waitT = this.tutorial ? tutorialWait() : waitFor(this.spot, this.ctx);
        this.mover = new MoveReader(); this.nearSp = null; this.sink = 0;
        if (this.onLure && !this.tutorial) { this.state = 'retrieve'; this.hideShadow(); this.sh.wait = 0.8 + Math.random() * 1.8; this.lureTip(); }
        this.snagRoll.newCast(); this.snagRoll.force = this.forceSnag || this.missionWantsSnag();
        if (!this.tutorial && this.checkTangle(tipW, this.float.position)) this.enterSnag('tangle', 'wait');
      }
    } else if (this.state === 'wait') {
      // Tap Space: wind in and cast again. Hold Space: draw the bait slowly toward you, to put it where the fish are (a school within a few metres bites sooner).
      const move = this.mover.read(space, dt), fp = this.float.position;
      if (move === 'reel') { this.drawIn(fp, eye, DRAW_SPEED * dt); this.ripple.scale.setScalar(1); }
      this.dist = fp.distanceTo(eye);
      const near = g.shoals?.nearest?.(fp.x, fp.z);
      this.nearSp = near && near.d < SHOAL_NEAR ? near.sp : null;
      this.waitT -= dt * (this.nearSp ? 2.2 : 1);
      fp.y = surf(fp.x, fp.z) + Math.sin(t * 2.2) * 0.02;
      prompt = this.nearSp ? 'Your bait is right by a school… (hold <kbd>Space</kbd> to draw it in, tap to wind in)' : 'Waiting for a bite… (hold <kbd>Space</kbd> to draw the bait in slowly, tap to wind in and cast again)';
      if (move === 'twitch' || this.dist < 2.2) { this.state = 'ready'; this.float.visible = false; if (move === 'twitch') this.baitTip(); }
      else if (this.waitT <= 0) { this.state = 'bite'; this.biteT = 1.3; this.catch = this.tutorial ? tutorialCatch() : pickCatch(this.spot, this.nearSp ? { ...this.ctx, arch: this.nearSp } : this.ctx); g.audio.play('warn'); if (!this.tutorial) g.useBait(); }   // the fish takes the bait: one bait is used
      else if (move === 'reel' && this.trySnag(dt, move, 'wait')) prompt = SNAG_TEXT.prompt;   // drawing the bait in over structure can snag it (never a still wait)
    } else if (this.state === 'retrieve') {
      prompt = this.retrieve(dt, t, space, eye, surf, world);
    } else if (this.state === 'bite') {
      this.biteT -= dt;
      this.float.position.y = surf(this.float.position.x, this.float.position.z) - 0.08 - Math.abs(Math.sin(t * 18)) * 0.06; // the float dips
      prompt = 'BITE! Press <kbd>Space</kbd> to strike!';
      if (hit) { this.startFight(); }
      else if (this.biteT <= 0) { this.missStrike(); }
    } else if (this.state === 'landed') {
      if (this.landT > 0 && (this.landT -= dt) <= 0) {
        g.onFishLanded(this.landed, this.spot, () => { g.angler.hold(null); this.disposeHeld(); g.walker.frozen = false; this.state = this.state === 'off' ? 'off' : 'ready'; });
      }
    } else if (this.state === 'snagged') {
      prompt = this.snagStep(dt, t, space, surf);
    } else if (this.state === 'fight') {
      // The catch bar runs the fight; the line, float and rod follow what the fish does.
      const bar = this.bar;
      bar.update(dt, space);
      this.reel = space || !!bar.held;   // Space, or a finger on the bar on touch
      const act = bar.activity;
      this.fightT += dt;
      const away = this.lineDir;   // fixed at the strike: re-deriving it from the float (which swings sideways) made the bearing drift round and spin the angler
      const d = THREE.MathUtils.lerp(this.dist0, 2.5, bar.meter); // the float comes in as the meter fills
      const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(Math.sin(this.fightT * (1.2 + act * 3)) * Math.min(5, d * 0.18) * (0.4 + act));
      this.float.position.copy(eye).addScaledVector(away, Math.max(1.8, d)).add(side);
      this.float.position.y = surf(this.float.position.x, this.float.position.z) - 0.04 - (bar.s?.mode === 'dive' ? 0.1 : 0);
      if (act > 0.5 && Math.random() < dt * 3) g.fx.splash?.(this.float.position, 4);
      this.sag = 0.04 + 0.2 * (1 - act);
    }
    // Float extras: ripple ring on the water, "!" over a bite.
    const fl = this.float.visible && ['wait', 'retrieve', 'snagged', 'bite', 'fight'].includes(this.state);
    this.ripple.visible = fl;
    if (fl) {
      const fp = this.float.position, ph = (t * 0.9) % 1, k = this.state === 'wait' ? 1 : 1.6;
      this.ripple.position.set(fp.x, surf(fp.x, fp.z) + 0.03, fp.z); this.ripple.scale.setScalar((0.8 + ph * 1.4) * k); this.ripple.material.opacity = (1 - ph) * 0.7;
    }
    this.bang.visible = this.state === 'bite';
    if (this.bang.visible) { const fp = this.float.position; this.bang.position.set(fp.x, fp.y + 1.5 + Math.abs(Math.sin(t * 9)) * 0.3, fp.z); }
    // Line from the rod tip to the float / fish.
    this.line.visible = this.float.visible && ['flying', 'wait', 'retrieve', 'snagged', 'bite', 'fight'].includes(this.state);
    if (this.line.visible) this.drawLine(tipW, this.float.position);
    $('#prompt').innerHTML = g.hint(prompt);
  }


  // ------------------------------------------------------------------ snags and tangles (snags.js)
  /** Roll for a snag this frame (called while the rig moves). Returns true if the rig has just snagged. Never in the teachers' opening. */
  trySnag(dt, move, from) {
    if (this.tutorial) return false;
    const hit = this.snagRoll.step(dt, { spot: this.spot, rig: this.game.gear.rig, state: from, move, sink: this.sink ?? 0, shadow: this.sh.on, speed: from === 'wait' ? DRAW_SPEED : REEL_SPEED });
    if (hit) this.enterSnag('snag', from);
    return hit;
  }
  /** Is the current mission "Structure" waiting for its first freed snag? Then the next eligible roll is guaranteed (it does not depend on luck). */
  missionWantsSnag() {
    try { const c = missionsView(this.game.progress).current; return !!c && c.mission.steps.some((st, i) => st.need?.type === 'snagFreed' && !c.steps[i].done); } catch { return false; }
  }
  /** A one-time tip (saved in p.tips). */
  tipOnce(key, text, kind = 'good') { const p = this.game.progress; if (p.tips?.[key]) return; (p.tips ??= {})[key] = true; this.game.persist?.(); this.game.toast(text, kind); }
  /** The rig is stuck (kind 'snag': tap to free it, hold to cut it) or crossed with an NPC's line (kind 'tangle': hold to wind in). from: the state to go back to. */
  enterSnag(kind, from) {
    const g = this.game;
    this.snagKind = kind; this.snagFrom = from; this.state = 'snagged'; this.forceSnag = false; this.reel = false; this.bendX = 0;
    this.hideShadow();
    this.snag = kind === 'tangle' ? new TangleState() : new SnagState();
    this.snagTaps = 0; this.yankTipped = false;
    g.audio.play('warn'); g.fx.splash?.(this.float.position, 3);
    if (kind === 'tangle') {
      const n = this.snagWho, lines = n?.def?.tangle ?? TANGLE_DEFAULT;
      g.toast(`Your line has crossed ${n?.def?.name ?? 'someone'}'s! Hold Space to wind in and untangle.`, 'warn');
      n?.say?.(lines[Math.floor(Math.random() * lines.length)], 4.5);
    } else this.tipOnce('snagStructure', SNAG_TEXT.tipStructure);
  }
  /** One frame of a snag or tangle: feed the player's Space, show the tension, free or cut. Returns the HUD prompt. */
  snagStep(dt, t, space, surf) {
    const g = this.game, S = this.snag, fp = this.float.position, kind = this.snagKind, r = S.step(dt, space), tn = S.tension;
    if (kind === 'snag' && S.taps > this.snagTaps) { this.snagTaps = S.taps; g.audio.play('click'); g.fx.splash?.(fp, 2); }   // each counted tap is heard and seen
    fp.y = surf(fp.x, fp.z) - 0.04 - tn * 0.1 + Math.sin(t * (9 + tn * 20)) * 0.015 * (kind === 'snag' ? tn : 0.3);
    // The tension ring (interestRing reused): calm green at rest, amber, then red as the line nears breaking. A tangle shows its winding progress in teal.
    const ring = this.interestRing, c = ring.material.color;
    ring.visible = true; ring.position.set(fp.x, surf(fp.x, fp.z) + 0.04, fp.z);
    if (kind === 'snag') c.setRGB(0.35 + 0.62 * tn, 0.85 - 0.6 * tn, 0.4 - 0.2 * tn); else c.setRGB(0.3, 0.75, 0.85);
    ring.scale.setScalar(kind === 'snag' ? 1.5 + 1.5 * tn : 1.5 + 1.0 * tn); ring.material.opacity = 0.75 + 0.25 * tn;   // big enough to read from the high camera
    this.bendX = kind === 'snag' ? 0.12 + 0.7 * tn : 0.1 + 0.3 * tn;   // the rod loads up with the tension (angler.js extraBend)
    if (kind === 'snag' && tn > 0.35 && !this.yankTipped) { this.yankTipped = true; this.tipOnce('snagYank', SNAG_TEXT.tipYank, 'warn'); }
    if (r === 'freed') this.freeSnag();
    else if (r === 'cut') this.cutLine('snag');
    if (this.state !== 'snagged') return '';
    if (kind === 'tangle') return SNAG_TEXT.tanglePrompt.replace('{who}', this.snagWho?.def?.name ?? 'their');
    return tn > 0.3 ? 'Let go! Don\'t pull. Tap <kbd>Space</kbd>.' : SNAG_TEXT.prompt;
  }
  /** Out of a snag or tangle: put the ring away, drop the rod load. */
  endSnag() { this.hideShadow(); this.bendX = 0; this.snag = null; }
  /** The snag let go (tapped free) or the lines came apart. A snag goes back to what it was doing with the rig where it was; a tangle winds the rig in. */
  freeSnag() {
    const g = this.game, kind = this.snagKind;
    g.fx.splash?.(this.float.position, 5); g.audio.play('smallSplash');
    this.endSnag();
    if (kind === 'tangle') {
      this.state = 'ready'; this.needRelease = true; this.float.visible = false;
      g.toast('Lines clear! Wind in and cast again, a little away from them.', 'good');
      return;
    }
    bookSnagFreed(g.progress); g.persist();
    this.state = this.snagFrom; this.mover = new MoveReader(); this.sink = 0;
    g.toast(SNAG_TEXT.freed, 'good');
    this.tipOnce('snagFloat', SNAG_TEXT.tipFloat);
  }
  /**
   * The line is cut: a snag held on too long (reason 'snag') or a fish that dived for structure on the catch bar (reason 'fight', msg = its toast). Costs the bait
   * (a snag only: a fight already used it when the fish bit; a lure rig loses nothing), counts one lost line at this site, calls game.onLineCut (the re-tie), then
   * the rod is ready again. No Steward deduction and no rig is ever taken out of the tackle box.
   */
  cutLine(reason, msg) {
    const g = this.game, p = g.progress;
    bookLineCut(p, g.eco.id);
    if (reason === 'snag') {
      if (!this.onLure) g.useBait();   // the game's own bait counter
      this.endSnag(); this.state = 'ready'; this.needRelease = true; this.float.visible = false; this.catch = null; this.ctx = null;
      g.toast(`${SNAG_TEXT.cut}${this.onLure ? '' : ' Your bait went with it.'}`, 'warn'); g.audio.play('warn');
    } else this.lost(msg);
    g.persist();
    g.onLineCut?.(reason);
  }
  /** At splashdown: does the line from the rod tip to the float cross a fishing NPC's line (the NPC waiting on a bite)? One tangle per NPC per outing. */
  checkTangle(tip, fp) {
    const g = this.game, o = g.progress?.outing;
    if (this._outingRef !== (o ?? null)) { this._outingRef = o ?? null; this.tangled.clear(); }
    for (const n of g.npcs?.npcs ?? []) {
      const seg = n.lineSeg?.();
      if (!seg || this.tangled.has(n.id)) continue;
      if (crosses({ x: tip.x, z: tip.z }, { x: fp.x, z: fp.z }, seg.a, seg.b)) { this.tangled.add(n.id); this.snagWho = n; return true; }
    }
    return false;
  }

  /** Move the rig `step` metres toward the angler along the water. */
  drawIn(fp, eye, step) { const dx = eye.x - fp.x, dz = eye.z - fp.z, d = Math.hypot(dx, dz) || 1; const k = Math.min(step, d) / d; fp.x += dx * k; fp.z += dz * k; }

  /**
   * Working a lure (state 'retrieve'). One key, three moves: tap = twitch (a short hop toward you), hold = reel (steady), nothing = pause (it sinks).
   * A shadow fish, picked from the spot's catch table, comes in behind the lure after a moment and judges the last couple of seconds of moves
   * against its species' lure style (lure.js): the ring over it fills green as its interest rises. It strikes at full interest, or turns away
   * when the rhythm is wrong for long enough. Reel it all the way in and you are back to 'ready' for another cast. Returns the HUD prompt.
   */
  retrieve(dt, t, space, eye, surf, world) {
    const g = this.game, fp = this.float.position, sh = this.sh, move = this.mover.read(space, dt);
    this.reel = move === 'reel';
    if (move === 'reel') { this.drawIn(fp, eye, REEL_SPEED * dt); this.sink = Math.max(0, this.sink - dt * 2); }
    else if (move === 'twitch') { this.drawIn(fp, eye, TWITCH_HOP); this.sink = 0; g.fx.splash?.(fp, 2); g.audio.play('click'); }
    else this.sink = Math.min(1, this.sink + dt * 0.8);
    const depth = Math.max(0.2, surf(fp.x, fp.z) - world.groundAt(fp.x, fp.z));
    fp.y = surf(fp.x, fp.z) - 0.05 - this.sink * Math.min(0.5, depth * 0.5);
    this.lureMesh.rotation.y = Math.atan2(eye.x - fp.x, eye.z - fp.z) + Math.PI / 2;
    this.dist = fp.distanceTo(eye);
    if (this.dist < 2.2) { this.state = 'ready'; this.float.visible = false; this.hideShadow(); return ''; }
    if (this.trySnag(dt, move, 'retrieve')) return SNAG_TEXT.prompt;   // reeling, or sitting sunk, in structure
    const away = this.lineDir;
    if (!sh.on) {
      sh.wait -= dt;
      if (sh.wait <= 0) {
        // A fish notices the lure: it starts a few metres behind it (away from you), a little to one side.
        this.catch = pickCatch(this.spot, this.ctx);
        const info = SPECIES_BY_ID[this.catch.id], mid = info ? (info.length[0] + info.length[1]) / 2 : 40;
        sh.len = Math.max(0.55, Math.min(1.4, 0.5 + mid / 60)); sh.side = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random());
        sh.x = fp.x + away.x * 3.5 - away.z * sh.side; sh.z = fp.z + away.z * 3.5 + away.x * sh.side; sh.hd = Math.atan2(-away.x, -away.z);
        sh.on = true; this.interest = new LureInterest(styleOf(this.catch.id)); this.shadow.visible = true; this.interestRing.visible = true;
      }
    } else {
      const I = this.interest, v = I.step(dt, move), follow = 1.1 + Math.max(0, 1 - I.interest) * 1.4;
      // Steer: sit `follow` metres behind the lure, swinging to the side as interest wavers; ease toward that and face the lure.
      const sway = Math.sin(t * 1.3) * (0.5 + Math.max(0, -I.interest)) * 0.8;
      const tx = fp.x + away.x * follow - away.z * sway, tz = fp.z + away.z * follow + away.x * sway;
      const k = Math.min(1, dt * (2.2 + I.match * 2));
      sh.x += (tx - sh.x) * k; sh.z += (tz - sh.z) * k;
      const want = Math.atan2(fp.x - sh.x, fp.z - sh.z); let da = ((want - sh.hd + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; sh.hd += da * Math.min(1, 5 * dt);
      const gr = world.groundAt(sh.x, sh.z), su = surf(sh.x, sh.z);
      this.shadow.position.set(sh.x, Math.max(gr + 0.1, su - 0.35), sh.z); this.shadow.rotation.set(0, sh.hd - Math.PI / 2, 0); this.shadow.scale.set(sh.len, 1, sh.len * 1.2);
      this.interestRing.position.set(sh.x, su + 0.03, sh.z);
      const c = this.interestRing.material.color, pos = Math.max(0, I.interest), neg = Math.max(0, -I.interest / 0.45);
      c.setRGB(0.9 - pos * 0.6 + neg * 0.05, 0.9 - neg * 0.5, 0.9 - pos * 0.5 - neg * 0.5); this.interestRing.material.opacity = 0.35 + 0.45 * Math.max(pos, neg); this.interestRing.scale.setScalar(0.8 + 0.6 * pos);
      if (v === 'strike') { this.hideShadow(); g.fx.splash?.(fp, 8); this.state = 'bite'; this.biteT = 1.3; g.audio.play('warn'); g.useBait(); }
      else if (v === 'spook') {
        this.hideShadow(); sh.wait = 2.5 + Math.random() * 3; this.spooks = (this.spooks ?? 0) + 1;
        g.toast(`It turned away. ${STYLES[I.style].hint}`, 'warn');
      }
    }
    return sh.on ? 'Something is following… keep the rhythm' : 'Work the lure: tap <kbd>Space</kbd> twitch · hold reel · let go pause';
  }
  /** The first time a bait rig is tapped in: one tip on why it wound in (a lure twitches, bait does not). */
  baitTip() {
    const p = this.game.progress; if (p.baitTip) return;
    p.baitTip = true; this.game.persist?.();
    this.game.toast(`Bait sits still and waits: a tap winds it in, a hold draws it slowly closer. Lures are the rigs you work with taps (tackle box, T).`, 'good');
  }
  /** The first time a lure goes in: one tip. */
  lureTip() {
    const p = this.game.progress; if (p.lureTip) return;
    p.lureTip = true; this.game.persist?.();
    this.game.toast('Lures only work when you move them. Tap Space to twitch, hold to reel, let go to pause. A shadow will follow if it likes the rhythm: watch its ring fill green.', 'good');
  }

  /** A thin dark ribbon from the rod tip to the float: sags when slack (and bows a little to the side), pulls straight when a fish works. */
  drawLine(a, b) {
    const p = this.line.geometry.attributes.position, cam = this.game.camera.position;
    const fighting = this.state === 'fight', len = a.distanceTo(b);
    const sag = (['wait', 'bite'].includes(this.state) ? 0.3 : this.state === 'snagged' ? 0.3 * (1 - 0.8 * (this.snag?.tension ?? 0)) : this.state === 'retrieve' ? (this.reel ? 0.08 : 0.22) : fighting ? this.sag : 0.1) * Math.min(14, len) * 0.2, bow = (fighting ? 0.1 : 0.55) * sag;
    const dx = b.x - a.x, dz = b.z - a.z, ln = Math.hypot(dx, dz) || 1, sx = -dz / ln, sz = dx / ln;
    const prev = this._lp ??= new THREE.Vector3(), cur = new THREE.Vector3(), seg = new THREE.Vector3(), side = new THREE.Vector3(), toCam = new THREE.Vector3();
    for (let i = 0; i < LINE_PTS; i++) {
      const k = i / (LINE_PTS - 1), s4 = 4 * k * (1 - k);
      cur.set(a.x + (b.x - a.x) * k + sx * bow * s4, a.y + (b.y + 0.1 - a.y) * k - sag * s4, a.z + (b.z - a.z) * k + sz * bow * s4);
      // Ribbon width perpendicular to both the line and the view direction.
      seg.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize(); toCam.subVectors(cam, cur).normalize();
      side.crossVectors(seg, toCam).normalize().multiplyScalar(LINE_W * 0.5 * (1 + (1 - k) * 0.6));
      p.setXYZ(i * 2, cur.x - side.x, cur.y - side.y, cur.z - side.z); p.setXYZ(i * 2 + 1, cur.x + side.x, cur.y + side.y, cur.z + side.z);
    }
    p.needsUpdate = true;
  }

  /** A missed strike: the fish took the bait and let go, so the bait is gone. The line comes in and you must bait up (checked again at the cast) and cast again; it never goes back to waiting with the old bait and old tackle context. */
  missStrike() {
    const g = this.game;
    if (this.tutorial) { this.state = 'wait'; this.waitT = 1.2 + Math.random(); this.catch = null; g.toast(INTRO.missedStrike, 'warn'); return; }   // the opening: the bite comes back, and no bait is lost
    this.state = 'ready'; this.float.visible = false; this.catch = null; this.ctx = null;
    if (this.onLure) { g.toast('Too slow — it spat the lure out. Strike the moment it hits. Cast and work it again.', 'warn'); return; }
    g.toast(g.baitReady() ? 'Too slow — the fish took the bait and let go. Strike as soon as the float dips. Your bait is gone: hold Space to cast again.' : 'Too slow — the fish took the bait and let go, and that was your last bait. Buy or collect more (tackle box, T), or switch to a lure.', 'warn');
  }

  startFight() {
    const c = this.catch, F = FIGHT[c.id] ?? { profile: 'twitch', power: 0.5 }, gs = this.game.gearStats();
    const w = this.game.walker;
    this.lineDir.set(this.float.position.x - w.pos.x, 0, this.float.position.z - w.pos.z); if (this.lineDir.lengthSq() > 0.25) this.lineDir.normalize(); else this.lineDir.copy(w.facing);
    this.state = 'fight'; this.fightT = 0; this.reel = false; this.dist0 = Math.max(6, this.dist); this.sag = 0.2;
    this.bar.start({
      profile: F.profile, power: F.power, gear: c.gear, size: c.length,
      rod: gs.rod, line: gs.line,   // your rod and reel/line (economy/store.js): zone size, how fast the fish tires you out, how well the line holds a bolting fish
      tutorial: this.tutorial,
      onSave: () => this.game.toast('Strong line held! You turned it just before the reef.', 'good'),
      lostLine: lostLineCount(this.game.progress, this.game.eco.id) > 0,   // a line of yours is still down here: the first litter on the bar is that line (snags.js)
      onLitter: (kind, meta) => this.game.onLitter(kind, meta),
      onEnd: r => {
        if (r.won) this.land();
        else if (r.reason === 'snag') this.cutLine('fight', 'Snagged! The fish dived for structure (reef, rocks, weed) and cut the line. Reef fish bolt for cover: keep the pressure on and turn them before they get there.');
        else this.lost('The fish shook the hook and got away. Keep the fish inside the green zone to wear it out.');
      },
    });
    this.game.audio.play('trick', { combo: 0 });
    this.game.intro?.onStrike?.();
  }
  lost(msg) {
    this.bar.stop(); this.float.visible = false; this.state = 'ready'; this.game.walker.frozen = false;
    this.game.toast(msg, 'warn'); this.game.audio.play('warn');
  }
  land() {
    const g = this.game, c = this.catch;
    this.bar.stop(); this.float.visible = false; this.state = 'landed';
    g.audio.play('splash');
    // Hold the fish up high, I Just Wanted to Fish style.
    const look = LOOKS[c.id];
    if (look) {
      const built = buildFish({ ...look, length: Math.max(0.5, Math.min(1.2, c.length / 100 * 3)) }); // oversized so it reads from up high
      const mat = new THREE.MeshStandardMaterial({ map: built.texture, roughness: 0.45, side: THREE.DoubleSide });
      const m = new THREE.Mesh(built.geometry, mat);
      m.rotation.set(Math.PI / 2, 0, 0); m.position.set(0.05, 0.1, 0.02); m.castShadow = true;
      const holder = new THREE.Group(); holder.add(m); g.angler.hold(holder); this.held = holder;
    }
    if (SPECIES_BY_ID[c.id]?.habitat === 'invertebrate') g.inkSplash?.(g.walker.pos);   // squid and cuttlefish squirt ink as they come out of the water
    // A moment to admire the catch before the keep-or-release card opens.
    this.landT = 1.2; this.landed = { ...c, ctx: this.ctx };
  }
}

function makeBang() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff3d2'; x.strokeStyle = '#1f5f6b'; x.lineWidth = 8;
  x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = '#e8553d'; x.font = '800 84px "Arial Rounded MT Bold", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 64, 70);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
  s.scale.setScalar(1.0); s.renderOrder = 20;
  return s;
}
const LINE_OUT = ['flying', 'wait', 'retrieve', 'snagged', 'bite', 'fight', 'landed'];
const REEL_SPEED = 1.7, TWITCH_HOP = 0.45, DRAW_SPEED = 0.7;   // m/s reeling a lure, metres per twitch, m/s drawing a bait in
const SHOAL_NEAR = 3;   // a bait this close to a school (metres) bites sooner, and that school's species takes it
export { RULES, judge };
