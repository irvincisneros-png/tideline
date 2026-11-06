// The teachers' opening, played with real input: a new save at the school's corner on Lake Illawarra, the four opening lines, the glowing ring, a gated walk (R, T, M, H, E and
// walking off all say no), a cast with a bite inside 4 s, a missed strike that replays the bite, the unlosable fight, the key (unaided), the measure, the undersize bream with the
// Keep tap turned back (no illegal row), the wet-handed release (with the tab hidden mid-release), the send-off, Mission 1 on the HUD and Bev's first radio call.
// Also: the whole thing under 4 minutes of game time, a skip at every beat, a reload at every step, the menu path (Start fishing, creator, lake) and the ?play deep link (no opening).
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/intro.mjs [mobile]
// Screenshots: playtest-shots/intro/<desktop|mobile>/  (teachers-clean.png has the HUD hidden)
import { launch } from './harness.mjs';

const mobile = process.argv.includes('mobile'), tag = mobile ? 'mobile' : 'desktop', out = `playtest-shots/intro/${tag}`;
let ok = true;
const check = (c, m) => { if (!c) { ok = false; console.log('FAIL:', m); } else console.log('ok:', m); };
const open = (query = 'play=1&intro=1&quality=low') => launch({ query: query + (mobile ? '&touch=1' : ''), outDir: out, width: 1280, height: 720, mobile });
const errs = [];
const run = n => !process.env.ONLY || process.env.ONLY.split(',').includes(String(n));   // ONLY=3,4 runs just those scenarios

// ------------------------------------------------------------------------------------------------------------ helpers (all real input or what a finger does)
const G = (t, f, a) => t.page.evaluate(f, a);
const wf = (t, f, a, timeout = 20000) => t.page.waitForFunction(f, a, { timeout }).then(() => true).catch(() => false);
const gtime = t => G(t, () => window.__game.time);
const step = t => G(t, () => window.__game.progress.intro?.step);
const dlgText = t => G(t, () => (window.__game.dialogue.isOpen ? document.querySelector('#dialogue .dlg-text')?.innerText : null));
const toasts = t => G(t, () => [...document.querySelectorAll('.toast')].map(e => e.textContent));
/** Click the first button ("Next", "Thanks!" or Continue) of the open dialogue. */
const next = async t => { await t.page.waitForSelector('#dialogue:not(.hidden) button', { timeout: 8000 }); await t.page.click('#dialogue button >> nth=0'); await t.wait(120); };
const pressKey = async (t, key) => { await t.page.keyboard.press(key); await t.wait(220); };
const SX = 22.8;   // the corner sits at x ~ 22.8 (CORNER.start)

async function sayMeet(t) { for (let i = 0; i < 4; i++) await next(t); await wf(t, () => window.__game.progress.intro.step === 'cast'); }
async function toRing(t) {
  await G(t, async () => { const { CORNER } = await import(new URL('src/ecosystems/seagrass.js', location.href).href), g = window.__game, w = g.walker, R = CORNER.ring; w.pos.set(R.x + 0.2, g.world.walkAt(R.x, R.z), R.z + 0.2); w.vel.set(0, 0, 0); g.rig.focus.set(w.pos.x, w.pos.y + 0.9, w.pos.z); });
  await t.wait(500);
}
async function rodOutAndCast(t) {
  await pressKey(t, 'r');
  await t.page.keyboard.down(' '); await t.wait(900); await t.page.keyboard.up(' ');
  return wf(t, () => ['wait', 'bite'].includes(window.__game.fishing.state), null, 8000);
}
/** From the cast: the bite (timed), then strike. Returns seconds from the splash to the bite. */
async function biteAndStrike(t, { miss = false } = {}) {
  await wf(t, () => window.__game.fishing.state === 'wait', null, 8000);
  const t0 = await gtime(t);
  await wf(t, () => window.__game.fishing.state === 'bite', null, 8000);
  const wait1 = (await gtime(t)) - t0;
  if (miss) {
    await wf(t, () => window.__game.fishing.state !== 'bite', null, 4000);
    check((await G(t, () => window.__game.fishing.state)) === 'wait', `${tag}: a missed strike replays the bite (state wait again)`);
    check((await toasts(t)).some(x => /Too slow/.test(x)), `${tag}: the missed strike says what to do`);
    await wf(t, () => window.__game.fishing.state === 'bite', null, 8000);
  }
  await t.page.keyboard.press(' ');
  return wait1;
}
/** Play the catch bar like a hand on a button: hold while the fish is above the zone. Resolves when the fish is landed. */
async function winFight(t) {
  await wf(t, () => window.__game.fishing.bar.active, null, 5000);
  await G(t, () => { const g = window.__game; clearInterval(window.__bot); window.__bot = setInterval(() => { const b = g.fishing.bar; if (b.active) b.held = b.fy - b.zy - 0.3 * b.zv > 0; }, 25); });
  const landed = await wf(t, () => window.__game.fishing.state === 'landed' || window.__game.panels.isOpen, null, 70000);
  await G(t, () => { clearInterval(window.__bot); window.__game.fishing.bar.held = false; });
  return landed;
}
async function doKey(t) {
  await t.page.waitForSelector('.key-grid', { timeout: 15000 });
  const path = await G(t, async () => { const { KEY } = await import(new URL('src/fishing/key.js', location.href).href); const target = 'yellowfinbream'; const go = (at, trail) => { if (at.leaf) return at.leaf === target ? trail : null; for (const a of ['a', 'b']) { const r = go(KEY.couplets[at.couplet][a].to, [...trail, a]); if (r) return r; } return null; }; return go({ couplet: KEY.first }, []); });
  for (const a of path) { await t.page.click(`.opt[data-a="${a}"]`); await t.wait(160); }
  await t.page.click('#key-ok'); await t.wait(300);
}
async function doMeasure(t) {
  await t.page.waitForSelector('#m-lock', { timeout: 8000 }); await t.wait(500);
  const len = await G(t, () => window.__game.catchFlow.c.length);
  for (let i = 0; i < 40; i++) { const v = +(await G(t, () => document.querySelector('#mr').textContent)); if (v === len) break; await t.page.click(v < len ? '#m-plus' : '#m-minus'); }
  await t.page.click('#m-lock'); await t.wait(250);
  await t.page.click('#m-next'); await t.wait(300);
  if (await t.page.$('#pb-ok')) { await t.page.click('#pb-ok'); await t.wait(300); }
  return len;
}
async function doRelease(t, { hide = false } = {}) {
  await t.page.waitForSelector('#rel-hold', { timeout: 8000 });
  await t.page.click('#rel-wet'); await t.wait(200);
  if (hide) {
    // The tab goes hidden for 4 s mid-release (a teacher talking to the class): the air clock must not count it.
    await G(t, () => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await t.wait(4000);
    await G(t, () => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await t.wait(300);
    const air = await G(t, () => parseFloat(document.querySelector('#air-t').textContent));
    check(air < 3.5, `${tag}: the air clock paused while the tab was hidden (${air} s shown after a 4 s hidden gap)`);
  }
  const b = await t.page.locator('#rel-hold').boundingBox();
  await t.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await t.page.mouse.down(); await t.wait(1700); await t.page.mouse.up();
  await t.page.waitForSelector('#r-next', { timeout: 8000 });
}
async function doSend(t) { await t.page.waitForSelector('#dialogue:not(.hidden)', { timeout: 10000 }); for (let i = 0; i < 4; i++) await next(t); }

/** Everything up to and including the key, the measure and the decision. detail: also the gates, the missed strike and the Keep tap. */
async function playToDecide(t, detail, { met = false } = {}) {
  const r = {};
  if (!met) await sayMeet(t);
  const bits = await G(t, () => ({ ring: !!window.__game.intro.ring, goal: document.querySelector('#intro-goal')?.innerText, tut: window.__game.fishing.tutorial }));
  check(bits.ring && /ring/i.test(bits.goal ?? '') && bits.tut, `${tag}: after the opening lines the ring is up and the goal says to walk to it ("${bits.goal}")`);
  if (detail) {
    for (const [key, word, what] of [['r', /ring/i, 'R (rod out) far from the ring'], ['t', /tackle/i, 'T (tackle box)'], ['m', /map/i, 'M (map)'], ['h', /home/i, 'H (head home)'], ['e', /chat/i, 'E (talk)']]) {
      await pressKey(t, key);
      const s = await G(t, () => ({ panel: window.__game.panels.isOpen, rod: window.__game.fishing.active }));
      check(!s.panel && !s.rod && (await toasts(t)).some(x => word.test(x)), `${tag}: ${what} is refused with a one-line hint`);
    }
    await G(t, async () => { const g = window.__game, w = g.walker; w.pos.set(0, g.world.walkAt(0, 60), 60); });
    await t.wait(400);
    const edge = await G(t, () => { const g = window.__game, b = g.intro.bounds; return { x: g.walker.pos.x, xMin: b.xMin, z: g.walker.pos.z, zMax: b.zMax }; });
    check(edge.x >= edge.xMin - 0.01 && edge.z <= edge.zMax + 0.01, `${tag}: walking off is clamped to the corner (x ${edge.x.toFixed(1)} >= ${edge.xMin.toFixed(1)}, z ${edge.z.toFixed(1)} <= ${edge.zMax.toFixed(1)})`);
    await t.shot('gated');
  }
  await toRing(t);
  const goal2 = await G(t, () => document.querySelector('#intro-goal')?.innerText);
  check(/\bR\b|rod/i.test(goal2 ?? ''), `${tag}: at the ring the goal says to take out the rod ("${goal2}")`);
  await t.shot('ring');
  const gotCast = await rodOutAndCast(t);
  check(gotCast, `${tag}: the rod comes out and the cast lands`);
  if (detail) { await pressKey(t, 'r'); check(await G(t, () => window.__game.fishing.active), `${tag}: R will not put the rod away mid-lesson`); }
  const bait0 = await G(t, () => window.__game.progress.shop.bait?.[window.__game.gear.bait] ?? null);
  r.wait = await biteAndStrike(t, { miss: detail });
  check(r.wait <= 4.1, `${tag}: the bite comes within 4 s of the splash (${r.wait.toFixed(2)} s)`);
  await wf(t, () => window.__game.progress.intro.step === 'fight', null, 3000);
  check((await step(t)) === 'fight', `${tag}: the strike moves the opening to the fight step`);
  r.landed = await winFight(t);
  check(r.landed, `${tag}: the fight is won`);
  const bait1 = await G(t, () => window.__game.progress.shop.bait?.[window.__game.gear.bait] ?? null);
  check(bait0 === bait1, `${tag}: the tutorial uses no bait (${bait0} -> ${bait1})`);
  await t.shot('fight-end');
  r.len = await G(t, () => window.__game.fishing.landed?.length);
  check(r.len >= 22 && r.len <= 24, `${tag}: the tutorial fish is 22 to 24 cm (${r.len})`);
  await t.page.waitForSelector('.key-grid', { timeout: 15000 });
  check((await step(t)) === 'flow', `${tag}: the catch panel is the flow step`);
  await t.shot('key');
  await doKey(t);
  check(await G(t, () => { const e = window.__game.progress.guide.e.yellowfinbream; return !!e.ident && !e.assisted; }), `${tag}: the key is solved unaided (identified, not assisted)`);
  const mtip = await G(t, () => document.querySelector('.panel .tip')?.innerText);
  check(/Mr Wilson/.test(mtip ?? ''), `${tag}: Mr Wilson's measuring line is an inline tip ("${(mtip ?? '').slice(0, 50)}")`);
  await t.shot('measure');
  await doMeasure(t);
  await t.page.waitForSelector('#fx-keep', { timeout: 8000 });
  const dtip = await G(t, () => document.querySelector('.panel .tip')?.innerText);
  check(/25 cm/.test(dtip ?? '') && new RegExp(`${r.len}`).test(dtip ?? ''), `${tag}: the board tip states the legal length and the measure ("${dtip}")`);
  check(!(await G(t, () => window.__game.dialogue.isOpen)), `${tag}: no dialogue box over the catch panel`);
  await t.shot('decide');
  return r;
}

async function keepTapBranch(t) {
  await t.page.click('#fx-keep'); await t.wait(400);
  const s = await G(t, () => ({ rows: window.__game.progress.catches.length, esky: window.__game.progress.esky.length, card: !!document.querySelector('.tutorial-keep'), text: document.querySelector('.panel')?.innerText, bad: window.__game.progress.catches.some(c => c.kept && !c.legal), steward: window.__game.progress.steward.fines }));
  check(s.card && /Have another look at that board/.test(s.text) && /25 cm/.test(s.text), `${tag}: Keep shows the rule card and "Have another look at that board"`);
  check(s.rows === 0 && s.esky === 0 && !s.bad && s.steward === 0, `${tag}: Keep wrote no logbook row, no esky entry and no fine`);
  await t.shot('keep-card');
  await t.page.click('#v-back'); await t.wait(300);
  check(!!(await t.page.$('#fx-release')) && !!(await t.page.$('#fx-keep')), `${tag}: back at the choice`);
}
async function releaseAndSend(t, { hide = false } = {}) {
  await t.page.click('#fx-release'); await t.wait(300);
  await t.page.click('#v-next'); await t.wait(300);
  const tip = await G(t, () => document.querySelector('.panel .tip')?.innerText);
  check(/wet your hands/i.test(tip ?? ''), `${tag}: the release step carries the wet-hands tip`);
  await doRelease(t, { hide });
  await t.shot('released');
  const row = await G(t, () => ({ ...window.__game.progress.catches.at(-1), n: window.__game.progress.catches.length, tier: window.__game.progress.guide.e.yellowfinbream }));
  check(row.n === 1 && row.tutorial === true && row.kept === false && row.wet === true && row.air <= 10 && row.accurate === true && row.id === 'yellowfinbream', `${tag}: the logbook row is the tutorial release (wet, ${row.air} s, accurate, tutorial: true)`);
  check(!!row.tier.mastered, `${tag}: a clean unaided key plus the right release is a real first Mastered entry`);
  await t.page.click('#r-next');
  await t.page.waitForSelector('#dialogue:not(.hidden)', { timeout: 10000 });
  return row;
}

// ============================================================================================================================== 1. the timed run (no extras)
if (run(1)) {
  const t = await open();
  const t0 = await (async () => { await t.page.waitForSelector('#dialogue:not(.hidden)', { timeout: 15000 }); return gtime(t); })();
  const first = await dlgText(t);
  check(/Illawarra Fish Guide/.test(first ?? ''), `${tag}: the first word is the goal ("${(first ?? '').slice(0, 60)}...")`);
  await t.shot('meet-1');
  const r = await playToDecide(t, false);
  await t.page.click('#fx-release'); await t.wait(200); await t.page.click('#v-next'); await t.wait(200);
  await doRelease(t); await t.page.click('#r-next');
  await doSend(t);
  await wf(t, () => window.__game.progress.intro.step === 'done');
  const dt = (await gtime(t)) - t0;
  check(dt < 240, `${tag}: first word to Mission 1 on the HUD in ${dt.toFixed(0)} s of game time (under 240)`);
  const hud = await G(t, () => ({ text: document.querySelector('#mission-btn .m-text')?.textContent, hidden: document.querySelector('#mission-btn').classList.contains('hidden') }));
  check(!hud.hidden && /First lines/.test(hud.text), `${tag}: Mission 1 is on the HUD ("${hud.text}")`);
  console.log(`${tag}: game time ${dt.toFixed(1)} s, bite after ${r.wait.toFixed(2)} s`);
  errs.push(...t.errors); await t.close();
}

// ============================================================================================================================== 2. the full run with every check
if (run(2)) {
  const t = await open();
  await t.page.waitForSelector('#dialogue:not(.hidden)', { timeout: 15000 });
  const lines = [];
  // read every opening line (and check the speakers, the two sentences at most and the Skip choice on each page)
  for (let i = 0; i < 4; i++) {
    const s = await G(t, () => ({ name: document.querySelector('#dialogue .dlg-name')?.childNodes[0]?.textContent, text: document.querySelector('#dialogue .dlg-text')?.innerText, skip: !!document.querySelector('#dialogue .dlg-choice[data-i="1"]'), box: document.querySelector('#dialogue').getBoundingClientRect().toJSON() }));
    lines.push(s);
    if (i === 0) {
      await t.shot('dialogue');
      const vp = await G(t, () => ({ w: innerWidth, h: innerHeight }));
      check(s.box.left >= 0 && s.box.right <= vp.w + 1 && s.box.bottom <= vp.h + 1, `${tag}: the dialogue box fits the ${vp.w}x${vp.h} screen`);
    }
    await next(t);
  }
  check(lines.every(l => l.skip), `${tag}: Skip is offered on every page`);
  check(lines.map(l => l.name).join() === 'Mr Cisneros,Mr Wilson,Mr Wilson,Mr Cisneros', `${tag}: the speakers are Mr Cisneros, Mr Wilson, Mr Wilson, Mr Cisneros`);
  check(lines.every(l => (l.text.match(/[.!?](\s|$)/g) ?? []).length <= 3), `${tag}: every line is short`);
  check(/tied this knot/.test(lines[2].text) && /Mission 2/.test(lines[2].text), `${tag}: Mr Wilson says the knot line`);
  await wf(t, () => window.__game.progress.intro.step === 'cast');
  // the clean shot of the two teachers: the over-the-shoulder view, HUD, name tags and the student hidden (the Fisheries Officer is sent away for the picture)
  await t.page.screenshot({ path: `${out}/corner-hud.png` });
  await G(t, () => { const g = window.__game, w = g.walker; w.pos.set(23.4, g.world.walkAt(23.4, 45.0), 45.0); w.heading = 0; g.rig.setPreset('shoulder', 0); g.angler.root.visible = false; const o = g.npcs.byId.officer; if (o) { window.__officerList = g.npcs.npcs; g.npcs.npcs = g.npcs.npcs.filter(n => n !== o); o.root.visible = false; o.hideLabels(); } const s = document.createElement('style'); s.id = 'clean'; s.textContent = '#hud, #intro-goal, #intro-skip, #touch, #toast, #dialogue { visibility: hidden !important; } .npc-tag, .npc-bubble, .npc-mark, [class*="npc-"] { visibility: hidden !important; }'; document.head.appendChild(s); });
  await t.wait(2200);
  await t.page.screenshot({ path: `${out}/teachers-clean.png` });
  await G(t, () => { const g = window.__game; document.getElementById('clean')?.remove(); g.rig.setPreset('diorama', 0); g.angler.root.visible = true; if (window.__officerList) { g.npcs.npcs = window.__officerList; window.__officerList = null; } });
  await t.teleport(SX, 46.9, { heading: 0, camYaw: Math.PI });
  const r = await playToDecide(t, true, { met: true }).catch(async e => { console.log('FAIL (full run):', e.message.split('\n')[0]); ok = false; await t.shot('error'); return null; });
  if (r) {
    await keepTapBranch(t);
    const row = await releaseAndSend(t, { hide: true });
    // send-off: four lines
    const sends = [];
    for (let i = 0; i < 4; i++) { sends.push(await dlgText(t)); await next(t); }
    check(/Mission 1/.test(sends[0]) && /radio/.test(sends[1]) && /can.t sell your catch/.test(sends[2]) && /credits/i.test(sends[3]), `${tag}: the send-off covers Mission 1, the radio, "can't sell your catch" and credits`);
    check(!/sell(ing)? (it|them|fish)\b.*\$/i.test(sends.join(' ')), `${tag}: nothing suggests a catch has a price`);
    await wf(t, () => window.__game.progress.intro.step === 'done');
    const st = await G(t, () => ({ step: window.__game.progress.intro, fishing: window.__game.fishing.state, tut: window.__game.fishing.tutorial, bounds: window.__game.intro.bounds, cur: window.__game.progress.missions.cur, hud: document.querySelector('#mission-btn .m-text')?.textContent }));
    check(st.step.step === 'done' && ['due', 'told'].includes(st.step.bev) && !st.tut && st.bounds === null && st.cur === 'first-lines', `${tag}: the opening is done: mission ${st.cur}, no gates, Bev's call ${st.step.bev}`);
    await t.shot('send-off-done');
    // Bev's first radio call, once, when the rod is ready
    const bev = await wf(t, () => window.__game.dialogue.isOpen && /Bev/.test(document.querySelector('#dialogue .dlg-name')?.innerText ?? ''), null, 12000);
    check(bev, `${tag}: Bev's first radio call plays once the student is ready to fish`);
    const bevText = await dlgText(t); await next(t);
    const bev2 = await dlgText(t);
    check(/Seen/.test(bev2 ?? '') && /Caught/.test(bev2 ?? '') && /Identified/.test(bev2 ?? '') && /Mastered/.test(bev2 ?? ''), `${tag}: Bev's call names the four tiers`);
    await t.shot('bev-call');
    await next(t); await t.wait(500);
    check(await G(t, () => window.__game.progress.tips.bevTiers === true && window.__game.progress.intro.bev === 'told'), `${tag}: Bev's call is remembered`);
    await t.wait(3500);
    check(!(await G(t, () => window.__game.dialogue.isOpen)), `${tag}: it does not play twice`);
    // the gates are off: T opens the tackle box, M opens the map
    await pressKey(t, 't'); check(await G(t, () => window.__game.panels.isOpen), `${tag}: T works again`); await pressKey(t, 't');
  }
  check(t.errors.length === 0, `${tag}: no console errors in the full run ${t.errors.slice(0, 2)}`);
  errs.push(...t.errors); await t.close();
}

// ============================================================================================================================== 3. a skip at every beat
if (run(3)) for (const beat of ['meet', 'cast', 'fight', 'send']) {
  const t = await open();
  await t.page.waitForSelector('#dialogue:not(.hidden)', { timeout: 15000 });
  if (beat === 'meet') { await t.page.click('#dialogue .dlg-choice[data-i="1"]'); }
  else {
    await sayMeet(t); await toRing(t);
    if (beat === 'cast') { await t.page.click('#intro-skip'); }
    else {
      await rodOutAndCast(t); await biteAndStrike(t);
      if (beat === 'fight') { await wf(t, () => window.__game.fishing.bar.active, null, 4000); await t.page.click('#intro-skip'); }
      else {
        await winFight(t); await t.page.waitForSelector('.key-grid', { timeout: 15000 }); await doKey(t); await doMeasure(t);
        await t.page.click('#fx-release'); await t.wait(200); await t.page.click('#v-next'); await t.wait(200); await doRelease(t); await t.page.click('#r-next');
        await t.page.waitForSelector('#dialogue:not(.hidden)', { timeout: 10000 });
        await t.page.click('#dialogue .dlg-choice[data-i="1"]');
      }
    }
  }
  await t.wait(600);
  if (beat === 'send') {   // the opening ran to its end, so the rod stays out and Bev's first call follows at once: let it play
    const bev = await wf(t, () => window.__game.dialogue.isOpen && /Bev/.test(document.querySelector('#dialogue .dlg-name')?.innerText ?? ''), null, 8000);
    check(bev, `${tag}: after a skip at "send" Bev's first call plays`);
    for (let i = 0; i < 2; i++) await next(t);
    await t.wait(400);
  }
  const s = await G(t, () => { const g = window.__game; return { step: g.progress.intro.step, dlg: g.dialogue.isOpen, panel: g.panels.isOpen, tut: g.fishing.tutorial, ring: !!g.intro.ring, bar: g.fishing.bar.active, hud: document.querySelector('#mission-btn .m-text')?.textContent, bounds: g.intro.bounds, frozen: g.walker.frozen, mode: g.mode }; });
  check(s.step === 'done' && !s.dlg && !s.panel && !s.tut && !s.ring && !s.bar && s.bounds === null && !s.frozen && s.mode === 'land' && /First lines/.test(s.hud ?? ''), `${tag}: skip at "${beat}" leaves nothing broken (${JSON.stringify(s)})`);
  // and the game works: rod out, tackle box, map
  await pressKey(t, 'r'); const rod = await G(t, () => window.__game.fishing.active);
  // the first time the rod is ready after a skip, Bev's first radio call plays (it is due after a skip as after the full opening): let it finish
  if (beat !== 'send' && await wf(t, () => window.__game.dialogue.isOpen && /Bev/.test(document.querySelector('#dialogue .dlg-name')?.innerText ?? ''), null, 5000)) { await next(t); await next(t); await t.wait(300); }
  await pressKey(t, 't'); const tb = await G(t, () => window.__game.panels.isOpen); if (tb) await pressKey(t, 't');
  void rod;
  check(tb, `${tag}: after a skip at "${beat}" the tackle box opens`);
  errs.push(...t.errors); await t.close();
}

// ============================================================================================================================== 4. a reload at every step
if (run(4)) {
  const t = await open();
  const reload = async () => { await t.page.reload(); await wf(t, () => window.__game?.mode === 'land', null, 60000); await t.wait(1800); };
  await t.page.waitForSelector('#dialogue:not(.hidden)', { timeout: 15000 });
  await reload();
  check(await wf(t, () => window.__game.dialogue.isOpen && /Illawarra Fish Guide/.test(document.querySelector('#dialogue .dlg-text')?.innerText ?? ''), null, 8000), `${tag}: a reload at "meet" starts the opening lines again`);
  await sayMeet(t);
  await reload();
  let s = await G(t, () => ({ step: window.__game.progress.intro.step, ring: !!window.__game.intro.ring, dlg: window.__game.dialogue.isOpen, rod: window.__game.fishing.active, tut: window.__game.fishing.tutorial, eco: window.__game.eco.id }));
  check(s.step === 'cast' && s.ring && !s.dlg && !s.rod && s.tut && s.eco === 'seagrass', `${tag}: a reload at "cast" resumes with the ring up (${JSON.stringify(s)})`);
  await rodOutAndCast(t); await biteAndStrike(t);
  await wf(t, () => window.__game.fishing.bar.active, null, 4000);
  check((await step(t)) === 'fight', `${tag}: mid-fight the step is "fight"`);
  await reload();
  s = await G(t, () => ({ step: window.__game.progress.intro.step, ring: !!window.__game.intro.ring, dlg: window.__game.dialogue.isOpen, active: window.__game.fishing.active }));
  check(s.step === 'cast' && s.ring && !s.dlg && !s.active, `${tag}: a reload mid-fight resumes at "cast" (${JSON.stringify(s)})`);
  await toRing(t); await rodOutAndCast(t); await biteAndStrike(t); await winFight(t);
  await t.page.waitForSelector('.key-grid', { timeout: 15000 });
  await doKey(t);   // the key is solved, no logbook row yet
  const mid = await G(t, () => ({ step: window.__game.progress.intro.step, rows: window.__game.progress.catches.length, ident: !!window.__game.progress.guide.e.yellowfinbream?.ident }));
  check(mid.step === 'flow' && mid.rows === 0 && mid.ident, `${tag}: in the flow before the row is written (${JSON.stringify(mid)})`);
  await reload();
  s = await G(t, () => ({ step: window.__game.progress.intro.step, ring: !!window.__game.intro.ring, panel: window.__game.panels.isOpen, rows: window.__game.progress.catches.length }));
  check(s.step === 'cast' && s.ring && !s.panel && s.rows === 0, `${tag}: a reload in the flow with no row resumes at "cast" (${JSON.stringify(s)})`);
  await toRing(t); await rodOutAndCast(t); await biteAndStrike(t); await winFight(t);
  await t.page.waitForSelector('#mat-board, .key-grid', { timeout: 15000 });
  if (await t.page.$('.key-grid')) await doKey(t);
  await doMeasure(t);
  await t.page.click('#fx-release'); await t.wait(200); await t.page.click('#v-next'); await t.wait(200); await doRelease(t); await t.page.click('#r-next');
  await t.page.waitForSelector('#dialogue:not(.hidden)', { timeout: 10000 });
  check((await step(t)) === 'send' && (await G(t, () => window.__game.progress.catches.length)) === 1, `${tag}: the release is saved and the step is "send"`);
  await reload();
  check(await wf(t, () => window.__game.dialogue.isOpen && /Mission 1/.test(document.querySelector('#dialogue .dlg-text')?.innerText ?? ''), null, 8000), `${tag}: a reload at "send" resumes at the send-off`);
  for (let i = 0; i < 4; i++) await next(t);
  await wf(t, () => window.__game.progress.intro.step === 'done');
  await reload();
  s = await G(t, () => ({ dlgOpen: window.__game.dialogue.isOpen, step: window.__game.progress.intro.step, rows: window.__game.progress.catches.length }));
  check(s.step === 'done' && s.rows === 1 && !(s.dlgOpen && /Illawarra Fish Guide/.test(await dlgText(t) ?? '')), `${tag}: after "done" a reload does not repeat the opening`);
  errs.push(...t.errors); await t.close();
}

// ============================================================================================================================== 5. the menu path and the deep link
if (run(5)) {
  const t = await open('quality=low');   // no ?play: the title screen, a new save
  await t.wait(1500);
  const menu = await G(t, () => ({ eco: window.__game.eco.id, mode: window.__game.mode }));
  check(menu.mode === 'menu' && menu.eco === 'seagrass', `${tag}: a new save's title screen is on Lake Illawarra (${JSON.stringify(menu)})`);
  await t.page.click('#btn-play'); await t.wait(2200);
  check(await G(t, () => window.__game.creatorOpen), `${tag}: Start fishing opens the creator first`);
  await t.page.fill('#cc-name', 'Kai'); await t.page.click('#cc-done');
  check(await wf(t, () => window.__game.mode === 'land' && window.__game.dialogue.isOpen, null, 15000), `${tag}: after the creator the opening begins`);
  const txt = await dlgText(t);
  check(/G.day Kai/.test(txt ?? ''), `${tag}: the opening greets the student by name ("${(txt ?? '').slice(0, 30)}")`);
  const pos = await G(t, () => window.__game.walker.pos.toArray().map(v => +v.toFixed(1)));
  check(Math.abs(pos[0] - SX) < 2, `${tag}: the new save stands at the corner (${pos})`);
  check(!(await G(t, () => window.__game.progress.tips.firstRun)), `${tag}: the old premise card is gone`);
  errs.push(...t.errors); await t.close();
  const d = await open('play=1&quality=low&eco=rocky');
  await d.wait(2500);
  const dd = await G(d, () => ({ dlg: window.__game.dialogue.isOpen, step: window.__game.progress.intro.step, eco: window.__game.eco.id, active: window.__game.intro.active }));
  check(!dd.dlg && !dd.active && dd.eco === 'rocky', `${tag}: ?play=1&eco=rocky skips the opening and keeps its site (${JSON.stringify(dd)})`);
  errs.push(...d.errors); await d.close();
  const p2 = await open('play=1&quality=low');
  await p2.wait(2500);
  const pp = await G(p2, () => ({ dlg: window.__game.dialogue.isOpen, active: window.__game.intro.active, hud: document.querySelector('#mission-btn .m-text')?.textContent }));
  check(!pp.dlg && !pp.active && /First lines/.test(pp.hud ?? ''), `${tag}: ?play=1 alone skips the opening and shows Mission 1 (${JSON.stringify(pp)})`);
  errs.push(...p2.errors); await p2.close();
}

const real = errs.filter(e => !/favicon/.test(e));
check(real.length === 0, `${tag}: zero console errors across every scenario ${real.slice(0, 2).map(s => s.slice(0, 160))}`);
console.log(ok ? 'INTRO OK' : 'INTRO FAILED'); process.exit(ok ? 0 : 1);
