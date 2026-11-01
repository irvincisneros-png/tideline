// The living soundscape: continuous layers (shore wash, wind, underwater rumble, shrimp crackle, gulls, mangrove
// birds) plus animal voices placed where the animals actually are.
// Each ecosystem tunes it with an optional `sound` block (see SITE_DEFAULTS).

export const SITE_DEFAULTS = { wash: 1, wind: 0.3, shrimp: 0, gulls: 0, mangroveBirds: 0, deep: 0 };

/** Which species make sound, and how. `every` = seconds between calls (random in range). */
export const VOICES = {
  dugong: { sounds: ['dugongChirp'], every: [5, 12], max: 40, ref: 6, breath: 'dugongBreath' },
  luderick: { sounds: ['parrotfishCrunch'], every: [3, 7], max: 14, ref: 2, gain: 0.6 },
  bluegroper: { sounds: ['fishGrunt'], every: [7, 14], max: 22, ref: 4, pitch: 110 },
  snapper: { sounds: ['fishGrunt'], every: [8, 18], max: 18, ref: 3, pitch: 150 },
  kingfish: { sounds: ['schoolTurn'], every: [5, 10], max: 30, ref: 6 },
  mullet: { sounds: ['schoolTurn'], every: [6, 12], max: 20, ref: 4, gain: 0.7 },
  urchin: { sounds: ['urchinScrape'], every: [1.5, 4], max: 9, ref: 2 },
};

const rand = (a, b) => a + Math.random() * (b - a);

export class Soundscape {
  constructor(engine) {
    this.E = engine;
    this.site = { ...SITE_DEFAULTS };
    this.cool = {}; this.scanT = 0; this.prev = new WeakMap();
    this.timers = { shrimp: 0, gull: 4, bird: 6 };
  }
  /** Build the continuous layers (needs a running AudioContext). */
  init() {
    const E = this.E, B = E.buses;
    this.wash = E.loopLayer('brown', 'lowpass', 600, B.amb);
    this.wind = E.loopLayer('pink', 'bandpass', 700, B.amb, 0.4);
    this.roar = E.loopLayer('white', 'bandpass', 900, B.amb, 0.4);
    this.uw = E.loopLayer('brown', 'lowpass', 220, B.amb);
    this.drone = E.loopLayer('brown', 'lowpass', 70, B.amb, 2);
  }
  setSite(eco) {
    this.site = { ...SITE_DEFAULTS, ...(eco?.sound ?? {}) };
    this.cool = {}; this.prev = new WeakMap();
  }

  /** Called every frame with a snapshot of the game. */
  update(dt, g) {
    const E = this.E;
    if (!E.ctx || !this.wash) return;
    const t = E.t, S = this.site;
    const under = g.depth > 0, u = under ? 1 : 0;
    const k = 1 - Math.exp(-dt * 5);
    const set = (param, v, kk = k) => { param.value += (v - param.value) * kk; };
    const deepSite = S.deep > 0;
    // --- ambience above water
    const air = 1 - u;
    set(this.wash.gain.gain, (0.22 + 0.08 * Math.sin(t * 0.4)) * S.wash * air);
    this.wash.filter.frequency.value = 450 + 300 * Math.sin(t * 0.23);
    const gust = 0.6 + 0.4 * Math.sin(t * 0.17) * Math.sin(t * 0.071 + 1);
    set(this.wind.gain.gain, 0.12 * S.wind * gust * air);
    this.wind.filter.frequency.value = 500 + 500 * gust;
    set(this.roar.gain.gain, (g.roar ?? 0) * 0.4 * (1 - u * 0.7));
    // --- ambience below water
    set(this.uw.gain.gain, u * (deepSite ? 0.18 : 0.42 + Math.min(g.depth, 20) * 0.012));
    set(this.drone.gain.gain, u * S.deep * 0.5);
    E.setReverb(under ? (deepSite ? 0.35 : 0.18) : 0.04);
    // Snapping shrimp crackle — the background sound of every healthy shallow reef.
    if (under && S.shrimp > 0) {
      this.timers.shrimp -= dt;
      if (this.timers.shrimp <= 0) {
        const n = Math.round(2 + S.shrimp * 6 * (g.reefHealth ?? 1));
        for (let i = 0; i < n; i++) E.play('shrimpSnap', { delay: Math.random() * 0.25, gain: S.shrimp });
        this.timers.shrimp = rand(0.12, 0.3);
      }
    }
    // Above-water birds
    if (!under && S.gulls > 0 && (this.timers.gull -= dt) <= 0) {
      const p = g.camera.position;
      E.play('seabirdCry', { at: { x: p.x + rand(-60, 60), y: 15, z: p.z + rand(-60, 20) }, medium: 'air', max: 140, ref: 20, gain: S.gulls * 0.8 });
      this.timers.gull = rand(6, 16);
    }
    if (S.mangroveBirds > 0 && (this.timers.bird -= dt) <= 0) {
      const m = S.mangroveAt ?? [0, 0];
      E.play('mangroveBird', { at: { x: m[0] + rand(-45, 45), y: 3, z: m[1] + rand(-6, 10) }, medium: 'air', max: 90, ref: 12, gain: S.mangroveBirds });
      this.timers.bird = rand(3, 9);
    }
    if (g.life) this.updateLife(dt, g);
  }

  updateLife(dt, g) {
    const E = this.E, L = E.listener, life = g.life;
    // Per-frame transitions: breaths at the surface, seabird plunges, dolphin echolocation buzzes.
    for (const a of life.agents) {
      const v = VOICES[a.id];
      if (!v || a.visible === false) continue;
      const prev = this.prev.get(a);
      const state = a.state, y = a.pos.y;
      if (prev) {
        if (v.breath && state === 'breathe' && prev.state !== 'breathe') E.play(v.breath, { at: a.pos, medium: 'air', ref: v.ref, max: v.breathMax ?? v.max * 1.5 });
        if (v.plunge && prev.y >= 0 && y < 0) E.play('birdPlunge', { at: a.pos, medium: 'air', ref: 8, max: 120 });
        if (v.chargeClicks && state === 'charge' && prev.state !== 'charge' && Math.random() < 0.5) E.play('dolphinClicks', { at: a.pos, ref: v.ref, max: v.max });
        prev.state = state; prev.y = y;
      } else this.prev.set(a, { state, y });
    }
    // Calls: a few times a second, the nearest member of each vocal species may call.
    this.scanT -= dt;
    if (this.scanT > 0) return;
    this.scanT = 0.25;
    const now = E.t;
    const nearest = {};
    for (const a of life.agents) {
      const v = VOICES[a.id];
      if (!v || a.visible === false) continue;
      const d = a.pos.distanceToSquared(L.pos);
      if (!nearest[a.id] || d < nearest[a.id].d) nearest[a.id] = { a, d };
    }
    for (const id in nearest) {
      const v = VOICES[id], { a, d } = nearest[id];
      if (d > v.max * v.max) continue;
      if ((this.cool[id] ?? 0) > now) continue;
      this.cool[id] = now + rand(v.every[0], v.every[1]);
      const name = v.sounds[Math.floor(Math.random() * v.sounds.length)];
      E.play(name, { at: a.pos, medium: v.medium ?? 'water', ref: v.ref, max: v.max, reverb: v.reverb ?? (L.medium === 'water' ? 0.25 : 0), gain: v.gain ?? 1, pitch: v.pitch });
    }
  }
}
