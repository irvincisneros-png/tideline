// Named places where people stand, sit, fish and walk, per site (the names the schedules in src/content/npcs.js use). They are computed from the
// site's own landmarks (the jetty, the shoreline, the lifeguard tower) so they stay right if a site is reshaped.
import { smoothstep } from '../core/noise.js';
import { shoreZ, JETTY } from '../ecosystems/seagrass.js';

const lakeMud = x => smoothstep(-26, -46, x);
const lakeShoreAt = x => shoreZ(x) - lakeMud(x) * 9;   // the waterline (the mud bank pushes the mangrove edge out into the lake)
const HUT = { x: JETTY.x - 11, z: shoreZ(JETTY.x - 11) + 13 };   // the bait-shop hut (seagrass.js decorate)

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
  rocky: {
    tower: { x: -9.8, z: 95.6 },
    board: { x: -4.4, z: 112.4 },
    litterA: { x: -52, z: 95.8 }, litterB: { x: -20, z: 94.8 }, litterC: { x: 16, z: 95.4 }, litterD: { x: 44, z: 96.4 },
    gutter: { x: 18, z: 87 }, gutter2: { x: -26, z: 87.2 },
    patrolA: { x: -62, z: 92 }, patrolB: { x: 36, z: 92 },
  },
};
/** Props the NPC system adds to a site (not done by the site's own decorate): where the boat ramp and the club board go. */
export const EXTRAS = {
  seagrass: { ramp: { x: 29.2, z: shoreZ(29.2), len: 7, w: 3.2 } },
  rocky: { board: { x: -6.6, z: 113.6 } },
};
