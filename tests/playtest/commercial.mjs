// Phase 7 playtest: the commercial post-game at Belmore Basin. Nell (the co-op fisher):
//   1 before you qualify she has no licence on offer (the teaser says what is needed); 2 after the ending (scripted save) she offers the co-op licence and you sign it
//   3 the co-op panel: Nets lab (gear, mesh slider, BRD, TED, goals), Sell (a haul, the sale in CO-OP credits, the esky that can never be sold, the recreational vs commercial table),
//     Sustainability (statuses, quotas, swaps, GoodFish pointer), Boat (on-board tech)
//   4 Club credits never move, and the shop has no fish on sale
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/commercial.mjs [high|low] [narrow|phone|phonep]
//   narrow = 375 px wide desktop; phone = 812x375 touch (taps); phonep = 375x812 portrait touch (the panel layout, opened from the title). Screenshots in playtest-shots/commercial/<tag>/.
import { launch } from './harness.mjs';
import { nearComplete, finishLast } from './saves.mjs';

const quality = process.argv[2] ?? 'high', mode = process.argv[3] ?? '', narrow = mode === 'narrow', phone = mode === 'phone', phonep = mode === 'phonep';
const touch = phone || phonep, tag = `${quality}${narrow ? '-375' : phone ? '-phone' : phonep ? '-phone-portrait' : ''}`;
const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; if (process.env.DBG) console.log(cond ? 'ok  ' : 'FAIL', msg); };
process.on('uncaughtException', e => { for (const l of log) console.log(...l); console.log('EXCEPTION', String(e).slice(0, 400)); process.exit(1); });
const t = await launch({ query: `eco=harbour&quality=${quality}&time=day&season=summer&tide=rising&swell=1&officer=0${phonep ? '' : '&play=1'}`, outDir: `playtest-shots/commercial/${tag}`, width: narrow ? 375 : 1280, height: narrow ? 760 : 760, phone: phone ? { w: 812, h: 375 } : phonep ? { w: 375, h: 812 } : null });
const page = t.page, ev = (f, a) => page.evaluate(f, a);
const press = sel => (touch ? page.tap(sel, { force: true }) : page.click(sel, { force: true }));   // force: aria-disabled buttons stay clickable on purpose (they explain why)
const waitFor = (sel, ms = 8000) => page.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const text = sel => ev(s => document.querySelector(s)?.innerText ?? '', sel);
const club = () => ev(() => window.__game.progress.coins);
const co = () => ev(() => window.__game.progress.coop?.credits ?? 0);
const say = async (choice) => {   // advance the dialogue: pick a choice by text, or press the next button
  await page.waitForSelector('.dlg:not(.hidden) button', { timeout: 6000 });
  if (choice) { const idx = await ev(c => [...document.querySelectorAll('.dlg .dlg-choice')].findIndex(b => b.innerText.includes(c)), choice); if (idx >= 0) { await press(`.dlg .dlg-choice >> nth=${idx}`); await t.wait(350); return true; } }
  await press('.dlg button >> nth=0'); await t.wait(350); return false;
};

await t.wait(1200);
// the panel layout on a portrait phone is tested from the title screen (the game itself asks for landscape on a phone)
if (phonep) {
  await nearComplete(page, { leave: 'carp' }); await finishLast(page, 'carp');
  await ev(() => { const g = window.__game; g.progress.ending.awards = Date.now(); g.persist(); });
  await ev(async () => { const C = await import(new URL('src/economy/commercial.js', location.href).href); C.grantLicence(window.__game.progress); window.__game.openCoop(); });
  await t.wait(700);
  check(await waitFor('.coop', 3000), 'the co-op panel opens at 375x812 with touch');
  await t.shot('lab-top');
  await press('[data-gear="trawl"]'); await press('[data-act="run"]'); await t.wait(500);
  await t.shot('lab-result');
  await press('#ctab-sell'); await t.wait(300); await t.shot('sell');
  await press('#ctab-sustain'); await t.wait(300); await t.shot('sustain');
  const overflow = await ev(() => { const b = document.querySelector('.coop'); return b ? b.scrollWidth - b.clientWidth : 0; });
  check(overflow <= 2, `the panel does not scroll sideways (overflow ${overflow}px)`);
  check(t.errors.length === 0, `zero console errors (${t.errors.length})`);
  for (const l of log) console.log(...l);
  await t.close(); console.log(ok ? 'PASS' : 'FAIL'); process.exit(ok ? 0 : 1);
}

// ================================================================== 1. before you qualify
await ev(() => { const g = window.__game; g.progress.angler ??= { name: 'Kai', skin: 0xc58c5e, hairStyle: 'short', hair: 0x4a2f1d, hatStyle: 'straw', hat: 0xe9d9a6, sunnies: 'none', pattern: 'plain', shirt: 0xf0715a, shorts: 0x2f5496, rod: 0x3b525c }; g.angler.setAppearance(g.progress.angler); g.persist(); });
const toNell = async () => { await ev(() => { const g = window.__game, n = g.npcs.byId.nell; const x = n.pos.x + 1.2, z = n.pos.z - 1.2; g.walker.pos.set(x, g.world.walkAt(x, z), z); g.rig.focus.set(x, g.walker.pos.y + 0.9, z); }); await t.wait(1400); };
check(await ev(() => window.__game.eco.id === 'harbour' && window.__game.mode === 'land'), 'on the Belmore Basin quay');
await toNell();
check(await ev(() => window.__game.npcs.near?.id === 'nell'), 'Nell is in talking range at the co-op door');
await page.keyboard.press('e'); await t.wait(600);
await say(); await say();   // her two intro lines
let menu = await ev(() => [...document.querySelectorAll('.dlg .dlg-choice')].map(b => b.innerText));
check(menu.length > 0 && !menu.some(m => /Co-op licence|The co-op/.test(m)), `before the ending Nell offers no licence: ${JSON.stringify(menu)}`);
await say('Ask about'); const topics = await ev(() => [...document.querySelectorAll('.dlg .dlg-choice')].map(b => b.innerText));
const ti = topics.findIndex(x => /commercial licence/.test(x)); check(ti >= 0, 'the "Could I get a commercial licence" topic is there');
await press(`.dlg .dlg-choice >> nth=${ti}`); await t.wait(300);
const teaser = await text('.dlg .dlg-text'); check(/Identified|awards night/i.test(teaser), `the teaser says what is needed: "${teaser.slice(0, 120)}..."`);
await t.shot('nell-teaser');
await say(); await say(); await t.wait(200);
await ev(() => window.__game.dialogue.finish(0)); await ev(() => { window.__game.dialogue.hide(); });
await page.keyboard.press('Escape');

// ================================================================== 2. after the ending: the licence
await ev(() => window.__game.npcs.talk.game.dialogue.hide());
await nearComplete(page, { leave: 'carp' }); await finishLast(page, 'carp');
await ev(() => { const g = window.__game; g.progress.ending.awards = Date.now(); g.progress.esky = [{ id: 'duskyflathead', label: 'Dusky flathead', length: 52, legal: true, kind: 'ok' }, { id: 'snapper', label: 'Snapper', length: 38, legal: true, kind: 'ok' }]; g.persist(); g.updateStats(); });
const club0 = await club();
await ev(() => { const g = window.__game; g.mode = 'land'; });
await toNell();
await page.keyboard.press('e'); await t.wait(600);
await ev(() => { document.querySelector('#toast').innerHTML = ''; });
menu = await ev(() => [...document.querySelectorAll('.dlg .dlg-choice')].map(b => b.innerText));
check(menu.some(m => /Co-op licence/.test(m)), `after awards night Nell offers it: ${JSON.stringify(menu)}`);
await t.shot('nell-menu');
await say('Co-op licence');
for (let i = 0; i < 3; i++) await say();
const ask = await text('.dlg .dlg-text'); check(/Want the licence/.test(ask), 'she asks if you want the licence');
await t.shot('nell-licence');
await say('Sign the licence'); await t.wait(500);
check(await ev(() => !!window.__game.progress.coop.licence && window.__game.progress.coop.credits === 30), 'signing the licence gives the 30 co-op credit advance');
check(await club() === club0, 'Club credits did not change');
await say();   // "Right, ... Open the co-op"
check(await waitFor('.coop', 4000), 'the co-op panel opens');
await t.wait(500); await t.shot('lab-start');

// ================================================================== 3. the nets lab
const goal = () => ev(() => [...document.querySelectorAll('.goals li')].map(l => [l.classList.contains('ok'), l.innerText]));
await press('[data-gear="trawl"]'); await t.wait(200);
check(await ev(() => !!document.querySelector('#lab-brd') && !!document.querySelector('#lab-ted')), 'a trawl shows the BRD and TED options');
await press('[data-act="run"]'); await t.wait(700);
let goals = await goal();
check(goals.length === 4 && goals.some(g => !g[0]), `a plain trawl fails some goals: ${goals.filter(g => !g[0]).map(g => g[1].split('\n')[0]).join(' / ')}`);
const notes = await text('.notes'); check(/bycatch reduction device/i.test(notes) && /seabed/i.test(notes), 'the haul notes teach the BRD (compulsory in NSW prawn trawl) and the seabed');
await t.shot('lab-trawl-plain');
// mesh: too small keeps young fish, then the right mesh with BRD + TED passes
await ev(() => { const r = document.querySelector('#lab-mesh'); r.value = 20; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
await t.wait(200); await press('[data-act="run"]'); await t.wait(500);
const young20 = await ev(() => window.__game.progress.coop && [...document.querySelectorAll('.bar-row')].find(r => /Young/.test(r.innerText))?.querySelector('b')?.innerText);
check(+young20 > 5, `a 20 mm mesh keeps young fish (${young20})`);
await ev(() => { const r = document.querySelector('#lab-mesh'); r.value = 60; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
await t.wait(200);
await press('#lab-brd'); await t.wait(200); await press('#lab-ted'); await t.wait(200); await press('[data-act="run"]'); await t.wait(700);
goals = await goal(); check(goals.length === 4 && goals.every(g => g[0]), 'a 60 mm mesh with a BRD and a TED meets every goal');
check(await ev(() => /Well designed/.test(document.querySelector('.cert')?.innerText ?? '')), 'and earns the "Well designed" note');
check(await ev(() => !!window.__game.progress.coop.labPassed.shelf), 'the lab certificate is saved');
await t.shot('lab-trawl-good');
await press('[data-act="use"]'); await t.wait(300);
check(await ev(() => window.__game.progress.coop.method?.gear === 'trawl' && window.__game.progress.coop.method.mesh === 60 && window.__game.progress.coop.method.brd && window.__game.progress.coop.method.ted), "the method is saved as the boat's method");
await press('[data-gear="longline"]'); await t.wait(200); await press('[data-act="run"]'); await t.wait(500);
check(/Medium to High/.test(await text('.how')) && /seabirds/i.test(await text('.notes')), 'a longline shows its bycatch level and the seabirds it hooks');
await press('[data-gear="gillnet"]'); await t.wait(200);
check(await ev(() => !!document.querySelector('#lab-mesh') && !document.querySelector('#lab-brd')), 'a gill net has a mesh but no BRD');
await press('[data-gear="handline"]'); await t.wait(200);
check(await ev(() => !document.querySelector('#lab-mesh')), 'a handline has no mesh slider');
await press('[data-act="run"]'); await t.wait(500); await press('[data-act="use"]'); await t.wait(300);
check(await ev(() => window.__game.progress.coop.method.gear === 'handline'), 'handline set as the boat method');

// ================================================================== 4. sell at the co-op
await press('#ctab-sell'); await t.wait(400);
await t.shot('sell-start');
check(await ev(() => document.querySelectorAll('.mk').length === 7), 'the co-op lists 7 fish it will land');
const jam = await ev(() => { const m = [...document.querySelectorAll('.mk')].find(x => /Jackass/.test(x.innerText)); return { closed: m.classList.contains('closed'), text: m.innerText }; });
check(jam.closed && /Depleted/.test(jam.text) && /Closed/.test(jam.text) && /Snapper/.test(jam.text), 'depleted jackass morwong is closed, with the snapper swap from the dataset');
await press('[data-haul="jackassmorwong"]'); await t.wait(300);
check(/closure/i.test(await text('.reply')), 'trying to haul a depleted fish explains the closure');
await press('[data-haul="snapper"]'); await t.wait(500);
const reply = await text('.reply'); check(/Haul in!/.test(reply) && /landed/.test(reply), `a haul lands fish: "${reply.slice(0, 90)}"`);
check(await ev(() => window.__game.progress.coop.hold.length === 1 && window.__game.progress.coop.hold[0].origin === 'commercial'), 'the hold has a commercial lot');
const before = await co();
await t.shot('sell-hold');
await press('[data-act="sell"]'); await t.wait(500);
const after = await co();
check(after > before && /Sold!/.test(await text('.reply')), `selling pays co-op credits (${before} -> ${after})`);
check(await club() === club0, 'Club credits are still the same: the two currencies are separate');
await press('[data-act="trysell"]'); await t.wait(400);
check(/No sale/.test(await text('.reply')) && /never/i.test(await text('.reply')) && (await ev(() => window.__game.progress.esky.length)) === 2, 'trying to sell the recreational esky is refused and the esky is untouched');
check(/Recreational/.test(await text('.vs')) && /Commercial/.test(await text('.vs')), 'the recreational vs commercial table is there');
await t.shot('sell-refused');
// ================================================================== 5. sustainability and the boat
await press('#ctab-sustain'); await t.wait(400);
const sus = await text('.coop [role="tabpanel"]');
check(/316 of 503/.test(sus) && /63%/.test(sus) && /Recovering/.test(sus) && /goodfish\.org\.au/.test(sus) && /Tailor/.test(sus), 'sustainability: the SAFS gauge, the six statuses, the swaps and the GoodFish pointer');
check(!/ITQ/.test(sus), 'no ITQ claims');
await t.shot('sustain');
await press('#ctab-boat'); await t.wait(400);
await ev(async () => { const C = await import(new URL('src/economy/commercial.js', location.href).href); C.addCommercial(window.__game.progress, 200, 'advance'); window.__game.openCoop({ tab: 'boat' }); });
await t.wait(500);
await press('[data-up="sonar"]'); await t.wait(300);
check(await ev(() => !!window.__game.progress.coop.upgrades.sonar), 'a sonar can be bought with co-op credits');
await t.shot('boat');
await press('#coop-done'); await t.wait(500);
check(await ev(() => !window.__game.panels.isOpen), 'Done closes the co-op');
check(await club() === club0, 'Club credits never moved in the whole chapter');
// the shop has no fish
check(await ev(async () => { const S = await import(new URL('src/content/shop.js', location.href).href); return !S.SHOP.some(i => /fish|catch|sell/i.test(Object.keys(i).join(' '))); }), "Mitra's shop sells no fish");

check(t.errors.length === 0, `zero console errors (${t.errors.length}${t.errors.length ? ': ' + t.errors.slice(0, 3).join(' || ').slice(0, 300) : ''})`);
for (const l of log) console.log(...l);
await t.close();
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
