// The map (key M, the 🗺 touch button, and the pause menu): a painted top-down map of the current site made from the site's own layout data
// (ui/mapData.js), and a stylised region map of the whole Illawarra coast with each site's lock. Plus the optional corner minimap (Settings).
// The site map is drawn as smooth vector shapes (contours of the terrain height: coastline, depth bands, spot areas) at the screen's pixel ratio, fitted
// to the panel (never panned), with an optional pinch / ctrl-scroll / button zoom. Labels are placed by the pure placeLabels() in mapData.js.
import { buildSiteMap, uncaughtAt, safetyState, npcMarkers, SPOT_TINT, REGION_SITES, smoothContours, depthLevels, placeLabels, legendFor } from './mapData.js';
import { ecoById } from '../ecosystems/index.js';
import { siteLock } from '../ecosystems/unlock.js';
import { SPECIES_BY_ID, SPOT_INFO } from '../fishing/species.js';
import { esc } from './panels.js';

const $ = (s, r = document) => r.querySelector(s);
const INK = '#1f5f6b', DEEP = '#14434d', CREAM = '#fff3d2', CORAL = '#e8553d', HALO = 'rgba(255,248,226,0.96)';
const FONT = '"Nunito", ui-rounded, "Trebuchet MS", system-ui, sans-serif', EMOJI = 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
const cache = new Map();   // site id -> { map, geo }

// ---------------------------------------------------------------- the geometry (built once per site, in 0..1 map units)
const SEA = { base: '#2a8bb2', bands: ['#bdf0e3', '#8fe0d6', '#60c8d0', '#3ca8c6'], glow: ['#e6fbf2', '#c0f1e6', '#92e0d8', '#68cbd3'] };
const FRESH = { base: '#4f9a98', bands: ['#cdeccd', '#a8dcc0', '#82c8b4', '#5eaaa2'], glow: ['#eaf8dc', '#cdeccd', '#a8dcc0', '#86cab8'] };
const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hashStr = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
const norm = (loops, cols, rows) => loops.map(l => l.map(([x, y]) => [x / cols, y / rows]));

/** The painted land colours as a canvas the size of the map grid (water cells take the nearest land colour so edges do not darken), smoothed when drawn. */
function landColours(map) {
  const { cols, rows } = map, n = cols * rows, rgb = new Float32Array(n * 3), have = new Uint8Array(n);
  for (let k = 0; k < n; k++) if (map.land[k]) { have[k] = 1; for (let c = 0; c < 3; c++) rgb[k * 3 + c] = map.rgb[k * 3 + c]; }
  for (let pass = 0; pass < 5; pass++) {   // dilate the land colours a few cells into the water
    const add = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i; if (have[k]) continue;
      let r = 0, g = 0, b = 0, w = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue; const q = nj * cols + ni; if (have[q]) { r += rgb[q * 3]; g += rgb[q * 3 + 1]; b += rgb[q * 3 + 2]; w++; } }
      if (w) add.push([k, r / w, g / w, b / w]);
    }
    for (const [k, r, g, b] of add) { have[k] = 1; rgb[k * 3] = r; rgb[k * 3 + 1] = g; rgb[k * 3 + 2] = b; }
  }
  const c = document.createElement('canvas'); c.width = cols; c.height = rows;
  const x = c.getContext('2d'), img = x.createImageData(cols, rows);
  for (let k = 0; k < n; k++) { const o = k * 4; img.data[o] = have[k] ? rgb[k * 3] : 241; img.data[o + 1] = have[k] ? rgb[k * 3 + 1] : 223; img.data[o + 2] = have[k] ? rgb[k * 3 + 2] : 167; img.data[o + 3] = 255; }
  x.putImageData(img, 0, 0);
  // a smooth, soft copy: scaled up with smoothing and a little blur, so the colours melt into each other
  const big = document.createElement('canvas'); big.width = cols * 6; big.height = rows * 6;
  const bx = big.getContext('2d'); bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high'; bx.filter = 'blur(5px)'; bx.drawImage(c, -3, -3, big.width + 6, big.height + 6);
  return big;
}

/** Scatter trees on the green land and rocks on the grey, deterministically (so the map does not shimmer). Positions in 0..1 map units. */
function scatter(map, eco) {
  const { cols, rows, view } = map, rnd = mulberry(hashStr(eco.id)), trees = [], rocks = [], waves = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i;
    if (map.land[k]) {
      const r = map.rgb[k * 3], g = map.rgb[k * 3 + 1], b = map.rgb[k * 3 + 2], gr = g - (r + b) / 2, lum = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b);
      const u = (i + 0.2 + rnd() * 0.6) / cols, v = (j + 0.2 + rnd() * 0.6) / rows;
      if (gr > 10 && rnd() < Math.min(0.1, (gr - 10) / 200)) trees.push({ u, v, rad: view.cell * (0.4 + rnd() * 0.4), tone: rnd() });
      else if (sat < 40 && lum < 175 && rnd() < 0.5) rocks.push({ u, v, rad: view.cell * (0.3 + rnd() * 0.45), tone: rnd(), rot: rnd() * 6.28 });
    } else if (map.depth[k] > 2.5 && rnd() < 0.045) waves.push({ u: (i + rnd()) / cols, v: (j + rnd()) / rows });
  }
  trees.sort((a, b) => a.v - b.v); rocks.sort((a, b) => a.v - b.v);
  return { trees, rocks, waves };
}

function buildGeo(map, eco) {
  const { hf, cols, rows } = map, fresh = !!eco.fresh;
  const cont = (f, fc, fr, level, o) => norm(smoothContours(f, fc, fr, level, o), fc, fr);
  const levels = depthLevels(eco.id);
  const geo = {
    pal: fresh ? FRESH : SEA, levels, bands: levels.map(l => cont(hf.h, hf.cols, hf.rows, l, { blur: 1, iters: 2, minLen: 6 })),
    land: cont(hf.h, hf.cols, hf.rows, 0, { blur: 1, iters: 2, minLen: 6 }), colours: landColours(map), ...scatter(map, eco), spotAreas: [], safe: [], cache: new Map(),
  };
  // spot areas: the smoothed outline of the cells each spot covers (the most common spot of a site is the plain water and is left untinted)
  const counts = new Map(); for (let k = 0; k < cols * rows; k++) if (map.spotIdx[k] >= 0) counts.set(map.spotIdx[k], (counts.get(map.spotIdx[k]) ?? 0) + 1);
  const dominant = counts.size > 1 ? [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0] : -1;
  for (const [idx, n] of counts) {
    if (idx === dominant || n < 6) continue;
    const m = new Float32Array(cols * rows); for (let k = 0; k < m.length; k++) m[k] = map.spotIdx[k] === idx ? 1 : 0;
    const loops = cont(m, cols, rows, 0.5, { blur: 2, iters: 2, minLen: 5 });
    if (loops.length) geo.spotAreas.push({ spot: map.spotNames[idx], loops });
  }
  if (map.safety) { const m = Float32Array.from(map.safe); geo.safe = cont(m, cols, rows, 0.5, { blur: 1, iters: 2, minLen: 5 }); }
  return geo;
}

/** The map data and the painted geometry for a site, built once. */
export function siteMapFor(eco) {
  let c = cache.get(eco.id);
  if (!c) { const map = buildSiteMap(eco); c = { map, geo: buildGeo(map, eco) }; cache.set(eco.id, c); }
  return c;
}

// ---------------------------------------------------------------- the painted base layer
/** A view transform: s = zoom (1 = the whole map fits), (ox, oy) = where the map's top-left corner sits on the canvas, in CSS pixels. */
export const FIT = Object.freeze({ s: 1, ox: 0, oy: 0 });
export const clampView = (xf, W, H) => { const s = Math.max(1, Math.min(6, xf.s)); return { s, ox: Math.min(0, Math.max(W - W * s, xf.ox)), oy: Math.min(0, Math.max(H - H * s, xf.oy)) }; };

function trace(ctx, loops, W, H, xf) {
  ctx.beginPath();
  for (const l of loops) { for (let i = 0; i < l.length; i++) { const x = l[i][0] * W * xf.s + xf.ox, y = l[i][1] * H * xf.s + xf.oy; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); }
}
function hatch(color, dpr) {
  const c = document.createElement('canvas'); c.width = c.height = Math.round(12 * dpr);
  const x = c.getContext('2d'); x.scale(dpr, dpr); x.strokeStyle = color; x.lineWidth = 2.2; x.lineCap = 'square';
  x.beginPath(); x.moveTo(-2, 14); x.lineTo(14, -2); x.moveTo(-2, 8); x.lineTo(8, -2); x.moveTo(4, 14); x.lineTo(14, 4); x.stroke();
  return x.createPattern(c, 'repeat');
}

/** Paint the water by depth, the land, the soft spot areas and the decorations into ctx (CSS-pixel coordinates; ctx is already scaled by dpr). */
function paintBase(ctx, map, eco, geo, W, H, xf, dpr) {
  const { pal } = geo, mpp = W * xf.s / (map.view.x1 - map.view.x0);   // pixels per metre
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.fillStyle = pal.base; ctx.fillRect(0, 0, W, H);
  // depth bands from the deepest to the shallowest, each with a soft glow spilling into the deeper water
  for (let i = geo.bands.length - 1; i >= 0; i--) {
    trace(ctx, geo.bands[i], W, H, xf);
    ctx.save(); ctx.shadowColor = pal.glow[i]; ctx.shadowBlur = 14 * dpr; ctx.fillStyle = pal.bands[i]; ctx.fill('evenodd'); ctx.restore();
  }
  // wave flecks on the deep water
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  for (const w of geo.waves) { const x = w.u * W * xf.s + xf.ox, y = w.v * H * xf.s + xf.oy; if (x < -20 || y < -10 || x > W + 20 || y > H + 10) continue; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x - 3, y - 3, x, y); ctx.quadraticCurveTo(x + 3, y + 3, x + 6, y); ctx.stroke(); }
  // foam where the water meets the land
  trace(ctx, geo.land, W, H, xf);
  ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 6; ctx.stroke(); ctx.restore();
  // the land: wet sand edge, then the painted colours inside it
  ctx.fillStyle = '#efdca0'; ctx.fill('evenodd');
  ctx.save(); trace(ctx, geo.land, W, H, xf); ctx.clip('evenodd');
  ctx.drawImage(geo.colours, xf.ox, xf.oy, W * xf.s, H * xf.s);
  ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(214,176,108,0.55)'; ctx.lineWidth = 8; trace(ctx, geo.land, W, H, xf); ctx.stroke(); ctx.restore();   // the damp sand along the waterline
  // rocks and trees
  const sc = (r) => Math.max(2.4, Math.min(7.5, r * mpp));
  for (const r of geo.rocks) {
    const x = r.u * W * xf.s + xf.ox, y = r.v * H * xf.s + xf.oy; if (x < -12 || y < -12 || x > W + 12 || y > H + 12) continue;
    const rad = sc(r.rad);
    ctx.save(); ctx.translate(x, y); ctx.rotate(r.rot); ctx.beginPath(); ctx.ellipse(0, 0, rad * 1.15, rad * 0.8, 0, 0, 6.283); ctx.fillStyle = r.tone > 0.5 ? '#a89f94' : '#8f877e'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(70,60,52,0.5)'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-rad * 0.25, -rad * 0.25, rad * 0.5, rad * 0.32, 0, 0, 6.283); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill(); ctx.restore();
  }
  for (const t of geo.trees) {
    const x = t.u * W * xf.s + xf.ox, y = t.v * H * xf.s + xf.oy; if (x < -14 || y < -14 || x > W + 14 || y > H + 14) continue;
    const rad = sc(t.rad);
    ctx.beginPath(); ctx.ellipse(x + rad * 0.25, y + rad * 0.45, rad, rad * 0.55, 0, 0, 6.283); ctx.fillStyle = 'rgba(30,70,50,0.22)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fillStyle = t.tone > 0.5 ? '#4f9d5c' : '#3f8a52'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(25,80,50,0.55)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x - rad * 0.28, y - rad * 0.3, rad * 0.5, 0, 6.283); ctx.fillStyle = 'rgba(190,240,170,0.45)'; ctx.fill();
  }
  ctx.restore();
  // the crisp shoreline
  trace(ctx, geo.land, W, H, xf); ctx.lineJoin = 'round'; ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(31,95,107,0.55)'; ctx.stroke();
  // decks: the jetty and the wharf
  for (const ln of map.view.lines ?? []) {
    const P = (x, z) => [((x - map.view.x0) / (map.view.x1 - map.view.x0)) * W * xf.s + xf.ox, ((z - map.view.z0) / (map.view.z1 - map.view.z0)) * H * xf.s + xf.oy];
    const [x1, y1] = P(ln.x1, ln.z1), [x2, y2] = P(ln.x2, ln.z2), w = Math.max(4, ln.w * mpp);
    ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = w + 3; ctx.strokeStyle = '#6e4f33'; ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = '#d9a86b'; ctx.stroke();
    ctx.setLineDash([1.5, 5]); ctx.lineWidth = w - 1; ctx.strokeStyle = 'rgba(110,79,51,0.55)'; ctx.stroke(); ctx.setLineDash([]);
  }
  // spot areas: a soft tint and a dashed edge
  for (const a of geo.spotAreas) {
    const col = SPOT_TINT[a.spot] ?? '#ffffff';
    trace(ctx, a.loops, W, H, xf); ctx.fillStyle = col + '38'; ctx.fill('evenodd');
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.strokeStyle = col + 'cc'; ctx.stroke(); ctx.setLineDash([]);
  }
  // the danger zone, faintly hatched (stronger in a big swell; see drawSiteMap)
  if (geo.safe.length) { trace(ctx, geo.safe, W, H, xf); ctx.fillStyle = 'rgba(232,85,61,0.1)'; ctx.fill('evenodd'); ctx.fillStyle = hatch('rgba(214,60,40,0.3)', dpr); ctx.fill('evenodd'); }
  ctx.restore();
}

/** The painted base, cached as a canvas for this size / zoom (the live markers are drawn over it every refresh). */
function baseLayer(map, eco, geo, W, H, dpr, xf) {
  const key = `${W}x${H}@${dpr}|${xf.s.toFixed(3)},${Math.round(xf.ox)},${Math.round(xf.oy)}`;
  let c = geo.cache.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const x = c.getContext('2d'); x.scale(dpr, dpr); paintBase(x, map, eco, geo, W, H, xf, dpr);
    geo.cache.set(key, c); if (geo.cache.size > 4) geo.cache.delete(geo.cache.keys().next().value);
  }
  return c;
}

// ---------------------------------------------------------------- the live layer
function disc(ctx, x, y, r, fill, glyph, lw = 2) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  if (glyph) { ctx.font = `${Math.round(r * 1.3)}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText(glyph, x, y + r * 0.06); }
}
function haloText(ctx, text, x, y, size, color) {
  ctx.font = `800 ${size}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(3, size * 0.3); ctx.strokeStyle = HALO; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function arrow(ctx, x, y, heading, r, fill, cone = true) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI - heading);   // the arrow points up; heading 0 faces +z, which is down the page
  if (cone) { const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 4); g.addColorStop(0, 'rgba(95,207,122,0.5)'); g.addColorStop(1, 'rgba(95,207,122,0)'); ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 4, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(0, -r * 1.35); ctx.lineTo(r * 0.95, r * 0.9); ctx.lineTo(0, r * 0.4); ctx.lineTo(-r * 0.95, r * 0.9); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
}
const KIND_FILL = { shop: '#ffd36b', club: '#ffe7a0', coop: '#ffd2bd', tower: '#ffc9b9', home: '#d9f5df', jetty: '#f3dcb5', ramp: '#f3dcb5' };
/** The label font size for a map of this CSS width: readable on a phone, a touch larger on a big screen. */
export const labelSize = W => Math.round(Math.max(11, Math.min(14, W / 62)) * 10) / 10;

/**
 * Draw the whole site map into a canvas. `state` = { player: {x,z,heading}, npcs, progress, swell, boat }.
 * opts: { w, h } CSS size (default: the canvas's pixel size / dpr), { dpr }, { xf } the zoom view (default: fit to the canvas).
 */
export function drawSiteMap(canvas, eco, state, opts = {}) {
  const { map, geo } = siteMapFor(eco), view = map.view, dpr = opts.dpr ?? 1, W = opts.w ?? canvas.width / dpr, H = opts.h ?? canvas.height / dpr, xf = opts.xf ?? FIT;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.drawImage(baseLayer(map, eco, geo, W, H, dpr, xf), 0, 0, W, H);
  const P = (x, z) => [((x - view.x0) / (view.x1 - view.x0)) * W * xf.s + xf.ox, ((z - view.z0) / (view.z1 - view.z0)) * H * xf.s + xf.oy];
  const on = (x, y, m = 0) => x >= m && y >= m && x <= W - m && y <= H - m;
  const size = labelSize(W), k = Math.max(0.8, Math.min(1, W / 520)), pr = size * 0.95 * k, sr = size * 0.82 * k, narrow = W < 460;
  const sf = safetyState(map, state.swell ?? 0);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (sf?.active && geo.safe.length) { trace(ctx, geo.safe, W, H, xf); ctx.fillStyle = 'rgba(232,85,61,0.12)'; ctx.fill('evenodd'); ctx.fillStyle = hatch('rgba(214,60,40,0.6)', dpr); ctx.fill('evenodd'); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(214,60,40,0.85)'; ctx.stroke(); }
  ctx.restore();
  // everything that has a marker, with its label's priority (higher = placed first, kept when space is tight)
  const marks = [], obstacles = [], labels = [], seen = new Set();
  const add = (m, label, r, priority, keep) => {
    if (!on(m.x, m.y, 2)) return;
    marks.push(m); obstacles.push({ id: m.id, x: m.x - r, y: m.y - r, w: r * 2, h: r * 2 });
    if (label) { ctx.font = `800 ${size}px ${FONT}`; labels.push({ id: m.id, x: m.x, y: m.y, r, w: Math.ceil(ctx.measureText(label.text).width) + 4, h: size + 4, priority, keep, text: label.text, color: label.color }); }
  };
  for (const p of map.pois) {
    const [x, y] = P(p.x, p.z), text = p.short ?? p.label.replace(/ \(head home\)/, ''), dup = seen.has(text); seen.add(text);
    add({ id: 'poi-' + p.id, x, y, r: pr, kind: 'poi', p }, dup ? null : { text, color: DEEP }, pr, p.kind === 'home' || p.kind === 'poi' ? 60 : 85);
  }
  for (const s of map.spots) {
    const [x, y] = P(s.x, s.z), t = s.label.replace(/^(Lake Illawarra|Belmore|Bellambi) /, '');
    add({ id: `spot-${s.idx}-${s.comp}`, x, y, r: sr, kind: 'spot', s, more: uncaughtAt(state.progress, s.spot).length }, s.comp === 0 ? { text: t.charAt(0).toUpperCase() + t.slice(1), color: DEEP } : null, sr, 50);
  }
  if (state.boat) { const [x, y] = P(state.boat.x, state.boat.z); add({ id: 'boat', x, y, r: pr, kind: 'boat' }, { text: 'Your boat', color: '#1d6b3b' }, pr, 100, true); }
  for (const n of state.npcs ?? []) {
    let [x, y] = P(n.x, n.z);
    const hit = map.pois.map(p => P(p.x, p.z)).find(([px, py]) => Math.hypot(px - x, py - y) < pr + 6);   // stand beside a building's marker, not on top of it
    if (hit) { const a = Math.atan2(y - hit[1], x - hit[0]) || -0.8; x = hit[0] + Math.cos(a) * (pr + 7); y = hit[1] + Math.sin(a) * (pr + 7); }
    add({ id: 'npc-' + n.id, x, y, r: 5, kind: 'npc' }, narrow ? null : { text: n.name, color: '#a33a26' }, 5, 30);   // on a phone the dots stay and the names go (no room)
  }
  if (state.player && !state.boat) { const [x, y] = P(state.player.x, state.player.z), cx = Math.max(10, Math.min(W - 10, x)), cy = Math.max(10, Math.min(H - 10, y)); add({ id: 'you', x: cx, y: cy, r: pr * 0.95, kind: 'you', heading: state.player.heading ?? 0 }, { text: 'You', color: '#1d6b3b' }, pr * 1.3, 120, true); }
  if (sf && geo.safe.length) {   // the danger caption sits in the middle of the zone
    const m = map.safe, cols = map.cols; let sx = 0, sz = 0, n = 0; for (let k = 0; k < m.length; k++) if (m[k]) { sx += k % cols; sz += (k / cols) | 0; n++; }
    if (n) { const [x, y] = P(view.x0 + (sx / n + 0.5) * view.cell, view.z0 + (sz / n + 0.5) * view.cell); if (on(x, y, 4)) { const text = sf.active ? `⚠ Danger: ${sf.label}` : sf.label; ctx.font = `800 ${size}px ${FONT}`; labels.push({ id: 'danger', x, y, r: 0, w: Math.ceil(ctx.measureText(text).width) + 4, h: size + 4, priority: sf.active ? 110 : 40, text, color: sf.active ? CORAL : '#a33a26', centre: true }); } }
  }
  // the compass keeps its corner
  const cr = size * 1.5, ccx = W - cr - 8, ccy = H - cr - 8; obstacles.push({ id: 'compass', x: ccx - cr, y: ccy - cr, w: cr * 2, h: cr * 2 });
  const { placed } = placeLabels(labels.filter(l => l.id !== 'danger'), { w: W, h: H }, obstacles);
  const danger = labels.find(l => l.id === 'danger');
  if (danger) { const b = { id: 'danger', x: danger.x - danger.w / 2, y: danger.y - danger.h / 2, w: danger.w, h: danger.h }; if (!placed.some(p => p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y) && b.x > 1 && b.x + b.w < W - 1) placed.push(b); }
  // draw: markers, then labels on top
  for (const m of marks) {
    if (m.kind === 'poi') disc(ctx, m.x, m.y, m.r, KIND_FILL[m.p.kind] ?? CREAM, m.p.icon);
    else if (m.kind === 'spot') {
      disc(ctx, m.x, m.y, m.r, '#fff', '🎣', 2);
      if (m.more) { const bx = m.x + m.r * 0.78, by = m.y - m.r * 0.78, br = m.r * 0.5; ctx.beginPath(); ctx.arc(bx, by, br, 0, 6.283); ctx.fillStyle = '#ffb347'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); ctx.font = `800 ${Math.round(br * 1.4)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText('?', bx, by + 0.5); }
    } else if (m.kind === 'boat') disc(ctx, m.x, m.y, m.r, '#fff', '⛵');
    else if (m.kind === 'npc') { ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fillStyle = '#ff8a5c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
  }
  const you = marks.find(m => m.kind === 'you');
  for (const l of placed) { const t = labels.find(x => x.id === l.id); if (t) haloText(ctx, t.text, l.x + 2, l.y + l.h / 2 + 0.5, size, t.color); }
  if (you) { ctx.beginPath(); ctx.arc(you.x, you.y, pr * 1.2, 0, 6.283); ctx.fillStyle = 'rgba(95,207,122,0.3)'; ctx.fill(); arrow(ctx, you.x, you.y, you.heading, pr * 0.8, '#5fcf7a'); }
  // frame and compass
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(0, 0, W, H);
  ctx.beginPath(); ctx.arc(ccx, ccy, cr, 0, 6.283); ctx.fillStyle = 'rgba(255,243,210,0.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = CORAL; ctx.beginPath(); ctx.moveTo(ccx, ccy - cr * 0.72); ctx.lineTo(ccx + cr * 0.24, ccy); ctx.lineTo(ccx - cr * 0.24, ccy); ctx.closePath(); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(ccx, ccy + cr * 0.72); ctx.lineTo(ccx + cr * 0.24, ccy); ctx.lineTo(ccx - cr * 0.24, ccy); ctx.closePath(); ctx.fill();
  ctx.font = `800 ${Math.round(size * 0.8)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = DEEP; ctx.fillText('N', ccx, ccy - cr - 0.5 + (ccy - cr < size ? size : 0));
  return { labelsPlaced: placed.length, labelsTotal: labels.length };
}

// ---------------------------------------------------------------- the region map
const REGION_SVG = `
<svg class="region-svg" viewBox="0 0 150 92" role="img" aria-label="Stylised map of the Illawarra coast with TideLine's five sites">
  <defs>
    <pattern id="rg-waves" width="6" height="4" patternUnits="userSpaceOnUse"><path d="M0 2 q1.5 -1.4 3 0 t3 0" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width=".35"/></pattern>
    <linearGradient id="rg-sea" x1="0" x2="1"><stop offset="0" stop-color="#7fe0d4"/><stop offset=".55" stop-color="#43b4c4"/><stop offset="1" stop-color="#2a8fb0"/></linearGradient>
  </defs>
  <rect width="150" height="92" fill="url(#rg-sea)"/><rect width="150" height="92" fill="url(#rg-waves)"/>
  <!-- the land: the coastal plain, with the escarpment behind it -->
  <path d="M0 0 H41 C43 8 46 12 45 18 C44 24 47 30 48 36 C49 41 46 44 45 50 C44 56 47 61 47 68 C47 74 41 77 40 82 C40 86 41 90 42 92 H0 Z" fill="#e9d9a0" stroke="#fff6dc" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M0 0 H41 C43 8 46 12 45 18 C44 24 47 30 48 36 C49 41 46 44 45 50 C44 56 47 61 47 68 C47 74 41 77 40 82 C40 86 41 90 42 92 H0 Z" fill="none" stroke="#1f5f6b" stroke-width=".7" stroke-linejoin="round" stroke-opacity=".7"/>
  <path d="M0 0 H22 C24 14 20 24 23 38 C25 50 21 64 24 92 H0 Z" fill="#8fc98a"/>
  <path d="M0 0 H12 C14 18 11 32 13 48 C14 62 11 78 12 92 H0 Z" fill="#5fa86c"/>
  <g fill="#3f8f52" opacity=".9"><path d="M3 10 l3 -5 l3 5z"/><path d="M8 22 l3 -5 l3 5z"/><path d="M4 36 l3 -5 l3 5z"/><path d="M9 50 l3 -5 l3 5z"/><path d="M3 66 l3 -5 l3 5z"/><path d="M8 80 l3 -5 l3 5z"/></g>
  <text x="2" y="86" font-size="2.6" fill="#fff" font-weight="800" stroke="#14434d" stroke-width=".5" paint-order="stroke">Illawarra escarpment</text>
  <!-- Lake Illawarra, joined to the sea by a little channel -->
  <path d="M30 70 C33 66 41 67 43 72 C45 77 42 82 36 83 C30 84 26 79 27 75 C27 73 28 71 30 70 Z" fill="#7fe0d4" stroke="#1f5f6b" stroke-width=".6"/>
  <path d="M43 75 C45 76 46 77 49 78" fill="none" stroke="#7fe0d4" stroke-width="1.6" stroke-linecap="round"/>
  <!-- the river runs down the escarpment to the lake -->
  <path d="M10 44 C14 49 20 50 20 56 C20 62 26 62 28 68" fill="none" stroke="#43b4c4" stroke-width="1.5" stroke-linecap="round"/>
  <!-- Belmore Basin: a small harbour notch -->
  <path d="M46 36 h4 v3 h-4 z" fill="#7fe0d4" stroke="#1f5f6b" stroke-width=".4"/>
  <!-- Port Kembla and the Five Islands offshore -->
  <path d="M47 50 C52 49 55 52 54 55 C53 57 49 56 47 55 Z" fill="#c9bb88" stroke="#1f5f6b" stroke-width=".5"/>
  <g fill="#7fb392" stroke="#1f5f6b" stroke-width=".4"><ellipse cx="66" cy="62" rx="3.2" ry="1.8"/><ellipse cx="72" cy="66" rx="1.6" ry="1"/><ellipse cx="62" cy="67" rx="1.3" ry=".9"/><ellipse cx="76" cy="61" rx="1" ry=".7"/><ellipse cx="70" cy="70" rx="1.1" ry=".8"/></g>
  <text x="80" y="68" font-size="2.6" fill="#fff" font-weight="800" stroke="#14434d" stroke-width=".5" paint-order="stroke">Five Islands</text>
  <!-- the boat route to the reef -->
  <path d="M51 40 C58 44 66 49 77 54" fill="none" stroke="#fff" stroke-width=".7" stroke-dasharray="1.6 1.4" stroke-linecap="round"/>
  <text x="3" y="5" font-size="3" fill="#14434d" font-weight="800">N ↑</text>
  <text x="118" y="89" font-size="3.2" fill="#fff" font-weight="800" stroke="#14434d" stroke-width=".6" paint-order="stroke">Tasman Sea</text>
  <text x="26" y="4.5" font-size="2.7" fill="#14434d" font-weight="800" opacity=".75">Sydney ↑</text>
  <text x="22" y="90" font-size="2.7" fill="#14434d" font-weight="800" opacity=".75">Shellharbour ↓</text>
  <text x="55" y="53" font-size="2.5" fill="#14434d" font-weight="800" opacity=".8">Port Kembla</text>
  %PINS%
</svg>`;

function regionHTML(game, selId) {
  const p = game.progress, here = game.eco.id;
  const pins = REGION_SITES.map(s => {
    const eco = ecoById(s.id), lock = siteLock(p, eco), isHere = s.id === here;
    const fill = lock.locked ? '#c9c2b0' : '#fff', glyph = lock.locked ? '🔒' : isHere ? '⭐' : '🎣';
    return `<g class="rg-pin ${lock.locked ? 'locked' : ''} ${s.id === selId ? 'sel' : ''}" data-id="${s.id}" tabindex="0" role="button" aria-label="${esc(eco.name)}${lock.locked ? ', locked' : isHere ? ', you are here' : ''}">
      <circle cx="${s.x}" cy="${s.y}" r="4.3" fill="${fill}" stroke="#1f5f6b" stroke-width=".9"/>
      <text x="${s.x}" y="${s.y + 1.4}" font-size="4.4" text-anchor="middle">${glyph}</text>
      <text x="${s.x + 6}" y="${s.y + 1}" font-size="3.3" font-weight="800" fill="#14434d" stroke="#fff3d2" stroke-width=".9" paint-order="stroke">${esc(s.short)}</text>
    </g>`;
  }).join('');
  return REGION_SVG.replace('%PINS%', pins);
}
function regionCard(game, id) {
  const eco = ecoById(id), s = REGION_SITES.find(x => x.id === id), lock = siteLock(game.progress, eco), here = game.eco.id === id;
  const status = here ? '<span class="chip ok">You are here</span>' : lock.locked ? `<span class="chip lock">🔒 Locked</span>` : '<span class="chip ok">Open</span>';
  const parts = lock.locked ? `<p class="lock-why"><b>To open it:</b> ${esc(lock.text)}.</p><p class="muted">${lock.parts.map(x => `${x.done ? '✔' : '✖'} ${esc(x.short ?? x.text)}${x.need > 1 ? ` (${x.have} of ${x.need})` : ''}`).join('<br>')}</p>` : '';
  return `<h3>${esc(eco.name)} ${status}</h3><p>${esc(s.where)}.</p><p class="muted">${esc(s.how)} ${here ? '' : lock.locked ? '' : 'Choose it from the title screen (Quit to title in the pause menu).'}</p>${parts}`;
}

// ---------------------------------------------------------------- the panel
const safeText = (map, swell) => { const sf = safetyState(map, swell); return sf ? `<div class="map-danger ${sf.active ? 'on' : ''}"><b>${sf.active ? '⚠ Danger now' : 'Safety zone'}: the ${esc(sf.label.toLowerCase())}.</b> ${esc(sf.note)}${sf.active ? ` The swell is ${swell.toFixed(1)} m.` : ` The swell is ${swell.toFixed(1)} m at the moment.`}</div>` : ''; };
const legendHTML = items => items.map(l => {
  const ic = l.icon === 'you' ? '<i class="dot you"></i>' : l.icon === 'people' ? '<i class="dot ppl"></i>' : l.icon === 'q' ? '<i class="dot q">?</i>' : l.icon === 'danger' ? '<i class="dot hatch"></i>' : `<span class="lg-ic">${l.icon}</span>`;
  return `<span>${ic} ${esc(l.label)}</span>`;
}).join('');

/** Build the data the site map draws from the live game. */
function liveState(game) {
  const e = game.eco, swell = e.fresh ? 0 : game.cond.swell;
  return {
    player: { x: game.walker.pos.x, z: game.walker.pos.z, heading: game.walker.heading }, npcs: npcMarkers(game.npcs.npcs), progress: game.progress, swell,
    boat: e.id === 'reef' ? { x: e.state.x, z: e.state.z } : null,
  };
}

export function openMap(game, tab = 'site') {
  const panels = game.panels, eco = game.eco, { map } = siteMapFor(eco), view = map.view;
  let current = tab, sel = eco.id, timer = null, W = 0, H = 0, xf = FIT, redraw = null, cv = null;
  const aspect = (view.x1 - view.x0) / (view.z1 - view.z0);
  const onResize = () => { if (current === 'site' && cv) { fit(); redraw?.(); } };
  addEventListener('resize', onResize);
  panels.open(`<div class="mapview"><h2>🗺 Map</h2>
    <div class="map-tabs" role="tablist"><button class="btn small" id="mt-site" role="tab">This place</button><button class="btn small" id="mt-region" role="tab">Illawarra coast</button></div>
    <div id="map-body"></div></div>`, () => { clearInterval(timer); removeEventListener('resize', onResize); game.mapOpen = false; }, { flow: 'map' });
  game.mapOpen = true;
  const body = $('#map-body', panels.body);
  const dpr = () => Math.min(3, window.devicePixelRatio || 1);
  /** Size the canvas to contain the whole map in the space the panel gives it (never wider than the panel, never taller than the screen). */
  function fit() {
    const stage = cv.parentElement, availW = Math.max(160, body.clientWidth), top = stage.getBoundingClientRect().top;
    const availH = Math.max(150, innerHeight - Math.max(0, top) - (innerHeight < 520 ? 16 : 28));
    W = Math.floor(Math.min(availW, availH * aspect)); H = Math.floor(W / aspect);
    const d = dpr(); cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    stage.style.width = W + 'px'; xf = clampView(xf, W, H);
  }
  const render = () => {
    $('#mt-site', panels.body).classList.toggle('on', current === 'site'); $('#mt-site', panels.body).setAttribute('aria-selected', current === 'site');
    $('#mt-region', panels.body).classList.toggle('on', current === 'region'); $('#mt-region', panels.body).setAttribute('aria-selected', current === 'region');
    clearInterval(timer); redraw = null; cv = null; $('.map-zoom', panels.body)?.remove();
    if (current === 'region') {
      body.innerHTML = `<p class="sub">TideLine's five places on the Illawarra coast, north at the top. A padlock means the place is still locked.</p>
        <div class="region-box"><div class="region-wrap">${regionHTML(game, sel)}</div><div class="region-card" id="rg-card">${regionCard(game, sel)}</div></div>`;
      const pick = id => { sel = id; body.querySelectorAll('.rg-pin').forEach(g => g.classList.toggle('sel', g.dataset.id === id)); $('#rg-card', body).innerHTML = regionCard(game, id); };
      body.querySelectorAll('.rg-pin').forEach(g => { g.onclick = () => pick(g.dataset.id); g.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g.dataset.id); } }; });
      return;
    }
    const st = liveState(game);
    const rows = map.spots.filter(s => s.comp === 0).map(s => {
      const more = uncaughtAt(game.progress, s.spot), info = SPOT_INFO[s.spot];
      const names = more.slice(0, 4).map(id => SPECIES_BY_ID[id]?.common ?? id);
      return `<li><i class="sw" style="background:${SPOT_TINT[s.spot] ?? '#fff'}"></i><span><b>${esc(info?.label ?? s.spot)}</b> <small>${esc(info?.blurb ?? '')}</small>${more.length ? `<br><span class="q">? ${more.length} to catch here</span>` : '<br><span class="done">✔ you have caught everything here</span>'}</span></li>`;
    }).join('');
    body.innerHTML = `<p class="sub">${esc(eco.name)} · ${esc(eco.place)}. North is at the top; you are the green arrow.</p>
      <div class="map-stage"><canvas id="map-cv" role="img" aria-label="Map of ${esc(eco.name)}"></canvas></div>
      ${safeText(map, st.swell)}
      <div class="map-legend">${legendHTML(legendFor(map, { npcs: st.npcs, boat: !!st.boat }))}</div>
      <ul class="map-spots">${rows}</ul>`;
    $('.map-zoom', panels.body)?.remove();
    $('.map-tabs', panels.body).insertAdjacentHTML('beforeend', '<div class="map-zoom" role="group" aria-label="Zoom the map"><button type="button" id="mz-in" aria-label="Zoom in">+</button><button type="button" id="mz-out" aria-label="Zoom out">−</button><button type="button" id="mz-fit" aria-label="Fit the whole map" title="Fit the whole map">⤢</button></div>');
    cv = $('#map-cv', body); xf = FIT; fit();
    redraw = () => { drawSiteMap(cv, eco, liveState(game), { w: W, h: H, dpr: dpr(), xf }); cv.style.touchAction = xf.s > 1 ? 'none' : 'pan-y'; panels.body.querySelector('#mz-fit')?.classList.toggle('on', xf.s > 1); };
    redraw(); timer = setInterval(redraw, 400);
    // zoom: buttons, ctrl / cmd + scroll, pinch and double-tap; drag to pan once zoomed in. The default is always the whole map.
    const zoomAt = (k, cx, cy) => { const s = Math.max(1, Math.min(6, xf.s * k)), r = s / xf.s; xf = clampView({ s, ox: cx - (cx - xf.ox) * r, oy: cy - (cy - xf.oy) * r }, W, H); redraw(); };
    $('#mz-in', panels.body).onclick = () => zoomAt(1.5, W / 2, H / 2); $('#mz-out', panels.body).onclick = () => zoomAt(1 / 1.5, W / 2, H / 2); $('#mz-fit', panels.body).onclick = () => { xf = FIT; redraw(); };
    cv.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    cv.addEventListener('dblclick', e => { const r = cv.getBoundingClientRect(); if (xf.s > 1) { xf = FIT; redraw(); } else zoomAt(2.5, e.clientX - r.left, e.clientY - r.top); });
    const ptrs = new Map(); let last = null;
    cv.addEventListener('pointerdown', e => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ } last = null; });
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId), now = { x: e.clientX, y: e.clientY }, r = cv.getBoundingClientRect();
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], o = a === prev ? b : a, d0 = Math.hypot(a.x - b.x, a.y - b.y); ptrs.set(e.pointerId, now);
        const d1 = Math.hypot(now.x - o.x, now.y - o.y); if (d0 > 8) zoomAt(d1 / d0, (now.x + o.x) / 2 - r.left, (now.y + o.y) / 2 - r.top);
      } else if (xf.s > 1) { xf = clampView({ s: xf.s, ox: xf.ox + now.x - prev.x, oy: xf.oy + now.y - prev.y }, W, H); ptrs.set(e.pointerId, now); redraw(); }
    });
    const up = e => { ptrs.delete(e.pointerId); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  };
  $('#mt-site', panels.body).onclick = () => { current = 'site'; render(); };
  $('#mt-region', panels.body).onclick = () => { current = 'region'; render(); };
  render();
}

// ---------------------------------------------------------------- the minimap (Settings, off by default)
export class MiniMap {
  constructor(game) {
    this.game = game; this.t = 0; this.eco = null;
    const cv = this.cv = document.createElement('canvas'); cv.id = 'minimap'; cv.width = 260; cv.height = 180; cv.className = 'hidden'; cv.setAttribute('aria-label', 'Minimap');
    $('#hud')?.appendChild(cv);
  }
  update(dt) {
    const g = this.game, on = !!g.settings.minimap && g.mode === 'land' && !g.panels.isOpen;
    this.cv.classList.toggle('hidden', !on);
    if (!on) return;
    this.t -= dt; if (this.t > 0) return; this.t = 0.3;
    const eco = g.eco, { map } = siteMapFor(eco), aspect = (map.view.x1 - map.view.x0) / (map.view.z1 - map.view.z0);
    const w = 260, h = Math.round(w / aspect), cv = this.cv, d = Math.min(2, window.devicePixelRatio || 1);
    if (cv.height !== Math.round(h * d) || cv.width !== Math.round(w * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    drawMini(cv, eco, liveState(g), w, h, d);
  }
}
function drawMini(cv, eco, st, W, H, dpr) {
  const { map, geo } = siteMapFor(eco), view = map.view, ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.drawImage(baseLayer(map, eco, geo, W, H, dpr, FIT), 0, 0, W, H);
  const P = (x, z) => [((x - view.x0) / (view.x1 - view.x0)) * W, ((z - view.z0) / (view.z1 - view.z0)) * H];
  const sf = safetyState(map, st.swell ?? 0);
  if (sf?.active && geo.safe.length) { trace(ctx, geo.safe, W, H, FIT); ctx.fillStyle = 'rgba(232,85,61,0.35)'; ctx.fill('evenodd'); }
  for (const s of map.spots) { const [x, y] = P(s.x, s.z); ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.283); ctx.fillStyle = uncaughtAt(st.progress, s.spot).length ? '#ffb347' : '#fff'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); }
  for (const p of map.pois) if (p.kind === 'shop' || p.kind === 'club' || p.kind === 'coop') { const [x, y] = P(p.x, p.z); ctx.fillStyle = '#ffd36b'; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(x - 4, y - 4, 8, 8); }
  for (const n of st.npcs) { const [x, y] = P(n.x, n.z); ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.283); ctx.fillStyle = '#ff8a5c'; ctx.fill(); }
  if (st.boat) { const [x, y] = P(st.boat.x, st.boat.z); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, 6, 6); }
  const [x, y] = P(st.player.x, st.player.z);
  arrow(ctx, Math.max(6, Math.min(W - 6, x)), Math.max(6, Math.min(H - 6, y)), st.player.heading ?? 0, 6, '#5fcf7a', false);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(0, 0, W, H);
}
