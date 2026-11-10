import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { TRACKS, SITE_TRACK, pickTrack, duckLevel, jingleFor } from '../src/audio/musicPlan.js';
import { ECOSYSTEMS } from '../src/ecosystems/index.js';

test('every site has a daytime track and the menu / ceremony have theirs', () => {
  for (const e of ECOSYSTEMS) assert.ok(TRACKS[SITE_TRACK[e.id]], e.id);
  assert.equal(pickTrack({ mode: 'menu' }), 'arcade');
  assert.equal(pickTrack({ mode: 'ceremony' }), 'gonefishin');
  assert.equal(pickTrack({ mode: 'loading' }), null);
});
test('site mapping by day', () => {
  const day = s => pickTrack({ mode: 'land', site: s, time: 'day' });
  assert.deepEqual(['rocky', 'seagrass', 'harbour', 'reef', 'river'].map(day), Array(5).fill('arcade'));
});
test('night, dawn and dusk keep the site track (one tune all day)', () => {
  for (const e of ECOSYSTEMS) {
    assert.equal(pickTrack({ mode: 'land', site: e.id, time: 'night' }), SITE_TRACK[e.id]);
    assert.equal(pickTrack({ mode: 'land', site: e.id, time: 'dusk' }), SITE_TRACK[e.id]);
    assert.equal(pickTrack({ mode: 'land', site: e.id, time: 'dawn' }), SITE_TRACK[e.id]);
  }
});
test('ducking: jingle lowest, then dialogue, fight; nothing = full', () => {
  assert.equal(duckLevel({}), 1);
  assert.ok(duckLevel({ jingle: true, dialogue: true }) < duckLevel({ dialogue: true }));
  assert.ok(duckLevel({ dialogue: true }) < duckLevel({ fight: true }));
  assert.ok(duckLevel({ fight: true }) < 1);
  assert.equal(jingleFor('newSpecies'), 'reelwinner');
  assert.equal(jingleFor('other'), null);
});
test('every track file exists', () => {
  for (const [k, t] of Object.entries(TRACKS)) assert.ok(existsSync(new URL('../' + t.file, import.meta.url)), k);
});
