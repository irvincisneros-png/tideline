// Ambient bird life that goes with the people: pelicans that loiter around the fish-cleaning table at Lake Illawarra and waddle about waiting for
// scraps, a flock of gulls that gathers over a school of fish near you, and the odd tern that dives onto the school with a splash.
import * as THREE from 'three';
import { flyingGullMesh } from '../land/landLife.js';
import { mulberry32, damp } from '../core/noise.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export class Birds {
  /** table: { x, z } of the fish-cleaning table (Lake only) or null. */
  constructor(game, table) {
    this.game = game; this.scene = game.scene; this.t = 0; this.rnd = mulberry32(4242);
    this.group = new THREE.Group(); this.scene.add(this.group);
    // Pelicans: three standing birds that shuffle between spots around the table.
    this.pelicans = [];
    const geo = game.world.models.get('pelican');
    if (table && geo) {
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(geo, game.world.props.mat); m.castShadow = m.receiveShadow = !!game.quality.shadows;
        const a = i * 2.1 + 0.5, r = 1.8 + i * 0.5;
        const bird = { mesh: m, x: table.x + Math.cos(a) * r, z: table.z + Math.sin(a) * r + 0.6, hd: a, home: table, wx: 0, wz: 0, wait: 1 + i * 1.5, ph: i * 2, hop: 0 };
        bird.wx = bird.x; bird.wz = bird.z;
        m.scale.setScalar(1.15); this.group.add(m); this.pelicans.push(bird);
      }
    }
    // Gulls over a school (index 0..4) and one tern (index 5) that dives.
    this.n = 6; this.flock = flyingGullMesh(this.n); this.flock.visible = false; this.group.add(this.flock);
    this.gulls = Array.from({ length: this.n }, (_, i) => ({ a: i * 1.05, r: 4.5 + this.rnd() * 4, h: 4 + this.rnd() * 2.2, w: (0.5 + this.rnd() * 0.25) * (i % 2 ? -1 : 1), x: 0, z: 0, y: 6, init: false }));
    this.center = new THREE.Vector3(); this.have = false; this.dive = { t: -1, next: 9 + this.rnd() * 6, from: new THREE.Vector3(), at: new THREE.Vector3(), done: false };
  }

  /** The school nearest the player that is in the water (shoals.js keeps them 5-18 m away), or null. */
  nearestSchool(player) {
    let best = null, bd = 1e9;
    for (const s of this.game.shoals?.schools ?? []) {
      if (!s.ready) continue;
      const d = Math.hypot(s.c.x - player.x, s.c.y - player.z);
      if (d < bd && d < 30) { bd = d; best = s; }
    }
    return best;
  }

  update(dt, t, player, active) {
    this.t = t;
    const world = this.game.world;
    for (const b of this.pelicans) {
      b.wait -= dt;
      const dx = b.wx - b.x, dz = b.wz - b.z, d = Math.hypot(dx, dz);
      if (d > 0.08) {
        b.x += dx / d * 0.5 * dt; b.z += dz / d * 0.5 * dt;
        let da = Math.atan2(dx, dz) - b.hd; da = ((da + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; b.hd += da * Math.min(1, 5 * dt);
        b.hop += dt * 7;
      } else if (b.wait <= 0) {
        const a = this.rnd() * 6.283, r = 1.6 + this.rnd() * 1.8; b.wx = b.home.x + Math.cos(a) * r; b.wz = b.home.z + Math.sin(a) * r + 0.6; b.wait = 3 + this.rnd() * 5;
        // Sometimes look at the player instead of walking away: pelicans are nosy.
        if (this.rnd() < 0.25) { b.wx = b.x; b.wz = b.z; b.hd = Math.atan2(player.x - b.x, player.z - b.z); }
      }
      const walking = d > 0.08;
      b.mesh.position.set(b.x, world.groundAt(b.x, b.z) + (walking ? Math.abs(Math.sin(b.hop)) * 0.04 : 0), b.z);
      b.mesh.rotation.set(0, b.hd, walking ? Math.sin(b.hop) * 0.06 : Math.sin(t * 0.4 + b.ph) * 0.02);
      b.mesh.visible = Math.hypot(b.x - player.x, b.z - player.z) < 90;
    }
    // Gulls follow a school.
    const school = active ? this.nearestSchool(player) : null;
    this.flock.visible = !!school || this.have;
    if (school) { this.center.set(school.c.x, 0, school.c.y); this.have = true; }
    else if (this.have && !active) this.have = false;
    if (!this.flock.visible) return;
    const D = this.dive;
    D.next -= dt;
    if (school && D.t < 0 && D.next <= 0) { D.t = 0; D.done = false; D.next = 14 + this.rnd() * 12; D.at.set(school.c.x + (this.rnd() - 0.5) * 2, 0, school.c.y + (this.rnd() - 0.5) * 2); }
    for (let i = 0; i < this.n; i++) {
      const g = this.gulls[i], tern = i === 5;
      g.a += g.w * dt;
      const tx = this.center.x + Math.cos(g.a) * g.r * (tern ? 1.4 : 1), tz = this.center.z + Math.sin(g.a) * g.r * (tern ? 1.4 : 1);
      const y0 = world.surfaceAt(tx, tz) + g.h + Math.sin(g.a * 3 + i) * 0.5;
      if (!g.init) { g.x = tx; g.z = tz; g.y = y0; g.init = true; }
      g.x = damp(g.x, tx, 2.2, dt); g.z = damp(g.z, tz, 2.2, dt); g.y = damp(g.y, y0, 2.2, dt);
      let x = g.x, z = g.z, y = g.y, pitch = 0;
      const sg = Math.sign(g.w);
      let yaw = Math.atan2(-Math.cos(g.a) * sg, -Math.sin(g.a) * sg);   // the model flies toward +x: yaw = atan2(-vz, vx) for a circling velocity (-sin a, cos a) * sign
      if (tern && D.t >= 0) {
        D.t += dt;
        const k = D.t / 1.5;   // 0..0.45 plunge, 0.45..1 climb
        if (D.t < 0.1) D.from.set(g.x, g.y, g.z);
        const sy = world.surfaceAt(D.at.x, D.at.z);
        if (k < 0.45) { const u = k / 0.45; x = D.from.x + (D.at.x - D.from.x) * u; z = D.from.z + (D.at.z - D.from.z) * u; y = D.from.y + (sy + 0.1 - D.from.y) * u * u; pitch = -0.8; yaw = Math.atan2(-(D.at.z - D.from.z), D.at.x - D.from.x); }
        else {
          if (!D.done) { D.done = true; this.game.fx.splash?.(_p.set(D.at.x, sy, D.at.z), 7); this.game.audio.play('smallSplash'); }
          const u = (k - 0.45) / 0.55; x = D.at.x + (g.x - D.at.x) * u; z = D.at.z + (g.z - D.at.z) * u; y = sy + 0.1 + (g.y - sy - 0.1) * Math.min(1, u * 1.2); pitch = 0.5;
        }
        if (k >= 1) { D.t = -1; g.x = x; g.z = z; g.y = y; }
      }
      // The model flies with its beak toward +x; yaw (about y) so +x points along the heading.
      _q.setFromEuler(_e.set(0, yaw, pitch));
      // A gull that wheels right past the lens is a huge flat wing across the screen: shrink it away within a few metres of the camera.
      const cam = this.game.camera.position, near = 1 - Math.min(1, Math.max(0, (6 - Math.hypot(x - cam.x, y - cam.y, z - cam.z)) / 2.5));
      _m.compose(_p.set(x, y, z), _q, _s.setScalar((tern ? 0.8 : 0.95) * near)); this.flock.setMatrixAt(i, _m);
    }
    this.flock.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.group.traverse(o => { if (o === this.flock) { o.geometry.dispose(); o.material.dispose(); } });
    this.group.parent?.remove(this.group);
  }
}
