// The fish trail: one "next fish to find" at a time, so there is always a clear thing to do (owner, Nov 2026: students kept catching the same
// fish with no idea where or when the others bite). It never locks anything: the player can ignore it, skip a fish or switch it off in Settings.
// The trail walks the sites in the order they open and, inside a site, from the commonest fish to the rarest. For the current target it gives a
// recipe (site, spot, rig, bait, best time and tide) built from the same bite-model data the game uses, a live checklist of that recipe, and the
// ONE next step as a short instruction for the HUD. Following the recipe makes the target bite far more often (TARGET_BOOST in catches.js).
// The fish's name is never given away before it is identified with the key: the trail calls it "a new fish".
// Pure functions (no DOM, no THREE), unit-tested in tests/trail.test.mjs.
import { SPECIES, SPECIES_BY_ID, REGIONS, SPOT_INFO } from './species.js';
import { tierOf, atLeast, labelOf } from './guide.js';
import { goodRig, goodBait } from './catches.js';

/** Sites in the order a new save meets them (it starts on the lake), and the Fish Guide region each one covers. */
export const SITE_ORDER = ['seagrass', 'rocky', 'harbour', 'reef', 'river'];
export const SITE_REGION = { seagrass: 'lake', rocky: 'bellambi', harbour: 'harbour', reef: 'reef', river: 'river' };
export const SITE_LABEL = { seagrass: 'Lake Illawarra', rocky: 'Bellambi beach', harbour: 'Belmore Basin', reef: 'the offshore reef', river: 'the river' };
/** A rig or bait counts as "right" for a species at this match or better (the same threshold the bite boost uses). */
export const GOOD_MATCH = 0.7;
const TIME_WORD = { dawn: 'dawn', day: 'the middle of the day', dusk: 'dusk', night: 'night' };
const LURES = new Set(['softplastic', 'metalslug', 'squidjig']);
const spotName = k => SPOT_INFO[k].label.replace('Lake Illawarra ', '').replace('Belmore ', '').replace('Offshore ', '').toLowerCase();
const join = l => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} or ${l.at(-1)}`);

/** The best spot for a species inside a region, and its base weight there ({ spot: null, w: 0 } when it does not live there). */
function bestSpot(sp, region) {
  let spot = null, w = 0;
  for (const k of REGIONS[region].spots) if ((sp.spots[k] ?? 0) > w) { w = sp.spots[k]; spot = k; }
  return { spot, w };
}

/**
 * Every species once, in trail order: [{ id, site, spot }]. A species that lives at several sites is met at the first one (in SITE_ORDER) where it is
 * reasonably common (base weight 2 or more), else where it is commonest. Inside a site: commonest first, fish with a hard gate (squid: jig, dusk) last.
 */
export function buildTrail() {
  const rows = [];
  for (const sp of SPECIES) {
    const opts = SITE_ORDER.map(site => ({ site, ...bestSpot(sp, SITE_REGION[site]) })).filter(o => o.spot);
    if (!opts.length) continue;
    const pick = opts.find(o => o.w >= 2) ?? opts.reduce((a, b) => (b.w > a.w ? b : a));
    rows.push({ id: sp.id, site: pick.site, spot: pick.spot, w: pick.w, gated: !!sp.gate, i: rows.length });
  }
  rows.sort((a, b) => SITE_ORDER.indexOf(a.site) - SITE_ORDER.indexOf(b.site) || a.gated - b.gated || b.w - a.w || a.i - b.i);
  return rows.map(({ id, site, spot }) => ({ id, site, spot }));
}
export const TRAIL = buildTrail();

/** The best choice from a { key: match } table: the best one you own if it is good enough, else the best there is (marked locked). */
function choose(table, owned, allowed = null, good = (k, m) => m >= GOOD_MATCH) {
  const all = Object.entries(table).filter(([k]) => !allowed || allowed.includes(k)).sort((a, b) => b[1] - a[1]);
  if (!all.length) return null;
  const mine = all.find(([k, m]) => good(k, m) && owned(k));
  const [id, match] = mine ?? all[0];
  return { id, match, owned: !!mine || owned(id) };
}

/**
 * The recipe for a trail entry: { id, site, spot, rig: {id, owned}, bait: {id, owned} | null (a lure needs none), time: [..], tide: [..] }.
 * `has` = { rig: id => bool, bait: id => bool } (what is in the player's tackle box).
 */
export function recipeFor(entry, has = { rig: () => true, bait: () => true }) {
  const sp = SPECIES_BY_ID[entry.id], g = sp.gate ?? {};
  const rig = choose(sp.rig, has.rig, g.rig, k => goodRig(sp, k)) ?? { id: g.rig?.[0] ?? 'runningsinker', match: 1, owned: has.rig(g.rig?.[0] ?? 'runningsinker') };
  const bait = LURES.has(rig.id) ? null : choose(sp.bait, has.bait, null, k => goodBait(sp, k));
  return { id: sp.id, site: entry.site, spot: entry.spot, rig, bait, time: g.time ?? sp.time ?? [], tide: sp.tide ?? [], hardTime: !!g.time };
}

/**
 * The fish to find next: the first trail entry not yet caught, at a site that is open, that the player has not skipped.
 * opts: { open: site => bool, skipped: [ids], ready: entry => bool }. A fish you already have the tackle for comes before one that needs a rig or
 * bait you have not earned (that one's step then says who to ask), so the trail never stalls on a locked item while something else is catchable. Returns { entry, n (caught so far), total, lockedSite } or null when the trail is finished.
 * When every fish at the open sites is caught, the next one at a locked site is returned with lockedSite: true (the HUD then says what opens it).
 */
export function nextTarget(progress, { open = () => true, skipped = [], ready = () => true } = {}) {
  const todo = TRAIL.filter(e => !atLeast(tierOf(progress, e.id), 'caught'));
  const n = TRAIL.length - todo.length, total = TRAIL.length;
  if (!todo.length) return null;
  const openTodo = todo.filter(e => open(e.site));
  const fresh = openTodo.filter(e => !skipped.includes(e.id));
  const entry = fresh.find(ready) ?? fresh[0] ?? openTodo.find(ready) ?? openTodo[0] ?? null;   // everything left was skipped: start the skipped ones again
  if (entry) return { entry, n, total, lockedSite: false };
  return { entry: todo[0], n, total, lockedSite: true };
}

/**
 * The live checklist for a recipe. `now` = { site, spot, rig, bait, time, tide } (tide null on the river).
 * Returns rows [{ key, ok, soft, label, value }]: site, rig, bait, spot are the steps; time and tide are "soft" (they help but never block).
 */
export function checklist(recipe, now, names = { rig: k => k, bait: k => k }) {
  const sp = SPECIES_BY_ID[recipe.id], rows = [];
  rows.push({ key: 'site', ok: now.site === recipe.site, label: 'Where', value: SITE_LABEL[recipe.site] });
  rows.push({ key: 'rig', ok: goodRig(sp, now.rig) && (!sp.gate?.rig || sp.gate.rig.includes(now.rig)), label: 'Rig', value: names.rig(recipe.rig.id), owned: recipe.rig.owned });
  if (recipe.bait) rows.push({ key: 'bait', ok: !LURES.has(now.rig) && goodBait(sp, now.bait), label: 'Bait', value: names.bait(recipe.bait.id), owned: recipe.bait.owned });
  rows.push({ key: 'spot', ok: now.site === recipe.site && (sp.spots[now.spot] ?? 0) > 0, label: 'Cast at', value: `the ${spotName(recipe.spot)}` });
  if (recipe.time.length) rows.push({ key: 'time', ok: recipe.time.includes(now.time), soft: !recipe.hardTime, label: 'Best time', value: join(recipe.time.map(t => TIME_WORD[t])) });
  if (recipe.tide.length && now.tide != null) rows.push({ key: 'tide', ok: recipe.tide.includes(now.tide), soft: true, label: 'Best tide', value: `${join(recipe.tide)} tide` });
  return rows;
}

/** What the trail calls its target: the real name once identified, "the fish you saw" style labels before that (the key must not be given away). */
export function targetName(progress, id) {
  const l = labelOf(progress, id);
  return l === '???' || l === 'Unseen fish' ? 'a new fish' : l;
}

/**
 * The ONE next step, as a short HUD line. `t` = nextTarget(), rows = checklist(), lockText = what opens a locked site.
 * Order: travel, rig, bait, spot, then (a hard time gate only) wait for the time; with everything set it says "cast here".
 */
export function nextStep(t, rows, { lockText = '', hints = {} } = {}) {
  if (!t) return 'Fish trail finished: every fish caught!';
  const head = `Next fish (${t.n + 1} of ${t.total})`;
  if (t.lockedSite) return `${head}: at ${SITE_LABEL[t.entry.site]}. ${lockText}`.trim();
  const row = k => rows.find(r => r.key === k);
  const site = row('site'), rig = row('rig'), bait = row('bait'), spot = row('spot'), time = row('time');
  if (!site.ok) return `${head}: travel to ${site.value}`;
  if (!rig.ok) return rig.owned ? `${head}: switch to the ${rig.value} rig` : `${head}: needs the ${rig.value} rig. ${hints.rig ?? ''}`.trim();
  if (bait && !bait.ok) return bait.owned ? `${head}: bait up with ${bait.value}` : `${head}: needs ${bait.value}. ${hints.bait ?? ''}`.trim();
  if (!spot.ok) return `${head}: cast at ${spot.value}`;
  if (time && !time.ok && !time.soft) return `${head}: it only bites at ${time.value}`;
  return time && !time.ok ? `${head}: cast here (best at ${time.value})` : `${head}: cast here!`;
}

/** When does the target's best time next start? Minutes to add to the day clock to reach it (0 when it is that time now). */
export function minutesUntil(times, hourNow) {
  const START = { dawn: 5.2, day: 8.2, dusk: 17.2, night: 20.2 };
  if (!times.length) return 0;
  const waits = times.map(t => ((START[t] - hourNow + 24) % 24) * 60);
  return Math.round(Math.min(...waits));
}
