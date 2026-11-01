// First-person walker for the beach, dunes, rock platform and estuary bank: walk/run/jump on the terrain and
// wade into the shallows. Wading stops at chest-deep water (SWIM_DEPTH).
import * as THREE from 'three';
import { clamp, damp } from '../core/noise.js';

export const EYE = 1.62;           // eye height above the feet, metres
export const SWIM_DEPTH = 1.15;    // still-water depth at your feet you cannot wade past

export class Walker {
  constructor(camera, input, settings) {
    this.camera = camera; this.input = input; this.settings = settings;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.speed = 0;
    this.grounded = true; this.bobT = 0; this.stepT = 0;
    this.events = []; // 'step', 'stepWet', 'splash', 'land'
    this.waterDepth = 0;
  }
  spawn(pos, yaw = 0) {
    this.pos.copy(pos); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = -0.08; this.grounded = true;
  }
  update(dt, world, bounds) {
    const inp = this.input;
    const [mx, my] = inp.takeMouse();
    const sens = 0.0022 * (this.settings.sensitivity ?? 1);
    this.yaw -= mx * sens;
    this.pitch = clamp(this.pitch - my * sens * (this.settings.invertY ? -1 : 1), -1.45, 1.45);

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (inp.down('KeyW', 'ArrowUp')) wish.add(fwd);
    if (inp.down('KeyS', 'ArrowDown')) wish.sub(fwd);
    if (inp.down('KeyD', 'ArrowRight')) wish.add(right);
    if (inp.down('KeyA', 'ArrowLeft')) wish.sub(right);
    const run = inp.down('ShiftLeft', 'ShiftRight');
    const ground0 = world.groundAt(this.pos.x, this.pos.z);
    const surf = world.surfaceAt(this.pos.x, this.pos.z);
    this.waterDepth = Math.max(0, surf - ground0);
    // Soft sand and water slow you down.
    const wade = clamp(1 - this.waterDepth * 0.55, 0.35, 1);
    let target = (run ? 4.2 : 1.7) * wade;
    if (wish.lengthSq() > 0) wish.normalize(); else target = 0;
    const accel = this.grounded ? 10 : 2;
    this.vel.x = damp(this.vel.x, wish.x * target, accel, dt);
    this.vel.z = damp(this.vel.z, wish.z * target, accel, dt);
    if (this.grounded && !this.noJump && inp.hit('Space') && this.waterDepth < 0.6) { this.vel.y = 4.2; this.grounded = false; }
    this.vel.y -= 9.8 * dt;

    // Horizontal move with a slope/step limit: you can't walk straight up cliffs or rock faces.
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const gNew = world.groundAt(nx, nz), step = Math.hypot(nx - this.pos.x, nz - this.pos.z);
    const rise = gNew - Math.max(ground0, this.pos.y);
    if (rise > 0.35 + step * 1.1 || (-gNew > SWIM_DEPTH && gNew < ground0)) { this.vel.x = this.vel.z = 0; } // too steep, or deeper than chest height
    else { this.pos.x = nx; this.pos.z = nz; }
    // Trees, boulders and other solid habitat.
    for (const c of world.nearbyColliders(this.pos, 3)) {
      if (c.center.y + c.r < this.pos.y + 0.2 || c.center.y - c.r > this.pos.y + EYE) continue;
      const dx = this.pos.x - c.center.x, dz = this.pos.z - c.center.z, d = Math.hypot(dx, dz), r = c.r * 0.6 + 0.25;
      if (d < r && d > 1e-3) { this.pos.x += (dx / d) * (r - d); this.pos.z += (dz / d) * (r - d); }
    }
    if (bounds) { this.pos.x = clamp(this.pos.x, bounds.xMin, bounds.xMax); this.pos.z = clamp(this.pos.z, bounds.zMin, bounds.zMax); }
    this.pos.y += this.vel.y * dt;
    const g = world.groundAt(this.pos.x, this.pos.z);
    if (this.pos.y <= g) { if (!this.grounded && this.vel.y < -3) this.events.push(this.waterDepth > 0.1 ? 'splash' : 'land'); this.pos.y = g; this.vel.y = 0; this.grounded = true; }
    else if (this.pos.y > g + 0.05) this.grounded = false;
    this.speed = Math.hypot(this.vel.x, this.vel.z);

    // Footsteps and head bob.
    if (this.grounded && this.speed > 0.3) {
      this.bobT += dt * this.speed * 3.6;
      this.stepT -= dt * this.speed;
      if (this.stepT <= 0) { this.stepT = run ? 0.95 : 0.75; this.events.push(this.waterDepth > 0.05 ? 'stepWet' : 'step'); }
    }

    const bob = this.settings.reducedMotion ? 0 : Math.sin(this.bobT) * 0.035 * Math.min(1, this.speed / 2);
    this.camera.position.set(this.pos.x, this.pos.y + EYE + bob, this.pos.z);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }
  takeEvents() { const e = this.events; this.events = []; return e; }
  get lookDir() { return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion); }
}
