// Bakes every stage of UNI/BLOOD/PALOMAR/SURGEON from the video repo's knots.tsx to 960x540 WebP.
// Usage: node bake.mjs "<video repo path>" "<out dir>"
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const VIDEO = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const req = createRequire(path.join(VIDEO, "package.json"));
const { bundle } = req("@remotion/bundler");
const { renderStill, selectComposition } = req("@remotion/renderer");
const esbuild = req("esbuild");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "knots-"));

// 1. stage metadata (names, source, overUnder) straight from knots.tsx
const metaOut = path.join(VIDEO, "node_modules", ".knots-meta.cjs");
esbuild.buildSync({ entryPoints: [path.join(VIDEO, "src/lib/knots.tsx")], bundle: true, platform: "node", format: "cjs", outfile: metaOut, external: ["react"], logLevel: "error", nodePaths: [path.join(VIDEO, "node_modules")] });
const K = req(metaOut);
const IDS = [["uni", K.UNI], ["blood", K.BLOOD], ["palomar", K.PALOMAR], ["surgeon", K.SURGEON]];

// 2. render
const serveUrl = await bundle({ entryPoint: path.join(VIDEO, "src/KnotStillsForTideline.tsx"), rootDir: VIDEO });
const chrome = path.join(os.homedir(), "Library/Caches/remotion-chrome-headless-shell/chrome-headless-shell");
const browserExecutable = fs.existsSync(chrome) ? chrome : null;
fs.mkdirSync(OUT, { recursive: true });
const index = [];
for (const [id, knot] of IDS) {
  const key = Object.keys(K.KNOTS).find((k) => K.KNOTS[k] === knot);
  const stages = [];
  for (let i = 0; i < knot.stages.length; i++) {
    const inputProps = { knot: key, stage: i };
    const comp = await selectComposition({ serveUrl, id: "KnotStill", inputProps, browserExecutable });
    const png = path.join(tmp, `${id}-${i + 1}.png`);
    await renderStill({ composition: comp, serveUrl, output: png, inputProps, imageFormat: "png", scale: 0.5, browserExecutable });
    execFileSync("cwebp", ["-quiet", "-q", "80", "-alpha_q", "80", png, "-o", path.join(OUT, `${id}-${i + 1}.webp`)]);
    stages.push({ n: i + 1, img: `${id}-${i + 1}.webp`, name: knot.stages[i].name });
    console.log("baked", id, i + 1);
  }
  index.push({ id, name: knot.name, turns: knot.turns, stages, source: knot.source, overUnder: knot.overUnder });
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ canvas: "960x540 WebP, transparent background", knots: index }, null, 2));
fs.rmSync(tmp, { recursive: true, force: true }); fs.rmSync(metaOut, { force: true });
