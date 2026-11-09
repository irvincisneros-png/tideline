// Look survey: the same views on each graphics tier, on a high-DPI screen at the default time of day (what a player really sees, not the flattering ?quality=high&time=day).
// Usage: URL=http://localhost:8451/ node tests/playtest/tiers.mjs [label] [tiers=low,medium,high] [eco=seagrass] [time] [view preset]
import { launch } from './harness.mjs';
const label = process.argv[2] ?? 'a', tiers = (process.argv[3] ?? 'low,medium,high').split(','), eco = process.argv[4] ?? 'seagrass', time = process.argv[5] || '', view = process.argv[6];
for (const q of tiers) {
  const t = await launch({ query: `eco=${eco}&quality=${q}&play=1${time ? `&time=${time}` : ''}`, outDir: `playtest-shots/tiers/${label}`, width: 1440, height: 810, dpr: 2 });
  if (view) await t.page.evaluate(v => window.__game.rig.setPreset(v), view);
  await t.wait(6000);
  await t.page.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove()));
  const tag = `${eco}-${q}${time ? '-' + time : ''}${view ? '-' + view : ''}`;
  await t.shot(`${tag}-arrive`);
  await t.look(Math.PI * 0.6); await t.wait(1200); await t.shot(`${tag}-turn`);
  await t.look(Math.PI * 0.7); await t.wait(1200); await t.shot(`${tag}-turn2`);
  const s = await t.state(); console.log(q, 'fps', s.fps, 'pr', await t.page.evaluate(() => window.__game.renderer.getPixelRatio()), t.errors.slice(0, 3));
  await t.close();
}
