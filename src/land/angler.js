// The visible angler: a chunky, cel-shaded character built from the Blender parts in assets/models/tideline_cosy.glb
// (tools/blender/tideline.py). Each part is its own mesh with its joint at the object origin, so posing is just rotating
// joints. Everything the character creator offers is a real mesh or a colour slot: hair (6), hats (5), sunnies (2), shirt patterns (3),
// colours for skin, hair, hat, shirt, shorts and the rod. The meshes for an option are only built when it is chosen.
//   setAppearance({ skin, hair, hairStyle, beard, beardColor, hatStyle, hat, shirt, pattern, shorts, sunnies, rod })   (colours as 0xRRGGBB or CSS strings)
// Procedural animation: idle, walk, wind-up, a keyed overhead cast (land/anim.js: torso wind and unwind, lunge, rod whips), wait, working a lure and
// fighting with the left hand on the reel handle (two-bone IK), hold up the catch. Hat and hair lag the head on a spring; the head looks at the float.
import * as THREE from 'three';
import { clamp, damp } from '../core/noise.js';
import { patchUnderwater } from '../ocean/shaders.js';
import { CAST, Spring, clipLength, sampleClip, twoBoneIK } from './anim.js';

import { DEFAULT_LOOK } from './angler-defaults.js';
import { BEARD_MESHES, beardGeo } from './beard.js';
export { DEFAULT_LOOK };
const SLOTS = ['skin', 'hair', 'hat', 'shirt', 'shorts', 'trim', 'beard', 'stubble'];
/** Which meshes each option shows (tools/blender/tideline.py). `hideUnderHat` parts disappear when a hat is worn (a bun or the top curls would poke through). */
export const OPTION_MESHES = {
  hairStyle: { short: ['ang_hairShort_hair'], long: ['ang_hairLong_hair'], pony: ['ang_hairPony_hair'], buzz: ['ang_hairBuzz_hair'], curly: ['ang_hairCurly_hair', 'ang_hairCurlyTop_hair'], bun: ['ang_hairBun_hair', 'ang_hairBunKnot_hair'] },
  hatStyle: { none: [], bucket: ['ang_hatBucket_hat', 'ang_hatBucketBand_band'], cap: ['ang_hatCap_hat'], straw: ['ang_hatStraw_hat', 'ang_hatStrawBand_band'], beanie: ['ang_hatBeanie_hat'], wide: ['ang_hatWide_hat', 'ang_hatWideBand_band'] },
  beard: BEARD_MESHES,
  sunnies: { none: [], round: ['ang_sunRound_sun'], sport: ['ang_sunSport_sun'] },
  pattern: {
    plain: [], stripes: ['ang_torso_stripes_trim', 'ang_armL_stripes_trim', 'ang_armR_stripes_trim'],
    flowers: ['ang_torso_flowers_trim', 'ang_torso_flowerdots_dots', 'ang_armL_flowers_trim', 'ang_armL_flowerdots_dots', 'ang_armR_flowers_trim', 'ang_armR_flowerdots_dots'],
    fishing: ['ang_torso_pocket_shirt'],
  },
};
// Hair that would poke through a hat crown or brim: short, buzz, curly and bun hair are hidden under any hat (the hat covers the head). Long and ponytail hair hang below the hat, so they stay.
export const HIDE_UNDER_HAT = new Set(['ang_hairShort_hair', 'ang_hairBuzz_hair', 'ang_hairCurly_hair', 'ang_hairCurlyTop_hair', 'ang_hairBun_hair', 'ang_hairBunKnot_hair']);
const BASE_PARTS = {
  ang_hips_shorts: 'hips', ang_torso_shirt: 'torso', ang_torso_skin: 'torso', ang_head_skin: 'head', ang_head_face: 'head',
  ang_armL_shirt: 'armL', ang_armL_skin: 'armL', ang_armR_shirt: 'armR', ang_armR_skin: 'armR', ang_foreL_skin: 'elbowL', ang_foreR_skin: 'elbowR',
  ang_thighL_shorts: 'thighL', ang_thighL_skin: 'thighL', ang_thighR_shorts: 'thighR', ang_thighR_skin: 'thighR', ang_shinL_skin: 'kneeL', ang_shinR_skin: 'kneeR', ang_footL_shoe: 'ankleL', ang_footR_shoe: 'ankleR',
};
const jointOf = name => BASE_PARTS[name] ?? (name.startsWith('ang_armL') ? 'armL' : name.startsWith('ang_armR') ? 'armR' : name.startsWith('ang_torso') ? 'torso' : 'head');
const ROD_LEN = 2.25;

// ---- Fallback people. If tideline_cosy.glb cannot be loaded the people (Mitra, Nell, the officer, you) are still built from these simple shapes, so the shop, the quests
// and the co-op always exist. Same joints as the Blender parts; coordinates are in the joint's own frame (standing pose, y up, +z forward).
const merged = list => {
  const pos = [], nor = [], idx = [];
  for (const g of list) {
    const base = pos.length / 3, p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    const ix = g.index; for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx);
  return out;
};
const tint = (g, rgb = [1, 1, 1]) => { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(rgb, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
const box = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const tube = (r, h, y, x = 0, z = 0) => new THREE.CylinderGeometry(r, r * 0.9, h, 10).translate(x, y, z);
const ball = (r, x = 0, y = 0, z = 0) => new THREE.SphereGeometry(r, 12, 9).translate(x, y, z);
const FALLBACK = {
  ang_hips_shorts: () => box(0.34, 0.22, 0.2, 0, -0.02, 0), ang_torso_shirt: () => box(0.34, 0.4, 0.2, 0, 0.22, 0), ang_torso_skin: () => box(0.1, 0.08, 0.1, 0, 0.46, 0),
  ang_head_skin: () => ball(0.17, 0, 0.14, 0), ang_head_face: () => merged([ball(0.02, -0.06, 0.17, 0.155), ball(0.02, 0.06, 0.17, 0.155)]),
  ang_armL_shirt: () => tube(0.06, 0.28, -0.14), ang_armR_shirt: () => tube(0.06, 0.28, -0.14), ang_armL_skin: () => ball(0.05, 0, -0.27, 0), ang_armR_skin: () => ball(0.05, 0, -0.27, 0),
  ang_foreL_skin: () => tube(0.045, 0.28, -0.14), ang_foreR_skin: () => tube(0.045, 0.28, -0.14),
  ang_thighL_shorts: () => tube(0.08, 0.24, -0.12), ang_thighR_shorts: () => tube(0.08, 0.24, -0.12), ang_thighL_skin: () => ball(0.001), ang_thighR_skin: () => ball(0.001),
  ang_shinL_skin: () => tube(0.055, 0.2, -0.1), ang_shinR_skin: () => tube(0.055, 0.2, -0.1),
  ang_footL_shoe: () => box(0.1, 0.07, 0.2, 0, -0.02, 0.05), ang_footR_shoe: () => box(0.1, 0.07, 0.2, 0, -0.02, 0.05),
};
let warned = false;
/** A stand-in geometry for a named part (hair and hats get a generic cap / brim), or null. White vertex colours so the slot colours show. */
function fallbackGeo(name) {
  const bg = beardGeo(name); if (bg) return bg;
  const f = FALLBACK[name] ?? (name.endsWith('_hair') ? () => new THREE.SphereGeometry(0.185, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 0.16, -0.01)
    : name.endsWith('_hat') ? () => merged([new THREE.CylinderGeometry(0.2, 0.2, 0.03, 14).translate(0, 0.24, 0), new THREE.CylinderGeometry(0.15, 0.17, 0.12, 12).translate(0, 0.3, 0)]) : null);
  if (!f) return null;
  const g = f();
  return tint(g, name.endsWith('_shoe') ? [0.22, 0.2, 0.2] : name === 'ang_head_face' ? [0.12, 0.1, 0.1] : [1, 1, 1]);
}
/** The stripe / petal colour that reads against a shirt colour: cream on dark shirts, deep teal on light ones. */
export function trimFor(shirt) { const c = new THREE.Color(shirt), l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; return l > 0.5 ? 0x1f5f6b : 0xfff3dc; }

// Joint positions in the standing pose (must match PIV in tools/blender/tideline.py).
const P = { hips: [0, .52, 0], head: [0, .98, 0], armL: [.27, .90, 0], armR: [-.27, .90, 0], elbowL: [.27, .62, 0], elbowR: [-.27, .62, 0], thighL: [.12, .50, 0], thighR: [-.12, .50, 0], kneeL: [.12, .26, 0], kneeR: [-.12, .26, 0], ankleL: [.12, .07, 0], ankleR: [-.12, .07, 0] };
const rel = (a, b) => P[a].map((v, i) => v - P[b][i]);
const ease = k => k * k * (3 - 2 * k);
/** Split a geometry's triangles by a predicate on the triangle centroid: returns [rest, picked] (picked is null when nothing matched). */
function splitGeo(geo, pick) {
  const g = geo.index ? geo.toNonIndexed() : geo, pos = g.attributes.position, n = pos.count / 3, c = new THREE.Vector3();
  const a = [], b = [];
  for (let i = 0; i < n; i++) {
    c.set(0, 0, 0); for (let k = 0; k < 3; k++) c.x += pos.getX(i * 3 + k) / 3, c.y += pos.getY(i * 3 + k) / 3, c.z += pos.getZ(i * 3 + k) / 3;
    (pick(c) ? b : a).push(i);
  }
  const sub = tris => {
    const out = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) {
      const arr = new Float32Array(tris.length * 3 * attr.itemSize);
      tris.forEach((tri, j) => { for (let k = 0; k < 3; k++) for (let m = 0; m < attr.itemSize; m++) arr[(j * 3 + k) * attr.itemSize + m] = attr.array[(tri * 3 + k) * attr.itemSize + m]; });
      out.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize));
    }
    return out;
  };
  return [b.length ? sub(a) : geo, b.length ? sub(b) : null];
}

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
    joint('headTop', J.head, [0, 0, 0]);   // hair and hats hang off this so they can lag the head
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
    this.hold_ = 0; this.pull = 0; this.crank = 0; this.az = 0; this.bendS = 0; this.shake = 0;   // smoothed fight state: reel input, fish pull, hand crank angle, rod azimuth, bend, shake
    this.whip = new Spring(15, 0.28); this.hatX = new Spring(24, 0.22); this.hatZ = new Spring(24, 0.22);   // rod tip lag behind a swing; hat and hair lag behind the head
    this.castPose = {}; this.ikW = 0; this.lookYaw = 0; this.lookPitch = 0; this.lookW = 0; this.prevPhi = this.rodPhi; this.headQ = null; this.stepS = 0;
    this.ikQ = new THREE.Quaternion(); this.ikS = new THREE.Vector3(...rel('armL', 'hips')); this.ikT = new THREE.Vector3(); this.ikPole = new THREE.Vector3(0.7, -1, -0.25); this.lookV = new THREE.Vector3();
    this.tmpQ = new THREE.Quaternion(); this.tmpV = new THREE.Vector3(); this.tmpP = new THREE.Quaternion();
  }
  material(color) {
    const m = new THREE.MeshStandardMaterial({ color, vertexColors: true, roughness: 0.85, metalness: 0 });
    return patchUnderwater(m, { key: 'angler' });
  }
  /** A mesh for a named Blender part on its joint (the low-poly _lo version on the low tier when there is one). */
  makePart(name, jointName = jointOf(name)) {
    const geo = (this.lo && this.models.get(name + '_lo')) || this.models.get(name) || fallbackGeo(name);
    if (!geo) { if (!warned) { warned = true; console.warn('Angler part missing (no model and no fallback):', name); } return null; }
    const slot = name.split('_').pop();
    const m = new THREE.Mesh(geo, SLOTS.includes(slot) ? this.mats[slot] : this.fixed);
    m.name = name; m.userData.noOutline = true; m.castShadow = this.shadowOn; m.receiveShadow = this.shadowOn;
    const top = jointName === 'head' && /_(hair|hat|band)$/.test(name);   // hair and hats lag the head on a spring
    this.joints[top ? 'headTop' : jointName].add(m);
    return m;
  }
  /** Character creation hook: any of { skin, hair, hairStyle, beard, beardColor, hatStyle, hat, shirt, pattern, shorts, sunnies, rod }. Colours are 0xRRGGBB or CSS strings. */
  setAppearance(a = {}) {
    Object.assign(this.look, a);
    const L = this.look;
    for (const s of SLOTS) if (s !== 'trim' && s !== 'beard' && s !== 'stubble') this.mats[s].color.set(L[s]);
    this.mats.beard.color.set(L.beardColor ?? L.hair);                                              // beardColor null = matches the hair
    this.mats.stubble.color.set(this.mats.skin.color).lerp(this.mats.beard.color, 0.72);              // stubble is a shadow of beard colour on the skin
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
    // The reel: body on the seat, and the crank arm split off into its own pivot so it turns when the angler winds (handle knob is where the left hand goes).
    const reelG = new THREE.Group(); reelG.position.set(0, 0.1, 0); reelG.scale.setScalar(1.6); this.rod.add(reelG);
    this.crankPivot = new THREE.Group(); this.crankPivot.position.set(0, -0.008, 0.052); reelG.add(this.crankPivot);
    this.knob = new THREE.Object3D(); this.knob.position.set(0.082, 0, 0.032); this.crankPivot.add(this.knob);
    const reel = models.get('rod_reel');
    if (reel) {
      const [body, crank] = splitGeo(reel, c => c.x > 0.042);
      const rm = this.material(0xffffff); rm.vertexColors = true;
      reelG.add(new THREE.Mesh(body, rm));
      if (crank) { crank.translate(0, 0.008, -0.052); this.crankPivot.add(new THREE.Mesh(crank, rm)); }
    }
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
  /** Bend the rod: 0 straight .. 1 deep bend toward the line (spread along the shaft); negative bows it back, as the tip lags a forward swing. */
  setBend(b, t = 0, shake = 0) {
    this.bend = b;
    // Negative x: the tip bows forward and down toward the line. A fish making a run adds a small quiver.
    this.rod.userData.segs.forEach((seg, i) => { seg.rotation.x = -(b * 0.12 * (i + 1)) + Math.sin(t * 19 + i) * 0.02 * shake * (i + 1); });
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
   * Pose the joints. ctx: { speed, state (fishing: off|ready|charge|flying|wait|retrieve|bite|fight|landed), power, act, reel, fightT, side, look (world point the
   * angler watches, e.g. the float), reducedMotion }. Joint targets are eased so poses blend into each other; the cast itself is a keyed clip (anim.js CAST).
   */
  update(dt, t, ctx) {
    const J = this.joints, speed = ctx.speed ?? 0, state = ctx.state ?? 'off', rm = !!ctx.reducedMotion;
    this.t = t;
    if (state !== this.prevState) { if (state === 'flying') this.castT = 0; this.prevState = state; }
    this.castT += dt;
    const w = clamp(speed / 2.6, 0, 1.6), still = 1 - Math.min(1, w);
    this.phase += dt * (3.5 + speed * 2.2) * (speed > 0.25 ? 1 : 0);
    const sw = Math.sin(this.phase) * 0.75 * Math.min(1, w), sw2 = Math.sin(this.phase + Math.PI) * 0.75 * Math.min(1, w);
    const breathe = Math.sin(t * 2.1) * 0.012, sway = rm ? 0 : Math.sin(t * 1.3) * 0.03 * still;
    const rodOut = state !== 'off';
    // Targets: arms (aRx/aRz/eRx right, aLx/aLz/eLx left), rod pitch phi (0 level, pi/2 up, > pi/2 back), torso lean and twist, hips twist and shift, lunge step, head pitch.
    let aRx = -sw2 * 0.9, aRz = -0.12, eRx = -0.25, aLx = -sw * 0.9, aLz = 0.12, eLx = -0.15, lean = 0, twist = 0, hipTwist = 0, hipZ = 0, step = 0, azOff = 0, phi = 0.95, headX = 0, rate = 12, crankRate = 0, shakeAmp = 0, ik = 0, look = 0, bendT = 0;
    if (rodOut) {
      aRx = -0.85 - Math.max(0, -sw2) * 0.1; aRz = -0.1; eRx = -0.7;
      aLx = -0.35 + sw * 0.2; eLx = -0.4;
      phi = 0.95 + Math.sin(t * 1.6) * 0.015;
    }
    const act = ctx.act ?? 0;
    // Smooth the inputs once per frame (rise a little faster than fall) so the pose never snaps.
    const reelIn = (state === 'fight' || state === 'retrieve') && ctx.reel ? 1 : 0;
    this.hold_ += (reelIn - this.hold_) * Math.min(1, dt * (reelIn > this.hold_ ? 6 : 4));
    this.pull += ((state === 'fight' ? act : 0) - this.pull) * Math.min(1, dt * 5);
    this.tension = clamp(0.3 + 0.3 * this.hold_ + 0.55 * this.pull, 0, 1);
    this.crank = (this.crank + dt * (state === 'fight' ? 0.5 + 6.5 * this.hold_ : state === 'retrieve' ? 5 * this.hold_ : 0)) % (Math.PI * 2);
    this.az = damp(this.az, state === 'fight' || state === 'wait' || state === 'retrieve' || state === 'bite' ? clamp(ctx.side ?? 0, -0.45, 0.45) : 0, 4, dt);
    const lineOut = ['flying', 'wait', 'retrieve', 'bite', 'fight'].includes(state);
    const inCast = lineOut && this.castT < clipLength(CAST), cp = inCast ? sampleClip(CAST, this.castT, this.castPose) : null;
    if (state === 'charge') {
      const p = ctx.power ?? 0; // wind back: the rod goes up and over, the shoulder rotates, the torso winds to the right and the weight settles on the back foot
      aRx = -0.85 + p * 1.5; eRx = -0.7 - p * 0.5; phi = 0.95 + p * 1.0; lean = -0.16 * p; aLx = -0.55 + p * 0.3; eLx = -0.5;
      twist = -0.38 * p; hipTwist = -0.14 * p; hipZ = -0.04 * p; azOff = -0.18 * p; headX = -0.08 * p;
      rate = 9;
    } else if (cp && this.castT < 0.95) {
      // The cast: the keyed clip drives everything (anim.js CAST). Fast easing through the snap, slower on the settle.
      ({ phi, aRx, eRx, aLx, eLx, twist, hipTwist, lean, hipZ, step, headX, azOff } = cp); rate = this.castT < 0.5 ? 26 : 9;
    } else if (state === 'wait') {
      phi = 0.78 + Math.sin(t * 0.9) * 0.02; aRx = -0.9; eRx = -0.75; look = 1; bendT = 0.05;
    } else if (state === 'retrieve') {
      // Working a lure: rod a little higher than waiting, the left hand on the reel handle (IK below), cranking while Space is held.
      const hs = this.hold_;
      phi = 0.85 + 0.08 * hs + Math.sin(t * 0.9) * 0.02; ik = 1; look = 1; bendT = 0.06 + 0.1 * hs;
      aRx = -0.45; aRz = 0.3; eRx = -1.45; twist = 0.22; aLx = -0.85; aLz = 0.08; eLx = -1.1;   // rod butt tucked in at the hip so the other hand reaches the handle
    } else if (state === 'bite') {
      phi = 0.95 + Math.sin(t * 14) * 0.03; aRx = -0.95; lean = 0.05; headX = 0.22; look = 1; bendT = 0.2;   // lean in, rod tip twitching
    } else if (state === 'fight') {
      // Feet planted, rod up and angled at the fish, body leaning back when it pulls, the left hand winding the reel while the bar is held.
      // Everything is driven by smoothed values (hold_, pull), so Space toggling every few ms reads as a steady reel, not a flicker.
      const hs = this.hold_, pl = this.pull, burst = clamp((pl - 0.3) / 0.7, 0, 1);
      const strike = ctx.fightT != null ? ease(clamp(1 - ctx.fightT / 0.45, 0, 1)) * Math.sin(clamp(ctx.fightT / 0.12, 0, 1) * Math.PI / 2) : 0;   // a quick rod lift as the hook is set
      phi = 1.1 + 0.12 * this.tension + 0.55 * strike; lean = -0.1 - 0.1 * pl - 0.05 * hs - 0.12 * strike; aRx = -0.5 - 0.3 * strike; aRz = 0.3; eRx = -1.45 - 0.2 * strike;
      aLx = -0.9; aLz = 0.08; eLx = -1.15; ik = 1; look = 0.6;
      step = 0.5; hipZ = 0.02; twist = 0.22; rate = 7; headX = -0.1; bendT = 0.3 + 0.7 * this.tension;
      shakeAmp = burst;
    } else if (state === 'landed') {
      aLx = -0.5 + Math.sin(t * 7) * 0.08; eLx = -0.5; aLz = 2.15 + Math.sin(t * 7) * 0.05; aRx = -0.85; eRx = -0.7; phi = 0.8; lean = -0.04; headX = -0.15;
    }
    if (cp && this.castT >= 0.95) { step = Math.max(step, cp.step); hipZ = Math.max(hipZ, cp.hipZ); headX = Math.max(headX, cp.headX); }   // the lunge eases out under the next pose
    if (ctx.phi != null) phi = ctx.phi;   // the character creator holds the rod up beside the head
    if (rodOut && speed > 0.4) { aRx = THREE.MathUtils.lerp(aRx, -0.85, 0.7); }
    // Head look: watch the float (or whatever ctx.look points at) once the cast has settled.
    const lk = ctx.look;
    if (lk && look > 0) {
      const v = this.lookV.copy(lk); this.root.worldToLocal(v); v.y -= 1.0;
      const h = Math.hypot(v.x, v.z);
      this.lookYaw = damp(this.lookYaw, clamp(Math.atan2(v.x, v.z), -0.9, 0.9), 5, dt);
      this.lookPitch = damp(this.lookPitch, clamp(Math.atan2(-v.y, h), -0.2, 0.55), 5, dt);
    }
    this.lookW = damp(this.lookW, lk && look > 0 && !(cp && this.castT < 0.45) ? look : 0, 5, dt);
    const d = (j, p, v, r = rate) => { j.rotation[p] = damp(j.rotation[p], v, r, dt); };
    this.shake = damp(this.shake, shakeAmp, 6, dt);
    d(J.armR, 'x', aRx); d(J.armR, 'z', aRz); d(J.elbowR, 'x', eRx);
    const cr = crankRate || rate;
    d(J.armL, 'x', aLx, cr); d(J.armL, 'z', aLz, cr); d(J.elbowL, 'x', eLx, cr);
    // Legs: the walk cycle, or a lunge (left foot forward, back heel up) after a cast and through a fight.
    this.stepS = damp(this.stepS, step, 8, dt);
    const st = this.stepS;
    d(J.thighL, 'x', sw - 0.5 * st); d(J.thighR, 'x', sw2 + 0.38 * st);
    d(J.kneeL, 'x', Math.max(0, -sw) * 0.9 + 0.42 * st); d(J.kneeR, 'x', Math.max(0, -sw2) * 0.9 + 0.1 * st);
    d(J.ankleL, 'x', 0.1 * st); d(J.ankleR, 'x', -0.45 * st);
    d(J.torso, 'x', lean); d(J.torso, 'y', twist); d(J.torso, 'z', sway + Math.sin(t * 13) * 0.025 * this.shake);
    d(J.hips, 'y', hipTwist);
    d(J.head, 'x', headX - lean * 0.5 + this.lookPitch * this.lookW); d(J.head, 'y', -twist * 0.6 + this.lookYaw * this.lookW); d(J.head, 'z', -sway * 1.5);
    J.hips.position.y = P.hips[1] + breathe + Math.abs(Math.sin(this.phase)) * 0.04 * Math.min(1, w) - 0.06 * st;
    J.hips.position.z = damp(J.hips.position.z, hipZ + 0.1 * st, 10, dt);
    this.rodPhi = damp(this.rodPhi, phi, rate, dt);
    // Orient the rod in the character's vertical plane: direction (0, sin phi, cos phi) in the root frame, yawed by the aim and the cast's sweep.
    this.root.updateWorldMatrix(true, false);
    this.rodMount.parent.updateWorldMatrix(true, false);
    // A full basis, not just a direction: the reel must hang below the rod facing forward whichever way the angler faces (a minimal rotation rolled it with the heading).
    const q = this.tmpQ, pq = this.tmpP, dir = this.tmpV, az = this.az + azOff, cp_ = Math.cos(this.rodPhi), sp_ = Math.sin(this.rodPhi);
    dir.set(Math.sin(az) * cp_, sp_, Math.cos(az) * cp_);
    RX.set(Math.cos(az), 0, -Math.sin(az)); RZ.crossVectors(RX, dir);
    q.setFromRotationMatrix(RM.makeBasis(RX, dir, RZ)).premultiply(this.root.getWorldQuaternion(pq));
    this.rodMount.parent.getWorldQuaternion(pq);
    this.rodMount.quaternion.copy(pq.invert().multiply(q));
    this.rod.visible = rodOut;
    if (this.holding) { this.holder.position.y = 1.3 + Math.sin(t * 6) * 0.04; this.holder.rotation.y = Math.sin(t * 5) * 0.25; }
    // Left hand on the reel handle: the crank turns with the winding, and a two-bone IK puts the hand on the knob (blended in while reeling states last).
    this.crankPivot.rotation.x = -this.crank;
    this.ikW = damp(this.ikW, ik, 6, dt);
    if (this.ikW > 0.01) {
      this.rodMount.updateWorldMatrix(false, true);
      this.knob.getWorldPosition(this.ikT); J.torso.worldToLocal(this.ikT);
      const elbow = twoBoneIK(this.ikS, this.ikT, 0.28, 0.33, this.ikPole, this.ikQ);
      J.armL.quaternion.slerp(this.ikQ, this.ikW);
      J.elbowL.rotation.x = THREE.MathUtils.lerp(J.elbowL.rotation.x, elbow, this.ikW);
    }
    // The rod flexes: a steady bend toward the line (a fish, a lure on the retrieve) plus the tip lagging any fast swing of the rod, which whips through the cast.
    const omega = dt > 0 ? (this.rodPhi - this.prevPhi) / dt : 0; this.prevPhi = this.rodPhi;
    this.whip.zeta = rm ? 1 : 0.28;
    const whip = this.whip.step(dt, clamp(omega * 0.045, -0.5, 0.5));
    this.bendS = damp(this.bendS, bendT + (ctx.extraBend ?? 0), 7, dt);   // extraBend: the rod loaded by a snag (fishing.js)
    this.setBend(this.bendS + whip, t, this.shake);
    // Hat and hair lag the head by a fraction of each turn, then spring back.
    J.head.updateWorldMatrix(true, false);
    const hq = J.head.getWorldQuaternion(this.tmpQ);
    if (this.headQ && !rm) {
      const dq = this.tmpP.copy(this.headQ).invert().premultiply(hq);   // this frame's turn, in world
      dq.premultiply(hq.clone().invert()).multiply(hq);                  // ...in the head's own frame
      const ang = 2 * Math.acos(clamp(dq.w, -1, 1)), s = Math.sqrt(Math.max(1e-9, 1 - dq.w * dq.w));
      if (ang > 1e-4 && ang < 1) { this.hatX.x -= dq.x / s * ang * 0.5; this.hatZ.x -= dq.z / s * ang * 0.5; }
    } else { this.hatX.reset(); this.hatZ.reset(); }
    this.headQ = (this.headQ ?? new THREE.Quaternion()).copy(hq);
    J.headTop.rotation.x = clamp(this.hatX.step(dt, 0), -0.3, 0.3); J.headTop.rotation.z = clamp(this.hatZ.step(dt, 0), -0.3, 0.3);
  }
}
const RX = new THREE.Vector3(), RZ = new THREE.Vector3(), RM = new THREE.Matrix4();
