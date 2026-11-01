// Player settings + graphics quality tiers, persisted locally.
const KEY = 'tideline.settings.v1';

export const TIERS = {
  low: { label: 'Low (school laptop)', pixelRatio: 0.75, oceanSegments: 128, waveColumns: 120, terrainScale: 0.6, coralScale: 0.6, fishScale: 0.5, reefFish: 1, snow: 250, bloom: false, shafts: false, antialias: false, shadows: 0, ao: false },
  medium: { label: 'Medium', pixelRatio: 1, oceanSegments: 192, waveColumns: 180, terrainScale: 0.75, coralScale: 1, fishScale: 0.9, reefFish: 1.5, snow: 500, bloom: false, shafts: true, antialias: true, shadows: 0, ao: false },
  high: { label: 'High', pixelRatio: 1.25, oceanSegments: 256, waveColumns: 240, terrainScale: 1, coralScale: 1.5, fishScale: 1.4, reefFish: 2, snow: 800, bloom: true, shafts: true, antialias: true, shadows: 1024, ao: false },
  ultra: { label: 'Ultra (gaming PC)', pixelRatio: 1.5, oceanSegments: 320, waveColumns: 320, terrainScale: 1.5, coralScale: 2.2, fishScale: 1.7, reefFish: 2, snow: 1200, bloom: true, shafts: true, antialias: true, shadows: 2048, ao: true },
};

export const DEFAULTS = {
  quality: null, // auto-detected on first run
  style: 'stylised', // 'stylised' (cosy, default) or 'realistic'
  sensitivity: 1, invertY: false, volume: 0.8, reducedMotion: false,
  subtitles: true,
};

export function guessTier() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'low';
    if (matchMedia('(pointer: coarse)').matches) return 'low'; // phones/tablets: cooler and smoother (adaptive resolution still applies)
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const r = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).toLowerCase() : '';
    const cores = navigator.hardwareConcurrency || 4;
    if (/rtx|radeon rx|geforce gtx 1[0-9]|apple m[2-9] (pro|max|ultra)/.test(r)) return 'ultra';
    if (/apple m|geforce|radeon|arc/.test(r) && cores >= 8) return 'high';
    if (/intel|mali|adreno|powervr|swiftshader|llvmpipe/.test(r) || cores <= 4) return 'low';
    return 'medium';
  } catch { return 'low'; }
}

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* storage blocked */ }
  const out = { ...DEFAULTS, ...s };
  const st = new URLSearchParams(location.search).get('style');
  if (st) out.style = st; // 'stylised' (Abzû / Alba-like) or 'realistic'
  const q = new URLSearchParams(location.search).get('quality');
  if (q && TIERS[q]) out.quality = q;
  if (!out.quality || !TIERS[out.quality]) out.quality = guessTier();
  return out;
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }
