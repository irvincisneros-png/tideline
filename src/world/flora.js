// Procedural algae, seagrasses, mangroves and deep-sea habitat builders (vertex-coloured, base at y = 0).
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeNoise, mulberry32 } from '../core/noise.js';
import { seg } from './lod.js';

const noise = makeNoise(19);
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
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg(radial), 1, true);
  g.translate(0, len / 2, 0);
  const dir = new THREE.Vector3().subVectors(b, a).normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
  g.translate(a.x, a.y, a.z);
  colorize(g, v => lerp3(colA, colB, Math.min(1, Math.max(0, new THREE.Vector3().subVectors(v, a).dot(dir) / len))));
  return strip(g);
}
/** A flat ribbon following a curve: points[] centre-line, widths[] per point, facing normal. */
function ribbon(points, widths, side, colFn) {
  const pos = [], col = [], idx = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i], w = widths[i];
    const t = i / (points.length - 1);
    const a = p.clone().addScaledVector(side, -w / 2), b = p.clone().addScaledVector(side, w / 2);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const c = colFn(t); col.push(...c, ...c);
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return strip(g);
}

/**
 * A leafy blade along a curve, several vertices across so it can have a raised midrib and ruffled edges.
 * opts: across (verts across, odd), rib (midrib height, m), ruffle (edge wave amplitude, m), freq (edge waves per blade).
 */
function blade(points, widths, side, colFn, { across = 5, rib = 0.01, ruffle = 0.015, freq = 9, phase = 0 } = {}) {
  across = seg(across, 2);
  const pos = [], col = [], idx = [], n = new THREE.Vector3(), tan = new THREE.Vector3();
  for (let i = 0; i < points.length; i++) {
    const p = points[i], w = widths[i], t = i / (points.length - 1);
    tan.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]).normalize();
    n.crossVectors(side, tan).normalize();
    const c = colFn(t);
    for (let j = 0; j < across; j++) {
      const s = (j / (across - 1)) * 2 - 1; // -1..1 across the blade
      const lift = rib * (1 - Math.abs(s)) * (1 - t) + ruffle * s * s * Math.sin(t * freq * Math.PI + phase + s * 1.7) * Math.min(1, t * 4);
      const q = p.clone().addScaledVector(side, s * w / 2).addScaledVector(n, lift);
      pos.push(q.x, q.y, q.z);
      const edge = 0.82 + 0.18 * (1 - Math.abs(s)); // edges slightly darker, midrib lighter
      col.push(c[0] * edge, c[1] * edge, c[2] * edge);
      if (i && j) { const a = (i - 1) * across + j - 1, b = a + across; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return strip(g);
}

/** Golden kelp (Ecklonia radiata): stipe topped by a strap-like frond with lateral blades. */
export function kelp(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const H = 0.45 + rnd() * 0.4;
  const stipeTop = new THREE.Vector3((rnd() - 0.5) * 0.1, H, (rnd() - 0.5) * 0.1);
  parts.push(tube(new THREE.Vector3(), stipeTop, 0.022, 0.016, 5, [0.32, 0.22, 0.1], [0.45, 0.32, 0.12]));
  // Holdfast
  const hf = new THREE.SphereGeometry(0.07, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2); hf.scale(1.4, 0.6, 1.4);
  colorize(hf, () => [0.3, 0.22, 0.12]); parts.push(strip(hf));
  // Ecklonia is golden- to olive-brown (fucoxanthin), darker and leathery toward the base of each blade.
  const gold = [0.64, 0.45, 0.13], dark = [0.36, 0.24, 0.07];
  // Primary frond: blades fanning out from the stipe top, drooping.
  const blades = 11 + Math.floor(rnd() * 5);
  for (let b = 0; b < blades; b++) {
    const ang = rnd() * Math.PI * 2, len = 0.55 + rnd() * 0.45, rise = 0.15 + rnd() * 0.35;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const pts = [], ws = [];
    const N = seg(12, 4);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push(stipeTop.clone().addScaledVector(dir, t * len).add(new THREE.Vector3(0, Math.sin(t * Math.PI * 0.8) * rise * len - t * t * 0.15, 0)));
      ws.push(0.12 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.08)), 0.7) + 0.012);
    }
    const side = new THREE.Vector3().crossVectors(dir, UP).normalize();
    // Twist the blade so it isn't perfectly flat
    side.applyAxisAngle(dir, (rnd() - 0.5) * 0.8);
    const tone = 0.85 + rnd() * 0.3;
    parts.push(blade(pts, ws, side, t => lerp3(dark, gold, Math.min(1, 0.2 + t * 1.1)).map(c => c * tone * (0.92 + 0.12 * Math.sin(t * 23 + b))),
      { rib: 0.012, ruffle: 0.012 + rnd() * 0.01, freq: 7 + rnd() * 5, phase: rnd() * 6 }));
  }
  return mergeGeometries(parts);
}

/** Crayweed (Phyllospora comosa): tall, bushy strands with small leaflets. */
export function crayweed(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const strands = 4 + Math.floor(rnd() * 3);
  for (let s = 0; s < strands; s++) {
    const ang = rnd() * Math.PI * 2, H = 1.0 + rnd() * 0.8;
    const lean = new THREE.Vector3(Math.cos(ang) * 0.25, 1, Math.sin(ang) * 0.25).normalize();
    const pts = [], ws = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(lean.clone().multiplyScalar(t * H).add(new THREE.Vector3(Math.sin(t * 5 + s) * 0.05, 0, Math.cos(t * 4 + s) * 0.05))); ws.push(0.03); }
    const side = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang));
    parts.push(ribbon(pts, ws, side, t => lerp3([0.25, 0.2, 0.08], [0.45, 0.38, 0.12], t)));
    for (let i = 1; i < 12; i++) {
      const p = pts[i];
      const d = new THREE.Vector3(rnd() - 0.5, 0.3, rnd() - 0.5).normalize();
      parts.push(ribbon([p, p.clone().addScaledVector(d, 0.09)], [0.025, 0.006], new THREE.Vector3(-d.z, 0, d.x).normalize(), () => [0.5, 0.42, 0.14]));
    }
  }
  return mergeGeometries(parts);
}

/** Seagrass clump (Zostera): curved ribbon blades. */
export function seagrassClump(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const parts = [];
  const n = opts.blades ?? 14;
  const base = opts.base ?? [0.15, 0.3, 0.1], tip = opts.tip ?? [0.42, 0.6, 0.2];
  for (let b = 0; b < n; b++) {
    const ang = rnd() * Math.PI * 2, H = (opts.height ?? 0.4) * (0.6 + rnd() * 0.7);
    const spread = opts.spread ?? 0.06, rr = spread * Math.sqrt(rnd()), aa = rnd() * Math.PI * 2;
    const off = new THREE.Vector3(Math.cos(aa) * rr, 0, Math.sin(aa) * rr);
    const bend = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)).multiplyScalar(0.15 + rnd() * 0.25);
    const pts = [], ws = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(off.clone().add(new THREE.Vector3(bend.x * t * t * H, t * H * (1 - 0.15 * t), bend.z * t * t * H))); ws.push((opts.width ?? 0.008) * (1 - t * 0.4)); }
    const side = new THREE.Vector3(-Math.sin(ang + 1), 0, Math.cos(ang + 1));
    parts.push(ribbon(pts, ws, side, t => lerp3(base, tip, t).map(c => c * (0.85 + rnd() * 0.3))));
  }
  return mergeGeometries(parts);
}
/** Paddle weed (Halophila ovalis): pairs of oval leaves on short stalks, close to the sand. */
export function halophila(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 16; i++) {
    const x = (rnd() - 0.5) * 0.5, z = (rnd() - 0.5) * 0.5;
    for (const s of [-1, 1]) {
      const g = new THREE.CircleGeometry(0.018, 8); g.scale(1, 1.8, 1);
      g.rotateX(-Math.PI / 2 + 0.6 * s); g.translate(x + s * 0.012, 0.03, z);
      colorize(g, () => [0.25 + rnd() * 0.1, 0.45, 0.15]);
      parts.push(strip(g));
    }
  }
  return mergeGeometries(parts);
}

/** Grey mangrove (Avicennia marina): trunk rising above the water with a rounded canopy. */
export function mangroveTree(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const bark = [0.42, 0.38, 0.33], leaf = [0.22, 0.32, 0.18];
  const H = 3 + rnd() * 2;
  const top = new THREE.Vector3((rnd() - 0.5) * 0.6, H, (rnd() - 0.5) * 0.6);
  parts.push(tube(new THREE.Vector3(), top, 0.16, 0.09, 8, bark, bark));
  for (let b = 0; b < 5; b++) {
    const ang = rnd() * Math.PI * 2;
    const p0 = new THREE.Vector3().lerp(top, 0.55 + rnd() * 0.4);
    const p1 = p0.clone().add(new THREE.Vector3(Math.cos(ang) * 1.2, 0.8 + rnd(), Math.sin(ang) * 1.2));
    parts.push(tube(p0, p1, 0.07, 0.04, 6, bark, bark));
    for (let k = 0; k < 4; k++) {
      // Leaf cluster: many small leaves (glossy green on top, grey-green underneath like Avicennia).
      const c = new THREE.Vector3(p1.x + (rnd() - 0.5) * 1.2, p1.y + (rnd() - 0.3) * 0.6, p1.z + (rnd() - 0.5) * 1.2);
      const R = 0.6 + rnd() * 0.5;
      const pos = [], col = [];
      for (let l = 0; l < 110; l++) {
        const d = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.5) * 0.7, rnd() - 0.5).normalize().multiplyScalar(R * Math.cbrt(rnd()));
        const ctr = c.clone().add(d);
        const ax = new THREE.Vector3(rnd() - 0.5, rnd() * 0.4, rnd() - 0.5).normalize().multiplyScalar(0.09);
        const sd = new THREE.Vector3().crossVectors(ax, new THREE.Vector3(rnd() - 0.5, 1, rnd() - 0.5)).normalize().multiplyScalar(0.035);
        const q = [ctr.clone().sub(ax), ctr.clone().add(sd), ctr.clone().add(ax), ctr.clone().sub(sd)];
        for (const i of [0, 1, 2, 0, 2, 3]) pos.push(q[i].x, q[i].y, q[i].z);
        const shade = 0.75 + rnd() * 0.4, grey = rnd() < 0.3;
        const lc = grey ? [0.45 * shade, 0.5 * shade, 0.42 * shade] : leaf.map(v => v * shade * (d.y > 0 ? 1.15 : 0.8));
        for (let i = 0; i < 6; i++) col.push(...lc);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      parts.push(g);
    }
  }
  return mergeGeometries(parts);
}
/** Pneumatophores: pencil-like breathing roots poking up from the mud. */
export function pneumatophores(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 1.6, z = (rnd() - 0.5) * 1.6, h = 0.12 + rnd() * 0.25;
    parts.push(tube(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + (rnd() - 0.5) * 0.03, h, z), 0.012, 0.008, 4, [0.3, 0.27, 0.22], [0.5, 0.45, 0.38]));
  }
  return mergeGeometries(parts);
}

/** Barrel/vase sponge used in temperate sponge gardens and deep glass-sponge fields. */
export function vaseSponge(seed, opts = {}) {
  const rnd = mulberry32(seed);
  const pts = [];
  const H = (opts.height ?? 0.5) * (0.7 + rnd() * 0.6);
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.05 + (opts.flare ?? 0.18) * Math.pow(t, 0.8) + 0.02 * Math.sin(t * 9), t * H)); }
  pts.push(new THREE.Vector2(pts[10].x * 0.85, H * 0.97));
  let g = new THREE.LatheGeometry(pts, seg(20, 8));
  g.deleteAttribute('uv');
  const col = opts.colors ? opts.colors[seed % opts.colors.length] : [0.85, 0.55, 0.2];
  colorize(g, v => col.map(c => c * (0.75 + 0.35 * (v.y / H))));
  return strip(g);
}
/** Finger sponge: a few upright lobes. */
export function fingerSponge(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const cols = [[0.95, 0.75, 0.2], [0.85, 0.35, 0.25], [0.6, 0.3, 0.6]];
  const c = cols[seed % cols.length];
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2, x = Math.cos(a) * 0.06, z = Math.sin(a) * 0.06;
    parts.push(tube(new THREE.Vector3(x, 0, z), new THREE.Vector3(x * 3, 0.25 + rnd() * 0.25, z * 3), 0.035, 0.03, 6, c, c.map(v => v * 1.1)));
  }
  return mergeGeometries(parts);
}

/** Deep-sea scleractinian reef (Solenosmilia): dense white-pink bushy branching thicket. */
export function deepCoral(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const base = [0.85, 0.75, 0.72], tip = [1.0, 0.92, 0.9];
  const grow = (p, dir, len, rad, depth) => {
    const end = p.clone().addScaledVector(dir, len);
    parts.push(tube(p, end, rad, rad * 0.85, 4, base, tip));
    if (depth <= 0) return;
    for (let i = 0; i < 2; i++) {
      const nd = dir.clone().applyAxisAngle(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), 0.5 + rnd() * 0.5).normalize();
      if (nd.y < 0.1) nd.y = 0.1;
      grow(end, nd.normalize(), len * 0.85, rad * 0.85, depth - 1);
    }
  };
  for (let i = 0; i < 6; i++) { const a = rnd() * Math.PI * 2; grow(new THREE.Vector3(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1), new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize(), 0.12, 0.018, 5); }
  return mergeGeometries(parts);
}
/** Bamboo coral: tall whip with segmented white/dark joints and fine side branches. */
export function bambooCoral(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  let p = new THREE.Vector3(), dir = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 14; i++) {
    const next = p.clone().addScaledVector(dir, 0.12);
    parts.push(tube(p, next, 0.02, 0.018, 5, i % 2 ? [0.25, 0.18, 0.12] : [0.92, 0.9, 0.85], i % 2 ? [0.25, 0.18, 0.12] : [0.92, 0.9, 0.85]));
    if (i > 3 && i % 2 === 0) for (const s of [-1, 1]) {
      const d = new THREE.Vector3(s * 0.8, 0.7, (rnd() - 0.5) * 0.4).normalize();
      parts.push(tube(next, next.clone().addScaledVector(d, 0.25 + rnd() * 0.2), 0.008, 0.004, 3, [0.9, 0.88, 0.82], [0.95, 0.75, 0.6]));
    }
    p = next; dir.add(new THREE.Vector3((rnd() - 0.5) * 0.15, 0, (rnd() - 0.5) * 0.15)).normalize();
  }
  return mergeGeometries(parts);
}
/** Glass sponge: tall translucent-looking vase with lattice ridges. */
export function glassSponge(seed) {
  return vaseSponge(seed, { height: 0.9, flare: 0.12, colors: [[0.85, 0.85, 0.78], [0.8, 0.82, 0.75]] });
}

/** Cunjevoi (Pyura): clumps of leathery barrel-shaped sea squirts. */
export function cunjevoi(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.CylinderGeometry(0.06, 0.07, 0.16, 10, 2);
    g.translate((rnd() - 0.5) * 0.3, 0.08, (rnd() - 0.5) * 0.3);
    colorize(g, v => v.y > 0.14 ? [0.55, 0.3, 0.25] : [0.35, 0.3, 0.22]);
    parts.push(strip(g));
  }
  return mergeGeometries(parts);
}
/** Long-spined sea urchin. */
export function urchin(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const body = new THREE.SphereGeometry(0.06, 12, 8); body.scale(1, 0.7, 1); body.translate(0, 0.04, 0);
  colorize(body, () => [0.12, 0.08, 0.12]); parts.push(strip(body));
  for (let i = 0; i < 70; i++) {
    const d = new THREE.Vector3(rnd() - 0.5, rnd() * 0.9 + 0.05, rnd() - 0.5).normalize();
    const p0 = d.clone().multiplyScalar(0.055).add(new THREE.Vector3(0, 0.04, 0));
    parts.push(tube(p0, p0.clone().addScaledVector(d, 0.14 + rnd() * 0.08), 0.004, 0.001, 3, [0.15, 0.08, 0.18], [0.3, 0.12, 0.35]));
  }
  return mergeGeometries(parts);
}
/** Blacklip abalone: low ear-shaped shell. */
export function abalone(seed) {
  const g = new THREE.SphereGeometry(0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1.4, 0.45, 1);
  colorize(g, v => { const r = Math.hypot(v.x, v.z); return Math.sin(r * 120) > 0.3 ? [0.45, 0.4, 0.32] : [0.3, 0.32, 0.25]; });
  return strip(g);
}

// ---------------------------------------------------------------- beach, dune and rock-platform plants
// (Illawarra coast, NSW.) Base at y = 0, metres.

/** A thin leaf: a pointed blade along a gentle arc (2 triangles per segment). */
function leaf(base, dir, up, len, width, n, col, droop = 0.3) {
  const pts = [], ws = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(base.clone().addScaledVector(dir, t * len).addScaledVector(up, -droop * len * t * t));
    ws.push(width * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95)) + width * 0.05);
  }
  let side = new THREE.Vector3().crossVectors(dir, up);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  return ribbon(pts, ws, side.normalize(), typeof col === 'function' ? col : () => col);
}

/** Beach spinifex (Spinifex sericeus): silvery, hairy grass tussocks on long runners, the foredune's sand-binder. */
export function spinifex(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const silver = [0.66, 0.7, 0.6], green = [0.42, 0.5, 0.36];
  const tufts = 8 + Math.floor(rnd() * 5);
  for (let k = 0; k < tufts; k++) {
    const c = new THREE.Vector3((rnd() - 0.5) * 2.8, 0, (rnd() - 0.5) * 2.8);
    const blades = seg(11, 4);
    for (let i = 0; i < blades; i++) {
      const a = rnd() * Math.PI * 2, lean = 0.7 + rnd() * 1.1; // splayed, half-prostrate leaves form a low mat
      const dir = new THREE.Vector3(Math.cos(a) * lean, 1, Math.sin(a) * lean).normalize();
      const tone = 0.85 + rnd() * 0.25;
      parts.push(leaf(c, dir, UP, 0.25 + rnd() * 0.25, 0.014, seg(3, 2), t => lerp3(green, silver, t).map(v => v * tone), 0.45));
    }
    // Female seed heads: spiky balls that roll along the beach in the wind.
    if (rnd() < 0.35) {
      const h = c.clone().add(new THREE.Vector3(0, 0.25 + rnd() * 0.15, 0));
      for (let s = 0; s < seg(12, 5); s++) {
        const d = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        parts.push(tube(h, h.clone().addScaledVector(d, 0.1), 0.004, 0.001, 3, [0.72, 0.68, 0.5], [0.8, 0.76, 0.6]));
      }
    }
  }
  // Runners: stolons creeping across the sand between tussocks.
  for (let r = 0; r < 3; r++) {
    const a = rnd() * Math.PI * 2, L = 0.8 + rnd() * 0.8;
    const p0 = new THREE.Vector3(0, 0.01, 0), p1 = new THREE.Vector3(Math.cos(a) * L, 0.02, Math.sin(a) * L);
    parts.push(tube(p0, p1, 0.004, 0.003, 3, [0.78, 0.7, 0.52], [0.78, 0.7, 0.52])); // runners: thin, sand-dusted
  }
  return mergeGeometries(parts);
}

/** Pigface (Carpobrotus glaucescens): mats of fleshy, three-sided leaves with magenta flowers. */
export function pigface(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const n = seg(26, 8);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.7;
    const base = new THREE.Vector3(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    const dir = new THREE.Vector3(Math.cos(a + (rnd() - 0.5)), 0.5 + rnd() * 0.6, Math.sin(a + (rnd() - 0.5))).normalize();
    const L = 0.08 + rnd() * 0.06;
    const g = new THREE.CylinderGeometry(0.004, 0.012, L, 3, 1); // triangular cross-section, fleshy
    g.translate(0, L / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir)); g.translate(base.x, base.y, base.z);
    const red = rnd() < 0.3;
    colorize(g, v => (v.y - base.y) / L > 0.7 && red ? [0.55, 0.25, 0.22] : [0.32, 0.48, 0.24]);
    parts.push(strip(g));
  }
  for (let f = 0; f < 3 + Math.floor(rnd() * 4); f++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.6;
    const c = new THREE.Vector3(Math.cos(a) * r, 0.09, Math.sin(a) * r);
    const petals = seg(14, 6);
    for (let p = 0; p < petals; p++) {
      const pa = (p / petals) * Math.PI * 2;
      parts.push(leaf(c, new THREE.Vector3(Math.cos(pa), 0.35, Math.sin(pa)).normalize(), UP, 0.035, 0.008, 2, [0.86, 0.22, 0.58], 0));
    }
    const ctr = new THREE.SphereGeometry(0.012, 5, 3); ctr.translate(c.x, c.y + 0.008, c.z); colorize(ctr, () => [0.95, 0.82, 0.4]); parts.push(strip(ctr));
  }
  return mergeGeometries(parts);
}

/** Coast banksia (Banksia integrifolia): gnarled grey trunk, leathery leaves, pale yellow flower spikes and old grey cones. */
export function coastBanksia(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const bark = [0.42, 0.39, 0.35], barkDark = [0.3, 0.28, 0.25];
  const tips = [];
  const grow = (p, dir, len, rad, depth) => {
    const mid = p.clone().addScaledVector(dir, len * 0.5).add(new THREE.Vector3((rnd() - 0.5) * len * 0.15, 0, (rnd() - 0.5) * len * 0.15));
    const end = p.clone().addScaledVector(dir, len);
    parts.push(tube(p, mid, rad, rad * 0.88, 7, barkDark, bark), tube(mid, end, rad * 0.88, rad * 0.72, 7, bark, bark));
    if (depth <= 0) { tips.push({ p: end, dir }); return; }
    const k = depth > 2 ? 2 : 2 + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < k; i++) {
      const nd = dir.clone().applyAxisAngle(new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize(), 0.45 + rnd() * 0.5);
      nd.y = Math.max(0.2, nd.y); nd.normalize();
      grow(end, nd, len * (0.62 + rnd() * 0.2), rad * 0.68, depth - 1);
    }
  };
  const H = 1.4 + rnd() * 1.2;
  grow(new THREE.Vector3(), new THREE.Vector3((rnd() - 0.5) * 0.3, 1, (rnd() - 0.5) * 0.3).normalize(), H, 0.13 + rnd() * 0.05, 4);
  for (const { p, dir } of tips) {
    // Leaf whorl: dark green upper surfaces, silvery-white undersides catch the light at the leaf edges.
    const nL = seg(12, 5);
    for (let i = 0; i < nL; i++) {
      const a = (i / nL) * Math.PI * 2 + rnd() * 0.5;
      const d = new THREE.Vector3(Math.cos(a), 0.25 + rnd() * 0.5, Math.sin(a)).add(dir.clone().multiplyScalar(0.6)).normalize();
      const tone = 0.8 + rnd() * 0.3;
      parts.push(leaf(p, d, UP, 0.12 + rnd() * 0.06, 0.022, seg(3, 2), t => lerp3([0.2, 0.32, 0.18], [0.58, 0.62, 0.55], t * 0.5).map(v => v * tone), 0.25));
    }
    if (rnd() < 0.3) {
      // Flower spike (pale yellow) or old grey follicle cone.
      const old = rnd() < 0.5;
      const g = new THREE.CylinderGeometry(0.028, 0.032, 0.11, seg(7, 4), 1);
      g.translate(0, 0.055, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir)); g.translate(p.x, p.y, p.z);
      colorize(g, () => old ? [0.36, 0.33, 0.3] : [0.9, 0.85, 0.5]);
      parts.push(strip(g));
    }
  }
  return mergeGeometries(parts);
}

/** Coastal wattle (Acacia longifolia subsp. sophorae): dense, low, wind-pruned shrub with phyllodes and yellow rod flowers (late winter–spring). */
export function coastalWattle(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const stems = 5 + Math.floor(rnd() * 4);
  for (let s = 0; s < stems; s++) {
    const a = rnd() * Math.PI * 2, lean = 0.5 + rnd() * 0.8;
    const dir = new THREE.Vector3(Math.cos(a) * lean, 1, Math.sin(a) * lean).normalize();
    const L = 0.6 + rnd() * 0.7;
    const end = dir.clone().multiplyScalar(L);
    parts.push(tube(new THREE.Vector3(), end, 0.03, 0.012, 5, [0.35, 0.3, 0.24], [0.4, 0.36, 0.28]));
    const nL = seg(16, 6);
    for (let i = 0; i < nL; i++) {
      const t = 0.35 + 0.65 * (i / nL);
      const p = dir.clone().multiplyScalar(L * t);
      const d = new THREE.Vector3(rnd() - 0.5, rnd() * 0.6 + 0.1, rnd() - 0.5).normalize();
      const tone = 0.8 + rnd() * 0.3;
      parts.push(leaf(p, d, UP, 0.1 + rnd() * 0.05, 0.016, 2, [0.3 * tone, 0.42 * tone, 0.22 * tone], 0.1));
      if (rnd() < 0.18) {
        const g = new THREE.CylinderGeometry(0.008, 0.008, 0.045, 4, 1);
        g.translate(0, 0.0225, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d)); g.translate(p.x, p.y, p.z);
        colorize(g, () => [0.98, 0.84, 0.18]); parts.push(strip(g));
      }
    }
  }
  return mergeGeometries(parts);
}

/** Neptune's necklace (Hormosira banksii): chains of olive-brown, water-filled beads draped over the mid-shore rock platform. */
export function neptunesNecklace(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const chains = 5 + Math.floor(rnd() * 3);
  for (let c = 0; c < chains; c++) {
    let p = new THREE.Vector3((rnd() - 0.5) * 0.3, 0.01, (rnd() - 0.5) * 0.3);
    let a = rnd() * Math.PI * 2;
    const beads = 5 + Math.floor(rnd() * 6);
    for (let b = 0; b < beads; b++) {
      const r = 0.008 + 0.006 * Math.sin((b / beads) * Math.PI) + rnd() * 0.002;
      const g = new THREE.SphereGeometry(r, seg(5, 3), seg(3, 2)); // tiny beads: a few faces each is plenty
      g.scale(1.25, 1, 1); g.rotateY(-a); g.translate(p.x, p.y + r * 0.8, p.z);
      const tone = 0.85 + rnd() * 0.3, y0 = p.y;
      colorize(g, v => [0.42 * tone, 0.36 * tone, 0.12 * tone].map(x => x * (0.75 + 0.25 * Math.max(0, (v.y - y0) / r))));
      parts.push(strip(g));
      p = p.clone().add(new THREE.Vector3(Math.cos(a) * r * 2.3, 0, Math.sin(a) * r * 2.3));
      a += (rnd() - 0.5) * 0.9;
    }
  }
  return mergeGeometries(parts);
}
