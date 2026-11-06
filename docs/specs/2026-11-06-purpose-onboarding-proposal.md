# TideLine: onboarding, snags, knots and a sense of purpose (proposal, 2026-11-06)

Author: Fable 5.1 (the build session). Status: **draft for adversarial review** by an Opus 5.5 session with a Codex second opinion. Nothing here is built yet.

## Why

Student feedback after a week of play:
- "Add snag and tangle mechanics" and "a mini game to learn and do the different knots."
- The game starts cold: Bev's four-page radio card, then you are on the shore. Students did not know what they were working toward.
- The owner wants a proper opening like a Pokémon professor intro, with the two Marine teachers (Mr Cisneros and Mr Wilson) handing over the first rod and measuring board, walking the player through their first catch, then sending them off on missions.

The syllabus hook is NSW Stage 5 Aquatic Technology, "Aquatic harvesting": recreational fishing rules, rigs and knots, measuring, releasing, stewardship. Knots are actually in the program (worksheet 2.1.x covers rigs; knots are the practical). Snags and lost line are the stewardship link (lost line kills birds and turtles; the game already has a litter mechanic and a "Tangled line collected" message).

## Constraints that stay fixed

- Correctness beats looks. Species, lengths, bag limits are verified against DPIRD; this proposal changes none of them.
- No selling of catch. No new First Nations content (Ranger Jo's dialogue awaits AEO/AECG review).
- Original game. The Pokémon reference is the **structure** of an opening (mentor, first tool, first catch, go forth), not any text, names or look.
- Teacher NPCs: Mr Cisneros is the owner (photo on file: short dark hair swept up, warm wide smile, Woonona High jacket). Mr Wilson should read as a long-haired, bearded, big-shouldered surfer type. We do **not** copy an actor's likeness; the brief is "ocean-guy vibe", built from the existing character creator parts (long hair, big beard, sunnies, open shirt). Both are drawn with the game's own cel-shaded rig and portrait system (`src/npc/portrait.js`), like every other NPC.
- The owner should confirm Mr Wilson is happy to be in the game before it goes live to students. (The owner is one of the two; the other is a colleague.)
- Vanilla ES modules, no build, 60 fps on the low tier, touch-first controls (one big button), 243+ unit tests must keep passing, every mechanic gets a Playwright playtest.

## What exists that this builds on

- `src/content/npcs.js`: nine NPCs with `look`, `where`, dialogue, `trades` of two kinds, `show` (a request `need` checked by `src/npc/requests.js`, e.g. `{ type: 'releases', n: 3, maxAir: 10 }`) and `quiz` (indexes into `src/content/quiz.js`), each with a `reward` item id from `src/content/items.js`. Rewards unlock rigs, baits, tools, hats.
- `src/ui/dialogue.js`: `say({ who, text, choices, button })` with portraits; `src/ui/firstRun.js`: the skippable premise card, gated by `progress.tips.firstRun`.
- `src/ui/catchFlow.js`: the land → identify (3-card key) → measure (brag mat) → keep/release flow.
- `src/fishing/fishing.js`: states off/ready/charge/flying/wait/retrieve/bite/fight/landed; the catch bar; a fish can already be **lost to a snag during a fight** (`r.reason === 'snag'`, "Snagged! The fish dived for structure"). Lure retrieve (2026-11-06) with twitch/reel/pause.
- `src/economy/*`: credits, stock health per species per spot, Steward points, shop at Mitra's. `progress.catches[]` records every fish.
- Sites: Lake Illawarra seagrass (start), Bellambi rocky, Belmore Basin harbour, offshore reef, a river. Site unlocks in `src/ecosystems/unlock.js`.
- `src/content/quiz.js`: ~30 quiz questions sourced from the worksheets.

## Part 1. Snags and tangles (fishing feel + stewardship)

### 1a. Snag on the bottom (new, bait and lure)
- Each spot gets a **snag map**: structure the world already draws (jetty pylons, rock, weed beds, reef) marks cells as snaggy. `world.snagAt(x, z)` → 0..1. Sand and open water are 0.
- A **paused lure sinking** on a snaggy cell, or a **bait rig left on the bottom** for a long time on a snaggy cell (paternoster/running sinker, not float/unweighted), rolls a snag check: `p = snagAt × rigSnagFactor × dt`. Soft plastics on a jig head are snaggier than a slug; a float rig never snags.
- On a snag: the rod loads up (existing bend), a dull "thunk", prompt **"Snagged! Hold Space to pull, tap to try to free it."** A short mini-interaction, 3 s:
  - **Tap rhythm** (tap, pause, tap, pause) walks the hook off, frees the rig, no loss. This is the real technique: slack line, let the sinker fall back, lift.
  - **Holding** straight away pulls harder: 50% the rig comes free, 50% the line breaks: you **lose the rig and the bait/lure**, a **"Lost line" marker** appears on the bottom at that spot.
- Lost rigs matter: the next cast needs a new rig tied on (Part 2 knot mini-game, 10 s), the tackle count drops (soft plastics are consumables: 5 per pack; metal slugs and jigs are 1 each and can be re-bought).
- **Lost line marker** stays in the world. If it drifts onto a bird or turtle path within an in-game day it becomes a litter object a player can pull out (existing litter mechanic, Fatima's quest). Pulling your own lost line back gives the Steward points back. This is the stewardship beat: the consequence of a snag is visible, not a number.
- Teaching text (one toast each, first time only): why structure holds fish (and snags), why a float rig is the answer over weed, why you do not yank.

### 1b. Fight snags (exists, improve)
- Keep the fight-loss reason `snag`, but telegraph it: when a fight fish is in "dive" mode near structure, the bar shows a **rock icon** and the hint "It is running for the reef. Keep the pressure on." Losing to a snag then feels earned.

### 1c. Tangles (new, cheap)
- A **cast across the line of a fishing NPC** (the ray from the rod tip to the target crosses an NPC's line within 1.5 m) tangles both lines: a comic "sproing", both lines go slack and knot, the NPC says something short and kind ("Happens to everyone. Wind in and we'll sort it."). Freed by winding in (hold), then a **knot check** (Part 2, the quick version) before the next cast.
- A **wind knot** (a loop of slack line jamming on the spool) from casting on a slack line: if the player casts within 0.5 s of a twitch on a lure rig the cast fizzles short (30%) and a wind knot needs a tap to clear. Small, teaches "let the line settle".
- Tangles never destroy gear. They cost time and a little tidiness, nothing else. (Rationale: snags carry the loss; tangles carry the comedy.)

## Part 2. Knot mini-game

Goal: students can **name, choose and tie** the four knots in the program: **uni knot** (hook/swivel to line), **blood knot** (line to line / leader), **clinch (improved clinch)** (hook to line, the one most tutorials start with), **loop knot** (lure to leader, gives a lure free movement). Optional fifth: **FG / Albright** for braid to leader, locked behind Mitra's braided line.

### 2a. How it plays
- Screen: a big looped line drawn as an SVG path on a cream card (`src/ui/knotUI.js`), the hook or swivel on the right, the tag end as a draggable bead. Each knot is a **sequence of 3–5 moves**: "pass the tag end through the eye", "wrap around the standing line 5 times", "back through the loop", "wet it and pull tight". Each move is one gesture: drag the bead to the highlighted target, or a **tap-rhythm for wraps** (tap five times; too few wraps = weak knot, too many = bulky). Touch-first: drag and tap only.
- Scoring, not failing: a knot has a **strength** 0–100% from the wraps count and whether it was wet before tightening (a tap on the "lick it" button). The strength is used in the fight: a weak knot lowers the line's breaking point for the next fish (`gearStats.lineBreak × strength`). A knot under 60% says "That will slip. Tie it again?" with a free retry.
- Time budget: first time 60–90 s with the guide showing every step; a known knot ("I know this one") collapses to a 10 s quick version (drag the bead once, tap the wraps) so re-tying after a snag is a beat, not a chore. Teachers can switch knots off in Settings (`settings.knots = 'full' | 'quick' | 'off'`) for lessons that are not about rigs.

### 2b. Where it appears
- The teachers' intro (Part 3) teaches the first knot: Mr Wilson ties a uni knot to put the first hook on, the player repeats it.
- Changing rig in the tackle box asks for the knot that rig needs (uni for a hook on a sinker rig, loop knot for a lure, blood knot when the leader changes). Known knots are the quick version. The knot list in the tackle box becomes a **Knot card** page: diagram, where it is used, breaking strength, "practised × times".
- Bev's club adds a **knot board**: tie each knot at ≥ 80% to earn the "Knots" badge (a hat, consistent with the reward system).
- A snag that breaks the line, or a tangle, sends you through the quick knot.

### 2c. Accuracy
Knot steps come from the DPIRD/Recfishing "basic knots" sheets and the worksheet diagrams; each knot card cites its source in `../tideline-content/species-and-rules.md` style. No made-up knots.

## Part 3. The opening with Mr Cisneros and Mr Wilson

Structure, not text, from the professor-intro pattern: mentor meets you, explains the world, gives the starter tools, you do the first thing under guidance, you are sent off with a purpose and a way to report back.

### 3a. Scene
- A new small spot on the Lake Illawarra site: the **WHS Marine Studies trailer** at the car park above the jetty (a ute, a trailer with "Woonona High Marine Studies", an esky, a rod rack, a measuring board on a table). Cheap to build from the existing prop set (`tools/blender/tideline.py` has ute/esky/table parts; the trailer is a box with a sign).
- Two new NPCs, `mrcisneros` and `mrwilson`, with `look`s built from creator parts. Mr C: short dark hair (`short`, hair 0x2a2020), warm skin tone from the photo, no beard, black jacket pattern (`fishing` pattern in a dark shirt colour), big smile portrait. Mr W: `long` hair 0x3a2a1e, `big` beard, sport sunnies on the head, open floral shirt (`flowers`), tall (scale 1.08 on the rig, which the NPC class supports via root scale).
- They stand at the trailer; after the intro they stay there as regular NPCs with their own trades, so the mission system has a hub.

### 3b. The intro beat by beat (replaces Bev's radio card for new saves; Bev's text moves to a later radio call)
1. Character creator (exists).
2. Fade in at the trailer. Mr C (portrait): welcome, what Marine Studies is, "this coast is your classroom", the Fish Guide goal (the four tiers), and the one rule that matters today: "measure before you decide".
3. Mr W: hands over the **starter kit**: a rod ("Rod 1, the school rod, it has caught a thousand bream"), the **measuring board**, a tackle box with a running sinker rig and prawns, a logbook. Each item is a card with an icon (items exist). He then ties the first knot and asks the player to do it (Part 2, full guided uni knot).
4. **Guided first cast** at the jetty: the prompt system (`g.hint`) is already there; the intro adds **gated steps** with the teachers' lines as the hints: walk to the marked spot → R → hold Space (charge) → release → wait → strike → fight (the bar explained in two lines) → land.
   - The tutorial cast is **rigged**: the first bite comes within 8 s and is a legal bream (34 cm), so every student lands a fish in minute three. Honest about it in the code (`tutorial: true` in the catch context), never shown in a logbook as a "real" catch? No: it is recorded like any other; it was a real catch in the game's terms.
5. Identify (3-card key) with Mr C coaching the ID feature; measure on the board with Mr W ("snout to tail tip, mouth closed"); keep or release with both teachers reacting either way (keeping a legal bream is fine; releasing is fine; they say why each is fine).
6. Send-off: Mr C gives the **first mission** (Part 4) and the radio ("Bev runs the club channel; she'll call you"). Mr W: "Snags, tangles, lost line: come back and I'll show you how to deal with them" (unlocks the knot board and the snag tips as a trade).
7. Total length target: 5 minutes, every page skippable with a long-press (teachers re-running a lesson will skip it), and `?play=1` deep links skip it as the radio card does today. Progress flag `progress.tips.intro`.

### 3c. Voice
Short lines, two sentences max, in the teachers' real voices (the owner can edit all of it in `src/content/teachers.js`). No in-jokes that need the class to be present. Mr C is the organiser and the "why"; Mr W is the hands and the ocean lore.

## Part 4. A sense of purpose: the mission spine

Problem: the game has nine NPCs with 22 trades, but no order. Nothing says "do this next". Students wander, catch, and stop.

### 4a. Missions (new layer over trades, not a replacement)
- A **mission** is a named chain of 3–5 existing or new `need`s with a story line, a giver, a reward and a **next mission**. Missions live in `src/content/missions.js`. Only one mission is "current"; it is shown on the HUD as a single line (**"Mission: catch and measure a flathead at the jetty (0/1)"**) and in the quest log at the top.
- The spine (first five, teacher-given, then handed to the coast NPCs):
  1. **First lines** (Mr C): land, identify and measure one more fish on your own. → unlocks Mitra's shop.
  2. **Know your tackle** (Mr W): tie three knots at 70%+, catch a fish on a float rig and on a running sinker. → float rig.
  3. **The rules** (Mr C): release an undersize fish correctly (air time < 10 s), pass Mitra's licence quiz. → nipper pump.
  4. **Structure** (Mr W): free yourself from a snag without losing the rig; pull out one piece of lost line. → soft plastic rig.
  5. **The guide** (both): identify five species. → unlocks Bellambi (the rocky site) and the radio call from Bev; from here the existing NPC trades become missions in site order (Bev → Sione → Fatima at Bellambi; Nell at the harbour; Priya; Jo).
- A finished mission plays a **short return scene** at the trailer (two lines, the reward card). The teachers' dialogue has a line for every mission state (not started / in progress / done), using the existing `react` hook.

### 4b. Purpose you can see
- **Fish Guide progress bar** on the map screen and on the HUD after each catch ("Guide 7/31"). The guide is the Pokédex and already exists; it just isn't shown as the goal.
- **Stewardship meter** per site (exists as stock health) drawn on the map as the bay getting visibly livelier; Mr C comments on it at mission returns.
- **The class board** at the trailer: a leaderboard of the player's own personal bests (longest fish per species, knots at 100%, fastest release). Local only, no network, no comparison with other students (no personal data anywhere).

### 4c. Small enjoyment adds (cheap, high return; candidates for the review to rank)
- **Personal best** fanfare: a fish longer than your record for that species gets a sting and a card.
- **Day/night and tide chips that mean something**: the mission text names the tide ("bream bite on the falling tide at dusk"), so planning the outing is the game.
- **Fish reaction shots** on the strike (camera already eases low); a 0.3 s hitch on the hook-set.
- **Photo mode** (exists?) tied to the guide card: the card uses your best photo.
- **Rod upgrades that feel different**: casting distance and bend are already data-driven; make the first upgrade a visible moment at the trailer.
- **Weather**: a rain day at the river (flow 'high' exists) with the teachers saying why the fishing changes.

## What I want the review to decide

1. Is the **snag model** (Part 1a) fun or a punishment? Is the tap-to-free rhythm learnable in one try on a phone? Should snags ever cost a rig, or only time?
2. Is the **knot mini-game** worth the build (SVG rope rendering is the risk) versus a card-and-quiz version? Which four knots, and should knot strength affect the fight at all?
3. Does the **intro** at the trailer beat the cheaper option (the two teachers appear at the jetty with no new scene)? Five minutes: too long for a 50-minute lesson?
4. The **mission spine**: single current mission, or a short list of three? Does it break the existing trade economy (rewards would be given twice)?
5. Order of build and what to cut to ship a first version this week.
6. Anything the three of us (Fable, Opus, Codex) disagree on gets the owner's call; list those explicitly.

## Build estimate (if accepted as written)
- Snags + tangles: 1 day (world snag map, fishing states, lost-line objects, 2 playtests, ~10 unit tests).
- Knot mini-game: 1.5 days (SVG knot renderer, 4 knot definitions with sources, strength model, settings, playtest).
- Teachers' intro: 1.5 days (trailer props, 2 NPC looks and portraits, tutorial gating, rigged first catch, skip paths, playtest on touch and desktop).
- Mission spine: 1 day (missions data, HUD line, quest log ordering, return scenes, migration for existing saves so nobody loses progress).
