// Breaking-wave model shared by the wave mesh (visuals) and the surf controller (physics),
// so what you see is what you ride.
//
// The set wave travels toward the shore (+z). Its cross-section is a folded spline whose
// shape blends between three key profiles: gentle swell -> steep face -> pitching barrel.
// Along the crest (x) the wave "peels": sections to +x of the peel point have broken
// into whitewater, sections just to -x are barrelling, and the shoulder further -x is
// still steepening. A surfer rides toward -x to stay ahead of the curl.

import { clamp, lerp, smoothstep } from '../core/noise.js';

// Control points [s, y] in units of wave height H. s is distance shoreward of the crest.
const BACK = [[-5.0, 0.0], [-2.6, 0.3], [-1.1, 0.78], [0.0, 1.0]];
const SWELL = [[0.5, 0.93], [1.0, 0.75], [1.5, 0.5], [2.0, 0.28], [2.6, 0.12], [3.4, 0.03], [4.5, 0.0], [7.0, 0.0]];
const STEEP = [[0.25, 0.96], [0.5, 0.82], [0.7, 0.62], [0.85, 0.4], [1.0, 0.18], [1.3, 0.03], [2.2, 0.0], [7.0, 0.0]];
// lipOuter, lipTip, ceiling, wall, lowerWall, base, flat, far
const BARREL = [[0.78, 0.97], [1.3, 0.28], [0.78, 0.74], [0.22, 0.52], [0.34, 0.12], [1.35, -0.02], [2.4, 0.0], [7.0, 0.0]];
// Samples per spline segment (11 segments for 12 control points). Fixed so every column has the same vertex count.
const SEG_SAMPLES = [5, 6, 6, 5, 7, 6, 5, 5, 5, 4, 3];
export const PROFILE_N = SEG_SAMPLES.reduce((a, b) => a + b, 0) + 1;
const IDX_CREST = 3, IDX_TIP = 5;

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Blend the key profiles into 12 control points (metres). */
export function controlPoints(H, steep, curl, out = []) {
  out.length = 0;
  for (const [s, y] of BACK) out.push([s * H, y * H]);
  for (let i = 0; i < 8; i++) {
    const a = SWELL[i], b = STEEP[i], c = BARREL[i];
    const s = lerp(lerp(a[0], b[0], steep), c[0], curl);
    const y = lerp(lerp(a[1], b[1], steep), c[1], curl);
    out.push([s * H, y * H]);
  }
  // Crest leans forward slightly as the wave pitches.
  out[IDX_CREST][0] += 0.12 * H * curl;
  return out;
}

/**
 * Sample one cross-section into typed arrays (s, y, foam) of length PROFILE_N.
 * collapse 0..1 turns the shape into a turbulent whitewater bore.
 */
export function sampleProfile(H, steep, curl, collapse, s, y, foam, jitter = 0) {
  const cp = controlPoints(H, steep, curl, _cp);
  let k = 0;
  for (let seg = 0; seg < cp.length - 1; seg++) {
    const p0 = cp[Math.max(0, seg - 1)], p1 = cp[seg], p2 = cp[seg + 1], p3 = cp[Math.min(cp.length - 1, seg + 2)];
    const n = SEG_SAMPLES[seg];
    for (let j = 0; j < n; j++) {
      const t = j / n;
      s[k] = catmull(p0[0], p1[0], p2[0], p3[0], t);
      y[k] = catmull(p0[1], p1[1], p2[1], p3[1], t);
      // Foam: the lip tip when pitching, the whole face once collapsing.
      const lipFoam = seg >= IDX_CREST && seg <= IDX_TIP + 1 ? smoothstep(0.55, 1, curl) * (seg === IDX_TIP ? 1 : 0.5) : 0;
      foam[k] = Math.max(lipFoam, collapse * (seg >= 2 && seg <= 8 ? 1 : seg === 9 ? (1 - j / n) : 0));
      k++;
    }
  }
  const last = cp[cp.length - 1];
  s[k] = last[0]; y[k] = last[1]; foam[k] = 0;
  if (jitter) {
    // Whitewater turbulence, strongest at the top of the bore.
    for (let i = 0; i < PROFILE_N; i++) y[i] += jitter * Math.max(0, y[i]) / Math.max(H, 0.01);
  }
}
const _cp = [];

/** A single set wave. All values in metres / seconds. */
export class SetWave {
  constructor(opts = {}) {
    this.H = opts.H ?? 2.4;          // face height
    this.speed = opts.speed ?? 5.5;   // shoreward speed of the crest
    this.peel = opts.peel ?? 6.5;     // lateral speed of the peel point (toward -x)
    this.peakX = opts.peakX ?? 20;    // where it first breaks
    this.z0 = opts.z0 ?? -70;         // spawn position of the crest
    this.breakZ = opts.breakZ ?? -12; // crest z at which it starts to break (reef edge)
    this.endZ = opts.endZ ?? 55;      // fully dissipated by here (lagoon)
    this.halfWidth = opts.halfWidth ?? 140;
    this.t = 0;
  }
  get z() { return this.z0 + this.speed * this.t; }
  get tBreak() { return (this.breakZ - this.z0) / this.speed; }
  get broken() { return this.t >= this.tBreak; }
  peelX() { return this.peakX - this.peel * (this.t - this.tBreak); }
  /** Overall height envelope: grows as it shoals, fades in the lagoon. */
  heightScale() {
    const z = this.z;
    return smoothstep(this.z0, this.breakZ - 10, z) * (0.55 + 0.45 * smoothstep(this.breakZ - 30, this.breakZ, z)) *
      (1 - smoothstep(this.endZ - 35, this.endZ, z));
  }
  /** Shape parameters of the column at world x. */
  column(x, out = {}) {
    const hs = this.heightScale();
    // Taper the ends of the crest, and keep the +x side (deep channel) a fat unbroken swell.
    const ends = 1 - smoothstep(this.halfWidth * 0.65, this.halfWidth, Math.abs(x - this.peakX * 0.3));
    const channel = 1 - 0.55 * smoothstep(this.peakX + 10, this.peakX + 60, x);
    let H = this.H * hs * ends * channel;
    const d = x - this.peelX();
    const pre = this.tBreak - this.t; // seconds until first break
    const breaking = this.broken ? 1 : 0;
    // Steepening ramps up as the wave reaches the reef and near the peel point.
    let steep = clamp(smoothstep(6, 0, pre) * 0.6 + breaking * smoothstep(-55, -6, d), 0, 1);
    let curl = breaking * smoothstep(-16, -1.5, d) * (1 - smoothstep(this.peakX + 8, this.peakX + 25, x));
    let collapse = breaking * smoothstep(0.5, 9, d) * (1 - smoothstep(this.peakX + 12, this.peakX + 30, x));
    curl *= 1 - collapse;
    steep = lerp(steep, 0.55, collapse);
    H *= 1 - 0.5 * collapse;
    // Lagoon: everything relaxes into a mushy reform.
    const lag = smoothstep(this.endZ - 45, this.endZ - 10, this.z);
    curl *= 1 - lag; steep *= 1 - lag * 0.7;
    out.H = H; out.steep = steep; out.curl = curl; out.collapse = collapse; out.d = d;
    return out;
  }
  update(dt) { this.t += dt; }
}

const _s = new Float32Array(PROFILE_N), _y = new Float32Array(PROFILE_N), _f = new Float32Array(PROFILE_N);
const _col = {};

/**
 * Point on the ridable face at fraction ft (0 = base of the face, 1 = top of the ridable face).
 * Returns world z, height above still water, slope angle and column info.
 */
export function sampleFace(wave, x, ft, out = {}) {
  const c = wave.column(x, _col);
  sampleProfile(c.H, c.steep, c.curl, 0, _s, _y, _f);
  const top = lerp(c.H * 0.98, c.H * 0.6, c.curl);
  const target = clamp(ft, 0, 1) * top;
  // Walk from the base of the face back toward the crest and find where the surface reaches target height.
  const iBase = PROFILE_N - 1 - SEG_SAMPLES[10] - SEG_SAMPLES[9]; // around the base control point
  let sPos = _s[iBase], yPos = _y[iBase], slope = 0;
  for (let i = iBase; i > 0; i--) {
    const y0 = _y[i], y1 = _y[i - 1];
    if ((y0 - target) * (y1 - target) <= 0 && y1 !== y0) {
      const t = (target - y0) / (y1 - y0);
      sPos = lerp(_s[i], _s[i - 1], t); yPos = target;
      const ds = _s[i - 1] - _s[i], dy = y1 - y0;
      slope = Math.atan2(dy, -ds); // positive when the face rises toward the crest
      break;
    }
    if (i === 1) { sPos = _s[0]; yPos = _y[0]; }
  }
  out.z = wave.z + sPos; out.y = yPos; out.slope = slope; out.H = c.H; out.curl = c.curl; out.collapse = c.collapse; out.d = c.d; out.top = top;
  return out;
}

/** Height of the set wave at (x, z) for objects floating on it (single-valued lower envelope). */
export function waveHeightAt(wave, x, z) {
  const c = wave.column(x, _col);
  if (c.H < 0.01) return 0;
  sampleProfile(c.H, c.steep, Math.min(c.curl, 0.25), c.collapse, _s, _y, _f);
  const s = z - wave.z;
  if (s <= _s[0] || s >= _s[PROFILE_N - 1]) return 0;
  for (let i = 0; i < PROFILE_N - 1; i++) {
    if (s >= _s[i] && s <= _s[i + 1]) {
      const t = (s - _s[i]) / Math.max(1e-4, _s[i + 1] - _s[i]);
      return lerp(_y[i], _y[i + 1], t);
    }
  }
  return 0;
}

// Background swell shared with the GPU shader (keep in sync with water.js).
export const SWELLS = [
  // [amplitude, wavelength, dirX, dirZ, speedScale]
  [0.22, 38, 0.15, 1.0, 1.0],
  [0.12, 21, -0.35, 0.94, 1.0],
  [0.07, 11, 0.6, 0.8, 1.0],
  [0.04, 6.5, -0.7, 0.7, 1.0],
];
export function swellHeight(x, z, t, calm = 1) {
  let h = 0;
  for (const [a, L, dx, dz] of SWELLS) {
    const k = (2 * Math.PI) / L, w = Math.sqrt(9.81 * k);
    const len = Math.hypot(dx, dz);
    h += a * calm * Math.sin(k * (x * dx / len + z * dz / len) - w * t);
  }
  return h;
}
