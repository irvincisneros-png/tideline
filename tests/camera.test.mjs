// Camera maths (src/land/cameraViews.js): pitch range, the three View presets, the low-view aim and the fight camera.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PITCH, PRESETS, PRESET_ORDER, nextPreset, presetNear, lowBlend, viewParams, angleDiff, fightPitch, FIGHT_PITCH, fightYawOffset, fightFocus } from '../src/land/cameraViews.js';

test('the pitch range runs from near top-down to a low 25 degree view', () => {
  assert.ok(PITCH.max > 1.35 && PITCH.max < Math.PI / 2, 'near top-down but not past vertical');
  const deg = PITCH.min * 180 / Math.PI;
  assert.ok(deg >= 24 && deg <= 30, `lowest view is ${deg.toFixed(1)} degrees above the horizon`);
});
test('presets cycle Diorama, Low, Over the shoulder and wrap; Diorama is the old view', () => {
  assert.deepEqual(PRESET_ORDER, ['diorama', 'low', 'shoulder']);
  assert.equal(nextPreset('diorama'), 'low'); assert.equal(nextPreset('low'), 'shoulder'); assert.equal(nextPreset('shoulder'), 'diorama'); assert.equal(nextPreset('nonsense'), 'diorama');
  assert.equal(PRESETS.diorama.pitch, 1.06);
  for (const id of PRESET_ORDER) { assert.ok(PRESETS[id].pitch >= PITCH.min && PRESETS[id].pitch <= PITCH.max); assert.equal(presetNear(PRESETS[id].pitch), id); }
  assert.equal(presetNear(0.9), 'custom');
  assert.ok(PRESETS.diorama.pitch > PRESETS.low.pitch && PRESETS.low.pitch > PRESETS.shoulder.pitch);
});
test('a high view keeps the plain lens; a low view widens it and aims past the angler', () => {
  const hi = viewParams(1.06), lo = viewParams(PITCH.min), mid = viewParams(0.74);
  assert.equal(hi.k, 0); assert.equal(hi.fov, 42); assert.equal(hi.ahead, 0); assert.equal(hi.side, 0);
  assert.equal(lowBlend(PITCH.min), 1);
  assert.ok(lo.fov > 50 && lo.ahead > 4 && lo.side > 1);
  assert.ok(mid.k > 0 && mid.k < 1 && mid.ahead < lo.ahead, 'blends smoothly in between');
  let prev = viewParams(PITCH.max);
  for (let p = PITCH.max; p >= PITCH.min; p -= 0.01) { const v = viewParams(p); assert.ok(v.fov >= prev.fov - 1e-9 && v.ahead >= prev.ahead - 1e-9, 'monotonic as the camera lowers'); prev = v; }
});
test('angleDiff is the shortest signed turn', () => {
  assert.ok(Math.abs(angleDiff(0.1, 0.3) - 0.2) < 1e-9);
  assert.ok(Math.abs(angleDiff(3.0, -3.0) - (2 * Math.PI - 6)) < 1e-9);
  assert.ok(Math.abs(angleDiff(-3.0, 3.0) + (2 * Math.PI - 6)) < 1e-9);
});
test('the fight camera goes lower but never higher than the player chose', () => {
  assert.equal(fightPitch(1.06), FIGHT_PITCH); assert.equal(fightPitch(1.45), FIGHT_PITCH);
  assert.equal(fightPitch(0.5), 0.5, 'a low preset is respected');
  assert.equal(fightPitch(PITCH.min), PITCH.min);
});
test('the fight camera looks side-on to the line, on the nearer side', () => {
  // Line runs toward -z (bearing of the forward vector (0,-1)); the player camera looks the same way at yaw 0.
  const off = fightYawOffset(0, 0, -1), yaw = off;
  const fwd = [-Math.sin(yaw), -Math.cos(yaw)], dot = fwd[0] * 0 + fwd[1] * -1;
  assert.ok(Math.abs(Math.acos(Math.abs(dot)) * 180 / Math.PI) > 55, 'the view direction is well off the line');
  assert.ok(Math.abs(fightYawOffset(0.5, 0, -1)) < 1.6 && Math.abs(off) > 0.8);
  // the nearer side: a camera already turned left stays on the left
  assert.ok(fightYawOffset(0.8, 0, -1) * fightYawOffset(-0.8, 0, -1) < 0, 'opposite cameras pick opposite sides');
  assert.equal(fightYawOffset(1, 0, 0), 0, 'no line, no turn');
});
test('the fight camera aims between the angler and the float, low enough to put the angler above the key bar', () => {
  const t = { x: 0, y: 0, z: 0 }, f = { x: 10, y: 0, z: -10 }, a = fightFocus(t, f, 14);
  assert.ok(a.x > 0 && a.x < 5 && a.z < 0 && a.z > -5, 'between them, nearer the angler');
  assert.ok(a.y < 1.5);
});
