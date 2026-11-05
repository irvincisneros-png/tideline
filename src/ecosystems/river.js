// The River (site 5): an Illawarra / Shoalhaven-style coastal river. Fresh, green-tinted water flows west to east between sandy banks of river she-oaks (casuarinas), past a deep still pool among boulders, over a low
// concrete weir with a walkway across it, and down a shallow riffle with a rocky pool below. You walk the south bank (and can cross the weir). Spots: the rocky pool, the weir (fast water below the wall) and the snags
// (fallen timber and undercut banks under the casuarinas). Species: Australian bass (the native perch, closed to keeping May to August: ?season=winter), common carp (an introduced pest: the best-practice flow) and the
// shortfin eel. The freshwater licence note comes from the dataset (content/river.js LICENCE). Opens once six species are Identified.
import * as THREE from 'three';
import { makeNoise, smoothstep, lerp, mulberry32 } from '../core/noise.js';
import { species as speciesInfo, LICENCE, BASS_SEASON } from '../content/river.js';
import { registerBehaviour } from '../life/life.js';
import { addGenerator } from '../world/reef.js';
import { rock } from '../world/coral.js';
import { buildRiverModels, weirTop } from '../world/riverProps.js';
import * as FL from '../world/flora.js';
import * as RT from '../world/riverTrees.js';
import { patchUnderwater } from '../ocean/shaders.js';
import { closedNow, SPECIES_BY_ID } from '../fishing/catches.js';
import * as G from '../world/groundPaint.js';
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
// The landing: a raised, flat pad of packed earth on the south bank with a little timber deck toward the water: where you start. (Spawn is dry ground a few steps from the water's edge.)
const LAND = { x: -30, z: centre(-30) + halfWidth(-30) + 3.6, y: 0.62, r: 3.2 };
const DECK = { x: -30, hx: 1.3, z: centre(-30) + halfWidth(-30) + 2.7, hz: 1.2, y: 0.7 };
// Gravel bars on the inside of the bends: [x, side (+1 south bank, -1 north), half-length, how far they reach into the river].
const BARS = [[-18, 1, 6.5, 3.4], [-44, -1, 6, 3], [40, -1, 6.5, 3.2], [62, 1, 6, 3]];
/** 0..1: how much of a gravel bar is here (just above the water, on the inside of a bend). */
export function barAt(x, z) {
  const sgn = Math.sign(z - centre(x)) || 1, bd = bankDist(x, z); let m = 0;
  for (const [bx, s, w, dp] of BARS) if (s === sgn) m = Math.max(m, (1 - smoothstep(0.35, 1, Math.abs(x - bx) / w)) * smoothstep(-dp, -dp * 0.3, bd) * (1 - smoothstep(0.4, 1.6, bd)));
  return m;
}
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
/** 0..1: the packed gravel track from the landing to the car park and the noticeboard. */
export function pathAt(x, z) {
  const d = Math.min(segDist(x, z, LAND.x, LAND.z - 0.5, LAND.x + 0.4, LAND.z + 9), segDist(x, z, LAND.x, LAND.z + 1, -33.6, LAND.z + 1.2));
  return 1 - smoothstep(0.45, 0.95, d);
}
/** Walkable built things above the ground: the weir (crest and its steps) and the landing deck. */
export function deckAt(x, z) {
  if (Math.abs(x - DECK.x) < DECK.hx && Math.abs(z - DECK.z) < DECK.hz) return DECK.y;
  const dx = x - WEIR_X; if (dx > -1.1 && dx < 4.9 && Math.abs(z - centre(WEIR_X)) < halfWidth(WEIR_X) + 0.4) return weirTop(dx);
  return null;
}

export function heightAt(x, z) {
  const c = centre(x), hw = halfWidth(x), d = Math.abs(z - c), u = d / hw;
  const pool = Math.exp(-(((x - POOL_X) / 14) ** 2)) * 1.5, riffle = smoothstep(WEIR_X + 3, WEIR_X + 14, x);
  let h;
  if (u < 1) {
    h = -0.2 - (2.0 + pool) * (1 - u * u) * (1 - 0.6 * riffle) + noise.fbm2(x * 0.25, z * 0.25, 2) * 0.12;       // a rounded bed, deepest in the pool, shallow in the riffle below the weir
  } else {
    const e = (u - 1) * hw;                                                                                    // metres up the bank
    h = 0.14 + Math.min(e, 6) * 0.1 + smoothstep(4, 30, e) * 2.4 + noise.fbm2(x * 0.05, z * 0.05, 3) * 0.5 * smoothstep(3, 14, e);
    if (z > c) h += smoothstep(10, 40, e) * 0.5;
    h = lerp(h, LAND.y, 1 - smoothstep(LAND.r, LAND.r + 2.3, Math.hypot(x - LAND.x, z - LAND.z)));                  // the flat landing pad
  }
  const bar = u < 1 ? barAt(x, z) : 0;
  if (bar > 0) h = Math.max(h, lerp(h, 0.12, bar));                                                                // a gravel bar just clear of the water
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
/** Mown lawn (eco.lawnAt for the terrain shader): only the picnic clearing by the landing; everywhere else is long grass. */
export function lawnAt(x, z) {
  return [1 - smoothstep(14, 22, Math.hypot(x - LAND.x, z - LAND.z)), bankDist(x, z)];
}
export function colorAt(x, z, h) {
  const n = noise.n2(x * 0.3, z * 0.3) * 0.04, n2 = noise.n2(x * 0.06 + 5, z * 0.06);
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const bd = bankDist(x, z);
  let c = [0.66 + n, 0.6 + n, 0.44];                                                                              // river sand and gravel
  c = mix3(c, [0.48, 0.5, 0.34], smoothstep(-1.2, -3, h) * 0.6);                                                  // darker, greener silt in the deep pool
  c = mix3(c, [0.52 + n, 0.48 + n, 0.42 + n], rockiness(x, z) * 0.8);                                             // boulders
  if (bd > 0) {
    c = mix3([0.88, 0.8, 0.6], [0.96, 0.88, 0.68], smoothstep(0, 1.2, h));                                         // pale sand on the water's edge
    c = G.paintGrass(c, x, z, smoothstep(2.5, 8, bd + n2 * 5), 0.35);                                              // rough grass
    c = mix3(c, [c[0] * 0.78, c[1] * 0.9, c[2] * 0.8], smoothstep(24, 55, bd));                                    // deeper under the bush
  }
  const bar = barAt(x, z);
  if (bar > 0) c = mix3(c, [0.7 + n * 3, 0.66 + n * 3, 0.55 + n * 2], smoothstep(0.1, 0.6, bar));                      // pebbly gravel
  if (bd > 0) { const pa = pathAt(x, z), pad = 1 - smoothstep(LAND.r - 0.4, LAND.r + 1.2, Math.hypot(x - LAND.x, z - LAND.z)); c = mix3(c, [0.8 + n * 2, 0.71 + n * 2, 0.55 + n], Math.max(pa * 0.9, pad * 0.75)); }   // packed earth and gravel
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
const REGION = { xMin: -95, xMax: 95, zMin: 17, zMax: 52 }, REGION_N = { xMin: -95, xMax: 95, zMin: -52, zMax: -17 };
const SHEOAK = { fn: RT.sheOak, foliage: true, atlas: RT.riverAtlas, variants: 3, scale: [0.8, 1.2], radius: 0.6, sink: 0.1, rough: 0.85, sway: 0.03, cluster: 2, bleaches: false, as: 'casuarina', land: true, minH: 0.5, maxH: 12, sat: 1, ao: 0.35 };
addGenerator('rivercasuarina', { ...SHEOAK, region: REGION });
addGenerator('rivercasuarinaN', { ...SHEOAK, region: REGION_N });
const nearLanding = (x, z, r) => Math.hypot(x - LAND.x, z - LAND.z) < r, nearWeir = x => Math.abs(x - WEIR_X) < 5;
const patch = (x, z, k = 0.1, o = 3) => smoothstep(-0.02, 0.22, noise.n2(x * k + o, z * k));
addGenerator('riverlomandra', { fn: RT.lomandra, variants: 4, scale: [0.8, 1.35], radius: 0.45, sink: 0.02, rough: 0.85, sway: 0.18, cluster: 3, bleaches: false, as: 'lomandra', land: true, soft: true, noShadow: true, doubleSide: true, sat: 1, ao: 0.5, minH: 0.3, maxH: 12 });
addGenerator('riverreeds', { fn: RT.reeds, variants: 4, scale: [0.85, 1.4], radius: 0.3, sink: 0.12, rough: 0.8, sway: 0.2, cluster: 4, bleaches: false, as: 'reeds', land: true, soft: true, noShadow: true, doubleSide: true, sat: 1, ao: 0.4, minH: -0.5, maxH: 0.42 });
addGenerator('riverboulder', { fn: RT.boulder, variants: 4, scale: [0.7, 1.7], radius: 0.7, sink: 0.12, rough: 0.95, bleaches: false, as: 'boulder', land: true, sat: 1, ao: 0.6, minH: -0.5, maxH: 3 });
addGenerator('riverpebbles', { fn: RT.pebbles, variants: 4, scale: [0.9, 1.4], radius: 0.4, sink: 0.04, rough: 0.9, bleaches: false, as: 'pebbles', land: true, soft: true, noShadow: true, sat: 1, ao: 0.2, minH: -0.45, maxH: 0.6, cluster: 3 });
addGenerator('riverrock', { fn: rock, variants: 3, scale: [0.9, 2.4], radius: 0.9, sink: 0.35, rough: 0.95, bleaches: false, soft: true });
addGenerator('riverweed', { fn: s => FL.seagrassClump(s, { blades: 40, height: 0.55, spread: 0.6 }), variants: 4, scale: [0.9, 1.4], radius: 0.5, sink: 0, rough: 0.7, sway: 1.4, cluster: 6, bleaches: false, as: 'zostera', maxH: -0.25, minH: -3.2, detailScale: 30, transl: 0.5, doubleSide: true, soft: true });

// ---- water effects at the weir: water sliding down the steps, a churning band where it lands, and a foam line drifting off downstream. All flat textured planes (cheap): the low tier gets fewer layers.
function paint(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
const fxMat = (map, opacity = 1, extra = {}) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity, side: THREE.DoubleSide, fog: true, ...extra });
function makeWeirFx(scene, low) {
  const hw = halfWidth(WEIR_X) * 0.98, cz = centre(WEIR_X), rnd = mulberry32(8), grp = new THREE.Group();
  const spillTex = paint(128, 64, (g, w, h) => {
    g.fillStyle = 'rgba(230,248,246,0.5)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 52; i++) { const y = rnd() * h, x = rnd() * w, hh = 1 + rnd() * 3, ww = 14 + rnd() * 44; g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.55})`; g.fillRect(x, y, ww, hh); g.fillRect(x - w, y, ww, hh); }
  });
  spillTex.repeat.set(1, 9);
  // a ribbon that follows the stepped profile: along the crest lip, down each riser, across each tread
  const prof = [[1.0, 0.425], [1.15, 0.425], [1.17, 0.245], [3.0, 0.245], [3.02, 0.075], [4.9, 0.075], [4.92, 0.01], [5.9, 0.01]];
  const pos = [], uv = [], idx = []; let run = 0;
  prof.forEach(([x, y], i) => { if (i) run += Math.hypot(x - prof[i - 1][0], y - prof[i - 1][1]); pos.push(WEIR_X + x, y, cz - hw, WEIR_X + x, y, cz + hw); uv.push(run / 3, 0, run / 3, 1); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx);
  const spill = new THREE.Mesh(rg, fxMat(spillTex, 0.88)); spill.renderOrder = 3; spill.userData.noShadow = true; spill.frustumCulled = false; grp.add(spill);
  // the churn where the fall lands: white water boiling in two layers
  const churnTex = paint(128, 128, (g, w, h) => { for (let i = 0; i < 200; i++) { const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * 6.5, a = 0.35 + rnd() * 0.55; for (const [ox, oy] of [[0, 0], [-w, 0], [w, 0], [0, -h], [0, h]]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, r, 0, 6.3); g.fill(); } } });
  churnTex.repeat.set(2, hw * 2 / 3.5);
  const churn = new THREE.Mesh(new THREE.PlaneGeometry(3.4, hw * 2).rotateX(-Math.PI / 2), fxMat(churnTex, 0.85)); churn.position.set(WEIR_X + 6.5, 0.06, cz); churn.renderOrder = 4; churn.userData.noShadow = true; grp.add(churn);
  let churn2 = null, churnTex2 = null;
  if (!low) { churnTex2 = churnTex.clone(); churnTex2.needsUpdate = true; churnTex2.repeat.set(3, hw * 2 / 2.6); churn2 = new THREE.Mesh(new THREE.PlaneGeometry(4.6, hw * 2).rotateX(-Math.PI / 2), fxMat(churnTex2, 0.5)); churn2.position.set(WEIR_X + 6.8, 0.07, cz); churn2.renderOrder = 4; churn2.userData.noShadow = true; grp.add(churn2); }
  // the foam line trailing downstream: ribbons that follow the river, fading out, scrolling with the current
  const foamTex = paint(256, 64, (g, w, h) => { for (let i = 0; i < 260; i++) { const x = rnd() * w, y = h * (0.5 + (rnd() + rnd() - 1) * 0.42), r = 1 + rnd() * 3, a = 0.2 + rnd() * 0.6; g.fillStyle = `rgba(255,255,255,${a})`; for (const ox of [0, -w, w]) { g.beginPath(); g.ellipse(x + ox, y, r * (2 + rnd() * 5), r, 0, 0, 6.3); g.fill(); } } });
  const lanes = low ? [[-3.5, 1.6], [3.8, 1.3]] : [[-6, 1.4], [-1.6, 2.0], [2.8, 1.5], [6.3, 1.2]], foam = [];
  lanes.forEach(([off, wd], li) => {
    const tex = foamTex.clone(); tex.needsUpdate = true; tex.repeat.set(7, 1);
    const fp = [], fu = [], fi = [], n = 16, L = 26;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = WEIR_X + 7.6 + t * L, zc = centre(x) + off * (0.8 + t * 0.25) + Math.sin(t * 6 + li * 1.7) * 0.9 * t, w2 = wd * (0.7 + t * 0.9);
      fp.push(x, 0.065, zc - w2, x, 0.065, zc + w2); fu.push(t, 0, t, 1); if (i) { const b = (i - 1) * 2; fi.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
    const cols = []; for (let i = 0; i <= n; i++) { const a = 0.9 * Math.pow(1 - i / n, 1.2); cols.push(1, 1, 1, a, 1, 1, 1, a); } geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 4)); geo.setIndex(fi);
    const m = new THREE.Mesh(geo, fxMat(tex, 0.8, { vertexColors: true })); m.renderOrder = 3; m.userData.noShadow = true; m.frustumCulled = false; grp.add(m); foam.push({ tex, sp: 0.28 + li * 0.07 });
  });
  scene.add(grp);
  return { grp, spillTex, churnTex, churnTex2, foam, churn, churn2 };
}

const SP = { fx: null, board: null, meshes: [], mats: [] };
function undecorate() {
  const f = SP.fx;
  if (f) { f.grp.parent?.remove(f.grp); f.grp.traverse(o => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); }
  SP.fx = null; SP.board = null;
  for (const m of SP.meshes) { m.parent?.remove(m); m.geometry.dispose(); m.dispose?.(); }
  for (const m of SP.mats) m.dispose();
  SP.meshes = []; SP.mats = [];
}
function signFace(pr, text, x, y, z, w, h, px, ink = '#1f5f6b', paperC = '#fff3d2') {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const g = c.getContext('2d');
  g.fillStyle = paperC; g.fillRect(0, 0, c.width, c.height); g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${px}px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif`; g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: true })); face.position.set(x, y, z); face.userData.noShadow = true; pr.group.add(face); SP.meshes.push(face); face.dispose = () => { tex.dispose(); face.material.dispose(); };
  return face;
}
/** The hand-placed trees: river she-oaks and leaning water gums, drawn as a few instanced meshes sharing the painted leaf atlas (a lit, alpha-cut material like the scatter). */
function plantTrees(world, list) {
  const pr = world.props, T = world.terrain;
  const mat = patchUnderwater(new THREE.MeshStandardMaterial({ vertexColors: true, map: RT.riverAtlas(), alphaTest: 0.45, alphaToCoverage: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }), { cutaway: 3.4, coral: false, sway: 0.03, detail: false });
  SP.mats.push(mat);
  const geos = { oak: [101, 102, 103].map(sd => RT.sheOak(sd)), gum: [201, 202, 203].map(sd => RT.waterGum(sd, 3.0)) }, groups = new Map();
  for (const t of list) { const k = `${t.kind}${t.v % 3}`; (groups.get(k) ?? groups.set(k, []).get(k)).push(t); }
  for (const [k, items] of groups) {
    const kind = k.slice(0, 3), geo = geos[kind][+k.slice(3)], im = new THREE.InstancedMesh(geo, mat, items.length), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    items.forEach((t, i) => { const y = T.heightAt(t.x, t.z) - 0.08; m.compose(new THREE.Vector3(t.x, y, t.z), q.setFromEuler(e.set(0, t.rot, 0)), new THREE.Vector3(t.s, t.s, t.s)); im.setMatrixAt(i, m); im.setColorAt(i, new THREE.Color().setRGB(0.95 + 0.1 * ((i * 7) % 3) / 2, 1, 0.95)); pr.blobs.push({ x: t.x, z: t.z, y: y + 0.08, r: (kind === 'oak' ? 2.4 : 2.0) * t.s, tall: kind === 'oak' ? 8 : 5, rot: t.rot }); world.addCollider(t.x, y + 1, t.z, kind === 'oak' ? 1.0 : 0.9); });
    im.instanceMatrix.needsUpdate = true; im.castShadow = im.receiveShadow = true; im.name = `river_${k}`; im.frustumCulled = false; pr.group.add(im); SP.meshes.push(im);
  }
}
function decorate(world) {
  undecorate();
  const pr = world.props, T = world.terrain, low = !pr.quality?.shadows, rnd = mulberry32(44);
  for (const [k, g] of buildRiverModels({ weirHalf: halfWidth(WEIR_X) })) world.models.set(k, g);
  // fallen timber half sunk in the shallows along both banks: the snags
  SNAGS.forEach(([x, dz, rot], i) => {
    const sg = dz > 0 ? 1 : -1, z = centre(x) + sg * (halfWidth(x) - 1.1);
    pr.place(`snag_log_${i % 3}`, x, z, { rot: rot + (sg > 0 ? 0 : Math.PI), y: -0.1, scale: 1 + (i % 2) * 0.2 });
  });
  // the landing, its path and the carpark side of things
  const dz0 = DECK.z; pr.place('landing', DECK.x, dz0, { y: 0 });
  for (let i = 0; i < 7; i++) { const t = i / 6, x = LAND.x + Math.sin(t * 3) * 0.35 + (i % 2 ? 0.25 : -0.25), z = LAND.z + 1.4 + t * 7.4; pr.place(`flagstone_${i % 2}`, x, z, { y: T.heightAt(x, z) - 0.26, rot: rnd() * 6.28, scale: 0.55 + rnd() * 0.2 }); }
  // the weir: stepped weathered concrete with abutment walls, the walkway rails along the crest, and a fishway (a side channel of stepped pools) on the south bank
  const cz = centre(WEIR_X), half = halfWidth(WEIR_X);
  pr.place('weir_body', WEIR_X, cz, { y: 0 });
  for (const dx of [-0.85, 0.85]) for (let z = -12; z <= 12; z += 4) pr.place('weir_rail', WEIR_X + dx, cz + z, { y: 0.4, rot: Math.PI / 2 });
  const lz = cz + half + 3.5; pr.place('fish_ladder', WEIR_X - 2.6, lz, { y: T.heightAt(WEIR_X + 3, lz) - 0.12 });
  pr.place('post_sign', WEIR_X + 3, lz + 2.2, { y: T.heightAt(WEIR_X + 3, lz + 2.2) - 0.1, rot: 0 });
  signFace(pr, 'FISHWAY', WEIR_X + 3, T.heightAt(WEIR_X + 3, lz + 2.2) - 0.1 + 1.45, lz + 2.2 + 0.05, 1.42, 0.5, 74, '#1f5f6b', '#fff3d2');
  const bx = -34, bz = centre(bx) + halfWidth(bx) + 5;
  const board = pr.place('notice_board', bx, bz, { rot: 0, shadow: 1.6, tall: 2.6 }); world.addCollider(bx, T.heightAt(bx, bz) + 1, bz, 1.4);
  if (board) { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d');
    g.fillStyle = '#fff3d2'; g.fillRect(0, 0, 640, 360); g.strokeStyle = '#1f5f6b'; g.lineWidth = 10; g.strokeRect(5, 5, 630, 350);
    g.fillStyle = '#1f5f6b'; g.textAlign = 'center'; g.font = '800 38px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; g.fillText('FRESHWATER FISHING', 320, 58);
    g.font = '700 25px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; g.textAlign = 'left';
    ['The NSW recreational fishing fee applies (18+).', 'Under 18? No fee, but all the rules apply.', 'Bass: closed to keeping May to August.', 'Carp are a pest: best practice is to', 'dispatch and bin them, never move live carp.', 'Check FishSmart before you fish.'].forEach((l, i) => g.fillText(l, 28, 118 + i * 38));
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.29), new THREE.MeshBasicMaterial({ map: tex, fog: true })); face.position.set(bx, 1.75, bz + 0.07); face.userData.noShadow = true; pr.group.add(face); SP.board = face; }
  // river she-oaks that frame the weir and the pool, and water gums leaning out over the water
  const trees = [];
  for (const [x, dz, v, s] of [[-52, 9, 0, 0.95], [-12, 11, 1, 1.0], [8, 8, 2, 0.95], [22, 11, 1, 0.9], [40, 9, 0, 1.0], [-64, 7, 1, 1.0], [-40, 14, 2, 1.0], [34, 13, 0, 0.95]]) trees.push({ kind: 'oak', x, z: centre(x) + halfWidth(x) + dz, v, s, rot: rnd() * 6.28 });
  for (const [x, dz, v, s] of [[-50, 10, 1, 1], [-14, 12, 2, 1], [60, 11, 0, 1], [-24, -10, 1, 1], [10, -11, 0, 0.95], [48, -9, 2, 1]]) trees.push({ kind: 'oak', x, z: centre(x) + (dz > 0 ? 1 : -1) * (halfWidth(x) + Math.abs(dz)), v, s, rot: rnd() * 6.28 });
  for (const [x, sg] of [[-46, 1], [-24, 1], [-4, 1], [22, 1], [52, 1], [-34, -1], [-10, -1], [28, -1], [66, -1], [-60, -1], [-68, 1]]) trees.push({ kind: 'gum', x, z: centre(x) + sg * (halfWidth(x) + 1.3 + rnd() * 0.8), v: Math.floor(rnd() * 3), s: 1.25 + rnd() * 0.25, rot: (sg > 0 ? Math.PI / 2 : -Math.PI / 2) + (rnd() - 0.5) * 0.7 });
  plantTrees(world, trees);
  SP.fx = makeWeirFx(world.scene, low);
}
function tick(game, dt) {
  const f = SP.fx; if (!f) return;
  const t = game.time ?? 0;
  f.spillTex.offset.x = (f.spillTex.offset.x - dt * 0.9) % 1;
  f.churnTex.offset.set((f.churnTex.offset.x + dt * 0.5) % 1, (f.churnTex.offset.y - dt * 0.65) % 1);
  f.churn.material.opacity = 0.78 + 0.1 * Math.sin(t * 3.1);
  if (f.churnTex2) { f.churnTex2.offset.set((f.churnTex2.offset.x - dt * 0.37) % 1, (f.churnTex2.offset.y - dt * 0.5) % 1); f.churn2.material.opacity = 0.45 + 0.12 * Math.sin(t * 2.3 + 1); }
  for (const l of f.foam) l.tex.offset.x = (l.tex.offset.x - dt * l.sp) % 1;
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
  fresh: true,                         // no tide and no swell: the HUD shows the river's flow, and the bite model reads flow, not tide (fishing/gear.js DayConditions)
  name: 'Freshwater river',
  place: 'Illawarra coastal river, NSW',
  blurb: 'A green coastal river between she-oaks, with a deep rocky pool, a concrete weir and fallen snags. Native bass, pest carp and eels. Bass are catch-and-release from May to August.',
  unlock: { type: 'identifiedCount', n: 6, label: 'Identify 6 species in your Fish Guide' },
  terrainSize: 320, terrainSegments: 256, seabedKind: 'sand', ripple: 0.25, seed: 61, rocks: 0,
  heightAt, colorAt, reefiness, deckAt, decorate, undecorate, tick, onStart, chipExtra,
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
    spawn: { x: LAND.x, z: LAND.z + 1.0, yaw: 0 },
    bounds: { xMin: -84, xMax: 84, zMin: -60, zMax: 72 },
    intro: 'Welcome to the river. Fish the deep rocky pool, the water below the weir and the snags under the she-oaks. Bass love snags and dive for them when hooked, so keep the rod up. Carp are a pest: best practice is to take them out. Cross the weir by its walkway to fish the far bank.',
    life: {}, zones: {}, flyingGulls: 0,
    home: { x: LAND.x, z: LAND.z + 10, r: 5, label: 'the car park by the bank' },
  },
  ridge: { arc: [0, 359] }, lawnAt,   // the escarpment all round the valley
  treeShadows: { casuarina: [2.4, 8] },
  cosyModels: {
    url: 'assets/models/seagrass_cosy.glb',
    coral: { rivercasuarina: ['she_oak_0', 'she_oak_1'], rivercasuarinaN: ['she_oak_0', 'she_oak_1'], riverweed: ['zostera_0', 'zostera_1', 'zostera_2'] },
    statics: {},
  },
  speciesInfo,
  placers: {},
  coral: [
    ['rivercasuarina', 48, (x, z) => (z > centre(x) + halfWidth(x) + 7 && !(x > -48 && x < -14 && z < centre(x) + halfWidth(x) + 22) ? 1 : 0)],
    ['rivercasuarinaN', 38, (x, z) => (z < centre(x) - halfWidth(x) - 5 ? 1 : 0)],
    ['riverlomandra', 170, (x, z) => { const bd = bankDist(x, z); return bd > 1.4 && bd < 11 && !nearWeir(x) ? patch(x, z, 0.09, 9) * (1 - pathAt(x, z)) * (nearLanding(x, z, 5.2) ? 0 : 0.9) : 0; }],
    ['riverreeds', 260, (x, z) => { const bd = bankDist(x, z); return bd > -1.1 && bd < 0.9 && !nearWeir(x) && !nearLanding(x, z, 8) ? patch(x, z, 0.13, 1) * 0.9 : 0; }],
    ['riverboulder', 90, (x, z) => { const bd = bankDist(x, z); return bd > -0.7 && bd < 2.6 && !nearWeir(x) && !nearLanding(x, z, 7) && pathAt(x, z) < 0.02 ? 0.3 + 0.5 * patch(x, z, 0.07, 5) : 0; }],
    ['riverpebbles', 150, (x, z) => { const bd = bankDist(x, z); return !nearWeir(x) && !nearLanding(x, z, 6) ? barAt(x, z) + (bd > -0.8 && bd < 1.2 ? 0.1 : 0) : 0; }],
    ['riverrock', 140, (x, z, h) => (h < 0 ? rockiness(x, z) : 0)],
    ['riverweed', 600, (x, z, h) => (h < -0.3 && h > -3 && rockiness(x, z) < 0.5 ? 1 : 0)],
  ],
  life: { australianbass: 10, carp: 10, shortfineel: 4 },
};
