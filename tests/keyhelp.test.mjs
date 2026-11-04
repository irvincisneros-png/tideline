import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, FEATURES } from '../src/fishing/species.js';
import { KEY, FEATURE_DEFS, answerFor, walk, pathTo } from '../src/fishing/key.js';
import { wrongStep, walkthrough, hintFor, whereToLook, trueFeature, REVEAL_AFTER } from '../src/fishing/keyHelp.js';
import * as G from '../src/fishing/guide.js';
import { migrateProgress } from '../src/core/save.js';
import { LOOKS } from '../src/life/looks.js';
import '../src/ecosystems/index.js';
import '../src/fishing/catches.js';

const fresh = () => ({ journal: {}, catches: [], stock: {}, steward: { points: 0, litter: 0, checks: 0, clean: 0, fines: 0 }, guide: { nextN: 1, e: {} } });
const DEF = Object.fromEntries(FEATURE_DEFS.map(f => [f.id, f]));
const asPath = (sp, answers) => { const out = []; let at = { couplet: KEY.first }; for (const a of answers) { out.push({ n: at.couplet, ans: a }); at = KEY.couplets[at.couplet][a].to; } return out; };
const leavesUnder = to => (to.leaf ? [to.leaf] : [...leavesUnder(KEY.couplets[to.couplet].a.to), ...leavesUnder(KEY.couplets[to.couplet].b.to)]);

test('key consistency: every catchable species, keyed by its own FEATURES, ends at itself, and every couplet sends it into the branch that holds it', () => {
  const seen = new Map();
  for (const s of SPECIES) {
    // follow the key reading each answer straight off the species' FEATURES (not via answerFor), as a careful student would
    let at = { couplet: KEY.first }, steps = 0;
    while (at.couplet) {
      const c = KEY.couplets[at.couplet];
      const a = s.feat[c.feature] === c.value ? 'a' : 'b';
      assert.ok(leavesUnder(c[a].to).includes(s.id), `${s.id}: couplet ${c.n} (${c.feature}=${c.value}) sends it down a branch that does not contain it`);
      at = c[a].to; steps++;
    }
    assert.equal(at.leaf, s.id, `${s.id} ends at ${at.leaf}`);
    assert.equal(steps, KEY.leaves[s.id]);
    seen.set(at.leaf, (seen.get(at.leaf) ?? 0) + 1);
  }
  assert.equal(seen.size, SPECIES.length, 'every species is reachable');
  for (const [id, n] of seen) assert.equal(n, 1, `${id} has one leaf`);
  // each couplet tests a single feature, and both answers have a species behind them (no dead ends)
  for (const c of Object.values(KEY.couplets)) { assert.ok(leavesUnder(c.a.to).length >= 1 && leavesUnder(c.b.to).length >= 1); assert.deepEqual([...leavesUnder(c.a.to), ...leavesUnder(c.b.to)].sort(), [...c.ids].sort()); }
});

test('key wording: every feature value a species uses has the "a" and "b" statements, and the decisive cues are concrete', () => {
  for (const s of SPECIES) for (const f of FEATURE_DEFS) { const v = DEF[f.id].values[s.feat[f.id]]; assert.ok(v?.a && v?.b && v?.name, `${s.id} ${f.id}`); }
  // body shape: a torpedo is plump and a slim fish is thin FOR ITS LENGTH, and the help line says how to tell them apart (sand whiting vs tailor)
  assert.match(DEF.body.values.torpedo.a, /plump/); assert.match(DEF.body.values.slim.a, /thin for its length/);
  assert.match(DEF.body.look, /skinnier than a tailor/);
});

test('sand whiting: long and slim, NOT torpedo-shaped, so couplet 1 (torpedo) is answered "b" and the key still ends at sand whiting', () => {
  const sw = SPECIES.find(s => s.id === 'sandwhiting'), c1 = KEY.couplets[1];
  assert.equal(sw.feat.body, 'slim');
  assert.equal(c1.feature, 'body'); assert.equal(c1.value, 'torpedo');
  assert.equal(answerFor(c1, sw), 'b');
  assert.match(c1.b.detail, /long and slim/, 'the "b" option names the slim bodies it covers');
  assert.equal(walk(KEY, pathTo(KEY, sw)).leaf, 'sandwhiting');
  const w = walkthrough(sw);
  assert.equal(w.leaf, 'sandwhiting'); assert.equal(w.steps[0].ans, 'b'); assert.match(w.steps[0].because, /long and slim|thin for its length/);
  // a student who calls it torpedo-shaped is told, at couplet 1, to compare its thickness
  const wrong = wrongStep(asPath(sw, ['a']), sw);
  assert.equal(wrong.n, 1); assert.equal(wrong.index, 0); assert.match(wrong.text, /thin for its length/);
});

test('the 3D model draws the body shape the key claims (slim thinner than torpedo thinner than deep)', () => {
  const depth = shape => SPECIES.filter(s => s.feat.body === shape).map(s => LOOKS[s.id].depth);
  assert.ok(Math.max(...depth('slim')) <= 0.16 && Math.min(...depth('torpedo')) >= 0.2, 'slim fish are visibly thinner than torpedo fish');
  assert.ok(Math.max(...depth('torpedo')) <= 0.26 && Math.min(...depth('deep')) >= 0.28, 'torpedo fish are visibly thinner than deep-bodied fish');
  assert.ok(Math.min(...SPECIES.filter(s => s.feat.body === 'flattened').map(s => LOOKS[s.id].width)) >= 0.2, 'flattened fish are wider than other bodies');
});

test('wrongStep: flipping any one answer on any species\' right path is caught at exactly that couplet, with a reason grounded in its feature', () => {
  for (const s of SPECIES) {
    const right = pathTo(KEY, s);
    assert.equal(wrongStep(asPath(s, right), s), null, `${s.id}: a right path has no wrong step`);
    right.forEach((a, i) => {
      const flipped = [...right.slice(0, i), a === 'a' ? 'b' : 'a'];
      // keep answering the way this species really looks in the new branch (an honest mistake), so the path ends at some species
      let at = { couplet: KEY.first }; for (const x of flipped) at = KEY.couplets[at.couplet][x].to;
      while (at.couplet) { const c = KEY.couplets[at.couplet], x = answerFor(c, s); flipped.push(x); at = c[x].to; }
      const m = wrongStep(asPath(s, flipped), s);
      assert.ok(m, `${s.id}@${i}`);
      assert.equal(m.index, i); assert.equal(m.chosen, flipped[i]); assert.equal(m.correct, a);
      assert.equal(m.n, asPath(s, right)[i].n);
      assert.ok(m.text.includes(trueFeature(KEY.couplets[m.n], s).statement), `${s.id}: the reason quotes the real feature`);
      assert.ok(!m.text.includes(s.name) && !m.text.includes(s.sci), 'it does not name the fish');
      assert.ok(['side', 'top', 'front'].includes(m.where.view));
    });
  }
});

test('walkthrough: the whole right path, couplet by couplet, each explained, ending at the real species', () => {
  for (const s of SPECIES) {
    const w = walkthrough(s);
    assert.equal(w.leaf, s.id); assert.equal(w.steps.length, KEY.leaves[s.id]);
    assert.deepEqual(w.steps.map(x => x.ans), pathTo(KEY, s));
    w.steps.forEach(x => { assert.ok(x.because.startsWith('On this fish: ') && x.because.includes(trueFeature(KEY.couplets[x.n], s).statement)); assert.ok(x.where.text && x.optionText); });
  }
});

test('hints: level 1 says where to look (no answer), level 2 marks the right option; both snap to a real view', () => {
  for (const c of Object.values(KEY.couplets)) for (const id of c.ids) {
    const s = SPECIES.find(x => x.id === id), h1 = hintFor(c, s, 1), h2 = hintFor(c, s, 2);
    assert.equal(h1.option, undefined); assert.ok(h1.text.startsWith('Hint: Switch to the '));
    assert.equal(h2.option, answerFor(c, s)); assert.equal(h1.view, whereToLook(c, s).view); assert.ok(['side', 'top', 'front'].includes(h2.view));
  }
  assert.equal(REVEAL_AFTER, 2);
});

test('scoring stays honest: a fish named with help is Identified but not Mastered until it is keyed cleanly once; old saves are unaffected', () => {
  const p = fresh();
  G.recordCatch(p, 'tailor', { length: 40 });
  assert.deepEqual(G.helpOf(p, 'tailor'), { hints: 0, misses: 0, reveals: 0 });
  G.recordHelp(p, 'tailor', 'hint'); G.recordHelp(p, 'tailor', 'hint'); G.recordHelp(p, 'tailor', 'miss'); G.recordHelp(p, 'tailor', 'reveal');
  assert.deepEqual(G.helpOf(p, 'tailor'), { hints: 2, misses: 1, reveals: 1 });
  assert.equal(G.recordKey(p, 'tailor', 'tailor', 'catch', { assisted: true }).correct, true);
  assert.equal(G.tierOf(p, 'tailor'), 'identified'); assert.ok(G.isAssisted(p, 'tailor')); assert.equal(G.labelOf(p, 'tailor'), 'Tailor');
  G.recordMeasure(p, 'tailor', true); G.recordDecision(p, 'tailor', true);
  assert.equal(G.tierOf(p, 'tailor'), 'identified', 'measure + decision do not master an assisted identification');
  G.recordKey(p, 'tailor', 'tailor', 'guide', { assisted: true });
  assert.equal(G.tierOf(p, 'tailor'), 'identified', 'another assisted key does not clear it');
  G.recordKey(p, 'tailor', 'seamullet', 'guide');
  assert.ok(G.isAssisted(p, 'tailor'), 'a wrong unassisted key does not clear it');
  G.recordKey(p, 'tailor', 'tailor', 'guide');
  assert.equal(G.tierOf(p, 'tailor'), 'mastered'); assert.ok(!G.isAssisted(p, 'tailor'));
  // clean first time, then an assisted look later: never takes anything away
  G.recordCatch(p, 'snapper', {}); G.recordKey(p, 'snapper', 'snapper'); G.recordKey(p, 'snapper', 'snapper', 'guide', { assisted: true });
  assert.ok(!G.isAssisted(p, 'snapper'));
  // an older save: identified with no assisted/clean/help fields still masters as before
  const q = fresh(); q.guide.e.bonito = { seen: { t: 1 }, caught: { t: 1, n: 1, count: 1 }, ident: true };
  G.recordMeasure(q, 'bonito', true); G.recordDecision(q, 'bonito', true);
  assert.equal(G.tierOf(q, 'bonito'), 'mastered'); assert.deepEqual(G.helpOf(q, 'bonito'), { hints: 0, misses: 0, reveals: 0 });
  q.guide.e.bonito.help = 'junk'; assert.deepEqual(G.helpOf(q, 'bonito'), { hints: 0, misses: 0, reveals: 0 }); G.recordHelp(q, 'bonito', 'hint'); assert.equal(G.helpOf(q, 'bonito').hints, 1);
  // it survives the save migration untouched (entries are copied whole)
  const m = migrateProgress(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(m.guide.e.tailor.help, p.guide.e.tailor.help); assert.equal(G.tierOf(m, 'tailor'), 'mastered');
  const r = fresh(); G.recordCatch(r, 'tailor', {}); G.recordKey(r, 'tailor', 'tailor', 'catch', { assisted: true });
  const m2 = migrateProgress(JSON.parse(JSON.stringify(r))); assert.ok(G.isAssisted(m2, 'tailor'));
});
