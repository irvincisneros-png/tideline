// Rough first-paint cost of every species' skin (buildFish with its 1024x512 canvas), in ms. Usage: URL=http://localhost:8451/ node tests/playtest/skintime.mjs
import { launch } from './harness.mjs';
const t = await launch({ query: 'eco=harbour&quality=high&play=1&time=day', outDir: 'playtest-shots/fishpass', width: 900, height: 600 });
const r = await t.page.evaluate(async () => {
  const { SPECIES } = await import('/src/fishing/species.js'); await import('/src/fishing/catches.js'); await import('/src/ecosystems/index.js');
  const { LOOKS } = await import('/src/life/looks.js'); const { buildFish } = await import('/src/life/fishModel.js');
  globalThis.__sm = new URLSearchParams(location.search).has('x'); const out = {}; for (const s of SPECIES) { const t0 = performance.now(); buildFish(globalThis.__sm ? { ...LOOKS[s.id], smooth: true } : LOOKS[s.id]); out[s.id] = Math.round(performance.now() - t0); } return out;
});
const v = Object.values(r); console.log(JSON.stringify(r)); console.log('mean ms', (v.reduce((a, b) => a + b, 0) / v.length).toFixed(0), 'max', Math.max(...v));
await t.close();
