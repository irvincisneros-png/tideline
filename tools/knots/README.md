# Knot stills (baked from the owner's code-drawn knots)

The stills in `../../assets/knots/` are rendered from `knots.tsx` in the video repo
(`Work Video production/aquatic-tech-videos/src/lib/knots.tsx`, exports `UNI`, `BLOOD`, `PALOMAR`, `SURGEON`)
using its own `KnotView` renderer. Never AI-generated; never hand-drawn.

## Re-bake

    cd "/Users/irvincisneros/Documents/Local Projects/Science Simulator Website/tideline/tools/knots"
    node bake.mjs "/Users/irvincisneros/Documents/Local Projects/Work Video production/aquatic-tech-videos" "/Users/irvincisneros/Documents/Local Projects/Science Simulator Website/tideline/assets/knots"

Takes about 1 minute. Needs `cwebp` (Homebrew) and the video repo's `node_modules`
(Remotion 4.0.534 + the chrome-headless-shell copy at `~/Library/Caches/remotion-chrome-headless-shell/`).

## What it does

1. esbuild-bundles `knots.tsx` to read stage names, `source` and `overUnder`.
2. Bundles `src/KnotStillsForTideline.tsx` (a small temporary entry point **added to the video repo**,
   its own `registerRoot`, does not touch `Root.tsx`, not committed) and calls `@remotion/renderer`
   `renderStill` once per (knot, stage) at 1920x1080 with `scale: 0.5` as transparent PNG, so output is 960x540.
3. `cwebp -q 80` converts each to WebP (alpha kept; background is transparent).
4. Writes `index.json` (knot name, turns, stages in order with `img` and `name`, plus `source` and `overUnder` verbatim).

Stage counts: uni 12, blood 16, palomar 6, surgeon 6 (40 files). The knot drawings sit on the video canvas,
so the blood knot lines run to the image edge by design.
