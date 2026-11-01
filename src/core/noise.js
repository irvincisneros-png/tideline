// Seeded value/simplex-style noise helpers (CPU side) used for terrain, coral and placement.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D/3D gradient noise (Perlin "improved") with a seeded permutation table.
export function makeNoise(seed = 1) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(512);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  function grad3(h, x, y, z) {
    const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
  function n3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(grad3(p[AA] & 15, x, y, z), grad3(p[BA] & 15, x - 1, y, z), u),
           lerp(grad3(p[AB] & 15, x, y - 1, z), grad3(p[BB] & 15, x - 1, y - 1, z), u), v),
      lerp(lerp(grad3(p[AA + 1] & 15, x, y, z - 1), grad3(p[BA + 1] & 15, x - 1, y, z - 1), u),
           lerp(grad3(p[AB + 1] & 15, x, y - 1, z - 1), grad3(p[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
  }
  const n2 = (x, y) => n3(x, y, 0.5);
  function fbm2(x, y, oct = 5, lac = 2, gain = 0.5) {
    let a = 1, f = 1, s = 0, norm = 0;
    for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); norm += a; a *= gain; f *= lac; }
    return s / norm;
  }
  function fbm3(x, y, z, oct = 4) {
    let a = 1, f = 1, s = 0, norm = 0;
    for (let i = 0; i < oct; i++) { s += a * n3(x * f, y * f, z * f); norm += a; a *= 0.5; f *= 2; }
    return s / norm;
  }
  function ridged3(x, y, z, oct = 3) {
    let a = 1, f = 1, s = 0, norm = 0;
    for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(n3(x * f, y * f, z * f))); norm += a; a *= 0.5; f *= 2; }
    return s / norm;
  }
  return { n2, n3, fbm2, fbm3, ridged3, rand };
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
