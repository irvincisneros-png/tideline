import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

const FIELDS = ['id', 'common', 'sci', 'group', 'feeding', 'trophic', 'size', 'depth', 'status', 'statusCode', 'role', 'interactions', 'didYouKnow', 'fieldNotes', 'spot', 'threats', 'sources'];
// Species cards only: npcs.js, items.js and quiz.js are the coast's people, rewards and worksheet quiz (tests/npc.test.mjs); shop.js is the economy data (tests/economy.test.mjs).
const files = readdirSync(new URL('../src/content/', import.meta.url)).filter(f => f.endsWith('.js') && !['npcs.js', 'items.js', 'quiz.js', 'shop.js', 'cards.js'].includes(f));

for (const f of files) {
  test(`content ${f}: every species card is complete`, async () => {
    const { species } = await import(`../src/content/${f}`);
    const ids = new Set();
    for (const s of species) {
      for (const k of FIELDS) assert.ok(s[k] !== undefined && s[k] !== '', `${f} ${s.id} missing ${k}`);
      assert.ok(['LC', 'NT', 'VU', 'EN', 'CR', 'DD', 'NE', 'EW', 'EX'].includes(s.statusCode), `${s.id} status code`);
      assert.ok(!ids.has(s.id), `duplicate ${s.id}`); ids.add(s.id);
      assert.ok(s.sources.length > 0);
    }
  });
}
