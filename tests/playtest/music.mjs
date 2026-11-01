// Music play-test: nothing under assets/music/ is fetched before the first user gesture, the first track streams after it,
// the initial payload carries no audio, ducking and the Settings controls work.
// Usage: URL=http://localhost:8455/ node tests/playtest/music.mjs
import { launch } from './harness.mjs';
const reqs = [];
const t = await launch({ outDir: 'playtest-shots/music', query: 'quality=low&eco=reef&time=day', onPage: p => p.on('response', async r => { try { reqs.push({ url: r.url(), bytes: (await r.body()).length }); } catch { reqs.push({ url: r.url(), bytes: 0 }); } }) });
const music = () => reqs.filter(r => r.url.includes('/assets/music/'));
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
await t.wait(3000);
const initial = reqs.reduce((a, r) => a + r.bytes, 0);
ok(music().length === 0, `no music fetched before a gesture (initial payload ${(initial / 1024).toFixed(0)} KB, ${reqs.length} requests)`);
await t.page.mouse.click(40, 40);
await t.wait(3500);
ok(music().some(r => r.url.endsWith('menu.m4a')), 'menu track streams after the first click');
const st = () => t.page.evaluate(() => window.__game.audio.music.state);
let s = await st(); ok(s.want === 'menu' && s.master > 0.1, `menu music audible ${JSON.stringify(s)}`);
await t.page.evaluate(() => { window.__game.startLand(null); });
await t.wait(6000);
s = await st(); ok(s.want && s.want !== 'menu', `site track chosen on land: ${s.want}`);
ok(music().every(r => r.bytes < 1.6e6), 'each music file under 1.6 MB: ' + music().map(r => r.url.split('/').pop() + ' ' + (r.bytes / 1024).toFixed(0) + 'KB').join(', '));
await t.page.evaluate(() => { window.__game.cond.minutes = 22 * 60; });
await t.wait(5000);
s = await st(); console.log('night state', JSON.stringify(s));
ok(s.want === 'slowstride' || (await t.page.evaluate(() => window.__game.cond.time)) !== 'night', 'night switches to Slow Stride');
await t.page.evaluate(() => window.__game.audio.music.jingle());
await t.wait(800);
s = await st(); ok(s.duck < 0.7, `bed ducks under the jingle (duck ${s.duck})`);
await t.page.evaluate(() => { const g = window.__game; g.settings.musicOn = false; g.audio.music.configure({ enabled: false }); });
await t.wait(5000);
s = await st(); ok(s.master < 0.01 && s.playing.length === 0, 'Music off silences and stops streaming');
ok(t.errors.length === 0, 'no console errors ' + t.errors.join(' | '));
await t.browser.close();
process.exit(fail ? 1 : 0);
