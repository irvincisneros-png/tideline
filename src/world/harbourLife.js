// The harbour's living light: lamp glows, the lighthouse beam, silvery baitfish swirling in each lamp's pool, the night squid (the Life agents of id 'squid'
// are shown only at dusk and night, hovering in the lamp light), and spray where a big swell breaks on the breakwall. All of it follows the in-game clock
// (cond.hour) and the lamp state in globalUniforms.uLampOn (set by Environment.setDaylight).
import * as THREE from 'three';
import { globalUniforms } from '../ocean/shaders.js';

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,244,214,1)'); g.addColorStop(0.18, 'rgba(255,214,140,0.85)'); g.addColorStop(0.5, 'rgba(255,170,80,0.25)'); g.addColorStop(1, 'rgba(255,150,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
/** A tiny flat fish (nose at +x) lying on the water plane, used for the baitfish. */
function babyFish() {
  const s = new THREE.Shape();
  s.moveTo(0.5, 0); s.bezierCurveTo(0.3, 0.16, -0.1, 0.16, -0.32, 0.04); s.lineTo(-0.5, 0.18); s.lineTo(-0.44, 0); s.lineTo(-0.5, -0.18); s.lineTo(-0.32, -0.04); s.bezierCurveTo(-0.1, -0.16, 0.3, -0.16, 0.5, 0);
  const g = new THREE.ShapeGeometry(s, 6); g.rotateX(-Math.PI / 2);
  return g;
}

export class HarbourLife {
  constructor(world, { lamps, headY, poolR, lighthouse }) {
    this.world = world; this.lamps = lamps; this.headY = headY; this.poolR = poolR; this.lighthouse = lighthouse;
    const scene = world.scene, low = world.quality.shadows === 0 && world.quality.coralScale < 1;
    this.group = new THREE.Group(); scene.add(this.group);
    // Warm glows at each lantern (a small bright core and a large faint halo), additive so they bloom.
    const mk = (scale, op) => { const m = new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: op }); const s = new THREE.Sprite(m); s.scale.setScalar(scale); s.renderOrder = 15; return s; };
    this.glows = lamps.map(L => { const core = mk(1.5, 0), halo = mk(6.5, 0); core.position.set(L.head[0], headY - 0.1, L.head[1]); halo.position.copy(core.position); this.group.add(core, halo); return { core, halo }; });
    // The lighthouse: a glow in the lantern and a slow sweeping beam.
    const lx = lighthouse.x, ly = lighthouse.y, lz = lighthouse.z;
    this.lhGlow = mk(9, 0); this.lhGlow.position.set(lx, ly, lz); this.group.add(this.lhGlow);
    const bg = new THREE.PlaneGeometry(1, 1); bg.translate(0.5, 0, 0); bg.rotateX(-Math.PI / 2);
    const bm = document.createElement('canvas'); bm.width = 256; bm.height = 8; const bx = bm.getContext('2d'), gr = bx.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, 'rgba(255,240,190,0.55)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); bx.fillStyle = gr; bx.fillRect(0, 0, 256, 8);
    this.beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bm), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, side: THREE.DoubleSide, fog: false }));
    this.beam.position.set(lx, ly, lz); this.beam.scale.set(60, 1, 5); this.beam.renderOrder = 14; this.beam.frustumCulled = false; this.group.add(this.beam);
    // Baitfish: a swirl of silver round each pool's centre, just under the surface.
    this.perPool = low ? 14 : 26;
    const total = this.perPool * lamps.length;
    this.fish = new THREE.InstancedMesh(babyFish(), new THREE.MeshBasicMaterial({ color: 0xf4faff, side: THREE.DoubleSide, fog: false, transparent: true, opacity: 0.95, depthWrite: false }), total);
    this.fish.frustumCulled = false; this.fish.renderOrder = 17; this.fish.userData.noShadow = true; this.group.add(this.fish);
    // A dark soft shadow under each silvery fish, so they read against the bright glow as well as the dark water.
    this.shade = new THREE.InstancedMesh(babyFish(), new THREE.MeshBasicMaterial({ color: 0x0b2a4a, side: THREE.DoubleSide, fog: false, transparent: true, opacity: 0.5, depthWrite: false }), total);
    this.shade.frustumCulled = false; this.shade.renderOrder = 16; this.group.add(this.shade);
    this.fd = Array.from({ length: total }, (_, i) => ({ pool: Math.floor(i / this.perPool), r: 0.5 + Math.random() * 3.0, a: Math.random() * 6.283, w: (0.5 + Math.random() * 0.7) * (Math.random() < 0.5 ? -1 : 1), y: 0.0 + Math.random() * 0.05, len: 0.2 + Math.random() * 0.1 }));
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3(); this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.sprayT = 0; this.low = low;
  }
  update(dt, t, cond) {
    const on = globalUniforms.uLampOn.value, night = globalUniforms.uNight.value;
    for (const g of this.glows) { g.core.material.opacity = on * 0.7; g.halo.material.opacity = on * 0.32; }
    this.lhGlow.material.opacity = on * 0.8; this.beam.material.opacity = on * 0.65; this.beam.rotation.y = t * 0.35; this.beam.visible = on > 0.02;
    // Baitfish gather in the pools: at night the whole swarm shows and circles tightly; by day a thin, wider scatter hangs in the shade under the wharf.
    const m = this.m, q = this.q, e = this.e, v = this.v, sc = this.sc, shown = Math.round(this.perPool * (0.35 + 0.65 * on));
    for (let i = 0; i < this.fd.length; i++) {
      const f = this.fd[i], idx = i % this.perPool;
      if (idx >= shown) { this.fish.setMatrixAt(i, this.zero); this.shade.setMatrixAt(i, this.zero); continue; }
      const L = this.lamps[f.pool], rr = f.r * (1.15 - 0.45 * on);
      f.a += f.w * dt * (0.5 + 0.5 / Math.max(0.5, rr));
      const x = L.head[0] + Math.cos(f.a) * rr, z = L.head[1] + Math.sin(f.a) * rr * 0.8;
      // facing along the direction of travel
      e.set(0, Math.atan2(-0.8 * Math.cos(f.a) * Math.sign(f.w), -Math.sin(f.a) * Math.sign(f.w)), 0);
      q.setFromEuler(e);
      m.compose(v.set(x, f.y + 0.06 + Math.sin(t * 2.4 + i) * 0.02, z), q, sc.set(f.len, 1, f.len));
      this.fish.setMatrixAt(i, m);
      m.compose(v.set(x + 0.07, f.y + 0.035, z + 0.07), q, sc.set(f.len * 1.25, 1, f.len * 1.35)); this.shade.setMatrixAt(i, m);
    }
    this.fish.instanceMatrix.needsUpdate = true; this.shade.instanceMatrix.needsUpdate = true;
    // The squid: shown at dusk and night (they rise to the baitfish in the light), hovering near the surface in the pools.
    const show = cond ? (cond.time === 'dusk' || cond.time === 'night') : night > 0.5;
    for (const a of this.world.life?.agents ?? []) {
      if (a.id !== 'squid') continue;
      a.visible = show;
      // Squid hold at the EDGE of each light pool, where the baitfish are lit but the squid are not: they ambush from the dark.
      const L = this.lamps[a.index % this.lamps.length], th = (L.rot ? Math.PI : 0) + (a.index % 2 ? 1 : -1) * (0.55 + 0.3 * ((a.index >> 1) % 3)) + Math.sin(t * 0.15 + a.index) * 0.2, ring = 2.6 + (a.index % 3) * 0.4;   // on the open-water side of the lamp, away from the deck
      a.target.set(L.head[0] + Math.cos(th) * ring, -0.36 + Math.sin(t * 0.7 + a.index) * 0.05, L.head[1] + Math.sin(th) * ring * 0.9);
      a.home.x = a.target.x; a.home.z = a.target.z;
    }
    // Spray where a big swell breaks on the breakwall.
    const swell = cond?.swell ?? 0;
    if (swell >= 2.2 && (this.sprayT -= dt) <= 0) {
      this.sprayT = 0.5 + Math.random() * 0.6;
      const side = Math.random() < 0.6, x = side ? 44 + 4.5 : -4 + Math.random() * 40, z = side ? -26 + Math.random() * 60 : -37;
      this.world.particles?.sprayBurst?.(new THREE.Vector3(x, 1.8, z), new THREE.Vector3(side ? -0.3 : 0, 1, side ? 0 : 0.3), 14, 3);
    }
  }
  dispose() {
    this.group.parent?.remove(this.group);
    this.group.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
  }
}
