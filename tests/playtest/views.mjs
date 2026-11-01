// Views playtest: every camera preset at all 5 sites in day and dusk, the fight camera, the site and region maps, and the bearded creator.
// Screenshots go to playtest-shots/views/. Usage: URL=http://localhost:8451/ node tests/playtest/views.mjs [high|low] [sites,comma] [part: presets|fight|map|creator|all]
import { launch } from './harness.mjs';
const q = process.argv[2] ?? 'high', sites = (process.argv[3] ?? 'rocky,seagrass,harbour,reef,river').split(','), part = process.argv[4] ?? 'all';
const OUT = 'playtest-shots/views', RIGS = { rocky: ['paternoster', 'beachworm'] }, base = (eco, time) => `eco=${eco}&quality=${q}&play=1&time=${time}&tide=rising&season=summer`;
let fail = 0; const bad = m => { fail++; console.log('FAIL', m); };
const settle = async t => { await t.wait(1500); await t.page.evaluate(() => { window.__game.panels.close?.(true); document.querySelector('#toast').innerHTML = ''; }); };

if (part === 'all' || part === 'presets') for (const site of sites) for (const time of ['day', 'dusk']) {
  const t = await launch({ query: base(site, time), outDir: OUT, width: 1280, height: 720 });
  await settle(t);
  for (const p of ['diorama', 'low', 'shoulder']) {
    await t.page.evaluate(([p]) => { const g = window.__game; g.rig.setPreset(p, g.walker.heading); }, [p]);
    await t.wait(2500);
    await t.shot(`${site}-${time}-${q}-${p}`);
  }
  // View key cycles presets.
  const before = await t.page.evaluate(() => window.__game.rig.preset); await t.tap('KeyV'); await t.wait(300);
  if (before === await t.page.evaluate(() => window.__game.rig.preset)) bad(`V did not cycle the view at ${site}`);
  const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) bad(`${site} ${time}: ${errs.slice(0, 2).join(' || ')}`);
  await t.close();
}

if (part === 'all' || part === 'fight') for (const pre of ['diorama', 'low']) {
  const site = 'rocky', t = await launch({ query: base(site, 'day'), outDir: OUT, width: 1280, height: 720 });
  await settle(t);
  await t.page.evaluate(([p]) => { const g = window.__game; g.rig.setPreset(p, g.walker.heading); g.walker.heading = Math.PI; }, [pre]);
  for (let i = 0; i < 80; i++) { await t.hold('KeyW', 250); if ((await t.state()).walker.waterDepth > 0.15) break; }
  await t.page.evaluate(([r, b]) => { Object.assign(window.__game.gear, { rig: r, bait: b }); }, RIGS[site]);
  let fought = false;
  for (let round = 0; round < 8 && !fought; round++) {
    await t.tap('KeyR'); await t.wait(300); if ((await t.state()).fishing.state === 'off') await t.tap('KeyR');
    await t.page.keyboard.down(' '); await t.wait(1100); await t.page.keyboard.up(' '); await t.wait(1200);
    for (let i = 0; i < 400; i++) { if ((await t.state()).fishing.state === 'bite') { await t.tap('Space'); fought = true; break; } await t.wait(100); }
  }
  if (!fought) bad('never hooked a fish'); else {
    let holding = false, shots = 0, sawFight = false; const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      const s = (await t.state()).fishing; if (s.state !== 'fight' || !s.bar) { if (Date.now() - t0 < 3000) { await t.wait(100); continue; } break; }
      const want = s.bar.fish - s.bar.zone - 0.3 * s.bar.zv > 0; if (want !== holding) { holding = want; await (want ? t.page.keyboard.down(' ') : t.page.keyboard.up(' ')); }
      if (await t.page.evaluate(() => window.__game.rig.fightBlend > 0.5)) sawFight = true;
      if (shots < 3 && Date.now() - t0 > 1500 * (shots + 1)) { await t.shot(`fight-${pre}-${q}`); shots++; }
      await t.wait(40);
    }
    await t.page.keyboard.up(' ');
    if (!sawFight) bad(`fight camera never engaged (${pre})`);
    await t.wait(4000); await t.shot(`after-fight-${pre}-${q}`);
    if (await t.page.evaluate(() => window.__game.rig.fightBlend) > 0.05) bad('fight camera did not ease back out');
  }
  const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) bad(`fight: ${errs.slice(0, 2).join(' || ')}`);
  await t.close();
}

if (part === 'all' || part === 'map') for (const width of [1280, 375]) for (const site of sites) {
  const t = await launch({ query: base(site, 'day'), outDir: OUT, width, height: width < 500 ? 740 : 800 });
  await settle(t);
  await t.tap('KeyM'); await t.wait(700);
  if (!await t.page.evaluate(() => window.__game.mapOpen)) bad(`map did not open ${site}`);
  await t.shot(`map-site-${site}-${width}`);
  if (site === 'rocky' || site === 'reef') { await t.page.click('#mt-region'); await t.wait(400); await t.shot(`map-region-${site}-${width}`); }
  const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) bad(`map ${site}: ${errs.slice(0, 2).join(' || ')}`);
  await t.close();
}

if (part === 'all' || part === 'creator') {
  const t = await launch({ query: `eco=rocky&quality=${q}&time=day`, outDir: OUT, width: 1280, height: 800 });
  await t.wait(800);
  await t.page.evaluate(() => { const g = window.__game; g.setAppearance({ beard: 'big', beardColor: 0xf6f4ee, hatStyle: 'bucket' }); g.creator.open({}); });
  await t.wait(1200); await t.shot(`creator-bigbeard-${q}`);
  const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) bad(`creator: ${errs.slice(0, 2).join(' || ')}`);
  await t.close();
}
console.log(fail ? `${fail} problem(s)` : 'views ok'); process.exit(fail ? 1 : 0);
