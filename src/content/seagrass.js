// TideLine – Lake Illawarra species cards (estuary: sand flats, seagrass, a channel, a mangrove edge and a jetty).
// Data only. Australian English. Habitat and plant cards were adapted from the Moreton Bay seagrass set; the line-caught fish cards
// are built from src/fishing/species.js (so the rules, ID features and stock status match the catch tables) plus a short field note.
// Teacher note: size and bag limits follow DPIRD / worksheet values checked 31 Oct - 1 Nov 2026; check the DPIRD page before class use.
// Lake Illawarra is rod and line only near the entrance (no crab traps, hoop/lift nets or prawn nets).
import { SPECIES_BY_ID } from '../fishing/species.js';

const STOCK_CODE = { sustainable: 'LC', recovering: 'NT', depleting: 'VU', depleted: 'EN', undefined: 'DD' };
/** A card for a line-caught species: the facts that must match the rules come from species.js. */
function fishCard(id, o) {
  const s = SPECIES_BY_ID[id];
  return {
    id, habitat: 'fishing', common: s.name, sci: s.sci, group: o.group ?? 'fish', status: s.statusNote, statusCode: STOCK_CODE[s.status] ?? 'DD',
    size: o.size ?? `Usually ${s.length[0]}–${s.length[1]} cm`, ...o,
    didYouKnow: o.didYouKnow ?? s.fact, spot: o.spot ?? s.idFeature,
    sources: o.sources ?? ['TideLine species data (NSW DPIRD size and bag limits)', 'NSW DPIRD – recreational fishing species guide'],
  };
}

export const species = [
  // ---- Line-caught fish of the Lake
  fishCard('sandwhiting', {
    feeding: 'carnivore', trophic: 'Secondary consumer', depth: 'Sand flats and the edges of seagrass, 0.3–3 m',
    role: 'Digs small worms, nippers and shrimps out of clean sand, and is food for bigger fish and birds.',
    interactions: ['Eats beach worms, nippers (yabbies) and small crustaceans', 'Eaten by flathead, bream and pelicans', 'Moves onto the shallow flats as the tide rises'],
    fieldNotes: 'Sand whiting feed in the shallows on a rising tide in warm months, which is why a light line, a small hook and a nipper or worm work best.',
    threats: 'Loss of sand-flat and seagrass habitat and poor water quality; deep hooking when released.',
  }),
  fishCard('yellowfinbream', {
    feeding: 'omnivore', trophic: 'Secondary consumer', depth: 'Jetty pylons, mangrove roots, seagrass edges and the channel',
    role: 'A hardy, curious all-rounder that crunches crabs and shellfish and nibbles weed and prawns around structure.',
    interactions: ['Eats crabs, shellfish, worms, prawns and weed', 'Shelters around jetty pylons, snags and mangrove roots', 'Eaten by mulloway and larger fish when small'],
    fieldNotes: 'Bream are the classic estuary fish and love structure like jetty posts. Because every jetty gets fished hard, rotating to luderick or sea mullet spreads the pressure.',
    threats: 'Fishing pressure around popular jetties; deep hooking; loss of mangrove and seagrass habitat.',
  }),
  fishCard('duskyflathead', {
    feeding: 'carnivore', trophic: 'Tertiary consumer', depth: 'Sand and mud flats, channel edges and mangrove edges',
    role: 'An ambush predator that lies buried on the bottom and snaps up passing prawns, small fish and crabs.',
    interactions: ['Eats fish, prawns and crabs', 'Camouflaged against sand and mud, so it is hard for predators to see', 'The largest females are the best breeders'],
    fieldNotes: 'Flathead have a slot limit: you may keep a fish between the minimum and maximum length only. Releasing the big ones protects the best breeders.',
    threats: 'Removing too many large breeding females; loss of estuary habitat.',
  }),
  fishCard('seamullet', {
    feeding: 'detritivore', trophic: 'Primary consumer', depth: 'Shallow flats, the channel and around the jetty',
    role: 'Sucks up algae, tiny plants and detritus from the sand and mud, recycling nutrients, and is food for bigger fish and birds.',
    interactions: ['Grazes algae and organic matter from the bottom', 'Eaten by mulloway, tailor, pelicans and dolphins', 'Runs out of estuaries to spawn at sea in autumn and winter'],
    fieldNotes: 'Mullet travel in big schools and are often seen jumping. They have a muscular, gizzard-like stomach for grinding the sand and mud they eat.',
    threats: 'Fishing pressure on spawning runs; poor water quality.',
  }),
  fishCard('luderick', {
    feeding: 'herbivore', trophic: 'Primary consumer', depth: 'Around the jetty, seagrass and weedy rocks, 0.5–3 m',
    role: 'A weed eater that grazes algae from pylons, rocks and seagrass leaves, keeping surfaces clean.',
    interactions: ['Eats green weed (sea lettuce) and other algae', 'Eaten by larger fish', 'Gathers in schools around jetty pylons'],
    fieldNotes: 'Luderick are caught on a float rig with green weed as bait: a good example of matching the bait to what the fish really eats.',
    threats: 'Loss of the weedy habitat they graze; fishing pressure.',
  }),
  fishCard('tailor', {
    feeding: 'carnivore', trophic: 'Tertiary consumer', depth: 'The channel and around the jetty, chasing baitfish',
    role: 'A fast predator that herds schools of small fish towards the surface and the shore.',
    interactions: ['Chases pilchards, garfish and other baitfish', 'Eaten by larger fish and dolphins', 'Has razor-sharp teeth that cut light line'],
    fieldNotes: 'Tailor often arrive at dawn and dusk. Use a stronger leader because of the teeth.',
    threats: 'Fishing pressure on spawning schools.',
  }),
  fishCard('silvertrevally', {
    feeding: 'carnivore', trophic: 'Secondary consumer', depth: 'Channel edges and around the jetty',
    role: 'A schooling fish that picks small crustaceans and worms from the bottom and the water above it.',
    interactions: ['Eats small crustaceans, worms and plankton', 'Eaten by larger predators', 'Often swims in loose schools near structure'],
    fieldNotes: 'Silver trevally are strong fighters for their size. Handle them carefully: poorly designed live wells have been shown to kill many of them.',
    threats: 'Handling stress and poor live-well design.',
  }),
  fishCard('garfish', {
    feeding: 'omnivore', trophic: 'Primary and secondary consumer', depth: 'Near the surface around the jetty and over seagrass',
    role: 'A surface schooling fish that eats seagrass blades, algae and tiny crustaceans, and is food for tailor and birds.',
    interactions: ['Eats seagrass leaves, algae and small animals', 'Eaten by tailor, kingfish and sea birds', 'Skips across the surface when chased'],
    fieldNotes: 'Garfish are caught on a small float with a tiny hook and bread or weed as bait. They have a long lower jaw, like a beak.',
    threats: 'Loss of seagrass beds; fishing pressure.',
  }),
  fishCard('mulloway', {
    feeding: 'carnivore', trophic: 'Tertiary consumer', depth: 'The deeper channel, especially around the jetty',
    role: 'A top estuary predator that eats fish and prawns; its numbers say a lot about the health of the whole system.',
    interactions: ['Eats fish, prawns and squid', 'Is slow to mature, so overfishing hurts it', 'Young mulloway shelter in estuaries before moving to the sea'],
    fieldNotes: 'Mulloway were once depleted in NSW. They are recovering, so keep only a legal fish and think about a sustainable swap.',
    threats: 'Past overfishing; loss of estuary nursery habitat.',
  }),
  fishCard('squid', {
    group: 'invertebrate', feeding: 'carnivore', trophic: 'Secondary consumer', size: 'Mantle usually 14–38 cm', depth: 'Over seagrass and around the jetty, often at night',
    role: 'A fast, intelligent mollusc that hunts small fish and prawns and is food for larger fish.',
    interactions: ['Eats small fish and crustaceans', 'Lays egg strings in seagrass and weed', 'Escapes by jet propulsion and a cloud of ink'],
    fieldNotes: 'Squid are caught on a squid jig, not a baited hook. Check the jig has spikes only, not barbs.',
    threats: 'Loss of seagrass where they lay eggs; fishing pressure.',
  }),
  fishCard('shortfineel', {
    feeding: 'carnivore', trophic: 'Secondary consumer', depth: 'The channel, mangrove roots and muddy edges',
    role: 'A night hunter of the mud and snags that eats crabs, worms and small fish.',
    interactions: ['Eats crabs, worms, prawns and small fish', 'Hides in holes and roots by day', 'Migrates to the sea to spawn'],
    fieldNotes: 'Shortfin eels spend years in estuaries and rivers, then travel far out to sea to breed. The legal minimum is 30 cm; longfin eels have a different minimum.',
    threats: 'Barriers that block migration; loss of wetland habitat.',
  }),
  // ---- Habitat and other wildlife of the Lake
  {
    "id": "seahorse",
    "common": "White's seahorse",
    "sci": "Hippocampus whitei",
    "group": "fish",
    "feeding": "carnivore",
    "trophic": "Secondary consumer",
    "size": "Up to 13 cm",
    "depth": "1–15 m",
    "status": "Endangered (IUCN); Endangered in NSW and nationally (EPBC Act)",
    "statusCode": "EN",
    "role": "An ambush predator of tiny crustaceans, and a flagship species for protecting seagrass and estuary habitat.",
    "interactions": [
      "Clings to seagrass, sponges and soft corals with its tail",
      "Sucks in small crustaceans such as amphipods and mysid shrimps",
      "Relies on camouflage to avoid predators such as flathead"
    ],
    "didYouKnow": "The male gets pregnant – the female deposits her eggs in his pouch, and he gives birth to fully formed babies weeks later.",
    "fieldNotes": "White's seahorse lives only in estuaries of eastern Australia, from southern Queensland to Lake Illawarra in NSW, near the southern end of its range. Pairs stay together through the breeding season and greet each other every morning with a short \"dance\". Numbers crashed in Port Stephens and Sydney Harbour as seagrass and soft corals were lost, and divers have since installed \"seahorse hotels\" (artificial habitat) to help them recover.",
    "spot": "Look closely at the seagrass blades for a small seahorse coiled by its tail, coloured to match the plants – it barely moves.",
    "threats": "Loss of seagrass, sponge and soft coral habitat; storms and poor water quality.",
    "sources": [
      "IUCN Red List – Hippocampus whitei (2017)",
      "NSW Fisheries Scientific Committee 2019 – Final Determination, Hippocampus whitei",
      "Short et al. 2019, ZooKeys – H. procerus a synonym of H. whitei"
    ]
  },
  {
    "id": "pipefish",
    "common": "Wide-bodied pipefish",
    "sci": "Stigmatopora nigra",
    "group": "fish",
    "feeding": "carnivore",
    "trophic": "Secondary consumer",
    "size": "Up to 16 cm",
    "depth": "0–35 m",
    "status": "Least Concern",
    "statusCode": "LC",
    "role": "Eats tiny crustaceans among seagrass blades, linking zooplankton to bigger fish.",
    "interactions": [
      "Feeds on copepods and other small crustaceans",
      "Hides among seagrass blades that match its shape and colour",
      "Eaten by larger fish such as flathead and bream"
    ],
    "didYouKnow": "Pipefish are close relatives of seahorses – like seahorses, it is the male that carries the eggs until they hatch.",
    "fieldNotes": "Its long, thin, green-brown body looks just like a seagrass leaf, and it sways with the plants. It sucks prey into its tube-like snout with a rapid head flick. It lives in the estuaries and bays of southern Australia, including NSW seagrass meadows.",
    "spot": "Stare at the swaying seagrass until one \"blade\" turns out to be a skinny fish hanging among the leaves.",
    "threats": "Loss of seagrass beds from poor water quality and coastal development.",
    "sources": [
      "Fishes of Australia – Stigmatopora nigra",
      "Australian Museum – Widebody Pipefish",
      "IUCN Red List – Stigmatopora nigra"
    ]
  },
  {
    "id": "blueswimmer",
    "common": "Blue swimmer crab",
    "sci": "Portunus armatus",
    "group": "invertebrate",
    "feeding": "omnivore",
    "trophic": "Secondary consumer",
    "size": "Up to about 20 cm shell width",
    "depth": "0–50 m",
    "status": "Not Evaluated",
    "statusCode": "NE",
    "role": "An active predator and scavenger on sand and seagrass, and an important food for fish, rays and people.",
    "interactions": [
      "Eats shellfish, worms, small crustaceans and dead animals",
      "Preyed on by rays, sharks and large fish",
      "Supports major recreational and commercial fisheries"
    ],
    "didYouKnow": "Its back legs are flattened like paddles, so it can actually swim instead of just walking.",
    "fieldNotes": "Males are bright blue with white spots; females are duller green-brown. Blue swimmers often bury themselves in sand with only their eyes showing. Australian blue swimmers were recognised as a separate species, Portunus armatus, from the Asian P. pelagicus in 2010.",
    "spot": "Watch for a bright blue crab scuttling across the sand – startle it and it swims away using its paddle-shaped back legs. (In Lake Illawarra it is rod and line only: no crab traps or nets near the entrance.)",
    "threats": "Fishing pressure and loss of seagrass nursery areas.",
    "sources": [
      "Lai et al. 2010, Zootaxa – Portunus pelagicus species complex",
      "Australian Museum – Blue Swimmer Crab",
      "NSW DPIRD – Blue swimmer crab"
    ]
  },
  {
    "id": "soldiercrab",
    "common": "Soldier crab",
    "sci": "Mictyris longicarpus",
    "group": "invertebrate",
    "feeding": "detritivore",
    "trophic": "Detritivore",
    "size": "About 2.5 cm shell length",
    "depth": "Intertidal (exposed at low tide)",
    "status": "Not Evaluated",
    "statusCode": "NE",
    "role": "Sifts sand for organic matter and bacteria, cleaning and turning over the tidal flats.",
    "interactions": [
      "Feeds on detritus and microorganisms in the sand",
      "Eaten by shorebirds such as migratory waders",
      "Its burrowing mixes and oxygenates the sediment"
    ],
    "didYouKnow": "Unlike most crabs, soldier crabs walk forwards, not sideways.",
    "fieldNotes": "At low tide, soldier crabs emerge in huge \"armies\" of thousands to feed on the exposed sand, rolling sand through their mouthparts and leaving tiny pellets behind. When disturbed or when the tide returns, they corkscrew down into the sand within seconds. Their round, pale-blue bodies make them look like little marbles on legs.",
    "spot": "At low tide, look on the open sand flats for a marching army of small blue crabs walking forwards together.",
    "threats": "Trampling, pollution and coastal development on tidal flats.",
    "sources": [
      "Australian Museum – Soldier crab, Mictyris longicarpus",
      "Dittmann 1996, Marine Ecology Progress Series – Effects of soldier crabs on sediments"
    ]
  },
  {
    "id": "cuttlefish",
    "common": "Mourning cuttlefish",
    "sci": "Ascarosepion plangon",
    "group": "invertebrate",
    "feeding": "carnivore",
    "trophic": "Secondary consumer",
    "size": "Up to about 15 cm mantle length",
    "depth": "0–80 m",
    "status": "Least Concern",
    "statusCode": "LC",
    "role": "An intelligent predator of prawns, crabs and small fish in seagrass and estuaries.",
    "interactions": [
      "Catches prawns, crabs and small fish with two shooting tentacles",
      "Preyed on by dolphins, large fish and sharks",
      "Uses colour displays to signal to other cuttlefish"
    ],
    "didYouKnow": "Cuttlefish can change colour and skin texture in under a second, using millions of colour cells called chromatophores.",
    "fieldNotes": "The mourning cuttlefish (formerly Sepia plangon) is common in eastern Australian estuaries from Queensland to NSW. Its internal shell, the cuttlebone, is filled with gas chambers that let it hover at any depth. Males can display half their body as a male and the other half as a female to sneak past rivals.",
    "spot": "Look for a small cuttlefish hovering above the seagrass, rippling its fin and changing colour as you watch.",
    "threats": "Habitat loss and bycatch in prawn trawls.",
    "sources": [
      "Reef Life Survey – Ascarosepion plangon",
      "Brown et al. 2012, Biology Letters – Sneaky male cuttlefish dual display",
      "SeaLifeBase – Sepia plangon"
    ]
  },
  {
    "id": "zostera",
    "common": "Eelgrass (Mueller's eelgrass)",
    "sci": "Zostera muelleri",
    "group": "plant",
    "feeding": "photosynthetic",
    "trophic": "Producer",
    "size": "Leaves up to about 50 cm long",
    "depth": "Intertidal to about 5 m",
    "status": "Least Concern",
    "statusCode": "LC",
    "role": "Forms dense meadows that produce food and oxygen, trap sediment, store carbon and shelter juvenile fish.",
    "interactions": [
      "Habitat and nursery for juvenile fish, prawns, seahorses and pipefish",
      "Covered by epiphytic algae when nutrient levels rise"
    ],
    "didYouKnow": "Seagrass is not a seaweed – it is a flowering plant with roots, leaves, flowers and seeds that returned to the sea from land.",
    "fieldNotes": "Zostera muelleri (which includes the plant once called Z. capricorni) is one of the most common seagrasses in NSW estuaries. It spreads by underground stems called rhizomes, which bind the sediment and help keep the water clear. Its flowers are pollinated underwater, with pollen carried by the water.",
    "spot": "Look at the long green ribbon-like blades swaying back and forth with the water movement.",
    "threats": "Turbid water and sediment from floods, nutrient runoff, dredging, boat moorings and propeller scars.",
    "sources": [
      "IUCN Red List – Zostera muelleri",
      "Waycott et al. 2014 – A guide to southern temperate seagrasses (CSIRO)",
      "NSW DPIRD – Seagrass (fish habitat)"
    ]
  },
  {
    "id": "halophila",
    "common": "Paddle weed (spoon grass)",
    "sci": "Halophila ovalis",
    "group": "plant",
    "feeding": "photosynthetic",
    "trophic": "Producer",
    "size": "Leaves 1–4 cm long",
    "depth": "Intertidal to about 10 m (can grow deeper)",
    "status": "Least Concern",
    "statusCode": "LC",
    "role": "A small, fast-growing seagrass that quickly recolonises bare patches.",
    "interactions": [
      "Pioneer species that recolonises ground disturbed by grazing or storms"
    ],
    "didYouKnow": "Paddle weed is higher in nitrogen and lower in fibre than most seagrasses, which is why dugongs seek it out.",
    "fieldNotes": "Paddle weed has pairs of small oval leaves on short stalks rising from a thin creeping rhizome. It grows and spreads quickly but has few reserves, so it is one of the first seagrasses to die off in murky water. It is a pioneer plant: it re-colonises bare sand quickly after a disturbance, then slower seagrasses take over.",
    "spot": "Look closely at the bottom for tiny paired oval leaves, like little paddles, in patches where dugongs have been feeding.",
    "threats": "Low light from turbid floodwater, nutrient runoff and dredging.",
    "sources": [
      "Preen 1995, Marine Ecology Progress Series – Cultivation grazing by dugongs",
      "IUCN Red List – Halophila ovalis",
      "Seagrass-Watch – Halophila ovalis"
    ]
  },
  {
    "id": "greymangrove",
    "common": "Grey mangrove",
    "sci": "Avicennia marina",
    "group": "plant",
    "feeding": "photosynthetic",
    "trophic": "Producer",
    "size": "Usually 3–10 m tall",
    "depth": "Intertidal (flooded at high tide)",
    "status": "Least Concern",
    "statusCode": "LC",
    "role": "Forms coastal forests that trap sediment, protect shorelines, store carbon and provide nursery habitat.",
    "interactions": [
      "Roots shelter juvenile fish, mud crabs and prawns at high tide",
      "Fallen leaves feed detritivores such as crabs and mullet",
      "Provides roosting and nesting sites for birds"
    ],
    "didYouKnow": "Grey mangrove leaves sweat out excess salt through special glands – you can sometimes see the salt crystals on their surface.",
    "fieldNotes": "Mangrove mud is waterlogged and low in oxygen, so grey mangroves send up hundreds of pencil-like aerial roots called pneumatophores that take in air at low tide. They also filter much of the salt out at the roots and get rid of the rest through salt glands on the leaves. Seeds start to grow while still on the parent tree, then drop and float away as ready-to-grow propagules.",
    "spot": "Look for grey-green trees growing in the water with hundreds of pencil-like roots poking up out of the mud around them.",
    "threats": "Clearing for coastal development, pollution and changes to tidal flow.",
    "sources": [
      "IUCN Red List – Avicennia marina",
      "NSW DPIRD – Mangroves (fish habitat)",
      "Duke 2006 – Australia's Mangroves"
    ]
  }
];
