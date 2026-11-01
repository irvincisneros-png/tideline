// Time of day for sites that opt in (eco.daylight): how bright the sun is, how warm the sunset glow is, and the night palette (dark blue and cosy, never black).
// Pure functions of the in-game hour (0-24), unit-tested in tests/harbour.test.mjs. The Environment (ocean/environment.js) applies them to the lights, sky, fog and water.
//   dawn ramp 4.8 -> 7.5 (night -> day) · day 7.5 -> 17 · dusk ramp 17 -> 20.5 (day -> night) · night 20.5 -> 4.8
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** { light: 0 (night) .. 1 (full day), night: 1 - light, glow: warm sunrise / sunset colour 0..1, lamps: 0 (off) .. 1 (on) } for an hour of the day. */
export function daylightAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  const light = h < 12 ? sstep(4.8, 7.5, h) : 1 - sstep(17, 20.5, h);
  const glow = Math.exp(-(((h - 6.2) / 0.9) ** 2)) * 0.8 + Math.exp(-(((h - 18.6) / 1.1) ** 2));
  const lamps = 1 - sstep(0.35, 0.8, light);   // the wharf lamps come on as the light fades (about sunset) and go off after sunrise
  return { hour: h, light, night: 1 - light, glow: Math.min(1, glow), lamps };
}

/** The night palette: dark navy sky, a lighter blue horizon, moonlit blue water. Colours are hex numbers; the Environment lerps the site's own day palette toward these. */
export const NIGHT = {
  skyTop: 0x0f2658, skyHorizon: 0x3f66a6, sunColor: 0x9fbaf5, sunIntensity: 1.5, hemiSky: 0x6e90d4, hemiGround: 0x2b4272, hemiIntensity: 1.0,
  shallow: 0x2a7ca8, mid: 0x174e86, deep: 0x0d2e68, fog: 0x244f8c, fogDeep: 0x10306a, exposure: 1.12,
  moonDir: [-0.42, 0.66, 0.5],
};
/** Dusk and dawn glow: the horizon turns amber and the sky a dusty violet-blue. */
export const GLOW = { skyHorizon: 0xf6a56a, skyTop: 0x4a5ea8 };
