import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SPECIES } from '../src/fishing/species.js';
import { LOOKS } from '../src/life/looks.js';
import '../src/ecosystems/index.js';
import '../src/fishing/catches.js';
import { globalUniforms } from '../src/ocean/shaders.js';
import { buildFish, pchip } from '../src/life/fishModel.js';
import { matFishBox, matReading } from '../src/ui/matMath.js';

globalUniforms.uStyle.value = 1;

test('every finned species model spans exactly its total length: tail tip at -L/2, snout (or beak) tip at +L/2', () => {
  for (const s of SPECIES) {
    const look = LOOKS[s.id];
    if (look.cephalopod) continue;
    const b = buildFish(look, { noTexture: true });
    b.geometry.computeBoundingBox();
    const bb = b.geometry.boundingBox;
    assert.ok(Math.abs(bb.min.x + look.length / 2) < 1e-4 && Math.abs(bb.max.x - look.length / 2) < 1e-4, `${s.id}: x ${bb.min.x.toFixed(4)}..${bb.max.x.toFixed(4)} vs L ${look.length}`);
    const tris = b.geometry.index.count / 3;
    assert.ok(tris <= 4000, `${s.id}: ${tris} triangles`);
  }
});

test('the brag mat: snout tip on the 0 stop, tail tip on the fish length (any scale, any aspect)', () => {
  for (const [len, pxcm, aspect, padL] of [[42, 7.5, 0.3, 18], [100, 3.1, 0.22, 18], [27.5, 12, 0.5, 18]]) {
    const r = matReading(matFishBox(len, pxcm, aspect, padL), padL, pxcm);
    assert.equal(r.snoutCm, 0); assert.ok(Math.abs(r.tailCm - len) < 1e-9);
  }
});

test('pchip passes through its control points and never overshoots', () => {
  const f = pchip([[0, 0.1], [0.5, 1], [1, 0.2]]);
  assert.ok(Math.abs(f(0.5) - 1) < 1e-9);
  for (let x = 0; x <= 1; x += 0.02) assert.ok(f(x) <= 1.0001 && f(x) >= 0.0999);
});
