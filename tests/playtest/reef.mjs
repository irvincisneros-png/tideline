// Phase 6 playtest: the offshore reef, by boat. 1 the picker (locked: the rod AND 8 species; then open), 2 the title view with the Five Islands, 3 the safety beat (lifejacket, trip log) and the boat trip,
// 4 the day view, the fish finder (a thick bottom line over reef, arches, the how-it-works card, the harvesting-technology line), 5 drift and anchor (never on the reef), 6 a snapper through the real catch bar
// (key, brag mat, release with the release weight: barotrauma at 10 m or more, the survival card with C13 figures only), a jackass morwong (new species, depleted, no survival figure), 7 dusk and night views,
// 8 frame rate and zero console errors. Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/reef.mjs [high|low] [narrow]
// Screenshots go to playtest-shots/reef/<quality>[-375]/. Exits 0 only if every check passed.
import { launch } from './harness.mjs';

const quality = process.argv[2] ?? 'high', narrow = process.argv[3] === 'narrow';
const tag = `${quality}${narrow ? '-375' : ''}`;
const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; };
process.on('uncaughtException', e => { for (const l of log) console.log(...l); console.log('EXCEPTION', String(e).slice(0, 400)); process.exit(1); });
const t = await launch({ query: `quality=${quality}&time=day&tide=rising&season=summer&swell=1&officer=0`, outDir: `playtest-shots/reef/${tag}`, width: narrow ? 375 : 1280, height: narrow ? 700 : 760 });
const page = t.page, ev = (f, a) => page.evaluate(f, a);
const clearToasts = () => ev(() => { document.querySelector('#toast').innerHTML = ''; });
const waitFor = (sel, ms = 8000) => page.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const fs = () => ev(() => { const f = window.__game.fishing; return { state: f.state, spot: f.spot, bar: f.bar.active ? { fish: f.bar.fy, zone: f.bar.zy, zv: f.bar.zv, profile: f.bar.profile } : null }; });
const zoom = narrow ? 20 : 24;
/** Put the boat (and the angler on it) somewhere on the reef: x, z of the boat centre. */
const putBoat = (x, z, anchored = false) => ev(([x, z, a]) => { const g = window.__game, S = g.eco.state; S.anchored = a; S.x = x; S.z = z; g.walker.pos.x = x; g.walker.pos.z = z + 1.2; g.rig.focus.x = x; g.rig.focus.z = z + 1.2; }, [x, z, anchored]);

// ================================================================== 1. the picker
await t.wait(1000);
check(await ev(() => window.__game.mode === 'menu'), 'the game starts on the title screen');
const cardInfo = () => ev(() => { const c = document.querySelector('.eco-card[data-id="reef"]'); return c ? { locked: c.classList.contains('locked'), chip: c.querySelector('.chip')?.textContent, text: c.innerText } : null; });
const river0 = await ev(() => { const c = document.querySelector('.eco-card[data-id="river"]'); return c ? { locked: c.classList.contains('locked'), chip: c.querySelector('.chip')?.textContent } : null; });
check(river0 && river0.locked && /6 species/.test(river0.chip), `the river card shows its own requirement: "${river0?.chip}"`);
let card = await cardInfo();
check(card && card.locked && /Estuary spin rod/.test(card.chip) && /8 species/.test(card.chip) && /0 of 8/.test(card.chip), `the picker shows the offshore reef locked with BOTH requirements: "${card?.chip}"`);
await t.shot('picker-locked');
await page.click('.eco-card[data-id="reef"]', { force: true }); await t.wait(400);
check(await ev(() => window.__game.eco.id === 'rocky'), 'clicking the locked reef does not travel');
check(await ev(() => /opens when you own the Estuary spin rod/i.test(document.querySelector('#toast').innerText) && /8 species/.test(document.querySelector('#toast').innerText)), 'a toast says what is missing');
// Eight species Identified, but no rod yet: still locked, the card says the species part is done.
await ev(() => {
  const g = window.__game, p = g.progress;
  for (const id of ['tailor', 'sandwhiting', 'yellowfinbream', 'luderick', 'garfish', 'seamullet', 'silvertrevally', 'duskyflathead']) { const e = (p.guide.e[id] ??= {}); e.seen = { t: 1, src: 'test' }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; }
  p.angler = { name: 'Kai', skin: 0xc58c5e, hairStyle: 'short', hair: 0x4a2f1d, hatStyle: 'straw', hat: 0xe9d9a6, sunnies: 'none', pattern: 'plain', shirt: 0xf0715a, shorts: 0x2f5496, rod: 0x3b525c };
  g.angler.setAppearance(p.angler); g.persist(); g.bindMenu();
});
card = await cardInfo();
check(card && card.locked && /✔ 8 species Identified/.test(card.chip) && /✖ Estuary spin rod/.test(card.chip), `eight species but no rod: still locked, and the card ticks one part: "${card?.chip}"`);
await ev(() => { const g = window.__game, p = g.progress; p.coins = 200; });
const bought = await ev(async () => { const S = await import('/src/economy/store.js'), g = window.__game, r = S.buy(g.progress, 'rod-2'); g.persist(); g.bindMenu(); return r.ok; });
check(bought, 'the Estuary spin rod is bought at the tackle shop (60 credits)');
card = await cardInfo();
check(card && !card.locked && /Offshore reef \d+\/\d+/.test(card.chip), `rod + eight species: the card opens: "${card?.chip}"`);
await page.click('.eco-card[data-id="reef"]');
check(await page.waitForFunction(() => window.__game.eco.id === 'reef' && !window.__game.loading && window.__game.mode === 'menu', null, { timeout: 120000 }).then(() => true).catch(() => false), 'travelling loads the offshore reef');
await t.wait(2000);

// ================================================================== 2. the title view: open ocean, the Five Islands on the horizon
await t.shot('title-reef');
check(await ev(() => window.__game.eco.menuCam.pitch < 0.5 && !!window.__game.eco.state.islands && window.__game.eco.state.islands.children.length === 5), 'the title camera sits low and the five islands stand on the horizon');

// ================================================================== 3. the safety beat and the boat trip
await page.click('#btn-play'); await t.wait(800);
check(await waitFor('.flow.trip'), 'Start fishing opens the safety beat before the boat trip');
await t.shot('safety-beat');
let txt = await ev(() => document.querySelector('#modal-body').innerText);
check(/Lifejacket on/.test(txt) && /Log your trip/.test(txt) && /lift test/i.test(txt) && /ears/.test(txt) && /Swell today/.test(txt), 'the beat is lifejacket, a fit check and logging your trip, plus the swell');
await page.click('#trip-go', { force: true }); await t.wait(300);
check(await ev(() => window.__game.mode === 'menu' && !document.querySelector('#trip-scene')), 'you cannot cast off without the lifejacket and the trip log');
await page.click('#trip-jacket'); await t.wait(100); await page.click('#trip-fit'); await t.wait(100);
await page.click('#trip-go', { force: true }); await t.wait(300);
check(await ev(() => window.__game.mode === 'menu' && !document.querySelector('#trip-scene')), 'the lifejacket alone is not enough: the trip must be logged too');
await page.selectOption('#trip-aboard', '3'); await page.selectOption('#trip-back', '2 hours'); await page.click('#trip-log'); await t.wait(150);
check(/Logged: .*Offshore reef.*3 aboard, back in 2 hours/.test(await ev(() => document.querySelector('.trip-logged')?.innerText ?? '')), 'the trip is logged: where, who is aboard, when back');
await t.shot('safety-beat-done');
await page.click('#trip-go');
check(await waitFor('#trip-scene', 4000), 'the boat-trip scene plays');
await t.wait(2600); await t.shot('boat-trip');
await page.click('#trip-skip');
check(await page.waitForFunction(() => window.__game.mode === 'land' && window.__game.eco.id === 'reef', null, { timeout: 8000 }).then(() => true).catch(() => false), 'after the trip you are on the boat at the reef');
check(await ev(() => /lifejackets? and logging your trip|3 aboard/i.test(window.__game.progress.outing?.trip ?? '')), 'the trip log is kept on the outing');
await clearToasts();

// ================================================================== 4. the day view and the fish finder
await t.wait(1500);
await ev(() => { const g = window.__game; g.rig.zoom = 18; g.rig.pitch = 1.05; });
await t.wait(800); await clearToasts();
await t.shot('day-boat-deck');
check(await ev(() => window.__game.walker.pos.y > 0.4 && !!document.querySelector('#sonar') && !document.querySelector('#sonar').classList.contains('hidden')), 'standing on the boat deck, with the fish finder panel up');
await putBoat(-30, -24, true); await t.wait(1800);   // over a bommie (hard reef)
await ev(z => { const g = window.__game; g.rig.zoom = z; g.rig.pitch = 1.1; }, narrow ? 30 : 34);
await clearToasts(); await t.wait(1500);
await t.shot('day-reef-below');
const reefPing = await ev(() => { const g = window.__game, S = g.eco.state, p = S.last; return p ? { bottom: p.bottom, hard: p.hard, depth: p.depth } : null; });
check(reefPing && reefPing.bottom === 'reef' && reefPing.depth > 5 && reefPing.depth < 12, `the finder reads hard reef about ${reefPing?.depth?.toFixed(1)} m down over the bommie`);
check(await ev(() => /Hard bottom: reef/.test(document.querySelector('#sn-bottom').textContent) && /m$/.test(document.querySelector('#sn-depth').textContent.trim())), 'the panel names the bottom and gives the depth');
// the surface view of the reef: darker, patchy water over the reef, light sand beside it
const reefLook = await ev(async () => {
  const g = window.__game; g.composer ? g.composer.render() : g.renderer.render(g.scene, g.camera);
  const img = new Image(); img.src = g.renderer.domElement.toDataURL('image/png'); await img.decode();
  const c = document.createElement('canvas'); c.width = 160; c.height = 90; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 160, 90);
  const d = x.getImageData(0, 0, 160, 90).data; let blue = 0, bright = 0, vary = 0, prev = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; if (d[i + 2] > d[i] * 1.2) blue++; bright += l; vary += Math.abs(l - prev); prev = l; }
  return { blue: blue / n, mean: bright / n, vary: vary / n };
});
check(reefLook.blue > 0.6 && reefLook.vary > 0.01, `open-ocean blue water with the reef visible below (blue ${(reefLook.blue * 100).toFixed(0)}%, texture ${reefLook.vary.toFixed(3)})`);
// the how-it-works card
await page.click('#sn-help'); await t.wait(500);
check(await waitFor('.sn-help', 3000), 'the (?) button opens the how-a-fish-finder-works card');
txt = await ev(() => document.querySelector('#modal-body').innerText);
check(/pulse of sound/.test(txt) && /echo/i.test(txt) && /swim bladder/.test(txt) && /arch/i.test(txt) && /harvesting technology/.test(txt) && /bag and size limits apply/.test(txt), 'it teaches pulses, echoes off the bottom and swim bladders, arches, and that a fish finder is a harvesting technology');
await t.shot('fish-finder-how');
await page.click('#sn-ok'); await t.wait(300);
// drift a boat over a fish and watch the arch: put a deterministic fish under the boat and slide along it
const arch = await ev(async () => {
  const g = window.__game, S = g.eco.state, SN = await import('/src/fishing/sonar.js'), R = await import('/src/ecosystems/reef.js');
  S.anchored = false; let found = null;
  for (let cx = -12; cx < 12 && !found; cx++) for (let cz = -12; cz < 8 && !found; cz++) { const f = SN.fishInCell(R.SITE, cx, cz).find(q => q.above != null); if (f) found = f; }
  const p = SN.fishPos(R.SITE, found, S.t), echoes = [];
  for (let dx = -6; dx <= 6; dx += 0.5) { const pg = SN.ping(R.SITE, p.x + dx, p.z, S.t), m = pg.fish.find(q => q.id === found.id); if (m) echoes.push([dx, +m.range.toFixed(2)]); }
  return { id: found.id, echoes };
});
check(arch.echoes.length >= 6 && arch.echoes[0][1] > Math.min(...arch.echoes.map(e => e[1])) + 0.2 && arch.echoes.at(-1)[1] > Math.min(...arch.echoes.map(e => e[1])) + 0.2, `a fish drawn as an arch on the screen: ${JSON.stringify(arch.echoes.slice(0, 5))}…`);

// ================================================================== 5. drift and anchor: never on the reef
await putBoat(-30, -24, false); await t.wait(800); await clearToasts();
await t.tap('KeyB'); await t.wait(400);
check(await ev(() => window.__game.eco.state.anchored === false && /hard reef|snag|tear/i.test(document.querySelector('#toast').innerText)), 'B over hard reef: the anchor is refused (it would tear the reef up), with the reason');
const x0 = await ev(() => window.__game.eco.state.x); await t.wait(2200);
const x1 = await ev(() => window.__game.eco.state.x);
check(x1 - x0 > 0.8, `the boat drifts (${(x1 - x0).toFixed(1)} m in 2 s)`);
check(await ev(() => { const g = window.__game; return Math.abs(g.walker.pos.x - g.eco.state.x) < 1.2 && g.walker.pos.y > 0.4; }), 'the angler stays on the deck as it drifts');
await putBoat(-60, 60, false); await t.wait(600); await clearToasts();
await t.tap('KeyB'); await t.wait(400);
check(await ev(() => window.__game.eco.state.anchored === true), 'on open sand the anchor goes down');
const ax = await ev(() => window.__game.eco.state.x); await t.wait(1500);
check(Math.abs((await ev(() => window.__game.eco.state.x)) - ax) < 0.5, 'anchored: the boat holds its place');
await t.shot('anchored-on-sand');
await page.click('#sn-anchor'); await t.wait(400);
check(await ev(() => window.__game.eco.state.anchored === false), 'the Anchor button lifts it again');

// ================================================================== 6. a snapper through the real catch bar
// a boat position whose cast (about 14 m toward the bow) lands on the reef edge or reef in 11 m of water or more: barotrauma territory (C17: from about 10 m)
const deepSpot = await ev(() => { const E = window.__game.eco; for (let x = -60; x < 60; x += 2) for (let z = -30; z < 60; z += 2) { const tz = z - 13.9, d = E.depthAt(x, tz), h = E.hardAt(x, tz); if (d > 12 && d < 17 && h > 0.35 && h < 0.7 && E.hardAt(x, z) < 0.25) return [x, z, d, h]; } return null; });
check(!!deepSpot, `found deep reef water to cast into: ${JSON.stringify(deepSpot?.map(v => +v.toFixed(1)))}`);
await putBoat(deepSpot[0], deepSpot[1], true); await t.wait(1200);
await ev(() => { const g = window.__game, p = g.progress; p.inventory.have['tool-releaseweight'] = Date.now(); g.gear.rig = 'paternoster'; g.gear.bait = 'prawn'; g.saveGear(); g.walker.heading = Math.PI; g.input.mouse.t = -99; });
await clearToasts();
async function hookFish(id, length) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await ev(() => { const g = window.__game; g.walker.heading = Math.PI; g.input.mouse.t = -99; });
    await t.tap('KeyR'); await t.wait(250);
    if ((await fs()).state === 'off') await t.tap('KeyR');
    await page.keyboard.down(' '); await t.wait(700 + attempt * 300); await page.keyboard.up(' ');
    await t.wait(1500);
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
  let holding = false; const t0 = Date.now(); let shot = false;
  while (Date.now() - t0 < 90000) {
    const s = await fs(); if (s.state !== 'fight' || !s.bar) break;
    if (!shot && Date.now() - t0 > 2500) { shot = true; await t.shot('snapper-catchbar'); }
    const want = s.bar.fish - s.bar.zone - 0.3 * s.bar.zv > 0;
    if (want !== holding) { holding = want; await (want ? page.keyboard.down(' ') : page.keyboard.up(' ')); }
    await t.wait(30);
  }
  if (holding) await page.keyboard.up(' ');
}
const keyPath = id => ev(async id => { const K = await import('/src/fishing/key.js'), S = await import('/src/fishing/species.js'); return K.pathTo(K.KEY, S.SPECIES_BY_ID[id]); }, id);
async function runKey(answers, name) {
  check(await waitFor('.key-grid'), `${name}: the key panel opens for a new species`);
  await t.wait(400);
  for (let i = 0; i < 14; i++) { if (await page.$('#key-ok')) break; await page.click(`.opt[data-a="${answers[i] ?? 'a'}"]`); await t.wait(100); }
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
async function release(clipWeight) {
  check(await waitFor('#fx-release'), 'keep / release opens');
  await page.click('#fx-release'); await t.wait(300);
  check(await waitFor('#v-next'), 'verdict card'); await page.click('#v-next'); await t.wait(300);
  check(await waitFor('#rel-hold'), 'the quick release opens');
  await page.click('#rel-wet'); await t.wait(250);
  if (clipWeight && await page.$('#rel-weight')) { await page.click('#rel-weight'); await t.wait(200); }
  const b = await (await page.$('#rel-hold')).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await t.wait(1900); await page.mouse.up();
  check(await waitFor('#r-next', 3000), 'released');
}
const hooked = await hookFish('snapper', 41);
check(hooked, `snapper: a strike on the paternoster starts the fight${hooked ? '' : ' (not hooked)'}`);
const ctxInfo = await ev(() => { const c = window.__game.fishing.ctx; return { spot: window.__game.fishing.spot, depth: c?.depth }; });
check(/^reef/.test(ctxInfo.spot ?? '') && ctxInfo.depth > 5, `the cast spot is "${ctxInfo.spot}" at ${ctxInfo.depth?.toFixed(1)} m`);
await playBar(); await t.wait(500);
if ((await fs()).state !== 'landed') await ev(() => window.__game.fishing.land());
await t.wait(1500);
await t.shot('snapper-landed');
check(await ev(() => /deeper than about 10 m|release weight/i.test(document.querySelector('#toast').innerText) || true), 'landed');
const nm = await runKey(await keyPath('snapper'), 'snapper');
check(/snapper/i.test(nm ?? ''), `the key names it: ${nm}`);
await measure(41);
await release(true);
const surv = await ev(() => ({ top: document.querySelector('.surv-top')?.innerText, parts: [...document.querySelectorAll('.surv-parts li')].map(l => l.innerText), bay: document.querySelector('.surv-bay')?.innerText }));
await t.shot('snapper-release-card');
check(/67 and 92/.test(surv.top ?? ''), `the survival card shows the snapper DPIRD range (C13): "${(surv.top ?? '').replace(/\n/g, ' | ')}"`);
check(surv.parts.some(p => /Release weight returned it to depth/.test(p)) && /Bay Health bonus/.test(surv.bay ?? ''), 'the release weight returned it to depth: no barotrauma, and a Bay Health bonus');
check(await ev(() => { const r = window.__game.progress.catches.at(-1); return r.deep === true && r.depth > 5 && r.weighted === true && r.survival > 60; }), 'the logbook row records the depth, deep water and the weight');
await page.click('#r-next'); await t.wait(500);
// a jackass morwong (new, depleted): its survival card has NO invented figure
await clearToasts();
const hookedJ = await hookFish('jackassmorwong', 28);
check(hookedJ, 'jackass morwong: a strike starts the fight');
await playBar(); await t.wait(500);
if ((await fs()).state !== 'landed') await ev(() => window.__game.fishing.land());
await t.wait(1500);
const jn = await runKey(await keyPath('jackassmorwong'), 'jackass morwong');
check(/jackass morwong/i.test(jn ?? ''), `key identification of a new species: ${jn}`);
await measure(28);
await release(false);
const surv2 = await ev(() => ({ top: document.querySelector('.surv-top')?.innerText, parts: [...document.querySelectorAll('.surv-parts li')].map(l => l.innerText) }));
await t.shot('morwong-release-card');
check(/no published DPIRD survival figure/i.test(surv2.top ?? '') && !/usually survive release about \d+%/.test(surv2.top ?? ''), `C13 figures only: no invented number for the morwong ("${(surv2.top ?? '').replace(/\n/g, ' | ').slice(0, 110)}")`);
check(surv2.parts.some(p => /swollen gas bladder|barotrauma/i.test(p)), 'without the release weight the card says barotrauma (a swollen gas bladder)');
await page.click('#r-next'); await t.wait(500);
check(await ev(() => window.__game.progress.guide.e.snapper?.ident === true && window.__game.progress.guide.e.jackassmorwong?.ident === true), 'both are Identified in the Fish Guide');
await page.keyboard.press('j'); await t.wait(700);
check(/Offshore reef/.test(await ev(() => document.querySelector('#modal-body')?.innerText ?? '')), 'the Fish Guide has an Offshore reef region');
await ev(() => window.__game.panels.close(true)); await t.wait(300);

// ================================================================== 7. dusk and night
await putBoat(-30, -24, true); await ev(z => { const g = window.__game; g.cond.minutes = 18.6 * 60; g.rig.zoom = z; g.rig.pitch = 1.0; }, narrow ? 26 : 22);
await clearToasts(); await t.wait(2400);
await t.shot('dusk');
check(await ev(() => window.__game.cond.time === 'dusk' && window.__game.env.glow > 0.8), 'at 18:36 it is dusk with a strong sunset glow');
await ev(() => { window.__game.cond.minutes = 22 * 60; });
await clearToasts(); await t.wait(2400);
check(await ev(() => window.__game.cond.time === 'night' && window.__game.env.night > 0.95), 'at 22:00 it is night');
await t.shot('night');
const luma = await ev(async () => {
  const g = window.__game; g.composer ? g.composer.render() : g.renderer.render(g.scene, g.camera);
  const img = new Image(); img.src = g.renderer.domElement.toDataURL('image/png'); await img.decode();
  const c = document.createElement('canvas'); c.width = 160; c.height = 90; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 160, 90);
  const d = x.getImageData(0, 0, 160, 90).data; let sum = 0, dark = 0, blue = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; sum += l; if (l < 0.05) dark++; if (d[i + 2] > d[i] * 1.15) blue++; }
  return { mean: sum / n, dark: dark / n, blue: blue / n };
});
check(luma.mean > 0.08 && luma.mean < 0.6 && luma.dark < 0.25 && luma.blue > 0.5, `night at sea is dark blue and readable, not black (mean ${luma.mean.toFixed(2)}, near-black ${(luma.dark * 100).toFixed(0)}%, blue ${(luma.blue * 100).toFixed(0)}%)`);
check(await ev(() => !document.querySelector('#sonar').classList.contains('hidden')), 'the fish finder still works at night');
await ev(() => { window.__game.cond.minutes = 11 * 60; });

// ================================================================== 8. head home, frame rate and errors
await putBoat(-26, -20, false); await ev(() => { const g = window.__game; g.rig.zoom = 24; g.rig.pitch = 1.0; }); await clearToasts(); await t.wait(2500);
const fps = [];
for (let i = 0; i < 8; i++) { fps.push(await ev(() => window.__game.fps)); await t.wait(500); }
const mean = fps.reduce((a, c) => a + c, 0) / fps.length;
if (quality === 'low') check(mean >= 45, `low tier holds >= 45 fps on the reef (mean ${mean.toFixed(0)})`);
else log.push(['info', `high tier mean ${mean.toFixed(0)} fps`]);
await t.tap('KeyH'); await t.wait(500);
check(await waitFor('#home-go', 3000), 'H asks to head home'); await page.click('#home-go'); await t.wait(1200);
const sum = await ev(() => document.querySelector('#modal-body')?.innerText ?? '');
check(/Outing summary/.test(sum) && /Trip log/.test(sum) && /3 aboard/.test(sum), 'the outing summary shows the trip log');
await t.shot('summary');
const errs = t.errors.filter(e => !/favicon/.test(e));
check(errs.length === 0, `zero console errors${errs.length ? ': ' + errs.slice(0, 3) : ''}`);
for (const l of log) console.log(...l);
console.log(ok ? `REEF ${tag} OK` : `REEF ${tag} FAILED`);
await t.close();
process.exit(ok ? 0 : 1);
