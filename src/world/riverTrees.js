// The river bank's plants, made in code in the cosy, chunky style (vertex-coloured trunks, painted leaf cards): river she-oak (casuarina, hanging jointed-needle sprays), river water gum (smooth mottled
// leaning trunk, lance-shaped leaf clusters), lomandra tussocks (arching strap leaves), reed beds (upright rushes with brown seed heads), bank boulders and pebble scatters.
// Every function takes a seed and returns one merged BufferGeometry (position, normal, color, uv) that the instanced scatter (reef.js addGenerator) or props can use. The leaf cards sample riverAtlas().
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';
import { seg } from './lod.js';
import { tube, rockGeo } from './propKit.js';

const COLS = 3, WHITE_U = 2.5 / COLS;                    // atlas cells: 0 she-oak spray, 1 water gum leaf cluster, 2 solid white (trunks, vertex colours show unchanged)
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const hsl = (h, s, l) => `hsl(${h}, ${s}%, ${l}%)`;

let atlas = null;
/** The river atlas (painted once per page): she-oak needle spray, water gum leaf cluster. */
export function riverAtlas() {
  if (atlas) return atlas;
  const S = 256, c = document.createElement('canvas'); c.width = S * COLS; c.height = S;
  const g = c.getContext('2d'), rnd = mulberry32(31);
  const cell = (i, draw) => { g.save(); g.translate(i * S, 0); g.beginPath(); g.rect(0, 0, S, S); g.clip(); draw(); g.restore(); };
  // 0: she-oak: a soft drooping CLUMP, not a curtain of single lines. A rounded cap of dense needles at the top, then many fine jointed needles falling and curving out from it,
  // all in one narrow band of muted olive green (low contrast, so it reads as soft foliage from the high camera), with only a hint of russet at the very tips.
  cell(0, () => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const grd = g.createRadialGradient(128, 56, 4, 128, 56, 64); grd.addColorStop(0, 'hsl(100, 26%, 30%)'); grd.addColorStop(0.55, 'hsl(100, 26%, 32%)'); grd.addColorStop(1, 'hsla(100, 26%, 34%, 0)');
    g.fillStyle = grd; g.beginPath(); g.ellipse(128, 56, 64, 40, 0, 0, 6.3); g.fill();   // a soft filled core so the clump has a body
    const K = 240;
    for (let k = 0; k < K; k++) {
      const f = (k % 60) / 59, layer = Math.floor(k / 60), x0 = 128 + (f - 0.5) * (150 - layer * 20) + (rnd() - 0.5) * 16, y0 = 26 + layer * 12 + (rnd() - 0.5) * 12 + Math.abs(f - 0.5) * 30;
      const len = 90 + rnd() * 110 - Math.abs(f - 0.5) * 50, n = Math.max(5, Math.round(len / 11)), side = f - 0.5, fan = side * 120 + (rnd() - 0.5) * 30, hue = 96 + rnd() * 14, lit = 30 + rnd() * 9, w0 = 2.6 + rnd() * 1.0;
      let px = x0, py = y0;
      for (let s = 1; s <= n; s++) {
        const t = s / n, nx = x0 + fan * Math.pow(t, 1.1) + Math.sin(t * 4 + k) * 3 * t, ny = y0 + s * (len / n) * 0.98 - Math.pow(t, 3) * 0, tip = t > 0.9;
        g.strokeStyle = tip ? hsl(30 + rnd() * 14, 34, 40) : hsl(hue, 30 + (s % 2) * 3, lit + (s % 2) * 3 + t * 5);
        g.lineWidth = w0 * (1 - t * 0.4); g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
        px = nx; py = ny;
      }
    }
  });
  // 1: water gum: a leafy branchlet of lance-shaped, glossy leaves (some young, reddish ones among the green).
  cell(1, () => {
    const leaf = (x, y, len, w, ang, fill, vein) => {
      g.save(); g.translate(x, y); g.rotate(ang); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.35, -w, len, 0); g.quadraticCurveTo(len * 0.35, w, 0, 0); g.fillStyle = fill; g.fill();
      g.strokeStyle = vein; g.lineWidth = 1.2; g.beginPath(); g.moveTo(2, 0); g.lineTo(len * 0.9, 0); g.stroke(); g.restore();
    };
    for (let b = 0; b < 3; b++) {
      const x0 = 70 + b * 58, x1 = x0 + (rnd() - 0.5) * 90, y1 = 150 + rnd() * 90;
      g.strokeStyle = hsl(22, 30, 30); g.lineWidth = 3; g.beginPath(); g.moveTo(x0, 4); g.quadraticCurveTo((x0 + x1) / 2 + 14, y1 * 0.45, x1, y1); g.stroke();
      for (let i = 0; i < 20; i++) {
        const t = 0.06 + i / 21, x = x0 + (x1 - x0) * t + Math.sin(t * 3) * 7, y = 4 + (y1 - 4) * t, side = i % 2 ? 1 : -1, ang = Math.PI / 2 + side * (0.65 + rnd() * 0.5) + (rnd() - 0.5) * 0.3;
        const young = rnd() < 0.04, l = 52 + rnd() * 30, lit = 28 + rnd() * 16;
        leaf(x, y, l, 11 + rnd() * 5, ang, young ? hsl(8 + rnd() * 14, 52, 42 + rnd() * 8) : hsl(84 + rnd() * 20, 40 + rnd() * 10, lit), young ? hsl(10, 40, 62) : hsl(90, 34, lit + 18));
      }
    }
  });
  g.fillStyle = '#fff'; g.fillRect(2 * S, 0, S, S);
  atlas = new THREE.CanvasTexture(c); atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  return atlas;
}

/** A leaf card at p facing n (its up stays close to world up, so hanging sprays hang), side s, atlas cell `cell`. anchor: 'top' hangs from p, 'mid' is centred on p, 'base' stands on p. Normals bend away from `bendFrom` (a soft, rounded crown). */
function card(p, n, s, cell, tint, rnd, bendFrom, bendK = 0.6, anchor = 'top', spin = 0.3, aspect = 1) {
  const g = new THREE.PlaneGeometry(s, s * aspect);
  g.rotateZ((rnd() - 0.5) * spin * 2);
  g.translate(0, anchor === 'top' ? -s * aspect * 0.5 : anchor === 'base' ? s * aspect * 0.5 : 0, 0);
  const nn = n.clone().normalize(), right = new THREE.Vector3().crossVectors(UP, nn);
  if (right.lengthSq() < 1e-4) right.set(1, 0, 0); right.normalize();
  g.applyMatrix4(new THREE.Matrix4().makeBasis(right, new THREE.Vector3().crossVectors(nn, right), nn)); g.translate(p.x, p.y, p.z);
  const uv = g.attributes.uv, pos = g.attributes.position, nrm = g.attributes.normal, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
  for (let k = 0; k < uv.count; k++) uv.setX(k, (cell + uv.getX(k)) / COLS);
  for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).sub(bendFrom).normalize().multiplyScalar(bendK).addScaledVector(nn, 1 - bendK).normalize(); nrm.setXYZ(k, v.x, v.y, v.z); col.set(tint, k * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/** Make every part non-indexed with position, normal, color and uv (white cell for parts without a texture), and merge. */
function merge(parts) {
  const out = parts.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color', 'uv'].includes(k)) n.deleteAttribute(k);
    if (!n.attributes.uv) { const u = new Float32Array(n.attributes.position.count * 2); for (let i = 0; i < u.length; i += 2) { u[i] = WHITE_U; u[i + 1] = 0.5; } n.setAttribute('uv', new THREE.BufferAttribute(u, 2)); }
    return n;
  });
  return mergeGeometries(out, false);
}
const col3 = (r, g, b, k = 1) => new THREE.Color().setRGB(Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k));

/** River she-oak (Casuarina cunninghamiana): a slim, fissured trunk, ascending branches and long hanging sprays of jointed needles, dark green with warm tips. About 6 to 8 m. */
export function sheOak(seed) {
  const rnd = mulberry32(seed * 13 + 5), parts = [];
  const H = 5.8 + rnd() * 1.8, a0 = rnd() * 6.28, lean = 0.3 + rnd() * 0.7, N = 8, M = 9;
  const trunk = t => V(Math.cos(a0) * lean * t * t * 1.4 + Math.sin(t * 5 + seed) * 0.05, H * t, Math.sin(a0) * lean * t * t * 1.4 + Math.cos(t * 4 + seed) * 0.05);
  const tp = [], tr = [];
  for (let i = 0; i <= M; i++) { const t = i / M; tp.push(trunk(t)); tr.push(0.21 * (1 - 0.8 * t) * (1 + (t < 0.12 ? (0.12 - t) * 2.5 : 0)) + 0.025); }
  parts.push(tube(tp, tr, N, (u, v) => { const j = Math.floor(v * N), h = (Math.sin(j * 12.9 + Math.floor(u * 9) * 4.1) * 0.5 + 0.5); return j % 2 ? col3(0.33, 0.26, 0.21, 0.8 + h * 0.3) : col3(0.52, 0.45, 0.38, 0.8 + h * 0.3); }, { ridge: (u, j) => (j % 2 ? 0.8 : 1.12) }));   // deep furrows between pale ridges
  const crown = V(tp[M].x * 0.6, H * 0.78, tp[M].z * 0.6), nb = seg(10, 6);
  for (let i = 0; i < nb; i++) {
    const t = 0.38 + (i / nb) * 0.58, az = i * 2.4 + rnd() * 0.8, el = 0.22 + (1 - t) * 0.55 + rnd() * 0.2, len = 1.5 + (1.1 - t) * 2.4 + rnd() * 0.8;
    const dir = V(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)), b0 = trunk(t), pts = [b0, b0.clone().addScaledVector(dir, len * 0.35), b0.clone().addScaledVector(dir, len * 0.7).add(V(0, -0.06, 0)), b0.clone().addScaledVector(dir, len).add(V(0, -0.28, 0))];
    parts.push(tube(pts, [0.05, 0.036, 0.024, 0.012], 5, () => col3(0.3, 0.27, 0.2)));
    // The foliage: several rounded, drooping clumps along the branch and a bigger one at its tip. Each clump is two crossed soft cards (so it reads from every side) plus a small cap of needles on top.
    const hang = [0.35, 0.58, 0.8, 1.0];
    for (const [k, f] of hang.entries()) {
      const p = b0.clone().addScaledVector(dir, len * f).add(V(0, -0.28 * f * f + 0.02, 0)), sz = (0.95 + rnd() * 0.35) * (f > 0.95 ? 1.25 : 1), tone = 0.9 + rnd() * 0.16, out = V(dir.x, 0, dir.z).normalize();
      const nrm = V(out.x + (rnd() - 0.5) * 1.1, 0.05 + rnd() * 0.15, out.z + (rnd() - 0.5) * 1.1), tint = [tone * 0.96, tone, tone * 0.9];
      parts.push(card(p, nrm, sz, 0, tint, rnd, crown, 0.8, 'top', 0.12, 0.95));
      parts.push(card(p, V(-nrm.z, 0.06, nrm.x), sz * 0.92, 0, tint, rnd, crown, 0.8, 'top', 0.12, 0.95));
      if (k % 2 === 0) parts.push(card(p.clone().add(V(0, 0.08, 0)), V(dir.x * 0.3, 1, dir.z * 0.3), sz * 0.85, 0, tint, rnd, crown, 0.85, 'mid', 3.1));   // a soft cap seen from above
    }
  }
  for (let i = 0; i < 4; i++) {   // a soft crown over the top of the trunk, so no bare pale spike shows from the high camera
    const a = i * 1.6 + rnd(), p = V(tp[M].x + Math.cos(a) * 0.5, H * (0.8 + rnd() * 0.15), tp[M].z + Math.sin(a) * 0.5), tone = 0.92 + rnd() * 0.12;
    parts.push(card(p, V(Math.cos(a), 0.1, Math.sin(a)), 1.25, 0, [tone * 0.96, tone, tone * 0.9], rnd, crown, 0.8, 'top', 0.12, 0.95));
    parts.push(card(p.clone().add(V(0, 0.12, 0)), V(0.2, 1, 0.1), 1.3, 0, [tone * 0.96, tone, tone * 0.9], rnd, crown, 0.85, 'mid', 3.1));
  }
  return merge(parts);
}

/** River water gum (Tristaniopsis laurina): a smooth, pale, mottled trunk leaning out (toward +x) with a forked crown of lance-leaf clusters. About 5 m. Lean = how far the crown reaches (m). */
export function waterGum(seed, lean = 2.2) {
  const rnd = mulberry32(seed * 29 + 3), parts = [], N = 12, M = 10, H = 4.2 + rnd() * 1.1, L = lean * (0.85 + rnd() * 0.3);
  const trunk = t => V(L * Math.pow(t, 1.7) * 1.0 + Math.sin(t * 4 + seed) * 0.06, H * t - 0.12 * t * t * H * 0.3, Math.sin(t * 3 + seed * 2) * 0.12);
  const tp = [], tr = [];
  for (let i = 0; i <= M; i++) { const t = i / M; tp.push(trunk(t)); tr.push(0.36 * (1 - 0.6 * t) * (1 + (t < 0.1 ? (0.1 - t) * 3 : 0))); }
  const mottle = (u, v) => {
    const h = Math.sin(Math.floor(v * N) * 8.3 + Math.floor(u * 7) * 5.9 + seed) * 0.5 + 0.5, h2 = Math.sin(Math.floor(v * N * 0.5) * 3.7 + Math.floor(u * 3.5) * 11 + seed * 3) * 0.5 + 0.5;
    const c = h2 > 0.62 ? [0.95, 0.58, 0.36] : h > 0.55 ? [0.92, 0.72, 0.54] : [0.98, 0.86, 0.64];                  // orange-tan, grey-pink and cream patches
    return col3(c[0], c[1], c[2], 0.9 + h * 0.15 - (u < 0.1 ? 0.12 : 0));
  };
  parts.push(tube(tp, tr, N, mottle, { ridge: (u, j) => 1 + 0.025 * Math.sin(u * 11 + j) }));
  const fork = trunk(0.62), crown = V(L * 0.75, H * 0.92, 0), lm = seg(3, 2);
  for (let i = 0; i < lm; i++) {                                                                              // the leaning crown limbs
    const az = -0.9 + i * 0.9 + rnd() * 0.3, el = 0.45 + rnd() * 0.3, len = 1.5 + rnd() * 1.2, dir = V(Math.cos(az) * Math.cos(el) + 0.5, Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
    const pts = [fork.clone(), fork.clone().addScaledVector(dir, len * 0.5), fork.clone().addScaledVector(dir, len)];
    parts.push(tube(pts, [0.1, 0.07, 0.04], 6, mottle));
    for (let k = 0; k < seg(7, 3); k++) {
      const f = 0.35 + (k / 7) * 0.7, p = fork.clone().addScaledVector(dir, len * f).add(V((rnd() - 0.5) * 0.5, 0.2 * rnd(), (rnd() - 0.5) * 0.5)), tone = 0.85 + rnd() * 0.3;
      const nrm = p.clone().sub(crown).add(V((rnd() - 0.5) * 1.5, 0.3, (rnd() - 0.5) * 1.5)).normalize();
      parts.push(card(p, nrm, 1.4 + rnd() * 0.7, 1, [tone, tone, tone * 0.92], rnd, crown, 0.6, 'mid', 3.1));
    }
  }
  const tip = trunk(1);
  for (let k = 0; k < seg(5, 2); k++) parts.push(card(tip.clone().add(V((rnd() - 0.5) * 1.1, rnd() * 0.5 - 0.2, (rnd() - 0.5) * 1.1)), V(rnd() - 0.5, 0.7 + rnd() * 0.4, rnd() - 0.5), 1.6 + rnd() * 0.5, 1, [0.95, 1, 0.9], rnd, crown, 0.6, 'mid', 3.1));
  return merge(parts);
}

/** A flat, tapering strap along a path of points, facing up-ish; `colorAt(t)` colours it. `ws` are half-widths. */
function strap(pts, ws, side, colorAt) {
  const pos = [], col = [], nrm = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const q = [[pts[i], ws[i], i / (pts.length - 1)], [pts[i + 1], ws[i + 1], (i + 1) / (pts.length - 1)]], c0 = colorAt(q[0][2]), c1 = colorAt(q[1][2]);
    const L0 = q[0][0].clone().addScaledVector(side, -q[0][1]), R0 = q[0][0].clone().addScaledVector(side, q[0][1]), L1 = q[1][0].clone().addScaledVector(side, -q[1][1]), R1 = q[1][0].clone().addScaledVector(side, q[1][1]);
    for (const [a, ca, b, cb, c, cc] of [[L0, c0, R0, c0, L1, c1], [R0, c0, R1, c1, L1, c1]]) for (const [p, k] of [[a, ca], [b, cb], [c, cc]]) { pos.push(p.x, p.y, p.z); col.push(k.r, k.g, k.b); nrm.push(0, 1, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Lomandra (mat rush): a dense tussock of long, arching strap leaves, green with straw-coloured tips. About 0.8 m high, 1.2 m across. */
export function lomandra(seed) {
  const rnd = mulberry32(seed * 7 + 1), parts = [], n = seg(34, 12);
  for (let i = 0; i < n; i++) {
    const az = rnd() * 6.28, len = 0.9 + rnd() * 0.7, el = 1.0 + rnd() * 0.45, reach = len * (0.5 + rnd() * 0.35), tone = 0.82 + rnd() * 0.3, pts = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push(V(Math.cos(az) * (0.04 + reach * (t * 0.7 + t * t * 0.45)), Math.max(0.02, len * (Math.sin(el) * t - 0.5 * t * t) + 0.02), Math.sin(az) * (0.04 + reach * (t * 0.7 + t * t * 0.45)))); }
    parts.push(strap(pts, [0.022, 0.026, 0.022, 0.015, 0.005], V(-Math.sin(az), 0, Math.cos(az)), t => (t > 0.72 ? col3(0.66, 0.6, 0.3, tone) : col3(0.3 + t * 0.2, 0.44 + t * 0.06, 0.16, tone))));
  }
  return merge(parts);
}

/** A bed of reeds / rushes: upright, slightly bowed blades with a few tall stalks bearing brown seed heads. About 1.3 m (stalks to 1.9 m). */
export function reeds(seed) {
  const rnd = mulberry32(seed * 11 + 9), parts = [], n = seg(26, 10);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.42, ox = Math.cos(a) * r, oz = Math.sin(a) * r, H = 0.85 + rnd() * 0.75, bend = V((rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5), tone = 0.8 + rnd() * 0.35, pts = [];
    for (let k = 0; k <= 3; k++) { const t = k / 3; pts.push(V(ox + bend.x * t * t * H, t * H, oz + bend.z * t * t * H)); }
    parts.push(strap(pts, [0.024, 0.02, 0.014, 0.003], V(-Math.sin(a + 1), 0, Math.cos(a + 1)), t => col3(0.24 + t * 0.2, 0.42 + t * 0.06, 0.16 + t * 0.04, tone)));
  }
  for (let i = 0; i < seg(4, 2); i++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.3, x = Math.cos(a) * r, z = Math.sin(a) * r, H = 1.35 + rnd() * 0.6, lx = (rnd() - 0.5) * 0.12, lz = (rnd() - 0.5) * 0.12;
    parts.push(strap([V(x, 0, z), V(x + lx * 0.5, H * 0.5, z + lz * 0.5), V(x + lx, H, z + lz)], [0.014, 0.011, 0.008], V(1, 0, 0), () => col3(0.4, 0.45, 0.2)));
    const head = new THREE.CylinderGeometry(0.02, 0.024, 0.15, 6); head.translate(x + lx, H + 0.04, z + lz);
    const hg = head.toNonIndexed(), cc = new Float32Array(hg.attributes.position.count * 3), k = 0.9 + rnd() * 0.3; for (let j = 0; j < cc.length; j += 3) { cc[j] = 0.42 * k; cc[j + 1] = 0.26 * k; cc[j + 2] = 0.15 * k; }
    hg.setAttribute('color', new THREE.BufferAttribute(cc, 3)); parts.push(hg);
  }
  return merge(parts);
}

/** A bank boulder: a chunky, mossy-topped grey-tan rock, about 1 m across, flat-shaded. */
export function boulder(seed) {
  const sx = 0.9 + ((seed * 7) % 5) * 0.12, sz = 0.8 + ((seed * 3) % 4) * 0.12;
  const g = rockGeo(new THREE.IcosahedronGeometry(0.55, 1), (x, y, z) => { const h = 0.82 + (Math.sin(x * 9.1 + y * 5.3 + z * 7.7 + seed) * 0.5 + 0.5) * 0.4; return [x * sx * h, Math.max(y * 0.62 * h, -0.12), z * sz * h]; },
    (y01, nx, ny) => { const h = Math.sin(y01 * 17 + nx * 9 + seed) * 0.5 + 0.5; const moss = Math.max(0, ny - 0.5) * 0.9 * (0.4 + h * 0.6); return new THREE.Color().setRGB(0.66 + h * 0.1 - moss * 0.22, 0.57 + h * 0.07 - moss * 0.02, 0.45 + h * 0.05 - moss * 0.1); });
  g.translate(0, -g.boundingBox.min.y * 0.7, 0);
  return merge([g]);
}
/** A scatter of river pebbles (a gravel bar): a dozen small rounded stones in greys, creams and ochres. */
export function pebbles(seed) {
  const rnd = mulberry32(seed * 5 + 2), parts = [], n = seg(14, 6), pal = [[0.62, 0.6, 0.55], [0.74, 0.68, 0.54], [0.5, 0.5, 0.48], [0.78, 0.7, 0.6], [0.58, 0.52, 0.44]];
  for (let i = 0; i < n; i++) {
    const r = 0.07 + rnd() * 0.12, c = pal[Math.floor(rnd() * pal.length)], k = 0.9 + rnd() * 0.2, sx = 1 + rnd() * 0.5, sz = 0.8 + rnd() * 0.4;
    const g = rockGeo(new THREE.IcosahedronGeometry(r, 0), (x, y, z) => [x * sx, y * 0.55, z * sz], (y01, nx, ny) => new THREE.Color().setRGB(c[0] * k * (0.9 + 0.15 * Math.max(0, ny)), c[1] * k * (0.9 + 0.15 * Math.max(0, ny)), c[2] * k));
    g.translate((rnd() - 0.5) * 2.0, r * 0.25, (rnd() - 0.5) * 2.0); parts.push(g);
  }
  return merge(parts);
}
