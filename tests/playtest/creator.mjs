// Character creator playtest: first run -> creator opens -> customise every category -> Done -> the angler in the world reflects every choice.
// Also: profanity filter, keyboard navigation, Edit my angler from Settings (Cancel keeps, Done changes), an old save sees the creator once,
// name in the dialogue and the logbook CSV, no console errors. Runs at 1280x800 and 375x812.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/creator.mjs [high|low]
// Screenshots: playtest-shots/creator/<viewport>/NN-name.png
import { launch } from './harness.mjs';

const quality = process.argv[2] ?? 'high';
const VIEWS = [['1280x800', 1280, 800], ['375x812', 375, 812]];
let ok = true; const errors = [];
const check = (cond, msg) => { if (!cond) { ok = false; console.log('FAIL:', msg); } else console.log('ok:', msg); };

const CHOICES = { skin: 0x6b3d24, hairStyle: 'curly', hair: 0xa4482a, hatStyle: 'straw', hat: 0xf4c84a, sunnies: 'round', pattern: 'flowers', shirt: 0x5fb3d6, shorts: 0xc9b27a, rod: 0xd9503f };
const sel = (key, v) => `#creator [role=radio][data-key="${key}"][data-v="${v}"]`;
const MESHES = { curly: ['ang_hairCurly_hair'], straw: ['ang_hatStraw_hat', 'ang_hatStrawBand_band'], round: ['ang_sunRound_sun'], flowers: ['ang_torso_flowers_trim', 'ang_torso_flowerdots_dots'] };

for (const [tag, width, height] of VIEWS) {
  const out = `playtest-shots/creator/${tag}`;
  let t = await launch({ query: `eco=seagrass&quality=${quality}`, outDir: out, width, height });
  const page = t.page, narrow = width < 600;
  await page.evaluate(() => { localStorage.clear(); }); await page.reload(); await page.waitForFunction(() => window.__game?.mode === 'menu', null, { timeout: 120000 });
  await t.wait(800); await t.shot('title');
  check(await page.evaluate(() => window.__game.progress.angler === null), `${tag}: a new save has no angler yet`);
  // ---- Start fishing -> the creator opens first.
  await page.click('#btn-play'); await t.wait(1800);
  check(await page.evaluate(() => !document.querySelector('#creator').classList.contains('hidden') && window.__game.creatorOpen && window.__game.mode === 'menu'), `${tag}: the creator opens on first play`);
  await t.shot('creator-first-run');
  const lay = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { stage: r('.cc-stage'), panel: r('.cc-panel'), hscroll: document.documentElement.scrollWidth > innerWidth, canvas: r('.cc-canvas') }; });
  if (narrow) check(lay.stage.bottom <= lay.panel.top + 2 && lay.stage.width > 300, `${tag}: preview sits above the options on a phone (stage bottom ${lay.stage.bottom | 0} <= panel top ${lay.panel.top | 0})`);
  else check(lay.stage.right <= lay.panel.left + 2, `${tag}: preview beside the options`);
  check(!lay.hscroll && lay.canvas.width > 150 && lay.canvas.height > 150, `${tag}: no horizontal scroll; preview canvas ${lay.canvas.width | 0}x${lay.canvas.height | 0}`);
  check(await page.evaluate(() => { const i = document.querySelector('#cc-name'); return i.maxLength === 16 && !!document.querySelector('label[for=cc-name]'); }), `${tag}: name field has a label and max 16`);
  // ---- Name: the profanity filter blocks Done.
  await page.fill('#cc-name', 'fuck'); await page.click('#cc-done'); await t.wait(200);
  check(await page.evaluate(() => !document.querySelector('#creator').classList.contains('hidden') && /friendly/.test(document.querySelector('#cc-name-msg').textContent) && document.querySelector('#cc-name').getAttribute('aria-invalid') === 'true'), `${tag}: a rude name is refused with a message`);
  await t.shot('creator-name-refused');
  await page.fill('#cc-name', 'Kai the Angler Extra'); // longer than 16: the input truncates
  check((await page.inputValue('#cc-name')).length <= 16, `${tag}: name capped at 16 characters`);
  await page.fill('#cc-name', 'Kai');
  // ---- Customise each category; sheets of every hair style and hat.
  const stage = page.locator('.cc-stage');
  const look = () => page.evaluate(() => ({ ...window.__game.creator.stage.angler.look }));
  await page.click(sel('hatStyle', 'none')); await page.click(sel('hair', 0x4a2f1d));   // no hat, so every hair style shows
  for (const h of ['short', 'long', 'pony', 'buzz', 'curly', 'bun']) { await page.click(sel('hairStyle', h)); await t.wait(250); await page.evaluate(h => { window.__game.creator.stage.yaw = h === 'pony' || h === 'bun' ? 2.6 : 0.8; window.__game.creator.stage.auto = false; }, h); await t.wait(150); await stage.screenshot({ path: `${out}/hair-${h}.png` }); }
  await page.click(sel('hairStyle', 'short'));
  for (const h of ['none', 'bucket', 'cap', 'straw', 'beanie', 'wide']) { await page.click(sel('hatStyle', h)); await t.wait(250); await stage.screenshot({ path: `${out}/hat-${h}.png` }); }
  for (const h of ['none', 'round', 'sport']) { await page.click(sel('sunnies', h)); await t.wait(250); await stage.screenshot({ path: `${out}/sunnies-${h}.png` }); }
  for (const h of ['plain', 'stripes', 'flowers', 'fishing']) { await page.click(sel('pattern', h)); await t.wait(250); await stage.screenshot({ path: `${out}/shirt-${h}.png` }); }
  await page.click(sel('hatStyle', 'none')); check(await page.evaluate(() => document.querySelector('[data-row=hat]').classList.contains('hidden')), `${tag}: hat colour hides with no hat`);
  for (const [k, v] of Object.entries(CHOICES)) { await page.locator(sel(k, v)).scrollIntoViewIfNeeded(); await page.click(sel(k, v)); await t.wait(120); }
  const l = await look();
  check(Object.entries(CHOICES).every(([k, v]) => l[k] === v), `${tag}: the live preview holds every choice ${JSON.stringify(l)}`);
  await page.evaluate(() => { window.__game.creator.stage.yaw = 0.5; window.__game.creator.stage.auto = false; });
  await t.wait(300);
  await page.locator('#creator [role=radio][data-key=skin][data-v="' + CHOICES.skin + '"]').scrollIntoViewIfNeeded();
  await t.shot('creator-customised-top');
  await page.evaluate(() => { document.querySelector('#cc-scroll').scrollTop = 99999; }); await t.wait(200);
  await t.shot('creator-customised-bottom');
  // ---- Keyboard: arrows move inside a group, and the choice is applied.
  await page.focus(sel('hairStyle', 'curly')); await page.keyboard.press('ArrowRight');
  check((await look()).hairStyle === 'bun', `${tag}: arrow key chooses the next hair style`);
  await page.keyboard.press('ArrowLeft'); check((await look()).hairStyle === 'curly', `${tag}: arrow key goes back`);
  const roles = await page.evaluate(() => [...document.querySelectorAll('#creator [role=radiogroup]')].every(g => g.getAttribute('aria-labelledby') && g.querySelectorAll('[role=radio][aria-checked=true]').length === 1));
  check(roles, `${tag}: every group is a labelled radiogroup with exactly one checked option`);
  const swLabels = await page.evaluate(() => [...document.querySelectorAll('#creator .cc-sw')].every(b => /: /.test(b.getAttribute('aria-label'))));
  check(swLabels, `${tag}: every swatch has an aria-label with its colour name`);
  // ---- Randomise changes something and stays valid; then set our choices again.
  await page.click('#cc-random'); await t.wait(250);
  const r = await look(); check(Object.keys(CHOICES).some(k => r[k] !== CHOICES[k]), `${tag}: Randomise changes the look`);
  await t.shot('creator-randomised');
  for (const [k, v] of Object.entries(CHOICES)) { await page.evaluate(([k, v]) => document.querySelector(`#creator [role=radio][data-key="${k}"][data-v="${v}"]`).click(), [k, v]); }
  // ---- Done -> into the world.
  await page.click('#cc-done'); await t.wait(1500);
  const st = await page.evaluate(() => { const g = window.__game, a = g.angler; return { mode: g.mode, open: g.creatorOpen, hidden: document.querySelector('#creator').classList.contains('hidden'), saved: g.progress.angler, look: { ...a.look }, skin: a.mats.skin.color.getHex(), hair: a.mats.hair.color.getHex(), hat: a.mats.hat.color.getHex(), shirt: a.mats.shirt.color.getHex(), shorts: a.mats.shorts.color.getHex(), rod: a.rodMat.color.getHex(), trim: a.mats.trim.color.getHex(),
    visible: [...a.optionMeshes].filter(([, m]) => m?.visible).map(([n]) => n) }; });
  check(st.mode === 'land' && !st.open && st.hidden, `${tag}: Done closes the creator and starts fishing`);
  check(st.saved?.name === 'Kai' && Object.entries(CHOICES).every(([k, v]) => st.saved[k] === v), `${tag}: choices saved in progress.angler (${JSON.stringify(st.saved)})`);
  const toHex = c => ((c >> 16 & 255) ** 2.2 / 255 ** 2.2 > 0 ? 0 : 0);
  const srgb = lin => { const f = x => Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255); return (f((lin >> 16 & 255) / 255) << 16) | 0; };
  void toHex; void srgb;
  check(['straw', 'round', 'flowers'].every(k => MESHES[k].every(n => st.visible.includes(n))) && MESHES.curly.every(n => !st.visible.includes(n)), `${tag}: the chosen meshes are in the world (curly hair is hidden under the hat so it cannot poke through the crown): ${st.visible.join(', ')}`);
  check(await page.evaluate(() => { const a = window.__game.angler, c = new window.__game.angler.mats.skin.color.constructor(); const eq = (m, hex) => c.set(hex).getHex() === m.color.getHex(); const L = a.look; return eq(a.mats.skin, L.skin) && eq(a.mats.hair, L.hair) && eq(a.mats.hat, L.hat) && eq(a.mats.shirt, L.shirt) && eq(a.mats.shorts, L.shorts) && eq({ color: a.rodMat.color }, L.rod); }), `${tag}: every colour slot carries the chosen colour, including the rod`);
  await t.page.keyboard.press('KeyR'); await t.wait(700);
  await page.evaluate(() => { document.querySelector('#toast').innerHTML = ''; });
  await t.shot('world-angler-rod-out');
  await page.evaluate(() => { const g = window.__game; g.rig.zoom = 6; g.rig.pitch = 0.9; g.rig.yaw += 2.6; }); await t.wait(900);
  await t.shot('world-angler-close');
  // ---- The name in the dialogue and the logbook.
  await page.evaluate(() => window.__game.catchFlow.run({ id: 'tailor', length: 35, ctx: {} }, 'jetty', () => {})); await t.wait(500);
  check(await page.evaluate(() => /Nice catch, Kai!/.test(document.querySelector('#modal-body').textContent)), `${tag}: "Nice catch, Kai!" in the landing dialogue`);
  await t.shot('nice-catch-name');
  const photo = await page.evaluate(() => window.__game.progress.guide.e.tailor?.photo ?? '');
  check(/^data:image\/jpeg/.test(photo) && photo.length > 4000, `${tag}: the guide photo is a render of the fish (${photo.length} bytes)`);
  await page.evaluate(() => { window.__game.panels.close(true); window.__game.catchFlow.cleanup?.(); });
  const csv = await page.evaluate(async () => { const m = await import('/src/core/save.js'); const p = window.__game.progress; p.catches.push({ time: Date.now(), spot: 'jetty', id: 'tailor', label: 'Tailor', length: 35, kept: false }); return m.logbookCSV(p).split('\n').slice(0, 2).join('\n'); });
  check(/^"angler","date"/.test(csv) && /\n"Kai",/.test(csv), `${tag}: logbook CSV leads with the angler name`);
  // ---- Reload: no creator, the look persists.
  await page.evaluate(() => { window.__game.progress.catches.pop(); window.__game.persist(); });
  await page.goto(page.url()); await page.waitForFunction(() => window.__game?.mode === 'menu', null, { timeout: 120000 }); await t.wait(500);
  await page.click('#btn-play'); await t.wait(1200);
  check(await page.evaluate(() => window.__game.mode === 'land' && !window.__game.creatorOpen && window.__game.angler.look.hairStyle === 'curly' && window.__game.progress.angler.name === 'Kai'), `${tag}: after a reload play starts straight away with the saved angler`);
  // ---- Edit my angler from Settings: Cancel keeps, Done changes.
  await page.keyboard.press('KeyP'); await t.wait(300); await page.click('#p-set'); await t.wait(300);
  await t.shot('settings-edit-angler');
  await page.click('#set-angler'); await t.wait(1200);
  check(await page.evaluate(() => window.__game.creatorOpen && /Edit my angler/.test(document.querySelector('#cc-title').textContent) && document.querySelector('#cc-name').value === 'Kai' && document.querySelector('[data-key=hairStyle][data-v=curly]').getAttribute('aria-checked') === 'true'), `${tag}: Edit my angler opens with the saved choices`);
  await page.click(sel('hairStyle', 'bun')); await t.wait(200);
  await t.shot('creator-edit');
  await page.keyboard.press('Escape'); await t.wait(300);
  check(await page.evaluate(() => !window.__game.creatorOpen && window.__game.angler.look.hairStyle === 'curly'), `${tag}: Esc cancels without changing the angler`);
  await page.keyboard.press('KeyP'); await t.wait(300);
  if (!await page.evaluate(() => window.__game.panels.isOpen)) { await t.wait(300); }
  await page.evaluate(() => window.__game.openSettings()); await t.wait(300); await page.click('#set-angler'); await t.wait(900);
  await page.click(sel('hairStyle', 'bun')); await page.fill('#cc-name', 'Kai R'); await page.click('#cc-done'); await t.wait(700);
  check(await page.evaluate(() => window.__game.angler.look.hairStyle === 'bun' && window.__game.progress.angler.name === 'Kai R' && window.__game.mode === 'land'), `${tag}: Done in the editor changes the angler and returns to the game`);
  await t.shot('world-after-edit');
  errors.push(...t.errors); await t.close();

  // ---- An older save (no angler field) sees the creator once, with defaults.
  t = await launch({ query: `eco=seagrass&quality=${quality}`, outDir: out, width, height });
  await t.page.evaluate(() => { localStorage.setItem('tideline.progress.v1', JSON.stringify({ v: 2, catches: [{ id: 'tailor', time: 1, kept: false }], journal: {}, guide: { nextN: 1, e: {} } })); });
  await t.page.reload(); await t.page.waitForFunction(() => window.__game?.mode === 'menu', null, { timeout: 120000 }); await t.wait(500);
  await t.page.click('#btn-play'); await t.wait(1200);
  check(await t.page.evaluate(() => window.__game.creatorOpen && document.querySelector('#cc-name').value === '' && window.__game.creator.stage.angler.look.hairStyle === 'short'), `${tag}: an old save sees the creator once, starting from the default look`);
  await t.shot('old-save-creator');
  await t.page.click('#cc-done'); await t.wait(800);
  await t.page.evaluate(() => window.__game.enterMenu()); await t.page.click('#btn-play'); await t.wait(600);
  check(await t.page.evaluate(() => window.__game.mode === 'land' && window.__game.progress.angler.name === ''), `${tag}: ...and not again afterwards`);
  errors.push(...t.errors); await t.close();
}
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors');
if (errors.length) ok = false;
console.log(ok ? 'CREATOR PLAYTEST PASSED' : 'CREATOR PLAYTEST FAILED');
process.exit(ok ? 0 : 1);
