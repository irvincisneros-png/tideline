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
registerLook('squid', {
  length: 0.35, depth: 0.16, width: 0.15, peak: 0.45, snout: 0.9, tailFrac: 0.02, tail: 'none', pectoral: 0, belly: 0.1, arms: 8, armsFrac: 0.24,
  dorsal: { from: 0.04, to: 0.6, height: 0.085, shape: 'round' }, anal: { from: 0.04, to: 0.6, height: 0.085, shape: 'round' },
  paint: { body: withEye((u, s) => { const dots = Math.sin(u * 150 + s * 40) * Math.sin(u * 90 - s * 70) > 0.55; const c = mix(C(0xf0e0d4), C(0xd2a79a), sm(-0.4, 0.7, s)); return dots ? mix(c, C(0xa05a5a), 0.55) : c; }, 0.72, 0.15, 0.06, 0x101010, 0xb8d0e0), fin: () => C(0xe8d2c8) },
  swim: { freq: 3, amp: 0.2 },
});
registerLook('shortfineel', {
  length: 0.7, depth: 0.05, width: 0.05, peak: 0.45, snout: 0.7, tailFrac: 0.05, tail: 'round', tailSpan: 0.45, pectoral: 0.025, peduncle: 0.6,
  dorsal: { from: 0.06, to: 0.8, height: 0.025 }, anal: { from: 0.06, to: 0.55, height: 0.02 },
  paint: { body: withEye((u, s) => mix(C(0xe8e0c0), C(0x6e6a42), sm(-0.4, 0.5, s)), 0.95, 0.3, 0.03, 0x101010, 0xe0d070), fin: () => C(0x8a8458) },
  swim: { freq: 3.5, amp: 0.4 }, waveK: 3,
});
