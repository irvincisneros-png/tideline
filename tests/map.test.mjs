// The map's data comes from each site's own layout: spots, safety zones, people, "?" marks and the region map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ECOSYSTEMS } from '../src/ecosystems/index.js';
import { SPOTS } from '../src/fishing/catches.js';
import { buildSiteMap, uncaughtAt, safetyState, npcMarkers, REGION_SITES, VIEWS, project, placeLabels, contourLoops, smoothLoop, smoothContours, legendFor, depthLevels } from '../src/ui/mapData.js';
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

// ---------------------------------------------------------------- the vector map: labels, outlines, legend
const box = (b, pad = 0) => ({ x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 });
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
test('placeLabels: no two placed labels overlap each other or another marker, and every label stays on the map', () => {
  const items = [], obstacles = [];
  for (let i = 0; i < 40; i++) { const x = 30 + (i * 37) % 300, y = 20 + (i * 53) % 160; items.push({ id: 'm' + i, x, y, r: 8, w: 60, h: 16, priority: i % 5 }); obstacles.push({ id: 'm' + i, x: x - 8, y: y - 8, w: 16, h: 16 }); }
  const { placed, dropped } = placeLabels(items, { w: 360, h: 200 }, obstacles);
  assert.equal(placed.length + dropped.length, items.length);
  assert.ok(placed.length > 5 && dropped.length > 0, 'a crowded map drops some labels instead of piling them up');
  placed.forEach((p, i) => {
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 360 && p.y + p.h <= 200, 'inside the map');
    for (const q of placed.slice(i + 1)) assert.ok(!hit(p, q), `${p.id} and ${q.id} overlap`);
    for (const o of obstacles) if (o.id !== p.id) assert.ok(!hit(p, o), `${p.id} covers the marker ${o.id}`);
  });
});
test('placeLabels: the higher priority label wins a contested spot, and a keep label is never dropped', () => {
  const items = [
    { id: 'low', x: 100, y: 50, r: 6, w: 60, h: 14, priority: 1 }, { id: 'high', x: 100, y: 50, r: 6, w: 60, h: 14, priority: 9 },
  ];
  const first = placeLabels(items, { w: 400, h: 100 }, []);
  assert.equal(first.placed.find(p => p.id === 'high').side, 'right', 'high priority takes the first (right-hand) spot');
  assert.notEqual(first.placed.find(p => p.id === 'low')?.side, 'right');
  // boxed in on every side by markers: dropped, unless it must stay
  const wall = [{ x: 0, y: 0, w: 200, h: 100 }];
  const solo = { id: 'a', x: 100, y: 50, r: 6, w: 40, h: 12, priority: 1 };
  assert.deepEqual(placeLabels([solo], { w: 200, h: 100 }, wall).dropped, ['a']);
  assert.equal(placeLabels([{ ...solo, keep: true }], { w: 200, h: 100 }, wall).placed.length, 1);
  assert.deepEqual(placeLabels([], { w: 10, h: 10 }), { placed: [], dropped: [] });
  assert.ok(!hit(box(first.placed[0]), { x: 0, y: 0, w: 0, h: 0 }));
});
test('contourLoops: the outline of a blob is one closed loop around it, and a hole makes a second', () => {
  const cols = 12, rows = 10, f = new Float32Array(cols * rows);
  for (let j = 2; j < 8; j++) for (let i = 3; i < 9; i++) f[j * cols + i] = 1;
  const loops = contourLoops(f, cols, rows, 0.5);
  assert.equal(loops.length, 1);
  const xs = loops[0].map(p => p[0]), ys = loops[0].map(p => p[1]);
  assert.ok(Math.min(...xs) > 2.5 && Math.max(...xs) < 9.5 && Math.min(...ys) > 1.5 && Math.max(...ys) < 8.5, 'hugs the blob');
  f[5 * cols + 5] = 0; f[5 * cols + 6] = 0; f[4 * cols + 5] = 0; f[4 * cols + 6] = 0;
  assert.equal(contourLoops(f, cols, rows, 0.5).length, 2, 'the pond inside is its own loop');
  const sm = smoothLoop(loops[0], 2);
  assert.equal(sm.length, loops[0].length * 4);
  assert.equal(contourLoops(new Float32Array(cols * rows), cols, rows, 0.5).length, 0, 'empty field, no shapes');
  assert.equal(contourLoops(new Float32Array(cols * rows).fill(1), cols, rows, 0.5).length, 1, 'a field that is all inside closes just outside the map');
});
test('every site gets a smooth coastline and depth bands where the terrain has them', () => {
  const lake = maps.seagrass, reef = maps.reef;
  assert.ok(lake.hf.cols >= lake.cols * 2 - 1, 'a finer height grid than the spot grid');
  const shore = smoothContours(lake.hf.h, lake.hf.cols, lake.hf.rows, 0);
  assert.ok(shore.length >= 1 && shore.every(l => l.length > 20), 'the lake has a shoreline loop');
  assert.equal(smoothContours(reef.hf.h, reef.hf.cols, reef.hf.rows, 0).length, 0, 'the open-sea reef map has no land outline');
  assert.ok(depthLevels('reef').some(l => smoothContours(reef.hf.h, reef.hf.cols, reef.hf.rows, l).length >= 1), 'but it has depth contours'
  );
  for (const e of ECOSYSTEMS) assert.ok(depthLevels(e.id).some(l => { const f = maps[e.id].hf; return Math.min(...f.h) < l && Math.max(...f.h) > l; }), `${e.id}: at least one depth band cuts through the real terrain`);
});
test('every site shows its own landmarks, and the legend lists what is actually on the map', () => {
  const kinds = id => new Set(maps[id].pois.map(p => p.kind));
  assert.ok(kinds('seagrass').has('shop') && kinds('seagrass').has('ramp') && kinds('seagrass').has('jetty'));
  assert.ok(kinds('rocky').has('club') && kinds('rocky').has('tower'), 'the club board and the lifeguard tower at Bellambi');
  assert.ok(kinds('harbour').has('coop') && kinds('harbour').has('jetty'), "the co-op and the wharf at the harbour");
  assert.ok(VIEWS.seagrass.lines.length && VIEWS.harbour.lines.length, 'the jetty and wharf decks are drawn');
  for (const e of ECOSYSTEMS) {
    const lg = legendFor(maps[e.id], { npcs: [{}], boat: e.id === 'reef' }), keys = lg.map(l => l.key);
    assert.ok(keys.includes('you') && keys.includes('people') && keys.includes('spot'));
    assert.equal(keys.includes('danger'), !!maps[e.id].safety, `${e.id}: the danger entry only where there is a danger zone`);
    assert.equal(keys.includes('boat'), e.id === 'reef');
    assert.equal(new Set(lg.map(l => l.label)).size, lg.length, `${e.id}: no repeated legend entries`);
    for (const p of maps[e.id].pois) assert.ok(lg.some(l => l.label === (p.legend ?? p.label)), `${e.id}: ${p.id} is in the legend`);
  }
  assert.ok(!legendFor(maps.rocky, { npcs: [] }).some(l => l.key === 'people'), 'no people, no people entry');
});
