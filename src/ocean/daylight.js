// Time of day, shared by every site (Bellambi beach and rocks, Lake Illawarra, Belmore Basin, the offshore reef and the river). Each site's own day palette (eco.water)
// is blended toward a warm dusk glow and a dark-blue, moonlit night (never black). Pure functions of the in-game hour (0-24), unit-tested in tests/daylight.test.mjs and tests/harbour.test.mjs.
// The Environment (ocean/environment.js) copies paletteAt() into the lights, sky, fog and water every frame.
//   dawn ramp 4.8 -> 7.5 (night -> day) · day 7.5 -> 17 · dusk ramp 17 -> 20.5 (day -> night) · night 20.5 -> 4.8
// A site opts out with `daylight: false` (none do now); `daylight: { glow, night: {...}, lamps }` tunes it: glow scales the sunrise / sunset colour, night overrides entries of NIGHT.
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** { light: 0 (night) .. 1 (full day), night: 1 - light, glow: warm sunrise / sunset colour 0..1, lamps: 0 (off) .. 1 (on) } for an hour of the day. */
export function daylightAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  const light = h < 12 ? sstep(4.8, 7.5, h) : 1 - sstep(17, 20.5, h);
  const glow = Math.exp(-(((h - 6.2) / 0.95) ** 2)) * 0.85 + Math.exp(-(((h - 18.7) / 1.35) ** 2));   // a long, strong sunset (peak about 18:40)
  const lamps = 1 - sstep(0.35, 0.8, light);   // the wharf lamps come on as the light fades (about sunset) and go off after sunrise
  return { hour: h, light, night: 1 - light, glow: Math.min(1, glow), lamps };
}

/** The night palette: dark navy sky, a lighter blue horizon, moonlit blue water. Colours are hex numbers; the site's day palette is lerped toward these. */
export const NIGHT = {
  skyTop: 0x0f2658, skyHorizon: 0x3f66a6, sunColor: 0x9fbaf5, sunIntensity: 1.5, hemiSky: 0x6e90d4, hemiGround: 0x2b4272, hemiIntensity: 1.0,
  shallow: 0x2a7ca8, mid: 0x174e86, deep: 0x0d2e68, fog: 0x244f8c, fogDeep: 0x10306a, exposure: 1.12,
  moonDir: [-0.42, 0.66, 0.5],
};
/** Dusk and dawn glow: the horizon turns a strong amber-orange and the sky above it a dusty rose-violet. */
export const GLOW = { skyHorizon: 0xff8a42, skyTop: 0x6a5cb0, sun: 0xff7a3a };

/** The site's lighting settings: null when it has no time of day, else { glow, night: NIGHT with the site's overrides, lamps }. */
export function lightingFor(eco) {
  const d = eco?.daylight;
  if (!d) return null;
  const o = typeof d === 'object' ? d : {};
  return { glow: o.glow ?? 1, night: { ...NIGHT, ...(o.night ?? {}) }, lamps: o.lamps ?? !!eco.litAt };
}

// ---- colour maths in linear light (what THREE.Color lerps in): sRGB hex -> linear [r, g, b]
const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const hexLinear = h => [lin(((h >> 16) & 255) / 255), lin(((h >> 8) & 255) / 255), lin((h & 255) / 255)];
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
/** Relative luminance of a linear colour. */
export const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

const DEFAULT_HEX = { sunColor: 0xfff2dd, hemiSky: 0xbfe6ff, hemiGround: 0x3a6a70 };
/**
 * Everything the lighting needs at an hour. `w` is the site's water block (eco.water, hex colours, sunIntensity, ambient, exposure, sun direction), `cfg` is lightingFor(eco).
 * Colours are linear [r, g, b]. Returns { d: daylightAt(hour), skyTop, skyHorizon, shallow, mid, deep, fog, fogDeep, sunColor, hemiSky, hemiGround, sunIntensity, hemiIntensity, exposure, sunDir }.
 */
export function paletteAt(w, hour, cfg = lightingFor({ daylight: true })) {
  const d = daylightAt(hour), k = d.night, N = cfg.night, g = d.glow * cfg.glow;
  const day = key => hexLinear(w[key] ?? DEFAULT_HEX[key]);
  const mix = (key, nk = key, kk = k) => lerp3(day(key), hexLinear(N[nk]), kk);
  const out = { d };
  out.skyTop = mix('skyTop'); out.skyHorizon = mix('skyHorizon');
  // The sunset / sunrise glow: amber-orange at the horizon, a rose-violet higher up.
  out.skyHorizon = lerp3(out.skyHorizon, hexLinear(GLOW.skyHorizon), Math.min(1, g * 0.82 * (1 - 0.5 * k)));
  out.skyTop = lerp3(out.skyTop, hexLinear(GLOW.skyTop), Math.min(1, g * 0.42 * (1 - k)));
  out.shallow = mix('shallow'); out.mid = mix('mid'); out.deep = mix('deep'); out.fog = mix('fog'); out.fogDeep = mix('fogDeep');
  // the water mirrors the sky: at sunset it picks up a warm peach in the shallows and a rose-violet in the deeps
  const wg = Math.min(1, g) * (1 - k);
  out.shallow = lerp3(out.shallow, hexLinear(0xffb08a), wg * 0.16); out.mid = lerp3(out.mid, hexLinear(0xd98a9a), wg * 0.14); out.deep = lerp3(out.deep, hexLinear(0x7a5aa0), wg * 0.14);
  const ks = sstep(0.35, 0.9, k);   // the sun stays sun-coloured (and turns orange) until it is nearly down; only then does the cool moon take over
  out.sunColor = lerp3(lerp3(hexLinear(w.sunColor ?? 0xfff2dd), hexLinear(N.sunColor), ks), hexLinear(GLOW.sun), Math.min(1, g * 0.85 * (1 - ks)));
  const sunI = w.sunIntensity ?? 2.6, hemiI = w.ambient ?? 1.1, exp = w.exposure ?? 0.82;
  out.sunIntensity = (sunI + (N.sunIntensity - sunI) * k) * (1 - 0.14 * g);
  out.hemiSky = mix('hemiSky'); out.hemiGround = mix('hemiGround');
  out.hemiIntensity = hemiI + (N.hemiIntensity - hemiI) * k;
  out.exposure = exp + (N.exposure - exp) * k;
  // The sun sinks toward the horizon at dusk (a low, long glow on the water), and the moon (fixed, high) takes over.
  const sd = w.sun, n = Math.hypot(...sd), dir = [sd[0] / n, sd[1] / n, sd[2] / n];
  dir[1] *= 0.22 + 0.78 * d.light;
  const m = Math.hypot(...N.moonDir), moon = N.moonDir.map(v => v / m), mw = 1 - Math.min(1, d.light / 0.5), t = mw * mw * (3 - 2 * mw);
  const v = lerp3(dir, moon, t), vl = Math.hypot(...v);
  out.sunDir = [v[0] / vl, v[1] / vl, v[2] / vl];
  return out;
}
