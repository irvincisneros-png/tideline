# TideLine: adversarial review of the onboarding, snags, knots and missions proposal (2026-11-06)

Author: Opus 5.5, with an independent second opinion from Codex. Reviews `docs/specs/2026-11-06-purpose-onboarding-proposal.md` by Fable 5.1. This is the decision document for the build session. Nothing here is built yet.

Where this document and the proposal differ, this document wins, except the lines listed under "Open disagreements", which are the owner's call. Each one has a default so the build need not wait.

## Summary verdict

**Build all four parts in reduced form, in the order missions, intro, snags, knots.** As written the proposal will not ship in five days (Codex: "several weeks, not five days"; I agree). It also has factual errors that would break the live game if built literally. Its structure is right. Its scope and several mechanics are not.

The five decisions that matter most:

1. **Missions are a thin pointer over the existing 22 trades.** No new gates, no duplicate rewards. They ship first and go live on their own.
2. **The intro gets a fish on the line in about 60 seconds.** The knot moves out of the intro. The tutorial fish is undersize, so "measure before you decide" pays off at once and earns a clean Mastery (owner's call, see below).
3. **Snags cost time, not inventory.** They happen only when the rig is moving, and tapping always frees the rig. A rig is lost only if the player keeps pulling. No soft plastic packs, no lost-line world objects.
4. **Knots use the owner's existing code-drawn library, baked to stills.** That removes the SVG rope risk. The four knots are the worksheet's: **uni, blood, palomar, surgeon's loop**, not the proposal's clinch and loop knot. Results use the worksheet's pull test, and knots do not touch the fight in v1.
5. **Nothing naming or showing Mr Wilson reaches `main` until consent is confirmed.** Pushes to `main` go live. One constant handles this (`WILSON_OK` in `src/content/teachers.js`).

### Factual corrections to the proposal

All checked against the code on 2026-11-06.

| Proposal says | What exists | Consequence |
|---|---|---|
| Lake Illawarra is the start site | `ECOSYSTEMS = [rocky, seagrass, ...]` (`src/ecosystems/index.js`). Bellambi is the default | The intro must move a new save to the lake on purpose |
| Mission 5 "unlocks Bellambi" | Bellambi and the lake have no `unlock`. Harbour needs 5 Identified, river 6, reef a rod plus 8 | Adding this gate would break Lesson 1 (`?eco=rocky&play=1`) and lock existing saves. Rejected |
| Mission 1 "unlocks Mitra's shop" | The shop is open and sells bait | Rejected. Free collection exists, but prawns can only be bought |
| `?play=1` skips the intro, "as the radio card does" | `teacher.html` sends whole classes in through `?play=1` links | A class on the teacher's links would never see the intro. See Part 3 |
| "the four knots in the program": uni, blood, clinch, loop | `tideline-content/species-and-rules.md:305`: "uni, blood, palomar, surgeon's loop; H/S/B result; tie 3 times each [worksheet 2.1.6]". The owner's video V-2.1.6 teaches the same four | Knot list replaced |
| "wrap 5 times" | V-2.1.6 and `knots.tsx` use **6** wraps for the uni, 5 each side for the blood | Use the owner's numbers |
| Knot sheets from DPIRD/Recfishing | Not in the content dataset. The owner's `knots.tsx` cites its sources per knot | Use those citations |
| `gearStats.lineBreak` | Does not exist. The fight has a meter, a zone and a `save` chance | The knot strength hook has nothing to attach to |
| "existing litter mechanic" for a world object | Litter exists only as catch-bar pickups (`catchbar.js updateLitter`, `main.js onLitter`). There are no bird or turtle paths and no drift simulation | The lost-line marker is a new system. Cut |
| "3-card key" | Dichotomous key (`src/fishing/key.js`, `src/ui/keyUI.js`), 4 to 6 couplets | Costs more intro time than the proposal allowed for |
| "Guide 7/31" | 25 species | Read the total from `SPECIES.length` |
| Mission 2: catch on a float rig, reward float rig | `START_RIGS` excludes float | Circular. See Part 4 |
| Rewards on missions 2, 3 and 4 | Float = `tam-bream`, nipper pump = `mitra-licence`, soft plastic = `mika-flathead`, identify five = `bev-ident` | Double-dipping. See Part 4 |
| Photo mode "exists?" | No. `G.setPhoto` already keeps the photo of your longest fish | Nothing to build |
| Ute parts in `tools/blender/tideline.py` | Esky, bucket and cleaning table props exist. No ute found | No ute |
| 243+ tests | 247 pass | Baseline is 247 |

Claims that hold: NPC `def.scale` works, `react` hooks exist, NPC lines exist (`npc.js fishStep`), the creator's parts cover Mr Wilson's look (`long`, `big` beard, `flowers`, `sport` sunnies, though the sunnies sit on the face because there is no on-the-head option), and the proposal's legal bream length is valid (minimum 25 cm).

## Part-by-part verdicts

### Part 1. Snags and tangles: CHANGE (1a), mostly already built (1b), half CUT (1c)

**Case against.** Three versions of "punishing the right move":
- A bait left still on a snaggy cell snags while the player does exactly what the game says: wait.
- `p × dt` on a paused lure punishes the twitch-pause rhythm taught by `lure.js`, and pausing is how `twitchpause` species strike.
- A student already holding Space to reel is read as "pull" the instant a snag fires, and takes a 50% line break for an input made before the snag existed.

"Tap, pause, tap, pause" inside a 3 s clock is the hardest possible thing to learn in one try on a phone. A per-cell snag map is a world-data job across five sites for no visible gain. Soft plastic packs add a new consumable class, a shop change, save fields and a dead-end for a student with no credits halfway through a lesson.

**Answer to review question 1.** As written it is a punishment. Below it is a comic interruption with a small lesson. Tap-to-free is learnable if it has no clock. Snags cost time and the current bait, never an inventory item (v1 rule; see Open disagreements).

**1a Snag, as it should be built:**
- `src/fishing/snags.js` (pure): a per-spot table, not a map. `SNAG_SPOT = { snags: 1, reef: .8, mangrove: .8, rock: .7, breakwall: .7, jetty: .6, wharf: .6, reefedge: .6, pool: .4, weir: .4, seagrass: .25, channel: .1, basin: .1, flats: 0, beach: 0, reefsand: 0 }`. `SNAG_RIG = { runningsinker: 1, softplastic: 1, paternoster: .8, squidjig: .7, metalslug: .6, unweighted: .5, float: 0 }`. `fishing.js` already knows `this.spot`.
- Roll **per metre the rig moves**, only in two cases: `wait` with `move === 'reel'`, and `retrieve` with `reel` or a sunk pause (`sink > 0.7`). Never while `sh.on` (a fish is following). Never during a still `wait`.
- Tune to roughly 1 snag in 8 casts at a high-risk spot, with a cooldown of 3 casts. A mission step can guarantee the next one (`this.forceSnag`), so Mission 4 does not depend on luck.
- New state `'snagged'`. It **must be added everywhere states are listed**, or students can dodge it (Codex's point, confirmed): `toggle()` (R calls `stop()` unconditionally), `canChangeGear`, the `w.frozen` list, `LINE_OUT`, line and ripple visibility, the carry list, `Outing.ask` and `manager.js:211`.
- Input: ignored until Space has been released once (`this.snag.armed`), so a held reel cannot count as a pull.
- Reuse `MoveReader`. A counted tap needs 0.3 s since the last one. Faster taps do nothing, with no penalty. 2 to 4 counted taps free the rig. There is no timer.
- A hold raises tension 0 to 1 over 1.6 s. Letting go lowers it. Full tension cuts the line. There is no coin flip: the student sees it coming and chose it.
- Show tension with `interestRing` and the existing rod bend.
- Prompt: "Snagged! Tap, tap, tap to let it drop off. Don't pull."

**Cost of a cut line:** the bait, a re-tie (Part 2), `p.skills.lostLine[eco]++`, and the teaching toast. Rigs are not consumed. No Steward deduction: a snag is an accident, not bad practice, and the rating must stay a measure of conduct.

**Lost line, as it should be built:** no world object. On the next fight at that site with `lostLine[eco] > 0`, the catch bar's first litter is forced to `'line'`, and collecting it decrements the count with the toast "That's the line you lost." It **pays no credits and adds nothing to `st.litter`**. Otherwise students cut lines to farm it, and litter is 15% of the Steward rating. About 20 lines of work and the consequence is still visible.

**1b Fight snags: mostly done.** `.cb-struct` and the warn hint "It is heading for the reef!" exist for the `bolt` profile. Only add the rock icon if `.cb-struct` does not already read as rock. Keep `r.reason === 'snag'`. It now counts as a cut line, with the re-tie limit from Part 2.

**1c Tangles.** Keep the NPC cross-line tangle: students asked for it and it is the funny one. `crosses(a, b, c, d)` in `snags.js`, checked once at splashdown against NPCs in their wait phase. It reuses the `'snagged'` state with `kind: 'tangle'`: hold to wind in, no cut possible, no knot needed. Limit one per NPC per outing, off in the tutorial, 3 kind NPC lines. **It is the first thing to drop if the week runs out.**

**Cut the wind knot.** Under the current code the trigger barely happens: a twitch leaves the lure in the water, and you must reel in and charge a cast inside 0.5 s. When it does fire it is a random 30% penalty on a rhythm the game just taught.

### Part 2. Knot mini-game: CHANGE, and much cheaper than feared

**Case against.** SVG rope is a real risk, and an accuracy risk: a wrong crossing teaches a wrong knot. A knot on every rig change taxes the game's central lesson ("tackle is matched to the target species"), and students will stop experimenting. `gearStats.lineBreak` has nothing to attach to. "Strength 0-100%" is an invented number in a game that must not invent. A knot setting per device does not reach a class of 28: teachers cannot change student settings.

**The find that changes the answer to review question 2.** The owner has already drawn these knots in code: `../../Work Video production/aquatic-tech-videos/src/lib/knots.tsx` (1,466 lines). It exports `UNI`, `BLOOD`, `PALOMAR` and `SURGEON`. Each is a list of named stages with z-ordered strands that read correctly over and under, and each has `source` and `overUnder` notes. Its header states the owner's rule: **never AI pictures of knots**. So `codex-image` must not be used for this.

**Do not port it.** It is React with per-piece SVG masks, which is too heavy to run on a Chromebook.
- Write a dev-time script that renders each stage to a still: `assets/knots/uni-1.webp` and so on, about 960×540, roughly 30 images, lazy-loaded when a knot card opens.
- Runtime is an `<img>` crossfade, with no renderer in the game.
- The TSX stays in the video repo. TideLine commits only the stills and credits the sources. The script can live in the video repo or `tools/`; if it cannot run without Remotion, render the frames through Remotion.

**Knots:** uni (6 wraps), blood (5 each side), palomar, surgeon's loop. Drop FG/Albright.

**Data shape** (`src/content/knots.js`):
```js
export const KNOTS = {
  uni: { name: 'Uni knot', job: 'Ties line to a hook or swivel', wraps: 6, source: '…from knots.tsx…', worksheet: '2.1.6',
    steps: [
      { img: 'uni-1', say: 'Thread the tag end through the eye', gesture: 'drag', from: [x, y], to: [x, y] },
      { img: 'uni-3', say: 'Wrap the tag around both lines', gesture: 'taps', n: 6 },
      { img: 'uni-4', say: 'Wet the knot', gesture: 'wet' },
      { img: 'uni-5', say: 'Pull the tag, then the main line', gesture: 'hold' },
    ] },
};
```

**Play:**
- One choice first ("Which knot joins two lines?"), since the proposal's goal was name, choose and tie. Then the steps.
- Every step also works with the big button (hold or tap Space), so one-button play holds and a trackpad never blocks a student. No timers anywhere.
- The button says **"Wet it"**, like the release step's wet-hands button, not "lick it".
- Finish with the worksheet's pull test. `knotResult({ wraps, wet })` in `src/fishing/knots.js` (pure) returns `'hold' | 'slip' | 'break'`. **Confirm what H/S/B stands for against worksheet 2.1.6**; Hold, Slip, Break is my reading of the dataset. A slip or break is a free retry with the reason.

**Where it appears:** Mr Wilson's knot board (reached from him, the tackle box and Mission 2), and the re-tie after a cut line.
- **Never on a rig change.**
- First time is the full guided version. After a Hold, the re-tie is Fable's 10 s quick version: one gesture plus the wrap taps. I drafted a one-tap version; Codex is right that it deletes the activity, so it is dropped.
- To stop reef break-offs becoming a chore, no more than one re-tie prompt per 3 minutes. Within that window the toast says a spare was already tied.
- A knot card shows the diagram, its job, "practised × n", and a line: "Tie it three times for real (worksheet 2.1.6)". The game rehearses for the bench. It does not replace it.

**Does strength affect the fight?** No in v1. The pull test is the feedback, and it is instant and honest. Later, a small visible bonus for a held knot is reasonable (Codex agrees). A hidden penalty never.

**Teacher control:** `?knots=full|quick|off` on the URL, read the way `?style=` is read in `loadSettings`, plus `settings.knots`. Add it to the deep-link table in `teacher.html`.

**State:** `p.skills.knots = { uni: { best: 'hold', n: 3 } }`.

### Part 3. Teachers' opening: CHANGE

**Case against.**
- Five minutes is really 8 to 10: creator, six dialogue beats, 90 s guided knot, walk, cast, 8 s wait, fight, key, measure, decide, send-off. For a 50-minute lesson that is a fifth of it, and the first fish arrives far too late.
- The scene sits at the lake but the game starts at Bellambi.
- The class's own links skip it.
- The dialogue box (z 35) sits over the modal (z 30), so teachers "coaching" the key would cover it on an 844×390 phone.
- Long-press to skip is undiscoverable and fights touch-action handling.
- Coaching the key risks setting `assisted`, which blocks Mastery.
- Every student gets the same 34 cm answer.
- A legal fish makes the two "equally good" choices progress differently: a released legal fish does not qualify for Mastery (`masteryDecision`), so the teachers would be saying something the game contradicts (Codex's point, confirmed).
- `firstRun.js` sets its flag before anything is shown, and the catch flow saves before the row exists. A reload midway could skip or repeat steps (Codex's point, confirmed).

**Answer to review question 3.** Have a small scene: the owner asked for a proper handover and a cold jetty conversation would not feel like one. But build a prop corner, not a car-park set. Five minutes is too long. The target is **under 4 minutes after the creator, with a fish on the line about 60 s after the first word**.

| Beat | Budget |
|---|---|
| Fade in at the corner. Mr C: welcome, the Guide goal. Mr W: hands over rod and measuring board. 3 to 4 lines total | 30 s |
| Walk to the marked spot, rod out | 20 s |
| Cast, a bite within 4 s, strike | 20 s |
| Fight (two lines of help, cannot be lost) | 20 s |
| Key, unaided, in the existing panel | 60 s |
| Measure. Mr W's line as an inline tip | 20 s |
| Decide, then release: wet hands, hold to unhook | 30 s |
| Send-off: first mission, the radio, "you can't sell your catch" and credits | 20 s |

**Build notes:**
- `src/ui/intro.js` and `src/content/teachers.js` (all lines, owner-editable, plus `WILSON_OK`). `mrcisneros` and `mrwilson` in `NPCS` with `sites: { seagrass: ... }`, `scale: 1.08` for Mr W, `trades: []` in v1. Add both to `ceremony.js` and to any fixed cast lists; tests may count NPCs.
- **Knot moves out of the intro.** Mr W: "I've tied this one. The next one's yours." It becomes Mission 2. The kit is handed over as lines, not an inventory change: the running sinker, prawns and brag mat already exist. Mr W calls it the measuring board once.
- **Site:** a due intro with no `?eco` sets `eco = seagrass` before `startLand` (`beginPlay`, `main.js:212`).
- **Links:** add `?intro=1` (shows it despite `?play`), keep `?play=1` skipping it, and change Lesson 1 in `teacher.html` to `?eco=seagrass&play=1&intro=1`, with its Bellambi content moved to later. `?firstrun=1` becomes an alias.
- **Skip:** the existing Skip choice in `dlg.say`, not long-press. A skip still starts Mission 1 and leaves no broken state.
- **Resumable:** `p.intro = { step: 'meet' | 'cast' | 'fight' | 'flow' | 'send' | 'done' }`. `introDue` matches `firstRunDue`: no catches and no guide entries. A reload resumes at the last safe step. `flow` resumes at `send` if the logbook row exists, otherwise `cast`. Every grant is idempotent.
- **Tutorial catch:** `fishing.tutorial = true` overrides `waitT` and the catch. `bar.start({ tutorial: true })` puts a floor under the meter, so it cannot be lost. Bream fight `twitch`, so there is no snag loss. A missed strike replays the bite, and tutorial mode skips `useBait` so no bait is lost.
- Guided gating must cover: walking off, opening the map, Head Home, opening T, and the rotate prompt on phones.
- **Catch flow coaching:** inline `.tip` lines using the existing `first` pattern in `stepMeasure`. **No dialogue over a modal.** Never set `assisted`.
- **The fish:** owner's call below. My recommendation is a yellowfin bream of **22 to 24 cm**, random in that band. It is in the species' range and under the verified 25 cm minimum.
  - The student commits, the board says undersize, and "measure before you decide" pays off in the first minute.
  - The tagline happens to them. The wet-hands release gets taught. There is one right answer, so the Mastery message is consistent.
  - A clean key gives a real first Mastered entry, which makes `tam-bream` ready and solves the float-rig circle in Mission 2.
  - If the student taps Keep: show the rule card, write no illegal row, and return to the choice ("Have another look at that board").
  - A rigged fish goes in the logbook with `tutorial: true`, so teachers can filter it from class data.
- **Air clock:** the release timer uses wall time (`catchFlow.js` tick) and does not pause when the tab is hidden. Pause it on `visibilitychange`, since a teacher talking mid-release will otherwise cost a student their first release.
- **Bev's text:** the "four tiers" and "can't sell" pages are not lost. Mr C covers the goal and the send-off covers selling. Bev's first radio call carries the tiers. Rewrite `tests/playtest/firstrun.mjs` to match.
- **Scene:** near the cleaning table in `seagrass.js:178-184`: a `propKit` code-built trailer box and sign, plus existing table and esky. No ute and no Blender rebuild.

**Consent and names.** With `WILSON_OK = false`, Mr C says all the lines and Mr W does not spawn, so the intro can go live either way. Do not use a likeness of any actor. The owner's photo is reference only and is never committed.

### Part 4. Mission spine: CHANGE

**Case against.** It gates things that are open, rewards things already rewarded, has a circular step, depends on luck, sends students back to a trailer across five sites, and pulls Ranger Jo into a required path while her dialogue awaits AEO/AECG review. One imposed mission plus RNG, in Codex's words, "turns direction into detention". And `progressOf` throws on unknown need types, so new needs must land with their checkers.

**Answer to review question 4.** One headline mission on the HUD, plus **pin**: from the quest log a student can put any accepted trade on the HUD line instead. Nothing is ever locked by a mission. Rewards are not given twice, because a trade step pays the trade's own existing reward, and the mission adds only its chapter cosmetic.

**Correction to my own draft.** I said a duplicate reward "vanishes". Codex is right that it does not: hand-ins still pay credits, and bait rewards add 10 stock each time (`talk.js:242-246`). The double-pay risk is real either way, and the fix is the same.

**Data** (`src/content/missions.js`):
```js
export const MISSIONS = [
  { id: 'first-lines', giver: 'mrcisneros', title: 'First lines', chapter: 1,
    steps: [{ need: { type: 'accurateMeasures', n: 2 }, hint: 'Catch one more and measure it within 1 cm.' },
            { trade: 'mitra-licence' }],
    reward: 'hat-marine', radio: ['…', '…'], next: 'know-tackle' },
];
```
A step is `{ need }` or `{ trade }`. A trade step is done when `npc.done[id]` is set. Progress is always derived from the logbook and Guide through `progressOf`, with no counters.

**State:** `p.missions = { cur, done: { id: t }, pin: tradeId | null }`.

**The spine:**

| # | Mission | Steps | Gives |
|---|---|---|---|
| 1 | First lines (Mr C) | `accurateMeasures 2`, trade `mitra-licence` | nipper pump (trade) |
| 2 | Know your tackle (Mr W) | knot `uni` at Hold, trade `tam-bream`, `rigCatch float` | float rig (trade), so no circle |
| 3 | The rules (Mr C) | `undersizeRelease 2`, trade `mitra-flathead` | pilchards (trade) |
| 4 | Structure (Mr W) | `snagFreed 1` (guaranteed snag while current), trade `mika-flathead` | soft plastic (trade) |
| 5 | The Guide (both) | trade `bev-ident` | metal slug (trade). This is the reason to go to Bellambi, and 5 Identified already opens the harbour: celebrate that on the radio |
| 6+ | Coast chapters | data only: `sione-rock`, `fatima-litter3`, `nell-squid`, `priya-measure`, `priya-tag` | trade rewards |

Ranger Jo stays optional and is never on the spine. Each mission fits one lesson segment of 10 to 15 minutes. Check that step 3's undersize rate at the lake is workable; pin is the safety valve.

**New need types** in `progressOf`, each with a test: `knot {id, result}`, `rigCatch {rig}`, `snagFreed {n}`, and `undersizeRelease {n, maxAir}` = rows with `kind === 'undersize' && kept === false && wet !== false && air <= maxAir`. Do not reuse `releases`: it accepts dry hands (Codex's point, confirmed). Fixing `releases` itself is a separate decision, because it would change `tam-release` and `jo-care` for existing saves.

**Mission rewards.** Stamp-only rewards are thin (Codex). Each chapter gives one new cosmetic hat or shirt in `ITEMS` and a logbook stamp. **No credits and no functional items** at mission level, so the economy of 22 trades does not move.

**Hand-ins.** Radio for ordinary completion (`dlg.say` with `role: 'on the radio'`, when the fishing state is `ready` or `off`). Students are not sent back across the map. Milestone celebrations at the teachers' corner are optional extras. This follows Codex's hybrid over my radio-only draft. No "return scene" is required to progress.

**HUD:** one tappable line in `#hud-top`, next to what `updateStats` writes, that opens the quest log. Check the 844×390 layout. A `missions` section at the top of `questLog.js` adds a "Show on my HUD" button per accepted trade.

**Old saves.** `ensureMissions(p)` runs after load: it walks the chain, silently marks finished missions done, silently grants their cosmetic, and sets `cur` to the first unfinished. No scenes and no reward storm. A save with catches never sees the intro; it gets one radio line from Mr C the next time it is at the lake. Add `missions`, `skills` and `intro` to `blank()` and validate them in `migrateProgress` with `objOr`. No version bump is needed, per the file's additive pattern, but add fixtures for v1 to v4 saves.

**From 4b and 4c:**

| Item | Verdict |
|---|---|
| Guide counter ("Guide 7/25") on the map and after a catch | Accept |
| Personal best fanfare | Accept. Fires at the measure step for kept and released fish alike, so it never rewards keeping. Compare before `recordCatch` overwrites `best` |
| Stewardship meter on the map | Later. Stock and Steward are different measures, and every native release adds stock, even a badly handled one (`stockDelta`). A visible stock target invites catch-and-release grinding (Codex, confirmed) |
| Class board | Cut. A leaderboard of yourself is the personal bests already in the Guide |
| Tide in mission text | Later. Must always be true under `DayConditions` |
| Reaction shots and hook-set hitch | Cut for now |
| Photo mode | Cut. Does not exist and is not needed |
| Rod upgrade moment | Cut |
| Weather | Cut |

## Codex's review and where I disagree

Codex read the proposal, the code and my draft objections. Its ranking, by value per build day for students: **"4 → 3 → 2 → 1. Ship Part 4 first."** Its estimates for the parts as written: missions 3 to 5 days, intro 4 to 6, knots 4 to 6, snags 6 to 9.

**Accepted, each checked in the code:**
- "`R` stops fishing unconditionally; tackle changes are allowed everywhere except bite/fight." The snag state must close those exits.
- "Tutorial completion cannot be one Boolean." Hence `p.intro.step`.
- "'Correct release' currently accepts dry hands." Hence `undersizeRelease`.
- "The tutorial's two 'equally good' choices progress differently." One reason for the undersize fish.
- "Every native release adds stock even after poor handling." No stock-based goals.
- "Release timing uses wall time." Fix the pause on hidden tabs.
- "One HUD mission is good; one imposed mission is not." Pin added.
- "Radio-only hand-ins flatten the world." Hybrid adopted.
- "'Shop is the only bait recovery' is false." Correct: free collection exists. The shop gate is still wrong.
- "Your one-tap known-knot shortcut risks deleting the requested activity." Dropped.
- "Stamp-only rewards unnecessarily remove motivation." Cosmetics added.

**Where I disagree:**
- **Ranking and estimates.** I agree with the order but not the verdict on snags. 6 to 9 days prices the proposal as written. The cut version has no inventory, no world objects and no map, and is about a day. Since students asked for it by name, it stays in the first release rather than last.
- **Knot cost.** 4 to 6 days does not fully credit the existing library. Codex is right that the art does not remove interaction design, but the riskiest piece is gone. Uni in a day is realistic, and the other three are mostly data.
- **Consumable tackle later with free school spares.** A reasonable later idea, but it brings back inventory, shop and save work for little gain. I would not plan on it. Owner's call.
- **"Randomising length will not stop classmates copying."** True of gestures, but it was aimed at the measure answer. It is one line, so it stays.
- **Research route choice.** A real idea, but pin covers the need in v1.
- **Hitch.** Codex treats the 0.3 s hitch as a performance risk. It would be a brief time-scale change, not a stall. It is cut anyway, for priority.

## Additional ideas, ranked

Ranked by student value per day against what already exists.

1. **Next-up nudge** (½ day). `nextUp(p)` in `guide.js`, pure: the closest Mastery ("Flathead: measured. Needs a legal keep."), shown after a catch and in `Outing.summary`, plus Codex's clue for an attainable unseen fish under current gear and conditions. Short-term goals, directly from tiers. In the first release.
2. **Personal best card** (½ day). Fanfare plus a full-screen card with `fishPhoto`, species, length. Students show each other their screens, which is the social loop without a network. In the first release.
3. **Site ribbons** (½ day). `regionCounts` already gives "Lake Illawarra 9/14", and the design spec promised ribbons. A stamp at each full Identified region.
4. **Pair challenge** (½ day, mostly `teacher.html`). Codex's idea: alternate angler and observer, compare exported records. No code risk, and helps teachers with shared devices.
5. **Rival rematch** (1 day). Codex's idea: beat yesterday's rival using existing comp scoring and capped credits. Mika's record makes a good voice for it.
6. **Steward comeback** (1 day). Codex's idea: three well-handled releases after a fine earns recognition, so a Year 9 who kept an undersize fish in Lesson 1 is not marked for the term. Uses logbook rows.
7. **Teacher radio reactions** (½ day, after Part 3). Data-only lines on first Mastered, first fine, first snag, big PB. Keep them kind; the owner edits them.
8. **Teachers at awards night** (½ day). Two lines in `content/ceremony.js` close the loop opened by the intro.
9. **Site legends** (2 to 3 days, later). A named fish per site, inside verified length ranges, found through gossip clues and the Seen tier. Pairs with the tension fight kept back in the mechanics survey. The strongest reason to return, but it is not this week.

## Build order for a first shippable version this week

Each day ends with `npm test` green and its playtests passing. Pushes to `main` go live, so push only then.

**Day 1. Missions (goes live alone).**
Correct the docs. `missions.js`, `ensureMissions`, new need types (`rigCatch`, `undersizeRelease`, plus `knot` and `snagFreed` as stubs that read `p.skills`), HUD line, pin, quest log section, radio hand-in. Next-up nudge, PB card, Guide counter. Mr W's lines go through `WILSON_OK`. Missions 2 and 4 stay hidden until their mechanics land: the chain skips steps marked `requires: 'knots'` or `requires: 'snags'`.

**Day 2. Teachers' intro.**
Teachers, prop corner, `intro.js`, tutorial fish, resume, skip, `?intro=1`, air clock pause, `teacher.html` Lesson 1.

**Day 3. Snags.**
`snags.js`, `'snagged'` state across all lists, tap and tension, lost-line litter, first-time toasts, `forceSnag`.

**Day 4. Knots.**
Bake stills. `knots.js`, `knotUI.js`, uni in full, then palomar, blood and surgeon as time allows. Knot card, re-tie, `?knots=`. Enable Missions 2 and 4.

**Day 5. Device and buffer.**
Real phone and Chromebook pass, which the project notes record as never done. 844×390 and 375 layouts. Cross-line tangle if time allows. Teacher page.

**Explicit cuts from the first version:**
- Wind knot
- Soft plastic packs and any rig or lure consumption
- Lost-line world markers, drift and bird or turtle paths
- Per-cell snag maps
- Knot on rig change, and knot strength in the fight
- FG/Albright, clinch and loop knot
- Ute, Blender work and a full trailer scene
- Class board, photo mode, weather, tide-named missions, reaction shots, rod upgrade moment
- Any new site or shop gate
- Teacher trades (they stay `[]`)

**First to drop if late:** in order, tangle, then blood and surgeon's loop (uni and palomar still cover line to hook and lure), then the PB card.

## Open disagreements for the owner's call

Build defaults are in bold.

1. **Tutorial fish.** **Opus: undersize 22 to 24 cm bream, released, teaches the rule.** Fable: legal 34 cm, keep or release. Codex: no preference, but says the current mixed message must be fixed.
2. **Snag rig loss.** **Opus: never consumes inventory in v1.** Fable: rigs lost and soft plastics in packs. Codex: fine for v1, later lose terminal tackle with free school spares.
3. **Knots in the fight.** **Opus and Codex: none in v1**, a small visible bonus later at most. Fable: `strength` scales line breaking.
4. **Knot on rig change.** **Opus: never.** Fable: every change, quick for known knots. Codex did not rule on it.
5. **Knot in the intro.** **Opus: after the first catch, as Mission 2.** Fable: Mr Wilson teaches it in the intro. Codex did not rule on it.
6. **Mission hand-ins.** **Opus and Codex: radio, with optional celebrations at the corner.** Fable: a return scene at the trailer.
7. **Build order.** **Opus and Codex: missions first.** Fable left it to this review. Owner may prefer the intro first, since it is what was asked for; that delays direction for students by a day.
8. **Trailer.** **Opus: prop corner.** Fable: ute and trailer in the car park. Codex: not ranked.
9. **Mission rewards.** **Opus and Codex: trade rewards plus cosmetics.** Fable: new functional unlocks.
10. **Who owns the knot list.** **Opus: worksheet 2.1.6's four.** Fable: clinch and loop knot in place of palomar and surgeon's. Owner confirms the worksheet is current.
11. **Lesson 1 start.** **Opus: move to the lake for the intro.** The alternative is to keep Bellambi and stage the teachers there, which costs a second prop corner and loses Old Tam's Mission 2 link.

**Owner actions, not disagreements:** confirm Mr Wilson's consent; confirm H/S/B wording against worksheet 2.1.6; check `teachers.js` voice; test on a real school device.

## Risks and the tests each piece needs

| Piece | Main risk | Unit tests | Playtest |
|---|---|---|---|
| Missions | Old saves get reward storms or wrong state | v1 to v4 fixtures fast-forward silently; each new need checker; trade step never pays twice; every `{trade}` and `reward` id resolves; no mission step needs an unreachable item; Jo never on the spine; `questLog` with pin | `missions.mjs`: new save through Mission 1, old save fast-forward, HUD tap on 844×390 |
| Save | Malformed new fields | `missions`, `skills` and `intro` repaired one field at a time, as `migrateProgress` already does | |
| Credits | New path from fish to coins | Existing "no fish to credits" test still passes; mission completion pays 0; own lost line pays 0 and adds 0 to `st.litter` | |
| Intro | Softlock on reload or wandering off | `introDue` truth table (`?play`, `?intro`, catches, guide); `p.intro.step` resume map; grants idempotent; tutorial length always inside species range and under `RULES.yellowfinbream.min` | `intro.mjs` on desktop and mobile: full run, skip at each beat, reload at each step, keep-tap branch, R, H, T and M during gating. Rewrite `firstrun.mjs` |
| Tutorial honesty | Assisted or Mastery mistakes | Unaided key gives Mastery on a correct release; help still gives `assisted`; row has `tutorial: true`; no illegal row on keep branch | Covered in `intro.mjs` |
| Snags | Dodged via R, T, H or E; feels unfair | Risk is 0 for float, flats, `sh.on` and still `wait`; held Space cannot count until released; fast taps ignored; cooldown; tension deterministic; `canChangeGear` false when snagged | `snag.mjs`: tap free, hold to cut, R and T blocked, touch big button, re-tie, line litter clears |
| Lure regression | Snags spoil the new retrieve | Existing `lure.test.mjs` unchanged; expected snags per 100 casts inside the target band | `lure.mjs` still passes |
| Tangle | Griefing or spam | `crosses()` geometry; one per NPC per outing | Add to `npcs.mjs` |
| Knots | Wrong knot taught; image weight | `knotResult` table for wraps and wet; every step's `img` exists; each knot has `source` and `worksheet`; quick needs a prior Hold; `?knots=off` skips | `knots.mjs` by touch, by keyboard only, and on 375 px. Owner checks every still against the video |
| Performance | Knot panel or HUD on low tier | Images lazy-load, total under 2 MB | `perf.mjs` at 60 fps low tier, no new draw calls in the corner beyond the bake |
| Teacher links | Class misses or repeats intro | URL flags parsed | Run every `teacher.html` link in `pages.mjs` |
| Classroom | One local save per browser: shared or cleared devices lose progress and repeat the intro | Skip is one tap | Note this in `teacher.html`. A move-save code is a separate task |
| Consent | Mr Wilson goes live early | `WILSON_OK = false` removes him from NPCs, lines and ceremony | Grep check before each push |
| Species data | Accidental rule change | Existing `species`, `content` and `realplaces` tests pass unchanged; diff touches no rule | |

**Known limit of this review.** Worksheet 2.1.6 itself was not found on disk. Its content here comes from the dataset row and the owner's video script. Day estimates are for an agent build session and are judgement, not measurement. Nothing has been tested on a real school device.
