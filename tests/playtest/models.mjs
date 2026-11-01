// Model close-ups: renders the brag-mat photo, the side view and the top-down mat picture of the fish whose models matter for the key (the squid and cuttlefish, the blue groper's
// forehead hump, the yakka and slimy mackerel) from the real 3D models, and saves them as PNG/JPG for a critical look. Not a pass/fail test.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/models.mjs [id,id,...]   -> playtest-shots/harbour/models/
import { launch } from './harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const ids = (process.argv[2] ?? 'squid,cuttlefish,bluegroper,yakka,slimymackerel').split(',');
const out = 'playtest-shots/harbour/models';
mkdirSync(out, { recursive: true });
const t = await launch({ query: 'eco=harbour&quality=high&play=1&time=day&swell=1', outDir: out, width: 900, height: 600 });
await t.wait(1200);
for (const id of ids) {
  const r = await t.page.evaluate(async id => {
    const m = await import('/src/ui/fishView.js');
    return { side: m.fishPicture(id, { w: 1000, h: 560 }), top: m.fishTopDown(id, 1000).url, photo: m.fishPhoto(id, { w: 900, h: 560 }) };
  }, id);
  for (const k of ['side', 'top', 'photo']) writeFileSync(`${out}/${id}-${k}.${k === 'photo' ? 'jpg' : 'png'}`, Buffer.from(r[k].split(',')[1], 'base64'));
  console.log('saved', id);
}
console.log('errors', t.errors.slice(0, 3));
await t.close();
