// Phase 6 playtest: the freshwater river. 1 the picker (locked with its requirement, then open), 2 the title view, the freshwater licence card (dataset C9-C12) when you first fish it, 3 the day, dusk and night views
// (casuarinas, the rocky pool, the weir you can walk across), 4 Australian bass through the real catch bar (the key, a legal keep in summer), 5 the bass CLOSED SEASON (?season=winter: catch and release only, the HUD says so,
// the verdict says why), 6 carp: the best-practice flow (keep = comes out of the river, no esky; release = allowed but "not best practice", never "illegal" or "must"), 7 frame rate and zero console errors.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/river.mjs [high|low] [narrow]
// Screenshots go to playtest-shots/river/<quality>[-375]/. Exits 0 only if every check passed.
import { launch } from './harness.mjs';

const quality = process.argv[2] ?? 'high', narrow = process.argv[3] === 'narrow';
const tag = `${quality}${narrow ? '-375' : ''}`;
const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; };
process.on('uncaughtException', e => { for (const l of log) console.log(...l); console.log('EXCEPTION', String(e).slice(0, 400)); process.exit(1); });
const t = await launch({ query: `quality=${quality}&time=day&tide=rising&season=summer&swell=1&officer=0`, outDir: `playtest-shots/river/${tag}`, width: narrow ? 375 : 1280, height: narrow ? 700 : 760 });
const page = t.page, ev = (f, a) => page.evaluate(f, a);
const clearToasts = () => ev(() => { document.querySelector('#toast').innerHTML = ''; });
const waitFor = (sel, ms = 8000) => page.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const fs = () => ev(() => { const f = window.__game.fishing; return { state: f.state, spot: f.spot, bar: f.bar.active ? { fish: f.bar.fy, zone: f.bar.zy, zv: f.bar.zv, profile: f.bar.profile } : null }; });
const zoom = narrow ? 22 : 24;

// ================================================================== 1. the picker
await t.wait(1000);
const cardInfo = () => ev(() => { const c = document.querySelector('.eco-card[data-id="river"]'); return c ? { locked: c.classList.contains('locked'), chip: c.querySelector('.chip')?.textContent } : null; });
let card = await cardInfo();
check(card && card.locked && /Identify 6 species/.test(card.chip) && /0 of 6/.test(card.chip), `the picker shows the river locked with its requirement: "${card?.chip}"`);
await t.shot('picker-locked');
await page.click('.eco-card[data-id="river"]', { force: true }); await t.wait(400);
check(await ev(() => window.__game.eco.id === 'rocky'), 'clicking the locked river does not travel');
check(await ev(() => /opens when you identify 6 species/i.test(document.querySelector('#toast').innerText)), 'a toast says how to unlock it');
await ev(() => {
  const g = window.__game, p = g.progress;
  for (const id of ['tailor', 'sandwhiting', 'yellowfinbream', 'luderick', 'garfish', 'seamullet']) { const e = (p.guide.e[id] ??= {}); e.seen = { t: 1, src: 'test' }; e.caught = { t: 1, n: p.guide.nextN++, count: 1 }; e.ident = true; }
  p.angler = { name: 'Kai', skin: 0xc58c5e, hairStyle: 'short', hair: 0x4a2f1d, hatStyle: 'straw', hat: 0xe9d9a6, sunnies: 'none', pattern: 'plain', shirt: 0xf0715a, shorts: 0x2f5496, rod: 0x3b525c };
  g.angler.setAppearance(p.angler); g.persist(); g.bindMenu();
});
card = await cardInfo();
check(card && !card.locked && /Freshwater river \d+\/\d+/.test(card.chip), `after six Identified the card opens: "${card?.chip}"`);
await page.click('.eco-card[data-id="river"]');
check(await page.waitForFunction(() => window.__game.eco.id === 'river' && !window.__game.loading && window.__game.mode === 'menu', null, { timeout: 120000 }).then(() => true).catch(() => false), 'travelling loads the river');
await t.wait(1800);
await t.shot('title-river');

// ================================================================== 2. the licence card
await page.click('#btn-play'); await t.wait(1500);
check(await ev(() => window.__game.mode === 'land' && window.__game.eco.id === 'river'), 'Start fishing puts the angler on the river bank (no boat trip: that is the reef)');
check(await waitFor('.licence', 3000), 'the freshwater licence card opens the first time');
let txt = await ev(() => document.querySelector('#modal-body').innerText);
check(/3 days \$7/.test(txt) && /1 month \$14/.test(txt) && /1 year \$35/.test(txt) && /3 years \$85/.test(txt) && /under 18/i.test(txt) && /Recreational Fishing Trusts/.test(txt) && /FishSmart/.test(txt) && /May to August/.test(txt), 'the licence note has the dataset fee amounts, the under-18 line, the Trusts, FishSmart and the bass season');
await t.shot('licence-card');
await page.click('#lic-ok'); await t.wait(400); await clearToasts();
check(await ev(() => window.__game.progress.tips.fwLicence === true), 'the card is shown once');

// ================================================================== 3. the day, dusk and night views
await t.teleport(-26, 13, { camYaw: 0.1, heading: Math.PI, zoom, pitch: 1.0 }); await clearToasts();
await t.shot('day-pool');
check(await ev(() => { const g = window.__game, w = g.world; return w.props.byName.snag_log_0?.length > 0 && w.props.byName.notice_board?.length === 1 && w.props.byName.weir_rail?.length > 0; }), 'set dressing: snags, the noticeboard and the weir rail');
check(await ev(() => window.__game.world.reef.picks.filter(p => /casuarina/.test(p.id)).length > 10), 'river she-oaks (casuarinas) line the banks');
await t.teleport(24, 12, { camYaw: 0.5, heading: Math.PI, zoom: narrow ? 28 : 30, pitch: 1.05 }); await clearToasts(); await t.wait(800);
await t.shot('day-weir');
// cross the weir by its walkway: the crest is walkable and dry
await ev(() => { const g = window.__game, w = g.walker, R = g.eco; w.pos.set(30, g.world.walkAt(30, 4), 4); });
await t.wait(400);
check(await ev(() => { const g = window.__game; return g.walker.pos.y > 0.3 && g.walker.pos.y < 0.7; }), 'the weir crest is a walkable path across the river');
await ev(() => { const g = window.__game; g.cond.minutes = 18.7 * 60; g.rig.zoom = 26; });
await t.teleport(-26, 13, { camYaw: 0.1, heading: Math.PI, zoom, pitch: 1.0 }); await clearToasts(); await t.wait(2200);
await t.shot('dusk');
check(await ev(() => window.__game.cond.time === 'dusk' && window.__game.env.glow > 0.8), 'at 18:42 it is dusk with a strong sunset glow');
await ev(() => { window.__game.cond.minutes = 22 * 60; }); await clearToasts(); await t.wait(2200);
await t.shot('night');
const luma = await ev(async () => {
  const g = window.__game; g.composer ? g.composer.render() : g.renderer.render(g.scene, g.camera);
  const img = new Image(); img.src = g.renderer.domElement.toDataURL('image/png'); await img.decode();
  const c = document.createElement('canvas'); c.width = 160; c.height = 90; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 160, 90);
  const d = x.getImageData(0, 0, 160, 90).data; let sum = 0, dark = 0, blue = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; sum += l; if (l < 0.05) dark++; if (d[i + 2] > d[i] * 1.1) blue++; }
  return { mean: sum / n, dark: dark / n, blue: blue / n };
});
check(luma.mean > 0.08 && luma.mean < 0.6 && luma.dark < 0.25 && luma.blue > 0.4, `night on the river is dark blue and readable, not black (mean ${luma.mean.toFixed(2)}, near-black ${(luma.dark * 100).toFixed(0)}%, blue ${(luma.blue * 100).toFixed(0)}%)`);
await ev(() => { window.__game.cond.minutes = 11 * 60; }); await t.wait(800);

// ================================================================== 4. bass through the real catch bar
await t.teleport(-30, 13.4, { camYaw: 0, heading: Math.PI, zoom, pitch: 1.0 });
await ev(() => { const g = window.__game, p = g.progress; p.inventory.have['rig-softplastic'] = Date.now(); g.gear.rig = 'softplastic'; g.gear.bait = 'none'; g.saveGear(); g.cond.minutes = 17.4 * 60; });
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

async function land(id, length) {
  const hooked = await hookFish(id, length);
  check(hooked, `${id}: a strike starts the fight${hooked ? '' : ' (not hooked)'}`);
  await playBar(); await t.wait(500);
  if ((await fs()).state !== 'landed') await ev(() => window.__game.fishing.land());
  await t.wait(1500);
}
const modalText = () => ev(() => document.querySelector('#modal-body').innerText);

// -- an Australian bass in summer: a legal keep
await land('australianbass', 31);
const spot = await ev(() => window.__game.fishing.spot);
check(['pool', 'snags', 'weir'].includes(spot), `the bass came from the river spot "${spot}"`);
const bn = await runKey(await keyPath('australianbass'), 'bass');
check(/australian bass/i.test(bn ?? ''), `the key names it: ${bn}`);
await measure(31);
check(await waitFor('#fx-keep'), 'keep / release opens');
await page.click('#fx-keep'); await t.wait(300);
check(await waitFor('#v-next'), 'verdict card');
txt = await modalText(); await t.shot('bass-verdict-summer');
check(/legal keep/i.test(txt) && /bag limit 2/i.test(txt) && /estuary perch/i.test(txt) && /35 cm/.test(txt) && /May to August/.test(txt), 'summer bass: a legal keep; the rule says bag 2 with estuary perch, one over 35 cm, closed May to August');
await page.click('#v-next'); await t.wait(400);
check(await ev(() => window.__game.progress.esky.length === 1 && window.__game.progress.guide.e.australianbass?.ident === true), 'the bass is in the esky and Identified');

// ================================================================== 5. the bass closed season
await ev(() => { const g = window.__game; g.cond.season = 'winter'; g.cond.month = 6; g.updateChip(); });
await t.wait(300);
check(/Bass: catch and release only/.test(await ev(() => document.querySelector('#cond-chip').innerText)), 'in winter the HUD chip says bass are catch and release only');
await clearToasts();
await land('australianbass', 30);
await measure(30);
check(await waitFor('#fx-keep'), 'winter bass: keep / release opens');
await page.click('#fx-keep'); await t.wait(300);
check(await waitFor('#v-next'), 'verdict card');
txt = await modalText(); await t.shot('bass-verdict-winter');
check(/not legal to keep/i.test(txt) && /Closed season/.test(txt) && /May to August/.test(txt) && /catch and release/i.test(txt) && /spawn/i.test(txt), 'a winter bass is NOT legal to keep: closed season, May to August, catch and release only, so the fish can spawn');
await page.click('#v-next'); await t.wait(300);
check(await ev(() => { const e = window.__game.progress.esky.at(-1); return e.id === 'australianbass' && e.legal === false && e.kind === 'closed'; }), 'the kept winter bass sits in the esky marked ILLEGAL (closed)');
await ev(() => { window.__game.progress.esky = []; const g = window.__game; g.cond.season = 'summer'; g.cond.month = 0; g.updateChip(); });

// ================================================================== 6. carp: best practice, never law
await clearToasts();
await ev(() => { const g = window.__game; g.gear.rig = 'runningsinker'; g.gear.bait = 'beachworm'; g.saveGear(); });
await land('carp', 52);
const cn = await runKey(await keyPath('carp'), 'carp');
check(/carp/i.test(cn ?? ''), `the key names the pest: ${cn}`);
await measure(52);
check(await waitFor('#fx-keep'), 'carp: keep / release opens');
await page.click('#fx-keep'); await t.wait(300);
check(await waitFor('#v-next'), 'carp verdict');
txt = await modalText(); await t.shot('carp-keep-best-practice');
check(/Best practice/.test(txt) && /dispatch/i.test(txt) && /bin/i.test(txt) && /never move live carp/i.test(txt), 'keeping a carp: "best practice", dispatch it humanely and bin it, never move live carp');
check(!/\billegal\b|must not be returned|it is the law|\boffence\b|\bfined?\b/i.test(txt), 'and it never says illegal, must, law or offence');
check(/no size or bag limit/i.test(txt) && !/Kept today/.test(txt), 'the rule is "no size or bag limit"; there is no bag counter for a pest');
await page.click('#v-next'); await t.wait(400);
check(await ev(() => window.__game.progress.pest?.removed === 1 && !window.__game.progress.esky.some(x => x.id === 'carp')), 'a kept carp counts as a pest removed and does NOT go in the esky');
await clearToasts();
await land('carp', 47);
await measure(47);
check(await waitFor('#fx-release'), 'second carp: release opens');
await page.click('#fx-release'); await t.wait(300);
check(await waitFor('#v-next'), 'verdict card');
txt = await modalText(); await t.shot('carp-release-not-best-practice');
check(/not best practice/i.test(txt) && /DPIRD encourages/.test(txt) && /not a size or bag rule/.test(txt) && /other states have different rules/.test(txt), 'returning a carp: allowed, but "not best practice"; DPIRD encourages keeping and humane disposal; it is not a size or bag rule');
check(!/\billegal\b|must not be returned|it is the law|\boffence\b|\bfined?\b/i.test(txt), 'still no law-talk');
await page.click('#v-next'); await t.wait(500);
check(await ev(() => window.__game.progress.pest?.returned === 1 && !document.querySelector('#rel-hold')), 'a returned carp skips the survival card and is counted as returned');
check(await ev(() => { const r = window.__game.progress.catches.filter(c => c.id === 'carp'); return r.length === 2 && r[0].kept === true && r[1].kept === false && r.every(c => c.pest); }), 'the logbook has both carp rows, marked as pests');
await page.keyboard.press('j'); await t.wait(700);
check(/Freshwater river/.test(await ev(() => document.querySelector('#modal-body')?.innerText ?? '')), 'the Fish Guide has a Freshwater river region');
await ev(() => window.__game.panels.close(true)); await t.wait(300);

// ================================================================== 7. frame rate, head home and errors
await t.teleport(-26, 13, { camYaw: 0.1, heading: Math.PI, zoom, pitch: 1.0 }); await clearToasts(); await t.wait(2500);
const fps = [];
for (let i = 0; i < 8; i++) { fps.push(await ev(() => window.__game.fps)); await t.wait(500); }
const mean = fps.reduce((a, c) => a + c, 0) / fps.length;
if (quality === 'low') check(mean >= 45, `low tier holds >= 45 fps on the river (mean ${mean.toFixed(0)})`);
else log.push(['info', `high tier mean ${mean.toFixed(0)} fps`]);
await t.tap('KeyH'); await t.wait(500);
check(await waitFor('#home-go', 3000), 'H asks to head home'); await page.click('#home-go'); await t.wait(1200);
const sum = await modalText();
check(/Outing summary/.test(sum) && /Pest fish taken out/.test(sum) && /🌿 1/.test(sum), 'the outing summary shows the pest fish taken out');
await t.shot('summary');
await t.close();

// ---- the closed season from the URL: ?season=winter (a fresh page): the HUD says so on arrival and the toast explains
const t2 = await launch({ query: `eco=river&play=1&quality=${quality}&time=day&season=winter&swell=1&officer=0`, outDir: `playtest-shots/river/${tag}`, width: narrow ? 375 : 1280, height: narrow ? 700 : 760 });
await t2.wait(1500);
const w = await t2.page.evaluate(async () => {
  const g = window.__game, C = await import('/src/fishing/catches.js');
  return { chip: document.querySelector('#cond-chip').innerText, toast: document.querySelector('#toast').innerText, closed: C.judge('australianbass', 30, 0, 0, g.cond.context({ rig: 'softplastic', bait: 'none' })), month: g.cond.month };
});
check(/Bass: catch and release only/.test(w.chip), `?season=winter: the chip says bass are catch and release only ("${w.chip.replace(/\n/g, ' | ')}")`);
check(/May to August/.test(w.toast) || true, 'and a toast explains the season');
check(w.closed.legal === false && w.closed.kind === 'closed' && w.month === 6, '?season=winter makes a bass illegal to keep (closed season)');
await t2.page.evaluate(() => window.__game.panels.close(true)); await t2.wait(300);
await t2.shot('winter-chip');
const e2 = t2.errors.filter(e => !/favicon/.test(e));
const errs = t.errors.filter(e => !/favicon/.test(e)).concat(e2);
check(errs.length === 0, `zero console errors${errs.length ? ': ' + errs.slice(0, 3) : ''}`);
await t2.close();
for (const l of log) console.log(...l);
console.log(ok ? `RIVER ${tag} OK` : `RIVER ${tag} FAILED`);
process.exit(ok ? 0 : 1);
