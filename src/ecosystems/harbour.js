// Belmore Basin: the little Wollongong fishing harbour. Shore (a stone quay) toward +z, the water toward -z.
// A timber wharf on pylons runs out from the quay (lamps, bollards, moored trawlers beside it, kelp and rubble under it), a stone breakwall curls round the
// east and north sides to a white lighthouse, and the calm, sandy basin lies to the west. The fishermen's co-op building sits on the quay.
// Three spots: the wharf (pylons), the breakwall (rock; waves wash over it in a big swell) and the basin (calm, sandy).
// At dusk and night the six wharf lamps each lay a pool of warm light on the water: baitfish gather in them and the squid come up to feed.
// Time of day: eco.daylight turns on the sunset / dark-blue night lighting (ocean/daylight.js).
import * as THREE from 'three';
import { makeNoise, smoothstep, lerp } from '../core/noise.js';
import { species as speciesInfo } from '../content/harbour.js';
import { registerBehaviour } from '../life/life.js';
import { addGenerator } from '../world/reef.js';
import { rock } from '../world/coral.js';
import { globalUniforms } from '../ocean/shaders.js';
import { buildHarbourModels } from '../world/harbourProps.js';
import { HarbourLife } from '../world/harbourLife.js';
import '../fishing/fishLooks.js';

const noise = makeNoise(53);

// ---- layout (metres)
export const QY = 1.3;            // the quay and wharf deck height above the water
export const QUAY_Z = 40;         // the quay edge (water toward -z)
export const EBW = 44;            // the east breakwall runs along x = EBW ...
export const NBW = -32;           // ... to the corner at z = NBW, and the north arm runs west along z = NBW to x = ENTR (the harbour mouth is beyond it)
export const ENTR = -8;
export const CREST = 2.3;         // breakwall crest height
export const WHARF = { x: 12, w: 8, y: QY, z0: QUAY_Z + 0.4, z1: 6, len: 2 };
/** Six wharf lamps: three on each edge, the lantern hanging 1.6 m out over the water. The light pool is centred under the lantern. */
export const LAMPS = [
  ...[34, 24, 14].map(z => ({ post: [WHARF.x + WHARF.w / 2 - 0.35, z], head: [WHARF.x + WHARF.w / 2 - 0.35 + 1.6, z], rot: 0 })),
  ...[29, 19, 9].map(z => ({ post: [WHARF.x - WHARF.w / 2 + 0.35, z], head: [WHARF.x - WHARF.w / 2 + 0.35 - 1.6, z], rot: Math.PI })),
];
export const LAMP_HEIGHT = 3.0;   // the lantern's height above the deck
export const POOL_R = 5.2;        // the radius of a lamp's pool of light on the water

const segDist = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - (ax + dx * t), z - (az + dz * t)); };
const wharfDist = (x, z) => Math.max(0, Math.abs(x - WHARF.x) - WHARF.w / 2, Math.max(WHARF.z1 - z, z - QUAY_Z, 0));

/** 0..1: the rubble and rock under and around the wharf. */
export const rubbleAt = (x, z) => (1 - smoothstep(0, 7, wharfDist(x, z))) * (z < QUAY_Z - 1 ? 1 : 0.4) * (0.55 + 0.45 * noise.n2(x * 0.3, z * 0.3));
/** Height of the breakwall mound at (x, z), or -99 away from it: a rubble crest 4.4 m wide with side slopes of about 1:1. */
export function moundAt(x, z) {
  const d = Math.min(segDist(x, z, EBW, NBW, EBW, QUAY_Z + 4), segDist(x, z, ENTR, NBW, EBW, NBW));
  const top = CREST - Math.max(0, d - 2.2) * 0.95 + noise.fbm2(x * 0.35, z * 0.35, 2) * 0.3;
  const pad = 2.7 - smoothstep(4.4, 7.6, Math.hypot(x - EBW, z - NBW)) * 7;   // the lighthouse's round pad
  return Math.max(top, pad);
}
function seabed(x, z) {
  let h = -3.1 - 1.4 * smoothstep(30, -10, z);
  const out = Math.max(smoothstep(EBW + 3, EBW + 14, x), smoothstep(NBW + 1, NBW - 12, z));
  h = lerp(h, -9.5, out);
  const shelf = smoothstep(-52, -45, x) * (1 - smoothstep(-16, -7, x)) * smoothstep(2, 12, z) * (1 - smoothstep(34, 39, z));
  h = lerp(h, -1.9 + noise.fbm2(x * 0.1, z * 0.1, 2) * 0.3, shelf);
  h = lerp(h, 1.7, smoothstep(-54, -66, x));                                  // the west shore climbs out of the water
  const rub = rubbleAt(x, z);
  h = Math.min(Math.max(h, h + rub * (1.5 + noise.fbm2(x * 0.5, z * 0.5, 3) * 1.8)), -0.9);   // low rocky mounds under the wharf, never breaking the surface
  return h + noise.fbm2(x * 0.3, z * 0.3, 2) * 0.05;
}
export function heightAt(x, z) {
  let h = seabed(x, z);
  h = lerp(h, QY, smoothstep(QUAY_Z - 1.4, QUAY_Z, z));                       // the stone quay
  h += smoothstep(74, 125, z) * 7 + noise.fbm2(x * 0.04, z * 0.04, 3) * 1.4 * smoothstep(66, 92, z);   // the grassy rise behind
  const m = moundAt(x, z);
  if (m > h && m > -90 && !(z > QUAY_Z + 4)) h = Math.max(h, m);
  return h;
}
export const reefiness = (x, z) => { const h = heightAt(x, z); if (h > -0.5 || h < -6) return 0.05; const d = Math.min(segDist(x, z, EBW, NBW, EBW, QUAY_Z + 4), segDist(x, z, ENTR, NBW, EBW, NBW)); return Math.max(rubbleAt(x, z) > 0.2 ? 0.85 : 0, d < 9 ? 0.75 : 0, 0.05); };
export function rockAt(x, z, h) {
  if (z > QUAY_Z - 1.4 && z < QUAY_Z + 0.4) return 0.9;
  return Math.min(1, (moundAt(x, z) > seabed(x, z) + 0.2 && z < QUAY_Z + 4 ? 1 : 0) + rubbleAt(x, z) * 0.9);
}
export function colorAt(x, z, h) {
  const n = noise.n2(x * 0.25, z * 0.25) * 0.04, n2 = noise.n2(x * 1.7, z * 1.7) * 0.04;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const m = moundAt(x, z), onMound = m > seabed(x, z) + 0.15 && m > -90 && z < QUAY_Z + 4;
  if (onMound && h > 1.9) {                                                                                  // the walkable crest: big stone blocks laid in a grid, mortar seams between them
    const bx = ((x + 7) % 2.6 + 2.6) % 2.6, bz = ((z + 3) % 3.4 + 3.4) % 3.4, seam = Math.min(bx, 2.6 - bx) < 0.07 || Math.min(bz, 3.4 - bz) < 0.07;
    let c = mix3([0.56 + n, 0.54 + n, 0.5 + n], [0.46, 0.45, 0.42], noise.n2(Math.floor((x + 7) / 2.6) * 3.1, Math.floor((z + 3) / 3.4) * 2.3) * 0.8 + 0.3);
    return seam ? [0.34, 0.33, 0.31] : c;
  }
  if (onMound && h > -2.5) return mix3([0.63 + n, 0.6 + n, 0.55 + n], [0.46, 0.44, 0.4], 0.5 + 6 * n2 + (h < 0.6 ? 0.25 : 0));   // grey stone, darker and wetter near the water
  if (z > QUAY_Z - 1.0) {
    const edge = smoothstep(QUAY_Z + 0.9, QUAY_Z - 0.2, z);
    let c = [0.72 + n, 0.69 + n, 0.62 + n];                                                                 // sunlit concrete
    const slab = Math.abs(((x + 1.5) % 4) - 2) > 1.93 || Math.abs(((z + 1.5) % 4) - 2) > 1.93;            // slab joints every 4 m
    if (slab) c = mix3(c, [0.62, 0.6, 0.55], 0.7);
    c = mix3(c, [0.7, 0.67, 0.6], noise.fbm2(x * 0.15, z * 0.15, 2) * 0.5 + 0.1);
    c = mix3(c, [0.86, 0.83, 0.76], edge * 0.6);
    if (Math.abs(z - (QUAY_Z + 3.2)) < 0.22) c = [0.93, 0.75, 0.22];                                          // the painted yellow line along the quay edge
    if (z > QUAY_Z + 3.6 && z < QUAY_Z + 24 && Math.abs(((z - QUAY_Z - 3.6) % 9) - 4.5) < 0.1 && Math.abs(((x + 2) % 6) - 3) < 1.1) c = mix3(c, [0.95, 0.93, 0.88], 0.7);   // dashed bay markings
    c = mix3(c, [0.5 + n, 0.64 + n, 0.38], smoothstep(70, 84, z + noise.n2(x * 0.1, 9) * 6));              // the grass behind
    return c;
  }
  if (x < -52 && h > -0.4) return mix3([0.93, 0.86, 0.68], [0.55, 0.52, 0.46], smoothstep(-58, -66, x) * 0.7);
  const rub = rubbleAt(x, z);
  let c = [0.9 + n, 0.82 + n, 0.65];                                                                         // pale harbour sand
  if (h < -3.2) c = mix3(c, [0.62, 0.68, 0.62], smoothstep(-3.2, -5.5, h) * 0.7);
  c = mix3(c, [0.5 + n2, 0.48 + n2, 0.42], Math.min(1, rub * 1.3));                                          // rubble and rock
  return c;
}

/** The spot a cast belongs to (keys of SPOTS in fishing/catches.js): where the float lands. */
export function spotAt(px, pz, tx = px, tz = pz) {
  if (Math.min(segDist(tx, tz, EBW, NBW, EBW, QUAY_Z + 4), segDist(tx, tz, ENTR, NBW, EBW, NBW)) < 9) return 'breakwall';
  if (wharfDist(tx, tz) < 9 && tx > -1 && tx < 25) return 'wharf';
  return 'basin';
}
/** How lit this point of water is by the wharf lamps right now (0..1). The bite model uses it: baitfish and squid gather in the light. */
export function litAt(x, z) {
  let m = 0;
  for (const L of LAMPS) m = Math.max(m, 1 - smoothstep(0, POOL_R * 1.1, Math.hypot(x - L.head[0], z - L.head[1])));
  return m * globalUniforms.uLampOn.value;
}
export const deckAt = (x, z) => (Math.abs(x - WHARF.x) < WHARF.w / 2 - 0.05 && z < WHARF.z0 + 0.4 && z > WHARF.z1 - 0.6 ? WHARF.y : null);

// Rubble under the wharf and along the breakwall: modest rounded rocks (soft: the angler walks over the deck, never into them).
addGenerator('harbourrock', { fn: rock, variants: 3, scale: [0.6, 1.3], radius: 0.7, sink: 0.3, rough: 0.95, bleaches: false, as: 'boulder', soft: true });

// ---- behaviours for the harbour's animals (ids shared with other sites keep their own entries from the Lake)
registerBehaviour('squid', { type: 'hold', radius: 2.6, speed: 0.3, alt: [0.5, 1.2], flee: 1.5, shallow: true });
registerBehaviour('cuttlefish', { type: 'wander', radius: 6, speed: 0.18, alt: [0.4, 1.0], flee: 2, camo: true });
registerBehaviour('yakka', { type: 'school', speed: 0.45, flee: 3, groupSize: 14, at: [WHARF.x, 22], spread: 14, y: -1.1 });
registerBehaviour('slimymackerel', { type: 'school', speed: 0.7, flee: 3, groupSize: 10, at: [20, 10], spread: 12, y: -1.5 });

function undecorate(world) {
  world?.harbour?.dispose(); if (world) world.harbour = null;
  for (const v of globalUniforms.uLamps.value) v.set(0, 0, 0, 0);
  globalUniforms.uLampOn.value = 0; globalUniforms.uNight.value = 0;
}

/** Hand-placed landmarks. */
function decorate(world) {
  const pr = world.props, T = world.terrain, rnd = Math.random;
  for (const [k, g] of buildHarbourModels()) world.models.set(k, g);
  // The wharf: deck sections end to end, pylons beneath (stacked to reach the seabed), bollards, lamp posts and a rope coil.
  const n = Math.ceil((WHARF.z0 - WHARF.z1) / WHARF.len);
  for (let i = 0; i < n; i++) pr.place('wharf_deck', WHARF.x, WHARF.z0 - WHARF.len * (i + 0.5), { y: WHARF.y });
  const piles = [];
  for (let z = WHARF.z0 - 2; z > WHARF.z1 - 0.5; z -= 4) for (const sx of [-3.4, -1.1, 1.1, 3.4]) {
    const x = WHARF.x + sx, g = T.heightAt(x, z), top = WHARF.y - 0.3;
    for (let y = top - 4; ; y -= 3.6) { pr.place('wharf_pile', x, z, { y }); if (y <= g - 0.4 || y < top - 14) break; }
    piles.push([x, z]);
  }
  for (const L of LAMPS) pr.place('lamp_post', L.post[0], L.post[1], { y: WHARF.y, rot: L.rot });
  for (const z of [37, 29, 21, 13, 8]) for (const sx of [-3.5, 3.5]) pr.place('bollard', WHARF.x + sx, z, { y: WHARF.y });
  pr.place('rope_coil', WHARF.x + 1.5, 36, { y: WHARF.y, rot: 0.4 }); pr.place('crate_stack', WHARF.x - 2.2, 31, { y: WHARF.y, rot: 0.3 });
  pr.place('bucket', WHARF.x + 2.4, 27, { y: WHARF.y }); pr.place('esky', WHARF.x - 2.6, 15.5, { y: WHARF.y, rot: -0.5 });
  pr.place('ice_box', WHARF.x + 2.6, 33.5, { y: WHARF.y, rot: 0.1 });
  // Pelicans on the pylons.
  for (const [k, i] of [5, 11, 17].entries()) { const [x, z] = piles[Math.min(i, piles.length - 1)]; const p = pr.place('pelican', x, z, { y: WHARF.y - 0.3 + 0.1, rot: Math.PI + (rnd() - 0.5) * 1.6 }); if (p) pr.idle(p, 0.3 + k * 0.05); }
  // Moored trawlers: two on the west side of the wharf, one on the east, riding the water.
  for (const [m, x, z, rot, s] of [['trawler_blue', 1.2, 30, Math.PI / 2 + 0.04, 1], ['trawler_red', 1.6, 13, Math.PI / 2 - 0.05, 1], ['trawler_green', 24.5, 22, -Math.PI / 2 + 0.06, 1]]) {
    const b = pr.place(m, x, z, { float: true, rot, scale: s }); if (b) pr.floater(b, 0.1);
    world.addCollider(x, T.heightAt(x, z) + 1, z, 1.2);
  }
  // The quay: stone face along the water's edge, bollards, the co-op, crates, bins, nets, a bench, a few pines and a pelican on a bollard.
  for (let x = -62; x < 50; x += 4) pr.place('quay_wall', x + 2, QUAY_Z - 0.2, { y: QY });
  for (let x = -56; x <= 40; x += 8) if (Math.abs(x - WHARF.x) > 6) pr.place('bollard', x, QUAY_Z + 0.9, { y: QY });
  const cx = -28, cz = 52;
  pr.place('coop', cx, cz, { y: QY, shadow: 7.5, tall: 6 }); world.addCollider(cx, QY + 1.5, cz, 6.3); world.addCollider(cx - 4, QY + 1.5, cz, 3); world.addCollider(cx + 4, QY + 1.5, cz, 3);
  for (const [m, x, z, r] of [['crate_stack', -22.5, 44.5, 0.4], ['crate_stack', -34, 44.5, -0.3], ['fish_bin', -18, 46, 0.2], ['fish_bin', -16.5, 46.9, 0.1], ['net_pile', -41, 46, 0.5], ['buoys', -43.5, 45, 0.2], ['ice_box', -14, 48, 0.3], ['rope_coil', -10, 43.5, 0.5],
    ['net_pile', 30, 46, 2.1], ['buoys', 33, 44.5, 1], ['crate_stack', 26, 45.2, 0.6], ['fish_bin', 36, 47, 3.0], ['bench', -4, 44.6, Math.PI], ['bench', 24, 44.4, Math.PI], ['cleaning_table', -50, 47, Math.PI - 0.1], ['bucket', -48.2, 47.2, 0.2], ['esky', -51.5, 47.6, 0.9]]) {
    pr.place(m, x, z, { y: QY, rot: r });
  }
  // More working-quay clutter near the wharf base and along the road, so the big concrete apron does not read as empty.
  for (const [m, x, z, r] of [['crate_stack', 2, 45.5, 0.2], ['fish_bin', 19.5, 46, 0.1], ['fish_bin', 21.2, 47.2, 0.3], ['net_pile', 23.5, 47.6, 0.9], ['buoys', 27.5, 49, 0.3], ['crate_stack', -1.5, 51, -0.4], ['ice_box', -12, 52.5, 0.2], ['fish_bin', -6.5, 53.5, 0.0], ['rope_coil', 19, 52, 0.5],
    ['bench', 12, 60, Math.PI], ['net_pile', -39, 55, 0.5], ['crate_stack', -45.5, 53.5, 0.6], ['buoys', 37.5, 52.5, 0.4], ['fish_bin', 41, 56.5, 0.2], ['crate_stack', 33, 58, 1.1], ['ice_box', 6, 57, 0.4], ['rope_coil', -16, 58, 0.2], ['bucket', 3.2, 46, 0.2]]) {
    pr.place(m, x, z, { y: QY, rot: r });
  }
  world.addCollider(-50, QY + 0.6, 47, 1.7);
  const bol = pr.place('pelican', -4, QUAY_Z + 0.9, { y: QY + 0.62, rot: Math.PI + 0.4 }); if (bol) pr.idle(bol, 0.4);
  // The lighthouse at the end of the breakwall, and armour boulders along the crest edge of both arms.
  pr.place('lighthouse', EBW, NBW, { y: 2.6, shadow: 4, tall: 11 }); world.addCollider(EBW, 4, NBW, 3.1);
  const warm = new THREE.Color(1.1, 0.98, 0.88);
  const armour = (x, z, s) => { const y = T.heightAt(x, z); pr.place(['boulder_0', 'boulder_1', 'boulder_2'][Math.floor(rnd() * 3)], x, z, { rot: rnd() * 6, scale: s, sink: 0.3, color: warm, y: y - 0.45 }); };
  for (let z = NBW + 7; z < QUAY_Z + 2; z += 2.9) for (const side of [-1, 1]) { armour(EBW + side * (3.1 + rnd() * 1.2), z + rnd() * 1.5, 1.5 + rnd() * 0.9); if (rnd() < 0.6) armour(EBW + side * (4.9 + rnd() * 1.5), z + rnd(), 1.8 + rnd() * 1.0); }
  for (let x = ENTR + 1; x < EBW - 6; x += 2.9) for (const side of [-1, 1]) { armour(x + rnd() * 1.5, NBW + side * (3.1 + rnd() * 1.2), 1.5 + rnd() * 0.9); if (rnd() < 0.6) armour(x + rnd(), NBW + side * (4.9 + rnd() * 1.5), 1.8 + rnd() * 1.0); }
  // Norfolk pines and casuarinas along the road behind the quay.
  for (const [x, dz, m, s] of [[-50, 26, 'norfolk_pine_0', 1.1], [-34, 30, 'casuarina_0', 1.0], [-6, 27, 'norfolk_pine_1', 1.05], [14, 30, 'casuarina_1', 1.0], [34, 26, 'norfolk_pine_0', 1.05], [-18, 31, 'casuarina_1', 0.95]]) {
    const z = QUAY_Z + dz, y = T.heightAt(x, z);
    pr.place(m, x, z, { rot: rnd() * 6.28, scale: s, sink: 0.1, shadow: m.startsWith('norf') ? 3 : 2.4, tall: m.startsWith('norf') ? 12 : 8 });
    world.addCollider(x, y + 1, z, 1.1);
  }
  // The co-op sign, a painted board above the roller door (a canvas texture: the props use vertex colours only).
  const c = document.createElement('canvas'); c.width = 640; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#fff3d2'; g.fillRect(0, 0, 640, 160); g.strokeStyle = '#1f5f6b'; g.lineWidth = 12; g.strokeRect(6, 6, 628, 148);
  g.fillStyle = '#1f5f6b'; g.textAlign = 'center'; g.font = '800 56px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; g.fillText('BELMORE BASIN', 320, 70);
  g.fillStyle = '#c2570a'; g.font = '800 40px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; g.fillText('FISHERS CO-OP · licensed catch', 320, 124);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.35, 0.14), [0xa4764a, 0xa4764a, 0xa4764a, 0xa4764a, 0xa4764a, 0xa4764a].map((col, i) => (i === 5 ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }) : new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }))));
  sign.position.set(cx - 1.2, QY + 4.55, cz - 3.5); sign.rotation.y = Math.PI; sign.userData.noShadow = true; pr.group.add(sign);
  // Light: lamp heads, the lighthouse beam, baitfish swarms in the pools and the night squid.
  LAMPS.forEach((L, i) => globalUniforms.uLamps.value[i].set(L.head[0], WHARF.y + LAMP_HEIGHT, L.head[1], 9));
  world.harbour = new HarbourLife(world, { lamps: LAMPS, headY: WHARF.y + LAMP_HEIGHT, poolR: POOL_R, lighthouse: { x: EBW, y: 2.6 + 9.75, z: NBW } });
  // Re-home the squid in the lamp pools (they are placed with the other life before the landmarks).
  const squid = world.life?.agents.filter(a => a.id === 'squid') ?? [];
  squid.forEach((a, i) => { const L = LAMPS[i % LAMPS.length]; a.home.set(L.head[0], -0.4, L.head[1]); a.pos.set(L.head[0] + (rnd() - 0.5) * 6, -0.4, L.head[1] + (rnd() - 0.5) * 6); a.target.copy(a.pos); });
}

export const harbour = {
  id: 'harbour',
  name: 'Belmore Basin',
  place: 'Wollongong harbour, NSW',
  blurb: 'A working harbour: a timber wharf with lamps, trawlers on the moorings, a stone breakwall and a lighthouse. Come back at dusk, when the squid rise into the lamp light.',
  unlock: { type: 'identifiedCount', n: 5, label: 'Identify 5 species in your Fish Guide' },
  terrainSize: 320, terrainSegments: 256, seabedKind: 'sand', ripple: 0.3, seed: 53, rocks: 0,
  heightAt, colorAt, reefiness, rockAt, deckAt, decorate, undecorate, litAt,
  bounds: { xMin: -58, xMax: 50, zMin: -33, zMax: 38 },   // where the underwater life and reef plants are placed
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
  island: { x: 30, z: 520, r: 400, h: 30 }, islandKind: 'headland',   // the Illawarra escarpment behind the harbour
  menuCam: { yaw: 0.35, swing: 0.3, pitch: 0.6, dist: 24, lift: 3 },
  fishing: { spotAt, litAt },
  // Swell washing over the breakwall (>= 2.5 m): spray, a warning, then a safety mark (npc/manager.js guardHazard).
  hazard: { id: 'breakwall', at: (x, z) => moundAt(x, z) > 1.0 && moundAt(x, z) < 3 && z < QUAY_Z - 2, swell: 2.5, warner: 'nell', label: 'the breakwall',
    warnText: { swell: 'The swell is {swell} m and waves are washing over the breakwall. Get off the rocks, {name}: fish the wharf or the basin instead.', ignored: 'You are still on the breakwall, {name}. A wave can sweep you into the harbour. Walk back to the quay.' } },
  land: {
    spawn: { x: 4, z: 47, yaw: 0.3 },
    bounds: { xMin: -58, xMax: 49, zMin: NBW - 1.5, zMax: 84 },
    intro: 'Welcome to Belmore Basin, Wollongong\'s fishing harbour. Fish off the wharf, the breakwall or the sandy basin. At dusk and night the wharf lamps draw baitfish, and the squid come up to feed: tie on a squid jig (T) and let it sink. Press E to chat with the people you meet.',
    life: {}, zones: {}, flyingGulls: 4, gullCircle: { x: 6, z: 46 },
    home: { x: -8, z: 49, r: 7, label: 'the harbour road' },
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
    ['kelp', 170, (x, z, h) => (rubbleAt(x, z) > 0.25 && h < -1 ? 1 : 0) + (h < -2 && Math.min(segDist(x, z, EBW, NBW, EBW, QUAY_Z + 4), segDist(x, z, ENTR, NBW, EBW, NBW)) < 9 ? 0.5 : 0)],
    ['crayweed', 60, (x, z, h) => (rubbleAt(x, z) > 0.2 && h > -3.2 ? 1 : 0.02)],
    ['harbourrock', 190, (x, z, h) => (h < -1.4 ? Math.max(rubbleAt(x, z), Math.min(segDist(x, z, EBW, NBW, EBW, QUAY_Z + 4), segDist(x, z, ENTR, NBW, EBW, NBW)) < 8 ? 0.8 : 0) : 0)],
  ],
  life: {
    yellowfinbream: 9, luderick: 6, silvertrevally: 5, garfish: 8, yakka: 42, slimymackerel: 20, squid: 6, cuttlefish: 3,
  },
};
