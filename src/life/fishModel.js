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
/** Fill a canvas skin. painter(u, s, part, f) returns [r,g,b] 0..1. */
function paintSkin(look, W = 512, H = 512) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const p = look.paint;
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
          // The same hand-painted anatomy on every fish: soft scale rows, a dark-teal gill-cover arc and a mouth line (look.mouth { len, s }), plus a faint lateral line.
          const sc = 0.97 + 0.03 * Math.sin(u * 220 + (Math.floor(v * 80) % 2) * 1.6) * Math.sin(v * 300);
          const gillU = (look.gill ?? 0.8) - 0.03 * s * s;
          const onGill = Math.abs(u - gillU) < 0.0045 && Math.abs(s) < 0.8;
          const mo = look.mouth ?? { len: 0.07, s: -0.12 };
          const onMouth = u > 1 - mo.len && Math.abs(s - (mo.s + (1 - u) * 0.8)) < 0.035;
          const lat = Math.abs(s - 0.3 - 0.1 * Math.sin(u * 3)) < 0.01 && u > 0.2 && u < 0.8 && !look.noLateral;
          const k = sc * (lat ? 0.94 : 1);
          col = [col[0] * k, col[1] * k, col[2] * k];
          if (onGill) col = mix3(col, INK, 0.5);
          if (onMouth) col = mix3(col, INK, 0.85);
        }
        col = tone(col);
      } else {
        const fv = (v - 0.75) / 0.25;
        const part = fv < 0.25 ? 'dorsal' : fv < 0.5 ? 'anal' : fv < 0.75 ? 'tail' : 'pectoral';
        const f = (fv % 0.25) / 0.25;
        col = p.fin ? p.fin(u, part, f) : p.body(u, 0.2, 1);
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

/** Build fish geometry. Returns { geometry, texture, length }.
 *  opts.flatTail: spread the tail fin flat (horizontal), as it lies on a brag mat: used for the top-down picture of flat-bodied fish.
 *  look.cephalopod ('squid' | 'cuttle'): see life/cephalopod.js. look.hump: forehead hump. look.lips: thick lips. */
export function buildFish(look, opts = {}) {
  if (look.cephalopod) return buildCephalopod(look, opts);   // squid and cuttlefish have their own model (life/cephalopod.js)
  const L = look.length;
  const tailFrac = look.tailFrac ?? 0.2;
  const armsL = 0;
  const bodyLen = L * (1 - tailFrac) - armsL;
  const C = cosy();
  const depth = look.depth * L, width = look.width * L * (C ? 1.18 : 1);
  const RINGS = C ? 32 : 26, SEG = C ? 24 : 18;
  const pos = [], uv = [], idx = [], fin = []; // fin: (k along fin base, 0 base..1 edge); body (0,-1); eye (0,-2)
  const x0 = -L / 2 + tailFrac * L;
  const superE = look.boxy ?? 2; // cross-section superellipse exponent
  const bodyX = t => x0 + t * bodyLen;
  // Body
  for (let r = 0; r <= RINGS; r++) {
    const t = r / RINGS;
    const prof = bodyProfile(t, look);
    // Snout tip closes; tail end stays open as the peduncle.
    const close = t > 0.97 ? Math.sqrt(Math.max(0, (1 - t) / 0.03)) : 1;
    const hh = depth * 0.5 * prof * close, ww = width * 0.5 * prof * close;
    const yOff = (look.belly ?? 0) * depth * prof * 0.15;
    for (let s = 0; s <= SEG; s++) {
      const phi = (s / SEG) * TAU;
      const c = Math.cos(phi), sn = Math.sin(phi);
      const ex = 2 / superE;
      // look.hump { at, h, w }: a forehead hump (the male blue groper's bulbous brow): the back of the head rises in a smooth bump.
      const hump = look.hump ? look.hump.h * depth * Math.exp(-(((t - look.hump.at) / look.hump.w) ** 2)) * Math.max(0, c) * close : 0;
      const y = Math.sign(c) * Math.pow(Math.abs(c), ex) * hh - yOff * (c < 0 ? 1 : 0) + hump;
      const z = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * ww;
      pos.push(bodyX(t), y, z);
      uv.push(t, 1 - (s / SEG) * 0.75); fin.push(0, -1);
    }
  }
  for (let r = 0; r < RINGS; r++) for (let s = 0; s < SEG; s++) {
    const a = r * (SEG + 1) + s, b = a + SEG + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  // Fins: thin double-sided sheets. Each is a strip from base curve to edge curve.
  const addFin = (base, edge, n, vBand, uOf) => {
    const vertical = C && [0.25, 0.5, 0.75].every(k => Math.abs(base(k)[2]) < 1e-6 && Math.abs(edge(k)[2]) < 1e-6);
    if (vertical) {
      // Two layers (z = +t and -t), thickest at the base and tapering to a rounded edge.
      const T = Math.max(0.004, L * 0.022), M = 3, start = pos.length / 3;
      for (const sd of [1, -1]) for (let i = 0; i <= n; i++) {
        const k = i / n, b = base(k), e = edge(k), endK = Math.sin(Math.PI * Math.min(1, 0.06 + k * 0.94));
        for (let j = 0; j <= M; j++) {
          const f = j / M, th = T * Math.sqrt(Math.max(0, 1 - f * f)) * (0.35 + 0.65 * endK);
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
      const k = i / n;
      const b = base(k), e = edge(k);
      pos.push(b[0], b[1], b[2]); uv.push(uOf(k), 1 - (0.75 + (vBand + 0.02) * 0.25)); fin.push(k, 0);
      pos.push(e[0], e[1], e[2]); uv.push(uOf(k), 1 - (0.75 + (vBand + 0.23) * 0.25)); fin.push(k, 1);
    }
    for (let i = 0; i < n; i++) {
      const a = start + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  };
  const halfH = t => depth * 0.5 * bodyProfile(t, look);
  // Dorsal fin(s): look.dorsal (the first, spiny one when there are two) and look.dorsal2 (the soft-rayed second one). shape: round | tri (spiny) | sail | dual (tall spiny front, low soft rear).
  for (const dd of [look.dorsal, look.dorsal2]) if (dd) {
    const { from, to, height, shape = 'round', streamer = 0 } = dd;
    addFin(
      k => { const t = from + (to - from) * k; return [bodyX(t), halfH(t) * 0.92, 0]; },
      k => {
        const t = from + (to - from) * k;
        let hgt = height * L * (shape === 'tri' ? Math.pow(Math.max(0, 1 - Math.abs(k - 0.7) / 0.7), 1.3) : shape === 'sail' ? Math.sin(Math.PI * Math.pow(k, 0.6)) : shape === 'dual' ? (k > 0.45 ? Math.pow(Math.sin(Math.PI * (0.5 + 0.5 * (k - 0.45) / 0.55 * 0.85)), 0.9) * (1 - 0.1 * (k - 0.45)) : 0.3 + 0.4 * k / 0.45) : Math.sin(Math.PI * k) ** 0.6);
        let back = 0;
        if (streamer && k > 0.6) { hgt += streamer * L * Math.pow((k - 0.6) / 0.4, 2) * 0.4; back = -streamer * L * Math.pow((k - 0.6) / 0.4, 1.5); }
        if (shape === 'tri' || shape === 'dual') back -= height * L * 0.35 * k;
        return [bodyX(t) + back, halfH(t) * 0.9 + hgt, 0];
      }, 10, 0, k => from + (to - from) * k);
  }
  // Finlets (look.finlets { from, to, n, h, top, bottom }): the row of small separate fins behind the dorsal and anal of mackerel, bonito and scad-like fish.
  if (look.finlets) {
    const { from, to, n, h, top = true, bottom = true } = look.finlets;
    for (const sd of [top ? 1 : 0, bottom ? -1 : 0]) if (sd) addFin(
      k => { const t = from + (to - from) * k; return [bodyX(t), sd * halfH(t) * 0.92, 0]; },
      k => { const t = from + (to - from) * k, ph = (k * n) % 1; return [bodyX(t) - h * L * 0.7 * ph, sd * (halfH(t) * 0.9 + h * L * (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, ph * 1.15)) ** 0.7)), 0]; },
      n * 3, 0, k => from + (to - from) * k);
  }
  if (look.anal) {
    const { from, to, height } = look.anal;
    addFin(
      k => { const t = from + (to - from) * k; return [bodyX(t), -halfH(t) * 0.92, 0]; },
      k => { const t = from + (to - from) * k; return [bodyX(t) - height * L * 0.3 * k, -halfH(t) * 0.9 - height * L * Math.sin(Math.PI * k) ** 0.6, 0]; },
      8, 0.25, k => from + (to - from) * k);
  }
  // Caudal fin (vertical for fish/sharks; horizontal flukes for marine mammals)
  if (look.tail === 'fluke') {
    const span = (look.tailSpan ?? 1) * L * 0.14, tl = tailFrac * L, xb = x0 + 0.005;
    addFin(
      k => [xb, 0, (k - 0.5) * width * 0.25],
      k => { const z = (k - 0.5) * 2; return [xb - tl * (0.35 + 0.65 * Math.pow(Math.abs(z), 0.7)) + (Math.abs(z) < 0.12 ? tl * 0.15 : 0), 0, z * span]; },
      12, 0.5, k => 0.03);
  } else if (look.tail !== 'none') {
    const tail = look.tail ?? 'forked';
    const span = (look.tailSpan ?? 1) * depth * 0.55 + L * 0.05;
    const tl = tailFrac * L;
    const xb = x0 + 0.005;
    const n = 12;
    const flat = !!opts.flatTail;
    addFin(
      k => (flat ? [xb, 0, (k - 0.5) * Math.max(depth, width * 0.5) * 0.5 * (look.peduncle ?? 0.14) * 1.4] : [xb, (k - 0.5) * depth * 0.5 * (look.peduncle ?? 0.14) * 1.4, 0]),
      k => {
        const y = (k - 0.5) * 2; // -1..1
        let x;
        if (tail === 'forked') x = xb - tl * (0.42 + 0.58 * Math.pow(Math.abs(y), 0.9));
        else if (tail === 'lunate') x = xb - tl * (0.45 + 0.55 * Math.pow(Math.abs(y), 0.6));
        else if (tail === 'round') x = xb - tl * (1 - 0.35 * y * y);
        else if (tail === 'heterocercal') x = xb - tl * (y > 0 ? 0.4 + 0.6 * Math.pow(y, 0.7) : 0.35 + 0.35 * Math.pow(-y, 0.8));
        else x = xb - tl * (1 - 0.14 * Math.pow(Math.abs(y), 2.4)); // truncate: a nearly straight edge with softly rounded corners (never forked)
        let yy = y * span;
        if (tail === 'heterocercal') yy = y > 0 ? y * span * 1.15 + tl * 0.25 * y : y * span * 0.6;
        return flat ? [x, 0, yy] : [x, yy, 0];
      }, n, 0.5, k => 0.02 + 0.06 * Math.abs(k - 0.5));
  }
  // Small tapered tubes for the garfish's beak and the carp's barbels (uvAt(k) picks the painted colour along the tube).
  const spike = (p0, p1, r0, r1, n, side, uvAt) => {
    const start = pos.length / 3, d = new THREE.Vector3().subVectors(p1, p0), nz = new THREE.Vector3(0, 0, 1), ny = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= n; i++) {
      const k = i / n, r = r0 + (r1 - r0) * k, c = p0.clone().addScaledVector(d, k);
      for (let j = 0; j < 5; j++) { const q = (j / 5) * TAU; pos.push(c.x, c.y + Math.cos(q) * r * ny.y, c.z + Math.sin(q) * r * nz.z); uv.push(...uvAt(k)); fin.push(0, -1); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < 5; j++) { const a0 = start + i * 5 + j, a1 = start + i * 5 + (j + 1) % 5; idx.push(a0, a0 + 5, a1, a1, a0 + 5, a1 + 5); }
  };
  if (look.beak) spike(new THREE.Vector3(bodyX(1) - 0.012 * L, -depth * 0.07, 0), new THREE.Vector3(bodyX(1) + look.beak * L, -depth * 0.09, 0), width * 0.12, width * 0.03, 5, 1, k => [k < 0.6 ? 0.8 : 0.97, 0.3]);
  if (look.barbels) for (const side of [-1, 1]) for (let b = 0; b < look.barbels; b++) {
    const x1 = bodyX(1) - 0.012 * L, y1 = -depth * 0.12, z1 = side * width * (0.1 + b * 0.05);
    spike(new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x1 + 0.03 * L * (1 - b * 0.35), y1 - 0.025 * L, z1 + side * 0.014 * L), L * 0.0035, L * 0.0012, 2, side, () => [0.6, 0.62]);
  }
  // Wobbegong tassels: a fringe of branching skin flaps along each side of the head (look.tassels = how many).
  if (look.tassels) for (const side of [-1, 1]) {
    const n = look.tassels, len = 0.04 * L, tt = k => 0.98 - 0.26 * k;
    addFin(
      k => { const t = tt(k); return [bodyX(t), -depth * 0.06, side * width * 0.5 * bodyProfile(t, look) * 0.97]; },
      k => { const t = tt(k), ph = (k * n) % 1, saw = 0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, ph * 1.1)) ** 0.8; return [bodyX(t) + len * 0.35 * saw, -depth * 0.06 - len * 0.25 * saw, side * (width * 0.5 * bodyProfile(t, look) * 0.97 + len * saw)]; },
      n * 3, 0.75, () => 0.9);
  }
  // Thick lips: two soft pads at the front of the jaws.
  if (look.lips) {
    const x1 = bodyX(1), r = depth * 0.1, S = 10, R = 6;
    for (const [dy, rx, ry, rz] of [[-depth * 0.045, r * 1.15, r * 0.62, r * 1.0], [-depth * 0.13, r * 1.05, r * 0.6, r * 0.9]]) {
      const start = pos.length / 3;
      for (let i = 0; i <= R; i++) for (let j = 0; j <= S; j++) {
        const a = (i / R) * Math.PI, th = (j / S) * TAU;
        pos.push(x1 - rx * 0.55 + Math.cos(a) * rx, dy + Math.sin(a) * Math.sin(th) * ry, Math.sin(a) * Math.cos(th) * rz); uv.push(0.9, 0.8); fin.push(0, -1);
      }
      for (let i = 0; i < R; i++) for (let j = 0; j < S; j++) { const a0 = start + i * (S + 1) + j, b0 = a0 + S + 1; idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0); }
    }
  }
  // Pectoral fins (pair)
  const pecL = (look.pectoral ?? 0.12) * L;
  if (pecL > 0) for (const side of [-1, 1]) {
    const t0 = look.pecAt ?? 0.72;
    const bx = bodyX(t0), wz = width * 0.5 * bodyProfile(t0, look) * side;
    const by = -depth * 0.12;
    const wing = look.pecWing ?? 0;
    addFin(
      k => [bx - k * pecL * 0.25, by + (k - 0.5) * pecL * 0.35, wz],
      // Swept, tapering fin: the trailing edge is shorter than the base and the tip points back toward the tail.
      k => { const tipK = 1 - k; return [bx - pecL * (0.45 + 0.55 * k) - wing * pecL * (0.25 + 0.35 * k), by + (k - 0.5) * pecL * 0.12 - pecL * 0.2 - wing * pecL * 0.15, wz + side * pecL * (0.3 + wing * 1.05) * (0.45 + 0.55 * tipK)]; },
      4, 0.75, k => t0);
  }
  // Pelvic fins (pair): small, tucked under the belly just behind the pectorals (none on flatfish-shaped or eel-like models: look.pelvic = 0).
  const pelL = (look.pelvic ?? 0.07) * L;
  if (pelL > 0) for (const side of [-1, 1]) {
    const t0 = look.pelAt ?? Math.max(0.5, (look.pecAt ?? 0.72) - 0.04);
    const bx = bodyX(t0), pr = bodyProfile(t0, look), wz = width * 0.5 * pr * 0.42 * side, by = -depth * 0.5 * pr * 0.93 + (look.belly ?? 0) * depth * pr * -0.15;
    addFin(
      k => [bx - k * pelL * 0.35, by, wz],
      k => [bx - pelL * (0.35 + 0.6 * k), by - pelL * (0.65 - 0.25 * k), wz * 1.6],
      3, 0.75, k => t0);
  }
  // Eyes: one construction for every species. A flat lens set INTO the head (its rim sunk below the skin, only the middle clears it by ~0.2 of the eye radius), its UVs wrapped onto the
  // painted rim + iris + pupil (looks.js withEye), plus a small white highlight sitting on the lens. Size comes from the painted radius (a real proportion per species), never from a bulge.
  const eye = look.paint.body?.eye;
  if (eye && !look.noEyeDome) {
    const t = eye.u, prof = bodyProfile(t, look), ex = 2 / superE;
    const hh = depth * 0.5 * prof, ww = width * 0.5 * prof;
    const re = eye.r * bodyLen, R = 5, S = 14;
    const hgt = re * (look.eyeRaise ?? 0.3), sink = re * 0.14;
    const Rs = (re * re + hgt * hgt) / (2 * hgt), amax = Math.asin(Math.min(0.999, re / Rs));
    for (const side of [1, -1]) {
      const phi0 = side > 0 ? Math.acos(Math.max(-1, Math.min(1, eye.s))) : TAU - Math.acos(Math.max(-1, Math.min(1, eye.s)));
      const c = Math.cos(phi0), sn = Math.sin(phi0);
      const cy = Math.sign(c) * Math.pow(Math.abs(c), ex) * hh, cz = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * ww;
      const nrm = new THREE.Vector3(0, cy / Math.max(1e-4, hh * hh), cz / Math.max(1e-4, ww * ww)).normalize();
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
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aFin', new THREE.Float32BufferAttribute(fin, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geometry: geo, texture: paintSkin(look), emissive: look.paint.glow ? paintGlow(look) : null, length: L };
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
