// The people of the Illawarra coast: who they are, what they look like, where they are at dawn / day / dusk / night, and everything they say.
// All dialogue is DATA here, not code (src/npc/talk.js plays it). Original characters, all friendly.
//
// Rules content comes from ../tideline-content/species-and-rules.md (sections B swaps, C rules, F quiz bank). Nothing here invents a rule.
//
// !! REVIEW BEFORE CLASSROOM RELEASE: the Sea Country ranger's dialogue (RANGER_NOTE below, the `jo` entry and the Sea Country cards in
// !! content/items.js) touches First Nations content. It uses ONLY dataset section D rows tagged [worksheet] (nothing [unverified]), speaks of
// !! practices as living knowledge and sends students to a Knowledge Holder. It still needs checking by the school's Aboriginal Education
// !! Officer and the local AECG before it is shown to a class.
//
// Shape of an NPC:
//   name, role, where (a line for the quest log), look (angler appearance: skin, hairStyle, hair, hatStyle, hat, sunnies, pattern, shirt, shorts, rod),
//   props (held/worn bits built in src/npc/props.js), scale (kids are smaller),
//   sites: { <ecoId>: { dawn|day|dusk|night: slot } }  slot = { act: fishing|walking|standing|sitting|away, at: 'place' | path: ['place', ...], face?: 'water' | radians }
//          place names are resolved per site in src/npc/places.js.
//   intro (first meeting), greet (later visits; {name} = the player's angler name), topics (Ask about...), tips and gossip (rotate with the day's tide / time /
//   season), trades (show-me and quiz requests), react (what they say about what you do nearby).
// Line conditions: { tide: [...], time: [...], season: [...] } narrow when a tip or gossip line is told (src/npc/lines.js). A gossip line has
// `species` (a species id): telling it marks that fish Seen in the Fish Guide (guide.markSeen(id, 'gossip')) and it must say where and when.

import { COIN, RATES } from './shop.js';

export const RANGER_NOTE = 'Sea Country dialogue: worksheet-sourced only. Needs review by the school AEO / local AECG before classroom release.';

export const NPCS = {
  // ------------------------------------------------------------------ Lake Illawarra
  mitra: {
    name: 'Mitra', role: 'Bait shop owner', where: 'the bait shop, Lake Illawarra',
    look: { skin: 0xe0a97c, hairStyle: 'bun', hair: 0xc9ced2, hatStyle: 'none', sunnies: 'round', pattern: 'plain', shirt: 0x2f9a9a, shorts: 0xc9b27a },
    props: ['apron', 'baittub'],
    sites: {
      seagrass: {
        dawn: { act: 'standing', at: 'hutDoor', face: 'water' }, day: { act: 'standing', at: 'hutDoor', face: 'water' },
        dusk: { act: 'standing', at: 'hutDoor', face: 'water' }, night: { act: 'away' },
      },
    },
    intro: [
      "Well, hello! I'm Mitra and this is my bait shop. Everyone who fishes the lake ends up on my doorstep sooner or later.",
      'Ask me anything about the rules, bait or tackle. I would rather you ask than guess.',
    ],
    greet: ["G'day, {name}! Good to see you.", 'Back again, {name}? What can I do for you?', 'Morning, {name}. Bait is fresh today.'],
    topics: [
      { q: 'Do I need a fishing licence?', a: [
        'In NSW it is called a recreational fishing fee. It is $7 for 3 days, $14 for a month, $35 for a year or $85 for 3 years (check the price on the day). You need it to fish, and also to collect your own bait, if you are 18 or older.',
        'You are under 18, so you do not pay. But every rule still applies to you, and a licence from Victoria is not valid in NSW.',
        'Some adults are exempt too: Aboriginal people, and people with a Pensioner Concession Card, for example. A Seniors Card is not enough on its own.',
      ] },
      { q: 'What does the fee pay for?', a: [
        'It goes into the Recreational Fishing Trusts, one for saltwater and one for freshwater. They pay for fish habitat, for stocking fish, and for facilities like boat ramps and cleaning tables.',
        'So when adults pay, they are paying for the fishing you do. Not a bad deal.',
      ] },
      { q: "Can I sell what I catch?", a: [
        "No. In NSW recreational fishers cannot sell their catch. Not to me, not to a café, not to your neighbour. It is for your own feed. That is why a fish never has a price on it in this game.",
        'People who sell fish hold a commercial licence, with quotas and rules about nets and bycatch. That is a whole other job.',
        `So how do you earn ${COIN.name}? Like a citizen scientist. A complete logbook record pays ${RATES.recordBase}: name the fish, measure it within 1 cm and make the right keep-or-release call. There is a bonus for the first record of a species (${RATES.firstSpecies}) and for a new spot, tide and time (${RATES.newCombo}), but only ${RATES.speciesDailyCap} records of one species count each day.`,
        `Tag a legal-size fish with Dr Priya's kit and release it quickly: ${RATES.tagPay}. Enter Bev's club comp at Bellambi, pull litter for Fatima's clean-up tally (${RATES.litterPiece} a piece), or do jobs for the people on the coast.`,
        'Then spend them in my shop: better rods, line, bait, gear that helps the fish, and a bit of style. Want a look?',
      ] },
      { q: 'Any sustainable swaps?', a: [
        'Always. Mulloway are only recovering in NSW after being depleted. Chase tailor or Australian salmon instead, or a dusky flathead here in the lake. All three stocks are sustainable.',
        'Hitting the same wharf for bream every weekend? Rotate with luderick or sea mullet. They are low on the food chain and plentiful.',
        'And remember, stock status is by region. Snapper are depleted in Western Australia but sustainable in NSW. Check the stock, not just the species.',
      ] },
      { q: 'What are the rules at the lake?', a: [
        'Around the lake entrance channel, from the breakwalls to about Bevans Island, you may not use crab traps, hoop or lift nets (witches hats), hand-hauled prawn nets, push nets or lobster traps. Not at any time of year.',
        'Rod and line is fine. In Mullet Creek no nets of any kind, apart from a landing net. Keep it simple and fish rod and line, like you are doing.',
        'Any crab or lobster carrying eggs goes straight back in the water.',
      ] },
      { q: 'What about bait?', a: [
        'You can collect up to 100 nippers and up to 20 beach worms a day. Pipis are bait only, and no more than 50 in total, and within 50 metres of the high-tide mark.',
        'Never use imported raw prawns. They are linked to white spot disease, which wiped out local prawns. Buy local, or pump your own nippers.',
        'And it is no-take at Bushrangers Bay Aquatic Reserve: no fishing and no collecting, not even empty shells.',
      ] },
    ],
    tips: [
      { t: 'Bait goes on ice in a sealed tub, out of the sun. Warm bait is smelly bait, and it fishes badly.' },
      { t: 'FishSmart is a free app with every size and bag limit. Check it before you keep anything, because limits change.' },
      { t: 'Use local bait: nippers, beach worms, local pilchards and squid. Imported raw prawns can carry white spot virus.' },
      { t: 'Match the tackle to the fish. A running sinker lets the sinker slide, so a whiting does not feel the weight and drop the bait.' },
      { t: 'Rising tide over the flats at first light is whiting time. Beach worm on a running sinker, and a light touch.', tide: ['rising'], time: ['dawn', 'day'] },
      { t: 'A falling tide pulls bream out from the jetty piles. Prawn on an unweighted rig drifts down the way a real one does.', tide: ['falling', 'low'] },
      { t: 'It is luderick season. Green weed on a float, set just off the bottom, and wait for the float to slide away.', season: ['autumn', 'winter'], tide: ['rising', 'high'] },
      { t: 'Dusk and night are squid time near the jetty. A squid jig has spikes but no barbed hook, and the squid grab it as it sinks.', time: ['dusk', 'night'] },
    ],
    gossip: [
      { species: 'sandwhiting', t: 'The regulars say sand whiting are working the Lake Illawarra flats, mornings on a rising tide, mostly in summer and autumn. Beach worm, running sinker.', tide: ['rising'] },
      { species: 'tailor', t: 'Tailor have been chasing bait round the jetty and along the channel at dawn and dusk. It is an autumn and winter thing, and they have teeth, so mind your fingers.' },
      { species: 'mulloway', t: 'Somebody swears they saw a big mulloway in the Lake Illawarra channel at night on a rising tide. Spring and summer. They are only recovering, so only one over 70 cm may be kept.', time: ['dusk', 'night'] },
      { species: 'duskyflathead', t: 'Dusky flathead lie on the sandy bottom of the channel edge, mostly at dawn and dusk on a rising tide. Spring and summer. Soft plastics work wonders.' },
    ],
    trades: [
      { id: 'mitra-licence', kind: 'quiz', title: 'Licence and fees quiz', quiz: [6, 7, 8], reward: 'bait-nipper',
        ask: 'Three quick questions about the fishing fee, and I will give you my spare nipper pump. Wrong answer, and we try again tomorrow.',
        done: 'Spot on, all three! Here, take the nipper pump. Pump nippers on the sand flats, 100 at most, and you can use them as bait.' },
      { id: 'mitra-flathead', kind: 'show', title: 'Measure a flathead properly', need: { type: 'accurateSlot', id: 'duskyflathead' }, reward: 'bait-pilchard',
        ask: 'Show me you can measure properly. Catch a dusky flathead inside the slot (36 to 70 cm) and measure it within 1 cm on the brag mat. I will give you a box of frozen pilchards.',
        done: 'Within a centimetre, and in the slot. You know that the big ones are the best breeders. Here are the pilchards. Keep them on ice!' },
      { id: 'mitra-lake', kind: 'quiz', title: 'Lake rules quiz', quiz: [13, 9, 10], reward: 'rig-squidjig',
        ask: 'I have a squid jig in the back with your name on it. Three questions about the lake and about bait, and it is yours.',
        done: 'Perfect. Here is the squid jig. Fish it at dusk or night near the jetty, and let it sink.' },
    ],
    react: {
      illegal: { undersize: "Hey, that one's undersize, {name}. Put it back, it has not bred yet.", oversize: "That one is over the slot, {name}. The big ones are the best breeders, let it go.", bag: "Careful, {name}, you have reached your bag limit for that fish.", possession: 'That is over your possession limit, {name}. Fridge and freezer count too.', protected: 'That is a protected species! Release it straight away, {name}.' },
      cheer: ['What a fish, {name}! The regulars will be jealous.', 'Beauty, {name}! That is a fine one.'],
      greet: ['G\'day, {name}!', 'Hello, {name}!'],
    },
  },

  tam: {
    name: 'Old Tam', role: 'Jetty regular', where: 'the jetty, Lake Illawarra',
    look: { skin: 0xe0a97c, hairStyle: 'short', hair: 0xc9ced2, beard: 'big', beardColor: 0xf6f4ee, hatStyle: 'straw', hat: 0xe9d9a6, sunnies: 'none', pattern: 'fishing', shirt: 0xf6f1e6, shorts: 0xc9b27a, rod: 0x8a5230 },
    props: ['bucket', 'thermos'],
    sites: {
      // Old Tam fishes the lake jetty by day and dusk, then walks up to Belmore Basin for the squid, so at night he is on the harbour wharf, under the lamps.
      seagrass: {
        dawn: { act: 'fishing', at: 'jettyEnd', face: 'water' }, day: { act: 'sitting', at: 'jettySeat', face: 'water' },
        dusk: { act: 'fishing', at: 'jettyEnd', face: 'water' }, night: { act: 'away' },
      },
      harbour: {
        dawn: { act: 'away' }, day: { act: 'away' }, dusk: { act: 'away' },
        night: { act: 'fishing', at: 'wharfEnd', face: 'water' },
      },
    },
    intro: [
      "Ah, a new face. They call me Old Tam. I have fished this jetty since before you were born, and I will be here when you are old and grey too.",
      'Fish with me a while. Tides, rigs, patience. The three things that matter.',
    ],
    greet: ["Hello again, {name}. Pull up a bit of jetty.", "{name}! The fish have been asking after you.", 'Good to see you, {name}. Mind the bucket.'],
    topics: [
      { q: 'Which rig for which fish?', a: [
        'A rig is picked for the fish. Paternoster holds the bait just off the bottom. A running sinker lets the sinker slide down to a swivel, so a fish can pick up the bait and feel almost no weight.',
        'A float holds the bait at one depth and tells you about every nibble, good for luderick and garfish. Unweighted is just hook and bait, sinking slowly and naturally.',
      ] },
      { q: 'How does the tide change the fishing?', a: [
        'Fish feed on the move. A rising tide brings food over the flats, so whiting and flathead come in. A falling tide pulls the bream out from the piles and the mangroves.',
        'Slack water at the top or bottom of the tide is quiet. Take a break, pour a cup of tea.',
      ] },
      { q: 'What do I do with a deeply hooked fish?', a: [
        'Cut the line close to its mouth. Do not rip the hook out. A bream that has swallowed the hook has only a 12% chance of survival if you pull it out, and over 85% if you cut the line.',
        'Use wet hands, keep it out of the water only a few seconds, and let it go.',
      ] },
      { q: 'Why do you fish the harbour wharf at night?', a: [
        'Because that is when the squid come up. The wharf lamps light the water, tiny plankton drifts into the light, the baitfish come for the plankton, and the squid come for the baitfish. It is a food chain lit up like a stage.',
        'I use a squid jig. It is a prawn-shaped lure with a ring of spikes and no barbed hook. Let it sink, lift it slowly, and when you feel a soft weight, strike. Then hold on: a squid pulls softly and then JETS.',
        'Bag limit is 20, and that counts squid and cuttlefish together.',
      ] },
      { q: 'Any jetty manners?', a: [
        'Look behind you before you cast, and call out. Cover your hooks when you walk. A hook in a stranger is no way to start the day.',
        'Take your litter home, and put old line in a bin. Line left on the jetty drowns birds.',
      ] },
    ],
    tips: [
      { t: 'Bream like a falling tide, round the jetty piles and the mangrove roots, at first light and last light.', tide: ['falling', 'low'], time: ['dawn', 'dusk'] },
      { t: 'Early on a rising tide, sand whiting come up onto the flats. Light line, beach worm, and do not rush the strike.', tide: ['rising'], time: ['dawn'] },
      { t: 'At night the tailor run along the jetty lights. Metal slug or pilchard on a running sinker, and a wire trace if you are brave.', time: ['night', 'dusk'] },
      { t: 'Green weed and a float, my friend. In winter the luderick are on it all day long.', season: ['winter', 'autumn'] },
      { t: 'High tide, slack water: nothing is moving. This is when I drink my tea.', tide: ['high'] },
      { t: 'Under the wharf lamps at night, cast into the edge of the light pool, where the baitfish gather. Squid jig, let it sink, lift slowly.', time: ['night', 'dusk'] },
      { t: 'If the bait comes back untouched, move. Fish are not everywhere. Look for birds, shade under the jetty, and the edge of the channel.' },
      { t: 'The best tackle is the tackle that suits the fish. Ask the guide what it likes.' },
    ],
    gossip: [
      { species: 'yellowfinbream', t: 'Yellowfin bream hold around the Lake Illawarra jetty piles at dawn and dusk, mostly on a falling tide. Prawn or nippers on a light rig.', tide: ['falling', 'low'] },
      { species: 'luderick', t: 'Luderick are grazing weed round the jetty and the seagrass in the middle of the day in autumn and winter, on a rising tide. Float rig and green weed.', season: ['autumn', 'winter'] },
      { species: 'silvertrevally', t: 'Silver trevally have been schooling under the jetty at dusk. Summer. They fight well, and they love prawn.' },
      { species: 'squid', t: 'Squid come in under the jetty lights at dusk and after dark, and best of all under the Belmore Basin wharf lamps. Jig them slowly, and let the jig sink.', time: ['dusk', 'night'] },
      { species: 'garfish', t: 'Garfish skim along the jetty in daylight. A small hook, a float, and a bit of green weed. They have long beaks, so look for the flash.', time: ['day', 'dawn'] },
    ],
    trades: [
      { id: 'tam-bream', kind: 'show', title: 'Master the yellowfin bream', need: { type: 'mastered', id: 'yellowfinbream' }, reward: 'rig-float',
        ask: 'Here is a challenge for you. Master the yellowfin bream: name it with the key, measure it right, and make the right call to keep or release it. Do that, and I will give you my float rig.',
        done: 'You know your bream. Here, take the float. It will show you every nibble.' },
      { id: 'tam-rigs', kind: 'quiz', title: 'Rigs and release quiz', quiz: [19, 18, 17], reward: 'bait-greenweed',
        ask: 'Three questions about rigs and bait. Get them all right, and I will give you a bag of fresh green weed.',
        done: 'Not a single slip. Here is the green weed. Luderick will eat nothing else.' },
      { id: 'tam-release', kind: 'show', title: 'Three quick releases', need: { type: 'releases', n: 3, maxAir: 10 }, reward: 'hat-tam',
        ask: 'Show me you can release a fish properly. Three releases in your logbook, each with no more than 10 seconds out of the water. I will give you my old hat.',
        done: 'Quick hands, healthy fish. That is the way. Here, have my hat. It has seen fifty summers.' },
    ],
    react: {
      illegal: { undersize: "That one's a baby, {name}. Back it goes, mate.", oversize: 'Too big, {name}. The big ones are the breeders. Let her go.', bag: 'That is your bag for that kind, {name}. Enough is enough.', possession: 'Careful, {name}. Count what is in the freezer too.', protected: 'Do not touch that one, {name}. Protected. Wet your hands and let it go.' },
      cheer: ['Now that is a fish, {name}!', "That's a beauty, {name}! Ha!"],
      greet: ['Morning, {name}.', 'Ah, {name}!'],
    },
  },

  priya: {
    name: 'Dr Priya', role: 'Marine scientist', where: 'the dinghy landing, Lake Illawarra',
    look: { skin: 0xa66a42, hairStyle: 'long', hair: 0x2a2020, hatStyle: 'cap', hat: 0x2f5496, sunnies: 'sport', pattern: 'plain', shirt: 0xf6f1e6, shorts: 0xc9b27a },
    props: ['clipboard', 'baittub'],
    sites: {
      seagrass: {
        dawn: { act: 'standing', at: 'ramp', face: 'water' }, day: { act: 'standing', at: 'ramp', face: 'water' },
        dusk: { act: 'walking', path: ['ramp', 'rampWest'] }, night: { act: 'away' },
      },
    },
    intro: [
      "Hi! I'm Dr Priya. I study the fish of Lake Illawarra for the university, and anglers are my best research team.",
      'Everything you log helps me. Every length, every release, every date. Records show if a fish population is healthy.',
    ],
    greet: ['Hi {name}! Any fish for the logbook?', 'Hello {name}. Good records today?', 'Hi {name}! Seen anything interesting?'],
    topics: [
      { q: 'What is tag and release?', a: [
        'We put a small numbered tag on a healthy fish and let it go. When another angler catches it later and reports the number, we learn how far it travelled and how fast it grew.',
        'It only works if the fish survives, so wet hands, a quick unhook, and back in the water. Most fish survive well: flathead 91 to 96%, luderick 99%, sand whiting 93%, tailor 92%.',
      ] },
      { q: 'What is a citizen-science logbook?', a: [
        'It is the logbook you already keep. Species, length, where, when, bait or lure, kept or released. Scientists use records like these to see if populations are healthy.',
        'The more accurate your measuring, the more useful the data. That is why accurate measures matter so much. Within a centimetre is the goal.',
      ] },
      { q: 'What is barotrauma?', a: [
        'Fish from deep water have gas in a swim bladder that expands as they are pulled up. It can leave them floating, unable to dive. It becomes a concern from about 10 metres.',
        'A release weight carries the fish back down to depth, which is much better than venting, which is a last resort. I have a release weight I can lend a good citizen scientist.',
      ] },
      { q: 'Why do small fish have to go back?', a: [
        'A minimum size means a fish has had the chance to breed at least once. A slot limit like the dusky flathead 36 to 70 cm also protects the big fish, because the biggest females lay the most eggs.',
      ] },
    ],
    tips: [
      { t: 'Total length is from the tip of the snout, with the mouth closed, to the tip of the tail. Lay the fish flat on the mat.' },
      { t: 'Fish right on the legal limit can shrink after they are harvested. Measure carefully, and one centimetre under is still undersize.' },
      { t: 'The seagrass beds around here are a fish nursery. Whiting, bream and flathead grow up in them. Look but do not trample.', tide: ['rising', 'high'] },
      { t: 'Spring and summer, the flathead are spawning in and near the lake. A good time to release the big ones.', season: ['spring', 'summer'] },
      { t: 'Use barbless or reduced-barb hooks, and non-offset circle hooks with bait. The fish are easier to release.' },
      { t: 'Use a knotless soft landing net. Knots strip off the slime that protects the fish.' },
    ],
    gossip: [
      { species: 'duskyflathead', t: 'My nets show dusky flathead concentrated on the Lake Illawarra channel edge and seagrass flats, mostly at dawn and dusk on a rising tide in spring and summer.' },
      { species: 'sandwhiting', t: 'Sand whiting juveniles are everywhere on the Lake Illawarra seagrass in summer. The adults feed on the flats on a rising tide.' },
      { species: 'shortfineel', t: 'Shortfin eels move through the channel and the mangrove edge at night in summer and autumn, heading down to the sea to breed. Easy to miss.', time: ['night', 'dusk'] },
      { species: 'seamullet', t: 'Sea mullet school over the Lake Illawarra flats on rising and high tides in the daytime, mostly in autumn. They feed on algae and detritus in the sand.' },
    ],
    trades: [
      { id: 'priya-measure', kind: 'show', title: 'Three accurate measurements', need: { type: 'accurateMeasures', n: 3 }, reward: 'tool-tagkit',
        ask: 'Show me three accurate measurements in your logbook, each within 1 cm of the true length. Do that, and I will give you a tag kit so you can join the tag-and-release program.',
        done: 'Accurate to the centimetre. That is data I can use. Here is your tag kit. Tag a fish at the release step.' },
      { id: 'priya-protected', kind: 'show', title: 'Release a protected species', need: { type: 'protectedRelease' }, reward: 'tool-releaseweight',
        ask: 'Wobbegongs and blue groper are protected and must be released straight away. Release one, and I will give you a release weight. You will find wobbegongs on the Bellambi rock platform.',
        done: 'You released a protected species, the right way. Here is the release weight. Use it for deep-water fish.' },
      { id: 'priya-tag', kind: 'show', title: 'Tag and release two fish', need: { type: 'taggedReleases', n: 2 }, reward: 'hat-research',
        ask: 'Use the tag kit on two fish at the release step. Wet hands and a quick return. I will give you a research cap.',
        done: 'Two tagged and gone. Thank you! Take a cap, citizen scientist.' },
    ],
    react: {
      illegal: { undersize: 'Oh no, {name}. That one is undersize. It has not bred yet, so it should swim free.', oversize: 'That one is over the slot, {name}. The biggest fish are the best breeders.', bag: 'You are over the bag limit there, {name}.', possession: 'That is over the possession limit, {name}.', protected: 'That is a protected species, {name}! Release it at once.' },
      cheer: ['Wow, {name}! Please log that one. Length, spot, time!', 'Lovely fish, {name}! Measure it and log it.'],
      greet: ['Hi {name}!', 'Hello, {name}!'],
    },
  },

  jo: {
    name: 'Ranger Jo', role: 'Sea Country ranger', where: 'the mangrove edge, Lake Illawarra',
    look: { skin: 0xe0a97c, hairStyle: 'pony', hair: 0x7a4e2c, hatStyle: 'wide', hat: 0x8fbf8a, sunnies: 'none', pattern: 'fishing', shirt: 0x7fcfa8, shorts: 0x7d8f4a },
    props: ['binoculars'],
    sites: {
      seagrass: {
        dawn: { act: 'standing', at: 'mangrove', face: 'water' }, day: { act: 'walking', path: ['mangrove', 'mangroveNear'] },
        dusk: { act: 'standing', at: 'mangrove', face: 'water' }, night: { act: 'away' },
      },
    },
    intro: [
      "Hello! I'm Jo, a ranger here at the mangrove edge. I keep an eye on the lake.",
      'I should be clear about something. I am not a Knowledge Holder, and I cannot speak for Aboriginal and Torres Strait Islander Peoples. What I share is from your class worksheets.',
      'For the real thing, ask your school to invite a Knowledge Holder through the local AECG. Their knowledge is living knowledge, and it is theirs to share.',
    ],
    greet: ['Hello, {name}. Good to see you at the water.', 'Hi {name}. How is the lake looking?', 'Morning, {name}.'],
    topics: [
      { q: 'Whose Country is this?', grants: 'sc-lake', a: [
        "Lake Illawarra is Dharawal Country. Spellings vary: Dharawal, D'harawal, Wadi Wadi, Wodi Wodi.",
        'The worksheet says local sources tell of women fishing from small bark canoes with hand lines, and nets made from bark. Women gathered shore plants like warrigal greens, pigface and sea lettuce. Shell middens around the lake show shellfish have been eaten here for a very long time.',
        'Country includes the water, and people have a responsibility to care for it. I have added a story card to your guide.',
      ] },
      { q: 'How did people fish?', grants: 'sc-methods', a: [
        'Aboriginal and Torres Strait Islander Peoples have used many methods, and still do. The worksheet names five: fish traps, spears, bark canoes, shell hooks on a handline, and weirs.',
        'A trap is stones, sticks or woven material shaped so fish swim in and cannot easily get out. A weir is a wall or fence across a stream or channel to hold or guide fish.',
      ] },
      { q: 'What is cultural fishing?', a: [
        'It is fishing for culture, for sharing food and teaching family and community. It is not for sale. Commercial fishing is for money.',
        'In NSW, Aboriginal people do not pay the recreational fishing fee. But the size limits still apply.',
      ] },
      { q: 'What do rangers do?', grants: 'sc-rangers', a: [
        'Ranger work includes watching over animals and sites, and removing pests. Your worksheet mentions the li-Anthawirriyarra Sea Rangers, and ranger work on the Worimi Conservation Lands.',
        'Here at the mangroves I look for rubbish, line and pest weeds. Every piece you pull out of the water helps.',
      ] },
      { q: 'What is two-way science?', a: [
        'It means using Aboriginal knowledge and Western science together, side by side. Each one can teach us something the other one can not.',
        'A question worth asking a Knowledge Holder: "What does Sea Country mean to you?"',
      ] },
      { q: 'Do the seasons matter?', a: [
        "The D'harawal calendar reads the seasons from plants, animals and weather. The worksheet gives one example: when the marrai'uo, or Gossamer Wattle, flowers in Wiritjiribin, around August, it is a sign that fish are swimming in the rivers.",
        'The calendar is shared by the Bureau of Meteorology with permission, so I will not repeat it all here. Read it there in full: bom.gov.au, Indigenous Weather Knowledge.',
      ] },
    ],
    tips: [
      { t: 'The mangroves are a fish nursery. Bream, mullet and flathead grow up in the roots. Walk gently along the edge.' },
      { t: 'Take only what you need. That is a principle in your worksheets, and a good one for a fisher.' },
      { t: 'Look after the breeding places. A bag limit and a slot limit are rules that protect them.' },
      { t: 'Litter and old line hurt animals. If you see line in the water, grab it. That is a Steward point.' },
      { t: 'Follow the seasons. Fish move with the tides and the seasons, and good fishers learn to watch for the signs.', season: ['spring', 'summer'] },
    ],
    gossip: [
      { species: 'yellowfinbream', t: 'Bream gather in the mangrove roots at Lake Illawarra at dawn and dusk, especially on a falling tide. The roots give them cover.', tide: ['falling', 'low'] },
      { species: 'shortfineel', t: 'Shortfin eels travel through the mangrove edge at night and dusk, in summer and autumn. They are on their way to the sea.', time: ['night', 'dusk'] },
    ],
    trades: [
      { id: 'jo-cultural', kind: 'quiz', title: 'Cultural fishing quiz', quiz: [27, 28], reward: 'sc-brewarrina',
        ask: 'Two questions from your worksheets about cultural fishing. If you get them right, I will add a story card to your guide.',
        done: "That is right. Here is the card about Baiame's Ngunnhu, the Brewarrina fish traps." },
      { id: 'jo-seasons', kind: 'quiz', title: 'Seasons quiz', quiz: [29], reward: 'sc-seasons',
        ask: 'One question about the D\'harawal calendar. Answer it, and I will give you a story card.',
        done: 'Yes! Here is the card about reading the seasons.' },
      { id: 'jo-care', kind: 'show', title: 'Look after the fish', need: { type: 'releases', n: 5, maxAir: 10 }, reward: 'sc-country',
        ask: 'Caring for Country includes caring for the fish. Show me five releases in your logbook, each under 10 seconds out of the water, and I will give you a story card about caring for Country.',
        done: 'You looked after those fish. Here is the card about caring for Country.' },
    ],
    react: {
      illegal: { undersize: 'That one is too small, {name}. Let it grow and breed.', oversize: 'That one is too big, {name}. The large ones are the breeders. Let it go.', bag: 'Take only what you need, {name}. That is your limit.', possession: 'Take only what you need, {name}. That is over the possession limit.', protected: 'That is protected, {name}. Please release it straight away.' },
      cheer: ['Lovely fish, {name}. Thank you for looking after the lake.', 'Well done, {name}!'],
      greet: ['Hello, {name}.', 'Hi, {name}.'],
    },
  },

  // ------------------------------------------------------------------ Bellambi
  sione: {
    name: 'Sione', role: 'Lifeguard', where: 'the lifeguard tower, Bellambi',
    look: { skin: 0x8a5230, hairStyle: 'buzz', hair: 0x2a2020, hatStyle: 'bucket', hat: 0xf0715a, sunnies: 'sport', pattern: 'plain', shirt: 0xf4c84a, shorts: 0xe0645a },
    props: ['rescuetube', 'binoculars'],
    sites: {
      rocky: {
        dawn: { act: 'standing', at: 'tower', face: 'water' }, day: { act: 'standing', at: 'tower', face: 'water' },
        dusk: { act: 'standing', at: 'tower', face: 'water' }, night: { act: 'standing', at: 'tower', face: 'water' },
      },
    },
    intro: [
      "G'day! Sione, Bellambi lifeguard. I keep my eyes on the water so you do not have to.",
      'The beach is my patch. The rock platform to the east is where people get hurt. Ask me anything about staying safe.',
    ],
    greet: ["G'day, {name}! Stay between the flags.", 'Hey {name}. What is the swell doing?', 'Morning, {name}!'],
    topics: [
      { q: 'Do I need a lifejacket on the rocks?', a: [
        'Yes. Wollongong is a declared area under the Rock Fishing Safety Act 2016. Council opted in, and since November 2023 police can issue a penalty notice, about $100 (check the current amount), if you rock fish without a lifejacket.',
        'Do the buckles up, snug. A good lift test: pull up on the shoulders and it should not rise above your ears.',
      ] },
      { q: 'How do I stay safe on the rock platform?', a: [
        'Check the swell, wind, tide and time before you go. Wear non-slip, cleated shoes, never thongs or gumboots. Never fish alone, and carry a phone.',
        'Plan your escape route. And if someone falls in, do not jump in after them. Call 000 and throw a lifebuoy.',
      ] },
      { q: 'Why is a rising tide dangerous on the rocks?', a: [
        'A rising tide covers the platform and cuts off the way back. You can walk out on dry rock and be stranded by a rising tide and a bigger wave set.',
        'A swell of 2.5 metres or more is a big no for me. I will blow the whistle.',
      ] },
      { q: 'Where is dangerous around here?', a: [
        'Around here, Hill 60 at Port Kembla, Sandon Point at Bulli, and the Coledale rocks have caught people out. The friendly spots are Bellambi Beach, Bulli Headland and the Port Kembla harbour breakwall.',
      ] },
      { q: 'Beach and jetty safety?', a: [
        'On the beach, check the surf and swell, and stay behind the wash. On a jetty or wharf, look behind before you cast and call out. On a boat, everyone wears a lifejacket.',
      ] },
    ],
    tips: [
      { t: 'Check the swell chip at the top of your screen. At 2.5 metres or more the rock platform is off limits today.' },
      { t: 'A rising tide covers the platform and cuts off the way back. Plan your escape route before you start.', tide: ['rising'] },
      { t: 'Low tide gives you the most platform, and the rock pools are exposed. Go slowly, the rocks are slippery.', tide: ['low'] },
      { t: 'Dawn light is lovely but the rocks are wet and slippery. Take it slow.', time: ['dawn'] },
      { t: 'Never fish alone, and tell someone where you are going. That goes for rock fishing especially.' },
      { t: 'Salmon and tailor chase bait in the gutters at dawn and dusk. Watch for birds working the water.', time: ['dawn', 'dusk'] },
    ],
    gossip: [
      { species: 'australiansalmon', t: 'Australian salmon are running the Bellambi beach gutters at dawn and dusk on a rising tide, in autumn and winter. Birds diving on the bait gives them away.', season: ['autumn', 'winter'] },
      { species: 'wobbegong', t: 'Wobbegongs lie under the ledges of the Bellambi rock platform at dusk and night. They are protected, so if you hook one, release it with wet hands and the least fuss.' },
      { species: 'sandwhiting', t: 'Sand whiting are in the Bellambi surf gutters on a rising tide, daytime, summer and autumn. Beach worm.' },
      { species: 'bluegroper', t: 'Eastern blue groper hang around the Bellambi platform edge in the daytime. They are protected, and line fishing for them is banned. Look but let them be.' },
    ],
    trades: [
      { id: 'sione-rock', kind: 'quiz', title: 'Rock safety quiz', quiz: [15, 16], reward: 'hat-lifeguard',
        ask: 'Two questions on rock fishing safety. Get them right, and I will give you a patrol hat.',
        done: 'Safe as houses. Here is a lifeguard hat. Wear it and stay safe.' },
    ],
    react: {
      illegal: { undersize: "Hey, that one's undersize, mate. Back it goes.", oversize: 'Too big, {name}. The big ones breed. Let it go.', bag: 'That is your bag limit, {name}.', possession: 'You are over your possession limit, mate.', protected: 'That one is protected, {name}. Wet your hands and release it.' },
      cheer: ['Good one, {name}!', 'Beauty! Look at the size of that, {name}!'],
      greet: ["G'day, {name}!", 'Hey, {name}!'],
    },
    warn: {
      swell: 'Oi, {name}! The swell is {swell} m. The rock platform is closed to fishers today. Come back to the beach.',
      ignored: "I warned you, {name}. That's a safety mark against your Steward rating. A swell like this can sweep you off the platform.",
    },
  },

  bev: {
    name: 'Bev', role: 'Fishing club organiser', where: 'the club board, Bellambi beach path',
    look: { skin: 0xf6d7bd, hairStyle: 'short', hair: 0xc9ced2, hatStyle: 'cap', hat: 0x35b3ad, sunnies: 'round', pattern: 'stripes', shirt: 0x2f5496, shorts: 0xf2eee2 },
    props: ['clipboard'],
    sites: {
      rocky: {
        dawn: { act: 'standing', at: 'board', face: 'water' }, day: { act: 'standing', at: 'board', face: 'water' },
        dusk: { act: 'standing', at: 'board', face: 'water' }, night: { act: 'away' },
      },
    },
    intro: [
      "Hello there! I'm Bev, and I run the Illawarra Anglers' Club. That is our notice board by the beach path.",
      'We hold a comp most weekends. Weigh-ins, catch-and-release, the lot. Our awards night is the highlight of the year.',
    ],
    greet: ['Hello, {name}! Ready for a comp?', 'Hi {name}! Keep an eye on the board.', "{name}! Come to be a member?"],
    topics: [
      { q: 'What comps are coming up?', a: [
        'There is a comp on the board every day. Some days it is the most species released, some days the longest legal dusky flathead, some days the most accurate measures. Ask me for "Today\'s club comp", enter for free, and I settle the board when you head home.',
        `Prizes are ${RATES.compPrizes[0]}, ${RATES.compPrizes[1]} and ${RATES.compPrizes[2]} ${COIN.short} for the top three and ${RATES.compPrizes[3]} for everyone else who scores. Build up your Fish Guide too, because comps need species you have identified.`,
      ] },
      { q: 'How does a catch-and-release comp work?', a: [
        'You measure the fish accurately on the mat, photograph it, release it quickly with wet hands, and log the length. The judges check your logbook. The longest accurate fish wins.',
        'The prize is not a big fish, it is the right fish handled right.',
      ] },
      { q: 'What is the awards night?', a: [
        'Once your Fish Guide is full and the bay is healthy, you present it at our awards night. A thriving bay means healthy stocks. We hide the rarest fish until the bay recovers.',
      ] },
    ],
    tips: [
      { t: 'In a comp, accurate measuring wins. A centimetre lost on the ruler can lose you the day.' },
      { t: 'Check the comp board each visit. Dates and categories are pinned there.' },
      { t: 'Metal slugs are a club favourite for salmon and tailor off the beach. Cast far, wind fast.', time: ['dawn', 'dusk'] },
      { t: 'The club has a rule: take only what you need, and leave the rest to grow.' },
      { t: 'Swell above two and a half metres? The club cancels rock comps. Safety first.' },
    ],
    gossip: [
      { species: 'australiansalmon', t: 'The club members had Australian salmon on the Bellambi beach at dawn and dusk, rising tide, autumn and winter. Metal slugs, mostly.' },
      { species: 'tailor', t: 'Tailor are chasing baitfish along the Bellambi beach and platform at dawn, dusk and after dark on a rising or falling tide in autumn and winter.' },
      { species: 'bonito', t: 'Bonito were hitting slugs off the Bellambi rock platform at dawn and dusk. Summer and autumn. Fast and fun.' },
      { species: 'snapper', t: 'A big snapper came off the Bellambi platform edge at dawn in spring. They like a paternoster and pilchard or squid.' },
    ],
    trades: [
      { id: 'bev-ident', kind: 'show', title: 'Identify five species', need: { type: 'identifiedCount', n: 5 }, reward: 'rig-metalslug',
        ask: 'Show me you know your fish. Five species Identified in your Fish Guide, with the key solved correctly. I will give you a club metal slug.',
        done: "Five species named properly. That's a good eye. Here's a metal slug. Cast it far, wind it fast." },
      { id: 'bev-quiz', kind: 'quiz', title: 'Size and limit quiz', quiz: [1, 2, 5], reward: 'hat-club',
        ask: 'Three questions about measuring and size limits. All correct, and you get a club cap.',
        done: 'Correct, correct, correct! Here is your club cap.' },
      { id: 'bev-master', kind: 'show', title: 'Master three species', need: { type: 'masteredCount', n: 3 }, reward: 'bait-squidstrip',
        ask: 'Master three different species: identified, measured accurately and the right call made. The club freezer will give you squid strips.',
        done: 'Three mastered. You are a proper club member. Squid strips from the freezer.' },
    ],
    react: {
      illegal: { undersize: 'Hey, that one is undersize, {name}. We would DQ you in a comp!', oversize: 'Over the slot, {name}. In my club we release those.', bag: 'That is over the bag limit, {name}.', possession: 'Over the possession limit, {name}.', protected: 'That one is protected, {name}! Release it.' },
      cheer: ['Now that is comp material, {name}!', 'Look at that, {name}! Measure it!'],
      greet: ['Hi {name}!', 'Hello, {name}!'],
    },
  },

  fatima: {
    name: 'Fatima', role: 'Clean-up volunteer', where: 'Bellambi beach',
    look: { skin: 0xc58c5e, hairStyle: 'long', hair: 0x2a2020, hatStyle: 'wide', hat: 0x8fbf8a, sunnies: 'none', pattern: 'stripes', shirt: 0xf4c84a, shorts: 0x4a5560 },
    props: ['litterpicker', 'sack'],
    sites: {
      rocky: {
        dawn: { act: 'walking', path: ['litterA', 'litterB'] }, day: { act: 'walking', path: ['litterC', 'litterD'] },
        dusk: { act: 'walking', path: ['litterB', 'litterA'] }, night: { act: 'away' },
      },
    },
    intro: [
      "Hi! I'm Fatima, a clean-up volunteer. See this picker? Everything I find on the beach goes in this sack.",
      'Lost fishing line, bottle tops, plastic bags. Animals mistake them for food or get tangled. Come and help me!',
    ],
    greet: ['Hi {name}! Found any litter?', 'Hello {name}! The beach looks better already.', 'Hey {name}!'],
    topics: [
      { q: 'Why does litter matter?', a: [
        'Lost fishing line traps and drowns birds, turtles and fish. Plastic bags look like jellyfish to a turtle. Lost tackle is an impact, too.',
        'Use line bins, carry your rubbish home, and choose the right gear so you do not snag.',
      ] },
      { q: 'How can I help?', a: [
        'When you fish, watch for litter drifting through the catch bar. Line and plastic bags show up. Catch them in the green zone and you earn Steward points.',
        'Show me your litter count, and I have some gear to share.',
      ] },
      { q: 'Where do I report illegal fishing?', a: [
        'Call Fishers Watch on 1800 043 536. It is also the number for the Bushrangers Bay Aquatic Reserve, where there is no fishing and no collecting at all.',
      ] },
    ],
    tips: [
      { t: 'Cut old fishing line into short pieces before you put it in a bin, so a bird can not get tangled.' },
      { t: 'Carry a small bag for your rubbish. Whatever you bring to the beach, take home.' },
      { t: 'After heavy rain, more rubbish washes down the creeks and onto the beach. Good day for a clean-up.', tide: ['high'] },
      { t: 'The wrack line of seaweed at the high-tide mark hides plastic. Look carefully.', tide: ['falling', 'low'] },
      { t: 'Never eat shellfish raw, and do not collect after heavy rain. Stormwater makes them unsafe.' },
    ],
    gossip: [
      { species: 'sandwhiting', t: 'I always see sand whiting darting in the Bellambi surf gutters on the rising tide in the daytime, mostly in summer and autumn.' },
      { species: 'australiansalmon', t: 'There are Australian salmon off Bellambi beach at dawn and dusk in winter. You can see the birds working over them.', season: ['winter', 'autumn'] },
    ],
    trades: [
      { id: 'fatima-litter3', kind: 'show', title: 'Pull out three pieces of litter', need: { type: 'litter', n: 3 }, reward: 'tool-lurecolours',
        ask: 'Pull three pieces of litter out of the water. Lost line, plastic bags, they float into the catch bar. I will give you a pack of lure colours.',
        done: 'Three pieces fewer in the sea. Here are some lure colours. Pick one in your tackle box.' },
      { id: 'fatima-litter8', kind: 'show', title: 'Pull out eight pieces of litter', need: { type: 'litter', n: 8 }, reward: 'hat-greenteam',
        ask: 'Eight pieces of litter in total, and you are a proper Green Team member. I will give you a sun hat.',
        done: 'Eight! You are a legend. Here is a Green Team hat.' },
    ],
    react: {
      illegal: { undersize: 'That one is undersize, {name}. Put it back, please.', oversize: 'That one is too big to keep, {name}. Let it go.', bag: 'You are over the bag limit, {name}.', possession: 'Over the possession limit, {name}.', protected: 'That is protected, {name}. Release it.' },
      cheer: ['Wow, {name}!', 'What a fish, {name}!'],
      greet: ['Hi {name}!', 'Hello, {name}!'],
    },
  },

  mika: {
    name: 'Mika', role: 'Kid angler', where: 'the shore (moves between spots)',
    look: { skin: 0xefc19c, hairStyle: 'curly', hair: 0x2a2020, hatStyle: 'none', sunnies: 'none', pattern: 'plain', shirt: 0xf0715a, shorts: 0x6f92c4, rod: 0xd9503f },
    props: ['bucket'], scale: 0.82,
    sites: {
      seagrass: {
        dawn: { act: 'fishing', at: 'jettyEnd2', face: 'water' }, day: { act: 'fishing', at: 'bankEast', face: 'water' },
        dusk: { act: 'walking', path: ['bankEast', 'jettyBase'] }, night: { act: 'away' },
      },
      rocky: {
        dawn: { act: 'fishing', at: 'gutter', face: 'water' }, day: { act: 'walking', path: ['gutter', 'gutter2'] },
        dusk: { act: 'fishing', at: 'gutter2', face: 'water' }, night: { act: 'away' },
      },
    },
    intro: [
      "Hey! I'm Mika. I fish everywhere, the lake, the beach, you name it. I'm going to catch every fish in the guide before you do!",
      "Just kidding. Mostly. Want to be fishing buddies?",
    ],
    greet: ['Hey {name}! Catch anything?', "{name}! I'm winning, you know.", 'Oh, hi {name}! Race you.'],
    topics: [
      { q: 'Where do you fish?', a: [
        'All over! At the lake I fish off the jetty at dawn, and the sand flats during the day. At Bellambi I fish the beach gutters.',
        'A fish is not everywhere. Different spots have different fish. Check the guide for where and when.',
      ] },
      { q: 'What is your best fish?', a: [
        'A dusky flathead, 52 centimetres! Well, I think so. I did not measure it on the mat. You are supposed to measure it, right?',
        'Measure it properly, snout to tail, mouth closed. That is what counts.',
      ] },
    ],
    tips: [
      { t: 'Flatties love soft plastics worked along the bottom. At dawn on a rising tide, along the channel edge.', tide: ['rising'], time: ['dawn', 'dusk'] },
      { t: 'I got three whiting last time on beach worm. Rising tide, early. They bite so softly!', tide: ['rising'] },
      { t: 'Bream hang around the pylons when the tide is going out. They steal your bait if you are slow.', tide: ['falling', 'low'] },
      { t: 'Do not tell anyone, but dusk is my favourite time. The birds start diving and the fish start biting.', time: ['dusk'] },
      { t: 'If you do not know a fish, use the key. It really works!' },
    ],
    gossip: [
      { species: 'duskyflathead', t: 'I saw a huge dusky flathead lying on the sand at the Lake Illawarra channel edge at dusk. Spring or summer, rising tide. Bet you cannot catch one over 40 centimetres!' },
      { species: 'yellowfinbream', t: 'Yellowfin bream are everywhere at the Lake Illawarra jetty at dawn and dusk on a falling tide. Easy to catch, hard to land.', tide: ['falling', 'low'] },
      { species: 'garfish', t: 'Garfish zip along the jetty in daylight. They have a long beak like a pointy pencil. Float and green weed.' },
      { species: 'australiansalmon', t: 'Salmon at Bellambi! They splash around in the gutters at dawn and dusk. Autumn, winter. A metal slug!' },
      { species: 'sandwhiting', t: 'Sand whiting in the Lake Illawarra flats on a rising tide, daytime, summer. Beach worm.' },
    ],
    trades: [
      { id: 'mika-flathead', kind: 'show', title: 'Beat me to a 40 cm flathead', need: { type: 'catchSize', id: 'duskyflathead', minCm: 40 }, reward: 'rig-softplastic',
        ask: "Bet you can't catch a flathead over 40 centimetres! Catch one and measure it, and I will give you my soft plastic.",
        done: 'No way! A flathead over 40! Okay okay, you win. Here is my soft plastic. Work it along the bottom.' },
      { id: 'mika-species', kind: 'show', title: 'Catch five different species', need: { type: 'caughtSpecies', n: 5 }, reward: 'hat-mika',
        ask: "I've caught five different kinds of fish. Beat that! Show me five species in your guide. I will give you my beanie.",
        done: 'Five kinds! Fine. Take my beanie. It is a bit chewed, sorry.' },
    ],
    react: {
      illegal: { undersize: "Hey, that one's undersize, mate!", oversize: 'Ooh, too big! Let it go, they are the breeders.', bag: 'That is your bag, {name}!', possession: 'Careful, that is over the possession limit!', protected: 'No! That one is protected! Let it go!' },
      cheer: ['Whoa! Big one, {name}!', 'No way, {name}! That is huge!'],
      greet: ['Hey {name}!', 'Oh, hi, {name}!'],
    },
  },

  // ------------------------------------------------------------------ Belmore Basin
  nell: {
    name: 'Nell', role: 'Co-op fisher', where: 'the co-op, Belmore Basin',
    look: { skin: 0xc58c5e, hairStyle: 'pony', hair: 0x7a4e2c, hatStyle: 'beanie', hat: 0xf0715a, sunnies: 'none', pattern: 'plain', shirt: 0xf4c84a, shorts: 0x2f5496 },
    props: ['crate'],
    sites: {
      harbour: {
        dawn: { act: 'walking', path: ['wharfBase', 'coopDoor'] }, day: { act: 'standing', at: 'coopDoor', face: 'water' },
        dusk: { act: 'sitting', at: 'benchWest', face: 'water' }, night: { act: 'away' },
      },
    },
    intro: [
      "G'day! I'm Nell. I crew a trawler out of Belmore Basin, and I sell through the co-op, right there behind you.",
      'You fish for fun and for the feed. I fish for a living. Same sea, very different rules. Ask me anything.',
    ],
    greet: ["G'day, {name}! Smells like fish, I know.", 'Back at the harbour, {name}? Mind the ropes.', 'Hey {name}. The boats are in, ask me anything.'],
    topics: [
      { q: 'What is a co-op?', a: [
        'A co-op is a business owned by the people who use it. We are licensed commercial fishers, and we land our catch at the co-op. It is weighed and sold on from there.',
        'Boats work out of Wollongong Harbour all year. After the co-op the fish travel along a chain: the market, then a shop or restaurant, then the customer. Some NSW fish are sold at the Sydney Fish Market auction.',
      ] },
      { q: 'Why can I not sell my catch?', a: [
        'Because you are a recreational fisher. In NSW, recreational fishers cannot sell their catch, ever. Your fish are for your own feed.',
        'Licensed commercial fishers can sell, through a co-op or a market. But we have a licence, quotas, closures and rules about our nets and bycatch. It is a job with a lot of rules, not a way to get rich quick.',
      ] },
      { q: 'What kinds of nets are there?', a: [
        'A trawl net is a cone towed along or just above the seabed, and the fish end up in the bag. A gill net is a wall of net that hangs in the water and stays in one place, and fish are caught by the gills. A seine net is drawn round a whole school and closed.',
        'A handline is the opposite: one fisher, a line and a few hooks. Very selective, hardly any bycatch. Snapper and kingfish are caught that way.',
      ] },
      { q: 'What is mesh size for?', a: [
        'Mesh size is the distance between opposite knots when the net is pulled tight. The right mesh lets young fish escape, so they can grow and breed. Too small and you catch fish you do not want. Too big and you lose the fish you are after.',
      ] },
      { q: 'What are licences, quotas and closures?', a: [
        'A licence is permission to fish. A quota is a limit on how much you can catch in a year. A closure is an area or a season where there is no fishing at all. Size limits apply too.',
        'Inshore waters, like estuaries, beaches and the near ocean, are managed by NSW DPIRD. Further offshore, from about 3 nautical miles out, it is the Australian Fisheries Management Authority.',
      ] },
      { q: 'What is bycatch?', a: [
        'Bycatch is everything the net catches that you were not fishing for. In NSW, every ocean and estuary prawn trawl net has to have a bycatch reduction device, a BRD, that lets small animals escape.',
        'In some tropical prawn trawls there is also a TED, a turtle excluder device: a grid with an escape hole that keeps turtles out of the net.',
      ] },
      { q: 'Do boats fish Lake Illawarra too?', a: [
        'Yes. Lake Illawarra has some commercial fishing in the estuary. That is a different job from ours, and it follows its own rules. Rod and line only for you around the lake entrance, remember.',
      ] },
      { q: 'Could I get a commercial licence one day?', a: [
        'Ha! Maybe. The co-op licence is the last chapter. Come and see me after the club celebration for catching every kind of fish, or after awards night. Then you can look at quotas, nets and bycatch from my side of the deck, and sell a commercial haul at the co-op.',
        'It is the only place anyone can sell fish in this game, and recreational fish never can. For now, keep catching, measuring, and releasing the small ones.',
      ], teaser: 'commercial' },
    ],
    tips: [
      { t: 'The wharf lamps bring plankton, the plankton brings baitfish, and the baitfish bring the squid. Look at the edge of the light pool.', time: ['dusk', 'night'] },
      { t: 'Yakka sit around the pylons and make great live bait. They have no size limit, but there is a bag of 50.' },
      { t: 'Fish are fussy about tide too. On a falling tide the bream come out from under the wharf.', tide: ['falling', 'low'] },
      { t: 'Squid and cuttlefish count together: the bag limit is 20 in total. Count both.' },
    ],
    gossip: [
      { species: 'squid', t: 'Squid have been coming up into the lamp light at Belmore Basin wharf at dusk and after dark. A squid jig, a slow lift, and soft hands.', time: ['dusk', 'night'] },
      { species: 'yakka', t: 'Yakka are schooling around the pylons under the Belmore wharf at dusk, mostly in summer and autumn. A small hook and a bit of prawn.', time: ['dusk', 'night'] },
      { species: 'slimymackerel', t: 'Slimy mackerel have been running along the wharf and the breakwall at dusk and night, mostly in winter and spring. Look for the wavy lines on their backs.', time: ['dusk', 'night'] },
      { species: 'cuttlefish', t: 'Cuttlefish creep over the sand in the basin at night. They like the weedy edge of the breakwall rocks, and they take a squid jig too.', time: ['night', 'dusk'] },
    ],
    trades: [
      { id: 'nell-squid', kind: 'show', title: 'Name a squid at the wharf', need: { type: 'identified', id: 'squid' }, reward: 'hat-coop',
        ask: 'Squid are a mollusc, not a fish. Land one on a squid jig at dusk or night under the wharf lamps, then solve the key so it has its name in your Fish Guide. I will give you my co-op beanie.',
        done: 'A squid, named with the key! You saw the arms and the two long tentacles. Here, the beanie is yours.' },
      { id: 'nell-commercial', kind: 'quiz', title: 'Commercial fishing quiz', quiz: [24, 26, 30], reward: 'hat-oilskin',
        ask: 'Three questions from my side of the boat: nets, bycatch and quotas. Get them right and the oilskin hat is yours. Wrong, and we try again tomorrow.',
        done: 'Not a net out of place. That is the way a commercial fisher thinks. Here, the oilskin hat. Wear it into a southerly.' },
    ],
    react: {
      illegal: { undersize: "That one's undersize, {name}. Put it back, it needs to breed first.", oversize: 'Over the slot, {name}. Let the big breeder go.', bag: 'That is your bag for that one, {name}. Squid and cuttlefish count together, remember.', possession: 'Careful, {name}. Possession limits count the freezer too.', protected: "That's a protected one, {name}. Back in, wet hands." },
      cheer: ['What a catch, {name}!', 'Now that is a beauty, {name}.'],
      greet: ["G'day, {name}.", 'Hello, {name}!'],
    },
    warn: {
      swell: "Whoa, {name}! The swell is {swell} m and it is washing right over the breakwall. Get off the rocks, now. Fish the wharf or the basin instead.",
      ignored: "{name}, I said to get off the breakwall! A wave can sweep you straight into the harbour. Walk back to the quay, please.",
    },
  },

  officer: {
    name: 'Fisheries Officer', role: 'NSW DPIRD Fisheries', where: 'patrolling the shore',
    look: { skin: 0xc58c5e, hairStyle: 'short', hair: 0x2a2020, hatStyle: 'cap', hat: 0x2f5496, sunnies: 'none', pattern: 'plain', shirt: 0x5fb3d6, shorts: 0x2f5496 },
    props: ['clipboard'],
    sites: {
      seagrass: {
        dawn: { act: 'walking', path: ['patrolA', 'patrolB'] }, day: { act: 'walking', path: ['patrolB', 'patrolA'] },
        dusk: { act: 'walking', path: ['patrolA', 'patrolB'] }, night: { act: 'away' },
      },
      rocky: {
        dawn: { act: 'walking', path: ['patrolA', 'patrolB'] }, day: { act: 'walking', path: ['patrolB', 'patrolA'] },
        dusk: { act: 'walking', path: ['patrolA', 'patrolB'] }, night: { act: 'away' },
      },
    },
    intro: [
      "G'day! I'm a Fisheries Officer. You will see me along the shore. I check that people follow the rules, and I help explain why they exist.",
    ],
    greet: ["G'day, {name}.", 'Hello again, {name}. Fishing legally?', 'Morning, {name}.'],
    topics: [
      { q: 'Why do the rules exist?', a: [
        'A minimum size lets a fish breed before it is kept. A slot limit protects the big breeders. A bag limit leaves fish for everyone. A possession limit stops anyone beating the bag limit by stocking the freezer.',
        'Protected species are too vulnerable to take. They have to go back at once.',
      ] },
      { q: 'Where do I check the limits?', a: [
        'FishSmart is a free app with every limit. The limits can change, so check before you fish. And if you see illegal fishing, report it to Fishers Watch on 1800 043 536.',
      ] },
    ],
    tips: [
      { t: 'Measure from the snout, mouth closed, to the tip of the tail. One centimetre under is still undersize.' },
      { t: 'I may check your esky on the way home. A clean esky keeps your Steward rating up.' },
      { t: 'Possession limits count the fridge and freezer too. Do not stock up.' },
    ],
    gossip: [],
    trades: [],
    react: {
      illegal: { undersize: "That one's undersize, {name}. I will be checking your esky.", oversize: 'That is over the slot, {name}. I will be checking your esky.', bag: 'You are over the bag limit, {name}. I will be checking your esky.', possession: 'Over the possession limit, {name}. I will be checking your esky.', protected: 'That is a protected species, {name}! Release it immediately.' },
      cheer: ['Good legal fish, {name}.', 'Well measured, {name}.'],
      greet: ["G'day, {name}.", 'Morning, {name}.'],
    },
  },
};

export const NPC_ORDER = ['mitra', 'tam', 'priya', 'jo', 'mika', 'sione', 'bev', 'fatima', 'nell', 'officer'];
export const NPC_LIST = NPC_ORDER.map(id => ({ id, ...NPCS[id] }));
/** Lines by kind when an NPC has no line of its own. */
export const REACT_FALLBACK = {
  illegal: { undersize: "Hey, that one's undersize, mate.", oversize: 'That one is over the slot. Let it go.', bag: 'That is over your bag limit.', possession: 'That is over your possession limit.', protected: 'That one is protected. Release it!' },
  cheer: ['Great catch, {name}!'],
  greet: ['Hello, {name}!'],
};
