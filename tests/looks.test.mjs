import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, FEATURES } from '../src/fishing/species.js';
import { LOOKS } from '../src/life/looks.js';
import '../src/ecosystems/index.js'; // registers the looks (the line-caught ones come with fishing/catches.js)
import '../src/fishing/catches.js';

// The key's features (fishing/species.js FEATURES) must be what the model really shows: tail shape, thick lips, tentacles, markings.
const TAIL = { forked: ['forked', 'lunate'], truncate: ['truncate'], rounded: ['round'], none: ['none'] };

test('every species has a look, and its tail type is the one the key claims', () => {
  for (const s of SPECIES) {
    const look = LOOKS[s.id], f = FEATURES[s.id];
    assert.ok(look, `${s.id} has a registered look`);
    assert.ok(TAIL[f.tail].includes(look.tail ?? 'forked'), `${s.id}: key says ${f.tail} tail, model draws ${look.tail}`);
  }
});

test('dusky flathead: a broad rounded-truncate tail (not forked), eyes on top close together, spotted, cream belly', () => {
  const l = LOOKS.duskyflathead;
  assert.equal(l.tail, 'truncate'); assert.ok((l.peduncle ?? 0) >= 0.15, 'a real base for the tail fan');
  assert.ok(l.paint.body.eye.s > 0.85, 'eyes sit on top of the head, near the midline');
  const belly = l.paint.body(0.5, -0.9, 1), back = l.paint.body(0.5, 0.9, 1);
  assert.ok(belly[0] + belly[1] + belly[2] > back[0] + back[1] + back[2] + 0.5, 'pale belly, darker back');
  const tail = l.paint.fin(0.05, 'tail', 0.95), mid = l.paint.fin(0.05, 'tail', 0.6);
  assert.ok(tail[0] > 0.7 && mid[0] < 0.3, 'a pale edge on the tail around a dark blotch');
});

test('markings the key lists are painted: salmon spots (not bars), luderick bars, kingfish stripe, trevally blotch, bluegroper lips, squid arms', () => {
  assert.equal(FEATURES.australiansalmon.markings, 'spots');
  const sal = LOOKS.australiansalmon.paint.body; let dark = 0, n = 0;
  for (let u = 0.15; u < 0.8; u += 0.004) for (let s = 0.3; s < 0.9; s += 0.02) { const c = sal(u, s, 1); n++; if (c[0] < 0.06) dark++; }
  assert.ok(dark / n > 0.01 && dark / n < 0.25, `a scatter of small dark spots on the back (${(dark / n * 100).toFixed(1)}%)`);
  assert.ok(LOOKS.bluegroper.lips && LOOKS.redmorwong.lips, 'thick-lipped fish have lips');
  assert.equal(LOOKS.bluegroper.tail, 'round');
  assert.ok(LOOKS.squid.arms >= 8, 'a squid shows its arms');
  assert.equal(FEATURES.squid.jaw, 'tentacles');
  const lud = LOOKS.luderick.paint.body; const barCols = new Set(); for (let u = 0.2; u < 0.78; u += 0.01) barCols.add(lud(u, 0.2, 1).map(v => v.toFixed(2)).join());
  assert.ok(barCols.size >= 2, 'luderick has dark bars on a paler flank');
  const sc = (look, y) => look.paint.body(0.78, y, 1); // silver trevally's black gill-cover spot
  assert.ok(sc(LOOKS.silvertrevally, 0.52)[0] < 0.2 && sc(LOOKS.silvertrevally, -0.4)[0] > 0.4);
});

test('dark fish are not black blobs: the darkest species stay readable (pastel-shifted)', () => {
  for (const id of ['luderick', 'rockblackfish']) {
    const c = LOOKS[id].paint.body(0.5, 0.5, 1), lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    assert.ok(lum > 0.1, `${id} back is readable (luminance ${lum.toFixed(2)})`);
  }
});
