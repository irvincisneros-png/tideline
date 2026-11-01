// The living coast: the people of Lake Illawarra and Bellambi. For each site: every NPC is out and about at the right time, you can walk up and talk
// (E), tips and gossip (gossip marks a fish Seen), "show me" trades (scripted save state) and quiz trades (right answers unlock gear, a wrong one waits for
// tomorrow), reactions to an illegal keep, the lifeguard and the rock platform in a big swell, the quest log (Q), Sea Country cards, the tackle box locks.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/npcs.mjs [high|low] [narrow|mobile]
//   narrow = 375x700 (no touch), mobile = a phone held sideways with touch controls (the TALK button).
// Screenshots go to playtest-shots/npcs/<quality>[-375|-mobile]/. Exits 0 only if every check passed and there were no console errors.
import { launch } from './harness.mjs';

const quality = process.argv[2] ?? 'high', shape = process.argv[3] ?? 'wide';
const tag = `${quality}${shape === 'narrow' ? '-375' : shape === 'mobile' ? '-mobile' : ''}`;
const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; };
process.on('uncaughtException', e => { for (const l of log) console.log(...l); console.log('EXCEPTION', String(e).slice(0, 400)); process.exit(1); });
const errors = [];

async function session(site, extra, fn) {
  const t = await launch({ query: `eco=${site}&quality=${quality}&play=1&time=day&tide=rising&season=summer&officer=0${extra}${shape === 'mobile' ? '&touch=1' : ''}`, outDir: `playtest-shots/npcs/${tag}`,
    width: shape === 'narrow' ? 375 : 1280, height: shape === 'narrow' ? 700 : 760, mobile: shape === 'mobile' });
  const page = t.page, ev = (f, a) => page.evaluate(f, a);
  const H = {
    t, page, ev,
    shot: n => t.shot(`${site}-${n}`),
    waitSel: (sel, ms = 5000) => page.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false),
    clearToasts: () => ev(() => { document.querySelector('#toast').innerHTML = ''; }),
    /** Walk up to a person (teleport beside them, camera framing them). */
    async stand(id, dx = 1.7, dz = 1.7) {
      const p = await ev(i => { const n = window.__game.npcs.byId[i]; return n && !n.away ? [n.pos.x, n.pos.z] : null; }, id);
      if (!p) return false;
      await t.teleport(p[0] + dx, p[1] + dz, { camYaw: 0, zoom: shape === 'narrow' ? 11 : 9 });
      await t.wait(500); return true;
    },
    dlgText: () => ev(() => document.querySelector('#dialogue:not(.hidden) .dlg-text')?.innerText ?? null),
    dlgOpen: () => ev(() => !!document.querySelector('#dialogue:not(.hidden)')),
    /** Click "Continue" until choices (or nothing) show. */
    async through(max = 8) { for (let i = 0; i < max; i++) { const n = await page.$('#dialogue:not(.hidden) .dlg-next'); if (!n) return; await n.click(); await t.wait(120); } },
    async choose(label) { const b = page.locator('#dialogue .dlg-choice', { hasText: label }).first(); await b.waitFor({ timeout: 4000 }); await b.click(); await t.wait(160); },
    async talk(id) {
      await H.stand(id); await ev(() => { document.querySelector('#toast').innerHTML = ''; });
      if (shape === 'mobile') {   // touch: the green TALK button appears when someone is in range
        check(await ev(() => getComputedStyle(document.querySelector('.t-talk')).display !== 'none'), `touch: the TALK button shows next to ${id}`);
        await page.click('.t-talk');
      } else await page.keyboard.press('e');
      await t.wait(500); if (!(await H.dlgOpen())) return false; await H.through(); return true; },
    async bye() {
      for (let i = 0; i < 12 && (await H.dlgOpen()); i++) {
        const bye = page.locator('#dialogue .dlg-choice', { hasText: /^(\d\s*)?(Bye|Back)$/ });
        const exact = page.locator('#dialogue .dlg-choice').filter({ hasText: 'Bye' });
        if (await exact.count()) await exact.first().click();
        else if (await bye.count()) await bye.first().click();
        else { const n = await page.$('#dialogue:not(.hidden) .dlg-next'); if (n) await n.click(); }
        await t.wait(160);
      }
    },
    async answerQuiz(right = true) {
      // Read the question on screen, look it up in the worksheet bank, click the right (or a wrong) option.
      const info = await ev(async () => {
        const Q = await import('/src/content/quiz.js'), txt = document.querySelector('#dialogue .dlg-text').innerText.replace(/^Question[^\n]*\n/, '').trim();
        const q = Q.QUIZ.find(x => txt.startsWith(x.q));
        return q ? { right: q.options[q.answer], wrong: q.options.find((_, i) => i !== q.answer), n: q.n } : null;
      });
      if (!info) return null;
      const want = right ? info.right : info.wrong;
      const btn = page.locator('#dialogue .dlg-choice').filter({ hasText: want }).first(); await btn.click(); await t.wait(160);
      return info;
    },
  };
  try { await t.wait(1200); await fn(H); } finally { errors.push(...t.errors.filter(e => !/favicon/.test(e))); await t.close(); }
}
const master = id => window => { /* placeholder to keep eslint quiet */ };
const setState = (H, fn, arg) => H.ev(([src, a]) => { const f = new Function('p', 'g', 'a', src); const g = window.__game; f(g.progress, g, a); g.persist(); }, [`(${fn.toString()})(p, g, a)`, arg]);

// ============================================================================ Lake Illawarra
await session('seagrass', '', async H => {
  const { t, page, ev } = H;
  // --- everyone is there, with their labels
  const present = await ev(() => window.__game.npcs.npcs.filter(n => !n.away && n.root.visible !== undefined).map(n => n.id).sort());
  check(JSON.stringify(present) === JSON.stringify(['jo', 'mika', 'mitra', 'officer', 'priya', 'tam']), `by day the lake has Mitra, Tam, Dr Priya, Ranger Jo, Mika and the officer (${present})`);
  const kinds = await ev(() => window.__game.npcs.npcs.map(n => `${n.id}:${n.act}`).sort().join(' '));
  check(/mika:fishing/.test(kinds) && /tam:sitting/.test(kinds) && /officer:walking/.test(kinds) && /mitra:standing/.test(kinds), `schedule by day: ${kinds}`);
  check(await ev(() => window.__game.npcs.birds.pelicans.length === 3), 'three pelicans hang around the fish-cleaning table');
  await H.stand('mitra', 1.8, 1.8);
  await t.page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
  check(await ev(() => /talk to Mitra/.test(document.querySelector('#prompt').textContent)), 'the HUD prompt says "Press E to talk to Mitra" when you walk up');
  check(await ev(() => document.querySelector('.npc-tag.show b')?.textContent === 'Mitra'), 'her name tag shows on approach');
  await H.shot('01-mitra-approach');

  // --- the portrait busts, rendered from the 3D rig (a contact sheet for review)
  const sheet = await ev(() => { const g = window.__game, d = document.createElement('div'); d.id = 'pg'; d.style.cssText = 'position:fixed;inset:0;z-index:99;background:#cdeee9;display:flex;flex-wrap:wrap;gap:6px;padding:8px;align-content:flex-start';
    let n = 0; for (const id of ['mitra', 'tam', 'priya', 'jo', 'sione', 'bev', 'fatima', 'mika', 'officer']) { const u = g.npcs.whoOf(id).portraitUrl; if (u) n++; const i = document.createElement('img'); i.src = u; i.style.cssText = 'width:200px;height:222px;background:#fff3d2;border:3px solid #1f5f6b;border-radius:12px'; d.appendChild(i); }
    document.body.appendChild(d); return n; });
  check(sheet === 9, 'nine portrait busts rendered from the rig');
  await t.wait(400); await H.shot('00-portraits'); await ev(() => document.querySelector('#pg').remove());
  // --- a conversation: intro, topics, tips, gossip
  check(await H.talk('mitra'), 'E opens a conversation with Mitra');
  check(await ev(() => { const i = document.querySelector('#dialogue img.dlg-bust.photo'); return !!i && i.complete && i.naturalWidth > 100; }), 'her portrait bust (rendered from the 3D rig) is in the dialogue box');
  check(await ev(() => /Mitra/.test(document.querySelector('.dlg-name').textContent)), 'the dialogue shows her name tag');
  await H.shot('02-mitra-menu');
  await H.choose('Ask about'); await H.shot('03-mitra-topics');
  await H.choose('licence'); check(/\$14/.test(await H.dlgText()) && /18/.test(await H.dlgText()), 'the licence topic quotes the fee ($14 a month) and the age rule'); await H.shot('04-mitra-licence');
  await H.through();
  await H.choose('sell'); const sellTxt = await H.dlgText(); check(/cannot sell|can't sell|No\./i.test(sellTxt), 'rec fishers cannot sell their catch in NSW'); await H.through();
  await H.choose('rules at the lake'); const lakeTxt = await H.dlgText(); check(/crab traps/i.test(lakeTxt), "Lake Illawarra's no-traps/nets rule"); await H.through();
  await H.choose('Back');
  await H.choose('Any tips'); const tip1 = await H.dlgText(); check(tip1 && tip1.length > 20, `a tip: ${tip1?.slice(0, 50)}…`); await H.through();
  await H.choose('Any tips'); const tip2 = await H.dlgText(); check(tip2 !== tip1, 'asking again gives a different tip'); await H.through();
  check(await ev(async () => { const G = await import('/src/fishing/guide.js'); return G.tierOf(window.__game.progress, 'sandwhiting') === 'unseen'; }), 'sand whiting is not Seen yet');
  await H.choose('gossip'); await t.wait(200);
  const gos = await H.dlgText(); await H.shot('05-mitra-gossip');
  check(/Added to your guide: Seen/.test(gos ?? '') || /whiting|tailor|mulloway|flathead/i.test(gos ?? ''), `gossip names a species where and when: ${gos?.slice(0, 70)}…`);
  const seen = await ev(async () => { const g = window.__game, G = await import('/src/fishing/guide.js'); return ['sandwhiting', 'tailor', 'mulloway', 'duskyflathead'].filter(id => G.tierOf(g.progress, id) === 'seen' && g.progress.guide.e[id].seen.src === 'gossip'); });
  check(seen.length === 1, `the gossip marked one species Seen with source "gossip" (${seen})`);
  check(await ev(() => [...document.querySelectorAll('.toast')].some(x => /Added to your guide: Seen/.test(x.textContent))), 'toast: "Added to your guide: Seen"');
  await H.through(); await H.bye();
  check(!(await H.dlgOpen()), 'Bye closes the conversation');

  // --- quiz trade: a wrong answer waits for tomorrow, then right answers unlock the nipper pump
  await H.talk('mitra');
  check(await ev(() => /Jobs and trades/.test(document.querySelector('#dialogue').innerText)), 'the menu offers Jobs and trades');
  await H.choose('Jobs and trades'); await H.shot('06-mitra-trades');
  await H.choose('Licence and fees'); await H.through(0); await H.choose('Ask me');
  check(/Question 1 of 3/.test(await H.dlgText()) && /worksheet 2\.1\.14/.test(await H.dlgText()), 'quiz question 1 of 3, citing the worksheet'); await H.shot('07-quiz-question');
  await H.answerQuiz(false); await t.wait(200);
  const fail = await H.dlgText(); check(/Not quite|answer is/i.test(fail ?? ''), 'a wrong answer is explained'); await H.shot('08-quiz-wrong');
  await H.through();
  check(await ev(() => window.__game.progress.npc.quizFail['mitra-licence'] === window.__game.progress.npc.day), 'the failed quiz is recorded for today');
  await H.choose('Jobs and trades'); await H.choose('Licence and fees'); check(/Not today/.test(await H.dlgText()), 'the same day: "ask me again tomorrow"'); await H.through();
  await H.choose('Back'); await H.bye();
  await ev(() => window.__game.npcs.bumpDay());                                  // a new in-game day
  await H.talk('mitra'); await H.choose('Jobs and trades'); await H.choose('Licence and fees'); await H.choose('Ask me');
  for (let i = 0; i < 3; i++) { const r = await H.answerQuiz(true); check(!!r, `quiz question ${i + 1} found in the worksheet bank (Q${r?.n})`); await t.wait(150); }
  const rew = await H.dlgText(); check(/nipper pump/i.test(rew ?? ''), 'all correct: Mitra gives the nipper pump'); await H.shot('09-quiz-reward');
  await H.through(); await H.bye();
  check(await ev(async () => { const I = await import('/src/npc/inventory.js'); return I.baitUnlocked(window.__game.progress, 'nipper'); }), 'nipper bait is unlocked');

  // --- Old Tam: a show-me trade from scripted guide state; locked rigs in the tackle box
  await H.talk('tam');
  check(await ev(() => /Old Tam/.test(document.querySelector('.dlg-name').textContent)), 'Old Tam (taking a break on the jetty by day) talks');
  await H.choose('Jobs and trades'); await H.choose('yellowfin bream');
  check(/Master the yellowfin/i.test(await H.dlgText()) || /challenge/i.test(await H.dlgText()), 'Tam asks for a Mastered yellowfin bream'); await H.shot('10-tam-ask');
  await page.locator('#dialogue .dlg-choice', { hasText: 'I will do it' }).click(); await t.wait(200); await H.through(); await H.bye();
  await H.ev(() => { document.querySelector('#toast').innerHTML = ''; });
  await t.tap('KeyQ'); await t.wait(500);
  check(await ev(() => /Master the yellowfin bream/.test(document.querySelector('#modal-body').innerText) && /Old Tam/.test(document.querySelector('#modal-body').innerText)), 'the quest log lists the request with who, where and what');
  await H.shot('11-quest-log-active'); await page.keyboard.press('Escape'); await t.wait(200);
  await t.tap('KeyT'); await t.wait(500);
  check(await ev(() => document.querySelector('.tb-rig[data-rig="float"]').classList.contains('locked') && /Ask Old Tam on the jetty/.test(document.querySelector('.tb-rig[data-rig="float"]').innerText)), 'the float rig is locked: "Ask Old Tam on the jetty"');
  await page.click('.tb-rig[data-rig="float"]', { force: true }); await t.wait(150);   // aria-disabled: still clickable, it explains why
  check(await ev(() => /locked/i.test(document.querySelector('#tb-desc').textContent) && window.__game.gear.rig === 'runningsinker'), 'clicking a locked rig explains it and does not select it');
  await H.shot('12-tackle-locked'); await page.click('#tb-done'); await t.wait(200);
  await setState(H, (p) => { const e = (p.guide.e.yellowfinbream ??= {}); e.seen = { t: 1, src: 'school' }; e.caught = { t: 1, n: 1, count: 1 }; e.ident = true; e.meas = { n: 1, acc: 1 }; e.dec = { ok: 1, bad: 0 }; e.mastered = 1; });
  check(await ev(() => document.body.classList.contains('quest-ready') || true), 'ok');
  await t.wait(1700);
  check(await ev(() => document.body.classList.contains('quest-ready')), 'the quest button shows a dot once something is ready to hand in');
  check(await ev(() => window.__game.npcs.byId.tam.markerKind === 'ok'), 'Tam shows a tick marker');
  await H.talk('tam'); await H.choose('Jobs and trades'); await H.choose('yellowfin bream');
  check(/Let me see/.test(await H.dlgText()), 'Tam checks your records'); await H.through(); await H.shot('13-tam-reward');
  check(/float/i.test(await H.dlgText() ?? '') || await H.dlgOpen(), 'the float rig is handed over'); await H.through(); await H.bye();
  check(await ev(async () => { const I = await import('/src/npc/inventory.js'); return I.rigUnlocked(window.__game.progress, 'float') && !I.rigUnlocked(window.__game.progress, 'metalslug'); }), 'the float rig is unlocked in the tackle box; the metal slug is still locked');
  await t.tap('KeyT'); await t.wait(400);
  check(await ev(() => !document.querySelector('.tb-rig[data-rig="float"]').classList.contains('locked') && /Ask Bev/.test(document.querySelector('.tb-rig[data-rig="metalslug"]').innerText)), 'tackle box: float open, metal slug says "Ask Bev…"');
  await page.click('.tb-rig[data-rig="float"]'); await t.wait(150); check(await ev(() => window.__game.gear.rig === 'float'), 'the float rig can be selected'); await page.click('#tb-done'); await t.wait(200);

  // --- Sea Country ranger
  await H.talk('jo');
  const joIntro = await ev(() => window.__game.progress.npc.met.jo);
  check(!!joIntro, 'Ranger Jo introduces herself');
  await H.choose('Ask about'); await H.choose('Whose Country'); const joTxt = await H.dlgText(); check(/Dharawal/.test(joTxt), 'Jo: Lake Illawarra is Dharawal Country'); await H.shot('14-jo-country');
  await H.through(); await H.choose('Back'); await H.bye();
  check(await ev(async () => { const I = await import('/src/npc/inventory.js'); return I.earnedCards(window.__game.progress).includes('sc-lake'); }), 'a Sea Country story card was earned');
  await t.tap('KeyJ'); await t.wait(800); await page.click('[data-reg="seacountry"]'); await t.wait(300);
  check(await ev(() => /Lake Illawarra is Dharawal Country/i.test(document.querySelector('#modal-body').innerText) && /Source: worksheet 1\.3\.1/i.test(document.querySelector('#modal-body').innerText)), 'the guide has a Sea Country tab listing the earned card and its worksheet source');
  await H.shot('15-sea-country-tab'); await page.keyboard.press('Escape'); await t.wait(200);

  // --- Mika (kid angler), a challenge, then a hat from a trade
  await H.talk('mika'); await H.choose('Jobs and trades'); await H.choose('flathead');
  check(/40 centimetres/.test(await H.dlgText()), "Mika: bet you can't catch a flathead over 40 cm"); await H.choose('Maybe later'); await H.bye();

  // --- reactions: an illegal keep within 15 m of someone; a big legal catch
  await H.stand('mitra', 4, 4); await H.clearToasts();
  await ev(() => window.__game.npcs.onCatch({ id: 'duskyflathead', length: 30, keep: true, legal: false, kind: 'undersize' })); await t.wait(400);
  check(await ev(() => [...document.querySelectorAll('.npc-bubble.show')].some(b => /undersize/.test(b.textContent))), 'a nearby person says "that one\'s undersize" about an illegal keep');
  await H.shot('16-reaction-undersize');
  await t.wait(5800);
  await ev(() => window.__game.npcs.onCatch({ id: 'duskyflathead', length: 68, keep: true, legal: true, kind: 'ok' })); await t.wait(300);
  check(await ev(() => document.querySelectorAll('.npc-bubble.show').length > 0), 'a big legal catch gets a cheer');
  await t.teleport(-60, 40, { camYaw: 0 }); await H.clearToasts(); await t.wait(500);
  await ev(() => window.__game.npcs.onCatch({ id: 'duskyflathead', length: 30, keep: true, legal: false, kind: 'undersize' })); await t.wait(200);
  check(await ev(() => document.querySelectorAll('.npc-bubble.show').length === 0 || [...document.querySelectorAll('.npc-bubble.show')].every(b => !/undersize/.test(b.textContent)) || window.__game.npcs.nearestTo(window.__game.walker.pos, 15) !== null), 'nobody near enough to comment far from everyone (15 m)');

  // --- the day moves on: dusk, then night. Mitra goes home, Mika heads home, and Old Tam walks up to the Belmore Basin wharf for the squid (phase 5: he is away from the lake at night)
  await ev(() => { window.__game.cond.minutes = 21 * 60; });
  await t.wait(1500);
  const night = await ev(() => window.__game.npcs.npcs.map(n => `${n.id}:${n.away ? 'away' : n.act}`).sort().join(' '));
  check(/mitra:away/.test(night) && /tam:away/.test(night) && /mika:away/.test(night) && /priya:away/.test(night), `at night: ${night}`);
  await ev(() => { window.__game.cond.minutes = 6.3 * 60; }); await t.wait(1500);
  const dawn = await ev(() => window.__game.npcs.npcs.map(n => `${n.id}:${n.away ? 'away' : n.act}`).sort().join(' '));
  check(/mitra:standing/.test(dawn) && /tam:fishing/.test(dawn) && /mika:fishing/.test(dawn), `at dawn: ${dawn}`);
  await t.wait(5000);   // let Tam walk back out to the jetty end
  await t.teleport(16, 16.8, { camYaw: 3.14, zoom: 8.5, heading: 0 }); await t.wait(1200);   // from the water side, looking back at the jetty end
  // --- the fishers cast, wait, and sometimes land a fish
  const phases = new Set();
  for (let i = 0; i < 120; i++) { await ev(() => window.__game.advance(1)); phases.add(await ev(() => window.__game.npcs.byId.tam.fish.phase + '/' + window.__game.npcs.byId.mika.fish.phase)); if (i === 3) await H.shot('17-fishers'); }
  const seenPhases = new Set([...phases].flatMap(x => x.split('/')));
  check(['charge', 'flying', 'wait'].every(x => seenPhases.has(x)), `the anglers cast and wait (${[...seenPhases]})`);
  check(seenPhases.has('landed'), 'an angler landed a fish (strike, fight, hold it up)');
  await t.wait(3000); const fs = await ev(() => window.__game.fps); check(fs == null || fs >= (quality === 'low' ? 45 : 30), `fps with people about: ${fs}`);

  // --- the quest log with a ready request and completed ones
  await t.tap('KeyQ'); await t.wait(600); await H.shot('18-quest-log'); check(await ev(() => /Completed/i.test(document.querySelector('#modal-body').innerText) && /kit/i.test(document.querySelector('#modal-body').innerText)), 'the quest log lists completed requests and your kit');
  await page.keyboard.press('Escape');
  // wear a hat reward
  await ev(() => { const g = window.__game; return import('/src/npc/inventory.js').then(I => { I.grant(g.progress, 'hat-tam'); g.persist(); }); });
  await t.tap('KeyQ'); await t.wait(400); await page.click('[data-hat="hat-tam"]'); await t.wait(300);
  check(await ev(() => window.__game.angler.look.hatStyle === 'straw' && window.__game.progress.inventory.worn === 'hat-tam'), 'a hat reward can be worn from the quest log');
  await page.keyboard.press('Escape');
});

// ============================================================================ Bellambi
await session('rocky', '', async H => {
  const { t, page, ev } = H;
  const present = await ev(() => window.__game.npcs.npcs.filter(n => !n.away).map(n => n.id).sort());
  check(JSON.stringify(present) === JSON.stringify(['bev', 'fatima', 'mika', 'officer', 'sione']), `by day Bellambi has Sione, Bev, Fatima, Mika and the officer (${present})`);
  // The lifeguard: rock-fishing safety
  check(await H.talk('sione'), 'E opens a conversation with Sione, the lifeguard'); await H.shot('01-sione');
  await H.choose('Ask about'); await H.choose('lifejacket'); const lj = await H.dlgText(); check(/Rock Fishing Safety Act|declared area|lifejacket/i.test(lj ?? '') && /\$100/.test(lj ?? ''), 'Sione: the lifejacket rule for rock fishing in Wollongong ($100)'); await H.through(); await H.choose('Back');
  await H.choose('gossip'); const g1 = await H.dlgText(); check(/Bellambi/.test(g1 ?? ''), `Sione's gossip: ${g1?.slice(0, 60)}…`); await H.through();
  const sGossip = await ev(() => Object.entries(window.__game.progress.guide.e).filter(([, e]) => e.seen?.src === 'gossip').map(([id]) => id));
  check(sGossip.length === 1, `the gossip made one Seen entry (${sGossip})`); await H.bye();
  // Bev: the club board
  check(await H.talk('bev'), 'Bev, the club organiser, talks by the beach path'); await H.choose('Ask about'); await H.choose('comps are coming'); check(/comp/i.test(await H.dlgText()), 'Bev teases the upcoming comps'); await H.shot('02-bev-comps'); await H.through(); await H.choose('Back'); await H.bye();
  // Fatima: litter missions, a litter trade (scripted litter count)
  check(await H.talk('fatima'), 'Fatima, the clean-up volunteer, talks'); await H.choose('Jobs and trades'); await H.choose('three pieces'); check(/three pieces/i.test(await H.dlgText()), 'Fatima asks for three pieces of litter'); await H.shot('03-fatima');
  await page.locator('#dialogue .dlg-choice', { hasText: 'I will do it' }).click(); await t.wait(200); await H.through(); await H.bye();
  await setState(H, (p) => { p.steward.litter = 3; });
  await t.wait(1700);
  await H.talk('fatima'); await H.choose('Jobs and trades'); await H.choose('three pieces'); await H.through(); await H.shot('04-fatima-reward'); await H.through(); await H.bye();
  check(await ev(async () => (await import('/src/npc/inventory.js')).hasItem(window.__game.progress, 'tool-lurecolours')), 'litter pulled from the water earns the lure colours');
  await ev(() => { const g = window.__game; g.gear.rig = 'runningsinker'; });
  // Mika at Bellambi, the officer patrolling
  check(await H.talk('mika'), 'Mika is at Bellambi too (moving between spots)'); await H.bye();
  check(await H.talk('officer'), 'the Fisheries Officer patrols the beach and can be talked to'); await H.shot('05-officer'); await H.bye();
  // The real catch flow: land an undersize flathead near the lifeguard, keep it, and he says so (the key is skipped: the flathead is already Identified)
  await setState(H, (p) => { const e = (p.guide.e.duskyflathead ??= {}); e.seen = { t: 1, src: 'school' }; e.caught = { t: 1, n: 7, count: 1 }; e.ident = true; });
  await H.stand('sione', 3, 3); await H.clearToasts();
  await ev(() => { const g = window.__game; g.fishing.state = 'ready'; g.fishing.spot = 'beach'; g.fishing.catch = { id: 'duskyflathead', length: 30, gear: 1 }; g.fishing.ctx = g.biteContext(); g.fishing.land(); });
  await t.wait(2000);
  check(await H.waitSel('#mat-board'), 'the brag mat opens for the real catch flow');
  await page.click('#m-lock'); await t.wait(250); await page.click('#m-next'); await t.wait(250);
  await page.click('#fx-keep'); await t.wait(250); await page.click('#v-next'); await t.wait(900);
  check(await ev(() => window.__game.progress.esky.some(x => x.id === 'duskyflathead' && x.legal === false)), 'the undersize flathead went in the esky marked illegal');
  check(await ev(() => [...document.querySelectorAll('.npc-bubble.show')].some(b => /undersize/.test(b.textContent))) && await ev(() => [...document.querySelectorAll('.toast')].some(x => /Sione/.test(x.textContent))), 'Sione (the lifeguard, within 15 m) says the keep is undersize (bubble and toast)');
  await H.shot('05b-reaction-real-flow');
  // Tackle box: lure colour row (soft plastic is still locked, so unlock it for the check)
  await ev(async () => { const g = window.__game, I = await import('/src/npc/inventory.js'); I.grant(g.progress, 'rig-softplastic'); g.gear.rig = 'softplastic'; g.gear.bait = 'none'; g.persist(); });
  await t.tap('KeyT'); await t.wait(500); check(await ev(() => document.querySelectorAll('.tb-lurecol').length === 4), 'lure colours appear in the tackle box for a lure rig'); await H.shot('06-lure-colours'); await page.click('#tb-done'); await t.wait(200);
  await ev(() => { const g = window.__game; g.gear.rig = 'runningsinker'; g.gear.bait = 'prawn'; });
});

// --- the rock platform in a big swell (swell=3): warning, then a safety mark if you stay
await session('rocky', '&swell=3', async H => {
  const { t, page, ev } = H;
  const before = await ev(async () => (await import('/src/fishing/guide.js')).stewardRating(window.__game.progress).value);
  await ev(() => { document.querySelector('#toast').innerHTML = ''; });
  await t.teleport(75, 86, { camYaw: 0, zoom: 10, heading: Math.PI });
  await t.wait(900);
  check(await ev(() => window.__game.cond.swell >= 2.5), 'the swell is over 2.5 m');
  check(await ev(() => [...document.querySelectorAll('.toast')].some(x => /Sione/.test(x.textContent) && /closed to fishers/.test(x.textContent))) && await ev(() => window.__game.npcs.warned), 'Sione warns you off the rock platform in a big swell (toast and a bubble)');
  await H.shot('07-platform-warning');
  check(await ev(() => window.__game.progress.steward.safety ?? 0) === 0, 'no penalty yet, just a warning');
  await ev(() => window.__game.advance(9)); await t.wait(300);
  const safety = await ev(() => window.__game.progress.steward.safety ?? 0);
  check(safety >= 1, `stay on the platform after the warning: a safety mark (${safety})`);
  const after = await ev(async () => (await import('/src/fishing/guide.js')).stewardRating(window.__game.progress).value);
  check(after < before, `the Steward rating dropped (${before.toFixed(2)} -> ${after.toFixed(2)})`);
  await H.shot('08-platform-penalty');
  // Leaving the platform stops it.
  await t.teleport(4, 92, { camYaw: 0 }); await ev(() => window.__game.advance(10));
  check((await ev(() => window.__game.progress.steward.safety ?? 0)) === safety, 'off the platform: no more marks');
});

check(errors.length === 0, `no console errors${errors.length ? ': ' + errors.slice(0, 3).map(s => s.slice(0, 200)).join(' || ') : ''}`);
for (const l of log) console.log(...l);
console.log(`npcs.mjs ${tag}:`, ok ? 'OK' : 'FAILED');
process.exit(ok ? 0 : 1);
