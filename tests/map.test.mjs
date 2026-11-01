// The map's data comes from each site's own layout: spots, safety zones, people, "?" marks and the region map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ECOSYSTEMS } from '../src/ecosystems/index.js';
import { SPOTS } from '../src/fishing/catches.js';
import { buildSiteMap, uncaughtAt, safetyState, npcMarkers, REGION_SITES, VIEWS, project } from '../src/ui/mapData.js';
import { siteLock } from '../src/ecosystems/unlock.js';
import { migrateProgress } from '../src/core/save.js';

const EXPECT = {
  rocky: ['beach', 'rock'], seagrass: ['flats', 'seagrass', 'channel', 'jetty', 'mangrove'], harbour: ['wharf', 'breakwall', 'basin'],
  reef: ['reef'], river: ['pool', 'weir', 'snags'],
};
const maps = Object.fromEntries(ECOSYSTEMS.map(e => [e.id, buildSiteMap(e)]));

test('every site has a map view and finds its own fishing spots', () => {
  for (const e of ECOSYSTEMS) {
    const got = new Set(maps[e.id].spots.map(s => s.spot));
    for (const sp of EXPECT[e.id]) assert.ok(got.has(sp), `${e.id} map is missing the ${sp} spot`);
    for (const s of maps[e.id].spots) assert.ok(SPOTS[s.spot], `${s.spot} is a real spot`);
  }
});
test('spot icons sit inside the map and on the right kind of cell', () => {
  for (const e of ECOSYSTEMS) {
    const m = maps[e.id], v = VIEWS[e.id];
    for (const s of m.spots) {
      assert.ok(s.x >= v.x0 && s.x <= v.x1 && s.z >= v.z0 && s.z <= v.z1, `${e.id}/${s.spot} inside the view`);
      assert.equal(e.fishing.spotAt(s.x, s.z, s.x, s.z), s.spot, `${e.id}: the ${s.spot} icon is on ${s.spot}`);
    }
    for (const p of m.pois) assert.ok(p.x >= v.x0 && p.x <= v.x1 && p.z >= v.z0 && p.z <= v.z1, `${e.id}/${p.id} landmark inside the view`);
  }
});
test('the sea is where the terrain says it is', () => {
  const r = maps.rocky, i = Math.floor((0 - r.view.x0) / r.view.cell), jw = Math.floor((45 - r.view.z0) / r.view.cell), jl = Math.floor((125 - r.view.z0) / r.view.cell);
  assert.equal(r.land[jw * r.cols + i], 0, 'water off Bellambi beach'); assert.equal(r.land[jl * r.cols + i], 1, 'dunes behind it');
  assert.ok(maps.river.land.some(x => x) && maps.river.land.some(x => !x), 'the river has both banks and water');
  assert.ok(maps.reef.land.every(x => !x), 'the offshore reef map is all water');
});
test('the shop is only where Mitra is, and every site has a way home', () => {
  assert.deepEqual(ECOSYSTEMS.filter(e => maps[e.id].pois.some(p => p.kind === 'shop')).map(e => e.id), ['seagrass']);
  for (const e of ECOSYSTEMS.filter(x => x.id !== 'reef')) assert.ok(maps[e.id].pois.some(p => p.kind === 'home' || p.home), `${e.id} has a head-home marker`);
});
test('safety zones: the rock platform and the breakwall, live only in a big swell', () => {
  assert.ok(maps.rocky.safety && maps.rocky.safety.cells > 100);
  assert.ok(maps.harbour.safety && maps.harbour.safety.cells > 50);
  assert.equal(maps.seagrass.safety, null); assert.equal(maps.river.safety, null);
  assert.equal(safetyState(maps.rocky, 1.2).active, false);
  assert.equal(safetyState(maps.rocky, 2.5).active, true);
  assert.equal(safetyState(maps.harbour, 3).active, true);
  assert.equal(safetyState(maps.river, 5), null);
  // the harbour zone is the same test the lifeguard / Nell use
  const h = ECOSYSTEMS.find(e => e.id === 'harbour');
  for (let k = 0; k < maps.harbour.safe.length; k += 37) if (maps.harbour.safe[k]) {
    const x = VIEWS.harbour.x0 + ((k % maps.harbour.cols) + 0.5) * VIEWS.harbour.cell, z = VIEWS.harbour.z0 + (((k / maps.harbour.cols) | 0) + 0.5) * VIEWS.harbour.cell;
    assert.ok(h.hazard.at(x, z));
  }
});
test('"?" marks: species at a spot you have not caught yet', () => {
  const fresh = migrateProgress({});
  const all = SPOTS.beach.fish.map(f => f[0]);
  assert.deepEqual(uncaughtAt(fresh, 'beach').sort(), all.slice().sort());
  const p = migrateProgress({});
  p.guide.e[all[0]] = { seen: { t: 1 }, caught: { t: 1, n: 1, count: 1 } };
  assert.equal(uncaughtAt(p, 'beach').length, all.length - 1);
  assert.ok(!uncaughtAt(p, 'beach').includes(all[0]));
  p.guide.e[all[1]] = { seen: { t: 1 } };    // only seen: still a "?"
  assert.ok(uncaughtAt(p, 'beach').includes(all[1]));
  assert.deepEqual(uncaughtAt(p, 'nowhere'), []);
});
test('people on the map: names, and nobody who is away', () => {
  const list = npcMarkers([{ id: 'mitra', away: false, pos: { x: 1, z: 2 } }, { id: 'tam', away: true, pos: { x: 0, z: 0 } }, { id: 'ghost', away: false, pos: { x: 0, z: 0 } }]);
  assert.deepEqual(list.map(n => n.name), ['Mitra']);
  assert.deepEqual([list[0].x, list[0].z], [1, 2]);
});
test('the region map shows all five sites with their locks', () => {
  assert.deepEqual(REGION_SITES.map(s => s.id).sort(), ECOSYSTEMS.map(e => e.id).sort());
  for (const s of REGION_SITES) assert.ok(s.x > 0 && s.x < 100 && s.y > 0 && s.y < 100 && s.where && s.how);
  const north = id => REGION_SITES.find(s => s.id === id).y;
  assert.ok(north('rocky') < north('harbour') && north('harbour') < north('seagrass'), 'Bellambi is north of Wollongong, which is north of the lake');
  const fresh = migrateProgress({});
  const locked = ECOSYSTEMS.filter(e => siteLock(fresh, e).locked).map(e => e.id).sort();
  assert.deepEqual(locked, ['harbour', 'reef', 'river']);
  assert.ok(siteLock(fresh, ECOSYSTEMS.find(e => e.id === 'reef')).text.length > 10);
});
test('project() puts north (small z) at the top of the page', () => {
  const v = VIEWS.river; assert.deepEqual(project(v, v.x0, v.z0, 100, 50), [0, 0]); assert.deepEqual(project(v, v.x1, v.z1, 100, 50), [100, 50]);
});
