// The school's corner by the cleaning table at Lake Illawarra (the teachers' opening): a Marine Studies trailer box with a rod rack in front of it, a measuring
// board for the table top and the trailer's "WHS Marine Studies" sign. Built in code in the cosy, chunky, flat-shaded style (world/propKit.js), low poly, and
// merged: the trailer and the rack are ONE mesh, the board is a second, the sign a third (a flat plane with a painted texture). Every model sits on y = 0.
import * as THREE from 'three';
import { box, cyl, ball, finish } from './propKit.js';

const CREAM = 0xfff3d2, TEAL = 0x2f9a9a, NAVY = 0x1f5f6b, WHITE = 0xf3efe4, GREY = 0x8d9296, DARK = 0x3b4a52, WOOD = 0xa4764a, CORAL = 0xe8553d;

/** The trailer box (about 3.8 m long, 2 m deep, 2 m high) with its front (the serving hatch and the rod rack) on local +z. Origin on the ground at the middle. */
function trailer() {
  const P = [];
  // chassis and wheels
  P.push(box(3.9, 0.16, 1.9, DARK, 0, 0.5, 0));
  for (const sx of [-0.7, 0.9]) for (const sz of [-1, 1]) {
    P.push(cyl(0.38, 0.38, 0.22, 0x23272b, sx, 0.38, sz * 1.0, 14, Math.PI / 2));
    P.push(cyl(0.2, 0.2, 0.24, GREY, sx, 0.38, sz * 1.0, 10, Math.PI / 2));
    P.push(box(0.95, 0.07, 0.3, DARK, sx, 0.8, sz * 0.95));   // mudguard
  }
  // drawbar and jockey wheel at the +x end
  P.push(box(1.3, 0.1, 0.1, DARK, 2.5, 0.5, 0, 0));
  P.push(cyl(0.05, 0.05, 0.5, DARK, 3.0, 0.3, 0, 6));
  P.push(cyl(0.12, 0.12, 0.08, 0x23272b, 3.0, 0.12, 0, 10, Math.PI / 2));
  // the box: cream walls with a teal band, a roof lip
  P.push(box(3.7, 1.7, 1.8, WHITE, 0, 1.5, 0));
  P.push(box(3.74, 0.34, 1.84, TEAL, 0, 1.0, 0));
  P.push(box(3.9, 0.12, 2.0, NAVY, 0, 2.4, 0));
  P.push(box(3.76, 0.05, 1.86, CORAL, 0, 0.78, 0));
  // serving hatch on the front with an awning propped on two poles, and a bench under it
  P.push(box(1.7, 0.85, 0.05, 0x23272b, -0.2, 1.55, 0.92));
  P.push(box(1.9, 0.07, 0.7, CORAL, -0.2, 2.0, 1.2, 0, -0.18));
  for (const x of [-1.1, 0.7]) P.push(cyl(0.035, 0.035, 1.1, GREY, x, 1.45, 1.52, 6));
  P.push(box(1.7, 0.07, 0.34, WOOD, -0.2, 1.05, 1.0));
  // a door on the side (+x end) and a small window
  P.push(box(0.05, 1.3, 0.8, TEAL, 1.88, 1.45, -0.2));
  P.push(box(0.05, 0.4, 0.5, 0x7fcfe0, 1.88, 1.7, 0.55));
  P.push(cyl(0.025, 0.025, 0.1, GREY, 1.93, 1.4, -0.45, 6, 0, Math.PI / 2));
  // the sign stands on two posts on the roof edge (the painted board is addCornerSign)
  for (const x of [-1.25, 0.85]) P.push(box(0.06, 0.46, 0.06, WOOD, x, 2.69, 0.7));
  // a roof box (a spare cooler) so the silhouette is not a plain brick
  P.push(box(0.9, 0.3, 0.5, 0x3d86c4, 0.9, 2.6, -0.3));
  // the rod rack in front: a frame with two uprights, a crossbar, and three thin rods leaning on it
  const rx = -2.3, rz = 1.55;
  for (const dz of [-0.5, 0.5]) P.push(box(0.07, 1.0, 0.07, WOOD, rx, 0.5, rz + dz));
  P.push(box(0.07, 0.07, 1.14, WOOD, rx, 0.95, rz));
  P.push(box(0.07, 0.07, 1.14, WOOD, rx, 0.25, rz));
  const cols = [CORAL, 0xf2b93b, TEAL];
  cols.forEach((c, i) => {
    const z = rz - 0.34 + i * 0.34;
    P.push(cyl(0.012, 0.022, 2.3, c, rx + 0.28, 1.2, z, 5, 0, 0.26));   // a long thin rod leaning back on the crossbar
    P.push(cyl(0.035, 0.035, 0.32, 0x23272b, rx + 0.04, 0.58, z, 6, 0, 0.26));   // its handle
    P.push(ball(0.04, GREY, rx + 0.5, 2.3, z));
  });
  return finish(P, 0.24);
}

/** The measuring board on the cleaning table (in the table model's own frame: the table top is about 1.0 m up and about 0.28 m along local x). */
function board() {
  const P = [];
  const x = 0.35, y = 1.015;
  P.push(box(0.95, 0.03, 0.3, 0xf6d46a, x, y + 0.015, 0));
  P.push(box(0.04, 0.04, 0.3, NAVY, x - 0.46, y + 0.04, 0));   // the zero stop
  for (let i = 1; i < 12; i++) P.push(box(0.008, 0.012, i % 5 === 0 ? 0.12 : 0.07, NAVY, x - 0.45 + i * 0.075, y + 0.036, -0.09));
  P.push(box(0.2, 0.05, 0.12, CORAL, x + 0.1, y + 0.04, 0.05));   // a little marker
  return finish(P, 0.18);
}

/** Map(name -> BufferGeometry) of the corner's models, ready for world.models. */
export function buildCornerModels() {
  return new Map([['wh_trailer', trailer()], ['wh_board', board()]]);
}

let signTex = null;
/** The trailer's sign: a painted plane on the front, above the hatch. `at` = { x, z, rot } of the trailer; y0 = the ground there. Added to `group`. */
export function addCornerSign(group, at, y0) {
  if (!signTex) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#1f5f6b'; x.fillRect(0, 0, 512, 128); x.strokeStyle = '#fff3d2'; x.lineWidth = 8; x.strokeRect(8, 8, 496, 112);
    x.fillStyle = '#fff3d2'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '800 40px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; x.fillText('WHS', 256, 36);
    x.fillStyle = '#ffd66b'; x.font = '800 50px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; x.fillText('Marine Studies', 256, 88);
    signTex = new THREE.CanvasTexture(c); signTex.colorSpace = THREE.SRGBColorSpace; signTex.anisotropy = 4;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.575), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }));
  const lx = -0.2, ly = 2.82, lz = 0.74, c = Math.cos(at.rot), s = Math.sin(at.rot);
  m.position.set(at.x + lx * c + lz * s, y0 + ly, at.z - lx * s + lz * c); m.rotation.y = at.rot; m.name = 'wh_sign'; m.userData.noShadow = true;
  group.add(m);
  return m;
}
