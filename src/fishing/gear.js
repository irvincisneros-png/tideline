// Tackle and the day's conditions. Rigs, baits, a small labelled diagram of each rig, the tackle-box panel HTML,
// and DayConditions (tide, time of day, season, swell) which cycle with in-game time.
import { TIDES, SEASON_MONTH } from './catches.js';
import { rigUnlocked, baitUnlocked, lockHint, hasItem, LURE_COLOURS } from '../npc/inventory.js';
import { clarityOf, CLARITY_LABEL, LURE_FX, lureMod } from '../economy/effects.js';
import { baitCount, gearStats } from '../economy/store.js';
import { COLLECT } from '../content/shop.js';
import { canCollect } from '../economy/store.js';

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const RIGS = {
  paternoster: { name: 'Paternoster', lure: false, blurb: 'Sinker on the bottom of the line, hooks on short side droppers above it. Holds bait just off the seabed.' },
  runningsinker: { name: 'Running sinker', lure: false, blurb: 'The sinker slides on the line down to a swivel, so a fish can pick up the bait and feel almost no weight.' },
  float: { name: 'Float (bobby cork)', lure: false, blurb: 'A float holds the bait at one depth in mid-water and shows you every nibble.' },
  unweighted: { name: 'Unweighted', lure: false, blurb: 'Just a hook and bait on the line. The bait sinks slowly and naturally.' },
  softplastic: { name: 'Soft plastic', lure: true, blurb: 'A lure: a rubber tail on a weighted jig head. You work it with the rod tip. No bait needed.' },
  metalslug: { name: 'Metal slug', lure: true, blurb: 'A lure: a heavy shiny slug that you cast a long way and retrieve fast. No bait needed.' },
  squidjig: { name: 'Squid jig', lure: true, blurb: 'A lure: a prawn-shaped jig with a ring of spikes (no barbed hook). No bait needed.' },
};
export const RIG_ORDER = ['paternoster', 'runningsinker', 'float', 'unweighted', 'softplastic', 'metalslug', 'squidjig'];

export const BAITS = {
  beachworm: { name: 'Beach worm', color: '#c46a5a', note: 'Collect no more than 20 a day.' },
  nipper: { name: 'Nipper (yabby)', color: '#e8a0a0', note: 'Pumped from sand flats. Limit 100.' },
  prawn: { name: 'Prawn', color: '#f0a070', note: 'Use local prawns: imported raw prawns have spread white spot disease.' },
  pilchard: { name: 'Pilchard', color: '#9ab8c8', note: 'Keep bait on ice in a sealed tub, out of the sun.' },
  squidstrip: { name: 'Squid strip', color: '#f0e0d0', note: 'Tough, stays on the hook well.' },
  greenweed: { name: 'Green weed', color: '#6cb46a', note: 'Fresh weed from the rocks, for fish that eat weed.' },
};
export const BAIT_ORDER = Object.keys(BAITS);

// ---------------------------------------------------------------- rig diagrams (inline SVG, 150 x 130)
const INK = '#1f5f6b';
const hook = (x, y, bait = true) => `<path d="M${x} ${y} v10 a6 6 0 0 1 -12 0 v-4" fill="none" stroke="#6a7a84" stroke-width="1.8" stroke-linecap="round"/><circle cx="${x}" cy="${y - 1}" r="1.6" fill="none" stroke="#6a7a84" stroke-width="1"/>${bait ? `<ellipse cx="${x - 6}" cy="${y + 14}" rx="4.5" ry="3" fill="#f0a070" stroke="${INK}" stroke-width="1"/>` : ''}`;
const swivel = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="3.4" fill="#d8dee2" stroke="${INK}" stroke-width="1"/>`;
const sinker = (x, y, rx = 5, ry = 6) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#9aa6ae" stroke="${INK}" stroke-width="1.2"/>`;
const line = (x1, y1, x2, y2, w = 1.4, c = INK) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
const tag = (text, x, y, tx, ty) => `<line x1="${x}" y1="${y}" x2="${tx - 1}" y2="${ty - 2}" stroke="${INK}" stroke-width="0.6" opacity="0.6"/><text x="${tx}" y="${ty}" font-size="8.6" fill="${INK}" font-weight="700">${text}</text>`;

const DIAGRAMS = {
  paternoster: () => [
    line(36, 6, 36, 98), swivel(36, 14), sinker(36, 104),
    line(36, 40, 18, 48, 1.1), hook(18, 48), line(36, 68, 54, 76, 1.1), hook(54, 76),
    tag('main line', 38, 28, 62, 26), tag('swivel', 39, 14, 62, 14), tag('dropper', 45, 72, 66, 62), tag('hook + bait', 58, 92, 64, 112), tag('sinker', 41, 104, 50, 124),
  ],
  runningsinker: () => [
    line(36, 6, 36, 70), sinker(36, 46, 5, 7), `<circle cx="36" cy="46" r="1.6" fill="${INK}"/>`, swivel(36, 72), line(36, 75, 36, 92, 1, '#7aa0a8'), hook(36, 92),
    tag('main line', 38, 20, 62, 18), tag('sinker slides', 41, 46, 62, 44), tag('swivel (stop)', 39, 72, 62, 72), tag('leader', 37, 84, 62, 86), tag('hook + bait', 40, 106, 62, 108),
  ],
  float: () => [
    line(36, 6, 36, 96), `<ellipse cx="36" cy="26" rx="6" ry="9" fill="#fff" stroke="${INK}" stroke-width="1.2"/><path d="M30 24 a6 9 0 0 1 12 0z" fill="#ff5a4a" stroke="${INK}" stroke-width="1"/><line x1="36" y1="15" x2="36" y2="10" stroke="${INK}" stroke-width="1.4"/>`,
    sinker(36, 56, 2.6, 3), swivel(36, 72), line(36, 75, 36, 90, 1, '#7aa0a8'), hook(36, 90),
    tag('float', 43, 26, 62, 24), tag('line', 37, 42, 62, 42), tag('small sinker', 39, 56, 62, 56), tag('swivel', 39, 72, 62, 72), tag('leader', 37, 83, 62, 86), tag('hook + bait', 40, 104, 62, 106),
  ],
  unweighted: () => [
    line(36, 6, 36, 88), swivel(36, 40), hook(36, 88),
    tag('line', 37, 20, 62, 20), tag('swivel', 39, 40, 62, 40), tag('no sinker', 37, 64, 62, 64), tag('hook + bait', 40, 104, 62, 106),
  ],
  softplastic: () => [
    line(36, 6, 36, 62), swivel(36, 62),
    `<circle cx="36" cy="76" r="6" fill="#9aa6ae" stroke="${INK}" stroke-width="1.2"/><path d="M36 82 v8 a5 5 0 0 1 -10 0" fill="none" stroke="#6a7a84" stroke-width="1.6" stroke-linecap="round"/>`,
    `<path d="M40 78 q18 4 14 18 q-4 12 -14 6 q8 -2 8 -9 q-3 -6 -8 -7z" fill="#f0a0b8" stroke="${INK}" stroke-width="1.1"/>`,
    tag('leader', 37, 40, 62, 38), tag('jig head', 42, 76, 62, 74), tag('soft plastic tail', 54, 96, 62, 114),
  ],
  metalslug: () => [
    line(36, 6, 36, 40), swivel(36, 40),
    `<path d="M36 46 q8 6 6 28 q-2 12 -6 16 q-4 -4 -6 -16 q-2 -22 6 -28z" fill="#d8e2e8" stroke="${INK}" stroke-width="1.2"/><path d="M33 56 q3 -4 4 6" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`,
    `<path d="M36 90 v4 M36 94 q-8 2 -10 -6 M36 94 q8 2 10 -6 M36 94 v8 q0 4 -4 3" fill="none" stroke="#6a7a84" stroke-width="1.6" stroke-linecap="round"/>`,
    tag('swivel', 39, 40, 62, 38), tag('metal slug', 44, 66, 62, 64), tag('treble hook', 44, 96, 62, 100),
  ],
  squidjig: () => [
    line(36, 6, 36, 36), swivel(36, 36),
    `<path d="M30 44 q-2 -8 6 -8 q8 0 6 8 q6 14 -2 30 q-4 8 -4 14 q0 -6 -4 -14 q-8 -16 -2 -30z" fill="#f0a0b8" stroke="${INK}" stroke-width="1.2"/><circle cx="33" cy="48" r="2" fill="#fff" stroke="${INK}" stroke-width="0.8"/><circle cx="33" cy="48" r="0.8" fill="${INK}"/>`,
    `<path d="M28 92 l-4 8 M32 94 l-2 9 M36 94 v10 M40 94 l2 9 M44 92 l4 8" stroke="#6a7a84" stroke-width="1.6" stroke-linecap="round"/>`,
    tag('line + swivel', 39, 36, 62, 34), tag('jig body (sinks)', 43, 60, 62, 60), tag('spikes, no barb', 44, 98, 62, 106),
  ],
};
export const rigDiagram = id => `<svg viewBox="0 0 150 130" class="tb-svg" role="img" aria-label="${esc(RIGS[id].name)} diagram">${DIAGRAMS[id]().join('')}</svg>`;

/**
 * Tackle-box panel body. gear = { rig, bait }; p = the saved progress (its inventory decides which rigs and baits are unlocked, its shop which bait you have left; without it all are);
 * site = the site id (where you can collect bait); cond = DayConditions (the water clarity for the lure colours).
 */
export function tackleBoxHTML(gear, p = null, site = null, cond = null) {
  const lure = RIGS[gear.rig].lure;
  const rigOpen = id => !p || rigUnlocked(p, id), baitOpen = id => !p || baitUnlocked(p, id);
  const owns = id => !!p && hasItem(p, id);
  const left = id => (p ? baitCount(p, id) : 99);
  const kit = [['tool-tagkit', '🏷 Tag kit'], ['tool-releaseweight', '⚖ Release weight'], ['bait-nipper', '🪈 Nipper pump']].filter(([id]) => owns(id)).map(([, n]) => n);
  const gs = p ? gearStats(p) : null;
  const colour = p ? p.inventory.lure ?? 'pink' : 'pink', clarity = cond?.clarity ?? 'clear', time = cond?.time ?? 'day';
  const collectable = p && site ? Object.keys(COLLECT).filter(id => baitOpen(id) || COLLECT[id].sites.includes(site)) : [];
  return `<div class="tb">
    <h2>Tackle box</h2>
    <p class="tb-sub">Pick the rig and bait for your next cast. Fish are fussy: the best tackle for one fish can be the wrong choice for another. ${p ? 'Some tackle is locked until you earn it from the people on the coast.' : ''}</p>
    ${gs ? `<p class="tb-gear"><span>🎣 ${esc(gs.rodName)}</span><span>🧵 ${esc(gs.lineName)}</span><small>Change rods and line at Mitra's shop.</small></p>` : ''}
    <h3>Rig</h3>
    <div class="tb-rigs">${RIG_ORDER.map(id => { const open = rigOpen(id); return `<button class="tb-rig ${gear.rig === id ? 'sel' : ''} ${open ? '' : 'locked'}" data-rig="${id}" ${open ? '' : 'aria-disabled="true"'} title="${esc(open ? RIGS[id].blurb : `Locked. ${lockHint(p, 'rig', id)}`)}" aria-pressed="${gear.rig === id}">
      ${rigDiagram(id)}<b>${esc(RIGS[id].name)}</b>${open ? '' : `<span class="tb-lock">🔒 ${esc(lockHint(p, 'rig', id) || 'Locked')}</span>`}</button>`; }).join('')}</div>
    <p class="tb-desc" id="tb-desc"><b>${esc(RIGS[gear.rig].name)}:</b> ${esc(RIGS[gear.rig].blurb)}</p>
    <h3>Bait ${lure ? '<span class="tb-lure">lures need no bait</span>' : ''}</h3>
    <div class="tb-baits ${lure ? 'off' : ''}">${BAIT_ORDER.map(id => { const open = baitOpen(id), n = left(id), out = open && n <= 0; return `<button class="tb-bait ${!lure && gear.bait === id ? 'sel' : ''} ${open && !out ? '' : 'locked'}" data-bait="${id}" ${lure ? 'disabled' : ''} ${open && !out ? '' : 'aria-disabled="true"'} aria-pressed="${!lure && gear.bait === id}" title="${esc(open ? BAITS[id].note : `Locked. ${lockHint(p, 'bait', id)}`)}">
      <i style="background:${BAITS[id].color}"></i>${esc(BAITS[id].name)}${open ? `<span class="tb-n ${out ? 'out' : ''}">${out ? 'none left' : '×' + n}</span>` : `<span class="tb-lock">🔒 ${esc(lockHint(p, 'bait', id) || 'Locked')}</span>`}</button>`; }).join('')}</div>
    <p class="tb-note" id="tb-note">${lure ? 'Lures are cast and worked back. Pick a bait rig to use bait again.' : esc(BAITS[gear.bait]?.note ?? '')}</p>
    ${collectable.length ? `<h3>Collect your own bait <span class="tb-lure">free, inside the daily limit</span></h3>
      <div class="tb-collect">${collectable.map(id => { const c = canCollect(p, id, site), d = COLLECT[id]; return `<div class="tb-col ${c.ok ? '' : 'no'}"><div><b>${esc(BAITS[id].name)}</b><small>${esc(d.rule)} ${c.ok ? '' : esc(c.reason)}</small></div>
        <button class="btn small" data-collect="${id}" ${c.ok ? '' : 'disabled'}>Collect ${d.per}${d.limit ? ` <em>${c.got}/${d.limit} today</em>` : ''}</button></div>`; }).join('')}</div>` : ''}
    ${lure && owns('tool-lurecolours') ? `<h3>Lure colour</h3><div class="tb-baits" id="tb-lures">${LURE_COLOURS.map(c => `<button class="tb-bait tb-lurecol ${colour === c.id ? 'sel' : ''}" data-lure="${c.id}" aria-pressed="${colour === c.id}"><i style="background:${c.css}"></i>${esc(c.name)}</button>`).join('')}</div>
      <p class="tb-note">${esc(LURE_FX[colour]?.hint ?? '')} In ${esc(CLARITY_LABEL[clarity])} at ${esc(time)} it changes the bite by ${(() => { const m = Math.round((lureMod(colour, clarity, time) - 1) * 100); return `${m >= 0 ? '+' : '−'}${Math.abs(m)}%`; })()}.</p>` : ''}
    ${kit.length ? `<p class="tb-note">In your kit: ${kit.join(' · ')}</p>` : ''}
    <p class="tb-actions"><button class="btn primary" id="tb-done">Done <kbd>T</kbd></button></p>
  </div>`;
}

// ---------------------------------------------------------------- the day's conditions
/** In-game minutes that pass per real second. A tide cycle (12.4 h) takes ~4 real minutes; a day takes 8. */
export const MIN_PER_SEC = 3;
const TIDE_PERIOD = 744; // minutes, ~12.4 h
export const TIME_HOURS = { dawn: 6.2, day: 11, dusk: 17.7, night: 22 };
const TIDE_LABEL = { rising: 'Rising tide', high: 'High tide', falling: 'Falling tide', low: 'Low tide' };

export function seasonFromDate(d = new Date()) {
  const m = d.getMonth();
  return seasonOfMonth(m);
}
/** The season a month (0 = January) is in: summer Dec-Feb, autumn Mar-May, winter Jun-Aug, spring Sep-Nov. */
export const seasonOfMonth = m => (m === 11 || m < 2 ? 'summer' : m < 5 ? 'autumn' : m < 8 ? 'winter' : 'spring');
/** The hour a day starts at: just after sunrise, so the scene is bright (the clock runs on to dusk and night in about 5 minutes). */
export const START_HOUR = 7.6;

export class DayConditions {
  /** opts: season, time ('dawn'|'day'|'dusk'|'night' or hour number), tide (phase name), swell (m). Defaults: this season, dawn, random tide/swell. */
  constructor(opts = {}, rnd = Math.random) {
    const m0 = opts.month != null && opts.month !== '' && Number.isFinite(Number(opts.month)) ? ((Math.round(Number(opts.month)) % 12) + 12) % 12 : null;
    this.season = opts.season ?? (m0 != null ? seasonOfMonth(m0) : seasonFromDate());
    this.month = m0 ?? (opts.season ? SEASON_MONTH[opts.season] ?? new Date().getMonth() : new Date().getMonth());   // 0 = January
    const h = opts.time in TIME_HOURS ? TIME_HOURS[opts.time] : Number(opts.time) || START_HOUR;
    this.minutes = h * 60;
    const phase = TIDES.includes(opts.tide) ? { low: 0, rising: 0.25, high: 0.5, falling: 0.75 }[opts.tide] : rnd();
    this.tideOffset = phase * TIDE_PERIOD - this.minutes;
    this.swellBase = opts.swell ?? 0.7 + rnd() * 1.4;
  }
  update(dt) { this.minutes += dt * MIN_PER_SEC; }
  /** Tide height 0 (low) .. 1 (high). */
  get tideHeight() { return (1 - Math.cos(this.tidePhase * Math.PI * 2)) / 2; }
  get tidePhase() { return ((((this.minutes + this.tideOffset) % TIDE_PERIOD) + TIDE_PERIOD) % TIDE_PERIOD) / TIDE_PERIOD; }
  get tide() { const p = this.tidePhase; return p < 0.125 || p >= 0.875 ? 'low' : p < 0.375 ? 'rising' : p < 0.625 ? 'high' : 'falling'; }
  get hour() { return (this.minutes / 60) % 24; }
  get time() { const h = this.hour; return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night'; }
  get swell() { return Math.max(0.2, this.swellBase + 0.2 * Math.sin(this.minutes / 47)); }
  get clock() { const h = Math.floor(this.hour), m = Math.floor(this.minutes % 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  /** Water clarity today (clear / stained / murky), from the swell: it decides which lure colour works (economy/effects.js). */
  get clarity() { return clarityOf(this.swell); }
  /** The bite-model context for the tackle the player has chosen. `extra` adds the gear modifiers (shy, lureMod). */
  context(gear, stock, extra = {}) { return { rig: gear.rig, bait: gear.bait, tide: this.tide, time: this.time, season: this.season, month: this.month, stock, clarity: this.clarity, ...extra }; }
  chip() { return `${TIDE_LABEL[this.tide]} · ${this.clock} ${this.time} · ${this.season} · swell ${this.swell.toFixed(1)} m`; }
}
