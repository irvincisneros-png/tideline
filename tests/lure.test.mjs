import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STYLES, styleOf, LureInterest, MoveReader, TUNING, TAP_MAX } from '../src/fishing/lure.js';
import { SPECIES } from '../src/fishing/species.js';

const DT = 1 / 60;
/** Run a cadence (a function of time returning 'reel' | 'twitch' | 'pause' per frame) for up to `secs`; returns the verdict and when. */
function run(style, cadence, secs = 20) {
  const L = new LureInterest(style);
  for (let t = 0; t < secs; t += DT) { const v = L.step(DT, cadence(t)); if (v) return { verdict: v, t, L }; }
  return { verdict: null, t: secs, L };
}
// Cadences a student can describe in a sentence.
const twitchPause = t => (t % 1.6 < DT ? 'twitch' : 'pause');                                       // twitch, pause 1.6 s, twitch...
const holdReel = () => 'reel';
const slowRoll = t => (t % 1.5 < 0.4 ? 'reel' : 'pause');                                           // reel 0.4 s, sink 1.1 s
const hop = t => { const p = t % 2.3; return p < DT || (p >= 0.3 && p < 0.3 + DT) ? 'twitch' : 'pause'; };   // twitch twitch, sink 2 s
const stillness = () => 'pause';

test('every species resolves to a known lure style', () => {
  for (const s of SPECIES) assert.ok(STYLES[styleOf(s.id)], `${s.id} -> ${styleOf(s.id)}`);
  assert.equal(styleOf('squid'), 'hop'); assert.equal(styleOf('tailor'), 'fastroll'); assert.equal(styleOf('duskyflathead'), 'twitchpause'); assert.equal(styleOf('snapper'), 'slowroll');
  for (const s of SPECIES) if (s.lure) assert.ok(STYLES[s.lure], `${s.id} lure style ${s.lure}`);
});

test('the right cadence brings a strike within a few seconds, for every style', () => {
  const right = { fastroll: holdReel, slowroll: slowRoll, twitchpause: twitchPause, hop };
  for (const [style, cad] of Object.entries(right)) {
    const r = run(style, cad);
    assert.equal(r.verdict, 'strike', `${style}: ${r.verdict} (interest ${r.L.interest.toFixed(2)}, match ${r.L.match.toFixed(2)})`);
    assert.ok(r.t > 2 && r.t < 12, `${style} strikes after ${r.t.toFixed(1)} s`);
    const S = STYLES[style]; assert.ok(S.strikeOn === 'reel' ? cad(r.t) === 'reel' : cad(r.t) !== 'reel', `${style} strikes on ${S.strikeOn}`);
  }
});

test('the wrong cadence spooks the fish instead, and never strikes', () => {
  const wrong = { fastroll: stillness, twitchpause: holdReel, hop: holdReel, slowroll: holdReel };
  for (const [style, cad] of Object.entries(wrong)) {
    const r = run(style, cad);
    assert.equal(r.verdict, 'spook', `${style} on a wrong cadence: ${r.verdict}`);
    assert.ok(r.t > TUNING.graceWindow, `${style}: a grace period before the mismatch counts (${r.t.toFixed(1)} s)`);
  }
});

test('interest is a gradient: a short mistake costs some interest but not the fish', () => {
  const L = new LureInterest('twitchpause');
  for (let t = 0; t < 3; t += DT) L.step(DT, twitchPause(t));
  const before = L.interest; assert.ok(before > 0.2 && before < 1, `interest built up (${before.toFixed(2)})`);
  for (let t = 0; t < 1.2; t += DT) L.step(DT, 'reel');   // one wrong second of winding
  assert.ok(L.interest < before && L.interest > TUNING.spookAt, `dipped to ${L.interest.toFixed(2)} without spooking`);
  assert.equal(L.verdict, null);
});

test('MoveReader: a short press is a twitch on release, a long press reels, nothing is a pause', () => {
  const m = new MoveReader(), got = [];
  for (let i = 0; i < 6; i++) got.push(m.read(true, 0.03));   // 0.18 s held: still a tap
  got.push(m.read(false, DT));
  assert.ok(got.slice(0, 6).every(x => x === 'pause') && got[6] === 'twitch', got.join());
  const m2 = new MoveReader(); let reels = 0;
  for (let t = 0; t < 1; t += DT) if (m2.read(true, DT) === 'reel') reels++;
  assert.ok(reels > (1 - TAP_MAX) / DT - 2, `reeling once held past ${TAP_MAX} s (${reels} frames)`);
  assert.equal(m2.read(false, DT), 'pause', 'releasing a long hold is not a twitch');
});
