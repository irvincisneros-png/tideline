// The sites that are modelled on real places keep the real layout: Bellambi (sea to the east, the point, the ramp cove, the rock pool), Belmore Basin (a walled basin opening into an outer
// harbour behind a breakwater), Cudgeree Bay at Windang (a straight east shore that turns away south-west, a sand bar, the lake to the west) and the Five Islands off Port Kembla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smoothPath, DistField, Path, inPoly } from '../src/world/shape.js';
import * as BL from '../src/world/bellambi.js';
import * as BM from '../src/world/belmore.js';
import { rocky } from '../src/ecosystems/rocky.js';
import { harbour } from '../src/ecosystems/harbour.js';
import { seagrass, shoreZ, chanZ, heightAt as lakeH, ISLETS, FRAME as LAKE_FRAME } from '../src/ecosystems/seagrass.js';
import { FIVE_ISLANDS } from '../src/ecosystems/reef.js';
import { REGION_SITES, VIEWS, toMap, toWorld } from '../src/ui/mapData.js';

test('shape helpers: smooth paths pass through their points, the distance field is signed and metric, paths measure arc length', () => {
  const pts = [[0, 0], [10, 5], [20, 0], [30, 8]], sp = smoothPath(pts, 5);
  for (const p of pts) assert.ok(sp.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9), 'goes through every control point');
  const sq = [[-20, -20], [20, -20], [20, 20], [-20, 20]], f = new DistField(sq, { half: 40, cell: 1 });
  assert.ok(Math.abs(f.at(0, 0) - 20) < 0.6, 'the middle of a 40 m square is 20 m from its edge'); assert.ok(Math.abs(f.at(30, 0) + 10) < 0.6, 'outside is negative'); assert.ok(f.at(0, 19) > 0 && f.at(0, 21) < 0);
  assert.ok(inPoly(0, 0, sq) && !inPoly(25, 0, sq));
  const path = new Path([[0, 0], [30, 0], [30, 40]]); assert.equal(path.length, 70); assert.deepEqual([path.at(45).x, path.at(45).z], [30, 15]); assert.ok(Math.abs(path.nearest(31, 10).s - 40) < 1e-9);
});

test('Bellambi: the sea is to the east, the beach curves down into the point and the point hooks out to the east', () => {
  const east = (x, z) => -z, h = rocky.heightAt;                                           // world -z is east
  assert.ok(h(0, -150) < -3 && h(60, -150) < -3, 'open sea east of the point'); assert.ok(h(40, 90) > 1 && h(-30, 100) > 1, 'land to the west');
  const tip = BL.beachAt(BL.S_TIP, 0), north = BL.beachAt(BL.S_BEACH_N, 0), south = BL.beachAt(BL.S_BEACH_S, 0);
  assert.ok(east(tip.x, tip.z) > east(north.x, north.z) + 90 && east(tip.x, tip.z) > east(south.x, south.z) + 50, 'the point sticks well out past both beaches');
  assert.ok(north.x < tip.x - 50 && south.x > tip.x + 50, 'the north beach is north (x down) of the point and the south beach south of it');
  // the beach runs south-east into the cove: heading east between the pool and the ramp
  assert.ok(BL.beachAt(BL.S_RAMP, 0).z < BL.beachAt(BL.S_POOL, 0).z - 15, 'the ramp is further east than the rock pool');
  assert.ok(BL.beachAt(BL.S_POOL, 0).x < BL.beachAt(BL.S_RAMP, 0).x, 'and the pool is north of the ramp');
});

test('Bellambi: the rock platform fringes the point (irregular, not on the beaches), the pools are in it, the ramp and rock pool exist', () => {
  const pm = BL.platformMask, tip = BL.beachAt(BL.S_TIP, -6);
  assert.ok(pm(tip.x, tip.z) > 0.9, 'platform at the tip');
  for (const s of [BL.S_TOWER, BL.S_POOL, BL.S_BEACH_S - 20]) { const b = BL.beachAt(s, -4); assert.equal(pm(b.x, b.z), 0, 'no platform on the beaches'); }
  let on = 0, tot = 0; for (let o = -45; o <= 30; o += 2) for (let s = BL.S_PT0; s < BL.S_PT1; s += 3) { const b = BL.beachAt(s, o); tot++; if (pm(b.x, b.z) > 0.3) on++; }
  assert.ok(on > 80 && on / tot < 0.5, `a band along the outer edge of the point, not a block (${on} of ${tot})`);
  assert.ok(rocky.fishing.spotAt(tip.x, tip.z, tip.x, tip.z) === 'rock' && rocky.fishing.spotAt(...Object.values(BL.TOWER).slice(0, 2)) === 'beach');
  const R = BL.RAMP; assert.ok(rocky.heightAt(R.x0, R.z0) > 0.8 && rocky.heightAt(R.x0 + R.nx * 14, R.z0 + R.nz * 14) < -0.3, 'the ramp runs from the sand down into the water');
  assert.ok(BL.coveAt(R.x0 + R.nx * 12, R.z0 + R.nz * 12) > 0.3, 'the ramp is in the sheltered cove');
  const P = BL.ROCKPOOL, c = { x: P.x + P.nx * 4.7, z: P.z + P.nz * 4.7 };
  assert.ok(rocky.heightAt(c.x, c.z) < -0.8, 'the rock pool is a basin below the waterline'); assert.ok(rocky.heightAt(c.x + P.tx * 8.6, c.z + P.tz * 8.6) > 0.4, 'with a wall round it');
  assert.equal(BL.POOLS.length, 12);
});

test('Bellambi: people and props stand on dry sand, and the map is turned so north is at the top', () => {
  for (const p of [BL.TOWER, BL.SPAWN, BL.BOARD, BL.HOME, ...Object.values(BL.BEACH_SPOTS)]) assert.ok(rocky.heightAt(p.x, p.z) > 0.1, 'dry');
  assert.ok(rocky.heightAt(rocky.land.spawn.x, rocky.land.spawn.z) > 1);
  const v = VIEWS.rocky; assert.ok(v.orient === BL.FRAME && rocky.frame === BL.FRAME);
  const [u, vv] = toMap(v, 10, 0); assert.deepEqual([u + 0, vv], [0, 10], 'world +x (south) is down the page, world -z (east) is right'); assert.deepEqual(toWorld(v, 0, 10).map(n => Math.round(n) + 0), [10, 0]);
  // the sea is on the right of the map and the beach on the left
  const at = (u, vv) => { const [x, z] = toWorld(v, u, vv); return rocky.heightAt(x, z); };
  assert.ok(at(120, 0) < -2 && at(-60, 60) > 1);
});

test('Belmore Basin: a walled rectangular basin opening west into the outer harbour; a breakwater with a lighthouse closes the harbour to the north-east; Cove Beach west, Flagstaff Hill east', () => {
  const h = harbour.heightAt, d = BM.landD;
  const B = BM.BASIN, mid = BM.T((B.a0 + B.a1) / 2, (B.b0 + B.b1) / 2);
  assert.ok(h(...mid) < -1.5 && d(...mid) < 0, 'water in the basin');
  for (const [a, b] of [[0, B.b0 - 3], [0, B.b1 + 3], [B.a0 - 3, 20]]) assert.ok(h(...BM.T(a, b)) > 1, `land round the basin at ${a},${b} (walls on the south-east, north-east and east sides)`);
  assert.ok(h(...BM.T(B.a1 + 8, 20)) < -2, 'the mouth is open to the west'); assert.ok(h(...BM.fromPx(250, 330)) < -2 && h(...BM.fromPx(330, 200)) < -2, 'into the outer harbour');
  // north is up: the lighthouse is north of the basin, the breakwater runs from the south-east headland to it, Cove Beach is west of the basin, Flagstaff Hill east
  assert.ok(BM.LIGHTHOUSE[1] < mid[1] - 40, 'the lighthouse is well north of the basin'); assert.ok(BM.CREST.at(0).x > BM.LIGHTHOUSE[0] + 100 && BM.CREST.at(0).z > BM.LIGHTHOUSE[1], 'the breakwater runs out from the east');
  assert.ok(BM.COVE_BEACH.x < mid[0] - 70, 'Cove Beach is west'); assert.ok(BM.HILL.x > mid[0] + 50 && h(BM.HILL.x, BM.HILL.z) > 5, 'and Flagstaff Hill rises to the east');
  for (let s = 10; s < BM.CREST.length - 10; s += 12) { const p = BM.CREST.at(s); assert.ok(h(p.x, p.z) > 1.8, `the breakwater crest is above the water at ${s.toFixed(0)}`); }
  // inside the breakwater is shallow harbour, outside it is deep
  const p = BM.CREST.at(70), sea = [p.x + 14 * p.tz, p.z - 14 * p.tx], inner = [p.x - 14 * p.tz, p.z + 14 * p.tx], deep = [BM.crestNear(...sea), BM.crestNear(...inner)].find(c => c.side > 0) ? sea : inner;
  assert.ok(Math.min(h(...sea), h(...inner)) > Math.max(h(...sea), h(...inner)) - 12 && Math.min(h(...sea), h(...inner)) < -3);
  assert.ok(harbour.heightAt(...harbour.land.spawn && [harbour.land.spawn.x, harbour.land.spawn.z]) > 1 && harbour.waterOnly);
  assert.ok(!VIEWS.harbour.orient, 'the harbour map is not turned: north is already up');
});

test('Cudgeree Bay at Windang: the lake is to the west, the shore runs north-south and turns south-west, with a sand bar on the flats and a channel; the mangrove patch is small and at the south', () => {
  assert.ok(VIEWS.seagrass.orient === LAKE_FRAME && seagrass.frame === LAKE_FRAME);
  const [u, v] = toMap(VIEWS.seagrass, 10, 0); assert.deepEqual([u + 0, v], [0, -10], 'world +x is north (up the page), world +z is east (right)');
  assert.ok(Math.abs(shoreZ(60) - shoreZ(10)) < 14, 'the shore is nearly straight, running north-south, for 50 m'); assert.ok(shoreZ(-60) < shoreZ(0) - 60, 'then it turns away south-west');
  assert.ok(lakeH(30, shoreZ(30) - 3) > -0.3 && lakeH(30, shoreZ(30) - 20) > -1.2, 'wide shallow flats off the shore'); assert.ok(lakeH(30, chanZ(30)) < -1.5, 'a deeper channel along their edge'); assert.ok(lakeH(30, chanZ(30) - 80) < -2, 'and the lake beyond');
  assert.ok(lakeH(83, -10) > 0, 'the sand bar stands just above the water'); assert.ok(lakeH(83 + 12, -10) < -0.1 && lakeH(83 - 12, -10) < -0.1, 'with water on both sides');
  assert.ok(ISLETS.every(([x, z]) => z < -60 && lakeH(x, z) > 0.5), 'low wooded islets out in the lake, to the south-west');
  const mangroveRule = seagrass.coral.find(r => r[0] === 'mangrove')[2]; assert.equal(mangroveRule(40, shoreZ(40)), 0, 'no mangroves on the straight shore'); assert.ok(seagrass.coral.find(r => r[0] === 'mangrove')[1] <= 40, 'a small stand');
  // meadows are patchy: some of the flats are bare, some seagrass
  let m = 0, t = 0; for (let x = -20; x < 90; x += 3) for (let z = shoreZ(x) - 40; z < shoreZ(x) - 4; z += 3) { t++; if (seagrass.coral.find(r => r[0] === 'zostera')[2](x, z) > 0.5) m++; }
  assert.ok(m / t > 0.2 && m / t < 0.8, `patchy meadows (${(m / t * 100).toFixed(0)}% seagrass)`);
});

test('the Five Islands off Port Kembla: Big Island is the largest, the chain runs north-west to south-east, the coast is to the west; the Illawarra coast tab keeps the real order', () => {
  const big = FIVE_ISLANDS[0]; assert.equal(big.name, 'Big Island'); assert.ok(FIVE_ISLANDS.length === 5 && FIVE_ISLANDS.every(i => i === big || i.r < big.r));
  const chain = FIVE_ISLANDS.filter(i => i.name !== 'Little Island').sort((a, b) => a.x - b.x);
  for (let i = 1; i < chain.length; i++) assert.ok(chain[i].x > chain[i - 1].x && chain[i].z > chain[i - 1].z, 'each island is further south-east (x up, z up) than the last');
  const N = id => REGION_SITES.find(s => s.id === id), y = id => N(id).y;
  assert.ok(y('rocky') < y('harbour') && y('harbour') < y('reef') && y('reef') < y('seagrass'), 'Bellambi, Belmore Basin, the Five Islands off Port Kembla, Lake Illawarra: north to south');
  assert.ok(N('reef').x > N('harbour').x + 8, 'the Five Islands are offshore (east) of the coast');
  // spacing follows real distances: Bellambi to Belmore ~5.7 km, to Port Kembla ~12 km, to Windang ~17 km (about 3.9 units a km)
  assert.ok(Math.abs((y('harbour') - y('rocky')) / 3.9 - 5.7) < 1.5 && Math.abs((y('seagrass') - y('rocky')) / 3.9 - 16.9) < 1.5);
});
