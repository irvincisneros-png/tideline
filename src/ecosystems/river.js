// The River (site 5): an Illawarra / Shoalhaven-style coastal river. Fresh, green-tinted water flows west to east between sandy banks of river she-oaks (casuarinas), past a deep still pool among boulders, over a low
// concrete weir with a walkway across it, and down a shallow riffle with a rocky pool below. You walk the south bank (and can cross the weir). Spots: the rocky pool, the weir (fast water below the wall) and the snags
// (fallen timber and undercut banks under the casuarinas). Species: Australian bass (the native perch, closed to keeping May to August: ?season=winter), common carp (an introduced pest: the best-practice flow) and the
// shortfin eel. The freshwater licence note comes from the dataset (content/river.js LICENCE). Opens once six species are Identified.
import * as THREE from 'three';
import { makeNoise, smoothstep, lerp } from '../core/noise.js';
import { species as speciesInfo, LICENCE, BASS_SEASON } from '../content/river.js';
import { registerBehaviour } from '../life/life.js';
import { addGenerator } from '../world/reef.js';
import { rock } from '../world/coral.js';
import { buildRiverModels } from '../world/riverProps.js';
import * as FL from '../world/flora.js';
import * as FO from '../world/foliage.js';
import { closedNow, SPECIES_BY_ID } from '../fishing/catches.js';
import '../fishing/fishLooks.js';

const noise = makeNoise(61);

// ---- layout (metres). The river runs along x; z = centre(x) is its middle; the south bank is +z.
export const WEIR_X = 30;                    // the weir wall: a concrete crest across the river
export const centre = x => 1.6 * Math.sin(x * 0.03 + 0.4);
export const halfWidth = x => 13 + 2 * Math.sin(x * 0.05 + 1);
/** Distance past the water's edge: negative in the river, positive on the bank. */
export const bankDist = (x, z) => Math.abs(z - centre(x)) - halfWidth(x);
const POOL_X = -26;                          // the deep, still pool among boulders upstream of the weir
const weirW = x => 1 - smoothstep(0.9, 2.1, Math.abs(x - WEIR_X));

export function heightAt(x, z) {
  const c = centre(x), hw = halfWidth(x), d = Math.abs(z - c), u = d / hw;
  const pool = Math.exp(-(((x - POOL_X) / 14) ** 2)) * 1.5, riffle = smoothstep(WEIR_X + 3, WEIR_X + 14, x);
  let h;
  if (u < 1) {
    h = -0.2 - (2.0 + pool) * (1 - u * u) * (1 - 0.6 * riffle) + noise.fbm2(x * 0.25, z * 0.25, 2) * 0.12;       // a rounded bed, deepest in the pool, shallow in the riffle below the weir
  } else {
    const e = (u - 1) * hw;                                                                                    // metres up the bank
    h = 0.12 + Math.min(e, 6) * 0.1 + smoothstep(4, 30, e) * 2.4 + noise.fbm2(x * 0.05, z * 0.05, 3) * 0.5 * smoothstep(3, 14, e);
    if (z > c) h += smoothstep(10, 40, e) * 0.5;
  }
  const w = weirW(x);
  if (w > 0 && u < 1.25) h = Math.max(h, lerp(h, 0.4, w));                                                      // the weir: a flat-topped concrete crest across the river, tied into both banks
  return h;
}
/** 0..1: boulders and the rocky pool (upstream) and the rocks below the weir. */
export function rockiness(x, z) {
  const d = Math.abs(z - centre(x)) / halfWidth(x);
  const pool = Math.exp(-(((x - POOL_X) / 16) ** 2)) * (1 - smoothstep(0.7, 1.15, d));
  const below = smoothstep(WEIR_X + 2, WEIR_X + 8, x) * (1 - smoothstep(WEIR_X + 26, WEIR_X + 40, x)) * (1 - smoothstep(0.85, 1.2, d));
  return Math.min(1, Math.max(pool, below) * (0.55 + 0.6 * (noise.n2(x * 0.18, z * 0.18) + 0.5)));
}
export const reefiness = (x, z) => (heightAt(x, z) < -0.3 ? rockiness(x, z) : 0.04);
export function colorAt(x, z, h) {
  const n = noise.n2(x * 0.3, z * 0.3) * 0.04, n2 = noise.n2(x * 0.06 + 5, z * 0.06);
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const bd = bankDist(x, z);
  let c = [0.66 + n, 0.6 + n, 0.44];                                                                              // river sand and gravel
  c = mix3(c, [0.48, 0.5, 0.34], smoothstep(-1.2, -3, h) * 0.6);                                                  // darker, greener silt in the deep pool
  c = mix3(c, [0.52 + n, 0.48 + n, 0.42 + n], rockiness(x, z) * 0.8);                                             // boulders
  if (bd > 0) {
    c = mix3([0.88, 0.8, 0.6], [0.96, 0.88, 0.68], smoothstep(0, 1.2, h));                                         // pale sand on the water's edge
    c = mix3(c, [0.5 + n * 2, 0.66 + n, 0.3], smoothstep(2.5, 8, bd + n2 * 5));                                    // grass
    c = mix3(c, [0.4 + n, 0.56 + n, 0.28], smoothstep(24, 55, bd));
  }
  const w = weirW(x);
  if (w > 0.4 && Math.abs(z - centre(x)) < halfWidth(x) * 1.2) {
    const joint = Math.abs(((z + 100) % 3.4) - 1.7) > 1.62;                                                       // concrete, with an expansion joint every 3.4 m
    c = mix3(c, joint ? [0.56, 0.55, 0.5] : [0.76, 0.74, 0.68], smoothstep(0.4, 0.8, w));
  }
  return c;
}
/** The spot a cast belongs to (keys of SPOTS in fishing/catches.js): where the float lands. */
export function spotAt(px, pz, tx = px, tz = pz) {
  if (Math.abs(tx - WEIR_X) < 9) return 'weir';
  const bd = bankDist(tx, tz);
  if (Math.abs(bd) < 3.6 || snagNear(tx, tz) < 4.2) return 'snags';
  return 'pool';
}
const SNAGS = [[-36, 12.5, 0.2], [-8, 13.8, -0.3], [16, 14.2, 0.1], [46, 12.5, 0.4], [-52, -13, -0.2], [4, -14.5, 0.3], [54, -12.5, -0.1]];
function snagNear(x, z) { let m = 99; for (const [sx, sz] of SNAGS) m = Math.min(m, Math.hypot(x - sx, z - (sz + centre(sx)))); return m; }

registerBehaviour('australianbass', { type: 'ambush', radius: 4, speed: 0.4, alt: [0.2, 1.2], flee: 2.2 });
registerBehaviour('carp', { type: 'wander', radius: 10, speed: 0.25, alt: [0.1, 0.7], flee: 2.5 });
registerBehaviour('shortfineel', { type: 'ambush', radius: 3, speed: 0.15, alt: [0.05, 0.3], flee: 1.2, camo: true });
const REGION = { xMin: -95, xMax: 95, zMin: 17, zMax: 90 }, REGION_N = { xMin: -95, xMax: 95, zMin: -90, zMax: -17 };
addGenerator('rivercasuarina', { fn: FO.banksiaTree, variants: 2, scale: [0.7, 1.15], radius: 0.6, sink: 0.1, rough: 0.8, cluster: 2, bleaches: false, as: 'casuarina', land: true, minH: 0.5, maxH: 12, region: REGION });
addGenerator('rivercasuarinaN', { fn: FO.banksiaTree, variants: 2, scale: [0.7, 1.15], radius: 0.6, sink: 0.1, rough: 0.8, cluster: 2, bleaches: false, as: 'casuarina', land: true, minH: 0.5, maxH: 12, region: REGION_N });
addGenerator('rivergrass', { fn: FO.spinifexPatch, foliage: true, noShadow: true, variants: 3, scale: [0.8, 1.3], radius: 0.4, sink: 0, rough: 0.8, sway: 0.25, cluster: 8, bleaches: false, as: 'spinifex', land: true, soft: true, ao: 0.3, minH: 0.25, maxH: 12, region: { ...REGION, zMax: 70 } });
addGenerator('riverrock', { fn: rock, variants: 3, scale: [0.9, 2.4], radius: 0.9, sink: 0.35, rough: 0.95, bleaches: false, soft: true });
addGenerator('riverweed', { fn: s => FL.seagrassClump(s, { blades: 40, height: 0.55, spread: 0.6 }), variants: 4, scale: [0.9, 1.4], radius: 0.5, sink: 0, rough: 0.7, sway: 1.4, cluster: 6, bleaches: false, as: 'zostera', maxH: -0.25, minH: -3.2, detailScale: 30, transl: 0.5, doubleSide: true, soft: true });

/** The weir spill: a pale, streaked sheet of water sliding down the downstream face of the wall, and a band of foam where it lands. */
function makeSpill(scene) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(235,250,248,0.55)'; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 46; i++) { const y = Math.random() * 64, x = Math.random() * 128, h = 1 + Math.random() * 3, w = 14 + Math.random() * 44; g.fillStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.5})`; g.fillRect(x, y, w, h); g.fillRect(x - 128, y, w, h); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 9); tex.colorSpace = THREE.SRGBColorSpace;
  const hw = halfWidth(WEIR_X) * 1.05, cz = centre(WEIR_X);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(3.4, hw * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9, side: THREE.DoubleSide, fog: true }));
  sheet.position.set(WEIR_X + 2.4, 0.13, cz); sheet.renderOrder = 3; sheet.userData.noShadow = true;
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(1.6, hw * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, fog: true }));
  foam.position.set(WEIR_X + 4.3, 0.14, cz); foam.renderOrder = 3; foam.userData.noShadow = true;
  const grp = new THREE.Group(); grp.add(sheet, foam); scene.add(grp);
  return { grp, tex, foam, sheet };
}

const SP = { spill: null, board: null, shown: false };
function undecorate() {
  if (SP.spill) { SP.spill.grp.parent?.remove(SP.spill.grp); SP.spill.grp.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); SP.spill = null; }
  SP.board = null;
}
function decorate(world) {
  undecorate();
  const pr = world.props, T = world.terrain, rnd = Math.random;
  for (const [k, g] of buildRiverModels()) world.models.set(k, g);
  // fallen timber in the water along both banks: the snags
  SNAGS.forEach(([x, dz, rot], i) => {
    const z = centre(x) + dz;
    pr.place(`snag_log_${i % 3}`, x, z, { rot: rot + (dz > 0 ? 0 : Math.PI), y: -0.05, scale: 1 + (i % 2) * 0.2 });
  });
  // stepping stones across the shallows below the weir
  for (let i = 0; i < 7; i++) { const x = WEIR_X + 11 + i * 1.7, z = centre(x) + (i - 3) * 1.8 + 8, y = T.heightAt(x, z); if (y < 0.1) pr.place(`stepping_stone_${i % 2}`, x, z, { y: y + 0.1, rot: i }); }
  // hand-rails along the weir walkway, a licence noticeboard by the bank, and the river she-oaks that frame it
  for (const dx of [-2, 2]) for (let z = -9; z <= 9; z += 4) if (z > -9) pr.place('weir_rail', WEIR_X + dx * 0.45, centre(WEIR_X) + z, { y: 0.4, rot: Math.PI / 2 });
  const bx = -34, bz = centre(bx) + halfWidth(bx) + 5;
  const board = pr.place('notice_board', bx, bz, { rot: 0, shadow: 1.6, tall: 2.6 }); world.addCollider(bx, T.heightAt(bx, bz) + 1, bz, 1.4);
  if (board) { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d');
    g.fillStyle = '#fff3d2'; g.fillRect(0, 0, 640, 360); g.strokeStyle = '#1f5f6b'; g.lineWidth = 10; g.strokeRect(5, 5, 630, 350);
    g.fillStyle = '#1f5f6b'; g.textAlign = 'center'; g.font = '800 38px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; g.fillText('FRESHWATER FISHING', 320, 58);
    g.font = '700 25px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; g.textAlign = 'left';
    ['The NSW recreational fishing fee applies (18+).', 'Under 18? No fee, but all the rules apply.', 'Bass: closed to keeping May to August.', 'Carp are a pest: best practice is to', 'dispatch and bin them, never move live carp.', 'Check FishSmart before you fish.'].forEach((l, i) => g.fillText(l, 28, 118 + i * 38));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.29), new THREE.MeshBasicMaterial({ map: tex, fog: true })); face.position.set(bx, 1.75, bz + 0.07); face.userData.noShadow = true; pr.group.add(face); SP.board = face; }
  for (const [x, dz, m, s] of [[-52, 9, 'casuarina_0', 0.95], [-12, 11, 'casuarina_1', 1.0], [8, 8, 'casuarina_0', 0.95], [22, 10, 'casuarina_1', 0.9], [40, 9, 'casuarina_0', 1.0], [-64, 7, 'casuarina_1', 1.0]]) {
    const z = centre(x) + halfWidth(x) + dz, y = T.heightAt(x, z);
    pr.place(m, x, z, { rot: rnd() * 6.28, scale: s, sink: 0.1, shadow: 2.4, tall: 8 }); world.addCollider(x, y + 1, z, 1.1);
  }
  SP.spill = makeSpill(world.scene);
}
function tick(game, dt) {
  const s = SP.spill; if (!s) return;
  s.tex.offset.x = (s.tex.offset.x - dt * 0.9) % 1;
  s.foam.material.opacity = 0.42 + 0.14 * Math.sin(game.time * 2.2);
}

/** Is bass keeping closed right now (the closed season is on)? Reads the day's season or month from the conditions. */
export const bassClosed = cond => closedNow(SPECIES_BY_ID.australianbass.rules, { month: cond?.month, season: cond?.season });
/** A phrase for the HUD chip. */
function chipExtra(game) { return bassClosed(game.cond) ? ' · Bass: catch and release only' : ''; }
/** The freshwater licence card (once) and the closed-season notice, shown when the outing starts. */
function onStart(game) {
  const p = game.progress; (p.tips ??= {});
  if (!p.tips.fwLicence) {
    p.tips.fwLicence = true; game.persist();
    game.panels.open(`<div class="flow licence"><h2>🎣 ${LICENCE.title}</h2><ul class="lic-list">${LICENCE.lines.map(l => `<li>${l}</li>`).join('')}</ul>
      <div class="rule-card"><b>Bass season</b>${BASS_SEASON.text}</div><p class="muted">${LICENCE.src}</p><p><button class="btn primary" id="lic-ok">Got it</button></p></div>`);
    game.panels.body.querySelector('#lic-ok').onclick = () => game.panels.close();
  }
  if (bassClosed(game.cond)) setTimeout(() => game.toast(`${BASS_SEASON.label}: ${BASS_SEASON.text}`, 'warn'), 600);
}

export const river = {
  id: 'river',
  name: 'Freshwater river',
  place: 'Illawarra coastal river, NSW',
  blurb: 'A green coastal river between she-oaks, with a deep rocky pool, a concrete weir and fallen snags. Native bass, pest carp and eels. Bass are catch-and-release from May to August.',
  unlock: { type: 'identifiedCount', n: 6, label: 'Identify 6 species in your Fish Guide' },
  terrainSize: 320, terrainSegments: 256, seabedKind: 'sand', ripple: 0.25, seed: 61, rocks: 0,
  heightAt, colorAt, reefiness, decorate, undecorate, tick, onStart, chipExtra,
  bounds: { xMin: -80, xMax: 80, zMin: -15, zMax: 15 },
  calm: 0.04,
  daylight: true,
  shoalDepth: [0.5, 3.6],
  water: {
    shafts: 0, exposure: 1.0,
    absorb: [0.34, 0.12, 0.18], fog: 0x4aa58f, fogDeep: 0x2a6a5c, fogDensity: 0.1,
    shallow: 0x7ed3a6, mid: 0x3f9a86, deep: 0x2b6f66, fogDepthScale: 6,
    skyTop: 0x3a8ae0, skyHorizon: 0xdceee6, sun: [0.45, 0.66, -0.4], sunIntensity: 2.3, sunColor: 0xfff0d2,
    hemiSky: 0xd6ecde, hemiGround: 0x5a7a4a,
  },
  sound: { wash: 0.06, wind: 0.25, shrimp: 0, gulls: 0, mangroveBirds: 1, mangroveAt: [10, 40] },
  menuCam: { yaw: 0.55, swing: 0.3, pitch: 0.6, dist: 22, lift: 2.2 },
  fishing: { spotAt },
  land: {
    spawn: { x: -30, z: centre(-30) + halfWidth(-30) + 1.6, yaw: 0 },
    bounds: { xMin: -84, xMax: 84, zMin: -60, zMax: 72 },
    intro: 'Welcome to the river. Fish the deep rocky pool, the water below the weir and the snags under the she-oaks. Bass love snags and dive for them when hooked, so keep the rod up. Carp are a pest: best practice is to take them out. Cross the weir by its walkway to fish the far bank.',
    life: {}, zones: {}, flyingGulls: 0,
    home: { x: -30, z: centre(-30) + halfWidth(-30) + 5, r: 8, label: 'the car park by the bank' },
  },
  treeShadows: { casuarina: [2.4, 8] },
  cosyModels: {
    url: 'assets/models/seagrass_cosy.glb',
    coral: { rivercasuarina: ['casuarina_0', 'casuarina_1'], rivercasuarinaN: ['casuarina_0', 'casuarina_1'], riverweed: ['zostera_0', 'zostera_1', 'zostera_2'] },
    statics: {},
  },
  speciesInfo,
  placers: {},
  coral: [
    ['rivercasuarina', 34, (x, z) => (z > centre(x) + halfWidth(x) + 7 && !(x > -48 && x < -14 && z < centre(x) + halfWidth(x) + 22) ? 1 : 0)],
    ['rivercasuarinaN', 26, (x, z) => (z < centre(x) - halfWidth(x) - 5 ? 1 : 0)],
    ['rivergrass', 240, (x, z) => (bankDist(x, z) > 1 && bankDist(x, z) < 26 ? 1 : 0.05)],
    ['riverrock', 140, (x, z, h) => (h < 0 ? rockiness(x, z) : 0)],
    ['riverweed', 600, (x, z, h) => (h < -0.3 && h > -3 && rockiness(x, z) < 0.5 ? 1 : 0)],
  ],
  life: { australianbass: 10, carp: 10, shortfineel: 4 },
};
