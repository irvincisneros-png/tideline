// Procedural corals and invertebrates. Every generator returns a BufferGeometry with a
// 'color' attribute (vertex colours) in model space, base at y = 0.
import * as THREE from 'three';
import { globalUniforms } from '../ocean/shaders.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seg } from './lod.js';
import { makeNoise, mulberry32 } from '../core/noise.js';

const noise = makeNoise(7);
const _up = new THREE.Vector3(0, 1, 0);

function colorize(geo, fn) {
  const p = geo.attributes.position, n = p.count;
  const col = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(p, i);
    const c = fn(v, i);
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function strip(geo) {
  // Keep only attributes every generator shares so merges succeed.
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color'].includes(k)) geo.deleteAttribute(k);
  return geo.index ? geo.toNonIndexed() : geo;
}
/** Tapered tube from a to b. */
function tube(a, b, r0, r1, radial, colA, colB) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg(radial), 1, true);
  g.translate(0, len / 2, 0);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, dir));
  g.translate(a.x, a.y, a.z);
  colorize(g, (v) => { const t = Math.min(1, Math.max(0, new THREE.Vector3().subVectors(v, a).dot(dir) / len)); return [colA[0] + (colB[0] - colA[0]) * t, colA[1] + (colB[1] - colA[1]) * t, colA[2] + (colB[2] - colA[2]) * t]; });
  return strip(g);
}
function cap(p, r, col) {
  const g = new THREE.SphereGeometry(r, seg(7), seg(5, 2));
  g.translate(p.x, p.y, p.z);
  colorize(g, () => col);
  return strip(g);
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const STAG_PALETTES = [
  { base: [0.55, 0.42, 0.3], tip: [0.75, 0.82, 1.0] },   // brown with blue tips
  { base: [0.5, 0.36, 0.52], tip: [0.85, 0.7, 0.95] },   // purple
  { base: [0.62, 0.55, 0.32], tip: [0.95, 0.9, 0.55] },  // yellow-green
  { base: [0.45, 0.5, 0.42], tip: [0.75, 0.95, 0.85] },  // green
];
export function staghorn(seed, palette, opts = {}) {
  const rnd = mulberry32(seed);
  const parts = [];
  palette = palette ?? STAG_PALETTES[seed % STAG_PALETTES.length];
  const base = palette.base, tip = palette.tip;
  const r0 = opts.radius ?? 0.045, depthMax = opts.depth ?? 4, len0 = opts.len ?? 0.22;
  const grow = (p, dir, len, rad, depth, t0) => {
    const end = p.clone().addScaledVector(dir, len);
    const t1 = Math.min(1, t0 + 0.22);
    const last = depth <= 0 || end.y > 0.9;
    // Living Acropora tips (axial corallites) are paler and thinner than the older branch below.
    parts.push(tube(p, end, rad, rad * (last ? 0.62 : 0.78), 6, lerp3(base, tip, t0 * 0.55), last ? tip : lerp3(base, tip, t1 * 0.55)));
    if (last) { parts.push(cap(end, rad * 0.6, tip)); return; }
    const n = rnd() < 0.55 ? 2 : 1;
    for (let i = 0; i < n + (depth > 2 ? 1 : 0); i++) {
      const nd = dir.clone();
      const ang = 0.35 + rnd() * 0.5;
      const axis = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize();
      nd.applyAxisAngle(axis, ang * (i === 0 ? 0.4 : 1));
      nd.y = Math.max(nd.y, 0.15); nd.normalize();
      grow(end, nd, len * (0.75 + rnd() * 0.3), rad * 0.78, depth - 1, t1);
    }
  };
  const stems = (opts.stems ?? 5) + Math.floor(rnd() * 3);
  for (let i = 0; i < stems; i++) {
    const a = (i / stems) * Math.PI * 2 + rnd();
    const spread = opts.spread ?? 0.6;
    const d = new THREE.Vector3(Math.cos(a) * spread, 0.8, Math.sin(a) * spread).normalize();
    grow(new THREE.Vector3(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05), d, len0 * (0.9 + rnd() * 0.4), r0, depthMax, 0);
  }
  return mergeGeometries(parts);
}

/** Bushy corymbose Acropora: short dense branches, bright tips. */
export function bushCoral(seed) {
  const pals = [{ base: [0.6, 0.35, 0.5], tip: [1.0, 0.6, 0.85] }, { base: [0.55, 0.5, 0.3], tip: [0.95, 0.95, 0.6] }, { base: [0.35, 0.45, 0.55], tip: [0.6, 0.85, 1.0] }];
  return staghorn(seed, pals[seed % pals.length], { radius: 0.03, depth: 3, len: 0.12, stems: 9, spread: 1.4 });
}

/** Foliose plate coral (Montipora/Turbinaria-like): stacked, scrolling plates. */
export function plateCoral(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const pal = [[0.55, 0.42, 0.3], [0.4, 0.5, 0.35], [0.62, 0.5, 0.42]][seed % 3];
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const R = 0.25 + rnd() * 0.25, tilt = 0.25 + rnd() * 0.4, ang = rnd() * Math.PI * 2;
    const g = plate(R, seed + i * 7, (r, th, f) => 0.03 * Math.sin(th * 3 + i) * f + f * f * 0.05, 0.025,
      (f, th, side) => side ? pal.map(c => c * 0.7) : pal.map(c => c * (0.85 + 0.25 * Math.pow(f, 3))), 6, 28);
    g.rotateZ(tilt); g.rotateY(ang);
    g.translate(Math.cos(ang) * 0.15, 0.08 + i * 0.09, Math.sin(ang) * 0.15);
    parts.push(g);
  }
  return mergeGeometries(parts);
}

/** Barrel sponge: thick tube with an open top. */
export function barrelSponge(seed) {
  const rnd = mulberry32(seed);
  const pts = [];
  const H = 0.6 + rnd() * 0.5;
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(0.18 + 0.2 * Math.sin(t * 2.4) + (t > 0.92 ? -0.06 : 0), t * H)); }
  pts.push(new THREE.Vector2(0.12, H * 0.96));
  let g = new THREE.LatheGeometry(pts, seg(26, 8));
  g.deleteAttribute('uv');
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x); const rib = 1 + 0.06 * Math.abs(Math.sin(a * 9)); p.setXYZ(i, v.x * rib, v.y, v.z * rib); }
  g.computeVertexNormals();
  const col = rnd() < 0.5 ? [0.55, 0.3, 0.25] : [0.6, 0.45, 0.35];
  colorize(g, (pt) => col.map(c => c * (0.8 + 0.3 * (pt.y / H))));
  return strip(g);
}

/** Soft coral tree (Dendronephthya-like): translucent stalk with bright polyp clusters. */
export function softTree(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const pals = [[[0.95, 0.4, 0.6], [1.0, 0.75, 0.85]], [[0.95, 0.6, 0.2], [1.0, 0.85, 0.4]], [[0.7, 0.4, 0.9], [0.95, 0.75, 1.0]]];
  const [c0, c1] = pals[seed % pals.length];
  const grow = (p, dir, len, rad, depth) => {
    const end = p.clone().addScaledVector(dir, len);
    parts.push(tube(p, end, rad, rad * 0.75, 5, [0.9, 0.85, 0.85], c0));
    if (depth <= 0) { parts.push(cap(end, rad * 2.2, c1)); return; }
    for (let i = 0; i < 3; i++) {
      const nd = dir.clone().applyAxisAngle(new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize(), 0.5 + rnd() * 0.4).normalize();
      grow(end, nd, len * 0.7, rad * 0.7, depth - 1);
    }
  };
  grow(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.22, 0.05, 3);
  return mergeGeometries(parts);
}

/** Polar plate surface helper (top + underside + rim). heightFn(r, theta) gives the top surface. */
function plate(R, rad, heightFn, thick, colFn, rings = 9, segs = 44) {
  rings = seg(rings, 4); segs = seg(segs, 12);
  const pos = [], col = [], idx = [];
  const rOut = th => R * (1 + 0.13 * noise.n2(Math.cos(th) * 1.5 + rad, Math.sin(th) * 1.5) + 0.025 * noise.n2(Math.cos(th) * 9 + rad, Math.sin(th) * 9));
  for (let side = 0; side < 2; side++) {
    const off = pos.length / 3;
    for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) {
      const th = (j / segs) * Math.PI * 2, f = i / rings;
      const r = rOut(th) * f;
      const y = heightFn(r, th, f) - (side ? thick * (1 - f * 0.7) : 0);
      pos.push(Math.cos(th) * r, y, Math.sin(th) * r);
      const c = colFn(f, th, side);
      col.push(c[0], c[1], c[2]);
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
      const a = off + i * (segs + 1) + j, b = a + segs + 1;
      if (side === 0) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  // Rim
  const top0 = rings * (segs + 1), bot0 = (rings + 1) * (segs + 1) + rings * (segs + 1);
  for (let j = 0; j < segs; j++) {
    const a = top0 + j, b = bot0 + j;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return strip(g);
}

// Table Acropora (A. hyacinthus / cytherea): flat-topped colony on a short stalk. The top is a dense mat of tiny
// upright branchlets (speckled), brown/green with a paler cream or blue growing margin that turns up slightly.
const TABLE_PALETTES = [
  { base: [0.42, 0.34, 0.2], edge: [0.86, 0.8, 0.62] },  // brown, cream edge
  { base: [0.34, 0.4, 0.24], edge: [0.78, 0.84, 0.66] }, // olive green
  { base: [0.4, 0.38, 0.3], edge: [0.66, 0.78, 0.9] },   // grey-brown, blue edge
];
export function tableCoral(seed) {
  const rnd = mulberry32(seed);
  const R = 0.7 + rnd() * 0.5, stalk = 0.3 + rnd() * 0.15;
  const { base, edge } = TABLE_PALETTES[seed % TABLE_PALETTES.length];
  const speck = (r, th) => noise.n2(r * 40 + seed, th * 60) * 0.5 + noise.n2(r * 13, th * 17 + seed) * 0.5;
  const top = plate(R, seed, (r, th, f) => stalk + 0.08 * f * f + 0.09 * Math.pow(f, 7) + 0.008 * speck(r, th) + noise.n2(r * 3 + seed, th) * 0.03, 0.05,
    (f, th, side) => {
      if (side) return [0.3, 0.26, 0.2];
      const k = 0.78 + 0.32 * speck(f * R, th);
      return lerp3(base, edge, Math.pow(f, 6)).map(v => v * k);
    }, 14, 72);
  const s = new THREE.CylinderGeometry(0.06, 0.12, stalk, 8, 1);
  s.translate(0, stalk / 2, 0);
  colorize(s, () => [0.36, 0.32, 0.25]);
  return mergeGeometries([top, strip(s)]);
}

export function brainCoral(seed) {
  const rnd = mulberry32(seed);
  let g = new THREE.SphereGeometry(0.5, seg(72, 12), seg(36, 6), 0, Math.PI * 2, 0, Math.PI * 0.55);
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  const ridge = new Float32Array(p.count);
  const s = seed * 0.37;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    // Meandering valleys: ridged noise on the sphere.
    const r = noise.ridged3(n.x * 4 + s, n.y * 4, n.z * 4 + s, 2);
    ridge[i] = r;
    const lump = 1 + noise.fbm3(n.x * 1.5 + s, n.y * 1.5, n.z * 1.5, 3) * 0.15;
    v.copy(n).multiplyScalar(0.5 * lump * (1 + (r - 0.7) * 0.07));
    v.y = v.y * 0.75 - 0.08;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const hue = rnd();
  const ridgeCol = hue < 0.5 ? [0.62, 0.6, 0.38] : [0.55, 0.45, 0.5];
  const valCol = hue < 0.5 ? [0.25, 0.32, 0.18] : [0.3, 0.38, 0.28];
  colorize(g, (pt, i) => lerp3(valCol, ridgeCol, Math.pow(Math.max(0, (ridge[i] - 0.55) / 0.45), 1.5)));
  return strip(g);
}

export function porites(seed) {
  const rnd = mulberry32(seed);
  let g = new THREE.IcosahedronGeometry(1, seg(14, 3));
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  const s = seed * 0.71;
  const knob = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const big = noise.fbm3(v.x * 1.2 + s, v.y * 1.2, v.z * 1.2 + s, 3);
    const k = noise.n3(v.x * 9 + s, v.y * 9, v.z * 9);
    const fine = 1 - Math.abs(noise.n3(v.x * 26 + s, v.y * 26, v.z * 26));
    knob[i] = k * 0.6 + fine * 0.4;
    const r = 0.9 * (1 + big * 0.45 + k * 0.06 + fine * 0.025);
    v.multiplyScalar(r);
    v.y = Math.max(v.y * 0.8, -0.15) + 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const pal = [[0.62, 0.52, 0.36], [0.5, 0.4, 0.45], [0.48, 0.5, 0.32], [0.66, 0.58, 0.42]][Math.floor(rnd() * 4)];
  colorize(g, (pt, i) => pal.map(c => c * (0.85 + knob[i] * 0.3)));
  return strip(g);
}

export function leatherCoral(seed) {
  const rnd = mulberry32(seed);
  const R = 0.35 + rnd() * 0.15, stalk = 0.22 + rnd() * 0.1;
  const pal = rnd() < 0.5 ? [0.8, 0.75, 0.55] : [0.72, 0.68, 0.48];
  const capG = plate(R, seed + 3, (r, th, f) => stalk + 0.05 * Math.sin(th * 7 + seed) * f * f + 0.02 * f - 0.04 * f * f * f, 0.04,
    (f, th, side) => side ? pal.map(c => c * 0.75) : pal.map(c => c * (0.9 + 0.12 * Math.sin(th * 50 + f * 20))), 7, 36);
  const s = new THREE.CylinderGeometry(R * 0.35, R * 0.28, stalk, 10, 2);
  s.translate(0, stalk / 2, 0);
  colorize(s, () => pal.map(c => c * 0.85));
  return mergeGeometries([capG, strip(s)]);
}

export function seaFan(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const pts = [];
  const col0 = [0.7, 0.18, 0.12], col1 = [0.95, 0.42, 0.2];
  const grow = (p, ang, len, rad, depth) => {
    const end = new THREE.Vector3(p.x + Math.sin(ang) * len, p.y + Math.cos(ang) * len, (rnd() - 0.5) * 0.02);
    parts.push(tube(p, end, rad, rad * 0.8, 3, col0, col1));
    pts.push(end);
    if (depth <= 0) return;
    const spread = 0.35 + rnd() * 0.25;
    grow(end, ang - spread * rnd(), len * 0.82, rad * 0.75, depth - 1);
    grow(end, ang + spread * rnd(), len * 0.82, rad * 0.75, depth - 1);
  };
  const trunk = new THREE.Vector3(0, 0.15, 0);
  parts.push(tube(new THREE.Vector3(), trunk, 0.035, 0.03, 4, col0, col0));
  for (let i = 0; i < 3; i++) grow(trunk, (i - 1) * 0.6, 0.28, 0.022, 5);
  // Reticulation: link nearby branch points into the lacy mesh typical of Annella.
  for (let i = 0; i < pts.length; i += 2) for (let j = i + 1; j < Math.min(pts.length, i + 12); j++) {
    const d = pts[i].distanceTo(pts[j]);
    if (d > 0.04 && d < 0.13) parts.push(tube(pts[i], pts[j], 0.005, 0.005, 3, col1, col1));
  }
  return mergeGeometries(parts);
}

export function anemone(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const column = new THREE.CylinderGeometry(0.34, 0.28, 0.14, 24, 1);
  column.translate(0, 0.07, 0);
  colorize(column, () => [0.6, 0.06, 0.22]);
  parts.push(strip(column));
  const disc = new THREE.CircleGeometry(0.34, 24); disc.rotateX(-Math.PI / 2); disc.translate(0, 0.14, 0);
  colorize(disc, () => [0.5, 0.45, 0.25]);
  parts.push(strip(disc));
  const tentBase = [0.62, 0.6, 0.32], tentMid = [0.7, 0.82, 0.4], tentTip = [0.85, 0.95, 0.55];
  const n = 340;
  for (let i = 0; i < n; i++) {
    const r = 0.34 * Math.sqrt(0.05 + 0.95 * rnd());
    const a = rnd() * Math.PI * 2;
    const p0 = new THREE.Vector3(Math.cos(a) * r, 0.14, Math.sin(a) * r);
    const outward = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const len = 0.09 + rnd() * 0.08;
    // Two-segment tentacle curving outward, tapering to a rounded tip.
    const d1 = outward.clone().multiplyScalar(0.25 + r).add(new THREE.Vector3(0, 1, 0)).normalize();
    const p1 = p0.clone().addScaledVector(d1, len * 0.55);
    const d2 = outward.clone().multiplyScalar(0.9 + r * 1.5).add(new THREE.Vector3((rnd() - 0.5) * 0.4, 0.7, (rnd() - 0.5) * 0.4)).normalize();
    const p2 = p1.clone().addScaledVector(d2, len * 0.5);
    parts.push(tube(p0, p1, 0.017, 0.014, 5, tentBase, tentMid));
    parts.push(tube(p1, p2, 0.014, 0.009, 5, tentMid, tentTip));
    parts.push(cap(p2, 0.009, tentTip));
  }
  return mergeGeometries(parts);
}

export function cots(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const disc = new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  disc.scale(1, 0.45, 1);
  colorize(disc, () => [0.42, 0.25, 0.4]);
  parts.push(strip(disc));
  const arms = 14 + Math.floor(rnd() * 4);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), -0.15, Math.sin(a)).normalize();
    const p0 = new THREE.Vector3(Math.cos(a) * 0.08, 0.04, Math.sin(a) * 0.08);
    const p1 = p0.clone().addScaledVector(dir, 0.17);
    parts.push(tube(p0, p1, 0.035, 0.012, 5, [0.45, 0.28, 0.42], [0.6, 0.3, 0.32]));
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      const sp = p0.clone().lerp(p1, t);
      const sd = new THREE.Vector3((rnd() - 0.5) * 0.6, 1, (rnd() - 0.5) * 0.6).add(dir.clone().multiplyScalar(0.3)).normalize();
      parts.push(tube(sp, sp.clone().addScaledVector(sd, 0.05 - t * 0.02), 0.006, 0.001, 3, [0.7, 0.55, 0.6], [0.95, 0.35, 0.3]));
    }
  }
  for (let k = 0; k < 30; k++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.1;
    const sp = new THREE.Vector3(Math.cos(a) * r, 0.05, Math.sin(a) * r);
    parts.push(tube(sp, sp.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.02, 0.045, (rnd() - 0.5) * 0.02)), 0.006, 0.001, 3, [0.7, 0.55, 0.6], [0.95, 0.35, 0.3]));
  }
  return mergeGeometries(parts);
}

export function seaCucumber(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const body = new THREE.CapsuleGeometry(0.07, 0.42, 6, 14);
  body.rotateZ(Math.PI / 2);
  body.scale(1, 0.8, 1.15);
  body.translate(0, 0.06, 0);
  colorize(body, (v) => v.y < 0.02 ? [0.85, 0.55, 0.4] : [0.8, 0.22, 0.1]);
  parts.push(strip(body));
  // Star-shaped papillae of the prickly redfish.
  for (let i = 0; i < 60; i++) {
    const x = (rnd() - 0.5) * 0.48, a = rnd() * Math.PI - Math.PI / 2;
    const p = new THREE.Vector3(x, 0.06 + Math.cos(a) * 0.055, Math.sin(a) * 0.075);
    const dir = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
    for (let k = 0; k < 3; k++) {
      const d = dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.8, 0, (rnd() - 0.5) * 0.8)).normalize();
      parts.push(tube(p, p.clone().addScaledVector(d, 0.03), 0.008, 0.002, 3, [0.85, 0.3, 0.12], [0.95, 0.55, 0.3]));
    }
  }
  return mergeGeometries(parts);
}

/** Rubble / rock lumps for filling gaps. */
export function rock(seed) {
  let g = new THREE.IcosahedronGeometry(0.5, seg(8, 2));
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    v.multiplyScalar(0.5 * (1 + noise.fbm3(v.x * 2 + seed, v.y * 2, v.z * 2, 3) * 0.5 + noise.n3(v.x * 14, v.y * 14 + seed, v.z * 14) * 0.04));
    v.y = Math.max(v.y * 0.6, -0.1) + 0.1;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  colorize(g, (pt) => { const n = noise.n3(pt.x * 6 + seed, pt.y * 6, pt.z * 6); return n > 0.1 ? [0.6, 0.38, 0.48] : [0.42, 0.4, 0.32]; });
  return strip(g);
}

/** Turtle as a small rig: returns { group, flippers: {fl, fr, rl, rr}, head } */
export function turtle(seed = 1, colors = {}) {
  const group = new THREE.Group();
  // Carapace texture: polygonal scutes with radiating streaks.
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(256, 256);
  const rnd = mulberry32(seed);
  const cells = Array.from({ length: 13 }, (_, i) => [(i % 5) / 5 + 0.1 + rnd() * 0.05, Math.floor(i / 5) / 3 + 0.15 + rnd() * 0.05]);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = x / 256, v = y / 256;
    let d1 = 9, d2 = 9, best = 0;
    cells.forEach(([cx, cy], k) => { const d = Math.hypot((u - cx) * 1.3, v - cy); if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d; });
    const edge = d2 - d1 < 0.012;
    const ang = Math.atan2(v - cells[best][1], u - cells[best][0]);
    const streak = 0.8 + 0.25 * Math.sin(ang * 9 + best) * Math.min(1, d1 * 8);
    const sc = colors.shell ?? [0.38, 0.3, 0.16];
    const base = [sc[0] * streak, sc[1] * streak, sc[2] * streak];
    const col = edge ? [0.8, 0.72, 0.5] : base;
    const i = (y * 256 + x) * 4;
    img.data[i] = col[0] * 255; img.data[i + 1] = col[1] * 255; img.data[i + 2] = col[2] * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const shellMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  const skinMat = new THREE.MeshStandardMaterial({ color: colors.skin ?? 0x6f6a4a, roughness: 0.8 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xe8d8a0, roughness: 0.8 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
  shell.scale.set(0.95, 0.42, 0.72);
  const plastron = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), bellyMat);
  plastron.scale.set(0.9, 0.12, 0.66); plastron.rotation.x = Math.PI;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skinMat);
  head.scale.set(1.4, 0.9, 0.95); head.position.set(0.55, 0.02, 0);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
  const cosy = globalUniforms.uStyle.value > 0.5, er = cosy ? 0.034 : 0.022; // cosy look: bigger, friendlier eyes with a highlight
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(er, 12, 8), eyeMat); e.position.set(0.08, 0.035, (0.085 + (cosy ? 0.01 : 0)) * s); head.add(e);
    if (cosy) { const h = new THREE.Mesh(new THREE.SphereGeometry(er * 0.32, 8, 6), hlMat); h.position.set(0.08 + er * 0.4, 0.035 + er * 0.45, (0.085 + 0.01 + er * 0.75) * s); head.add(h); }
  }
  group.add(shell, plastron, head);
  const flip = (len, w) => { const g = new THREE.SphereGeometry(0.5, 16, 8); g.scale(w, 0.06, len); g.translate(0, 0, len * 0.45); return g; };
  const mk = (len, w, x, z, side) => {
    const pivot = new THREE.Group(); pivot.position.set(x, -0.02, z * side);
    const m = new THREE.Mesh(flip(len, w), skinMat); m.rotation.y = side > 0 ? -0.35 : Math.PI + 0.35;
    if (side < 0) m.scale.z = 1;
    pivot.add(m); group.add(pivot); return pivot;
  };
  const flippers = { fl: mk(0.6, 0.26, 0.22, 0.28, 1), fr: mk(0.6, 0.26, 0.22, 0.28, -1), rl: mk(0.24, 0.16, -0.32, 0.2, 1), rr: mk(0.24, 0.16, -0.32, 0.2, -1) };
  group.userData.materials = [shellMat, skinMat, bellyMat, eyeMat];
  return { group, flippers, head };
}

/** Giant clam rig: returns { group, valves:[l,r], mantle } */
export function giantClam(seed = 1) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const valveGeo = (() => {
    let g = new THREE.SphereGeometry(0.5, 40, 20, 0, Math.PI, 0, Math.PI);
    g.deleteAttribute('uv');
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const ang = Math.atan2(v.y + 0.5, v.x);
      const rib = 1 + 0.07 * Math.abs(Math.sin(ang * 5));
      p.setXYZ(i, v.x * rib, v.y * rib, v.z * 0.55 * rib);
    }
    g.computeVertexNormals();
    colorize(g, (pt) => { const a = Math.atan2(pt.y + 0.5, pt.x); return Math.sin(a * 5) > 0.6 ? [0.88, 0.85, 0.75] : [0.72, 0.7, 0.6]; });
    return g;
  })();
  const shellMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
  const valves = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(valveGeo, shellMat);
    m.scale.set(1, 0.7, 1);
    m.rotation.x = -Math.PI / 2; m.rotation.z = 0; // opening faces up
    if (s < 0) m.rotation.x = Math.PI / 2, m.rotation.y = Math.PI;
    pivot.add(m); pivot.position.y = 0.0; group.add(pivot); valves.push(pivot);
  }
  // Mantle with iridescent spots (zooxanthellae-rich tissue).
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const hue = rnd();
  ctx.fillStyle = hue < 0.4 ? '#1b4f8a' : hue < 0.7 ? '#2d6b3a' : '#5a3d7a'; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 220; i++) { ctx.fillStyle = `hsla(${180 + rnd() * 60},90%,${55 + rnd() * 25}%,0.8)`; ctx.beginPath(); ctx.arc(rnd() * 128, rnd() * 128, 1 + rnd() * 2.5, 0, 7); ctx.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const mantleMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, emissive: 0x0a2a3a, emissiveIntensity: 0.6 });
  const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 12), mantleMat);
  mantle.scale.set(1, 0.12, 0.42); mantle.position.y = 0.28;
  group.add(mantle);
  group.userData.materials = [shellMat, mantleMat];
  return { group, valves, mantle };
}
