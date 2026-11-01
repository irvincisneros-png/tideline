// First-run premise card: a brand-new player, Start fishing -> creator -> Done -> Bev's radio card (four short pages, skippable), shown once; a ?play deep link does not show it.
// Also shoots the creator preview (front 3/4 view). Usage: URL=http://localhost:8451/ node tests/playtest/firstrun.mjs   Screenshots: playtest-shots/release/
import { launch } from './harness.mjs';
let ok = true;
const check = (c, m) => { if (!c) { ok = false; console.log('FAIL:', m); } else console.log('ok:', m); };
for (const [tag, w, h] of [['1280', 1280, 800], ['375', 375, 700]]) {
  const t = await launch({ query: 'eco=rocky&quality=low', outDir: 'playtest-shots/release/tmp', width: w, height: h });
  const page = t.page, ev = (f, a) => page.evaluate(f, a);
  await ev(() => localStorage.clear()); await page.reload(); await page.waitForFunction(() => window.__game?.mode === 'menu', null, { timeout: 120000 });
  await t.wait(600);
  await page.click('#btn-play'); await t.wait(2200);
  check(await ev(() => window.__game.creatorOpen), `${tag}: creator opens`);
  await t.wait(1500);
  await page.screenshot({ path: `playtest-shots/release/creator-front-${tag}.png` });
  const yaw = await ev(() => window.__game.creator.stage.angler.root.rotation.y);
  check(Math.abs(yaw) < 1.0, `${tag}: the creator angler faces the camera (3/4 front), yaw ${yaw.toFixed(2)}`);
  await page.fill('#cc-name', 'Kai'); await page.click('#cc-done'); await t.wait(1800);
  check(await ev(() => window.__game.mode === 'land' && window.__game.dialogue.isOpen), `${tag}: the premise card opens after the creator`);
  let txt = await ev(() => document.querySelector('#dialogue').innerText);
  check(/Illawarra Fish Guide/.test(txt) && /catch .em all/.test(txt), `${tag}: page 1 states the goal and the tagline`);
  await page.screenshot({ path: `playtest-shots/release/first-run-1-${tag}.png` });
  await page.click('.dlg-choice[data-i="0"]'); await t.wait(300);
  txt = await ev(() => document.querySelector('#dialogue').innerText);
  check(/Seen/.test(txt) && /Caught/.test(txt) && /Identified/.test(txt) && /Mastered/.test(txt), `${tag}: page 2 names the four tiers`);
  await page.click('.dlg-choice[data-i="0"]'); await t.wait(300);
  txt = await ev(() => document.querySelector('#dialogue').innerText);
  check(/Club credits/.test(txt) && /cannot sell/.test(txt), `${tag}: page 3 says credits come from records, not selling`);
  await page.screenshot({ path: `playtest-shots/release/first-run-3-${tag}.png` });
  await page.click('.dlg-choice[data-i="0"]'); await t.wait(300);
  txt = await ev(() => document.querySelector('#dialogue').innerText);
  check(/walk to the water/.test(txt) && /R/.test(txt), `${tag}: page 4 gives the first step`);
  await page.screenshot({ path: `playtest-shots/release/first-run-4-${tag}.png` });
  await page.click('.dlg-choice[data-i="0"]'); await t.wait(300);
  check(await ev(() => !window.__game.dialogue.isOpen && window.__game.progress.tips.firstRun === true), `${tag}: the card closes and is remembered`);
  // Skip: a second fresh save, Escape on page 1 closes it
  await ev(() => { localStorage.clear(); }); await page.reload(); await page.waitForFunction(() => window.__game?.mode === 'menu', null, { timeout: 120000 });
  await ev(() => { const g = window.__game; g.progress.angler = { name: 'Kai', skin: 0xc58c5e, hairStyle: 'short', hair: 0x4a2f1d, hatStyle: 'straw', hat: 0xe9d9a6, sunnies: 'none', pattern: 'plain', shirt: 0xf0715a, shorts: 0x2f5496, rod: 0x3b525c }; g.beginPlay(); });
  await t.wait(1500);
  check(await ev(() => window.__game.dialogue.isOpen), `${tag}: a continuing blank save with an angler also gets the card`);
  await page.keyboard.press('Escape'); await t.wait(300);
  check(await ev(() => !window.__game.dialogue.isOpen), `${tag}: Escape skips it`);
  await t.close();
  // deep link: no card
  const t2 = await launch({ query: 'eco=rocky&play&quality=low', outDir: 'playtest-shots/release/tmp', width: w, height: h });
  await t2.wait(1500);
  check(await t2.page.evaluate(() => !window.__game.dialogue.isOpen), `${tag}: a ?play deep link does not show the card`);
  check(t2.errors.length === 0 && t.errors.length === 0, `${tag}: zero console errors ${[...t.errors, ...t2.errors].slice(0, 2)}`);
  await t2.close();
}
console.log(ok ? 'FIRSTRUN OK' : 'FIRSTRUN FAILED'); process.exit(ok ? 0 : 1);
