// Facial hair: the look data, the save migration (an old angler gets "none"), Randomise, and the beard meshes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, STYLES, SECTIONS, sanitizeLook, randomLook, makeAngler, swatchName } from '../src/core/anglerData.js';
import { DEFAULT_LOOK, BEARD_IDS } from '../src/land/angler-defaults.js';
import { migrateProgress } from '../src/core/save.js';
import { BEARD_MESHES, beardGeo } from '../src/land/beard.js';
import { NPCS } from '../src/content/npcs.js';

test('options: none, stubble, moustache, short beard, big bushy beard; colours are the hair palette plus grey and white', () => {
  assert.deepEqual(STYLES.beard.map(s => s.id), ['none', 'stubble', 'moustache', 'short', 'big']);
  assert.deepEqual(STYLES.beard.map(s => s.id), BEARD_IDS);
  const names = PALETTES.beardColor.map(c => c.name);
  for (const h of PALETTES.hair) assert.ok(PALETTES.beardColor.some(c => c.v === h.v), `hair colour ${h.name} is a beard colour`);
  assert.ok(names.includes('Grey') && names.includes('White'));
  assert.equal(new Set(PALETTES.beardColor.map(c => c.v)).size, PALETTES.beardColor.length);
  const sec = SECTIONS.find(s => s.key === 'beardColor');
  assert.equal(sec.when({ beard: 'none' }), false); assert.equal(sec.when({ beard: 'big' }), true);
});

test('defaults: no beard, colour matches the hair (null); bad values fall back', () => {
  assert.equal(DEFAULT_LOOK.beard, 'none'); assert.equal(DEFAULT_LOOK.beardColor, null);
  assert.deepEqual(sanitizeLook({}), DEFAULT_LOOK);
  const l = sanitizeLook({ beard: 'wizard', beardColor: 'red' });
  assert.equal(l.beard, 'none'); assert.equal(l.beardColor, null);
  const k = sanitizeLook({ beard: 'big', beardColor: 0xf6f4ee });
  assert.equal(k.beard, 'big'); assert.equal(k.beardColor, 0xf6f4ee);
  assert.equal(swatchName('beardColor', null), 'Matches hair'); assert.equal(swatchName('beardColor', 0xf6f4ee), 'White');
  assert.equal(makeAngler('Kai', { beard: 'short' }).beard, 'short');
});

test('save migration: an angler saved before beards gets "none"; good values and bad values', () => {
  const old = { name: 'Kai', skin: 0xc58c5e, hairStyle: 'short', hair: 0x4a2f1d };
  const m = migrateProgress({ v: 4, angler: old });
  assert.equal(m.angler.beard, 'none'); assert.equal(m.angler.beardColor, null); assert.equal(m.angler.name, 'Kai');
  const keep = migrateProgress({ v: 4, angler: { ...old, beard: 'big', beardColor: 0x8d9296 } });
  assert.equal(keep.angler.beard, 'big'); assert.equal(keep.angler.beardColor, 0x8d9296);
  const bad = migrateProgress({ v: 4, angler: { ...old, beard: 7, beardColor: 'x' } });
  assert.equal(bad.angler.beard, 'none'); assert.equal(bad.angler.beardColor, null);
  assert.equal(migrateProgress({}).angler, null);   // no angler yet: the creator opens, nothing invented
});

test('Randomise: reaches every beard style, colour is valid or matches the hair', () => {
  let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const seen = new Set(); let matched = 0, own = 0;
  for (let i = 0; i < 300; i++) {
    const r = randomLook(rng); seen.add(r.beard);
    if (r.beardColor === null) matched++; else { own++; assert.ok(PALETTES.beardColor.some(c => c.v === r.beardColor)); }
  }
  assert.equal(seen.size, 5); assert.ok(matched > own && own > 0);
});

test('beard meshes: every style has real, chunky geometry in the head frame (the big beard is the biggest)', () => {
  const size = id => { const g = beardGeo(BEARD_MESHES[id][0]); g.computeBoundingBox(); return { n: g.attributes.position.count, h: g.boundingBox.max.y - g.boundingBox.min.y, min: g.boundingBox.min }; };
  assert.equal(BEARD_MESHES.none.length, 0);
  for (const id of BEARD_IDS.filter(i => i !== 'none')) { const s = size(id); assert.ok(s.n > 100, id); assert.ok(s.min.z > -0.1, `${id} sits on the front of the face`); }
  assert.ok(size('big').h > size('short').h && size('short').h > size('moustache').h);
  assert.ok(size('big').n > 1000, 'a big beard is built from many overlapping tufts, not one plane');
  assert.equal(beardGeo('ang_hairShort_hair'), null);
});

test('NPCs: Old Tam has a white big beard and his look sanitises cleanly', () => {
  const l = sanitizeLook(NPCS.tam.look);
  assert.equal(l.beard, 'big'); assert.equal(l.beardColor, 0xf6f4ee);
});
