// Snags and tangles (review Part 1, docs/specs/2026-11-06-purpose-onboarding-review.md). Pure logic, no three.js: tested in tests/snags.test.mjs.
//
// A snag is a comic interruption with a small lesson, never a punishment:
//   * It can only happen while the rig is MOVING near structure (a reel in a wait, or a reel or a sunk pause in a lure retrieve), never in a still wait,
//     never while a shadow fish is following, never on a float rig, never on open sand.
//   * TAP Space (2 to 4 counted taps, 0.3 s apart at least) and the rig drops off. There is no timer.
//   * HOLD Space and the tension climbs to full in 1.6 s, then the line is cut. Letting go lowers it. The student sees it coming and chose it.
//   * Input is ignored until Space has been let go once, so a Space that was already down (reeling in) can never count as a pull.
// A cut line costs the bait (never an inventory item), a re-tie (the knot game), one `lostLine` and a teaching toast. No Steward deduction.
// A tangle (1c) is the same state with a fishing NPC's line: hold to wind in, nothing can be cut, no knot needed.
import { MoveReader } from './lure.js';

/** Chance weight of a snag at each fishing spot (keys of SPOT_INFO), 0 to 1. A spot not listed cannot snag. */
export const SNAG_SPOT = { snags: 1, reef: 0.8, mangrove: 0.8, rock: 0.7, breakwall: 0.7, jetty: 0.6, wharf: 0.6, reefedge: 0.6, pool: 0.4, weir: 0.4, seagrass: 0.25, channel: 0.1, basin: 0.1, flats: 0, beach: 0, reefsand: 0 };
/** How much each rig catches on the bottom, 0 to 1. A float rig rides on the surface and never snags. */
export const SNAG_RIG = { runningsinker: 1, softplastic: 1, paternoster: 0.8, squidjig: 0.7, metalslug: 0.6, unweighted: 0.5, float: 0 };

/** Gameplay tuning (not a biology fact). */
export const SNAG = {
  cast: 10,            // metres a typical cast moves the rig while it is rolling: what the per-metre chance is tuned against
  perCast: 0.2,        // chance of a snag in one such cast at risk 1 (with the cooldown below that works out at about 1 snag in 8 casts at a high-risk spot)
  cooldown: 3,         // casts after a snag with no roll at all
  sunkSpeed: 0.3,      // metres of "drag" per second a sunk, paused lure counts for (it is not moving, but it is sitting in the structure)
  forceMetres: 1.5,    // a forced snag (the mission) waits for this much rig movement, so it does not pop the instant the rod is cast
  tapGap: 0.3,         // seconds between COUNTED taps; faster taps do nothing, with no penalty
  tapsMin: 2, tapsMax: 4,
  holdSecs: 1.6,       // a held Space takes tension 0 to 1 in this long, and a full tension cuts the line
  fallSecs: 1.2,       // and letting go takes it 1 to 0 in this long
  windSecs: 2.2,       // a tangle: holding Space winds the lines clear in this long
  windFallSecs: 4,     // ... and letting go loses the progress this slowly
};
/** Chance per metre of rig movement at risk 1, so a SNAG.cast-metre cast has `perCast` chance. */
export const PER_METRE = 1 - Math.pow(1 - SNAG.perCast, 1 / SNAG.cast);

/** How snaggy this spot and rig are together, 0 to 1. Unknown spots and rigs are 0. */
export const snagRisk = (spot, rig) => (SNAG_SPOT[spot] ?? 0) * (SNAG_RIG[rig] ?? 0);

/**
 * The roll. Call newCast() at each splashdown and step() every frame the rig could be moving. step() returns true when the rig snags.
 * ctx: { spot, rig, state ('wait' | 'retrieve'), move ('reel' | 'twitch' | 'pause'), sink (0..1, a lure's depth), shadow (a fish is following), speed (m/s of a reel) }.
 */
export class SnagRoll {
  constructor(rnd = Math.random) { this.rnd = rnd; this.cool = 0; this.blocked = false; this.force = false; this.moved = 0; }
  /** A new cast has landed: count down the cooldown. */
  newCast() { this.blocked = this.cool > 0; if (this.cool > 0) this.cool--; this.moved = 0; }
  /** Is the rig doing something that can snag? (Reeling in a wait; reeling or sitting sunk in a retrieve. Never with a shadow fish on.) */
  static eligible(ctx) {
    if (ctx.shadow) return false;
    if (ctx.state === 'wait') return ctx.move === 'reel';
    if (ctx.state === 'retrieve') return ctx.move === 'reel' || (ctx.move === 'pause' && (ctx.sink ?? 0) > 0.7);
    return false;
  }
  step(dt, ctx) {
    if ((this.blocked && !this.force) || !SnagRoll.eligible(ctx)) return false;   // a forced (mission) snag ignores the cooldown
    const risk = snagRisk(ctx.spot, ctx.rig);
    if (risk <= 0) return false;   // a float rig or open sand can never snag, even when a mission wants one
    const m = (ctx.move === 'reel' ? (ctx.speed ?? 1) : SNAG.sunkSpeed) * dt;
    this.moved += m;
    if (this.force) { if (this.moved >= SNAG.forceMetres) return this.hit(); return false; }
    if (this.rnd() < 1 - Math.pow(1 - PER_METRE * risk, m)) return this.hit();
    return false;
  }
  hit() { this.cool = SNAG.cooldown; this.force = false; this.blocked = true; return true; }   // blocked: no second snag in the same cast
}

/** The snagged rig, as the player works it. step(dt, down) returns null while it is on, 'freed' or 'cut'. No timers: only what the student does. */
export class SnagState {
  constructor(rnd = Math.random) {
    this.reader = new MoveReader();
    this.armed = false;     // false until Space has been let go once: a held reel is not a pull
    this.need = SNAG.tapsMin + Math.floor(rnd() * (SNAG.tapsMax - SNAG.tapsMin + 1));   // counted taps to free the rig (2 to 4, a different number each snag)
    this.taps = 0; this.sinceTap = Infinity; this.tension = 0; this.result = null;
  }
  step(dt, down) {
    if (this.result) return this.result;
    if (!this.armed) {
      this.reader.read(false, dt);   // nothing the student does counts until they have let go
      if (!down) this.armed = true;
      return null;
    }
    this.sinceTap += dt;
    const move = this.reader.read(down, dt);
    if (move === 'twitch' && this.sinceTap >= SNAG.tapGap) { this.taps++; this.sinceTap = 0; }   // a tap too soon after the last counted one is simply ignored
    this.tension = move === 'reel' ? Math.min(1, this.tension + dt / SNAG.holdSecs) : Math.max(0, this.tension - dt / SNAG.fallSecs);
    if (this.tension >= 1) return (this.result = 'cut');
    if (this.taps >= this.need) return (this.result = 'freed');
    return null;
  }
}

/** Crossed lines with a fishing NPC: hold Space to wind in. Nothing can break. step(dt, down) returns null or 'freed'. progress is 0..1. */
export class TangleState {
  constructor() { this.progress = 0; this.result = null; }
  get tension() { return this.progress; }
  step(dt, down) {
    if (this.result) return this.result;
    this.progress = down ? Math.min(1, this.progress + dt / SNAG.windSecs) : Math.max(0, this.progress - dt / SNAG.windFallSecs);
    return this.progress >= 1 ? (this.result = 'freed') : null;
  }
}

/**
 * Do the segments a-b and c-d cross? Points are { x, z }. A proper crossing only: touching ends, sharing an end or lying along each other do not count.
 * Used once at splashdown, rod tip to float against a fishing NPC's rod tip to float.
 */
export function crosses(a, b, c, d) {
  const o = (p, q, r) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// ---------------------------------------------------------------- the bookkeeping (pure, on the saved progress object)
const skills = p => {
  const s = (p.skills = p.skills && typeof p.skills === 'object' ? p.skills : {});
  if (!s.knots || typeof s.knots !== 'object') s.knots = {};
  if (!s.lostLine || typeof s.lostLine !== 'object') s.lostLine = {};
  return s;
};
/** A snag was freed by tapping: p.skills.snagFreed counts up (the mission "Structure" reads it). Returns the new count. */
export function bookSnagFreed(p) { const s = skills(p); s.snagFreed = (s.snagFreed ?? 0) + 1; return s.snagFreed; }
/** A line was cut (a snag held too long, or a fish that dived for structure): one lost line at this site. No credits, no Steward points. */
export function bookLineCut(p, ecoId) { const s = skills(p); s.lostLine[ecoId] = (s.lostLine[ecoId] ?? 0) + 1; return s.lostLine[ecoId]; }
/** How many lines of yours are still in the water at this site. */
export const lostLineCount = (p, ecoId) => Math.max(0, +skills(p).lostLine[ecoId] || 0);
/**
 * The catch bar's zone touched the line you lost: take it off the count. Pays no credits and adds NOTHING to `steward.litter` or `steward.points`
 * (litter is 15% of the Steward rating and Fatima pays for it, so a cut line must not be a way to farm either). Returns true if there was a line to collect.
 */
export function collectLostLine(p, ecoId) {
  if (lostLineCount(p, ecoId) <= 0) return false;
  skills(p).lostLine[ecoId] -= 1;
  return true;
}

// ---------------------------------------------------------------- words (the game's voice: short, kind, one idea each)
export const SNAG_TEXT = {
  prompt: 'Snagged! Tap, tap, tap to let it drop off. Don\'t pull.',
  tanglePrompt: 'Tangled with {who}\'s line! Hold <kbd>Space</kbd> to wind in.',
  freed: 'Free! A few gentle taps let the rig drop off. That is the way.',
  cut: 'The line snapped. Pulling hard on a snag only wedges it tighter. Next time, tap to let it drop off.',
  tipStructure: 'Reefs, rocks, jetty piles and weed hold fish, and they hold hooks too. Working your rig near structure risks a snag.',
  tipFloat: 'A float rig rides above the bottom, so it will not snag. Over weed or reef, a float is the answer.',
  tipYank: 'Do not yank a snag. A hard pull only wedges the hook and snaps the line. Tap and let it drop off.',
  lostLine: 'That\'s the line you lost.',
};
