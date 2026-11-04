// Key help in the real game: key sand whiting wrong twice and screenshot the hint, the wrong-couplet feedback and the walkthrough.
// Usage: python3 devserver.py 8451 &  then  node tests/playtest/keyhelp.mjs [phone]  -> playtest-shots/keyhelp[-phone]/*.png
import { launch } from './harness.mjs';
const phone = process.argv[2] === 'phone', out = 'playtest-shots/keyhelp' + (phone ? '-phone' : '');
const t = await launch({ query: 'eco=harbour&quality=low&play=1&time=day', outDir: out, ...(phone ? { mobile: true } : { width: 1280, height: 800 }) });
const { page } = t;
await t.wait(1000);
await page.evaluate(() => { const g = window.__game; g.panels.close?.(); g.catchFlow.run({ id: 'sandwhiting', length: 30 }, 'beach', () => {}); });
await page.waitForSelector('.key-grid'); await t.wait(800);
await t.shot('0-key-start');
await page.click('#key-hint'); await t.wait(500); await t.shot('1-hint-look-here');
await page.click('#key-hint'); await t.wait(500); await t.shot('2-hint-highlight');
// answer wrong on purpose (all "a"), then confirm the wrong name
const run = async ans => { for (let i = 0; i < 12 && !(await page.$('#key-ok')); i++) { await page.click(`.opt[data-a="${ans}"]`); await t.wait(80); } await t.wait(300); };
await run('a'); await t.shot('3-leaf-wrong');
await page.click('#key-ok'); await t.wait(600); await t.shot('4-wrong-couplet-feedback');
console.log('feedback:', await page.$eval('.miss-why', e => e.textContent));
await page.click('#miss-retry'); await t.wait(300);
await page.click('.crumb').catch(() => {});   // not needed: retry keeps earlier answers; here couplet 1 is wrong so the path is empty
await run('a'); await page.click('#key-ok'); await t.wait(600); await t.shot('5-second-miss-walk-offered');
await page.click('#miss-walk'); await t.wait(600); await t.shot('6-walk-step-1');
await page.click('#walk-next'); await t.wait(500); await t.shot('7-walk-step-2');
for (let i = 0; i < 8 && !(await page.$('#walk-done')); i++) { await page.click('#walk-next'); await t.wait(300); }
await t.wait(500); await t.shot('8-walk-name-the-fish');
const help = await page.evaluate(() => window.__game.progress.guide.e.sandwhiting.help);
console.log('help recorded', JSON.stringify(help));
await page.click('#walk-done'); await t.wait(800);
const st = await page.evaluate(() => { const G = window.__game.progress.guide.e.sandwhiting; return { ident: G.ident, assisted: G.assisted, panel: document.querySelector('.panel h2')?.textContent }; });
console.log('after reveal', JSON.stringify(st), 'errors', t.errors.slice(0, 5));
await t.shot('9-after-reveal-measure');
await t.close();
