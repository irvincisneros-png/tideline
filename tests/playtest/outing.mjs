// Full-outing playtest: cast -> bite -> land -> dichotomous key (scripted correct path from the key data) -> brag-mat measure -> keep or release
// (with the quick-release step) -> head home -> Fisheries Officer (forced with ?officer=1) -> outing summary -> Fish Guide tiers -> logbook -> title.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/outing.mjs [high|low] [rocky|seagrass] [narrow]
// Screenshots go to playtest-shots/outing/<site>-<quality>[-375]/. Exits 0 only if every check passed and there were no console errors.
// The first fish is played on the real catch bar; the later ones are landed directly (fishing.land()) to keep the run short.
import { launch } from './harness.mjs';

const quality = process.argv[2] ?? 'high', site = process.argv[3] ?? 'seagrass', narrow = process.argv[4] === 'narrow';
const tag = `${site}-${quality}${narrow ? '-375' : ''}`;
const t = await launch({ query: `eco=${site}&quality=${quality}&play=1&time=day&tide=rising&season=summer&officer=1`, outDir: `playtest-shots/outing/${tag}`, width: narrow ? 375 : 1280, height: narrow ? 700 : 760 });
const page = t.page, log = [];
process.on('uncaughtException', e => { for (const l of log) console.log(...l); console.log('EXCEPTION', String(e).slice(0, 400)); process.exit(1); });
let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; };
const ev = (fn, arg) => page.evaluate(fn, arg);
const fs = () => ev(() => { const f = window.__game.fishing; return { state: f.state, spot: f.spot, bar: f.bar.active ? { fish: f.bar.fy, zone: f.bar.zy, zv: f.bar.zv } : null }; });
const clearToasts = () => ev(() => { document.querySelector('#toast').innerHTML = ''; });

await t.wait(1200);
// Stand at a casting spot facing the water: the jetty end at the lake, the beach at Bellambi.
if (site === 'seagrass') await t.teleport(16, 21, { camYaw: 0.15, heading: Math.PI, zoom: 14 });
else await t.teleport(4, 86, { camYaw: -0.3, heading: Math.PI, zoom: 14 });
await clearToasts();
await t.shot('01-at-water');

/** Cast, wait for the bite (forced quickly), strike. Overrides what bites so the key path is known. */
async function hookFish(id, length) {
  // Cast; if the float would land on dry ground (the tide moves while we play), cast again harder.
  for (let attempt = 0; attempt < 4; attempt++) {
    await ev(() => { const g = window.__game; g.walker.heading = Math.PI; g.input.mouse.t = -99; }); // face the water (the pointer parked over a button would turn the angler)
    await t.tap('KeyR'); await t.wait(250);
    if ((await fs()).state === 'off') await t.tap('KeyR');
    await page.keyboard.down(' '); await t.wait(900 + attempt * 350); await page.keyboard.up(' ');
    await t.wait(1400);
    const st0 = await fs(); log.push(['dbg', id, attempt, st0.state, await ev(() => [...document.querySelectorAll('.toast')].map(e => e.textContent).join('|').slice(0, 120)), await ev(() => { const w = window.__game.walker; return [w.pos.x.toFixed(1), w.pos.z.toFixed(1), w.heading.toFixed(2)].join(','); })]);
    if (st0.state === 'wait') break;
    await clearToasts();
  }
  await ev(() => { window.__game.fishing.waitT = 0.05; });
  for (let i = 0; i < 80; i++) { if ((await fs()).state === 'bite') break; await t.wait(60); }
  await ev(([i, l]) => { window.__game.fishing.catch = { id: i, length: l, gear: 1 }; }, [id, length]);
  await t.tap('Space'); await t.wait(250);
  const st = await fs(); check(st.state === 'fight', `${id}: strike starts the fight${st.state === 'fight' ? '' : ' (state ' + st.state + ')'}`);
}
/** Play the catch bar with a simple controller until the fish is landed. */
async function playBar() {
  let holding = false; const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const s = await fs(); if (s.state !== 'fight' || !s.bar) break;
    const want = s.bar.fish - s.bar.zone - 0.3 * s.bar.zv > 0;
    if (want !== holding) { holding = want; await (want ? page.keyboard.down(' ') : page.keyboard.up(' ')); }
    await t.wait(30);
  }
  if (holding) await page.keyboard.up(' ');
}
const land = () => ev(() => window.__game.fishing.land());
const waitFor = (sel, ms = 8000) => page.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const keyPath = id => ev(async id => { const K = await import('/src/fishing/key.js'), S = await import('/src/fishing/species.js'); return K.pathTo(K.KEY, S.SPECIES_BY_ID[id]); }, id);

/** The dichotomous key: answers = ['a','b',...] (last answer then confirm). */
async function runKey(answers, shotName) {
  check(await waitFor('.key-grid'), 'the key panel opens for an unidentified fish');
  await t.wait(500);
  if (shotName) await t.shot(`${shotName}-key-start`);
  for (let i = 0; i < 12; i++) {
    if (await page.$('#key-ok')) break; // a wrong first answer can reach a leaf sooner than the right path
    await page.click(`.opt[data-a="${answers[i] ?? 'a'}"]`); await t.wait(120);
    if (shotName && i === 1) await t.shot(`${shotName}-key-step`);
  }
  check(await waitFor('#key-ok', 3000), 'the key ends at a proposed name');
  if (shotName) await t.shot(`${shotName}-key-leaf`);
  await page.click('#key-ok'); await t.wait(300);
}
const leafName = () => ev(() => document.querySelector('.leaf-name')?.textContent);

/** Brag mat: drag the marker near the target length, nudge it exactly, lock in. */
async function measure(target, shotName) {
  check(await waitFor('#mat-board'), 'the brag mat opens');
  await t.wait(500);
  const geo = await ev(() => { const i = document.querySelector('#mat-fish').getBoundingClientRect(), b = document.querySelector('#mat-board').getBoundingClientRect(), len = window.__game.catchFlow.c.length; return { x0: i.left, pxcm: i.width / len, y: b.top + b.height / 2 }; });
  await page.mouse.move(geo.x0 + 20, geo.y); await page.mouse.down(); await page.mouse.move(geo.x0 + target * geo.pxcm, geo.y, { steps: 8 }); await page.mouse.up();
  for (let i = 0; i < 12; i++) {
    const v = +(await ev(() => document.querySelector('#mr').textContent));
    if (v === target) break;
    await page.click(v < target ? '#m-plus' : '#m-minus');
  }
  check(+(await ev(() => document.querySelector('#mr').textContent)) === target, `marker reads ${target} cm`);
  if (shotName) await t.shot(`${shotName}-measure-before`);
  await page.click('#m-lock'); await t.wait(300);
  if (shotName) await t.shot(`${shotName}-measure-after`);
  const res = await ev(() => document.querySelector('#mr-res')?.textContent);
  await page.click('#m-next'); await t.wait(250);
  return res;
}

/** Keep or release (rules hidden until you commit), then the verdict card. */
async function decide(keep, shotName) {
  check(await waitFor('#fx-keep'), 'keep / release decision opens');
  const hiddenBefore = await ev(() => !/(legal length|bag limit)\s*(is|of)?\s*\d+/i.test(document.querySelector('#modal-body').innerText));
  check(hiddenBefore, 'the rules are hidden before the decision');
  if (shotName) await t.shot(`${shotName}-decide`);
  await page.click(keep ? '#fx-keep' : '#fx-release'); await t.wait(300);
  check(await waitFor('#v-next'), 'verdict card with the reason');
  const txt = await ev(() => document.querySelector('#modal-body').innerText);
  if (shotName) await t.shot(`${shotName}-verdict`);
  await page.click('#v-next'); await t.wait(250);
  return txt;
}

async function quickRelease({ wet, shotName }) {
  check(await waitFor('#rel-hold'), 'quick release step opens');
  if (wet) await page.click('#rel-wet');
  await t.wait(400);
  if (shotName) await t.shot(`${shotName}-release`);
  const b = await (await page.$('#rel-hold')).boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await t.wait(1900); await page.mouse.up();
  check(await waitFor('#r-next', 3000), 'hold-to-unhook completes the release');
  const txt = await ev(() => document.querySelector('#modal-body').innerText);
  if (shotName) await t.shot(`${shotName}-released`);
  await page.click('#r-next'); await t.wait(400);
  return txt;
}

// ---------------------------------------------------------------- fish A: tailor 31 cm, key right, measure right, keep (legal)
await hookFish('tailor', 31);
await t.shot('02-fight');
await playBar();
await t.wait(400);
check((await fs()).state === 'landed', 'catch bar won: fish landed');
await t.shot('03-landed');
await runKey(await keyPath('tailor'), '04');
await measure(31, '05');
let txt = await decide(true, '06');
check(/legal keep/i.test(txt), 'tailor 31 cm keep is a legal keep');
check((await ev(() => window.__game.progress.esky.length)) === 1, 'the legal fish is in the esky');
await t.wait(500);
await clearToasts();
await t.shot('07-after-keep-hud');
check(await ev(() => /Esky 1/.test(document.querySelector('#stat-chip').innerText)), 'the esky chip shows 1 fish');

// ---------------------------------------------------------------- fish B: dusky flathead 30 cm (undersize): key right, measure off by 3, keep it (illegal)
await hookFish('duskyflathead', 30);
await land(); await t.wait(1900);
await runKey(await keyPath('duskyflathead'));
await measure(33, '08');
txt = await decide(true, '09');
check(/not legal to keep/i.test(txt) && /breed/i.test(txt), 'undersize keep: verdict gives the reason (breeding)');
check(await ev(() => window.__game.progress.esky.length === 2 && window.__game.progress.esky[1].legal === false), 'the illegal fish is in the esky marked illegal');
await t.wait(400);
check(await ev(() => /illegal/i.test(document.querySelector('#stat-chip').innerText)), 'the esky chip flags the illegal fish');

// ---------------------------------------------------------------- fish C: wobbegong (protected), keyed WRONG, released with wet hands
await hookFish('wobbegong', 70);
await land(); await t.wait(1900);
const wob = await keyPath('wobbegong'); const wrongPath = [...wob]; wrongPath[wrongPath.length - 1] = wrongPath.at(-1) === 'a' ? 'b' : 'a';
await runKey(wrongPath);
await measure(70, null);
txt = await decide(false, '10');
check(/right call/i.test(txt), 'releasing a protected fish is the right call');
txt = await quickRelease({ wet: true, shotName: '11' });
check(/Back in the water/.test(txt), 'wet hands and a quick release: back in the water');
// ---------------------------------------------------------------- fish D: the same fish again, keyed differently (wrong again) -> the guide flags it
await hookFish('wobbegong', 72);
await land(); await t.wait(1900);
const wrong2 = [...wob]; wrong2[0] = wob[0] === 'a' ? 'b' : 'a';
await runKey(wrong2);
await measure(72, null);
await decide(false, null);
txt = await quickRelease({ wet: false });
check(/DRY/.test(txt), 'dry hands are called out');

// ---------------------------------------------------------------- the guide so far
await clearToasts();
await t.tap('KeyJ'); await t.wait(1800);
await t.shot('12-guide');
const tiers = await ev(async () => { const G = await import('/src/fishing/guide.js'), p = window.__game.progress; return { tailor: G.tierOf(p, 'tailor'), flat: G.tierOf(p, 'duskyflathead'), wob: G.tierOf(p, 'wobbegong'), flag: G.needsRekey(p, 'wobbegong'), pct: G.completion(p) }; });
check(tiers.tailor === 'mastered', `tailor mastered (got ${tiers.tailor})`);
check(tiers.flat === 'identified', `flathead identified, not mastered (got ${tiers.flat})`);
check(tiers.wob === 'caught' && /do not agree/i.test(tiers.flag ?? ''), 'wobbegong stays Caught and is flagged "re-key it"');
check(await ev(() => document.querySelectorAll('.gcell').length === 19), 'the guide lists all 19 species');
check(await ev(() => /Lake Illawarra \d+\/\d+/.test(document.querySelector('#modal-body').innerText)), 'per-spot completion counters ("Lake Illawarra n/N")');
check(await ev(() => /bay health/i.test(document.querySelector('#modal-body').innerText)), 'Bay Health meter in the guide header');
await page.click('.gcell[data-id="tailor"]'); await t.wait(900);
await t.shot('13-guide-mastered');
check(await ev(() => /Sustainable|Stock status/i.test(document.querySelector('#modal-body').innerText)), 'a mastered entry reveals the stock status');
await page.click('#g-list'); await t.wait(300);
await page.click('.gcell[data-id="wobbegong"]'); await t.wait(900);
await t.shot('14-guide-flagged');
check(await ev(() => /doesn't match/i.test(document.querySelector('#modal-body').innerText)), 'the flagged entry says it does not match');
// Re-key it correctly from the guide.
await page.click('#g-rekey'); await t.wait(700);
const wp = await keyPath('wobbegong');
for (const a of wp) { await page.click(`.opt[data-a="${a}"]`); await t.wait(80); }
await page.click('#key-ok'); await t.wait(500);
check(await ev(async () => { const G = await import('/src/fishing/guide.js'); return G.tierOf(window.__game.progress, 'wobbegong'); }) !== 'caught', 're-keying correctly from the guide identifies the wobbegong');
await page.keyboard.press('Escape'); await t.wait(300);

// ---------------------------------------------------------------- logbook
await t.tap('KeyL'); await t.wait(500);
await t.shot('15-logbook');
const rows = await ev(() => document.querySelectorAll('.lb tbody tr').length);
check(rows === 4, `logbook has one row per fish (got ${rows})`);
await page.keyboard.press('Escape'); await t.wait(200);

// ---------------------------------------------------------------- head home -> officer -> summary
await ev(() => { window.__game.fishing.stop(); });
await page.click('#home-btn'); await t.wait(500);
await t.shot('16-head-home');
await page.click('#home-go'); await t.wait(700);
check(await waitFor('.dlg:not(.hidden) .dlg-box', 4000), 'the Fisheries Officer dialogue opens');
await t.shot('17-officer');
let lines = 0, shotsTaken = 0;
for (let i = 0; i < 12; i++) {
  const next = await page.$('.dlg:not(.hidden) .dlg-next');
  if (!next) break;
  lines++;
  if (lines === 3 && shotsTaken < 2) { await t.shot('18-officer-rule'); shotsTaken++; }
  await next.click(); await t.wait(250);
}
check(lines >= 4, `officer says several lines (${lines})`);
check(await waitFor('.summary', 4000), 'the outing summary card shows');
await t.wait(300);
await t.shot('19-summary');
const sum = await ev(() => document.querySelector('.summary').innerText);
check(/Fined for 1 illegal/.test(sum), 'summary: the officer fined the illegal fish');
check(/Steward rating/.test(sum) && /Bay Health/.test(sum) && /fish caught/.test(sum), 'summary shows steward and Bay Health change');
check(await ev(() => window.__game.progress.esky.length === 0 && window.__game.progress.steward.fines >= 1), 'esky emptied and the fine recorded');
// Guide from the summary, then the title screen shows completion.
await page.click('#sum-title'); await t.wait(1200);
await t.shot('20-title');
check(await ev(() => /Fish Guide \d+%/.test(document.querySelector('#progress-sum').textContent)), 'the title screen shows overall completion');
const saved = await ev(() => JSON.parse(localStorage.getItem('tideline.progress.v1')));
check(saved.v === 2 && saved.catches.length === 4 && saved.guide.e.tailor.mastered, 'progress saved (schema v2: guide, catches, steward)');

const errs = t.errors.filter(e => !/favicon/.test(e));
check(errs.length === 0, `no console errors${errs.length ? ': ' + errs.slice(0, 3).map(s => s.slice(0, 200)).join(' || ') : ''}`);
for (const l of log) console.log(...l);
console.log(`outing.mjs ${tag}:`, ok ? 'OK' : 'FAILED');
await t.close();
process.exit(ok ? 0 : 1);
