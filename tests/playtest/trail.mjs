// Fish trail play-test: the HUD line names the next step, the card (N) can set the tackle, travel and wait, skipping moves on, and catching the target advances the trail.
// Usage: URL=http://localhost:8451/ node tests/playtest/trail.mjs
import { launch } from './harness.mjs';
const t = await launch({ query: 'eco=rocky&quality=low&play=1&time=day', outDir: 'playtest-shots/trail', width: 1280, height: 720 });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const line = () => t.page.evaluate(() => { const e = document.querySelector('#target-btn'); return e.classList.contains('hidden') ? '' : e.textContent; });
const key = code => t.page.evaluate(c => { dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })); dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })); }, code);
await t.wait(1500);
let s = await line(); ok(/Next fish \(1 of \d+\): travel to Lake Illawarra/.test(s), `away from the target's site the step is to travel: "${s}"`);
await t.page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove())); await t.shot('hud-travel');
await key('KeyN'); await t.wait(400);
ok(await t.page.evaluate(() => !!document.querySelector('#tr-go') && document.querySelectorAll('.trail-list li').length >= 4), 'the card lists the recipe with a Travel button');
await t.shot('card-travel');
await t.page.click('#tr-go');
await t.page.waitForFunction(() => window.__game.eco.id === 'seagrass' && window.__game.mode === 'land' && !window.__game.loading, null, { timeout: 90000 });
await t.wait(1500);
s = await line(); ok(/Next fish/.test(s) && !/travel/.test(s), `at the site the step moves on: "${s}"`);
// put the wrong rig on, then let the card fix it
await t.page.evaluate(() => { const g = window.__game; g.gear.rig = 'paternoster'; g.gear.bait = 'prawn'; g.saveGear(); });
await t.wait(700); s = await line(); ok(/switch to the|bait up with/.test(s), `wrong tackle is the next step: "${s}"`);
await key('KeyN'); await t.wait(400); await t.shot('card-tackle');
for (const id of ['#tr-rig', '#tr-bait']) if (await t.page.$(id)) { await t.page.click(id); await t.wait(300); }
const fit = await t.page.evaluate(() => { const g = window.__game, i = g.trailInfo(); return { rig: g.gear.rig, bait: g.gear.bait, want: [i.recipe.rig.id, i.recipe.bait?.id], rows: i.rows.filter(r => ['rig', 'bait'].includes(r.key)).every(r => r.ok) }; });
ok(fit.rows && fit.rig === fit.want[0], `the card put the recipe's tackle on ${JSON.stringify(fit)}`);
await t.page.evaluate(() => window.__game.panels.close()); await t.wait(700);
const tgt = await t.page.evaluate(() => { const g = window.__game; return { id: g.trail?.t?.entry.id, ctx: g.biteContext().target }; });
ok(tgt.id && tgt.ctx === tgt.id, `the bite model knows the target (${tgt.id})`);
// skip, then catch the target: the trail advances
await key('KeyN'); await t.wait(300); await t.page.click('#tr-skip'); await t.wait(400);
const after = await t.page.evaluate(() => window.__game.trailInfo().t.entry.id);
ok(after !== tgt.id, `skip moves to another fish (${tgt.id} -> ${after})`);
await t.page.evaluate(() => window.__game.panels.close()); await t.wait(1200);
await t.page.evaluate(async id => { const g = window.__game, G = await import(new URL('src/fishing/guide.js', location.href)); G.recordCatch(g.progress, id, { length: 30 }); }, after);
await t.wait(1400);
const adv = await t.page.evaluate(() => ({ id: window.__game.trailInfo().t.entry.id, n: window.__game.trailInfo().t.n, toasts: [...document.querySelectorAll('.toast')].map(e => e.textContent) }));
ok(adv.id !== after && adv.n === 1 && adv.toasts.some(x => /New fish found/.test(x)), `catching the target advances and cheers ${JSON.stringify(adv).slice(0, 200)}`);
await t.shot('hud-after');
// off in Settings
await t.page.evaluate(() => { window.__game.settings.trail = false; }); await t.wait(700);
ok((await line()) === '', 'switched off in Settings, the line is gone');
ok(t.errors.length === 0, 'no console errors ' + t.errors.join(' | ').slice(0, 300));
await t.close(); console.log(fail ? 'trail FAILED' : 'trail ok'); process.exit(fail ? 1 : 0);
