// The Offshore Reef (site 4): out past the Belmore Basin lighthouse, in open blue water about 18 m deep over sand, with a patchy reef of ledges and bommies rising to 7 m. You fish from a boat that
// drifts slowly over the reef (or sits at anchor on sand: never on the reef). The boat's fish finder shows the depth, the bottom (hard reef or soft sand) and the fish as arches (fishing/sonar.js, ui/sonarUI.js).
// Spots (where the float lands): the reef (hard bottom), the reef edge (rubble and ledges) and the sand beside the reef. Deep fish (snapper, kingfish, morwong) can suffer barotrauma: bring the release weight.
// The boat is the walkable "land": its deck is a small moving rectangle (BOAT_DECK) and the walker is carried along with it every frame (tick). Opens with the Estuary spin rod (or better) and 8 species Identified.
import * as THREE from 'three';
import { makeNoise, smoothstep, lerp } from '../core/noise.js';
import { species as speciesInfo } from '../content/reef.js';
import { registerBehaviour } from '../life/life.js';
import { addGenerator } from '../world/reef.js';
import { rock } from '../world/coral.js';
import { globalUniforms } from '../ocean/shaders.js';
import { buildBoatModels, BOAT_DECK, DECK_Y } from '../world/boatModels.js';
import * as SONAR from '../fishing/sonar.js';
import { SonarPanel, howItWorksHTML } from '../ui/sonarUI.js';
import * as G from '../fishing/guide.js';
import '../fishing/fishLooks.js';

const noise = makeNoise(97);

// ---- the seabed (metres): a sand floor about 18 m down, two broken ridges and ten bommies of reef rising to about 7 m
/** The area the boat drifts over; leaving it means a motor back upwind for another drift. */
export const DRIFT_BOX = { xMin: -70, xMax: 70, zMin: -70, zMax: 70 };
const BOMMIES = [[-30, -24, 11, 1.0], [-6, 6, 9, 0.95], [22, -8, 12, 1.0], [46, 30, 10, 0.9], [-44, 26, 10, 0.9], [8, 40, 11, 1.0], [-20, -58, 9, 0.85], [58, -42, 10, 0.9], [-62, -4, 8, 0.85], [34, -52, 8, 0.8]];
const RIDGES = [[0.5, 6, 9, 13], [-0.35, -36, 7, 11]];   // z = a x + b + c sin(...): a broken line of reef, and how wide it is
/** 0..1: how much reef there is at (x, z). */
export function reefMask(x, z) {
  let m = 0;
  for (const [a, b, c, w] of RIDGES) {
    const d = Math.abs(z - (a * x + b + c * Math.sin(x * 0.045 + 1))) / w, n = noise.fbm2(x * 0.03 + 4, z * 0.03, 3);
    m = Math.max(m, (1 - smoothstep(0.3, 1, d)) * smoothstep(-0.4, 0.1, n));
  }
  for (const [bx, bz, r, k] of BOMMIES) { const d = Math.hypot(x - bx, z - bz) + noise.n2(x * 0.2, z * 0.2) * 1.6; m = Math.max(m, (1 - smoothstep(r * 0.35, r, d)) * k); }
  return m;
}
const floorAt = (x, z) => -19 - 2.2 * smoothstep(-70, 80, x) + noise.fbm2(x * 0.02, z * 0.02, 2) * 0.8;
export function heightAt(x, z) {
  const m = reefMask(x, z), t = m * m * (3 - 2 * m), terr = t + 0.08 * Math.sin(t * 16) * t * (1 - t);   // little ledges as it climbs
  const top = -8.4 + noise.fbm2(x * 0.08 + 9, z * 0.08, 2) * 1.2, f = floorAt(x, z);
  return f + (top - f) * terr + noise.fbm2(x * 0.5, z * 0.5, 2) * 0.14 * terr + noise.n2(x * 0.3, z * 0.3) * 0.05;
}
/** 0 (soft sand) .. 1 (hard reef): the rubble apron round the reef is in between. The sounder and the spot of a cast read it. */
export function hardAt(x, z) {
  const m = reefMask(x, z);
  return Math.min(1, 0.3 * smoothstep(0.02, 0.12, m) + 0.72 * smoothstep(0.2, 0.55, m));
}
export const depthAt = (x, z) => -heightAt(x, z);
export const reefiness = (x, z) => hardAt(x, z);
export function colorAt(x, z, h) {
  const m = reefMask(x, z), hard = hardAt(x, z), n = noise.n2(x * 0.5, z * 0.5), n2 = noise.n2(x * 0.09 + 3, z * 0.09);
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  let c = [0.9 + n * 0.03, 0.86 + n * 0.03, 0.72];                                      // pale sand
  c = mix3(c, [0.6, 0.56, 0.48], smoothstep(0.02, 0.2, m) * 0.7);                        // rubble round the foot
  if (hard > 0.3) {
    const rock = mix3([0.42, 0.34, 0.3], [0.5, 0.4, 0.32], n * 0.5 + 0.5);              // dark sandstone
    const kelp = [0.3, 0.42, 0.2], sponge = [0.86, 0.5, 0.26];
    let r = mix3(rock, kelp, smoothstep(-0.05, 0.4, n2) * smoothstep(-10, -7.5, h));     // kelp-green on the top
    r = mix3(r, sponge, smoothstep(0.45, 0.7, n) * 0.55 * smoothstep(-14, -9, h));       // orange sponge on the sides
    c = mix3(c, r, smoothstep(0.3, 0.7, hard));
  }
  return c;
}
/** The spot a cast belongs to (keys of SPOTS in fishing/catches.js): where the bait lands, by the bottom there. */
export function spotAt(px, pz, tx = px, tz = pz) {
  const h = hardAt(tx, tz);
  return h > 0.6 ? 'reef' : h > 0.25 ? 'reefedge' : 'reefsand';
}

/** The sounder's view of this site: deterministic from SEED. */
export const SEED = 97;
export const SITE = { seed: SEED, hardAt, depthAt };

// ---- the boat's state: a drifting boat over the reef, or at anchor on sand
export const START = { x: -52, z: -58 };
const DIR = new THREE.Vector2(0.62, 0.78).normalize();   // the drift heading (a gentle wind from the south-west)
export const driftSpeed = swell => 0.55 + 0.12 * Math.min(2.5, swell);
const S = { boat: null, x: START.x, z: START.z, vx: 0, vz: 0, anchored: false, t: 0, acc: 0, panel: null, line: null, rope: null, nDrift: 0, speed: 0, buoys: [], islands: null, fade: null, seen: new Set(), lastArch: 0, game: null };
export const state = S;
export function resetBoat() { Object.assign(S, { x: START.x, z: START.z, anchored: false, t: 0, acc: 0, nDrift: 0, speed: 0 }); }
/** Where you stand: the boat's deck is a walkable rectangle that moves with the boat. */
export const deckAt = (x, z) => (S.boat && Math.abs(x - S.x) <= BOAT_DECK.u && z >= S.z + BOAT_DECK.v0 && z <= S.z + BOAT_DECK.v1 ? DECK_Y : null);
/** The sounder's mark nearest your bait (for the bite model): the species showing right under it, or null. */
export const archAt = (x, z, t) => SONAR.fishNear(SITE, x, z, t, 8, 5);

registerBehaviour('bonito', { type: 'school', speed: 1.2, flee: 3, groupSize: 8, at: [-10, -8], spread: 60, y: -1.7 });
registerBehaviour('australiansalmon', { type: 'school', speed: 0.9, flee: 3, groupSize: 10, at: [14, 6], spread: 60, y: -1.4 });
addGenerator('reefrock', { fn: rock, variants: 3, scale: [1.4, 3.0], radius: 1.4, sink: 0.4, rough: 0.95, bleaches: false, as: 'boulder', soft: true });

/**
 * The Five Islands off Port Kembla, and the Port Kembla coast behind them. The islands are a chain of small rocky islands running north-west to south-east about 1 to 2 km
 * off the coast (Big Island, the largest, is flat-topped and grassy; the others are low rocky islets), each ringed by white surf. They are scaled in to a few hundred metres so
 * the boat sits among them. The coast is to the WEST: Hill 60 and the beach, the steelworks (stacks and sheds), the long outer-harbour breakwater running out to the north-east,
 * and the escarpment behind, all hazy with distance. Real arrangement from a satellite view (north up): see the notes in docs/specs.
 * [x, z, radius, height, flat-topped]  (north is -z, west is -x)
 */
export const FIVE_ISLANDS = [
  { name: 'Big Island', x: -230, z: -345, r: 78, h: 27, flat: true },
  { name: 'Rabbit Island', x: -130, z: -268, r: 24, h: 12 },
  { name: 'Martin Island', x: -62, z: -208, r: 19, h: 9 },
  { name: 'Bass Rock', x: 22, z: -158, r: 11, h: 5.5 },
  { name: 'Little Island', x: -318, z: -300, r: 15, h: 8 },
];
function makeIslands(scene) {
  const grp = new THREE.Group(), nz = makeNoise(5);
  const std = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true, fog: true });
  const flat = (r, c) => new THREE.MeshBasicMaterial({ color: c, fog: true });
  const col = (geo, fn) => { const p = geo.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = k[0]; c[i * 3 + 1] = k[1]; c[i * 3 + 2] = k[2]; } geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; };
  for (const I of FIVE_ISLANDS) {
    // a stepped, craggy lump: a tapering drum with a noisy outline, cliffs warm brown-grey, a grassy top, a darker wet band at the waterline
    const geo = new THREE.CylinderGeometry(I.r * (I.flat ? 0.8 : 0.5), I.r * 1.25, I.h + 4, 30, 7);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.22 * nz.n2(Math.cos(a) * 2.2 + I.x * 0.01, Math.sin(a) * 2.2 + I.z * 0.01) + 0.07 * nz.n2(x * 0.15, z * 0.15);
      p.setXYZ(i, x * k, y + (I.flat ? 0 : nz.n2(x * 0.1, z * 0.1) * I.h * 0.15), z * k);
    }
    geo.translate(0, (I.h + 4) / 2 - 4, 0); geo.computeVertexNormals();
    col(geo, (x, y, z) => {
      const n = nz.n2(x * 0.2, z * 0.2) * 0.06, top = y > I.h * (I.flat ? 0.93 : 0.8), wet = y < 0.8;
      if (top) return [0.5 + n, 0.62 + n, 0.3];                                       // grass and scrub
      if (wet) return [0.28, 0.3, 0.3];                                               // dark, wet, weed-streaked rock
      const t = Math.min(1, y / I.h);
      return [0.62 - t * 0.08 + n, 0.5 - t * 0.04 + n, 0.38 + n];                     // sandstone cliffs, a little paler below
    });
    const m = new THREE.Mesh(geo, std); m.position.set(I.x, 0, I.z); m.userData.noShadow = true; grp.add(m);
    // surf: a pale foam ring where the swell breaks on the rocks
    const ring = new THREE.Mesh(new THREE.RingGeometry(I.r * 0.95, I.r * 1.55, 36, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.38, depthWrite: false, fog: true }));
    ring.position.set(0, 0.06, 0); ring.userData.noShadow = true; m.add(ring);
  }
  // ---- the Port Kembla coast, far to the west: low land, Hill 60, the steelworks, the long breakwater, the escarpment (flat, hazy colours); its own group, S.coast
  const coast = new THREE.Group();
  const land = new THREE.Mesh(new THREE.BoxGeometry(700, 8, 2000), flat(1, 0x7d8f70)); land.position.set(-1360, -1, -150); coast.add(land);
  const beach = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 760), flat(1, 0xd9cfa8)); beach.position.set(-1006, 0.4, 70); coast.add(beach);
  const hill = new THREE.Mesh(new THREE.SphereGeometry(150, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.26, 1), flat(1, 0x6f8a62)); hill.position.set(-1090, 2, -260); coast.add(hill);
  const mount = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.13, 0.9), flat(1, 0x5f7a78)); mount.position.set(-1900, 0, -100); coast.add(mount);   // the escarpment
  const works = new THREE.Group(); works.position.set(-1090, 3, -640); coast.add(works);
  for (let i = 0; i < 7; i++) {   // sheds
    const w = 60 + (i % 3) * 25, h = 22 + (i * 7) % 18, shed = new THREE.Mesh(new THREE.BoxGeometry(w, h, 34), flat(1, i % 2 ? 0x8a8f94 : 0x9a8b7e)); shed.position.set(-30 - (i % 3) * 20, h / 2, i * 52 - 150); works.add(shed);
  }
  for (const [x, z, r, h, c] of [[-44, -140, 4.5, 85, 0x8d8d90], [-30, -96, 5.5, 100, 0x9a9a9d], [-52, -40, 4, 70, 0x8d8d90], [-24, 6, 9, 55, 0x94836f], [-62, 44, 5, 80, 0x9a9a9d], [-40, 110, 3.6, 62, 0x8d8d90]]) {
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, h, 10), flat(1, c)); stack.position.set(x, h / 2, z); works.add(stack);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.8, 5, 10), flat(1, 0xb8553c)); band.position.set(x, h - 8, z); works.add(band);
  }
  const bw = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 560), flat(1, 0x8c8b84)); bw.position.set(-870, 0.5, -780); bw.rotation.y = -0.7; coast.add(bw);   // the outer-harbour breakwater, running out to the north-east
  const bw2 = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 380), flat(1, 0x8c8b84)); bw2.position.set(-1010, 0.5, -500); bw2.rotation.y = 0.15; coast.add(bw2);
  coast.traverse(o => { if (o.isMesh) o.userData.noShadow = true; });
  scene.add(coast); S.coast = coast;
  grp.traverse(o => { if (o.isMesh) o.userData.noShadow = true; });
  scene.add(grp); return grp;
}

function undecorate(world) {
  S.panel?.dispose(); S.panel = null;
  for (const k of ['islands', 'coast']) if (S[k]) { S[k].parent?.remove(S[k]); S[k].traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); S[k] = null; }
  if (S.rope) { S.rope.parent?.remove(S.rope); S.rope.geometry.dispose(); S.rope.material.dispose(); S.rope = null; }
  S.fade?.remove(); S.fade = null; S.boat = null; S.game = null;
}

function decorate(world) {
  undecorate(world); resetBoat();
  for (const [k, g] of buildBoatModels()) world.models.set(k, g);
  const pr = world.props;
  S.boat = pr.place('player_boat', S.x, S.z, { y: 0, rot: 0 });
  // a few marker buoys on the reef (the sort of thing a chartplotter waypoint stands for)
  S.buoys = [[-36, -14], [40, 8], [-6, 56], [60, -20]].map(([x, z], i) => { const b = pr.place('marker_buoy', x, z, { float: true }); if (b) pr.floater(b, 0.05); return b; });
  S.islands = makeIslands(world.scene);
}

/** B: put the anchor down or lift it. Never on the reef: a hard bottom means drift instead. Returns { ok, anchored, reason }. */
export function toggleAnchor(game) {
  if (S.anchored) { S.anchored = false; game.toast('Anchor up. The boat drifts again.', 'good'); setRope(game, false); return { ok: true, anchored: false }; }
  const hard = hardAt(S.x, S.z);
  if (hard > 0.35) {
    const msg = hard > 0.6 ? 'That is hard reef. An anchor would snag and tear the reef up, so we drift over reef instead. Find sand beside it to anchor.' : 'Rubble and ledges: too close to the reef to anchor safely. Drift, or move onto open sand.';
    game.toast(msg, 'warn'); return { ok: false, anchored: false, reason: msg };
  }
  S.anchored = true; setRope(game, true);
  game.toast('Anchor down on sand, well clear of the reef. The boat holds here: drop your bait and watch the fish finder for marks that move in.', 'good');
  return { ok: true, anchored: true };
}
function setRope(game, on) {
  if (S.rope) { S.rope.parent?.remove(S.rope); S.rope.geometry.dispose(); S.rope.material.dispose(); S.rope = null; }
  if (!on) return;
  const bx = S.x, bz = S.z + BOAT_DECK.v0 - 2.2, gy = depthAt(bx, bz), len = Math.hypot(gy, 6);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 5), new THREE.MeshBasicMaterial({ color: 0xd9c28a, fog: true }));
  m.position.set(bx, -gy / 2 + 0.3, bz - 3); m.rotation.x = Math.atan2(6, gy); m.userData.noShadow = true; game.scene.add(m); S.rope = m;
}

/** A short fade to hide the boat motoring back upwind for another drift. */
function fadeBlink(game, mid) {
  const el = S.fade ??= (() => { const d = document.createElement('div'); d.className = 'fade-blink'; d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d); return d; })();
  el.classList.add('on');
  setTimeout(() => { mid(); }, 450);
  setTimeout(() => el.classList.remove('on'), 650);
}
/** Motor back up-wind for the next drift (each drift is a slightly different line). */
export function nextDrift(game, instant = false) {
  S.nDrift++;
  const k = S.nDrift % 4, off = [0, 26, -26, 13][k];
  const go = () => {
    if (!instant && ['bite', 'fight', 'landed', 'snagged', 'flying'].includes(game.fishing.state)) return;   // a fish took the bait during the fade: stay on this drift (the next tick asks again)
    game.toast('You motored back up to the start of another drift.', 'good');
    const nx = START.x + off * 0.78, nz = START.z - off * 0.62, dx = nx - S.x, dz = nz - S.z;
    S.x = nx; S.z = nz; game.walker.pos.x += dx; game.walker.pos.z += dz; game.rig.focus.x += dx; game.rig.focus.z += dz;
    game.fishing.float.visible = false; game.fishing.hideShadow?.(); if (game.fishing.active && game.fishing.state !== 'off') game.fishing.state = 'ready';
    placeBoat(game);
  };
  if (instant) go(); else fadeBlink(game, go);
}
function placeBoat(game) {
  S.boat?.position.set(S.x, 0, S.z);
  const L = game.eco.land; if (L) { L.bounds.xMin = S.x - BOAT_DECK.u + 0.15; L.bounds.xMax = S.x + BOAT_DECK.u - 0.15; L.bounds.zMin = S.z + BOAT_DECK.v0 + 0.1; L.bounds.zMax = S.z + BOAT_DECK.v1 - 0.15; }
}

/** Every frame (land mode and the title): drift the boat, carry the angler and the bait with it, and ping the sounder. */
function tick(game, dt) {
  if (!S.boat) return;
  S.game = game;
  const land = game.mode === 'land', w = game.walker;
  let dx = 0, dz = 0;
  if (land) {
    S.t += dt;
    if (S.anchored) { dx = Math.cos(S.t * 0.5) * 0.04 * dt; dz = Math.sin(S.t * 0.4) * 0.03 * dt; S.speed = 0; }
    else { const sp = driftSpeed(game.cond.swell); dx = DIR.x * sp * dt; dz = DIR.y * sp * dt; S.speed = sp; }
    S.x += dx; S.z += dz; w.pos.x += dx; w.pos.z += dz;
    if (!S.anchored && (S.x > DRIFT_BOX.xMax || S.z > DRIFT_BOX.zMax) && !S.fadeing && ['off', 'ready', 'wait', 'retrieve'].includes(game.fishing.state)) { S.fadeing = true; nextDrift(game); setTimeout(() => { S.fadeing = false; }, 900); }   // (never motor off with a fish on)
  }
  game.carry = { x: dx, z: dz };
  placeBoat(game);
  if (!S.panel) S.panel = new SonarPanel({ onHelp: () => showHowItWorks(game), onAnchor: () => toggleAnchor(game) });
  S.panel.show(land);
  if (!land) return;
  S.acc += dt;
  let p = null;
  while (S.acc >= 0.2) { S.acc -= 0.2; p = SONAR.ping(SITE, S.x, S.z, S.t); S.panel.push(p); }
  if (p) {
    S.panel.readout({ ping: p, anchored: S.anchored, speed: S.speed });
    // a mark straight under the boat counts as Seen in the Fish Guide (silhouette and where-and-when hint)
    for (const f of p.fish) if (f.under && !S.seen.has(f.id) && G.markSeen(game.progress, f.id, 'fishfinder')) {
      S.seen.add(f.id); game.persist();
      game.toast('📗 A strong mark passed right under the boat. It is in your Fish Guide as Seen: check the Guide (J) for where and when to find it.', 'good');
    }
  }
  S.last = p ?? S.last;
}
export function showHowItWorks(game) {
  game.panels.open(howItWorksHTML());
  game.panels.body.querySelector('#sn-ok').onclick = () => { game.panels.close(); (game.progress.tips ??= {}).sonar = true; game.persist(); };
}

export const reef = {
  id: 'reef',
  name: 'Offshore reef',
  place: 'Off Port Kembla, NSW (by boat)',
  blurb: 'Out past the lighthouse in a boat with a fish finder: open blue water about 20 m deep, with ledges and bommies of reef rising to about 8 m. Snapper, morwong and kingfish, and barotrauma to think about.',
  unlock: { type: 'all', label: 'Own the Estuary spin rod (or better) and Identify 8 species', parts: [{ type: 'rod', minTier: 2, short: 'Estuary spin rod or better' }, { type: 'identifiedCount', n: 8, short: '8 species Identified' }] },
  travel: true,   // Start fishing here runs the boat-trip scene first (ui/boatTrip.js): lifejackets and a trip log, then the run out of Belmore Basin
  terrainSize: 320, terrainSegments: 256, seabedKind: 'sand', ripple: 0.2, seed: SEED, rocks: 0,
  heightAt, colorAt, reefiness, deckAt, decorate, undecorate, tick, depthAt, archAt, hardAt,
  toggleAnchor, state: S,
  bounds: { xMin: -70, xMax: 70, zMin: -70, zMax: 70 },   // where the underwater life and reef plants are placed
  calm: 0.2,
  daylight: true,
  shoalDepth: [7, 40],   // the dark silhouettes of fish near the surface show in any deep water here
  water: {
    shafts: 0, exposure: 1.0, clear: 32, haze: 0.014,
    absorb: [0.09, 0.03, 0.02], fog: 0x1b79b8, fogDeep: 0x0b3f7a, fogDensity: 0.05,
    shallow: 0x3ccaee, mid: 0x1f93d8, deep: 0x0f5cac, fogDepthScale: 10,
    skyTop: 0x2a74d6, skyHorizon: 0xcfe6f4, sun: [0.5, 0.66, -0.4], sunIntensity: 2.4, sunColor: 0xfff0d2,
    hemiSky: 0xcfe6f6, hemiGround: 0x3a6a8a,
  },
  sound: { wash: 0.2, wind: 0.5, shrimp: 0, gulls: 0.4 },
  menuCam: { yaw: 0.2, swing: 0.25, pitch: 0.34, dist: 15, lift: 1.4 },   // a low title camera so the Five Islands show on the horizon
  fishing: { spotAt },
  land: {
    spawn: { x: START.x, z: START.z + 1.2, yaw: 0 },
    bounds: { xMin: START.x - 0.85, xMax: START.x + 0.85, zMin: START.z + BOAT_DECK.v0, zMax: START.z + BOAT_DECK.v1 },   // follows the boat (placeBoat)
    intro: 'You are on the boat, out past the lighthouse. Read the fish finder (bottom left): a thick bright line is hard reef, marks are fish, arches are single fish. Press R for your rod, T for the tackle box (paternoster on the bottom for reef fish), and B to anchor on sand. Never anchor on the reef: we drift over it. Tap the ? on the fish finder to learn how it works.',
    life: {}, zones: {}, flyingGulls: 3, gullCircle: { x: START.x + 14, z: START.z + 12 },
    home: { x: START.x, z: START.z + 2, r: 99999, label: 'the boat' },
  },
  treeShadows: {},
  cosyModels: {
    url: 'assets/models/rocky_cosy.glb',
    coral: { kelp: ['kelp_0', 'kelp_1', 'kelp_2', 'kelp_3'], fingersponge: ['fingersponge_0', 'fingersponge_1'], vasesponge: ['vasesponge_0', 'vasesponge_1'], reefrock: ['boulder_0', 'boulder_1', 'boulder_2'], boulder: ['boulder_0', 'boulder_1', 'boulder_2'] },
    statics: {},
  },
  speciesInfo,
  placers: {},
  coral: [
    ['kelp', 900, (x, z, h) => (hardAt(x, z) > 0.5 && h > -13 ? 1 : 0.0)],
    ['fingersponge', 150, (x, z, h) => (hardAt(x, z) > 0.4 ? 1 : 0.03)],
    ['vasesponge', 90, (x, z, h) => (hardAt(x, z) > 0.4 ? 1 : 0.02)],
    ['reefrock', 160, (x, z) => (hardAt(x, z) > 0.25 ? 1 : 0.02)],
  ],
  life: { bonito: 12, australiansalmon: 14, yakka: 28, slimymackerel: 16, snapper: 6, redmorwong: 6, jackassmorwong: 4, silvertrevally: 6, bluegroper: 2 },
};
