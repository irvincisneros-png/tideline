// Sound recipes. Each entry is (engine, out, gain, opts) => void and schedules Web Audio nodes into `out`.
// `bus` picks the default mix bus: body (your own body: breath, fins, ears), world (surf, boats, splashes),
// life (animal voices), ui (menus and rewards).
const r = (a, b) => a + Math.random() * (b - a);
const T = (E, o) => E.t + (o.delay ?? 0);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const note = (base, step) => base * Math.pow(2, step / 12);

function def(bus, fn) { fn.bus = bus; return fn; }

export const SOUNDS = {
  // ---------------------------------------------------------------- body
  footstep: def('body', (E, out, g, o) => {
    // Bare feet on sand: a soft crunch (dry) or a duller squelch-slap (wet sand, shallows).
    const t = T(E, o), wet = !!o.wet;
    const f = E.filter('bandpass', wet ? r(500, 750) : r(1400, 2100), wet ? 1.2 : 0.7);
    f.connect(E.env(out, t, (wet ? 0.1 : 0.07) * g, 0.004, wet ? 0.12 : 0.08));
    E.noise(wet ? 'pink' : 'white', t, 0.16, f);
  }),
  breath: def('body', (E, out, g, o) => {
    const t = T(E, o), inhale = o.inhale ?? true;
    const f = E.filter('bandpass', inhale ? 1500 : 850, 0.8); f.connect(E.env(out, t, 0.14 * g, inhale ? 0.45 : 0.15, inhale ? 0.6 : 0.9));
    E.noise('pink', t, 1.3, f);
  }),
  recoveryBreaths: def('body', (E, out, g, o) => {
    // "Hook breathing": three sharp inhales after surfacing from a blackout scare.
    for (let i = 0; i < 3; i++) SOUNDS.breath(E, out, g * 1.2, { ...o, delay: (o.delay ?? 0) + i * 0.75, inhale: true });
  }),
  heartbeat: def('body', (E, out, g, o) => {
    const t = T(E, o);
    for (const [off, k] of [[0, 1], [0.24, 0.7]]) {
      const osc = E.osc('sine', 62, t + off, 0.22, E.env(out, t + off, 0.5 * g * k * (o.rate ?? 1), 0.015, 0.17));
      osc.frequency.exponentialRampToValueAtTime(38, t + off + 0.18);
    }
  }),
  bubbles: def('body', (E, out, g, o) => {
    const t = T(E, o), n = o.n ?? 6, base = o.base ?? 500;
    for (let i = 0; i < n; i++) {
      const w = t + i * r(0.03, 0.07), f = base * r(1, 2);
      const osc = E.osc('sine', f, w, 0.1, E.env(out, w, r(0.03, 0.07) * g, 0.008, r(0.05, 0.09)));
      osc.frequency.exponentialRampToValueAtTime(f * r(1.8, 2.6), w + 0.07);
    }
  }),
  finKick: def('body', (E, out, g, o) => {
    // Water pushed by a long freediving fin: a soft low "whoomf" with a little turbulence.
    const t = T(E, o);
    const f = E.filter('lowpass', 380, 1.2); f.frequency.setValueAtTime(260, t); f.frequency.linearRampToValueAtTime(520, t + 0.18); f.frequency.linearRampToValueAtTime(200, t + 0.45);
    f.connect(E.env(out, t, 0.22 * g, 0.12, 0.35));
    E.noise('brown', t, 0.55, f);
    if (Math.random() < 0.35) SOUNDS.bubbles(E, out, g * 0.5, { n: 2, base: 700, delay: (o.delay ?? 0) + 0.1 });
  }),
  surfaceStroke: def('body', (E, out, g, o) => {
    const t = T(E, o);
    const f = E.filter('bandpass', r(900, 1400), 0.9); f.connect(E.env(out, t, 0.16 * g, 0.03, 0.3));
    E.noise('white', t, 0.4, f);
  }),
  equalise: def('body', (E, out, g, o) => {
    // Muffled "pop" in the ears, then a tiny squeak as the pressure evens out.
    const t = T(E, o);
    const p = E.osc('sine', 180, t, 0.09, E.env(out, t, 0.22 * g, 0.005, 0.07));
    p.frequency.exponentialRampToValueAtTime(90, t + 0.07);
    E.osc('sine', 2600, t + 0.06, 0.08, E.env(out, t + 0.06, 0.02 * g, 0.01, 0.06));
  }),
  earPain: def('body', (E, out, g, o) => {
    const t = T(E, o);
    const osc = E.osc('sine', 3200, t, 1.3, E.env(out, t, 0.03 * g, 0.2, 1.0));
    osc.frequency.linearRampToValueAtTime(3500, t + 1.2);
    E.osc('sine', 75, t, 0.6, E.env(out, t, 0.18 * g, 0.05, 0.5));
  }),
  blackout: def('body', (E, out, g, o) => {
    const t = T(E, o);
    const f = E.filter('lowpass', 300); f.connect(E.env(out, t, 0.5 * g, 0.02, 1.6));
    E.noise('brown', t, 1.8, f);
    for (let i = 0; i < 4; i++) SOUNDS.heartbeat(E, out, g * (1 - i * 0.22), { delay: (o.delay ?? 0) + 0.3 + i * (0.9 + i * 0.35), rate: 0.9 });
  }),
  // ---------------------------------------------------------------- surf
  splash: def('world', (E, out, g, o) => {
    const t = T(E, o), size = o.size ?? 1;
    const f = E.filter('lowpass', 4500); f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(260, t + 1.1 * size);
    f.connect(E.env(out, t, 0.5 * g, 0.01, 1.2 * size));
    E.noise('white', t, 1.4 * size, f);
    const thump = E.filter('lowpass', 160); thump.connect(E.env(out, t, 0.4 * g * size, 0.005, 0.25));
    E.noise('brown', t, 0.35, thump);
  }),
  smallSplash: def('world', (E, out, g, o) => {
    const t = T(E, o);
    const f = E.filter('bandpass', r(1500, 2600), 0.8); f.connect(E.env(out, t, 0.25 * g, 0.005, 0.28));
    E.noise('white', t, 0.35, f);
    SOUNDS.bubbles(E, out, g * 0.4, { n: 3, base: 900, delay: (o.delay ?? 0) + 0.05 });
  }),
  paddleStroke: def('world', (E, out, g, o) => {
    // Hand scooping water: a short airy "shhk" plus a drip.
    const t = T(E, o);
    const f = E.filter('bandpass', r(1100, 1700), 1.1); f.connect(E.env(out, t, 0.18 * g, 0.04, 0.25));
    E.noise('white', t, 0.35, f);
    const d = E.osc('sine', r(1300, 1900), t + 0.22, 0.06, E.env(out, t + 0.22, 0.04 * g, 0.004, 0.05));
    d.frequency.exponentialRampToValueAtTime(2600, t + 0.27);
  }),
  popUp: def('world', (E, out, g, o) => {
    const t = T(E, o);
    const slap = E.filter('lowpass', 900); slap.connect(E.env(out, t, 0.45 * g, 0.004, 0.18));
    E.noise('white', t, 0.25, slap);
    const whoosh = E.filter('bandpass', 600, 0.6); whoosh.frequency.setValueAtTime(400, t); whoosh.frequency.exponentialRampToValueAtTime(2200, t + 0.5);
    whoosh.connect(E.env(out, t, 0.2 * g, 0.15, 0.4));
    E.noise('pink', t, 0.6, whoosh);
  }),
  waveCrash: def('world', (E, out, g, o) => {
    // The lip landing in the flats: a deep boom then a long hiss of whitewater.
    const t = T(E, o);
    const boom = E.filter('lowpass', 140); boom.connect(E.env(out, t, 0.9 * g, 0.02, 1.1));
    E.noise('brown', t, 1.3, boom);
    const hiss = E.filter('bandpass', 1400, 0.4); hiss.frequency.setValueAtTime(2400, t); hiss.frequency.exponentialRampToValueAtTime(700, t + 3);
    hiss.connect(E.env(out, t, 0.4 * g, 0.15, 3.2));
    E.noise('white', t, 3.5, hiss);
  }),
  kickOut: def('world', (E, out, g, o) => {
    const t = T(E, o);
    const f = E.filter('bandpass', 1800, 0.7); f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.7);
    f.connect(E.env(out, t, 0.3 * g, 0.05, 0.7));
    E.noise('white', t, 0.8, f);
    SOUNDS.smallSplash(E, out, g * 0.8, { delay: (o.delay ?? 0) + 0.55 });
  }),
  wipeoutTumble: def('body', (E, out, g, o) => {
    // Held down in the whitewater: churning roar, then thousands of bubbles.
    const t = T(E, o);
    const f = E.filter('lowpass', 500, 1.5); f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + 2.2);
    f.connect(E.env(out, t + 0.1, 0.7 * g, 0.1, 2.2));
    E.noise('brown', t + 0.1, 2.5, f);
    SOUNDS.bubbles(E, out, g, { n: 18, base: 280, delay: (o.delay ?? 0) + 0.3 });
  }),
  // ---------------------------------------------------------------- life
  whaleSong: def('life', (E, out, g, o) => {
    // One humpback "unit": a slow moaning glide with harmonics, sometimes a rising "whoop".
    const t = T(E, o);
    const units = Math.floor(r(2, 4));
    let w = t;
    for (let u = 0; u < units; u++) {
      const kind = Math.random();
      const dur = r(1.2, 2.6), f0 = kind < 0.5 ? r(90, 160) : r(250, 420), f1 = kind < 0.5 ? f0 * r(0.6, 1.6) : f0 * r(1.4, 2.2);
      const filt = E.filter('lowpass', 1400, 0.5); filt.connect(E.env(out, w, 0.22 * g, dur * 0.3, dur * 0.7));
      for (const [h, a] of [[1, 1], [2, 0.45], [3, 0.2]]) {
        const og = E.ctx.createGain(); og.gain.value = a; og.connect(filt);
        const osc = E.osc(h === 1 ? 'sawtooth' : 'sine', f0 * h, w, dur + 0.1, og);
        osc.frequency.exponentialRampToValueAtTime(f1 * h, w + dur);
        const vib = E.osc('sine', r(4, 7), w, dur + 0.1, (() => { const vg = E.ctx.createGain(); vg.gain.value = f0 * h * 0.015; vg.connect(osc.frequency); return vg; })());
        void vib;
      }
      w += dur + r(0.3, 1.0);
    }
  }),
  whaleBlow: def('life', (E, out, g, o) => {
    // A humpback exhaling at the surface: an explosive whoosh from huge lungs.
    const t = T(E, o);
    const f = E.filter('bandpass', 700, 0.5); f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(350, t + 1.4);
    f.connect(E.env(out, t, 0.6 * g, 0.06, 1.4));
    E.noise('pink', t, 1.6, f);
    const low = E.filter('lowpass', 180); low.connect(E.env(out, t, 0.4 * g, 0.03, 0.8));
    E.noise('brown', t, 1, low);
  }),
  dolphinWhistle: def('life', (E, out, g, o) => {
    // Signature whistle: a frequency-modulated sweep between ~5 and 15 kHz.
    const t = T(E, o), dur = r(0.4, 0.9), f0 = r(5000, 9000);
    const osc = E.osc('sine', f0, t, dur + 0.05, E.env(out, t, 0.05 * g, 0.03, dur));
    const shape = Math.floor(r(0, 3));
    if (shape === 0) osc.frequency.exponentialRampToValueAtTime(f0 * 1.7, t + dur);
    else if (shape === 1) { osc.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + dur * 0.5); osc.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + dur); }
    else { osc.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + dur * 0.4); osc.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + dur); }
  }),
  dolphinClicks: def('life', (E, out, g, o) => {
    // Echolocation click train, speeding up into a "buzz" as the dolphin closes on a target.
    const t = T(E, o), n = Math.floor(r(12, 28));
    let w = t, gap = r(0.06, 0.1);
    for (let i = 0; i < n; i++) {
      const f = E.filter('highpass', 3500, 0.8); f.connect(E.env(out, w, 0.18 * g, 0.001, 0.006));
      E.noise('white', w, 0.012, f);
      w += gap; gap *= r(0.86, 0.95);
    }
  }),
  dolphinChuff: def('life', (E, out, g, o) => {
    const t = T(E, o);
    const f = E.filter('bandpass', 1600, 0.7); f.connect(E.env(out, t, 0.3 * g, 0.01, 0.3));
    E.noise('pink', t, 0.35, f);
  }),
  dugongChirp: def('life', (E, out, g, o) => {
    // Dugongs chirp and trill — short squeaky frequency sweeps, often in a run.
    const t = T(E, o), n = Math.floor(r(2, 5));
    for (let i = 0; i < n; i++) {
      const w = t + i * r(0.12, 0.2), f0 = r(3000, 5000);
      const osc = E.osc('triangle', f0, w, 0.12, E.env(out, w, 0.04 * g, 0.01, 0.08));
      osc.frequency.exponentialRampToValueAtTime(f0 * r(0.6, 1.4), w + 0.09);
    }
  }),
  dugongBreath: def('life', (E, out, g, o) => {
    const t = T(E, o);
    const f = E.filter('bandpass', 1000, 0.6); f.connect(E.env(out, t, 0.22 * g, 0.04, 0.5));
    E.noise('pink', t, 0.6, f);
  }),
  parrotfishCrunch: def('life', (E, out, g, o) => {
    // Beak scraping coral rock: a rapid crunchy scrape.
    const t = T(E, o), n = Math.floor(r(3, 6));
    for (let i = 0; i < n; i++) {
      const w = t + i * r(0.05, 0.09);
      const f = E.filter('bandpass', r(1800, 3200), 1.5); f.connect(E.env(out, w, 0.2 * g, 0.002, 0.04));
      E.noise('white', w, 0.06, f);
    }
  }),
  fishGrunt: def('life', (E, out, g, o) => {
    // Many reef fish (groupers, drummers) grunt by drumming their swim bladders.
    const t = T(E, o), f0 = o.pitch ?? r(90, 160), pulses = Math.floor(r(3, 7));
    const filt = E.filter('lowpass', 500); filt.connect(E.env(out, t, 0.25 * g, 0.02, 0.05 + pulses * 0.04, pulses * 0.02));
    const osc = E.osc('square', f0, t, 0.1 + pulses * 0.06, filt);
    const am = E.ctx.createGain(); am.gain.value = 0; osc.disconnect(); osc.connect(am).connect(filt);
    const lfo = E.osc('square', r(18, 30), t, 0.1 + pulses * 0.06, am.gain);
    void lfo;
  }),
  schoolTurn: def('life', (E, out, g, o) => {
    // A big school flicking round together: a soft rushing swish.
    const t = T(E, o);
    const f = E.filter('bandpass', 900, 0.5); f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(1500, t + 0.4); f.frequency.exponentialRampToValueAtTime(500, t + 0.9);
    f.connect(E.env(out, t, 0.12 * g, 0.2, 0.7));
    E.noise('pink', t, 1, f);
  }),
  seabirdCry: def('life', (E, out, g, o) => {
    // Shearwater / gull call: a harsh nasal down-glide.
    const t = T(E, o), n = Math.floor(r(1, 4));
    for (let i = 0; i < n; i++) {
      const w = t + i * r(0.25, 0.4), f0 = r(1400, 2200), dur = r(0.18, 0.35);
      const filt = E.filter('bandpass', f0, 2.5); filt.connect(E.env(out, w, 0.1 * g, 0.02, dur));
      const osc = E.osc('sawtooth', f0, w, dur + 0.05, filt);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.6, w + dur);
      filt.frequency.exponentialRampToValueAtTime(f0 * 0.7, w + dur);
    }
  }),
  birdPlunge: def('world', (E, out, g, o) => SOUNDS.smallSplash(E, out, g * 1.4, o)),
  mangroveBird: def('life', (E, out, g, o) => {
    // A small bird trilling in the mangroves.
    const t = T(E, o), n = Math.floor(r(4, 9)), f0 = r(2500, 4200);
    for (let i = 0; i < n; i++) {
      const w = t + i * 0.07;
      const osc = E.osc('sine', f0 * (i % 2 ? 1.12 : 1), w, 0.06, E.env(out, w, 0.035 * g, 0.005, 0.05));
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.3, w + 0.05);
    }
  }),
  shrimpSnap: def('life', (E, out, g, o) => {
    // Snapping shrimp: their claw fires a collapsing bubble — a sharp click. Reefs crackle with them.
    const t = T(E, o);
    const f = E.filter('highpass', r(2500, 5000)); f.connect(E.env(out, t, r(0.08, 0.3) * g, 0.0008, 0.007));
    E.noise('white', t, 0.012, f);
  }),
  urchinScrape: def('life', (E, out, g, o) => {
    // Urchins chewing kelp and rock: faint ticking scrapes.
    const t = T(E, o);
    for (let i = 0; i < 4; i++) {
      const w = t + i * r(0.04, 0.12);
      const f = E.filter('bandpass', r(3000, 6000), 3); f.connect(E.env(out, w, 0.08 * g, 0.001, 0.02));
      E.noise('white', w, 0.03, f);
    }
  }),
  // ---------------------------------------------------------------- vehicles
  sonarPing: def('world', (E, out, g, o) => {
    const t = T(E, o);
    E.osc('sine', 1850, t, 0.45, E.env(out, t, 0.12 * g, 0.004, 0.4));
    E.osc('sine', 3700, t, 0.2, E.env(out, t, 0.02 * g, 0.004, 0.15));
  }),
  hullCreak: def('world', (E, out, g, o) => {
    // Steel and syntactic foam flexing under hundreds of atmospheres of pressure.
    const t = T(E, o), dur = r(0.5, 1.2), f0 = r(70, 140);
    const filt = E.filter('bandpass', f0 * 4, 3); filt.connect(E.env(out, t, 0.14 * g, 0.1, dur));
    const osc = E.osc('sawtooth', f0, t, dur + 0.1, filt);
    osc.frequency.linearRampToValueAtTime(f0 * r(0.8, 1.25), t + dur);
  }),
  ballast: def('world', (E, out, g, o) => {
    const t = T(E, o);
    const f = E.filter('highpass', 1800); f.connect(E.env(out, t, 0.12 * g, 0.1, 0.9, 0.3));
    E.noise('white', t, 1.4, f);
    SOUNDS.bubbles(E, out, g * 0.6, { n: 8, base: 350, delay: (o.delay ?? 0) + 0.2 });
  }),
  lightsClunk: def('world', (E, out, g, o) => {
    const t = T(E, o);
    const f = E.filter('lowpass', 600); f.connect(E.env(out, t, 0.35 * g, 0.002, 0.12));
    E.noise('brown', t, 0.15, f);
    E.osc('square', 120, t, 0.06, E.env(out, t, 0.04 * g, 0.002, 0.05));
  }),
  climbAboard: def('world', (E, out, g, o) => {
    const t = T(E, o);
    for (const off of [0, 0.35]) {
      const f = E.filter('lowpass', 400, 2); f.connect(E.env(out, t + off, 0.4 * g, 0.003, 0.2));
      E.noise('brown', t + off, 0.25, f);
    }
    SOUNDS.splash(E, out, g * 0.5, { delay: (o.delay ?? 0) + 0.1, size: 0.6 });
  }),
  // ---------------------------------------------------------------- ui
  click: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    E.osc('sine', 1400, t, 0.05, E.env(out, t, 0.05 * g, 0.002, 0.035));
  }),
  panelOpen: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    E.osc('sine', 520, t, 0.12, E.env(out, t, 0.05 * g, 0.005, 0.1));
    E.osc('sine', 780, t + 0.05, 0.14, E.env(out, t + 0.05, 0.05 * g, 0.005, 0.12));
  }),
  panelClose: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    E.osc('sine', 700, t, 0.1, E.env(out, t, 0.04 * g, 0.005, 0.08));
    E.osc('sine', 470, t + 0.05, 0.12, E.env(out, t + 0.05, 0.04 * g, 0.005, 0.1));
  }),
  cameraUp: def('ui', (E, out, g, o) => {
    const t = T(E, o), up = o.up ?? true;
    const osc = E.osc('triangle', up ? 500 : 800, t, 0.12, E.env(out, t, 0.04 * g, 0.005, 0.1));
    osc.frequency.exponentialRampToValueAtTime(up ? 800 : 500, t + 0.1);
  }),
  shutter: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    for (const [off, fq] of [[0, 3200], [0.07, 2200]]) {
      const f = E.filter('bandpass', fq, 2); f.connect(E.env(out, t + off, 0.25 * g, 0.001, 0.03));
      E.noise('white', t + off, 0.05, f);
    }
  }),
  trick: def('ui', (E, out, g, o) => {
    // Rising pentatonic note — higher as your combo builds.
    const t = T(E, o), step = PENTA[Math.min(PENTA.length - 1, o.combo ?? 0)];
    const f = note(660, step);
    E.osc('triangle', f, t, 0.25, E.env(out, t, 0.06 * g, 0.005, 0.2));
    E.osc('sine', f * 2, t, 0.15, E.env(out, t, 0.02 * g, 0.005, 0.12));
  }),
  newSpecies: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    [0, 4, 7, 12].forEach((s, i) => E.osc('triangle', note(784, s), t + i * 0.07, 0.4, E.env(out, t + i * 0.07, 0.05 * g, 0.005, 0.35)));
  }),
  betterPhoto: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    [0, 7].forEach((s, i) => E.osc('triangle', note(784, s), t + i * 0.08, 0.3, E.env(out, t + i * 0.08, 0.045 * g, 0.005, 0.25)));
  }),
  behaviour: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    [12, 7, 14].forEach((s, i) => E.osc('sine', note(523, s), t + i * 0.09, 0.3, E.env(out, t + i * 0.09, 0.05 * g, 0.005, 0.25)));
  }),
  missionDone: def('ui', (E, out, g, o) => {
    // Little fanfare: major arpeggio with a held top note.
    const t = T(E, o);
    [0, 4, 7, 12].forEach((s, i) => {
      const w = t + i * 0.11, last = i === 3;
      E.osc('triangle', note(523, s), w, last ? 0.9 : 0.25, E.env(out, w, 0.07 * g, 0.006, last ? 0.8 : 0.2));
      if (last) E.osc('sine', note(523, s + 12), w, 0.9, E.env(out, w, 0.025 * g, 0.006, 0.8));
    });
  }),
  correct: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    [0, 7].forEach((s, i) => E.osc('sine', note(660, s), t + i * 0.09, 0.25, E.env(out, t + i * 0.09, 0.06 * g, 0.005, 0.2)));
  }),
  wrong: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    [0, -3].forEach((s, i) => E.osc('triangle', note(330, s), t + i * 0.12, 0.25, E.env(out, t + i * 0.12, 0.06 * g, 0.005, 0.2)));
  }),
  warn: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    [0, 0.16].forEach(off => E.osc('triangle', 440, t + off, 0.12, E.env(out, t + off, 0.05 * g, 0.005, 0.1)));
  }),
  labRun: def('ui', (E, out, g, o) => {
    const t = T(E, o);
    const osc = E.osc('sine', 300, t, 0.6, E.env(out, t, 0.04 * g, 0.05, 0.5));
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.5);
    SOUNDS.bubbles(E, out, g * 0.5, { n: 5, base: 600, delay: (o.delay ?? 0) + 0.1 });
  }),
};
