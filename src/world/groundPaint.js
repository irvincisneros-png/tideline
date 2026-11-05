// The painted ground layer shared by the shore sites: grass that drifts between lush and sun-dried, bare patches, pigface and spinifex mats, and worn walking tracks.
// Colours are vertex colours, so every feature here is several metres wide (vertices are 0.7 to 2 m apart). The fine stuff, mown stripes and tufts, lives in the terrain shader
// (world/terrain.js), driven by eco.lawnAt. Pure functions of x and z, so a site looks the same on every tier.
import { makeNoise, smoothstep, lerp, clamp } from '../core/noise.js';

const N = makeNoise(909);
const LUSH = [0.44, 0.63, 0.3], MID = [0.57, 0.71, 0.36], DRY = [0.72, 0.74, 0.42], EARTH = [0.77, 0.67, 0.47];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * Grass: returns `c` with grass painted over it by `g` (0..1). `lawn` 1 is kept short and even (fewer bare patches), 0 is rough ground.
 */
export function paintGrass(c, x, z, g = 1, lawn = 1) {
  if (g <= 0) return c;
  const wide = N.fbm2(x * 0.016 + 3, z * 0.016, 3), mid = N.fbm2(x * 0.075, z * 0.075 + 7, 3), clump = N.n2(x * 0.27, z * 0.27);
  let k = wide < 0 ? mix3(MID, LUSH, clamp(-wide * 2.4, 0, 1)) : mix3(MID, DRY, clamp(wide * 2.2, 0, 1));
  k = [k[0] * (1 + clump * 0.07), k[1] * (1 + clump * 0.06), k[2] * (1 + clump * 0.05)];
  k = mix3(k, DRY, smoothstep(0.12, 0.34, mid) * 0.5);                                                      // scorched, thin patches
  k = mix3(k, EARTH, smoothstep(0.27, 0.42, mid + wide * 0.35) * lerp(0.85, 0.42, lawn));                   // worn bare to the soil
  return mix3(c, k, g);
}

/** Coastal ground cover over `g` (0..1): straw-gold spinifex hummocks and dark pigface mats with a scatter of magenta flowers. */
export function paintWild(c, x, z, g = 1) {
  if (g <= 0) return c;
  const sp = N.fbm2(x * 0.11 + 11, z * 0.11, 3), pf = N.fbm2(x * 0.06, z * 0.06 + 23, 3), fl = N.n2(x * 0.42 + 4, z * 0.42);
  let k = mix3([0.66, 0.68, 0.4], [0.84, 0.78, 0.52], smoothstep(-0.25, 0.3, sp));                          // spinifex, greener in the dips and straw on the crests
  const mat = smoothstep(0.02, 0.2, pf);
  k = mix3(k, [0.36, 0.5, 0.27], mat);                                                                      // pigface mats
  k = mix3(k, [0.82, 0.42, 0.56], mat * smoothstep(0.26, 0.42, fl) * 0.75);                                 // its flowers
  return mix3(c, k, g);
}

/** Distance from (x, z) to the segment a-b. */
function segD(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
/** 0..1: on a worn track. `lines` is a list of polylines of [x, z]; a track wanders a little and is `w` metres wide. */
export function wornAt(x, z, lines, w = 1.3) {
  const wx = x + N.n2(x * 0.05, z * 0.05 + 4) * 3.5, wz = z + N.n2(x * 0.05 + 9, z * 0.05) * 3.5;
  let d = 99;
  for (const l of lines) for (let i = 0; i + 1 < l.length; i++) d = Math.min(d, segD(wx, wz, l[i], l[i + 1]));
  return d > w * 2.4 ? 0 : smoothstep(w * 1.9, w * 0.55, d + N.n2(x * 0.6, z * 0.6) * 0.5);
}
/** Lay a worn track colour over `c` by `k`, sandy or earthy. */
export const paintWorn = (c, k, col = [0.8, 0.71, 0.54]) => (k > 0 ? mix3(c, col, k * 0.85) : c);
