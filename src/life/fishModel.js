// Procedural fish / shark / ray geometry with painted canvas skins.
// Model space: head toward +x, dorsal +y, origin at body centre, units metres.
import * as THREE from 'three';
import { globalUniforms } from '../ocean/shaders.js';
import { buildCephalopod } from './cephalopod.js';

/** Cosy art style: rounder bodies, thick soft fins, big glossy eyes (species proportions and markings unchanged). */
const cosy = () => globalUniforms.uStyle.value > 0.5;

const TAU = Math.PI * 2;
const hex = h => new THREE.Color(h);

/** Body thickness profile 0..1 along t (0 = caudal peduncle, 1 = snout). */
function bodyProfile(t, look) {
  const ped = look.peduncle ?? 0.14;
  const peak = look.peak ?? 0.58;            // where the body is deepest
  const a = Math.log(0.5) / Math.log(peak);
  const snout = look.snout ?? 0.7;           // <1 blunt, >1 pointy
  const base = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(Math.min(t, 0.999), a))), snout);
  return ped + (1 - ped) * base;
}

/** Emissive (glow) map for bioluminescent species: look.paint.glow(u, s) -> 0..1 */
function paintGlow(look, W = 256, H = 256) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(W, H);
  const gc = look.glowColor ?? [0.4, 0.8, 1.0];
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const u = (px + 0.5) / W, v = (py + 0.5) / H;
    let g = 0;
    if (v < 0.75) { const phi = (v / 0.75) * TAU; g = look.paint.glow(u, Math.cos(phi), 'body'); }
    else g = look.paint.glowFin ? look.paint.glowFin(u) : 0;
    const i = (py * W + px) * 4;
    img.data[i] = gc[0] * g * 255; img.data[i + 1] = gc[1] * g * 255; img.data[i + 2] = gc[2] * g * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const INK = [0.07, 0.2, 0.23];   // the thin dark-teal ink used for every painted line
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** One saturation and value range for every skin: no near-black fish, no neon: darks are lifted toward ink-teal and over-saturated colours are eased back. */
function tone(c) {
  const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]), l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  let o = c;
  if (mx - mn > 0.62) o = mix3(o, [l, l, l], Math.min(0.3, (mx - mn - 0.62) * 0.9));      // ease off neon
  if (l < 0.2) o = mix3(o, [0.2, 0.29, 0.31], (0.2 - l) * 1.1);                              // lift near-black toward dark teal
  return o;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
/** Fill a canvas skin. painter(u, s, part, f) returns [r,g,b] 0..1. Body rows (top 75%): fine overlapping scales, a lateral line that follows the back's curve, a curved gill-cover edge
 *  and a mouth line; fin rows: each fin starts in the body colour at its root and fades to the fin's own colour. */
function paintSkin(look, W = 512, H = 512) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const p = look.paint, scl = look.scales ?? {}, nU = scl.nU ?? 70, nR = scl.nR ?? 46, sStr = scl.strength ?? 0.05;
  const mo = look.mouth ?? { len: 0.07, s: -0.12 }, gill = look.gill ?? 0.8, sheen = look.metal != null && look.metal >= 0.25;
  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / H;
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W;
      let col;
      if (v < 0.75) {
        const phi = (v / 0.75) * TAU;
        const s = Math.cos(phi); // +1 dorsal, -1 belly
        col = p.body(u, s, phi < Math.PI ? 1 : -1);
        if (!look.smooth) {
          // Scales: overlapping rows, each scale a little darker along its rear (tail-ward) arc. Fine and soft; look.scales = { nU, nR, strength } for big scales (carp).
          const a = phi / TAU * nR, row = Math.floor(a), fy = a - row, bq = u * nU + (row & 1) * 0.5, fx = bq - Math.floor(bq);
          let k = 1 - sStr * sstep(0.46, 0.72, Math.hypot(fx - 0.68, (fy - 0.5) * 1.05));
          if (sheen) k *= 1 + (Math.abs(s - 0.12) < 0.9 ? 0.08 * Math.exp(-(((s - 0.12) / 0.3) ** 2)) * sstep(0.08, 0.3, u) : 0) - 0.12 * sstep(0.55, 1, s);   // a soft silver sheen along the flank, a darker ridge
          else k *= 1 - 0.08 * sstep(0.6, 1, s);
          col = [col[0] * k, col[1] * k, col[2] * k];
          // Lateral line: rises toward the shoulder, runs level, drops to the middle of the tail root; a faint dotted line of pores.
          if (!look.noLateral && u > 0.1 && u < gill) {
            const sl = 0.03 + 0.5 * sstep(0.3, 0.86, u), m = (1 - sstep(0.008, 0.02, Math.abs(s - sl))) * sstep(0.1, 0.2, u) * (1 - sstep(gill - 0.04, gill - 0.01, u)) * (0.78 + 0.22 * Math.sin(u * 700));
            if (m > 0) col = lum(col) > 0.4 ? mix3(col, INK, 0.2 * m) : mix3(col, [0.75, 0.82, 0.82], 0.15 * m);
          }
          // Gill cover: a curved edge (its rear margin bulges tail-ward at mid-height and curls forward top and bottom), the plate a touch paler, a fainter cheek arc ahead of it.
          const gu = gill + 0.05 * s * s, cover = 1 - sstep(0.82, 0.96, Math.abs(s));
          if (cover > 0 && Math.abs(u - gu) < 0.1) {
            const e = 1 - sstep(0.0025, 0.0065, Math.abs(u - gu)), e2 = 1 - sstep(0.002, 0.005, Math.abs(u - (gu + 0.04 + 0.03 * s * s)));
            if (u > gu) { const lt = 1 + 0.05 * cover; col = [col[0] * lt, col[1] * lt, col[2] * lt]; }
            col = mix3(col, INK, 0.4 * e * cover + 0.1 * e2 * cover * sstep(gu, gu + 0.02, u));
          }
          // Mouth: a curved line from the snout back toward the cheek, rising as it goes.
          const mu = (1 - u) / mo.len;
          if (mu < 1 && mu >= 0) { const sm2 = mo.s + mu * 0.1 + mu * mu * 0.1; col = mix3(col, INK, 0.8 * (1 - sstep(0.02, 0.045, Math.abs(s - sm2)))); }
        }
        col = tone(col);
      } else {
        const fv = (v - 0.75) / 0.25;
        const part = fv < 0.25 ? 'dorsal' : fv < 0.5 ? 'anal' : fv < 0.75 ? 'tail' : 'pectoral';
        const f = (fv % 0.25) / 0.25;
        col = p.fin ? p.fin(u, part, f) : p.body(u, 0.2, 1);
        if (part === 'pectoral') col = mix3(col, [1, 1, 0.95], 0.16);   // paired fins read pale and glassy
        // Root: start in the body's own colour (a fin grows out of the skin), then fade to the fin colour.
        const root = (1 - sstep(0.1, 0.55, f)) * (part === 'pectoral' ? 0.6 : 0.85);
        if (root > 0.01) col = mix3(col, tone(p.body(Math.min(u, 0.8), part === 'dorsal' ? 0.85 : part === 'anal' ? -0.85 : part === 'tail' ? 0.1 : -0.1, 1)), root);
      }
      const i = (py * W + px) * 4;
      img.data[i] = Math.min(255, col[0] * 255); img.data[i + 1] = Math.min(255, col[1] * 255); img.data[i + 2] = Math.min(255, col[2] * 255); img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Monotone cubic (PCHIP) through [x, y] control points: smooth silhouettes that never overshoot. */
export function pchip(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), h = [], d = [];
  for (let i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
  const m = new Array(n).fill(0);
  const end = (h0, h1, d0, d1) => { let e = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1); if (Math.sign(e) !== Math.sign(d0)) e = 0; else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(e) > 3 * Math.abs(d0)) e = 3 * d0; return e; };
  if (n === 2) m[0] = m[1] = d[0];
  else {
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    m[0] = end(h[0], h[1], d[0], d[1]); m[n - 1] = end(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}
/** Silhouette arrays: either a list of 9 numbers (at t = 0, .12, .25, .4, .55, .7, .82, .92, 1) or [t, value] pairs. */
const KNOTS = [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.82, 0.92, 1];
const knots = a => pchip(typeof a[0] === 'number' ? a.map((v, i) => [KNOTS[i], v]) : a);

/** Fin outlines. pts: height factor (0..1) from the front of the fin base (k = 0) to its rear (k = 1); lean: how far the edge is raked back, as a fraction of the height. */
const FIN_SHAPES = {
  round: { pts: [[0, 0.15], [0.2, 0.75], [0.5, 1], [0.8, 0.8], [1, 0.12]], lean: 0.12 },
  spiny: { pts: [[0, 0.3], [0.1, 0.9], [0.25, 1], [0.55, 0.7], [0.85, 0.34], [1, 0.1]], lean: 0.5 },          // first dorsal: stiff spines raked back
  soft: { pts: [[0, 0.45], [0.1, 1], [0.35, 0.85], [0.7, 0.6], [0.92, 0.45], [1, 0.08]], lean: 0.32 },        // soft rays: tallest at the front, a rounded rear lobe
  dual: { pts: [[0, 0.2], [0.06, 0.85], [0.16, 1], [0.4, 0.78], [0.52, 0.42], [0.6, 0.33], [0.75, 0.36], [0.92, 0.3], [1, 0.08]], lean: 0.38 },   // one long fin: spines in front, soft rays behind
  low: { pts: [[0, 0.1], [0.12, 0.6], [0.5, 0.78], [0.88, 0.62], [1, 0.1]], lean: 0.05 },
};
FIN_SHAPES.tri = FIN_SHAPES.spiny;
for (const s of Object.values(FIN_SHAPES)) s.f = pchip(s.pts);

/** Build fish geometry. Returns { geometry, texture, length }.
 *  The silhouette is either the legacy peak/snout bell (look.peak, look.snout) or, when look.top / look.bot are given, two explicit profiles (see KNOTS)
 *  for the back and the belly, each 0..1 of its own maximum (look.topShare = how much of look.depth lies above the body axis); look.wpts does the same for the width.
 *  Total length is exact: the model spans -L/2 (tail tip) .. +L/2 (snout / beak tip), so the brag mat can scale the picture by it.
 *  opts.flatTail: spread the tail fin flat (horizontal), as it lies on a brag mat: used for the top-down picture of flat-bodied fish.
 *  opts.noTexture: skip painting the skin (tests).
 *  look.cephalopod ('squid' | 'cuttle'): see life/cephalopod.js. look.hump: forehead hump. look.lips: thick lips. */
export function buildFish(look, opts = {}) {
  if (look.cephalopod) return buildCephalopod(look, opts);   // squid and cuttlefish have their own model (life/cephalopod.js)
  const L = look.length;
  const tailFrac = look.tailFrac ?? 0.2;
  const C = cosy();
  const depth = look.depth * L, width = look.width * L * (C ? 1.18 : 1);
  const RINGS = C ? 32 : 26, SEG = C ? 24 : 18;
  const pos = [], uv = [], idx = [], fin = []; // fin: (k along fin base, 0 base..1 edge); body (0,-1); eye (0,-2)
  const superE = look.boxy ?? 2; // cross-section superellipse exponent
  const ex = 2 / superE;
  const beakL = look.beak ? look.beak * L : 0;
  const x0 = -L / 2 + tailFrac * L;
  const ext = tailFrac * L * 0.24;                                              // the caudal peduncle runs on past t = 0, flattening into the tail fin's root
  const snoutX = L / 2 - beakL - (look.lips ? depth * 0.055 : 0) - (look.barbels ? L * 0.02 : 0);
  const bodyLen = snoutX - x0;
  const bodyX = t => x0 + t * bodyLen;
  // ---- silhouette: back, belly and width as functions of t (0 = peduncle .. 1 = snout tip)
  const hum = t => (look.hump ? look.hump.h * depth * Math.exp(-(((t - look.hump.at) / look.hump.w) ** 2)) : 0);
  let topF, botF, wF;
  if (look.top) {
    const tn = knots(look.top), bn = knots(look.bot ?? look.top), share = look.topShare ?? 0.55;
    const wn = look.wpts ? knots(look.wpts) : t => tn(t) * share + bn(t) * (1 - share);
    topF = t => tn(t) * share * depth + hum(t); botF = t => bn(t) * (1 - share) * depth; wF = t => width * 0.5 * wn(t);
  } else {
    topF = t => depth * 0.5 * bodyProfile(t, look) + hum(t);
    botF = t => depth * 0.5 * bodyProfile(t, look) + (look.belly ?? 0) * depth * bodyProfile(t, look) * 0.15;
    wF = t => width * 0.5 * bodyProfile(t, look);
  }
  const cyF = t => (topF(t) - botF(t)) / 2, hhF = t => (topF(t) + botF(t)) / 2;
  /** z of the flank surface at height y (a point on the skin for fins, eyes and lips to sit on). */
  const surfZ = (t, y) => { const u = (y - cyF(t)) / Math.max(1e-5, hhF(t)); return wF(t) * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(u)), superE)), 1 / superE); };
  // ---- body rings: the peduncle extension (thin, flattening to a knife edge for the tail fin), then t = 0..1
  const rings = [];
  const E = 4, T0 = topF(0), B0 = botF(0), W0 = wF(0);
  for (let j = 0; j < E; j++) {
    const f = j / E, fl = 1 + 0.1 * (1 - f);
    rings.push({ x: x0 - ext * (1 - f), top: T0 * fl, bot: B0 * fl, w: W0 * (0.08 + 0.92 * Math.pow(Math.sin(f * Math.PI / 2), 1.3)), t: 0, close: 1 });
  }
  for (let r = 0; r <= RINGS; r++) {
    const t = r / RINGS, close = t > 0.97 ? Math.sqrt(Math.max(0, (1 - t) / 0.03)) : 1;   // the snout tip closes
    rings.push({ x: bodyX(t), top: topF(t), bot: botF(t), w: wF(t), t, close });
  }
  for (const R of rings) {
    const cy = (R.top - R.bot) / 2, hh = (R.top + R.bot) / 2 * R.close, ww = R.w * R.close;
    for (let s = 0; s <= SEG; s++) {
      const phi = (s / SEG) * TAU, c = Math.cos(phi), sn = Math.sin(phi);
      pos.push(R.x, cy + Math.sign(c) * Math.pow(Math.abs(c), ex) * hh, Math.sign(sn) * Math.pow(Math.abs(sn), ex) * ww);
      uv.push(R.t, 1 - (s / SEG) * 0.75); fin.push(0, -1);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < SEG; s++) {
    const a = r * (SEG + 1) + s, b = a + SEG + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  // ---- fins: thin membranes. Each is a strip from a base curve (sitting on the skin) to an edge curve; vertical ones get two thin layers, thickest at the root.
  const FT = Math.max(0.0015, L * 0.0085);
  const addFin = (base, edge, n, vBand, uOf, o = {}) => {
    const vertical = [0.25, 0.5, 0.75].every(k => Math.abs(base(k)[2]) < 1e-6 && Math.abs(edge(k)[2]) < 1e-6);
    if (vertical) {
      const T = (o.thick ?? 1) * FT, M = 3, start = pos.length / 3;
      for (const sd of [1, -1]) for (let i = 0; i <= n; i++) {
        const k = i / n, b = base(k), e = edge(k), endK = Math.sin(Math.PI * Math.min(1, 0.06 + k * 0.94));
        for (let j = 0; j <= M; j++) {
          const f = j / M, th = T * Math.pow(Math.max(0, 1 - f), 0.7) * (0.35 + 0.65 * endK) + 0.0004;
          pos.push(b[0] + (e[0] - b[0]) * f, b[1] + (e[1] - b[1]) * f, sd * th);
          uv.push(uOf(k), 1 - (0.75 + (vBand + 0.02 + 0.21 * f) * 0.25)); fin.push(k, f);
        }
      }
      const row = M + 1, layer = (n + 1) * row;
      for (let s = 0; s < 2; s++) for (let i = 0; i < n; i++) for (let j = 0; j < M; j++) {
        const a = start + s * layer + i * row + j, b2 = a + row;
        if (s === 0) idx.push(a, a + 1, b2, a + 1, b2 + 1, b2); else idx.push(a, b2, a + 1, a + 1, b2, b2 + 1);
      }
      return;
    }
    const start = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const k = i / n, b = base(k), e = edge(k);
      pos.push(b[0], b[1], b[2]); uv.push(uOf(k), 1 - (0.75 + (vBand + 0.02) * 0.25)); fin.push(k, 0);
      pos.push(e[0], e[1], e[2]); uv.push(uOf(k), 1 - (0.75 + (vBand + 0.23) * 0.25)); fin.push(k, 1);
    }
    for (let i = 0; i < n; i++) { const a = start + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  /** A median fin (dorsal / anal) rooted along the back (sd = 1) or the belly (sd = -1) between body positions from..to (t). */
  const medianFin = (d, sd, def) => {
    const { from, to, height, shape = def, streamer = 0 } = d;
    const sink = depth * 0.02, surf = t => (sd > 0 ? topF(t) : botF(t));
    if (shape === 'sail') {   // legacy tall sail with a trailing streamer (reef fish)
      addFin(
        k => { const t = from + (to - from) * k; return [bodyX(t), sd * (surf(t) - sink), 0]; },
        k => {
          const t = from + (to - from) * k;
          let hgt = height * L * Math.sin(Math.PI * Math.pow(k, 0.6)), back = 0;
          if (streamer && k > 0.6) { hgt += streamer * L * Math.pow((k - 0.6) / 0.4, 2) * 0.4; back = -streamer * L * Math.pow((k - 0.6) / 0.4, 1.5); }
          return [bodyX(t) + back, sd * (surf(t) + hgt), 0];
        }, 10, sd > 0 ? 0 : 0.25, k => from + (to - from) * k);
      return;
    }
    const S = FIN_SHAPES[shape] ?? FIN_SHAPES.round, lean = d.lean ?? S.lean, H = height * L;
    const n = Math.max(8, Math.round(10 + (to - from) * 24));
    addFin(
      k => { const t = from + (to - from) * k; return [bodyX(t), sd * (surf(t) - sink), 0]; },
      k => { const t = from + (to - from) * k, h = H * S.f(1 - k) * (1 - 0.0); return [bodyX(t) - lean * h, sd * (surf(t) - sink + h + sink), 0]; },
      n, sd > 0 ? 0 : 0.25, k => from + (to - from) * k);
  };
  for (const [dd, def] of [[look.dorsal, 'round'], [look.dorsal2, 'soft']]) if (dd) medianFin(dd, 1, def);
  if (look.anal) medianFin(look.anal, -1, 'soft');
  // Finlets (look.finlets { from, to, n, h, top, bottom }): the row of small separate fins behind the dorsal and anal of mackerel, bonito and scad-like fish.
  if (look.finlets) {
    const { from, to, n, h, top = true, bottom = true } = look.finlets;
    for (const sd of [top ? 1 : 0, bottom ? -1 : 0]) if (sd) addFin(
      k => { const t = from + (to - from) * k; return [bodyX(t), sd * ((sd > 0 ? topF(t) : botF(t)) * 0.96), 0]; },
      k => { const t = from + (to - from) * k, ph = (k * n) % 1; return [bodyX(t) - h * L * 0.7 * ph, sd * ((sd > 0 ? topF(t) : botF(t)) * 0.94 + h * L * (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, ph * 1.15)) ** 0.7)), 0]; },
      n * 3, 0, k => from + (to - from) * k);
  }
  // ---- caudal fin: grows out of the knife-edge end of the peduncle; its base spans the whole peduncle height.
  const xb = x0 - ext + 0.004 * L, tl = xb + L / 2, cy0 = cyF(0), baseH = (T0 + B0) * 1.08;
  if (look.tail === 'fluke') {
    const span = (look.tailSpan ?? 1) * L * 0.14, tlf = tailFrac * L, xf = x0 + 0.005;
    addFin(
      k => [xf, 0, (k - 0.5) * width * 0.25],
      k => { const z = (k - 0.5) * 2; return [xf - tlf * (0.35 + 0.65 * Math.pow(Math.abs(z), 0.7)) + (Math.abs(z) < 0.12 ? tlf * 0.15 : 0), 0, z * span]; },
      12, 0.5, k => 0.03);
  } else if (look.tail !== 'none') {
    const tail = look.tail ?? 'forked';
    const span = (look.tailSpan ?? 1) * depth * 0.55 + L * 0.05;
    const fork = look.fork ?? (tail === 'lunate' ? 0.45 : 0.38);   // where the notch of a forked tail sits, as a fraction of the tail's length (small = deep fork)
    const flat = !!opts.flatTail;
    addFin(
      k => (flat ? [xb, 0, (k - 0.5) * baseH * 0.9] : [xb, cy0 + (k - 0.5) * baseH, 0]),
      k => {
        const y = (k - 0.5) * 2, ay = Math.abs(y); // -1..1
        let x;
        if (tail === 'forked') x = xb - tl * (fork + (1 - fork) * Math.pow(ay, 1.12));
        else if (tail === 'lunate') x = xb - tl * (fork + (1 - fork) * Math.pow(ay, 0.6));
        else if (tail === 'round') x = xb - tl * (1 - (look.tailRound ?? 0.35) * y * y) * (look.lowerLobe != null && y < 0 ? look.lowerLobe + (1 - look.lowerLobe) * (1 + y) * 0.2 : 1);
        else if (tail === 'heterocercal') x = xb - tl * (y > 0 ? 0.4 + 0.6 * Math.pow(y, 0.7) : 0.35 + 0.35 * Math.pow(-y, 0.8));
        else x = xb - tl * (1 - (look.tailRound ?? 0.14) * Math.pow(ay, look.tailCurve ?? 2.4)); // truncate: a nearly straight edge with softly rounded corners (never forked)
        let yy = y * span * (look.lowerLobe != null && y < 0 ? look.lowerLobe : 1);
        if (tail === 'heterocercal') yy = y > 0 ? y * span * 1.15 + tl * 0.25 * y : y * span * 0.6;
        return flat ? [x, 0, yy] : [x, cy0 + yy, 0];
      }, 14, 0.5, k => 0.02 + 0.06 * Math.abs(k - 0.5), { thick: 0.9 });
  }
  // Small tapered tubes for the garfish's beak and the carp's barbels (uvAt(k) picks the painted colour along the tube).
  const spike = (p0, p1, r0, r1, n, side, uvAt) => {
    const start = pos.length / 3, d = new THREE.Vector3().subVectors(p1, p0);
    for (let i = 0; i <= n; i++) {
      const k = i / n, r = r0 + (r1 - r0) * k, c = p0.clone().addScaledVector(d, k);
      for (let j = 0; j < 5; j++) { const q = (j / 5) * TAU; pos.push(c.x, c.y + Math.cos(q) * r, c.z + Math.sin(q) * r); uv.push(...uvAt(k)); fin.push(0, -1); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < 5; j++) { const a0 = start + i * 5 + j, a1 = start + i * 5 + (j + 1) % 5; idx.push(a0, a0 + 5, a1, a1, a0 + 5, a1 + 5); }
  };
  const tipY = cyF(1);
  if (look.beak) spike(new THREE.Vector3(bodyX(1) - 0.012 * L, tipY - depth * 0.05, 0), new THREE.Vector3(L / 2, tipY - depth * 0.06, 0), Math.max(width * 0.1, L * 0.006), L * 0.0016, 5, 1, k => [k < 0.6 ? 0.8 : 0.97, 0.3]);
  if (look.barbels) for (const side of [-1, 1]) for (let b = 0; b < look.barbels; b++) {
    const x1 = bodyX(1) - 0.012 * L, y1 = tipY - depth * 0.1, z1 = side * width * (0.1 + b * 0.05);
    spike(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x1 + 0.03 * L * (1 - b * 0.35), y1 - 0.025 * L, z1 + side * 0.014 * L), L * 0.0035, L * 0.0012, 2, side, () => [0.6, 0.62]);
  }
  // Wobbegong tassels: a fringe of branching skin flaps along each side of the head (look.tassels = how many).
  if (look.tassels) for (const side of [-1, 1]) {
    const n = look.tassels, len = 0.04 * L, tt = k => 0.98 - 0.26 * k;
    addFin(
      k => { const t = tt(k); return [bodyX(t), -depth * 0.06, side * wF(t) * 0.97]; },
      k => { const t = tt(k), ph = (k * n) % 1, saw = 0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, ph * 1.1)) ** 0.8; return [bodyX(t) + len * 0.35 * saw, -depth * 0.06 - len * 0.25 * saw, side * (wF(t) * 0.97 + len * saw)]; },
      n * 3, 0.75, () => 0.9);
  }
  // Thick lips: two soft pads at the front of the jaws.
  if (look.lips) {
    const x1 = bodyX(1) + depth * 0.055, r = depth * 0.1, S = 10, R = 6;
    for (const [dy, rx, ry, rz] of [[tipY + depth * 0.01, r * 1.15, r * 0.62, r * 1.0], [tipY - depth * 0.085, r * 1.05, r * 0.6, r * 0.9]]) {
      const start = pos.length / 3;
      for (let i = 0; i <= R; i++) for (let j = 0; j <= S; j++) {
        const a = (i / R) * Math.PI, th = (j / S) * TAU;
        pos.push(x1 - rx * 0.55 + Math.cos(a) * rx, dy + Math.sin(a) * Math.sin(th) * ry, Math.sin(a) * Math.cos(th) * rz); uv.push(0.9, 0.8); fin.push(0, -1);
      }
      for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) { const a0 = start + i * (S + 1) + j, b0 = a0 + S + 1; idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0); }
    }
  }
  // Pectoral fins (pair), rooted on the flank just behind the gill cover.
  const pecL = (look.pectoral ?? 0.12) * L;
  if (pecL > 0) for (const side of [-1, 1]) {
    const t0 = look.pecAt ?? 0.72, wing = look.pecWing ?? 0;
    if (wing > 0) {   // flat-bodied fish and sharks: broad wings held out sideways
      const bx = bodyX(t0), wz = wF(t0) * side, by = -depth * 0.12;
      // A broad rounded wing: the base runs along the flank, the outline swings out sideways and back in a smooth arc.
      addFin(
        k => [bx - k * pecL * 0.5, by, wz],
        k => { const a = Math.PI * (0.12 + 0.76 * k), out = Math.sin(a); return [bx - pecL * (0.05 + 0.8 * k) - wing * pecL * 0.2 * k, by - pecL * 0.04 * out, wz + side * pecL * (0.15 + wing * 1.1) * out]; },
        8, 0.75, () => t0);
    } else {          // a fan of rays: the upper ones longest, swept back and a little outward
      const yb = cyF(t0) + hhF(t0) * (look.pecY ?? -0.25), rl = pecL * 0.22, bx = bodyX(t0);
      const rootY = k => yb + rl * (0.5 - k), rootX = k => bx - k * pecL * 0.08;
      addFin(
        k => { const y = rootY(k); return [rootX(k), y, surfZ(t0, y) * side * 0.97]; },
        k => { const y = rootY(k), ang = 0.04 + 0.7 * k, len = pecL * (1 - 0.5 * Math.pow(k, 1.3)); return [rootX(k) - len * Math.cos(ang), y - len * Math.sin(ang), surfZ(t0, y) * side * 0.97 + side * pecL * (0.1 + 0.12 * (1 - k))]; },
        6, 0.75, () => t0);
    }
  }
  // Pelvic fins (pair): small, tucked under the belly just behind the pectorals (none on flatfish-shaped or eel-like models: look.pelvic = 0).
  const pelL = (look.pelvic ?? 0.07) * L;
  if (pelL > 0) for (const side of [-1, 1]) {
    const t0 = look.pelAt ?? Math.max(0.5, (look.pecAt ?? 0.72) - 0.04), bx = bodyX(t0);
    const yAt = k => cyF(t0) - hhF(t0) * (0.62 + 0.3 * k);   // root runs from the lower flank toward the belly line
    addFin(
      k => { const y = yAt(k); return [bx - k * pelL * 0.45, y, surfZ(t0, y) * side * 0.96]; },
      k => { const y = yAt(k); return [bx - pelL * (0.3 + 0.62 * k), y - pelL * (0.62 - 0.22 * k), surfZ(t0, y) * side * 0.96 + side * pelL * 0.14]; },
      3, 0.75, () => t0);
  }
  // Eyes: one construction for every species. A flat lens set INTO the head (its rim sunk below the skin, only the middle clears it by ~0.2 of the eye radius), its UVs wrapped onto the
  // painted rim + iris + pupil (looks.js withEye), plus a small white highlight sitting on the lens. Size comes from the painted radius (a real proportion per species), never from a bulge.
  const eye = look.paint.body?.eye;
  if (eye && !look.noEyeDome) {
    const t = eye.u, cyE = cyF(t), hh = hhF(t), ww = wF(t);
    const re = eye.r * bodyLen, R = 5, S = 14;
    const hgt = re * (look.eyeRaise ?? 0.3), sink = re * 0.14;
    const Rs = (re * re + hgt * hgt) / (2 * hgt), amax = Math.asin(Math.min(0.999, re / Rs));
    for (const side of [1, -1]) {
      const phi0 = side > 0 ? Math.acos(Math.max(-1, Math.min(1, eye.s))) : TAU - Math.acos(Math.max(-1, Math.min(1, eye.s)));
      const c = Math.cos(phi0), sn = Math.sin(phi0);
      const cy = cyE + Math.sign(c) * Math.pow(Math.abs(c), ex) * hh, cz = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * ww;
      const nrm = new THREE.Vector3(0, (cy - cyE) / Math.max(1e-4, hh * hh), cz / Math.max(1e-4, ww * ww)).normalize();
      const tu = new THREE.Vector3(1, 0, 0), tv = new THREE.Vector3().crossVectors(nrm, tu).normalize();
      const centre = new THREE.Vector3(bodyX(t), cy, cz).addScaledVector(nrm, -(Rs - hgt + sink));
      const start = pos.length / 3;
      for (let i = 0; i <= R; i++) {
        const rho = i / R, a = rho * amax; // spherical cap
        for (let j = 0; j <= S; j++) {
          const th = (j / S) * TAU;
          const p = centre.clone().addScaledVector(nrm, Math.cos(a) * Rs).addScaledVector(tu, Math.sin(a) * Rs * Math.cos(th)).addScaledVector(tv, Math.sin(a) * Rs * Math.sin(th));
          pos.push(p.x, p.y, p.z);
          const k = rho * eye.r, ss = Math.max(-1, Math.min(1, eye.s + (k * Math.sin(th) * side) / 0.55));
          const ph = side > 0 ? Math.acos(ss) : TAU - Math.acos(ss);
          uv.push(eye.u + k * Math.cos(th), 1 - (ph / TAU) * 0.75); fin.push(0, -2);
        }
      }
      for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) {
        const a = start + i * (S + 1) + j, b = a + S + 1;
        if (side > 0) idx.push(a, b, a + 1, a + 1, b, b + 1); else idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
      // Highlight: a tiny white disc lying on the lens, up and toward the snout (aFin.y = -3 makes the shader draw it white).
      const upT = new THREE.Vector3(0, 1, 0).addScaledVector(nrm, -nrm.y).normalize();
      const off = tu.clone().multiplyScalar(re * 0.28).addScaledVector(upT, re * 0.32), ol = off.length();
      const lift = Math.sqrt(Math.max(0, Rs * Rs - ol * ol)) - (Rs - hgt + sink) + re * 0.02;
      const hc = new THREE.Vector3(bodyX(t), cy, cz).addScaledVector(nrm, lift).add(off), hr = re * 0.17, h0 = pos.length / 3;
      pos.push(hc.x, hc.y, hc.z); uv.push(eye.u, 0.5); fin.push(0, -3);
      for (let j = 0; j < 8; j++) {
        const th = (j / 8) * TAU, p = hc.clone().addScaledVector(tu, Math.cos(th) * hr).addScaledVector(tv, Math.sin(th) * hr).addScaledVector(nrm, -hr * 0.2);
        pos.push(p.x, p.y, p.z); uv.push(eye.u, 0.5); fin.push(0, -3);
      }
      for (let j = 0; j < 8; j++) { const a = h0 + 1 + j, b = h0 + 1 + (j + 1) % 8; if (side > 0) idx.push(h0, b, a); else idx.push(h0, a, b); }
    }
  }
  // Exact total length: remap x so the tail tip sits at -L/2 and the snout (or beak) tip at +L/2 (a correction of a few percent at most).
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { if (pos[i] < mn) mn = pos[i]; if (pos[i] > mx) mx = pos[i]; }
  const kx = L / (mx - mn);
  for (let i = 0; i < pos.length; i += 3) pos[i] = (pos[i] - mn) * kx - L / 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aFin', new THREE.Float32BufferAttribute(fin, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geometry: geo, texture: opts.noTexture ? null : paintSkin(look), emissive: !opts.noTexture && look.paint.glow ? paintGlow(look) : null, length: L };
}

/** Manta / stingray: flat disc in the xz plane, head +x. */
export function buildRay(look) {
  const L = look.length, span = look.span;
  const RINGS = 22, SEG = 40;
  const pos = [], uv = [], idx = [];
  const outline = (theta) => {
    const c = Math.cos(theta), s = Math.sin(theta);
    if (look.kind === 'manta') {
      // Diamond with swept-back pointed wings.
      const wing = Math.pow(Math.abs(s), 1.6);
      const sweep = -Math.abs(s) * 0.35 * L;
      return [c * L * 0.5 * (1 - wing * 0.65) + sweep * wing, s * span * 0.5 * (0.55 + 0.45 * Math.pow(Math.abs(s), 0.5))];
    }
    return [c * L * 0.5, s * span * 0.5 * (1 - 0.12 * c)];
  };
  for (let r = 0; r <= RINGS; r++) {
    const rr = r / RINGS;
    for (let k = 0; k <= SEG; k++) {
      const th = (k / SEG) * TAU;
      const [ox, oz] = outline(th);
      const x = ox * rr, z = oz * rr;
      const thick = (look.thick ?? 0.12) * L * Math.sqrt(Math.max(0, 1 - rr * rr)) * (1 - 0.6 * Math.abs(Math.sin(th)) * rr);
      pos.push(x, thick * 0.5, z);
      uv.push(0.5 + x / (L * 1.2), 0.25 + z / (span * 2.2));
    }
  }
  const top = (pos.length / 3);
  for (let r = 0; r < RINGS; r++) for (let k = 0; k < SEG; k++) {
    const a = r * (SEG + 1) + k, b = a + SEG + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  // Underside
  for (let i = 0; i < top; i++) {
    pos.push(pos[i * 3], -pos[i * 3 + 1] * 0.6, pos[i * 3 + 2]);
    uv.push(uv[i * 2], uv[i * 2 + 1] + 0.5);
  }
  for (let r = 0; r < RINGS; r++) for (let k = 0; k < SEG; k++) {
    const a = top + r * (SEG + 1) + k, b = a + SEG + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // Tail: thin tapered tube along -x
  const tailL = (look.tail ?? 0.6) * L, tStart = pos.length / 3;
  const tx0 = -L * 0.45;
  for (let i = 0; i <= 10; i++) {
    const k = i / 10, rad = 0.03 * L * (1 - k) + 0.002;
    for (let j = 0; j <= 5; j++) {
      const a = (j / 5) * TAU;
      pos.push(tx0 - k * tailL, Math.cos(a) * rad, Math.sin(a) * rad); uv.push(0.05, 0.25);
    }
  }
  for (let i = 0; i < 10; i++) for (let j = 0; j < 5; j++) {
    const a = tStart + i * 6 + j, b = a + 6;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // Cephalic fins for mantas: two curled lobes at the front.
  if (look.kind === 'manta') for (const side of [-1, 1]) {
    const s0 = pos.length / 3;
    for (let i = 0; i <= 4; i++) {
      const k = i / 4;
      pos.push(L * 0.42 + k * L * 0.16, 0.0, side * L * 0.16); uv.push(0.9, 0.25);
      pos.push(L * 0.42 + k * L * 0.16, -0.06 * L * (1 - k * 0.5), side * L * 0.11); uv.push(0.9, 0.75);
    }
    for (let i = 0; i < 4; i++) { const a = s0 + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // Skin: top half v<0.5 dorsal, bottom half ventral.
  const R = 512; // crisp spots and bands on rays
  const c = document.createElement('canvas'); c.width = c.height = R;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(R, R);
  for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
    const u = x / R, v = y / R;
    const col = look.paint(u, v < 0.5 ? v * 2 : (v - 0.5) * 2, v < 0.5);
    const i = (y * R + x) * 4;
    img.data[i] = col[0] * 255; img.data[i + 1] = col[1] * 255; img.data[i + 2] = col[2] * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;
  return { geometry: geo, texture: tex, length: L };
}

export { hex };
