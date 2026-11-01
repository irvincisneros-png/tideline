// The boat's fish finder (sounder / sonar). Pure and deterministic: the same seed, place and time always give the same picture, so it is unit-tested (tests/reef.test.mjs).
//
// How it works (taught on the panel, dataset E1, worksheets 2.1.7 and 2.1.13): the transducer under the boat sends a short pulse of sound down in a cone. Sound bounces back (echoes) off whatever it hits:
// the bottom, a school of baitfish, a single big fish. The time the echo takes is the distance (sound in water travels about 1500 m each second), so it can be drawn as a depth. A hard bottom
// (reef, rock) sends back a strong echo, a thick line (often with a second echo); a soft bottom (sand, mud) a thinner one. A fish swim bladder is full of gas, which reflects sound strongly, so fish show up
// as marks; as the boat moves over one, the cone first catches it at an angle (far = deep), then straight below (near), then at an angle again, which draws an ARCH. A school is a cloud of dots.
// The screen scrolls: the newest ping is at the right and the places the boat has been slide off to the left.
// Fish finders are a harvesting technology (recreational and commercial, where they find schools): they can make it easier to over-fish, but bag and size limits apply regardless of gear (dataset E1, worksheet 2.1.7).
// [unverified biology: how strongly a swim bladder reflects sound is general sonar science, not a DPIRD rule. No rule here depends on it.]
import { SPECIES } from './species.js';

export const BEAM_HALF = (30 * Math.PI) / 180;   // half-angle of the sound cone (a wide, 60 degree cone, so arches are easy to see)
export const TAN_BEAM = Math.tan(BEAM_HALF);
export const SOUND_SPEED = 1500;                  // m/s in sea water
export const CELL = 6;                            // metres: fish are generated per 6 m cell
export const SCHOOL_CELL = 28;
export const MAX_RANGE = 26;                      // the screen shows 0 to 26 m

/** A small integer hash -> [0, 1). Deterministic. */
function h01(a, b, c = 0, d = 0) {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647) + Math.imul(d | 0, 1274126177)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177); x = x ^ (x >>> 16);
  x = Math.imul(x, 2246822519) ^ (x >>> 15);
  return ((x >>> 0) % 1000003) / 1000003;
}
const spotOf = hard => (hard > 0.6 ? 'reef' : hard > 0.25 ? 'reefedge' : 'reefsand');
/** What the bottom is called on the screen, from how hard it is (0 soft .. 1 hard). */
export const bottomKind = hard => (hard > 0.6 ? 'reef' : hard > 0.25 ? 'rubble' : 'sand');
export const BOTTOM_LABEL = { reef: 'Hard bottom: reef', rubble: 'Mixed bottom: rubble and ledges', sand: 'Soft bottom: sand' };

const PELAGIC = new Set(['pelagic']);
/** Species that can show as a mark over each bottom type, weighted by how common they are there (species.js `spots`). */
function pool(hard) {
  const spot = spotOf(hard);
  return SPECIES.filter(s => s.spots[spot] && s.habitat !== 'invertebrate').map(s => ({ id: s.id, w: s.spots[spot], pelagic: PELAGIC.has(s.habitat), len: s.length }));
}
const POOLS = {};
const poolFor = hard => (POOLS[spotOf(hard)] ??= pool(hard));

/**
 * The fish that live in one 6 m cell: up to three, each { id, len (cm), x0, z0 (home), above (m above the bottom, or null for mid-water), a (wander radius m), w, ph }.
 * `site` = { seed, hardAt(x, z) -> 0..1, depthAt(x, z) -> metres }.
 */
export function fishInCell(site, cx, cz) {
  const out = [], hard = site.hardAt((cx + 0.5) * CELL, (cz + 0.5) * CELL), seed = site.seed | 0;
  const chance = [0.1 + 0.8 * hard, (0.05 + 0.75 * hard) * 0.7, hard > 0.5 ? 0.5 * hard : 0];   // far more fish over hard bottom (the cone is narrower in shallow water, so there must be many more)
  for (let k = 0; k < 3; k++) {
    if (h01(cx, cz, seed, 11 + k) > chance[k]) continue;
    const list = poolFor(hard), total = list.reduce((s, x) => s + x.w, 0);
    let r = h01(cx, cz, seed, 21 + k) * total, pick = list[0];
    for (const it of list) { if ((r -= it.w) <= 0) { pick = it; break; } }
    const [lo, hi] = pick.len, len = Math.round(lo + (hi - lo) * Math.pow(h01(cx, cz, seed, 31 + k), 1.5));
    out.push({
      id: pick.id, len, k,
      x0: (cx + h01(cx, cz, seed, 41 + k)) * CELL, z0: (cz + h01(cx, cz, seed, 51 + k)) * CELL,
      above: pick.pelagic ? null : 0.4 + h01(cx, cz, seed, 61 + k) * 2.6, mid: 0.25 + 0.5 * h01(cx, cz, seed, 71 + k),
      a: 1.2 + 2.4 * h01(cx, cz, seed, 81 + k), w: 0.12 + 0.2 * h01(cx, cz, seed, 91 + k), ph: h01(cx, cz, seed, 101 + k) * 6.283,
    });
  }
  return out;
}
/** Where a fish is at time t: its home plus a slow loop. { x, z, y (depth below the surface, m) }. */
export function fishPos(site, f, t) {
  const x = f.x0 + Math.cos(f.w * t + f.ph) * f.a, z = f.z0 + Math.sin(f.w * 0.83 * t + f.ph * 1.7) * f.a * 0.8, bottom = site.depthAt(x, z);
  const y = f.above != null ? bottom - f.above : Math.max(2.5, bottom * f.mid);
  return { x, z, y: Math.max(1.5, Math.min(bottom - 0.3, y)) };
}
/** A cloud of baitfish (one per 28 m cell with some chance): { x, z, y, r, thick }, or null. */
export function schoolInCell(site, sx, sz) {
  const seed = site.seed | 0;
  if (h01(sx, sz, seed, 7) > 0.28) return null;
  const x = (sx + 0.15 + 0.7 * h01(sx, sz, seed, 8)) * SCHOOL_CELL, z = (sz + 0.15 + 0.7 * h01(sx, sz, seed, 9)) * SCHOOL_CELL, bottom = site.depthAt(x, z);
  return { x, z, y: Math.max(3, bottom * (0.35 + 0.3 * h01(sx, sz, seed, 10))), r: 5 + 4 * h01(sx, sz, seed, 12), thick: 1.5 + 1.5 * h01(sx, sz, seed, 13), id: 'yakka' };
}

/**
 * One ping from a boat at (x, z) at time t (seconds). Returns
 *   { x, z, t, depth (m), hard (0..1), bottom ('reef' | 'rubble' | 'sand'), label, second (a second bottom echo shows over hard ground),
 *     fish: [{ id, len, range (slant m), under (true when it is almost straight below), strength 0..1 }], dots: [range...] (baitfish echoes), school: 0..1, pingMs }
 */
export function ping(site, x, z, t = 0) {
  const depth = site.depthAt(x, z), hard = site.hardAt(x, z), fish = [], dots = [];
  const reach = (depth + 4) * TAN_BEAM + 4, c0 = Math.floor((x - reach) / CELL), c1 = Math.floor((x + reach) / CELL), r0 = Math.floor((z - reach) / CELL), r1 = Math.floor((z + reach) / CELL);
  for (let cx = c0; cx <= c1; cx++) for (let cz = r0; cz <= r1; cz++) for (const f of fishInCell(site, cx, cz)) {
    const p = fishPos(site, f, t), d = Math.hypot(p.x - x, p.z - z), cone = p.y * TAN_BEAM;
    if (d > cone) continue;
    fish.push({ id: f.id, len: f.len, range: Math.hypot(p.y, d), under: d < 1.2, strength: 1 - d / cone, h: p.y });
  }
  fish.sort((a, b) => a.range - b.range);
  let school = 0;
  for (let sx = Math.floor((x - 14) / SCHOOL_CELL); sx <= Math.floor((x + 14) / SCHOOL_CELL); sx++) for (let sz = Math.floor((z - 14) / SCHOOL_CELL); sz <= Math.floor((z + 14) / SCHOOL_CELL); sz++) {
    const s = schoolInCell(site, sx, sz);
    if (!s) continue;
    const d = Math.hypot(s.x - x, s.z - z), cone = s.y * TAN_BEAM + s.r;
    if (d > cone) continue;
    const dens = Math.max(0, 1 - d / cone); school = Math.max(school, dens);
    const n = Math.round(6 * dens);
    for (let i = 0; i < n; i++) dots.push(s.y + (h01(Math.floor(t * 5), i, sx * 31 + sz, 3) - 0.5) * 2 * s.thick);
  }
  return { x, z, t, depth, hard, bottom: bottomKind(hard), label: BOTTOM_LABEL[bottomKind(hard)], second: hard > 0.6, fish, dots, school, pingMs: Math.round((2 * depth) / SOUND_SPEED * 1000 * 10) / 10 };
}

/** The mark (if any) closest to a point on the bottom, such as where a bait has sunk: { id, len } within `radius` metres horizontally and `reach` metres of the bottom. Used by the bite model. */
export function fishNear(site, x, z, t, radius = 8, reach = 5) {
  let best = null, bd = radius;
  const c0 = Math.floor((x - radius) / CELL), c1 = Math.floor((x + radius) / CELL), r0 = Math.floor((z - radius) / CELL), r1 = Math.floor((z + radius) / CELL);
  for (let cx = c0; cx <= c1; cx++) for (let cz = r0; cz <= r1; cz++) for (const f of fishInCell(site, cx, cz)) {
    const p = fishPos(site, f, t), d = Math.hypot(p.x - x, p.z - z);
    if (d < bd && site.depthAt(p.x, p.z) - p.y <= reach) { bd = d; best = { id: f.id, len: f.len, d }; }
  }
  return best;
}

/** A rolling picture: push pings, read the columns (newest last). Keeps `n` columns. */
export class SonarTape {
  constructor(n = 120) { this.n = n; this.cols = []; }
  push(p) { this.cols.push(p); if (this.cols.length > this.n) this.cols.shift(); return p; }
  clear() { this.cols.length = 0; }
}

/** The words on the panel: how it works and how to read the screen (dataset E1; worksheets 2.1.7, 2.1.13). */
export const HOW_IT_WORKS = {
  title: 'How a fish finder works',
  steps: [
    'A transducer under the boat sends a pulse of sound straight down, in a cone.',
    'The sound bounces back (an echo) off the bottom and off fish. A fish\'s swim bladder is full of gas, and gas bounces sound back strongly.',
    'The finder times the echo to work out the distance. The screen scrolls: the newest ping is on the right and the places the boat has been slide off to the left.',
  ],
  read: [
    ['A thick, wavy line', 'the bottom. A thick bright line (often with a second echo below it) is hard bottom such as reef; a thin line is soft sand.'],
    ['An arch', 'a single fish. The boat passes through its edge of the cone (far, deep), then straight over it (near, shallow), then out the other side: that draws an arch.'],
    ['A cloud of dots', 'a school of baitfish.'],
  ],
  tech: 'A fish finder is a harvesting technology: recreational and commercial fishers both use sounders to find fish. That can make it easier to over-fish, so remember: bag and size limits apply no matter what gear you use (worksheet 2.1.7).',
  tip: 'Drop your bait near the bottom, right under the marks.',
};
