// The prop finish: AO, bevel distances and the merged outline hull (world/propBake.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { box, finish } from '../src/world/propKit.js';
import { bakeModel } from '../src/world/propBake.js';

const shed = () => finish([box(3, 2, 3, 0xdddddd, 0, 1, 0), box(4, 0.1, 4, 0xbb5533, 0, 2.05, 0)]);
const lum = (g, i) => g.attributes.color.getX(i) + g.attributes.color.getY(i) + g.attributes.color.getZ(i);

test('the outline is merged into the same geometry: every triangle twice, the copy flagged and wound backwards', () => {
  const raw = shed(), g = bakeModel(raw), n = raw.attributes.position.count, ink = g.attributes.aInk;
  assert.equal(g.attributes.position.count, n * 2);
  for (let i = 0; i < n; i++) { assert.equal(ink.getX(i), 0); assert.equal(ink.getX(n + i), 1); }
  for (let t = 0; t < n; t += 3) assert.equal(g.attributes.position.getX(n + t + 1), raw.attributes.position.getX(t + 2));
  assert.ok(g.attributes.position.array.every(Number.isFinite) && g.attributes.normal.array.every(Number.isFinite));
  assert.equal(bakeModel(g), g, 'baking twice changes nothing');
});
test('occlusion: a wall is darker at the ground and under the eaves than a bare roof, and shade stays cool (blue keeps the most light)', () => {
  const raw = shed(), g = bakeModel(raw), p = g.attributes.position, n = raw.attributes.position.count;
  let wallLow = 9, roof = 0, cool = true;
  for (let i = 0; i < n; i++) {
    if (Math.abs(p.getX(i)) === 1.5 && p.getY(i) < 0.01) { wallLow = Math.min(wallLow, lum(g, i) / lum(raw, i)); cool &&= g.attributes.color.getZ(i) / raw.attributes.color.getZ(i) >= g.attributes.color.getX(i) / raw.attributes.color.getX(i); }
    if (p.getY(i) > 2.09) roof = Math.max(roof, lum(g, i) / lum(raw, i));
  }
  assert.ok(wallLow < 0.85, `ground contact darkens (${wallLow})`); assert.ok(roof > 0.98, 'open roof stays bright'); assert.ok(cool, 'shade is a cool tint');
});
test('bevels mark convex box edges and not butted, level faces', () => {
  const a = finish([box(2, 1, 1, 0xffffff, -1, 0.5, 0), box(2, 1, 1, 0xffffff, 1, 0.5, 0)]), g = bakeModel(a), e = g.attributes.aEdge, p = g.attributes.position;
  const n = a.attributes.position.count; let near = 0, buttedEdge = 0;
  for (let i = 0; i < n; i += 3) if (p.getY(i) === 1 && p.getY(i + 1) === 1 && p.getY(i + 2) === 1) for (let v = 0; v < 3; v++) {
    const m = Math.min(e.getX(i + v), e.getY(i + v), e.getZ(i + v)); if (m === 0) near++;
    if (Math.abs(p.getX(i + v)) < 1e-6) { for (const [c, o] of [[e.getX(i + v), 0], [e.getY(i + v), 1], [e.getZ(i + v), 2]]) if (c === 0 && Math.abs(p.getX(i + (o + 1) % 3)) < 1e-6 && Math.abs(p.getX(i + (o + 2) % 3)) < 1e-6) buttedEdge++; }
  }
  assert.ok(near > 0, 'the top faces know their outer edges'); assert.equal(buttedEdge, 0, 'no bevel across the joint');
});
