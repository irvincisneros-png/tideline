// The map's data, built from each site's own layout (its terrain, its fishing-spot function, its landmarks). Pure: no DOM, so it is unit tested.
//   buildSiteMap(eco)  -> a raster of the site (land colours, water depth, which fishing spot each cell belongs to, the safety zone) and the spot list.
//   uncaughtAt(progress, spot) -> species at that spot you have not caught yet (the "?" marks).
//   npcMarkers(npcs), safetyState(map, swell), REGION_SITES (the stylised Illawarra coast).
import { ECOSYSTEMS } from '../ecosystems/index.js';
import { SPOTS, SPOT_INFO } from '../fishing/catches.js';
import { tierOf } from '../fishing/guide.js';
import { NPCS } from '../content/npcs.js';
import { platformMask } from '../ecosystems/rocky.js';
import { JETTY, shoreZ } from '../ecosystems/seagrass.js';
import { WHARF, EBW, NBW } from '../ecosystems/harbour.js';
import { WEIR_X, centre } from '../ecosystems/river.js';

/**
 * Per site: the world rectangle the map shows (x to the right, z down the page: the same way up as the game's default camera), the cell size, and the
 * landmarks. `landSpots` are fishing spots that cover dry rock (the rock platform). `safety` marks a danger zone in a big swell.
 * kind: shop | home | poi | boat
 */
export const VIEWS = {
  rocky: {
    x0: -130, x1: 160, z0: 30, z1: 135, cell: 2.5, landSpots: ['rock'],
    safety: { id: 'platform', label: 'Rock platform', swell: 2.5, at: (x, z) => platformMask(x, z) > 0.3 && x > 20, note: 'Waves can sweep the platform in a big swell (2.5 m or more). Stay on the sand when the lifeguard warns you.' },
    pois: [
      { id: 'tower', label: 'Lifeguard tower', x: -12, z: 99.5, icon: '🛟', kind: 'poi' },
      { id: 'board', label: 'Club board', x: -5, z: 112.5, icon: '📋', kind: 'poi' },
      { id: 'home', label: 'Beach access path (head home)', x: -3, z: 118, icon: '🏠', kind: 'home' },
      { id: 'pools', label: 'Rock pools', x: 96, z: 90, icon: '🦀', kind: 'poi' },
      { id: 'esky', label: 'Esky and bucket', x: 58.5, z: 79.5, icon: '🧊', kind: 'poi' },
    ],
  },
  seagrass: {
    x0: -90, x1: 90, z0: -22, z1: 85, cell: 1.8,
    pois: [
      { id: 'shop', label: "Mitra's bait and tackle shop (head home)", x: JETTY.x - 11, z: shoreZ(JETTY.x - 11) + 10, icon: '🛒', kind: 'shop', home: true },
      { id: 'jettyBase', label: 'Jetty', x: JETTY.x, z: JETTY.z0 + 1, icon: '⚓', kind: 'poi' },
      { id: 'ramp', label: 'Boat ramp', x: 29.5, z: shoreZ(29.5) + 2, icon: '🛶', kind: 'poi' },
      { id: 'table', label: 'Fish-cleaning table', x: JETTY.x + 7.5, z: shoreZ(JETTY.x + 7.5) + 9, icon: '🔪', kind: 'poi' },
    ],
  },
  harbour: {
    x0: -62, x1: 54, z0: -40, z1: 72, cell: 1.6,
    safety: { id: 'breakwall', label: 'Breakwall', swell: 2.5, at: (x, z) => !!ECOSYSTEMS.find(e => e.id === 'harbour')?.hazard.at(x, z), note: 'Waves wash over the breakwall in a big swell (2.5 m or more). Fish the wharf or the basin instead.' },
    pois: [
      { id: 'lighthouse', label: 'Lighthouse', x: EBW, z: NBW, icon: '🗼', kind: 'poi' },
      { id: 'wharf', label: 'Timber wharf and lamps', x: WHARF.x, z: 24, icon: '🏮', kind: 'poi' },
      { id: 'coop', label: "Fishermen's co-op", x: -27, z: 45.8, icon: '🐟', kind: 'poi' },
      { id: 'home', label: 'The harbour road (head home)', x: -8, z: 49, icon: '🏠', kind: 'home' },
    ],
  },
  reef: {
    x0: -100, x1: 100, z0: -100, z1: 100, cell: 3.2,
    pois: [
      { id: 'b1', label: 'Marker buoy', x: -36, z: -14, icon: '🔴', kind: 'poi' },
      { id: 'b2', label: 'Marker buoy', x: 40, z: 8, icon: '🔴', kind: 'poi' },
      { id: 'b3', label: 'Marker buoy', x: -6, z: 56, icon: '🔴', kind: 'poi' },
      { id: 'b4', label: 'Marker buoy', x: 60, z: -20, icon: '🔴', kind: 'poi' },
    ],
  },
  river: {
    x0: -95, x1: 95, z0: -48, z1: 48, cell: 1.8,
    pois: [
      { id: 'weir', label: 'Concrete weir', x: WEIR_X, z: centre(WEIR_X), icon: '🧱', kind: 'poi' },
      { id: 'landing', label: 'Fishing landing', x: -30, z: centre(-30) + 16.6, icon: '🪵', kind: 'poi' },
      { id: 'home', label: 'The car park by the bank (head home)', x: -30, z: centre(-30) + 26.6, icon: '🏠', kind: 'home' },
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
  const open = eco.id === 'reef';   // the open sea: every cell is a place to drop a line
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, x = x0 + (i + 0.5) * cell, z = z0 + (j + 0.5) * cell, h = eco.heightAt(x, z);
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
      let mx = 0, mz = 0; for (const c of cells) { mx += c % cols; mz += (c / cols) | 0; }
      mx /= cells.length; mz /= cells.length;
      let best = cells[0], bd = 1e9;
      for (const c of cells) { const d = Math.hypot((c % cols) - mx, ((c / cols) | 0) - mz); if (d < bd) { bd = d; best = c; } }
      for (const c of cells) spotIdx[c] = spotNo;
      spots.push({ spot: sp, idx: spotNo, label: SPOT_INFO[sp]?.label ?? sp, x: x0 + ((best % cols) + 0.5) * cell, z: z0 + (((best / cols) | 0) + 0.5) * cell, cells: cells.length, comp: ci });
    });
  }
  return { id: eco.id, view, cols, rows, land, depth, rgb, spotIdx, safe, spotNames, spots, pois: view.pois, safety: view.safety ? { ...view.safety, cells: safe.reduce((a, b) => a + b, 0) } : null };
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
 * The five sites on a stylised Illawarra coastline (north at the top, the Tasman Sea to the right). x, y are 0..100 in the drawing; the real order of the places
 * from north to south is kept: Bellambi, Belmore Basin (Wollongong), Port Kembla (the reef is offshore), Lake Illawarra; the river runs down from the escarpment.
 */
export const REGION_SITES = [
  { id: 'rocky', short: 'Bellambi', x: 47, y: 15, where: 'Bellambi and Woonona: surf beach and a rock platform', how: 'Walk down the beach path.' },
  { id: 'harbour', short: 'Belmore Basin', x: 49, y: 38, where: 'Wollongong harbour: wharf, breakwall and lighthouse', how: 'Walk along the quay.' },
  { id: 'reef', short: 'Offshore reef', x: 79, y: 56, where: 'Off Port Kembla, past the Five Islands', how: 'By boat from Belmore Basin.' },
  { id: 'seagrass', short: 'Lake Illawarra', x: 44, y: 76, where: 'The Illawarra estuary at Windang: jetty, flats and seagrass', how: 'Walk out along the jetty.' },
  { id: 'river', short: 'River', x: 17, y: 56, where: 'A coastal river below the escarpment, running down to the lake', how: 'Park by the bank and walk to the pool.' },
];
