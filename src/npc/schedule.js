// Daily schedules: where each person is, and what they are doing, at dawn / day / dusk / night. Pure functions (no DOM, no three.js), unit-tested in
// tests/npc.test.mjs. The schedule data itself lives in src/content/npcs.js; place names resolve to coordinates in src/npc/places.js.
//   slot = { act: 'fishing' | 'walking' | 'standing' | 'sitting' | 'away', at?: 'place', path?: ['place', ...], face?: 'water' | radians }

export const TIMES = ['dawn', 'day', 'dusk', 'night'];
export const ACTS = ['fishing', 'walking', 'standing', 'sitting', 'away'];
/** Heading (radians, model forward is +z) that faces the water at both sites (the water is toward -z). */
export const WATER_HEADING = Math.PI;

/** The slot for this person at this site and time of day; null when they do not live at this site. */
export function slotAt(def, siteId, time) {
  const s = def?.sites?.[siteId];
  if (!s) return null;
  return s[time] ?? s.day ?? null;
}
export const isAway = slot => !slot || slot.act === 'away';
/** Place names a slot uses. */
export const placesOf = slot => (slot?.path ? slot.path : slot?.at ? [slot.at] : []);

/** Turn a slot into points: { act, points: [{x, z}], heading (or null: face the way you walk), away }. `places` maps names to { x, z }. */
export function resolveSlot(slot, places) {
  if (isAway(slot)) return { act: 'away', points: [], heading: null, away: true };
  const points = placesOf(slot).map(n => {
    const p = places[n];
    if (!p) throw new Error(`Unknown place "${n}"`);
    return { x: p.x, z: p.z };
  });
  const heading = slot.face === 'water' ? WATER_HEADING : typeof slot.face === 'number' ? slot.face : null;
  return { act: slot.act, points, heading, away: false };
}

/** Everyone who is out and about at this site at this time: [{ id, slot }]. */
export function presentAt(npcs, siteId, time) {
  const out = [];
  for (const [id, def] of Object.entries(npcs)) {
    const slot = slotAt(def, siteId, time);
    if (slot && !isAway(slot)) out.push({ id, slot });
  }
  return out;
}

/** A short phrase for the quest log / name tag: what they are doing. */
export function activityText(slot) {
  switch (slot?.act) {
    case 'fishing': return 'fishing';
    case 'walking': return 'walking the shore';
    case 'sitting': return 'taking a break';
    case 'standing': return 'on duty';
    default: return 'away';
  }
}

/** Where along a path of points (ping-pong) a walker is after travelling `dist` metres. Returns { x, z, heading, leg } (heading = direction of travel). */
export function pathPosition(points, dist) {
  if (points.length === 1) return { x: points[0].x, z: points[0].z, heading: null, leg: 0 };
  const lens = []; let total = 0;
  for (let i = 0; i < points.length - 1; i++) { const l = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z); lens.push(l); total += l; }
  if (total < 1e-6) return { x: points[0].x, z: points[0].z, heading: null, leg: 0 };
  let d = ((dist % (total * 2)) + total * 2) % (total * 2);
  const back = d > total; if (back) d = total * 2 - d;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const k = Math.min(1, d / (lens[i] || 1)), a = points[i], b = points[i + 1];
      const hx = (b.x - a.x) * (back ? -1 : 1), hz = (b.z - a.z) * (back ? -1 : 1);
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, heading: Math.atan2(hx, hz), leg: i };
    }
    d -= lens[i];
  }
  return { x: points.at(-1).x, z: points.at(-1).z, heading: null, leg: lens.length - 1 };
}
