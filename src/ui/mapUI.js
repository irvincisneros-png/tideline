// The map (key M, the 🗺 touch button, and the pause menu): a painted top-down map of the current site made from the site's own layout data
// (ui/mapData.js), and a stylised region map of the whole Illawarra coast with each site's lock. Plus the optional corner minimap (Settings).
import { buildSiteMap, uncaughtAt, safetyState, npcMarkers, project, SPOT_TINT, REGION_SITES, VIEWS } from './mapData.js';
import { ECOSYSTEMS, ecoById } from '../ecosystems/index.js';
import { siteLock } from '../ecosystems/unlock.js';
import { SPECIES_BY_ID, SPOT_INFO } from '../fishing/species.js';
import { esc } from './panels.js';

const $ = (s, r = document) => r.querySelector(s);
const INK = '#1f5f6b', DEEP = '#14434d', CREAM = '#fff3d2', CORAL = '#e8553d';
const cache = new Map();   // site id -> { map, base (painted canvas) }

/** The map data and the painted base layer for a site, built once. */
export function siteMapFor(eco) {
  let c = cache.get(eco.id);
  if (!c) { const map = buildSiteMap(eco); c = { map, base: paintBase(map, eco) }; cache.set(eco.id, c); }
  return c;
}

const lerp = (a, b, k) => a + (b - a) * k;
/** Paint the land colours, the water by depth, a pale shoreline and the soft spot tints, at 4 canvas pixels per map cell (smoothed). */
function paintBase(map, eco, px = 4) {
  const { cols, rows } = map, small = document.createElement('canvas'); small.width = cols; small.height = rows;
  const sctx = small.getContext('2d'), img = sctx.createImageData(cols, rows), d = img.data;
  const shallow = [127, 224, 212], deep = [30, 124, 160];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, o = k * 4;
    if (map.land[k]) { d[o] = map.rgb[k * 3]; d[o + 1] = map.rgb[k * 3 + 1]; d[o + 2] = map.rgb[k * 3 + 2]; }
    else {
      const t = Math.min(1, map.depth[k] / (eco.id === 'reef' ? 22 : 8));
      let r = lerp(shallow[0], deep[0], t), g = lerp(shallow[1], deep[1], t), b = lerp(shallow[2], deep[2], t);
      // pale foam where water touches land
      let near = false;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni >= 0 && nj >= 0 && ni < cols && nj < rows && map.land[nj * cols + ni]) near = true; }
      if (near) { r = lerp(r, 245, 0.6); g = lerp(g, 252, 0.6); b = lerp(b, 245, 0.6); }
      d[o] = r; d[o + 1] = g; d[o + 2] = b;
    }
    d[o + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const c = document.createElement('canvas'); c.width = cols * px; c.height = rows * px;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, c.width, c.height);
  // spot tints (faint; the biggest spot of a site is the default water and stays untinted)
  const tint = document.createElement('canvas'); tint.width = cols; tint.height = rows;
  const tctx = tint.getContext('2d'), timg = tctx.createImageData(cols, rows), td = timg.data;
  const counts = {}; for (let k = 0; k < cols * rows; k++) if (map.spotIdx[k] >= 0) counts[map.spotIdx[k]] = (counts[map.spotIdx[k]] ?? 0) + 1;
  const dominant = Object.keys(counts).length > 1 ? +Object.entries(counts).sort((x, y) => y[1] - x[1])[0][0] : -1;
  for (let k = 0; k < cols * rows; k++) {
    const si = map.spotIdx[k]; if (si < 0 || si === dominant) continue;
    const v = parseInt((SPOT_TINT[map.spotNames[si]] ?? '#ffffff').slice(1), 16);
    td[k * 4] = v >> 16; td[k * 4 + 1] = (v >> 8) & 255; td[k * 4 + 2] = v & 255; td[k * 4 + 3] = map.land[k] ? 70 : 62;
  }
  tctx.putImageData(timg, 0, 0);
  ctx.drawImage(tint, 0, 0, c.width, c.height);
  // danger zone: red diagonal hatching, masked to the zone (drawn faint always, strong when the swell is up)
  if (map.safety) {
    const sc = document.createElement('canvas'); sc.width = cols; sc.height = rows;
    const sx = sc.getContext('2d'), si = sx.createImageData(cols, rows);
    for (let k = 0; k < cols * rows; k++) if (map.safe[k]) si.data[k * 4 + 3] = 255;
    sx.putImageData(si, 0, 0);
    const h = document.createElement('canvas'); h.width = c.width; h.height = c.height;
    const hx = h.getContext('2d'); hx.fillStyle = 'rgba(232,85,61,0.1)'; hx.fillRect(0, 0, h.width, h.height);
    hx.strokeStyle = 'rgba(214,60,40,0.55)'; hx.lineWidth = 2.5;
    for (let i = -h.height; i < h.width; i += 12) { hx.beginPath(); hx.moveTo(i, h.height); hx.lineTo(i + h.height, 0); hx.stroke(); }
    hx.globalCompositeOperation = 'destination-in'; hx.imageSmoothingEnabled = true; hx.drawImage(sc, 0, 0, h.width, h.height);
    map.safeCanvas = h;
    ctx.globalAlpha = 0.35; ctx.drawImage(h, 0, 0); ctx.globalAlpha = 1;
  }
  return c;
}

// ---------------------------------------------------------------- drawing helpers
const shortLabel = l => { const t = l.replace(/^(Lake Illawarra|Belmore|Bellambi) /, ''); return t.charAt(0).toUpperCase() + t.slice(1); };
function halo(ctx, text, x, y, size = 13, color = DEEP) {
  ctx.font = `800 ${size}px ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif`;
  ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,243,210,0.95)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function disc(ctx, x, y, r, fill, glyph, size) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  if (glyph) { ctx.font = `${size ?? r * 1.15}px system-ui, "Apple Color Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText(glyph, x, y + 1); }
}
/** Greedy label placement: try beside the point, then above/below, skipping spots that overlap a label already placed. */
class Labels {
  constructor(w, h) { this.w = w; this.h = h; this.boxes = []; }
  free(b) { return b.x >= 2 && b.y >= 2 && b.x + b.w <= this.w - 2 && b.y + b.h <= this.h - 2 && !this.boxes.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y); }
  put(ctx, text, x, y, r, size = 13, color) {
    ctx.font = `800 ${size}px ui-rounded, "Nunito", "Trebuchet MS", system-ui, sans-serif`;
    const w = ctx.measureText(text).width + 4, h = size + 4;
    for (const [bx, by] of [[x + r + 3, y - h / 2], [x - r - 3 - w, y - h / 2], [x - w / 2, y - r - 3 - h], [x - w / 2, y + r + 3], [x + r + 3, y - h - r], [x + r + 3, y + r], [x - r - 3 - w, y - h - r], [x - r - 3 - w, y + r]]) {
      const b = { x: bx, y: by, w, h };
      if (this.free(b)) { this.boxes.push(b); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; halo(ctx, text, bx + 2, by + 2, size, color); return true; }
    }
    return false;
  }
  reserve(x, y, r) { this.boxes.push({ x: x - r, y: y - r, w: r * 2, h: r * 2 }); }
}

function arrow(ctx, x, y, heading, r, fill) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI - heading);   // the arrow points up; heading 0 faces +z, which is down the page
  ctx.beginPath(); ctx.moveTo(0, -r * 1.35); ctx.lineTo(r * 0.95, r * 0.9); ctx.lineTo(0, r * 0.4); ctx.lineTo(-r * 0.95, r * 0.9); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
}

/** Draw the whole site map into a canvas. `state` = { player: {x,z,heading}, npcs, progress, swell, boat }. */
export function drawSiteMap(canvas, eco, state, opts = {}) {
  const { map, base } = siteMapFor(eco), view = map.view;
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H); ctx.drawImage(base, 0, 0, W, H);
  const P = (x, z) => project(view, x, z, W, H), u = 1, L = new Labels(W, H);
  const sf = safetyState(map, state.swell ?? 0);
  // live danger zone: stronger and edged when the swell is up
  if (sf && sf.active && map.safeCanvas) ctx.drawImage(map.safeCanvas, 0, 0, W, H);
  // people
  const people = state.npcs ?? [];
  // danger zone caption
  if (sf) {
    let sx = 0, sz = 0, n = 0; for (let k = 0; k < map.safe.length; k++) if (map.safe[k]) { sx += k % map.cols; sz += (k / map.cols) | 0; n++; }
    if (n) { const x = (sx / n + 0.5) / map.cols * W, y = (sz / n + 0.5) / map.rows * H; L.put(ctx, `${sf.active ? '⚠ DANGER' : 'Danger in big swell'}: ${sf.label}`, x, y - 4, 4, 12 * Math.max(1, u * 0.95), sf.active ? CORAL : '#a33a26'); }
  }
  // points of interest
  const pr = Math.max(9, 11 * u);
  for (const p of map.pois) {
    const [x, y] = P(p.x, p.z);
    disc(ctx, x, y, pr, p.kind === 'shop' ? '#ffd36b' : p.kind === 'home' ? '#d9f5df' : CREAM, p.icon, pr * 1.2);
    L.reserve(x, y, pr);
  }
  // fishing spots with "?" for species not caught yet
  const sr = Math.max(10, 12 * u);
  for (const s of map.spots) {
    const [x, y] = P(s.x, s.z), more = uncaughtAt(state.progress, s.spot);
    ctx.beginPath(); ctx.arc(x, y, sr, 0, 6.283); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.font = `${sr * 1.15}px system-ui, "Apple Color Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText('🎣', x, y + 1);
    if (more.length) { ctx.beginPath(); ctx.arc(x + sr * 0.85, y - sr * 0.85, sr * 0.55, 0, 6.283); ctx.fillStyle = '#ffb347'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); ctx.font = `800 ${sr * 0.8}px ui-rounded, system-ui`; ctx.fillStyle = INK; ctx.fillText('?', x + sr * 0.85, y - sr * 0.85 + 1); }
    L.reserve(x, y, sr);
  }
  for (const p of map.pois) { const [x, y] = P(p.x, p.z); L.put(ctx, p.label.replace(/ \(head home\)/, ''), x, y, pr, 12 * Math.max(1, u * 0.95)); }
  for (const s of map.spots) { const [x, y] = P(s.x, s.z); L.put(ctx, shortLabel(s.label), x, y, sr, 13 * Math.max(1, u * 0.95), DEEP); }
  // the offshore boat
  if (state.boat) { const [x, y] = P(state.boat.x, state.boat.z); disc(ctx, x, y, pr, '#fff', '⛵', pr * 1.1); L.put(ctx, 'You (the boat)', x, y, pr, 12 * Math.max(1, u * 0.95)); }
  // people
  for (const n of people) {
    const [x, y] = P(n.x, n.z); if (x < 0 || y < 0 || x > W || y > H) continue;
    ctx.beginPath(); ctx.arc(x, y, Math.max(5, 6 * u), 0, 6.283); ctx.fillStyle = '#ff8a5c'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    L.put(ctx, n.name, x, y, 6 * u, 12 * Math.max(1, u * 0.95), '#a33a26');
  }
  // you
  if (state.player && !state.boat) {
    const [x, y] = P(state.player.x, state.player.z), cx = Math.max(10, Math.min(W - 10, x)), cy = Math.max(10, Math.min(H - 10, y));
    ctx.beginPath(); ctx.arc(cx, cy, 15 * u + 4, 0, 6.283); ctx.fillStyle = 'rgba(95,207,122,0.35)'; ctx.fill();
    arrow(ctx, cx, cy, state.player.heading ?? 0, Math.max(8, 9 * u), '#5fcf7a');
    L.put(ctx, 'You', cx, cy, 12 * u, 13 * Math.max(1, u * 0.95), '#1d6b3b');
  }
  // frame + compass
  ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.strokeRect(0, 0, W, H);
  const cx = W - 34 * u - 8, cy = H - 34 * u - 8;
  ctx.beginPath(); ctx.arc(cx, cy, 20 * u, 0, 6.283); ctx.fillStyle = 'rgba(255,243,210,0.9)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = CORAL; ctx.beginPath(); ctx.moveTo(cx, cy - 15 * u); ctx.lineTo(cx + 5 * u, cy); ctx.lineTo(cx - 5 * u, cy); ctx.closePath(); ctx.fill();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(cx, cy + 15 * u); ctx.lineTo(cx + 5 * u, cy); ctx.lineTo(cx - 5 * u, cy); ctx.closePath(); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; halo(ctx, 'N', cx, cy - 26 * u - 2, 11 * u + 2);
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
  <text x="62" y="73.5" font-size="2.6" fill="#fff" font-weight="800" stroke="#14434d" stroke-width=".5" paint-order="stroke">Five Islands</text>
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
  let current = tab, sel = eco.id, timer = null;
  const aspect = (view.x1 - view.x0) / (view.z1 - view.z0);
  const narrow = innerWidth < 600, Hh = narrow ? 300 : 520, W = Math.min(narrow ? 700 : 900, Math.round(Hh * aspect)), H2 = Math.round(W / aspect);   // drawn at about the size it is shown, so the labels stay readable; on a phone the map pans sideways
  panels.open(`<div class="mapview"><h2>🗺 Map</h2>
    <div class="map-tabs" role="tablist"><button class="btn small" id="mt-site" role="tab">This place</button><button class="btn small" id="mt-region" role="tab">Illawarra coast</button></div>
    <div id="map-body"></div></div>`, () => { clearInterval(timer); game.mapOpen = false; }, { flow: 'map' });
  game.mapOpen = true;
  const body = $('#map-body', panels.body);
  const render = () => {
    $('#mt-site', panels.body).classList.toggle('on', current === 'site'); $('#mt-site', panels.body).setAttribute('aria-selected', current === 'site');
    $('#mt-region', panels.body).classList.toggle('on', current === 'region'); $('#mt-region', panels.body).setAttribute('aria-selected', current === 'region');
    clearInterval(timer);
    if (current === 'region') {
      body.innerHTML = `<p class="sub">TideLine's five places on the Illawarra coast, north at the top. A padlock means the place is still locked.</p>
        <div class="map-scroll"><div class="region-wrap">${regionHTML(game, sel)}</div></div><div class="region-card" id="rg-card">${regionCard(game, sel)}</div>`;
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
      <div class="map-scroll"><canvas id="map-cv" width="${W}" height="${H2}" aria-label="Map of ${esc(eco.name)}"></canvas></div>
      ${safeText(map, st.swell)}
      <div class="map-legend"><span><i class="dot you"></i> You</span><span><i class="dot ppl"></i> People</span><span>🎣 Fishing spot</span><span><i class="dot q">?</i> Fish you haven't caught</span><span>🛒 Shop</span><span>🏠 Head home</span></div>
      <ul class="map-spots">${rows}</ul>`;
    const cv = $('#map-cv', body), redraw = () => { const s = liveState(game); drawSiteMap(cv, eco, s); };
    redraw(); timer = setInterval(redraw, 400);
    const sc = cv.parentElement; if (sc.scrollWidth > sc.clientWidth) { const [px] = project(view, st.player.x, st.player.z, W, H2); sc.scrollLeft = px - sc.clientWidth / 2; }   // phone: centre the pan on you
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
    const w = 260, h = Math.round(w / aspect), cv = this.cv;
    if (cv.height !== h) cv.height = h;
    const s = liveState(g); s.npcs = s.npcs;
    drawMini(cv, eco, s);
  }
}
function drawMini(cv, eco, st) {
  const { map, base } = siteMapFor(eco), view = map.view, W = cv.width, H = cv.height, ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H); ctx.drawImage(base, 0, 0, W, H);
  const P = (x, z) => project(view, x, z, W, H);
  const sf = safetyState(map, st.swell ?? 0);
  if (sf?.active && map.safeCanvas) ctx.drawImage(map.safeCanvas, 0, 0, W, H);
  for (const s of map.spots) { const [x, y] = P(s.x, s.z); ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.283); ctx.fillStyle = uncaughtAt(st.progress, s.spot).length ? '#ffb347' : '#fff'; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); }
  for (const p of map.pois) if (p.kind === 'shop') { const [x, y] = P(p.x, p.z); ctx.fillStyle = '#ffd36b'; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(x - 4, y - 4, 8, 8); }
  for (const n of st.npcs) { const [x, y] = P(n.x, n.z); ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.283); ctx.fillStyle = '#ff8a5c'; ctx.fill(); }
  if (st.boat) { const [x, y] = P(st.boat.x, st.boat.z); ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, 6, 6); }
  const [x, y] = P(st.player.x, st.player.z);
  arrow(ctx, Math.max(6, Math.min(W - 6, x)), Math.max(6, Math.min(H - 6, y)), st.player.heading ?? 0, 6, '#5fcf7a');
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(0, 0, W, H);
}
