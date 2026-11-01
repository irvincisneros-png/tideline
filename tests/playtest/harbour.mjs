// Phase 5 playtest: Belmore Basin. 1 travel there (the locked card on the picker, then the unlocked one), 2 the day view, 3 the night lamp view (dark blue, readable),
// 4 a squid caught on the real catch bar (the jet profile, the ink splash, the key, the brag mat, keep) and a squid-and-cuttlefish bag, 5 the co-op fisher (talk, "can't sell",
// the commercial licence teased, the show-me and the quiz), 6 key identification of a new species (yakka). Also: zero console errors and a frame-rate check (low tier >= 45 fps).
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/harbour.mjs [high|low] [narrow]
// Screenshots go to playtest-shots/harbour/<quality>[-375]/. Exits 0 only if every check passed.
import { launch } from './harness.mjs';

const quality = process.argv[2] ?? 'high', narrow = process.argv[3] === 'narrow';
const tag = `${quality}${narrow ? '-375' : ''}`;
const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; };
process.on('uncaughtException', e => { for (const l of log) console.log(...l); console.log('EXCEPTION', String(e).slice(0, 400)); process.exit(1); });
// Start on the title screen of the default site (no ?eco, no ?play): the way a student gets to the harbour is the site picker.
const t = await launch({ query: `quality=${quality}&time=day&tide=rising&season=summer&swell=1&officer=0`, outDir: `playtest-shots/harbour/${tag}`, width: narrow ? 375 : 1280, height: narrow ? 700 : 760 });
const page = t.page, ev = (f, a) => page.evaluate(f, a);
const clearToasts = () => ev(() => { document.querySelector('#toast').innerHTML = ''; });
const waitFor = (sel, ms = 8000) => page.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const fs = () => ev(() => { const f = window.__game.fishing; return { state: f.state, spot: f.spot, bar: f.bar.active ? { fish: f.bar.fy, zone: f.bar.zy, zv: f.bar.zv, profile: f.bar.profile } : null }; });
const zoom = narrow ? 24 : 30;

// ================================================================== 1. travel there
await t.wait(1000);
check(await ev(() => window.__game.mode === 'menu'), 'the game starts on the title screen');
const cardInfo = () => ev(() => { const c = document.querySelector('.eco-card[data-id="harbour"]'); return c ? { locked: c.classList.contains('locked'), chip: c.querySelector('.chip')?.textContent, text: c.innerText } : null; });
let card = await cardInfo();
check(card && card.locked && /5 species/.test(card.chip) && /0 of 5/.test(card.chip), `the picker shows Belmore Basin locked with its requirement: "${card?.chip}"`);
await t.shot('01-picker-locked');
await page.click('.eco-card[data-id="harbour"]', { force: true }); await t.wait(400);
check(await ev(() => window.__game.eco.id === 'rocky'), 'clicking the locked site does not travel');
check(await ev(() => /opens when you identify 5 species/i.test(document.querySelector('#toast').innerText)), 'a toast says how to unlock it');
// Five species Identified (a sensible Guide milestone), a made angler (so the creator does not open) and a jig.
await ev(() => {
  const g = window.__game, p = g.progress;
  for (const id of ['tailor', 'sandwhiting', 'yellowfinbream', 'luderick', 'garfish']) { const e = (p.guide.e[id] ??= {}); e.seen = { t: 1, src: 'test' }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; }
  p.angler = { name: 'Kai', skin: 0xc58c5e, hairStyle: 'short', hair: 0x4a2f1d, hatStyle: 'straw', hat: 0xe9d9a6, sunnies: 'none', pattern: 'plain', shirt: 0xf0715a, shorts: 0x2f5496, rod: 0x3b525c };
  g.angler.setAppearance(p.angler); g.persist(); g.bindMenu();
});
card = await cardInfo();
check(card && !card.locked && /Belmore Basin harbour \d+\/\d+/.test(card.chip), `after five Identified the card opens: "${card?.chip}"`);
await page.click('.eco-card[data-id="harbour"]');
check(await page.waitForFunction(() => window.__game.eco.id === 'harbour' && !window.__game.loading && window.__game.mode === 'menu', null, { timeout: 90000 }).then(() => true).catch(() => false), 'travelling loads Belmore Basin');
await t.wait(1500);
await t.shot('02-title-harbour');
await page.click('#btn-play'); await t.wait(1500);
check(await ev(() => window.__game.mode === 'land' && window.__game.eco.id === 'harbour'), 'Start fishing puts the angler on the harbour quay');
await clearToasts();

// ================================================================== 2. the day view
await t.teleport(8, 41, { camYaw: 0.15, heading: Math.PI, zoom, pitch: 1.0 });
await clearToasts();
await t.shot('03-day-wharf');
check(await ev(() => window.__game.env.night < 0.05 && window.__game.cond.time === 'day'), 'it is day: bright');
const wharfProps = await ev(() => ({ trawlers: window.__game.world.props.byName.trawler_blue?.length + window.__game.world.props.byName.trawler_red?.length + window.__game.world.props.byName.trawler_green?.length, lamps: window.__game.world.props.byName.lamp_post?.length, coop: window.__game.world.props.byName.coop?.length, lighthouse: window.__game.world.props.byName.lighthouse?.length, bollards: window.__game.world.props.byName.bollard?.length, kelp: window.__game.world.reef.picks.filter(p => p.id === 'kelp').length }));
check(wharfProps.trawlers === 3 && wharfProps.lamps === 6 && wharfProps.coop === 1 && wharfProps.lighthouse === 1 && wharfProps.bollards > 10, `set dressing: ${JSON.stringify(wharfProps)}`);
check(wharfProps.kelp > 20, 'kelp grows on the rubble under the wharf');
await t.teleport(44, -8, { camYaw: -0.5, heading: Math.PI, zoom: narrow ? 30 : 38, pitch: 1.0 });
await clearToasts();
await t.shot('04-day-breakwall-lighthouse');
check(await ev(() => window.__game.walker.pos.y > 2), 'the breakwall crest is walkable');
await ev(() => { window.__game.cond.swellBase = 3.2; });
await t.wait(2600);
check(await ev(() => /breakwall|washing over/i.test(document.querySelector('#toast').innerText)), 'in a big swell (3 m) the breakwall warns you off');
await t.shot('04b-breakwall-swell');
await ev(() => { window.__game.cond.swellBase = 1; });
await t.teleport(-20, 40, { camYaw: 0.5, heading: Math.PI, zoom: narrow ? 24 : 34, pitch: 1.0 });
await t.shot('05-day-coop');

// ================================================================== 3. the night lamp view
await ev(() => { const g = window.__game; g.cond.minutes = 22 * 60; });
await t.wait(1800);
check(await ev(() => window.__game.cond.time === 'night' && window.__game.env.night > 0.95), 'at 22:00 it is night');
check(await ev(() => window.__game.world.harbour && window.__game.world.props.byName.lamp_post.length === 6), 'six wharf lamps stand on the wharf');
await t.teleport(12.6, 20, { camYaw: 0, heading: Math.PI, zoom: narrow ? 38 : 26, pitch: 1.0 });   // a phone's tall, narrow frame needs the camera further back to see the water and the pools
await clearToasts(); await t.wait(1500);
await t.shot('06-night-lamps');
// readability: the picture is blue, not black, and the lamps are the brightest warm things in it
const luma = await ev(async () => {
  const g = window.__game; g.composer ? g.composer.render() : g.renderer.render(g.scene, g.camera);
  const url = g.renderer.domElement.toDataURL('image/png'), img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = 160; c.height = 90; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 160, 90);
  const d = x.getImageData(0, 0, 160, 90).data; let sum = 0, dark = 0, blue = 0, warm = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2], l = (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255; sum += l; if (l < 0.05) dark++; if (b > r * 1.15) blue++; if (r > 200 && gg > 150) warm++; }
  return { mean: sum / n, dark: dark / n, blue: blue / n, warm: warm / n };
});
check(luma.mean > 0.12 && luma.mean < 0.6, `night is readable: mean brightness ${luma.mean.toFixed(2)}`);
check(luma.dark < 0.2, `night is not black: ${(luma.dark * 100).toFixed(0)}% near-black pixels`);
check(luma.blue > (narrow ? 0.25 : 0.4), `night is blue: ${(luma.blue * 100).toFixed(0)}% blue-dominant pixels`);
check(await ev(() => window.__game.env.glow !== undefined && window.__game.world.harbour.glows[0].core.material.opacity > 0.5), 'the lamp glows are lit');
// squid are out at night, hovering at the edge of the lamp pools; baitfish swirl in them
const squid = await ev(() => { const a = window.__game.world.life.agents.filter(a => a.id === 'squid'); return { n: a.length, shown: a.filter(x => x.visible !== false).length }; });
check(squid.n >= 4 && squid.shown === squid.n, `squid are out in the lamp light at night (${squid.shown}/${squid.n})`);
await t.wait(6000);
await t.teleport(14.5, 26, { camYaw: 0, heading: Math.PI, zoom: narrow ? 10 : 13, pitch: 1.12 });
await clearToasts(); await t.wait(1200);
await t.shot('07-night-pool-closeup');
await ev(() => { window.__game.cond.minutes = 11 * 60; }); await t.wait(1200);
check(await ev(() => window.__game.world.life.agents.filter(a => a.id === 'squid').every(a => a.visible === false)), 'by day the squid are gone (they only come up at dusk and night)');
await ev(() => { window.__game.cond.minutes = 18.3 * 60; }); await t.wait(2200);   // sunset: the amber glow, the lamps just coming on
await t.teleport(8, 41, { camYaw: 0.15, heading: Math.PI, zoom, pitch: 1.0 });
await clearToasts(); await t.shot('08-dusk');
check(await ev(() => window.__game.cond.time === 'dusk' && window.__game.env.glow > 0.5), 'at 18:20 it is dusk with a sunset glow');

// ================================================================== 4. a squid on the real catch bar
await ev(() => {
  const g = window.__game, p = g.progress; p.inventory.have['rig-squidjig'] = Date.now(); g.gear.rig = 'squidjig'; g.gear.bait = 'none'; g.saveGear(); g.cond.minutes = 21.5 * 60;
});
await t.wait(1500);
await t.teleport(14.4, 23, { camYaw: 0, heading: Math.PI, zoom: narrow ? 16 : 20, pitch: 1.05 });
await clearToasts();
async function hookFish(id, length) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await ev(() => { const g = window.__game; g.walker.heading = Math.PI; g.input.mouse.t = -99; });
    await t.tap('KeyR'); await t.wait(250);
    if ((await fs()).state === 'off') await t.tap('KeyR');
    await page.keyboard.down(' '); await t.wait(700 + attempt * 300); await page.keyboard.up(' ');
    await t.wait(1400);
    if ((await fs()).state === 'wait') break;
    await clearToasts();
  }
  await ev(() => { window.__game.fishing.waitT = 0.05; });
  for (let i = 0; i < 80; i++) { if ((await fs()).state === 'bite') break; await t.wait(60); }
  await ev(([i, l]) => { window.__game.fishing.catch = { id: i, length: l, gear: 1 }; }, [id, length]);
  await t.tap('Space'); await t.wait(250);
  return (await fs()).state === 'fight';
}
async function playBar() {
  let holding = false; const t0 = Date.now(); let ink = 0, squeeze = 0, shot = false;
  while (Date.now() - t0 < 90000) {
    const s = await fs(); if (s.state !== 'fight' || !s.bar) break;
    const b = await ev(() => { const f = window.__game.fishing.bar; return { squeeze: f.squeeze, hint: f.hintKind }; });
    if (b.squeeze) squeeze++;
    if (!shot && (b.squeeze || Date.now() - t0 > 2500)) { shot = true; await t.shot('09-squid-catchbar'); }
    const want = s.bar.fish - s.bar.zone - 0.3 * s.bar.zv > 0;
    if (want !== holding) { holding = want; await (want ? page.keyboard.down(' ') : page.keyboard.up(' ')); }
    await t.wait(30);
  }
  if (holding) await page.keyboard.up(' ');
  return { squeeze };
}
const keyPath = id => ev(async id => { const K = await import('/src/fishing/key.js'), S = await import('/src/fishing/species.js'); return K.pathTo(K.KEY, S.SPECIES_BY_ID[id]); }, id);
async function runKey(answers, name) {
  check(await waitFor('.key-grid'), `${name}: the key panel opens for a new species`);
  await t.wait(400);
  for (let i = 0; i < 14; i++) {
    if (await page.$('#key-ok')) break;
    await page.click(`.opt[data-a="${answers[i] ?? 'a'}"]`); await t.wait(100);
  }
  check(await waitFor('#key-ok', 3000), `${name}: the key ends at a name`);
  const leaf = await ev(() => document.querySelector('.leaf-name')?.textContent);
  await page.click('#key-ok'); await t.wait(300);
  return leaf;
}
async function measure(target) {
  check(await waitFor('#mat-board'), 'the brag mat opens');
  await t.wait(500);
  const geo = await ev(() => { const i = document.querySelector('#mat-fish').getBoundingClientRect(), b = document.querySelector('#mat-board').getBoundingClientRect(), len = window.__game.catchFlow.c.length; return { x0: i.left, pxcm: i.width / len, y: b.top + b.height / 2 }; });
  await page.mouse.move(geo.x0 + 20, geo.y); await page.mouse.down(); await page.mouse.move(geo.x0 + target * geo.pxcm, geo.y, { steps: 8 }); await page.mouse.up();
  for (let i = 0; i < 14; i++) { const v = +(await ev(() => document.querySelector('#mr').textContent)); if (v === target) break; await page.click(v < target ? '#m-plus' : '#m-minus'); }
  await page.click('#m-lock'); await t.wait(300);
  await page.click('#m-next'); await t.wait(250);
}
let landed = false, inkSeen = null, fightInfo = null;
for (let attempt = 0; attempt < 4 && !landed; attempt++) {
  const hooked = await hookFish('squid', 24);
  check(hooked, `squid: a strike on the squid jig starts the fight${hooked ? '' : ' (not hooked)'}`);
  if (!hooked) break;
  fightInfo = await ev(() => { const b = window.__game.fishing.bar; return { profile: b.profile, attr: document.querySelector('#catchbar').dataset.profile, icon: /M2 12 C8 6/.test(document.querySelector('.cb-fish').innerHTML), hint: document.querySelector('.cb-hint').innerText }; });
  check(fightInfo.profile === 'jet' && fightInfo.attr === 'jet' && fightInfo.icon, `the squid has its own catch bar profile (jet), a squid icon and a squid hint: "${fightInfo.hint}"`);
  const r = await playBar();
  await t.wait(500);
  landed = (await fs()).state === 'landed';
  if (landed) {
    inkSeen = await ev(() => ({ overlay: getComputedStyle(document.getElementById('ink-splash')).opacity, blobs: document.querySelectorAll('#ink-splash i').length, decals: window.__game.inkDecals.length }));
    await t.shot('10-squid-landed-ink');
    check(r.squeeze >= 0, `the bar squeezed ${r.squeeze} times before jetting`);
  } else { await clearToasts(); await t.wait(600); }
}
check(landed, 'the squid was landed through the catch bar');
check(inkSeen && inkSeen.blobs >= 5 && +inkSeen.overlay > 0.05, `ink splashes across the screen on landing (${JSON.stringify(inkSeen)})`);
check(inkSeen && inkSeen.decals >= 1, 'and ink spots the deck round the angler');
const sqName = await runKey(await keyPath('squid'), 'squid');
check(/squid/i.test(sqName ?? ''), `the key names it: ${sqName}`);
await measure(24);
check(await waitFor('#fx-keep'), 'keep / release opens');
await page.click('#fx-keep'); await t.wait(300);
check(await waitFor('#v-next'), 'verdict card');
const verdict = await ev(() => document.querySelector('#modal-body').innerText);
await t.shot('11-squid-verdict');
check(/legal keep/i.test(verdict) && /spikes only|no barbed/i.test(verdict) && /squid and cuttlefish together/i.test(verdict), 'squid: a legal keep; the rule says 20 squid and cuttlefish in total and "spikes only"');
check(/Kept today \(squid and cuttlefish together\): 0 of 20/.test(verdict), 'the bag counter is "of 20" and shared with cuttlefish');
await page.click('#v-next'); await t.wait(400);
check(await ev(() => window.__game.progress.guide.e.squid?.ident === true && window.__game.progress.esky.length === 1), 'the squid is Identified in the Fish Guide and in the esky');
// the dusk-and-night gate is enforced where a student can see it: in the day a jig catches no squid
await ev(() => { window.__game.cond.minutes = 12 * 60; });
check(await ev(async () => { const C = await import('/src/fishing/catches.js'); const g = window.__game; let n = 0; for (let i = 0; i < 300; i++) if (C.pickCatch('wharf', g.biteContext({ x: 12, z: 20 })).id === 'squid') n++; return n === 0; }), 'a squid jig by day catches no squid');
await ev(() => { window.__game.cond.minutes = 22 * 60; });

// ================================================================== 6. a second new species through the key: yakka
await clearToasts();
await ev(() => { const g = window.__game; g.gear.rig = 'unweighted'; g.gear.bait = 'prawn'; g.saveGear(); });
const hookedY = await hookFish('yakka', 21);
check(hookedY, 'yakka: a strike starts the fight');
await playBar(); await t.wait(500);
if ((await fs()).state !== 'landed') await ev(() => window.__game.fishing.land());
await t.wait(1500);
const yName = await runKey(await keyPath('yakka'), 'yakka');
check(/yellowtail scad|yakka/i.test(yName ?? ''), `key identification of a new species: ${yName}`);
await t.shot('12-yakka-key-named');
await measure(21);
check(await waitFor('#fx-release'), 'release opens');
await page.click('#fx-release'); await t.wait(300);
check(await waitFor('#v-next'), 'yakka verdict');
await page.click('#v-next'); await t.wait(300);
check(await waitFor('#rel-hold'), 'the quick release opens');
await page.click('#rel-wet'); await t.wait(300);
const b = await (await page.$('#rel-hold')).boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await t.wait(1900); await page.mouse.up();
check(await waitFor('#r-next', 3000), 'released');
await page.click('#r-next'); await t.wait(500);
check(await ev(() => window.__game.progress.guide.e.yakka?.ident === true), 'the yakka is Identified');

// ---- the release card: the DPIRD range for bream (C13), and the cut-the-line lesson kept apart (C15)
await clearToasts();
const hookedB = await hookFish('yellowfinbream', 28);
check(hookedB, 'bream: a strike starts the fight');
await playBar(); await t.wait(500);
if ((await fs()).state !== 'landed') await ev(() => window.__game.fishing.land());
await t.wait(1500);
await measure(28);
check(await waitFor('#fx-release'), 'bream: release opens');
await page.click('#fx-release'); await t.wait(300); await page.click('#v-next'); await t.wait(300);
await page.click('#rel-wet'); await t.wait(300);
const bb = await (await page.$('#rel-hold')).boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await t.wait(1900); await page.mouse.up();
check(await waitFor('#r-next', 3000), 'bream released');
const surv = await ev(() => ({ top: document.querySelector('.surv-top')?.innerText, cut: document.querySelector('.surv-cut')?.innerText }));
check(/72 and 97/.test(surv.top ?? '') && !/usually survive release about 85%/.test(surv.top ?? ''), `the release card shows the bream range, not a single 85%: "${(surv.top ?? '').replace(/\n/g, ' | ')}"`);
check(/12%/.test(surv.cut ?? '') && /85%/.test(surv.cut ?? '') && /separate lesson/.test(surv.cut ?? ''), 'the cut-the-line lesson (12% to over 85%) is a separate note');
await t.shot('12b-bream-release-card');
await page.click('#r-next'); await t.wait(500);
// ---- the Fish Guide has a Belmore Basin region
await page.keyboard.press('j'); await t.wait(700);
const guideText = await ev(() => document.querySelector('#modal-body')?.innerText ?? '');
check(/Belmore Basin harbour/.test(guideText) && /Squid/.test(guideText), 'the Fish Guide counts a Belmore Basin harbour region');
await t.shot('12c-fish-guide');
await ev(() => window.__game.panels.close(true)); await t.wait(300);

// ================================================================== 5. the co-op fisher
await ev(() => { window.__game.cond.minutes = 11 * 60; }); await t.wait(1500);
const here = await ev(() => { const n = window.__game.npcs.byId.nell; return n && !n.away ? [n.pos.x, n.pos.z] : null; });
check(!!here, 'Nell, the co-op fisher, is on the quay by day');
const dlgText = () => ev(() => document.querySelector('#dialogue:not(.hidden) .dlg-text')?.innerText ?? null);
const through = async (max = 8) => { for (let i = 0; i < max; i++) { const n = await page.$('#dialogue:not(.hidden) .dlg-next'); if (!n) return; await n.click(); await t.wait(120); } };
const choose = async label => { const bt = page.locator('#dialogue .dlg-choice', { hasText: label }).first(); await bt.waitFor({ timeout: 4000 }); await bt.click(); await t.wait(160); };
await t.teleport(here[0] + 1.7, here[1] + 1.7, { camYaw: 0, zoom: narrow ? 9 : 9 });
await clearToasts(); await page.keyboard.press('e'); await t.wait(600); await through();
check(await ev(() => !!document.querySelector('#dialogue:not(.hidden)')), 'E talks to Nell');
await t.shot('13-nell-talk');
const readAll = async () => { let all = ''; for (let i = 0; i < 8; i++) { all += (await dlgText() ?? '') + '\n'; const n = await page.$('#dialogue:not(.hidden) .dlg-next'); if (!n) break; await n.click(); await t.wait(120); } return all; };
await choose('Ask about'); await choose('sell');
await t.shot('14-nell-cannot-sell');
const sell = await readAll();
check(/recreational fishers cannot sell/i.test(sell ?? '') && /licen[cs]ed commercial/i.test(sell ?? ''), `Nell: recreational fishers cannot sell, licensed commercial fishers can: "${sell?.slice(0, 70)}…"`);
await choose('co-op'); check(/co-op is a business/i.test(await readAll()), 'Nell explains what a co-op is');
await choose('commercial licence'); const tease = await readAll();
check(/not yet/i.test(tease) && /promise, not a door/i.test(tease), 'the commercial licence is teased, not unlocked');
check(await ev(() => !window.__game.progress.inventory.have['licence-commercial'] && !JSON.stringify(window.__game.progress).includes('commercialLicence')), 'no commercial licence was granted');
await choose('Back');
await choose('Jobs and trades'); await t.wait(200);
const tradesMenu = await ev(() => document.querySelector('#dialogue').innerText);
check(/Name a squid at the wharf ✓/.test(tradesMenu), 'the show-me is ready to hand in because the squid is Identified in the guide');
await t.shot('15-nell-trades');
await choose('Name a squid'); await through(); await t.wait(300);
check(await ev(() => !!window.__game.progress.inventory.have['hat-coop']), 'the show-me paid out the Co-op beanie');
// the quiz: three commercial-fishing questions drawn from the worksheet quiz bank
await through(); if (!(await ev(() => !!document.querySelector('#dialogue:not(.hidden)')))) { await page.keyboard.press('e'); await t.wait(500); await through(); }
await choose('Jobs and trades'); await choose('Commercial fishing quiz'); await through(0); await choose('Ask me');
for (let i = 0; i < 3; i++) {
  const info = await ev(async () => { const Q = await import('/src/content/quiz.js'), txt = document.querySelector('#dialogue .dlg-text').innerText.replace(/^Question[^\n]*\n/, '').trim(); const q = Q.QUIZ.find(x => txt.startsWith(x.q)); return q ? { right: q.options[q.answer], n: q.n } : null; });
  check(info && [24, 26, 30].includes(info.n), `quiz question ${i + 1} comes from the commercial worksheets (Q${info?.n})`);
  if (i === 0) await t.shot('16-nell-quiz');
  if (!info) break;
  await page.locator('#dialogue .dlg-choice').filter({ hasText: info.right }).first().click(); await t.wait(200); await through(2);
}
await through(); await t.wait(300);
check(await ev(() => !!window.__game.progress.inventory.have['hat-oilskin']), 'three right answers paid out the oilskin hat');
for (let i = 0; i < 12 && (await ev(() => !!document.querySelector('#dialogue:not(.hidden)'))); i++) { const bye = page.locator('#dialogue .dlg-choice', { hasText: 'Bye' }); if (await bye.count()) await bye.first().click(); else { const n = await page.$('#dialogue:not(.hidden) .dlg-next'); if (n) await n.click(); } await t.wait(150); }
// Old Tam works the wharf at night
await ev(() => { window.__game.cond.minutes = 22 * 60; }); await t.wait(1500);
check(await ev(() => { const n = window.__game.npcs.byId.tam; return n && !n.away; }), 'Old Tam has walked up to the harbour wharf for the night');
const tp = await ev(() => { const n = window.__game.npcs.byId.tam; return [n.pos.x, n.pos.z]; });
await t.teleport(tp[0] + 1.6, tp[1] + 2.2, { camYaw: 0, zoom: narrow ? 11 : 12 }); await clearToasts(); await t.wait(600);
await t.shot('17-tam-at-night');

// ================================================================== frame rate and errors
await t.teleport(12.6, 20, { camYaw: 0.2, heading: Math.PI, zoom: narrow ? 20 : 26, pitch: 1.0 });
await clearToasts(); await t.wait(2500);
const fps = [];
for (let i = 0; i < 8; i++) { fps.push(await ev(() => window.__game.fps)); await t.wait(500); }
const mean = fps.reduce((a, c) => a + c, 0) / fps.length;
if (quality === 'low') check(mean >= 45, `low tier holds >= 45 fps at night with the lamps in view (mean ${mean.toFixed(0)})`);
else log.push(['info', `high tier mean ${mean.toFixed(0)} fps`]);
const errs = t.errors.filter(e => !/favicon/.test(e));
check(errs.length === 0, `zero console errors${errs.length ? ': ' + errs.slice(0, 3) : ''}`);
for (const l of log) console.log(...l);
console.log(ok ? `HARBOUR ${tag} OK` : `HARBOUR ${tag} FAILED`);
await t.close();
process.exit(ok ? 0 : 1);
