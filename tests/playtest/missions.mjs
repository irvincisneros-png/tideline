// Day 1 missions play-test (real Chromium, the game's own modules driven through window.__game):
//   1. a NEW save sees the HUD mission line and Mission 1 step 1 moves after an accurate measure; the personal best card, the next-up nudge and the
//      Guide counter show; the HUD line opens the quest log; pin puts a request on the HUD; a finished mission plays its radio call (queued while a panel is open)
//   2. an OLD save fast-forwards silently: its finished mission is marked done with its hat and no credits, one welcome radio line, once
//   3. the HUD line fits and opens the quest log on a phone held sideways (844x390, touch) and at 375 wide
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/missions.mjs [mobile]   (mobile = only part 3)
// Screenshots in playtest-shots/missions/. Exits 0 only if every check passed.
import { launch } from './harness.mjs';

const onlyMobile = process.argv[2] === 'mobile';
const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; };
process.on('uncaughtException', e => { for (const l of log) console.log(...l); console.log('EXCEPTION', String(e).slice(0, 400)); process.exit(1); });
const OUT = 'playtest-shots/missions', Q = 'eco=seagrass&quality=low&play=1&time=day&tide=rising&season=summer&officer=0';
const ANGLER = { name: 'Kai', skin: 0xc58c5e, hairStyle: 'short', hair: 0x4a2f1d, hatStyle: 'straw', hat: 0xe9d9a6, sunnies: 'none', pattern: 'plain', shirt: 0xf0715a, shorts: 0x2f5496, rod: 0x3b525c };
const hud = page => page.evaluate(() => { const b = document.querySelector('#mission-btn'), r = b.getBoundingClientRect(); return { shown: !b.classList.contains('hidden') && r.width > 0, text: b.querySelector('.m-text').textContent, pinned: b.classList.contains('pinned'), rect: { l: r.left, t: r.top, r: r.right, b: r.bottom }, vw: innerWidth, vh: innerHeight, scrollW: document.documentElement.scrollWidth }; });
const dlgOpen = page => page.evaluate(() => { const g = window.__game; return { open: g.dialogue.isOpen, who: document.querySelector('#dialogue .dlg-name')?.textContent ?? '', text: document.querySelector('#dialogue .dlg-text')?.textContent ?? '' }; });
/** Put an older save in storage and reload, so the game loads it the way a returning student's browser would. */
const reloadWith = async (t, save) => {
  await t.page.evaluate(s => localStorage.setItem('tideline.progress.v1', s), JSON.stringify(save));
  await t.page.reload(); await t.page.waitForFunction(() => window.__game && window.__game.mode === 'land', null, { timeout: 120000 });
};

/** Land a fish and walk it through the brag mat: lock the exact length, then keep or release it. Returns what the cards showed. */
async function handle(t, { id, length, keep }) {
  const page = t.page, seen = {};
  await page.evaluate(([id, length]) => {
    const g = window.__game;
    if (!g.progress.guide.e[id]?.ident) import(new URL('src/fishing/guide.js', location.href).href).then(G => G.recordKey(g.progress, id, id));
  }, [id, length]);
  await t.wait(300);
  await page.evaluate(([id, length]) => window.__game.catchFlow.run({ id, length, gear: 0.8, ctx: { rig: 'runningsinker', bait: 'prawn', tide: 'rising', time: 'day', season: 'summer' } }, 'jetty', () => {}), [id, length]);
  await page.waitForSelector('.flow.measure #m-lock', { timeout: 8000 }); await t.wait(500);
  for (let i = 0; i < 90; i++) {
    const v = await page.evaluate(() => +document.querySelector('#mr').textContent);
    if (v === length) break;
    await page.click(v < length ? '#m-plus' : '#m-minus');
  }
  await page.click('#m-lock'); await t.wait(200); await page.click('#m-next'); await t.wait(400);
  seen.pb = await page.evaluate(() => { const c = document.querySelector('#pb-card'); return c ? { text: c.textContent, photo: c.querySelector('.pb-photo').style.backgroundImage.length > 20 } : null; });
  if (seen.pb) { await t.shot('personal-best'); await page.click('#pb-ok'); await t.wait(400); }
  await page.waitForSelector('#fx-keep', { timeout: 5000 });
  if (keep) {
    await page.click('#fx-keep'); await page.waitForSelector('#v-next', { timeout: 5000 });
    seen.nextup = await page.evaluate(() => document.querySelector('.nextup')?.textContent ?? ''); await t.shot('kept-card');
    await page.click('#v-next');
  } else {
    await page.click('#fx-release'); await page.waitForSelector('#v-next'); await page.click('#v-next');
    await page.waitForSelector('#rel-wet', { timeout: 5000 }); await page.click('#rel-wet');
    await page.focus('#rel-hold'); await page.keyboard.down('Space'); await t.wait(1800); await page.keyboard.up('Space');
    await page.waitForSelector('#r-next', { timeout: 6000 });
    seen.nextup = await page.evaluate(() => document.querySelector('.nextup')?.textContent ?? ''); await t.shot('released-card');
    await page.click('#r-next');
  }
  await t.wait(400);
  return seen;
}

// ================================================================== 1. a new save
if (!onlyMobile) {
  const t = await launch({ query: Q, outDir: OUT, width: 1280, height: 720 });
  const page = t.page, ev = (f, a) => page.evaluate(f, a);
  await t.wait(1500);
  let h = await hud(page);
  check(h.shown && h.text === 'First lines: Log 2 measures within 1 cm (0/2)', `new save: the HUD shows the mission line: "${h.text}"`);
  const total = await ev(() => import(new URL('src/fishing/species.js', location.href).href).then(m => m.SPECIES.length));
  await t.shot('new-save-hud');
  // First fish: an exact measure, released. The last card says where the Guide stands and what is closest to Mastery.
  let seen = await handle(t, { id: 'yellowfinbream', length: 30, keep: false });
  check(!seen.pb, 'the first fish of a species is not a "personal best" (no record to beat)');
  check(new RegExp(`Guide 1/${total}`).test(seen.nextup) && /Next up: Yellowfin bream: keyed and measured\. Needs a legal keep\./.test(seen.nextup), `the release card shows the Guide counter and next up: "${seen.nextup}"`);
  await t.wait(900);
  h = await hud(page);
  check(h.text === 'First lines: Log 2 measures within 1 cm (1/2)', `after one accurate measure the HUD reads (1/2): "${h.text}"`);
  const p1 = await ev(() => window.__game.progress.catches.at(-1));
  check(p1.accurate === true && p1.kept === false, 'the logbook row is accurate and released');
  // Second fish: longer than the first: the personal best card (kept or released alike), then a legal keep.
  seen = await handle(t, { id: 'yellowfinbream', length: 34, keep: true });
  check(!!seen.pb && /Personal best/.test(seen.pb.text) && /34 cm/.test(seen.pb.text) && /30 cm/.test(seen.pb.text) && seen.pb.photo, `a longer fish shows the personal best card with the photo: "${seen.pb?.text}"`);
  await t.wait(900);
  h = await hud(page);
  check(h.text === 'First lines: Talk to Mitra: Licence and fees quiz', `step 1 done, the HUD moves on to the trade step: "${h.text}"`);
  check((await ev(() => window.__game.progress.missions.done['first-lines'])) == null, 'the mission is not done until the quiz is handed in');
  // The Guide counter on the map.
  await ev(() => window.__game.openMap());
  await t.wait(500);
  const gc = await ev(() => document.querySelector('.mapview .guide-count')?.textContent);
  check(new RegExp(`^Guide [1-9]/${total}$`).test(gc ?? ''), `the map screen shows the Guide counter: "${gc}"`);
  await ev(() => window.__game.panels.close());
  // The HUD line opens the quest log, which has the missions section.
  await page.click('#mission-btn'); await t.wait(500);
  let ql = await ev(() => ({ open: window.__game.panels.isOpen, mission: document.querySelector('.questlog .missions')?.textContent ?? '' }));
  check(ql.open && /First lines/.test(ql.mission) && /Licence and fees quiz/.test(ql.mission) && /Measuring cap/.test(ql.mission), 'tapping the HUD line opens the quest log with the current mission and its reward');
  await t.shot('quest-log-missions');
  // Pin: accept a request, pin it, the HUD shows it; tap again to unpin.
  await ev(async () => { const R = await import(new URL('src/npc/requests.js', location.href).href); R.accept(window.__game.progress, 'tam-bream'); window.__game.persist(); window.__game.panels.close(); window.__game.questLog(); });
  await t.wait(500);
  await page.click('[data-pin="tam-bream"]'); await t.wait(400);
  h = await hud(page);
  check(h.pinned && /bream/i.test(h.text) && !h.text.startsWith('First lines'), `pinning an accepted request puts it on the HUD: "${h.text}"`);
  check(await ev(() => window.__game.progress.missions.pin === 'tam-bream'), 'the pin is saved');
  await page.click('[data-pin="tam-bream"]'); await t.wait(400);
  h = await hud(page);
  check(!h.pinned && h.text.startsWith('First lines'), 'tapping again unpins');
  await ev(() => window.__game.panels.close());
  // A finished mission is queued while a panel is open, then plays its radio call once and gives only its hat.
  const before = await ev(() => ({ coins: window.__game.progress.coins, have: Object.keys(window.__game.progress.inventory.have) }));
  await ev(async () => { const g = window.__game, R = await import(new URL('src/npc/requests.js', location.href).href); g.questLog(); R.accept(g.progress, 'mitra-licence'); R.complete(g.progress, 'mitra-licence'); g.persist(); });
  await t.wait(1500);
  let d = await dlgOpen(page);
  check(!d.open, 'with a panel open the radio call waits (queued)');
  check(await ev(() => window.__game.progress.missions.done['first-lines'] > 0), 'but the mission is already marked done');
  await ev(() => window.__game.panels.close());
  await t.wait(1500);
  d = await dlgOpen(page);
  check(d.open && d.who.startsWith('Mr Cisneros') && /Two careful measures/.test(d.text), `the radio call plays at the next safe moment: ${d.who}: "${d.text.slice(0, 60)}"`);
  await t.shot('radio-call');
  for (let i = 0; i < 4 && (await dlgOpen(page)).open; i++) { await page.click('#dialogue button'); await t.wait(350); }
  d = await dlgOpen(page);
  const after = await ev(() => ({ coins: window.__game.progress.coins, have: Object.keys(window.__game.progress.inventory.have), cur: window.__game.progress.missions.cur }));
  check(!d.open, 'the call ends and does not repeat');
  check(after.coins === before.coins, 'the mission paid no credits');
  check(after.have.includes('hat-measuring') && after.have.length === before.have.length + 1, `it added one hat only: ${after.have.filter(x => !before.have.includes(x))}`);
  check(after.cur === 'know-tackle', `the next mission is Know your tackle (Mission 2, now that knots are built): ${after.cur}`);
  await t.wait(800);
  h = await hud(page);
  check(/^Know your tackle: /.test(h.text), `the HUD line moves to the next mission: "${h.text}"`);
  check(t.errors.length === 0, `new save: zero console errors ${t.errors.slice(0, 2)}`);
  await t.close();
}

// ================================================================== 2. an old save fast-forwards silently
if (!onlyMobile) {
  const OLD = { v: 4, coins: 77, angler: ANGLER, catches: [1, 2, 3].map(i => ({ eco: 'seagrass', id: 'yellowfinbream', label: 'Yellowfin bream', n: 1, length: 30, measured: 30, accurate: true, kept: true, legal: true, kind: 'ok', correct: true, time: i, day: 1, spot: 'jetty', rig: 'runningsinker', wet: undefined })),
    guide: { nextN: 2, e: { yellowfinbream: { seen: { t: 1 }, caught: { t: 1, n: 1, count: 3 }, ident: true, clean: true, meas: { n: 3, acc: 3 }, dec: { ok: 3, bad: 0 }, best: 30 } } },
    npc: { day: 2, met: {}, accepted: { 'mitra-licence': 1 }, done: { 'mitra-licence': 5 }, quizFail: {}, rot: {} }, inventory: { have: { 'bait-nipper': 5 }, cards: {}, worn: null, lure: null } };
  const t = await launch({ query: Q, outDir: OUT, width: 1280, height: 720 });
  const page = t.page, ev = (f, a) => page.evaluate(f, a);
  await reloadWith(t, OLD); await t.wait(500);
  const early = await ev(() => { const g = window.__game, p = g.progress; return { done: Object.keys(p.missions.done), cur: p.missions.cur, hats: Object.keys(p.inventory.have).filter(k => k.startsWith('hat-')), coins: p.coins, toasts: [...document.querySelectorAll('.toast')].map(x => x.textContent), intro: p.intro.step, legacy: p.missions.legacy }; });
  check(early.done.join() === 'first-lines' && early.cur === 'know-tackle', `old save: Mission 1 is already done, the pointer is on Mission 2 (Know your tackle): ${early.done} -> ${early.cur}`);
  check(early.hats.join() === 'hat-measuring' && early.coins === 77, `its hat is in the kit and no credits were paid (${early.hats}, ${early.coins} credits)`);
  check(early.intro === 'done' && early.legacy === true, 'an old save never sees the intro');
  check(!early.toasts.some(x => /Mission done|New hat|🎁/.test(x)), 'no reward toast storm');
  await t.wait(4000);
  let d = await dlgOpen(page);
  check(d.open && d.who.startsWith('Mr Cisneros') && /quest log/.test(d.text) && !/Two careful measures/.test(d.text), `at the lake it gets ONE welcome radio line: ${d.who}: "${d.text.slice(0, 70)}"`);
  await t.shot('old-save-hello');
  await page.click('#dialogue button'); await t.wait(1800);
  d = await dlgOpen(page);
  check(!d.open, 'and nothing else follows it (no mission radio calls for the fast-forwarded mission)');
  const hello = await ev(() => ({ tip: window.__game.progress.tips.missionsHello, hats: Object.keys(window.__game.progress.inventory.have).filter(k => k.startsWith('hat-')), line: document.querySelector('#mission-btn .m-text').textContent }));
  check(hello.tip === true && hello.hats.join() === 'hat-measuring', 'the hello is remembered and no further hat was given');
  check(/^Know your tackle: /.test(hello.line), `the HUD line is on Mission 2: "${hello.line}"`);
  await page.reload(); await page.waitForFunction(() => window.__game && window.__game.mode === 'land', null, { timeout: 120000 });
  await t.wait(4500);
  d = await dlgOpen(page);
  check(!d.open, 'after a reload the hello does not come again');
  check(t.errors.length === 0, `old save: zero console errors ${t.errors.slice(0, 2)}`);
  await t.close();
}

// ================================================================== 3. the HUD line on small screens
{
  const t = await launch({ query: `${Q}&touch=1`, outDir: `${OUT}/phone`, mobile: true });
  const page = t.page;
  await t.wait(1800);
  await page.waitForFunction(() => !document.querySelector('#toast').children.length, null, { timeout: 20000 });   // the opening toast sits over the HUD for a few seconds
  let h = await hud(page);
  check(h.vw === 844 && h.vh === 390, `phone landscape ${h.vw}x${h.vh}`);
  check(h.shown && h.text.startsWith('First lines:'), `844x390: the mission line shows: "${h.text}"`);
  check(h.rect.l >= 0 && h.rect.r <= h.vw - 250 && h.rect.b <= 170 && h.scrollW <= h.vw, `844x390: it fits left of the thumb buttons: right ${h.rect.r.toFixed(0)} of ${h.vw - 250}, bottom ${h.rect.b.toFixed(0)}, no sideways scroll`);
  const overlap = await page.evaluate(() => { const a = document.querySelector('#mission-btn').getBoundingClientRect(); return [...document.querySelectorAll('#cond-chip, #stat-chip, #menu-btn, #touch .t-top button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top; }).map(e => e.id || e.className); });
  check(overlap.length === 0, `844x390: it overlaps no other HUD item ${overlap}`);
  await t.shot('phone-hud');
  await page.touchscreen.tap((h.rect.l + h.rect.r) / 2, (h.rect.t + h.rect.b) / 2); await t.wait(600);   // a real finger: the look layer sits over the HUD and passes the tap on
  const ql = await page.evaluate(() => ({ open: window.__game.panels.isOpen, missions: !!document.querySelector('.questlog .missions') }));
  check(ql.open && ql.missions, '844x390: tapping the HUD line opens the quest log (missions section on top)');
  await t.shot('phone-quest-log');
  const box = await page.evaluate(() => { const r = document.querySelector('.questlog .missions').getBoundingClientRect(); return { t: r.top, b: r.bottom, vh: innerHeight }; });
  check(box.t >= 0 && box.t < box.vh * 0.6, `844x390: the missions section is visible at the top of the log (top ${box.t.toFixed(0)} of ${box.vh})`);
  check(t.errors.length === 0, `phone: zero console errors ${t.errors.slice(0, 2)}`);
  await t.close();
}
{
  const t = await launch({ query: Q, outDir: `${OUT}/narrow`, width: 375, height: 667 });
  await t.wait(1800);
  const h = await hud(t.page);
  check(h.shown && h.rect.l >= 0 && h.rect.r <= 375 && h.scrollW <= 375, `375 wide: the mission line fits (${h.rect.l.toFixed(0)}..${h.rect.r.toFixed(0)}), no sideways scroll`);
  const overlap = await t.page.evaluate(() => { const a = document.querySelector('#mission-btn').getBoundingClientRect(); return [...document.querySelectorAll('#cond-chip, #stat-chip, #menu-btn, #touch .t-top button')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top; }).map(e => e.id || e.className); });
  check(overlap.length === 0, `375 wide: it overlaps no other HUD item ${overlap}`);
  await t.shot('narrow-hud');
  await t.page.click('#mission-btn'); await t.wait(500);
  check(await t.page.evaluate(() => window.__game.panels.isOpen && !!document.querySelector('.questlog .missions')), '375 wide: the HUD line opens the quest log');
  check(t.errors.length === 0, `375: zero console errors ${t.errors.slice(0, 2)}`);
  await t.close();
}

for (const l of log) console.log(...l);
console.log(ok ? 'PASS missions' : 'FAIL missions');
process.exit(ok ? 0 : 1);
