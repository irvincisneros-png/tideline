// TideLine – Seagrass meadows & mangroves content (Moreton Bay, Queensland)
// Data only. Australian English. IUCN statuses checked October 2026.
// Notes for teachers:
//  - Green turtle: IUCN global status changed from Endangered to Least Concern in Oct 2025;
//    it remains listed as Vulnerable in Australia under the EPBC Act.
//  - Dugong: Vulnerable globally (IUCN); some overseas subpopulations (East Africa, Japan's Nansei
//    Islands) are Critically Endangered and New Caledonia's is Endangered. Vulnerable under
//    Queensland's Nature Conservation Act 1992.
//  - White's seahorse: Hippocampus procerus (Queensland) was merged into H. whitei in 2019, so
//    Moreton Bay sits within its range (Hervey Bay, Qld to Lake Illawarra, NSW).
//  - Whitespotted eagle ray: uplisted to Endangered in the most recent IUCN assessment
//    (older sources say Vulnerable).
//  - Mourning cuttlefish: now placed in the genus Ascarosepion (formerly Sepia plangon).
//  - Spotted sea hare: Indo-Pacific animals once called Aplysia dactylomela are now
//    Aplysia argus (Alexander & Valdés 2013).
//  - Zostera muelleri includes the plant formerly called Zostera capricorni.
//  - NSW link: Posidonia australis (strapweed) is listed as an endangered population in six
//    NSW estuaries (Port Hacking, Botany Bay, Sydney Harbour, Pittwater, Brisbane Water,
//    Lake Macquarie) under the Fisheries Management Act 1994.

export const species = [
  {
    id: 'dugong',
    common: 'Dugong',
    sci: 'Dugong dugon',
    group: 'mammal',
    feeding: 'herbivore',
    trophic: 'Primary consumer',
    size: 'Up to 3 m long and over 400 kg',
    depth: '1–10 m (usually shallow seagrass beds)',
    status: 'Vulnerable (global); Vulnerable in Queensland',
    statusCode: 'VU',
    role: 'The only strictly marine plant-eating mammal; its grazing reshapes seagrass meadows and recycles nutrients.',
    interactions: [
      'Grazes seagrasses, preferring the nutritious paddle weed (Halophila ovalis)',
      'Competes with green turtles for seagrass',
      'Calves can be taken by large sharks such as tiger sharks'
    ],
    didYouKnow: 'Dugongs can live for about 70 years, but a female may have only one calf every three to seven years, so populations recover very slowly.',
    fieldNotes: 'Moreton Bay holds several hundred dugongs – roughly 500 to 1000 in surveys – right next to a city of over two million people. Instead of just clipping leaves, a dugong ploughs up whole plants, roots and all, with its muscular, bristly upper lip, leaving winding bare trails in the meadow. It must surface to breathe every few minutes, rising nostrils-first.',
    spot: 'Watch for a big grey animal grazing along the bottom and leaving a winding trail of bare sand, then rising to the surface to breathe – often with others nearby.',
    threats: 'Loss of seagrass after floods and runoff, boat strikes, entanglement in nets and marine debris.',
    sources: [
      'IUCN Red List – Dugong dugon',
      'Lanyon 2003, Wildlife Research – Distribution and abundance of dugongs in Moreton Bay',
      'Marsh et al. 2011 – Ecology and Conservation of the Sirenia'
    ]
  },
  {
    id: 'greenturtle',
    common: 'Green turtle',
    sci: 'Chelonia mydas',
    group: 'reptile',
    feeding: 'herbivore',
    trophic: 'Primary consumer (adults)',
    size: 'Up to 1.2 m shell length',
    depth: '0–40 m',
    status: 'Least Concern (global, 2025); Vulnerable in Australia (EPBC Act)',
    statusCode: 'LC',
    role: 'Crops seagrass leaves like a lawnmower, which keeps meadows productive and speeds up nutrient cycling.',
    interactions: [
      'Grazes seagrass and algae, competing with dugongs',
      'Its cropping encourages fresh, nutritious regrowth of seagrass',
      'Hatchlings are eaten by birds, crabs and fish'
    ],
    didYouKnow: 'Green turtles are named for the green colour of their body fat, which comes from their plant diet – not from their shell.',
    fieldNotes: 'Moreton Bay is an important feeding ground where many green turtles live for years before migrating to nesting beaches such as those on the southern Great Barrier Reef. Unlike dugongs, turtles bite off leaves and leave the roots behind. Nest temperature sets a hatchling\'s sex – warmer sand produces more females.',
    spot: 'Watch a large turtle grazing on the seagrass, then follow it as it swims up to the surface to breathe.',
    threats: 'Seagrass loss after floods, boat strikes, plastic ingestion, fishing bycatch and warming nesting beaches.',
    sources: [
      'IUCN Red List 2025 – Chelonia mydas (downlisted to Least Concern)',
      'Queensland Government – Marine turtles',
      'DCCEEW Species Profile and Threats Database – Chelonia mydas'
    ]
  },
  {
    id: 'eagleray',
    common: 'Whitespotted eagle ray',
    sci: 'Aetobatus ocellatus',
    group: 'ray',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 3 m disc width',
    depth: '1–60 m',
    status: 'Endangered',
    statusCode: 'EN',
    role: 'Digs up and eats buried shellfish, stirring the sediment and controlling clam and snail numbers.',
    interactions: [
      'Preys on clams, snails, crabs and worms buried in the sand',
      'Leaves feeding pits that other fish scavenge in',
      'Eaten by large sharks such as great hammerheads'
    ],
    didYouKnow: 'Its teeth are fused into flat plates that work like a nutcracker to crush hard shells.',
    fieldNotes: 'Eagle rays "fly" with powerful flaps of their wing-like pectoral fins and are often seen in groups. To feed, they use a shovel-shaped snout to dig into the sand, blasting out sediment and leaving shallow pits. The long, thin tail has one or more venomous spines near its base.',
    spot: 'Look for a dark ray covered in white spots gliding over the meadow, then stopping to dig into the sand in a cloud of sediment.',
    threats: 'Caught as bycatch and targeted in fisheries in parts of its range; low breeding rate.',
    sources: [
      'IUCN Red List – Aetobatus ocellatus',
      'Fishes of Australia – Aetobatus ocellatus',
      'Last et al. 2016 – Rays of the World'
    ]
  },
  {
    id: 'shovelnose',
    common: 'Giant shovelnose ray',
    sci: 'Glaucostegus typus',
    group: 'ray',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 2.7 m',
    depth: '0–100 m',
    status: 'Critically Endangered',
    statusCode: 'CR',
    role: 'A bottom predator of crabs, prawns and small fish on shallow sandy and muddy flats.',
    interactions: [
      'Eats crabs, prawns, molluscs and small bottom fish',
      'Uses sand patches between seagrass to rest and hide',
      'Preyed on by large sharks'
    ],
    didYouKnow: 'Despite its shark-like body, it is a ray – its gill slits are underneath its body, not on its sides.',
    fieldNotes: 'Shovelnose rays (also called guitarfish or wedgefish relatives) have a flattened, triangular snout and a thick shark-like tail. They often lie still on sand, partly covered, and are easy to approach. Overseas they are heavily fished for their fins, which is why the species is now traded only under CITES controls.',
    spot: 'Look on the sand patches for a long, sandy-brown ray with a pointed snout lying very still on the bottom.',
    threats: 'Overfishing for fins and meat, bycatch in trawl and gill nets, and loss of coastal habitat.',
    sources: [
      'IUCN Red List – Glaucostegus typus',
      'Fishes of Australia – Glaucostegus typus',
      'CITES Appendix II – Glaucostegidae (2019)'
    ]
  },
  {
    id: 'seahorse',
    common: 'White\'s seahorse',
    sci: 'Hippocampus whitei',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 13 cm',
    depth: '1–15 m',
    status: 'Endangered (IUCN); Endangered in NSW, Queensland and nationally (EPBC Act)',
    statusCode: 'EN',
    role: 'An ambush predator of tiny crustaceans, and a flagship species for protecting seagrass and estuary habitat.',
    interactions: [
      'Clings to seagrass, sponges and soft corals with its tail',
      'Sucks in small crustaceans such as amphipods and mysid shrimps',
      'Relies on camouflage to avoid predators such as flathead'
    ],
    didYouKnow: 'The male gets pregnant – the female deposits her eggs in his pouch, and he gives birth to fully formed babies weeks later.',
    fieldNotes: 'White\'s seahorse lives only in estuaries of eastern Australia, from Hervey Bay in Queensland to Lake Illawarra in NSW. Pairs stay together through the breeding season and greet each other every morning with a short "dance". Numbers crashed in Port Stephens and Sydney Harbour as seagrass and soft corals were lost, and divers have since installed "seahorse hotels" (artificial habitat) to help them recover.',
    spot: 'Look closely at the seagrass blades for a small seahorse coiled by its tail, coloured to match the plants – it barely moves.',
    threats: 'Loss of seagrass, sponge and soft coral habitat; storms and poor water quality.',
    sources: [
      'IUCN Red List – Hippocampus whitei (2017)',
      'NSW Fisheries Scientific Committee 2019 – Final Determination, Hippocampus whitei',
      'Short et al. 2019, ZooKeys – H. procerus a synonym of H. whitei'
    ]
  },
  {
    id: 'pipefish',
    common: 'Wide-bodied pipefish',
    sci: 'Stigmatopora nigra',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 16 cm',
    depth: '0–35 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'Eats tiny crustaceans among seagrass blades, linking zooplankton to bigger fish.',
    interactions: [
      'Feeds on copepods and other small crustaceans',
      'Hides among seagrass blades that match its shape and colour',
      'Eaten by larger fish such as flathead and bream'
    ],
    didYouKnow: 'Pipefish are close relatives of seahorses – like seahorses, it is the male that carries the eggs until they hatch.',
    fieldNotes: 'Its long, thin, green-brown body looks just like a seagrass leaf, and it sways with the plants. It sucks prey into its tube-like snout with a rapid head flick. This species is found in southern Australia and reaches its northern limit in southern Queensland, so in Moreton Bay you are near the edge of its range.',
    spot: 'Stare at the swaying seagrass until one "blade" turns out to be a skinny fish hanging among the leaves.',
    threats: 'Loss of seagrass beds from poor water quality and coastal development.',
    sources: [
      'Fishes of Australia – Stigmatopora nigra',
      'Australian Museum – Widebody Pipefish',
      'IUCN Red List – Stigmatopora nigra'
    ]
  },
  {
    id: 'whiting',
    common: 'Sand whiting',
    sci: 'Sillago ciliata',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 51 cm (usually under 30 cm)',
    depth: '0–20 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'Feeds on worms and small crustaceans in sandy shallows next to seagrass, and is a favourite recreational catch.',
    interactions: [
      'Eats polychaete worms, yabbies and small crustaceans dug from the sand',
      'Juveniles shelter in seagrass and shallow estuary flats',
      'Preyed on by flathead, birds and larger fish'
    ],
    didYouKnow: 'When threatened, sand whiting can dive into the sand and bury themselves to hide.',
    fieldNotes: 'Sand whiting move in small schools over sandbanks, using their pointed snouts to probe for prey. Young whiting use the shallowest water and seagrass edges as a nursery before moving onto open sand. They are one of the most popular fish for anglers in south-east Queensland and NSW.',
    spot: 'Look over the sand patches for a loose school of slim, silvery fish with pointed snouts, nosing into the bottom to feed.',
    threats: 'Fishing pressure and loss of shallow nursery habitat.',
    sources: [
      'Fishes of Australia – Sillago ciliata',
      'IUCN Red List – Sillago ciliata',
      'Queensland Government – Sand whiting'
    ]
  },
  {
    id: 'bream',
    common: 'Yellowfin bream',
    sci: 'Acanthopagrus australis',
    group: 'fish',
    feeding: 'omnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 66 cm (usually under 35 cm)',
    depth: '0–50 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'A generalist feeder that moves food energy between mangroves, seagrass and sand flats.',
    interactions: [
      'Eats crabs, shellfish, worms, small fish and some plant material',
      'Shelters among mangrove roots at high tide',
      'Preyed on by larger fish, dolphins and birds'
    ],
    didYouKnow: 'Most yellowfin bream start life as males and many change into females as they grow larger.',
    fieldNotes: 'Bream follow the tide, moving into flooded mangrove forests to feed on crabs and returning to the channels and seagrass as the water drops. Each winter adults gather at estuary mouths and surf bars to spawn. Their eggs and larvae drift before the young settle back into estuary seagrass.',
    spot: 'Follow a silver fish with yellow lower fins as it wanders back and forth between the mangrove roots and the seagrass.',
    threats: 'Fishing pressure, loss of mangroves and seagrass, and poor estuary water quality.',
    sources: [
      'Fishes of Australia – Acanthopagrus australis',
      'IUCN Red List – Acanthopagrus australis',
      'NSW DPIRD – Yellowfin bream'
    ]
  },
  {
    id: 'mullet',
    common: 'Sea mullet',
    sci: 'Mugil cephalus',
    group: 'fish',
    feeding: 'detritivore',
    trophic: 'Primary consumer / detritivore',
    size: 'Up to 1 m (usually under 50 cm)',
    depth: '0–10 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'Eats detritus, microalgae and decaying plant matter, recycling the energy of fallen seagrass and mangrove leaves.',
    interactions: [
      'Feeds on detritus and microscopic algae filtered from mud',
      'An important food source for dolphins, ospreys and large fish',
      'Large autumn spawning runs support an important commercial fishery'
    ],
    didYouKnow: 'Mullet have a gizzard-like stomach that grinds up sand and mud to help digest their food.',
    fieldNotes: 'Sea mullet schools cruise near the surface and often leap clear of the water. They suck up soft mud and detritus, so much of their energy ultimately comes from dead seagrass and mangrove leaves. In autumn, huge schools migrate out of estuaries and along beaches to spawn at sea.',
    spot: 'Look up near the surface for a school of torpedo-shaped grey fish cruising together – some may jump out of the water.',
    threats: 'Overfishing of spawning runs and poor estuary water quality.',
    sources: [
      'Fishes of Australia – Mugil cephalus',
      'IUCN Red List – Mugil cephalus',
      'Queensland Government – Sea mullet'
    ]
  },
  {
    id: 'flathead',
    common: 'Dusky flathead',
    sci: 'Platycephalus fuscus',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Tertiary consumer',
    size: 'Up to 1.2 m',
    depth: '0–20 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A top ambush predator of the shallows that controls numbers of small fish and prawns.',
    interactions: [
      'Ambushes small fish such as whiting, mullet and pipefish',
      'Eats prawns and crabs',
      'Hides at seagrass edges and sand patches'
    ],
    didYouKnow: 'Almost every big dusky flathead is a female – the largest are often protected by "slot" size limits so they can keep breeding.',
    fieldNotes: 'The dusky flathead is the largest flathead species in the world. It wriggles into the sand until only its eyes stick out, then lunges upward to grab passing prey in its wide mouth. Sharp spines on its head and gill covers protect it from predators.',
    spot: 'Look closely at the sand for a pair of eyes – a flathead lies half-buried, perfectly camouflaged, waiting to ambush passing fish.',
    threats: 'Fishing pressure on large breeding females and loss of estuary habitat.',
    sources: [
      'Fishes of Australia – Platycephalus fuscus',
      'NSW DPIRD – Dusky flathead',
      'Gray & Barnes 2015, Fisheries Research – Dusky flathead reproductive biology'
    ]
  },
  {
    id: 'juvenilesnapper',
    common: 'Snapper (juveniles)',
    sci: 'Chrysophrys auratus',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Juveniles 2–20 cm (adults up to 1.3 m)',
    depth: '1–10 m (juveniles); adults to 200 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'Uses sheltered bays and seagrass as a nursery before moving out to reefs, linking estuaries to offshore fisheries.',
    interactions: [
      'Juveniles eat small crustaceans, worms and molluscs',
      'Shelters from predators in seagrass and over soft bottoms',
      'Preyed on by flathead, larger fish and birds'
    ],
    didYouKnow: 'Snapper can live for more than 40 years, and old adults grow a big bump on their forehead.',
    fieldNotes: 'Young snapper settle into sheltered bays like Moreton Bay, where seagrass and soft bottoms provide food and shelter. As they grow, they move to deeper reefs offshore. Many fish caught by anglers on outer reefs spent their first year or so in an estuary nursery like this one.',
    spot: 'Look for a small school of pinkish-silver little fish with faint blue spots, darting among the seagrass.',
    threats: 'Overfishing of adults and loss of nursery habitat; stocks in some regions have needed fishing closures.',
    sources: [
      'Fishes of Australia – Chrysophrys auratus',
      'IUCN Red List – Chrysophrys auratus',
      'Queensland Government – Snapper'
    ]
  },
  {
    id: 'blueswimmer',
    common: 'Blue swimmer crab',
    sci: 'Portunus armatus',
    group: 'invertebrate',
    feeding: 'omnivore',
    trophic: 'Secondary consumer',
    size: 'Up to about 20 cm shell width',
    depth: '0–50 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'An active predator and scavenger on sand and seagrass, and an important food for fish, rays and people.',
    interactions: [
      'Eats shellfish, worms, small crustaceans and dead animals',
      'Preyed on by rays, sharks and large fish',
      'Supports major recreational and commercial fisheries'
    ],
    didYouKnow: 'Its back legs are flattened like paddles, so it can actually swim instead of just walking.',
    fieldNotes: 'Males are bright blue with white spots; females are duller green-brown. Blue swimmers often bury themselves in sand with only their eyes showing. Australian blue swimmers were recognised as a separate species, Portunus armatus, from the Asian P. pelagicus in 2010.',
    spot: 'Watch for a bright blue crab scuttling across the sand – startle it and it swims away using its paddle-shaped back legs.',
    threats: 'Fishing pressure and loss of seagrass nursery areas.',
    sources: [
      'Lai et al. 2010, Zootaxa – Portunus pelagicus species complex',
      'Australian Museum – Blue Swimmer Crab',
      'Queensland Government – Blue swimmer crab'
    ]
  },
  {
    id: 'mudcrab',
    common: 'Giant mud crab',
    sci: 'Scylla serrata',
    group: 'invertebrate',
    feeding: 'omnivore',
    trophic: 'Secondary consumer',
    size: 'Up to about 24 cm shell width',
    depth: '0–10 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A large predator and scavenger of mangrove forests that eats shellfish, crabs and dead material.',
    interactions: [
      'Crushes snails, clams and smaller crabs with powerful claws',
      'Digs burrows among mangrove roots and in mud banks',
      'Preyed on by large fish, rays and people'
    ],
    didYouKnow: 'A mud crab\'s crushing claw can be almost as heavy as the rest of its body.',
    fieldNotes: 'Mud crabs live in burrows in mangrove mud and come out to forage, mainly at night and on high tides. Females migrate offshore to release their eggs, and larvae drift at sea before young crabs return to the mangroves. Like all crabs, they must moult their hard shell to grow.',
    spot: 'Look among the mangrove roots for a large dark green-brown crab with huge claws, guarding its burrow.',
    threats: 'Clearing of mangroves and fishing pressure.',
    sources: [
      'Queensland Government – Mud crabs',
      'Australian Museum – Mud crab',
      'Alberts-Hubatsch et al. 2016, Hydrobiologia – Scylla serrata ecology'
    ]
  },
  {
    id: 'soldiercrab',
    common: 'Soldier crab',
    sci: 'Mictyris longicarpus',
    group: 'invertebrate',
    feeding: 'detritivore',
    trophic: 'Detritivore',
    size: 'About 2.5 cm shell length',
    depth: 'Intertidal (exposed at low tide)',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'Sifts sand for organic matter and bacteria, cleaning and turning over the tidal flats.',
    interactions: [
      'Feeds on detritus and microorganisms in the sand',
      'Eaten by shorebirds such as migratory waders',
      'Its burrowing mixes and oxygenates the sediment'
    ],
    didYouKnow: 'Unlike most crabs, soldier crabs walk forwards, not sideways.',
    fieldNotes: 'At low tide, soldier crabs emerge in huge "armies" of thousands to feed on the exposed sand, rolling sand through their mouthparts and leaving tiny pellets behind. When disturbed or when the tide returns, they corkscrew down into the sand within seconds. Their round, pale-blue bodies make them look like little marbles on legs.',
    spot: 'At low tide, look on the open sand flats for a marching army of small blue crabs walking forwards together.',
    threats: 'Trampling, pollution and coastal development on tidal flats.',
    sources: [
      'Australian Museum – Soldier crab, Mictyris longicarpus',
      'Queensland Museum – Wild Guide to Moreton Bay',
      'Dittmann 1996, Marine Ecology Progress Series – Effects of soldier crabs on sediments'
    ]
  },
  {
    id: 'cuttlefish',
    common: 'Mourning cuttlefish',
    sci: 'Ascarosepion plangon',
    group: 'invertebrate',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to about 15 cm mantle length',
    depth: '0–80 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'An intelligent predator of prawns, crabs and small fish in seagrass and estuaries.',
    interactions: [
      'Catches prawns, crabs and small fish with two shooting tentacles',
      'Preyed on by dolphins, large fish and sharks',
      'Uses colour displays to signal to other cuttlefish'
    ],
    didYouKnow: 'Cuttlefish can change colour and skin texture in under a second, using millions of colour cells called chromatophores.',
    fieldNotes: 'The mourning cuttlefish (formerly Sepia plangon) is common in eastern Australian estuaries from Queensland to NSW. Its internal shell, the cuttlebone, is filled with gas chambers that let it hover at any depth. Males can display half their body as a male and the other half as a female to sneak past rivals.',
    spot: 'Look for a small cuttlefish hovering above the seagrass, rippling its fin and changing colour as you watch.',
    threats: 'Habitat loss and bycatch in prawn trawls.',
    sources: [
      'Reef Life Survey – Ascarosepion plangon',
      'Brown et al. 2012, Biology Letters – Sneaky male cuttlefish dual display',
      'SeaLifeBase – Sepia plangon'
    ]
  },
  {
    id: 'seahare',
    common: 'Spotted sea hare',
    sci: 'Aplysia argus',
    group: 'invertebrate',
    feeding: 'herbivore',
    trophic: 'Primary consumer',
    size: 'Up to about 30 cm',
    depth: '0–20 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'Grazes algae, including algae that grows on seagrass leaves, helping keep the leaves clear for sunlight.',
    interactions: [
      'Grazes red and green algae',
      'Its algal diet supplies chemicals it uses in defence',
      'Few predators because of its chemical defences'
    ],
    didYouKnow: 'When attacked, a sea hare squirts out a cloud of purple ink that confuses predators.',
    fieldNotes: 'Sea hares are large sea slugs named for the two ear-like tentacles (rhinophores) on their head. Their shell is reduced to a thin internal plate. They are hermaphrodites, and in spring they sometimes gather in large mating chains. The Indo-Pacific populations of this spotted sea hare were once called Aplysia dactylomela.',
    spot: 'Look for a big, soft, spotted slug slowly crawling over the seagrass and rocks, munching on algae.',
    threats: 'Few known threats; affected by poor water quality and habitat loss.',
    sources: [
      'Alexander & Valdés 2013, Journal of Molluscan Studies – Aplysia argus and A. dactylomela',
      'Australian Faunal Directory – Aplysia argus',
      'Australian Museum – Sea hares'
    ]
  },
  {
    id: 'zostera',
    common: 'Eelgrass (Mueller\'s eelgrass)',
    sci: 'Zostera muelleri',
    group: 'plant',
    feeding: 'photosynthetic',
    trophic: 'Producer',
    size: 'Leaves up to about 50 cm long',
    depth: 'Intertidal to about 5 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'Forms dense meadows that produce food and oxygen, trap sediment, store carbon and shelter juvenile fish.',
    interactions: [
      'Habitat and nursery for juvenile fish, prawns, seahorses and pipefish',
      'Grazed by green turtles and, less often, dugongs',
      'Covered by epiphytic algae when nutrient levels rise'
    ],
    didYouKnow: 'Seagrass is not a seaweed – it is a flowering plant with roots, leaves, flowers and seeds that returned to the sea from land.',
    fieldNotes: 'Zostera muelleri (which includes the plant once called Z. capricorni) is the most common seagrass in south-east Queensland and NSW estuaries. It spreads by underground stems called rhizomes, which bind the sediment and help keep the water clear. Its flowers are pollinated underwater, with pollen carried by the water.',
    spot: 'Look at the long green ribbon-like blades swaying back and forth with the water movement.',
    threats: 'Turbid water and sediment from floods, nutrient runoff, dredging, boat moorings and propeller scars.',
    sources: [
      'IUCN Red List – Zostera muelleri',
      'Waycott et al. 2014 – A guide to southern temperate seagrasses (CSIRO)',
      'Queensland Government – Seagrass'
    ]
  },
  {
    id: 'halophila',
    common: 'Paddle weed (spoon grass)',
    sci: 'Halophila ovalis',
    group: 'plant',
    feeding: 'photosynthetic',
    trophic: 'Producer',
    size: 'Leaves 1–4 cm long',
    depth: 'Intertidal to about 10 m (can grow deeper)',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'A small, fast-growing seagrass that is the favourite food of dugongs and quickly recolonises bare patches.',
    interactions: [
      'Preferred food of dugongs, which dig up whole plants',
      'Grazed by green turtles',
      'Pioneer species that recolonises ground disturbed by grazing or storms'
    ],
    didYouKnow: 'Paddle weed is higher in nitrogen and lower in fibre than most seagrasses, which is why dugongs seek it out.',
    fieldNotes: 'Paddle weed has pairs of small oval leaves on short stalks rising from a thin creeping rhizome. It grows and spreads quickly but has few reserves, so it is one of the first seagrasses to die off in murky water. Research in Moreton Bay showed that repeated dugong grazing favours Halophila over slower-growing seagrasses – a kind of "cultivation grazing".',
    spot: 'Look closely at the bottom for tiny paired oval leaves, like little paddles, in patches where dugongs have been feeding.',
    threats: 'Low light from turbid floodwater, nutrient runoff and dredging.',
    sources: [
      'Preen 1995, Marine Ecology Progress Series – Cultivation grazing by dugongs',
      'IUCN Red List – Halophila ovalis',
      'Seagrass-Watch – Halophila ovalis'
    ]
  },
  {
    id: 'greymangrove',
    common: 'Grey mangrove',
    sci: 'Avicennia marina',
    group: 'plant',
    feeding: 'photosynthetic',
    trophic: 'Producer',
    size: 'Usually 3–10 m tall',
    depth: 'Intertidal (flooded at high tide)',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'Forms coastal forests that trap sediment, protect shorelines, store carbon and provide nursery habitat.',
    interactions: [
      'Roots shelter juvenile fish, mud crabs and prawns at high tide',
      'Fallen leaves feed detritivores such as crabs and mullet',
      'Provides roosting and nesting sites for birds'
    ],
    didYouKnow: 'Grey mangrove leaves sweat out excess salt through special glands – you can sometimes see the salt crystals on their surface.',
    fieldNotes: 'Mangrove mud is waterlogged and low in oxygen, so grey mangroves send up hundreds of pencil-like aerial roots called pneumatophores that take in air at low tide. They also filter much of the salt out at the roots and get rid of the rest through salt glands on the leaves. Seeds start to grow while still on the parent tree, then drop and float away as ready-to-grow propagules.',
    spot: 'Look for grey-green trees growing in the water with hundreds of pencil-like roots poking up out of the mud around them.',
    threats: 'Clearing for coastal development, pollution and changes to tidal flow.',
    sources: [
      'IUCN Red List – Avicennia marina',
      'Queensland Government WetlandInfo – Mangroves',
      'Duke 2006 – Australia\'s Mangroves'
    ]
  },
  {
    id: 'jellyfish',
    common: 'Blubber jellyfish',
    sci: 'Catostylus mosaicus',
    group: 'invertebrate',
    feeding: 'planktivore',
    trophic: 'Secondary consumer',
    size: 'Bell up to about 35 cm across',
    depth: '0–10 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'Eats zooplankton and can form huge seasonal blooms in bays and estuaries.',
    interactions: [
      'Filters zooplankton with its frilly oral arms',
      'Eaten by sea turtles and some fish',
      'Small fish sometimes shelter beneath its bell'
    ],
    didYouKnow: 'Blubber jellyfish have no long tentacles – they catch food with eight frilly arms that hang under the bell.',
    fieldNotes: 'Blubber jellyfish are common in east-coast estuaries and can occur in swarms of thousands. Their colour varies with location: often creamy brown in Queensland and blue in Sydney waters. The sting is usually mild but can still irritate skin.',
    spot: 'Look up into the water for a big rounded jellyfish pulsing slowly and drifting with the tide.',
    threats: 'Not threatened; blooms may increase where water quality is poor.',
    sources: [
      'Australian Museum – Blubber jellyfish',
      'Pitt & Kingsford 2003, Marine Ecology Progress Series – Catostylus mosaicus',
      'Queensland Museum – Jellyfish'
    ]
  }
];
