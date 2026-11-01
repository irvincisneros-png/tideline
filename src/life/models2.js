// Extra procedural animals for the temperate, estuary, open-ocean and deep-sea ecosystems.
// Static-style generators return vertex-coloured BufferGeometry (base/centre at origin, facing +x).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';

const UP = new THREE.Vector3(0, 1, 0);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function colorize(geo, fn) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const c = fn(v, i); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function strip(geo) {
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
  return geo.index ? geo.toNonIndexed() : geo;
}
function tube(a, b, r0, r1, radial, colA, colB) {
  const len = Math.max(1e-4, a.distanceTo(b));
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
  g.translate(0, len / 2, 0);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
  g.translate(a.x, a.y, a.z);
  colorize(g, v => lerp3(colA, colB, Math.min(1, Math.max(0, new THREE.Vector3().subVectors(v, a).dot(dir) / len))));
  return strip(g);
}
function blob(r, sx, sy, sz, col, pos = [0, 0, 0], seg = 16) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2));
  g.scale(sx, sy, sz); g.translate(...pos);
  colorize(g, typeof col === 'function' ? col : () => col);
  return strip(g);
}
/** Smooth curved tube along points (radius per point). */
function chain(points, radii, colFn, radial = 6) {
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) parts.push(tube(points[i], points[i + 1], radii[i], radii[i + 1], radial, colFn(i / (points.length - 1)), colFn((i + 1) / (points.length - 1))));
  return parts;
}

/** Jellyfish: domed bell with frilly margin, oral arms and trailing tentacles. Bell top at y≈0. */
export function jellyfish(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const parts = [];
  const R = opts.radius ?? 0.18, col = opts.color ?? [0.75, 0.8, 0.95], rim = opts.rim ?? [0.9, 0.85, 1.0];
  const bell = new THREE.SphereGeometry(R, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  bell.scale(1, opts.dome ?? 0.65, 1);
  const p = bell.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x); const edge = 1 - v.y / (R * 0.65); p.setXYZ(i, v.x * (1 + 0.04 * Math.sin(a * 16) * edge), v.y, v.z * (1 + 0.04 * Math.sin(a * 16) * edge)); }
  bell.computeVertexNormals();
  colorize(bell, q => lerp3(rim, col, Math.min(1, q.y / (R * 0.5))));
  parts.push(strip(bell));
  if (opts.ring) parts.push(blob(R * 0.9, 1, 0.08, 1, opts.ring, [0, R * 0.05, 0], 20));
  const arms = opts.arms ?? 4;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + rnd();
    const pts = [], rad = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(new THREE.Vector3(Math.cos(a) * R * 0.2 * (1 + t), -t * R * (opts.armLen ?? 2.5), Math.sin(a) * R * 0.2 * (1 + t)).add(new THREE.Vector3(Math.sin(t * 6 + i) * 0.02, 0, Math.cos(t * 5 + i) * 0.02))); rad.push(R * 0.12 * (1 - t * 0.7)); }
    parts.push(...chain(pts, rad, t => lerp3(col, rim, t), 5));
  }
  const tents = opts.tentacles ?? 16;
  for (let i = 0; i < tents; i++) {
    const a = (i / tents) * Math.PI * 2;
    const pts = [], rad = [];
    const L = R * (opts.tentLen ?? 4) * (0.7 + rnd() * 0.6);
    for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push(new THREE.Vector3(Math.cos(a) * R * 0.95, -t * L, Math.sin(a) * R * 0.95).add(new THREE.Vector3(Math.sin(t * 5 + i) * 0.03, 0, Math.cos(t * 4 + i) * 0.03))); rad.push(0.004); }
    parts.push(...chain(pts, rad, () => rim, 3));
  }
  return mergeGeometries(parts);
}

/** Bluebottle (Physalia): gas float with a crest, blue trailing tentacles. Float centre at origin. */
export function bluebottle(seed) {
  const rnd = mulberry32(seed);
  const parts = [blob(0.06, 1.6, 0.8, 0.8, v => lerp3([0.35, 0.55, 0.95], [0.75, 0.6, 0.95], Math.max(0, v.y / 0.05)))];
  parts.push(blob(0.035, 2.2, 0.9, 0.25, [0.65, 0.5, 0.9], [0, 0.04, 0]));
  for (let i = 0; i < 6; i++) {
    const pts = [], rad = [];
    const L = 0.6 + rnd() * 1.4;
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new THREE.Vector3(-0.04 + (rnd() - 0.5) * 0.05, -t * L, (rnd() - 0.5) * 0.06 + Math.sin(t * 6 + i) * 0.03)); rad.push(0.004); }
    parts.push(...chain(pts, rad, () => [0.2, 0.35, 0.95], 3));
  }
  return mergeGeometries(parts);
}

/** Chain of salps: translucent barrels with orange gut nuclei. */
export function salpChain(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const n = 10 + Math.floor(rnd() * 8);
  for (let i = 0; i < n; i++) {
    const x = i * 0.05, y = Math.sin(i * 0.5) * 0.04, z = Math.cos(i * 0.4) * 0.03;
    const g = new THREE.CylinderGeometry(0.018, 0.022, 0.05, 10, 1);
    g.rotateZ(Math.PI / 2 + 0.3); g.translate(x, y, z);
    colorize(g, () => [0.75, 0.9, 0.95]); parts.push(strip(g));
    parts.push(blob(0.007, 1, 1, 1, [0.95, 0.5, 0.2], [x, y, z], 6));
  }
  return mergeGeometries(parts);
}

/** Seahorse (Hippocampus): upright S-curved body, snout, curled tail. Origin at the middle of the body. */
export function seahorse(seed, opts = {}) {
  const col = opts.color ?? [0.65, 0.5, 0.3], dark = opts.dark ?? [0.4, 0.3, 0.18];
  const parts = [];
  const body = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12;
    // From head (t=0, top) to tail tip (t=1, curled)
    const y = 0.07 - t * 0.14;
    const x = 0.02 * Math.sin(t * Math.PI * 1.2) + (t > 0.7 ? Math.sin((t - 0.7) / 0.3 * Math.PI) * 0.025 : 0);
    body.push(new THREE.Vector3(x, t > 0.85 ? y + (t - 0.85) * 0.25 : y, 0));
  }
  const radii = body.map((_, k) => { const t = k / 12; return 0.004 + 0.014 * Math.sin(Math.PI * Math.min(1, t * 1.6 + 0.12)); });
  parts.push(...chain(body, radii, t => (Math.sin(t * 40) > 0.5 ? dark : col), 8));
  // Head + snout
  parts.push(blob(0.012, 1.2, 1, 0.9, col, [0.008, 0.075, 0]));
  parts.push(tube(new THREE.Vector3(0.015, 0.075, 0), new THREE.Vector3(0.042, 0.068, 0), 0.005, 0.004, 6, col, dark));
  parts.push(blob(0.009, 0.4, 1.3, 0.4, col.map(c => c * 1.2), [-0.008, 0.035, 0]));
  return mergeGeometries(parts);
}

/** Weedy seadragon: long slim body with leafy appendages; origin at mid body, head +x. */
export function seadragon(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const pts = [], rad = [];
  for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(0.22 - t * 0.44, 0.03 * Math.sin(t * 5), 0)); rad.push(0.004 + 0.016 * Math.sin(Math.PI * Math.min(1, t * 1.3 + 0.1))); }
  const red = [0.75, 0.25, 0.2], yel = [0.95, 0.75, 0.25], purp = [0.45, 0.3, 0.6];
  parts.push(...chain(pts, rad, t => (Math.sin(t * 30) > 0.6 ? yel : t < 0.3 ? red : lerp3(red, purp, t)), 8));
  parts.push(tube(new THREE.Vector3(0.22, 0.01, 0), new THREE.Vector3(0.3, 0.0, 0), 0.006, 0.005, 6, red, yel));
  // Leafy appendages
  for (let i = 0; i < 9; i++) {
    const p = pts[2 + i];
    for (const s of [-1, 1]) {
      const d = new THREE.Vector3((rnd() - 0.5) * 0.3, s * 0.8, (rnd() - 0.5) * 0.5).normalize();
      const leaf = new THREE.CircleGeometry(0.012, 6); leaf.scale(1.8, 1, 1);
      leaf.lookAt(d); leaf.translate(p.x + d.x * 0.03, p.y + d.y * 0.03, p.z + d.z * 0.03);
      colorize(leaf, () => [0.65, 0.55, 0.25]);
      parts.push(strip(leaf));
      parts.push(tube(p, p.clone().addScaledVector(d, 0.025), 0.002, 0.002, 3, [0.6, 0.5, 0.25], [0.6, 0.5, 0.25]));
    }
  }
  return mergeGeometries(parts);
}

/** Crab: carapace, two claws, eight walking legs. Origin at body centre on the ground. */
export function crab(seed, opts = {}) {
  const col = opts.color ?? [0.25, 0.35, 0.55], legCol = opts.legs ?? col.map(c => c * 0.85);
  const S = opts.size ?? 0.12;
  const parts = [blob(S, 1.4, 0.45, 1, v => (v.y > 0 ? col : col.map(c => Math.min(1, c * 1.6 + 0.2))), [0, S * 0.5, 0])];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const base = new THREE.Vector3((i - 1.5) * S * 0.45, S * 0.5, s * S * 0.8);
      const knee = base.clone().add(new THREE.Vector3((i - 1.5) * S * 0.2, S * 0.35, s * S * 0.6));
      const foot = knee.clone().add(new THREE.Vector3((i - 1.5) * S * 0.2, -S * 0.85, s * S * 0.5));
      parts.push(tube(base, knee, S * 0.07, S * 0.06, 4, legCol, legCol), tube(knee, foot, S * 0.06, S * 0.03, 4, legCol, legCol));
    }
    const sh = new THREE.Vector3(S * 0.9, S * 0.5, s * S * 0.6);
    const el = sh.clone().add(new THREE.Vector3(S * 0.5, S * 0.2, s * S * 0.3));
    parts.push(tube(sh, el, S * 0.09, S * 0.08, 5, col, col));
    parts.push(blob(S * 0.28, 1.6, 0.8, 0.9, col.map(c => c * 1.1), [el.x + S * 0.3, el.y, el.z]));
  }
  return mergeGeometries(parts);
}

/** Octopus: mantle and eight curling arms spread on the rock. */
export function octopus(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const col = opts.color ?? [0.55, 0.4, 0.32];
  const parts = [blob(0.12, 1.1, 1.3, 1, v => col.map(c => c * (0.85 + 0.3 * Math.sin(v.x * 60) * Math.sin(v.y * 50))), [-0.05, 0.16, 0])];
  parts.push(blob(0.07, 1.2, 0.8, 1.1, col, [0.06, 0.06, 0]));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rnd() * 0.3;
    const pts = [], rad = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8, r = 0.05 + t * 0.35, curl = t > 0.6 ? (t - 0.6) * 4 : 0;
      pts.push(new THREE.Vector3(0.06 + Math.cos(a + curl) * r, 0.03 + Math.sin(t * Math.PI) * 0.03, Math.sin(a + curl) * r));
      rad.push(0.022 * (1 - t * 0.85));
    }
    parts.push(...chain(pts, rad, () => col, 6));
  }
  return mergeGeometries(parts);
}

/** Eastern rock lobster peering out of a crevice: carapace, tail and long antennae. */
export function rockLobster(seed) {
  const parts = [];
  const red = [0.65, 0.22, 0.15], pale = [0.85, 0.6, 0.4];
  parts.push(blob(0.08, 1.8, 0.8, 1, red, [0.05, 0.08, 0]));
  for (let i = 0; i < 5; i++) parts.push(blob(0.065 - i * 0.008, 1.1, 0.6, 1, i % 2 ? red : red.map(c => c * 0.85), [-0.1 - i * 0.07, 0.07 - i * 0.004, 0]));
  for (const s of [-1, 1]) {
    const b = new THREE.Vector3(0.18, 0.1, s * 0.03);
    parts.push(tube(b, b.clone().add(new THREE.Vector3(0.55, 0.25, s * 0.25)), 0.012, 0.002, 4, pale, pale));
    for (let i = 0; i < 4; i++) { const p = new THREE.Vector3(0.1 - i * 0.05, 0.05, s * 0.06); parts.push(tube(p, p.clone().add(new THREE.Vector3(0.02, -0.05, s * 0.1)), 0.008, 0.005, 3, red, pale)); }
  }
  return mergeGeometries(parts);
}

/** Sea hare: soft slug-like body with wing-like parapodia and rhinophores. */
export function seaHare(seed) {
  const parts = [blob(0.08, 1.8, 0.8, 0.9, v => [0.45 + 0.08 * Math.sin(v.x * 80), 0.35, 0.22], [0, 0.06, 0])];
  parts.push(tube(new THREE.Vector3(0.12, 0.08, 0.02), new THREE.Vector3(0.16, 0.13, 0.03), 0.008, 0.004, 4, [0.4, 0.3, 0.2], [0.4, 0.3, 0.2]));
  parts.push(tube(new THREE.Vector3(0.12, 0.08, -0.02), new THREE.Vector3(0.16, 0.13, -0.03), 0.008, 0.004, 4, [0.4, 0.3, 0.2], [0.4, 0.3, 0.2]));
  return mergeGeometries(parts);
}

/** Brittle star: small disc with five long thin arms. */
export function brittleStar(seed) {
  const rnd = mulberry32(seed);
  const parts = [blob(0.025, 1, 0.35, 1, [0.85, 0.55, 0.45])];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.2;
    const pts = [], rad = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6, c = Math.sin(t * 3 + i) * 0.4; pts.push(new THREE.Vector3(Math.cos(a + c * t) * (0.02 + t * 0.16), 0.005 + Math.sin(t * Math.PI) * 0.02, Math.sin(a + c * t) * (0.02 + t * 0.16))); rad.push(0.006 * (1 - t * 0.7)); }
    parts.push(...chain(pts, rad, () => [0.9, 0.6, 0.5], 4));
  }
  return mergeGeometries(parts);
}

/** Siphonophore: very long chain of translucent bells and stems. */
export function siphonophore(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  let p = new THREE.Vector3();
  for (let i = 0; i < 40; i++) {
    const n = p.clone().add(new THREE.Vector3(-0.12, Math.sin(i * 0.3) * 0.04, Math.cos(i * 0.25) * 0.04));
    parts.push(tube(p, n, 0.006, 0.006, 3, [0.9, 0.7, 0.75], [0.9, 0.7, 0.75]));
    if (i < 6) parts.push(blob(0.03, 1.2, 1, 1, [0.85, 0.9, 1.0], [p.x, p.y, p.z], 10));
    else if (i % 2) parts.push(blob(0.012, 1, 1.4, 1, [1.0, 0.6, 0.55], [p.x, p.y - 0.02, p.z], 6));
    p = n;
  }
  void rnd;
  return mergeGeometries(parts);
}

/** Comb jelly: translucent oval with eight comb rows (rainbow-coloured by the game shader). */
export function combJelly(seed) {
  const g = new THREE.SphereGeometry(0.06, 24, 16);
  g.scale(1, 1.5, 1);
  colorize(g, v => { const a = Math.atan2(v.z, v.x); const row = Math.abs(Math.sin(a * 4)) > 0.92; return row ? [0.95, 0.6, 0.9] : [0.75, 0.85, 0.95]; });
  return strip(g);
}

/** Giant isopod: armoured segmented body with short legs. */
export function isopod(seed) {
  const parts = [];
  const col = [0.75, 0.72, 0.62];
  for (let i = 0; i < 8; i++) parts.push(blob(0.07, 0.45, 0.45, 1.1 - Math.abs(i - 3.5) * 0.06, col.map(c => c * (i % 2 ? 0.92 : 1)), [0.2 - i * 0.055, 0.05, 0], 10));
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const b = new THREE.Vector3(0.15 - i * 0.06, 0.03, s * 0.06); parts.push(tube(b, b.clone().add(new THREE.Vector3(0, -0.04, s * 0.06)), 0.008, 0.005, 3, col, col)); }
  for (const s of [-1, 1]) parts.push(tube(new THREE.Vector3(0.22, 0.06, s * 0.02), new THREE.Vector3(0.32, 0.08, s * 0.08), 0.006, 0.003, 3, col, col));
  return mergeGeometries(parts);
}

/** Vampire squid: dark red mantle, fins and a web joining eight arms (pulses like a jelly). */
export function vampireSquid(seed) {
  const parts = [];
  const red = [0.45, 0.06, 0.08];
  parts.push(blob(0.07, 1.6, 1, 1, red, [-0.05, 0, 0]));
  for (const s of [-1, 1]) parts.push(blob(0.035, 1, 0.2, 1.4, red.map(c => c * 1.2), [-0.12, 0, s * 0.07]));
  const web = new THREE.ConeGeometry(0.11, 0.15, 16, 1, true); web.rotateZ(Math.PI / 2); web.translate(0.1, 0, 0);
  colorize(web, () => red.map(c => c * 0.7)); parts.push(strip(web));
  // Eyes (large, blue-ish)
  for (const s of [-1, 1]) parts.push(blob(0.016, 1, 1, 1, [0.5, 0.6, 0.85], [0.0, 0.03, s * 0.05], 8));
  return mergeGeometries(parts);
}

/** Small brown seabird body with wings (for the shearwater diving into bait balls). */
export function seabird(seed) {
  const parts = [blob(0.12, 1.6, 0.7, 0.75, v => (v.y > 0 ? [0.3, 0.25, 0.2] : [0.45, 0.4, 0.35]))];
  parts.push(blob(0.05, 1.2, 1, 1, [0.28, 0.24, 0.2], [0.2, 0.03, 0]));
  parts.push(tube(new THREE.Vector3(0.24, 0.03, 0), new THREE.Vector3(0.3, 0.02, 0), 0.01, 0.003, 4, [0.2, 0.2, 0.2], [0.2, 0.2, 0.2]));
  for (const s of [-1, 1]) {
    const w = new THREE.BufferGeometry();
    w.setAttribute('position', new THREE.Float32BufferAttribute([0.05, 0.02, s * 0.05, -0.08, 0.02, s * 0.05, -0.12, 0.0, s * 0.5], 3));
    w.computeVertexNormals(); colorize(w, () => [0.25, 0.22, 0.18]);
    parts.push(w);
  }
  return mergeGeometries(parts);
}

/** Simple dive boat hull + cabin (return point in open water). */
export function diveBoat() {
  const parts = [];
  const hull = new THREE.CylinderGeometry(1.4, 0.9, 1.0, 16, 1); hull.scale(4, 1, 1); hull.translate(0, 0.1, 0);
  colorize(hull, v => (v.y > 0.45 ? [0.9, 0.9, 0.88] : v.y > 0.1 ? [0.85, 0.2, 0.15] : [0.15, 0.2, 0.3]));
  parts.push(strip(hull));
  const cabin = new THREE.BoxGeometry(2.2, 1.2, 1.8); cabin.translate(0.8, 1.2, 0);
  colorize(cabin, () => [0.92, 0.92, 0.9]); parts.push(strip(cabin));
  const deck = new THREE.BoxGeometry(5.4, 0.08, 2.2); deck.translate(-0.4, 0.62, 0);
  colorize(deck, () => [0.6, 0.5, 0.38]); parts.push(strip(deck));
  return mergeGeometries(parts);
}
export { blob, tube, colorize, strip, chain };
