// Dark fish silhouettes drifting through the clear shallows near the angler: schools of 3-6, species-agnostic shapes (decorative for
// now; they are the fish you can cast to). One instanced mesh of flat, opaque, dark-teal fish under the water: the water layer tints
// them paler the deeper they swim, exactly like seeing real fish from above. They keep to water 0.4-2.4 m deep and shy away from the angler.
// Each school is one species (picked from the catch table of the spot it is swimming over, scaled to that species' size): a school within
// SEEN_RANGE of the angler marks the species as Seen in the Fish Guide (onSeen(id, 'school')).
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { globalUniforms } from '../ocean/shaders.js';
import { SPOTS, SPECIES_BY_ID, gateOpen } from '../fishing/catches.js';

export const SEEN_RANGE = 8; // metres: a school this close to the angler counts as Seen in the Fish Guide

function fishGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.5, 0); s.bezierCurveTo(0.42, 0.11, 0.2, 0.15, -0.02, 0.12); s.bezierCurveTo(-0.2, 0.1, -0.3, 0.05, -0.36, 0.03);
  s.lineTo(-0.5, 0.15); s.quadraticCurveTo(-0.44, 0, -0.5, -0.15); s.lineTo(-0.36, -0.03);
  s.bezierCurveTo(-0.3, -0.05, -0.2, -0.1, -0.02, -0.12); s.bezierCurveTo(0.2, -0.15, 0.42, -0.11, 0.5, 0);
  const g = new THREE.ShapeGeometry(s, 10); g.rotateX(-Math.PI / 2);
  return g;
}

export class Shoals {
  constructor(scene, quality) {
    this.scene = scene;
    const low = quality.shadows === 0 && quality.coralScale < 1;
    this.schools = []; this.rnd = mulberry32(99); this.seen = new Set(); this.onSeen = null;
    const sizes = low ? [4, 3, 5] : [4, 5, 3, 6, 4];
    const total = sizes.reduce((a, b) => a + b, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0x123a44, side: THREE.DoubleSide, fog: false });
    mat.onBeforeCompile = shader => {
      shader.uniforms.uTime = globalUniforms.uTime;
      shader.vertexShader = 'uniform float uTime; varying vec2 vF;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vF = position.xz;
        float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
        transformed.z += sin(uTime * 10.0 + ph - transformed.x * 9.0) * 0.07 * smoothstep(0.15, -0.5, transformed.x);`);
      // Seen from above: a darker back, then a paler rim of flank catching the light down each side, so a fish reads as a fish and not as a speck.
      shader.fragmentShader = 'varying vec2 vF;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float wide = 0.145 * sqrt(max(0.0, 1.0 - pow((vF.x - 0.05) / 0.5, 2.0))) + 0.012;
        float flank = smoothstep(0.42, 0.95, abs(vF.y) / wide) * smoothstep(-0.34, -0.18, vF.x);
        diffuseColor.rgb = mix(diffuseColor.rgb * 0.82, vec3(0.42, 0.62, 0.64), flank * 0.75);`);
    };
    this.mesh = new THREE.InstancedMesh(fishGeometry(), mat, total);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -1; this.mesh.userData.noShadow = true;
    scene.add(this.mesh);
    this.castShade = !!quality.shadows;   // a soft shadow on the sand under each school: high and ultra, painted by the terrain shader (uSchools), so it follows the ground and lies under the fish
    let k = 0;
    for (const n of sizes) {
      const fish = Array.from({ length: n }, () => { const len = 0.42 + this.rnd() * 0.3; return { i: k++, ox: (this.rnd() - 0.5) * 2.2, oz: (this.rnd() - 0.5) * 2.2, len, base: len, x: 0, z: 0, hd: 0, ph: this.rnd() * 6 }; });
      this.schools.push({ fish, c: new THREE.Vector2(), wp: new THREE.Vector2(), speed: 0.7 + this.rnd() * 0.4, flee: 0, ready: false, wait: this.rnd() * 3 });
    }
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3();
  }
  /** Which species swims in this school: weighted by the catch table of the fishing spot the school is over (nearest to where the angler stands). */
  speciesAt(eco, p, x, z, time) {
    const spot = eco?.fishing?.spotAt?.(p.x, p.z, x, z) ?? 'beach', tab = SPOTS[spot]?.fish?.filter(f => gateOpen(SPECIES_BY_ID[f[0]], { time, rig: null }));   // squid only show at dusk and night
    if (!tab?.length) return null;
    const total = tab.reduce((a, f) => a + f[1], 0); let r = this.rnd() * total;
    for (const f of tab) if ((r -= f[1]) <= 0) return f[0];
    return tab[0][0];
  }
  /** A spot of shallow water (0.4-2.4 m deep) 5-16 m from the angler, else null. */
  pick(world, p, minR = 5, maxR = 16) {
    const [dMin, dMax] = world.eco?.shoalDepth ?? [0.4, 2.4];   // how deep the water can be and still show fish (clearer sites: deeper)
    for (let i = 0; i < 24; i++) {
      const a = this.rnd() * 6.283, r = minR + this.rnd() * (maxR - minR), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const d = world.surfaceAt(x, z) - world.groundAt(x, z);
      if (d > dMin && d < dMax) return new THREE.Vector2(x, z);
    }
    return null;
  }
  update(dt, t, world, walker, eco, time) {
    if (!walker || !world.terrain) { this.mesh.visible = false; if (this.castShade) for (const u of globalUniforms.uSchools.value) u.z = 0; return; }
    this.mesh.visible = true;
    const p = walker.pos, m = this.m, q = this.q, e = this.e, v = this.v, sc = this.sc;
    for (const s of this.schools) {
      const far = Math.hypot(s.c.x - p.x, s.c.y - p.z) > 34;
      if (!s.ready || far) {
        s.wait -= dt;
        if (s.wait > 0 && s.ready) continue;
        const c = this.pick(world, p, 4, 18);
        if (!c) { s.wait = 1.5; s.ready = false; for (const f of s.fish) this.mesh.setMatrixAt(f.i, this.zero); continue; }
        s.c.copy(c); s.wp.copy(c); s.ready = true; s.wait = 0;
        s.sp = this.speciesAt(eco, p, c.x, c.y, time);
        const info = SPECIES_BY_ID[s.sp], mid = info ? (info.length[0] + info.length[1]) / 2 : 40, k2 = Math.max(0.8, Math.min(1.6, 0.6 + mid / 70));
        for (const f of s.fish) { f.x = c.x + f.ox; f.z = c.y + f.oz; f.hd = this.rnd() * 6.283; f.len = f.base * k2; }
      }
      // Waypoint wandering; a flurry away from the angler when it comes close.
      const dp = Math.hypot(s.c.x - p.x, s.c.y - p.z);
      if (s.sp && dp < SEEN_RANGE && !this.seen.has(s.sp)) { this.seen.add(s.sp); this.onSeen?.(s.sp, 'school'); }
      if (dp < 4.2 && s.flee <= 0) { s.flee = 1.6; s.wp.set(s.c.x + (s.c.x - p.x) * 2.5, s.c.y + (s.c.y - p.z) * 2.5); }
      s.flee = Math.max(0, s.flee - dt);
      const dx = s.wp.x - s.c.x, dz = s.wp.y - s.c.y, dl = Math.hypot(dx, dz), sp = s.flee > 0 ? 3.4 : s.speed;
      if (dl < 1) { const n = this.pick(world, p, 5, 16); if (n) s.wp.copy(n); }
      else { const nx = s.c.x + dx / dl * sp * dt, nz = s.c.y + dz / dl * sp * dt, d = world.surfaceAt(nx, nz) - world.groundAt(nx, nz); if (d > 0.35) s.c.set(nx, nz); else { const n = this.pick(world, p, 5, 16); if (n) s.wp.copy(n); } }
      const lead = Math.atan2(dx, dz);
      for (const f of s.fish) {
        // Each fish eases toward its slot in the school, with a little wandering of its own.
        const tx = s.c.x + f.ox + Math.sin(t * 0.7 + f.ph) * 0.35, tz = s.c.y + f.oz + Math.cos(t * 0.6 + f.ph) * 0.35;
        const vx = tx - f.x, vz = tz - f.z, d = Math.hypot(vx, vz);
        const k = Math.min(1, (s.flee > 0 ? 6 : 2.2) * dt);
        f.x += vx * k; f.z += vz * k;
        const want = d > 0.12 ? Math.atan2(vx, vz) : lead;
        let da = ((want - f.hd + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        f.hd += da * Math.min(1, 5 * dt);
        const surf = world.surfaceAt(f.x, f.z), gr = world.groundAt(f.x, f.z);
        if (surf - gr < 0.25) { this.mesh.setMatrixAt(f.i, this.zero); continue; }
        const y = Math.max(gr + 0.1, surf - 0.32);
        // Model faces +x; rotating about y by (heading - 90 degrees) points it along (sin hd, cos hd).
        e.set(0, f.hd - Math.PI / 2, 0); q.setFromEuler(e);
        const shallow = 1 + 0.28 * (1 - Math.min(1, Math.max(0, (surf - gr - 0.6) / 1.8)));          // a touch bigger over the sand flats, where they are the thing to cast at; a shade fatter than life, so the shape carries at the play camera's distance
        m.compose(v.set(f.x, y, f.z), q, sc.set(f.len * shallow, 1, f.len * shallow * 1.2));
        this.mesh.setMatrixAt(f.i, m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.castShade) {
      const sd = globalUniforms.uSunDir.value, U = globalUniforms.uSchools.value;
      this.schools.forEach((s, i) => {
        const gr = world.groundAt(s.c.x, s.c.y), off = (world.surfaceAt(s.c.x, s.c.y) - gr) * 0.5;   // cast along the sun, by how far above the sand they swim
        U[i].set(s.c.x - sd.x * off, s.c.y - sd.z * off, s.ready && off > 0.15 ? 1.5 + s.fish.length * 0.42 : 0);
      });
    }
  }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
