// Animation helpers for the angler rig (land/angler.js): keyed pose clips, a damped spring for secondary motion and a two-bone IK solve
// for a hand on a reel handle. Pure maths on three.js vectors, no scene objects, so tests/anim.test.mjs can run it in Node.
import * as THREE from 'three';

const smooth = k => k * k * (3 - 2 * k);

/**
 * A clip is { keys: [{ at, pose }] } with `at` in seconds ascending. A channel left out of a key holds the last value it had, so keys
 * only name what changes. sampleClip writes the pose at time t into `out` (channels not yet keyed at t are left untouched) and returns it.
 */
export function sampleClip(clip, t, out = {}) {
  const keys = clip.keys;
  if (!clip._filled) {   // fill each channel forward once so every key is a complete pose
    const cur = {};
    for (const k of keys) { Object.assign(cur, k.pose); k.full = { ...cur }; }
    clip._filled = true;
  }
  if (t <= keys[0].at) return Object.assign(out, keys[0].full);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.at) {
      const k = smooth((t - a.at) / (b.at - a.at));
      for (const ch in b.full) { const va = a.full[ch] ?? b.full[ch], vb = b.full[ch]; out[ch] = va + (vb - va) * k; }
      return out;
    }
  }
  return Object.assign(out, keys[keys.length - 1].full);
}
export const clipLength = clip => clip.keys[clip.keys.length - 1].at;

/**
 * The overhead cast, timed from the moment the key is released (fishing state 'flying'). Channels are the angler's pose targets:
 * phi rod pitch (0 level, pi/2 up, > pi/2 back), aRx/eRx right arm and elbow, aLx/eLx left arm, twist torso yaw (negative = wound to the
 * right, for a right-handed cast), hipTwist hips yaw, lean torso pitch (negative = back), hipZ hips forward shift, step lunge of the left
 * foot, headX head pitch, azOff rod yaw added to the aim. The float leaves the tip at RELEASE_AT (fishing.js holds it on the tip until then).
 */
export const RELEASE_AT = 0.2;
export const CAST = { keys: [
  { at: 0.00, pose: { phi: 1.95, aRx: 0.65, eRx: -1.2, aLx: -0.6, eLx: -0.5, twist: -0.38, hipTwist: -0.14, lean: -0.16, hipZ: -0.04, step: 0, headX: -0.08, azOff: -0.18 } },
  { at: 0.10, pose: { phi: 1.45, aRx: -0.25, eRx: -1.05, twist: -0.18, hipTwist: -0.06, lean: -0.06, hipZ: -0.01, step: 0.25, azOff: -0.08 } },
  { at: 0.20, pose: { phi: 0.42, aRx: -1.55, eRx: -0.45, aLx: -0.75, twist: 0.22, hipTwist: 0.1, lean: 0.13, hipZ: 0.05, step: 0.9, headX: 0.16, azOff: 0.1 } },
  { at: 0.42, pose: { phi: 0.3, aRx: -1.42, eRx: -0.6, twist: 0.14, hipTwist: 0.08, lean: 0.09, hipZ: 0.05, step: 1, headX: 0.12, azOff: 0.06 } },
  { at: 0.95, pose: { phi: 0.78, aRx: -0.9, eRx: -0.75, aLx: -0.35, eLx: -0.4, twist: 0, hipTwist: 0, lean: 0, hipZ: 0.02, step: 0.7, headX: 0.06, azOff: 0 } },
  { at: 1.6, pose: { hipZ: 0, step: 0, headX: 0 } },
] };

/** A damped spring on one value: x follows `target` with overshoot (omega rad/s, zeta damping ratio). Drive with step(dt, target). */
export class Spring {
  constructor(omega = 18, zeta = 0.35) { this.omega = omega; this.zeta = zeta; this.x = 0; this.v = 0; }
  step(dt, target = 0) {
    // Sub-step so a long frame (tab switch, low tier) cannot blow the integration up.
    const n = Math.min(8, Math.max(1, Math.ceil(dt / (1 / 120)))), h = dt / n, w = this.omega;
    for (let i = 0; i < n; i++) { this.v += (-w * w * (this.x - target) - 2 * this.zeta * w * this.v) * h; this.x += this.v * h; }
    return this.x;
  }
  reset(x = 0) { this.x = x; this.v = 0; }
}

const _d = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _x = new THREE.Vector3(), _z = new THREE.Vector3(), _e = new THREE.Vector3(), _m = new THREE.Matrix4();
/**
 * Two-bone IK in the shoulder's parent frame. The upper arm hangs along local -y and the elbow bends about local x so the forearm swings
 * toward local +z. shoulder/target are positions in that frame, l1/l2 bone lengths, pole the side the elbow should fall toward.
 * Writes the shoulder quaternion into outQ and returns the elbow rotation.x (negative = bent). If the target is out of reach the arm points at it.
 */
export function twoBoneIK(shoulder, target, l1, l2, pole, outQ) {
  _d.subVectors(target, shoulder);
  const d = Math.max(1e-4, Math.min(l1 + l2 - 1e-3, _d.length()));
  _d.normalize();
  const cosB = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const cosG = Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)));
  const beta = Math.acos(cosB), gamma = Math.acos(cosG);
  // The plane the elbow lies in: spanned by the target direction and the pole.
  _n.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_n.lengthSq() < 1e-6) _n.set(0, -1, 0).addScaledVector(_d, _d.y);
  _n.normalize();
  _u.copy(_d).multiplyScalar(Math.cos(beta)).addScaledVector(_n, Math.sin(beta));   // upper arm direction
  _e.copy(shoulder).addScaledVector(_u, l1);                                            // elbow position
  _f.subVectors(target, _e).normalize();                                                // forearm direction
  // Basis: local -y along the upper arm, local +z toward where the forearm bends, local x = y cross z.
  _z.copy(_f).addScaledVector(_u, -_f.dot(_u));
  if (_z.lengthSq() < 1e-6) _z.copy(_n).multiplyScalar(-1);
  _z.normalize();
  const y = _u.clone().multiplyScalar(-1);
  _x.crossVectors(y, _z).normalize();
  _m.makeBasis(_x, y, _z);
  outQ.setFromRotationMatrix(_m);
  return -(Math.PI - gamma);
}
