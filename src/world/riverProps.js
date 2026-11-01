// The river's built and fallen things, made in code (world/propKit.js): snag logs half-sunk in the water, a weir hand-rail, a licence noticeboard and a row of stepping stones.
// buildRiverModels() returns Map(name -> BufferGeometry); every model sits on y = 0.
import * as THREE from 'three';
import { box, cyl, ball, cone, part, finish, rockGeo, tube } from './propKit.js';
import { mulberry32 } from '../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const rgb = (r, g, b) => new THREE.Color().setRGB(Math.min(1, r), Math.min(1, g), Math.min(1, b));
const lerpC = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));

/**
 * A gnarly fallen river tree, half sunk, lying along x: a ridged, fissured trunk (bark crests and dark furrows, silvery on top, green algae underneath), a flared root plate at the -x end
 * (buttress roots, tangled root fingers, soil clods and a disc of earth), snapped limbs with pale broken ends and dead twigs. About 4 to 6 m long; the trunk axis is just above y = 0.
 */
function snagLog(variant) {
  const rnd = mulberry32(900 + variant * 77), P = [];
  const L = [5.4, 4.3, 6.3][variant], cy = 0.12, N = 12, R0 = [0.52, 0.46, 0.42][variant], xb = -L / 2;
  const barkAt = (u, v) => {
    const j = Math.floor(v * N), a = (j / N) * Math.PI * 2, top = -Math.sin(a), hj = hash(j * 3.7 + variant * 5), hp = hash(j * 1.3 + Math.floor(u * 5) * 4.1 + variant);
    let c = j % 2 === 0 ? [0.58, 0.45, 0.33] : [0.34, 0.24, 0.17];
    const k = 0.84 + hj * 0.2 + 0.1 * Math.sin(u * 9 + j * 2.1); c = [c[0] * k, c[1] * k, c[2] * k];
    c = lerpC(c, [0.8, 0.72, 0.6], Math.max(0, top - 0.05) * 0.6 * (0.5 + hp));                 // sun-bleached silver on top
    c = lerpC(c, [0.34, 0.44, 0.24], Math.max(0, -top - 0.3) * 0.9 * (0.3 + hp * 0.7));        // green algae and moss below
    if (hp > 0.86 && top > -0.2) c = lerpC(c, [0.6, 0.64, 0.5], 0.7);                            // a patch of grey-green lichen
    if (u < 0.1) c = lerpC(c, [0.4, 0.29, 0.2], 0.5);                                            // earth worked into the root end
    return rgb(c[0], c[1], c[2]);
  };
  const ridge = (u, j) => (j % 2 ? 0.88 : 1.08) * (1 + 0.06 * Math.sin(u * 23 + j * 1.7)) * (1 + (u < 0.14 ? (0.14 - u) / 0.14 * 0.55 : 0)) * (1 + 0.1 * Math.max(0, Math.sin(u * 9 + variant * 2 + j * 0.4) - 0.8) * 5);
  const trunkPts = [], radii = [], M = 22;
  for (let i = 0; i <= M; i++) { const t = i / M; trunkPts.push(V(xb + L * t, cy + 0.1 * Math.sin(t * 3 + variant), 0.2 * Math.sin(t * 2.4 + variant * 2))); radii.push(R0 * (1 - 0.46 * t) * (1 + 0.05 * Math.sin(t * 17))); }
  P.push(tube(trunkPts, radii, N, barkAt, { ridge, cap: 0xe3cf9f }));
  const end = trunkPts[M];
  for (let i = 0; i < 5; i++) { const a = i * 1.26 + rnd(); P.push(part(new THREE.ConeGeometry(0.06, 0.4 + rnd() * 0.35, 4), 0xe3cf9f, end.x + 0.04, end.y + Math.cos(a) * radii[M] * 0.7, end.z + Math.sin(a) * radii[M] * 0.7, 0, 0, -Math.PI / 2 + (rnd() - 0.5) * 0.5)); }   // splintered end
  // root plate: a disc of earth with buttress roots and tangled fingers
  const rootC = a => lerpC([0.4, 0.3, 0.22], [0.5, 0.4, 0.3], a);
  const roots = 7 + variant;
  for (let k = 0; k < roots; k++) {
    const phi = (k / roots) * Math.PI * 2 + rnd() * 0.5, cu = Math.cos(phi), sn = Math.sin(phi), reach = 1.25 + rnd() * 0.7, droop = cu < 0 ? 0.35 : 0.1;
    const pts = [V(xb + 0.55, cy + cu * 0.32, sn * 0.32), V(xb + 0.05, cy + cu * reach * 0.45, sn * reach * 0.45), V(xb - 0.4, cy + cu * reach * 0.8 - droop * 0.3, sn * reach * 0.8), V(xb - 0.8 - rnd() * 0.2, cy + cu * reach - droop, sn * reach)];
    P.push(tube(pts, [0.24, 0.17, 0.1, 0.045], 6, (u, v) => { const c = rootC(u * 0.8 + hash(k + v * 9) * 0.3); return rgb(c[0], c[1], c[2]); }, { ridge: (u, j) => (j % 2 ? 0.9 : 1.08) }));
    for (let f = 0; f < 2; f++) {                                                                   // thin tangled root fingers off each root
      const p2 = pts[2 + f * 0], d = V(rnd() - 0.5, (rnd() - 0.6) * 0.9, rnd() - 0.5).normalize().multiplyScalar(0.45 + rnd() * 0.4);
      P.push(tube([p2.clone(), p2.clone().add(d.clone().multiplyScalar(0.5)).add(V(0, -0.05, 0.06 * (f ? 1 : -1))), p2.clone().add(d)], [0.05, 0.03, 0.011], 4, () => rgb(0.38, 0.29, 0.22)));
    }
  }
  const soil = (r, sx, sy, sz, x, y, z, seed) => { const g = rockGeo(new THREE.IcosahedronGeometry(r, 1), (px, py, pz) => { const h = 0.8 + hash(px * 9.1 + py * 5.3 + pz * 7.7 + seed) * 0.5; return [px * sx * h, py * sy * h, pz * sz * h]; }, (y01, nx, ny) => { const h = hash(y01 * 11 + nx * 5 + seed); return new THREE.Color().setRGB(0.34 + h * 0.12 + 0.06 * Math.max(0, ny), 0.26 + h * 0.08, 0.19 + h * 0.05); }); g.translate(x, y, z); return g; };
  P.push(soil(0.8, 0.5, 1.0, 1.0, xb - 0.15, cy + 0.05, 0, 3));                                      // the plate of earth held by the roots
  for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, d = 0.7 + rnd() * 0.7; P.push(soil(0.12 + rnd() * 0.14, 1.2, 0.9, 1, xb - 0.2 - rnd() * 0.5, cy + Math.cos(a) * d * 0.8, Math.sin(a) * d, 7 + i)); }
  // snapped limbs and dead twigs
  const limbs = 3 + variant;
  for (let i = 0; i < limbs; i++) {
    const t = 0.18 + (i + rnd() * 0.6) / limbs * 0.7, c = trunkPts[Math.round(t * M)], r = radii[Math.round(t * M)], side = i % 2 ? 1 : -1;
    const dir = V((rnd() - 0.5) * 0.7, 0.75 + rnd() * 0.5, side * (0.4 + rnd() * 0.5)).normalize(), len = 0.7 + rnd() * (variant === 1 && i === 0 ? 2.0 : 0.8);
    const a = c.clone().addScaledVector(dir, r * 0.7), m = a.clone().addScaledVector(dir, len * 0.5).add(V(0, 0.05, 0)), b = a.clone().addScaledVector(dir, len);
    P.push(tube([a, m, b], [0.13, 0.1, 0.07], 6, (u, v) => { const j = Math.floor(v * 6); const c2 = j % 2 ? [0.52, 0.43, 0.33] : [0.34, 0.26, 0.2]; return rgb(c2[0], c2[1], c2[2]); }, { cap: 0xe9d6a8, ridge: (u, j) => (j % 2 ? 0.9 : 1.08) }));
    for (let s = 0; s < 2; s++) { const base = a.clone().lerp(b, 0.45 + s * 0.3), d2 = dir.clone().add(V((rnd() - 0.5) * 1.4, (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 1.4)).normalize(), l2 = 0.5 + rnd() * 0.5; P.push(tube([base, base.clone().addScaledVector(d2, l2 * 0.55), base.clone().addScaledVector(d2, l2).add(V(0, -0.08, 0))], [0.04, 0.028, 0.01], 4, () => rgb(0.46, 0.4, 0.33))); }
  }
  return finish(P, 0.2);
}
/** A short stretch of low steel hand-rail on posts, for the weir walkway (4 m long along x). */
function weirRail() {
  const p = [];
  for (let i = 0; i <= 2; i++) p.push(cyl(0.05, 0.05, 1.05, 0xdfe5e8, -2 + i * 2, 0.52, 0, 6));
  p.push(box(4.0, 0.05, 0.05, 0xdfe5e8, 0, 1.02, 0), box(4.0, 0.04, 0.04, 0xdfe5e8, 0, 0.62, 0));
  return finish(p, 0.2);
}
/** A timber noticeboard on two posts (the board's face is blank: the site paints a canvas over it). 2.4 m wide, face toward +z. */
function noticeBoard() {
  const p = [cyl(0.09, 0.1, 2.3, 0x6b4a30, -1.0, 1.15, 0, 7), cyl(0.09, 0.1, 2.3, 0x6b4a30, 1.0, 1.15, 0, 7), box(2.5, 1.35, 0.1, 0xb88a58, 0, 1.75, 0), box(2.64, 0.1, 0.18, 0x7a5532, 0, 2.48, 0), box(2.64, 0.1, 0.16, 0x7a5532, 0, 1.05, 0.0)];
  return finish(p, 0.18);
}
/** A flat-topped stepping stone, grey-brown and angular. */
function steppingStone(variant) {
  const g = rockGeo(new THREE.DodecahedronGeometry(0.55, 0), (x, y, z) => [x * (1.2 + 0.2 * variant), y * 0.55, z * 1.05], (y01, nx, ny) => new THREE.Color().setRGB((0.5 + 0.12 * Math.max(0, ny)) * 0.9, 0.48 * 0.9 + 0.08 * Math.max(0, ny), 0.42 * 0.9));
  g.translate(0, -g.boundingBox.min.y, 0);
  return finish([g], 0.14);
}
// ---- the weir: stepped, weathered concrete. Local frame: x downstream from the crest centre, z across the river from its middle, y absolute (the water is y = 0). Shared with the terrain and the walkable deck.
export const WEIR_STEPS = [          // [x0, x1, top]: the crest, then three treads stepping down to the stilling apron
  [-1.1, 1.1, 0.4], [1.1, 3.0, 0.22], [3.0, 4.9, 0.05], [4.9, 6.6, -0.16],
];
export const weirTop = dx => { for (const [a, b, t] of WEIR_STEPS) if (dx >= a && dx < b) return t; return null; };
const CONC = [[0.7, 0.68, 0.62], [0.62, 0.6, 0.55], [0.58, 0.58, 0.52], [0.68, 0.64, 0.55], [0.6, 0.62, 0.57]];
function weir(half) {
  const P = [], span = half + 1.3, nP = Math.ceil((span * 2) / 3.4), pw = (span * 2) / nP, gap = 0.07;
  const conc = (seed, wet) => { const c = CONC[Math.floor(hash(seed) * CONC.length)], k = 0.9 + hash(seed + 3) * 0.16, w = wet * (0.4 + hash(seed + 9) * 0.6); const m = lerpC([c[0] * k, c[1] * k, c[2] * k], [0.5, 0.58, 0.44], w); return rgb(m[0], m[1], m[2]); };
  const slab = (x0, x1, top, bot, wet, lvl) => {
    for (let k = 0; k < nP; k++) {
      const z = -span + pw * (k + 0.5), w = pw - gap, cx = (x0 + x1) / 2, bodyTop = top - 0.1;
      P.push(box(x1 - x0, bodyTop - bot, w, conc(k * 13 + lvl * 101, wet * 0.5), cx, (bodyTop + bot) / 2, z));            // darker, damp body
      P.push(box(x1 - x0 + 0.06, 0.1, w, conc(k * 7 + lvl * 57 + 5, wet), cx, top - 0.05, z));                           // lighter top slab, a little proud
      if (k) P.push(box(x1 - x0, top - bot - 0.03, 0.05, 0x4a463f, cx, (top + bot) / 2 - 0.015, z - pw / 2));          // an expansion joint
      for (let s = 0; s < 2; s++) if (hash(k * 5 + lvl * 17 + s * 3) > 0.62) P.push(box(0.05, 0.28 + hash(k + s) * 0.3, 0.16 + hash(k * 3 + s) * 0.25, 0x6f7058, x1 + 0.02, top - 0.2, z + (hash(k * 9 + s) - 0.5) * (pw - 0.5)));   // algae streak down the riser
    }
  };
  WEIR_STEPS.forEach(([a, b, t], i) => slab(a, b, t, -2.8, i * 0.35, i));
  slab(-2.6, -1.1, -0.2, -2.8, 0.7, 5);                                                                                      // the submerged upstream sill
  const wallC = (s) => { const c = conc(s, 0.15); return c; };
  for (const sg of [-1, 1]) {                                                                                                 // abutment wing walls tying the weir into each bank
    const z = sg * (half + 0.85);
    P.push(box(9.0, 3.2, 0.65, wallC(40 + sg), 2.6, -0.4, z), box(9.2, 0.1, 0.82, 0xd8d3c4, 2.6, 1.17, z), box(0.7, 3.2, 1.7, wallC(44 + sg), -1.8, -0.4, sg * (half + 0.9)));
    for (let k = 0; k < 4; k++) P.push(box(0.05, 3.1, 0.7, 0x4a463f, -1.5 + k * 2.4, -0.4, z - sg * 0.002));
  }
  // staff gauge on the upstream wing wall
  for (let k = 0; k < 8; k++) P.push(box(0.11, 0.19, 0.04, k % 2 ? 0x2a4a58 : 0xf2ead0, -1.05, 0.7 - k * 0.2, half - 0.18 + 0.0));
  return finish(P, 0.22);
}
/** A concrete fishway beside the weir: a flume of stepped pools with baffles and a notch between each, a little water in every pool. 11 m along x, flowing +x, 2 m wide. Local y = 0 is the bank. */
function fishLadder() {
  const P = [], pools = 6, plen = 11 / pools, W = 2.0, wt = 0.3, top = 0.62, conc = [0.74, 0.72, 0.65];
  const f = i => 0.3 - i * 0.05;
  P.push(box(11.4, 1.6, wt, 0x9b978a, 5.5, -0.18, -W / 2 - wt / 2), box(11.4, 1.6, wt, 0x9b978a, 5.5, -0.18, W / 2 + wt / 2), box(11.4, 0.08, wt + 0.14, 0xd8d3c4, 5.5, top + 0.04, -W / 2 - wt / 2), box(11.4, 0.08, wt + 0.14, 0xd8d3c4, 5.5, top + 0.04, W / 2 + wt / 2));
  for (let i = 0; i < pools; i++) {
    const x = plen * i + plen / 2, fl = f(i), wl = fl + 0.2;
    P.push(box(plen, 1.2, W, 0x8a8678, x, fl - 0.6, 0));                                                                   // pool floor
    P.push(box(plen - 0.2, 0.03, W - 0.1, i % 2 ? 0x74c6b2 : 0x6abcab, x, wl - 0.015, 0));                                  // water
    const bx = plen * (i + 1), slot = i % 2 ? 0.45 : -0.45, gapW = 0.45;
    if (i < pools - 1) {                                                                                                    // a baffle with a notch (the slot alternates sides)
      const zl = -W / 2, zr = W / 2, zs0 = slot - gapW / 2, zs1 = slot + gapW / 2;
      P.push(box(0.14, 0.52, zs0 - zl, 0xb3ae9f, bx, fl + 0.26, (zl + zs0) / 2), box(0.14, 0.52, zr - zs1, 0xb3ae9f, bx, fl + 0.26, (zs1 + zr) / 2), box(0.14, 0.1, zs1 - zs0, 0xb3ae9f, bx, fl + 0.02, slot));
      P.push(box(0.5, 0.04, gapW * 0.8, 0xf6fbfa, bx + 0.22, f(i + 1) + 0.19, slot));                                       // a flick of white where the water drops through the notch
    }
  }
  P.push(box(0.6, 0.06, 1.2, 0xd8d3c4, -0.3, top - 0.1, 0), box(0.3, 0.9, 2.6, 0x9b978a, -0.15, -0.1, 0));                // inlet lip
  return finish(P, 0.22);
}
/** A little timber landing at the water's edge for the spawn: planks along z with gaps, two bearers, four posts and two bollards. Top at y = 0.7; 2.6 wide (x), 2.4 long (z), the water at -z. */
function landing() {
  const P = [], top = 0.7;
  for (let i = 0; i < 12; i++) P.push(box(2.6, 0.07, 0.17, [0xb8905e, 0xa9814f, 0xc09865][i % 3], 0, top - 0.035, -1.1 + i * 0.2));
  for (const x of [-1.0, 1.0]) P.push(box(0.14, 0.14, 2.5, 0x6f4f32, x, top - 0.15, 0));
  for (const [x, z] of [[-1.25, -1.15], [1.25, -1.15], [-1.25, 1.1], [1.25, 1.1]]) P.push(cyl(0.1, 0.11, 1.1, 0x5e432b, x, top - 0.4, z, 7));
  for (const x of [-1.25, 1.25]) P.push(cyl(0.1, 0.12, 0.42, 0x6f4f32, x, top + 0.21, -1.15, 7), cyl(0.12, 0.12, 0.05, 0x3f2e20, x, top + 0.43, -1.15, 7));
  return finish(P, 0.2);
}
/** A short post sign: two posts and a board. Face toward +z; the site paints the lettering over it. */
function postSign() {
  const P = [cyl(0.07, 0.08, 1.7, 0x6b4a30, -0.55, 0.85, 0, 7), cyl(0.07, 0.08, 1.7, 0x6b4a30, 0.55, 0.85, 0, 7), box(1.5, 0.52, 0.08, 0xf4efe2, 0, 1.45, 0), box(1.62, 0.08, 0.14, 0x1f5f6b, 0, 1.74, 0), box(1.62, 0.08, 0.12, 0x1f5f6b, 0, 1.16, 0)];
  return finish(P, 0.18);
}
/** A flat flagstone for the path (sits low in the ground). */
function flagstone(variant) {
  const g = rockGeo(new THREE.DodecahedronGeometry(0.5, 0), (x, y, z) => [x * (1.5 + 0.25 * variant), y * 0.3, z * 1.2], (y01, nx, ny) => new THREE.Color().setRGB((0.66 + 0.06 * Math.max(0, ny)) * 0.92, 0.62 * 0.92, 0.54 * 0.92));
  g.translate(0, -g.boundingBox.min.y, 0);
  return finish([g], 0.12);
}
export function buildRiverModels({ weirHalf = 14.2 } = {}) {
  const m = new Map();
  for (let v = 0; v < 3; v++) m.set(`snag_log_${v}`, snagLog(v));
  for (let v = 0; v < 2; v++) m.set(`stepping_stone_${v}`, steppingStone(v));
  m.set('weir_body', weir(weirHalf)); m.set('fish_ladder', fishLadder()); m.set('landing', landing()); m.set('post_sign', postSign());
  for (let v = 0; v < 2; v++) m.set(`flagstone_${v}`, flagstone(v));
  m.set('weir_rail', weirRail()); m.set('notice_board', noticeBoard());
  return m;
}
