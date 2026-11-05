// Lake Illawarra at Windang (the "seagrass" site): a sunny NSW estuary lakeshore. Shore toward +z (east), the lake toward -z (west).
// A cream sand bank with a grassy edge, clear shallow sand flats with seagrass patches, a deeper channel, a muddy grey-mangrove edge
// on the left only, and a plank wooden jetty with posts out to the channel (walkable; casts off its end count as the 'jetty' spot).
// Near the jetty base: a bait-shop hut, a fish-cleaning table, a moored tinnie; casuarinas, Norfolk Island pines and pelicans on the posts.
import * as THREE from 'three';
import { makeNoise, smoothstep, lerp } from '../core/noise.js';
import { smoothPath, DistField } from '../world/shape.js';
import { species as speciesInfo } from '../content/seagrass.js';
import { addGenerator } from '../world/reef.js';
import { registerBehaviour, registerLook } from '../life/life.js';
import { paint as P } from '../life/looks.js';
import * as FL from '../world/flora.js';
import * as FO from '../world/foliage.js';
import * as G from '../world/groundPaint.js';
import '../fishing/fishLooks.js'; // the line-caught species' looks are also what swims in the Lake

// The layout follows Cudgeree Bay on the east shore of Lake Illawarra at Windang (a satellite view, north up, 790 m across, drawn here at about 35%): the shore runs north-south
// with the lake to the WEST, so the world axes are x = north and z = east (the lake is toward -z, the town and Windang Road on the +z side). From the north the shore is nearly
// straight, then it turns away to the south-west along the caravan parks. Wide pale sand flats with dark patches of seagrass run out from it; there is a long thin sand bar out on the
// flats; a deeper channel runs along the edge of the flats; and the lake opens to deeper water beyond. Lake Illawarra has only small stands of grey mangroves: one patch, at the south.
const noise = makeNoise(31);
const FRAME_PX = (py, px) => [(350 - py) * 0.35, 44 + (px - 550) * 0.35];   // satellite pixel (row, column) -> world [x, z]
export const FRAME = { toMap: (x, z) => [z, -x], toWorld: (u, v) => [-v, u] };   // the map is turned a quarter so that north is up (u east, v south)
const SHORE_PTS = (() => {
  const px = [[-40, 640], [50, 610], [150, 575], [230, 562], [290, 548], [340, 552], [400, 545], [430, 515], [462, 455], [470, 380], [490, 300], [535, 200], [580, 120], [640, 20]].map(([a, b]) => FRAME_PX(a, b));
  const dense = smoothPath(px, 6), n = dense.length, ext = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [b[0] + (b[0] - a[0]) / l * 300, b[1] + (b[1] - a[1]) / l * 300]; };
  return [ext(dense[3], dense[0]), ...dense, ext(dense[n - 4], dense[n - 1])];
})();
const LAKE_LAND = new DistField([...SHORE_PTS, [-500, 1500], [500, 1500]], { half: 175, cell: 0.9 });
/** Signed distance from the waterline (metres, perpendicular): positive on the land (east), negative in the lake. */
export const landD = (x, z) => LAKE_LAND.at(x, z);
// the waterline as z at each x (the shore is a function of x), tabulated: x decreases along SHORE_PTS from the north
const SHORE_TAB = (() => { const lo = -200, hi = 200, step = 0.5, tab = new Float32Array(Math.round((hi - lo) / step) + 1); let j = 0; const P = SHORE_PTS; for (let i = 0; i < tab.length; i++) { const x = hi - i * step; while (j < P.length - 2 && P[j + 1][0] > x) j++; const a = P[j], b = P[j + 1], t = (a[0] - x) / (a[0] - b[0] || 1); tab[i] = a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1.5, t)); } return { tab, lo, hi, step }; })();
/** Waterline (z where the bank meets the water) along x, and the centre line of the deeper channel. */
export const shoreZ = x => { const { tab, hi, step } = SHORE_TAB, f = Math.max(0, Math.min(tab.length - 1.001, (hi - x) / step)), i = Math.floor(f); return tab[i] + (tab[i + 1] - tab[i]) * (f - i); };
/** How far offshore (metres, perpendicular to the shore) the middle of the channel is, along x. */
const chanD = x => 40 - 7 * Math.sin(x * 0.035 + 2);
export const chanZ = x => shoreZ(x) - chanD(x);
/** 0..1: how much this is the muddy mangrove edge (the south end of the shore only). */
const mudAt = x => smoothstep(-26, -46, x);
const shoreAt = x => shoreZ(x) - mudAt(x) * 9; // the mud bank pushes out into the lake
/** Distance inland of the (mud-pushed) waterline: positive on the bank, negative in the lake. */
const bankD = (x, z) => landD(x, z) + mudAt(x) * 9;
/** The long thin sand bar out on the flats (a low crescent, a little above the water). */
const BAR = { x: 80, z0: -26, z1: 6, bulge: 3 };
const barMask = (x, z) => { const cx = BAR.x + BAR.bulge * Math.sin(clamp01((z - BAR.z0) / (BAR.z1 - BAR.z0)) * Math.PI); return smoothstep(5, 1.6, Math.abs(x - cx)) * smoothstep(BAR.z0 - 4, BAR.z0 + 3, z) * smoothstep(BAR.z1 + 4, BAR.z1 - 3, z); };
const clamp01 = t => Math.max(0, Math.min(1, t));
/** Two small wooded islets out in the lake to the south-west (Baker Island and Bevans Island at the entrance channel): [x, z, radius, height]. */
export const ISLETS = [[-92, -122, 13, 1.5], [-124, -96, 8, 1.2]];
const isletAt = (x, z) => { let m = 0; for (const [ix, iz, r] of ISLETS) m = Math.max(m, 1 - smoothstep(r * 0.55, r, Math.hypot(x - ix, z - iz) + noise.n2(x * 0.2, z * 0.2) * 1.2)); return m; };

// The jetty: deck at y, running from the bank (z0) out toward the channel (z1 < z0).
export const JETTY = { x: 16, w: 2.4, y: 0.95, len: 2 };
JETTY.z0 = shoreZ(JETTY.x) + 3.6;
JETTY.z1 = chanZ(JETTY.x) + 5;
export const deckAt = (x, z) => (Math.abs(x - JETTY.x) < JETTY.w / 2 - 0.05 && z < JETTY.z0 + 0.4 && z > JETTY.z1 - 0.9 ? JETTY.y : null);

export function heightAt(x, z) {
  const mud = mudAt(x), d = bankD(x, z); // d > 0 on the bank
  let h;
  if (d >= 0) {
    h = 0.95 * smoothstep(0, 5.5 + mud * 6, d);                                   // the sand bank
    h += smoothstep(14, 70, d) * 2.4 + smoothstep(10, 22, d) * 0.15;               // grassy rise behind
    h += noise.fbm2(x * 0.05, z * 0.05, 3) * 0.4 * smoothstep(8, 22, d);
  } else {
    const D = -d, ch = chanD(x);
    // A very wide, clear, gently sloping sandy flat...
    h = -0.04 - Math.min(D, 46) * (0.026 - mud * 0.014);
    // ...a slightly deeper pool in the inner corner of the bay (dense seagrass: the dark water in the satellite view)...
    h -= 0.45 * Math.exp(-(Math.pow((x + 5) / 24, 2) + Math.pow((D - 26) / 16, 2)));
    // ...a deeper channel along the edge of the flats, and the open lake beyond it.
    h -= 2.1 * Math.exp(-Math.pow((D - ch) / 8.5, 2));
    h -= smoothstep(ch + 8, ch + 70, D) * 1.6;
    h += noise.fbm2(x * 0.06, z * 0.06, 3) * 0.1 * smoothstep(0, 4, D);
    const bm = barMask(x, z); if (bm > 0) h = lerp(h, 0.1 + noise.n2(x * 0.5, z * 0.5) * 0.04, bm);   // the sand bar
  }
  const im = isletAt(x, z); if (im > 0) h = lerp(h, ISLETS.find(([ix, iz, r]) => Math.hypot(x - ix, z - iz) < r * 1.2)?.[3] ?? 1.3, smoothstep(0, 0.5, im));
  return h + noise.fbm2(x * 0.3, z * 0.3, 2) * 0.03;
}
/** Patchy seagrass meadows across the shallows (visible through the clear water): big irregular patches with bare sand between them, thicker in the inner bay. */
export const meadow = (x, z) => noise.fbm2(x * 0.045 + 3, z * 0.045, 3) > 0.04 || (Math.pow((x + 5) / 30, 2) + Math.pow((-bankD(x, z) - 26) / 20, 2) < 1 && noise.n2(x * 0.15, z * 0.15) > -0.35);
export function reefiness(x, z) { const h = heightAt(x, z); return h < -0.3 && h > -2.3 && meadow(x, z) ? 0.8 : 0.1; }
let WORN_T = null;
const WORN = { get lines() { return WORN_T ??= [[[JETTY.x, shoreZ(JETTY.x) + 5], [JETTY.x + 6, shoreZ(JETTY.x) + 22], [JETTY.x + 4, shoreZ(JETTY.x) + 46]], [[JETTY.x - 26, shoreZ(JETTY.x - 26) + 8], [JETTY.x - 14, shoreZ(JETTY.x - 14) + 20], [JETTY.x + 6, shoreZ(JETTY.x) + 22]]]; } };
/** Mown lawn (eco.lawnAt for the terrain shader): [how mown, stripe coordinate]. The caravan-park lawns behind the bank, stripes along the shore. */
export function lawnAt(x, z) {
  const d = bankD(x, z);
  return [smoothstep(9, 13, d) * (1 - smoothstep(50, 62, d)), d];
}
export function colorAt(x, z, h) {
  const n = noise.n2(x * 0.2, z * 0.2) * 0.04, n2 = noise.n2(x * 0.05 + 9, z * 0.05), mud = mudAt(x);
  const d = bankD(x, z);
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  let c = [0.96 + n, 0.88 + n, 0.69];                                           // warm cream sand
  if (h < -1.3) c = mix3(c, [0.66, 0.7, 0.62], smoothstep(-1.3, -3.0, h));       // darker silt in the channel
  if (meadow(x, z) && h < -0.3 && h > -2.3) c = mix3(c, [0.3, 0.44, 0.28], 0.62); // seagrass patches show as dark green-brown, as in the satellite view
  if (d > 0) {
    c = mix3([0.84, 0.74, 0.55], [0.97, 0.89, 0.7], smoothstep(0, 0.6, h));      // damp sand at the waterline
    c = G.paintGrass(c, x, z, smoothstep(4.5, 9.5, d + n2 * 7));                  // sand bank to grass
    c = G.paintWild(c, x, z, smoothstep(4.5, 7, d + n2 * 7) * (1 - smoothstep(8, 15, d)) * smoothstep(0, 0.3, n2 + 0.2) * 0.8);   // pigface and spinifex along the top of the bank
    c = mix3(c, [c[0] * 0.8, c[1] * 0.92, c[2] * 0.82], smoothstep(30, 60, d));   // greener, deeper on the hill
    c = G.paintWorn(c, G.wornAt(x, z, WORN.lines) * smoothstep(3, 6, d));                                     // tracks down to the jetty and the bait hut
  }
  if (mud > 0 && h < 1.0) c = mix3(c, [0.56, 0.5, 0.4], mud * 0.85);             // muddy, grey-brown on the mangrove edge
  const bm = barMask(x, z); if (bm > 0.05) c = mix3(c, [0.97, 0.92, 0.78], bm * 0.9);   // the pale sand bar
  const im = isletAt(x, z); if (im > 0.05) c = mix3(c, [0.62 + n, 0.74, 0.4], smoothstep(0, 0.6, im) * (h > 0.05 ? 0.9 : 0.3));   // grass on the islets
  return c;
}

// ---- Seagrass and mangroves (the mangroves stand along the muddy left edge only)
addGenerator('zostera', { fn: s => FL.seagrassClump(s, { blades: 46, height: 0.45, spread: 0.65 }), variants: 4, scale: [0.9, 1.3], radius: 0.6, sink: 0, rough: 0.7, sway: 1.6, cluster: 8, bleaches: false, as: 'zostera', maxH: -0.3, minH: -3.4, detailScale: 30, transl: 0.5, doubleSide: true, soft: true });
addGenerator('halophila', { fn: FL.halophila, variants: 3, scale: [1, 2], radius: 0.3, sink: 0, rough: 0.7, cluster: 12, bleaches: false, as: 'halophila', maxH: -1.0, minH: -5.5 });
addGenerator('mangrove', { fn: FL.mangroveTree, variants: 4, scale: [0.65, 1.05], radius: 1.2, sink: 0.2, rough: 0.8, bleaches: false, upright: true, as: 'greymangrove', maxH: 0.55, minH: -0.9, cluster: 4 });
addGenerator('pneumatophores', { fn: FL.pneumatophores, variants: 3, scale: [1, 1.8], radius: 0.6, sink: 0.02, rough: 0.9, bleaches: false, as: 'greymangrove', maxH: 0.45, minH: -1.2, cluster: 6 });
// ---- Lakeshore trees and tussocks: Blender models (the foliage-card fallbacks only show if the model set fails to load)
const LAND = { xMin: -110, xMax: 140, zMin: -80, zMax: 150 };
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
  if (Math.exp(-Math.pow((-bankD(tx, tz) - chanD(tx)) / 8.5, 2)) > 0.45) return 'channel';
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
  bounds: { xMin: -90, xMax: 120, zMin: -85, zMax: 50 }, // where the underwater life and meadows are placed (the flats, the channel and the bay)
  waterOnly: true, waterFallback: [30, 5],   // fish are only placed where there is water over them (not on the bank)
  frame: FRAME,   // the map is turned a quarter so north is up: the lake is to the west, as at Windang
  calm: 0.22,
  water: {
    shafts: 0, exposure: 1.0,
    absorb: [0.3, 0.1, 0.16], fog: 0x4fbfae, fogDeep: 0x2a8c8c, fogDensity: 0.08,
    shallow: 0x44d2bc, mid: 0x1f8f9e, deep: 0x15607c, fogDepthScale: 6,
    skyTop: 0x2f7fd8, skyHorizon: 0xd2e8f0, sun: [0.5, 0.64, -0.42], sunIntensity: 2.4, sunColor: 0xfff0d2,
    hemiSky: 0xd8ecf0, hemiGround: 0x6a7a4a,
  },
  daylight: true,   // time of day: the sunset glow and the dark-blue night (ocean/daylight.js)
  sound: { wash: 0.3, wind: 0.2, shrimp: 0.2, gulls: 0.5, mangroveBirds: 1, mangroveAt: [-48, shoreZ(-48) - 6] },
  menuCam: { yaw: 0.55, swing: 0.3, pitch: 0.62, dist: 22, lift: 2.5 },
  // Stand on the bank or the jetty and cast. The spot is read where the float lands (tx, tz): off the jetty end, the mangrove edge, the channel, seagrass or the sand flat.
  fishing: { spotAt },
  land: {
    spawn: { x: JETTY.x - 5, z: shoreZ(JETTY.x - 5) + 8, yaw: 0 },
    bounds: { xMin: -80, xMax: 115, zMin: -70, zMax: 125 },
    intro: 'Welcome to Lake Illawarra. Walk out along the jetty (or wade the sand flats), press R for your rod and T for your tackle box, then cast over the flats, seagrass and channel. Rod and line only here: no crab traps or nets near the entrance. Press E to chat with the people you meet.',
    life: {}, zones: {},
    home: { x: JETTY.x - 11, z: shoreZ(JETTY.x - 11) + 8, r: 7, label: 'the bait shop' }, // walk here (or press H) to head home and end the outing
  },
  ridge: { arc: [205, 335] }, lawnAt,   // the escarpment across the lake to the west, as it is from Windang
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
    ['zostera', 3200, (x, z) => (meadow(x, z) ? 1 : 0.01)],
    ['halophila', 420, (x, z, h) => (h < -1.4 ? 1 : 0.1)],
    // The mangroves stand along the muddy left edge only.
    ['mangrove', 30, (x, z) => (x < -30 && Math.abs(bankD(x, z)) < 11 ? 1 : 0)],
    ['pneumatophores', 46, (x, z) => (x < -30 && Math.abs(bankD(x, z)) < 9 ? 1 : 0)],
    // Casuarinas, a few Norfolk Island pines and banksias along the bank; grass tussocks at the edge of the sand.
    ['casuarina', 90, (x, z) => (bankD(x, z) > 12 || isletAt(x, z) > 0.4 ? 1 : 0)],
    ['norfolkpine', 18, (x, z) => (bankD(x, z) > 16 && x > -60 ? 1 : 0)],
    ['lakebanksia', 34, (x, z) => (bankD(x, z) > 14 ? 1 : 0)],
    ['lakegrass', 200, (x, z) => (bankD(x, z) > 4 && bankD(x, z) < 30 && x > -26 ? 1 : 0.1)],
    ['lakebush', 120, (x, z) => (bankD(x, z) > 8 ? 1 : 0)],
  ],
  life: {
    seahorse: 8, pipefish: 6, sandwhiting: 24, yellowfinbream: 10, seamullet: 32, duskyflathead: 5, luderick: 8,
    blueswimmer: 6, soldiercrab: 30, cuttlefish: 3,
  },
};
