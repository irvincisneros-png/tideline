// Lake Illawarra layout: a walkable plank jetty from the bank out to the channel, and the `jetty` catch spot off its end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPOT_INFO } from '../src/fishing/species.js';

const { seagrass, JETTY, shoreZ, chanZ, heightAt, deckAt } = await import('../src/ecosystems/seagrass.js');

test('the jetty runs from the bank to deep water and every metre of it is walkable deck', () => {
  assert.ok(JETTY.z0 > JETTY.z1 + 20, 'a decent length');
  assert.ok(heightAt(JETTY.x, JETTY.z0) > 0.5, 'it starts on the sand bank');
  assert.ok(heightAt(JETTY.x, JETTY.z1) < -1.5, 'it ends over the deeper channel');
  for (let z = JETTY.z0; z > JETTY.z1 - 0.5; z -= 0.25) assert.equal(deckAt(JETTY.x, z), JETTY.y, `deck at z=${z.toFixed(2)}`);
  assert.equal(deckAt(JETTY.x + 3, JETTY.z0 - 5), null, 'no deck beside the jetty');
  // The step from the bank onto the deck is small enough for the walker (rise limit about 0.35 m).
  assert.ok(JETTY.y - heightAt(JETTY.x, JETTY.z0 + 0.4) < 0.35);
});

test('a cast off the end of the jetty is the jetty spot; other casts keep their own spots', () => {
  const { spotAt } = seagrass.fishing;
  assert.equal(spotAt(JETTY.x, JETTY.z1, JETTY.x, JETTY.z1 - 12), 'jetty');
  assert.equal(spotAt(JETTY.x, JETTY.z1, JETTY.x + 6, JETTY.z1 - 4), 'jetty');
  assert.ok(SPOT_INFO.jetty);
  const sx = seagrass.land.spawn.x, sz = seagrass.land.spawn.z;
  assert.notEqual(spotAt(sx, sz, sx, sz - 12), 'jetty');            // casting from the bank over the flats
  assert.equal(spotAt(-60, 30, -60, 34), 'mangrove');               // the muddy left edge
  const c = chanZ(-5);
  assert.equal(spotAt(-5, c + 10, -5, c), 'channel');
});

test('the spawn is on dry sand near the jetty base, the mangrove edge is on the left only, and the lakeshore is a believable shape', () => {
  const L = seagrass.land.spawn;
  assert.ok(heightAt(L.x, L.z) > 0.5, 'spawn is dry');
  assert.ok(Math.abs(L.x - JETTY.x) < 12 && L.z > JETTY.z0 - 2);
  const mangroveRule = seagrass.coral.find(r => r[0] === 'mangrove')[2];
  assert.equal(mangroveRule(40, shoreZ(40)), 0, 'no mangroves on the right');
  assert.equal(mangroveRule(-45, shoreZ(-45) - 9), 1, 'mangroves on the muddy left edge');
  assert.ok(seagrass.speciesInfo.every(s => !/dugong|turtle/i.test(s.id)), 'no Moreton Bay species left');
  assert.ok(seagrass.speciesInfo.some(s => s.id === 'yellowfinbream'));
});
