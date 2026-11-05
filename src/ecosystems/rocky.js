// NSW rocky reef, beach and rock platform at BELLAMBI, Illawarra. The layout is traced from the real coastline (world/bellambi.js): a long surf beach curving down
// from the north-west into the sheltered boat-ramp cove, Bellambi Point hooking out to the EAST with a rock platform round its tip, Bellambi Rock Pool on the outcrop
// north of the cove, a second beach running away south-west with the lagoon and bushland behind it, and a kelp-and-boulder reef with breaking water out to sea.
// The sea is toward -z (east in real life; the map is turned so north is up, see FRAME), the land toward +z.
import * as THREE from 'three';
import { makeNoise, smoothstep, lerp, clamp } from '../core/noise.js';
import { species as speciesInfo } from '../content/rocky.js';
import { addGenerator } from '../world/reef.js';
import { registerBehaviour, registerLook } from '../life/life.js';
import { paint as P } from '../life/looks.js';
import * as FL from '../world/flora.js';
import * as FO from '../world/foliage.js';
import { rock } from '../world/coral.js';
import { dressBeach } from '../world/beachProps.js';
import * as BL from '../world/bellambi.js';

export { platformMask, POOLS, FRAME } from '../world/bellambi.js';
const { platformMask, platformHeight, shoreD, shoreS, POOLS, S_PT0, S_PT1, S_RAMP, S_POOL, S_TOWER } = BL;
const noise = makeNoise(77);
const BARREN = { x: 52, z: -150, r: 16 };
const BOULDERS = [[20, -120, 7, 3], [40, -146, 8, 3.5], [58, -126, 7, 3], [8, -146, 6, 2.5], [48, -104, 6, 2.2], [30, -166, 5, 1.8]];

// ---- The shore: the beach face, a grassy foreshore, hummocky dunes behind the north beach, the low reserve on the point, bushland behind the south beach.
// Sea level is y = 0 (a low-ish tide, so the pools on the platform are exposed).
const pointMask = BL.pointMask;   // 1 on the cove and the point, 0 on the long beaches either side
function landHeight(x, z, d, s) {
  const t = clamp(d / 10, 0, 1);
  let h = 2.15 * (0.55 * t + 0.45 * smoothstep(0, 1, t));                              // beach face (about 1:5, a little steeper than life so the sand stays narrow)
  h += 0.5 * smoothstep(10, 22, d);                                                    // the back beach and the foreshore
  const pm = pointMask(x, z);
  const dune = smoothstep(13, 22, d) * (1 - smoothstep(40, 56, d)) * (1 - pm);
  h += dune * (noise.fbm2(x * 0.035, z * 0.05, 4) * 2.4 + noise.fbm2(x * 0.15, z * 0.15, 2) * 0.45 + 0.6);
  h += smoothstep(34, 150, d) * (5.2 - 2.6 * pm);                                      // rising ground behind (low on the point)
  h += noise.fbm2(x * 0.03 + 5, z * 0.03, 3) * 0.9 * smoothstep(10, 40, d) + BL.bushAt(x, z) * (0.9 + noise.fbm2(x * 0.12, z * 0.12, 2) * 1.2);
  h += Math.sin(x * 0.26) * 0.1 * smoothstep(0.3, 1, h) * (1 - smoothstep(2, 5, h));   // beach cusps
  return h;
}
/** The open-sea bottom as a function of the distance offshore D: a gentle beach, a sandbar, then deeper and deeper. */
function seaProfile(D) {
  const b = D < 18 ? -1.6 * (D / 18) : lerp(-1.6, -4.2, smoothstep(18, 60, D));
  return b + lerp(0, -4.8, smoothstep(60, 130, D)) + lerp(0, -7, smoothstep(130, 260, D)) + 0.55 * Math.exp(-Math.pow((D - 30) / 7, 2)) - smoothstep(260, 420, D) * 2;
}
/** 0..1: weedy reef. Dark patches in the shallows (the cove, off the beach), the fringe round the platform, and the boulder reef out to sea. */
export function reefiness(x, z) {
  const d = shoreD(x, z);
  if (d > 4) return 0;
  let r = BL.patchAt(x, z) * 0.9;
  const s = shoreS(x, z), seg = smoothstep(S_PT0 - 8, S_PT0 + 6, s) * (1 - smoothstep(S_PT1 - 6, S_PT1 + 8, s));
  r = Math.max(r, seg * (1 - smoothstep(0, 16, -d - 9)) * smoothstep(-4, -8, d) * 0.85);
  const L = BL.REEF_LOBE, dl = Math.hypot(x - L.x, z - L.z) + noise.n2(x * 0.05, z * 0.05) * 7;
  r = Math.max(r, (1 - smoothstep(L.r * 0.45, L.r, dl)) * (0.7 + 0.3 * noise.n2(x * 0.04, z * 0.04)));
  for (const [bx, bz, rad] of BOULDERS) r = Math.max(r, 1 - smoothstep(rad * 0.8, rad * 1.5, Math.hypot(x - bx, z - bz)));
  const B = BL.BREAKER; r = Math.max(r, 1 - smoothstep(B.r * 0.7, B.r * 1.6, Math.hypot(x - B.x, z - B.z)));
  return clamp(r, 0, 1);
}
function seaHeight(x, z, d) {
  const D = -d, cove = BL.coveAt(x, z);
  let base = seaProfile(D);
  base = lerp(base, base * 0.5, cove);                                                  // the cove is shallow, sandy and sheltered
  const reef = reefiness(x, z), amp = clamp((-base - 0.6) / 5, 0.16, 1);
  let h = base + reef * (Math.max(0, noise.fbm2(x * 0.09, z * 0.09, 4)) * 3.2 + noise.fbm2(x * 0.35, z * 0.35, 2) * 0.5) * amp;
  h -= reef * Math.pow(Math.max(0, Math.sin(x * 0.18 + noise.n2(x * 0.03, z * 0.03) * 2)), 6) * 1.6 * amp;
  h += noise.fbm2(x * 0.05, z * 0.05, 3) * 0.5 * smoothstep(5, 30, D);
  for (const [bx, bz, r, ht] of BOULDERS) { const e = Math.hypot(x - bx, z - bz) / r; if (e < 2) h += ht * Math.exp(-e * e * 2) * (0.8 + 0.4 * noise.n2(x * 0.5, z * 0.5)); }
  const B = BL.BREAKER; h += 3.6 * Math.exp(-Math.pow(Math.hypot(x - B.x, z - B.z) / B.r, 2) * 1.6) * (0.85 + 0.3 * noise.n2(x * 0.3, z * 0.3));   // Bellambi Reef: breaking water
  return Math.min(h, Math.max(base, -1.0));                                             // weed and boulders never break the surface by themselves
}
let CP_H = null;
/** The car park is levelled to the ground height at its centre (so it sits flush, not on a mound). */
const carparkH = () => (CP_H ??= landHeight(BL.CARPARK.x, BL.CARPARK.z, shoreD(BL.CARPARK.x, BL.CARPARK.z), shoreS(BL.CARPARK.x, BL.CARPARK.z)));
export function heightAt(x, z) {
  const d = shoreD(x, z), s = shoreS(x, z);
  let h = d >= 0 ? landHeight(x, z, d, s) : seaHeight(x, z, d);
  const pm = platformMask(x, z); if (pm > 0) h = lerp(h, platformHeight(x, z), pm);
  const oc = BL.outcropHeight(x, z); if (oc) h = lerp(h, oc.h, oc.m);
  const rm = BL.rampMask(x, z); if (rm > 0) h = lerp(h, BL.rampHeight(x, z), rm);
  const C = BL.CARPARK, cm = smoothstep(C.hx + 3, C.hx - 0.5, Math.abs(x - C.x)) * smoothstep(C.hz + 3, C.hz - 0.5, Math.abs(z - C.z)); if (cm > 0) h = lerp(h, carparkH(), cm);
  const lm = BL.lagoonMask(x, z); if (lm > 0) h = lerp(lerp(h, 1.5, smoothstep(0, 0.5, lm)), -1.0, smoothstep(0.35, 0.75, lm));   // Bellambi Lagoon
  return h;
}
export function colorAt(x, z, h, slope) {
  const d = shoreD(x, z);
  if (h > -1.1 && (d > -2 || platformMask(x, z) > 0.01 || BL.outcropMask(x, z) > 0.01 || BL.rampMask(x, z) > 0.01)) return shoreColor(x, z, h, slope, d);
  const reef = reefiness(x, z);
  const n = noise.n2(x * 0.3, z * 0.3);
  const sand = [0.7 + n * 0.04, 0.66 + n * 0.04, 0.55];
  const inBarren = Math.hypot(x - BARREN.x, z - BARREN.z) < BARREN.r;
  // Rock with pink coralline paint (barrens) or green-brown turf (under kelp)
  const rockC = inBarren ? (n > 0 ? [0.62, 0.45, 0.5] : [0.5, 0.42, 0.45]) : (n > 0.1 ? [0.36, 0.38, 0.24] : [0.42, 0.38, 0.3]);
  const t = clamp(reef * 1.3 - slope * 0.3, 0, 1);
  return [lerp(sand[0], rockC[0], t), lerp(sand[1], rockC[1], t), lerp(sand[2], rockC[2], t)];
}
function shoreColor(x, z, h, slope, d) {
  const n = noise.n2(x * 0.3, z * 0.3), n2 = noise.n2(x * 2.1, z * 2.1), s = shoreS(x, z), pm = pointMask(x, z);
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // Sand: dark and wet in the swash zone, pale and dry up the beach. Warm quartz sand (Illawarra beaches are golden), darker where wet.
  const wet = [0.9 + n * 0.03, 0.78 + n * 0.03, 0.56], dry = [1.0, 0.92 + n * 0.02, 0.72];
  let c = mix3(wet, dry, smoothstep(0.1, 0.75, h));
  const cover = Math.max(0, Math.min(1, 0.55 + 0.6 * noise.fbm2(x * 0.08, z * 0.08, 3)));
  c = mix3(c, [0.5 + n * 0.05, 0.54, 0.34], smoothstep(13, 22, d) * cover * 0.7 * (1 - pm));                  // spinifex on the dunes
  c = mix3(c, [0.58 + n * 0.05, 0.7 + n * 0.04, 0.36], smoothstep(9, 15, d) * 0.95);   // the mown foreshore grass
  c = mix3(c, [0.24 + n * 0.04, 0.38 + n * 0.04, 0.18], smoothstep(40, 58, d) * (0.6 + 0.35 * cover) * (1 - pm) + BL.bushAt(x, z) * 0.85);   // scrub behind the dunes, the gully bushland
  c = mix3(c, [0.56 + n * 0.05, 0.68, 0.34], smoothstep(24, 40, d) * pm * 0.6);                                // the reserve on the point
  // the shared path along the back of the beach
  const path = smoothstep(1.0, 0.45, Math.abs(d - 17)) * (1 - smoothstep(0.1, 0.4, BL.bushAt(x, z)));
  if (path > 0) c = mix3(c, [0.8, 0.78, 0.72], path * 0.9);
  // the car park on the point: grey asphalt with painted bays
  const C = BL.CARPARK, cx = Math.abs(x - C.x), cz = Math.abs(z - C.z);
  if (cx < C.hx + 0.6 && cz < C.hz + 0.6) { const k = smoothstep(C.hx + 0.6, C.hx - 0.2, cx) * smoothstep(C.hz + 0.6, C.hz - 0.2, cz); const bay = ((x - C.x) % 2.6 + 2.6) % 2.6 < 0.1 && cz < C.hz - 1.2; c = mix3(c, bay ? [0.9, 0.9, 0.86] : [0.6 + n * 0.04, 0.6 + n * 0.04, 0.58 + n * 0.04], k); }
  // the boat ramp: concrete with grooves
  const rm = BL.rampMask(x, z);
  if (rm > 0) { const { a, b } = BL.rampLocal(x, z), groove = Math.abs(((a % 0.8) + 0.8) % 0.8 - 0.4) < 0.07 ? 0.78 : 1, kerb = Math.abs(b) > BL.RAMP.w / 2 - 0.9 ? 0.55 : 1, k = 0.82 * groove * kerb; c = mix3(c, [k, k, k * 0.97], smoothstep(0, 0.45, rm)); }   // pale concrete with grooves and dark kerbs: it must read against warm sand from above
  // Bellambi Lagoon: damp sand ring, reedy bank
  const lm = BL.lagoonMask(x, z); if (lm > 0) c = mix3(c, h < 0 ? [0.78, 0.7, 0.5] : [0.5 + n * 0.05, 0.58, 0.34], smoothstep(0, 0.4, lm));
  // the rock pool and its outcrop: pale stone walls, weedy olive ledge
  const oc = BL.outcropMask(x, z);
  if (oc > 0.02) {
    const ph = BL.poolHeight(x, z); let r = [0.62 + n * 0.05, 0.58 + n * 0.04, 0.5];                              // concrete / stone wall
    if (ph != null && ph < -0.3) r = [0.52, 0.66 + n * 0.04, 0.58];                                              // the pool floor
    else if (ph == null || ph < 0.5) r = mix3([0.5, 0.52, 0.3], [0.74, 0.56, 0.36], 0.5 + 0.5 * n2);
    c = mix3(c, r, Math.min(1, oc * 1.3));
  }
  const pmask = platformMask(x, z) * (1 - rm);
  if (pmask > 0.01) {
    // Rock platform zonation: pink coralline + green algae in pools, olive turf low, barnacle-grey mid, bare dry rock high.
    let r;
    // Cosy palette: warm ochre sandstone on top, olive weed low down, bright coralline pink and green algae in the pools.
    if (h < -0.05) r = n2 > 0 ? [0.8, 0.5, 0.54] : [0.4, 0.6, 0.34];                                           // pools: pink coralline, green algae
    else if (h < 0.5) r = mix3([0.5, 0.52, 0.3], [0.74, 0.56, 0.36], smoothstep(-0.05, 0.5, h) * (0.6 + 0.4 * n2)); // low shore: olive weed to sandstone
    else if (h < 0.95) r = mix3([0.84, 0.58, 0.34], [0.93, 0.68, 0.4], 0.5 + 0.5 * n2);                         // mid shore sandstone
    else r = [0.95 + n * 0.04, 0.7 + n * 0.04, 0.42];                                                          // dry upper platform: bright ochre
    if (h > -0.05) {
      // Gutters between the ledges are darker and weedy; each pool is ringed by wet olive algae so it reads clearly from above.
      const gut = Math.pow(Math.max(0, Math.sin(x * 0.21 + z * 0.19 + noise.n2(x * 0.05, z * 0.05) * 2)), 12);
      r = mix3(r, [0.5, 0.44, 0.28], Math.min(1, gut * 1.4));
      // Ledge risers and cracks are darker, warm brown, so the tiers read as stepped rock from above.
      const gx = platformHeight(x + 0.7, z) - platformHeight(x - 0.7, z), gz = platformHeight(x, z + 0.7) - platformHeight(x, z - 0.7), g = Math.hypot(gx, gz) / 1.4;
      r = mix3(r, [0.4, 0.27, 0.18], Math.min(1, smoothstep(0.08, 0.3, g) * 0.95 + BL.crackAt(x, z) * 0.95));
      // Baked sun shading on the risers (sun from the +x side): faces toward it are bright, faces away are dark, so the ledges read as steps.
      const lit = Math.max(0.55, Math.min(1.3, 1 + (-gx * 0.55 + gz * 0.3) / 1.4 * 1.4));
      r = [r[0] * lit, r[1] * lit, r[2] * lit];
      r = mix3(r, [0.6, 0.45, 0.28], smoothstep(0.1, 0.3, noise.n2(x * 0.5, z * 0.5)) * 0.25 * (1 - smoothstep(0.1, 0.3, g))); // lighter, sunbaked ledge tops
      let pd = 9; for (const [px, pz, pr] of POOLS) pd = Math.min(pd, Math.hypot(x - px, z - pz) / (pr * 1.3));
      r = mix3(r, [0.42, 0.52, 0.3], smoothstep(1.45, 1.05, pd) * 0.85);
    }
    c = mix3(c, r, Math.min(1, pmask * 1.2));
  }
  // weedy shallows: the dark reef patches show through the clear water
  if (h < 0.1) { const pr = BL.patchAt(x, z); if (pr > 0.05) c = mix3(c, [0.28 + n * 0.04, 0.34, 0.22], pr * 0.8); }
  return c;
}
/** Substrate for the terrain shader: 1 = rock (platform, the pool outcrop, reef boulders), 0 = sand. */
export function rockAt(x, z, h, slope) {
  const pm = platformMask(x, z), oc = BL.outcropMask(x, z);
  if (pm > 0.02 || oc > 0.02) return Math.min(1, pm * 1.3 + oc * 0.9);
  if (h > 0.2) return slope > 0.5 && h > 2 ? 0.6 : 0;
  return Math.min(1, reefiness(x, z) * 1.1 + Math.max(0, slope - 0.4));
}
const inBarren = (x, z) => Math.hypot(x - BARREN.x, z - BARREN.z) < BARREN.r;
/** Beach-ish land use at (x, z): how far inland (d) and which stretch of shore (0 = north beach, 1 = cove and point, 2 = south beach). */
const onBeach = (x, z, lo, hi) => { const d = shoreD(x, z); return d > lo && d < hi ? 1 : 0; };


// ---- Habitat-forming plants and sponges
addGenerator('kelp', { fn: FL.kelp, variants: 5, scale: [1.0, 1.7], radius: 0.7, sink: 0.02, rough: 0.6, sway: 0.22, cluster: 16, bleaches: false, as: 'kelp', detailScale: 12, sat: 1.05, transl: 0.6, doubleSide: true, soft: true });
addGenerator('crayweed', { fn: FL.crayweed, variants: 3, scale: [0.9, 1.4], radius: 0.6, sink: 0.02, rough: 0.6, sway: 0.12, cluster: 6, bleaches: false, as: 'crayweed', detailScale: 12, sat: 1.1, transl: 0.5, doubleSide: true, soft: true });
// Weed on the dark reef patches in the shallows of the cove and off the beach (the dark areas in the satellite view): crayweed that grows right up to a half-metre depth.
addGenerator('coveweed', { fn: FL.crayweed, variants: 3, scale: [0.9, 1.5], radius: 0.6, sink: 0.02, rough: 0.6, sway: 0.14, cluster: 7, bleaches: false, as: 'crayweed', detailScale: 12, sat: 1.1, transl: 0.5, doubleSide: true, soft: true, maxH: -0.4 });
addGenerator('fingersponge', { fn: FL.fingerSponge, variants: 3, scale: [0.8, 1.6], radius: 0.35, sink: 0.02, rough: 0.9, bleaches: false, as: 'spongegarden', cluster: 4 });
addGenerator('vasesponge', { fn: s => FL.vaseSponge(s, { colors: [[0.9, 0.6, 0.2], [0.8, 0.4, 0.3], [0.7, 0.65, 0.5]] }), variants: 3, scale: [0.8, 1.5], radius: 0.35, sink: 0.02, rough: 0.9, bleaches: false, as: 'spongegarden' });
// ---- Beach, dune and rock-platform plants (placed by height and region, not by reefiness)
const LANDX = { xMin: -140, xMax: 140, zMin: -60, zMax: 150 };
const notPlatform = (x, z) => 1 - platformMask(x, z);
addGenerator('spinifex', { fn: FO.spinifexPatch, foliage: true, noShadow: true, variants: 3, scale: [0.8, 1.3], radius: 0.45, sink: 0, rough: 0.8, sway: 0.25, cluster: 6, bleaches: false, as: 'spinifex', land: true, soft: true, transl: 0.35, sat: 1, ao: 0.3, minH: 1.9, maxH: 12, region: LANDX });
addGenerator('pigface', { fn: FL.pigface, noShadow: true, variants: 2, scale: [0.9, 1.6], radius: 0.4, sink: 0, rough: 0.55, cluster: 5, bleaches: false, as: 'pigface', land: true, soft: true, sat: 1.05, minH: 2.2, maxH: 12, region: LANDX });
addGenerator('wattle', { fn: FO.wattleShrub, foliage: true, variants: 3, scale: [0.8, 1.5], radius: 1.2, sink: 0.1, rough: 0.75, sway: 0.03, cluster: 6, bleaches: false, as: 'coastalwattle', land: true, soft: true, transl: 0.35, sat: 1.05, ao: 0.6, minH: 2.8, maxH: 16, region: LANDX });
addGenerator('heath', { fn: FO.heathShrub, foliage: true, noShadow: true, variants: 2, scale: [0.8, 1.6], radius: 0.6, sink: 0.05, rough: 0.8, sway: 0.03, cluster: 8, bleaches: false, as: 'coastalwattle', land: true, soft: true, transl: 0.3, sat: 1.0, ao: 0.6, minH: 3, maxH: 16, region: LANDX });
addGenerator('banksia', { fn: FO.banksiaTree, variants: 4, scale: [0.8, 1.3], radius: 1.1, sink: 0.1, rough: 0.75, sway: 0.004, cluster: 4, bleaches: false, as: 'coastbanksia', land: true, transl: 0.25, sat: 1.0, ao: 0.5, minH: 3.5, maxH: 18, region: LANDX });
addGenerator('norfolkpine', { fn: FO.banksiaTree, variants: 2, scale: [0.75, 1.15], radius: 0.7, sink: 0.1, rough: 0.8, cluster: 2, bleaches: false, as: 'norfolkpine', land: true, minH: 2.4, maxH: 14, region: LANDX });
addGenerator('casuarina', { fn: FO.banksiaTree, variants: 2, scale: [0.8, 1.25], radius: 0.6, sink: 0.1, rough: 0.8, cluster: 3, bleaches: false, as: 'casuarina', land: true, minH: 2.6, maxH: 14, region: LANDX });
addGenerator('hormosira', { fn: FL.rockWeed, noShadow: true, variants: 4, scale: [0.7, 1.3], radius: 0.25, sink: 0.02, rough: 0.7, cluster: 7, bleaches: false, as: 'neptunesnecklace', land: true, soft: true, sat: 1.05, minH: 0.12, maxH: 0.85, region: { xMin: -20, xMax: 60, zMin: -75, zMax: -20 } });
addGenerator('boulder', { fn: rock, variants: 3, scale: [1.6, 4.2], radius: 1.6, sink: 0.4, rough: 0.95, bleaches: false });

// ---- Looks (procedural fish skins)
const { C, mix, sm, withEye, bars, spots, counter, hash } = P;
/** Smooth value noise (0..1): big soft blotches for patterned skins. */
const vnoise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, f = t => t * t * (3 - 2 * t), a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1); return (a + (b - a) * f(fx)) * (1 - f(fy)) + (c + (d - c) * f(fx)) * f(fy); };
const looks = {
  bluegroper: { length: 0.9, top: [.44,.58,.78,.94,1,.96,.84,.62,.3], bot: [.44,.56,.74,.9,.97,.9,.74,.5,.24], topShare: 0.54, tailRound: 0.22, depth: 0.29, width: 0.15, peak: 0.55, snout: 0.45, tailFrac: 0.16, tail: 'round', tailSpan: 0.75, pectoral: 0.13, pecY: -0.05, lips: true, throat: 0.1, hump: { at: 0.86, h: 0.11, w: 0.09 }, mouth: { len: 0.05, s: -0.15 },
    scales: { nU: 30, nR: 34, strength: 0.16 },   // a wrasse: big, plain scales
    dorsal: { from: 0.14, to: 0.8, height: 0.055, shape: 'dual' }, anal: { from: 0.14, to: 0.44, height: 0.06 },
    // Eastern blue groper (Achoerodus viridis, male): a big, sturdy, elongated wrasse, cobalt to cornflower blue (darker on the back), a large blunt head with thick fleshy lips and a small eye,
    // a little fleshy rise on the forehead, one long low dorsal, broad rounded pectorals and a squarish, softly rounded tail. Each big scale has a darker rear edge; fine darker squiggles on the cheek.
    paint: { body: withEye((u, s) => {
      let c = mix(C(0xb8d4f0), C(0x2f6fc4), sm(-0.6, 0.75, s));
      if (u > 0.8 && u < 0.92 && Math.abs(s + 0.1) < 0.5 && Math.sin(u * 160 + s * 26) > 0.82) c = mix(c, C(0x24508e), 0.4);   // cheek squiggles
      return c;
    }, 0.9, 0.36, 0.017, 0x111111, 0xd88a40), fin: (u, part, f) => (part === 'tail' || part === 'dorsal' || part === 'anal' ? mix(C(0x3f7ccc), C(0x6aa0e0), f) : C(0x8ab8ec)) }, swim: { freq: 3, amp: 0.4 } },
  redmorwong: { length: 0.5, top: [.32,.48,.7,.92,1,.92,.76,.54,.26], bot: [.32,.46,.64,.86,.96,.82,.6,.36,.14], fork: 0.55, depth: 0.36, width: 0.16, peak: 0.6, snout: 0.6, tailFrac: 0.18, tail: 'forked', tailSpan: 0.55, pectoral: 0.16, hump: { at: 0.86, h: 0.035, w: 0.1 }, mouth: { len: 0.04, s: -0.2 },
    dorsal: { from: 0.15, to: 0.8, height: 0.09, shape: 'dual' }, anal: { from: 0.15, to: 0.4, height: 0.075 }, lips: true,
    // Cheilodactylus fuscus: a deep pinkish-red body, two dark bands, thick lips, a steep head, one long dorsal (very tall at the front) and long pectorals.
    paint: { body: withEye((u, s) => { const base = mix(C(0xf4e8de), C(0xdc7c68), sm(-0.2, 0.8, s)); let a = 0; for (const uc of [0.72, 0.53]) { const d = Math.abs(u - (uc - 0.045 * s + 0.03 * s * s)), tap = sm(-0.75, -0.2, s) * (1 - sm(0.82, 1, s)); a = Math.max(a, (1 - sm(0.012, 0.034, d)) * tap); } return mix(base, C(0x9c4a3c), a * 0.78); }, 0.9, 0.25, 0.026, 0x101010, 0xe0c880), fin: () => C(0xd4614c) }, swim: { freq: 3, amp: 0.5 } },
  mado: { length: 0.18, depth: 0.45, width: 0.12, peak: 0.55, snout: 0.7, tailFrac: 0.18, tail: 'forked', pectoral: 0.12,
    dorsal: { from: 0.2, to: 0.75, height: 0.14 }, anal: { from: 0.18, to: 0.45, height: 0.1 },
    paint: { body: withEye((u, s) => (Math.abs(((s * 4 + u * 0.6) % 1 + 1) % 1 - 0.5) < 0.15 ? C(0x1a1a1a) : C(0xe8e0a0)), 0.86, 0.25, 0.05), fin: () => C(0xe8d070) }, swim: { freq: 7, amp: 0.8 } },
  luderick: { length: 0.4, top: [.34,.5,.72,.92,1,.9,.72,.5,.22], bot: [.34,.48,.7,.9,.98,.86,.64,.4,.14], fork: 0.74, depth: 0.38, width: 0.15, peak: 0.55, snout: 0.6, tailFrac: 0.17, tail: 'forked', pectoral: 0.12, mouth: { len: 0.04, s: -0.15 },
    dorsal: { from: 0.15, to: 0.78, height: 0.065, shape: 'dual' }, anal: { from: 0.15, to: 0.42, height: 0.07 },
    // Girella tricuspidata: olive-grey back, silvery flanks, 6-8 narrow dark bars across the upper two-thirds, a small mouth, one long dorsal and a slightly forked tail.
    paint: { body: withEye((u, s) => { const base = mix(C(0xcdd0be), C(0x8a9270), sm(-0.4, 0.7, s)); let a = 0; for (let i = 0; i < 8; i++) { const h1 = hash(i, 3), h2 = hash(i, 9), uc = 0.22 + i * 0.07 + (h1 - 0.5) * 0.02 - 0.03 * s + 0.02 * Math.sin(s * 5 + i), hw = 0.009 + 0.006 * h2; a = Math.max(a, (1 - sm(hw * 0.5, hw * 1.6, Math.abs(u - uc))) * sm(-0.35, 0.45, s) * (0.6 + 0.4 * h1)); } return mix(base, C(0x434d38), a * 0.6); }, 0.9, 0.25, 0.026, 0x101010, 0xd8d090), fin: () => C(0x6a7460) }, swim: { freq: 4, amp: 0.6 } },
  kingfish: { length: 1.1, top: [.14,.28,.52,.78,.95,1,.88,.6,.1], bot: [.14,.26,.48,.74,.92,1,.86,.55,.06], fork: 0.3, depth: 0.22, width: 0.14, peak: 0.6, snout: 0.9, tailFrac: 0.22, tail: 'forked', tailSpan: 0.55, pectoral: 0.12, peduncle: 0.1, mouth: { len: 0.09, s: -0.06 },
    dorsal: { from: 0.58, to: 0.66, height: 0.035, shape: 'tri' }, dorsal2: { from: 0.22, to: 0.55, height: 0.05 }, anal: { from: 0.2, to: 0.38, height: 0.045 },
    // Seriola lalandi: a long, torpedo-shaped fish, blue-green back, silver belly, a golden-yellow stripe along the side, a dark bar through the eye, a yellow tail and fins, a short spiny dorsal then a long soft one.
    paint: { body: withEye((u, s) => { if (u > 0.84 && u < 0.97 && Math.abs(s - 0.28) < 0.06 && Math.abs(s - 0.28) > 0.0) return C(0x3a6a80); if (Math.abs(s - 0.1) < 0.04 && u < 0.84) return C(0xe0cc58); return mix(C(0xe8eef0), C(0x4a7a98), sm(-0.1, 0.6, s)); }, 0.9, 0.25, 0.019, 0x101010, 0xd8d0a0), fin: (u, part) => (part === 'tail' || part === 'anal' ? C(0xe8cc48) : C(0x6a8a98)) }, swim: { freq: 3.5, amp: 0.6 }, metal: 0.5 },
  oldwife: { length: 0.25, depth: 0.6, width: 0.1, peak: 0.55, snout: 0.9, tailFrac: 0.15, tail: 'truncate', pectoral: 0.1,
    dorsal: { from: 0.25, to: 0.8, height: 0.25, shape: 'sail' }, anal: { from: 0.2, to: 0.5, height: 0.18 },
    paint: { body: withEye(bars(() => C(0xe8e4d8), [[0.82, 0.04, 0x1a1a1a], [0.62, 0.06, 0x1a1a1a], [0.42, 0.06, 0x1a1a1a], [0.22, 0.05, 0x1a1a1a]]), 0.88, 0.2, 0.04), fin: (u) => (u > 0.5 ? C(0x1a1a1a) : C(0xd0c8b8)) }, swim: { freq: 4, amp: 0.5 } },
  snapper: { length: 0.7, top: [.28,.44,.66,.9,1,.92,.78,.56,.2], bot: [.3,.44,.62,.82,.92,.8,.58,.34,.08], fork: 0.66, topShare: 0.57, depth: 0.35, topShare: 0.62, width: 0.15, peak: 0.6, snout: 0.6, tailFrac: 0.17, tail: 'forked', pectoral: 0.14, hump: { at: 0.84, h: 0.07, w: 0.1 }, mouth: { len: 0.06, s: -0.18 },
    dorsal: { from: 0.18, to: 0.78, height: 0.07, shape: 'dual' }, anal: { from: 0.16, to: 0.4, height: 0.065 },
    // Chrysophrys auratus: a deep pink-red body with a scatter of small electric-blue spots on the back and upper sides, a steep head with a bony forehead hump, a big eye, one long dorsal (spiny front) and a forked tail with a pale edge.
    paint: { body: withEye(spots((u, s) => mix(C(0xf8e4da), C(0xe08878), sm(-0.3, 0.7, s)), 0x7ac4f4, 40, 0.085, (u, s) => s > -0.2), 0.9, 0.3, 0.028, 0x101010, 0xe8d8b0), fin: () => C(0xe08a7a) }, swim: { freq: 3, amp: 0.5 } },
  easternbluedevil: { length: 0.3, depth: 0.32, width: 0.15, peak: 0.55, snout: 0.6, tailFrac: 0.15, tail: 'round', pectoral: 0.14,
    dorsal: { from: 0.12, to: 0.8, height: 0.12 }, anal: { from: 0.12, to: 0.45, height: 0.12 },
    paint: { body: withEye(spots((u, s) => mix(C(0x0a1a5a), C(0x1a3aa0), s * 0.5 + 0.5), 0xbfe0ff, 30, 0.1), 0.88, 0.25, 0.04), fin: (u, part, f) => (f > 0.8 ? C(0x60c0ff) : C(0x1a3aa0)) }, swim: { freq: 2.5, amp: 0.4 } },
  greynurse: { length: 2.6, depth: 0.18, width: 0.17, peak: 0.55, snout: 1.0, tailFrac: 0.26, tail: 'heterocercal', tailSpan: 0.6, pectoral: 0.15, pecWing: 0.4,
    dorsal: { from: 0.42, to: 0.58, height: 0.09, shape: 'tri' }, anal: { from: 0.15, to: 0.25, height: 0.06 },
    paint: { body: withEye(spots(counter(0x7a7a6a, 0xe8e0d0, 1.2), 0x5a3a2a, 16, 0.12, (u, s) => s > 0 && u < 0.7), 0.92, 0.2, 0.012, 0x050505, 0x222222), fin: () => C(0x6a6a5a) }, swim: { freq: 1.6, amp: 0.6 } },
  portjackson: { length: 1.1, depth: 0.2, width: 0.2, peak: 0.75, snout: 0.35, tailFrac: 0.22, tail: 'heterocercal', tailSpan: 1.1, pectoral: 0.16, pecWing: 0.6,
    dorsal: { from: 0.55, to: 0.65, height: 0.08, shape: 'tri' }, anal: { from: 0.2, to: 0.28, height: 0.05 },
    paint: { body: withEye((u, s) => { const harness = Math.abs(u - 0.66 + Math.abs(s) * 0.15) < 0.03 || Math.abs(u - 0.42 + Math.abs(s) * 0.1) < 0.03; return harness && s > -0.3 ? C(0x2a2018) : mix(C(0xe0d4c0), C(0xa89880), sm(-0.4, 0.5, s)); }, 0.88, 0.45, 0.025), fin: () => C(0x9a8a70) }, swim: { freq: 1.8, amp: 0.5 } },
  wobbegong: { length: 1.6, top: [.3,.42,.6,.8,.95,1,.92,.68,.3], bot: [.3,.4,.58,.78,.94,.98,.9,.66,.26], wpts: [.18,.3,.46,.64,.82,.96,1,.92,.45], tailRound: 0.2, lowerLobe: 0.22, tailSpan: 0.5, depth: 0.1, width: 0.27, peak: 0.7, snout: 0.25, tailFrac: 0.26, tail: 'round', pectoral: 0.17, pecWing: 0.6, pecAt: 0.72, boxy: 3, tassels: 9, pelvic: 0.11, pelAt: 0.5, mouth: { len: 0.1, s: -0.3 }, noLateral: true,
    dorsal: { from: 0.4, to: 0.47, height: 0.05 }, dorsal2: { from: 0.27, to: 0.34, height: 0.042 }, anal: { from: 0.2, to: 0.25, height: 0.03 },
    // Spotted wobbegong (Orectolobus maculatus): a flat carpet shark, broad flat head with a fringe of branching tassels round the mouth, small eyes on top, two similar dorsals set far back,
    // a long tail with a low upper lobe. Camouflage: soft dark saddles across a sandy-olive back, scattered with pale O-shaped rings; pale underneath.
    paint: { body: withEye((u, s) => {
      const base = mix(C(0xe2d6b4), C(0x8a7a50), sm(-0.35, 0.25, s));
      if (s < -0.3) return base;
      const sad = sm(0.35, 0.75, Math.sin(u * 30 + 0.6 * Math.sin(s * 3))) * sm(-0.1, 0.4, s), n = vnoise(u * 7, s * 2.6);
      let c = mix(base, C(0x5a4a2c), 0.55 * sad + 0.2 * sm(0.55, 0.8, n));
      const gu = u * 34, gs = (s + 1) * 6, iu = Math.floor(gu), is = Math.floor(gs);
      const cu = iu + 0.5 + 0.35 * (hash(iu, is) - 0.5), cs = is + 0.5 + 0.35 * (hash(is, iu) - 0.5), r = Math.hypot(gu - cu, (gs - cs) * 1.1);
      if (hash(iu + 3, is + 7) > 0.35 && s > -0.15) c = mix(c, C(0xf2e8c8), 0.85 * (1 - sm(0.06, 0.1, Math.abs(r - 0.24))));   // pale rings
      return c;
    }, 0.86, 0.96, 0.012, 0x222222, 0xd8c060), fin: (u, part, f) => mix(C(0x7a6a44), C(0xcfc096), 0.3 * f) }, swim: { freq: 1.5, amp: 0.4 } },
  fiddlerray: { kind: 'stingray', length: 0.9, span: 0.55, thick: 0.18, tail: 0.9,
    paint: (u, v, top) => { if (!top) return C(0xf0ece4); const line = Math.abs(Math.sin((u * 6 + Math.abs(v - 0.5) * 8))) < 0.18; return line ? C(0x3a3020) : mix(C(0xa89870), C(0x7a6a48), v); }, swim: { freq: 2.5, amp: 0.4 } },
};
for (const [id, l] of Object.entries(looks)) registerLook(id, l);

// ---- Behaviours
const B = {
  bluegroper: { type: 'wander', radius: 22, speed: 0.45, alt: [1, 4], flee: 1.5, curious: true },
  redmorwong: { type: 'ambush', radius: 6, speed: 0.25, alt: [0.3, 1.2], flee: 2 },
  mado: { type: 'school', speed: 0.35, alt: [1.5, 4], flee: 2.5, groupSize: 30 },
  luderick: { type: 'grazer', radius: 14, speed: 0.45, alt: [0.6, 2.5], flee: 3 },
  kingfish: { type: 'vortex', speed: 1.5, alt: [4, 8], flee: 3, groupSize: 25, at: [20, -132], y: -10 },
  oldwife: { type: 'pair', radius: 8, speed: 0.3, alt: [1, 3], flee: 2 },
  snapper: { type: 'wander', radius: 20, speed: 0.4, alt: [1, 3], flee: 3 },
  easternbluedevil: { type: 'ambush', radius: 2, speed: 0.15, alt: [0.2, 0.7], flee: 4 },
  greynurse: { type: 'patrol', speed: 0.55, flee: 5, center: [30, -128], y: -12 },
  portjackson: { type: 'rest', speed: 0.6, flee: 2 },
  wobbegong: { type: 'rest', speed: 0.5, flee: 1.2, camo: true },
  fiddlerray: { type: 'rest', speed: 0.7, flee: 2.5 },
  weedyseadragon: { type: 'hover', gen: 'seadragon', place: 'coral:kelp,crayweed', onTop: 0.55, camo: true, radius: 0.25, scale: [1.4, 1.8], range: 0.25 },
  octopus: { type: 'static', gen: 'octopus', place: 'reef', depth: [-12, -4], camo: true, radius: 0.35, scale: [0.9, 1.3] },
  urchin: { type: 'static', gen: 'urchin', place: 'barren', radius: 0.18, scale: [0.9, 1.4] },
  abalone: { type: 'static', gen: 'abalone', place: 'reef', depth: [-10, -3], radius: 0.12 },
  rocklobster: { type: 'static', gen: 'rocklobster', place: 'reef', depth: [-14, -5], radius: 0.3, scale: [1.2, 1.6] },
  cunjevoi: { type: 'static', gen: 'cunjevoi', place: 'reef', depth: [-6, -2], radius: 0.25, scale: [1, 1.6] },
};
for (const [id, b] of Object.entries(B)) registerBehaviour(id, b);


const { beachAt, S_BEACH_N, S_BEACH_S, S_TIP, TOWER, BOARD, HOME, SPAWN, RAMP } = BL;
/** A random spot on the beach: stretch `[s0, s1]` along the waterline, `[o0, o1]` metres inland. */
const alongBeach = (rnd, s0, s1, o0, o1) => { const b = beachAt(s0 + rnd() * (s1 - s0), o0 + rnd() * (o1 - o0)); return { x: b.x, z: b.z }; };

export const rocky = {
  id: 'rocky',
  name: 'Illawarra beach & rock platform',
  place: 'Bellambi, NSW',
  blurb: 'Bellambi Beach curving into the point: a surf beach, a sheltered boat-ramp cove, the rock pool and a sandstone rock platform round Bellambi Point. Fish the gutters and the platform edge.',
  terrainSize: 400, terrainSegments: 560, seabedKind: 'sand', ripple: 0.35, seed: 77,
  heightAt, colorAt, reefiness, rockAt,
  frame: BL.FRAME,   // the map is turned a quarter so north is up: the sea is to the east, as at Bellambi
  waterOnly: true, waterFallback: [30, -130],   // fish and reef animals are only placed where there is water over them
  bounds: { xMin: -80, xMax: 100, zMin: -190, zMax: 70 },
  diveBounds: { xMin: -80, xMax: 100, zMin: -190, zMax: 70 }, // world.bounds (reef/life placement)
  water: {
    shafts: 0,
    absorb: [0.34, 0.1, 0.09], fog: 0x2d6a6c, fogDeep: 0x0f3236, fogDensity: 0.06,
    shallow: 0x3fcfc0, mid: 0x1f9aae, deep: 0x1a6a9c, exposure: 1.0,
    skyTop: 0x3a78c0, skyHorizon: 0xc0d8e2, sun: [0.55, 0.62, -0.3], sunColor: 0xfff0dc, sunIntensity: 2.3,
    hemiSky: 0xbfe0e8, hemiGround: 0x3a5a4a,
  },
  daylight: true,   // time of day: the sunset glow and the dark-blue night (ocean/daylight.js)
  sound: { wash: 1.2, wind: 0.4, shrimp: 0.6, gulls: 1 },
  island: { x: 40, z: 560, r: 420, h: 34 }, islandKind: 'headland', // the Illawarra escarpment behind the coastal plain (to the west)
  // Rod fishing: the rock platform round the point, the surf beach elsewhere (keys of SPOTS in fishing/catches.js).
  fishing: { spotAt: (x, z) => (platformMask(x, z) > 0.3 ? 'rock' : 'beach') },
  land: {
    spawn: { x: SPAWN.x, z: SPAWN.z, yaw: SPAWN.yaw },
    bounds: { xMin: -125, xMax: 120, zMin: -85, zMax: 100 }, // seaward edge; the walker also stops wading at chest depth (SWIM_DEPTH)
    intro: 'You\'re on Bellambi Beach, north of the point. Walk down to the water, press R for your rod (T opens your tackle box), then follow the beach round the cove past the boat ramp to the rock platform at the tip of Bellambi Point. Press E to chat with the people you meet.',
    life: { ghostcrab: 28, oystercatcher: 4, silvergull: 12, waratahanemone: 70, bluelinedoctopus: 3 },
    flyingGulls: 6, gullCircle: { x: TOWER.x, z: TOWER.z - 6 },
    home: { x: HOME.x, z: HOME.z, r: HOME.r, label: HOME.label }, // the top of the access path: walk here (or press H) to head home and end the outing
    zones: {
      ghostcrab: rnd => (rnd() < 0.6 ? alongBeach(rnd, S_BEACH_N + 10, BL.S_POOL - 6, 5, 12) : alongBeach(rnd, BL.S_PT1 + 12, S_BEACH_S + 30, 5, 11)),
      oystercatcher: (rnd, i) => alongBeach(rnd, BL.S_TOWER - 60 + Math.floor(i / 2) * 60, BL.S_TOWER - 54 + Math.floor(i / 2) * 60, 1.5, 3.5),
      silvergull: rnd => alongBeach(rnd, BL.S_TOWER - 40, BL.S_TOWER + 50, 3, 9),
      waratahanemone: (rnd, i) => { const [px, pz, r] = POOLS[i % POOLS.length], a = rnd() * 6.283, d = r * (0.75 + rnd() * 0.45); return { x: px + Math.cos(a) * d, z: pz + Math.sin(a) * d }; },
      bluelinedoctopus: (rnd, i) => { const [px, pz, r] = POOLS[(i * 4 + 1) % POOLS.length]; return { x: px + (rnd() - 0.5) * r * 0.6, z: pz + (rnd() - 0.5) * r * 0.6 }; },
    },
  },
  cosyModels: {
    url: 'assets/models/rocky_cosy.glb',
    coral: {
      banksia: ['banksia_0', 'banksia_1'], norfolkpine: ['norfolk_pine_0', 'norfolk_pine_1'], casuarina: ['casuarina_0', 'casuarina_1'],
      kelp: ['kelp_0', 'kelp_1', 'kelp_2', 'kelp_3'], crayweed: ['crayweed_0', 'crayweed_1'], coveweed: ['crayweed_0', 'crayweed_1'], fingersponge: ['fingersponge_0', 'fingersponge_1'],
      vasesponge: ['vasesponge_0', 'vasesponge_1'], boulder: ['boulder_0', 'boulder_1', 'boulder_2'], rock: ['boulder_0', 'boulder_1', 'boulder_2'],
    },
    statics: { urchin: 'urchin_0', abalone: 'abalone_0', cunjevoi: 'cunjevoi_0', weedyseadragon: 'seadragon_0', octopus: 'octopus_0', rocklobster: 'rocklobster_0' },
    land: { ghostcrab: 'crab_ghost', waratahanemone: 'waratah_0' },
  },
  treeShadows: { norfolkpine: [3, 12], casuarina: [2.4, 8], coastbanksia: [2, 4] }, // low tier: soft blob shadows under reef-placed trees [radius, height]
  menuCam: { yaw: 0.5, swing: 0.3, pitch: 0.7, dist: 20, lift: 1.5 },
  /** Hand-placed landmarks: the lifeguard tower on the beach, Norfolk Island pines and casuarinas along the foreshore, boats in the ramp cove, an angler's esky and bucket on the platform. */
  decorate(world) {
    const pr = world.props, T = world.terrain, rnd = Math.random;
    pr.place('lifeguard_tower', TOWER.x, TOWER.z, { rot: TOWER.rot, shadow: 2.2, tall: 3.4 });
    world.addCollider(TOWER.x, T.heightAt(TOWER.x, TOWER.z) + 1.5, TOWER.z, 2.1);
    // The foreshore reserve: Norfolk pines and a few casuarinas in a loose line behind the beach path (every stretch of the shore, but not on the point's tip).
    for (let s = S_BEACH_N + 6, k = 0; s < S_BEACH_S + 40; s += 21 + (k++ % 3) * 5) {
      const near = Math.abs(s - S_TIP) < 44 || (s > BL.S_RAMP - 30 && s < BL.S_PT1 - 12); if (near) continue;
      const m = k % 4 === 3 ? 'casuarina_' + (k % 2) : 'norfolk_pine_' + (k % 2), b = beachAt(s, 21 + (k % 2) * 4), sc = 0.95 + 0.15 * ((k * 7) % 5) / 4;
      pr.place(m, b.x, b.z, { rot: rnd() * 6.28, scale: sc, sink: 0.1, shadow: m.startsWith('norf') ? 3 : 2.4, tall: m.startsWith('norf') ? 12 : 8 });
      world.addCollider(b.x, T.heightAt(b.x, b.z) + 1, b.z, 1.1);
    }
    // The reserve on the point: a couple of pines by the car park and the lookout.
    for (const [dx, dz, m] of [[9, 8, 'norfolk_pine_0'], [11, -6, 'casuarina_1'], [-2, 11, 'norfolk_pine_1']]) {
      const x = BL.CARPARK.x + dx, z = BL.CARPARK.z + dz; pr.place(m, x, z, { rot: rnd() * 6.28, scale: 1.0, sink: 0.1, shadow: 3, tall: 12 }); world.addCollider(x, T.heightAt(x, z) + 1, z, 1.1);
    }
    // The sheltered ramp cove: a few little boats on moorings in the calm water off the ramp.
    for (const [da, db, rot] of [[22, -9, 0.4], [26, 6, -0.7], [34, -3, 1.1]]) {
      const x = RAMP.x0 + RAMP.nx * da + RAMP.tx * db, z = RAMP.z0 + RAMP.nz * da + RAMP.tz * db, boat = pr.place('tinnie', x, z, { float: true, rot }); if (boat) pr.floater(boat, 0.32);
    }
    // An angler's esky and bucket on the dry upper platform (found by looking for flat, dry ledge near the tip).
    let spot = null;
    for (let o = 5; o < 14 && !spot; o += 1) for (let s = S_TIP - 10; s <= S_TIP + 14 && !spot; s += 2) {
      const b = beachAt(s, -o), h = T.heightAt(b.x, b.z), hx = T.heightAt(b.x + 1.2, b.z), hz = T.heightAt(b.x, b.z + 1.2);
      if (h > 0.7 && h < 1.4 && Math.abs(h - hx) < 0.12 && Math.abs(h - hz) < 0.12 && platformMask(b.x, b.z) > 0.9) spot = b;
    }
    if (spot) { pr.place('esky', spot.x, spot.z, { rot: 0.4 }); pr.place('bucket', spot.x + 1.2, spot.z + 0.5, { rot: 0.4 }); }
    dressBeach(world); // shells, driftwood, wrack, umbrellas, towels and the beach-access path
    // Chunky rounded sandstone boulders along the platform's seaward edge, and a few on the shore of the point.
    const warm = new THREE.Color(1.28, 0.96, 0.7);
    let k = 0;
    for (let s = BL.S_PT0 + 4; s < BL.S_PT1 - 4; s += 7 + (k % 3)) {
      const base = beachAt(s, -8), W = BL.platW(s, base.x, base.z), b = beachAt(s, -(W - 1.5 + (k % 3)));
      const sc = 1.7 + ((k * 5) % 7) * 0.18; pr.place('boulder_' + (k % 3), b.x, b.z, { rot: k * 1.3, scale: sc, sink: 0.25 * sc, color: warm }); world.addCollider(b.x, T.heightAt(b.x, b.z) + 0.4 * sc, b.z, 0.55 * sc); k++;
    }
  },
  speciesInfo,
  placers: {
    // Urchins are scattered across the whole reef; outside the starting barren they are hidden until a lab run spreads it.
    barren: (rnd, terrain) => {
      for (let i = 0; i < 60; i++) {
        const a = rnd() * 6.283, r = (i < 30 && rnd() < 0.45 ? BARREN.r : 80) * Math.sqrt(rnd());
        const x = BARREN.x + Math.cos(a) * r, z = BARREN.z + Math.sin(a) * r;
        if (reefiness(x, z) > 0.3) return new THREE.Vector3(x, terrain.heightAt(x, z), z);
      }
      return new THREE.Vector3(BARREN.x, terrain.heightAt(BARREN.x, BARREN.z), BARREN.z);
    },
  },
  coral: [
    // Dense, like a healthy NSW dune system: spinifex mats on the foredune, a wall of wattle and heath behind, banksia woodland.
    ['spinifex', 1100, (x, z) => notPlatform(x, z) * (1 - BL.pointMask(x, z) * 0.85) * (onBeach(x, z, 12, 44) + 0.04)],
    ['pigface', 380, (x, z) => notPlatform(x, z) * (onBeach(x, z, 11, 50) * 0.9 + 0.04)],
    ['wattle', 520, (x, z) => notPlatform(x, z) * (shoreD(x, z) > 40 ? 1 : 0.06) * (0.4 + BL.bushAt(x, z))],
    ['heath', 440, (x, z) => notPlatform(x, z) * (shoreD(x, z) > 46 ? 1 : 0.05) * (0.4 + BL.bushAt(x, z))],
    ['banksia', 200, (x, z) => notPlatform(x, z) * (shoreD(x, z) > 52 ? 0.8 : 0.03) * (0.3 + BL.bushAt(x, z) * 1.4)],
    ['norfolkpine', 18, (x, z) => notPlatform(x, z) * onBeach(x, z, 16, 34)],
    ['casuarina', 24, (x, z) => notPlatform(x, z) * (onBeach(x, z, 14, 40) + 0.03)],
    ['hormosira', 420, (x, z) => platformMask(x, z)],
    ['kelp', 1300, (x, z, h) => (inBarren(x, z) ? 0 : 1) * (h < -3 && h > -13 ? 1 : 0.1)],
    ['coveweed', 360, (x, z, h) => BL.patchAt(x, z) * (h < -0.4 ? 1 : 0)],
    ['crayweed', 90, (x, z, h) => (inBarren(x, z) ? 0 : 1) * (h > -7 ? 1 : 0.2)],
    ['fingersponge', 70, (x, z, h) => (h < -11 ? 1 : 0.05)],
    ['vasesponge', 50, (x, z, h) => (h < -12 ? 1 : 0.05)],
    ['boulder', 160, (x, z) => reefiness(x, z)],
  ],
  life: {
    bluegroper: 3, redmorwong: 8, mado: 60, luderick: 14, kingfish: 25, oldwife: 6, snapper: 8, easternbluedevil: 3,
    greynurse: 3, portjackson: 4, wobbegong: 3, fiddlerray: 3, weedyseadragon: 5, octopus: 3, urchin: 420, abalone: 25, rocklobster: 5, cunjevoi: 30,
  },
};
