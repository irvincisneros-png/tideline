// Animals of the beach, dunes and rock platform: ghost crabs, shorebirds, gulls and rock-pool creatures.
// Lightweight agents (no swimming physics); they share the photo/pick interface of the underwater agents:
// { id, pos, dir, radius, visible, kind: { length }, b: { type } }.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';
import { blob, tube, colorize, strip } from '../life/models2.js';
import * as M2 from '../life/models2.js';
import { patchUnderwater, globalUniforms } from '../ocean/shaders.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- models (head toward +x, feet at y = 0)

/** Standing shorebird: body, head, bill, legs and folded wings. c = colours. */
function shorebird(c, s = 1) {
  const parts = [];
  // Body (dark back, pale belly when c.belly differs) and breast
  parts.push(blob(0.11 * s, 1.55, 0.9, 0.95, v => (v.y > 0.2 * s + 0.01 || v.x > 0.1 * s ? c.back : c.belly), [0, 0.2 * s, 0], 14));
  parts.push(blob(0.065 * s, 1, 1, 0.95, c.head, [0.17 * s, 0.29 * s, 0], 12));
  // Bill
  parts.push(tube(V(0.22 * s, 0.29 * s, 0), V(0.22 * s + c.bill * s, 0.27 * s - c.billDroop * s, 0), 0.011 * s, 0.004 * s, 6, c.billCol, c.billTip ?? c.billCol));
  // Eye with ring
  for (const z of [-1, 1]) parts.push(blob(0.012 * s, 1, 1, 0.6, c.eye, [0.205 * s, 0.305 * s, z * 0.045 * s], 6));
  // Legs
  for (const z of [-1, 1]) {
    parts.push(tube(V(0, 0.12 * s, z * 0.035 * s), V(0.01 * s, 0.0, z * 0.04 * s), 0.008 * s, 0.006 * s, 4, c.legs, c.legs));
    parts.push(tube(V(0.01 * s, 0.003, z * 0.04 * s), V(0.06 * s, 0.003, z * 0.04 * s), 0.005 * s, 0.004 * s, 3, c.legs, c.legs));
  }
  // Folded wings and tail
  for (const z of [-1, 1]) parts.push(blob(0.09 * s, 1.6, 0.45, 0.25, c.wing, [-0.05 * s, 0.24 * s, z * 0.07 * s], 10));
  parts.push(blob(0.06 * s, 1.3, 0.2, 0.6, c.tail ?? c.wing, [-0.17 * s, 0.22 * s, 0], 8));
  return mergeGeometries(parts);
}
/** Gull in flight: wings spread; vertices carry aWing = distance along the wing for the flapping shader. */
function flyingGull(c) {
  const g = shorebird({ ...c, legs: c.belly }, 1);
  const wings = [];
  for (const side of [-1, 1]) {
    const w = new THREE.PlaneGeometry(0.2, 0.55, 2, 4); // chord x span
    w.rotateX(-Math.PI / 2);
    w.translate(-0.03, 0.25, side * 0.3);
    colorize(w, v => Math.abs(v.z) > 0.48 ? c.tip : c.wing);
    wings.push(strip(w));
  }
  const m = mergeGeometries([strip(g), ...wings]);
  const p = m.attributes.position, aw = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) aw[i] = Math.max(0, Math.abs(p.getZ(i)) - 0.06) * Math.sign(p.getZ(i));
  m.setAttribute('aWing', new THREE.BufferAttribute(aw, 1));
  return m;
}
/** Waratah anemone at low tide: tentacles pulled in, a glossy red dome with a ring of blue spots (acrorhagi). */
function waratahAnemone() {
  const g = new THREE.SphereGeometry(0.035, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  g.scale(1, 0.9, 1);
  colorize(g, v => {
    const ring = v.y < 0.008 && v.y > 0.002 && (Math.atan2(v.z, v.x) * 12 % 2 + 2) % 2 < 0.6;
    return ring ? [0.15, 0.3, 0.85] : [0.6, 0.04, 0.06];
  });
  return strip(g);
}
/** Blue-lined octopus: small, mottled tan-yellow with fine blue lines (they glow brighter when it is alarmed). */
function blueLinedOctopus() {
  const g = M2.octopus(7, { color: [0.62, 0.5, 0.25] });
  g.scale(0.45, 0.45, 0.45);
  const p = g.attributes.position, c = g.attributes.color, glow = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const line = Math.abs(Math.sin(x * 160 + Math.sin(z * 90) * 2) * Math.sin(z * 150 + y * 40)) > 0.82;
    if (line) { c.setXYZ(i, 0.1, 0.3, 0.9); glow[i] = 1; }
  }
  g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  return g;
}
const MODELS = {
  ghostcrab: () => { const g = M2.crab(3, { color: [0.86, 0.8, 0.66], legs: [0.82, 0.76, 0.62], size: 0.05 }); return g; },
  oystercatcher: () => shorebird({ back: [0.04, 0.04, 0.04], belly: [0.92, 0.92, 0.9], head: [0.04, 0.04, 0.04], wing: [0.05, 0.05, 0.05], tail: [0.06, 0.06, 0.06],
    bill: 0.08, billDroop: 0.01, billCol: [0.95, 0.32, 0.08], eye: [0.85, 0.15, 0.08], legs: [0.88, 0.55, 0.55] }, 1.05),
  silvergull: () => shorebird({ back: [0.92, 0.92, 0.92], belly: [0.95, 0.95, 0.95], head: [0.96, 0.96, 0.96], wing: [0.66, 0.68, 0.72], tail: [0.95, 0.95, 0.95],
    bill: 0.045, billDroop: 0.006, billCol: [0.8, 0.12, 0.1], eye: [0.9, 0.9, 0.9], legs: [0.8, 0.12, 0.1] }, 0.95),
  silvergullFlying: () => flyingGull({ back: [0.92, 0.92, 0.92], belly: [0.95, 0.95, 0.95], head: [0.96, 0.96, 0.96], wing: [0.68, 0.7, 0.74], tip: [0.08, 0.08, 0.08],
    bill: 0.045, billDroop: 0.006, billCol: [0.8, 0.12, 0.1], eye: [0.9, 0.9, 0.9], legs: [0.8, 0.12, 0.1] }),
  waratahanemone: waratahAnemone,
  bluelinedoctopus: blueLinedOctopus,
};

// Vertex animation per species (model space: +x forward, +y up, +z to the side).
const BIRD_FLAP = `
  float wing = step(0.045, abs(transformed.z)) * step(0.16, transformed.y);
  transformed.z *= 1.0 + wing * aMove * 2.2;                                    // spread the wings
  transformed.y += wing * aMove * sin(uAnimTime * 26.0) * (abs(transformed.z) - 0.04) * 1.6; // and flap
`;
const ANIM = {
  ghostcrab: `
    float leg = step(0.04, abs(transformed.z)) * step(transformed.y, 0.04);
    transformed.y += leg * aMove * max(0.0, sin(uAnimTime * 34.0 + transformed.x * 90.0 + sign(transformed.z) * 1.6)) * 0.012;
  `,
  oystercatcher: BIRD_FLAP,
  silvergull: BIRD_FLAP,
};

// ---------------------------------------------------------------- behaviour

export const LAND_BEHAVIOUR = {
  ghostcrab: { type: 'ghostcrab', speed: 1.6, wary: 5, radius: 0.08 },
  oystercatcher: { type: 'shorebird', speed: 0.35, wary: 9, flee: 4, radius: 0.25 },
  silvergull: { type: 'gull', speed: 0.5, wary: 4, radius: 0.22 },
  waratahanemone: { type: 'static', radius: 0.06 },
  bluelinedoctopus: { type: 'octopus', radius: 0.08 },
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();

export class LandLife {
  /** spec: eco.land with life {id: n}, zones {id: (rnd) => {x, z}} and helpers. */
  constructor(scene, eco, terrain, quality, seed = 13, art = null) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.terrain = terrain; this.eco = eco; this.agents = []; this.meshes = {};
    this.rnd = mulberry32(seed);
    const land = eco.land;
    for (const [id, n] of Object.entries(land.life)) {
      const b = LAND_BEHAVIOUR[id];
      const mid = art?.land?.[id], geo = mid && art.models.has(mid) ? art.models.get(mid).clone() : MODELS[id]();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: id === 'waratahanemone' ? 0.25 : 0.7, side: THREE.DoubleSide });
      if (id === 'bluelinedoctopus') this.patchGlow(mat);
      if (ANIM[id]) this.patchAnim(mat, ANIM[id]);
      patchUnderwater(mat, { key: 'land' + id });
      if (ANIM[id]) geo.setAttribute('aMove', new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.castShadow = true;
      this.group.add(im); this.meshes[id] = im;
      for (let i = 0; i < n; i++) {
        const p = land.zones[id](this.rnd, i);
        const a = { id, b, index: i, pos: V(p.x, terrain.heightAt(p.x, p.z), p.z), home: V(p.x, 0, p.z), dir: V(1, 0, 0).applyAxisAngle(V(0, 1, 0), this.rnd() * 6.28),
          radius: b.radius, visible: true, kind: { length: b.radius * 2 }, state: 'idle', timer: this.rnd() * 4, phase: this.rnd() * 6.28, y: 0, scale: 1, alarm: 0 };
        a.home.y = a.pos.y;
        this.agents.push(a);
      }
    }
    // Flying gulls wheel overhead (not photographable targets on their own; the standing gulls are).
    const nf = land.flyingGulls ?? 0;
    if (nf) {
      const geo = MODELS.silvergullFlying();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
      mat.onBeforeCompile = sh => {
        sh.uniforms.uTime = globalUniforms.uTime;
        sh.vertexShader = 'attribute float aWing; uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = uTime * 4.2 + instanceMatrix[3].x * 0.7;
          transformed.y += sin(ph) * aWing * 0.9 * abs(aWing) * 2.0;`);
      };
      mat.customProgramCacheKey = () => 'flyinggull';
      this.flyers = new THREE.InstancedMesh(geo, mat, nf); this.flyers.frustumCulled = false;
      this.flyerState = Array.from({ length: nf }, (_, i) => ({ c: land.gullCircle ?? { x: 0, z: 100 }, r: 18 + this.rnd() * 25, h: 9 + this.rnd() * 10, w: (0.15 + this.rnd() * 0.12) * (this.rnd() < 0.5 ? 1 : -1), a: this.rnd() * 6.28 }));
      this.group.add(this.flyers);
    }
    this.burrows = this.makeBurrows();
    this.t = 0;
  }
  /** Vertex animation driven by a per-instance 0..1 'aMove' (legs scuttle, wings flap). */
  patchAnim(mat, code) {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      prev?.(sh, r);
      sh.uniforms.uAnimTime = globalUniforms.uTime;
      sh.vertexShader = 'attribute float aMove; uniform float uAnimTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + code);
    };
  }
  patchGlow(mat) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uAlarm = { value: 0 }; mat.userData.alarm = sh.uniforms.uAlarm;
      sh.vertexShader = 'attribute float aGlow; varying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      sh.fragmentShader = 'varying float vGlow; uniform float uAlarm;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.1, 0.45, 1.0) * vGlow * (0.15 + uAlarm * 1.6);');
    };
  }
  /** Ghost crab burrows: dark holes with a fan of excavated sand, one per crab. */
  makeBurrows() {
    const crabs = this.agents.filter(a => a.id === 'ghostcrab');
    if (!crabs.length) return null;
    const hole = new THREE.CircleGeometry(0.035, 10); hole.rotateX(-Math.PI / 2); hole.translate(0, 0.012, 0);
    colorize(hole, () => [0.06, 0.05, 0.04]);
    const fan = new THREE.SphereGeometry(0.12, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2); fan.scale(1, 0.12, 0.7); fan.translate(0.1, 0, 0);
    colorize(fan, () => [0.9, 0.85, 0.72]);
    const geo = mergeGeometries([strip(hole), strip(fan)]);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const im = new THREE.InstancedMesh(geo, mat, crabs.length); im.receiveShadow = true;
    crabs.forEach((a, i) => { _e.set(0, this.rnd() * 6.28, 0); _q.setFromEuler(_e); _m.compose(a.home, _q, _s.set(1, 1, 1)); im.setMatrixAt(i, _m); });
    this.group.add(im);
    return im;
  }

  update(dt, player) {
    this.t += dt;
    const pp = player?.pos;
    const ground = (x, z) => this.terrain.heightAt(x, z);
    let octAlarm = 0;
    for (const a of this.agents) {
      const b = a.b, dist = pp ? Math.hypot(a.pos.x - pp.x, a.pos.z - pp.z) : 99;
      a.timer -= dt;
      if (b.type === 'ghostcrab') {
        // Ghost crabs bolt sideways to their burrow when anything big approaches, then wait before peeking out.
        if (a.state !== 'hidden' && dist < b.wary) a.state = 'bolt';
        if (a.state === 'bolt') {
          const to = _v.subVectors(a.home, a.pos).setY(0); const d = to.length();
          if (d < 0.08) { a.state = 'hidden'; a.timer = 6 + this.rnd() * 8; }
          else { a.pos.addScaledVector(to.normalize(), Math.min(d, b.speed * 2.2 * dt)); a.dir.copy(to).applyAxisAngle(_up, Math.PI / 2); }
        } else if (a.state === 'hidden') {
          if (a.timer <= 0 && dist > b.wary * 1.6) { a.state = 'idle'; a.timer = 1 + this.rnd() * 3; }
        } else if (a.timer <= 0) {
          if (a.state === 'idle') { a.state = 'scuttle'; a.timer = 0.4 + this.rnd() * 0.8; a.target = a.home.clone().add(V((this.rnd() - 0.5) * 3, 0, (this.rnd() - 0.5) * 3)); }
          else { a.state = 'idle'; a.timer = 1 + this.rnd() * 4; }
        }
        if (a.state === 'scuttle' && a.target) { const to = _v.subVectors(a.target, a.pos).setY(0); if (to.length() > 0.05) { a.pos.addScaledVector(to.normalize(), b.speed * dt); a.dir.copy(to).applyAxisAngle(_up, Math.PI / 2); } }
        a.visible = a.state !== 'hidden';
        a.move = a.state === 'bolt' || a.state === 'scuttle' ? 1 : 0;
      } else if (b.type === 'shorebird' || b.type === 'gull') {
        // Walk and probe along the sand; walk away from people, take flight when crowded.
        if (a.state === 'fly') {
          a.flyT += dt; const k = a.flyT / a.flyDur;
          a.pos.lerpVectors(a.from, a.to, k); a.y = Math.sin(Math.PI * Math.min(1, k)) * 6;
          if (k >= 1) { a.state = 'idle'; a.y = 0; a.home.copy(a.to); a.timer = 3; }
        } else if (dist < (b.flee ?? b.wary * 0.6)) {
          a.state = 'fly'; a.flyT = 0; a.flyDur = 4 + this.rnd() * 2; a.from = a.pos.clone();
          const away = _v.set(a.pos.x - pp.x, 0, a.pos.z - pp.z).normalize();
          a.to = a.pos.clone().add(V(away.x * 20 + (this.rnd() - 0.5) * 30, 0, away.z * 6)); a.to.z = Math.min(Math.max(a.to.z, 78), 112);
          a.dir.set(a.to.x - a.pos.x, 0, a.to.z - a.pos.z).normalize();
        } else if (dist < b.wary) {
          const away = _v.set(a.pos.x - pp.x, 0, a.pos.z - pp.z).normalize();
          a.dir.lerp(away, 0.1).normalize(); a.pos.addScaledVector(a.dir, b.speed * 2.2 * dt); a.state = 'walk';
        } else if (a.timer <= 0) {
          a.state = a.state === 'walk' ? 'probe' : 'walk'; a.timer = 1.5 + this.rnd() * 3;
          if (a.state === 'walk') a.dir.applyAxisAngle(_up, (this.rnd() - 0.5) * 1.5);
          const toHome = _v.subVectors(a.home, a.pos).setY(0); if (toHome.length() > 8) a.dir.lerp(toHome.normalize(), 0.6).normalize();
        } else if (a.state === 'walk') a.pos.addScaledVector(a.dir, b.speed * dt);
        a.grazing = a.state === 'probe';
        a.move = a.state === 'fly' ? 1 : a.state === 'walk' ? 0.15 : 0;
      } else if (b.type === 'octopus') {
        a.alarm = Math.max(0, a.alarm - dt * 0.4);
        if (dist < 1.6) a.alarm = 1;
        octAlarm = Math.max(octAlarm, a.alarm);
      }
      // Pose
      const gy = ground(a.pos.x, a.pos.z);
      const yaw = Math.atan2(-a.dir.z, a.dir.x);
      const probe = a.state === 'probe' ? Math.max(0, Math.sin(this.t * 3 + a.phase)) * 0.5 : 0;
      _e.set(0, yaw, -probe); _q.setFromEuler(_e);
      const sc = a.visible ? 1 : 0;
      _m.compose(_p.set(a.pos.x, gy + (a.y ?? 0) + (b.type === 'octopus' ? 0.01 : 0), a.pos.z), _q, _s.set(sc, sc, sc));
      if (b.type !== 'static' || !a.placed) { this.meshes[a.id].setMatrixAt(a.index, _m); a.placed = true; }
      a.pos.y = gy + (a.y ?? 0) + 0.05;
    }
    for (const [id, im] of Object.entries(this.meshes)) {
      im.instanceMatrix.needsUpdate = true;
      const mv = im.geometry.attributes.aMove;
      if (mv) { for (const a of this.agents) if (a.id === id) mv.array[a.index] += ((a.move ?? 0) - mv.array[a.index]) * 0.2; mv.needsUpdate = true; }
    }
    const om = this.meshes.bluelinedoctopus?.material.userData.alarm; if (om) om.value = octAlarm;
    for (const a of this.agents) if (a.id === 'bluelinedoctopus') a.flashing = a.alarm > 0.3;
    if (this.flyers) {
      this.flyerState.forEach((f, i) => {
        f.a += f.w * dt;
        const x = f.c.x + Math.cos(f.a) * f.r, z = f.c.z + Math.sin(f.a) * f.r * 0.6, y = f.h + Math.sin(f.a * 3) * 1.5;
        const dx = -Math.sin(f.a) * f.r * Math.sign(f.w), dz = Math.cos(f.a) * f.r * 0.6 * Math.sign(f.w);
        _e.set(Math.sin(f.a * 2) * 0.15, Math.atan2(-dz, dx), 0); _q.setFromEuler(_e);
        _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1)); this.flyers.setMatrixAt(i, _m);
      });
      this.flyers.instanceMatrix.needsUpdate = true;
    }
  }
  dispose() {
    this.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.group.parent?.remove(this.group);
  }
}
const _v = new THREE.Vector3(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
