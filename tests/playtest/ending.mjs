// Phase 7 playtest: the awards-night ending and the 100%-Caught milestone. Scripted near-complete save (tests/playtest/saves.mjs):
//   1 the title screen (Continue / New game, Settings, Teacher page, Credits, Learning Hub), no ceremony yet
//   2 the last Mastery lands: the title offers Awards night, and the outing summary offers "Go to the club"
//   3 the ceremony itself: an evening on Bellambi beach, the whole cast, each award quoting the player's own numbers, the end card with the tagline
//   4 credits (with the Sea Country AEO/AECG note), Keep fishing (the next morning, still able to play), the ceremony is not offered twice
//   5 the milestone: every fish Caught -> the smaller celebration; Nell's co-op offer after the ending
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/ending.mjs [high|low] [narrow|phone]
//   narrow = 375 px wide desktop; phone = 375x812 with touch (taps, not clicks). Screenshots in playtest-shots/ending/<quality>[-375|-phone]/. Exits 0 only if every check passed.
import { launch } from './harness.mjs';
import { nearComplete, finishLast, caughtAll } from './saves.mjs';

const quality = process.argv[2] ?? 'high', mode = process.argv[3] ?? '', narrow = mode === 'narrow', phone = mode === 'phone';
const tag = `${quality}${narrow ? '-375' : phone ? '-phone' : ''}`;
const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; if (process.env.DBG) console.log(cond ? 'ok  ' : 'FAIL', msg); };
process.on('uncaughtException', e => { for (const l of log) console.log(...l); console.log('EXCEPTION', String(e).slice(0, 400)); process.exit(1); });
const t = await launch({ query: `quality=${quality}&time=day&season=summer&officer=0`, outDir: `playtest-shots/ending/${tag}`, width: narrow ? 375 : 1280, height: narrow ? 760 : 760, phone: phone ? { w: 375, h: 812 } : null });
const page = t.page, ev = (f, a) => page.evaluate(f, a);
const press = sel => (phone ? page.tap(sel) : page.click(sel));
const waitFor = (sel, ms = 8000) => page.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const text = sel => ev(s => document.querySelector(s)?.innerText ?? '', sel);

// ================================================================== 1. the title
await t.wait(800);
let title = await ev(() => ({ play: document.querySelector('#btn-play').innerText, newHidden: document.querySelector('#btn-new').classList.contains('hidden'), awardsHidden: document.querySelector('#btn-awards').classList.contains('hidden'),
  hub: document.querySelector('.hub-link')?.href, teacher: document.querySelector('#btn-teacher')?.getAttribute('href'), credits: !!document.querySelector('#btn-credits'), settings: !!document.querySelector('#btn-settings') }));
check(title.play === 'Start fishing' && title.newHidden && title.awardsHidden, `a brand-new device offers "Start fishing" only: ${JSON.stringify(title)}`);
check(title.hub === 'https://irvincisneros-png.github.io/' && title.teacher === 'teacher.html' && title.credits && title.settings, 'the title has the Learning Hub link, Teacher page, Credits and Settings');
await t.shot('title-new');
const st0 = await nearComplete(page, { leave: 'carp', bay: 88 });
check(st0.mastered === st0.total - 1 && st0.bay > 80, `scripted save: ${st0.mastered}/${st0.total} Mastered, Bay Health ${st0.bay.toFixed(0)}%`);
title = await ev(() => ({ play: document.querySelector('#btn-play').innerText, newHidden: document.querySelector('#btn-new').classList.contains('hidden'), awardsHidden: document.querySelector('#btn-awards').classList.contains('hidden') }));
check(title.play === 'Continue' && !title.newHidden && title.awardsHidden, `with progress the title shows Continue + New game, and no awards button yet: ${JSON.stringify(title)}`);
await t.shot('title-continue');
await press('#btn-new'); await t.wait(300);
check(await waitFor('#ng-yes', 2000), 'New game asks before deleting');
await t.shot('new-game-confirm');
await press('#ng-no'); await t.wait(300);
check(await ev(() => window.__game.progress.catches.length > 50), '"Keep my game" keeps the save');

// ================================================================== 2. the last mastery
check(await ev(() => window.__game.pendingCeremony() === null), 'no ceremony while one fish is still not Mastered');
check(await finishLast(page, 'carp') === 'mastered', 'the last species is Mastered through the Fish Guide');
check(await ev(() => window.__game.pendingCeremony()) === 'awards', 'awards night is now pending (100% Mastered + healthy bay)');
title = await ev(() => ({ hidden: document.querySelector('#btn-awards').classList.contains('hidden'), label: document.querySelector('#btn-awards').innerText }));
check(!title.hidden && /Awards night/.test(title.label), `the title offers it: "${title.label}"`);
await t.shot('title-awards-ready');
// The in-game route: fish, head home, the summary offers the club.
await press('#btn-play'); await t.wait(1500);
check(await ev(() => window.__game.mode === 'land'), 'Continue starts an outing');
await ev(() => window.__game.outing.ask()); await t.wait(300);
await press('#home-go'); await t.wait(900);
check(await waitFor('.summary', 4000), 'heading home shows the outing summary');
const summ = await text('.summary');
check(/Awards night!/.test(summ) && /Go to the club/.test(summ), 'the summary says awards night is ready and offers "Go to the club"');
await t.shot('summary-club');
await press('#sum-again');

// ================================================================== 3. the ceremony
check(await page.waitForFunction(() => window.__game.mode === 'ceremony' && !window.__game.loading, null, { timeout: 90000 }).then(() => true).catch(() => false), 'the ceremony starts on Bellambi beach');
await t.wait(2600);
check(await ev(() => window.__game.eco.id === 'rocky'), 'the ceremony is at Bellambi (the fishing club)');
const hour = await ev(() => +window.__game.cond.hour.toFixed(1));
check(hour >= 18 && hour <= 19.5, `it is evening (${hour}h)`);
const cast = await ev(() => Object.keys(window.__game.npcs.byId).sort());
check(cast.length === 10, `the whole cast is there: ${cast.join(', ')}`);
await t.shot('stage-intro');
const awardTexts = [];
for (let i = 0; i < 10; i++) {
  check(await waitFor('.dlg:not(.hidden) .dlg-next', 6000), `award ${i + 1}: the dialogue is up`);
  const tx = await text('.dlg .dlg-text'); awardTexts.push(tx);
  const who = await text('.dlg .dlg-name');
  if ([0, 2, 5, 9].includes(i)) await t.shot(`award-${i + 1}-${who.split('\n')[0].toLowerCase().replace(/[^a-z]+/g, '-')}`);
  await press('.dlg .dlg-next'); await t.wait(500);
}
const joined = awardTexts.join(' | ');
check(/Kai/.test(joined), 'the awards use the player\'s name');
check(awardTexts.length === 10 && awardTexts.filter(x => /\d/.test(x)).length >= 8, 'the awards quote numbers from the player\'s own record');
check(/14 pieces/.test(joined) && /9 tagged/.test(joined) && /Bay Health is at 8\d%|Bay Health is at 9\d%/.test(joined), 'litter (14), tags (9) and Bay Health (the scripted 88% stocks plus the Steward bonus) are the scripted numbers');
check(await waitFor('.endcard', 6000), 'the end card appears');
const end = await text('.endcard');
check(/Gotta catch ’em all… and release the small\./.test(end), 'the end card has the tagline');
check(/25\/25/.test(end), 'the end card shows 25/25 Mastered');
await t.wait(600); await t.shot('end-card');
check(await ev(() => window.__game.progress.ending.awards > 0), 'awards night is saved as shown');
check(await ev(() => window.__game.pendingCeremony() === null), 'it is not offered twice');

// ================================================================== 4. credits and keep fishing
await press('#end-credits'); await t.wait(500);
const cr = await text('.credits');
check(/Sea Country content pending AEO\/AECG review/.test(cr), 'the credits note "Sea Country content pending AEO/AECG review"');
check(/DPIRD/.test(cr) && /SAFS/.test(cr) && /GoodFish/.test(cr), 'the credits name DPIRD, SAFS and GoodFish');
await t.shot('credits');
await press('#cr-ok'); await t.wait(500);
check(await waitFor('.endcard', 3000), 'closing the credits returns to the end card');
await press('#end-play'); await t.wait(1500);
check(await ev(() => window.__game.mode === 'land' && window.__game.eco.id === 'rocky'), 'Keep fishing: back on the beach and playable');
const morning = await ev(() => +window.__game.cond.hour.toFixed(1));
check(morning >= 7 && morning < 9, `the next morning (${morning}h)`);
check(await ev(() => window.__game.npcs.npcs.length > 0 && !window.__game.npcs.ceremony), 'the usual people are back on the coast');
await ev(() => window.__game.toggleRod()); await t.wait(500);
await t.shot('after-ending-playing');

// ================================================================== 5. co-op offer, then the milestone
const elig = await ev(async () => { const C = await import(new URL('src/economy/commercial.js', location.href).href); return { eligible: C.coopEligible(window.__game.progress) }; });
check(elig.eligible, 'after awards night Nell can offer the co-op licence');
// The milestone, on a clean device in the same browser: every fish Caught, none Mastered.
const url = page.url().split('?')[0];
await ev(() => localStorage.clear());
await page.goto(`${url}?quality=${quality}&time=day&season=summer&officer=0`);
await page.waitForFunction(() => window.__game?.mode === 'menu', null, { timeout: 120000 });
const p2 = page, t2 = t;
check(await caughtAll(p2) === 25, 'milestone save: all 25 fish Caught');
check(await p2.evaluate(() => window.__game.pendingCeremony()) === 'milestone', 'the 100% Caught milestone is pending (not awards night)');
await p2.evaluate(() => { window.__game.runCeremony('milestone'); });   // (not awaited: evaluate would wait for the whole ceremony)
await p2.waitForFunction(() => window.__game.mode === 'ceremony' && !window.__game.loading, null, { timeout: 90000 }); await p2.waitForTimeout(2600);
await t2.shot('milestone-stage');
for (let i = 0; i < 4; i++) { await p2.waitForSelector('.dlg:not(.hidden) .dlg-next', { timeout: 6000 }); if (i === 1) await t2.shot('milestone-award'); await (phone ? p2.tap('.dlg .dlg-next') : p2.click('.dlg .dlg-next')); await p2.waitForTimeout(400); }
await p2.waitForSelector('.endcard', { timeout: 6000 });
const mend = await p2.evaluate(() => document.querySelector('.endcard').innerText);
check(/Every fish caught!/.test(mend) && /Gotta catch ’em all… and release the small\./.test(mend) && /Awards night is still to come/.test(mend), 'the milestone end card celebrates and points on to awards night');
await t2.shot('milestone-end');
check(await p2.evaluate(() => window.__game.progress.ending.milestone > 0 && !window.__game.progress.ending.awards), 'only the milestone is saved');

const errors = [...t.errors];
check(errors.length === 0, `zero console errors (${errors.length}${errors.length ? ': ' + errors.slice(0, 3).join(' || ').slice(0, 300) : ''})`);
for (const l of log) console.log(...l);
await t.close();
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
