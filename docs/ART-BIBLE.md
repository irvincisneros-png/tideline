# TideLine art bible

Reference: **I Just Wanted to Fish** (Fork Dev, 2026). One look everywhere: every site.
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
  No outlines on water. Every placed prop has its outline merged into its own mesh (`src/world/propBake.js`), with baked AO and a paler bevel on hard edges, so this holds on the low tier with no extra pass.

## Water
- Clear: you see the reef and the sand under shallow water.
- **Caustics**: crisp, bright, slowly dancing light networks on the seabed in the shallows.
- **Shore foam**: soft white bands that lap at the edge of sand, with a dark wet strip above the waterline (water level driven, in the terrain shader). Rock pools stay clear.
- Surf: glassy turquoise face, white lip and spray, small foam flecks; sun glints.

## Sky
- Soft blue gradient, a few big puffy rounded clouds with gentle shading (no hard noisy edges): painted billboards (`src/ocean/clouds.js`), tinted by the hour. A clean sun and moon disc with a soft halo. The escarpment is layered ridges fading to the live horizon colour (`src/world/ridges.js`).

## Camera and characters
- A high third-person, near top-down follow camera (pitch about 60 degrees, 12-18 m back, damped, wheel / pinch zoom). The angler is a chunky, cel-shaded character with a big head and a bucket hat (`tools/blender/tideline.py`); colours are parameters (`setAppearance`). Hair (6), hats (5), sunnies (2) and shirt patterns (stripes, flowers, fishing shirt) are separate Blender meshes in the neutral colour slots (hair / hat / shirt / trim) plus a few fixed-colour parts, chosen in the character creator (`src/ui/creator.js`). Fish: tails, markings and lips match the key's features (`tests/looks.test.mjs`); a flat-bodied fish's tail is spread flat on the brag mat. Casts, the line (a thin dark curve) and the red and white float are all readable from above.
- Tall things between the camera and the angler (canopies, roofs) are cut away with a stippled see-through hole.

## People of the coast
- Every NPC is the same chunky angler rig as the player with a fixed look (skin, hair, hat, shirt, shorts, sunnies) and one or two cosy props built in code (`src/npc/props.js`): an apron, clipboard, binoculars, rescue tube, litter picker and sack, bait tub, bucket, thermos, folding stool. A kid is the same body at 0.82 scale. Hats and clothes are the readable part from the high camera, so each person gets a distinct hat or hat colour.
- Dialogue portraits are rendered from the real rig (head and shoulders, dark-teal ink outline, transparent background) into the cream dialogue box. Name tags, request markers and speech bubbles are cream HTML labels with the dark-teal outline, drawn over the canvas so the text stays crisp.

## Composition
- Every site has hand-placed **hero landmarks** (coral bommies, boulders, a cay, a rock platform) with open
  sand channels between them, so every view has a focal point and a path.

## Performance
- The look must hold on the **low** tier: painted layer, caustics and outlines are cheap shader effects;
  shadows and the outline pass stay high/ultra only.

## In-play HUD (console pass, 2026-11-10)

In play the screen belongs to the world. Cream cards with the chunky teal outline are for panels, dialogue, speech bubbles and the catch bar only. Anything that sits over the world while you walk or fish is dark glass (`--glass-ink`) or outlined cream text, never a cream box.

- Top left: tide (or flow) and the clock in one capsule; the tackle joins it while the rod is out; the mission line under it is plain outlined text.
- Top right: esky count, credits, the menu button. Steward stars, season and swell live in the pause menu.
- Bottom centre: one prompt, the thing you can do right now. A bite turns it coral.
- Bottom right: two to five button hints for this moment (`Game.hudHints`). Never the whole key list: that is in the pause menu.
- Top centre: toasts, two at most. The long welcome to a place is shown once per save; after that the place name fades in and out (`#site-name`).
- People: a name appears within about 6 m; a request marker shows from across the beach.
- Pause menu (Esc, P, ☰, Start): eight tiles and the controls for the device in hand (keyboard, touch or controller).
- Controller: `src/core/gamepad.js`. Hints are written for the keyboard and rewritten per device by `Game.hint`.
