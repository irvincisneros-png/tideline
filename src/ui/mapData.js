// The map's data, built from each site's own layout (its terrain, its fishing-spot function, its landmarks). Pure: no DOM, so it is unit tested.
//   buildSiteMap(eco)  -> a raster of the site (land colours, water depth, which fishing spot each cell belongs to, the safety zone) and the spot list.
//   uncaughtAt(progress, spot) -> species at that spot you have not caught yet (the "?" marks).
//   npcMarkers(npcs), safetyState(map, swell), REGION_SITES (the stylised Illawarra coast).
import { ECOSYSTEMS } from '../ecosystems/index.js';
import { SPOTS, SPOT_INFO } from '../fishing/catches.js';
import { tierOf } from '../fishing/guide.js';
import { NPCS } from '../content/npcs.js';
import { platformMask, POOLS, FRAME as BELLAMBI_FRAME } from '../ecosystems/rocky.js';
import { TOWER, BOARD, HOME as BELLAMBI_HOME, RAMP, ROCKPOOL, BREAKER } from '../world/bellambi.js';
import { JETTY, shoreZ, FRAME as LAKE_FRAME } from '../ecosystems/seagrass.js';
import { WHARF, LIGHTHOUSE, QUAY_Z } from '../ecosystems/harbour.js';
import * as BM from '../world/belmore.js';
import { WEIR_X, centre } from '../ecosystems/river.js';
import { PLACES, EXTRAS, HUT } from '../npc/places.js';

/**
 * A site can be drawn turned so that north is really at the top of the page: view.orient = { toMap(x, z) -> [u, v], toWorld(u, v) -> [x, z] }.
 * The view rectangle (x0..x1, z0..z1), the cells, the spots and the markers are all in MAP coordinates (u to the right = east, v down the page = south);
 * the site's own functions (heightAt, fishing.spotAt, the safety test) are always called with WORLD coordinates. Sites with no orient are drawn as the world is.
 */
export const toMap = (view, x, z) => (view.orient ? view.orient.toMap(x, z) : [x, z]);
export const toWorld = (view, u, v) => (view.orient ? view.orient.toWorld(u, v) : [u, v]);
/** A world heading (0 faces +z, the angle grows toward +x) as the heading of the same direction on the map. */
export function mapHeading(view, h) {
  if (!view.orient) return h;
  const [a, b] = view.orient.toMap(0, 0), [c, d] = view.orient.toMap(Math.sin(h), Math.cos(h));
  return Math.atan2(c - a, d - b);
}

/**
 * Per site: the world rectangle the map shows (x to the right, z down the page: the same way up as the game's default camera), the cell size, and the
 * landmarks. `landSpots` are fishing spots that cover dry rock (the rock platform). `safety` marks a danger zone in a big swell.
 * kind: shop | home | poi | boat
 */
export const VIEWS = {
  rocky: {
    orient: BELLAMBI_FRAME, x0: -95, x1: 140, z0: -85, z1: 115, cell: 2, landSpots: ['rock'], iconDepth: 1.6,   // turned so north is at the top: Bellambi's sea is to the east
    safety: { id: 'platform', label: 'Rock platform', swell: 2.5, at: (x, z) => platformMask(x, z) > 0.3, note: 'Waves can sweep the platform in a big swell (2.5 m or more). Stay on the sand when the lifeguard warns you.' },
    pois: [
      { id: 'tower', short: 'Lifeguard', label: 'Lifeguard tower', x: TOWER.x, z: TOWER.z, icon: '🛟', kind: 'tower', legend: 'Lifeguard tower' },
      { id: 'board', short: 'Club board', label: 'Club board', x: BOARD.x, z: BOARD.z, icon: '📋', kind: 'club', legend: 'Fishing club board' },
      { short: 'Home', id: 'home', label: 'Beach access path (head home)', x: BELLAMBI_HOME.x, z: BELLAMBI_HOME.z, icon: '🏠', kind: 'home', legend: 'Head home' },
      { id: 'rockpool', short: 'Rock Pool', label: 'Bellambi Rock Pool', x: ROCKPOOL.x + ROCKPOOL.nx * 4.7, z: ROCKPOOL.z + ROCKPOOL.nz * 4.7, icon: '🏊', kind: 'poi', legend: 'Bellambi Rock Pool' },
      { id: 'ramp', short: 'Boat ramp', label: 'Bellambi boat ramp', x: RAMP.x0 + RAMP.nx * 6, z: RAMP.z0 + RAMP.nz * 6, icon: '🛶', kind: 'ramp', legend: 'Boat ramp' },
      { id: 'pools', short: 'Rock pools', label: 'Rock pools', x: POOLS[5][0], z: POOLS[5][1], icon: '🦀', kind: 'poi', legend: 'Rock pools' },
      { id: 'reef', short: 'Bellambi Reef', label: 'Bellambi Reef (breaking waves)', x: BREAKER.x, z: BREAKER.z, icon: '🌊', kind: 'poi', legend: 'Bellambi Reef' },
    ],
  },
  seagrass: {
    orient: LAKE_FRAME, x0: -125, x1: 85, z0: -110, z1: 85, cell: 1.8, iconDepth: 1.4,   // turned so north is at the top: the lake is to the west, as at Windang
    pois: [
      { id: 'shop', short: 'Mitra\'s shop', label: "Mitra's bait and tackle shop (head home)", x: HUT.x, z: HUT.z - 1.5, icon: '🛒', kind: 'shop', home: true, legend: 'Bait and tackle shop' },
      { id: 'jettyBase', short: '', label: 'Jetty', x: JETTY.x, z: JETTY.z0 + 1, icon: '⚓', kind: 'jetty', legend: 'Jetty' },
      { id: 'ramp', label: 'Boat ramp', x: EXTRAS.seagrass.ramp.x, z: shoreZ(EXTRAS.seagrass.ramp.x) + 2, icon: '🛶', kind: 'ramp', legend: 'Boat ramp' },
      { id: 'table', short: 'Cleaning table', label: 'Fish-cleaning table', x: JETTY.x + 7.5, z: shoreZ(JETTY.x + 7.5) + 9, icon: '🔪', kind: 'poi', legend: 'Fish-cleaning table' },
    ],
    // decks drawn as planks on the map: [{ id, x1, z1, x2, z2, w }]
    lines: [{ id: 'jetty', x1: JETTY.x, z1: JETTY.z0 + 0.4, x2: JETTY.x, z2: JETTY.z1 - 0.9, w: JETTY.w }],
  },
  harbour: {
    x0: -125, x1: 118, z0: -105, z1: 85, cell: 1.8,
    safety: { id: 'breakwall', label: 'Breakwall', swell: 2.5, at: (x, z) => !!ECOSYSTEMS.find(e => e.id === 'harbour')?.hazard.at(x, z), note: 'Waves wash over the breakwall in a big swell (2.5 m or more). Fish the wharf or the basin instead.' },
    pois: [
      { id: 'lighthouse', label: 'Lighthouse', x: LIGHTHOUSE[0], z: LIGHTHOUSE[1] + 3, icon: '🗼', kind: 'poi', legend: 'Lighthouse' },
      { id: 'wharf', short: '', label: 'Timber wharf and lamps', x: BM.T(WHARF.x, 26)[0], z: BM.T(WHARF.x, 26)[1], icon: '🏮', kind: 'jetty', legend: 'Wharf' },
      { id: 'coop', short: 'Co-op', label: "Fishermen's co-op", x: PLACES.harbour.coopDoor.x, z: PLACES.harbour.coopDoor.z, icon: '🐟', kind: 'coop', legend: "Fishermen's co-op" },
      { short: 'Home', id: 'home', label: 'The harbour road (head home)', x: BM.T(-8, 49)[0], z: BM.T(-8, 49)[1], icon: '🏠', kind: 'home', legend: 'Head home' },
      { id: 'cove', short: 'Cove Beach', label: 'Cove Beach', x: BM.fromPx(160, 428)[0], z: BM.fromPx(160, 428)[1], icon: '🏖️', kind: 'poi', legend: 'Cove Beach' },
      { id: 'hill', short: 'Flagstaff Hill', label: 'Flagstaff Hill', x: BM.HILL.x, z: BM.HILL.z, icon: '⛰️', kind: 'poi', legend: 'Flagstaff Hill' },
    ],
    lines: [{ id: 'wharf', x1: BM.T(WHARF.x, QUAY_Z + 0.4)[0], z1: BM.T(WHARF.x, QUAY_Z + 0.4)[1], x2: BM.T(WHARF.x, WHARF.z1)[0], z2: BM.T(WHARF.x, WHARF.z1)[1], w: WHARF.w }],
  },
  reef: {
    x0: -100, x1: 100, z0: -100, z1: 100, cell: 3.2,
    pois: [
      { id: 'b1', label: 'Marker buoy', x: -36, z: -14, icon: '🔴', kind: 'poi', legend: 'Marker buoy' },
      { id: 'b2', label: 'Marker buoy', x: 40, z: 8, icon: '🔴', kind: 'poi', legend: 'Marker buoy' },
      { id: 'b3', label: 'Marker buoy', x: -6, z: 56, icon: '🔴', kind: 'poi', legend: 'Marker buoy' },
      { id: 'b4', label: 'Marker buoy', x: 60, z: -20, icon: '🔴', kind: 'poi', legend: 'Marker buoy' },
    ],
  },
  river: {
    x0: -95, x1: 95, z0: -48, z1: 48, cell: 1.8,
    pois: [
      { id: 'weir', short: 'Weir', label: 'Concrete weir', x: WEIR_X, z: centre(WEIR_X), icon: '🧱', kind: 'poi', legend: 'Concrete weir' },
      { id: 'landing', short: 'Landing', label: 'Fishing landing', x: -30, z: centre(-30) + 16.6, icon: '🪵', kind: 'ramp', legend: 'Fishing landing' },
      { short: 'Home', id: 'home', label: 'The car park by the bank (head home)', x: -30, z: centre(-30) + 26.6, icon: '🏠', kind: 'home', legend: 'Head home' },
    ],
  },
};

/** The hue a fishing spot is tinted on the map (CSS colour). Shared spots of one family get related colours. */
export const SPOT_TINT = {
  beach: '#ffd36b', rock: '#d98a4a', flats: '#f6e08a', seagrass: '#5fcf7a', channel: '#2d7fc4', jetty: '#c68b4f', mangrove: '#3f8f52',
  wharf: '#ffb347', breakwall: '#b9a99b', basin: '#8fd3ea', reef: '#e85d8c', reefedge: '#ff9ab0', reefsand: '#f3dfae', pool: '#4aa58f', weir: '#fff', snags: '#8a6a4a',
};

/** Species at a spot that the player has not caught yet (Not seen, or only seen as a silhouette). */
export function uncaughtAt(progress, spot) {
  const out = [];
  for (const [id] of SPOTS[spot]?.fish ?? []) { const t = tierOf(progress, id); if (t === 'unseen' || t === 'seen') out.push(id); }
  return out;
}

const mixc = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const CREAM = [1, 0.95, 0.82];

/**
 * Rasterise a site. Returns { id, view, cols, rows, land (Uint8, 1 = dry), depth (Float32, metres below the surface, 0 on land), rgb (Uint8, 3 per cell, the land colour),
 * spotIdx (Int16, index into spots, -1 none), safe (Uint8), spots: [{ spot, label, x, z, cells, comp }], pois }.
 * Spots are found by calling the site's own fishing.spotAt over the cells a line can reach (the shallows, the platform, or any water for the open-sea reef).
 */
export function buildSiteMap(eco) {
  const view = VIEWS[eco.id];
  if (!view) throw new Error(`no map view for ${eco.id}`);
  const { x0, x1, z0, z1, cell } = view;
  const cols = Math.round((x1 - x0) / cell), rows = Math.round((z1 - z0) / cell), n = cols * rows;
  const land = new Uint8Array(n), depth = new Float32Array(n), rgb = new Uint8ClampedArray(n * 3), spotIdx = new Int16Array(n).fill(-1), safe = new Uint8Array(n);
  const spotNames = [], cellSpot = new Array(n);
  // a finer height grid (twice as fine) for the smooth coastline and depth contours
  const hf = heightField(eco, view, 2);
  const open = eco.id === 'reef';   // the open sea: every cell is a place to drop a line
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, [x, z] = toWorld(view, x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell), h = eco.heightAt(x, z);
    const dry = h >= 0;
    land[k] = dry ? 1 : 0; depth[k] = dry ? 0 : -h;
    if (dry) { const c = mixc(eco.colorAt(x, z, h, 0.1), CREAM, 0.4); rgb[k * 3] = c[0] * 255; rgb[k * 3 + 1] = c[1] * 255; rgb[k * 3 + 2] = c[2] * 255; }
    const sp = eco.fishing?.spotAt?.(x, z, x, z);
    if (sp && (open || h < 0.3 && h > -9 || view.landSpots?.includes(sp) && dry)) cellSpot[k] = sp;
    if (view.safety && view.safety.at(x, z) && (dry || h > -2.5)) safe[k] = 1;
  }
  // Group the cells of each spot into connected patches and keep the biggest (icons go there).
  const spots = [], seen = new Uint8Array(n);
  const ids = [...new Set(cellSpot.filter(Boolean))];
  for (const sp of ids) {
    const comps = [];
    for (let s = 0; s < n; s++) {
      if (seen[s] || cellSpot[s] !== sp) continue;
      const stack = [s], cells = []; seen[s] = 1;
      while (stack.length) {
        const c = stack.pop(); cells.push(c);
        const ci = c % cols, cj = (c / cols) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          const nk = nj * cols + ni; if (!seen[nk] && cellSpot[nk] === sp) { seen[nk] = 1; stack.push(nk); }
        }
      }
      comps.push(cells);
    }
    comps.sort((a, b) => b.length - a.length);
    const spotNo = spotNames.length; spotNames.push(sp);
    comps.forEach((cells, ci) => {
      if (ci > 1 || cells.length < 5 || (ci === 1 && cells.length < 60)) { for (const c of cells) spotIdx[c] = spotNo; return; }   // tiny scraps are tinted but get no icon
      // the icon goes at the middle of the patch; on a big open stretch of water (Bellambi's surf beach) it stays in the shallows, where you actually stand and cast
      const near = view.iconDepth != null ? cells.filter(c => depth[c] <= view.iconDepth) : [], pick = near.length >= 5 ? near : cells;
      let mx = 0, mz = 0; for (const c of pick) { mx += c % cols; mz += (c / cols) | 0; }
      mx /= pick.length; mz /= pick.length;
      let best = pick[0], bd = 1e9;
      for (const c of pick) { const d = Math.hypot((c % cols) - mx, ((c / cols) | 0) - mz); if (d < bd) { bd = d; best = c; } }
      for (const c of cells) spotIdx[c] = spotNo;
      spots.push({ spot: sp, idx: spotNo, label: SPOT_INFO[sp]?.label ?? sp, x: x0 + ((best % cols) + 0.5) * cell, z: z0 + (((best / cols) | 0) + 0.5) * cell, cells: cells.length, comp: ci });
    });
  }
  const pois = view.pois.map(p => { const [u, v] = toMap(view, p.x, p.z); return { ...p, wx: p.x, wz: p.z, x: u, z: v }; });
  const lines = (view.lines ?? []).map(l => { const [a, b] = toMap(view, l.x1, l.z1), [c, d] = toMap(view, l.x2, l.z2); return { ...l, x1: a, z1: b, x2: c, z2: d }; });
  return { id: eco.id, view, cols, rows, hf, land, depth, rgb, spotIdx, safe, spotNames, spots, pois, lines, safety: view.safety ? { ...view.safety, cells: safe.reduce((a, b) => a + b, 0) } : null };
}

/** Terrain height on a grid `k` times finer than the view's cell: { cols, rows, h (Float32, metres, sea level 0) }, sample (i, j) at the centre of its cell. */
export function heightField(eco, view, k = 2) {
  const { x0, x1, z0, z1, cell } = view, c = cell / k;
  const cols = Math.round((x1 - x0) / c), rows = Math.round((z1 - z0) / c), h = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const [x, z] = toWorld(view, x0 + (i + 0.5) * c, z0 + (j + 0.5) * c); h[j * cols + i] = eco.heightAt(x, z); }
  return { cols, rows, h };
}

/** Is the site's danger zone live? (a big swell). Rivers have no swell. */
export function safetyState(map, swell) {
  const s = map.safety; if (!s) return null;
  return { ...s, active: swell >= s.swell, swell };
}

/** The people who are on the coast right now: [{ id, name, x, z }] from the NPC manager's list (npc.away people are not on the map). */
export function npcMarkers(npcs) {
  return npcs.filter(n => n && !n.away && n.pos && NPCS[n.id]).map(n => ({ id: n.id, name: NPCS[n.id].name, role: NPCS[n.id].role, x: n.pos.x, z: n.pos.z }));
}

/** Canvas / world helpers for a map view. */
export function project(view, x, z, w, h) { return [((x - view.x0) / (view.x1 - view.x0)) * w, ((z - view.z0) / (view.z1 - view.z0)) * h]; }

// ---------------------------------------------------------------- the region map
/**
 * The five sites on a stylised Illawarra coastline (north at the top, the Tasman Sea to the right). x, y are 0..100 in the drawing, with y spaced like the real latitudes
 * (about 4 units per km): Bellambi (north), Belmore Basin in Wollongong (5.7 km south of it), Port Kembla (12 km), the Five Islands 2.5 km off Port Kembla (the reef), and Lake Illawarra
 * at Windang (17 km); the river runs down from the escarpment.
 */
export const REGION_SITES = [
  { id: 'rocky', short: 'Bellambi', x: 47, y: 15, where: 'Bellambi and Woonona: surf beach and a rock platform', how: 'Walk down the beach path.' },
  { id: 'harbour', short: 'Belmore Basin', x: 49, y: 38, where: 'Wollongong harbour: wharf, breakwall and lighthouse', how: 'Walk along the quay.' },
  { id: 'reef', short: 'Five Islands reef', x: 66, y: 64, where: 'Off Port Kembla, among the Five Islands', how: 'By boat from Belmore Basin.' },
  { id: 'seagrass', short: 'Lake Illawarra', x: 43, y: 79, where: 'The Illawarra estuary at Windang: jetty, flats and seagrass', how: 'Walk out along the jetty.' },
  { id: 'river', short: 'River', x: 17, y: 56, where: 'A coastal river below the escarpment, running down to the lake', how: 'Park by the bank and walk to the pool.' },
];


// ---------------------------------------------------------------- smooth shapes (pure geometry, no DOM)
/** A box blur of a scalar grid (edges clamp), `passes` times. Returns a new Float32Array. */
export function blurField(f, cols, rows, passes = 1) {
  let a = Float32Array.from(f), b = new Float32Array(f.length);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      let s = 0, w = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const k = (di === 0 ? 2 : 1) * (dj === 0 ? 2 : 1); s += a[nj * cols + ni] * k; w += k;
      }
      b[j * cols + i] = s / w;
    }
    [a, b] = [b, a];
  }
  return a;
}

/**
 * Marching squares: the outlines of the region where field >= level, as closed loops of [x, y] points in grid units (sample (i, j) sits at (i + 0.5, j + 0.5), so a loop
 * lives in 0..cols x 0..rows; a region touching the edge is closed just outside it, so clip to the map). Loops are returned unsmoothed; see smoothLoop.
 */
export function contourLoops(field, cols, rows, level) {
  const pw = cols + 2, ph = rows + 2, g = new Float32Array(pw * ph).fill(level - 1);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) g[(j + 1) * pw + i + 1] = field[j * cols + i];
  const at = (i, j) => g[j * pw + i];
  // a crossing is named by its edge: 'h' (between (i,j) and (i+1,j)) or 'v' (between (i,j) and (i,j+1))
  const pt = new Map();
  const cross = (kind, i, j) => {
    const key = `${kind}${i},${j}`; let p = pt.get(key);
    if (!p) {
      const a = at(i, j), b = kind === 'h' ? at(i + 1, j) : at(i, j + 1), t = (level - a) / (b - a);
      p = { key, x: (kind === 'h' ? i + t : i) - 0.5, y: (kind === 'v' ? j + t : j) - 0.5, adj: [] }; pt.set(key, p);
    }
    return p;
  };
  const link = (a, b) => { a.adj.push(b); b.adj.push(a); };
  for (let j = 0; j < ph - 1; j++) for (let i = 0; i < pw - 1; i++) {
    const tl = at(i, j) >= level, tr = at(i + 1, j) >= level, br = at(i + 1, j + 1) >= level, bl = at(i, j + 1) >= level;
    const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
    if (code === 0 || code === 15) continue;
    const T = () => cross('h', i, j), B = () => cross('h', i, j + 1), Lf = () => cross('v', i, j), R = () => cross('v', i + 1, j);
    switch (code) {
      case 1: case 14: link(Lf(), B()); break;
      case 2: case 13: link(B(), R()); break;
      case 3: case 12: link(Lf(), R()); break;
      case 4: case 11: link(T(), R()); break;
      case 6: case 9: link(T(), B()); break;
      case 7: case 8: link(Lf(), T()); break;
      case 5: case 10: {   // saddle: join by the centre value
        const mid = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4 >= level;
        if ((code === 5) === mid) { link(Lf(), T()); link(B(), R()); } else { link(Lf(), B()); link(T(), R()); }
        break;
      }
    }
  }
  const loops = [], used = new Set();
  for (const start of pt.values()) {
    if (used.has(start.key) || start.adj.length !== 2) continue;
    const loop = []; let prev = null, cur = start;
    while (cur && !used.has(cur.key)) {
      used.add(cur.key); loop.push([cur.x, cur.y]);
      const nxt = cur.adj.find(n => n !== prev && !used.has(n.key)) ?? null; prev = cur; cur = nxt;
    }
    if (loop.length > 3) loops.push(loop);
  }
  return loops;
}

/** Chaikin corner-cutting of a closed loop (rounds the outline), `iters` times. */
export function smoothLoop(loop, iters = 2) {
  let p = loop;
  for (let it = 0; it < iters; it++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}

/** The smoothed outlines of one level of a field, dropping tiny specks (fewer than `minLen` points). */
export function smoothContours(field, cols, rows, level, { blur = 1, iters = 2, minLen = 5 } = {}) {
  const f = blur ? blurField(field, cols, rows, blur) : field;
  return contourLoops(f, cols, rows, level).filter(l => l.length >= minLen).map(l => smoothLoop(l, iters));
}

/** The depth-band levels (metres, negative below the surface) a site's water is shaded in, from the shallows out. */
export function depthLevels(siteId) { return DEPTH_LEVELS[siteId] ?? [-0.7, -1.8, -3.6, -6.5]; }
const DEPTH_LEVELS = { reef: [-9, -12, -15, -18], river: [-0.6, -1.4, -2.2, -3], seagrass: [-0.4, -1, -1.8, -2.6], harbour: [-0.7, -1.6, -2.6, -3.6], rocky: [-0.5, -1.1, -1.8, -2.4] };   // from the shallows out; each site's own depth range

// ---------------------------------------------------------------- labels and the legend
const overlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
/**
 * Collision-avoiding label placement (pure). `items` = [{ id, x, y, r, w, h, priority, keep? }]: a marker at (x, y) with radius r and a label box w x h.
 * `obstacles` = [{ id?, x, y, w, h }] boxes labels must not cover (the markers themselves; an item's own marker is ignored by id). Higher priority is placed first;
 * each label tries the sides of its marker in turn (right, left, above, below, then the diagonals) and takes the first free spot inside `bounds` ({ w, h }).
 * A label with no free spot is dropped unless `keep` is set (then it takes its first in-bounds spot even if it overlaps).
 * Returns { placed: [{ id, x, y, w, h, side }], dropped: [id] }, x/y being the top-left of the label box.
 */
export function placeLabels(items, bounds, obstacles = [], gap = 3) {
  const placed = [], dropped = [];
  const order = items.map((it, n) => ({ it, n })).sort((a, b) => (b.it.priority ?? 0) - (a.it.priority ?? 0) || a.n - b.n);
  for (const { it } of order) {
    const { x, y, r = 0, w, h } = it, g = r + gap;
    const cands = [
      ['right', x + g, y - h / 2], ['left', x - g - w, y - h / 2], ['above', x - w / 2, y - g - h], ['below', x - w / 2, y + g],
      ['up-right', x + g * 0.7, y - g * 0.7 - h], ['down-right', x + g * 0.7, y + g * 0.7], ['up-left', x - g * 0.7 - w, y - g * 0.7 - h], ['down-left', x - g * 0.7 - w, y + g * 0.7],
    ];
    const inside = c => c[1] >= 1 && c[2] >= 1 && c[1] + w <= bounds.w - 1 && c[2] + h <= bounds.h - 1;
    const free = c => inside(c) && !placed.some(p => overlap({ x: c[1], y: c[2], w, h }, p)) && !obstacles.some(o => o.id !== it.id && overlap({ x: c[1], y: c[2], w, h }, o));
    let pick = cands.find(free);
    if (!pick && it.keep) pick = cands.find(inside) ?? [cands[0][0], Math.max(1, Math.min(bounds.w - w - 1, cands[0][1])), Math.max(1, Math.min(bounds.h - h - 1, cands[0][2]))];
    if (pick) placed.push({ id: it.id, x: pick[1], y: pick[2], w, h, side: pick[0] }); else dropped.push(it.id);
  }
  return { placed, dropped };
}

/** The legend entries for a site: [{ icon, label, key }] from the markers it actually has (you, people, fishing spots, each landmark kind, the danger zone, the boat). */
export function legendFor(map, { npcs = [], boat = false } = {}) {
  const out = [{ key: 'you', icon: 'you', label: 'You (the arrow points the way you face)' }];
  if (boat) out.push({ key: 'boat', icon: '⛵', label: 'Your boat' });
  if (npcs.length) out.push({ key: 'people', icon: 'people', label: 'People' });
  if (map.spots.length) { out.push({ key: 'spot', icon: '🎣', label: 'Fishing spot' }); out.push({ key: 'q', icon: 'q', label: "Fish you haven't caught" }); }
  const seen = new Set();
  for (const p of map.pois) { const label = p.legend ?? p.label, k = `${p.icon}|${label}`; if (seen.has(k)) continue; seen.add(k); out.push({ key: p.id, icon: p.icon, label }); }
  if (map.safety) out.push({ key: 'danger', icon: 'danger', label: `Danger in a big swell: ${map.safety.label.toLowerCase()}` });
  return out;
}
