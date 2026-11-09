// Look smoothing in the follow camera (src/land/cameraRig.js): a mouse or touch drag is eased, not applied raw, and the keys ramp.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraRig, LOOK_EASE } from '../src/land/cameraRig.js';

const DT = 1 / 60;
/** A rig with a scripted input: `mouse` is drained once per frame, `keys` is the set of codes held. */
function rig() {
  const input = { mouse: [0, 0], keys: new Set(), takeMouse() { const m = this.mouse; this.mouse = [0, 0]; return m; }, down(...c) { return c.some(k => this.keys.has(k)); }, takeZoom: () => 0 };
  const r = new CameraRig(new THREE.PerspectiveCamera(42, 1.6, 0.1, 100), input, { sensitivity: 1 });
  r.reset(new THREE.Vector3(0, 0, 0), 0);
  return { r, input, step: n => { for (let i = 0; i < n; i++) r.update(DT, null, new THREE.Vector3(0, 0, 0), null, true, {}); } };
}

test('a single mouse impulse turns the camera by the same total as before, but spread over a few frames and never overshooting', () => {
  const { r, input, step } = rig();
  input.mouse = [100, 0];
  const yaws = [];
  for (let i = 0; i < 40; i++) { r.update(DT, null, new THREE.Vector3(), null, true, {}); yaws.push(r.yaw); }
  const total = yaws[yaws.length - 1];
  assert.ok(Math.abs(total - (-0.42)) < 0.42 * 0.04, `total turn ${total.toFixed(3)} ≈ -0.42 rad`);
  assert.ok(Math.abs(yaws[0]) < 0.42 * 0.5, `the first frame moves only part of the way (${yaws[0].toFixed(3)})`);
  assert.ok(Math.abs(yaws[5]) > 0.42 * 0.75, 'most of the turn lands within 100 ms');
  for (let i = 1; i < yaws.length; i++) assert.ok(yaws[i] <= yaws[i - 1] + 1e-9 && yaws[i] >= total - 1e-9, 'monotonic, no overshoot');
  assert.ok(LOOK_EASE >= 10 && LOOK_EASE <= 30, 'ease rate stays in the snappy-but-smooth band');
});

test('a steady drag turns at the input rate; lifting the finger glides to a stop instead of halting dead', () => {
  const { r, input } = rig();
  let prev = 0, deltas = [];
  for (let i = 0; i < 60; i++) { input.mouse = [10, 0]; r.update(DT, null, new THREE.Vector3(), null, true, {}); deltas.push(r.yaw - prev); prev = r.yaw; }
  const steady = deltas[59];
  assert.ok(Math.abs(steady - (-0.042)) < 0.003, `steady rate ${steady.toFixed(4)} ≈ -0.042 rad per frame`);
  const after = [];
  for (let i = 0; i < 20; i++) { r.update(DT, null, new THREE.Vector3(), null, true, {}); after.push(r.yaw - prev); prev = r.yaw; }
  assert.ok(after[0] < 0 && Math.abs(after[0]) < Math.abs(steady) && Math.abs(after[0]) > Math.abs(steady) * 0.4, `glides (${after[0].toFixed(4)})`);
  assert.ok(Math.abs(after[19]) < Math.abs(steady) * 0.01, 'and is all but stopped within a third of a second');
});

test('the turn keys ramp up and down, and a tilt by hand eases the view after the goal', () => {
  const { r, input, step } = rig();
  input.keys.add('KeyC');
  let prev = r.yaw; const d = [];
  for (let i = 0; i < 40; i++) { r.update(DT, null, new THREE.Vector3(), null, true, {}); d.push(r.yaw - prev); prev = r.yaw; }
  assert.ok(d[0] < d[39] * 0.5, `starts slow (${d[0].toFixed(4)}) and reaches speed (${d[39].toFixed(4)})`);
  assert.ok(Math.abs(d[39] - 1.6 * DT) < 1.6 * DT * 0.1, 'full speed is the old 1.6 rad/s');
  input.keys.delete('KeyC');
  step(1); const first = r.yaw - prev;
  assert.ok(first > 0 && first < d[39], 'eases off rather than stopping dead');
  const p0 = r.pitch; r.tilt(-0.2);
  assert.equal(r.pitchGoal, p0 - 0.2, 'the goal moves at once');
  assert.equal(r.pitch, p0, 'the view has not jumped');
  step(30);
  assert.ok(Math.abs(r.pitch - r.pitchGoal) < 0.02, 'and catches up within half a second');
});

test('with a panel open, look input is dropped and any glide stops', () => {
  const { r, input } = rig();
  input.mouse = [50, 0]; r.update(DT, null, new THREE.Vector3(), null, true, {});
  const y1 = r.yaw;
  input.mouse = [50, 0]; r.update(DT, null, new THREE.Vector3(), null, false, {});
  assert.equal(r.yaw, y1, 'no turn while inactive, and the glide from the frame before is cancelled');
});
