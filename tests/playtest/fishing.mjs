// Smoke playtest: boots on the shore, walks to the water with real key presses, casts, strikes, fights and lands a fish.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/fishing.mjs [quality]
// Env: SITE=rocky|seagrass (default rocky). Screenshots go to playtest-shots/fishing (gitignored).
import { launch } from './harness.mjs';
const quality = process.argv[2] ?? 'high', site = process.env.SITE ?? 'rocky';
const t = await launch({ query: `eco=${site}&quality=${quality}&play=1`, outDir: 'playtest-shots/fishing', width: 1280, height: 720 });
const log = [];
const fs = () => t.page.evaluate(() => { const f = window.__game.fishing; return { state: f.state, tension: +f.tension.toFixed(2), dist: +f.dist.toFixed(1), running: f.fight?.running, spot: f.spot }; });
await t.wait(1500);
const s0 = await t.state(); log.push(['boot', s0.mode, s0.walker.pos]);
await t.shot('shore');
// Walk toward the sea (-z) with W until the water is at our feet, like a student would.
await t.page.evaluate(() => { const w = window.__game.walker; w.yaw = 0; w.pitch = -0.1; });
for (let i = 0; i < 80; i++) { await t.hold('KeyW', 250); if ((await t.state()).walker.waterDepth > 0.15) break; }
const s1 = await t.state(); log.push(['at water', s1.walker.pos, 'depth', s1.walker.waterDepth]);
for (let round = 0; round < 6; round++) {
  await t.tap('KeyR'); await t.wait(300);
  if ((await fs()).state === 'off') await t.tap('KeyR');
  await t.page.keyboard.down(' '); await t.wait(1100); await t.page.keyboard.up(' ');
  await t.wait(1200); if (round === 0) await t.shot('float-out');
  for (let i = 0; i < 160; i++) { const s = await fs(); if (s.state === 'bite') { await t.tap('Space'); break; } await t.wait(120); }
  await t.wait(300); if (round === 0) await t.shot('fight');
  for (let i = 0; i < 400; i++) {
    const s = await fs(); if (s.state !== 'fight') break;
    if (!s.running && s.tension < 0.7) await t.hold('Space', 150); else await t.wait(150);
  }
  await t.wait(500); const end = await fs(); log.push(['round', round, end.state]);
  if (end.state === 'landed') {
    await t.shot('landed');
    log.push(await t.page.evaluate(() => document.querySelector('#modal')?.innerText.replace(/\s+/g, ' ').slice(0, 140)));
    await t.page.click('#fx-release'); await t.wait(500);
    break;
  }
  await t.tap('KeyR'); await t.wait(300);
}
log.push(['catches', await t.page.evaluate(() => (window.__game.progress.catches ?? []).map(c => `${c.id} ${c.length}cm kept:${c.kept} ok:${c.correct}`))]);
log.push(['journal', (await t.state()).journal, 'fps', (await t.state()).fps]);
const ok = log.some(l => l[0] === 'catches' && l[1].length > 0);
console.log(JSON.stringify(log), '\nlanded:', ok, 'console errors:', t.errors.length, t.errors.slice(0, 5).map(s => s.slice(0, 300)));
await t.close();
process.exit(ok && t.errors.length === 0 ? 0 : 1);
