// A lived-in coast: rows of chunky cosy houses and terraces behind the beaches, built in code (propKit) and merged into a few vertex-coloured meshes, so a site
// reads as a town by the sea rather than a strip of sand in front of a green plain. Nothing is copied from any real building: the shapes are generic Illawarra
// weatherboard cottages and brick flats (gable or hip roofs, a verandah, a chimney, a water tank, a fence), in pastel art-bible colours.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';
import { box, cyl, part, finish } from './propKit.js';

const WALLS = [0xf4ecd8, 0xe9dcc2, 0xcfe3e8, 0xd9e6cf, 0xf1d8c6, 0xfaf3e6, 0xe2d4e8, 0xd7c4a6];
const ROOFS = [0xb9553c, 0x8a8f94, 0x4f6f63, 0x9a4a3a, 0x6b7f99, 0xa8694a, 0xc26a4a];
const TRIM = 0xfffaf0, GLASS = 0x6c9ab0, DOOR = [0x2f5f6b, 0xc2570a, 0x7a4d2e, 0x3d6b4f];
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

/** A gable roof: a triangular prism `w` wide (across the ridge), `d` long (along the ridge, local z), `h` tall, sitting on y = 0 at the eaves. */
function gable(w, d, h, hex, x = 0, y = 0, z = 0) {
  const L = [-w / 2, 0, -d / 2], R = [w / 2, 0, -d / 2], T0 = [0, h, -d / 2], L1 = [-w / 2, 0, d / 2], R1 = [w / 2, 0, d / 2], T1 = [0, h, d / 2];
  const tri = (...pts) => pts.flat();
  const pos = [
    ...tri(T0, L, R), ...tri(T1, R1, L1),                      // the two gable ends
    ...tri(L, T0, T1), ...tri(L, T1, L1),                      // left slope
    ...tri(R, T1, T0), ...tri(R, R1, T1),                      // right slope
    ...tri(L, L1, R), ...tri(R, L1, R1),                       // underside (eaves seen from below)
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return part(g, hex, x, y, z);
}
/** A hip roof: a flattened pyramid with a short ridge. */
function hip(w, d, h, hex, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * 0.12, p.getY(i), p.getZ(i) * 0.6);   // the top face shrinks to a ridge
  g.computeVertexNormals();
  return part(g, hex, x, y + h / 2, z);
}
/** A single-storey cottage facing +z: walls, roof, verandah, windows, door, chimney, tank. Sits on y = 0 with a plinth below so it never floats on a slope. */
export function cottage(seed) {
  const rnd = mulberry32(seed), w = 7 + rnd() * 2.5, d = 6 + rnd() * 2.5, h = 2.9, wall = pick(rnd, WALLS), roof = pick(rnd, ROOFS), P = [];
  P.push(box(w, h + 0.8, d, wall, 0, h / 2 - 0.4, 0));                                            // walls (0.8 m plinth below ground)
  const hipped = rnd() < 0.4, rh = 1.3 + rnd() * 0.5;
  P.push(hipped ? hip(w + 0.9, d + 0.9, rh, roof, 0, h) : gable(w + 0.9, d + 0.6, rh, roof, 0, h, 0));
  if (!hipped) P.push(box(w * 0.98, 0.001 + rh, 0.12, wall, 0, h, 0), box(0.1, rh * 0.7, 0.1, wall, 0, h, 0));   // keep the gable end closed against the sky
  // verandah along the front (+z): a lean-to roof on posts, a step
  const vd = 1.8;
  P.push(box(w, 0.1, vd, roof, 0, h - 0.45, d / 2 + vd / 2));
  for (const px of [-w / 2 + 0.3, 0, w / 2 - 0.3]) P.push(cyl(0.07, 0.07, h - 0.5, TRIM, px, (h - 0.5) / 2, d / 2 + vd - 0.2, 6));
  P.push(box(w, 0.12, vd, 0xd9c7a5, 0, 0.12, d / 2 + vd / 2));
  // front door and windows
  const dx = (rnd() - 0.5) * w * 0.4;
  P.push(box(0.9, 2.0, 0.08, pick(rnd, DOOR), dx, 1.05, d / 2 + 0.05));
  for (const px of [dx - w * 0.3, dx + w * 0.3]) P.push(box(1.2, 1.1, 0.08, GLASS, px, 1.6, d / 2 + 0.05), box(1.35, 1.25, 0.05, TRIM, px, 1.6, d / 2 + 0.03));
  for (const sd of [-1, 1]) for (const pz of [-d * 0.25, d * 0.2]) P.push(box(0.08, 1.0, 1.1, GLASS, sd * (w / 2 + 0.05), 1.6, pz), box(0.05, 1.15, 1.25, TRIM, sd * (w / 2 + 0.03), 1.6, pz));
  // chimney and a corrugated water tank at the back
  if (rnd() < 0.6) P.push(box(0.6, 1.6, 0.6, 0xa5705a, -w * 0.3, h + 0.9, -d * 0.15));
  if (rnd() < 0.5) P.push(cyl(0.7, 0.7, 1.7, 0x9aa5a8, w / 2 + 1.0, 0.85, -d * 0.3, 10));
  return finish(P, 0.22);
}
/** A two-storey brick block of flats or a terrace facing +z: balconies, a flat parapet roof. */
export function flats(seed) {
  const rnd = mulberry32(seed), w = 9 + rnd() * 3, d = 8 + rnd() * 2, h = 6.2, wall = pick(rnd, [0xd7b8a0, 0xe3cdb6, 0xf0e4d0, 0xc9b3a6, 0xdfd3c0]), P = [];
  P.push(box(w, h + 0.8, d, wall, 0, h / 2 - 0.4, 0));
  P.push(box(w + 0.3, 0.35, d + 0.3, pick(rnd, ROOFS), 0, h + 0.1, 0));
  for (let lvl = 0; lvl < 2; lvl++) {
    const y = 0.5 + lvl * 3.0;
    for (let i = 0; i < 3; i++) {
      const px = (i - 1) * w * 0.3;
      P.push(box(1.5, 1.3, 0.08, GLASS, px, y + 1.5, d / 2 + 0.05), box(1.65, 1.45, 0.05, TRIM, px, y + 1.5, d / 2 + 0.03));
    }
    if (lvl === 1) { P.push(box(w * 0.7, 0.14, 1.3, 0xe9e2d2, 0, y - 0.1, d / 2 + 0.65), box(w * 0.7, 0.9, 0.08, 0x8ea8b4, 0, y + 0.4, d / 2 + 1.3)); }   // a balcony with a rail
  }
  P.push(box(1.0, 2.2, 0.08, pick(rnd, DOOR), -w * 0.35, 1.15, d / 2 + 0.05));
  return finish(P, 0.22);
}
/** A low paling fence `len` long along local x. */
function fence(len, seed) {
  const rnd = mulberry32(seed), P = [], col = pick(rnd, [0xf4efe2, 0xcfc3a8, 0xa8b4a0]);
  P.push(box(len, 0.06, 0.05, col, 0, 0.75, 0), box(len, 0.06, 0.05, col, 0, 0.35, 0));
  for (let x = -len / 2; x <= len / 2; x += 0.42) P.push(box(0.14, 0.95, 0.03, col, x, 0.48, 0.03));
  return finish(P, 0.2);
}

/**
 * Lay a row (or two) of buildings along a band of distance-from-the-water. `dist(x, z)` is positive on land; buildings go where dist is within `band`, facing the water.
 * `accept(x, z)` vetoes a spot. Buildings are merged into one mesh per 20 and get a collider each. Returns the placed lots [{ x, z, rot }].
 */
export function layTown(world, { bounds, dist, band, spacing = 11, accept = () => true, kind = () => 'cottage', seed = 7, fences = true }) {
  const pr = world.props, T = world.terrain, rnd = mulberry32(seed), lots = [], geos = [], fen = [];
  const step = 2.5;
  for (let z = bounds.zMin; z <= bounds.zMax; z += step) for (let x = bounds.xMin; x <= bounds.xMax; x += step) {
    const d = dist(x, z); if (d < band[0] || d > band[1] || !accept(x, z)) continue;
    const jx = x + (rnd() - 0.5) * 1.5, jz = z + (rnd() - 0.5) * 1.5;
    if (lots.some(l => Math.hypot(l.x - jx, l.z - jz) < spacing)) continue;
    // face the water: down the gradient of dist
    const gx = dist(jx + 1, jz) - dist(jx - 1, jz), gz = dist(jx, jz + 1) - dist(jx, jz - 1);
    const rot = Math.atan2(-gx, -gz);
    lots.push({ x: jx, z: jz, rot });
  }
  const add = list => { if (list.length) { const m = new THREE.Mesh(mergeGeometries(list), pr.mat); m.userData.prop = 'town'; m.castShadow = m.receiveShadow = true; pr.group.add(m); } };
  lots.forEach((l, i) => {
    const k = kind(l.x, l.z, i), g = k === 'flats' ? flats(seed * 31 + i) : cottage(seed * 17 + i);
    // settle on the lowest of the footprint corners so the plinth hides the slope
    let y = Infinity; for (const [ox, oz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) y = Math.min(y, T.heightAt(l.x + ox, l.z + oz));
    g.rotateY(l.rot); g.translate(l.x, y + 0.05, l.z); geos.push(g);
    world.addCollider(l.x, y + 1.5, l.z, k === 'flats' ? 6 : 4.6);
    pr.blobs.push({ x: l.x, z: l.z, y, r: k === 'flats' ? 7.5 : 6.2, tall: 7 });
    if (fences && rnd() < 0.7) { const f = fence(9 + rnd() * 2, seed + i); const fx = l.x + Math.sin(l.rot) * 6.2, fz = l.z + Math.cos(l.rot) * 6.2; f.rotateY(l.rot); f.translate(fx, T.heightAt(fx, fz), fz); fen.push(f); }
    if (geos.length >= 20) { add(geos.splice(0)); }
  });
  add(geos); add(fen);
  return lots;
}
