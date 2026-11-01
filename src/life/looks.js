// Visual definitions for procedurally modelled animals. Painters work in body space:
// u = 0 tail .. 1 snout, s = +1 dorsal .. -1 belly. Colours are linear-ish 0..1 RGB.
import * as THREE from 'three';

const C = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const grain = (u, s) => 0.94 + 0.06 * hash(Math.floor(u * 90), Math.floor(s * 40));

/** Countershaded base: darker back, paler belly. */
const counter = (top, bottom, k = 1) => (u, s) => mix(C(bottom), C(top), sm(-0.6 * k, 0.5 * k, s));

function withEye(fn, eyeU = 0.86, eyeS = 0.3, r = 0.045, iris = 0x111111, ring = 0xd8c070) {
  const f = (u, s, side) => {
    const du = (u - eyeU), ds = (s - eyeS) * 0.55;
    const d = Math.hypot(du, ds);
    if (d < r * 0.6) return C(iris);
    if (d < r) return mix(C(ring), C(iris), 0.25);
    return fn(u, s, side);
  };
  f.eye = { u: eyeU, s: eyeS, r }; // lets the model builder add a domed, glossy eyeball over the painted eye
  return f;
}
/** Vertical bars: list of [uCentre, halfWidth, colour, edgeColour?, edgeWidth?] */
function bars(base, list) {
  return (u, s, side) => {
    for (const [uc, hw, col, edge, ew = 0.012] of list) {
      const d = Math.abs(u - uc);
      if (d < hw) return C(col);
      if (edge != null && d < hw + ew) return C(edge);
    }
    return base(u, s, side);
  };
}
function spots(base, col, density, size, region = () => true) {
  return (u, s, side) => {
    const gu = u * density, gs = s * density * 0.45;
    const iu = Math.floor(gu), is = Math.floor(gs);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const cu = iu + a + hash(iu + a, is + b), cs = is + b + hash(is + b, iu + a + 7);
      if (Math.hypot(gu - cu, gs - cs) < size && region(u, s)) return C(col);
    }
    return base(u, s, side);
  };
}
const finSolid = (col, edge, edgeCol) => (u, part, f) => (edge && f > 1 - edge ? C(edgeCol) : C(col));

export const LOOKS = {
  clownfish: {
    length: 0.1, depth: 0.42, width: 0.2, peak: 0.55, snout: 0.6, tailFrac: 0.18, tail: 'round', pectoral: 0.14,
    dorsal: { from: 0.18, to: 0.78, height: 0.16, shape: 'round' }, anal: { from: 0.18, to: 0.42, height: 0.12 },
    paint: {
      body: withEye(bars((u, s) => mix(C(0xff6a00), C(0xff8c1a), s * 0.5 + 0.5), [[0.79, 0.045, 0xffffff, 0x101010, 0.012], [0.5, 0.06, 0xffffff, 0x101010, 0.012], [0.12, 0.03, 0xffffff, 0x101010, 0.012]]), 0.9, 0.25, 0.05),
      fin: (u, part, f) => f > 0.75 ? C(0x0d0d0d) : f > 0.62 ? C(0xffffff) : C(0xff6a00),
    },
    swim: { freq: 9, amp: 1.0 },
  },
  bluetang: {
    length: 0.25, depth: 0.55, width: 0.14, peak: 0.55, snout: 0.55, tailFrac: 0.16, tail: 'truncate', pectoral: 0.13,
    dorsal: { from: 0.12, to: 0.82, height: 0.07 }, anal: { from: 0.12, to: 0.55, height: 0.06 },
    paint: {
      body: withEye((u, s) => {
        // Royal blue with the black "palette" swoosh.
        const sw = Math.abs(s - (0.25 + 0.35 * Math.sin((u - 0.1) * 3.4))) < 0.18 && u > 0.12 && u < 0.85;
        const loop = Math.hypot((u - 0.45) * 2.2, (s - 0.05) * 1.1) < 0.28 && Math.hypot((u - 0.45) * 2.2, (s - 0.05) * 1.1) > 0.12;
        return sw || loop ? C(0x070b1c) : mix(C(0x0a3ad8), C(0x2a6cff), grain(u, s) - 0.5 + 0.5);
      }, 0.88, 0.22, 0.05),
      fin: (u, part) => part === 'tail' || (part === 'pectoral') ? C(0xffd200) : C(0x0a1a55),
    },
    swim: { freq: 6, amp: 0.8 },
  },
  moorishidol: {
    length: 0.2, depth: 0.85, width: 0.1, peak: 0.6, snout: 1.6, tailFrac: 0.14, tail: 'truncate', pectoral: 0.1,
    dorsal: { from: 0.35, to: 0.75, height: 0.35, shape: 'sail', streamer: 0.9 }, anal: { from: 0.2, to: 0.55, height: 0.22 },
    paint: {
      body: withEye(bars((u) => u > 0.88 ? C(0xff9a1a) : C(0xffef9a), [[0.72, 0.08, 0x0c0c0c], [0.42, 0.06, 0xffffff], [0.3, 0.07, 0x0c0c0c], [0.15, 0.05, 0xffe04a]]), 0.82, 0.18, 0.04),
      fin: (u, part) => part === 'tail' ? C(0x111111) : part === 'dorsal' ? (u < 0.5 ? C(0xf4f4f4) : C(0xffe8a0)) : C(0x111111),
    },
    swim: { freq: 4, amp: 0.6 },
  },
  cleanerwrasse: {
    length: 0.11, depth: 0.2, width: 0.12, peak: 0.55, snout: 1.1, tailFrac: 0.14, tail: 'round', pectoral: 0.1,
    dorsal: { from: 0.1, to: 0.8, height: 0.05 }, anal: { from: 0.1, to: 0.4, height: 0.05 },
    paint: {
      body: withEye((u, s) => {
        const stripe = Math.abs(s - (0.1 + (1 - u) * -0.1)) < 0.13 + (1 - u) * 0.12;
        if (stripe) return C(0x0a0a10);
        return s > 0 ? mix(C(0x5fa8e8), C(0xe8f4ff), u) : mix(C(0x3d8be0), C(0xf2f7ff), u * 0.5 + 0.4);
      }, 0.92, 0.2, 0.04),
      fin: (u, part) => part === 'tail' ? C(0x2b6fe0) : C(0x3a7fe0),
    },
    swim: { freq: 10, amp: 1.0 },
  },
  parrotfish: {
    length: 0.7, depth: 0.36, width: 0.2, peak: 0.55, snout: 0.45, tailFrac: 0.16, tail: 'lunate', pectoral: 0.11,
    dorsal: { from: 0.15, to: 0.78, height: 0.05 }, anal: { from: 0.12, to: 0.45, height: 0.05 }, belly: 0.4,
    paint: {
      body: withEye(spots((u, s) => mix(C(0x0d7c6a), C(0x1fb8a0), s * 0.5 + 0.5), 0x2fd6ff, 22, 0.18, (u, s) => s > -0.3), 0.9, 0.35, 0.03, 0x111111, 0xff7a3a),
      fin: (u, part, f) => f > 0.8 ? C(0x3ae0ff) : C(0x14907a),
    },
    swim: { freq: 4, amp: 0.4 }, // labriform (uses pectorals) — little body wave
  },
  humpheadwrasse: {
    length: 1.6, depth: 0.38, width: 0.2, peak: 0.6, snout: 0.35, tailFrac: 0.14, tail: 'round', pectoral: 0.12, belly: 0.4,
    dorsal: { from: 0.12, to: 0.82, height: 0.07 }, anal: { from: 0.12, to: 0.45, height: 0.07 },
    paint: {
      body: withEye((u, s) => {
        const scribble = Math.sin(u * 140 + Math.sin(s * 25) * 2) > 0.7 ? 0.82 : 1;
        const base = mix(C(0x2f6b5a), C(0x4fa58a), s * 0.5 + 0.5);
        return base.map(v => v * scribble * (u > 0.8 ? 1.1 : 1));
      }, 0.93, 0.32, 0.025, 0x222222, 0xffe080),
      fin: (u, part, f) => f > 0.7 ? C(0x9adf7a) : C(0x2f6b5a),
    },
    swim: { freq: 2.2, amp: 0.4 },
  },
  coraltrout: {
    length: 0.6, depth: 0.28, width: 0.17, peak: 0.6, snout: 0.85, tailFrac: 0.15, tail: 'truncate', pectoral: 0.1,
    dorsal: { from: 0.12, to: 0.78, height: 0.07 }, anal: { from: 0.12, to: 0.4, height: 0.07 },
    paint: {
      body: withEye(spots((u, s) => mix(C(0xa0281e), C(0xe0503a), s * 0.4 + 0.6), 0x5fd0ff, 34, 0.15), 0.9, 0.3, 0.035),
      fin: (u, part, f) => f > 0.85 ? C(0x4ab0ff) : C(0xc03a28),
    },
    swim: { freq: 3.5, amp: 0.6 },
  },
  chromis: {
    length: 0.08, depth: 0.42, width: 0.16, peak: 0.55, snout: 0.8, tailFrac: 0.2, tail: 'forked', pectoral: 0.12,
    dorsal: { from: 0.18, to: 0.7, height: 0.12 }, anal: { from: 0.15, to: 0.38, height: 0.1 },
    paint: {
      body: withEye((u, s) => mix(C(0x5fe0c0), C(0x9df8e8), sm(-0.3, 0.8, s) * 0.4 + grain(u, s) * 0.1), 0.88, 0.25, 0.06),
      fin: () => C(0x7ff0d8),
    },
    swim: { freq: 11, amp: 1.0 },
  },
  trevally: {
    length: 0.6, depth: 0.32, width: 0.14, peak: 0.6, snout: 0.7, tailFrac: 0.2, tail: 'forked', tailSpan: 1.5, pectoral: 0.16,
    dorsal: { from: 0.2, to: 0.6, height: 0.11, shape: 'tri' }, anal: { from: 0.18, to: 0.4, height: 0.08 },
    paint: {
      body: withEye((u, s) => mix(C(0xc8d4dc), C(0x6a8090), sm(-0.2, 0.9, s)).map(v => v * (0.95 + 0.1 * Math.sin(u * 60))), 0.88, 0.25, 0.06, 0x101010, 0xf0f0f0),
      fin: (u, part) => part === 'tail' ? C(0x506878) : C(0x8899a5),
    },
    swim: { freq: 5, amp: 0.7 },
    metal: 0.6,
  },
  butterflyfish: {
    length: 0.2, depth: 0.7, width: 0.1, peak: 0.55, snout: 1.4, tailFrac: 0.13, tail: 'truncate', pectoral: 0.1,
    dorsal: { from: 0.22, to: 0.78, height: 0.14, streamer: 0.25 }, anal: { from: 0.15, to: 0.5, height: 0.12 },
    paint: {
      body: withEye((u, s) => {
        // White front with chevron lines, yellow rear; black eye band.
        if (Math.abs(u - 0.86) < 0.03) return C(0x111111);
        if (u < 0.45) return C(0xffd21a);
        const chev = Math.sin((u * 1.4 + Math.abs(s) * 0.9) * 40) > 0.6;
        return chev ? C(0x9a9a9a) : C(0xf8f8f2);
      }, 0.86, 0.2, 0.035),
      fin: (u, part) => part === 'dorsal' && u < 0.4 ? C(0x111111) : C(0xffd21a),
    },
    swim: { freq: 5, amp: 0.6 },
  },
  angelfish: {
    length: 0.25, depth: 0.55, width: 0.12, peak: 0.55, snout: 0.7, tailFrac: 0.13, tail: 'round', pectoral: 0.11,
    dorsal: { from: 0.15, to: 0.75, height: 0.08 }, anal: { from: 0.15, to: 0.5, height: 0.08 },
    paint: {
      body: withEye((u, s) => {
        const band = Math.sin(u * 52 + s * 3) > 0.35;
        return u > 0.8 ? C(0xffb03a) : band ? C(0xf2f4ff) : C(0xff7a10);
      }, 0.88, 0.22, 0.045),
      fin: (u, part) => part === 'dorsal' ? C(0x2a3a9a) : part === 'tail' ? C(0xffd21a) : C(0xffb03a),
    },
    swim: { freq: 4, amp: 0.5 },
  },
  boxfish: {
    length: 0.3, depth: 0.42, width: 0.38, peak: 0.55, snout: 0.35, tailFrac: 0.2, tail: 'round', boxy: 4, pectoral: 0.1, peduncle: 0.18,
    dorsal: { from: 0.12, to: 0.24, height: 0.08 }, anal: { from: 0.12, to: 0.24, height: 0.08 },
    paint: {
      body: withEye(spots((u, s) => C(0xffd400), 0x111111, 18, 0.14), 0.86, 0.3, 0.045),
      fin: () => C(0xffd84a),
    },
    swim: { freq: 7, amp: 0.25 }, // ostraciiform: only the tail wags
  },
  reefshark: {
    length: 1.5, depth: 0.16, width: 0.15, peak: 0.6, snout: 1.25, tailFrac: 0.24, tail: 'heterocercal', tailSpan: 1.6, pectoral: 0.22, pecWing: 0.6, pecAt: 0.7,
    dorsal: { from: 0.52, to: 0.72, height: 0.14, shape: 'tri' }, anal: { from: 0.1, to: 0.18, height: 0.04 },
    paint: {
      body: withEye(counter(0x8a8a78, 0xf2f0ea, 1.3), 0.93, 0.25, 0.02, 0x080808, 0x222222),
      fin: (u, part, f) => f > 0.72 ? C(0x080808) : C(0x8a8a78),
    },
    swim: { freq: 2.4, amp: 0.7 },
  },
  turtle: { length: 1.0 },
  manta: {
    kind: 'manta', length: 1.6, span: 3.8, thick: 0.28, tail: 0.5,
    paint: (u, v, top) => {
      if (!top) {
        // White belly with unique dark spots (used to identify individual mantas).
        const sp = hash(Math.floor(u * 22), Math.floor(v * 22)) > 0.93 && Math.abs(v - 0.5) < 0.25;
        return sp ? C(0x222222) : C(0xf2f2ee);
      }
      const shoulder = Math.abs(v - 0.5) > 0.12 && Math.abs(v - 0.5) < 0.32 && u > 0.55 && u < 0.72;
      return shoulder ? C(0xd8d8d0) : C(0x1a1e24);
    },
    swim: { freq: 1.1, amp: 0.6 },
  },
  bluespottedray: {
    kind: 'stingray', length: 0.35, span: 0.3, thick: 0.18, tail: 1.1,
    paint: (u, v, top) => {
      if (!top) return C(0xf0ece4);
      const sp = hash(Math.floor(u * 30), Math.floor(v * 30)) > 0.7 && hash(u * 9, v * 7) > 0.2;
      return sp ? C(0x1a7cff) : mix(C(0xc0a060), C(0x8a6a3a), v);
    },
    swim: { freq: 3, amp: 0.4 },
  },
};

export const paint = { C, mix, sm, withEye, bars, spots, counter, finSolid, grain, hash };
