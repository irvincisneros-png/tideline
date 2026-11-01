// The commercial post-game: Nell's "Co-op licence". Pure data (no DOM), tagged with the content dataset section each fact comes from.
//
// WHAT IS TAUGHT (dataset E2, worksheets 2.2.2 / 2.2.3 / 2.2.5 / 2.2.6 / 2.2.7):
//   gear types and how each one works, mesh size, bycatch reduction devices (BRD, compulsory in NSW ocean and estuary prawn trawl nets) and TEDs,
//   licences, quotas (a limit per year) and closures, who manages the fishery, stock status (the six SAFS statuses) and the sustainable swaps (B1).
// WHAT IS A GAME MODEL (labelled as such on screen): the numbers in the net simulation, the prices and the quota sizes. The worksheets give levels
//   (seabed High / Low, bycatch Low / Medium-High / High), not percentages or prices, so those are invented to make the lesson playable.
// NOT TAUGHT: quota trading schemes are not in the dataset, so the game says "quota: a limit per year" and nothing more.
// GoodFish ratings are NOT published (dataset: weak source, vary by state); the game points students to the GoodFish app instead.

export const COOP = {
  name: "Belmore Basin Fishers' Co-op",
  money: { name: 'Co-op credits', short: 'co-op credits', icon: '🏦' },
  note: 'Co-op credits are game money for the commercial chapter only. They are not Club credits, and they cannot buy anything in Mitra\'s shop.',
  gameNumbers: 'Game numbers: the worksheets give levels (Low, Medium, High), not percentages or prices, so the percentages, prices and quotas here are made up to make the lesson playable.',
  quotaDays: 7,          // a "quota year" lasts this many in-game days (heading home ends a day)
  haulsPerDay: 3,        // hauls per in-game day
};

/** Fish "cards" for the mesh game (dataset E3: stretched mesh vs fish card widths 10, 25, 40 and 70 mm). */
export const GROUPS = {
  small: { id: 'small', name: 'Small fish', width: 10, icon: '🐟', note: 'sardine-sized' },
  young: { id: 'young', name: 'Young fish', width: 25, icon: '🐠', note: 'too young to have bred' },
  adult: { id: 'adult', name: 'Adult fish', width: 40, icon: '🐡', note: 'the size that is good to land' },
  big: { id: 'big', name: 'Big animals', width: 70, icon: '🦈', note: 'rays and sharks' },
  protected: { id: 'protected', name: 'Turtles and seabirds', width: 70, icon: '🐢', note: 'protected animals' },
};

/** What is in the water at each fishing ground, per haul (a game sample, not a real survey). `target` is the group you want to land. */
export const SCENARIOS = {
  shelf: {
    id: 'shelf', name: 'Shelf fish', blurb: 'Adult fish on the shelf, with their young swimming among them.', target: 'adult', names: {},
    water: { small: 40, young: 30, adult: 60, big: 10, protected: 4 },
  },
  sardine: {
    id: 'sardine', name: 'Sardine school', blurb: 'A big school of sardines near the surface, with a few other animals mixed in.', target: 'small',
    names: { small: 'Sardines', young: 'Other small fish', adult: 'Other fish' },
    water: { small: 140, young: 5, adult: 5, big: 5, protected: 1 },
  },
};

/**
 * The gears (dataset E2 "Net differences", "Trawl", "Purse seine", "Longline", "Trap (pot)", "Handline"; worksheets 2.2.2, 2.2.3, 2.2.7).
 *   seabed / bycatch: the worksheet's own words (null = the worksheet does not rate it).
 *   kind 'net': a net with a mesh (`catch` is how many of the fish in its path it sweeps up, then the mesh decides what stays).
 *   kind 'hook' or 'trap': no mesh; `pick` is the share of each group that takes the hook or goes in the trap (game numbers).
 */
export const GEARS = {
  trawl: {
    id: 'trawl', name: 'Trawl net', icon: '🕸', kind: 'net', sweep: 0.8, cost: 30, brd: true, ted: true,
    seabed: 'High', bycatch: 'High',
    how: 'A cone-shaped net towed along or just above the seabed. The fish end up in the bag at the end. It is efficient, but it brings bycatch and disturbs the seabed.',
    src: 'worksheets 2.2.2, 2.2.3, 2.2.7',
  },
  purseseine: {
    id: 'purseseine', name: 'Purse seine', icon: '⭕', kind: 'net', sweep: 0.9, cost: 24, brd: false, ted: false,
    groupMul: { big: 0.5, protected: 0.25 },
    seabed: null, bycatch: 'Little, if the school is one species',
    how: 'A net wrapped round a whole school and pulled shut at the bottom, like a purse. It catches a lot in one go, with little bycatch if the school is one species, but it can overfish.',
    src: 'worksheets 2.2.2, 2.2.3',
  },
  gillnet: {
    id: 'gillnet', name: 'Gill net', icon: '▦', kind: 'net', sweep: 0.55, cost: 14, brd: false, ted: false, gill: true,
    seabed: null, bycatch: null,
    how: 'A wall of net that hangs in the water and STAYS in place. Fish swim into it and are caught by the gills, so only fish of about the right size are held.',
    src: 'worksheet 2.2.3',
  },
  longline: {
    id: 'longline', name: 'Longline', icon: '🪝', kind: 'hook', cost: 20, pick: { small: 0, young: 0.05, adult: 0.45, big: 0.35, protected: 0.2 },
    seabed: 'Low', bycatch: 'Medium to High',
    how: 'A very long line with many baited hooks (tuna and swordfish). The hooks can also catch seabirds, turtles and sharks.',
    src: 'worksheets 2.2.2, 2.2.7',
  },
  trap: {
    id: 'trap', name: 'Trap (pot)', icon: '🧺', kind: 'trap', cost: 12, pick: { small: 0, young: 0.08, adult: 0.3, big: 0.02, protected: 0 }, releasedAlive: true,
    seabed: 'Low to Medium', bycatch: 'Low',
    how: 'A baited cage. Animals go in and cannot get out (rock lobster, crabs). The animals you do not want can be released alive, but pots can be lost.',
    src: 'worksheets 2.2.2, 2.2.7',
  },
  handline: {
    id: 'handline', name: 'Handline', icon: '🎣', kind: 'hook', cost: 6, pick: { small: 0, young: 0.05, adult: 0.35, big: 0.03, protected: 0 },
    seabed: 'Low', bycatch: 'Low',
    how: 'One fisher with a line and a few hooks (snapper, kingfish). Very selective: you can choose what to keep. You land fewer fish, with very little bycatch.',
    src: 'worksheets 2.2.2, 2.2.7',
  },
};
export const GEAR_ORDER = ['handline', 'trap', 'longline', 'gillnet', 'purseseine', 'trawl'];
/** Seabed disturbance in the sim, from the worksheet levels. */
export const SEABED_SCORE = { Low: 1, 'Low to Medium': 2, High: 5 };
export const BRD_INFO = {
  name: 'Bycatch reduction device (BRD)',
  text: 'A BRD lets unwanted and small animals escape from the net. It is compulsory in all ocean and estuary prawn trawl nets in NSW.',
  src: 'worksheet 2.2.7',
  escape: 0.6,    // game number: share of young, small and big non-target animals that slip out
  targetLoss: 0.05,
};
export const TED_INFO = {
  name: 'Turtle excluder device (TED)',
  text: 'A grid with an escape hole that stops turtles getting into the net. It is used in some tropical prawn trawl nets.',
  src: 'worksheet 2.2.7',
  bigEscape: 0.85,
};
export const MESH_TEXT = {
  what: 'Mesh size is the distance between opposite knots when the mesh is pulled tight (the stretched mesh). To test a fish, hold it against the relaxed, open diamond: if it cannot pass through, the net keeps it.',
  right: 'The right mesh lets young fish escape so they can grow and breed. Too small and you catch small fish you do not want. Too big and you lose the fish you are after. The smallest mesh is for sardines.',
  src: 'worksheet 2.2.3',
  gapShare: 0.5,  // game simplification: the open gap of the diamond is half the stretched measure
};

/** What a good haul looks like, so the lab has a goal (game targets). */
export const LAB_GOALS = {
  shelf: { target: 20, youngMax: 3, protectedMax: 0, bycatchMax: 0.15 },
  sardine: { target: 60, youngMax: 6, protectedMax: 0, bycatchMax: 0.15 },
};

/**
 * What the co-op will land. status is the SAFS status (dataset A2; the game's own species table for the ones that are in the game).
 * base = game price per fish. `swap` = the dataset B1 sustainable swap for an under-pressure species.
 */
export const MARKET = [
  { id: 'snapper', base: 8, scenario: 'shelf' },
  { id: 'kingfish', base: 10, scenario: 'shelf' },
  { id: 'seamullet', base: 3, scenario: 'shelf' },
  { id: 'australiansalmon', base: 3, scenario: 'shelf' },
  { id: 'mulloway', base: 12, scenario: 'shelf' },
  { id: 'jackassmorwong', base: 6, scenario: 'shelf' },
  { id: 'sardine', base: 1, scenario: 'sardine', name: 'Australian sardine', status: 'undefined', statusNote: 'Used as the purse seine example in the worksheets. Its stock status is not in the game\'s data: look it up in the national stock report (SAFS).' },
];

/** What a stock status means for the quota and the price (game numbers; the six statuses are the worksheet's, dataset E2). */
export const STATUS = {
  sustainable: { label: 'Sustainable', quota: 40, price: 1.2, word: 'not being harmed', tone: 'good', buyers: 'Buyers like it: a premium.' },
  recovering: { label: 'Recovering', quota: 8, price: 0.9, word: 'low but coming back', tone: 'warn', buyers: 'A small quota while the stock rebuilds.' },
  depleting: { label: 'Depleting', quota: 6, price: 0.6, word: 'OK now, but fishing pressure is too high', tone: 'warn', buyers: 'A small quota and a low price.' },
  depleted: { label: 'Depleted', quota: 0, price: 0.4, word: 'low, and fishing may stop it recovering', tone: 'bad', buyers: 'Closed: the co-op will not land it.' },
  undefined: { label: 'Undefined', quota: 15, price: 1, word: 'not enough information', tone: 'neutral', buyers: 'A cautious quota while the science catches up.' },
  negligible: { label: 'Negligible', quota: 40, price: 1, word: 'little fishing', tone: 'good', buyers: 'Little fishing, so no special price.' },
};
export const SAFS_NUMBERS = {
  stocks: 503, species: 155, sustainable: 316, recovering: 16, depleting: 13, depleted: 45, undefined: 74, negligible: 39, assessable: 390,
  text: 'The 2024 national report (SAFS) assessed 503 stocks of 155 species: 316 sustainable, 16 recovering, 13 depleting, 45 depleted, 74 undefined and 39 negligible. 316 of 503 is about 63% sustainable. Of the 390 stocks that can be assessed, 85% are sustainable or recovering.',
  src: 'worksheet 2.2.6; SAFS 6th edition',
};
export const GOODFISH_NOTE = 'GoodFish (the Australian Marine Conservation Society guide) rates seafood by state and the ratings change over time, so this game does not copy its colours. Open the GoodFish app or goodfish.org.au to check a fish before you buy it.';

/** On-board technology (dataset E2): what each one does, and what it does in the game (a price, a saving or a better haul). */
export const UPGRADES = [
  { id: 'sonar', name: 'Sonar', icon: '📡', price: 60, text: 'Sonar finds schools of fish under the boat.', fx: 'Your hauls land 30% more of the fish you are after.', src: 'worksheet 2.2.2' },
  { id: 'gps', name: 'GPS', icon: '🛰', price: 50, text: 'GPS gives the boat\'s position, so it can return to good grounds and navigate safely.', fx: 'Hauls cost 25% less (less time searching, less fuel).', src: 'worksheets 2.2.2, 2.1.13' },
  { id: 'fridge', name: 'Refrigeration', icon: '🧊', price: 70, text: 'Refrigeration keeps the catch fresh until it reaches the co-op.', fx: 'Fresh fish sell for 20% more.', src: 'worksheet 2.2.2' },
  { id: 'autopilot', name: 'Autopilot', icon: '🧭', price: 40, text: 'The autopilot steers the boat on its own while the crew works.', fx: 'Hauls cost 15% less.', src: 'worksheet 2.2.2' },
];
export const UPGRADE_FX = { sonar: { target: 1.3 }, gps: { cost: 0.75 }, fridge: { price: 1.2 }, autopilot: { cost: 0.85 } };

/** The recreational / commercial table the co-op teaches (dataset C and E2). */
export const REC_VS_COM = [
  ['Who', 'Anyone who pays the recreational fishing fee (under 18s pay nothing)', 'A licensed commercial fisher'],
  ['Can they sell fish?', 'No. Never. Your catch is for your own feed.', 'Yes, through a co-op or a market.'],
  ['How are they limited?', 'Size limits and a daily bag limit (and a possession limit)', 'A licence, a quota (a limit per year), closures and size limits'],
  ['What gear?', 'A rod and line (with bait and lures)', 'Nets, lines, traps: each with rules about mesh size, bycatch devices and the seabed'],
  ['Who manages it?', 'NSW DPIRD', 'NSW DPIRD inshore; the Australian Fisheries Management Authority further offshore (from about 3 nautical miles)'],
];
export const REC_VS_COM_SRC = 'dataset C5, C6, C9 and E2 (worksheets 2.1.14, 2.2.5)';

/** Why you cannot sell recreational fish even with a co-op licence. */
export const NO_SELL_REC = {
  title: 'Recreational fish are never for sale',
  text: 'Your esky holds fish caught on a rod under the recreational fishing rules. Even with a co-op licence you cannot sell them: a commercial licence covers commercial fishing, not your weekend catch. To sell, you land a commercial haul (the Sell tab).',
};
