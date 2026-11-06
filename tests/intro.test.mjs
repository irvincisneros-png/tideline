// The teachers' opening (ui/intro.js, ui/introText.js, fishing/tutorial.js, content/teachers.js): who sees it, where a reload resumes, that every write is idempotent, the tutorial fish,
// Mr Wilson's switch, the honest key and the Keep tap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateProgress } from '../src/core/save.js';
import { introDue, resumeStep, introStep, setStep, markTeachersMet, finishIntro, clearBareTutorialEntry, bevCallDue, markBevCall, bevLines, lockReason, onlyTutorial, hasTutorialRow, STEPS } from '../src/ui/intro.js';
import { beatLines, resolveLine, teacherLine, fill } from '../src/ui/introText.js';
import { INTRO, INTRO_HINTS, BEV_CALL, TUTORIAL_FISH, WILSON_OK } from '../src/content/teachers.js';
import { tutorialCatch, tutorialWait, TUTORIAL_BITE_S } from '../src/fishing/tutorial.js';
import { NPCS, teacherNpcs, NPC_ORDER } from '../src/content/npcs.js';
import { AWARDS, awardsFor } from '../src/content/ceremony.js';
import { SPECIES_BY_ID } from '../src/fishing/species.js';
import { RULES, judge, FIGHT } from '../src/fishing/catches.js';
import * as G from '../src/fishing/guide.js';
import { CatchFlow } from '../src/ui/catchFlow.js';
import { CatchBar, PROFILES, TUTORIAL_FLOOR } from '../src/fishing/catchbar.js';
import { ensureMissionState } from '../src/npc/missions.js';

const fresh = () => migrateProgress({});
const q = s => new URLSearchParams(s);
const row = o => ({ eco: 'seagrass', id: 'tailor', length: 31, kept: false, time: 1, spot: 'jetty', ...o });
/** A save part-way through the opening: the tutorial bream is in the Fish Guide, optionally with the logbook row. */
function partway(step, { withRow = false } = {}) {
  const p = fresh(); p.intro.step = step;
  G.recordCatch(p, TUTORIAL_FISH.id, { length: 23 });
  if (withRow) p.catches.push(row({ id: TUTORIAL_FISH.id, length: 23, tutorial: true }));
  return p;
}

// ---------------------------------------------------------------- who sees the opening
test('introDue: the truth table (?play, ?intro, ?firstrun, catches, Fish Guide, step)', () => {
  const none = q('');
  assert.equal(introDue(fresh(), none), true, 'a new save on the title screen');
  assert.equal(introDue(fresh(), q('play=1')), false, '?play=1 alone skips it');
  assert.equal(introDue(fresh(), q('play=1&intro=1')), true, '?intro=1 shows it despite ?play');
  assert.equal(introDue(fresh(), q('play=1&firstrun=1')), true, '?firstrun=1 is an alias');
  assert.equal(introDue(fresh(), q('intro=1')), true);
  assert.equal(introDue(fresh(), q('eco=rocky&play=1')), false);
  // any catch or Fish Guide entry: never
  const caught = fresh(); caught.catches.push(row());
  assert.equal(introDue(caught, none), false); assert.equal(introDue(caught, q('play=1&intro=1')), false, 'a catch beats ?intro');
  const guided = fresh(); G.markSeen(guided, 'tailor', 'gossip');
  assert.equal(introDue(guided, none), false, 'a Fish Guide entry beats it');
  // done: never, even with ?intro=1 on a new-looking save
  const done = fresh(); done.intro.step = 'done';
  assert.equal(introDue(done, none), false); assert.equal(introDue(done, q('play=1&intro=1')), false);
  // an old save (migrated with catches) is 'done' and never sees it
  const old = migrateProgress({ v: 4, catches: [row()], guide: { nextN: 2, e: { tailor: { seen: { t: 1, src: 'caught' }, caught: { t: 1, n: 1, count: 1 } } } } });
  assert.equal(old.intro.step, 'done'); assert.equal(introDue(old, none), false);
  // part-way through: due again (so a reload resumes), but only while nothing but the tutorial fish exists
  for (const s of ['cast', 'fight', 'flow', 'send']) {
    assert.equal(introDue(partway(s), none), true, `${s}: resumes`);
    assert.equal(introDue(partway(s, { withRow: true }), q('play=1&intro=1')), true, `${s}: resumes with the row, ?intro=1`);
    assert.equal(introDue(partway(s), q('play=1')), false, `${s}: ?play=1 alone does not resume`);
  }
  const real = partway('send', { withRow: true }); real.catches.push(row());
  assert.equal(introDue(real, none), false, 'a real catch ends the resume');
  const other = partway('cast'); G.markSeen(other, 'tailor', 'gossip');
  assert.equal(introDue(other, none), false, 'another Fish Guide entry ends the resume');
  assert.equal(introDue({ ...fresh(), intro: { step: 'nonsense' } }, none), true, 'an unknown step is a new save');
});

test('the resume map: a fight cannot be resumed, the flow resumes at the send-off once the row exists', () => {
  assert.deepEqual(STEPS, ['meet', 'cast', 'fight', 'flow', 'send', 'done']);
  const r = (step, withRow) => resumeStep(step === 'meet' ? Object.assign(fresh(), { intro: { step } }) : partway(step, { withRow }));
  assert.equal(r('meet'), 'meet'); assert.equal(r('cast'), 'cast'); assert.equal(r('fight'), 'cast');
  assert.equal(r('flow', false), 'cast', 'no row: back to the cast'); assert.equal(r('flow', true), 'send', 'row written: on to the send-off');
  assert.equal(r('send', true), 'send');
  assert.equal(resumeStep({ intro: { step: 'done' } }), 'done');
  assert.equal(introStep({}), 'meet'); assert.equal(introStep({ intro: { step: 7 } }), 'meet');
  assert.ok(onlyTutorial(partway('flow', { withRow: true })) && hasTutorialRow(partway('flow', { withRow: true })) && !hasTutorialRow(partway('flow')));
});

// ---------------------------------------------------------------- idempotent writes
test('every write of the opening is idempotent', () => {
  const p = fresh();
  const snap = () => JSON.stringify({ intro: p.intro, met: p.npc.met, tips: p.tips, missions: p.missions, have: p.inventory.have, coins: p.coins });
  setStep(p, 'cast'); setStep(p, 'cast'); assert.equal(p.intro.step, 'cast');
  markTeachersMet(p); const a = snap(); markTeachersMet(p); assert.equal(snap(), a, 'met twice is the same');
  assert.ok(p.npc.met.mrcisneros && p.npc.met.mrwilson);
  finishIntro(p, 1000); const b = snap(); finishIntro(p, 2000); assert.equal(snap(), b, 'finishing twice is the same (doneAt stays)');
  assert.equal(p.intro.step, 'done'); assert.equal(p.intro.bev, 'due'); assert.equal(p.missions.cur, 'first-lines', 'Mission 1 is current');
  setStep(p, 'cast'); assert.equal(p.intro.step, 'done', 'done never goes back');
  // grants: no coins, no items from the opening itself
  assert.equal(p.coins, fresh().coins); assert.deepEqual(p.inventory.have, fresh().inventory.have);
  // Bev's call: due once, then told
  assert.equal(bevCallDue(p), true); markBevCall(p); markBevCall(p); assert.equal(bevCallDue(p), false); assert.equal(p.intro.bev, 'told'); assert.equal(p.tips.bevTiers, true);
  finishIntro(p); assert.equal(p.intro.bev, 'told', 'finishing again does not re-arm the call');
  // a save that never ran the opening never gets Bev's call
  assert.equal(bevCallDue(fresh()), false); const old = migrateProgress({ v: 4, catches: [row()] }); assert.equal(bevCallDue(old), false);
  // the bare tutorial guide entry (landed, then reloaded before the key) is cleared once; a keyed one stays
  const bare = partway('cast'); assert.equal(clearBareTutorialEntry(bare), true); assert.deepEqual(bare.guide.e, {}); assert.equal(bare.guide.nextN, 1); assert.equal(clearBareTutorialEntry(bare), false);
  const keyed = partway('cast'); G.recordKey(keyed, TUTORIAL_FISH.id, TUTORIAL_FISH.id, 'catch', { assisted: false });
  assert.equal(clearBareTutorialEntry(keyed), false); assert.ok(keyed.guide.e.yellowfinbream.ident);
  const withRows = partway('send', { withRow: true }); assert.equal(clearBareTutorialEntry(withRows), false);
  // a repair: intro with a missing object is rebuilt, not thrown on
  const odd = fresh(); odd.intro = null; setStep(odd, 'cast'); assert.equal(odd.intro.step, 'cast'); ensureMissionState(odd);
});

// ---------------------------------------------------------------- the tutorial fish
test('the tutorial fish: yellowfin bream, 22 to 24 cm, inside the species range and under the legal length', () => {
  const sp = SPECIES_BY_ID[TUTORIAL_FISH.id];
  assert.equal(TUTORIAL_FISH.id, 'yellowfinbream'); assert.equal(TUTORIAL_FISH.lo, 22); assert.equal(TUTORIAL_FISH.hi, 24);
  assert.ok(TUTORIAL_FISH.lo >= sp.length[0] && TUTORIAL_FISH.hi <= sp.length[1], 'inside the species range');
  assert.ok(TUTORIAL_FISH.hi < RULES.yellowfinbream.min && RULES.yellowfinbream.min === 25, 'under the 25 cm legal length');
  assert.equal(FIGHT.yellowfinbream.profile, 'twitch', 'a twitch fight: it cannot snag you');
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const c = tutorialCatch(); seen.add(c.length);
    assert.ok(Number.isInteger(c.length) && c.length >= 22 && c.length <= 24 && c.tutorial === true && c.id === 'yellowfinbream' && c.gear === 1);
    assert.equal(judge(c.id, c.length, 0, 0, { month: 5 }).kind, 'undersize', 'always undersize, so Keep is never legal');
  }
  assert.deepEqual([...seen].sort(), [22, 23, 24], 'random in the band');
  for (const r of [0, 0.3333, 0.34, 0.6666, 0.67, 0.9999]) assert.ok([22, 23, 24].includes(tutorialCatch(() => r).length));
  assert.equal(tutorialCatch(() => 0).length, 22); assert.equal(tutorialCatch(() => 0.99999).length, 24);
  for (const r of [0, 0.5, 0.999]) assert.ok(tutorialWait(() => r) <= 4 && tutorialWait(() => r) >= TUTORIAL_BITE_S[0], 'the bite is inside 4 s');
});

test('the tutorial fight cannot be lost: a floor under the catch meter, and a fish left alone tires on its own', () => {
  const mk = tutorial => {
    const bar = Object.create(CatchBar.prototype);
    Object.assign(bar, { active: true, tutorial, profile: 'twitch', power: 0.45, q: 1, zoneH: 0.17, jitter: 0, k: 1, drainMul: 1, turnTime: 0.7, save: 0, zy: 0.1, zv: 0, jt: 9, fy: 0.9, fv: 0, meter: 0.3, time: 0, warn: false, squeeze: false, inZone: false, activity: 0, litter: null, litterT: 1e9, el: { classList: { toggle() {} } }, render() {}, hint() {}, updateLitter() {}, finish(r) { this.res = r; this.active = false; } });
    bar.s = {}; PROFILES.twitch.init(bar.s, bar); bar.s.cx = 0.9; bar.s.drift = 1e9; bar.s.t = 1e9;   // the fish sits at the top; the zone is never lifted
    return bar;
  };
  assert.ok(TUTORIAL_FLOOR > 0 && TUTORIAL_FLOOR < 1);
  const ordinary = mk(false); for (let i = 0; i < 60 * 40 && ordinary.active; i++) ordinary.update(1 / 60, false);
  assert.deepEqual(ordinary.res, { won: false, reason: 'empty' }, 'an ordinary fight left alone is lost');
  const tut = mk(true); let lowest = 1;
  for (let i = 0; i < 60 * 12; i++) { tut.update(1 / 60, false); lowest = Math.min(lowest, tut.meter); }
  assert.ok(tut.active && !tut.res, '12 s of doing nothing does not lose it');
  assert.ok(lowest >= TUTORIAL_FLOOR - 1e-9, `the meter never fell below the floor (${lowest})`);
  for (let i = 0; i < 60 * 90 && tut.active; i++) tut.update(1 / 60, false);
  assert.deepEqual(tut.res, { won: true }, 'and a fish left alone for long enough tires and is landed (no stuck fight)');
});

// ---------------------------------------------------------------- Mr Wilson's switch
test('WILSON_OK false removes Mr Wilson from the NPCs, the cast lists and every line (Mr Cisneros says them)', () => {
  assert.equal(WILSON_OK, true, 'the owner asked for Mr Wilson');
  assert.ok(NPCS.mrcisneros && NPCS.mrwilson, 'both teachers exist while the switch is on');
  const off = teacherNpcs(false);
  assert.ok(off.mrcisneros && !('mrwilson' in off), 'no Mr Wilson with the switch off');
  assert.deepEqual(Object.keys(teacherNpcs(true)), ['mrcisneros', 'mrwilson']);
  assert.ok(awardsFor(true).some(a => a.npc === 'mrwilson') && awardsFor(true).some(a => a.npc === 'mrcisneros'));
  assert.ok(!awardsFor(false).some(a => a.npc === 'mrwilson') && awardsFor(false).some(a => a.npc === 'mrcisneros'), 'no award line for him');
  assert.deepEqual(AWARDS.map(a => a.npc).sort(), Object.keys(NPCS).sort(), 'the cast is everyone who exists');
  for (const beat of ['meet', 'send']) {
    const on = beatLines(beat, true), offLines = beatLines(beat, false);
    assert.equal(on.length, offLines.length, `${beat}: same number of lines`);
    assert.ok(offLines.every(l => l.who === 'mrcisneros' && l.text.length > 5), `${beat}: every line is Mr Cisneros's`);
    assert.ok(!JSON.stringify(offLines).includes('mrwilson') && !/Mr Wilson/.test(JSON.stringify(offLines)), `${beat}: nobody is named Mr Wilson`);
    assert.ok(on.some(l => l.who === 'mrwilson'), `${beat}: with him on, he speaks`);
  }
  assert.equal(resolveLine({ who: 'mrwilson', text: 'a', alt: 'b' }, false).text, 'b'); assert.equal(resolveLine({ who: 'mrwilson', text: 'a' }, false).text, 'a');
  assert.match(teacherLine(INTRO.tips.measure, {}, false), /Mr Cisneros/); assert.match(teacherLine(INTRO.tips.measure, {}, true), /Mr Wilson/);
});

// ---------------------------------------------------------------- the words
test('the opening\'s lines: short, kind, no selling and no First Nations content', () => {
  const all = [...INTRO.meet, ...INTRO.send, INTRO.tips.measure, INTRO.tips.decide, INTRO.tips.release];
  const sentences = t => (t.match(/[.!?]+[”"]?(\s|$)/g) ?? []).length;
  for (const l of all) {
    assert.ok(['mrcisneros', 'mrwilson'].includes(l.who));
    assert.ok(sentences(l.text) <= 2, `two sentences at most: ${l.text}`);
    if (l.alt) assert.ok(sentences(l.alt) <= 2, l.alt);
  }
  const text = JSON.stringify([INTRO, INTRO_HINTS, BEV_CALL]);
  assert.doesNotMatch(text, /Dharawal|Aboriginal|First Nations|Indigenous|Dreaming|Sea Country|Elder|ancestor/i);
  assert.doesNotMatch(text, /\$\d|\bprice|\bbuy(ing)? (a )?fish/i, 'no prices and no trade in fish');
  assert.match(INTRO.send[2].text, /can.t sell your catch/); assert.match(INTRO.send[0].text, /Mission 1/); assert.match(INTRO.send[1].text, /radio/); assert.match(INTRO.send[3].text, /credits/i);
  assert.match(INTRO.meet[0].text, /Illawarra Fish Guide/); assert.match(INTRO.meet[2].text, /knot/); assert.match(INTRO.meet[2].text, /Mission 2/);
  assert.match(INTRO.meet[1].text, /rod/); assert.match(INTRO.meet[1].text, /measuring board/);
  assert.equal(fill('{min} cm, {cm} cm, {x}', { min: 25, cm: 23 }), '25 cm, 23 cm, {x}');
  assert.match(BEV_CALL[1], /Seen/); assert.match(BEV_CALL[1], /Mastered/);
  assert.equal(bevLines('Kai')[0].text.includes('Kai') || !BEV_CALL[0].includes('{name}'), true);
  for (const k of Object.keys(INTRO_HINTS)) assert.ok(INTRO_HINTS[k].length > 10 && INTRO_HINTS[k].length < 90, `hint ${k} is one short line`);
});

test('the two teachers are well-formed people with original looks and short idle talk', () => {
  for (const id of ['mrcisneros', 'mrwilson']) {
    const d = NPCS[id];
    assert.equal(d.teacher, true); assert.deepEqual(d.trades, []); assert.deepEqual(d.topics, []);
    assert.equal(d.intro.length >= 1, true); assert.equal(d.greet.length, 3, `${id}: three idle lines`); assert.ok(d.greet.some(g => g.includes('{name}')));
    assert.ok(d.tips.length >= 3); assert.ok(d.react.cheer.length >= 1 && d.react.first.length >= 1 && d.react.illegal.undersize);
    assert.ok(d.sites.seagrass && !d.sites.rocky, `${id} is at the lake`);
    for (const t of ['dawn', 'day', 'dusk', 'night']) assert.equal(d.sites.seagrass[t].act, 'standing');
  }
  assert.equal(NPCS.mrcisneros.look.skin, 0xb98560); assert.equal(NPCS.mrcisneros.look.shirt, 0x1f2a44); assert.equal(NPCS.mrcisneros.look.pattern, 'fishing'); assert.equal(NPCS.mrcisneros.look.hairStyle, 'short');
  assert.equal(NPCS.mrwilson.look.beard, 'big'); assert.equal(NPCS.mrwilson.look.hairStyle, 'long'); assert.equal(NPCS.mrwilson.look.sunnies, 'sport'); assert.equal(NPCS.mrwilson.scale, 1.08);
  assert.ok(!NPC_ORDER.includes('mrcisneros'), 'the teachers are not part of the coast list (their colours are their own)');
});

// ---------------------------------------------------------------- the gates
test('lockReason: R, T, M, H and E are refused while the opening runs; everything is free after', () => {
  const live = { step: 'cast', rodOut: false, nearRing: false };
  assert.equal(lockReason('KeyR', live), 'rodFar'); assert.equal(lockReason('KeyR', { ...live, nearRing: true }), null, 'rod out at the ring');
  assert.equal(lockReason('KeyR', { ...live, nearRing: true, rodOut: true }), 'rod', 'but not away again');
  assert.equal(lockReason('KeyT', live), 'tackle'); assert.equal(lockReason('KeyM', live), 'map'); assert.equal(lockReason('KeyH', live), 'home'); assert.equal(lockReason('KeyE', live), 'talk');
  assert.equal(lockReason('KeyJ', live), null); assert.equal(lockReason('KeyQ', live), null);
  for (const step of ['fight', 'flow', 'send', 'meet']) assert.equal(lockReason('KeyH', { ...live, step }), 'home', step);
  for (const k of ['KeyR', 'KeyT', 'KeyM', 'KeyH', 'KeyE']) assert.equal(lockReason(k, { ...live, step: 'done' }), null, `${k} after done`);
  for (const k of ['rodFar', 'rod', 'tackle', 'map', 'home', 'talk']) assert.ok(INTRO_HINTS[k], `a hint for ${k}`);
});

// ---------------------------------------------------------------- honest tutorial: Mastery, assisted, the Keep tap
/** What the catch flow does for one fish, by the same guide calls (ui/catchFlow.js stepKey, stepMeasure, record). */
function runFish(p, { assisted = false, keep = false, length = 23 } = {}) {
  const id = TUTORIAL_FISH.id, v = judge(id, length, 0, 0, { month: 5 });
  G.recordCatch(p, id, { length });
  G.recordKey(p, id, id, 'catch', { assisted });
  G.recordMeasure(p, id, true);
  G.recordDecision(p, id, keep ? v.legal : true, G.masteryDecision(keep, v.legal));
  return G.tierOf(p, id);
}
test('an unaided key on the tutorial fish plus the right release is a real Mastered entry; help still blocks it', () => {
  assert.equal(runFish(fresh()), 'mastered', 'unaided key, accurate measure, correct release of an undersize fish');
  assert.notEqual(runFish(fresh(), { assisted: true }), 'mastered', 'a helped key is identified but not mastered');
  assert.equal(G.isAssisted(fresh(), TUTORIAL_FISH.id), false);
  const helped = fresh(); runFish(helped, { assisted: true }); assert.equal(G.isAssisted(helped, TUTORIAL_FISH.id), true);
  assert.equal(G.masteryDecision(false, false), true, 'releasing an undersize fish counts'); assert.equal(G.masteryDecision(true, false), false, 'keeping it never does');
});

test('the catch flow: Keep on the tutorial bream shows the rule and writes nothing; Release writes one tutorial row and the fish is Mastered', () => {
  const p = fresh(), id = TUTORIAL_FISH.id, html = [];
  const el = { onclick: null, focus() {}, addEventListener() {}, scrollTop: 0 };
  const game = {
    progress: p, eco: { id: 'seagrass' }, audio: { play() {} }, toasts: [], persist() {}, updateStats() {}, earned() {}, toast(t) { this.toasts.push(t); }, gearStats: () => ({}), pendingCeremony: () => null,
    panels: { body: { set innerHTML(v) { html.push(v); }, get innerHTML() { return html.at(-1); }, querySelector: () => el }, modal: { querySelector: () => el }, open() {}, close() {} },
    npcs: { reacted: 0, onCatch() { this.reacted++; } },
  };
  const f = new CatchFlow(game);
  const landed = { ...tutorialCatch(() => 0.5), ctx: { rig: 'runningsinker', bait: 'prawn' } };
  assert.equal(landed.length, 23);
  // run() would open the panel and the key; do its bookkeeping by hand
  f.c = landed; f.id = id; f.sp = SPECIES_BY_ID[id]; f.spot = 'flats'; f.tut = true; f.tierBefore = G.tierOf(p, id); f.pb = null; f.done = () => {};
  G.recordCatch(p, id, { length: 23 }); f.entry = G.entryOf(p, id);
  G.recordKey(p, id, id, 'catch', { assisted: false }); f.measured = 23; f.accurate = true; G.recordMeasure(p, id, true);
  // 1. Keep
  f.commit(true);
  assert.match(html.at(-1), /Have another look at that board/); assert.match(html.at(-1), /25 cm/); assert.match(html.at(-1), /Back to the board/);
  assert.equal(p.catches.length, 0, 'no logbook row'); assert.equal(p.esky.length, 0, 'nothing in the esky'); assert.equal(p.steward.fines, 0, 'no fine');
  assert.equal(game.npcs.reacted, 0, 'nobody reacts to it'); assert.deepEqual(p.stock, {}, 'no stock change');
  assert.equal(G.tierOf(p, id), 'identified', 'the keep did not count toward anything');
  assert.ok(!p.guide.e[id].dec, 'no decision recorded');
  // back to the choice, and Keep again does the same
  f.stepDecide(); assert.match(html.at(-1), /Keep it or release it/); assert.match(html.at(-1), /Mr Wilson/); assert.match(html.at(-1), /must be 25 cm/);
  f.commit(true); assert.equal(p.catches.length, 0);
  // 2. Release
  f.stepDecide(); f.commit(false);
  assert.match(html.at(-1), /Right call/);
  f.record({ wet: true, air: 4.2, tagged: false, weighted: false, net: false });
  assert.equal(p.catches.length, 1); const r = p.catches[0];
  assert.equal(r.tutorial, true); assert.equal(r.kept, false); assert.equal(r.legal, false); assert.equal(r.kind, 'undersize'); assert.equal(r.wet, true); assert.equal(r.accurate, true); assert.equal(r.id, id); assert.equal(r.length, 23);
  assert.equal(p.esky.length, 0);
  assert.equal(G.tierOf(p, id), 'mastered', 'the first Mastered entry');
  // an ordinary fish is never marked tutorial
  const g2 = new CatchFlow(game); g2.c = { id: 'tailor', length: 31, ctx: {} }; assert.equal(!!g2.c.tutorial, false);
});
