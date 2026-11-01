import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, STYLES, SECTIONS, NAME_MAX, checkName, displayName, sanitizeLook, randomLook, makeAngler, lookOf, nameOf } from '../src/core/anglerData.js';
import { DEFAULT_LOOK } from '../src/land/angler-defaults.js';
import { loadProgress } from '../src/core/save.js';

test('creator options: 8 skin tones, 8 colours each, the required styles', () => {
  assert.equal(PALETTES.skin.length, 8);
  for (const k of ['skin', 'hair', 'hat', 'shirt', 'shorts', 'rod']) { assert.equal(PALETTES[k].length, 8, k); assert.equal(new Set(PALETTES[k].map(c => c.v)).size, 8, `${k} swatches are distinct`); }
  assert.deepEqual(STYLES.hairStyle.map(s => s.id), ['short', 'long', 'pony', 'buzz', 'curly', 'bun']);
  assert.deepEqual(STYLES.hatStyle.map(s => s.id), ['none', 'bucket', 'cap', 'straw', 'beanie', 'wide']);
  assert.deepEqual(STYLES.pattern.map(s => s.id), ['plain', 'stripes', 'flowers', 'fishing']);
  assert.deepEqual(STYLES.sunnies.map(s => s.id), ['none', 'round', 'sport']);
  assert.deepEqual(Object.keys(DEFAULT_LOOK).sort(), [...Object.keys(PALETTES), ...Object.keys(STYLES)].sort());
  for (const s of SECTIONS) assert.ok(s.kind === 'swatch' ? PALETTES[s.key] : STYLES[s.key], s.key);
});

test('names: trimmed, 16 characters at most, basic profanity blocked (spaced and leet spellings too), ordinary names fine', () => {
  assert.equal(checkName('  Sam   Lee ').name, 'Sam Lee');
  assert.equal(checkName('A'.repeat(40)).name.length, NAME_MAX);
  assert.doesNotMatch(checkName('<b>Mia</b>').name, /[<>]/);
  for (const bad of ['fuck', 'F U C K', 'sh1t', 'Big Sh!t', 'xxcuntxx', 'b1tch', 'D1ck', 'cock', 'a$$']) assert.equal(checkName(bad).ok, false, bad);
  for (const ok of ['Hancock', 'Essex', 'Scunthorpe', 'Mia', 'Tui-Rose', 'Assam', 'Kai', '']) assert.equal(checkName(ok).ok, true, ok);
  assert.equal(displayName(''), 'Angler'); assert.equal(displayName('  Kai '), 'Kai');
});

test('looks: bad or missing values fall back to the default, random looks are always valid', () => {
  assert.deepEqual(sanitizeLook({}), DEFAULT_LOOK); assert.deepEqual(sanitizeLook(null), DEFAULT_LOOK);
  const l = sanitizeLook({ hairStyle: 'mohawk', hatStyle: 'wide', skin: 'blue', shirt: 0x123456, rod: -5, hat: NaN });
  assert.equal(l.hairStyle, DEFAULT_LOOK.hairStyle); assert.equal(l.hatStyle, 'wide'); assert.equal(l.skin, DEFAULT_LOOK.skin); assert.equal(l.shirt, 0x123456); assert.equal(l.rod, DEFAULT_LOOK.rod); assert.equal(l.hat, DEFAULT_LOOK.hat);
  let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const seen = {};
  for (let i = 0; i < 200; i++) {
    const r = randomLook(rng);
    for (const k of Object.keys(PALETTES)) assert.ok(PALETTES[k].some(c => c.v === r[k]), k);
    for (const k of Object.keys(STYLES)) { assert.ok(STYLES[k].some(c => c.id === r[k]), k); (seen[k] ??= new Set()).add(r[k]); }
  }
  for (const k of Object.keys(STYLES)) assert.equal(seen[k].size, STYLES[k].length, `random reaches every ${k}`);
});

test('saved angler: an old save has none (the creator opens once); a made one round-trips', () => {
  const store = {};
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
  store['tideline.progress.v1'] = JSON.stringify({ v: 2, catches: [], journal: {} });   // a phase 1b save
  const old = loadProgress(); assert.equal(old.angler, null); assert.equal(nameOf(old), 'Angler'); assert.deepEqual(lookOf(old.angler), DEFAULT_LOOK);
  const a = makeAngler('  Kai ', { skin: 0x6b3d24, hairStyle: 'bun', hatStyle: 'cap', pattern: 'flowers' });
  assert.equal(a.name, 'Kai'); assert.equal(a.skin, 0x6b3d24); assert.equal(a.hairStyle, 'bun');
  store['tideline.progress.v1'] = JSON.stringify({ v: 2, angler: a });
  const p = loadProgress(); assert.equal(nameOf(p), 'Kai'); assert.equal(lookOf(p.angler).pattern, 'flowers');
  delete globalThis.localStorage;
});
