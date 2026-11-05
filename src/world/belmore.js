// The layout of Belmore Basin and Wollongong Harbour, traced from the real place (a satellite view, north up, ~400 m across) and squeezed to about 70% of life size.
//
// Real Belmore Basin: a small, almost enclosed, stone-walled rectangular basin (the fishing harbour: trawlers and charter boats moored along its walls, the Wollongong
// Fishing Co-op on the north-east side) opening to the west into a larger OUTER HARBOUR. The outer harbour is closed off to the north and east by a long rubble BREAKWATER
// that runs from the headland north-west to the old breakwater LIGHTHOUSE. Cove Beach is a small sandy beach on the west side of the outer harbour; a short timber jetty
// pokes out near the restaurants on the south side of the basin mouth; FLAGSTAFF HILL (grassy, with the Flagstaff Point lighthouse) rises to the east and south-east.
//
// World axes are the real ones: north is -z (up the map), east is +x. (x, z) = ((px - 480) * 0.35, (py - 320) * 0.35) for a pixel of the satellite view.
// The working quay (the basin's north-east wall, with the co-op, the timber wharf and its lamps) is laid out in a QUAY FRAME that is a plain rotation of the
// world: xo runs along the quay toward the basin mouth (west-south-west), zo runs inland from the water's edge (the quay edge is zo = 40, the water is zo < 40).
import { smoothstep, lerp, clamp, makeNoise } from '../core/noise.js';
import { Path, DistField, smoothPath } from './shape.js';

const K = 0.35;
/** World [x, z] of a pixel (px, py) of the 800 x 600 satellite view. */
export const fromPx = (px, py) => [(px - 480) * K, (py - 320) * K];

// ---------------------------------------------------------------- the quay frame
const AL = Math.hypot(-270, 120), AX = -270 / AL, AZ = 120 / AL;        // along the quay (toward the mouth)
export const QA = [AX, AZ], QN = [-AZ, AX];                               // QN: inland (away from the water)
export const QO = fromPx(480, 274);                                      // world position of the quay frame's (0, 40)
export const QROT = Math.atan2(QN[0], QN[1]);                             // a prop placed at rot 0 in the frame faces +zo; add this to turn it with the frame
export const QUAY_Z = 40;
/** Quay frame (xo, zo) -> world [x, z]. */
export const T = (xo, zo) => [QO[0] + xo * QA[0] + (zo - QUAY_Z) * QN[0], QO[1] + xo * QA[1] + (zo - QUAY_Z) * QN[1]];
/** World (x, z) -> quay frame { a: xo, b: zo }. */
export const toQuay = (x, z) => ({ a: (x - QO[0]) * QA[0] + (z - QO[1]) * QA[1], b: QUAY_Z + (x - QO[0]) * QN[0] + (z - QO[1]) * QN[1] });

/** The basin in the quay frame: closed on the north-east (zo = 40), south-east (zo = 4) and east (xo = -40) sides, open to the outer harbour beyond xo = 60. */
export const BASIN = { a0: -40, a1: 60, b0: 4, b1: 40 };

// ---------------------------------------------------------------- the breakwater (its crest) and the lighthouse
const BW_PX = [[860, 295], [800, 270], [710, 243], [628, 212], [556, 178], [496, 138], [440, 98], [408, 74]];
export const LIGHTHOUSE = fromPx(406, 70);
/** The breakwater crest from the headland (east) to the lighthouse, then a short arm running north. */
export const CREST_PTS = [...BW_PX.map(([a, b]) => fromPx(a, b)).slice(0, -1), LIGHTHOUSE, [LIGHTHOUSE[0] - 1, LIGHTHOUSE[1] - 70]];
export const CREST = new Path(CREST_PTS);
/** Distance to the crest line, and which side of it you are on: side > 0 on the open-sea (north-east) side, < 0 inside the harbour. */
export function crestNear(x, z) {   // d, side (+1 sea side), s (arc length along the crest)
  const P = CREST_PTS, cum = CREST.cum; let best = 1e9, side = 1, s = 0;
  for (let i = 1; i < P.length; i++) {
    const [ax, az] = P[i - 1], [bx, bz] = P[i], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; s = cum[i - 1] + (cum[i] - cum[i - 1]) * t; side = Math.sign((x - ax) * dz - (z - az) * dx) * -1 || 1; }   // cross product: positive on the sea (north-east) side of the west-bound crest
  }
  return { d: best, side, s };
}

// ---------------------------------------------------------------- the land: one polygon round the whole harbour (the water is outside it)
const P = (...pts) => pts.map(([a, b]) => fromPx(a, b));
const LAND = [
  ...P([386, 72], [418, 58], [452, 84], [506, 124], [566, 166], [640, 201], [720, 230], [800, 256], [860, 283], [930, 300], [960, 380], [950, 520], [930, 700], [900, 1400], [-500, 1400], [-500, 330], [-120, 372],
    [60, 398], [120, 408], [180, 424], [225, 437], [262, 436], [290, 428], [320, 430], [336, 440]),
  T(60, 4), T(-40, 4), T(-40, 40), T(64, 40),      // round the basin: the south-east wall, the east end, the north-east wall (the working quay), then the quay's west face
  T(64, 68), T(40, 69),                            // the car-park quay's north-west edge, then the sand beach under the breakwater, up to the lighthouse
  ...P([372, 236], [396, 206], [402, 160], [407, 110], [396, 84]),
];
const FIELD = new DistField(LAND, { half: 170, cell: 0.9 });
/** Signed distance to the water's edge: positive on land (metres), negative in the water. */
export const landD = (x, z) => FIELD.at(x, z);

// ---------------------------------------------------------------- features of the land
export const QY = 1.3;            // the quay's height above the water
export const CREST_H = 2.3;       // breakwater crest height
const noise = makeNoise(53);
/** Height of the breakwater mound (a rubble crest ~5 m wide, slopes of about 1:1), or -99 away from it. */
export function moundAt(x, z) {
  const { d } = crestNear(x, z); if (d > 14) return -99;
  const top = CREST_H - Math.max(0, d - 2.4) * 0.95 + noise.fbm2(x * 0.35, z * 0.35, 2) * 0.3;
  const pad = 2.7 - smoothstep(4.4, 7.6, Math.hypot(x - LIGHTHOUSE[0], z - LIGHTHOUSE[1])) * 7;   // the lighthouse's round pad
  return Math.max(top, pad);
}
/** Flagstaff Hill (grassy, rising to the east and south-east) and the headland's rocky coast. */
export const HILL = { x: fromPx(700, 455)[0], z: fromPx(700, 455)[1], r: 52, h: 6.2 };
export const hillAt = (x, z) => HILL.h * (1 - smoothstep(10, HILL.r, Math.hypot(x - HILL.x, z - HILL.z) + noise.n2(x * 0.05, z * 0.05) * 6));
/** The ring road (Endeavour Drive) round the hill, a pale strip: distance from its centreline in metres. */
export const ROAD_R = 33;
export const roadDist = (x, z) => Math.abs(Math.hypot(x - HILL.x, z - HILL.z) - ROAD_R);
/** The quay's aprons in the quay frame: the working quay (north-east wall) and the promenade behind the south-east wall. */
export const APRON = { a0: -44, a1: 64, b0: 38.6, b1: 68 }, PROM = { a0: -44, a1: 66, b0: -13, b1: 5.4 };
/** 0..1: how much a point is on a flat quay surface (the apron or the promenade), soft at the landward edges. */
export function quayMask(x, z) {
  const { a, b } = toQuay(x, z);
  const ap = smoothstep(APRON.a0 - 1.5, APRON.a0 + 1, a) * smoothstep(APRON.a1 + 1.5, APRON.a1 - 1, a) * smoothstep(APRON.b0 - 0.2, APRON.b0 + 0.3, b) * smoothstep(APRON.b1 + 3, APRON.b1 - 2, b);
  const pr = smoothstep(PROM.a0 - 1.5, PROM.a0 + 1, a) * smoothstep(PROM.a1 + 1.5, PROM.a1 - 1, a) * smoothstep(PROM.b0 - 3, PROM.b0 + 1, b) * smoothstep(PROM.b1 + 0.2, PROM.b1 - 0.3, b);
  const en = smoothstep(-64, -61, a) * smoothstep(-36, -39, a) * smoothstep(-6, 2, b) * smoothstep(58, 52, b);   // the road across the basin's east end, joining the two quays
  return Math.max(ap, pr, en);
}
/** 1 close to the basin's three stone walls (steep, vertical quay faces), 0 elsewhere. The walls are the quay-frame box round the basin, ignoring its open mouth. */
export function wallNear(x, z) {
  const { a, b } = toQuay(x, z), B = BASIN;
  const inside = a > B.a0 && b > B.b0 && b < B.b1, dist = inside ? -Math.min(a - B.a0, b - B.b0, B.b1 - b) : Math.hypot(Math.max(B.a0 - a, 0), Math.max(B.b0 - b, b - B.b1, 0));
  const apronFace = (1 - smoothstep(0.8, 2.6, Math.abs(a - APRON.a1))) * (b > 37 && b < 70 ? 1 : 0);   // the quay's west face, over the car park end
  return Math.max((1 - smoothstep(1.2, 3.2, Math.abs(dist))) * smoothstep(B.a1 + 8, B.a1 + 2, a), apronFace);
}
/** 1 over the basin's water (its box and the first 10 m of the mouth), fading to 0 five metres outside it: the basin floor is level and 3.2 m deep. */
export function basinK(x, z) {
  const { a, b } = toQuay(x, z), B = BASIN, dx = Math.max(B.a0 - a, a - (B.a1 + 10), 0), dz = Math.max(B.b0 - b, b - B.b1, 0);
  return 1 - smoothstep(0, 5, Math.hypot(dx, dz));
}
export const inBasinBox = (x, z) => { const { a, b } = toQuay(x, z), B = BASIN; return a > B.a0 && a < B.a1 + 18 && b > B.b0 - 0.5 && b < B.b1 + 0.5; };

// ---------------------------------------------------------------- the other landmarks
export const COVE_BEACH = { x: fromPx(150, 418)[0], z: fromPx(150, 418)[1] };
/** The short timber jetty near the restaurants: from the south shore (root) out to the north-west. */
export const JETTY2 = (() => { const [rx, rz] = fromPx(300, 446), [ex, ez] = fromPx(250, 380), L = Math.hypot(ex - rx, ez - rz); return { rx, rz, ex, ez, len: L, w: 1.8, y: 0.8, ux: (ex - rx) / L, uz: (ez - rz) / L }; })();
export const FLAGSTAFF = fromPx(782, 266);
/** 0..1: the streets behind the harbour lawns (Cliff Road and the terraces above Cove Beach and the basin): flat ground off the hill, away from the quay. */
export function streetAt(x, z) {
  const d = landD(x, z);
  return smoothstep(26, 30, d) * (1 - smoothstep(56, 62, d)) * (1 - smoothstep(0.15, 0.5, hillAt(x, z))) * (1 - smoothstep(0.02, 0.2, quayMask(x, z))) * (1 - smoothstep(20, 50, x));
}
