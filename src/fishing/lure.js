// Working a lure: the retrieve phase that follows a cast on a lure rig (fishing.js state 'retrieve').
// The player has three moves on one key: tap Space = twitch, hold Space = reel, nothing = pause. A fish from the spot's catch table
// shadows the lure and its interest rises when the last couple of seconds of moves match the way that species feeds (its lure style),
// and falls when they do not. At full interest it strikes, on the move its style strikes on. Constant mismatch spooks it and it leaves.
// Pure logic, no three.js: tested in tests/lure.test.mjs. Styles are gameplay tuning [unverified], not species biology facts.
import { SPECIES_BY_ID } from './species.js';

/** How a species likes a lure worked. `wants` scores the last WINDOW seconds: reelFrac = share of the window spent reeling, twitches = taps in it,
 * pause = seconds since the last move. `strikeOn` is the move it bites on. `hint` is what the HUD says when it turns away. */
export const STYLES = {
  fastroll: { label: 'fast roll', strikeOn: 'reel', hint: 'Pelagic fish chase: hold to reel fast and keep it moving.',
    wants: ({ reelFrac }) => smooth(0.35, 0.8, reelFrac) },
  slowroll: { label: 'slow roll', strikeOn: 'pause', hint: 'Slow it down: reel a little, then let it sink.',
    wants: ({ reelFrac, pause }) => smooth(0.08, 0.25, reelFrac) * (1 - smooth(0.6, 0.9, reelFrac)) * (0.6 + 0.4 * smooth(0.2, 0.6, pause)) },
  twitchpause: { label: 'twitch and pause', strikeOn: 'pause', hint: 'Ambush fish wait: twitch it, then pause and let it sink.',
    wants: ({ reelFrac, twitches, pause }) => smooth(0.3, 1.0, twitches) * (1 - smooth(0.3, 0.6, reelFrac)) * (0.4 + 0.6 * smooth(0.4, 1.0, pause)) },
  hop: { label: 'hop and sink', strikeOn: 'pause', hint: 'Squid take a sinking jig: twitch twice, then let it sink still for a few seconds.',
    wants: ({ reelFrac, twitches, pause }) => smooth(0.8, 1.8, twitches) * (1 - smooth(0.15, 0.4, reelFrac)) * smooth(0.4, 1.0, pause) },
};
/** A species' lure style: its own `lure` field, else by habitat and fight. */
export function styleOf(id) {
  const sp = SPECIES_BY_ID[id];
  if (!sp) return 'slowroll';
  if (sp.lure && STYLES[sp.lure]) return sp.lure;
  if (sp.habitat === 'invertebrate') return 'hop';
  if (sp.habitat === 'pelagic') return 'fastroll';
  if (sp.fight === 'twitch' || sp.habitat === 'estuarine') return 'twitchpause';
  return 'slowroll';
}

export const WINDOW = 2.4;        // seconds of moves the fish judges
export const TAP_MAX = 0.22;      // a press shorter than this is a twitch, longer is reeling
export const TUNING = {
  rise: 0.42,        // interest gained per second at a perfect match
  fall: 0.28,        // lost per second at a complete mismatch
  spookAt: -0.45,    // interest this low and the fish turns away
  strikeAt: 1,
  noticeAfter: 0.8,  // seconds the shadow needs before it can be judged (it has just arrived)
  graceWindow: 1.2,  // seconds after the shadow appears during which a mismatch costs nothing
};

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Turns raw Space up/down into a move each frame: 'twitch' on the frame a short tap ends, 'reel' while held past TAP_MAX, else 'pause'. */
export class MoveReader {
  constructor() { this.heldFor = 0; this.wasDown = false; }
  read(down, dt) {
    let move = 'pause';
    if (down) { this.heldFor += dt; if (this.heldFor > TAP_MAX) move = 'reel'; }
    else { if (this.wasDown && this.heldFor <= TAP_MAX) move = 'twitch'; this.heldFor = 0; }
    this.wasDown = down;
    return move;
  }
}

/** The shadow fish's interest in the lure: step it with the move of each frame; read `interest` (-0.45..1), `match` (0..1) and `verdict`. */
export class LureInterest {
  constructor(style) {
    this.style = STYLES[style] ? style : 'slowroll';
    this.events = [];   // [{ t, move }] over the last WINDOW seconds
    this.t = 0; this.interest = 0; this.match = 0; this.pause = 0; this.verdict = null;   // null | 'strike' | 'spook'
  }
  /** The shape of the last WINDOW seconds: how much reeling, how many twitches, how long since the last move. */
  shape() {
    let reel = 0, twitches = 0;
    for (const e of this.events) { if (e.move === 'reel') reel += e.dt; else if (e.move === 'twitch') twitches++; }
    return { reelFrac: Math.min(1, reel / WINDOW), twitches, pause: this.pause };
  }
  step(dt, move) {
    if (this.verdict) return this.verdict;
    this.t += dt;
    if (move === 'pause') this.pause += dt; else this.pause = 0;
    if (move !== 'pause') this.events.push({ t: this.t, move, dt });
    while (this.events.length && this.events[0].t < this.t - WINDOW) this.events.shift();
    const S = STYLES[this.style], shape = this.shape();
    this.match = S.wants(shape);
    if (this.t < TUNING.noticeAfter) return null;
    const gain = this.match * TUNING.rise - (1 - this.match) * TUNING.fall * (this.t < TUNING.graceWindow ? 0 : 1);
    this.interest = Math.max(TUNING.spookAt, Math.min(TUNING.strikeAt, this.interest + gain * dt));
    if (this.interest >= TUNING.strikeAt && move === S.strikeOn) this.verdict = 'strike';
    else if (this.interest <= TUNING.spookAt) this.verdict = 'spook';
    return this.verdict;
  }
}
