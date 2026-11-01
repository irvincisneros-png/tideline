# TideLine

A cosy 3D fishing game on the Illawarra coast. Walk down to the water, cast a line, fight the fish, then decide: keep it or release it? A browser game for NSW Stage 5 **Aquatic Technology 7–10 — Aquatic harvesting** (recreational fishing).

**Spots:** Illawarra beach and rock platform (Woonona–Bellambi) · Lake Illawarra (sand flats, seagrass, channel and mangrove edge; the jetty spot is in the data but has no geometry yet).

Forked from the DeepSwell engine (vanilla ES modules, vendored Three.js r169). Look: `docs/ART-BIBLE.md`. Plan: `docs/specs/2026-11-01-tideline-design.md`.

## Run locally

No build step.

```bash
python3 devserver.py 8451
```

Open http://localhost:8451 (teacher links and QR codes: `/teacher.html`). Add `?play` to skip the title screen, `?eco=seagrass` to pick the estuary, `?quality=low` for the school-laptop tier.

## Controls
- **Walk:** mouse look, WASD walk, Shift run, Space jump. Wading stops at chest depth. Click an animal for its species card.
- **Tackle:** T opens the tackle box (rig and bait; a labelled diagram of each rig). The HUD chip shows the tide, time, season, swell and your tackle. Tackle that suits the fish bites sooner and gives a bigger reel zone.
- **Fish:** R rod out/away · hold Space to wind up, release to cast · Space to strike when the float dips · then the **catch bar**: hold Space (or press and hold the bar on touch) to lift the green zone, let go to let it fall; keep the fish inside it to fill the meter. Floating litter earns steward points; reef fish bolt for the reef line (touch it and you are bust off).
- **Rules:** every landed fish is judged against NSW size, slot, bag, possession and protected-species rules; choose Keep or Release.
- **Field guide:** J (species you have caught, CSV export) · P pause. Touch devices get an on-screen joystick and buttons.

## Tests

```bash
npm test                                          # wave maths, species data, bite model, catch rules, audio
URL=http://localhost:8451/ node tests/playtest/catchbar.mjs high rocky   # real-Chrome playtest: tackle box, cast, strike, catch bar (args: high|low, rocky|seagrass, mobile|narrow; screenshots in playtest-shots/catchbar/)
```

The playtest harness borrows Playwright from a sibling repo (set `PLAYWRIGHT_PATH` otherwise) and uses installed Google Chrome.

## Credits and notes

- Syllabus: NSW Aquatic Technology 7–10, option Aquatic harvesting.
- All models and textures are procedural or Blender-built in `tools/blender` (no third-party assets). Species facts are sourced on each card. Size, slot, bag and possession limits follow DPIRD and the worksheets (see `src/fishing/species.js`, each value tagged with its source); check them before classroom use.
- Progress stays on the device (localStorage).
