// The tackle shop and the economy numbers. Pure data (no DOM, no three.js) so the tests and the NPC dialogue can import it.
//
// NSW recreational fishers may NOT sell their catch (taught by Mitra). Club credits come only from the sources in RATES:
//   logbook records (citizen science), tag-and-release, club comps, missions, and litter pulled out of the water. There is no price on a fish anywhere.
//
// Shop items: { id, cat, name, price, tier?, blurb, why?, stats (shown as chips), req? (a request `need`, see npc/requests.js progressOf), ... }
//   cat rod | line | bait | lure | conservation | style
//   rods and lines are `gear` (equip one of each); `starter` ones are owned from the start.
//   `grants` = an inventory item id (content/items.js) that the purchase gives, so the rest of the game (the release step, the tackle box) sees it.
//   bait packs add `qty` to progress.shop.bait[bait].

export const COIN = { name: 'Club credits', short: 'credits', icon: '🪙' };

/** Every number the economy pays. Quoted by Mitra's lesson, the "Earn credits" tab and the tests. */
export const RATES = {
  recordBase: 6,          // a complete, accurate logbook record: species identified + measured within 1 cm + the right keep-or-release call
  firstSpecies: 15,       // bonus: the first record of a species
  newCombo: 4,            // bonus: a record of a species at a new spot / tide / time-of-day combination
  speciesDailyCap: 3,     // records of ONE species that pay per in-game day (scientists want variety, not 30 of the same fish)
  tagPay: 10,             // tag a legal-size fish with Dr Priya's kit and release it quickly (wet hands, 10 s or less out of the water)
  tagDailyCap: 5,         // tag payments per in-game day
  recapture: 25,          // a "tag recapture" letter on a later day
  recaptureChance: 0.4,   // per outing, when a tagged fish from an earlier day is still out there
  litterPiece: 2,         // per piece of litter on Fatima's clean-up tally
  litterDailyCap: 10,     // pieces paid per in-game day
  quizPerQuestion: 6,     // missions: a quiz pays this per question ...
  showBase: 15,           // ... and a "show me" job pays this (harder ones pay a little more, see missionCoins)
  compPrizes: [40, 25, 15, 5], // club comp: 1st, 2nd, 3rd, then everyone else who competed
  startGrant: 20,         // a brand-new save
  migrationGrant: 40,     // an older save (v2) gets a little more so its progress is not wasted
};

/** Starting bait stock: bought bait (prawns) and collected bait (beach worms). Everything else comes from the shop or by collecting. */
export const START_BAIT_STOCK = { prawn: 25, beachworm: 15 };
export const BAIT_CAP = 99;

/** Bait you collect yourself: free, but only at the right spot and with the right gear, and inside the DPIRD daily limits (dataset C18). */
export const COLLECT = {
  nipper: { sites: ['seagrass'], item: 'bait-nipper', per: 10, limit: 100, where: 'the sand flats at Lake Illawarra', need: 'a nipper pump', rule: 'Limit 100 nippers a day (DPIRD).' },
  beachworm: { sites: ['rocky'], item: null, per: 5, limit: 20, where: 'the wet sand on Bellambi beach', need: null, rule: 'Limit 20 beach worms a day, whole or part (DPIRD).' },
  greenweed: { sites: ['rocky', 'seagrass'], item: 'bait-greenweed', per: 5, limit: null, where: 'the weedy rocks and piles', need: "Old Tam's green weed tip", rule: 'No daily limit is listed, so take only what you need.' },
};
export const COLLECT_HOLD_MAX = 30;   // no daily limit listed (green weed): the most you hold

/** Fish that bite shyly: a lighter, less visible line gets more bites from them. */
export const SHY_SPECIES = ['yellowfinbream', 'luderick'];

export const SHOP = [
  // ------------------------------------------------------------ rods: a wider catch-bar zone and/or a slower fish
  { id: 'rod-1', cat: 'rod', tier: 1, name: 'Starter rod', price: 0, starter: true, rod: { zoneMul: 1, drainMul: 1, speedMul: 1 },
    blurb: 'The whippy fibreglass rod your uncle lent you. It works, but it is not forgiving.', why: 'Every angler starts somewhere.' },
  { id: 'rod-2', cat: 'rod', tier: 2, name: 'Estuary spin rod', price: 60, req: { type: 'identifiedCount', n: 3 }, rod: { zoneMul: 1.1, drainMul: 0.95, speedMul: 1 },
    blurb: 'A light graphite spin rod with a softer tip: the green zone is 10% bigger.', why: 'You have named three species, so you know what you are fishing for.' },
  { id: 'rod-3', cat: 'rod', tier: 3, name: 'All-rounder 2.4 m', price: 150, req: { type: 'identifiedCount', n: 6 }, rod: { zoneMul: 1.2, drainMul: 0.88, speedMul: 0.95 },
    blurb: 'A longer, smoother rod for beach and rock. The zone is 20% bigger and fish tire you out less.', why: 'Six species Identified: you have fished enough different fish to use it well.' },
  { id: 'rod-4', cat: 'rod', tier: 4, name: 'Club champion graphite', price: 300, req: { type: 'masteredCount', n: 2 }, rod: { zoneMul: 1.3, drainMul: 0.8, speedMul: 0.9 },
    blurb: 'The rod the comp winners use: a 30% bigger zone and fish that bolt about 10% slower.', why: 'Mastery means identified, measured and handled the right way, so this rod goes to anglers who have shown it.' },

  // ------------------------------------------------------------ reels and line: strength vs how shy fish see it
  { id: 'line-std', cat: 'line', tier: 2, name: 'Standard reel, 4 kg mono', price: 0, starter: true, line: { save: 0, turnMul: 1, shy: 1 },
    blurb: 'A balanced reel and nylon line. Not the strongest and not the stealthiest.', why: 'A good all-round choice for most fish.' },
  { id: 'line-light', cat: 'line', tier: 1, name: 'Light reel, 2 kg fluorocarbon', price: 40, req: { type: 'identifiedCount', n: 2 }, line: { save: 0, turnMul: 1.25, shy: 1.3 },
    blurb: 'Thin, nearly invisible line. Shy fish such as bream and luderick bite about 30% more. Risky on a fish that bolts: it is harder to turn, so you must cover a diving fish longer.',
    why: 'Fluorocarbon is hard for a fish to see underwater, so fussy feeders take the bait.' },
  { id: 'line-strong', cat: 'line', tier: 3, name: 'Strong reel, 8 kg braid', price: 90, req: { type: 'identifiedCount', n: 5 }, line: { save: 0.5, turnMul: 0.8, shy: 0.8 },
    blurb: 'Thick, strong line. When a reef fish bolts for the rocks there is a 50% chance the line holds and turns it. But shy fish can see it, so bream and luderick bite about 20% less.',
    why: 'Strong line has fewer break-offs on fish that bolt (snapper, kingfish) or jet (squid), but thick line shows up in clear water.' },

  // ------------------------------------------------------------ bait you buy (collected bait stays free: see COLLECT)
  { id: 'pack-prawn', cat: 'bait', name: 'Frozen prawns x10', price: 8, bait: 'prawn', qty: 10, blurb: 'Local prawns on ice: bream, whiting and flathead all take them.', why: 'Buy local. Imported raw prawns have spread white spot disease, which kills local prawns (worksheet 1.2.2).' },
  { id: 'pack-pilchard', cat: 'bait', name: 'Frozen pilchards x10', price: 10, bait: 'pilchard', qty: 10, grants: 'bait-pilchard', blurb: 'Oily and smelly: tailor, salmon and snapper cannot resist it.', why: 'Keep bait on ice in a sealed tub, out of the sun (worksheet 2.1.10).' },
  { id: 'pack-squid', cat: 'bait', name: 'Squid strips x10', price: 12, bait: 'squidstrip', qty: 10, grants: 'bait-squidstrip', blurb: 'Tough strips that stay on the hook for snapper, mulloway and morwong.', why: 'Brined or tough bait stays on the hook, so fewer wasted casts.' },

  // ------------------------------------------------------------ lures (the squid jig opens the night squid at Belmore Basin; Mitra's lake quiz gives one free)
  { id: 'rig-squidjig', cat: 'lure', name: 'Squid jig', price: 14, grants: 'rig-squidjig', blurb: 'A prawn-shaped jig with a ring of spikes and no barbed hook. Squid and cuttlefish take it at dusk and night.',
    why: 'In NSW a squid jig must have spikes only, no barbed hook (DPIRD, worksheet 2.1.4). The daily bag limit is 20, squid and cuttlefish together.' },

  // ------------------------------------------------------------ conservation gear: it helps the fish, not just you
  { id: 'tool-releaseweight', cat: 'conservation', name: 'Release weight', price: 30, grants: 'tool-releaseweight', blurb: 'Clip it on a deep-water fish and it sinks back to depth.',
    why: 'Fish pulled up from about 10 m or more can suffer barotrauma: their gas bladder swells. A release weight returns them to depth and survival jumps (DPIRD). Also adds a little to Bay Health.' },
  { id: 'tool-landingnet', cat: 'conservation', name: 'Knotless landing net', price: 45, blurb: 'A soft, knotless net keeps the fish in the water while you unhook it, so far fewer fish are dropped.',
    why: 'Handling a fish out of the water strips its slime and risks a drop. A knotless net keeps it wet and cuts the time it spends out of the water by about a third (DPIRD, worksheet 2.1.16).' },
  { id: 'tool-finemat', cat: 'conservation', name: 'Fine measuring mat', price: 55, req: { type: 'identifiedCount', n: 4 }, blurb: 'Half-centimetre marks on the brag mat, so you can line the marker up more finely.',
    why: 'One cm under is still undersize (and fish can shrink a little after harvest), so the closer you read it, the better your decision.' },

  // ------------------------------------------------------------ style (cosmetics: they use the character creator\'s look data)
  { id: 'hat-sunset', cat: 'style', slot: 'hat', name: 'Sunset bucket hat', price: 12, look: { hatStyle: 'bucket', hat: 0xff9a4a }, blurb: 'Warm orange, like a sunset over the lake.' },
  { id: 'hat-seafoam', cat: 'style', slot: 'hat', name: 'Seafoam wide-brim', price: 18, look: { hatStyle: 'wide', hat: 0x9fe3d2 }, blurb: 'A pale green wide-brim for long days on the jetty.' },
  { id: 'hat-harbour', cat: 'style', slot: 'hat', name: 'Harbour beanie', price: 15, look: { hatStyle: 'beanie', hat: 0x1d3a5f }, blurb: 'Deep navy, for cold dawn starts.' },
  { id: 'hat-rose', cat: 'style', slot: 'hat', name: 'Rosella cap', price: 14, look: { hatStyle: 'cap', hat: 0xe24a68 }, blurb: 'Bright rosella red.' },
  { id: 'shirt-sunrise', cat: 'style', slot: 'shirt', name: 'Sunrise stripes', price: 20, look: { shirt: 0xff9a3c, pattern: 'stripes' }, blurb: 'Orange stripes, easy to spot from the beach.' },
  { id: 'shirt-kelp', cat: 'style', slot: 'shirt', name: 'Kelp fishing shirt', price: 25, look: { shirt: 0x4f9d5a, pattern: 'fishing' }, blurb: 'A deep green shirt with big pockets.' },
  { id: 'shirt-tidepool', cat: 'style', slot: 'shirt', name: 'Tidepool flowers', price: 22, look: { shirt: 0x3ab7c9, pattern: 'flowers' }, blurb: 'Aqua with little flowers.' },
  { id: 'rod-gold', cat: 'style', slot: 'rodcol', name: 'Golden rod', price: 30, look: { rod: 0xe6b422 }, blurb: 'A rod colour to match a golden catch.' },
  { id: 'rod-aqua', cat: 'style', slot: 'rodcol', name: 'Aqua rod', price: 18, look: { rod: 0x14c8e8 }, blurb: 'Bright aqua blue.' },
  { id: 'rod-candy', cat: 'style', slot: 'rodcol', name: 'Candy rod', price: 18, look: { rod: 0xff5fa2 }, blurb: 'A cheerful candy pink.' },
];
export const SHOP_BY_ID = Object.fromEntries(SHOP.map(i => [i.id, i]));
export const SHOP_CATS = [
  { id: 'rod', label: 'Rods', icon: '🎣' },
  { id: 'line', label: 'Reels and line', icon: '🧵' },
  { id: 'bait', label: 'Bait', icon: '🦐' },
  { id: 'lure', label: 'Lures', icon: '🦑' },
  { id: 'conservation', label: 'Help the fish', icon: '🌊' },
  { id: 'style', label: 'Style', icon: '🧢' },
  { id: 'earn', label: 'Earn credits', icon: '🪙' },
];
export const CAT_SLOT = { rod: 'rod', line: 'line' };
