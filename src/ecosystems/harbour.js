// Belmore Basin and Wollongong Harbour, laid out from the real place (world/belmore.js): the little stone-walled basin (a timber wharf on pylons runs out from its working quay, lamps, trawlers
// moored beside it, the fishermen's co-op on the quay) opens to the west into the outer harbour, which a long rubble breakwater closes off to the north and east, ending at a white lighthouse.
// Cove Beach is the sandy beach on the west side; a timber jetty pokes out near the restaurants on the south side; Flagstaff Hill (grass, a ring road, a second lighthouse) is to the east.
// Three spots: the wharf (pylons), the breakwall (rock; waves wash over it in a big swell) and the basin (calm, sandy: the basin and the outer harbour).
// At dusk and night the six wharf lamps each lay a pool of warm light on the water: baitfish gather in them and the squid come up to feed.
// Time of day: eco.daylight turns on the sunset / dark-blue night lighting (ocean/daylight.js).
// North is -z (up the map), east is +x. The working quay is laid out in a rotated QUAY FRAME (world/belmore.js): (xo, zo) with the quay edge at zo = 40 and the water at zo < 40.
import * as THREE from 'three';
import { makeNoise, smoothstep, lerp } from '../core/noise.js';
import { species as speciesInfo } from '../content/harbour.js';
import { registerBehaviour } from '../life/life.js';
import { addGenerator } from '../world/reef.js';
import { rock } from '../world/coral.js';
import { globalUniforms } from '../ocean/shaders.js';
import { buildHarbourModels } from '../world/harbourProps.js';
import { layTown } from '../world/townProps.js';
import { HarbourLife } from '../world/harbourLife.js';
import { quayDecal } from '../world/quayPaint.js';
import * as BM from '../world/belmore.js';
import * as G from '../world/groundPaint.js';
import '../fishing/fishLooks.js';

const noise = makeNoise(53);
const { T, toQuay, QROT, landD, crestNear, wallNear, quayMask } = BM;
const SPAWN = T(4, 47), HOME = T(-8, 49);

// ---- layout (metres)
export const QY = BM.QY;               // the quay and wharf deck height above the water
export const QUAY_Z = BM.QUAY_Z;       // the quay edge in the quay frame (water toward lower zo)
export const CREST = BM.CREST_H;       // breakwall crest height
export const LIGHTHOUSE = BM.LIGHTHOUSE;
export const moundAt = BM.moundAt;
/** The timber wharf, in quay-frame metres: runs out from the quay edge (zo = z0) toward the south-east wall, 7 m wide. */
export const WHARF = { x: 12, w: 7, y: QY, z0: QUAY_Z + 0.4, z1: 13, len: 2 };
/** Six wharf lamps: three on each edge, the lantern hanging 1.6 m out over the water. Positions are world [x, z]; the light pool is centred under the lantern. */
const lampAt = (side, zo) => { const ex = WHARF.x + side * (WHARF.w / 2 - 0.35); return { post: T(ex, zo), head: T(ex + side * 1.6, zo), rot: (side > 0 ? 0 : Math.PI) + QROT }; };
export const LAMPS = [...[35, 27, 19].map(z => lampAt(1, z)), ...[31, 23, 15].map(z => lampAt(-1, z))];
export const LAMP_HEIGHT = 3.0;   // the lantern's height above the deck
export const POOL_R = 5.2;        // the radius of a lamp's pool of light on the water

const wharfDistQ = (a, b) => Math.max(0, Math.abs(a - WHARF.x) - WHARF.w / 2, Math.max(WHARF.z1 - b, b - QUAY_Z, 0));
const wharfDist = (x, z) => { const q = toQuay(x, z); return wharfDistQ(q.a, q.b); };

/** 0..1: the rubble and rock under and around the wharf. */
export const rubbleAt = (x, z) => { const q = toQuay(x, z); return (1 - smoothstep(0, 7, wharfDistQ(q.a, q.b))) * (q.b < QUAY_Z - 1 ? 1 : 0.4) * (0.55 + 0.45 * noise.n2(x * 0.3, z * 0.3)); };
function seabed(x, z, d) {
  const c = crestNear(x, z), out = smoothstep(0, 7, c.side * c.d);                 // 1 on the open-sea side of the breakwater
  const open = -3.5 * smoothstep(0, 22, -d) - 1.3 * smoothstep(26, 70, -d), inner = lerp(lerp(open, -3.2, BM.basinK(x, z)), -3.2 * smoothstep(0, 0.9, -d), wallNear(x, z));   // the outer harbour shelves away from the shore; the basin has a level floor and steep walls
  let h = lerp(inner, -9.5 * smoothstep(0, 11, -d), out);
  const rub = rubbleAt(x, z);
  h = Math.min(Math.max(h, h + rub * (1.5 + noise.fbm2(x * 0.5, z * 0.5, 3) * 1.8)), -0.9);   // low rocky mounds under the wharf, never breaking the surface
  return h + noise.fbm2(x * 0.3, z * 0.3, 2) * 0.05;
}
/** The dry ground: sand beaches sloping up from the water, lawn, Flagstaff Hill, the flat quay (apron and promenade) and the stone-walled basin edge. */
function landHeight(x, z, d) {
  const lawn = 1.55 + BM.hillAt(x, z) + noise.fbm2(x * 0.05, z * 0.05, 3) * 0.35 * smoothstep(10, 40, d);
  let h = lawn * smoothstep(0, 9, d);                                             // the beach face, then the lawn
  const rock = smoothstep(55, 90, x) * (1 - smoothstep(2, 12, d)) * (0.45 + 0.8 * Math.max(0, noise.fbm2(x * 0.18, z * 0.18, 3)));   // the rocky headland coast under Flagstaff Hill
  h += rock * 1.4;
  h = lerp(h, QY, wallNear(x, z));                                                // the stone quay face
  return lerp(h, QY, quayMask(x, z));
}
export function heightAt(x, z) {
  const d = landD(x, z);
  let h = d >= 0 ? landHeight(x, z, d) : seabed(x, z, d);
  const m = BM.moundAt(x, z);
  if (m > h && m > -90) h = Math.max(h, m);
  return h;
}
export const reefiness = (x, z) => { const h = heightAt(x, z); if (h > -0.5 || h < -6) return 0.05; const d = crestNear(x, z).d; return Math.max(rubbleAt(x, z) > 0.2 ? 0.85 : 0, d < 9 ? 0.75 : 0, 0.05); };
export function rockAt(x, z, h) {
  const q = toQuay(x, z);
  if (landD(x, z) > 0 && wallNear(x, z) > 0.5 && h > 0.5) return 0.9;
  return Math.min(1, (BM.moundAt(x, z) > h - 0.3 && BM.moundAt(x, z) > -90 ? 1 : 0) + rubbleAt(x, z) * 0.9 + smoothstep(55, 90, x) * (h > -0.4 && landD(x, z) < 12 ? 0.8 : 0));
}
/** Tracks across the lawns: to the top of Flagstaff Hill, along the back of the Cove Beach dunes and down the headland. */
const WORN = [[[-30, 70], [-4, 82], [BM.FLAGSTAFF[0], BM.FLAGSTAFF[1]]], [[-92, 58], [-60, 54], [-34, 58]], [[BM.FLAGSTAFF[0], BM.FLAGSTAFF[1]], [64, 44], [78, 26]]];
/** Mown lawn (eco.lawnAt for the terrain shader): [how mown, stripe coordinate]. Stripes run along the shore; the hill and the headland are left rough. */
export function lawnAt(x, z) {
  const d = landD(x, z);
  return [smoothstep(7, 11, d) * (1 - smoothstep(0.2, 2.2, BM.hillAt(x, z))), d];
}
export function colorAt(x, z, h) {
  const n = noise.n2(x * 0.25, z * 0.25) * 0.04, n2 = noise.n2(x * 1.7, z * 1.7) * 0.04;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const d = landD(x, z), m = BM.moundAt(x, z), q = toQuay(x, z), onMound = m > -90 && m > h - 0.3 && m > 0.2;
  if (onMound && h > 1.9) {                                                                                  // the walkable crest: big stone blocks laid in a grid along the crest, mortar seams between them
    const c = crestNear(x, z), bx = ((c.s + 7) % 2.6 + 2.6) % 2.6, bz = (((c.side * c.d) + 50) % 3.4 + 3.4) % 3.4, seam = Math.min(bx, 2.6 - bx) < 0.07 || Math.min(bz, 3.4 - bz) < 0.07;
    const col = mix3([0.56 + n, 0.54 + n, 0.5 + n], [0.46, 0.45, 0.42], noise.n2(Math.floor((c.s + 7) / 2.6) * 3.1, Math.floor((c.side * c.d + 50) / 3.4) * 2.3) * 0.8 + 0.3);
    return seam ? [0.34, 0.33, 0.31] : col;
  }
  if (onMound && h > -2.5) return mix3([0.63 + n, 0.6 + n, 0.55 + n], [0.46, 0.44, 0.4], 0.5 + 6 * n2 + (h < 0.6 ? 0.25 : 0));   // grey stone, darker and wetter near the water
  if (d > 0) {
    const qm = quayMask(x, z), wall = wallNear(x, z);
    // sand on the beaches (Cove Beach, the beach under the breakwater), lawn behind, the hill, the ring road
    let c = mix3([0.9 + n, 0.8 + n, 0.6], [0.97, 0.9 + n, 0.72], smoothstep(0, 1.4, h));                    // damp then dry sand
    c = G.paintGrass(c, x, z, smoothstep(5, 11, d + noise.n2(x * 0.1, 9) * 3));                             // sand to lawn
    c = G.paintWild(c, x, z, smoothstep(0.5, 3, BM.hillAt(x, z)) * smoothstep(0.1, 0.3, noise.fbm2(x * 0.05, z * 0.05, 2) + 0.2) * 0.5);   // rough cover on Flagstaff Hill
    c = mix3(c, [c[0] * 0.8, c[1] * 0.93, c[2] * 0.8], smoothstep(1.8, 5, h));                              // greener up the hill
    c = G.paintWorn(c, G.wornAt(x, z, WORN) * smoothstep(8, 12, d) * (1 - quayMask(x, z)));                 // tracks worn across the lawns and up the hill
    const rd = BM.roadDist(x, z); if (rd < 2.2 && BM.hillAt(x, z) > 0.4) c = mix3(c, [0.55, 0.55, 0.52], smoothstep(2.2, 1.4, rd));   // Endeavour Drive round the hill
    const st = BM.streetAt(x, z); if (st > 0.02) { const sd = Math.abs(d - 41.5); c = mix3(c, sd < 0.12 ? [0.9, 0.9, 0.86] : Math.abs(sd - 3.4) < 0.3 ? [0.85, 0.84, 0.8] : [0.55 + n, 0.55 + n, 0.54], st * smoothstep(3.8, 3.2, sd)); }   // the street behind the lawns
    const rk = smoothstep(55, 90, x) * (1 - smoothstep(2, 12, d)); if (rk > 0.05) c = mix3(c, [0.58 + n * 2, 0.5 + n, 0.4], rk * 0.8);   // rocky headland
    if (qm > 0.02 || wall > 0.02) {
      const edge = smoothstep(QUAY_Z + 0.9, QUAY_Z - 0.2, q.b) * (q.b > QUAY_Z - 3 ? 1 : 0);
      let k = [0.72 + n, 0.69 + n, 0.62 + n];                                                               // sunlit concrete
      const slab = Math.abs(((q.a + 1.5) % 4 + 4) % 4 - 2) > 1.93 || Math.abs(((q.b + 1.5) % 4 + 4) % 4 - 2) > 1.93;   // slab joints every 4 m
      if (slab) k = mix3(k, [0.62, 0.6, 0.55], 0.7);
      k = mix3(k, [0.7, 0.67, 0.6], noise.fbm2(x * 0.15, z * 0.15, 2) * 0.5 + 0.1);
      k = mix3(k, [0.86, 0.83, 0.76], edge * 0.6);
      if (Math.abs(q.b - (QUAY_Z + 3.2)) < 0.22 && q.a > -44 && q.a < 64) k = [0.93, 0.75, 0.22];             // the painted yellow line along the quay edge
      c = mix3(c, k, Math.max(qm, wall > 0.5 ? 1 : 0));
    }
    return c;
  }
  const rub = rubbleAt(x, z);
  let c = [0.9 + n, 0.82 + n, 0.65];                                                                         // pale harbour sand
  if (h < -3.2) c = mix3(c, [0.62, 0.68, 0.62], smoothstep(-3.2, -5.5, h) * 0.7);
  c = mix3(c, [0.5 + n2, 0.48 + n2, 0.42], Math.min(1, rub * 1.3));                                          // rubble and rock
  return c;
}

/** The spot a cast belongs to (keys of SPOTS in fishing/catches.js): where the float lands. */
export function spotAt(px, pz, tx = px, tz = pz) {
  if (crestNear(tx, tz).d < 9 && landD(tx, tz) < 6) return 'breakwall';
  const q = toQuay(tx, tz);
  if (wharfDistQ(q.a, q.b) < 9 && q.a > -1 && q.a < 25) return 'wharf';
  return 'basin';
}
/** How lit this point of water is by the wharf lamps right now (0..1). The bite model uses it: baitfish and squid gather in the light. */
export function litAt(x, z) {
  let m = 0;
  for (const L of LAMPS) m = Math.max(m, 1 - smoothstep(0, POOL_R * 1.1, Math.hypot(x - L.head[0], z - L.head[1])));
  return m * globalUniforms.uLampOn.value;
}
const J2 = BM.JETTY2;
const jetty2Local = (x, z) => { const dx = x - J2.rx, dz = z - J2.rz; return { u: dx * J2.ux + dz * J2.uz, v: -dx * J2.uz + dz * J2.ux }; };
export const deckAt = (x, z) => {
  const q = toQuay(x, z);
  if (Math.abs(q.a - WHARF.x) < WHARF.w / 2 - 0.05 && q.b < WHARF.z0 + 0.4 && q.b > WHARF.z1 - 0.6) return WHARF.y;
  const j = jetty2Local(x, z); if (j.u > 2 && j.u < J2.len + 0.3 && Math.abs(j.v) < J2.w / 2 - 0.05) return J2.y;   // the timber jetty by the restaurants
  return null;
};

// Rubble under the wharf and along the breakwall: modest rounded rocks (soft: the angler walks over the deck, never into them).
addGenerator('harbourrock', { fn: rock, variants: 3, scale: [0.6, 1.3], radius: 0.7, sink: 0.3, rough: 0.95, bleaches: false, as: 'boulder', soft: true });

// ---- behaviours for the harbour's animals (ids shared with other sites keep their own entries from the Lake)
registerBehaviour('squid', { type: 'hold', radius: 2.6, speed: 0.3, alt: [0.5, 1.2], flee: 1.5, shallow: true });
registerBehaviour('cuttlefish', { type: 'wander', radius: 6, speed: 0.18, alt: [0.4, 1.0], flee: 2, camo: true });
registerBehaviour('yakka', { type: 'school', speed: 0.45, flee: 3, groupSize: 14, at: T(WHARF.x - 4, 22), spread: 14, y: -1.1 });
registerBehaviour('slimymackerel', { type: 'school', speed: 0.7, flee: 3, groupSize: 10, at: T(30, 16), spread: 12, y: -1.5 });

function undecorate(world) {
  world?.harbour?.dispose(); if (world) world.harbour = null;
  for (const v of globalUniforms.uLamps.value) v.set(0, 0, 0, 0);
  globalUniforms.uLampOn.value = 0; globalUniforms.uNight.value = 0;
}

/** Hand-placed landmarks. Quay props are placed in the quay frame (Q / H / C below turn (xo, zo) into the world). */
function decorate(world) {
  const pr = world.props, Tr = world.terrain, rnd = Math.random;
  for (const [k, g] of buildHarbourModels()) world.models.set(k, g);
  const Q = (m, xo, zo, o = {}) => { const [x, z] = T(xo, zo); return pr.place(m, x, z, { ...o, rot: (o.rot ?? 0) + QROT }); };   // a prop in the quay frame (it turns with the frame)
  const H = (xo, zo) => { const [x, z] = T(xo, zo); return Tr.heightAt(x, z); };
  const C = (xo, y, zo, r) => { const [x, z] = T(xo, zo); world.addCollider(x, y, z, r); };
  const at = (x, z, m, o = {}) => pr.place(m, x, z, o);                   // a prop at a world position
  // The wharf: deck sections end to end, pylons beneath (stacked to reach the seabed), bollards, lamp posts and a rope coil.
  const n = Math.ceil((WHARF.z0 - WHARF.z1) / WHARF.len);
  for (let i = 0; i < n; i++) Q('wharf_deck', WHARF.x, WHARF.z0 - WHARF.len * (i + 0.5), { y: WHARF.y });
  const piles = [];
  for (let z = WHARF.z0 - 2; z > WHARF.z1 - 0.5; z -= 4) for (const sx of [-3.4, -1.1, 1.1, 3.4]) {
    const x = WHARF.x + sx, g = H(x, z), top = WHARF.y - 0.3;
    for (let y = top - 4; ; y -= 3.6) { Q('wharf_pile', x, z, { y }); if (y <= g - 0.4 || y < top - 14) break; }
    piles.push(T(x, z));
  }
  for (const L of LAMPS) at(L.post[0], L.post[1], 'lamp_post', { y: WHARF.y, rot: L.rot });
  for (const z of [37, 30, 23, 16.5]) for (const sx of [-3.2, 3.2]) Q('bollard', WHARF.x + sx, z, { y: WHARF.y });
  Q('rope_coil', WHARF.x + 1.5, 36, { y: WHARF.y, rot: 0.4 }); Q('crate_stack', WHARF.x - 2.2, 31, { y: WHARF.y, rot: 0.3 });
  Q('bucket', WHARF.x + 2.4, 27, { y: WHARF.y }); Q('esky', WHARF.x - 2.6, 20.5, { y: WHARF.y, rot: -0.5 });
  Q('ice_box', WHARF.x + 2.6, 33.5, { y: WHARF.y, rot: 0.1 });
  // Pelicans on the pylons.
  for (const [k, i] of [4, 8, 12].entries()) { const [x, z] = piles[Math.min(i, piles.length - 1)]; const p = at(x, z, 'pelican', { y: WHARF.y - 0.3 + 0.1, rot: Math.PI + (rnd() - 0.5) * 1.6 }); if (p) pr.idle(p, 0.3 + k * 0.05); }
  // Moored trawlers: two on the quay-ward side of the wharf, one on the other, riding the water.
  for (const [m, xo, zo, rot] of [['trawler_blue', -0.5, 30, Math.PI / 2 + 0.04], ['trawler_red', -0.2, 17, Math.PI / 2 - 0.05], ['trawler_green', 24.5, 25, -Math.PI / 2 + 0.06]]) {
    const b = Q(m, xo, zo, { float: true, rot }); if (b) pr.floater(b, 0.1);
    C(xo, H(xo, zo) + 1, zo, 1.2);
  }
  // The quay: stone face along the water's edge, bollards, the co-op, crates, bins, nets, a bench, a few pines and a pelican on a bollard.
  for (let x = -44; x < 64; x += 4) Q('quay_wall', x + 2, QUAY_Z - 0.2, { y: QY });
  for (let x = -40; x <= 60; x += 8) if (Math.abs(x - WHARF.x) > 6) Q('bollard', x, QUAY_Z + 0.9, { y: QY });
  const cx = -28, cz = 52;
  Q('coop', cx, cz, { y: QY, shadow: 7.5, tall: 6 }); C(cx, QY + 1.5, cz, 6.3); C(cx - 4, QY + 1.5, cz, 3); C(cx + 4, QY + 1.5, cz, 3);
  for (const [m, x, z, r] of [['crate_stack', -22.5, 44.5, 0.4], ['crate_stack', -34, 44.5, -0.3], ['fish_bin', -18, 46, 0.2], ['fish_bin', -16.5, 46.9, 0.1], ['net_pile', -39, 46, 0.5], ['buoys', -41, 45, 0.2], ['ice_box', -14, 48, 0.3], ['rope_coil', -10, 43.5, 0.5],
    ['net_pile', 30, 46, 2.1], ['buoys', 33, 44.5, 1], ['crate_stack', 26, 45.2, 0.6], ['fish_bin', 36, 47, 3.0], ['bench', -4, 44.6, Math.PI], ['bench', 24, 44.4, Math.PI], ['cleaning_table', -41, 49, Math.PI - 0.1], ['bucket', -39.2, 49.2, 0.2], ['esky', -42.5, 49.6, 0.9]]) {
    Q(m, x, z, { y: QY, rot: r });
  }
  // More working-quay clutter near the wharf base and along the road, so the big concrete apron does not read as empty.
  for (const [m, x, z, r] of [['crate_stack', 2, 45.5, 0.2], ['crate_stack', -1.5, 51, -0.4], ['ice_box', -12, 52.5, 0.2], ['fish_bin', -6.5, 53.5, 0.0], ['bench', 12, 60, Math.PI], ['net_pile', -38, 56, 0.5], ['crate_stack', -42, 54, 0.6], ['buoys', 44, 52.5, 0.4], ['fish_bin', 50, 56.5, 0.2], ['ice_box', 6, 57, 0.4], ['rope_coil', -16, 58, 0.2], ['bucket', 3.2, 46, 0.2]]) {
    Q(m, x, z, { y: QY, rot: r });
  }
  C(-41, QY + 0.6, 49, 1.7);
  const bol = Q('pelican', -4, QUAY_Z + 0.9, { y: QY + 0.62, rot: Math.PI + 0.4 }); if (bol) pr.idle(bol, 0.4);
  // The lighthouse at the end of the breakwater, and armour boulders along both sides of the crest.
  at(LIGHTHOUSE[0], LIGHTHOUSE[1], 'lighthouse', { y: 2.6, shadow: 4, tall: 11 }); world.addCollider(LIGHTHOUSE[0], 4, LIGHTHOUSE[1], 3.1);
  // Armour rock: angular, quarried grey-brown blocks (propKit armourRock) stacked along both sides of the crest, bigger toward the water, with only a trace of moss.
  const armour = (x, z, s) => { const y = Tr.heightAt(x, z); at(x, z, `armour_rock_${Math.floor(rnd() * 3)}`, { rot: rnd() * 6, scale: s, sink: 0.25, y: y - 0.35 }); };
  for (let s = 8; s < BM.CREST.length - 8; s += 4.2) {
    const p = BM.CREST.at(s), nx = -p.tz, nz = p.tx;
    for (const side of [-1, 1]) {
      const o1 = side * (3.0 + rnd() * 1.2), ax = p.x + nx * o1 + p.tx * rnd() * 1.5, az = p.z + nz * o1 + p.tz * rnd() * 1.5;
      if (BM.moundAt(ax, az) > -90) armour(ax, az, 1.2 + rnd() * 0.8);
      if (rnd() < 0.55) { const o2 = side * (4.8 + rnd() * 1.5); armour(p.x + nx * o2 + p.tx * rnd(), p.z + nz * o2 + p.tz * rnd(), 1.5 + rnd() * 0.9); }
    }
  }
  const decal = quayDecal(QY + 0.025); pr.group.add(decal); world.harbourDecal = decal;   // painted bays, the diesel bay, the loading zone and the café plaza (world/quayPaint.js)
  // Working-waterfront furniture so the big concrete apron is a place, not a slab: fish-cleaning tables with buckets and eskies, a diesel bowser in its painted bay, a café kiosk with umbrella tables and
  // planters, net-drying racks, crates and nets, painted bays, and planters along the road edge.
  for (const [x, z, r] of [[-36, 44.4, Math.PI], [-17.5, 44.8, Math.PI + 0.1], [47, 44.6, Math.PI - 0.15], [-3, 48.5, Math.PI]]) { Q('cleaning_table', x, z, { y: QY, rot: r }); Q('bucket', x + 2.0, z + 0.2, { y: QY, rot: 0.4 }); Q('esky', x - 1.8, z + 0.9, { y: QY, rot: 0.8 }); C(x + 0.2, QY + 0.6, z, 2.2); }
  Q('fuel_bowser', -9, 47.5, { y: QY, rot: 0 }); C(-9, QY + 1, 47.5, 1.1);
  Q('sandwich_board', -5.2, 47.4, { y: QY, rot: 0.3 });
  const kx = 28, kz = 54;
  Q('kiosk', kx, kz, { y: QY, shadow: 3.4, tall: 3.6 }); C(kx, QY + 1.2, kz, 2.6); C(kx - 1.6, QY + 1.2, kz, 1.2); C(kx + 1.6, QY + 1.2, kz, 1.2);
  for (const [x, z, r] of [[21.5, 50.5, 0.3], [26.8, 49.5, 1.2], [33, 50, 2.1], [34.5, 55, 0.9]]) { Q('umbrella_table', x, z, { y: QY, rot: r, shadow: 2.0, tall: 2.5 }); C(x, QY + 0.6, z, 0.6); }
  Q('sandwich_board', 29.6, 50.6, { y: QY, rot: -0.2 });
  for (const [x, z, r] of [[20.2, 53, 0.1], [36.4, 52.8, 0], [18.8, 60, Math.PI / 2], [38, 59.5, Math.PI / 2], [-33, 50.5, 0.05], [-30, 50.5, -0.05], [-22, 50.2, 0.1], [-12, 52.8, 0], [6.5, 52.5, 0.1], [16.5, 52.2, -0.1], [-42, 47.5, 0], [-0.5, 52.6, 0]]) Q('planter', x, z, { y: QY, rot: r });
  for (const [m, x, z, r] of [['crab_pots', 14, 52.5, 0.3], ['crab_pots', -36, 60, 0.1], ['crab_pots', 55, 52, 0.6], ['wheelie_bins', -26.5, 60.4, 0.0], ['wheelie_bins', 47.5, 49, 0.1], ['wheelie_bins', 0.5, 62, 0.2], ['boat_trailer', -14, 63.5, Math.PI / 2], ['boat_trailer', -20, 63.5, Math.PI / 2 + 0.05], ['boat_trailer', -2, 63.5, Math.PI / 2 - 0.04], ['boat_trailer', 3, 57, 0.2]]) Q(m, x, z, { y: QY, rot: r });
  for (const [x, z, r] of [[-38, 64, 0.2], [-19, 66, -0.15], [57, 63, 0.4], [14, 65, 0.1]]) { Q('net_rack', x, z, { y: QY, rot: r, shadow: 2.2, tall: 2 }); C(x, QY + 1, z, 1.8); }
  // The south side of the basin (the promenade behind the south-east wall): a few benches, planters, the café umbrellas, and a bollard line along the wall.
  for (let x = -36; x <= 56; x += 8) Q('bollard', x, 4.8, { y: QY });
  for (const [m, x, z, r] of [['bench', -20, 1.6, 0], ['bench', 4, 1.6, 0], ['bench', 30, 1.6, 0], ['planter', -10, 0.8, 0], ['planter', 14, 0.8, 0], ['planter', 40, 0.8, 0], ['umbrella_table', 48, -3, 0.4], ['umbrella_table', 52, 1.5, 1.4], ['fish_bin', 20, -4, 0.2], ['crate_stack', -30, -2, 0.4]]) Q(m, x, z, { y: QY, rot: r });
  // Norfolk pines and casuarinas along the road behind the quay, round the lawn at Cove Beach, and up Flagstaff Hill.
  const tree = (x, z, m, s) => { const y = Tr.heightAt(x, z); at(x, z, m, { rot: rnd() * 6.28, scale: s, sink: 0.1, shadow: m.startsWith('norf') ? 3 : 2.4, tall: m.startsWith('norf') ? 12 : 8 }); world.addCollider(x, y + 1, z, 1.1); };
  for (const [x, dz, m, s] of [[-40, 24, 'norfolk_pine_0', 1.1], [-24, 26, 'casuarina_0', 1.0], [-6, 25, 'norfolk_pine_1', 1.05], [14, 26, 'casuarina_1', 1.0], [34, 24, 'norfolk_pine_0', 1.05], [-14, 26, 'casuarina_1', 0.95], [52, 22, 'norfolk_pine_1', 1.0]]) { const [x2, z2] = T(x, QUAY_Z + dz); tree(x2, z2, m, s); }
  for (const [px, py, m, s] of [[110, 452, 'casuarina_0', 1.0], [160, 470, 'casuarina_1', 1.05], [215, 490, 'norfolk_pine_0', 1.0], [330, 480, 'norfolk_pine_1', 1.0], [120, 520, 'norfolk_pine_0', 1.1], [260, 520, 'casuarina_0', 1.0],
    [640, 330, 'norfolk_pine_1', 1.0], [690, 320, 'norfolk_pine_0', 1.05], [760, 350, 'norfolk_pine_1', 1.1], [770, 520, 'norfolk_pine_0', 1.05], [680, 560, 'norfolk_pine_1', 1.0], [610, 470, 'casuarina_1', 1.0], [720, 400, 'norfolk_pine_0', 1.0], [655, 520, 'casuarina_0', 1.0]]) { const [x, z] = BM.fromPx(px, py); if (BM.landD(x, z) > 3) tree(x, z, m, s); }
  // The town behind the harbour: terraces and flats along the street behind the lawns, cottages further back (world/townProps.js).
  const tb = { xMin: -150, xMax: 60, zMin: -40, zMax: 110 };
  layTown(world, { bounds: tb, dist: BM.landD, band: [30, 36], spacing: 13, accept: (x, z) => BM.streetAt(x, z) > 0.8, kind: (x, z, i) => (i % 3 === 1 ? 'cottage' : 'flats'), seed: 5, fences: false });
  layTown(world, { bounds: tb, dist: (x, z) => 100 - BM.landD(x, z), band: [51, 55], spacing: 12, accept: (x, z) => BM.streetAt(x, z) > 0.8, seed: 9 });
  // The second lighthouse, on the headland under Flagstaff Hill (no beam: the breakwall light is the working one), and a flagstaff on the hill.
  { const [x, z] = BM.FLAGSTAFF; at(x, z, 'lighthouse', { sink: 0.2, shadow: 4, tall: 11, scale: 0.9 }); world.addCollider(x, Tr.heightAt(x, z) + 2, z, 2.6); }
  // The timber jetty by the restaurants: deck sections end to end, posts every 4 m on both sides, from the shore out toward the north-west.
  { const J = BM.JETTY2, rot = Math.atan2(J.ux, J.uz), nxt = -J.uz, nzt = J.ux, jn = Math.ceil((J.len - 2) / 2);
    for (let i = 0; i < jn; i++) { const u = 2 + 2 * (i + 0.5); at(J.rx + J.ux * u, J.rz + J.uz * u, 'jetty_deck', { y: J.y, rot }); }
    for (let u = 5; u < J.len; u += 4) for (const sd of [-1, 1]) { const x = J.rx + J.ux * u + nxt * sd * (J.w / 2 + 0.05), z = J.rz + J.uz * u + nzt * sd * (J.w / 2 + 0.05), g = Tr.heightAt(x, z); for (let y = J.y; ; y -= 3.6) { at(x, z, 'jetty_post', { y }); if (y - 3.4 <= g - 0.2 || y < J.y - 8) break; } }
    at(J.rx + J.ux * (J.len + 0.2), J.rz + J.uz * (J.len + 0.2), 'jetty_end', { y: J.y, rot });
    const p = at(J.rx + J.ux * (J.len - 3) + nxt * 1.0, J.rz + J.uz * (J.len - 3) + nzt * 1.0, 'pelican', { y: J.y + 0.78, rot: 1 }); if (p) pr.idle(p, 0.3);
  }
  // The co-op sign, a painted board above the roller door (a canvas texture: the props use vertex colours only).
  const c = document.createElement('canvas'); c.width = 640; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#fff3d2'; g.fillRect(0, 0, 640, 160); g.strokeStyle = '#1f5f6b'; g.lineWidth = 12; g.strokeRect(6, 6, 628, 148);
  g.fillStyle = '#1f5f6b'; g.textAlign = 'center'; g.font = '800 56px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; g.fillText('BELMORE BASIN', 320, 70);
  g.fillStyle = '#c2570a'; g.font = '800 40px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; g.fillText('FISHERS CO-OP · licensed catch', 320, 124);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.35, 0.14), [0xa4764a, 0xa4764a, 0xa4764a, 0xa4764a, 0xa4764a, 0xa4764a].map((col, i) => (i === 5 ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }) : new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }))));
  { const [sx, sz] = T(cx - 1.2, cz - 3.5); sign.position.set(sx, QY + 4.55, sz); sign.rotation.y = Math.PI + QROT; }
  sign.userData.noShadow = true; pr.group.add(sign);
  // Light: lamp heads, the lighthouse beam, baitfish swarms in the pools and the night squid.
  LAMPS.forEach((L, i) => globalUniforms.uLamps.value[i].set(L.head[0], WHARF.y + LAMP_HEIGHT, L.head[1], 9));
  world.harbour = new HarbourLife(world, { lamps: LAMPS, headY: WHARF.y + LAMP_HEIGHT, poolR: POOL_R, lighthouse: { x: LIGHTHOUSE[0], y: 2.6 + 9.75, z: LIGHTHOUSE[1] } });
  // Re-home the squid in the lamp pools (they are placed with the other life before the landmarks).
  const squid = world.life?.agents.filter(a => a.id === 'squid') ?? [];
  squid.forEach((a, i) => { const L = LAMPS[i % LAMPS.length]; a.home.set(L.head[0], -0.4, L.head[1]); a.pos.set(L.head[0] + (rnd() - 0.5) * 6, -0.4, L.head[1] + (rnd() - 0.5) * 6); a.target.copy(a.pos); });
}

export const harbour = {
  id: 'harbour',
  name: 'Belmore Basin',
  place: 'Wollongong harbour, NSW',
  blurb: 'A working harbour: the stone-walled basin with a timber wharf and lamps, trawlers on the moorings, the outer harbour behind a long breakwall and a lighthouse. Come back at dusk, when the squid rise into the lamp light.',
  unlock: { type: 'identifiedCount', n: 5, label: 'Identify 5 species in your Fish Guide' },
  terrainSize: 320, terrainSegments: 256, seabedKind: 'sand', ripple: 0.3, seed: 53, rocks: 0,
  heightAt, colorAt, reefiness, rockAt, deckAt, decorate, undecorate, litAt,
  bounds: { xMin: -125, xMax: 100, zMin: -110, zMax: 30 },   // where the underwater life and reef plants are placed (the outer harbour, the basin and the breakwall)
  waterOnly: true, waterFallback: [-40, -10],   // fish are only placed where there is water over them
  calm: 0.16,
  daylight: true,
  shoalDepth: [0.5, 4.8],   // the clear harbour water shows fish this deep
  water: {
    shafts: 0, exposure: 1.0,
    absorb: [0.26, 0.09, 0.12], fog: 0x2f9fa8, fogDeep: 0x16587a, fogDensity: 0.07,
    shallow: 0x3dc4b8, mid: 0x1b8795, deep: 0x125270, fogDepthScale: 8,
    skyTop: 0x3c86d8, skyHorizon: 0xd0e6ee, sun: [0.5, 0.62, -0.45], sunIntensity: 2.4, sunColor: 0xfff0d2,
    hemiSky: 0xd4eaf0, hemiGround: 0x6a7a5a,
  },
  sound: { wash: 0.35, wind: 0.25, shrimp: 0.05, gulls: 0.6 },
  ridge: { arc: [96, 262] }, lawnAt,   // the Illawarra escarpment, inland to the west of Wollongong
  menuCam: { yaw: 0.35, swing: 0.3, pitch: 0.6, dist: 24, lift: 3 },
  fishing: { spotAt, litAt },
  // Swell washing over the breakwall (>= 2.5 m): spray, a warning, then a safety mark (npc/manager.js guardHazard).
  hazard: { id: 'breakwall', at: (x, z) => moundAt(x, z) > 1.0 && moundAt(x, z) < 3 && crestNear(x, z).s > 6, swell: 2.5, warner: 'nell', label: 'the breakwall',
    warnText: { swell: 'The swell is {swell} m and waves are washing over the breakwall. Get off the rocks, {name}: fish the wharf or the basin instead.', ignored: 'You are still on the breakwall, {name}. A wave can sweep you into the harbour. Walk back to the quay.' } },
  land: {
    spawn: { x: SPAWN[0], z: SPAWN[1], yaw: QROT + 0.3 },
    bounds: { xMin: -150, xMax: 118, zMin: -106, zMax: 110 },
    intro: 'Welcome to Belmore Basin, Wollongong\'s fishing harbour. Fish off the wharf, the breakwall or the sandy basin and outer harbour. At dusk and night the wharf lamps draw baitfish, and the squid come up to feed: tie on a squid jig (T) and let it sink. Press E to chat with the people you meet.',
    life: {}, zones: {}, flyingGulls: 4, gullCircle: { x: SPAWN[0] + 4, z: SPAWN[1] - 6 },
    home: { x: HOME[0], z: HOME[1], r: 7, label: 'the harbour road' },
  },
  treeShadows: { },
  cosyModels: {
    url: 'assets/models/rocky_cosy.glb',
    coral: { kelp: ['kelp_0', 'kelp_1', 'kelp_2', 'kelp_3'], crayweed: ['crayweed_0', 'crayweed_1'], harbourrock: ['boulder_0', 'boulder_1', 'boulder_2'] },
    statics: { urchin: 'urchin_0', octopus: 'octopus_0' },
  },
  speciesInfo,
  placers: {},
  coral: [
    ['kelp', 170, (x, z, h) => (rubbleAt(x, z) > 0.25 && h < -1 ? 1 : 0) + (h < -2 && crestNear(x, z).d < 9 ? 0.5 : 0)],
    ['crayweed', 60, (x, z, h) => (rubbleAt(x, z) > 0.2 && h > -3.2 ? 1 : 0.02)],
    ['harbourrock', 190, (x, z, h) => (h < -1.4 ? Math.max(rubbleAt(x, z), crestNear(x, z).d < 8 ? 0.8 : 0) : 0)],
  ],
  life: {
    yellowfinbream: 9, luderick: 6, silvertrevally: 5, garfish: 8, yakka: 42, slimymackerel: 20, squid: 6, cuttlefish: 3,
  },
};
