# TideLine

A cosy 3D fishing game on the Illawarra coast. Walk down to the water, cast a line, fight the fish, then decide: keep it or release it? A browser game for NSW Stage 5 **Aquatic Technology 7–10 — Aquatic harvesting** (recreational fishing).

**Spots (phase 0):** Illawarra beach and rock platform (Woonona–Bellambi) · Seagrass and mangrove estuary bank (placeholder for Lake Illawarra).

Forked from the DeepSwell engine (vanilla ES modules, vendored Three.js r169). Look: `docs/ART-BIBLE.md`. Plan: `docs/specs/2026-11-01-tideline-design.md`.

## Run locally

No build step.

```bash
python3 devserver.py 8451
```

Open http://localhost:8451 (teacher links and QR codes: `/teacher.html`). Add `?play` to skip the title screen, `?eco=seagrass` to pick the estuary, `?quality=low` for the school-laptop tier.

## Controls
- **Walk:** mouse look, WASD walk, Shift run, Space jump. Wading stops at chest depth. Click an animal for its species card.
- **Fish:** R rod out/away · hold Space to wind up, release to cast · Space to strike when the float dips · hold Space to reel while the fish rests, let go while it runs (too much tension snaps the line).
- **Rules:** every landed fish is judged against NSW size and bag limits; choose Keep or Release.
- **Field guide:** J (species you have caught, CSV export) · P pause. Touch devices get an on-screen joystick and buttons.

## Tests

```bash
npm test                                          # wave maths, catch rules, species content, audio
URL=http://localhost:8451/ node tests/playtest/fishing.mjs   # real-Chrome smoke playtest (screenshots in playtest-shots/)
```

The playtest harness borrows Playwright from a sibling repo (set `PLAYWRIGHT_PATH` otherwise) and uses installed Google Chrome.

## Credits and notes

- Syllabus: NSW Aquatic Technology 7–10, option Aquatic harvesting.
- All models and textures are procedural or Blender-built in `tools/blender` (no third-party assets). Species facts are sourced on each card. Size and bag limits follow NSW DPI recreational rules as noted in `src/fishing/catches.js`; check them before classroom use.
- Progress stays on the device (localStorage).
