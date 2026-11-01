// The visible angler: a chunky, cel-shaded character built from the Blender parts in assets/models/tideline_cosy.glb
// (tools/blender/tideline.py). Each part is its own mesh with its joint at the object origin, so posing is just rotating
// joints. Everything the character creator offers is a real mesh or a colour slot: hair (6), hats (5), sunnies (2), shirt patterns (3),
// colours for skin, hair, hat, shirt, shorts and the rod. The meshes for an option are only built when it is chosen.
//   setAppearance({ skin, hair, hairStyle, hatStyle, hat, shirt, pattern, shorts, sunnies, rod })   (colours as 0xRRGGBB or CSS strings)
// Procedural animation: idle, walk, wind-up, cast, wait, fight (rod bends, leans back), hold up the catch.
import * as THREE from 'three';
import { clamp, damp } from '../core/noise.js';
import { patchUnderwater } from '../ocean/shaders.js';

import { DEFAULT_LOOK } from './angler-defaults.js';
export { DEFAULT_LOOK };
const SLOTS = ['skin', 'hair', 'hat', 'shirt', 'shorts', 'trim'];
/** Which meshes each option shows (tools/blender/tideline.py). `hideUnderHat` parts disappear when a hat is worn (a bun or the top curls would poke through). */
export const OPTION_MESHES = {
  hairStyle: { short: ['ang_hairShort_hair'], long: ['ang_hairLong_hair'], pony: ['ang_hairPony_hair'], buzz: ['ang_hairBuzz_hair'], curly: ['ang_hairCurly_hair', 'ang_hairCurlyTop_hair'], bun: ['ang_hairBun_hair', 'ang_hairBunKnot_hair'] },
  hatStyle: { none: [], bucket: ['ang_hatBucket_hat', 'ang_hatBucketBand_band'], cap: ['ang_hatCap_hat'], straw: ['ang_hatStraw_hat', 'ang_hatStrawBand_band'], beanie: ['ang_hatBeanie_hat'], wide: ['ang_hatWide_hat', 'ang_hatWideBand_band'] },
  sunnies: { none: [], round: ['ang_sunRound_sun'], sport: ['ang_sunSport_sun'] },
  pattern: {
    plain: [], stripes: ['ang_torso_stripes_trim', 'ang_armL_stripes_trim', 'ang_armR_stripes_trim'],
    flowers: ['ang_torso_flowers_trim', 'ang_torso_flowerdots_dots', 'ang_armL_flowers_trim', 'ang_armL_flowerdots_dots', 'ang_armR_flowers_trim', 'ang_armR_flowerdots_dots'],
    fishing: ['ang_torso_pocket_shirt'],
  },
};
export const HIDE_UNDER_HAT = new Set(['ang_hairBunKnot_hair', 'ang_hairCurlyTop_hair']);
const BASE_PARTS = {
  ang_hips_shorts: 'hips', ang_torso_shirt: 'torso', ang_torso_skin: 'torso', ang_head_skin: 'head', ang_head_face: 'head',
  ang_armL_shirt: 'armL', ang_armL_skin: 'armL', ang_armR_shirt: 'armR', ang_armR_skin: 'armR', ang_foreL_skin: 'elbowL', ang_foreR_skin: 'elbowR',
  ang_thighL_shorts: 'thighL', ang_thighL_skin: 'thighL', ang_thighR_shorts: 'thighR', ang_thighR_skin: 'thighR', ang_shinL_skin: 'kneeL', ang_shinR_skin: 'kneeR', ang_footL_shoe: 'ankleL', ang_footR_shoe: 'ankleR',
};
const jointOf = name => BASE_PARTS[name] ?? (name.startsWith('ang_armL') ? 'armL' : name.startsWith('ang_armR') ? 'armR' : name.startsWith('ang_torso') ? 'torso' : 'head');
const ROD_LEN = 2.25;
/** The stripe / petal colour that reads against a shirt colour: cream on dark shirts, deep teal on light ones. */
export function trimFor(shirt) { const c = new THREE.Color(shirt), l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; return l > 0.5 ? 0x1f5f6b : 0xfff3dc; }

// Joint positions in the standing pose (must match PIV in tools/blender/tideline.py).
const P = { hips: [0, .52, 0], head: [0, .98, 0], armL: [.27, .90, 0], armR: [-.27, .90, 0], elbowL: [.27, .62, 0], elbowR: [-.27, .62, 0], thighL: [.12, .50, 0], thighR: [-.12, .50, 0], kneeL: [.12, .26, 0], kneeR: [-.12, .26, 0], ankleL: [.12, .07, 0], ankleR: [-.12, .07, 0] };
const rel = (a, b) => P[a].map((v, i) => v - P[b][i]);
const ease = k => k * k * (3 - 2 * k);

export class Angler {
  /** @param {Map<string, THREE.BufferGeometry>} models the tideline_cosy.glb set */
  constructor(scene, models, look = {}, { lo = false, shadows = false } = {}) {
    this.models = models; this.lo = lo; this.shadowOn = shadows;
    this.look = { ...DEFAULT_LOOK, ...look };
    this.root = new THREE.Group(); this.root.name = 'angler';
    this.mats = {};
    for (const s of SLOTS) this.mats[s] = this.material(0xffffff);
    this.fixed = this.material(0xffffff);
    this.optionMeshes = new Map();   // name -> mesh, built on first use
    const J = {}; this.joints = J;
    const joint = (name, parent, at) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); parent.add(g); J[name] = g; return g; };
    joint('hips', this.root, P.hips);
    joint('thighL', J.hips, rel('thighL', 'hips')); joint('thighR', J.hips, rel('thighR', 'hips'));
    joint('kneeL', J.thighL, rel('kneeL', 'thighL')); joint('kneeR', J.thighR, rel('kneeR', 'thighR'));
    joint('ankleL', J.kneeL, rel('ankleL', 'kneeL')); joint('ankleR', J.kneeR, rel('ankleR', 'kneeR'));
    joint('torso', J.hips, [0, 0, 0]);
    joint('head', J.torso, rel('head', 'hips'));
    joint('armL', J.torso, rel('armL', 'hips')); joint('armR', J.torso, rel('armR', 'hips'));
    joint('elbowL', J.armL, rel('elbowL', 'armL')); joint('elbowR', J.armR, rel('elbowR', 'armR'));
    for (const [n, j] of Object.entries(BASE_PARTS)) this.makePart(n, j);
    this.buildRod(models);
    // The catch is held out to the left in the raised hand, lying flat so it reads from the high camera.
    this.holder = new THREE.Group(); this.root.add(this.holder); this.holder.position.set(0.8, 1.3, 0.2);
    this.setAppearance(this.look);
    scene.add(this.root);
    this.root.visible = false;
    this.phase = 0; this.t = 0; this.castT = 9; this.prevState = 'off'; this.rodPhi = 0.95; this.lean = 0; this.bend = 0;
    this.tmpQ = new THREE.Quaternion(); this.tmpV = new THREE.Vector3(); this.tmpP = new THREE.Quaternion();
  }
  material(color) {
    const m = new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.85, metalness: 0 });
    return patchUnderwater(m, { key: 'angler' });
  }
  /** A mesh for a named Blender part on its joint (the low-poly _lo version on the low tier when there is one). */
  makePart(name, jointName = jointOf(name)) {
    const geo = (this.lo && this.models.get(name + '_lo')) || this.models.get(name);
    if (!geo) { console.warn('Angler part missing:', name); return null; }
    const slot = name.split('_').pop();
    const m = new THREE.Mesh(geo, SLOTS.includes(slot) ? this.mats[slot] : this.fixed);
    m.name = name; m.userData.noOutline = true; m.castShadow = this.shadowOn; m.receiveShadow = this.shadowOn;
    this.joints[jointName].add(m);
    return m;
  }
  /** Character creation hook: any of { skin, hair, hairStyle, hatStyle, hat, shirt, pattern, shorts, sunnies, rod }. Colours are 0xRRGGBB or CSS strings. */
  setAppearance(a = {}) {
    Object.assign(this.look, a);
    const L = this.look;
    for (const s of SLOTS) if (s !== 'trim') this.mats[s].color.set(L[s]);
    this.mats.trim.color.set(trimFor(L.shirt));
    if (this.rodMat) this.rodMat.color.set(L.rod);
    // Show only the meshes the chosen options use.
    const want = new Set();
    for (const [key, table] of Object.entries(OPTION_MESHES)) for (const n of table[L[key]] ?? []) want.add(n);
    const hatOn = (L.hatStyle ?? 'none') !== 'none';
    for (const n of want) {
      if (!this.optionMeshes.has(n)) this.optionMeshes.set(n, this.makePart(n));
    }
    for (const [n, m] of this.optionMeshes) if (m) m.visible = want.has(n) && !(hatOn && HIDE_UNDER_HAT.has(n));
    return { ...this.look };
  }
  castShadows(on) { this.shadowOn = on; this.root.traverse(o => { if (o.isMesh) { o.castShadow = on; o.receiveShadow = on; } }); }

  buildRod(models) {
    const J = this.joints;
    // The mount follows the right hand but is oriented in world space each frame (so the rod points where the pose says).
    this.rodMount = new THREE.Group(); J.elbowR.add(this.rodMount); this.rodMount.position.set(0, -0.32, 0.02);
    this.rod = new THREE.Group(); this.rodMount.add(this.rod); this.rod.position.y = -0.1;
    const blank = this.rodMat = new THREE.MeshStandardMaterial({ color: this.look.rod, roughness: 0.55 });
    const grip = models.get('rod_grip');
    if (grip) { const g = new THREE.Mesh(grip, this.material(0xffffff)); g.material.vertexColors = true; g.scale.setScalar(1.35); this.rod.add(g); }
    const reel = models.get('rod_reel');
    if (reel) { const r = new THREE.Mesh(reel, this.material(0xffffff)); r.material.vertexColors = true; r.position.set(0, 0.1, 0); r.scale.setScalar(1.6); this.rod.add(r); }
    // The blank is three tapering segments, each bent a little more than the one below, so the rod flexes under a fish.
    const segs = []; let parent = this.rod, y = 0.36;
    const lens = [0.8, 0.75, 0.7];
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Group(); seg.position.y = y; parent.add(seg);
      const r0 = 0.026 - i * 0.0055, r1 = 0.0205 - i * 0.0055 - 0.004;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.005, r1), r0, lens[i], 8), blank); m.position.y = lens[i] / 2; m.castShadow = true; seg.add(m);
      segs.push(seg); parent = seg; y = lens[i];
    }
    this.rod.userData.segs = segs;
    this.rodTip = new THREE.Object3D(); this.rodTip.position.y = lens[2]; parent.add(this.rodTip);
    this.rod.visible = false;
  }
  /** Bend the rod: 0 straight .. 1 deep bend (spread along the shaft). */
  setBend(b, t = 0) {
    this.bend = b;
    this.rod.userData.segs.forEach((seg, i) => { seg.rotation.x = b * 0.2 * (i + 1) * 0.6 + (b > 0.5 ? Math.sin(t * 22 + i) * 0.015 * b : 0); });
  }

  /** Show the catch in the raised hand (a THREE.Object3D) or clear it (null). */
  hold(obj) {
    for (const c of [...this.holder.children]) this.holder.remove(c);
    if (obj) this.holder.add(obj);
    this.holding = !!obj;
  }

  /** Walk-ready transform: stand on the ground at pos, facing heading. */
  place(pos, heading, waterDepth = 0) {
    this.root.position.set(pos.x, pos.y, pos.z);
    this.root.rotation.y = heading;
  }

  /**
   * Pose the joints. ctx: { speed, state (fishing: off|ready|charge|flying|wait|bite|fight|landed), power, act, moving, rodOut, reducedMotion }
   * Joint targets are eased so poses blend into each other.
   */
  update(dt, t, ctx) {
    const J = this.joints, speed = ctx.speed ?? 0, state = ctx.state ?? 'off';
    this.t = t;
    if (state !== this.prevState) { if (state === 'flying') this.castT = 0; this.prevState = state; }
    this.castT += dt;
    const w = clamp(speed / 2.6, 0, 1.6), still = 1 - Math.min(1, w);
    this.phase += dt * (3.5 + speed * 2.2) * (speed > 0.25 ? 1 : 0);
    const sw = Math.sin(this.phase) * 0.75 * Math.min(1, w), sw2 = Math.sin(this.phase + Math.PI) * 0.75 * Math.min(1, w);
    const breathe = Math.sin(t * 2.1) * 0.012, sway = ctx.reducedMotion ? 0 : Math.sin(t * 1.3) * 0.03 * still;
    const rodOut = state !== 'off';
    // Targets for the arms, the rod angle phi (0 = level forward, pi/2 = straight up, > pi/2 leaning back) and the body lean.
    let aRx = -sw2 * 0.9, aRz = -0.12, eRx = -0.25, aLx = -sw * 0.9, aLz = 0.12, eLx = -0.15, lean = 0, phi = 0.95, headX = 0, hipY = 0, rate = 12;
    if (rodOut) {
      aRx = -0.85 - Math.max(0, -sw2) * 0.1; aRz = -0.1; eRx = -0.7;
      aLx = -0.35 + sw * 0.2; eLx = -0.4;
      phi = 0.95 + Math.sin(t * 1.6) * 0.015;
    }
    const act = ctx.act ?? 0;
    if (state === 'charge') {
      const p = ctx.power ?? 0; // wind back: the rod goes up and over, the shoulder rotates, the body leans back
      aRx = -0.85 + p * 1.5; eRx = -0.7 - p * 0.5; phi = 0.95 + p * 1.0; lean = -0.14 * p; aLx = -0.55 + p * 0.3;
      rate = 9;
    } else if (state === 'flying' || (state === 'wait' && this.castT < 0.6)) {
      // The cast: snap the rod forward and down, follow through, settle.
      const k = clamp(this.castT / 0.3, 0, 1), e = ease(k);
      aRx = THREE.MathUtils.lerp(0.65, -1.5, e); eRx = THREE.MathUtils.lerp(-1.2, -0.5, e); phi = THREE.MathUtils.lerp(1.95, 0.45, e);
      lean = THREE.MathUtils.lerp(-0.15, 0.1, e) * (1 - clamp((this.castT - 0.5) / 0.6, 0, 1)); aLx = -0.6; rate = 22;
      if (this.castT > 0.3) { phi = 0.45 + clamp((this.castT - 0.3) / 0.5, 0, 1) * 0.4; aRx = -1.5 + clamp((this.castT - 0.3) / 0.5, 0, 1) * 0.65; eRx = -0.5 - clamp((this.castT - 0.3) / 0.5, 0, 1) * 0.25; rate = 8; }
    } else if (state === 'wait') {
      phi = 0.78 + Math.sin(t * 0.9) * 0.02; aRx = -0.9; eRx = -0.75;
    } else if (state === 'bite') {
      phi = 0.95 + Math.sin(t * 40) * 0.05; aRx = -0.95; lean = 0.05; headX = 0.22; // lean in, rod tip twitching
    } else if (state === 'fight') {
      // Lean back against the fish; reeling with the left hand, the rod bent and shaking.
      phi = 1.25 + Math.sin(t * 9) * 0.04 * act; lean = -0.2 - 0.08 * act; aRx = -1.05; eRx = -0.9;
      aLx = -0.95; eLx = -1.2 + Math.sin(t * 12) * 0.5; aLz = 0.05; hipY = Math.sin(t * 7) * 0.05 * act; rate = 8; headX = -0.12;
    } else if (state === 'landed') {
      aLx = -0.5 + Math.sin(t * 7) * 0.08; eLx = -0.5; aLz = 2.15 + Math.sin(t * 7) * 0.05; aRx = -0.85; eRx = -0.7; phi = 0.8; lean = -0.04; headX = -0.15;
    }
    if (ctx.phi != null) phi = ctx.phi;   // the character creator holds the rod up beside the head
    if (rodOut && speed > 0.4) { aRx = THREE.MathUtils.lerp(aRx, -0.85, 0.7); }
    const d = (j, p, v) => { j.rotation[p] = damp(j.rotation[p], v, rate, dt); };
    d(J.armR, 'x', aRx); d(J.armR, 'z', aRz); d(J.elbowR, 'x', eRx);
    d(J.armL, 'x', aLx); d(J.armL, 'z', aLz); d(J.elbowL, 'x', eLx);
    d(J.thighL, 'x', sw); d(J.thighR, 'x', sw2);
    d(J.kneeL, 'x', Math.max(0, -sw) * 0.9); d(J.kneeR, 'x', Math.max(0, -sw2) * 0.9);
    d(J.torso, 'x', lean); d(J.torso, 'z', sway); d(J.head, 'x', headX - lean * 0.5); d(J.head, 'z', -sway * 1.5);
    J.hips.position.y = P.hips[1] + breathe + Math.abs(Math.sin(this.phase)) * 0.04 * Math.min(1, w) + hipY * 0.2;
    this.rodPhi = damp(this.rodPhi, phi, rate, dt);
    // Orient the rod in the character's vertical plane: direction (0, sin phi, cos phi) in the root frame.
    this.root.updateWorldMatrix(true, false);
    this.rodMount.parent.updateWorldMatrix(true, false);
    const q = this.tmpQ, pq = this.tmpP, dir = this.tmpV;
    dir.set(0, Math.sin(this.rodPhi), Math.cos(this.rodPhi)).applyQuaternion(this.root.getWorldQuaternion(pq));
    q.setFromUnitVectors(UP, dir);
    this.rodMount.parent.getWorldQuaternion(pq);
    this.rodMount.quaternion.copy(pq.invert().multiply(q));
    this.rod.visible = rodOut;
    if (this.holding) { this.holder.position.y = 1.3 + Math.sin(t * 6) * 0.04; this.holder.rotation.y = Math.sin(t * 5) * 0.25; }
    // The reel faces the angler: spin the grip around the rod axis so the reel hangs below the rod.
    this.setBend(state === 'fight' ? 0.35 + 0.65 * act : state === 'wait' ? 0.05 : state === 'bite' ? 0.2 : state === 'charge' ? 0.25 : 0, t);
  }
}
const UP = new THREE.Vector3(0, 1, 0);
