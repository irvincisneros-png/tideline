# TideLine

A cosy 3D fishing game on the Illawarra coast. Walk down to the water, cast a line, fight the fish, then decide: keep it or release it? A browser game for NSW Stage 5 **Aquatic Technology 7–10 — Aquatic harvesting** (recreational fishing).

**Spots:** Illawarra beach and rock platform (Woonona–Bellambi: lifeguard tower, Norfolk Island pines, banksia scrub, sandstone platform with rock pools) · Lake Illawarra (a cream sand bank with a grassy edge, a plank jetty out to the channel, seagrass patches, a mangrove edge on one side, a bait-shop hut, a moored tinnie and pelicans).

Forked from the DeepSwell engine (vanilla ES modules, vendored Three.js r169). Look: `docs/ART-BIBLE.md`. Plan: `docs/specs/2026-11-01-tideline-design.md`.

## Run locally

No build step.

```bash
python3 devserver.py 8451
```

Open http://localhost:8451 (teacher links and QR codes: `/teacher.html`). Add `?play` to skip the title screen, `?eco=seagrass` to pick the estuary, `?quality=low` for the school-laptop tier.

## Controls
Third-person: a high, near top-down camera follows your angler (pitch about 60 degrees, 12–18 m back).
- **Walk:** WASD (relative to the camera), Shift run. Q / E (or hold the right mouse button and drag, or drag on touch) turns the camera; the mouse wheel (or a pinch) zooms. Wading stops at chest depth. Click an animal for its species card.
- **Tackle:** T opens the tackle box (rig and bait; a labelled diagram of each rig). The HUD chip shows the tide, time, season, swell and your tackle. Tackle that suits the fish bites sooner and gives a bigger reel zone.
- **Fish:** R rod out/away · the angler turns to face the pointer · hold Space to wind up (a ring on the water shows where the cast will land), release to cast · Space to strike when the float dips · then the **catch bar**: hold Space (or press and hold the bar on touch) to lift the green zone, let go to let it fall; keep the fish inside it to fill the meter. Floating litter earns steward points; reef fish bolt for the reef line (touch it and you are bust off).
- **Rules:** every landed fish is judged against NSW size, slot, bag, possession and protected-species rules; choose Keep or Release.
- **Field guide:** J (species you have caught, CSV export) · P pause. Touch devices get an on-screen joystick and buttons.
- **Character:** `game.setAppearance({ skin, hair, hat, shirt, shorts })` recolours the angler (character creation will call this).

## Tests

```bash
npm test                                          # wave maths, species data, bite model, catch rules, audio
URL=http://localhost:8451/ node tests/playtest/catchbar.mjs high rocky   # real-Chrome playtest: tackle box, cast, strike, catch bar (args: high|low, rocky|seagrass, mobile|narrow; screenshots in playtest-shots/catchbar/)
URL=http://localhost:8451/ node tests/playtest/look.mjs high            # hero screenshots (title, beach, platform, jetty, cast, catch bar, keep/release) at 1280x720 and 375x812 into playtest-shots/look/
```

The playtest harness borrows Playwright from a sibling repo (set `PLAYWRIGHT_PATH` otherwise) and uses installed Google Chrome.

## Credits and notes

- Syllabus: NSW Aquatic Technology 7–10, option Aquatic harvesting.
- All models and textures are procedural or Blender-built in `tools/blender` (no third-party assets). The angler, trees, jetty, boats, huts and the lifeguard tower are in `tools/blender/tideline.py` (`Blender --background --factory-startup --python tools/blender/tideline.py` writes `assets/models/tideline_cosy.glb`). Species facts are sourced on each card. Size, slot, bag and possession limits follow DPIRD and the worksheets (see `src/fishing/species.js`, each value tagged with its source); check them before classroom use.
- Progress stays on the device (localStorage).
