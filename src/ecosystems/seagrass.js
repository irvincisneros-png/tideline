// Lake Illawarra (the "seagrass" site): a sunny NSW estuary lakeshore. Shore toward +z, the lake toward -z.
// A cream sand bank with a grassy edge, clear shallow sand flats with seagrass patches, a deeper channel, a muddy grey-mangrove edge
// on the left only, and a plank wooden jetty with posts out to the channel (walkable; casts off its end count as the 'jetty' spot).
// Near the jetty base: a bait-shop hut, a fish-cleaning table, a moored tinnie; casuarinas, Norfolk Island pines and pelicans on the posts.
import * as THREE from 'three';
import { makeNoise, smoothstep, lerp } from '../core/noise.js';
import { species as speciesInfo } from '../content/seagrass.js';
import { addGenerator } from '../world/reef.js';
import { registerBehaviour, registerLook } from '../life/life.js';
import { paint as P } from '../life/looks.js';
import * as FL from '../world/flora.js';
import * as FO from '../world/foliage.js';
import '../fishing/fishLooks.js'; // the line-caught species' looks are also what swims in the Lake

const noise = makeNoise(31);

/** Waterline (z where the bank meets the water) along x, and the centre line of the deeper channel. */
export const shoreZ = x => 44 + 4 * Math.sin(x * 0.04 + 1) + 2.5 * Math.sin(x * 0.11 + 0.3);
export const chanZ = x => shoreZ(x) - 40 + 7 * Math.sin(x * 0.035 + 2);
/** 0..1: how much this is the muddy mangrove edge (the left side of the shore only). */
const mudAt = x => smoothstep(-26, -46, x);
const shoreAt = x => shoreZ(x) - mudAt(x) * 9; // the mud bank pushes out into the lake

// The jetty: deck at y, running from the bank (z0) out toward the channel (z1 < z0).
export const JETTY = { x: 16, w: 2.4, y: 0.95, len: 2 };
JETTY.z0 = shoreZ(JETTY.x) + 3.6;
JETTY.z1 = chanZ(JETTY.x) + 5;
export const deckAt = (x, z) => (Math.abs(x - JETTY.x) < JETTY.w / 2 - 0.05 && z < JETTY.z0 + 0.4 && z > JETTY.z1 - 0.9 ? JETTY.y : null);

export function heightAt(x, z) {
  const mud = mudAt(x), d = z - shoreAt(x); // d > 0 on the bank
  let h;
  if (d >= 0) {
    h = 0.95 * smoothstep(0, 5.5 + mud * 6, d);                                   // the sand bank
    h += smoothstep(14, 70, d) * 2.4 + smoothstep(10, 22, d) * 0.15;               // grassy rise behind
    h += noise.fbm2(x * 0.05, z * 0.05, 3) * 0.4 * smoothstep(8, 22, d);
  } else {
    // A long, clear, gently sloping sandy flat...
    h = -0.04 - Math.min(-d, 36) * (0.032 - mud * 0.016);
    // ...a deeper channel across the lake, and deeper water beyond it.
    h -= 2.1 * Math.exp(-Math.pow((z - chanZ(x)) / 8.5, 2));
    h -= smoothstep(chanZ(x) - 8, chanZ(x) - 70, z) * 1.6;
    h += noise.fbm2(x * 0.06, z * 0.06, 3) * 0.1 * smoothstep(0, 4, -d);
  }
  return h + noise.fbm2(x * 0.3, z * 0.3, 2) * 0.03;
}
/** Patchy seagrass meadows across the shallows (visible through the clear water). */
export const meadow = (x, z) => noise.fbm2(x * 0.05 + 3, z * 0.05, 3) > 0.02;
export function reefiness(x, z) { const h = heightAt(x, z); return h < -0.3 && h > -2.3 && meadow(x, z) ? 0.8 : 0.1; }
export function colorAt(x, z, h) {
  const n = noise.n2(x * 0.2, z * 0.2) * 0.04, n2 = noise.n2(x * 0.05 + 9, z * 0.05), mud = mudAt(x);
  const d = z - shoreAt(x);
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  let c = [0.96 + n, 0.88 + n, 0.69];                                           // warm cream sand
  if (h < -1.3) c = mix3(c, [0.66, 0.7, 0.62], smoothstep(-1.3, -3.0, h));       // darker silt in the channel
  if (meadow(x, z) && h < -0.3 && h > -2.3) c = mix3(c, [0.4, 0.52, 0.34], 0.5); // seagrass patches show as soft green-brown
  if (d > 0) {
    c = mix3([0.84, 0.74, 0.55], [0.97, 0.89, 0.7], smoothstep(0, 0.6, h));      // damp sand at the waterline
    c = mix3(c, [0.55 + n * 2, 0.7 + n, 0.33], smoothstep(4.5, 9.5, d + n2 * 7)); // sand bank to grass
    c = mix3(c, [0.42 + n, 0.6 + n, 0.3], smoothstep(30, 60, d));                 // greener, deeper on the hill
  }
  if (mud > 0 && h < 1.0) c = mix3(c, [0.56, 0.5, 0.4], mud * 0.85);             // muddy, grey-brown on the mangrove edge
  return c;
}

// ---- Seagrass and mangroves (the mangroves stand along the muddy left edge only)
addGenerator('zostera', { fn: s => FL.seagrassClump(s, { blades: 46, height: 0.45, spread: 0.65 }), variants: 4, scale: [0.9, 1.3], radius: 0.6, sink: 0, rough: 0.7, sway: 1.6, cluster: 8, bleaches: false, as: 'zostera', maxH: -0.3, minH: -3.4, detailScale: 30, transl: 0.5, doubleSide: true, soft: true });
addGenerator('halophila', { fn: FL.halophila, variants: 3, scale: [1, 2], radius: 0.3, sink: 0, rough: 0.7, cluster: 12, bleaches: false, as: 'halophila', maxH: -1.0, minH: -5.5 });
addGenerator('mangrove', { fn: FL.mangroveTree, variants: 4, scale: [0.65, 1.05], radius: 1.2, sink: 0.2, rough: 0.8, bleaches: false, upright: true, as: 'greymangrove', maxH: 0.55, minH: -0.9, cluster: 4 });
addGenerator('pneumatophores', { fn: FL.pneumatophores, variants: 3, scale: [1, 1.8], radius: 0.6, sink: 0.02, rough: 0.9, bleaches: false, as: 'greymangrove', maxH: 0.45, minH: -1.2, cluster: 6 });
// ---- Lakeshore trees and tussocks: Blender models (the foliage-card fallbacks only show if the model set fails to load)
const LAND = { xMin: -125, xMax: 125, zMin: 52, zMax: 150 };
addGenerator('casuarina', { fn: FO.banksiaTree, variants: 2, scale: [0.8, 1.3], radius: 0.6, sink: 0.1, rough: 0.8, cluster: 3, bleaches: false, as: 'casuarina', land: true, minH: 0.8, maxH: 12, region: LAND });
addGenerator('norfolkpine', { fn: FO.banksiaTree, variants: 2, scale: [0.75, 1.15], radius: 0.7, sink: 0.1, rough: 0.8, cluster: 2, bleaches: false, as: 'norfolkpine', land: true, minH: 0.8, maxH: 12, region: LAND });
addGenerator('lakebanksia', { fn: FO.banksiaTree, variants: 2, scale: [0.8, 1.3], radius: 0.9, sink: 0.1, rough: 0.8, cluster: 3, bleaches: false, as: 'coastbanksia', land: true, minH: 1.0, maxH: 12, region: LAND });
addGenerator('lakegrass', { fn: FO.spinifexPatch, foliage: true, noShadow: true, variants: 3, scale: [0.8, 1.2], radius: 0.4, sink: 0, rough: 0.8, sway: 0.25, cluster: 8, bleaches: false, as: 'spinifex', land: true, soft: true, ao: 0.3, minH: 0.7, maxH: 12, region: LAND });
addGenerator('lakebush', { fn: FO.banksiaTree, variants: 2, scale: [0.4, 0.75], radius: 0.6, sink: 0.05, rough: 0.8, cluster: 5, bleaches: false, as: 'coastbanksia', land: true, minH: 0.9, maxH: 12, region: LAND });

const { C, mix, sm, withEye } = P;
const looks = {
  pipefish: { length: 0.18, depth: 0.05, width: 0.05, peak: 0.5, snout: 1.4, tailFrac: 0.05, tail: 'round', pectoral: 0.03, peduncle: 0.3,
    dorsal: { from: 0.45, to: 0.6, height: 0.04 }, anal: null,
    paint: { body: withEye((u, s) => (Math.sin(u * 120) > 0.6 ? C(0x6a7a3a) : C(0x9aa858)), 0.95, 0.2, 0.06), fin: () => C(0x9aa858) }, swim: { freq: 3, amp: 0.3 }, waveK: 3 },
  cuttlefish: { length: 0.3, depth: 0.32, width: 0.28, peak: 0.55, snout: 0.45, tailFrac: 0.02, tail: 'none', pectoral: 0, belly: 0.2,
    dorsal: { from: 0.05, to: 0.9, height: 0.05 }, anal: { from: 0.05, to: 0.9, height: 0.05 },
    paint: { body: withEye((u, s) => { const zeb = Math.sin(u * 50 + Math.sin(s * 6) * 2) > 0.4 && s > 0; return zeb ? C(0x5a4030) : mix(C(0xe8dcc8), C(0xa08a6a), sm(-0.4, 0.5, s)); }, 0.84, 0.2, 0.05, 0x111111, 0xd8c880), fin: () => C(0xd8ccb0) }, swim: { freq: 6, amp: 0.15 } },
};
for (const [id, l] of Object.entries(looks)) registerLook(id, l);

const B = {
  seahorse: { type: 'hover', gen: 'seahorse', place: 'coral:zostera', onTop: 0.6, camo: true, radius: 0.12, scale: [1.4, 1.8], range: 0.05 },
  pipefish: { type: 'ambush', radius: 1.5, speed: 0.06, alt: [0.15, 0.4], flee: 1, camo: true, nearCoral: 'zostera' },
  sandwhiting: { type: 'school', speed: 0.4, alt: [0.2, 0.6], flee: 3, groupSize: 12 },
  yellowfinbream: { type: 'wander', radius: 15, speed: 0.35, alt: [0.4, 1.3], flee: 2.5 },
  seamullet: { type: 'school', speed: 0.5, flee: 3, groupSize: 16, at: [10, 24], spread: 40, y: -0.7 },
  duskyflathead: { type: 'rest', speed: 0.8, flee: 1.2, camo: true },
  luderick: { type: 'grazer', radius: 10, speed: 0.4, alt: [0.5, 1.6], flee: 3 },
  blueswimmer: { type: 'crawl', gen: 'crab', opts: { color: [0.25, 0.4, 0.75], size: 0.1 }, place: 'sand', speed: 0.05, radius: 0.15 },
  soldiercrab: { type: 'crawl', gen: 'crab', opts: { color: [0.45, 0.6, 0.9], size: 0.03 }, place: 'flat', speed: 0.04, radius: 0.12, scale: [1, 1.3] },
  cuttlefish: { type: 'wander', radius: 8, speed: 0.2, alt: [0.4, 1.0], flee: 2, camo: true },
};
for (const [id, b] of Object.entries(B)) registerBehaviour(id, b);

/** The spot a cast belongs to (keys of SPOTS): where the float lands (tx, tz), not where the angler stands. */
function spotAt(px, pz, tx = px, tz = pz) {
  if (Math.hypot(tx - JETTY.x, tz - JETTY.z1) < 20 && tz < JETTY.z1 + 5) return 'jetty';          // off the end of the jetty (the pylon shade and the channel just beyond it)
  const h = heightAt(tx, tz);
  if (tx < -28 && h > -1.0) return 'mangrove';                                                    // the muddy mangrove edge
  if (Math.exp(-Math.pow((tz - chanZ(tx)) / 8.5, 2)) > 0.45) return 'channel';
  if (meadow(tx, tz) && h < -0.35) return 'seagrass';
  return 'flats';
}

/** Hand-placed landmarks: the jetty, its posts, pelicans, a moored tinnie, the bait-shop hut, the cleaning table, trees. */
function decorate(world) {
  const pr = world.props, T = world.terrain, rnd = Math.random;
  const J = JETTY, yTop = J.y;
  // Deck sections, end to end.
  const n = Math.ceil((J.z0 - J.z1) / J.len);
  for (let i = 0; i < n; i++) pr.place('jetty_deck', J.x, J.z0 - J.len * (i + 0.5), { y: yTop });
  pr.place('jetty_end', J.x, J.z1 - 0.2, { y: yTop });
  pr.place('jetty_rope', J.x + 0.7, J.z1 + 0.5, { y: yTop, rot: 0.6 });
  // Posts every 4 m on both sides (stacked where the water is deep); the bank end stands on sand.
  const posts = [];
  for (let z = J.z0 - 1; z > J.z1 - 0.5; z -= 4) for (const side of [-1, 1]) {
    const x = J.x + side * (J.w / 2 + 0.05), g = T.heightAt(x, z);
    for (let y = yTop; ; y -= 3.6) { pr.place('jetty_post', x, z, { y }); if (y - 3.4 <= g - 0.2 || y < yTop - 12) break; }
    posts.push([x, z]);
  }
  // Pelicans on posts along the jetty.
  for (const [k, i] of [17, 12, 8, 3].entries()) {
    const [x, z] = posts[Math.min(i, posts.length - 1)], p = pr.place('pelican', x, z, { y: yTop + 0.78, rot: Math.PI + (rnd() - 0.5) * 1.6 }); if (p) pr.idle(p, 0.3 + k * 0.05);
  }
  // A moored tinnie beside the jetty, and kit on the deck.
  const bx = J.x + 7, bz = shoreZ(bx) - 15, boat = pr.place('tinnie', bx, bz, { float: true, rot: -0.5 }); if (boat) pr.floater(boat, 0.32); // riding a little high so the hull floor stays dry
  pr.place('esky', J.x - 0.5, J.z0 - 6, { y: yTop, rot: 0.3 }); pr.place('bucket', J.x + 0.7, J.z0 - 9, { y: yTop });
  // Bait-shop hut and fish-cleaning table on the grass at the jetty's base, facing the water.
  const hx = J.x - 11, hz = shoreZ(hx) + 13;
  pr.place('bait_hut', hx, hz, { rot: Math.PI + 0.1, shadow: 3.6, tall: 3.8 });
  world.addCollider(hx, T.heightAt(hx, hz) + 1, hz, 4.2);
  const tx = J.x + 7.5, tz = shoreZ(tx) + 9;
  pr.place('cleaning_table', tx, tz, { rot: Math.PI - 0.15, shadow: 1.6, tall: 1.3 });
  pr.place('bucket', tx + 2.2, tz + 0.1, { rot: 0.5 }); pr.place('esky', tx - 1.8, tz + 0.8, { rot: 0.9 });
  world.addCollider(tx + 0.3, T.heightAt(tx, tz) + 0.6, tz, 2.4);
  // Hero trees around the hut and along the bank.
  for (const [x, dz, m, s] of [[-30, 12, 'casuarina_0', 1.0], [-22, 19, 'norfolk_pine_1', 1.0], [-3, 16, 'casuarina_1', 1.05], [30, 20, 'norfolk_pine_0', 1.05], [38, 12, 'casuarina_0', 0.95], [-44, 6, 'casuarina_1', 1.0], [52, 14, 'casuarina_1', 1.0]]) {
    const z = shoreZ(x) + dz, y = T.heightAt(x, z);
    pr.place(m, x, z, { rot: rnd() * 6.28, scale: s, sink: 0.1, shadow: m.startsWith('norf') ? 3 : 2.4, tall: m.startsWith('norf') ? 12 : 8 });
    world.addCollider(x, y + 1, z, 1.1);
  }
}

export const seagrass = {
  id: 'seagrass',
  name: 'Lake Illawarra',
  place: 'Illawarra estuary, NSW',
  blurb: 'A sunny lakeshore: a plank jetty out to the channel, clear sand flats, seagrass patches and a mangrove edge. Rod and line only. A fish nursery.',
  terrainSize: 320, terrainSegments: 256, seabedKind: 'sand', ripple: 0.4, seed: 31, rocks: 0,
  heightAt, colorAt, reefiness, deckAt, decorate,
  bounds: { xMin: -90, xMax: 90, zMin: -10, zMax: 32 }, // where the underwater life and meadows are placed
  calm: 0.22,
  water: {
    shafts: 0, exposure: 1.0,
    absorb: [0.3, 0.1, 0.16], fog: 0x4fbfae, fogDeep: 0x2a8c8c, fogDensity: 0.08,
    shallow: 0x44d2bc, mid: 0x1f8f9e, deep: 0x15607c, fogDepthScale: 6,
    skyTop: 0x2f7fd8, skyHorizon: 0xd2e8f0, sun: [0.5, 0.64, -0.42], sunIntensity: 2.4, sunColor: 0xfff0d2,
    hemiSky: 0xd8ecf0, hemiGround: 0x6a7a4a,
  },
  sound: { wash: 0.3, wind: 0.2, shrimp: 0.2, gulls: 0.5, mangroveBirds: 1, mangroveAt: [-40, 36] },
  menuCam: { yaw: 0.55, swing: 0.3, pitch: 0.62, dist: 22, lift: 2.5 },
  // Stand on the bank or the jetty and cast. The spot is read where the float lands (tx, tz): off the jetty end, the mangrove edge, the channel, seagrass or the sand flat.
  fishing: { spotAt },
  land: {
    spawn: { x: JETTY.x - 5, z: shoreZ(JETTY.x - 5) + 8, yaw: 0 },
    bounds: { xMin: -80, xMax: 80, zMin: JETTY.z1 - 0.6, zMax: 130 },
    intro: 'Welcome to Lake Illawarra. Walk out along the jetty (or wade the sand flats), press R for your rod and T for your tackle box, then cast over the flats, seagrass and channel. Rod and line only here: no crab traps or nets near the entrance. Press E to chat with the people you meet.',
    life: {}, zones: {},
    home: { x: JETTY.x - 11, z: shoreZ(JETTY.x - 11) + 8, r: 7, label: 'the bait shop' }, // walk here (or press H) to head home and end the outing
  },
  island: null,
  treeShadows: { casuarina: [2.4, 8], norfolkpine: [3, 12], coastbanksia: [2, 4] }, // low tier: soft blob shadows under reef-placed trees [radius, height]
  cosyModels: {
    url: 'assets/models/seagrass_cosy.glb',
    coral: {
      zostera: ['zostera_0', 'zostera_1', 'zostera_2'], halophila: ['halophila_0', 'halophila_1'], mangrove: ['mangrove_0', 'mangrove_1', 'mangrove_2'], pneumatophores: ['pneumato_0', 'pneumato_1'],
      casuarina: ['casuarina_0', 'casuarina_1'], norfolkpine: ['norfolk_pine_0', 'norfolk_pine_1'], lakebanksia: ['banksia_0', 'banksia_1'], lakebush: ['banksia_0', 'banksia_1'],
    },
    statics: { seahorse: 'seahorse_0', blueswimmer: 'crab_blueswimmer', soldiercrab: 'crab_soldier' },
  },
  speciesInfo,
  placers: {
    flat: (rnd, t) => { const x = -30 + rnd() * 100, z = shoreAt(x) - 1 + rnd() * 3; return new THREE.Vector3(x, t.heightAt(x, z), z); },
  },
  coral: [
    ['zostera', 3200, (x, z) => (meadow(x, z) ? 1 : 0.01) * smoothstep(48, 40, z)],
    ['halophila', 420, (x, z, h) => (h < -1.4 ? 1 : 0.1)],
    // The mangroves stand along the muddy left edge only.
    ['mangrove', 46, (x, z) => (x < -30 && Math.abs(z - shoreAt(x)) < 11 ? 1 : 0)],
    ['pneumatophores', 70, (x, z) => (x < -30 && Math.abs(z - shoreAt(x)) < 9 ? 1 : 0)],
    // Casuarinas, a few Norfolk Island pines and banksias along the bank; grass tussocks at the edge of the sand.
    ['casuarina', 70, (x, z) => (z > shoreZ(x) + 12 && x > -100 ? 1 : 0)],
    ['norfolkpine', 18, (x, z) => (z > shoreZ(x) + 16 ? 1 : 0)],
    ['lakebanksia', 34, (x, z) => (z > shoreZ(x) + 14 ? 1 : 0)],
    ['lakegrass', 200, (x, z) => (z > shoreZ(x) + 4 && z < shoreZ(x) + 30 && x > -26 ? 1 : 0.1)],
    ['lakebush', 120, (x, z) => (z > shoreZ(x) + 8 ? 1 : 0)],
  ],
  life: {
    seahorse: 8, pipefish: 6, sandwhiting: 24, yellowfinbream: 10, seamullet: 32, duskyflathead: 5, luderick: 8,
    blueswimmer: 6, soldiercrab: 30, cuttlefish: 3,
  },
};
