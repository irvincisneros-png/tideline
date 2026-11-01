// Streaming music: one HTMLAudio element per playing track (fetched only when needed, after the first user gesture),
// routed through a music bus in the Web Audio graph. Tracks crossfade; dialogue, the catch bar and the new-species
// jingle duck the bed. The ambient soundscape keeps playing underneath at a lower level.
import { TRACKS, pickTrack, duckLevel } from './musicPlan.js';

const FADE = 2.6;          // seconds for a full crossfade
const AMB_UNDER = 0.55;    // ambience bus level while music is on

export class Music {
  constructor(engine) {
    this.E = engine;
    this.enabled = true; this.volume = 0.5;
    this.want = null; this.ctxState = { mode: 'loading' };
    this.voices = new Map();   // key -> { el, gain, level, target, jingle }
    this.duck = 1; this.jingleLeft = 0; this.master = 0; this.ready = false;
    this.fetched = [];         // track keys requested so far (read by tests)
  }
  configure({ enabled, volume }) { if (enabled !== undefined) this.enabled = !!enabled; if (volume !== undefined) this.volume = volume; }
  /** Remember what the game is doing (safe before the gesture; nothing is fetched until start()). */
  plan(g) {
    this.ctxState = g;
    this.want = pickTrack({ mode: g.mode, site: g.eco?.id, time: g.time });
    this.duckTarget = duckLevel({ dialogue: g.dialogue, fight: g.fight, panel: g.panel, jingle: this.jingleLeft > 0 });
  }
  /** Called from inside the first user gesture once the AudioContext exists. */
  start() {
    const E = this.E; if (this.ready || !E.ctx) return;
    this.ready = true;
    this.bus = E.ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(E.master);
    E.buses.music = this.bus;
    this.sync();
  }
  voice(key) {
    let v = this.voices.get(key); if (v) return v;
    const T = TRACKS[key], E = this.E;
    const el = new window.Audio();
    el.preload = 'auto'; el.loop = !T.jingle; el.crossOrigin = 'anonymous';
    el.src = T.file;
    const gain = E.ctx.createGain(); gain.gain.value = 0;
    E.ctx.createMediaElementSource(el).connect(gain).connect(this.bus);
    v = { key, el, gain, level: 0, target: 0, jingle: !!T.jingle };
    this.voices.set(key, v); this.fetched.push(key);
    el.play().catch(() => {});
    return v;
  }
  /** One-shot "new species" jingle: ducks the bed while it plays. */
  jingle(key = 'reelwinner') {
    if (!this.ready || !this.enabled || this.volume <= 0.001) return;
    const old = this.voices.get(key); if (old) { old.el.pause(); old.gain.disconnect(); this.voices.delete(key); }
    const v = this.voice(key); v.target = 1; v.level = 1; v.gain.gain.value = 1;
    this.jingleLeft = 5.4;
  }
  sync() { if (this.ready && this.enabled && this.want && this.volume > 0.001) this.voice(this.want); }
  update(dt) {
    if (!this.ready) return;
    const E = this.E, audible = this.enabled && this.volume > 0.001;
    if (this.jingleLeft > 0) this.jingleLeft -= dt;
    this.duckTarget = Math.min(this.duckTarget ?? 1, this.jingleLeft > 0 ? 0.2 : 1);
    this.duck += (this.duckTarget - this.duck) * (1 - Math.exp(-dt * 3));
    const m = audible ? this.volume * this.duck : 0;
    this.master += (m - this.master) * (1 - Math.exp(-dt * 4));
    this.bus.gain.value = this.master;
    if (audible) this.sync();
    const step = dt / FADE;
    let loud = false;
    for (const v of [...this.voices.values()]) {
      if (!v.jingle) v.target = audible && v.key === this.want ? 1 : 0;
      v.level += Math.max(-step, Math.min(step, v.target - v.level));
      v.gain.gain.value = v.level * v.level * (3 - 2 * v.level) ;   // smoothstep
      if (v.jingle) { if (v.el.ended || (this.jingleLeft <= 0 && v.el.paused)) this.drop(v); }
      else if (v.target === 0 && v.level <= 0.001) this.drop(v);
      if (v.level > 0.01) loud = true;
    }
    // Ambience sits under the music.
    const amb = E.buses.amb;
    if (amb) amb.gain.value += ((loud && audible ? AMB_UNDER : 1) - amb.gain.value) * (1 - Math.exp(-dt * 2));
  }
  drop(v) { try { v.el.pause(); v.el.removeAttribute('src'); v.el.load(); v.gain.disconnect(); } catch { /* ignore */ } this.voices.delete(v.key); }
  /** For tests: what is playing and how loud. */
  get state() { return { want: this.want, fetched: [...this.fetched], playing: [...this.voices.values()].map(v => ({ key: v.key, level: +v.level.toFixed(2) })), master: +this.master.toFixed(3), duck: +this.duck.toFixed(2) }; }
}
