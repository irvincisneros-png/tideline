// Third-person follow camera. The default is the diorama view (high, near top-down, like I Just Wanted to Fish); the player can tilt it all the way down to a low
// over-the-shoulder view that shows the horizon, the sky and the sunset: drag with the mouse / two-finger drag, F (lower) and G (higher), or V to cycle three presets
// (Diorama, Low, Over the shoulder) with a smooth glide. While a fish is on, the camera eases lower and side-on so the crank, rod bend and lean can be read.
// It is never inside the terrain; props and canopies that would hide the angler are cut away in the shaders (ocean/shaders.js cutaway).
import * as THREE from 'three';
import { clamp, damp } from '../core/noise.js';
import { PITCH, PRESETS, nextPreset, presetNear, viewParams, angleDiff, fightPitch, fightYawOffset, fightFocus } from './cameraViews.js';

export const LOOK_EASE = 16;   // 1/s: how fast a look impulse eases out (higher = snappier, lower = floatier)
export const CAM = { pitch: PITCH.diorama, pitchMin: PITCH.min, pitchMax: PITCH.max, dist: 12.6, distMin: 7.5, distMax: 22, fov: 42 };
const _dir = new THREE.Vector3(), _aim = new THREE.Vector3();

export class CameraRig {
  constructor(camera, input, settings = {}) {
    this.camera = camera; this.input = input; this.settings = settings;
    this.yaw = 0; this.pitch = this.pitchGoal = CAM.pitch; this.dist = CAM.dist; this.zoom = CAM.dist; // zoom = what the player chose; dist = after framing
    this.preset = 'diorama'; this.yawGoal = null;
    this.fightBlend = 0; this.fightYaw = 0; this.fightOn = false; this.fightTurned = false;   // fight camera state
    this.focus = new THREE.Vector3(); this.pos = new THREE.Vector3();
    this.yawVel = 0; this.pitchVel = 0; this.turnV = 0; this.tiltV = 0; this.pitchRate = 4;   // look smoothing: mouse deltas feed a velocity that eases out; keys ramp up and down
    this.vp = viewParams(this.pitch);
    camera.fov = CAM.fov; camera.updateProjectionMatrix();
  }
  /** Snap to a spot (new site, after a menu). Keeps the player's chosen tilt and zoom. */
  reset(target, yaw = 0) {
    this.yaw = yaw; this.pitch = this.pitchGoal; this.zoom = this.dist = PRESETS[this.preset]?.zoom ?? CAM.dist;   // the title and the ceremony borrow zoom, so go back to the preset's
    this.yawGoal = null; this.fightBlend = this.fightYaw = 0; this.fightOn = false;
    this.focus.copy(target).y += 0.9;
    this.apply(null, 1e3);
  }
  /** Glide to a preset ('diorama' | 'low' | 'shoulder'); the over-the-shoulder view also swings round behind the angler. */
  setPreset(id, heading = null) {
    const p = PRESETS[id]; if (!p) return;
    this.preset = id; this.pitchGoal = p.pitch; this.zoom = p.zoom; this.pitchRate = 4;
    this.yawGoal = p.behind && heading != null ? heading + Math.PI : null;
  }
  cyclePreset(heading = null) { this.setPreset(nextPreset(presetNear(this.pitchGoal) === 'custom' ? this.preset : presetNear(this.pitchGoal)), heading); return this.preset; }
  /** Tilt by hand (radians, positive = higher / more top-down): the goal moves at once and the view eases after it. */
  tilt(d) { this.pitchGoal = clamp(this.pitchGoal + d, CAM.pitchMin, CAM.pitchMax); this.pitchRate = 14; this.preset = presetNear(this.pitchGoal); }
  get presetLabel() { return PRESETS[this.preset]?.label ?? 'Custom'; }
  /**
   * @param {number} dt
   * @param {object} world  groundAt / walkAt
   * @param {THREE.Vector3} target  the angler's feet
   * @param {THREE.Vector3|null} also  a second point to keep in frame (the float), or null
   * @param {boolean} active  false while a panel is open
   * @param {{ fight?: boolean, line?: {x:number,z:number}, heading?: number }} extra  fight: a fish is on (the fight camera); line: unit bearing angler to float
   */
  update(dt, world, target, also = null, active = true, extra = {}) {
    const inp = this.input, sens = this.settings.sensitivity ?? 1;
    // Mouse and touch deltas are not applied raw: each one is an impulse into a velocity that eases out over ~60 ms (LOOK_EASE), so a jittery drag reads
    // as one smooth turn and the view glides to a stop when the finger lifts. The keys ramp up and down the same way instead of starting at full speed.
    const ease = Math.exp(-LOOK_EASE * dt), k = (1 - ease) / Math.max(dt, 1e-4);
    let turn = 0, tk = 0;
    if (active) {
      const [mx, my] = inp.takeMouse();
      if (mx) { this.yawGoal = null; if (this.fightOn) this.fightTurned = true; }
      this.yawVel -= mx * 0.0042 * sens * k;
      if (my) this.pitchVel -= my * 0.0035 * sens * (this.settings.invertY ? -1 : 1) * k;
      tk = (inp.down('KeyG') ? 1 : 0) - (inp.down('KeyF') ? 1 : 0);   // F lowers the view, G raises it (R is the rod, T the tackle box)
      turn = (inp.down('KeyC') ? 1 : 0) - (inp.down('KeyZ') ? 1 : 0);   // E talks and Q opens the quest log, so the camera turns on Z / C
      if (turn) { this.yawGoal = null; if (this.fightOn) this.fightTurned = true; }
      const z = inp.takeZoom();
      if (z) this.zoom = clamp(this.zoom * Math.pow(1.12, z), CAM.distMin, CAM.distMax);
    } else { inp.takeMouse?.(); this.yawVel = this.pitchVel = 0; }
    this.turnV = damp(this.turnV, turn, 9, dt); this.tiltV = damp(this.tiltV, tk, 9, dt);
    this.yaw += (this.yawVel + this.turnV * 1.6 * sens) * dt;
    const dp = (this.pitchVel + this.tiltV * 0.9) * dt;
    if (Math.abs(dp) > 1e-6) this.tilt(dp);
    this.yawVel *= ease; this.pitchVel *= ease;
    if (this.yawGoal != null) { const d = angleDiff(this.yaw, this.yawGoal); this.yaw += d * (1 - Math.exp(-3 * dt)); if (Math.abs(d) < 0.01) this.yawGoal = null; }
    this.pitch = damp(this.pitch, this.pitchGoal, this.pitchRate, dt);
    // The fight camera: on when a fish is hooked (and the player has not turned it off), off again once landed. A player's own turn during the fight is respected.
    const fight = !!extra.fight && this.settings.fightCam !== false && !!also;
    if (fight && !this.fightOn) this.fightTurned = false;
    this.fightOn = fight;
    this.fightBlend = damp(this.fightBlend, fight ? 1 : 0, fight ? 2.2 : 1.6, dt);
    const fyTarget = fight && !this.fightTurned && extra.line ? fightYawOffset(this.yaw, extra.line.x, extra.line.z) : 0;
    this.fightYaw = damp(this.fightYaw, fight ? fyTarget : 0, 2.2, dt);
    // Frame the angler and the float: aim between them and back off a little as they separate.
    let want = this.zoom, fx = target.x, fy = target.y + 0.9, fz = target.z;
    if (also) {
      const sep = Math.hypot(also.x - target.x, also.z - target.z);
      if (fight) {
        const ff = fightFocus(target, also, sep); fx = ff.x; fz = ff.z; fy = ff.y - 0.5;
        want = Math.min(CAM.distMax + 7, Math.max(CAM.distMin + 1, Math.min(this.zoom, 9) + sep * 0.5));
      } else {
        fx = target.x + (also.x - target.x) * 0.5; fz = target.z + (also.z - target.z) * 0.5;
        fy = target.y * 0.7 + also.y * 0.3 + 0.8;
        want = Math.min(CAM.distMax + 7, Math.max(this.zoom, 10 + sep * 1.05));
      }
    }
    this.focus.x = damp(this.focus.x, fx, 5, dt); this.focus.y = damp(this.focus.y, fy, 4, dt); this.focus.z = damp(this.focus.z, fz, 5, dt);
    this.dist = damp(this.dist, want, 3.5, dt);
    this.apply(world, dt);
  }
  apply(world, dt = 0, plain = false) {   // plain: the title screen's fixed lens
    const fb = plain ? 0 : this.fightBlend;
    const pitch = this.pitch + fb * (fightPitch(this.pitch) - this.pitch), yaw = this.yaw + fb * this.fightYaw;
    const vp = this.vp = plain ? { k: 0, fov: 42, ahead: 0, lift: 0, side: 0 } : viewParams(pitch);
    const cp = Math.cos(pitch), sp = Math.sin(pitch), d = this.dist;
    const dir = _dir.set(Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp);
    const f = this.focus;
    let h = 0;
    if (world) {
      // Keep the lens above the ground along the whole boom (hill, dune or bluff behind the angler). A low camera stays a little higher over the ground.
      const clear = 1.8 + 0.8 * vp.k;
      for (let s = 0.3; s <= 1.001; s += 0.175) h = Math.max(h, world.walkAt(f.x + dir.x * d * s, f.z + dir.z * d * s) + clear - (f.y + dir.y * d * s));
    }
    let py = f.y + dir.y * d + Math.max(0, h);
    // Never dip under the water surface (that would flip to the underwater view).
    if (world?.surfaceAt) py = Math.max(py, world.surfaceAt(f.x + dir.x * d, f.z + dir.z * d) + 1.1);
    this.pos.set(f.x + dir.x * d, py, f.z + dir.z * d);
    this.camera.position.copy(this.pos);
    // A low view looks past the angler (toward the horizon), with the angler slid off to one side; the fight camera keeps the angler and float centred.
    const keep = 1 - fb, fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    _aim.set(f.x + fwdX * vp.ahead * keep + rx * vp.side * keep, f.y + vp.lift * keep + (this.pos.y - (f.y + dir.y * d)) * 0.5, f.z + fwdZ * vp.ahead * keep + rz * vp.side * keep);
    if (Math.abs(this.camera.fov - vp.fov) > 0.05) { this.camera.fov = vp.fov; this.camera.updateProjectionMatrix(); }
    this.camera.lookAt(_aim);
  }
  /** Direction on the ground plane that is "up the screen". */
  get forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
}
