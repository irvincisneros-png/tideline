// The layout of Bellambi, NSW, traced from the real coastline (a satellite view, north up, about 1.5 km across) and squeezed into a diorama: 1 game metre is
// about 6.6 real metres along the shore, and the beaches are a little wider than life so there is room to walk and fish.
//
// Real Bellambi: Bellambi Beach is a long sandy beach that curves down from the north-west and bends round into the NORTH side of Bellambi Point, where it
// meets a small sheltered cove with the boat ramp (sandy, calm, dark weed reef in the shallows). The point is a low headland that hooks out to the EAST:
// a grassy reserve with a car park, and a low rock platform fringing its seaward tip. Bellambi Rock Pool is a stone-walled ocean pool on the rocky outcrop on
// the beach north of the ramp cove. South of the point a second beach curves away south-west with Bellambi Lagoon and bushland behind it. Breaking reef
// ("Bellambi Reef") lies well out to the south-east. The sea is to the EAST.
//
// Frame: the map's own axes are u = east and v = south (metres). The WORLD axes are turned a quarter so that the sea is toward -z (the way the game always
// looked): world x = v (south), world z = -u (west). So east is -z, north is -x, and the land is toward +z.
import { smoothstep, lerp, clamp, makeNoise } from '../core/noise.js';
import { smoothPath, Path, DistField } from './shape.js';

export const FRAME = { toMap: (x, z) => [-z, x], toWorld: (u, v) => [v, -u] };
const K = 0.3;   // metres per satellite pixel
/** World [x, z] of a pixel (px, py) of the 800 x 600 satellite view (north up, origin near the ramp cove). */
export const fromPx = (px, py) => [(py - 330) * K, -(px - 330) * K];
/** The pixel of a world point (the opposite of fromPx). */
export const toPx = (x, z) => [330 - z / K, 330 + x / K];

// The waterline, from the north end of the beach down to the south (the sea is on the east side, the land on the west).
const SHORE_PX = [[92, -150], [100, -60], [118, 10], [124, 60], [132, 100], [146, 140], [162, 172], [190, 196], [222, 205], [240, 222], [250, 245], [254, 270], [264, 300], [284, 326], [312, 346], [345, 358],
  [380, 358], [405, 344], [418, 330], [440, 322], [465, 318], [488, 324], [500, 340], [500, 362], [490, 392], [472, 424], [447, 456], [418, 486], [388, 510], [358, 534], [333, 564], [312, 600], [298, 660], [290, 760]];
const TAIL = 260;
const core = smoothPath(SHORE_PX.map(([a, b]) => fromPx(a, b)), 3);
const extend = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [b[0] + (b[0] - a[0]) / l * TAIL, b[1] + (b[1] - a[1]) / l * TAIL]; };
const north = extend(core[3], core[0]), south = extend(core[core.length - 4], core[core.length - 1]);
export const SHORE_PTS = [north, ...core, south];
/** The waterline as a path (arc length s runs from the north to the south). */
export const SHORE = new Path(SHORE_PTS);
const FIELD = new DistField([...SHORE_PTS, [south[0], 1200], [north[0], 1200]], { half: 190, cell: 0.8 });
/** Signed distance from the waterline, in metres: positive on the land (west), negative in the sea. */
export const shoreD = (x, z) => FIELD.at(x, z);
export const shoreS = (x, z) => FIELD.arc(x, z);
/** The unit vectors at arc length s: t along the shore (southward), n toward the SEA, l toward the LAND. */
export function frameAt(s) { const p = SHORE.at(s); return { x: p.x, z: p.z, tx: p.tx, tz: p.tz, nx: p.tz, nz: -p.tx, lx: -p.tz, lz: p.tx }; }
/** A point at arc length s along the waterline and `off` metres inland (negative = into the sea). */
export function beachAt(s, off = 0) { const f = frameAt(s); return { ...f, x: f.x + f.lx * off, z: f.z + f.lz * off }; }
const sNear = (px, py) => { const [x, z] = fromPx(px, py); return SHORE.nearest(x, z).s; };

// ---------------------------------------------------------------- landmarks along the beach
export const S_TOWER = sNear(166, 178);       // the lifeguard tower: the open surf beach, north of the rock pool
export const S_POOL = sNear(240, 222);        // Bellambi Rock Pool
export const S_RAMP = sNear(410, 338);        // the boat ramp, in the lee of the point
export const S_TIP = sNear(500, 345);         // the tip of Bellambi Point
export const S_PT0 = sNear(430, 327), S_PT1 = sNear(484, 430);   // the rock platform runs from the ramp neck round the tip and down the seaward side
export const S_BEACH_N = sNear(135, 100), S_BEACH_S = sNear(312, 600);
export const S_ACCESS = S_TOWER - 20;       // the beach access path (and the way home)
export const TOWER = (() => { const b = beachAt(S_TOWER, 9); return { x: b.x, z: b.z, rot: Math.atan2(b.nx, b.nz) }; })();
export const BOARD = (() => { const b = beachAt(S_TOWER + 9, 25); return { x: b.x, z: b.z }; })();
export const HOME = (() => { const b = beachAt(S_ACCESS, 27); return { x: b.x, z: b.z, r: 6, label: 'the beach access path', at: b }; })();
export const SPAWN = (() => { const b = beachAt(S_TOWER + 7, 10); return { x: b.x, z: b.z, yaw: Math.atan2(-b.nx, -b.nz) }; })();   // yaw: the camera's turn; yaw 0 looks toward -z
/** Points on the beach for the people and the animals: [{ x, z }] by name. */
export const BEACH_SPOTS = {
  litterA: beachAt(S_TOWER - 30, 7), litterB: beachAt(S_TOWER + 22, 7), litterC: beachAt(S_POOL + 30, 7), litterD: beachAt(S_RAMP - 28, 8),
  gutter: beachAt(S_TOWER + 40, 1.2), gutter2: beachAt(S_TOWER - 8, 1.2), patrolA: beachAt(S_TOWER - 45, 6), patrolB: beachAt(S_POOL + 40, 6),
};

// ---------------------------------------------------------------- the rock platform on the point
const noise = makeNoise(77);
/** How far the platform reaches out to sea (metres) at arc length s: wide at the tip, narrower on the flanks, ragged. */
export const platW = (s, x, z) => 7 + 13 * Math.exp(-Math.pow((s - S_TIP) / 30, 2)) + 3.6 * noise.n2(x * 0.09, z * 0.09);
/** 0..1: how much of the rock platform is at (x, z). Irregular: it follows the point's outer edge, wider at the tip. */
export function platformMask(x, z) {
  const d = shoreD(x, z); if (d > 9 || d < -18) return 0;
  const s = shoreS(x, z); if (s < S_PT0 - 12 || s > S_PT1 + 10) return 0;
  const W = platW(s, x, z);
  return smoothstep(-W - 1.4, -W + 1.2, d) * smoothstep(S_PT0 - 10, S_PT0 + 10, s) * (1 - smoothstep(S_PT1 - 10, S_PT1 + 8, s)) * (1 - smoothstep(3, 9, d));
}
/** Snap v (0..1) to n flat steps; k sets how sharp the risers are (smaller = sharper). */
function terrace(v, n, k) { const f = clamp(v, 0, 0.9999) * n, i = Math.floor(f); return (i + smoothstep(0.5 - k, 0.5 + k, f - i)) / n; }
/** 0..1: thin cracks and joints in the sandstone. */
export function crackAt(x, z) {
  const a = 1 - Math.abs(noise.n2(x * 0.19 + 11, z * 0.23)), b = 1 - Math.abs(noise.n2(x * 0.31 - 5, z * 0.17 + 9));
  return smoothstep(0.93, 0.985, Math.max(a, b * 0.97)) * smoothstep(0.4, 0.8, platformMask(x, z));
}
/** Pools on the platform: [x, z, r], placed at fixed fractions of the platform's length and depth. */
export const POOLS = [[0.05, 5.5, 2.4], [0.12, 9, 3.2], [0.2, 4, 2.0], [0.27, 8, 2.8], [0.34, 3.5, 2.2], [0.42, 7, 3.4], [0.5, 4.5, 1.9], [0.57, 8.5, 2.6], [0.65, 3.8, 2.3], [0.72, 6, 3.0], [0.8, 3.4, 2.0], [0.9, 5, 2.4]].map(([f, off, r]) => {
  const b = beachAt(S_PT0 + 6 + f * (S_PT1 - S_PT0 - 12), -off * 0.8); return [b.x, b.z, r];
});
export function platformHeight(x, z) {
  const d = shoreD(x, z), s = shoreS(x, z), W = platW(s, x, z), q = (d + W) / (W + 4);        // q: 0 at the seaward edge, 1 inland
  let h = 0.35 + 0.5 * smoothstep(0, 1, q);
  const ledge = 0.5 + noise.fbm2(x * 0.05 + 3, z * 0.055, 3) * 1.1;
  h += terrace(ledge, 4, 0.06) * 0.95 - 0.2 + noise.fbm2(x * 0.6, z * 0.6, 2) * 0.04;
  h -= crackAt(x, z) * 0.14;
  h -= Math.pow(Math.max(0, Math.sin(x * 0.21 + z * 0.19 + noise.n2(x * 0.05, z * 0.05) * 2)), 12) * 0.5;   // gutters
  h -= (1 - smoothstep(0, 0.16, q)) * 3.0;                                                                  // the seaward edge drops into the swell
  for (const [px, pz, r] of POOLS) { const e = Math.hypot(x - px, z - pz) / (r * 1.3 * (1 + 0.16 * noise.n2(x * 0.4, z * 0.4))); if (e < 1) h -= 1.45 * (1 - e * e); }
  return h;
}

// ---------------------------------------------------------------- Bellambi Rock Pool and the boat ramp
/** Bellambi Rock Pool: a stone-walled ocean pool on a low outcrop at the water's edge. Local axes: a along the shore, b out to sea from the waterline. */
export const ROCKPOOL = (() => { const f = frameAt(S_POOL); return { ...f, halfA: 7.2, b0: 1.2, b1: 8.2, out: { a: 13.5, b0: -3, b1: 12.5 } }; })();
export function poolLocal(x, z) { const P = ROCKPOOL, dx = x - P.x, dz = z - P.z; return { a: dx * P.tx + dz * P.tz, b: dx * P.nx + dz * P.nz }; }
/** 0..1 the low outcrop the pool sits on. */
export function outcropMask(x, z) {
  const { a, b } = poolLocal(x, z), O = ROCKPOOL.out;
  if (Math.abs(a) > O.a + 3 || b < O.b0 - 3 || b > O.b1 + 3) return 0;
  const edge = 2.2 + noise.n2(x * 0.3, z * 0.3) * 0.9;
  return smoothstep(O.a + edge, O.a - edge, Math.abs(a)) * smoothstep(O.b0 - edge, O.b0 + edge, b) * smoothstep(O.b1 + edge, O.b1 - edge, b);
}
/** The pool itself: the basin floor, a wall 0.65 m proud of the water around it, and the ledge outside the wall; null away from it. */
export function poolHeight(x, z) {
  const { a, b } = poolLocal(x, z), P = ROCKPOOL;
  const ox = Math.max(Math.abs(a) - P.halfA, P.b0 - b, b - P.b1);            // < 0 inside the pool, > 0 outside (a box distance)
  if (ox > 3.4) return null;
  if (ox < -0.3) return -1.15 + noise.n2(x * 0.5, z * 0.5) * 0.08;
  return lerp(lerp(-1.15, 0.65, smoothstep(-0.3, 0.9, ox)), 0.3, smoothstep(2.1, 3.4, ox));   // a broad wall (a few grid cells wide, so it stays smooth)
}
/** The low outcrop the pool is built on: { m (how much), h (the height there) }, or null away from it. */
export function outcropHeight(x, z) {
  const m = outcropMask(x, z); if (m <= 0) return null;
  const p = poolHeight(x, z);
  return { m, h: p ?? 0.3 + noise.fbm2(x * 0.3, z * 0.3, 2) * 0.12 };
}
/** The concrete boat ramp, running from the beach out into the cove. */
export const RAMP = (() => {
  const f = frameAt(S_RAMP), len = 17, w = 6.4, st = beachAt(S_RAMP, 3.5);
  return { ...f, x0: st.x, z0: st.z, len, w, hStart: 1.0, hEnd: -1.0 };
})();
export function rampLocal(x, z) { const R = RAMP, dx = x - R.x0, dz = z - R.z0; return { a: dx * R.nx + dz * R.nz, b: dx * R.tx + dz * R.tz }; }   // a: out to sea from the ramp's top, b: across it
/** 0..1: the ramp's footprint (soft edge). */
export function rampMask(x, z) {
  const { a, b } = rampLocal(x, z), R = RAMP;
  return smoothstep(R.w / 2 + 0.9, R.w / 2 - 0.1, Math.abs(b)) * smoothstep(-1.6, -0.2, a) * smoothstep(R.len + 1.4, R.len - 0.2, a);
}
export const rampHeight = (x, z) => { const { a } = rampLocal(x, z), R = RAMP; return lerp(R.hStart, R.hEnd, clamp(a / R.len, 0, 1)) + 0.02; };

// ---------------------------------------------------------------- the cove, the reefs and the lagoon
/** 1 across the cove and the point (the low reserve, no dunes), 0 on the long beaches north and south of it: a smooth function of position. */
export function pointMask(x, z) { const py = toPx(x, z)[1]; return smoothstep(250, 310, py) * (1 - smoothstep(470, 540, py)); }
/** 1 in the sheltered cove in the lee of the point (calm, sandy, shallow), 0 elsewhere. */
export function coveAt(x, z) {
  const [px, py] = toPx(x, z), r = Math.hypot((px - 385) / 125, (py - 290) / 82);
  return 1 - smoothstep(0.55, 1, r);
}
/** Dark weedy reef patches in the shallows off the beach and the cove: [px, py, radius px]. */
export const PATCHES_PX = [[262, 106, 26], [292, 168, 34], [318, 262, 32], [372, 284, 40], [412, 302, 24], [452, 300, 22], [536, 380, 30], [488, 460, 28]];
export function patchAt(x, z) {
  const [px, py] = toPx(x, z); let m = 0;
  for (const [cx, cy, r] of PATCHES_PX) { const e = Math.hypot(px - cx, py - cy) / (r * (1 + 0.28 * noise.n2(px * 0.05, py * 0.05))); m = Math.max(m, 1 - smoothstep(0.55, 1, e)); }
  return m;
}
/** Where the rocky reef and the kelp forest are: a lobe of boulders to the east and south-east of the point, out in deeper water. */
export const REEF_LOBE = { x: 38, z: -92, r: 62 };
export const BREAKER = { x: 66, z: -116, r: 15 };   // Bellambi Reef: the shoal where the swell breaks
/** The lagoon behind the south beach. */
export const LAGOON = (() => { const [x, z] = fromPx(118, 566); return { x, z, rx: 13, rz: 10 }; })();
export function lagoonMask(x, z) { const e = Math.hypot((x - LAGOON.x) / LAGOON.rx, (z - LAGOON.z) / LAGOON.rz); return 1 - smoothstep(0.6, 1, e + noise.n2(x * 0.1, z * 0.1) * 0.12); }
/** The gully bushland behind the south beach (dark green), 0..1. */
export function bushAt(x, z) { const [px, py] = toPx(x, z); return 1 - smoothstep(0.7, 1.1, Math.hypot((px - 270) / 110, (py - 545) / 80 + noise.n2(px * 0.03, py * 0.03) * 0.15)); }
/** The car park on the point: [x, z, half width x, half depth z]. */
export const CARPARK = (() => { const [x, z] = fromPx(412, 384); return { x, z, hx: 7, hz: 5 }; })();
/** 0..1: the streets of houses behind the beaches (the suburb north of the point along the foreshore reserve, a shorter row behind the south beach). Flat ground for the houses and a road. */
export function townAt(x, z) {
  const d = shoreD(x, z), s = shoreS(x, z);
  const band = smoothstep(33, 40, d) * (1 - smoothstep(62, 70, d));
  const north = smoothstep(S_BEACH_N - 90, S_BEACH_N - 70, s) * (1 - smoothstep(S_POOL + 10, S_POOL + 30, s));
  const south = smoothstep(S_PT1 + 20, S_PT1 + 40, s) * (1 - smoothstep(S_BEACH_S + 20, S_BEACH_S + 40, s)) * (1 - smoothstep(0.2, 0.6, bushAt(x, z)));
  return band * Math.max(north, south) * (1 - pointMask(x, z));
}
