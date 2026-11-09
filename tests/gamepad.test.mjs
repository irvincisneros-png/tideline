// Controller support (core/gamepad.js): the pure parts. Button names per family, keyboard hints rewritten for a pad, stick dead zone, and the focus move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { familyOf, layout, buttonName, padLabel, axis, pickInDirection, B } from '../src/core/gamepad.js';

test('pads are told apart by their id string', () => {
  assert.equal(familyOf('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'), 'nintendo');
  assert.equal(familyOf('DualSense Wireless Controller (Vendor: 054c)'), 'playstation');
  assert.equal(familyOf('Xbox Wireless Controller'), 'xbox');
  assert.equal(familyOf(''), 'xbox');
});
test('confirm is the button that family calls A (or ✕); it and back are never the same button', () => {
  assert.equal(buttonName('xbox', 'ok'), 'A'); assert.equal(layout('xbox').ok, 'south');
  assert.equal(buttonName('nintendo', 'ok'), 'A'); assert.equal(layout('nintendo').ok, 'east');
  assert.equal(buttonName('playstation', 'ok'), '✕');
  for (const f of ['xbox', 'nintendo', 'playstation']) { const L = layout(f); assert.notEqual(L.ok, L.back); assert.equal(new Set(Object.values(L)).size, Object.values(L).length, `${f}: one action per button`); for (const pos of Object.values(L)) assert.ok(pos in B, `${f}: ${pos} is a real button`); }
});
test('keyboard hints become button names', () => {
  assert.equal(padLabel('Hold <kbd>Space</kbd> to wind up a cast', 'xbox'), 'Hold <kbd class="pad">A</kbd> to wind up a cast');
  assert.equal(padLabel('Press <kbd>E</kbd> to talk to Mitra', 'nintendo'), 'Press <kbd class="pad">A</kbd> to talk to Mitra');
  assert.equal(padLabel('<span><kbd>R</kbd> Rod</span><span><kbd>Esc</kbd> Menu</span>', 'nintendo'), '<span><kbd class="pad">Y</kbd> Rod</span><span><kbd class="pad">+</kbd> Menu</span>');
  assert.equal(padLabel('<kbd>WASD</kbd> Move', 'xbox'), '<kbd>L stick</kbd> Move');
  assert.match(padLabel('Press T for your tackle box.', 'xbox'), /Press Y for/);
  assert.equal(padLabel('', 'xbox'), '');
});
test('a stick at rest reads zero and full tilt reads one', () => {
  assert.equal(axis(0.1), 0); assert.equal(axis(-0.2), 0);
  assert.ok(Math.abs(axis(1) - 1) < 1e-9); assert.ok(Math.abs(axis(-1) + 1) < 1e-9);
  assert.ok(axis(0.5) > 0 && axis(0.5) < 0.5);
});
test('the focus moves to the nearest thing in that direction, preferring what is straight ahead', () => {
  // a 2 x 3 grid of tiles, 100 wide, 60 high
  const tiles = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) tiles.push({ x: c * 110, y: r * 70, w: 100, h: 60 });
  const from = tiles[1], others = tiles.filter(t => t !== from), at = i => tiles.indexOf(others[i]);
  assert.equal(at(pickInDirection(from, others, 1, 0)), 2);
  assert.equal(at(pickInDirection(from, others, -1, 0)), 0);
  assert.equal(at(pickInDirection(from, others, 0, 1)), 4);
  assert.equal(pickInDirection(from, others, 0, -1), -1, 'nothing above the top row');
  // a wide button below the grid is reached from any column
  const wide = { x: 0, y: 200, w: 320, h: 40 };
  assert.equal(pickInDirection(tiles[5], [...tiles.slice(0, 5), wide], 0, 1), 5);
});
