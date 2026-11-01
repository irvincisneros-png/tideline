// Seagrass meadows & mangroves — Moreton Bay, Queensland. Shore (mangroves) toward +z.
import * as THREE from 'three';
import { makeNoise, smoothstep, lerp, clamp } from '../core/noise.js';
import { species as speciesInfo } from '../content/seagrass.js';
import { addGenerator } from '../world/reef.js';
import { registerBehaviour, registerLook } from '../life/life.js';
import { paint as P } from '../life/looks.js';
import * as FL from '../world/flora.js';

const noise = makeNoise(31);
export function heightAt(x, z) {
  let h;
  if (z < 30) h = lerp(-3.6, -1.4, smoothstep(-80, 30, z));
  else if (z < 62) h = lerp(-1.4, 0.35, smoothstep(30, 60, z));
  else h = lerp(0.35, 2.2, smoothstep(62, 90, z));
  // A tidal channel winding across the bay
  const ch = Math.exp(-Math.pow((z + 25 + Math.sin(x * 0.03) * 12) / 9, 2));
  h -= ch * 1.6 * (z < 30 ? 1 : 0);
  h += noise.fbm2(x * 0.04, z * 0.04, 4) * 0.35 + noise.fbm2(x * 0.3, z * 0.3, 2) * 0.05;
  return h;
}
export const meadow = (x, z) => noise.fbm2(x * 0.025 + 3, z * 0.025, 3) > -0.08;
export function reefiness(x, z) { const h = heightAt(x, z); return h < -0.6 && h > -3.2 && meadow(x, z) ? 0.8 : 0.1; }
export function colorAt(x, z, h) {
  const n = noise.n2(x * 0.2, z * 0.2) * 0.05;
  if (h > 0.4) return [0.38 + n, 0.34 + n, 0.22];                // land behind the mangroves
  if (z > 30) return [0.36 + n, 0.31 + n, 0.24];                 // grey mud flat
  const g = meadow(x, z) ? 0.6 : 0;
  return [lerp(0.7, 0.42, g) + n, lerp(0.64, 0.46, g) + n, lerp(0.5, 0.3, g)];
}

addGenerator('zostera', { fn: s => FL.seagrassClump(s, { blades: 46, height: 0.45, spread: 0.65 }), variants: 4, scale: [0.9, 1.3], radius: 0.6, sink: 0, rough: 0.7, sway: 1.6, cluster: 8, bleaches: false, as: 'zostera', maxH: -0.5, minH: -3.4, detailScale: 30, transl: 0.5, doubleSide: true, soft: true });
addGenerator('halophila', { fn: FL.halophila, variants: 3, scale: [1, 2], radius: 0.3, sink: 0, rough: 0.7, cluster: 12, bleaches: false, as: 'halophila', maxH: -1.6, minH: -5.5 });
addGenerator('mangrove', { fn: FL.mangroveTree, variants: 4, scale: [0.9, 1.4], radius: 1.2, sink: 0.2, rough: 0.8, bleaches: false, upright: true, as: 'greymangrove', maxH: 0.5, minH: -0.9, cluster: 4 });
addGenerator('pneumatophores', { fn: FL.pneumatophores, variants: 3, scale: [1, 1.8], radius: 0.6, sink: 0.02, rough: 0.9, bleaches: false, as: 'greymangrove', maxH: 0.4, minH: -1.2, cluster: 6 });

const { C, mix, sm, withEye, bars, spots, counter, hash } = P;
const looks = {
  whiting: { length: 0.3, depth: 0.2, width: 0.13, peak: 0.6, snout: 1.1, tailFrac: 0.17, tail: 'forked', pectoral: 0.1,
    dorsal: { from: 0.3, to: 0.75, height: 0.08 }, anal: { from: 0.12, to: 0.42, height: 0.05 },
    paint: { body: withEye((u, s) => mix(C(0xf4f0e0), C(0xc8b880), sm(-0.2, 0.8, s)), 0.92, 0.2, 0.035), fin: () => C(0xe0c870) }, swim: { freq: 6, amp: 0.7 } },
  bream: { length: 0.35, depth: 0.42, width: 0.14, peak: 0.55, snout: 0.7, tailFrac: 0.17, tail: 'forked', pectoral: 0.13,
    dorsal: { from: 0.2, to: 0.78, height: 0.1, shape: 'tri' }, anal: { from: 0.18, to: 0.42, height: 0.08 },
    paint: { body: withEye((u, s) => mix(C(0xe8eaea), C(0x8a9080), sm(-0.2, 0.8, s)), 0.88, 0.25, 0.04), fin: (u, part) => (part === 'anal' || part === 'pectoral' ? C(0xe8c040) : C(0x9aa090)) }, swim: { freq: 4, amp: 0.6 }, metal: 0.3 },
  mullet: { length: 0.45, depth: 0.22, width: 0.16, peak: 0.6, snout: 0.45, tailFrac: 0.18, tail: 'forked', pectoral: 0.11,
    dorsal: { from: 0.35, to: 0.5, height: 0.08, shape: 'tri' }, anal: { from: 0.2, to: 0.35, height: 0.06 },
    paint: { body: withEye((u, s) => mix(C(0xdce2e4), C(0x5a6a70), sm(-0.1, 0.8, s)).map(v => v * (Math.sin(s * 18) > 0.85 ? 0.85 : 1)), 0.92, 0.25, 0.035), fin: () => C(0x6a7a80) }, swim: { freq: 4.5, amp: 0.6 }, metal: 0.4 },
  flathead: { length: 0.6, depth: 0.1, width: 0.24, peak: 0.75, snout: 0.25, tailFrac: 0.16, tail: 'truncate', pectoral: 0.14, pecWing: 0.8, boxy: 3,
    dorsal: { from: 0.2, to: 0.7, height: 0.05 }, anal: { from: 0.15, to: 0.5, height: 0.04 },
    paint: { body: withEye(spots((u, s) => mix(C(0xe8dcc0), C(0x8a7050), sm(-0.3, 0.3, s)), 0x4a3a28, 30, 0.14, (u, s) => s > -0.2), 0.85, 0.65, 0.025, 0x222222, 0xd0b060), fin: () => C(0x8a7050) }, swim: { freq: 2.5, amp: 0.5 } },
  juvenilesnapper: { length: 0.12, depth: 0.38, width: 0.14, peak: 0.6, snout: 0.6, tailFrac: 0.18, tail: 'forked', pectoral: 0.12,
    dorsal: { from: 0.2, to: 0.78, height: 0.09 }, anal: { from: 0.16, to: 0.4, height: 0.07 },
    paint: { body: withEye(bars((u, s) => mix(C(0xf0d0c0), C(0xc07a6a), sm(-0.3, 0.7, s)), [[0.6, 0.03, 0xa05a50], [0.4, 0.03, 0xa05a50]]), 0.9, 0.28, 0.05), fin: () => C(0xd08070) }, swim: { freq: 7, amp: 0.8 } },
  pipefish: { length: 0.18, depth: 0.05, width: 0.05, peak: 0.5, snout: 1.4, tailFrac: 0.05, tail: 'round', pectoral: 0.03, peduncle: 0.3,
    dorsal: { from: 0.45, to: 0.6, height: 0.04 }, anal: null,
    paint: { body: withEye((u, s) => (Math.sin(u * 120) > 0.6 ? C(0x6a7a3a) : C(0x9aa858)), 0.95, 0.2, 0.06), fin: () => C(0x9aa858) }, swim: { freq: 3, amp: 0.3 }, waveK: 3 },
  cuttlefish: { length: 0.3, depth: 0.32, width: 0.28, peak: 0.55, snout: 0.45, tailFrac: 0.02, tail: 'none', pectoral: 0, belly: 0.2,
    dorsal: { from: 0.05, to: 0.9, height: 0.05 }, anal: { from: 0.05, to: 0.9, height: 0.05 },
    paint: { body: withEye((u, s) => { const zeb = Math.sin(u * 50 + Math.sin(s * 6) * 2) > 0.4 && s > 0; return zeb ? C(0x5a4030) : mix(C(0xe8dcc8), C(0xa08a6a), sm(-0.4, 0.5, s)); }, 0.84, 0.2, 0.05, 0x111111, 0xd8c880), fin: () => C(0xd8ccb0) }, swim: { freq: 6, amp: 0.15 } },
  eagleray: { kind: 'manta', length: 0.9, span: 1.8, thick: 0.22, tail: 1.6,
    // Whitespotted eagle ray (Aetobatus ocellatus): dark back with round white spots (jittered grid), white belly.
    paint: (u, v, top) => {
      if (!top) return C(0xf2f2ee);
      const gu = u * 16, gv = v * 16, cu = Math.floor(gu), cv = Math.floor(gv);
      const ok = hash(cu, cv) > 0.3, jx = 0.5 + (hash(cu + 7.1, cv) - 0.5) * 0.5, jy = 0.5 + (hash(cu, cv + 3.3) - 0.5) * 0.5;
      const d = Math.hypot(gu - cu - jx, gv - cv - jy), r = 0.16 + 0.12 * hash(cu + 1.7, cv + 9.1);
      return ok && d < r ? C(0xf0f0f0) : C(0x2a3036);
    }, swim: { freq: 1.6, amp: 0.6 } },
  shovelnose: { length: 1.6, depth: 0.1, width: 0.3, peak: 0.7, snout: 0.9, tailFrac: 0.2, tail: 'heterocercal', tailSpan: 0.7, pectoral: 0.2, pecWing: 1.2, boxy: 3,
    dorsal: { from: 0.3, to: 0.42, height: 0.07, shape: 'tri' }, anal: null,
    paint: { body: withEye(counter(0xb8a07a, 0xf0e8d8, 0.6), 0.85, 0.6, 0.02), fin: () => C(0xb8a07a) }, swim: { freq: 1.8, amp: 0.4 } },
  dugong: { length: 2.7, depth: 0.27, width: 0.3, peak: 0.45, snout: 0.35, tailFrac: 0.14, tail: 'fluke', tailSpan: 1.1, pectoral: 0.12, pecAt: 0.78, smooth: true, belly: 0.3,
    dorsal: null, anal: null, vertical: true,
    paint: { body: withEye((u, s) => mix(C(0xb8b0a4), C(0x7a7266), sm(-0.4, 0.6, s)).map(v => v * (0.95 + 0.05 * hash(Math.floor(u * 60), Math.floor(s * 30)))), 0.93, 0.25, 0.01, 0x1a1a1a, 0x3a3a3a), fin: () => C(0x7a7266) }, swim: { freq: 0.9, amp: 0.7 } },
};
for (const [id, l] of Object.entries(looks)) registerLook(id, l);

const B = {
  dugong: { type: 'breather', graze: true, radius: 28, speed: 0.45, breathEvery: 45, breathTime: 3, flee: 3 },
  greenturtle: { type: 'turtle', speed: 0.35, flee: 2.5, at: [5, -15], y: -1.6 },
  eagleray: { type: 'patrol', speed: 0.7, flee: 3, center: [0, -20], y: -2.4 },
  shovelnose: { type: 'rest', speed: 0.6, flee: 2.5 },
  seahorse: { type: 'hover', gen: 'seahorse', place: 'coral:zostera', onTop: 0.6, camo: true, radius: 0.12, scale: [1.4, 1.8], range: 0.05 },
  pipefish: { type: 'ambush', radius: 1.5, speed: 0.06, alt: [0.15, 0.4], flee: 1, camo: true, nearCoral: 'zostera' },
  whiting: { type: 'school', speed: 0.4, alt: [0.2, 0.6], flee: 3, groupSize: 15 },
  bream: { type: 'wander', radius: 15, speed: 0.35, alt: [0.4, 1.3], flee: 2.5 },
  mullet: { type: 'school', speed: 0.5, flee: 3, groupSize: 20, at: [15, -5], spread: 30, y: -0.9 },
  flathead: { type: 'rest', speed: 0.8, flee: 1.2, camo: true },
  juvenilesnapper: { type: 'school', speed: 0.3, alt: [0.2, 0.7], flee: 2.5, groupSize: 20, nearCoral: 'zostera' },
  blueswimmer: { type: 'crawl', gen: 'crab', opts: { color: [0.25, 0.4, 0.75], size: 0.1 }, place: 'sand', speed: 0.05, radius: 0.15 },
  mudcrab: { type: 'crawl', gen: 'crab', opts: { color: [0.25, 0.3, 0.2], size: 0.13 }, place: 'mangrove', speed: 0.03, radius: 0.18 },
  soldiercrab: { type: 'crawl', gen: 'crab', opts: { color: [0.45, 0.6, 0.9], size: 0.03 }, place: 'flat', speed: 0.04, radius: 0.12, scale: [1, 1.3] },
  cuttlefish: { type: 'wander', radius: 8, speed: 0.2, alt: [0.4, 1.2], flee: 2, camo: true },
  seahare: { type: 'static', gen: 'seahare', place: 'coral:zostera', onTop: 0.05, radius: 0.12, scale: [1, 1.5] },
  jellyfish: { type: 'drift', gen: 'jellyfish', opts: { radius: 0.2, color: [0.85, 0.82, 0.9], rim: [0.95, 0.9, 1.0], arms: 8, armLen: 1.6, tentacles: 0, dome: 0.75 }, place: 'water', depth: [-2.5, -0.8], transparent: 0.7, pulse: true, radius: 0.3, speed: 0.07 },
};
for (const [id, b] of Object.entries(B)) registerBehaviour(id, b);

export const seagrass = {
  id: 'seagrass',
  name: 'Seagrass & mangroves',
  place: 'Estuary bank (Lake Illawarra later)',
  blurb: 'Shallow, green water over seagrass meadows, with mangroves lining the bank. A fish nursery.',
  terrainSize: 320, terrainSegments: 256, seabedKind: 'sand', ripple: 0.5, seed: 31, rocks: 0,
  heightAt, colorAt, reefiness,
  bounds: { xMin: -75, xMax: 75, zMin: -80, zMax: 60 },
  water: {
    shafts: 0,
    absorb: [0.4, 0.15, 0.24], fog: 0x527a64, fogDeep: 0x34523f, fogDensity: 0.1,
    shallow: 0x8cb89a, mid: 0x5e9a80, deep: 0x33604c, fogDepthScale: 6,
    skyTop: 0x2a6fc4, skyHorizon: 0xcde4ee, sun: [0.3, 0.86, -0.3], sunIntensity: 2.6,
    hemiSky: 0xd0e8e0, hemiGround: 0x4a5a3a,
  },
  sound: { wash: 0.35, wind: 0.2, shrimp: 0.35, gulls: 0.3, mangroveBirds: 1, mangroveAt: [0, 66] },
  menuCam: { look: [0, 0.5, 40], r: 26, y: 5 },
  // Placeholder bank for phase 0 (Lake Illawarra later): stand on the mud flat behind the mangroves and fish the shallows.
  fishing: { spotAt: () => 'estuary' },
  land: {
    spawn: { x: 0, z: 66, yaw: 0 },
    bounds: { xMin: -75, xMax: 75, zMin: 20, zMax: 110 },
    intro: 'You\'re on the bank of a mangrove estuary. Press R for your rod and cast out over the seagrass flats.',
    life: {}, zones: {},
  },
  island: null,
  cosyModels: {
    url: 'assets/models/seagrass_cosy.glb',
    coral: { zostera: ['zostera_0', 'zostera_1', 'zostera_2'], halophila: ['halophila_0', 'halophila_1'], mangrove: ['mangrove_0', 'mangrove_1', 'mangrove_2'], pneumatophores: ['pneumato_0', 'pneumato_1'] },
    statics: { seahorse: 'seahorse_0', blueswimmer: 'crab_blueswimmer', mudcrab: 'crab_mud', soldiercrab: 'crab_soldier', seahare: 'seahare_0', jellyfish: 'jelly_blubber' },
  },
  speciesInfo,
  placers: {
    mangrove: (rnd, t) => { for (let i = 0; i < 200; i++) { const x = (rnd() - 0.5) * 140, z = 38 + rnd() * 22; const h = t.heightAt(x, z); if (h < 0.2 && h > -0.9) return new THREE.Vector3(x, h, z); } return new THREE.Vector3(0, -0.5, 45); },
    flat: (rnd, t) => { const x = (rnd() - 0.5) * 120, z = 32 + rnd() * 8; return new THREE.Vector3(x, t.heightAt(x, z), z); },
  },
  coral: [
    ['zostera', 2300, (x, z, h) => (meadow(x, z) ? 1 : 0.01)],
    ['halophila', 500, (x, z, h) => (h < -1.8 ? 1 : 0.1)],
    ['mangrove', 70, (x, z) => (z > 38 ? 1 : 0)],
    ['pneumatophores', 220, (x, z) => (z > 34 ? 1 : 0)],
  ],
  life: {
    dugong: 3, greenturtle: 3, eagleray: 3, shovelnose: 3, seahorse: 8, pipefish: 6, whiting: 30, bream: 10, mullet: 40,
    flathead: 5, juvenilesnapper: 40, blueswimmer: 6, mudcrab: 5, soldiercrab: 30, cuttlefish: 3, seahare: 6, jellyfish: 10,
  },
};
