// Looks for the line-caught species that don't swim in the dive scenes (every catch id needs a registered look).
// Shapes and markings are real; colours are pastel-shifted (art bible). Body space: u = 0 tail .. 1 snout, s = +1 back .. -1 belly.
import { registerLook } from '../life/life.js';
import { paint as P } from '../life/looks.js';

const { C, mix, sm, withEye, counter, spots } = P;

registerLook('australiansalmon', {
  // Arripis trutta: blue-green back, silver flanks and belly, small dark spots scattered over the back and upper sides (no bars), pale fins, a dark-edged forked tail.
  length: 0.5, depth: 0.25, width: 0.13, peak: 0.55, snout: 0.85, tailFrac: 0.2, tail: 'forked', tailSpan: 1.3, pectoral: 0.13,
  dorsal: { from: 0.35, to: 0.6, height: 0.08, shape: 'tri' }, anal: { from: 0.2, to: 0.35, height: 0.06 },
  paint: { body: withEye(spots((u, s) => mix(C(0xeaf0f0), C(0x6f9a92), sm(-0.25, 0.75, s)), 0x2c4a44, 40, 0.1, (u, s) => s > 0.12 && u > 0.12 && u < 0.82), 0.88, 0.25, 0.05), fin: (u, part) => (part === 'tail' ? C(0x55706a) : C(0xd8dcc0)) },
  swim: { freq: 6, amp: 0.7 }, metal: 0.5,
});
registerLook('tailor', {
  length: 0.45, depth: 0.25, width: 0.12, peak: 0.55, snout: 0.75, tailFrac: 0.2, tail: 'forked', tailSpan: 1.2, pectoral: 0.12,
  dorsal: { from: 0.25, to: 0.65, height: 0.07 }, anal: { from: 0.2, to: 0.45, height: 0.06 },
  paint: { body: withEye(counter(0x5a8a9a, 0xdce6e2, 0.9), 0.88, 0.25, 0.05), fin: (u, part) => part === 'tail' ? C(0x6a7a6a) : C(0xc8c890) },
  swim: { freq: 6, amp: 0.7 }, metal: 0.45,
});
registerLook('sandwhiting', {
  length: 0.3, depth: 0.18, width: 0.1, peak: 0.5, snout: 1.2, tailFrac: 0.16, tail: 'truncate', pectoral: 0.11,
  dorsal: { from: 0.2, to: 0.7, height: 0.042 }, anal: { from: 0.15, to: 0.45, height: 0.05 },
  paint: { body: withEye((u, s) => mix(C(0xf2ecd8), C(0xc8b890), sm(-0.2, 0.9, s)), 0.9, 0.25, 0.04), fin: () => C(0xd8c890) },
  swim: { freq: 6, amp: 0.6 }, metal: 0.3,
});
registerLook('yellowfinbream', {
  length: 0.3, depth: 0.42, width: 0.13, peak: 0.55, snout: 0.75, tailFrac: 0.16, tail: 'forked', tailSpan: 1.1, pectoral: 0.13,
  dorsal: { from: 0.2, to: 0.75, height: 0.09 }, anal: { from: 0.2, to: 0.4, height: 0.07 },
  paint: { body: withEye((u, s) => mix(C(0xdcdad0), C(0x8a8a6a), sm(-0.3, 0.9, s)), 0.88, 0.25, 0.045), fin: (u, part) => part === 'anal' || part === 'pectoral' ? C(0xf0d040) : C(0x9a9a7a) },
  swim: { freq: 5, amp: 0.6 }, metal: 0.4,
});

registerLook('duskyflathead', {
  // Platycephalus fuscus: a long, flat, spade-shaped head with the eyes on top close together, dark mottled olive-brown back with small black spots, a cream belly, and a
  // rounded-truncate tail (a broad fan with a softly curved edge, never forked) with a dark blotch and a pale edge.
  length: 0.6, depth: 0.1, width: 0.24, peak: 0.75, snout: 0.25, tailFrac: 0.16, tail: 'truncate', tailSpan: 0.95, peduncle: 0.2, pectoral: 0.15, pecWing: 0.45, boxy: 3,
  dorsal: { from: 0.2, to: 0.7, height: 0.05 }, anal: { from: 0.15, to: 0.5, height: 0.04 },
  paint: {
    body: withEye(spots((u, s) => mix(C(0xeee2c4), C(0x8d7852), sm(-0.3, 0.3, s)), 0x3a2e20, 30, 0.14, (u, s) => s > -0.2), 0.86, 0.96, 0.03, 0x222222, 0xd0b060),
    fin: (u, part, f) => (part === 'tail' ? (f > 0.86 ? C(0xe9dfa8) : f > 0.4 && f < 0.82 ? C(0x3a2e20) : C(0x8d7852)) : part === 'pectoral' ? mix(C(0xe8dcb8), C(0x8d7852), f) : C(0x8d7852)),
  }, swim: { freq: 2.5, amp: 0.5 },
});
registerLook('seamullet', {
  length: 0.45, depth: 0.22, width: 0.16, peak: 0.6, snout: 0.45, tailFrac: 0.18, tail: 'forked', pectoral: 0.11,
  dorsal: { from: 0.35, to: 0.5, height: 0.08, shape: 'tri' }, anal: { from: 0.2, to: 0.35, height: 0.06 },
  paint: { body: withEye((u, s) => mix(C(0xdce2e4), C(0x5a6a70), sm(-0.1, 0.8, s)).map(v => v * (Math.sin(s * 18) > 0.85 ? 0.85 : 1)), 0.92, 0.25, 0.035), fin: () => C(0x6a7a80) }, swim: { freq: 4.5, amp: 0.6 }, metal: 0.4,
});
registerLook('mulloway', {
  length: 0.8, depth: 0.24, width: 0.12, peak: 0.5, snout: 0.8, tailFrac: 0.17, tail: 'truncate', tailSpan: 1.05, pectoral: 0.12,
  dorsal: { from: 0.25, to: 0.72, height: 0.09 }, anal: { from: 0.16, to: 0.3, height: 0.06 },
  paint: { body: withEye((u, s) => mix(C(0xefece4), C(0x9a8a78), sm(-0.3, 0.8, s)).map(v => v * (Math.abs(s - 0.1) < 0.03 && u > 0.2 && u < 0.8 ? 0.9 : 1)), 0.9, 0.22, 0.06, 0x101010, 0xe0d8c0), fin: () => C(0x7a6a5a) },
  swim: { freq: 4, amp: 0.55 }, metal: 0.35,
});
registerLook('silvertrevally', {
  length: 0.35, depth: 0.34, width: 0.11, peak: 0.55, snout: 0.7, tailFrac: 0.19, tail: 'forked', tailSpan: 1.35, pectoral: 0.14,
  dorsal: { from: 0.2, to: 0.6, height: 0.09 }, anal: { from: 0.18, to: 0.4, height: 0.07 },
  paint: {
    body: withEye((u, s) => (Math.hypot((u - 0.78) * 1.6, (s - 0.52) * 0.7) < 0.05 ? C(0x1c2024) : mix(C(0xeef2f4), C(0x86a0b0), sm(-0.2, 0.9, s))), 0.9, 0.3, 0.05, 0x101010, 0xe8e8d0),
    fin: (u, part) => (part === 'tail' ? C(0xe6d060) : C(0xc8d0d4)),
  },
  swim: { freq: 5, amp: 0.65 }, metal: 0.6,
});
registerLook('rockblackfish', {
  length: 0.4, depth: 0.42, width: 0.14, peak: 0.5, snout: 0.6, tailFrac: 0.17, tail: 'truncate', tailSpan: 1.0, pectoral: 0.13,
  dorsal: { from: 0.15, to: 0.8, height: 0.1 }, anal: { from: 0.2, to: 0.42, height: 0.07 },
  paint: { body: withEye((u, s) => mix(C(0xb8c4c8), C(0x66767f), sm(-0.4, 0.7, s)), 0.88, 0.26, 0.045, 0x101010, 0xc8b878), fin: () => C(0x6e7c84) },
  swim: { freq: 4, amp: 0.55 },
});
registerLook('garfish', {
  length: 0.3, depth: 0.07, width: 0.07, peak: 0.45, snout: 1.7, tailFrac: 0.15, tail: 'forked', tailSpan: 1.6, pectoral: 0.09,
  dorsal: { from: 0.1, to: 0.3, height: 0.032, shape: 'tri' }, anal: { from: 0.12, to: 0.32, height: 0.028, shape: 'tri' },
  paint: { body: withEye((u, s) => (u > 0.94 ? C(0xff7a40) : mix(C(0xf2f6f6), C(0x86b4a8), sm(-0.1, 0.8, s))), 0.86, 0.3, 0.04), fin: () => C(0xbcc8c8) },
  swim: { freq: 7, amp: 0.55 }, metal: 0.5,
});
registerLook('bonito', {
  length: 0.55, depth: 0.25, width: 0.12, peak: 0.45, snout: 0.9, tailFrac: 0.19, tail: 'forked', tailSpan: 1.3, pectoral: 0.1,
  dorsal: { from: 0.3, to: 0.72, height: 0.062 }, anal: { from: 0.18, to: 0.28, height: 0.05 },
  paint: { body: withEye((u, s) => (s > 0.1 && Math.sin(u * 46 + s * 14) > 0.55 ? C(0x2a4658) : mix(C(0xeef0f0), C(0x4a8aa6), sm(-0.2, 0.7, s))), 0.9, 0.25, 0.04), fin: (u, part) => (part === 'tail' ? C(0x4a5a6a) : C(0x7a98a8)) },
  swim: { freq: 7, amp: 0.65 }, metal: 0.55,
});
// ---- Cephalopods (models in life/cephalopod.js). u = 0 tail .. 1 head, s = +1 back .. -1 belly. Colours are pastel-shifted (art bible), markings are real.
const hash2 = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
/** Chromatophores: scattered dots of pigment (reddish-brown, a few purple) that the animal can expand or shrink; denser on the back. */
const dots = (u, s, dens, size) => {
  const gu = u * dens, gs = (s + 1) * dens * 0.55, iu = Math.floor(gu), is = Math.floor(gs);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const cu = iu + a + hash2(iu + a, is + b), cs = is + b + hash2(is + b, iu + a + 7), r = size * (0.55 + 0.9 * hash2(iu + a + 3, is + b + 5));
    if (Math.hypot(gu - cu, gs - cs) < r) return hash2(iu + a + 9, is + b + 1) > 0.82 ? 2 : 1;
  }
  return 0;
};
registerLook('squid', {
  // Sepioteuthis australis (southern calamari): a long tube pointed at the tail, a diamond fin down the back half, big eyes, eight arms that curl at the tips
  // and two long tentacles with paddle tips. Pale, see-through pink, freckled with reddish chromatophores, a darker back and a blue-green sheen.
  cephalopod: 'squid', length: 0.55, emissive: 0xf2a496, emissiveIntensity: 0.5, depth: 0.19, width: 0.18, tailFrac: 0.02, tail: 'none', arms: 8, pectoral: 0,
  paint: {
    body: (u, s) => {
      const back = sm(-0.5, 0.85, s);
      let c = mix(C(0xfbf3ee), C(0xf1d3ca), back);
      c = mix(c, C(0xc2e6e0), 0.2 * sm(0.15, 0.45, u) * (1 - sm(0.55, 0.8, u)) * (1 - Math.abs(s)));      // a pale blue-green sheen
      c = mix(c, C(0xf0cfc6), 0.28 * sm(0.55, 0.95, s) * sm(0.05, 0.3, u));                                    // the darker stripe down the back
      const d = dots(u, s, 56, 0.2 + 0.12 * back + (u > 0.89 ? 0.1 : 0));
      if (d === 1) c = mix(c, C(0xd69a92), 0.5 + 0.15 * back);
      else if (d === 2) c = mix(c, C(0xa88ab4), 0.4);
      return c;
    },
    fin: (u, part, f) => { const c = mix(C(0xfdf6f2), C(0xf3d8d0), f * 0.7); const d = dots(u * 1.6, f * 2 - 1, 26, 0.2); return d ? mix(c, C(0xdca79f), 0.45) : c; },
    arm: (u, f) => { const root = 1 - sm(0.1, 0.7, u), c = mix(C(0xfcf0ea), C(0xefc3b8), root); const d = dots(u * 0.9, f * 2 - 1, 30, 0.3); return d && u < 0.8 ? mix(c, C(0xd08c84), 0.5) : u > 0.82 ? mix(c, C(0xfffaf6), 0.7) : c; },
    iris: [0.62, 0.74, 0.8],
  },
  swim: { freq: 3, amp: 0.2 },
});
registerLook('cuttlefish', {
  // Sepia spp.: a broad, flattened oval body with a frill of fin all the way round, short thick arms, W-shaped pupils and zebra-like bands across the back.
  cephalopod: 'cuttle', length: 0.3, depth: 0.3, width: 0.3, tailFrac: 0.02, tail: 'none', arms: 8, pectoral: 0,
  paint: {
    body: (u, s) => {
      const back = sm(-0.3, 0.8, s);
      let c = mix(C(0xefe0c4), C(0xb59a74), back);
      const band = Math.sin(u * 52 + Math.sin(s * 5) * 1.6);
      if (s > -0.1 && u < 0.84 && band > 0.35) c = mix(c, C(0x6e553a), 0.55 + 0.3 * back);                     // zebra bands across the mantle
      const d = dots(u, s, 70, 0.14);
      if (d && s > 0.1) c = mix(c, C(0xfaf4e6), 0.7);                                                          // pale speckles
      return c;
    },
    fin: (u, part, f) => mix(C(0xf1e4cc), C(0xcdb48a), Math.abs(Math.sin(u * 40)) * 0.5 + f * 0.3),
    arm: (u, f) => mix(C(0xc9ad84), C(0xeadcbf), u),
    iris: [0.78, 0.72, 0.5],
  },
  swim: { freq: 6, amp: 0.15 },
});
registerLook('yakka', {
  // Yellowtail scad (Trachurus): slim and silvery, blue-green back, a yellow tail and fins, a dark spot on the gill cover and a line of bony scutes along the side.
  length: 0.25, depth: 0.2, width: 0.1, peak: 0.55, snout: 0.8, tailFrac: 0.2, tail: 'forked', tailSpan: 1.25, pectoral: 0.11,
  dorsal: { from: 0.28, to: 0.7, height: 0.06 }, anal: { from: 0.2, to: 0.5, height: 0.05 },
  paint: {
    body: withEye((u, s) => {
      if (Math.hypot((u - 0.79) * 1.7, (s - 0.35) * 0.7) < 0.045) return C(0x24343a);                          // the dark gill-cover spot
      if (Math.abs(s - 0.04) < 0.035 && u > 0.2 && u < 0.76 && Math.sin(u * 95) > -0.2) return C(0xcdb55a);      // lateral line scutes
      return mix(C(0xeef4f0), C(0x6aa7b4), sm(-0.2, 0.8, s));
    }, 0.9, 0.3, 0.046),
    fin: (u, part) => (part === 'tail' || part === 'anal' ? C(0xf0cf4c) : C(0xdcd890)),
  },
  swim: { freq: 7, amp: 0.65 }, metal: 0.5,
});
registerLook('slimymackerel', {
  // Scomber australasicus: a torpedo of a fish with a big eye, wavy dark lines over a blue-green back, a silver belly and a forked tail with finlets behind the fins.
  length: 0.32, depth: 0.2, width: 0.11, peak: 0.5, snout: 0.9, tailFrac: 0.2, tail: 'forked', tailSpan: 1.3, pectoral: 0.1,
  dorsal: { from: 0.3, to: 0.62, height: 0.06, shape: 'tri' }, anal: { from: 0.18, to: 0.4, height: 0.045 },
  paint: {
    body: withEye((u, s) => {
      const back = mix(C(0xeef2f0), C(0x5f9fae), sm(-0.15, 0.7, s));
      return s > 0.12 && u > 0.12 && u < 0.84 && Math.sin(u * 62 + Math.sin(s * 22) * 2.2) > 0.4 ? mix(back, C(0x2f5f70), 0.7) : back;   // wavy dark lines on the back
    }, 0.89, 0.25, 0.062),
    fin: (u, part) => (part === 'tail' ? C(0x6f8f9a) : C(0xb8cdd0)),
  },
  swim: { freq: 7, amp: 0.65 }, metal: 0.55,
});
registerLook('shortfineel', {
  length: 0.7, depth: 0.05, width: 0.05, peak: 0.45, snout: 0.7, tailFrac: 0.05, tail: 'round', tailSpan: 0.45, pectoral: 0.025, peduncle: 0.6,
  dorsal: { from: 0.06, to: 0.8, height: 0.025 }, anal: { from: 0.06, to: 0.55, height: 0.02 },
  paint: { body: withEye((u, s) => mix(C(0xe8e0c0), C(0x6e6a42), sm(-0.4, 0.5, s)), 0.95, 0.3, 0.03, 0x101010, 0xe0d070), fin: () => C(0x8a8458) },
  swim: { freq: 3.5, amp: 0.4 }, waveK: 3,
});
// ---- Phase 6: the offshore reef and the freshwater river.
registerLook('jackassmorwong', {
  // Nemadactylus douglasii: a deep, silvery-grey body with a dark band over the shoulder, one long trailing pectoral fin, a small "kissing" mouth with thick lips and a forked tail.
  length: 0.45, depth: 0.38, width: 0.12, peak: 0.55, snout: 0.7, tailFrac: 0.17, tail: 'forked', tailSpan: 1.1, pectoral: 0.24, pecAt: 0.7, lips: true,
  dorsal: { from: 0.18, to: 0.82, height: 0.075 }, anal: { from: 0.2, to: 0.42, height: 0.06 },
  paint: {
    body: withEye((u, s) => {
      const base = mix(C(0xeaeceb), C(0x8e9aa0), sm(-0.4, 0.8, s));
      return Math.abs(u - 0.7) < 0.045 && s > -0.1 ? mix(base, C(0x4c5a62), 0.7) : base;      // the dark shoulder band
    }, 0.9, 0.25, 0.048, 0x101010, 0xe6d8a0),
    fin: (u, part) => (part === 'pectoral' ? C(0xd8dcdc) : part === 'tail' ? C(0x6f7e86) : C(0x9aa6ac)),
  },
  swim: { freq: 4, amp: 0.55 }, metal: 0.3,
});
registerLook('australianbass', {
  // Macquaria novemaculeata: a dark golden-olive perch with a paler belly, a pointed head with a lower jaw that juts out, spiny-fronted dorsal and a forked tail.
  length: 0.35, depth: 0.3, width: 0.12, peak: 0.55, snout: 0.85, tailFrac: 0.17, tail: 'forked', tailSpan: 1.0, pectoral: 0.12,
  dorsal: { from: 0.2, to: 0.78, height: 0.075 }, anal: { from: 0.18, to: 0.38, height: 0.055 },
  paint: { body: withEye((u, s) => mix(C(0xe2d6a6), C(0x7d6a3a), sm(-0.35, 0.8, s)), 0.9, 0.3, 0.05, 0x101010, 0xd8b050), fin: (u, part) => (part === 'tail' ? C(0x6a5a34) : C(0x8d7a4a)) },
  swim: { freq: 5, amp: 0.6 },
});
registerLook('carp', {
  // Cyprinus carpio: a stout golden-olive body with big scales (a pattern of scale edges), a sucker-like downturned mouth with two pairs of barbels, one long dorsal fin and a forked red-brown tail.
  length: 0.45, depth: 0.34, width: 0.15, peak: 0.5, snout: 0.5, tailFrac: 0.17, tail: 'forked', tailSpan: 0.95, pectoral: 0.11,
  dorsal: { from: 0.12, to: 0.78, height: 0.07 }, anal: { from: 0.18, to: 0.32, height: 0.05 },
  paint: {
    body: withEye((u, s) => {
      const base = mix(C(0xe9dca2), C(0x8a7a3e), sm(-0.35, 0.8, s));
      const row = Math.floor((s + 1) * 6), off = (row % 2) * 0.5, edge = Math.abs(((u * 26 + off) % 1) - 0.5) > 0.44 || Math.abs((((s + 1) * 6) % 1) - 0.5) > 0.46;
      return edge && u > 0.12 && u < 0.8 ? mix(base, C(0x6a5a2a), 0.4) : base;                                  // the big scale edges
    }, 0.88, 0.28, 0.04, 0x101010, 0xd8b050),
    fin: (u, part) => (part === 'tail' || part === 'anal' ? C(0xb0664a) : C(0x9a8a52)),
  },
  swim: { freq: 3.5, amp: 0.5 },
});
