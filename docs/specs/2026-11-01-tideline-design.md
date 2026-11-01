# TideLine — design spec (2026-11-01)

A cosy 3D fishing game set on the Illawarra coast for NSW Stage 5 Aquatic Technology,
**Aquatic harvesting** option (syllabus content "Recreational fishing" + "Commercial fishing";
program booklet Module 2, worksheets 2.1.1–2.2.7). Forked from the DeepSwell engine (vanilla ES
modules, vendored Three.js r169, no build step). Look: `docs/ART-BIBLE.md` — the *I Just Wanted to
Fish* cosy diorama style. Original game: no names, UI, characters or mechanics copied from it.

Content source of truth: `../tideline-content/species-and-rules.md` (species, limits, stock status,
swaps, First Nations content, quiz bank — each value tagged with its source). Never invent a rule:
an `[unverified]` **rule or First Nations claim** stays out of the game. `[unverified]` biology
(bait, rig, tide, season, length range, fight, ID feature) is fine for gameplay tuning. Snapper bag
= 10 (DPIRD; DeepSwell's 4 was wrong). Model possession limits. Lake Illawarra: no crab traps,
hoop/lift nets or prawn nets (rod and line only). Carp: teach "don't return" as best practice, not law.
Don't copy the D'harawal calendar text (BOM terms) — summarise and link.

## The pitch
You are a young angler with a tackle box, a logbook and an empty field guide. Every outing you plan
a trip, fish, then decide what goes in the esky. The goal is not the biggest bag: it is a full field
guide and a healthy bay. Your **Steward rating** (1–5 stars) is the headline score, coins are second.

## Core loop (one outing ≈ 5–8 minutes)
1. **Plan (the bait-shop counter).** Tide/conditions board for the day: tide (rising/high/falling/low),
   time (dawn/day/dusk/night), season, swell (m), wind. Pick a spot, a rig and a bait. Safety gate:
   rock platform in big swell shows a "Not today" warning and requires the lifejacket (Wollongong rock
   fishing lifejacket rule, if verified in the content file). Licence card shown once (what the fee
   pays for).
2. **Fish.** Walk the spot (existing walker), cast, wait, strike, fight (existing `fishing.js`
   tension mechanic). Bite chance per species =
   `base weight × rig match × bait match × tide/time/season match × local stock health`.
   A bad match still catches, just slower and often the "wrong" (bycatch/undersize) fish — the
   lesson "tackle is matched to the target species" is felt, not told.
3. **Identify.** On landing, a 3-card ID check: the real species and two look-alikes; the
   card prompt names the key ID feature after you answer. First correct ID adds the species to the
   field guide with its card.
4. **Measure.** Brag-mat mini-game: fish lies on a mat with a cm scale; drag the marker to the tail
   tip (mouth closed, total length); read to the nearest cm. Within ±1 cm = "Accurate".
5. **Decide.** Keep or release, with the rules visible only *after* the student commits (they must
   recall/look up in the field guide). Outcomes:
   - legal keep -> esky; undersize/over-slot/over-bag/protected keep -> "illegal fish" in esky;
   - release -> quick release mini-step: wet hands, hook out, back in the water within 10 s
     (air-time timer); deep reef fish need a **release weight** (barotrauma).
6. **Head home.** Random **Fisheries Officer** check (~1 in 3 outings) inspects the esky: illegal
   fish = fine + lost stars, with the rule and the *reason* for it. Logbook row written for every
   fish (date, spot, tide, species, length, kept/released). Then **the café**: cook or sell what you
   kept; sustainable choices raise the Steward rating.

## Sustainability layer (the educational heart)
- **Stock health** per species per spot (0–100), seeded from NSW stock status (sustainable 80,
  depleting 55, depleted 30, recovering 45). It sets bite rates. Keeping undersize or over-bag fish,
  and targeting depleted species, lowers it; legal releases and good practice nudge it up. Visible on
  the spot card as a fish-school icon (full / thinning / sparse).
- **Sustainable swaps.** When you rig specifically for a depleted species, the bait-shop owner
  suggests the swap from the content file ("Mulloway are depleted in NSW — tailor run on the same
  beach on a falling tide…"). Taking the swap earns stars.
- **Introduced species.** Carp/redfin (freshwater spot, phase 2): keeping them is good; the rule on
  not returning them is taught here (per content file).
- **Bay health meter** on the map = average stock health; outings in a row of good practice make it
  visibly livelier (more schools, birds working the water).

## Spots
Phase 1: **Lake Illawarra** (estuary: sand flats, seagrass, channel edge, mangrove edge; from the
bank and a jetty) — reuse/adapt DeepSwell's seagrass/mangrove builders; **Bellambi surf beach +
rock platform** — reuse DeepSwell's rocky site shore (beach, dunes, rock platform, pools).
Phase 2: Belmore Basin harbour wharf (squid jig, night fishing), offshore reef by boat with
**fish finder/sounder** screen (pelagic arches vs demersal returns, bottom hardness, GPS marks),
freshwater river (Australian bass, carp removal), crab nets / witches hats, bait collection
(beach worms, nipper pump, pipi rules).
Phase 3: **Sea Country** cards and seasonal calendar (Dharawal content exactly as in the worksheets,
presented as field-guide knowledge, not a mini-game); **Commercial fishing lab** (trawl vs gill vs
seine: choose net, run a haul, see target vs bycatch, read a stock-assessment graph); teacher page.

## Catch mechanic (replaces DeepSwell's tension fight)
Cast, bite and strike stay. On the strike a **vertical catch bar** opens (owner loves Stardew's
fishing; this is our own take): hold Space / touch to lift a green "reel zone", release to let it
fall; keep the fish icon inside it to fill the catch meter, outside it drains. Fish movement is
**species-driven** from the content file's behaviour data, so the fight teaches biology:
pelagic (tailor, salmon, kingfish) = fast darting runs; demersal (flathead) = heavy head-shakes
then sits low; reef fish (snapper, kingfish) = dive for a **structure line** at the bottom — reach it
and you're snagged/bust off; whiting/bream = light twitchy; squid = slow pulses then a backward jet.
**Gear sets the zone size**: matched rig + bait = big, steady zone; mismatch = small, jittery.
Line weight / drag upgrades widen it. **Litter replaces treasure**: sometimes lost line or a plastic
bag drifts through the bar; catching it raises the Steward rating. Long fights on deep offshore
fish fill a **barotrauma meter** that feeds the release-weight step. Must work one-handed on touch.

## Visual target (owner, 2026-11-01) — read from the Steam page of *I Just Wanted to Fish*
Reproduce the *feel*, never its assets, names or UI layout:
- **Camera:** high third-person, near top-down (pitch ~55–65°, ~12–18 m back), smoothly follows a
  small character; gentle zoom (wheel/pinch). Fishing keeps the same camera: you see the angler, the
  line arcing out and the float on the water. First-person removed.
- **Water:** crystal-clear shallow turquoise over visible cream sand; painted caustic web on the
  seabed; soft white foam line tracing the shore; sparkly sun glints; colour deepens to teal/blue
  with depth; dark fish silhouettes visible swimming in the shallows (they are the fish you can cast to).
- **Land:** warm cream sand, big soft tree shadows across it, chunky rounded rocks, clumps of
  colourful weed/sponge in the water. Illawarra flavour: Norfolk Island pines, casuarinas, banksia
  scrub, sandstone platform and bluff, pelicans, gulls.
- **Built things:** plank wooden jetty with posts, tinnie/boats moored, bait-shop hut, fish-cleaning
  table, lifeguard tower — all chunky, Blender-built.
- **Characters:** stylised, cel-shaded, big readable heads, hats; NPC dialogue = a portrait bust at
  bottom-left with a cream, rounded dialogue box (name tag, text, choices).
- **UI:** every panel in the cream/teal cosy style (no dark slate panels anywhere).

## Game spine — complete the Illawarra Fish Guide (owner, 2026-11-01)
Tagline: **"Gotta catch 'em all… and release the small."** (Never say "Pokédex".)
- Each guide entry fills in tiers: **Seen** (fish finder, rock pool, another angler's bucket —
  silhouette + where/when hint) → **Caught** ("Unknown fish") → **Identified** (dichotomous key
  solved) → **Mastered** (accurate brag-mat measure + correct keep/release call; reveals stock
  status and the sustainable swap).
- Spots are regions with per-spot completion ("Lake Illawarra 9/14"); a spot ribbon unlocks the next
  spot and its gear (boat + fish finder, squid jig + harbour night, freshwater river).
- Rare entries need conditions (night, tide phase, season, location, gear) — the lesson is
  learned, not ground out.
- Protected species are Mastered only by a correct release.
- Ending: guide 100% Mastered **and** Bay Health above threshold (depleted stocks hide the last
  rare fish until the bay recovers) → present the guide at the fishing club awards night, credits.
  Post-game: commercial licence chapter.

## NPCs — a living coast (owner, 2026-11-01)
Original characters, cosy-modelled, with daily schedules; they fish (and sometimes land fish),
walk, and react to the player (e.g. tut at an undersize keep nearby). E to talk.
- Bait-shop owner (shop; rules, licence, swaps, "rec fishers can't sell catch"; sells gear).
- Old wharf angler (jetty, dawn/dusk; rig + tide tips).
- Lifeguard (beach tower; rock-fishing safety, swell, lifejacket law; gates the platform).
- Fisheries officer (roams; esky inspections, explains each rule's reason).
- Marine scientist (boat ramp; tag-and-release, citizen-science logbook pay).
- Sea Country ranger (Lake Illawarra; First Nations content strictly from worksheets 2.1.1/2.2.1;
  dialogue flagged for school AEO / local AECG review before release).
- Kid angler rival/buddy (moves between spots; challenges + gossip).
- Club comp organiser (fishing club; weekly comps, awards-night ending).
- Clean-up volunteer (beach; litter missions, trades litter for gear).
Interactions: **tips** rotate with today's tide/time/season and act as **gossip** that reveals
"Seen" entries; **"Show me" trades** use field-guide/logbook records (Mastered entry, logged
releases with photos, protected-species release) as proof and reward items (rigs, nipper pump,
release weight, tag kit, Sea Country story cards); **quiz trades** draw on the worksheet quiz bank.
Ambient life: pelicans at Belmore Basin cleaning tables, diving seabirds over schools.
Dialogue lives in data (`src/content/npcs.js`), not code.

## Owner additions (2026-11-01)
- **Dichotomous key replaces the 3-card ID check.** First landing of a species shows "Unknown fish".
  Player walks a 4–6 couplet key built from real, visible features (body flattened top-to-bottom?
  tail forked? yellow fins? dark spots/bars? mouth size/position? teeth?) and can rotate/inspect the
  3D fish while answering. Solving names the species permanently: later catches auto-label and the
  field guide card unlocks. A wrong path names it wrongly; the guide later flags the mismatch
  ("this doesn't match — re-key it"). One key covers all phase species; it grows as species are
  added (generated from per-species feature data, unit-tested so every species reaches a unique leaf).
- **Character creation.** Name, skin tone, hair style/colour, hat, shirt, sunnies, rod colour.
  Needs a **third-person camera** (orbit behind the angler; first-person optional). Restore cosy
  character models from `../deepswell/assets/models/characters_cosy.glb` / its Blender builder.
- **Economy without illegal sales.** NSW recreational fishers may not sell their catch — taught
  in-game by the bait-shop owner when you try. Coins come from: logbook/citizen-science records
  (accurate measurement pays more), tag-and-release, fishing-club comps (weigh-ins and
  catch-and-release), missions, litter. Spend at the **tackle shop**: rods/reels/line (bigger,
  steadier catch zone; stronger line for bolt fish), rigs, bought bait (or collect bait free within
  the bait rules), cosmetics. Later (phase 3): a **commercial licence** unlocks selling at the
  Wollongong fishermen's co-op and the commercial chapter (quota, nets, bycatch).

## Gear
Rigs: paternoster, running sinker, float (bobby cork), unweighted, soft-plastic lure, metal slug,
squid jig, crab net. Baits: beach worm, nipper (yabby), prawn, pilchard, squid strip, bread/weed
(luderick: green weed). Each species in the content file lists its preferred rig + bait. Tackle box
UI shows a small 3D/2D diagram of each rig with labelled parts (hook, sinker, swivel, float, leader).

## Progress & learning record
- Field guide (collection goal) — species card: photo of your catch, scientific name, ID feature,
  habitat, legal length/bag, stock status, "did you know", the swap.
- Missions mapped to syllabus dot points (e.g. "Catch, measure and log 5 species at Lake
  Illawarra" -> identify/record local species; "Release 3 undersize fish correctly" -> bag & size
  limits; "Match the rig: catch a whiting on a running sinker with worm").
- Quiz cards between outings, from the content file's quiz bank (cite worksheet numbers in data).
- Logbook export as CSV (numeracy). Saved with the existing `core/save.js` pattern.

## Keep from DeepSwell / strip
Keep: ocean, world, terrain, life (fish looks + models), fishing, audio, ui/touch, core, settings,
Blender tool chain, cosy models, playtest harness. Strip: surf, dive, jet ski, labs, photo grading,
other ecosystems (GBR, pelagic, deep). Title, README, `package.json` name, `<title>` -> TideLine.

## Quality bar
Cosy art bible everywhere; every catchable species needs a correct-shaped, correctly marked look
(`registerLook`) — accurate markings pastel-shifted. Works at 375 px with touch controls and on the
low graphics tier (school laptops). `npm test` passes; Playwright playtest per phase with screenshots.
