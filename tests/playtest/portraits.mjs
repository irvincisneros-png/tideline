// Contact sheet of every person's dialogue portrait, rendered the way the game does: playtest-shots/npcs/portraits-<label>.png. Usage: node tests/playtest/portraits.mjs [label]
import { launch } from './harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const label = process.argv[2] ?? 'a'; mkdirSync('playtest-shots/npcs', { recursive: true });
const t = await launch({ query: 'eco=harbour&quality=high&play=1&time=day', width: 1280, height: 900 });
await t.wait(1500);
const out = await t.page.evaluate(async () => {
  const { NPC_LIST } = await import('/src/content/npcs.js'), { portraitFor, clearPortraits } = await import('/src/npc/portrait.js'); const g = window.__game; clearPortraits();
  const list = NPC_LIST.filter(n => n.look), res = [];
  for (const n of list) res.push({ id: n.id, name: n.name, props: n.props, url: portraitFor(n.id, g.world.models, n.look, { props: n.props, lo: false }) });
  return res;
});
const html = `<body style="margin:0;background:#fff3d2;font:13px sans-serif;display:grid;grid-template-columns:repeat(6,210px)">${out.map(o => `<div style="text-align:center"><img src="${o.url}" width="200"><br>${o.name} · ${(o.props ?? []).join(', ')}</div>`).join('')}</body>`;
await t.page.setContent(html); await t.wait(500);
await t.page.screenshot({ path: `playtest-shots/npcs/portraits-${label}.png`, fullPage: true });
console.log(out.length, 'portraits', out.filter(o => !o.url).length, 'failed'); await t.close();
