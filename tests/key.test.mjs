import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, FEATURES, REGIONS, speciesInRegion } from '../src/fishing/species.js';
import { KEY, buildKey, walk, pathTo, answerFor, FEATURE_DEFS } from '../src/fishing/key.js';
import '../src/fishing/catches.js'; // registers the looks

test('every species has the visible features the key needs, with a wording for each value', () => {
  for (const s of SPECIES) {
    assert.ok(s.feat && s.feat === FEATURES[s.id], `${s.id} feat`);
    for (const f of FEATURE_DEFS) {
      assert.ok(f.values[s.feat[f.id]], `${s.id}: ${f.id}=${s.feat[f.id]} has no wording`);
    }
  }
  // Features are distinct enough that no two species look identical to the key.
  const sig = new Set(SPECIES.map(s => FEATURE_DEFS.map(f => s.feat[f.id]).join('|')));
  assert.equal(sig.size, SPECIES.length);
});

test('every species reaches its own unique leaf, by the answers its own features give', () => {
  const leaves = new Set();
  for (const s of SPECIES) {
    const path = pathTo(KEY, s), end = walk(KEY, path);
    assert.equal(end.leaf, s.id, `${s.id} ended at ${JSON.stringify(end)}`);
    assert.ok(!leaves.has(end.leaf)); leaves.add(end.leaf);
  }
  assert.equal(leaves.size, SPECIES.length);
  // N species need N-1 couplets (the key grows by exactly one couplet per species); no path is longer than 8 couplets and the key is not trivially shallow.
  assert.equal(Object.keys(KEY.couplets).length, SPECIES.length - 1);
  for (const [id, d] of Object.entries(KEY.leaves)) assert.ok(d >= 3 && d <= 8, `${id} is ${d} couplets deep`);
  assert.ok(KEY.depth <= 8 && KEY.depth >= 4);
});

test('the key is deterministic and numbered in reading order', () => {
  const again = buildKey([...SPECIES].reverse());
  assert.deepEqual(again, KEY);
  assert.equal(KEY.first, 1);
  // Couplet 1 comes first; the first answer's subtree is numbered before the second's.
  const seen = [];
  const visit = to => { if (!to.couplet) return; seen.push(to.couplet); const c = KEY.couplets[to.couplet]; visit(c.a.to); visit(c.b.to); };
  visit({ couplet: 1 });
  assert.deepEqual(seen, seen.map((_, i) => i + 1));
  for (const c of Object.values(KEY.couplets)) {
    assert.ok(c.a.text && c.b.text && c.a.text !== c.b.text);
    assert.equal(c.ids.filter(id => answerFor(c, SPECIES.find(s => s.id === id)) === 'a').length > 0, true);
    assert.ok(c.a.to.couplet || c.a.to.leaf);
  }
});

test('a wrong answer ends at a different leaf (a wrong key names a wrong species)', () => {
  const s = SPECIES.find(x => x.id === 'tailor'), path = pathTo(KEY, s);
  const wrong = [...path]; wrong[wrong.length - 1] = wrong.at(-1) === 'a' ? 'b' : 'a';
  const end = walk(KEY, wrong);
  assert.ok(end.leaf && end.leaf !== 'tailor');
});

test('regions: Lake Illawarra, Bellambi and Belmore Basin all list species, and together cover every species', () => {
  const lake = speciesInRegion('lake'), bel = speciesInRegion('bellambi'), har = speciesInRegion('harbour');
  assert.ok(lake.length >= 10 && bel.length >= 10 && har.length >= 14);
  assert.equal(new Set([...lake, ...bel, ...har].map(s => s.id)).size, SPECIES.length);
  for (const id of ['yakka', 'slimymackerel', 'cuttlefish', 'squid']) assert.ok(har.some(s => s.id === id), `${id} is a harbour species`);
  assert.ok(REGIONS.lake.label === 'Lake Illawarra');
});
