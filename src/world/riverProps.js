// The river's built and fallen things, made in code (world/propKit.js): snag logs half-sunk in the water, a weir hand-rail, a licence noticeboard and a row of stepping stones.
// buildRiverModels() returns Map(name -> BufferGeometry); every model sits on y = 0.
import * as THREE from 'three';
import { box, cyl, ball, cone, finish, rockGeo } from './propKit.js';

/** A fallen casuarina trunk with a few snapped branches and a root ball: a snag, where bass and eels hide. About 6 m long, lying along x. */
function snagLog(variant) {
  const r = i => { const x = Math.sin((variant * 31 + i) * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const p = [cyl(0.3, 0.4, 6, 0x6b5238, 0, 0.25, 0, 9, 0, Math.PI / 2), cyl(0.28, 0.3, 6.2, 0x5a4430, 0, 0.45, 0.08, 7, 0, Math.PI / 2 + 0.04)];
  p.push(ball(0.55, 0x594430, -3.05, 0.35, 0, 1, 0.8, 1.1));                                           // the root ball
  for (let i = 0; i < 4; i++) { const x = -2 + i * 1.3 + r(i), side = i % 2 ? 1 : -1; p.push(cyl(0.05, 0.12, 1.6 + r(i + 5), 0x6b5238, x, 0.7, side * 0.55, 6, side * 0.9, 0.1 * (r(i + 9) - 0.5))); }
  for (const [x, z] of [[-2.7, 0.5], [-2.9, -0.5], [-3.3, 0.2]]) p.push(cyl(0.04, 0.1, 1.2, 0x594430, x, 0.5, z, 6, 0.5 * Math.sign(z), 0.7));
  return finish(p, 0.2);
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
export function buildRiverModels() {
  const m = new Map();
  for (let v = 0; v < 3; v++) m.set(`snag_log_${v}`, snagLog(v));
  for (let v = 0; v < 2; v++) m.set(`stepping_stone_${v}`, steppingStone(v));
  m.set('weir_rail', weirRail()); m.set('notice_board', noticeBoard());
  return m;
}
