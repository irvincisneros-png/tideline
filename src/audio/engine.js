// Web Audio plumbing for TideLine: buses, shared noise buffers, a generated reverb, voice limiting
// and simple 3D placement (distance falloff, stereo pan, muffling across the air/water boundary).
// No audio files — every sound is synthesised in sounds.js.
import { SOUNDS } from './sounds.js';

/**
 * How a source at `src` sounds to a listener at `pos` facing with `right` as its right-hand vector.
 * Pure (no Web Audio) so it can be unit tested.
 * @returns {{ gain: number, pan: number, muffled: boolean }}
 */
export function spatialMix(pos, right, src, { ref = 6, max = 80, medium = 'water', listenerMedium = 'water' } = {}) {
  const dx = src.x - pos.x, dy = src.y - pos.y, dz = src.z - pos.z;
  const d = Math.hypot(dx, dy, dz);
  if (d > max) return { gain: 0, pan: 0, muffled: false, d };
  // Inverse-distance falloff, faded to silence at max range.
  const fall = ref / (ref + Math.max(0, d - ref * 0.25));
  const edge = Math.min(1, (max - d) / (max * 0.25));
  const pan = d > 1e-3 ? Math.max(-1, Math.min(1, (dx * right.x + dz * right.z) / d)) * 0.85 : 0;
  const muffled = medium !== listenerMedium;
  return { gain: fall * edge * (muffled ? 0.35 : 1), pan, muffled, d };
}

export class SoundEngine {
  constructor() {
    this.ctx = null; this.volume = 0.8; this.started = false;
    this.voices = 0; this.maxVoices = 40;
    this.stats = {}; // name -> times played (read by play-tests)
    this.listener = { pos: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, medium: 'air' };
  }
  get t() { return this.ctx?.currentTime ?? 0; }

  start() {
    if (this.started) { if (this.ctx?.state === 'suspended') this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.started = true;
    const ctx = this.ctx = new AC();
    // master -> gentle limiter -> speakers
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -10; this.limiter.knee.value = 8; this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.004; this.limiter.release.value = 0.25;
    this.master = ctx.createGain(); this.master.gain.value = this.volume;
    this.master.connect(this.limiter).connect(ctx.destination);
    // duck: blackout / pause fades everything except UI
    this.duckG = ctx.createGain(); this.duckG.connect(this.master);
    this.buses = {};
    for (const name of ['amb', 'world', 'body', 'life']) { const g = ctx.createGain(); g.connect(this.duckG); this.buses[name] = g; }
    this.buses.ui = ctx.createGain(); this.buses.ui.gain.value = 0.8; this.buses.ui.connect(this.master);
    this.buffers = makeNoise(ctx);
    // Shared reverb send: long, dark tail for underwater/submersible spaces.
    this.reverb = ctx.createConvolver(); this.reverb.buffer = makeImpulse(ctx, 2.8, 2.2);
    this.reverbF = ctx.createBiquadFilter(); this.reverbF.type = 'lowpass'; this.reverbF.frequency.value = 2200;
    this.reverbG = ctx.createGain(); this.reverbG.gain.value = 0.0;
    this.reverbSend = ctx.createGain();
    this.reverbSend.connect(this.reverb).connect(this.reverbF).connect(this.reverbG).connect(this.duckG);
    return true;
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.t, 0.05); }
  setReverb(amount) { if (this.reverbG) this.reverbG.gain.setTargetAtTime(amount, this.t, 0.3); }
  duck(level, time = 0.4) { if (this.duckG) this.duckG.gain.setTargetAtTime(level, this.t, time / 3); }
  setListener(camera, medium) {
    const L = this.listener;
    L.pos = camera.position;
    const e = camera.matrixWorld.elements; // column 0 = camera right
    L.right = { x: e[0], y: e[1], z: e[2] };
    L.medium = medium;
  }

  /** Play a named one-shot from sounds.js. Returns false if it was dropped. */
  play(name, opts = {}) {
    this.stats[name] = (this.stats[name] ?? 0) + 1;
    if (!this.ctx || this.ctx.state === 'closed') return false;
    const fn = SOUNDS[name];
    if (!fn) { console.warn('Unknown sound', name); return false; }
    if (this.voices >= this.maxVoices && !opts.priority) return false;
    let out = this.buses[opts.bus ?? fn.bus ?? 'world'];
    let gain = opts.gain ?? 1;
    if (opts.at) {
      const m = spatialMix(this.listener.pos, this.listener.right, opts.at, { ref: opts.ref, max: opts.max, medium: opts.medium ?? 'water', listenerMedium: this.listener.medium });
      if (m.gain < 0.01) return false;
      out = this.place(out, m, opts.reverb);
      gain *= m.gain;
    } else if (opts.reverb) {
      const g = this.ctx.createGain(); g.gain.value = opts.reverb; g.connect(this.reverbSend);
      const split = this.ctx.createGain(); split.connect(out); split.connect(g); out = split;
    }
    fn(this, out, gain, opts);
    return true;
  }
  /** Panner + optional muffle filter in front of `bus`. */
  place(bus, m, reverb = 0) {
    const ctx = this.ctx;
    const p = ctx.createStereoPanner(); p.pan.value = m.pan;
    let head = p;
    if (m.muffled) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; f.connect(p); head = f; }
    p.connect(bus);
    if (reverb) { const g = ctx.createGain(); g.gain.value = reverb; p.connect(g).connect(this.reverbSend); }
    return head;
  }

  // ---- building blocks used by sounds.js -------------------------------------------------------
  track(src, stopAt) {
    this.voices++;
    src.onended = () => { this.voices--; };
    src.stop(stopAt);
    return src;
  }
  noise(kind, t, dur, out) {
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers[kind];
    s.connect(out); s.start(t, Math.random() * 2.5); this.track(s, t + dur);
    return s;
  }
  osc(type, freq, t, dur, out) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    o.connect(out); o.start(t); this.track(o, t + dur);
    return o;
  }
  filter(type, freq, q = 0.7) { const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
  /** Gain node with an attack/decay envelope, connected to out. */
  env(out, t, peak, attack, decay, hold = 0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.002, attack));
    if (hold) g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
    g.connect(out);
    return g;
  }
  /** Looping noise/osc layer for continuous sounds; returns { gain, filter, src }. */
  loopLayer(kind, filterType, freq, bus, q = 0.7) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.buffers[kind]; src.loop = true;
    const f = this.filter(filterType, freq, q);
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(bus);
    src.start(0, Math.random() * 3);
    return { src, filter: f, gain: g };
  }
}

function makeNoise(ctx) {
  const len = ctx.sampleRate * 4;
  const mk = () => ctx.createBuffer(1, len, ctx.sampleRate);
  const white = mk(), brown = mk(), pink = mk();
  const w = white.getChannelData(0), b = brown.getChannelData(0), p = pink.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const r = Math.random() * 2 - 1;
    w[i] = r;
    last = (last + 0.02 * r) / 1.02; b[i] = last * 3.5;
    b0 = 0.99765 * b0 + r * 0.099046; b1 = 0.963 * b1 + r * 0.2965164; b2 = 0.57 * b2 + r * 1.0526913;
    p[i] = (b0 + b1 + b2 + r * 0.1848) * 0.2;
  }
  return { white, brown, pink };
}
function makeImpulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}
