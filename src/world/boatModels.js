// The angler's boat for the offshore reef, made in code in the cosy, chunky, flat-shaded style (world/propKit.js): a 7.4 m aluminium centre-console with a solid curved hull, a sunk deck, a raised bow
// cuddy, a console with a windscreen, steering wheel and the fish finder screen, orange lifejackets on the rail, rod holders, an esky, an anchor on the bow and an outboard on the stern.
// Boat-local coordinates: the bow points to -z, the stern to +z, y = 0 is the waterline. The walkable deck is the rectangle BOAT_DECK (u across, v along), its floor at DECK_Y.
// Also: a marker buoy, and a small set of reef-top silhouettes are NOT here (the reef is terrain).
import * as THREE from 'three';
import { box, cyl, ball, torus, finish, loft, sheet, wall, cap } from './propKit.js';

export const DECK_Y = 0.6;                                         // the cockpit floor above the waterline
export const BOAT_DECK = { u: 1.0, v0: -1.15, v1: 3.1 };           // walkable: |u| <= 1.0, v from -1.15 (behind the console) to 3.1 (the stern)
export const BOAT_LEN = 7.4, BOAT_BEAM = 2.6;

function playerBoat() {
  const Lh = BOAT_LEN / 2, hb = BOAT_BEAM / 2, gun = 0.98;
  const Z = t => Lh - t * BOAT_LEN;                                  // t = 0 at the stern, 1 at the bow
  const half = t => hb * (t < 0.64 ? 0.96 + 0.04 * Math.min(1, t / 0.2) : Math.pow(Math.max(0, Math.cos(Math.min(1, (t - 0.64) / 0.36) * Math.PI / 2)), 0.7));
  const dy = t => gun + 0.3 * Math.pow(t, 2.4);                    // the sheer rises to the bow
  const dr = t => 0.52 * (t > 0.86 ? 1 - Math.pow((t - 0.86) / 0.14, 1.4) * 0.8 : 1) * (t < 0.06 ? 0.8 + 3.3 * t : 1);
  const N = 18, K = 13, rings = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, row = [];
    for (let j = 0; j < K; j++) {
      const a = (j / (K - 1)) * Math.PI, c = Math.cos(a), sn = Math.sin(a);
      row.push([-Math.sign(c) * Math.pow(Math.abs(c), 0.9) * half(t), dy(t) - (dy(t) + dr(t)) * Math.pow(Math.max(0, sn), 0.62), Z(t)]);
    }
    rings.push(row);
  }
  const p = [];
  p.push(loft(rings, (u, v) => { const d = Math.min(v, 1 - v); return d < 0.07 ? 0x2a8c96 : d < 0.3 ? 0xf4f1e8 : 0x4e5a62; }));   // teal sheer stripe, white topsides, a dark grey bottom
  p.push(cap(rings[0], 0xf4f1e8, [0, 0, 1]));                                                                                   // the transom
  // the inside of the hull: grey-blue sides above the sunk deck, a rim along the gunwale, and the cockpit floor
  for (const sd of [-1, 1]) {
    const low = [], high = [], rim = [];
    for (let i = 1; i <= N - 3; i++) { const t = i / N; low.push([sd * (half(t) * 0.93), DECK_Y, Z(t)]); high.push([sd * (half(t) * 0.975), dy(t), Z(t)]); }
    p.push(...wall(low, high, 0xf4f1e8, 0xc9d6dc, [sd, 0, 0]));
    for (let i = 1; i <= N - 3; i += 1) { const t = i / N; rim.push(box(0.12, 0.07, BOAT_LEN / N + 0.05, 0x2a8c96, sd * half(t) * 0.97, dy(t) + 0.02, Z(t))); }
    p.push(...rim);
  }
  const fl = [], fr = [];
  for (let i = 1; i <= N - 3; i++) { const t = i / N; fl.push([-half(t) * 0.93, DECK_Y, Z(t)]); fr.push([half(t) * 0.93, DECK_Y, Z(t)]); }
  p.push(sheet(fl, fr, 0xd7d3c4, 1));
  for (let i = 0; i < 9; i++) p.push(box(1.9, 0.02, 0.06, 0xc0bcab, 0, DECK_Y + 0.012, Z(0.04) - i * 0.42));                    // non-slip deck lines
  // the bow cuddy and foredeck: a raised cover over the front, with a hatch, an anchor and a rope coil
  const zb = Z(0.74), zf = Z(0.93);
  const fore = [], foreR = [];
  for (let i = 13; i <= N - 1; i++) { const t = i / N; fore.push([-half(t) * 0.96, dy(t) + 0.05, Z(t)]); foreR.push([half(t) * 0.96, dy(t) + 0.05, Z(t)]); }
  p.push(sheet(fore, foreR, 0xf4f1e8, 1));
  p.push(box(1.7, 0.06, 0.05, 0x2a8c96, 0, gun + 0.12, zb - 0.1), box(0.8, 0.08, 0.7, 0xdfe7ea, 0, gun + 0.16, (zb + zf) / 2 + 0.1), box(0.7, 0.04, 0.6, 0x8aa3ad, 0, gun + 0.21, (zb + zf) / 2 + 0.1));
  p.push(torus(0.18, 0.035, 0x5b636a, 0, gun + 0.45, zf - 0.35, 0), cyl(0.04, 0.04, 0.8, 0x5b636a, 0, gun + 0.25, zf - 0.1, 6, Math.PI / 2, 0));   // the bow roller and ring
  p.push(torus(0.22, 0.06, 0xd9c28a, 0.45, gun + 0.2, (zb + zf) / 2 - 0.25, Math.PI / 2), torus(0.15, 0.06, 0xd9c28a, 0.45, gun + 0.3, (zb + zf) / 2 - 0.25, Math.PI / 2));   // a coil of anchor rope
  p.push(cyl(0.025, 0.025, 0.9, 0x6b747a, 0, gun + 0.7, zf - 0.55, 6), ball(0.05, 0xe8553d, 0, gun + 1.18, zf - 0.55));                       // a bow light post
  // the console: a box with a sloped front, a dark windscreen, a steering wheel, the fish finder screen and a grab rail
  const cz = -1.72;
  p.push(box(1.05, 0.82, 0.95, 0xf4f1e8, 0, DECK_Y + 0.41, cz), box(1.1, 0.07, 1.0, 0x2a8c96, 0, DECK_Y + 0.85, cz), box(1.0, 0.07, 0.35, 0x34444c, 0, DECK_Y + 0.9, cz - 0.25, 0, 0.45));
  p.push(box(1.0, 0.5, 0.05, 0x7ab0c4, 0, DECK_Y + 1.18, cz - 0.38, 0, -0.18), box(1.06, 0.05, 0.06, 0xdfe7ea, 0, DECK_Y + 0.93, cz - 0.4), box(1.06, 0.05, 0.06, 0xdfe7ea, 0, DECK_Y + 1.44, cz - 0.34, 0, -0.18));
  for (const sx of [-0.5, 0.5]) p.push(box(0.05, 0.55, 0.05, 0xdfe7ea, sx, DECK_Y + 1.17, cz - 0.36, 0, -0.18));
  p.push(torus(0.16, 0.03, 0x34444c, 0, DECK_Y + 1.0, cz + 0.3, 0.9), box(0.5, 0.32, 0.06, 0x24282c, 0.0, DECK_Y + 1.05, cz + 0.12, 0, 0.5), box(0.42, 0.24, 0.02, 0x2fd0e0, 0, DECK_Y + 1.06, cz + 0.095, 0, 0.5));
  p.push(cyl(0.025, 0.025, 1.0, 0xdfe7ea, -0.5, DECK_Y + 1.0, cz + 0.45, 6), cyl(0.025, 0.025, 1.0, 0xdfe7ea, 0.5, DECK_Y + 1.0, cz + 0.45, 6), box(1.05, 0.04, 0.04, 0xdfe7ea, 0, DECK_Y + 1.52, cz + 0.45));
  p.push(box(0.4, 0.14, 0.26, 0xff7a1a, -0.28, DECK_Y + 0.9, cz + 0.4, 0.2), box(0.4, 0.14, 0.26, 0xff7a1a, 0.28, DECK_Y + 0.9, cz + 0.4, -0.2), box(0.34, 0.12, 0.24, 0xffb020, 0, DECK_Y + 1.58, cz + 0.45));          // orange lifejackets on the rail
  // seats: a fold-down bench at the stern each side, an esky and a tackle box
  p.push(box(0.55, 0.12, 0.9, 0xc9d6dc, -0.7, DECK_Y + 0.34, 2.45), box(0.55, 0.12, 0.9, 0xc9d6dc, 0.7, DECK_Y + 0.34, 2.45), box(0.5, 0.34, 0.8, 0x2a8c96, -0.7, DECK_Y + 0.17, 2.45), box(0.5, 0.34, 0.8, 0x2a8c96, 0.7, DECK_Y + 0.17, 2.45));
  p.push(box(0.8, 0.5, 0.55, 0x3d86c4, 0.0, DECK_Y + 0.25, 3.0), box(0.84, 0.06, 0.59, 0xeaf4fa, 0, DECK_Y + 0.53, 3.0), box(0.5, 0.2, 0.34, 0xe8553d, -0.2, DECK_Y + 0.1, 0.4), box(0.5, 0.04, 0.34, 0xf0b73c, -0.2, DECK_Y + 0.22, 0.4));
  // rod holders along both gunwales (angled tubes), two rods stowed upright
  for (const sd of [-1, 1]) for (const z of [0.5, 1.4, 2.3]) p.push(cyl(0.05, 0.05, 0.3, 0x5b636a, sd * (half(0.4) * 0.97), dy(0.4) + 0.12, z, 7, 0, sd * 0.2));
  // the outboard on the transom: a white cowl, a dark leg, a prop (partly under the water), a bracket
  p.push(box(0.5, 0.6, 0.62, 0xf4f1e8, 0, 0.78, Lh + 0.5), box(0.52, 0.12, 0.64, 0x2a8c96, 0, 1.12, Lh + 0.5), box(0.2, 0.9, 0.3, 0x4e5a62, 0, 0.1, Lh + 0.5), box(0.5, 0.18, 0.12, 0x6b747a, 0, -0.4, Lh + 0.5), box(0.7, 0.12, 0.3, 0x6b747a, 0, 0.55, Lh + 0.22));
  p.push(box(0.14, 0.18, 0.22, 0x34444c, 0, 0.4, Lh + 0.5), cyl(0.045, 0.045, 0.6, 0x34444c, 0, 0.5, Lh + 0.72, 6, Math.PI / 2, 0));   // the tilt handle and a fuel line
  // fenders hung on the topsides, a name board, and a flag on a short staff
  for (const sd of [-1, 1]) for (const z of [-0.6, 1.5]) p.push(cyl(0.1, 0.1, 0.45, 0xf0f2f2, sd * (half(0.5) + 0.12), 0.55, z, 8), cyl(0.012, 0.012, 0.3, 0xdfe7ea, sd * (half(0.5) + 0.05), 0.95, z, 4));
  p.push(box(0.04, 0.3, 0.9, 0xfff4de, hb * 0.99 - 0.01, 0.6, -0.9), box(0.04, 0.2, 0.7, 0xe8553d, -hb * 0.99 + 0.01, 0.6, -0.9));
  return finish(p, 0.2);
}
/** A marker buoy: a red-and-white float with a little flag on a staff (a waypoint the chartplotter would mark). Origin at the waterline. */
function markerBuoy() {
  return finish([cyl(0.3, 0.3, 0.5, 0xe8553d, 0, 0.1, 0, 10), cyl(0.3, 0.3, 0.2, 0xfff4de, 0, 0.45, 0, 10), cyl(0.02, 0.02, 1.5, 0x34444c, 0, 1.3, 0, 5), box(0.5, 0.3, 0.02, 0xf0b73c, 0.25, 1.85, 0)]);
}
/** A pair of far-off headlands, for the horizon on the title view (the Five Islands off Port Kembla): low dark humps. Origin on the water. */
export function buildBoatModels() {
  const m = new Map();
  m.set('player_boat', playerBoat()); m.set('marker_buoy', markerBuoy());
  return m;
}
