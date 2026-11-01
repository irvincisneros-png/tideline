// Belmore Basin's built things, made in code (chunky, flat-shaded, vertex-coloured, in the same cosy style as the Blender prop set): a timber wharf deck and
// pylons, bollards, lamp posts, three fishing trawlers, the co-op building, a stone quay wall, a lighthouse, and the odds and ends of a working harbour
// (fish crates, bins, nets, buoys, rope). buildHarbourModels() returns Map(name -> BufferGeometry with position, normal, color), the same shape as a loaded .glb set,
// so props.place('name', x, z, opts) works unchanged. Units are metres; every model sits on y = 0 (a hull: the waterline is y = 0).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const colour = h => new THREE.Color(h);
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();

/** Give a primitive its flat colour and place it (position, Euler rotation). Returns a non-indexed geometry with position, normal and color only. */
function part(geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  M.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz));
  g.applyMatrix4(M);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count, c = new Float32Array(n * 3), k = colour(hex);
  for (let i = 0; i < n; i++) { c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const box = (w, h, d, hex, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => part(new THREE.BoxGeometry(w, h, d), hex, x, y, z, rx, ry, rz);
const cyl = (r0, r1, h, hex, x = 0, y = 0, z = 0, seg = 10, rx = 0, rz = 0) => part(new THREE.CylinderGeometry(r0, r1, h, seg), hex, x, y, z, rx, 0, rz);
const ball = (r, hex, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => part(new THREE.SphereGeometry(r, 10, 7), hex, x, y, z, 0, 0, 0, sx, sy, sz);
const torus = (R, r, hex, x, y, z, rx = Math.PI / 2) => part(new THREE.TorusGeometry(R, r, 6, 14), hex, x, y, z, rx, 0, 0);

/** Merge parts, then bake a soft light-from-above shade into the colours so the faces read without a lit shader. */
function finish(parts, shade = 0.26) {
  const geo = mergeGeometries(parts.map(g => g.toNonIndexed ? (g.index ? g.toNonIndexed() : g) : g), false);
  geo.computeVertexNormals();
  const n = geo.attributes.normal, c = geo.attributes.color;
  for (let i = 0; i < c.count; i++) {
    const k = 1 - shade + shade * (n.getY(i) * 0.5 + 0.5) * 1.3;
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  return geo;
}

// ------------------------------------------------------------------ the wharf
function wharfDeck() {
  // 8 m wide, 2 m long module, top face at y = 0. Planks run along z; two cross beams underneath; a low kerb on both long edges.
  const p = [];
  for (let i = 0; i < 8; i++) p.push(box(0.97, 0.3, 2.0, i % 2 ? 0xb88a58 : 0xa97b4b, -3.5 + i, -0.15, 0));
  for (const z of [-0.8, 0.8]) p.push(box(8.0, 0.32, 0.26, 0x6b4a30, 0, -0.46, z));
  for (const x of [-3.88, 3.88]) p.push(box(0.2, 0.18, 2.0, 0x8a5e3a, x, 0.09, 0));
  return finish(p, 0.2);
}
function wharfPile() {
  // A tarred timber pile with a pale tide band and a flat cap; origin at the foot, 4 m tall.
  return finish([cyl(0.3, 0.34, 4, 0x4a3727, 0, 2, 0, 9), cyl(0.315, 0.315, 0.55, 0x7a6a50, 0, 2.9, 0, 9), cyl(0.31, 0.31, 0.12, 0x6b4a30, 0, 4.02, 0, 9)]);
}
function bollard() {
  return finish([cyl(0.2, 0.26, 0.36, 0x353d43, 0, 0.18, 0, 10), cyl(0.15, 0.15, 0.2, 0x353d43, 0, 0.45, 0, 10), cyl(0.26, 0.19, 0.12, 0x353d43, 0, 0.62, 0, 10), cyl(0.205, 0.205, 0.05, 0xf0b73c, 0, 0.5, 0, 10)]);
}
function lampPost() {
  // 3.3 m post with a curved arm reaching 1.6 m out toward +x and a cream lantern head hanging at the end (head at (1.6, 3.2)).
  const p = [cyl(0.075, 0.1, 3.3, 0x34444c, 0, 1.65, 0, 8), cyl(0.16, 0.16, 0.18, 0x34444c, 0, 0.09, 0, 8)];
  p.push(box(1.65, 0.07, 0.07, 0x34444c, 0.8, 3.3, 0), box(0.07, 0.5, 0.07, 0x34444c, 0.15, 3.1, 0, 0, 0, 0.7));
  p.push(cyl(0.2, 0.15, 0.34, 0xfff0c2, 1.6, 3.0, 0, 8), cyl(0.04, 0.24, 0.12, 0x34444c, 1.6, 3.23, 0, 8), cyl(0.18, 0.18, 0.05, 0x34444c, 1.6, 2.82, 0, 8));
  return finish(p, 0.1);
}

// ------------------------------------------------------------------ trawlers
/** A ribbon between two rails along the hull: rail(t) -> [x, y, z] for t = 0 (stern) .. 1 (bow). */
function ribbon(railA, railB, hex, n = 16) {
  const pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const a = railA(i / n), b = railB(i / n); pos.push(...a, ...b); }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const f = g.toNonIndexed(); f.computeVertexNormals();
  const c = new Float32Array(f.attributes.position.count * 3), k = colour(hex);
  for (let i = 0; i < c.length; i += 3) { c[i] = k.r; c[i + 1] = k.g; c[i + 2] = k.b; }
  f.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return f;
}
function trawler({ len = 11, beam = 3.5, hull = 0xf4efe4, stripe = 0x2d6f9c, cabin = 0xf7f2e8, roof = 0x2d6f9c, gear = 0x3e8f62, bottom = 0x8d3d3a } = {}) {
  const L = len, hb = beam / 2, deck = 0.82;
  const x = t => -L / 2 + t * L;
  const half = t => hb * (t < 0.72 ? (0.9 + 0.1 * Math.sin(Math.min(1, t * 6) * Math.PI / 2)) : Math.pow(Math.cos((t - 0.72) / 0.28 * Math.PI / 2), 0.7));
  const dy = t => deck + 0.55 * t * t * t;          // the bow lifts
  const ky = t => -0.78 * (t > 0.88 ? 1 - (t - 0.88) / 0.12 * 0.55 : 1);
  const p = [];
  for (const s of [-1, 1]) {
    p.push(ribbon(t => [x(t), dy(t), s * half(t)], t => [x(t), dy(t) - 0.34, s * half(t)], stripe));                      // the coloured sheer stripe
    p.push(ribbon(t => [x(t), dy(t) - 0.34, s * half(t)], t => [x(t), 0.0, s * half(t) * 0.97], hull));                 // white topsides to the waterline
    p.push(ribbon(t => [x(t), 0.0, s * half(t) * 0.97], t => [x(t), ky(t) * 0.55, s * half(t) * 0.6], bottom));          // red antifouling below
    p.push(ribbon(t => [x(t), ky(t) * 0.55, s * half(t) * 0.6], t => [x(t), ky(t), 0], bottom));
  }
  p.push(ribbon(t => [x(t), dy(t), -half(t)], t => [x(t), dy(t), half(t)], 0xc5a36f));                                  // the timber deck
  for (const sd of [-1, 1]) p.push(box(L * 0.74, 0.22, 0.1, 0xe8e0d0, x(0.5), deck + 0.15, sd * (hb * 0.96)));   // the low bulwark rail
  // wheelhouse near the stern end of the middle, with a roof, windows and a mast
  const cx = x(0.35);
  p.push(box(2.5, 1.55, 2.5, cabin, cx, deck + 0.78, 0), box(2.8, 0.14, 2.8, roof, cx, deck + 1.62, 0));
  p.push(box(0.05, 0.6, 2.2, 0x2b4a5a, cx + 1.26, deck + 1.0, 0), box(2.0, 0.5, 0.05, 0x2b4a5a, cx, deck + 1.0, 1.26), box(2.0, 0.5, 0.05, 0x2b4a5a, cx, deck + 1.0, -1.26));
  p.push(cyl(0.07, 0.09, 4.0, 0x6b747a, cx - 0.4, deck + 3.6, 0, 6), box(0.1, 0.1, 1.9, 0x6b747a, cx - 0.4, deck + 4.2, 0), ball(0.3, 0xeef2f4, cx + 0.5, deck + 1.95, 0, 1, 0.8, 1));
  // a derrick leaning forward, a winch drum with a green net at the stern, floats and crates on deck
  p.push(cyl(0.09, 0.11, 3.4, 0x6b747a, x(0.62), deck + 1.6, 0, 6, 0, -0.65));
  p.push(cyl(0.45, 0.45, 2.2, gear, x(0.08), deck + 0.6, 0, 12, Math.PI / 2, 0), ball(0.85, 0x4faa72, x(0.1), deck + 0.75, 0, 1, 0.55, 1.25));
  for (const [a, b] of [[0.5, 0.9], [0.56, -0.8], [0.62, 0.7], [0.5, -0.4]]) p.push(ball(0.2, 0xff8a3d, x(a), deck + 0.2, b * hb * 0.7));
  p.push(box(0.8, 0.4, 0.55, 0x3d86c4, x(0.78), deck + 0.2, 0.7), box(0.8, 0.4, 0.55, 0xf0a63a, x(0.78), deck + 0.2, -0.7), box(0.8, 0.4, 0.55, 0x3d86c4, x(0.78), deck + 0.6, 0.7));
  for (const s of [-1, 1]) for (const a of [0.25, 0.5, 0.75]) p.push(cyl(0.16, 0.16, 0.3, 0x24282c, x(a), 0.35, s * (half(a) + 0.12), 8, Math.PI / 2, 0));   // tyre fenders
  return finish(p, 0.22);
}

// ------------------------------------------------------------------ the co-op, a lighthouse, quay wall
function coop() {
  // 13 m (x) by 6.5 m (z); the front (the water side) faces -z. Origin on the ground at the centre of the building.
  const W = 13, D = 6.5, H = 4.2, wall = 0xbfe0d4, trim = 0xf6f1e6, roof = 0x6f8aa0;
  const p = [box(W, H, D, wall, 0, H / 2, 0), box(W + 0.3, 0.3, D + 0.3, 0x9aa3a6, 0, 0.15, 0)];
  // gable roof: two slabs meeting at a ridge, with eaves
  const pitch = 0.42, slab = (D / 2 + 0.7) / Math.cos(pitch);
  for (const s of [-1, 1]) p.push(box(W + 0.8, 0.16, slab, roof, 0, H + Math.sin(pitch) * slab / 2 - 0.05, s * (D / 4 + 0.15), 0, s * -pitch, 0));
  p.push(box(W + 0.9, 0.2, 0.3, 0xdfe5e8, 0, H + Math.sin(pitch) * slab - 0.05, 0));
  // big roller door, a person door, windows, a loading dock along the front, an ice chute
  const fz = -D / 2 - 0.02;
  p.push(box(3.6, 3.2, 0.1, 0x3b6a8a, -1.2, 1.6, fz), box(3.9, 0.25, 0.14, trim, -1.2, 3.3, fz), box(1.1, 2.3, 0.1, 0xe0733f, 2.0, 1.15, fz));
  for (const x of [-5, 4.4, 5.6]) p.push(box(1.3, 1.1, 0.1, 0x2b4a5a, x, 2.3, fz), box(1.5, 0.12, 0.16, trim, x, 1.7, fz - 0.03));
  p.push(box(W + 0.4, 0.34, 1.5, 0xb7b2a6, 0, 0.17, fz - 0.8), box(1.0, 0.14, 2.4, 0x8d9aa3, 5.2, 3.0, fz - 1.1, 0, -0.5, 0));
  for (let i = 0; i < 4; i++) p.push(box(0.12, 1.0, 0.12, 0x6b4a30, -5.5 + i * 3.4, 0.9, fz - 1.4));      // dock posts
  return finish(p, 0.18);
}
function lighthouse() {
  // The breakwater lighthouse: a squat white tower with a red band, a gallery and a glassy lantern. ~13 m. Origin on the ground.
  const tower = [[2.4, 0], [2.3, 0.9], [1.95, 2.2], [1.8, 3.4]], band = [[1.8, 3.4], [1.75, 5.6]], upper = [[1.75, 5.6], [1.55, 8.2]];
  const lathe = (pts, hex) => part(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 14), hex);
  const p = [cyl(3.3, 3.6, 0.9, 0x8f8a80, 0, 0.45, 0, 14), lathe(tower, 0xfbf6ec), lathe(band, 0xd9503c), lathe(upper, 0xfbf6ec)];
  p.push(cyl(2.25, 2.0, 0.28, 0x6f7479, 0, 8.4, 0, 14), cyl(2.2, 2.2, 0.55, 0x8b9096, 0, 8.7, 0, 14));
  p.push(cyl(1.0, 1.0, 1.7, 0xffeaa8, 0, 9.75, 0, 12), cyl(0.2, 1.15, 0.7, 0xd9503c, 0, 11.0, 0, 12), ball(0.22, 0x34444c, 0, 11.5, 0));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(box(0.08, 1.7, 0.08, 0x34444c, Math.cos(a) * 1.01, 9.75, Math.sin(a) * 1.01)); }
  p.push(box(1.0, 1.5, 0.12, 0x34444c, 0, 1.7, 1.95));   // a door
  return finish(p, 0.2);
}
function quayWall() {
  // 4 m long, 3.4 m tall courses of stone blocks (the quay's face). Origin at the top edge (y = 0), the face toward -z.
  const p = [], cols = [0x9c968a, 0xa8a296, 0x8a847a, 0xb1ab9e], rows = 4, rh = 3.4 / rows;
  for (let r = 0; r < rows; r++) {
    const row = r % 2 ? [[-1.75, 0.5], [-1, 1], [0, 1], [1, 1], [1.75, 0.5]] : [[-1.5, 1], [-0.5, 1], [0.5, 1], [1.5, 1]];
    row.forEach(([cx, w], i) => p.push(box(w - 0.05, rh - 0.05, 0.9, cols[(r * 3 + i) % 4], cx, -rh * (r + 0.5), 0)));
  }
  p.push(box(4.0, 0.22, 1.1, 0xc2bcae, 0, -0.11, 0.05));   // the coping stone
  return finish(p, 0.2);
}

// ------------------------------------------------------------------ odds and ends
const crateStack = () => finish([
  box(0.62, 0.34, 0.42, 0x3d86c4, 0, 0.17, 0), box(0.62, 0.34, 0.42, 0xf0a63a, 0.05, 0.51, 0.02, 0.12), box(0.62, 0.34, 0.42, 0x3d86c4, -0.02, 0.85, -0.02, -0.1),
  box(0.62, 0.34, 0.42, 0xe8553d, 0.7, 0.17, 0.1, 0.3), box(0.62, 0.34, 0.42, 0x3d86c4, 0.7, 0.51, 0.12, 0.2)]);
const fishBin = () => finish([box(1.2, 0.8, 0.9, 0x3d86c4, 0, 0.4, 0), box(1.26, 0.1, 0.96, 0x2d6f9c, 0, 0.82, 0), box(1.0, 0.04, 0.7, 0xeaf4fa, 0, 0.7, 0)]);
const netPile = () => finish([ball(0.8, 0x4faa72, 0, 0.4, 0, 1.3, 0.55, 1), ball(0.55, 0x3e8f62, 0.6, 0.3, 0.3, 1, 0.6, 1), ball(0.4, 0x6fc08a, -0.5, 0.65, -0.1, 1, 0.7, 1), ball(0.16, 0xff8a3d, 0.9, 0.2, -0.4), ball(0.16, 0xff8a3d, -0.9, 0.2, 0.4)]);
const buoys = () => finish([ball(0.3, 0xff8a3d, 0, 0.3, 0), ball(0.28, 0xf2e8d0, 0.6, 0.28, 0.2), ball(0.3, 0xe8553d, 0.2, 0.3, 0.65), ball(0.26, 0xff8a3d, -0.5, 0.26, 0.4), cyl(0.04, 0.04, 0.3, 0x34444c, 0, 0.7, 0, 6)]);
const ropeCoil = () => finish([torus(0.45, 0.1, 0xd9c28a, 0, 0.1, 0, Math.PI / 2), torus(0.32, 0.1, 0xd9c28a, 0, 0.2, 0, Math.PI / 2), torus(0.2, 0.09, 0xd9c28a, 0, 0.3, 0, Math.PI / 2)]);
const bench = () => finish([box(1.8, 0.1, 0.5, 0xb88a58, 0, 0.5, 0), box(1.8, 0.4, 0.08, 0xa97b4b, 0, 0.8, -0.24), box(0.1, 0.5, 0.45, 0x34444c, -0.8, 0.25, 0), box(0.1, 0.5, 0.45, 0x34444c, 0.8, 0.25, 0)]);
const iceBox = () => finish([box(1.5, 1.0, 1.0, 0xf3f6f6, 0, 0.5, 0), box(1.56, 0.1, 1.06, 0x3d86c4, 0, 1.05, 0), box(0.5, 0.12, 0.08, 0x2d6f9c, 0.3, 0.7, 0.52)]);

export function buildHarbourModels() {
  const m = new Map();
  m.set('wharf_deck', wharfDeck()); m.set('wharf_pile', wharfPile()); m.set('bollard', bollard()); m.set('lamp_post', lampPost());
  m.set('trawler_blue', trawler()); m.set('trawler_red', trawler({ len: 12.5, beam: 3.8, stripe: 0xd9503c, roof: 0xd9503c, gear: 0x5a7fa6 }));
  m.set('trawler_green', trawler({ len: 9.5, beam: 3.2, stripe: 0x3e8f62, roof: 0x3e8f62, cabin: 0xfff3d2, gear: 0xd9503c }));
  m.set('coop', coop()); m.set('lighthouse', lighthouse()); m.set('quay_wall', quayWall());
  m.set('crate_stack', crateStack()); m.set('fish_bin', fishBin()); m.set('net_pile', netPile()); m.set('buoys', buoys()); m.set('rope_coil', ropeCoil()); m.set('bench', bench()); m.set('ice_box', iceBox());
  return m;
}
