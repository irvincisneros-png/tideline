// Belmore Basin's built things, made in code (chunky, flat-shaded, vertex-coloured, in the same cosy style as the Blender prop set): a timber wharf deck and
// pylons, bollards, lamp posts, three fishing trawlers, the co-op building, a stone quay wall, a lighthouse, and the odds and ends of a working harbour
// (fish crates, bins, nets, buoys, rope). buildHarbourModels() returns Map(name -> BufferGeometry with position, normal, color), the same shape as a loaded .glb set,
// so props.place('name', x, z, opts) works unchanged. Units are metres; every model sits on y = 0 (a hull: the waterline is y = 0).
import * as THREE from 'three';
import { colour, part, box, cyl, ball, torus, cone, finish, loft, sheet, rockGeo, cap, wall } from './propKit.js';

// ------------------------------------------------------------------ the wharf
function wharfDeck() {
  // 8 m wide, 2 m long module, top face at y = 0. Planks run along z; two cross beams underneath; a low kerb on both long edges.
  const p = [];
  for (let i = 0; i < 8; i++) p.push(box(0.97, 0.3, 2.0, i % 2 ? 0xb88a58 : 0xa97b4b, -3.5 + i, -0.15, 0));
  for (const z of [-0.8, 0.8]) p.push(box(8.0, 0.32, 0.26, 0x6b4a30, 0, -0.46, z));
  for (const x of [-3.88, 3.88]) p.push(box(0.2, 0.18, 2.0, 0x8a5e3a, x, 0.09, 0));
  return finish(p, 0.2);
}
function wharfPile() {
  // A tarred timber pile with a pale tide band and a flat cap; origin at the foot, 4 m tall.
  return finish([cyl(0.3, 0.34, 4, 0x4a3727, 0, 2, 0, 9), cyl(0.315, 0.315, 0.55, 0x7a6a50, 0, 2.9, 0, 9), cyl(0.31, 0.31, 0.12, 0x6b4a30, 0, 4.02, 0, 9)]);
}
function bollard() {
  return finish([cyl(0.2, 0.26, 0.36, 0x353d43, 0, 0.18, 0, 10), cyl(0.15, 0.15, 0.2, 0x353d43, 0, 0.45, 0, 10), cyl(0.26, 0.19, 0.12, 0x353d43, 0, 0.62, 0, 10), cyl(0.205, 0.205, 0.05, 0xf0b73c, 0, 0.5, 0, 10)]);
}
function lampPost() {
  // 3.3 m post with a curved arm reaching 1.6 m out toward +x and a cream lantern head hanging at the end (head at (1.6, 3.2)).
  const p = [cyl(0.075, 0.1, 3.3, 0x34444c, 0, 1.65, 0, 8), cyl(0.16, 0.16, 0.18, 0x34444c, 0, 0.09, 0, 8)];
  p.push(box(1.65, 0.07, 0.07, 0x34444c, 0.8, 3.3, 0), box(0.07, 0.5, 0.07, 0x34444c, 0.15, 3.1, 0, 0, 0, 0.7));
  p.push(cyl(0.2, 0.15, 0.34, 0xfff0c2, 1.6, 3.0, 0, 8), cyl(0.04, 0.24, 0.12, 0x34444c, 1.6, 3.23, 0, 8), cyl(0.18, 0.18, 0.05, 0x34444c, 1.6, 2.82, 0, 8));
  return finish(p, 0.1);
}

// ------------------------------------------------------------------ trawlers
/**
 * A solid fishing trawler: a smoothly curved hull (a rounded bilge, a sheer that rises to a sharp bow, a flat transom), white topsides with a coloured sheer stripe over red antifouling, a deck with
 * bulwarks, a wheelhouse with big windows, a mast with a radar dome, folded outriggers lashed beside the mast, an A-frame with trawl doors, a net drum, a heap of net and strings of floats.
 */
function trawler({ len = 11, beam = 3.5, hull = 0xf4efe4, stripe = 0x2d6f9c, cabin = 0xf7f2e8, roof = 0x2d6f9c, gear = 0x3e8f62, bottom = 0x8d3d3a, net = 0x4faa72 } = {}) {
  const L = len, hb = beam / 2, deck = 0.92, draft = 0.85;
  const X = t => -L / 2 + t * L;
  const half = t => hb * (t < 0.58 ? 0.93 + 0.07 * Math.sin(Math.min(1, t / 0.22) * Math.PI / 2) : Math.pow(Math.max(0, Math.cos(Math.min(1, (t - 0.58) / 0.42) * Math.PI / 2)), 0.66));
  const dy = t => deck + 0.78 * Math.pow(t, 2.8);                                  // the sheer rises to the bow
  const dr = t => draft * (t > 0.82 ? 1 - Math.pow((t - 0.82) / 0.18, 1.5) * 0.72 : 1) * (t < 0.1 ? 0.78 + 2.2 * t : 1);
  const N = 22, K = 15, rings = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, ring = [];
    for (let j = 0; j < K; j++) {
      const a = (j / (K - 1)) * Math.PI, c = Math.cos(a), sn = Math.sin(a);
      ring.push([X(t), dy(t) - (dy(t) + dr(t)) * Math.pow(Math.max(0, sn), 0.6), -Math.sign(c) * Math.pow(Math.abs(c), 0.86) * half(t)]);
    }
    rings.push(ring);
  }
  const p = [];
  // topsides: v runs port deck edge -> keel -> starboard deck edge; the sheer stripe and the red bottom are bands of it
  p.push(loft(rings, (u, v) => { const d = Math.min(v, 1 - v); return d < 0.075 ? stripe : d < 0.3 ? hull : bottom; }));
  p.push(cap(rings[0], hull, [-1, 0, 0]));                                          // the transom
  p.push(box(0.05, 0.16, Math.min(1.5, half(0) * 1.2), 0x8d3d3a, X(0) - 0.05, deck - 0.6, 0));      // a name board across the stern
  const left = [], right = [];
  for (let i = 0; i <= N; i++) { const t = i / N; left.push([X(t), dy(t) - 0.02, -half(t) * 0.97]); right.push([X(t), dy(t) - 0.02, half(t) * 0.97]); }
  p.push(sheet(left, right, 0xc5a36f, 1));                                           // the timber deck
  for (const sd of [-1, 1]) {                                                         // bulwarks: a low wall each side, white outside, timber inside, with a rail on top
    const low = [], high = [], top = [];
    for (let i = 1; i <= N - 2; i++) { const t = i / N, x = X(t), z = sd * half(t) * 0.985; low.push([x, dy(t) - 0.02, z]); high.push([x, dy(t) + 0.4, z]); top.push([x, dy(t) + 0.4, z]); }
    p.push(...wall(low, high, hull, 0xb89466, [0, 0, sd]));
    for (let i = 0; i < top.length - 1; i += 2) { const a = top[i], b = top[Math.min(i + 2, top.length - 1)]; p.push(box(Math.hypot(b[0] - a[0], b[2] - a[2]) + 0.04, 0.07, 0.12, stripe, (a[0] + b[0]) / 2, a[1] + 0.03, (a[2] + b[2]) / 2, -Math.atan2(b[2] - a[2], b[0] - a[0]))); }
  }
  // wheelhouse: forward of amidships, big windows on all four sides, a roof with an overhang, a funnel behind it
  const cx = X(0.4), cy = deck;
  p.push(box(2.7, 1.5, 2.55, cabin, cx, cy + 0.75, 0), box(3.0, 0.16, 2.85, roof, cx, cy + 1.58, 0), box(2.5, 0.1, 2.35, 0xdfe5e8, cx, cy + 1.68, 0));
  const glass = 0x3e7388;
  p.push(box(0.06, 0.62, 2.2, glass, cx + 1.36, cy + 1.0, 0), box(0.06, 0.1, 2.28, 0xffffff, cx + 1.37, cy + 1.34, 0), box(0.06, 0.1, 2.28, 0xffffff, cx + 1.37, cy + 0.66, 0));
  for (const sd of [-1, 1]) {
    for (const wx of [-0.62, 0.62]) { p.push(box(0.95, 0.58, 0.06, glass, cx + wx, cy + 1.0, sd * 1.29), box(1.03, 0.07, 0.07, 0xffffff, cx + wx, cy + 1.33, sd * 1.3), box(1.03, 0.07, 0.07, 0xffffff, cx + wx, cy + 0.68, sd * 1.3)); }
    p.push(box(0.06, 0.62, 0.95, glass, cx - 1.36, cy + 1.0, sd * 0.6), box(0.06, 0.08, 1.02, 0xffffff, cx - 1.37, cy + 1.34, sd * 0.6));
    p.push(box(0.9, 1.15, 0.06, 0xe8553d, cx - 0.1, cy + 0.6, sd * 1.285));      // a door on each side
  }
  p.push(cyl(0.2, 0.24, 1.2, 0x34444c, cx - 1.0, cy + 2.3, 0.8, 10), cyl(0.22, 0.2, 0.12, roof, cx - 1.0, cy + 2.93, 0.8, 10));   // the funnel
  // mast, radar dome, a spreader, navigation lights
  const mx = cx - 0.3;
  p.push(cyl(0.07, 0.1, 3.4, 0x6b747a, mx, cy + 3.4, 0, 8), box(0.08, 0.08, 1.7, 0x6b747a, mx, cy + 4.6, 0), ball(0.32, 0xeef2f4, cx + 0.7, cy + 1.95, 0, 1, 0.75, 1), ball(0.06, 0xe8553d, mx, cy + 4.6, -0.85), ball(0.06, 0x3ac07a, mx, cy + 4.6, 0.85), cyl(0.015, 0.015, 1.2, 0x34444c, mx, cy + 5.4, 0, 5));
  // outriggers, folded up: two long poles lashed upright either side of the mast, tied to the spreader
  for (const sd of [-1, 1]) {
    p.push(cyl(0.05, 0.075, 6.2, 0x7c858b, mx - 0.15, cy + 3.8, sd * 1.05, 7, sd * 0.1, 0.07));
    p.push(box(0.04, 0.04, 0.9, 0x34444c, mx - 0.1, cy + 2.2, sd * 0.62, 0, 0, 0.0), cyl(0.03, 0.03, 0.34, 0xe0e4e6, mx - 0.12, cy + 2.0, sd * 1.1, 6));
  }
  // the stern A-frame with trawl doors hung on it, a net drum and the net
  const sx = X(0.07);
  p.push(cyl(0.07, 0.09, 2.8, 0x6b747a, sx, cy + 1.4, -hb * 0.72, 8, 0.22, 0), cyl(0.07, 0.09, 2.8, 0x6b747a, sx, cy + 1.4, hb * 0.72, 8, -0.22, 0), box(0.12, 0.12, hb * 1.28, 0x6b747a, sx, cy + 2.7, 0), ball(0.14, 0x34444c, sx - 0.05, cy + 2.55, 0));
  for (const sd of [-1, 1]) p.push(box(0.1, 1.15, 0.85, 0x7a4f2c, sx + 0.5, cy + 0.72, sd * hb * 0.55, 0, 0, sd * 0.08), box(0.12, 0.1, 0.9, 0x5b636a, sx + 0.5, cy + 1.2, sd * hb * 0.55), box(0.12, 0.1, 0.9, 0x5b636a, sx + 0.5, cy + 0.3, sd * hb * 0.55));
  p.push(cyl(0.42, 0.42, 2.0, gear, X(0.2), cy + 0.62, 0, 12, Math.PI / 2, 0), ball(0.9, net, X(0.17), cy + 0.7, 0, 1.15, 0.55, 1.25), ball(0.5, 0x3e8f62, X(0.2), cy + 0.95, 0.5, 1, 0.6, 1));
  for (const [t, z] of [[0.52, 0.9], [0.55, -0.85], [0.6, 0.55], [0.5, -0.35], [0.1, 1.1], [0.12, -1.15], [0.14, 1.2], [0.08, -1.0]]) p.push(ball(0.2, 0xff8a3d, X(t), cy + 0.22, z * hb * 0.7));
  for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) p.push(ball(0.15, i % 2 ? 0xfff0d2 : 0xff8a3d, X(0.1 + i * 0.07), cy + 0.5, sd * (half(0.1 + i * 0.07) * 0.9)));   // a string of floats along each rail
  p.push(box(0.9, 0.42, 0.6, 0x3d86c4, X(0.78), cy + 0.2, 0.7), box(0.9, 0.42, 0.6, 0xf0a63a, X(0.78), cy + 0.2, -0.7), box(0.9, 0.42, 0.6, 0x3d86c4, X(0.78), cy + 0.63, 0.7), box(1.2, 0.16, 1.1, 0x8a6a45, X(0.66), cy + 0.08, 0));   // crates and a hatch
  p.push(cyl(0.05, 0.05, 1.1, 0x6b747a, X(0.9), cy + 0.7, 0, 6), ball(0.09, 0x34444c, X(0.9), cy + 1.3, 0), torus(0.28, 0.045, 0x34444c, X(0.93), cy + 0.2, 0, 0));   // a bow light post and the anchor ring
  for (const sd of [-1, 1]) for (const a of [0.3, 0.52, 0.72]) p.push(cyl(0.17, 0.17, 0.3, 0x24282c, X(a), 0.34, sd * (half(a) + 0.12), 8, Math.PI / 2, 0));   // tyre fenders
  return finish(p, 0.22);
}

// ------------------------------------------------------------------ rock armour, quay furniture
/** A quarried armour rock: an angular, flat-faced block of grey-brown stone with weathered edges and a little moss low down (variant 0-2). Origin at the base, about 1 m. */
function armourRock(variant) {
  const seed = 11 + variant * 37, r = i => { const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };
  const base = [new THREE.DodecahedronGeometry(0.62, 0), new THREE.IcosahedronGeometry(0.62, 0), new THREE.OctahedronGeometry(0.7, 0)][variant % 3];
  const sx = 1.15 + 0.25 * r(1), sy = 0.78 + 0.2 * r(2), sz = 0.95 + 0.3 * r(3);
  const memo = new Map();
  const g = rockGeo(base, (x, y, z) => {                                          // jitter each distinct corner once so faces stay flat and the corners are crisp
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!memo.has(key)) { const k = r(memo.size + 5); memo.set(key, [x * (0.86 + 0.3 * k) * sx, y * (0.8 + 0.4 * r(memo.size + 90)) * sy, z * (0.86 + 0.3 * r(memo.size + 50)) * sz]); }
    return memo.get(key);
  }, (y01, nx, ny, nz) => {
    const top = Math.max(0, ny), under = Math.max(0, -ny), sh = 0.88 + 0.14 * top - 0.12 * under;                  // a flat, weathered grey-brown, lighter on the tops
    const warm = (Math.abs(nx) + Math.abs(nz)) * 0.03, v = 0.92 + 0.14 * (((Math.sin(nx * 91.7 + ny * 47.3 + nz * 13.1) * 43758.5453) % 1 + 1) % 1);   // each face a slightly different weathered tone
    const c = new THREE.Color().setRGB((0.57 + warm) * sh * v, (0.545 + warm * 0.6) * sh * v, 0.5 * sh * v);
    if (y01 < 0.22 && ny < 0.5) c.lerp(new THREE.Color(0x6d7f4c), 0.28 * (1 - y01 / 0.22));                  // only a trace of moss, at the foot
    return c;
  });
  g.translate(0, -g.boundingBox.min.y, 0);
  return finish([g], 0.12);
}
function fuelBowser() {
  // A diesel bowser: a red-and-white pillar with a hose and nozzle, a screen, a rubber boot, and yellow-and-black guard posts.
  const p = [box(1.0, 0.16, 0.8, 0x8f969b, 0, 0.08, 0), box(0.62, 1.55, 0.46, 0xe8553d, 0, 0.95, 0), box(0.66, 0.5, 0.5, 0xf6f1e6, 0, 1.78, 0), box(0.5, 0.26, 0.04, 0x2b4a5a, 0, 1.78, -0.26), box(0.5, 0.22, 0.04, 0xf0b73c, 0, 1.1, -0.245), box(0.7, 0.1, 0.54, 0x34444c, 0, 2.06, 0)];
  p.push(box(0.1, 0.5, 0.1, 0x34444c, -0.4, 0.85, 0), cyl(0.04, 0.04, 0.5, 0x34444c, -0.46, 1.0, 0, 6, 0, 0.5), torus(0.2, 0.03, 0x34444c, 0.34, 0.9, 0, 0), box(0.12, 0.24, 0.08, 0xf0b73c, -0.44, 0.7, 0.02));
  for (const [x, z] of [[-0.62, -0.5], [0.62, -0.5], [-0.62, 0.5], [0.62, 0.5]]) p.push(cyl(0.09, 0.09, 0.9, 0xf0b73c, x, 0.45, z, 8), cyl(0.092, 0.092, 0.14, 0x24282c, x, 0.5, z, 8), cyl(0.092, 0.092, 0.14, 0x24282c, x, 0.8, z, 8));
  return finish(p, 0.2);
}
function kiosk() {
  // A little harbour café: cream walls, a teal roof, a striped awning over a serving hatch and counter, a menu board, a coffee-cup sign and a roof vent. 4.4 (x) by 3 (z), front faces -z.
  const W = 4.4, D = 3.0, H = 2.7, wall = 0xfdeec6, trim = 0x2a8c96;
  const p = [box(W, 0.15, D, 0xb9b2a4, 0, 0.075, 0), box(W - 0.2, H, D - 0.2, wall, 0, H / 2 + 0.15, 0), box(W + 0.5, 0.22, D + 0.6, trim, 0, H + 0.26, 0), box(W + 0.2, 0.18, D + 0.3, 0x35a6af, 0, H + 0.45, 0), box(1.0, 0.3, 0.7, 0x6f7479, -1.3, H + 0.7, 0.2)];
  const fz = -D / 2 + 0.07;
  p.push(box(2.5, 1.0, 0.12, 0x2b4a5a, 0.2, 1.55, fz - 0.02), box(2.7, 0.1, 0.2, trim, 0.2, 2.1, fz - 0.06), box(2.9, 0.12, 0.55, 0xe0b27a, 0.2, 1.0, fz - 0.3), box(1.0, 1.8, 0.1, 0x3b6a8a, -1.75, 1.05, fz - 0.03), box(0.15, 2.0, 0.15, 0xe9dfc4, 1.9, 1.15, fz - 0.05), box(0.15, 2.0, 0.15, 0xe9dfc4, -0.65, 1.15, fz - 0.05));
  // the awning: alternating red and cream slats sloping out from above the hatch
  for (let i = 0; i < 9; i++) p.push(box(0.34, 0.07, 1.25, i % 2 ? 0xfff4de : 0xe8553d, -1.4 + i * 0.35 + 0.18, 2.42 - 0.04, fz - 0.68, 0, 0.32));
  p.push(box(2.9, 0.07, 0.07, 0xe8553d, 0.2, 2.18, fz - 1.22)); 
  p.push(box(0.9, 0.7, 0.07, 0x34444c, 1.75, 2.05, fz - 0.07), box(0.8, 0.12, 0.08, 0xfff4de, 1.75, 2.25, fz - 0.12), box(0.8, 0.1, 0.08, 0xf0b73c, 1.75, 2.05, fz - 0.12), box(0.8, 0.1, 0.08, 0xfff4de, 1.75, 1.88, fz - 0.12));   // the menu board
  p.push(cyl(0.34, 0.26, 0.5, 0xfff4de, 0, H + 1.0, -0.6, 12), torus(0.2, 0.05, 0xfff4de, 0.34, H + 1.0, -0.6, 0), cyl(0.3, 0.3, 0.06, 0x7a4f2c, 0, H + 1.24, -0.6, 12));   // a coffee cup on the roof
  return finish(p, 0.18);
}
function umbrellaTable() {
  // A round café table with four chairs and a big striped umbrella (blue and cream segments) on a centre pole. Origin on the ground under the pole.
  const p = [cyl(0.05, 0.07, 2.35, 0x8d969b, 0, 1.17, 0, 7), cyl(0.62, 0.62, 0.07, 0xf4efe4, 0, 0.78, 0, 14), cyl(0.07, 0.12, 0.78, 0x8d969b, 0, 0.39, 0, 7), cyl(0.3, 0.3, 0.05, 0x8d969b, 0, 0.03, 0, 10)];
  const seg = 12;
  for (let i = 0; i < seg; i++) {
    const g = new THREE.CylinderGeometry(0.04, 1.35, 0.52, 1, 1, false, (i / seg) * Math.PI * 2, (1 / seg) * Math.PI * 2);
    p.push(part(g, i % 2 ? 0xfff4de : 0x2d8fc0, 0, 2.45, 0));
  }
  p.push(ball(0.07, 0x8d969b, 0, 2.74, 0));
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4, x = Math.cos(a) * 1.0, z = Math.sin(a) * 1.0; p.push(box(0.42, 0.06, 0.42, 0xe0b27a, x, 0.48, z, -a), box(0.06, 0.48, 0.06, 0x6b747a, x, 0.24, z), box(0.42, 0.34, 0.06, 0xe0b27a, x + Math.cos(a) * 0.19, 0.72, z + Math.sin(a) * 0.19, -a + Math.PI / 2)); }
  return finish(p, 0.2);
}
function planter() {
  // A timber planter box with a clipped green bush and a few bright flowers.
  const p = [box(1.7, 0.55, 0.62, 0x9a7048, 0, 0.275, 0), box(1.78, 0.08, 0.7, 0x7a5532, 0, 0.58, 0), box(1.5, 0.08, 0.46, 0x4d3a2a, 0, 0.6, 0)];
  for (const [x, r] of [[-0.5, 0.34], [0.0, 0.42], [0.5, 0.32]]) p.push(ball(r, 0x4f9a52, x, 0.82 + r * 0.3, 0, 1, 0.85, 1));
  for (const [x, z, c] of [[-0.4, 0.1, 0xff7aa8], [0.2, -0.12, 0xffd54a], [0.55, 0.1, 0xffffff], [-0.1, 0.16, 0xff8a3d], [0.0, -0.1, 0xff7aa8]]) p.push(ball(0.07, c, x, 1.02, z));
  return finish(p, 0.2);
}
function netRack() {
  // A timber drying rack with nets hung over the cross pole and trailing floats and a bucket under it.
  const p = [cyl(0.07, 0.08, 2.1, 0x7a5532, -1.4, 1.05, 0, 7), cyl(0.07, 0.08, 2.1, 0x7a5532, 1.4, 1.05, 0, 7), cyl(0.05, 0.05, 3.0, 0x8d6a45, 0, 2.05, 0, 7, 0, Math.PI / 2), box(0.08, 1.7, 0.08, 0x7a5532, -1.4, 0.8, 0.5, 0, 0.5), box(0.08, 1.7, 0.08, 0x7a5532, 1.4, 0.8, 0.5, 0, 0.5)];
  for (const [x, w, c] of [[-0.8, 0.9, 0x4faa72], [0.1, 1.0, 0x3e8f62], [0.95, 0.8, 0x6fc08a]]) p.push(box(w, 1.25, 0.12, c, x, 1.35, 0), box(w * 0.9, 0.5, 0.14, 0x2f7a52, x, 0.62, 0));
  for (const x of [-1.1, -0.2, 0.7, 1.2]) p.push(ball(0.13, 0xff8a3d, x, 0.36, 0.1));
  return finish(p, 0.2);
}
function crabPots() {
  // A stack of three round wire crab pots with a rope and an orange buoy each.
  const p = [];
  for (let i = 0; i < 3; i++) { const y = 0.26 + i * 0.5, x = i === 1 ? 0.06 : 0; p.push(cyl(0.5, 0.5, 0.46, 0x4f6a4a, x, y, 0, 12), cyl(0.505, 0.505, 0.05, 0x2f3a2c, x, y - 0.2, 0, 12), cyl(0.505, 0.505, 0.05, 0x2f3a2c, x, y + 0.2, 0, 12), ball(0.14, 0xff8a3d, x + 0.45, y + 0.35, 0.1)); }
  p.push(cyl(0.02, 0.02, 0.5, 0xd9c28a, 0.3, 1.4, 0.1, 5), ball(0.12, 0xff8a3d, 0.3, 1.7, 0.1));
  return finish(p, 0.2);
}
function wheelieBins() {
  const p = [];
  for (const [x, c] of [[-0.4, 0x3e8f62], [0.4, 0xf0b73c]]) p.push(box(0.6, 0.95, 0.66, c, x, 0.5, 0), box(0.66, 0.08, 0.72, 0x2e6a48, x, 1.0, 0.0), cyl(0.09, 0.09, 0.05, 0x24282c, x - 0.2, 0.09, 0.34, 8, Math.PI / 2, 0), cyl(0.09, 0.09, 0.05, 0x24282c, x + 0.2, 0.09, 0.34, 8, Math.PI / 2, 0));
  p.push(box(0.66, 0.08, 0.72, 0xd9a02a, 0.4, 1.0, 0));
  return finish(p, 0.2);
}
function boatTrailer() {
  // A little aluminium tinnie on a galvanised trailer (about 4.4 m long, along x): a curved hull, two benches, an outboard, trailer wheels and a winch.
  const L = 3.6, hb = 0.8, rings = [];
  for (let i = 0; i <= 9; i++) { const t = i / 9, half = hb * (t < 0.55 ? 1 : Math.pow(Math.max(0, Math.cos(Math.min(1, (t - 0.55) / 0.45) * Math.PI / 2)), 0.7)), dy = 0.62 + 0.18 * t * t; const row = []; for (let j = 0; j < 9; j++) { const a = (j / 8) * Math.PI, sn = Math.max(0, Math.sin(a)); row.push([-L / 2 + t * L, dy - 0.45 * Math.pow(sn, 0.7), -Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) * half]); } rings.push(row); }
  const p = [loft(rings, (u, v) => (Math.min(v, 1 - v) < 0.1 ? 0xd9503c : 0xd7dde0)), loft(rings, 0xa9b3b8, { inward: true }), box(0.06, 0.34, hb * 1.5, 0xc4cbce, -L / 2 - 0.02, 0.6, 0)];
  p.push(box(0.5, 0.06, hb * 1.5, 0xb9c1c5, -0.5, 0.74, 0), box(0.5, 0.06, hb * 1.5, 0xb9c1c5, 0.6, 0.74, 0), box(0.4, 0.5, 0.3, 0xf4efe4, -L / 2 - 0.2, 0.85, 0), box(0.14, 0.4, 0.2, 0x4e5a62, -L / 2 - 0.22, 0.5, 0));
  p.push(box(L + 0.6, 0.08, 0.08, 0x8f989d, 0, 0.3, 0.62), box(L + 0.6, 0.08, 0.08, 0x8f989d, 0, 0.3, -0.62), box(0.08, 0.08, 1.4, 0x8f989d, -0.2, 0.3, 0), box(1.0, 0.07, 0.07, 0x8f989d, L / 2 + 0.7, 0.3, 0, 0.0));
  for (const z of [-0.78, 0.78]) p.push(cyl(0.28, 0.28, 0.18, 0x24282c, -0.2, 0.28, z, 12, Math.PI / 2, 0), cyl(0.12, 0.12, 0.2, 0x9aa3a8, -0.2, 0.28, z, 8, Math.PI / 2, 0));
  p.push(box(0.2, 0.2, 0.16, 0x34444c, L / 2 + 0.55, 0.45, 0));
  return finish(p, 0.22);
}
function sandwichBoard() {
  const p = [box(0.7, 0.9, 0.06, 0x2b4a5a, 0, 0.55, 0, 0, 0.22), box(0.7, 0.9, 0.06, 0x2b4a5a, 0, 0.55, 0.14, 0, -0.22), box(0.56, 0.5, 0.07, 0xfff4de, 0, 0.62, -0.02, 0, 0.22), box(0.4, 0.06, 0.08, 0xe8553d, 0, 0.78, -0.04, 0, 0.22)];
  return finish(p, 0.2);
}

// ------------------------------------------------------------------ the co-op, a lighthouse, quay wall
function coop() {
  // 13 m (x) by 6.5 m (z); the front (the water side) faces -z. Origin on the ground at the centre of the building.
  const W = 13, D = 6.5, H = 4.2, wall = 0xbfe0d4, trim = 0xf6f1e6, roof = 0x6f8aa0;
  const p = [box(W, H, D, wall, 0, H / 2, 0), box(W + 0.3, 0.3, D + 0.3, 0x9aa3a6, 0, 0.15, 0)];
  // gable roof: two slabs meeting at a ridge, with eaves
  const pitch = 0.42, slab = (D / 2 + 0.7) / Math.cos(pitch);
  for (const s of [-1, 1]) p.push(box(W + 0.8, 0.16, slab, roof, 0, H + Math.sin(pitch) * slab / 2 - 0.05, s * (D / 4 + 0.15), 0, s * -pitch, 0));
  p.push(box(W + 0.9, 0.2, 0.3, 0xdfe5e8, 0, H + Math.sin(pitch) * slab - 0.05, 0));
  // big roller door, a person door, windows, a loading dock along the front, an ice chute
  const fz = -D / 2 - 0.02;
  p.push(box(3.6, 3.2, 0.1, 0x3b6a8a, -1.2, 1.6, fz), box(3.9, 0.25, 0.14, trim, -1.2, 3.3, fz), box(1.1, 2.3, 0.1, 0xe0733f, 2.0, 1.15, fz));
  for (const x of [-5, 4.4, 5.6]) p.push(box(1.3, 1.1, 0.1, 0x2b4a5a, x, 2.3, fz), box(1.5, 0.12, 0.16, trim, x, 1.7, fz - 0.03));
  p.push(box(W + 0.4, 0.34, 1.5, 0xb7b2a6, 0, 0.17, fz - 0.8), box(1.0, 0.14, 2.4, 0x8d9aa3, 5.2, 3.0, fz - 1.1, 0, -0.5, 0));
  for (let i = 0; i < 4; i++) p.push(box(0.12, 1.0, 0.12, 0x6b4a30, -5.5 + i * 3.4, 0.9, fz - 1.4));      // dock posts
  return finish(p, 0.18);
}
function lighthouse() {
  // The breakwater lighthouse: a squat white tower with a red band, a gallery and a glassy lantern. ~13 m. Origin on the ground.
  const tower = [[2.4, 0], [2.3, 0.9], [1.95, 2.2], [1.8, 3.4]], band = [[1.8, 3.4], [1.75, 5.6]], upper = [[1.75, 5.6], [1.55, 8.2]];
  const lathe = (pts, hex) => part(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 14), hex);
  const p = [cyl(3.3, 3.6, 0.9, 0x8f8a80, 0, 0.45, 0, 14), lathe(tower, 0xfbf6ec), lathe(band, 0xd9503c), lathe(upper, 0xfbf6ec)];
  p.push(cyl(2.25, 2.0, 0.28, 0x6f7479, 0, 8.4, 0, 14), cyl(2.2, 2.2, 0.55, 0x8b9096, 0, 8.7, 0, 14));
  p.push(cyl(1.0, 1.0, 1.7, 0xffeaa8, 0, 9.75, 0, 12), cyl(0.2, 1.15, 0.7, 0xd9503c, 0, 11.0, 0, 12), ball(0.22, 0x34444c, 0, 11.5, 0));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.push(box(0.08, 1.7, 0.08, 0x34444c, Math.cos(a) * 1.01, 9.75, Math.sin(a) * 1.01)); }
  p.push(box(1.0, 1.5, 0.12, 0x34444c, 0, 1.7, 1.95));   // a door
  return finish(p, 0.2);
}
function quayWall() {
  // 4 m long, 3.4 m tall courses of stone blocks (the quay's face). Origin at the top edge (y = 0), the face toward -z.
  const p = [], cols = [0x9c968a, 0xa8a296, 0x8a847a, 0xb1ab9e], rows = 4, rh = 3.4 / rows;
  for (let r = 0; r < rows; r++) {
    const row = r % 2 ? [[-1.75, 0.5], [-1, 1], [0, 1], [1, 1], [1.75, 0.5]] : [[-1.5, 1], [-0.5, 1], [0.5, 1], [1.5, 1]];
    row.forEach(([cx, w], i) => p.push(box(w - 0.05, rh - 0.05, 0.9, cols[(r * 3 + i) % 4], cx, -rh * (r + 0.5), 0)));
  }
  p.push(box(4.0, 0.3, 2.7, 0xc2bcae, 0, -0.11, 0.85));   // the wide coping slab: its landward edge is a clean straight joint with the apron
  return finish(p, 0.2);
}

// ------------------------------------------------------------------ odds and ends
const crateStack = () => finish([
  box(0.62, 0.34, 0.42, 0x3d86c4, 0, 0.17, 0), box(0.62, 0.34, 0.42, 0xf0a63a, 0.05, 0.51, 0.02, 0.12), box(0.62, 0.34, 0.42, 0x3d86c4, -0.02, 0.85, -0.02, -0.1),
  box(0.62, 0.34, 0.42, 0xe8553d, 0.7, 0.17, 0.1, 0.3), box(0.62, 0.34, 0.42, 0x3d86c4, 0.7, 0.51, 0.12, 0.2)]);
const fishBin = () => finish([box(1.2, 0.8, 0.9, 0x3d86c4, 0, 0.4, 0), box(1.26, 0.1, 0.96, 0x2d6f9c, 0, 0.82, 0), box(1.0, 0.04, 0.7, 0xeaf4fa, 0, 0.7, 0)]);
const netPile = () => finish([ball(0.8, 0x4faa72, 0, 0.4, 0, 1.3, 0.55, 1), ball(0.55, 0x3e8f62, 0.6, 0.3, 0.3, 1, 0.6, 1), ball(0.4, 0x6fc08a, -0.5, 0.65, -0.1, 1, 0.7, 1), ball(0.16, 0xff8a3d, 0.9, 0.2, -0.4), ball(0.16, 0xff8a3d, -0.9, 0.2, 0.4)]);
const buoys = () => finish([ball(0.3, 0xff8a3d, 0, 0.3, 0), ball(0.28, 0xf2e8d0, 0.6, 0.28, 0.2), ball(0.3, 0xe8553d, 0.2, 0.3, 0.65), ball(0.26, 0xff8a3d, -0.5, 0.26, 0.4), cyl(0.04, 0.04, 0.3, 0x34444c, 0, 0.7, 0, 6)]);
const ropeCoil = () => finish([torus(0.45, 0.1, 0xd9c28a, 0, 0.1, 0, Math.PI / 2), torus(0.32, 0.1, 0xd9c28a, 0, 0.2, 0, Math.PI / 2), torus(0.2, 0.09, 0xd9c28a, 0, 0.3, 0, Math.PI / 2)]);
const bench = () => finish([box(1.8, 0.1, 0.5, 0xb88a58, 0, 0.5, 0), box(1.8, 0.4, 0.08, 0xa97b4b, 0, 0.8, -0.24), box(0.1, 0.5, 0.45, 0x34444c, -0.8, 0.25, 0), box(0.1, 0.5, 0.45, 0x34444c, 0.8, 0.25, 0)]);
const iceBox = () => finish([box(1.5, 1.0, 1.0, 0xf3f6f6, 0, 0.5, 0), box(1.56, 0.1, 1.06, 0x3d86c4, 0, 1.05, 0), box(0.5, 0.12, 0.08, 0x2d6f9c, 0.3, 0.7, 0.52)]);

export function buildHarbourModels() {
  const m = new Map();
  m.set('wharf_deck', wharfDeck()); m.set('wharf_pile', wharfPile()); m.set('bollard', bollard()); m.set('lamp_post', lampPost());
  m.set('trawler_blue', trawler()); m.set('trawler_red', trawler({ len: 12.5, beam: 3.8, stripe: 0xd9503c, roof: 0xd9503c, gear: 0x5a7fa6 }));
  m.set('trawler_green', trawler({ len: 9.5, beam: 3.2, stripe: 0x3e8f62, roof: 0x3e8f62, cabin: 0xfff3d2, gear: 0xd9503c }));
  m.set('coop', coop()); m.set('lighthouse', lighthouse()); m.set('quay_wall', quayWall());
  for (let v = 0; v < 3; v++) m.set(`armour_rock_${v}`, armourRock(v));
  m.set('fuel_bowser', fuelBowser()); m.set('kiosk', kiosk()); m.set('umbrella_table', umbrellaTable()); m.set('planter', planter()); m.set('net_rack', netRack()); m.set('sandwich_board', sandwichBoard()); m.set('crab_pots', crabPots()); m.set('wheelie_bins', wheelieBins()); m.set('boat_trailer', boatTrailer());
  m.set('crate_stack', crateStack()); m.set('fish_bin', fishBin()); m.set('net_pile', netPile()); m.set('buoys', buoys()); m.set('rope_coil', ropeCoil()); m.set('bench', bench()); m.set('ice_box', iceBox());
  return m;
}
