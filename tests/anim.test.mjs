// The angler's animation helpers (src/land/anim.js): the keyed cast clip, the secondary-motion spring and the reel-hand IK.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAST, RELEASE_AT, Spring, clipLength, sampleClip, twoBoneIK } from '../src/land/anim.js';

test('sampleClip holds unkeyed channels, eases between keys and clamps past the ends', () => {
  const clip = { keys: [{ at: 0, pose: { a: 0, b: 5 } }, { at: 1, pose: { a: 10 } }, { at: 2, pose: { b: 1 } }] };
  assert.deepEqual(sampleClip(clip, -1), { a: 0, b: 5 });
  const mid = sampleClip(clip, 0.5); assert.equal(mid.a, 5); assert.equal(mid.b, 5, 'b is held while only a is keyed');
  const q = sampleClip(clip, 0.25); assert.ok(q.a > 0 && q.a < 5, 'eased, not linear: ' + q.a);
  assert.deepEqual(sampleClip(clip, 1.5), { a: 10, b: 3 });
  assert.deepEqual(sampleClip(clip, 9), { a: 10, b: 1 });
  assert.equal(clipLength(clip), 2);
});

test('the cast clip: rod loaded back at the start, forward and down at release, torso unwinds through it, settles to the wait pose', () => {
  const start = sampleClip(CAST, 0), rel = sampleClip(CAST, RELEASE_AT), end = sampleClip(CAST, clipLength(CAST));
  assert.ok(start.phi > 1.7, 'rod back over the shoulder');
  assert.ok(rel.phi < 0.6, 'rod forward at release: ' + rel.phi);
  assert.ok(start.twist < -0.2 && rel.twist > 0.1, 'torso winds right then unwinds past centre');
  assert.ok(start.lean < 0 && rel.lean > 0, 'weight moves from the back foot to the front');
  assert.ok(rel.step > 0.5, 'the left foot lunges by release');
  assert.ok(Math.abs(end.phi - 0.78) < 1e-9 && end.twist === 0 && end.step === 0 && end.hipZ === 0, 'back to the wait pose with the feet square');
  // phi only falls between the start and the release (one clean snap, no wobble), and the rod never goes below level.
  let prev = Infinity;
  for (let t = 0; t <= RELEASE_AT; t += 0.01) { const p = sampleClip(CAST, t).phi; assert.ok(p <= prev + 1e-9, `phi rises at ${t}`); assert.ok(p > 0.2); prev = p; }
});

test('Spring: overshoots the target with light damping and settles; critical damping never overshoots', () => {
  const s = new Spring(15, 0.28); let min = Infinity;
  for (let t = 0; t < 2; t += 1 / 60) { const x = s.step(1 / 60, t < 0.1 ? -0.4 : 0); if (t > 0.1) min = Math.min(min, x); }
  assert.ok(min < -0.05, 'swings through after the drive stops: ' + min);
  assert.ok(Math.abs(s.x) < 0.01, 'settled by 2 s: ' + s.x);
  let max = -Infinity;
  for (let t = 0; t < 2; t += 1 / 60) { const x = s.step(1 / 60, t < 0.1 ? 0.4 : 0); if (t > 0.1) max = Math.max(max, x); }
  const c = new Spring(15, 1); let over = false; c.reset(0.4);
  for (let t = 0; t < 2; t += 1 / 60) if (c.step(1 / 60, 0) < -1e-6) over = true;
  assert.ok(!over, 'critically damped: no overshoot');
  // A long frame (tab switch) does not blow up.
  const big = new Spring(24, 0.22); big.reset(0.3); big.step(0.5, 0); assert.ok(Number.isFinite(big.x) && Math.abs(big.x) < 0.3);
});

/** Forward kinematics of the arm the IK poses: shoulder at S, upper arm along local -y of q, elbow bent about local x by `elbow`. */
function hand(S, q, elbow, l1, l2) {
  const up = new THREE.Vector3(0, -l1, 0).applyQuaternion(q);
  const E = S.clone().add(up);
  const fq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), elbow));
  return { E, H: E.clone().add(new THREE.Vector3(0, -l2, 0).applyQuaternion(fq)) };
}
test('twoBoneIK puts the hand on the target with the elbow toward the pole, and reaches toward targets out of range', () => {
  const S = new THREE.Vector3(0.27, 0.38, 0), pole = new THREE.Vector3(0.7, -1, -0.25), q = new THREE.Quaternion(), l1 = 0.28, l2 = 0.3;
  for (const T of [[-0.1, 0.2, 0.25], [0.15, 0.05, 0.3], [-0.05, 0.3, 0.1], [0.3, 0.0, 0.2]]) {
    const target = new THREE.Vector3(...T);
    const elbow = twoBoneIK(S, target, l1, l2, pole, q);
    const { E, H } = hand(S, q, elbow, l1, l2);
    assert.ok(H.distanceTo(target) < 1e-6, `hand on target ${T}: off by ${H.distanceTo(target)}`);
    assert.ok(elbow <= 0 && elbow > -Math.PI, 'elbow bends the natural way: ' + elbow);
    // The elbow sits on the pole side of the shoulder-target line.
    const d = target.clone().sub(S).normalize(), e = E.clone().sub(S); e.addScaledVector(d, -e.dot(d));
    assert.ok(e.dot(pole) > 0, `elbow toward the pole for ${T}`);
  }
  const far = new THREE.Vector3(0.27, -0.5, 0.9), elbow = twoBoneIK(S, far, l1, l2, pole, q), { H } = hand(S, q, elbow, l1, l2);
  assert.ok(Math.abs(elbow) < 0.25, 'arm nearly straight at full reach: ' + elbow);
  assert.ok(H.clone().sub(S).normalize().dot(far.clone().sub(S).normalize()) > 0.999, 'pointing at the target');
});
