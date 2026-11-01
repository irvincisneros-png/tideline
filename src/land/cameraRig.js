// High third-person, near top-down follow camera (I Just Wanted to Fish style diorama view): pitch ~60 degrees,
// 12-18 m back, smooth damping, wheel / pinch zoom, never inside the terrain. Q / E (or a right-button or touch drag)
// turn it around the angler. While a line is out it frames the angler and the float together.
import * as THREE from 'three';
import { clamp, damp } from '../core/noise.js';

export const CAM = { pitch: 1.06, pitchMin: 0.85, pitchMax: 1.25, dist: 15, distMin: 9, distMax: 22, fov: 42 }; // 1.06 rad = 61 degrees

export class CameraRig {
  constructor(camera, input, settings = {}) {
    this.camera = camera; this.input = input; this.settings = settings;
    this.yaw = 0; this.pitch = CAM.pitch; this.dist = CAM.dist; this.zoom = CAM.dist; // zoom = what the player chose; dist = after framing
    this.focus = new THREE.Vector3(); this.pos = new THREE.Vector3();
    camera.fov = CAM.fov; camera.updateProjectionMatrix();
  }
  /** Snap to a spot (new site, after a menu). */
  reset(target, yaw = 0) {
    this.yaw = yaw; this.pitch = CAM.pitch; this.zoom = this.dist = CAM.dist;
    this.focus.copy(target).y += 0.9;
    this.apply(null, 1e3);
  }
  /**
   * @param {number} dt
   * @param {object} world  groundAt / walkAt
   * @param {THREE.Vector3} target  the angler's feet
   * @param {THREE.Vector3|null} also  a second point to keep in frame (the float), or null
   */
  update(dt, world, target, also = null, active = true) {
    const inp = this.input;
    if (active) {
      const [mx, my] = inp.takeMouse();
      const sens = this.settings.sensitivity ?? 1;
      this.yaw -= mx * 0.0042 * sens;
      this.pitch = clamp(this.pitch - my * 0.0035 * sens * (this.settings.invertY ? -1 : 1), CAM.pitchMin, CAM.pitchMax);
      const turn = (inp.down('KeyE') ? 1 : 0) - (inp.down('KeyQ') ? 1 : 0);
      this.yaw += turn * 1.6 * (this.settings.sensitivity ?? 1) * dt;
      const z = inp.takeZoom();
      if (z) this.zoom = clamp(this.zoom * Math.pow(1.12, z), CAM.distMin, CAM.distMax);
    }
    // Frame the angler and the float: aim between them and back off a little as they separate.
    let want = this.zoom, fx = target.x, fy = target.y + 0.9, fz = target.z;
    if (also) {
      const sep = Math.hypot(also.x - target.x, also.z - target.z);
      fx = target.x + (also.x - target.x) * 0.5; fz = target.z + (also.z - target.z) * 0.5;
      fy = target.y * 0.7 + also.y * 0.3 + 0.8;
      want = Math.min(CAM.distMax + 7, Math.max(this.zoom, 10 + sep * 1.05));
    }
    this.focus.x = damp(this.focus.x, fx, 5, dt); this.focus.y = damp(this.focus.y, fy, 4, dt); this.focus.z = damp(this.focus.z, fz, 5, dt);
    this.dist = damp(this.dist, want, 3.5, dt);
    this.apply(world, dt);
  }
  apply(world) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch), d = this.dist;
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    const f = this.focus;
    let h = 0;
    if (world) {
      // Keep the lens above the ground along the whole boom (hill, dune or bluff behind the angler).
      for (let s = 0.3; s <= 1.001; s += 0.175) h = Math.max(h, world.walkAt(f.x + dir.x * d * s, f.z + dir.z * d * s) + 1.8 - (f.y + dir.y * d * s));
    }
    this.pos.set(f.x + dir.x * d, f.y + dir.y * d + Math.max(0, h), f.z + dir.z * d);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(f);
  }
  /** Direction on the ground plane that is "up the screen". */
  get forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
}
