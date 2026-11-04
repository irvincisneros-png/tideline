// Named places where people stand, sit, fish and walk, per site (the names the schedules in src/content/npcs.js use). They are computed from the
// site's own landmarks (the jetty, the shoreline, the lifeguard tower) so they stay right if a site is reshaped.
import { smoothstep } from '../core/noise.js';
import { shoreZ, JETTY } from '../ecosystems/seagrass.js';
import { BEACH_SPOTS, beachAt, S_TOWER, BOARD } from '../world/bellambi.js';
import { T as quayT } from '../world/belmore.js';
const qp = (a, b) => { const [x, z] = quayT(a, b); return { x, z }; };   // a spot on Belmore Basin's quay, in the quay frame (world/belmore.js)

const lakeMud = x => smoothstep(-26, -46, x);
const lakeShoreAt = x => shoreZ(x) - lakeMud(x) * 9;   // the waterline (the mud bank pushes the mangrove edge out into the lake)
export const HUT = { x: JETTY.x - 11, z: shoreZ(JETTY.x - 11) + 13 };   // the bait-shop hut (seagrass.js decorate)

const pt = b => ({ x: b.x, z: b.z });
export const PLACES = {
  seagrass: {
    hutDoor: { x: HUT.x + 1.6, z: HUT.z - 4.6 },
    jettySeat: { x: JETTY.x + 0.1, z: JETTY.z0 - 13 },
    jettyBase: { x: JETTY.x, z: JETTY.z0 - 2.5 },
    jettyEnd: { x: JETTY.x - 0.55, z: JETTY.z1 + 1.9 },
    jettyEnd2: { x: JETTY.x + 0.6, z: JETTY.z1 + 1.9 },
    ramp: { x: 26.4, z: shoreZ(26.4) + 2.4 },
    rampWest: { x: 34.5, z: shoreZ(34.5) + 2.6 },
    mangrove: { x: -47, z: lakeShoreAt(-47) + 4.2 },
    mangroveNear: { x: -38, z: lakeShoreAt(-38) + 4.2 },
    bankEast: { x: 41, z: shoreZ(41) + 1.1 },
    patrolA: { x: 34, z: shoreZ(34) + 6 },
    patrolB: { x: 64, z: shoreZ(64) + 6 },
  },
  harbour: {
    wharfEnd: qp(11.6, 14.4),
    wharfBase: qp(12, 44.4),
    coopDoor: qp(-27, 45.8),
    benchWest: qp(-4, 43.4),
  },
  rocky: {   // Bellambi: the lifeguard stands in front of the tower, the club board is at the back of the beach (world/bellambi.js)
    tower: (() => { const b = beachAt(S_TOWER + 1.5, 4.8); return { x: b.x, z: b.z }; })(),
    board: (() => { const b = beachAt(S_TOWER + 9, 23.8); return { x: b.x, z: b.z }; })(),
    litterA: pt(BEACH_SPOTS.litterA), litterB: pt(BEACH_SPOTS.litterB), litterC: pt(BEACH_SPOTS.litterC), litterD: pt(BEACH_SPOTS.litterD),
    gutter: pt(BEACH_SPOTS.gutter), gutter2: pt(BEACH_SPOTS.gutter2),
    patrolA: pt(BEACH_SPOTS.patrolA), patrolB: pt(BEACH_SPOTS.patrolB),
  },
};
/** Props the NPC system adds to a site (not done by the site's own decorate): where the boat ramp and the club board go. */
export const EXTRAS = {
  seagrass: { ramp: { x: 29.2, z: shoreZ(29.2), len: 7, w: 3.2 } },
  rocky: { board: { x: BOARD.x, z: BOARD.z } },
};
