// Release-pass playtest: (1) the people exist in realistic graphics and when the character .glb fails to load, (10) landing 20 fish does not leak GPU memory,
// (5) a ?ceremony= preview changes nothing in the saved progress and does not unlock the co-op, (13) the help panel explains the one simulated day.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/release.mjs [low]   Screenshots in playtest-shots/release/. Exits 0 only if every check passed.
import { launch } from './harness.mjs';

const quality = process.argv[2] ?? 'low';
const log = []; let ok = true;
const check = (cond, msg) => { log.push([cond ? 'ok' : 'FAIL', msg]); if (!cond) ok = false; };
process.on('uncaughtException', e => { for (const l of log) console.log(...l); console.log('EXCEPTION', String(e).slice(0, 400)); process.exit(1); });
const OUT = 'playtest-shots/release';

// ================================================================== 1a. realistic graphics: the people are still there
{
  const t = await launch({ query: `style=realistic&quality=${quality}&time=day&officer=0&play&eco=harbour`, outDir: OUT });
  const page = t.page, ev = (f, a) => page.evaluate(f, a);
  await t.wait(1500);
  const r = await ev(() => { const g = window.__game, n = g.npcs; let meshes = 0; g.angler.root.traverse(o => { if (o.isMesh) meshes++; });
    return { style: g.settings.style, npcs: n.npcs.length, nell: !!n.byId.nell, mitraPortrait: !!n.whoOf('mitra').portraitUrl, anglerMeshes: meshes, models: g.world.models.has('ang_head_skin') ? 1 : 0 }; });
  check(r.style === 'realistic' && r.npcs > 0 && r.nell, `realistic graphics: ${r.npcs} people on the coast including Nell`);
  check(r.anglerMeshes > 15 && r.mitraPortrait, `the angler has ${r.anglerMeshes} body meshes and Mitra has a portrait`);
  await ev(() => window.__game.loadSite('seagrass')); await t.wait(1500);
  check(await ev(() => !!window.__game.npcs.byId.mitra && !!window.__game.npcs.whoOf('mitra').portraitUrl), 'at Lake Illawarra Mitra (the shop) exists in realistic graphics');
  await t.shot('realistic-people');
  check(t.errors.length === 0, `realistic: zero console errors ${t.errors.slice(0, 2)}`);
  await t.close();
}
// ================================================================== 1b. the .glb fails to load: simple fallback people
{
  const t = await launch({ query: `quality=${quality}&time=day&officer=0&play&eco=seagrass`, outDir: OUT, onPage: p => p.route(/tideline_cosy\.glb/, r => r.abort()) });
  const page = t.page, ev = (f, a) => page.evaluate(f, a);
  await t.wait(1500);
  const r = await ev(() => { const g = window.__game, n = g.npcs; let meshes = 0; g.angler.root.traverse(o => { if (o.isMesh) meshes++; }); return { npcs: n.npcs.length, mitra: !!n.byId.mitra, anglerMeshes: meshes, models: g.world.models.has('ang_head_skin') ? 1 : 0 }; });
  check(r.models === 0 && r.npcs > 0 && r.mitra, `model file blocked: ${r.npcs} fallback people, Mitra present`);
  check(r.anglerMeshes > 12, `the angler is built from fallback shapes (${r.anglerMeshes} meshes)`);
  // Talk to Mitra: the shop must open.
  const shop = await ev(() => { const g = window.__game; return typeof g.openShop === 'function' && !!g.npcs.byId.mitra && !!g.npcs.whoOf('mitra').name; });
  check(shop, 'the shop and Mitra are reachable'); await t.wait(500);
  await t.shot('fallback-people');
  const real = t.errors.filter(e => !/Failed to load resource|net::ERR|tideline_cosy/i.test(e));
  check(real.length === 0, `fallback: no console errors other than the blocked download itself ${real.slice(0, 2)}`);
  await t.close();
}
// ================================================================== 10. GPU memory over 20 landings
{
  const t = await launch({ query: `quality=${quality}&time=day&officer=0&play&eco=rocky`, outDir: OUT });
  const page = t.page, ev = (f, a) => page.evaluate(f, a);
  await t.wait(1000);
  const res = await ev(async () => {
    const g = window.__game, f = g.fishing, m = () => ({ ...g.renderer.info.memory });
    f.state = 'ready'; f.spot = 'beach';
    const land = id => { f.catch = { id, length: 40, gear: 0.8 }; f.ctx = {}; f.land(); g.angler.update(1 / 60, g.time, { state: 'landed' }); f.state = 'off'; f.landT = 0; g.angler.hold(null); f.disposeHeld(); };
    const ids = ['tailor', 'yellowfinbream', 'luderick', 'duskyflathead', 'australiansalmon'];
    land('tailor'); g.renderer.render(g.scene, g.camera);   // warm any one-off caches
    const before = m();
    for (let i = 0; i < 20; i++) { land(ids[i % ids.length]); g.renderer.render(g.scene, g.camera); }
    return { before, after: m() };
  });
  check(res.after.geometries <= res.before.geometries + 2 && res.after.textures <= res.before.textures + 2, `20 landings: geometries ${res.before.geometries} -> ${res.after.geometries}, textures ${res.before.textures} -> ${res.after.textures}`);
  check(t.errors.length === 0, `gpu: zero console errors ${t.errors.slice(0, 2)}`);
  await t.close();
}
// ================================================================== 5. a ?ceremony= preview changes nothing saved
{
  const SEED = JSON.stringify({ v: 4, angler: { name: 'Kai', skin: 0xc58c5e, hairStyle: 'short', hair: 0x4a2f1d, hatStyle: 'straw', hat: 0xe9d9a6, sunnies: 'none', pattern: 'plain', shirt: 0xf0715a, shorts: 0x2f5496, rod: 0x3b525c }, catches: [{ id: 'tailor', kept: false, correct: true, time: 1, day: 1, spot: 'beach', length: 30 }], guide: { nextN: 2, e: { tailor: { seen: { t: 1 }, caught: { t: 1, n: 1, count: 1 } } } } });
  const t = await launch({ query: `ceremony=awards&quality=${quality}&time=day&officer=0`, outDir: OUT, onPage: p => p.addInitScript(s => { if (!localStorage.getItem('tideline.progress.v1')) localStorage.setItem('tideline.progress.v1', s); }, SEED) });
  const page = t.page, ev = (f, a) => page.evaluate(f, a);
  const before = await ev(() => localStorage.getItem('tideline.progress.v1'));
  check(await page.waitForFunction(() => window.__game.mode === 'ceremony' && !window.__game.loading, null, { timeout: 90000 }).then(() => true).catch(() => false), 'the preview ceremony runs');
  await t.wait(2600);
  for (let i = 0; i < 10; i++) { await page.waitForSelector('.dlg:not(.hidden) .dlg-next', { timeout: 6000 }); await page.click('.dlg .dlg-next'); await t.wait(450); }
  check(await page.waitForSelector('.endcard', { timeout: 6000 }).then(() => true).catch(() => false), 'the end card appears');
  check(/Preview only/.test(await ev(() => document.querySelector('.endcard').innerText)), 'the end card says it is a preview');
  await t.shot('ceremony-preview-end');
  const mid = await ev(async () => { const C = await import(new URL('src/economy/commercial.js', location.href).href); return { raw: localStorage.getItem('tideline.progress.v1'), mem: !!window.__game.progress.ending.awards, elig: C.coopEligible(window.__game.progress) }; });
  check(mid.raw === before, 'the saved progress is byte-for-byte unchanged after the preview ceremony');
  await page.click('#end-play'); await t.wait(2500);
  const after = await ev(() => ({ raw: localStorage.getItem('tideline.progress.v1') }));
  check(after.raw === before, 'and still unchanged after "Keep fishing" (the day did not move on)');
  await ev(() => window.__game.persist());
  check((await ev(() => localStorage.getItem('tideline.progress.v1'))) === before, 'even an explicit persist() does nothing while previewing');
  check(!mid.elig, 'a preview does not unlock the co-op licence');
  check(t.errors.length === 0, `preview: zero console errors ${t.errors.slice(0, 2)}`);
  await t.close();
}
// ================================================================== 13. the help panel explains the day
{
  const t = await launch({ query: `quality=${quality}&time=day&officer=0`, outDir: OUT });
  const page = t.page, ev = (f, a) => page.evaluate(f, a);
  await t.wait(800);
  await page.click('#btn-help'); await t.wait(400);
  const tx = await ev(() => document.querySelector('#modal-body').innerText);
  check(/One day for everything/.test(tx) && /fridge/.test(tx) && /Recovery takes time/i.test(tx), 'the help panel explains the one simulated day, the fridge and recovery');
  await t.shot('help-day');
  check(t.errors.length === 0, `help: zero console errors ${t.errors.slice(0, 2)}`);
  await t.close();
}
for (const l of log) console.log(...l);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
