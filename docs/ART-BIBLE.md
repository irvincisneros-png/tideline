# DeepSwell art bible

Reference: **I Just Wanted to Fish** (Fork Dev, 2026). One look everywhere: surf, dive, beach, every site.
Science stays accurate: species keep their real shapes, markings and colours (pastel-shifted, never invented).

## Feel
A sunny, hand-made diorama. Bright, clear, calm and friendly. Readable at a glance from any distance.

## Light
- Warm, soft sun (slightly golden). Shadows are never grey or black: they are **cool blue/teal tints** of the
  lit colour.
- Strong sky fill, so nothing goes dark; contrast comes from colour and shape, not darkness.
- Soft, short contact shadows under objects (baked AO plus sun shadows on high/ultra).

## Colour
- High-key palette. Water runs crystal turquoise (shallows) to clear blue (deep); never murky grey.
- Sand is warm cream. Coral and fish are pastel but saturated; each site has its own accent colours.
- Underwater fades to a colour (site water), never to black, except the deep-sea site at night.

## Surfaces (materials)
- Matte. Only water, eyes and wet sand are glossy.
- A soft painted layer on everything: lighter on top-facing surfaces, darker toward bases and undersides,
  gentle low-frequency brush mottling and a few fine speckles. No photo textures, no fine noise.

## Shapes
- Chunky, rounded and simple, built by script (Blender, `tools/blender/`). Big readable silhouettes; detail
  comes from colour, not geometry. Species proportions stay correct.

## Lines
- Thin outlines on silhouettes, **dark teal** rather than black, fading with distance and fog.
  No outlines on water.

## Water
- Clear: you see the reef and the sand under shallow water.
- **Caustics**: crisp, bright, slowly dancing light networks on the seabed in the shallows.
- **Shore foam**: soft white bands that lap at the edge of sand and rock.
- Surf: glassy turquoise face, white lip and spray, small foam flecks; sun glints.

## Sky
- Soft blue gradient, a few big puffy rounded clouds with gentle shading (no hard noisy edges).

## Composition
- Every site has hand-placed **hero landmarks** (coral bommies, boulders, a cay, a rock platform) with open
  sand channels between them, so every view has a focal point and a path.

## Performance
- The look must hold on the **low** tier: painted layer, caustics and outlines are cheap shader effects;
  shadows and the outline pass stay high/ultra only.
