// The catch bar: a vertical bar that opens when you strike. Hold Space (or press and hold the bar on touch) to lift the green
// reel zone; let go and it falls with a little bounce. Keep the fish icon inside the zone to fill the catch meter, outside it
// drains. The fish moves the way its species fights (dart | shake | bolt | twitch | jet). Gear sets the zone size: matched
// tackle = big and steady, mismatched = small and jittery. Litter drifts through; catch it with the zone for a steward point.
// Coordinates are fractions of the track: 0 = bottom, 1 = top.

import { INTRO } from '../content/teachers.js';

/** Tuning constants (exported so the tests and the notes can quote them). */
export const TUNING = {
  lift: 2.6,           // upward acceleration while held (track heights / s^2)
  gravity: 1.8,        // downward acceleration while released
  vMax: 1.1,           // top speed of the zone
  bounceFloor: 0.35,   // fraction of speed kept when the zone hits the bottom
  bounceTop: 0.2,
  zoneMin: 0.17,       // zone height (fraction of track) at the worst gear match
  zoneMax: 0.34,       // ... at a perfect match
  startMeter: 0.3,
  gain: 0.16,          // catch meter gain per second while the fish is in the zone (x 0.85..1.15 with gear)
  drainBase: 0.06,     // drain per second outside the zone ...
  drainPower: 0.06,    // ... plus this x fish power (0..1)
  jitterMax: 0.25,     // random zone kick at the worst match (track heights / s)
  structure: 0.07,     // height of the structure line (fish touching it busts you off)
  warnTime: 0.6,       // seconds of warning before a reef fish bolts
  turnTime: 0.7,       // seconds the zone must cover a diving fish to turn it
  litterFirst: [3, 6], // seconds until the first litter, then
  litterEvery: [7, 12],
  litterSpeed: [0.15, 0.21],
  zoneCap: 0.6,        // the zone never grows past this fraction of the track, however good the rod
};

export const TUTORIAL_FLOOR = 0.15;   // the lowest the catch meter can fall to in the teachers' opening
const $ = (s, r = document) => r.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FISH_SVG = `<svg viewBox="0 0 40 24" width="34" height="20" aria-hidden="true"><path d="M3 12 L11 4 L12 8 C17 2 30 2 36 12 C30 22 17 22 12 16 L11 20 Z" fill="#ff9a5a" stroke="#1f5f6b" stroke-width="2.2" stroke-linejoin="round"/><circle cx="29" cy="10" r="2.2" fill="#fff" stroke="#1f5f6b" stroke-width="1.2"/><circle cx="29.6" cy="10" r="0.9" fill="#1f5f6b"/><path d="M16 9 q4 -3 8 0" fill="none" stroke="#fff3" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const SQUID_SVG = `<svg viewBox="0 0 40 24" width="36" height="22" aria-hidden="true"><path d="M2 12 C8 6 14 5 20 7 C25 5 30 6 37 12 C30 18 25 19 20 17 C14 19 8 18 2 12Z" fill="#f2b8a8" stroke="#1f5f6b" stroke-width="2.2" stroke-linejoin="round"/><path d="M20 7 L26 2 L28 8 M20 17 L26 22 L28 16" fill="#e89a8c" stroke="#1f5f6b" stroke-width="1.8" stroke-linejoin="round"/><circle cx="30" cy="10" r="2.4" fill="#fff" stroke="#1f5f6b" stroke-width="1.4"/><circle cx="30.5" cy="10" r="1.1" fill="#1f5f6b"/><path d="M36 10 q3 0 4 2 M36 12 q3 1 4 3 M36 14 q3 2 3 4" fill="none" stroke="#1f5f6b" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const LITTER = {
  line: { label: 'Tangled line', svg: `<svg viewBox="0 0 30 30" width="26" height="26" aria-hidden="true"><path d="M4 22 C2 8 18 2 22 10 C26 18 8 20 10 10 C12 4 24 8 26 20" fill="none" stroke="#6a7a84" stroke-width="2.4" stroke-linecap="round"/><path d="M4 22 l-2 5 M26 20 l2 -3" stroke="#1f5f6b" stroke-width="2" stroke-linecap="round"/></svg>` },
  bag: { label: 'Plastic bag', svg: `<svg viewBox="0 0 30 30" width="26" height="26" aria-hidden="true"><path d="M9 6 C9 1 21 1 21 6" fill="none" stroke="#1f5f6b" stroke-width="2" stroke-linecap="round"/><path d="M7 7 H23 L26 25 C20 28 10 28 4 25 Z" fill="#f4f8fa" fill-opacity="0.92" stroke="#1f5f6b" stroke-width="2" stroke-linejoin="round"/><path d="M11 12 q3 6 0 10" fill="none" stroke="#9ab" stroke-width="1.4"/></svg>` },
};

/**
 * Everything the gear changes about a fight, in one pure function (the unit tests call it). opts: gear 0..1 (rig x bait match), power 0..1, size (cm),
 * rod = { zoneMul, drainMul, speedMul } and line = { save, turnMul } from economy/store.js gearStats (a better rod widens the zone or slows the fish;
 * stronger line saves a bolting fish from a break-off and turns it sooner; light line does the opposite).
 */
export function barParams(opts = {}) {
  const q = Math.sqrt(clamp(opts.gear ?? 0.5, 0, 1)), power = clamp(opts.power ?? 0.5, 0, 1), rod = opts.rod ?? {}, line = opts.line ?? {};
  const zoneH = Math.min(TUNING.zoneCap, (TUNING.zoneMin + (TUNING.zoneMax - TUNING.zoneMin) * q) * (1.1 - 0.2 * power) * (rod.zoneMul ?? 1));
  const k = (0.8 + 0.5 * power * (0.9 + 0.2 * clamp((opts.size ?? 40) / 50, 0.6, 1.4))) * (rod.speedMul ?? 1);
  const turnMul = line.turnMul ?? 1;
  return { q, zoneH, jitter: (1 - q) * TUNING.jitterMax, k, drainMul: rod.drainMul ?? 1, save: clamp(line.save ?? 0, 0, 0.95), turnTime: TUNING.turnTime * turnMul, jetMul: 1 + (turnMul - 1) * 0.8 };
}

/** Fish movement per behaviour profile. Each has init(s, bar) and step(s, dt, bar) which sets s.tgt and s.speed (track heights / s). */
export const PROFILES = {
  // Pelagic (tailor, salmon): rests an instant, then darts across the bar.
  dart: {
    init(s) { s.t = 0.3; s.tgt = 0.5; s.speed = 1.2; },
    step(s, dt, bar) {
      s.t -= dt;
      if (s.t <= 0) { const far = bar.fy > 0.5 ? rand(0.12, 0.45) : rand(0.55, 0.9); s.tgt = far; s.speed = 0.8 * bar.k; s.t = rand(0.35, 0.8) + Math.abs(far - bar.fy) / s.speed; }
    },
  },
  // Demersal (flathead): sits low, then heavy head-shakes.
  shake: {
    init(s) { s.mode = 'low'; s.t = rand(1.2, 2); s.tgt = 0.14; s.speed = 0.5; },
    step(s, dt, bar) {
      s.t -= dt;
      if (s.mode === 'low') {
        s.tgt = 0.11 + 0.05 * Math.sin(bar.time * 3); s.speed = 0.5;
        if (s.t <= 0) { s.mode = 'shake'; s.t = rand(0.9, 1.4); s.base = rand(0.35, 0.55); s.phase = 0; }
      } else {
        s.phase += dt * 6.28 * 3.2; s.tgt = s.base + 0.22 * bar.k * Math.sin(s.phase); s.speed = 3.2;
        if (s.t <= 0) { s.mode = 'low'; s.t = rand(1.4, 2.4); s.speed = 0.9; }
      }
    },
  },
  // Reef fish (snapper, kingfish, groper): wander, then bolt for the structure line at the bottom.
  bolt: {
    init(s) { s.mode = 'swim'; s.t = rand(1.8, 3); s.tgt = 0.55; s.speed = 0.45; s.held = 0; },
    step(s, dt, bar) {
      s.t -= dt;
      if (s.mode === 'swim') {
        if (s.t <= 0) { s.mode = 'warn'; s.t = TUNING.warnTime; bar.warn = true; }
        else if (s.wander === undefined || (s.wander -= dt) <= 0) { s.tgt = rand(0.3, 0.85); s.speed = 0.45 * bar.k; s.wander = rand(0.8, 1.4); }
      } else if (s.mode === 'warn') {
        s.tgt = bar.fy; s.speed = 0; s.jitter = Math.sin(bar.time * 40) * 0.01;
        if (s.t <= 0) { s.mode = 'dive'; s.t = 4; s.held = 0; s.ramp = 0; }
      } else if (s.mode === 'dive') {
        s.ramp = Math.min(1, s.ramp + dt / 0.5);
        const inZone = bar.inZone;
        s.tgt = inZone ? bar.fy + 0.1 : -0.2; s.speed = (inZone ? 0.12 : 0.55 * bar.k) * (0.25 + 0.75 * s.ramp);
        if (inZone) s.held += dt;
        if (s.held >= bar.turnTime) { s.mode = 'swim'; s.t = rand(2.2, 3.6); s.tgt = rand(0.5, 0.75); s.speed = 0.7; s.wander = 1; bar.warn = false; }
      }
    },
  },
  // Light feeders (whiting, bream, luderick): small quick twitches around a slowly drifting centre.
  twitch: {
    init(s) { s.cx = 0.5; s.t = 0.2; s.drift = 2; s.tgt = 0.5; s.speed = 0.9; },
    step(s, dt, bar) {
      s.drift -= dt; s.t -= dt;
      if (s.drift <= 0) { s.cx = rand(0.22, 0.78); s.drift = rand(2, 3.5); }
      if (s.t <= 0) { s.off = rand(-0.09, 0.09) * (0.8 + bar.power); s.t = rand(0.15, 0.35); }
      s.tgt = clamp(s.cx + (s.off ?? 0), 0.06, 0.94); s.speed = 0.6 + (s.t < 0.1 ? 0.5 : 0.1);
    },
  },
  // Squid and cuttlefish ("jet"): a SOFT PULL that creeps the bar down while the animal pulses gently, then a squeeze (the mantle fills: a warning), then a
  // JET: a sudden burst away from the zone that shoots out a puff of ink. After a jet it glides, and now and then it jets twice in a row.
  // The way to win is to follow the soft pull smoothly and ease off at the squeeze, not to jerk the bar.
  jet: {
    init(s) { s.mode = 'pull'; s.t = rand(1.8, 2.8); s.base = 0.55; s.phase = 0; s.tgt = 0.55; s.speed = 0.3; s.jets = 0; },
    step(s, dt, bar) {
      s.t -= dt;
      if (s.mode === 'pull') {
        s.phase += dt * 6.28 / 2.2;
        s.base = Math.max(0.2, s.base - 0.045 * dt);                                  // the soft pull: it keeps drawing the line downward
        s.tgt = clamp(s.base + 0.14 * Math.sin(s.phase), 0.08, 0.92); s.speed = 0.3 * Math.min(1.3, bar.k);
        if (s.t <= 0) { s.mode = 'squeeze'; s.t = 0.45; bar.squeeze = true; bar.warn = true; }
      } else if (s.mode === 'squeeze') {
        s.speed = 0; s.jitter = Math.sin(bar.time * 50) * 0.004;
        if (s.t <= 0) {
          s.mode = 'jet'; s.t = 0.28; bar.squeeze = false; bar.warn = false; bar.ink = true; s.jets++;
          const away = bar.fy >= bar.zy ? 1 : -1, far = bar.fy + away * rand(0.34, 0.5) * bar.k * bar.jetMul;
          s.tgt = clamp(far, 0.08, 0.92); if (s.tgt === 0.08 || s.tgt === 0.92) s.tgt = clamp(bar.fy - away * 0.4, 0.08, 0.92); s.speed = 2.6;
        }
      } else if (s.mode === 'jet') {
        if (s.t <= 0) { if (Math.random() < 0.25 && s.jets % 3 === 1) { s.mode = 'squeeze'; s.t = 0.25; bar.squeeze = true; } else { s.mode = 'glide'; s.t = rand(0.6, 1.0); s.speed = 0.5; } }
      } else if (s.t <= 0) { s.mode = 'pull'; s.t = rand(2, 3.2); s.base = clamp(bar.fy, 0.25, 0.8); s.phase = 0; }
    },
  },
};

function el_setProfile(bar, profile) {
  bar.el.dataset.profile = profile;
  bar.fishEl.innerHTML = profile === 'jet' ? bar.fishSvgs.squid : bar.fishSvgs.fish;
  bar.inkEl.classList.remove('puff');
}

export class CatchBar {
  constructor(game) {
    this.game = game; this.active = false; this.held = false; this.tutorial = false; 
    const el = this.el = document.createElement('div');
    el.id = 'catchbar'; el.className = 'hidden';
    el.setAttribute('role', 'application');
    el.setAttribute('aria-label', 'Catch bar. Hold Space, or press and hold here, to lift the green zone and keep the fish inside it.');
    el.innerHTML = `<div class="cb-card">
        <div class="cb-cols">
          <div class="cb-track"><div class="cb-struct"><span>reef · rock</span></div><div class="cb-zone"></div><div class="cb-litter"></div><div class="cb-fish">${FISH_SVG}</div><div class="cb-ink"></div></div>
          <div class="cb-meter" title="Catch meter"><i></i></div>
        </div>
      </div>
      <div class="cb-hint"></div>`;
    document.body.appendChild(el);
    this.zoneEl = $('.cb-zone', el); this.fishEl = $('.cb-fish', el); this.litterEl = $('.cb-litter', el);
    this.structEl = $('.cb-struct', el); this.inkEl = $('.cb-ink', el); this.fishSvgs = { fish: FISH_SVG, squid: SQUID_SVG }; this.meterEl = $('.cb-meter i', el); this.hintEl = $('.cb-hint', el);
    const down = e => { e.preventDefault(); this.held = true; try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } game.audio.start(); };
    const up = () => { this.held = false; };
    el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  /**
   * Open the bar. opts: profile (dart|shake|bolt|twitch|jet), power 0..1, gear 0..1 (rig × bait match for this fish),
   * size (length cm), onEnd(result) with result = { won } or { won: false, reason: 'snag' | 'empty' }, onLitter(kind).
   */
  start(opts) {
    const profile = PROFILES[opts.profile] ? opts.profile : 'twitch';
    this.profile = profile; this.power = clamp(opts.power ?? 0.5, 0, 1); this.onEnd = opts.onEnd; this.onLitter = opts.onLitter;
    const bp = this.params = barParams(opts);
    this.q = bp.q; this.zoneH = bp.zoneH; this.jitter = bp.jitter; this.k = bp.k;   // fish speed scale
    this.drainMul = bp.drainMul; this.save = bp.save; this.turnTime = bp.turnTime; this.jetMul = bp.jetMul; this.saves = 0; this.onSave = opts.onSave;
    this.zy = 0.5; this.zv = 0; this.jt = 0.2;
    this.fy = 0.5; this.fv = 0; this.meter = TUNING.startMeter; this.time = 0;
    this.warn = false; this.squeeze = false; this.inZone = true; this.activity = 0; this.litter = null;
    this.tutorial = !!opts.tutorial;   // the teachers' opening: a floor under the meter so the fish cannot be lost, no litter, two lines of help
    this.litterT = this.tutorial ? 1e9 : rand(...TUNING.litterFirst); this.litterCount = 0; this.litterSpawns = 0;
    this.forceLine = !!opts.lostLine && !this.tutorial;   // a line you cut at this site is still down here: the first litter is that line (fishing/snags.js)
    this.s = {}; PROFILES[profile].init(this.s, this);
    this.structEl.style.display = profile === 'bolt' ? '' : 'none';
    el_setProfile(this, profile);
    this.ink = false;
    this.zoneEl.style.height = `${this.zoneH * 100}%`;
    this.zoneEl.classList.toggle('shaky', this.jitter > 0.15);
    this.hintKind = null; this.hint('hold');
    this.el.classList.remove('hidden', 'warn'); this.active = true; this.held = false;
    this.render();
  }
  stop() { this.active = false; this.held = false; this.el.classList.add('hidden'); }

  hint(kind) {
    if (this.hintKind === kind) return; this.hintKind = kind;
    const squid = this.profile === 'jet';
    if (this.tutorial && kind === 'hold') { this.hintEl.innerHTML = this.game.hint(`<b>Fish on!</b> ${INTRO.fight[0]}<br>${INTRO.fight[1]}`); return; }
    const t = { hold: squid ? '<b>Squid on!</b> It pulls softly, then <b>jets</b>. Follow it gently and keep it in the green zone.' : '<b>Fish on!</b> Hold <kbd>Space</kbd> to lift the green zone. Keep the fish inside it!',
      warn: squid ? 'It is squeezing to JET! Get ready to follow it.' : 'It is heading for the reef! Cover it with the zone!' }[kind];
    this.hintEl.innerHTML = this.game.hint(t);
  }

  /** Advance one frame. lift = Space held (or the bar pressed on touch). */
  update(dt, lift) {
    if (!this.active) return;
    const T = TUNING; this.time += dt;
    // ---- zone: lift while held, fall with gravity, bounce off the ends, jitter when the gear is wrong
    this.zv += (lift || this.held ? T.lift : -T.gravity) * dt;
    if (this.jitter > 0 && (this.jt -= dt) <= 0) { this.zv += (Math.random() - 0.5) * 2 * this.jitter; this.jt = rand(0.15, 0.4); }
    this.zv = clamp(this.zv, -T.vMax, T.vMax);
    const h = this.zoneH / 2;
    this.zy += this.zv * dt;
    if (this.zy < h) { this.zy = h; this.zv = this.zv < -0.15 ? -this.zv * T.bounceFloor : 0; }
    if (this.zy > 1 - h) { this.zy = 1 - h; this.zv = this.zv > 0.15 ? -this.zv * T.bounceTop : 0; }
    // ---- fish
    const s = this.s, prev = this.fy;
    PROFILES[this.profile].step(s, dt, this);
    const d = s.tgt - this.fy, mv = clamp(d, -s.speed * dt, s.speed * dt);
    this.fy = clamp(this.fy + mv + (s.jitter ?? 0) * dt * 60, 0.02, 0.98); s.jitter = 0;   // (the wobble is tuned per 60 Hz frame: scaled so a 120 Hz screen shakes the same)
    this.fv = (this.fy - prev) / Math.max(dt, 1e-4);
    this.activity += (clamp(Math.abs(this.fv) / 1.2, 0, 1) - this.activity) * Math.min(1, dt * 6);
    this.inZone = Math.abs(this.fy - this.zy) <= h + 0.01;
    // ---- catch meter
    if (this.inZone) this.meter += T.gain * (0.85 + 0.3 * this.q) * dt;
    else this.meter -= (T.drainBase + T.drainPower * this.power) * dt * this.drainMul;
    if (this.tutorial) {
      // The fish cannot be lost: the meter never drops below a floor, and a fish that has been left alone for a while tires on its own.
      if (!this.inZone && this.time > 8) this.meter += 0.13 * dt;   // beats the drain (about 0.09 a second): about 20 s to land it
      this.meter = Math.max(this.meter, TUTORIAL_FLOOR);
    }
    this.meter = Math.min(1, this.meter);
    // ---- litter drifts down through the bar; the zone collects it
    this.updateLitter(dt, h);
    this.hint(this.warn ? 'warn' : 'hold');
    this.el.classList.toggle('warn', this.warn);
    this.render();
    // ---- end conditions
    if (this.profile === 'bolt' && s.mode === 'dive' && this.fy <= T.structure) {
      // Strong line can hold and turn a bolting fish just before the reef (a break-off saved); light line never does.
      if (Math.random() < this.save) { this.saves++; this.fy = 0.3; s.mode = 'swim'; s.t = rand(2.2, 3.6); s.tgt = rand(0.5, 0.75); s.speed = 0.7; s.wander = 1; this.warn = false; this.onSave?.(); }
      else return this.finish({ won: false, reason: 'snag' });
    }
    if (this.meter >= 1) return this.finish({ won: true });
    if (this.meter <= 0) return this.finish({ won: false, reason: 'empty' });
  }

  updateLitter(dt, h) {
    const T = TUNING;
    if (!this.litter) {
      if ((this.litterT -= dt) <= 0) {
        const lost = this.forceLine && this.litterSpawns === 0, kind = lost || Math.random() < 0.5 ? 'line' : 'bag';
        this.litterSpawns++;
        this.litter = { kind, lost, y: 1.06, x: rand(0.2, 0.8), vy: -rand(...T.litterSpeed), ph: rand(0, 6) };
        this.litterEl.innerHTML = LITTER[kind].svg; this.litterEl.classList.add('on');
      }
      return;
    }
    const L = this.litter;
    L.y += L.vy * dt; L.ph += dt * 2.2;
    if (Math.abs(L.y - this.zy) <= h + 0.035) {
      this.litterCount++; this.litterEl.classList.remove('on'); this.litter = null; this.litterT = rand(...T.litterEvery);
      this.zoneEl.classList.add('pop'); setTimeout(() => this.zoneEl.classList.remove('pop'), 350);
      this.onLitter?.(L.kind, { lost: !!L.lost });
    } else if (L.y < -0.05) { this.litterEl.classList.remove('on'); this.litter = null; this.litterT = rand(...T.litterEvery); }
  }

  finish(result) {
    this.active = false; this.held = false; this.litterEl.classList.remove('on');
    this.el.classList.add('hidden');
    this.onEnd?.(result);
  }

  render() {
    const h = this.zoneH / 2;
    this.zoneEl.style.bottom = `${(this.zy - h) * 100}%`;
    this.zoneEl.classList.toggle('on', this.inZone);
    const ang = clamp(this.fv / 0.8, -1, 1) * -70;
    this.fishEl.style.bottom = `${this.fy * 100}%`;
    this.fishEl.style.transform = `translate(-50%, 50%) rotate(${ang}deg) scale(${this.squeeze ? 0.7 : 1})`;
    if (this.ink) { this.ink = false; const el = this.inkEl; el.style.bottom = `${this.fy * 100}%`; el.classList.remove('puff'); void el.offsetWidth; el.classList.add('puff'); }
    const m = clamp(this.meter, 0, 1);
    this.meterEl.style.height = `${m * 100}%`;
    this.meterEl.classList.toggle('low', m < 0.25);
    if (this.litter) { this.litterEl.style.bottom = `${this.litter.y * 100}%`; this.litterEl.style.left = `${(0.5 + 0.28 * Math.sin(this.litter.ph)) * 100}%`; }
  }
}
