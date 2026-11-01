// Beach dressing for Bellambi: shells, driftwood, a seaweed wrack line along the high-tide mark, beach umbrellas and towels, a beach-access path with
// a little boardwalk up the foredune, and (for every site) footprints that trail behind the angler on dry sand.
// All procedural, vertex-coloured and merged into a few meshes (cheap on the low tier). Shells and wrack do not cast shadows.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';

const TAU = Math.PI * 2;
const strip = g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g.index ? g.toNonIndexed() : g; };
function paint(g, fn) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const c = fn(v, i); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
/** Colour each triangle of a non-indexed geometry by its centre: fn(centre) -> [r, g, b]. */
function paintFaces(g, fn) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); m.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    const k = fn(m); for (let j = 0; j < 3; j++) { col[(i + j) * 3] = k[0]; col[(i + j) * 3 + 1] = k[1]; col[(i + j) * 3 + 2] = k[2]; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const place = (g, x, y, z, ry = 0, rx = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); return g; };

// ---------------------------------------------------------------- parts
function shell(rnd) {
  const r = 0.045 + rnd() * 0.05, g = new THREE.SphereGeometry(r, 8, 4, 0, TAU, 0, Math.PI / 2);
  g.scale(1, 0.4, 0.85);
  const tone = rnd(), base = tone < 0.45 ? [0.98, 0.93, 0.84] : tone < 0.8 ? [0.97, 0.78, 0.72] : [0.9, 0.85, 0.95];
  return paint(strip(g), v => { const rib = 0.86 + 0.14 * Math.sin(Math.atan2(v.z, v.x) * 14); return base.map(c => c * rib); });
}
/** A tangle of seaweed: several small, flat, irregular lumps heaped together, dark brown and olive with a few green and rust strands. */
function wrackBlob(rnd) {
  const parts = [], n = 4 + Math.floor(rnd() * 5), spread = 0.2 + rnd() * 0.25, dir = rnd() * Math.PI;
  for (let i = 0; i < n; i++) {
    const r = 0.05 + rnd() * 0.1, g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1 + rnd() * 1.2, 0.3 + rnd() * 0.25, 0.4 + rnd() * 0.5); g.rotateY(dir + (rnd() - 0.5) * 1.2);
    const t = (rnd() - 0.5) * 2 * spread; g.translate(Math.cos(dir) * t + (rnd() - 0.5) * 0.12, r * 0.15, Math.sin(dir) * t + (rnd() - 0.5) * 0.12);
    const tone = rnd(), base = tone < 0.45 ? [0.24, 0.19, 0.1] : tone < 0.75 ? [0.36, 0.28, 0.12] : tone < 0.9 ? [0.2, 0.28, 0.12] : [0.5, 0.3, 0.16];
    parts.push(paint(strip(g), v => { const k = 0.75 + 0.5 * Math.max(0, v.y / (r * 0.4)); return base.map(c => c * k); }));
  }
  return mergeGeometries(parts);
}
function driftwood(rnd) {
  const len = 0.9 + rnd() * 1.8, r = 0.08 + rnd() * 0.09, parts = [];
  const log = new THREE.CylinderGeometry(r * 0.7, r, len, 7, 1); log.rotateZ(Math.PI / 2);
  parts.push(paint(strip(log), v => { const t = v.x / len + 0.5; return [0.8 - 0.2 * t, 0.7 - 0.22 * t, 0.56 - 0.2 * t]; }));
  if (rnd() < 0.7) { const br = new THREE.CylinderGeometry(r * 0.25, r * 0.5, len * 0.3, 5); br.rotateZ(1.0); br.translate(len * (rnd() - 0.5) * 0.4, r * 0.8, 0); parts.push(paint(strip(br), () => [0.66, 0.6, 0.5])); }
  const g = mergeGeometries(parts); g.translate(0, r * 0.9, 0); return g;
}
function umbrella(stripes) {
  const parts = [], pole = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6); pole.translate(0, 1.15, 0);
  parts.push(paint(strip(pole), () => [0.9, 0.86, 0.78]));
  const canopy = strip(new THREE.ConeGeometry(1.2, 0.5, 12, 1, true)); canopy.translate(0, 2.05, 0);
  parts.push(paintFaces(canopy, c => (Math.floor(((Math.atan2(c.z, c.x) + Math.PI) / TAU) * 12) % 2 ? stripes[0] : stripes[1])));
  const cap = new THREE.SphereGeometry(0.06, 6, 4); cap.translate(0, 2.32, 0); parts.push(paint(strip(cap), () => [0.95, 0.9, 0.8]));
  return mergeGeometries(parts);
}
function towel(c1, c2) {
  const g = strip(new THREE.PlaneGeometry(0.85, 1.7, 5, 1)); g.rotateX(-Math.PI / 2);
  return paintFaces(g, c => (Math.floor((c.x + 0.425) / 0.17) % 2 ? c1 : c2));
}

/** Dress the Bellambi beach. T = terrain (heightAt). Meshes are added to world.props.group with the prop material. */
export function dressBeach(world) {
  const pr = world.props, T = world.terrain, rnd = mulberry32(2026), mat = pr.mat;
  const add = (geos, noShadow) => { if (!geos.length) return; const m = new THREE.Mesh(mergeGeometries(geos), mat); m.userData.noShadow = !!noShadow; m.userData.prop = 'beachdress'; pr.group.add(m); return m; };
  const gy = (x, z) => T.heightAt(x, z);
  const dry = (x, z) => gy(x, z) > 0.35;
  // Seaweed wrack: a wavy line along the high-tide mark, plus a few strands near the swash.
  const wrack = [];
  for (let i = 0; i < 170; i++) {
    const x = -78 + rnd() * 128, line = 95.2 + Math.sin(x * 0.085) * 1.6 + Math.sin(x * 0.23 + 1) * 0.5, z = line + (rnd() - 0.5) * (rnd() < 0.2 ? 6 : 1.8);
    if (dry(x, z)) wrack.push(place(wrackBlob(rnd), x, gy(x, z) + 0.02, z, rnd() * TAU));
  }
  add(wrack, true);
  // Shells, thickest near the swash line.
  const shells = [];
  for (let i = 0; i < 190; i++) {
    const x = -78 + rnd() * 130, z = 87 + Math.pow(rnd(), 1.6) * 17;
    if (dry(x, z)) shells.push(place(shell(rnd), x, gy(x, z) + 0.012, z, rnd() * TAU, 0, (rnd() - 0.5) * 0.3));
  }
  add(shells, true);
  // Driftwood: logs along the top of the beach and a few down on the sand.
  const wood = [];
  for (let i = 0; i < 20; i++) {
    const x = -76 + rnd() * 122, z = i < 14 ? 101 + rnd() * 10 : 92 + rnd() * 7;
    if (Math.hypot(x - 4, z - 92) < 5 || Math.hypot(x + 3, z - 108) < 4) continue; // keep the spawn and the access path clear
    wood.push(place(driftwood(rnd), x, gy(x, z), z, rnd() * Math.PI));
  }
  add(wood);
  // Umbrellas and towels near the lifeguard tower.
  const umb = [], tow = [];
  const sets = [[-1, 106.5, [[0.95, 0.35, 0.3], [0.98, 0.95, 0.88]], [[0.2, 0.75, 0.75], [1, 1, 0.95]], 0.25], [10.5, 109.5, [[0.25, 0.7, 0.78], [0.98, 0.95, 0.88]], [[1, 0.7, 0.3], [1, 1, 0.95]], -0.2], [-22, 104.5, [[1, 0.78, 0.25], [0.98, 0.95, 0.88]], [[0.95, 0.4, 0.55], [1, 1, 0.95]], 0.15]];
  for (const [x, z, st, tc, tilt] of sets) {
    umb.push(place(umbrella(st), x, gy(x, z) - 0.05, z, rnd() * TAU, 0, tilt));
    tow.push(place(towel(tc[0], tc[1]), x + 1.5, gy(x + 1.5, z + 0.4) + 0.025, z + 0.4, 0.4 + rnd() * 0.6));
    tow.push(place(towel(tc[1], tc[0]), x - 0.2, gy(x - 0.2, z + 2) + 0.025, z + 2, -0.5 + rnd()));
  }
  add(umb); add(tow);
  // Beach-access path: a worn strip from the beach up the foredune, with a boardwalk and edge posts over the steep part.
  const px = z => -3 + Math.sin(z * 0.19) * 0.9, path = [], pos = [], idx = [], col = [];
  const z0 = 99, z1 = 131, step = 1;
  for (let z = z0; z <= z1; z += step) for (const s of [-1, 1]) {
    const open = Math.min(1, Math.max(0, (z - z0) / 7)), x = px(z) + s * 1.25 * (0.25 + 0.75 * open); // narrows to a worn trail at the beach end
    pos.push(x, gy(x, z) + 0.05, z); col.push(0.88 - 0.16 * open, 0.79 - 0.16 * open, 0.6 - 0.16 * open);
  }
  for (let i = 0; i < (z1 - z0) / step; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); pg.setIndex(idx); pg.computeVertexNormals();
  path.push(pg);
  const boards = [], posts = [];
  for (let z = 112; z <= 130; z += 0.62) {
    const x = px(z), b = new THREE.BoxGeometry(2.3, 0.07, 0.5); b.rotateY(Math.atan2(px(z + 0.5) - px(z), 0.5));
    boards.push(paint(strip(b), v => { const k = 0.9 + 0.1 * Math.sin(v.x * 9 + z); return [0.72 * k, 0.55 * k, 0.36 * k]; }).translate(x, gy(x, z) + 0.09, z));
  }
  for (let z = 112; z <= 130; z += 3.7) for (const s of [-1, 1]) {
    const x = px(z) + s * 1.3, p = new THREE.CylinderGeometry(0.07, 0.08, 0.75, 6); p.translate(x, gy(x, z) + 0.36, z); posts.push(paint(strip(p), () => [0.6, 0.45, 0.3]));
  }
  // A signpost at the top, where you head home.
  const sx = px(119) + 1.9, sign = [paint(strip(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 6)), () => [0.55, 0.4, 0.26]).translate(sx, gy(sx, 119) + 0.75, 119),
    paint(strip(new THREE.BoxGeometry(0.9, 0.34, 0.06)), () => [0.95, 0.9, 0.78]).translate(sx, gy(sx, 119) + 1.35, 119)];
  add(path, true); add([...boards, ...posts, ...sign]);
}

// ---------------------------------------------------------------- footprints
/** Footprints on dry or damp sand, alternating left and right behind the angler; they fade over about 45 s. */
export class Footprints {
  constructor(scene, world) {
    this.world = world; this.n = 96; this.i = 0; this.last = new THREE.Vector3(1e9, 0, 1e9); this.side = 1; this.age = new Float32Array(this.n).fill(99);
    const g = new THREE.PlaneGeometry(0.22, 0.46, 1, 1); g.rotateX(-Math.PI / 2);
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(this.n), 1); g.setAttribute('aFade', this.fade);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false,
      vertexShader: 'attribute float aFade; varying float vF; varying vec2 vUv; void main(){ vF = aFade; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vF; varying vec2 vUv; void main(){ vec2 d = (vec2(vUv.x, 1.0 - vUv.y) - 0.5) * 2.0; float heel = length(d * vec2(1.0, 1.25) + vec2(0.0, 0.55)); float toe = length(d * vec2(1.0, 1.1) - vec2(0.0, 0.5)); float a = max(1.0 - smoothstep(0.55, 0.8, heel * 1.15), 1.0 - smoothstep(0.6, 0.9, toe)); gl_FragColor = vec4(0.55, 0.42, 0.24, a * vF * 0.62); }',
    });
    this.mesh = new THREE.InstancedMesh(g, mat, this.n); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.userData.noShadow = true;
    const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let k = 0; k < this.n; k++) this.mesh.setMatrixAt(k, z);
    scene.add(this.mesh);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
  }
  update(dt, walker, rockAt) {
    if (!walker) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const w = this.world, p = walker.pos;
    for (let k = 0; k < this.n; k++) { this.age[k] += dt; this.fade.setX(k, Math.max(0, 1 - this.age[k] / 45)); }
    this.fade.needsUpdate = true;
    const gnd = w.groundAt(p.x, p.z), onDeck = p.y - gnd > 0.3, wet = w.surfaceAt(p.x, p.z) - gnd > 0.02;
    const rock = rockAt ? rockAt(p.x, p.z, gnd, 0) > 0.5 : false;
    if (walker.speed < 0.3 || onDeck || wet || rock || gnd < 0.12) return;
    if (Math.hypot(p.x - this.last.x, p.z - this.last.z) < 0.72) return;
    this.last.copy(p); this.side = -this.side;
    const h = walker.heading, ox = Math.cos(h) * 0.13 * this.side, oz = -Math.sin(h) * 0.13 * this.side;
    const x = p.x + ox, z = p.z + oz;
    this.e.set(0, h, 0); this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(x, w.groundAt(x, z) + 0.035, z), this.q, this.s);
    this.mesh.setMatrixAt(this.i, this.m); this.mesh.instanceMatrix.needsUpdate = true;
    this.age[this.i] = 0; this.i = (this.i + 1) % this.n;
  }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
