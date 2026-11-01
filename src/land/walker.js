// The angler's body on the beach, dunes, rock platform, jetty and estuary bank: walk/run on the terrain (or the jetty deck)
// and wade into the shallows. Wading stops at chest-deep water (SWIM_DEPTH). Moves relative to the camera's yaw (the
// camera rig in land/cameraRig.js follows the walker; the visible character is land/angler.js).
import * as THREE from 'three';
import { clamp, damp } from '../core/noise.js';

export const SWIM_DEPTH = 1.15;    // still-water depth at your feet you cannot wade past

export class Walker {
  constructor(input, settings) {
    this.input = input; this.settings = settings;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.viewYaw = 0;   // camera yaw: "up" on screen is (-sin yaw, 0, -cos yaw)
    this.heading = 0;   // which way the character faces: model forward (+z) rotated by this about y
    this.speed = 0; this.moving = false;
    this.grounded = true; this.stepT = 0;
    this.frozen = false; // true while a fish is on the line: plant your feet
    this.events = []; // 'step', 'stepWet', 'splash', 'land'
    this.waterDepth = 0;
  }
  spawn(pos, yaw = 0) {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.viewYaw = yaw; this.heading = Math.PI + yaw; this.grounded = true;
  }
  /** Turn to face a world-space direction (used when aiming a cast). */
  face(dx, dz, dt = 1, rate = 14) {
    if (Math.hypot(dx, dz) < 1e-3) return;
    this.heading = turnToward(this.heading, Math.atan2(dx, dz), rate * dt);
  }
  /** Unit vector the character faces. */
  get facing() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  update(dt, world, bounds) {
    const inp = this.input;
    const fwd = new THREE.Vector3(-Math.sin(this.viewYaw), 0, -Math.cos(this.viewYaw));
    const right = new THREE.Vector3(Math.cos(this.viewYaw), 0, -Math.sin(this.viewYaw));
    const wish = new THREE.Vector3();
    if (!this.frozen) {
      if (inp.down('KeyW', 'ArrowUp')) wish.add(fwd);
      if (inp.down('KeyS', 'ArrowDown')) wish.sub(fwd);
      if (inp.down('KeyD', 'ArrowRight')) wish.add(right);
      if (inp.down('KeyA', 'ArrowLeft')) wish.sub(right);
    }
    const run = inp.down('ShiftLeft', 'ShiftRight');
    const ground0 = world.walkAt(this.pos.x, this.pos.z);
    const surf = world.surfaceAt(this.pos.x, this.pos.z);
    this.waterDepth = Math.max(0, surf - ground0);
    // Soft sand and water slow you down.
    const wade = clamp(1 - this.waterDepth * 0.55, 0.35, 1);
    let target = (run ? 5.2 : 2.7) * wade;
    if (wish.lengthSq() > 0) wish.normalize(); else target = 0;
    const accel = this.grounded ? 10 : 2;
    this.vel.x = damp(this.vel.x, wish.x * target, accel, dt);
    this.vel.z = damp(this.vel.z, wish.z * target, accel, dt);
    if (wish.lengthSq() > 0) this.heading = turnToward(this.heading, Math.atan2(wish.x, wish.z), 12 * dt);
    this.vel.y -= 9.8 * dt;

    // Horizontal move with a slope/step limit: you can't walk straight up cliffs or rock faces.
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const gNew = world.walkAt(nx, nz), step = Math.hypot(nx - this.pos.x, nz - this.pos.z);
    const rise = gNew - Math.max(ground0, this.pos.y);
    if (rise > 0.35 + step * 1.1 || (-gNew > SWIM_DEPTH && gNew < ground0)) { this.vel.x = this.vel.z = 0; } // too steep, or deeper than chest height
    else { this.pos.x = nx; this.pos.z = nz; }
    // Trees, boulders and other solid habitat.
    for (const c of world.nearbyColliders(this.pos, 3)) {
      if (c.center.y + c.r < this.pos.y + 0.2 || c.center.y - c.r > this.pos.y + 1.4) continue;
      const dx = this.pos.x - c.center.x, dz = this.pos.z - c.center.z, d = Math.hypot(dx, dz), r = c.r * 0.6 + 0.25;
      if (d < r && d > 1e-3) { this.pos.x += (dx / d) * (r - d); this.pos.z += (dz / d) * (r - d); }
    }
    if (bounds) { this.pos.x = clamp(this.pos.x, bounds.xMin, bounds.xMax); this.pos.z = clamp(this.pos.z, bounds.zMin, bounds.zMax); }
    this.pos.y += this.vel.y * dt;
    const g = world.walkAt(this.pos.x, this.pos.z);
    if (this.pos.y <= g) { if (!this.grounded && this.vel.y < -3) this.events.push(this.waterDepth > 0.1 ? 'splash' : 'land'); this.pos.y = g; this.vel.y = 0; this.grounded = true; }
    else if (this.pos.y > g + 0.05) this.grounded = false;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.moving = this.speed > 0.3;

    // Footsteps.
    if (this.grounded && this.speed > 0.3) {
      this.stepT -= dt * this.speed;
      if (this.stepT <= 0) { this.stepT = run ? 1.1 : 0.9; this.events.push(this.waterDepth > 0.05 ? 'stepWet' : 'step'); }
    }
  }
  takeEvents() { const e = this.events; this.events = []; return e; }
}

/** Rotate angle a toward b by at most max radians (shortest way round). */
export function turnToward(a, b, max) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  d = clamp(d, -Math.abs(max), Math.abs(max));
  return a + d;
}
