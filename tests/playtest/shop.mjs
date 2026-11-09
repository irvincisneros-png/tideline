// The economy and the tackle shop, in real Chrome. Credits from a logbook record (+ a tag-and-release) and from a litter pull (Fatima's tally); the club comp (Bev);
// Mitra's shop: open it from her talk menu, buy a rod, equip it and check the catch-bar zone grew; a locked rod stays locked; the "can't sell your catch" lesson and the
// one-time shop tip; the tackle box's bait counts and collecting; the release outcome with the release weight; the recapture letter; keyboard and 375 px layout.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/shop.mjs [high|low] [narrow]
//   narrow = 375x700 (a phone's width), otherwise 1280x760. Screenshots go to playtest-shots/shop/<quality>[-375]/. Exits 0 only if every check passed and there were no console errors.
import { launch } from './harness.mjs';

const quality = process.argv[2] ?? 'high', narrow = process.argv[3] === 'narrow';
const tag = `${quality}${narrow ? '-375' : ''}`;
const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; };
process.on('uncaughtException', e => { for (const l of log) console.log(...l); console.log('EXCEPTION', String(e).slice(0, 400)); process.exit(1); });
const errors = [];

async function session(site, fn) {
  const t = await launch({ query: `eco=${site}&quality=${quality}&play=1&time=day&tide=rising&season=summer&officer=0`, outDir: `playtest-shots/shop/${tag}`, width: narrow ? 375 : 1280, height: narrow ? 700 : 760 });
  const page = t.page, ev = (f, a) => page.evaluate(f, a);
  const H = {
    t, page, ev,
    shot: n => t.shot(`${site}-${n}`),
    waitSel: (sel, ms = 6000) => page.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false),
    clearToasts: () => ev(() => { document.querySelector('#toast').innerHTML = ''; }),
    coins: () => ev(() => window.__game.progress.coins),
    chip: () => ev(() => document.querySelector('#stat-chip').innerText.replace(/\s+/g, ' ')),
    async stand(id, dx = 1.7, dz = 1.7) {
      const p = await ev(i => { const n = window.__game.npcs.byId[i]; return n && !n.away ? [n.pos.x, n.pos.z] : null; }, id);
      if (!p) return false;
      await t.teleport(p[0] + dx, p[1] + dz, { camYaw: 0, zoom: narrow ? 11 : 9 }); await t.wait(500); return true;
    },
    dlgText: () => ev(() => document.querySelector('#dialogue:not(.hidden) .dlg-text')?.innerText ?? null),
    dlgOpen: () => ev(() => !!document.querySelector('#dialogue:not(.hidden)')),
    async through(max = 8) { for (let i = 0; i < max; i++) { const n = await page.$('#dialogue:not(.hidden) .dlg-next'); if (!n) return; await n.click(); await t.wait(120); } },
    async choose(label) { const b = page.locator('#dialogue .dlg-choice', { hasText: label }).first(); await b.waitFor({ timeout: 4000 }); await b.click(); await t.wait(180); },
    async talk(id) { await H.stand(id); await H.clearToasts(); await page.keyboard.press('e'); await t.wait(500); if (!(await H.dlgOpen())) return false; await H.through(); return true; },
    async bye() { for (let i = 0; i < 12 && (await H.dlgOpen()); i++) { const bye = page.locator('#dialogue .dlg-choice').filter({ hasText: 'Bye' }); const back = page.locator('#dialogue .dlg-choice').filter({ hasText: /Back/ }); if (await bye.count()) await bye.first().click(); else if (await back.count()) await back.first().click(); else { const n = await page.$('#dialogue:not(.hidden) .dlg-next'); if (n) await n.click(); } await t.wait(160); } },
    /** Land a fish directly (no waiting for a bite): the catch flow starts when the angler has held it up. */
    async land(id, length) { await ev(([i, l]) => { const g = window.__game, f = g.fishing; f.state = 'fight'; f.spot = g.eco.id === 'rocky' ? 'beach' : 'jetty'; f.catch = { id: i, length: l, gear: 1 }; f.ctx = g.biteContext(); f.float.visible = false; f.land(); }, [id, length]); await t.wait(1900); },
    async runKey(id) {
      const answers = await ev(async id => { const K = await import('/src/fishing/key.js'), S = await import('/src/fishing/species.js'); return K.pathTo(K.KEY, S.SPECIES_BY_ID[id]); }, id);
      check(await H.waitSel('.key-grid'), 'the key opens for a new species'); await t.wait(400);
      for (let i = 0; i < 12; i++) { if (await page.$('#key-ok')) break; await page.click(`.opt[data-a="${answers[i] ?? 'a'}"]`); await t.wait(100); }
      await page.click('#key-ok'); await t.wait(300);
    },
    async measure(target) {
      check(await H.waitSel('#mat-board'), 'the brag mat opens'); await t.wait(450);
      const geo = await ev(() => { const i = document.querySelector('#mat-fish').getBoundingClientRect(), b = document.querySelector('#mat-board').getBoundingClientRect(); return { x0: i.left, pxcm: i.width / window.__game.catchFlow.c.length, y: b.top + b.height / 2 }; });
      await page.mouse.move(geo.x0 + 20, geo.y); await page.mouse.down(); await page.mouse.move(geo.x0 + target * geo.pxcm, geo.y, { steps: 6 }); await page.mouse.up();
      for (let i = 0; i < 14; i++) { const v = +(await ev(() => document.querySelector('#mr').textContent)); if (v === target) break; await page.click(v < target ? '#m-plus' : '#m-minus'); }
      await page.click('#m-lock'); await t.wait(250); await page.click('#m-next'); await t.wait(250); if (await page.$('#pb-ok')) { await page.click('#pb-ok'); await t.wait(200); }   // a personal best: its card comes before keep / release
    },
  };
  try { await t.wait(1200); await fn(H); } finally { errors.push(...t.errors.filter(e => !/favicon/.test(e))); await t.close(); }
}

const overflow = H => H.ev(() => { const p = document.querySelector('#modal .panel'); return p.scrollWidth - p.clientWidth; });

// ============================================================================ Lake Illawarra: a record + a tag, the shop, the lesson
await session('seagrass', async H => {
  const { t, page, ev } = H;
  await t.teleport(16, 21, { camYaw: 0.15, heading: Math.PI, zoom: narrow ? 12 : 14 });
  await H.clearToasts();
  const start = await H.coins();
  check(start === 20, `a new save starts with ${start} credits`);
  check(/🪙 20/.test(await H.chip()), `the HUD chip shows credits next to Esky and Steward: "${await H.chip()}"`);
  await H.shot('01-hud-start');

  // --- earn: a complete, accurate logbook record, tagged and released quickly with Dr Priya's kit
  await ev(async () => { const I = await import('/src/npc/inventory.js'); I.grant(window.__game.progress, 'tool-tagkit'); window.__game.persist(); });   // earned from Dr Priya (npcs.mjs); scripted here
  await H.land('yellowfinbream', 25);
  await H.runKey('yellowfinbream');
  await H.measure(25);
  check(await H.waitSel('#fx-release'), 'keep or release opens'); await page.click('#fx-release'); await t.wait(300);
  check(await H.waitSel('#v-next'), 'verdict'); await page.click('#v-next'); await t.wait(300);
  check(await H.waitSel('#rel-hold'), 'the quick release opens');
  const hasTag = await ev(() => !!document.querySelector('#rel-tag'));
  check(hasTag, 'the tag kit adds a "Tag it" button to the release step');
  await page.click('#rel-wet'); await page.click('#rel-tag'); await t.wait(300);
  await H.shot('02-release-step');
  const hb = await (await page.$('#rel-hold')).boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await t.wait(1900); await page.mouse.up();
  check(await H.waitSel('#r-next', 3000), 'unhooked and released');
  const rel = await ev(() => document.querySelector('#modal-body').innerText);
  check(/Estimated survival/.test(rel), 'the release outcome shows an estimated survival');
  check(/\+35 credits/.test(rel) && /Logbook record/.test(rel) && /First record of this species/.test(rel) && /Tag and release/.test(rel), `the payout card itemises record 6 + first species 15 + new combo 4 + tag 10 = 35: ${rel.match(/\+\d+ credits/)?.[0]}`);
  check(/never from selling fish|can't sell/i.test(rel), 'and says credits never come from selling fish');
  await H.shot('03-release-payout');
  await page.click('#r-next'); await t.wait(500);
  check((await H.coins()) === start + 35, `credits ${start} -> ${await H.coins()}`);
  check(/🪙 55/.test(await H.chip()), 'the HUD chip updated');
  check(await ev(() => window.__game.progress.econ.tags.length === 1), 'tag no. T-1001 is in the tagging database');
  // A second record of the same fish pays only the base (no first-species bonus)
  await H.land('yellowfinbream', 27);   // already identified: it goes straight to the mat
  await H.measure(27); await page.click('#fx-release'); await t.wait(300); await page.click('#v-next'); await t.wait(300);
  await page.click('#rel-wet'); const hb2 = await (await page.$('#rel-hold')).boundingBox();
  await page.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2); await page.mouse.down(); await t.wait(1900); await page.mouse.up(); await H.waitSel('#r-next', 3000);
  const rel2 = await ev(() => document.querySelector('#modal-body').innerText);
  check(/\+6 credits/.test(rel2) && !/First record/.test(rel2), 'a second record of the same species and combination pays only the base');
  await page.click('#r-next'); await t.wait(400);
  const afterTwo = await H.coins();

  // --- set up the Guide for the tier-2 rod (scripted: three species Identified) and give the bank some credits
  await ev(() => { const g = window.__game, p = g.progress; for (const id of ['tailor', 'sandwhiting']) { const e = (p.guide.e[id] ??= {}); e.seen = { t: 1, src: 'x' }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; } p.coins = 200; g.persist(); g.updateStats(); });

  // --- the zone before buying
  const zone = () => ev(() => { const g = window.__game, f = g.fishing; f.catch = { id: 'yellowfinbream', length: 25, gear: 1 }; f.dist = 8; f.startFight(); const z = f.bar.zoneH, dm = f.bar.drainMul; f.stop(); f.state = 'off'; return { z, dm, rod: g.gearStats().rodId }; });
  const z1 = await zone();
  check(z1.rod === 'rod-1', 'you start with the starter rod'); await t.wait(200);

  // --- Mitra's shop from her talk menu
  check(await H.talk('mitra'), 'E opens a conversation with Mitra');
  check(await ev(() => /Shop/.test(document.querySelector('#dialogue').innerText)), 'her menu has a Shop option');
  await H.shot('04-mitra-menu');
  await H.choose('Shop'); await H.through(2);
  check(await H.waitSel('.shop'), 'the shop panel opens'); await t.wait(400);
  check(await ev(() => !document.querySelector('.shop-tip')), 'no "can\'t sell" tip yet: the esky is empty');
  await H.shot('05-shop-rods');
  check((await overflow(H)) <= 1, `no sideways scroll in the shop (${await overflow(H)}px)`);
  const btnH = await ev(() => Math.min(...[...document.querySelectorAll('.shop .btn, .shop-tabs button')].map(b => b.getBoundingClientRect().height)));
  check(btnH >= 44, `touch targets are big enough (smallest ${btnH.toFixed(0)}px)`);
  check(await ev(() => document.querySelectorAll('.shop-card').length === 4), 'four rod tiers');
  // locks: the top rod needs Mastery
  check(await ev(() => /Locked|🔒/.test(document.querySelector('.shop-card [data-id="rod-4"]').closest('.shop-card').innerText)), 'the top rod shows a lock');
  await page.click('[data-id="rod-4"]', { force: true }); await t.wait(150);
  check(/Master|Locked/.test(await ev(() => document.querySelector('#shop-msg').innerText)), 'clicking it says what unlocks it'); check((await H.coins()) === 200, 'and takes no credits');
  await H.shot('06-locked-message');
  // buy and equip the tier-2 rod
  await page.click('[data-id="rod-2"]'); await t.wait(250);
  check((await H.coins()) === 200 - 60, `bought: credits 200 -> ${await H.coins()}`);
  check(await ev(() => window.__game.gearStats().rodId === 'rod-2'), 'the new rod is equipped');
  check(await ev(() => /Equipped/.test(document.querySelector('[data-id="rod-2"]').innerText)), 'its card says Equipped ✓');
  await H.shot('07-bought-rod');
  const z2 = await zone();
  check(z2.z > z1.z * 1.08 && z2.rod === 'rod-2', `the catch-bar zone grew with the rod: ${z1.z.toFixed(3)} -> ${z2.z.toFixed(3)}`);
  check(z2.dm < z1.dm, `and the meter drains slower (${z1.dm} -> ${z2.dm})`);
  // other tabs
  for (const tab of ['line', 'bait', 'conservation', 'style', 'earn']) {
    await page.click(`#tab-${tab}`); await t.wait(200);
    check((await overflow(H)) <= 1, `${tab} tab: no sideways scroll`);
    await H.shot(`08-tab-${tab}`);
  }
  check(await ev(() => /can't sell your catch/i.test(document.querySelector('.earn-law').innerText)), 'the Earn credits tab says you can\'t sell your catch');
  // keyboard: arrows move between tabs, Tab reaches the buttons, Esc closes
  await page.focus('#tab-earn'); await page.keyboard.press('ArrowRight'); await t.wait(150);
  check(await ev(() => document.activeElement.id === 'tab-rod'), 'ArrowRight moves along the tabs (wraps round)');
  await page.keyboard.press('Tab'); await t.wait(50);
  check(await ev(() => !!document.activeElement.closest('.shop')), 'Tab moves through the shop');
  await page.click('#tab-bait'); await page.focus('[data-id="pack-pilchard"]'); await page.keyboard.press('Enter'); await t.wait(250);
  check(await ev(() => window.__game.progress.shop.bait.pilchard === 10), 'a bait pack can be bought from the keyboard (Enter)');
  await page.keyboard.press('Escape'); await t.wait(300);
  check(await ev(() => !window.__game.panels.isOpen), 'Esc closes the shop');
  check(await H.dlgOpen(), 'and Mitra\'s menu comes back'); await H.bye();

  // --- tackle box: bait counts and collecting
  await t.teleport(16, 21, { camYaw: 0.15, heading: Math.PI, zoom: narrow ? 12 : 14 });
  await page.keyboard.press('t'); await t.wait(400);
  check(await ev(() => document.querySelectorAll('.tb-n').length >= 3), 'the tackle box shows how much of each bait is left');
  check(await ev(() => /collect your own bait/i.test(document.querySelector('.tb').innerText)), 'and a "Collect your own bait" section');
  check(await ev(() => { const b = document.querySelector('[data-collect="nipper"]'); return b && b.disabled; }), 'nippers are disabled without the pump');
  await H.shot('09-tackle-box');
  await page.keyboard.press('t'); await t.wait(250);
  await ev(() => { const g = window.__game; g.gear.bait = 'prawn'; const before = g.progress.shop.bait.prawn; g.useBait(); window.__lastBait = [before, g.progress.shop.bait.prawn]; });
  check(await ev(() => window.__lastBait[1] === window.__lastBait[0] - 1), 'a bite uses one bait');

  // --- the lesson: a kept fish in the esky, then try to sell it
  await H.land('tailor', 31);   // identified by the scripted Guide state: straight to the mat
  await H.measure(31); await page.click('#fx-keep'); await t.wait(300);
  const verdict = await ev(() => document.querySelector('#modal-body').innerText);
  check(/credits/.test(verdict) && /legal keep/i.test(verdict), 'a legal keep also shows what the record earned');
  await H.shot('10-keep-payout');
  await page.click('#v-next'); await t.wait(400);
  const credsBeforeSell = await H.coins();
  check(await ev(() => window.__game.progress.esky.length === 1), 'a fish is in the esky');
  await H.shot('11-esky-hud');
  check(await H.talk('mitra'), 'back to Mitra');
  check(await ev(() => /Sell my fish/.test(document.querySelector('#dialogue').innerText)), 'her menu now offers "Sell my fish"');
  await H.choose('Sell my fish'); await t.wait(200);
  check(/cannot/i.test(await H.dlgText()), 'she says she cannot buy it'); await H.shot('12-sell-lesson-1');
  await H.through(1); const l2 = await H.dlgText(); check(/cannot sell/i.test(l2), 'NSW recreational fishers cannot sell their catch'); await H.shot('12-sell-lesson-2');
  await H.through(1); check(/commercial licence/i.test(await H.dlgText()), 'a commercial licence is a different job');
  await H.through(1); const l3 = await H.dlgText(); check(/logbook record/i.test(l3) && /citizen scientist/i.test(l3), 'the lesson points to logbook records'); await H.shot('12-sell-lesson-3');
  await H.through(1); const l4 = await H.dlgText(); check(/tag/i.test(l4) && /comp/i.test(l4) && /litter/i.test(l4), 'and tagging, the club comp and litter'); await H.shot('12-sell-lesson-4');
  await H.through(1);
  check(/shop/i.test(await H.dlgText()), 'then she offers the shop');
  check((await H.coins()) === credsBeforeSell, 'no credits for the fish: the lesson paid nothing');
  await H.choose('Show me the shop'); await H.through(2);
  check(await H.waitSel('.shop'), 'the shop opens from the lesson'); await t.wait(300);
  check(await ev(() => !!document.querySelector('.shop-tip') && /can't sell/i.test(document.querySelector('.shop-tip').innerText)), 'the one-time tip: fish in your esky can\'t be sold');
  await H.shot('13-shop-tip');
  await page.click('#shop-done'); await t.wait(300); await H.bye();
  await H.talk('mitra'); await H.choose('Shop'); await H.through(2); await H.waitSel('.shop');
  check(await ev(() => !document.querySelector('.shop-tip')), 'the tip shows only once'); await page.click('#shop-done'); await t.wait(250); await H.bye();

  // --- the recapture letter (the chance is rolled at the start of an outing; shown here directly)
  await ev(async () => { const m = await import('/src/ui/shop.js'), g = window.__game; m.showRecaptureLetter(g, { tag: { no: 'T-1001', length: 25 }, species: 'Yellowfin bream', days: 3, grew: 1, km: 6, place: 'Lake Illawarra entrance', bonus: 25 }); });
  await t.wait(500); check(await ev(() => /What a recapture tells scientists/.test(document.querySelector('.letter').innerText)), 'the recapture letter explains what recaptures tell scientists');
  await H.shot('14-recapture-letter'); await page.click('#letter-done'); await t.wait(300);
  const fps = await ev(() => window.__game.fps); check(fps == null || fps >= (quality === 'low' ? 45 : 30), `fps ${fps}`);
  log.push(['info', `credits: start ${start}, after two records ${afterTwo}`]);
});

// ============================================================================ Bellambi: litter -> Fatima's tally, Bev's comp, the release weight
await session('rocky', async H => {
  const { t, page, ev } = H;
  await H.clearToasts();
  const c0 = await H.coins();
  // --- a litter pull: the catch bar's green zone collects litter (game.onLitter is what the bar calls)
  await ev(() => { const g = window.__game; g.onLitter('line'); g.onLitter('bag'); g.onLitter('bag'); });
  check(await ev(() => window.__game.progress.steward.litter === 3), 'three pieces of litter pulled out of the water');
  check(await H.talk('fatima'), 'Fatima is at the beach clean-up');
  check(await ev(() => /Clean-up tally/.test(document.querySelector('#dialogue').innerText)), 'her menu has a Clean-up tally');
  await H.choose('Clean-up tally'); await t.wait(250);
  const tl = await H.dlgText(); check(/3 pieces/.test(tl) && /6 credits/.test(tl), `she pays for the tally: ${tl?.slice(0, 80)}`);
  await H.shot('01-fatima-tally'); await H.through(); await H.bye();
  check((await H.coins()) === c0 + 6, `litter pays 2 a piece: ${c0} -> ${await H.coins()}`);
  check(/🪙 26/.test(await H.chip()), 'the HUD chip shows it');
  // the same pieces are not paid twice
  await H.talk('fatima'); await H.choose('Clean-up tally'); await H.through(); await H.bye();
  check((await H.coins()) === c0 + 6, 'the same litter is not paid twice');

  // --- Bev's club comp
  check(await H.talk('bev'), 'Bev is at the club board');
  await H.choose("club comp"); await t.wait(200);
  const ct = await H.dlgText(); check(/Most species released/.test(ct) && /Prizes/.test(ct), 'today\'s comp and its prizes are on the board'); await H.shot('02-bev-comp');
  await H.choose('Enter the comp'); await H.through(3); await H.bye();
  check(await ev(() => !!window.__game.progress.econ.comp), 'entered the comp');
  // two species released well count; then head home to settle
  await ev(() => { const g = window.__game, p = g.progress; for (const [id, n] of [['tailor', 31], ['australiansalmon', 40]]) { const e = (p.guide.e[id] ??= {}); e.seen = { t: 1 }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; p.catches.push({ eco: 'rocky', id, length: n, kept: false, wet: true, air: 5, accurate: true, correct: true, legal: true, kind: 'ok', time: Date.now() + 5, spot: 'beach', tide: 'rising', daytime: 'day', outing: p.outing?.id }); } g.persist(); });
  await H.talk('bev'); await H.choose('club comp'); const st = await H.dlgText(); check(/score so far: 2 species/.test(st), `your score so far is shown: ${st?.replace(/\s+/g, ' ').slice(-120)}`); await H.through(); await H.bye();
  const before = await H.coins();
  await ev(() => window.__game.outing.ask()); await t.wait(300); await page.click('#home-go'); await t.wait(1200);
  const sum = await ev(() => document.querySelector('.summary')?.innerText ?? '');
  check(/Club comp/.test(sum) && /Most species released/.test(sum), 'the outing summary shows the comp result');
  check(/Club credits earned/.test(sum), 'and the credits earned this outing');
  await H.shot('03-summary');
  const prize = (await H.coins()) - before; check(prize === 5 || prize === 15 || prize === 25 || prize === 40, `the comp paid its prize by place (${prize})`);
  await page.click('#sum-again'); await t.wait(800);
  check(await ev(() => window.__game.progress.econ.compDone?.day != null), 'the comp is settled once');

  // --- the release weight raises survival for a deep-water fish (the release outcome shows it)
  await ev(async () => { const I = await import('/src/npc/inventory.js'); I.grant(window.__game.progress, 'tool-releaseweight'); const g = window.__game, p = g.progress; const e = (p.guide.e.snapper ??= {}); e.seen = { t: 1 }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; g.persist(); });
  await H.land('snapper', 40); await H.measure(40); await page.click('#fx-release'); await t.wait(300); await page.click('#v-next'); await t.wait(300);
  check(await ev(() => !!document.querySelector('#rel-weight')), 'a deep-water fish offers the release weight');
  await page.click('#rel-wet'); await page.click('#rel-weight'); await t.wait(200);
  const hb = await (await page.$('#rel-hold')).boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await t.wait(1900); await page.mouse.up(); await H.waitSel('#r-next', 3000);
  const rtxt = await ev(() => document.querySelector('#modal-body').innerText);
  check(/Release weight returned it to depth/.test(rtxt) && /Bay Health bonus/.test(rtxt), 'the outcome shows the release weight helping and a Bay Health bonus');
  const pctW = +rtxt.match(/Estimated survival: (\d+)%/)[1];
  await H.shot('04-release-weight');
  await page.click('#r-next'); await t.wait(400);
  // the same fish without the weight
  await H.land('snapper', 41); await H.measure(41); await page.click('#fx-release'); await t.wait(300); await page.click('#v-next'); await t.wait(300);
  await page.click('#rel-wet'); const hb2 = await (await page.$('#rel-hold')).boundingBox();
  await page.mouse.move(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2); await page.mouse.down(); await t.wait(1900); await page.mouse.up(); await H.waitSel('#r-next', 3000);
  const pctN = +(await ev(() => document.querySelector('#modal-body').innerText)).match(/Estimated survival: (\d+)%/)[1];
  check(pctW > pctN + 15, `survival with the weight ${pctW}% vs without ${pctN}%`);
  await H.shot('05-release-no-weight'); await page.click('#r-next'); await t.wait(300);

  // --- the fine measuring mat: half-centimetre marks and steps
  await ev(() => { window.__game.progress.shop.owned['tool-finemat'] = Date.now(); });
  await H.land('tailor', 31);
  check(await H.waitSel('#mat-board'), 'the mat opens'); await t.wait(450);
  check(await ev(() => /0\.5 cm/.test(document.querySelector('#m-minus').innerText) && /0\.5 cm/.test(document.querySelector('#m-plus').innerText)), 'the fine mat steps in half centimetres');
  const r0 = +(await ev(() => document.querySelector('#mr').textContent)); await page.click('#m-plus'); await t.wait(100);
  check(+(await ev(() => document.querySelector('#mr').textContent)) === r0 + 0.5, `one press moves the marker 0.5 cm (${r0} -> ${r0 + 0.5})`);
  await H.shot('06-fine-mat');
  await H.measure(31); await page.click('#fx-keep'); await t.wait(300); await page.click('#v-next'); await t.wait(300);
});

for (const l of log) console.log(...l);
const real = errors.filter(e => !/ERR_BLOCKED|Failed to load resource.*(favicon)/.test(e));
check(real.length === 0, `zero console errors${real.length ? ': ' + real.slice(0, 3).join(' | ').slice(0, 300) : ''}`);
console.log(log.at(-1).join(' '));
console.log(ok ? `PASS shop playtest (${tag})` : `FAIL shop playtest (${tag})`);
process.exit(ok ? 0 : 1);
