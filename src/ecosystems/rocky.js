// NSW rocky reef & kelp forest (Illawarra, near Woonona/Bellambi). Beach toward +z.
// Deep sand + sponge gardens (z < -60) -> boulder reef with kelp forest and an urchin barren -> sandbar -> beach (the walkable part).
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

const noise = makeNoise(77);
const BARREN = { x: 28, z: -28, r: 16 };
const BOULDERS = [[-30, -40, 7, 3], [10, -50, 8, 3.5], [-55, -20, 6, 2.5], [45, -45, 7, 3], [-10, -15, 6, 2.2], [30, -5, 5, 1.8]];

// ---- The shore (z > 70): beach, foredune, hind-dune scrub, and an Illawarra-style rock platform with rock pools
// at the eastern end below a sandstone bluff. Sea level is y = 0 (a low-ish tide, so the pools are exposed).
const PLATFORM = { x0: 50, z0: 66, z1: 114 };
export const POOLS = [[62, 76, 2.2], [71, 85, 3.0], [83, 73, 1.8], [90, 91, 2.6], [101, 79, 2.1], [110, 96, 3.2], [79, 101, 1.7], [121, 84, 2.5], [96, 105, 1.9], [132, 99, 2.8], [140, 80, 2.2]];
/** 0..1: how much of the rock platform is at (x, z). */
export function platformMask(x, z) {
  return smoothstep(PLATFORM.x0 - 6, PLATFORM.x0 + 6, x + noise.n2(z * 0.05, 3) * 6) * smoothstep(PLATFORM.z0 - 3, PLATFORM.z0 + 2, z + noise.n2(x * 0.08, 1) * 3);
}
/** Beach and dunes: height along the shore-normal axis z (x adds dune hummocks and beach cusps). */
function shoreHeight(x, z) {
  let h;
  if (z < 84) h = lerp(-1.2, 0, smoothstep(70, 84, z));
  else if (z < 102) h = lerp(0, 2.1, (z - 84) / 18);                 // beach face (about 1:9)
  else if (z < 116) h = lerp(2.1, 2.7, (z - 102) / 14);              // dry upper beach
  else if (z < 128) h = lerp(2.7, 7, smoothstep(116, 128, z));       // foredune
  else if (z < 140) h = lerp(7, 4.6, smoothstep(128, 140, z));       // swale
  else h = 4.6 + smoothstep(140, 160, z) * 1.5;                      // hind dune
  h += smoothstep(186, 200, z) * 10;                                 // rising ground at the edge of the map
  // Beach cusps on the swash zone; wind-sculpted hummocks and blowouts on the dunes.
  h += Math.sin(x * 0.26) * 0.12 * smoothstep(84, 88, z) * (1 - smoothstep(94, 100, z));
  const dune = smoothstep(112, 124, z);
  h += dune * (noise.fbm2(x * 0.035, z * 0.05, 4) * 2.6 + noise.fbm2(x * 0.15, z * 0.15, 2) * 0.45);
  return h;
}
/** Snap v (0..1) to n flat steps; k sets how sharp the risers are (smaller = sharper). */
function terrace(v, n, k) { const f = clamp(v, 0, 0.9999) * n, i = Math.floor(f); return (i + smoothstep(0.5 - k, 0.5 + k, f - i)) / n; }
/** 0..1: thin cracks and joints in the sandstone (ridged noise, the narrowest lines). */
function crackAt(x, z) {
  const a = 1 - Math.abs(noise.n2(x * 0.19 + 11, z * 0.23)), b = 1 - Math.abs(noise.n2(x * 0.31 - 5, z * 0.17 + 9));
  return smoothstep(0.93, 0.985, Math.max(a, b * 0.97)) * smoothstep(0.4, 0.8, platformMask(x, z));
}
function platformHeight(x, z) {
  // Gently rising platform with stepped ledges, gutters and a seaward drop; sandstone bluff behind it.
  let h = 0.45 + 0.45 * smoothstep(66, 110, z);
  // Tiered ledges: the height snaps to flat steps with short, steep risers between them (a few steps up and down across the platform).
  const ledge = 0.5 + noise.fbm2(x * 0.045 + 3, z * 0.05, 3) * 1.1;
  h += terrace(ledge, 4, 0.06) * 1.0 - 0.2 + noise.fbm2(x * 0.6, z * 0.6, 2) * 0.04;
  h -= crackAt(x, z) * 0.14;
  h -= Math.pow(Math.max(0, Math.sin(x * 0.21 + z * 0.05 + noise.n2(x * 0.05, z * 0.05) * 2)), 12) * 0.5; // gutters
  h -= (1 - smoothstep(64, 70, z)) * 3.2;                           // seaward edge drops into the swell
  for (const [px, pz, r] of POOLS) { const d = Math.hypot(x - px, z - pz) / (r * 1.3 * (1 + 0.16 * noise.n2(x * 0.4, z * 0.4))); if (d < 1) h -= 1.45 * (1 - d * d); }
  h += smoothstep(110, 124, z + noise.n2(x * 0.07, 7) * 4) * 13 + noise.fbm2(x * 0.2, z * 0.2, 2) * smoothstep(112, 120, z) * 1.5; // bluff
  return h;
}
function baseProfile(z) {
  if (z < -60) return lerp(-14, -18, smoothstep(-60, -95, z));
  if (z < 0) return lerp(-14, -5, smoothstep(-60, 0, z));        // boulder reef rising toward shore
  if (z < 28) return lerp(-5, -2.6, smoothstep(0, 20, z));        // sandbar where waves break
  return lerp(-2.6, -0.6, smoothstep(28, 75, z)) + smoothstep(80, 110, z) * 3;
}
export function reefiness(x, z) {
  let r = smoothstep(-66, -56, z) * (1 - smoothstep(-4, 6, z));
  r *= 0.7 + 0.3 * noise.n2(x * 0.04, z * 0.04);
  for (const [bx, bz, rad] of BOULDERS) r = Math.max(r, 1 - smoothstep(rad * 0.8, rad * 1.5, Math.hypot(x - bx, z - bz)));
  return clamp(r, 0, 1);
}
export function heightAt(x, z) {
  let h = baseProfile(z);
  const reef = reefiness(x, z);
  // Boulder field: blocky lumps + gutters running shore-normal
  h += reef * (Math.max(0, noise.fbm2(x * 0.09, z * 0.09, 4)) * 3.2 + noise.fbm2(x * 0.35, z * 0.35, 2) * 0.5);
  h -= reef * Math.pow(Math.max(0, Math.sin(x * 0.18 + noise.n2(x * 0.03, z * 0.03) * 2)), 6) * 1.6;
  h += noise.fbm2(x * 0.05, z * 0.05, 3) * 0.5;
  for (const [bx, bz, r, ht] of BOULDERS) { const d = Math.hypot(x - bx, z - bz) / r; if (d < 2) h += ht * Math.exp(-d * d * 2) * (0.8 + 0.4 * noise.n2(x * 0.5, z * 0.5)); }
  h = Math.min(h, -1.2);
  if (z < 66) return h;
  const shore = shoreHeight(x, z), k = smoothstep(66, 76, z);
  const beach = lerp(h, shore, k);
  const pm = platformMask(x, z);
  return pm > 0 ? lerp(beach, platformHeight(x, z), pm) : beach;
}
export function colorAt(x, z, h, slope) {
  if (z > 66 && h > -1.1) return shoreColor(x, z, h, slope);
  const reef = reefiness(x, z);
  const n = noise.n2(x * 0.3, z * 0.3);
  const sand = [0.7 + n * 0.04, 0.66 + n * 0.04, 0.55];
  const inBarren = Math.hypot(x - BARREN.x, z - BARREN.z) < BARREN.r;
  // Rock with pink coralline paint (barrens) or green-brown turf (under kelp)
  const rockC = inBarren ? (n > 0 ? [0.62, 0.45, 0.5] : [0.5, 0.42, 0.45]) : (n > 0.1 ? [0.36, 0.38, 0.24] : [0.42, 0.38, 0.3]);
  const t = clamp(reef * 1.3 - slope * 0.3, 0, 1);
  return [lerp(sand[0], rockC[0], t), lerp(sand[1], rockC[1], t), lerp(sand[2], rockC[2], t)];
}
function shoreColor(x, z, h, slope) {
  const n = noise.n2(x * 0.3, z * 0.3), n2 = noise.n2(x * 2.1, z * 2.1);
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // Sand: dark and wet in the swash zone, pale and dry up the beach, vegetated and darker on the dunes.
  // Warm quartz sand (Illawarra beaches are golden), darker where wet.
  const wet = [0.9 + n * 0.03, 0.78 + n * 0.03, 0.56], dry = [1.0, 0.92 + n * 0.02, 0.72]; // real dry sand reflects ~40–50%
  let c = mix3(wet, dry, smoothstep(0.1, 0.75, h));
  const cover = Math.max(0, Math.min(1, 0.55 + 0.6 * noise.fbm2(x * 0.08, z * 0.08, 3)));        // patchy plant cover
  c = mix3(c, [0.5 + n * 0.05, 0.54, 0.34], smoothstep(114, 124, z) * cover * 0.85);            // spinifex-covered foredune
  c = mix3(c, [0.27 + n * 0.04, 0.31 + n * 0.04, 0.18], smoothstep(130, 142, z) * (0.6 + 0.35 * cover)); // hind-dune scrub floor
  const pm = platformMask(x, z);
  if (pm > 0.01) {
    // Rock platform zonation: pink coralline + green algae in pools, olive turf low, barnacle-grey mid, bare dry rock high.
    let r;
    // Cosy palette: warm ochre sandstone on top, olive weed low down, bright coralline pink and green algae in the pools.
    if (h < -0.05) r = n2 > 0 ? [0.8, 0.5, 0.54] : [0.4, 0.6, 0.34];                           // pools: pink coralline, green algae
    else if (h < 0.5) r = mix3([0.5, 0.52, 0.3], [0.74, 0.56, 0.36], smoothstep(-0.05, 0.5, h) * (0.6 + 0.4 * n2)); // low shore: olive weed to sandstone
    else if (h < 0.95) r = mix3([0.78, 0.6, 0.4], [0.88, 0.7, 0.46], 0.5 + 0.5 * n2);        // mid shore sandstone
    else r = [0.9 + n * 0.04, 0.72 + n * 0.04, 0.48];                                          // dry upper platform: bright ochre
    if (slope > 0.35 && h > 1.2) r = [0.8 + n * 0.05, 0.56 + n * 0.05, 0.34];                   // orange sandstone bluff
    else if (h > -0.05) {
      // Gutters between the ledges are darker and weedy; each pool is ringed by wet olive algae so it reads clearly from above.
      const gut = Math.pow(Math.max(0, Math.sin(x * 0.21 + z * 0.05 + noise.n2(x * 0.05, z * 0.05) * 2)), 12);
      r = mix3(r, [0.5, 0.44, 0.28], Math.min(1, gut * 1.4));
      // Ledge risers and cracks are darker, warm brown, so the tiers read as stepped rock from above.
      if (z < 112) {
        const gx = platformHeight(x + 0.7, z) - platformHeight(x - 0.7, z), gz = platformHeight(x, z + 0.7) - platformHeight(x, z - 0.7), g = Math.hypot(gx, gz) / 1.4;
        r = mix3(r, [0.4, 0.27, 0.18], Math.min(1, smoothstep(0.08, 0.3, g) * 0.95 + crackAt(x, z) * 0.95));
        // Baked sun shading on the risers (sun from the +x side): faces toward it are bright, faces away are dark, so the ledges read as steps.
        const lit = Math.max(0.55, Math.min(1.3, 1 + (-gx * 0.55 + gz * 0.3) / 1.4 * 1.4));
        r = [r[0] * lit, r[1] * lit, r[2] * lit];
        r = mix3(r, [0.6, 0.45, 0.28], smoothstep(0.1, 0.3, noise.n2(x * 0.5, z * 0.5)) * 0.25 * (1 - smoothstep(0.1, 0.3, g))); // lighter, sunbaked ledge tops
      }
      let pd = 9; for (const [px, pz, pr] of POOLS) pd = Math.min(pd, Math.hypot(x - px, z - pz) / (pr * 1.3));
      r = mix3(r, [0.42, 0.52, 0.3], smoothstep(1.45, 1.05, pd) * 0.85);
    }
    c = mix3(c, r, Math.min(1, pm * 1.2));
  }
  return c;
}
/** Substrate for the terrain shader: 1 = rock (platform, bluff, reef boulders), 0 = sand. */
export function rockAt(x, z, h, slope) {
  if (z > 64) return Math.min(1, platformMask(x, z) * 1.3 + (slope > 0.5 && h > 2 ? 0.6 : 0));
  return Math.min(1, reefiness(x, z) * 1.1 + Math.max(0, slope - 0.4));
}
const inBarren = (x, z) => Math.hypot(x - BARREN.x, z - BARREN.z) < BARREN.r;

// ---- Habitat-forming plants and sponges
addGenerator('kelp', { fn: FL.kelp, variants: 5, scale: [1.0, 1.7], radius: 0.7, sink: 0.02, rough: 0.6, sway: 0.22, cluster: 16, bleaches: false, as: 'kelp', detailScale: 12, sat: 1.05, transl: 0.6, doubleSide: true, soft: true });
addGenerator('crayweed', { fn: FL.crayweed, variants: 3, scale: [0.9, 1.4], radius: 0.6, sink: 0.02, rough: 0.6, sway: 0.12, cluster: 6, bleaches: false, as: 'crayweed', detailScale: 12, sat: 1.1, transl: 0.5, doubleSide: true, soft: true });
addGenerator('fingersponge', { fn: FL.fingerSponge, variants: 3, scale: [0.8, 1.6], radius: 0.35, sink: 0.02, rough: 0.9, bleaches: false, as: 'spongegarden', cluster: 4 });
addGenerator('vasesponge', { fn: s => FL.vaseSponge(s, { colors: [[0.9, 0.6, 0.2], [0.8, 0.4, 0.3], [0.7, 0.65, 0.5]] }), variants: 3, scale: [0.8, 1.5], radius: 0.35, sink: 0.02, rough: 0.9, bleaches: false, as: 'spongegarden' });
// ---- Beach, dune and rock-platform plants (placed by height and region, not by reefiness)
const LANDX = { xMin: -170, xMax: 160 };
const notPlatform = (x, z) => 1 - platformMask(x, z);
addGenerator('spinifex', { fn: FO.spinifexPatch, foliage: true, noShadow: true, variants: 3, scale: [0.8, 1.3], radius: 0.45, sink: 0, rough: 0.8, sway: 0.25, cluster: 6, bleaches: false, as: 'spinifex', land: true, soft: true, transl: 0.35, sat: 1, ao: 0.3, minH: 1.9, maxH: 12, region: { ...LANDX, zMin: 104, zMax: 150 } });
addGenerator('pigface', { fn: FL.pigface, noShadow: true, variants: 2, scale: [0.9, 1.6], radius: 0.4, sink: 0, rough: 0.55, cluster: 5, bleaches: false, as: 'pigface', land: true, soft: true, sat: 1.05, minH: 2.2, maxH: 12, region: { ...LANDX, zMin: 108, zMax: 160 } });
addGenerator('wattle', { fn: FO.wattleShrub, foliage: true, variants: 3, scale: [0.8, 1.5], radius: 1.2, sink: 0.1, rough: 0.75, sway: 0.03, cluster: 6, bleaches: false, as: 'coastalwattle', land: true, soft: true, transl: 0.35, sat: 1.05, ao: 0.6, minH: 2.8, maxH: 16, region: { ...LANDX, zMin: 122, zMax: 198 } });
addGenerator('heath', { fn: FO.heathShrub, foliage: true, noShadow: true, variants: 2, scale: [0.8, 1.6], radius: 0.6, sink: 0.05, rough: 0.8, sway: 0.03, cluster: 8, bleaches: false, as: 'coastalwattle', land: true, soft: true, transl: 0.3, sat: 1.0, ao: 0.6, minH: 3, maxH: 16, region: { ...LANDX, zMin: 128, zMax: 198 } });
addGenerator('banksia', { fn: FO.banksiaTree, variants: 4, scale: [0.8, 1.3], radius: 1.1, sink: 0.1, rough: 0.75, sway: 0.004, cluster: 4, bleaches: false, as: 'coastbanksia', land: true, transl: 0.25, sat: 1.0, ao: 0.5, minH: 3.5, maxH: 18, region: { ...LANDX, zMin: 134, zMax: 198 } });
addGenerator('norfolkpine', { fn: FO.banksiaTree, variants: 2, scale: [0.75, 1.15], radius: 0.7, sink: 0.1, rough: 0.8, cluster: 2, bleaches: false, as: 'norfolkpine', land: true, minH: 2.4, maxH: 14, region: { ...LANDX, zMin: 112, zMax: 150 } });
addGenerator('casuarina', { fn: FO.banksiaTree, variants: 2, scale: [0.8, 1.25], radius: 0.6, sink: 0.1, rough: 0.8, cluster: 3, bleaches: false, as: 'casuarina', land: true, minH: 2.6, maxH: 14, region: { ...LANDX, zMin: 118, zMax: 160 } });
addGenerator('hormosira', { fn: FL.rockWeed, noShadow: true, variants: 4, scale: [0.7, 1.3], radius: 0.25, sink: 0.02, rough: 0.7, cluster: 7, bleaches: false, as: 'neptunesnecklace', land: true, soft: true, sat: 1.05, minH: 0.12, maxH: 0.85, region: { xMin: 46, xMax: 150, zMin: 66, zMax: 112 } });
addGenerator('boulder', { fn: rock, variants: 3, scale: [1.6, 4.2], radius: 1.6, sink: 0.4, rough: 0.95, bleaches: false });

// ---- Looks (procedural fish skins)
const { C, mix, sm, withEye, bars, spots, counter, hash } = P;
/** Smooth value noise (0..1): big soft blotches for patterned skins. */
const vnoise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, f = t => t * t * (3 - 2 * t), a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1); return (a + (b - a) * f(fx)) * (1 - f(fy)) + (c + (d - c) * f(fx)) * f(fy); };
const looks = {
  bluegroper: { length: 0.9, top: [.36,.52,.72,.88,.98,.94,.82,.62,.34], bot: [.36,.5,.7,.88,.98,.88,.7,.5,.3], topShare: 0.52, tailRound: 0.3, depth: 0.32, width: 0.2, peak: 0.55, snout: 0.45, tailFrac: 0.15, tail: 'round', tailSpan: 0.6, peduncle: 0.32, pectoral: 0.14, belly: 0.3, lips: true, hump: { at: 0.84, h: 0.28, w: 0.13 }, mouth: { len: 0.05, s: -0.15 }, // the male's bulbous forehead hump
    dorsal: { from: 0.12, to: 0.8, height: 0.06, shape: 'dual' }, anal: { from: 0.12, to: 0.45, height: 0.06 },
    // Eastern blue groper (male): a bright cornflower blue, paler on the belly, a big ROUNDED tail, thick lips, a smallish eye set low on the head.
    paint: { body: withEye((u, s) => mix(C(0xb4d6f4), C(0x62a0e0), sm(-0.55, 0.55, s)).map(v => v * (0.97 + 0.04 * Math.sin(u * 90 + s * 4))), 0.9, 0.3, 0.019, 0x111111, 0xd8a050), fin: () => C(0x74aae6) }, swim: { freq: 3, amp: 0.4 } },
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
    paint: { body: withEye(spots((u, s) => mix(C(0xf4d2c4), C(0xd4705e), sm(-0.3, 0.7, s)), 0x7ac4f4, 40, 0.085, (u, s) => s > -0.2), 0.9, 0.3, 0.028, 0x101010, 0xe8d8b0), fin: () => C(0xdc7a6a) }, swim: { freq: 3, amp: 0.5 } },
  easternbluedevil: { length: 0.3, depth: 0.32, width: 0.15, peak: 0.55, snout: 0.6, tailFrac: 0.15, tail: 'round', pectoral: 0.14,
    dorsal: { from: 0.12, to: 0.8, height: 0.12 }, anal: { from: 0.12, to: 0.45, height: 0.12 },
    paint: { body: withEye(spots((u, s) => mix(C(0x0a1a5a), C(0x1a3aa0), s * 0.5 + 0.5), 0xbfe0ff, 30, 0.1), 0.88, 0.25, 0.04), fin: (u, part, f) => (f > 0.8 ? C(0x60c0ff) : C(0x1a3aa0)) }, swim: { freq: 2.5, amp: 0.4 } },
  greynurse: { length: 2.6, depth: 0.18, width: 0.17, peak: 0.55, snout: 1.0, tailFrac: 0.26, tail: 'heterocercal', tailSpan: 0.6, pectoral: 0.15, pecWing: 0.4,
    dorsal: { from: 0.42, to: 0.58, height: 0.09, shape: 'tri' }, anal: { from: 0.15, to: 0.25, height: 0.06 },
    paint: { body: withEye(spots(counter(0x7a7a6a, 0xe8e0d0, 1.2), 0x5a3a2a, 16, 0.12, (u, s) => s > 0 && u < 0.7), 0.92, 0.2, 0.012, 0x050505, 0x222222), fin: () => C(0x6a6a5a) }, swim: { freq: 1.6, amp: 0.6 } },
  portjackson: { length: 1.1, depth: 0.2, width: 0.2, peak: 0.75, snout: 0.35, tailFrac: 0.22, tail: 'heterocercal', tailSpan: 1.1, pectoral: 0.16, pecWing: 0.6,
    dorsal: { from: 0.55, to: 0.65, height: 0.08, shape: 'tri' }, anal: { from: 0.2, to: 0.28, height: 0.05 },
    paint: { body: withEye((u, s) => { const harness = Math.abs(u - 0.66 + Math.abs(s) * 0.15) < 0.03 || Math.abs(u - 0.42 + Math.abs(s) * 0.1) < 0.03; return harness && s > -0.3 ? C(0x2a2018) : mix(C(0xe0d4c0), C(0xa89880), sm(-0.4, 0.5, s)); }, 0.88, 0.45, 0.025), fin: () => C(0x9a8a70) }, swim: { freq: 1.8, amp: 0.5 } },
  wobbegong: { length: 1.6, top: [.5,.6,.76,.9,1,1,.92,.65,.25], bot: [.5,.58,.72,.88,.96,.96,.88,.6,.22], wpts: [.4,.5,.62,.76,.88,1,1,.9,.4], fork: 0.4, tailRound: 0.25, lowerLobe: 0.3, tailSpan: 0.8, depth: 0.1, width: 0.28, peak: 0.7, snout: 0.25, tailFrac: 0.17, tail: 'round', pectoral: 0.17, pecWing: 0.55, boxy: 3, tassels: 8, pelvic: 0.1, mouth: { len: 0.1, s: -0.3 }, noLateral: true,
    dorsal: { from: 0.3, to: 0.4, height: 0.055 }, dorsal2: { from: 0.17, to: 0.26, height: 0.045 }, anal: { from: 0.1, to: 0.16, height: 0.035 },
    // Orectolobus: a flat shark with a fringe of branching tassels round the wide mouth and head, small eyes on top, two similar dorsals set far back, in a patchwork: pale cream blotches and saddles on olive-brown, outlined darker.
    paint: { body: withEye((u, s) => { const n = vnoise(u * 9, s * 3.4), base = mix(C(0xd6c8a0), C(0x7d6c44), sm(-0.3, 0.3, s)); if (s < -0.25) return base; return n > 0.62 ? C(0xefe2b6) : n > 0.54 ? C(0x6a5a38) : base; }, 0.86, 0.96, 0.012, 0x222222, 0xd8c060), fin: (u, part, f) => (f > 0.8 ? C(0xe6d8a8) : C(0x8a7850)) }, swim: { freq: 1.5, amp: 0.4 } },
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
  kingfish: { type: 'vortex', speed: 1.5, alt: [4, 8], flee: 3, groupSize: 25, at: [-25, -72], y: -10 },
  oldwife: { type: 'pair', radius: 8, speed: 0.3, alt: [1, 3], flee: 2 },
  snapper: { type: 'wander', radius: 20, speed: 0.4, alt: [1, 3], flee: 3 },
  easternbluedevil: { type: 'ambush', radius: 2, speed: 0.15, alt: [0.2, 0.7], flee: 4 },
  greynurse: { type: 'patrol', speed: 0.55, flee: 5, center: [-10, -58], y: -12 },
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

export const rocky = {
  id: 'rocky',
  name: 'Illawarra beach & rock platform',
  place: 'Woonona–Bellambi, NSW',
  blurb: 'A surf beach, dunes and a sandstone rock platform with rock pools. Fish the gutters and the platform edge.',
  terrainSize: 400, terrainSegments: 560, seabedKind: 'sand', ripple: 0.35, seed: 77,
  heightAt, colorAt, reefiness, rockAt,
  bounds: { xMin: -75, xMax: 75, zMin: -90, zMax: 60 },
  diveBounds: { xMin: -75, xMax: 75, zMin: -90, zMax: 92 }, // world.bounds (reef/life placement)
  water: {
    shafts: 0,
    absorb: [0.34, 0.1, 0.09], fog: 0x2d6a6c, fogDeep: 0x0f3236, fogDensity: 0.06,
    shallow: 0x3fcfc0, mid: 0x1f9aae, deep: 0x1a6a9c, exposure: 1.0,
    skyTop: 0x3a78c0, skyHorizon: 0xc0d8e2, sun: [0.55, 0.62, -0.3], sunColor: 0xfff0dc, sunIntensity: 2.3,
    hemiSky: 0xbfe0e8, hemiGround: 0x3a5a4a,
  },
  daylight: true,   // time of day: the sunset glow and the dark-blue night (ocean/daylight.js)
  sound: { wash: 1.2, wind: 0.4, shrimp: 0.6, gulls: 1 },
  island: { x: 0, z: 560, r: 420, h: 34 }, islandKind: 'headland', // the Illawarra escarpment behind the coastal plain
  // Rod fishing: rock platform to the east, surf beach elsewhere (keys of SPOTS in fishing/catches.js).
  fishing: { spotAt: (x, z) => (platformMask(x, z) > 0.3 ? 'rock' : 'beach') },
  land: {
    spawn: { x: 4, z: 92, yaw: -0.5 },
    bounds: { xMin: -165, xMax: 155, zMin: 55, zMax: 194 }, // seaward edge; the walker also stops wading at chest depth (SWIM_DEPTH)
    intro: 'You\'re on the beach at Woonona. Walk down to the water, press R for your rod (T opens your tackle box), and try the rock platform to the east (right) too. Press E to chat with the people you meet.',
    life: { ghostcrab: 28, oystercatcher: 4, silvergull: 12, waratahanemone: 70, bluelinedoctopus: 3 },
    flyingGulls: 6, gullCircle: { x: 5, z: 96 },
    home: { x: -3, z: 118, r: 5, label: 'the beach access path' }, // the top of the access path: walk here (or press H) to head home and end the outing
    zones: {
      ghostcrab: rnd => ({ x: -70 + rnd() * 105, z: 99 + rnd() * 14 }),
      oystercatcher: (rnd, i) => ({ x: -40 + Math.floor(i / 2) * 35 + rnd() * 3, z: 85.5 + rnd() * 2.5 }),
      silvergull: rnd => ({ x: -30 + rnd() * 50, z: 89 + rnd() * 12 }),
      waratahanemone: (rnd, i) => { const [px, pz, r] = POOLS[i % POOLS.length], a = rnd() * 6.283, d = r * (0.75 + rnd() * 0.45); return { x: px + Math.cos(a) * d, z: pz + Math.sin(a) * d }; },
      bluelinedoctopus: (rnd, i) => { const [px, pz, r] = POOLS[(i * 4 + 1) % POOLS.length]; return { x: px + (rnd() - 0.5) * r * 0.6, z: pz + (rnd() - 0.5) * r * 0.6 }; },
    },
  },
  cosyModels: {
    url: 'assets/models/rocky_cosy.glb',
    coral: {
      banksia: ['banksia_0', 'banksia_1'], norfolkpine: ['norfolk_pine_0', 'norfolk_pine_1'], casuarina: ['casuarina_0', 'casuarina_1'],
      kelp: ['kelp_0', 'kelp_1', 'kelp_2', 'kelp_3'], crayweed: ['crayweed_0', 'crayweed_1'], fingersponge: ['fingersponge_0', 'fingersponge_1'],
      vasesponge: ['vasesponge_0', 'vasesponge_1'], boulder: ['boulder_0', 'boulder_1', 'boulder_2'], rock: ['boulder_0', 'boulder_1', 'boulder_2'],
    },
    statics: { urchin: 'urchin_0', abalone: 'abalone_0', cunjevoi: 'cunjevoi_0', weedyseadragon: 'seadragon_0', octopus: 'octopus_0', rocklobster: 'rocklobster_0' },
    land: { ghostcrab: 'crab_ghost', waratahanemone: 'waratah_0' },
  },
  treeShadows: { norfolkpine: [3, 12], casuarina: [2.4, 8], coastbanksia: [2, 4] }, // low tier: soft blob shadows under reef-placed trees [radius, height]
  menuCam: { yaw: 0.5, swing: 0.3, pitch: 0.7, dist: 20, lift: 1.5 },
  /** Hand-placed landmarks: the lifeguard tower on the beach, Norfolk Island pines along the dune front, an angler's esky and bucket on the platform. */
  decorate(world) {
    const pr = world.props, T = world.terrain;
    const tx = -12, tz = 99.5;
    pr.place('lifeguard_tower', tx, tz, { rot: Math.PI, shadow: 2.2, tall: 3.4 });
    world.addCollider(tx, T.heightAt(tx, tz) + 1.5, tz, 2.1);
    for (const [x, z, m, s] of [[-40, 121, 'norfolk_pine_1', 1.0], [-27, 123, 'norfolk_pine_0', 1.1], [-8, 120.5, 'norfolk_pine_1', 0.95], [22, 122, 'norfolk_pine_0', 1.05], [38, 124, 'norfolk_pine_1', 1.1], [-52, 126, 'casuarina_0', 1.0], [12, 124.5, 'casuarina_1', 1.0]]) {
      pr.place(m, x, z, { rot: Math.random() * 6.28, scale: s, sink: 0.1, shadow: m.startsWith('norf') ? 3 : 2.4, tall: m.startsWith('norf') ? 12 : 8 });
      world.addCollider(x, T.heightAt(x, z) + 1, z, 1.1);
    }
    pr.place('esky', 58.5, 79.5, { rot: 0.4 }); pr.place('bucket', 59.7, 80.2, { rot: 0.4 });
    dressBeach(world); // shells, driftwood, wrack, umbrellas, towels and the beach-access path
    // Chunky rounded sandstone boulders along the platform's seaward edge and the foot of the bluff.
    const warm = new THREE.Color(1.28, 0.96, 0.7);
    for (const [x, z, m, s, r] of [[53, 70, 'boulder_0', 1.9, 0.5], [66, 67, 'boulder_1', 2.4, 2.1], [80, 66.5, 'boulder_2', 1.7, 4], [96, 68, 'boulder_0', 2.6, 1], [112, 67, 'boulder_1', 2.0, 3], [128, 70, 'boulder_2', 2.8, 5], [146, 74, 'boulder_0', 2.2, 2],
      [60, 109, 'boulder_2', 2.2, 0.3], [88, 111, 'boulder_1', 2.6, 2.6], [118, 110, 'boulder_0', 2.4, 4.4], [140, 108, 'boulder_2', 2.0, 1.5], [75, 86, 'boulder_1', 1.3, 3.3], [105, 90, 'boulder_0', 1.2, 0.8]]) {
      pr.place(m, x, z, { rot: r, scale: s, sink: 0.25 * s, color: warm });
      world.addCollider(x, T.heightAt(x, z) + 0.4 * s, z, 0.55 * s);
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
    ['spinifex', 1500, (x, z) => notPlatform(x, z) * (z > 112 && z < 134 ? 1 : 0.3)],
    ['pigface', 500, (x, z) => notPlatform(x, z) * (z > 112 && z < 140 ? 1 : 0.4)],
    ['wattle', 700, (x, z) => notPlatform(x, z) * (z > 127 ? 1 : 0.15)],
    ['heath', 600, (x, z) => notPlatform(x, z) * (z > 132 ? 1 : 0.1)],
    ['banksia', 240, (x, z) => notPlatform(x, z) * (z > 134 ? 1 : 0.1)],
    ['norfolkpine', 26, (x, z) => notPlatform(x, z) * (z > 114 && z < 146 ? 1 : 0.05)],
    ['casuarina', 30, (x, z) => notPlatform(x, z) * (z > 120 ? 1 : 0.05)],
    ['hormosira', 420, (x, z) => platformMask(x, z)],
    ['kelp', 1300, (x, z, h) => (inBarren(x, z) ? 0 : 1) * (h < -3 && h > -13 ? 1 : 0.1)],
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
