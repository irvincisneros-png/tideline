// Rewards the coast's people give you: gear that unlocks rigs and baits in the tackle box, tools, hats and Sea Country story cards.
// Pure data (no DOM, no three.js) so tests can import it. Items are kept in progress.inventory.have = { itemId: timestamp }.
//
// Starting kit: paternoster, running sinker and unweighted rigs; prawn and beach worm bait. Everything else is earned from a trade with the
// person named in `ask` (the tackle box shows "Ask Old Tam on the jetty" on a locked rig) and, in a later phase, bought at the tackle shop.

export const START_RIGS = ['paternoster', 'runningsinker', 'unweighted'];
export const START_BAITS = ['prawn', 'beachworm'];

/** kind: rig | bait | tool | hat | card. `unlocks` opens a rig or bait in the tackle box. `hat` is a look for the angler (hatStyle + a PALETTES.hat colour). */
export const ITEMS = {
  'rig-float': { kind: 'rig', name: 'Float rig (bobby cork)', unlocks: { rig: 'float' }, blurb: 'A float holds the bait at one depth and shows every nibble. Good for luderick, garfish and mullet.', from: 'tam', ask: 'Old Tam on the jetty' },
  'rig-softplastic': { kind: 'rig', name: 'Soft plastic rig', unlocks: { rig: 'softplastic' }, blurb: 'A rubber-tailed lure on a jig head. Dusky flathead cannot resist one worked along the bottom.', from: 'mika', ask: 'Mika, the kid with the rod' },
  'rig-metalslug': { kind: 'rig', name: 'Metal slug', unlocks: { rig: 'metalslug' }, blurb: 'A heavy shiny lure you cast a long way and wind in fast. Salmon, tailor and bonito chase it.', from: 'bev', ask: 'Bev at the club board on the beach path' },
  'rig-squidjig': { kind: 'rig', name: 'Squid jig', unlocks: { rig: 'squidjig' }, blurb: 'A lure, not bait: a plastic jig that looks like a prawn, with a ring of spikes and no barbed hook. Squid grab it at dusk and night near the jetty.', from: 'mitra', ask: 'Mitra at the bait shop' },
  'bait-nipper': { kind: 'bait', name: 'Nipper pump', unlocks: { bait: 'nipper' }, blurb: 'Pump nippers (yabbies) from the sand flats yourself: limit 100. Whiting and bream love them.', from: 'mitra', ask: 'Mitra at the bait shop' },
  'bait-pilchard': { kind: 'bait', name: 'Frozen pilchards', unlocks: { bait: 'pilchard' }, blurb: 'Keep them on ice in a sealed tub, out of the sun. Tailor, salmon and snapper take pilchard.', from: 'mitra', ask: 'Mitra at the bait shop' },
  'bait-squidstrip': { kind: 'bait', name: 'Squid strips', unlocks: { bait: 'squidstrip' }, blurb: 'Tough strips that stay on the hook. From the fishing club freezer.', from: 'bev', ask: 'Bev at the club board on the beach path' },
  'bait-greenweed': { kind: 'bait', name: 'Green weed', unlocks: { bait: 'greenweed' }, blurb: 'Fresh weed for fish that eat weed: luderick, rock blackfish and sea mullet.', from: 'tam', ask: 'Old Tam on the jetty' },
  'tool-tagkit': { kind: 'tool', name: 'Tag kit', blurb: 'Tag a fish before you release it (Release step). Tag-and-release records show scientists how far fish travel and how fast they grow.', from: 'priya', ask: 'Dr Priya at the dinghy landing' },
  'tool-releaseweight': { kind: 'tool', name: 'Release weight', blurb: 'Clips on to a deep-water fish so it sinks back to depth, instead of floating with a swollen gas bladder (barotrauma).', from: 'priya', ask: 'Dr Priya at the dinghy landing' },
  'tool-lurecolours': { kind: 'tool', name: 'Lure colours', blurb: 'A pack of recycled lure tails in different colours. Choose one in the tackle box when you fish a lure.', from: 'fatima', ask: 'Fatima, the clean-up volunteer on Bellambi beach' },
  'hat-lifeguard': { kind: 'hat', name: 'Lifeguard bucket hat', hat: { hatStyle: 'bucket', hat: 0xf0715a }, blurb: 'Coral red, like the patrol flags.', from: 'sione', ask: 'Sione at the lifeguard tower' },
  'hat-tam': { kind: 'hat', name: "Tam's straw hat", hat: { hatStyle: 'straw', hat: 0xe9d9a6 }, blurb: 'Fifty summers on the jetty.', from: 'tam', ask: 'Old Tam on the jetty' },
  'hat-research': { kind: 'hat', name: 'Research cap', hat: { hatStyle: 'cap', hat: 0x2f5496 }, blurb: 'A navy cap for citizen scientists.', from: 'priya', ask: 'Dr Priya at the dinghy landing' },
  'hat-mika': { kind: 'hat', name: "Mika's beanie", hat: { hatStyle: 'beanie', hat: 0xf4c84a }, blurb: 'Sunny yellow, a bit chewed.', from: 'mika', ask: 'Mika, the kid with the rod' },
  'hat-club': { kind: 'hat', name: 'Fishing club cap', hat: { hatStyle: 'cap', hat: 0x35b3ad }, blurb: 'Teal, with the club badge.', from: 'bev', ask: 'Bev at the club board on the beach path' },
  'hat-coop': { kind: 'hat', name: 'Co-op beanie', hat: { hatStyle: 'beanie', hat: 0xf0715a }, blurb: 'Coral red, worn on the trawlers out of Belmore Basin.', from: 'nell', ask: 'Nell at the co-op, Belmore Basin' },
  'hat-oilskin': { kind: 'hat', name: 'Oilskin hat', hat: { hatStyle: 'wide', hat: 0xf4c84a }, blurb: 'A bright yellow sou\'wester for wet days on the water.', from: 'nell', ask: 'Nell at the co-op, Belmore Basin' },
  'hat-greenteam': { kind: 'hat', name: 'Green Team sun hat', hat: { hatStyle: 'wide', hat: 0x8fbf8a }, blurb: 'A sage wide-brim for beach clean-ups.', from: 'fatima', ask: 'Fatima, the clean-up volunteer on Bellambi beach' },
  // Mission cosmetics (content/missions.js): one hat per chapter, given by the mission, never for credits and never a functional item.
  // `mission: true` marks them (they are not the reward of any trade, and `from` names the mission's giver, who may not be one of the NPCs).
  'hat-measuring': { kind: 'hat', mission: true, name: 'Measuring cap', hat: { hatStyle: 'cap', hat: 0xfaf6ea }, blurb: 'A crisp white cap for careful measurers.', from: 'mrcisneros', ask: 'Finish the mission "First lines"' },
  'hat-tackle': { kind: 'hat', mission: true, name: 'Tackle bucket hat', hat: { hatStyle: 'bucket', hat: 0x35b3ad }, blurb: 'Teal, with a hook-safe patch on the brim.', from: 'mrwilson', ask: 'Finish the mission "Know your tackle"' },
  'hat-fairgo': { kind: 'hat', mission: true, name: 'Fair-go straw hat', hat: { hatStyle: 'straw', hat: 0x8fbf8a }, blurb: 'Sage green, for people who know the rules and keep them.', from: 'mrcisneros', ask: 'Finish the mission "The rules"' },
  'hat-structure': { kind: 'hat', mission: true, name: 'Snag-free beanie', hat: { hatStyle: 'beanie', hat: 0x4a5560 }, blurb: 'Charcoal grey, warm on early starts.', from: 'mrwilson', ask: 'Finish the mission "Structure"' },
  'hat-guide': { kind: 'hat', mission: true, name: 'Fish Guide wide-brim', hat: { hatStyle: 'wide', hat: 0x2f5496 }, blurb: 'Navy blue, for someone who has named five fish.', from: 'mrcisneros', ask: 'Finish the mission "The Guide"' },
  'hat-rocksafe': { kind: 'hat', mission: true, name: 'Rock-safe bucket hat', hat: { hatStyle: 'bucket', hat: 0xf4c84a }, blurb: 'Sunny yellow, easy to spot from the tower.', from: 'sione', ask: 'Finish the mission "Rock safe"' },
  'hat-cleanshore': { kind: 'hat', mission: true, name: 'Clean shore cap', hat: { hatStyle: 'cap', hat: 0x8fbf8a }, blurb: 'Sage green, for people who leave a beach cleaner.', from: 'fatima', ask: 'Finish the mission "A cleaner shore"' },
  'hat-wharf': { kind: 'hat', mission: true, name: 'Wharf beanie', hat: { hatStyle: 'beanie', hat: 0x2f5496 }, blurb: 'Navy blue, for nights under the wharf lamps.', from: 'nell', ask: 'Finish the mission "Lights on the wharf"' },
  'hat-citizen': { kind: 'hat', mission: true, name: 'Citizen scientist hat', hat: { hatStyle: 'straw', hat: 0xfaf6ea }, blurb: 'Pale straw, for people who record things properly.', from: 'priya', ask: 'Finish the mission "Citizen science"' },
  'hat-tagrelease': { kind: 'hat', mission: true, name: 'Tag-and-release wide-brim', hat: { hatStyle: 'wide', hat: 0xf0715a }, blurb: 'Coral red, for careful hands.', from: 'priya', ask: 'Finish the mission "Tag and release"' },
};

/** Sea Country story cards (the guide's "Sea Country" tab). Every sentence comes from a dataset section D row tagged [worksheet] and is
 *  written as living knowledge, in the worksheets' words. Nothing tagged [unverified] is used (no turban-shell hooks, no totem species,
 *  no local practices beyond what the worksheet says local sources say). REVIEW: the school's Aboriginal Education Officer / local AECG
 *  must check these before classroom release (see README). */
export const CARDS = {
  'sc-methods': {
    title: 'Five ways of fishing', src: 'worksheet 2.1.1',
    text: 'Aboriginal and Torres Strait Islander Peoples have fished with many methods, and still do. The worksheet names five: a fish trap (stones, sticks or woven material shaped so fish swim in and cannot easily get out), a spear (a pointed tool thrown or thrust), a bark canoe, a shell hook (a hook made from shell, tied to a handline) and a weir (a wall or fence across a stream or channel to hold or guide fish).',
  },
  'sc-brewarrina': {
    title: "Baiame's Ngunnhu at Brewarrina", src: 'worksheets 2.1.1, 2.2.1, 1.3.1',
    text: "On the Barwon River in north-west NSW, on Ngemba Country, stone walls and pens make the Brewarrina fish traps (Baiame's Ngunnhu). Several Aboriginal nations share them. They are on the National Heritage List (2005), and the custodians say they are tens of thousands of years old. The stories link the traps to the creator Baiame. Fish were held alive until they were needed.",
  },
  'sc-lake': {
    title: 'Lake Illawarra is Dharawal Country', src: 'worksheet 1.3.1',
    text: 'The worksheet says local sources tell of women fishing from small bark canoes with hand lines, of nets made from bark, and of women gathering shore plants such as warrigal greens, pigface and sea lettuce. Shell middens around the lake show that shellfish have been eaten here for a very long time. These are living stories: ask a Knowledge Holder through your school\'s Aboriginal Education Officer or local AECG to yarn with your class.',
  },
  'sc-seasons': {
    title: 'Reading the seasons', src: 'worksheet 5.1.1',
    text: "The D'harawal calendar reads the seasons from plants, animals and weather, not from months. For example, when the marrai'uo (Gossamer Wattle) flowers in Wiritjiribin (around August), it tells people that fish are swimming in the rivers. The calendar covers Port Jackson's south shores to the Shoalhaven River's north shores, so it includes Woonona. The calendar is the Bureau of Meteorology's, shared with permission, so read it there in full: bom.gov.au, Indigenous Weather Knowledge, D'harawal calendar.",
  },
  'sc-country': {
    title: 'Caring for Country and Sea Country', src: 'worksheets 1.3.1, 1.3.2, 5.1.1',
    text: 'Country includes the water, and people have a responsibility to care for it. The worksheets describe the principles: take only what you need, follow the seasons, look after breeding places, and limit who takes, how much and when. Using Aboriginal knowledge and Western science together is called two-way science.',
  },
  'sc-rangers': {
    title: 'Sea Rangers', src: 'worksheet 1.3.2',
    text: 'Ranger work includes watching over animals and sites and removing pests. The worksheet gives two examples: the li-Anthawirriyarra Sea Rangers, and ranger work on the Worimi Conservation Lands.',
  },
};
export const CARD_ORDER = ['sc-methods', 'sc-lake', 'sc-brewarrina', 'sc-seasons', 'sc-country', 'sc-rangers'];
