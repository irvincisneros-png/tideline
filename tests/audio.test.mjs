import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spatialMix } from '../src/audio/engine.js';
import { SOUNDS } from '../src/audio/sounds.js';
import { VOICES } from '../src/audio/soundscape.js';

const ear = { x: 0, y: 0, z: 0 }, right = { x: 1, y: 0, z: 0 };

test('spatialMix: louder when closer, silent past max range', () => {
  const near = spatialMix(ear, right, { x: 0, y: 0, z: -3 }, { ref: 5, max: 50 });
  const far = spatialMix(ear, right, { x: 0, y: 0, z: -30 }, { ref: 5, max: 50 });
  assert.ok(near.gain > far.gain && far.gain > 0);
  assert.equal(spatialMix(ear, right, { x: 0, y: 0, z: -60 }, { max: 50 }).gain, 0);
});

test('spatialMix: pans toward the side the sound is on', () => {
  assert.ok(spatialMix(ear, right, { x: 10, y: 0, z: 0 }).pan > 0.5);
  assert.ok(spatialMix(ear, right, { x: -10, y: 0, z: 0 }).pan < -0.5);
  assert.ok(Math.abs(spatialMix(ear, right, { x: 0, y: 0, z: -10 }).pan) < 0.01);
});

test('spatialMix: sounds across the air/water surface are muffled and quieter', () => {
  const same = spatialMix(ear, right, { x: 0, y: 0, z: -5 }, { medium: 'air', listenerMedium: 'air' });
  const across = spatialMix(ear, right, { x: 0, y: 0, z: -5 }, { medium: 'air', listenerMedium: 'water' });
  assert.ok(across.muffled && !same.muffled && across.gain < same.gain);
});

test('every sound the game asks for exists', () => {
  const used = new Set();
  for (const v of Object.values(VOICES)) { v.sounds.forEach(s => used.add(s)); if (v.breath) used.add(v.breath); }
  const src = ['src/main.js', 'src/ui/panels.js', 'src/audio/soundscape.js', 'src/fishing/fishing.js'].map(f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  for (const m of src.matchAll(/\.play\('([a-zA-Z]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/play\(\w+ \? '([a-zA-Z]+)' : (?:\w+ \? )?'([a-zA-Z]+)'(?: : '([a-zA-Z]+)')?/g)) m.slice(1).filter(Boolean).forEach(s => used.add(s));
  assert.ok(used.size > 15, `found ${used.size}`);
  for (const s of used) assert.equal(typeof SOUNDS[s], 'function', `missing sound "${s}"`);
});

test('vocal species exist in at least one ecosystem', async () => {
  const ids = new Set();
  for (const f of readdirSync(new URL('../src/content/', import.meta.url)).filter(f => !['npcs.js', 'items.js', 'quiz.js', 'shop.js', 'cards.js', 'coop.js', 'credits.js', 'ceremony.js', 'missions.js', 'teachers.js'].includes(f))) {
    const { species } = await import(`../src/content/${f}`);
    species.forEach(s => ids.add(s.id));
  }
  for (const id of Object.keys(VOICES)) assert.ok(ids.has(id), `VOICES.${id} is not a species`);
});
