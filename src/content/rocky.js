// TideLine – NSW rocky reef & kelp forest content (species + missions)
// Site: Illawarra coast near Woonona/Bellambi, NSW – temperate reef, 0–18 m, East Australian Current (EAC) influence.
// Data only. Australian English. IUCN statuses checked October 2026.
// Notes for teachers:
//  - Eastern blue groper: IUCN Near Threatened. It is the NSW state fish emblem. Spearfishing and commercial
//    fishing for it are banned in NSW, and line fishing is prohibited (extended for three years from 1 March 2025,
//    DPIRD). Check current NSW DPIRD rules before quoting dates.
//  - Weedy (common) seadragon: reassessed by the IUCN as Vulnerable (assessed 2024, published 2025); it was
//    previously Least Concern. (No DPIRD/worksheet row in our dataset covers seadragon rules, so the game gives advice only, not law.)
//  - Grey nurse shark: Critically Endangered globally (IUCN) and the east coast population is listed as
//    Critically Endangered under the EPBC Act.
//  - Blacklip abalone: IUCN Vulnerable (2021 assessment).
//  - Spotted wobbegong: IUCN Least Concern since 2015 (previously Near Threatened).
//  - Several common NSW reef fish (red morwong, mado, luderick, eastern blue devil) have not been evaluated by the IUCN.

export const species = [
  {
    id: 'bluegroper',
    common: 'Eastern blue groper',
    sci: 'Achoerodus viridis',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Tertiary consumer',
    size: 'Up to about 1 m',
    depth: '1–60 m',
    status: 'Near Threatened (NSW state fish; spearfishing, commercial and line fishing banned in NSW)',
    statusCode: 'NT',
    role: 'A large reef predator that crunches sea urchins, crabs and molluscs, helping stop urchins from overgrazing the kelp.',
    interactions: [
      'Preys on long-spined sea urchins (Centrostephanus rodgersii), helping protect kelp forests',
      'Eats crabs, shrimps and molluscs, and also cunjevoi (Pyura praeputialis)',
      'Juveniles shelter in estuary seagrass beds before moving to the reef'
    ],
    didYouKnow: 'The eastern blue groper is the official fish emblem of New South Wales – and most gropers start life as brown or green females before some turn into blue males.',
    fieldNotes: 'Blue gropers are wrasses and protogynous hermaphrodites: every fish starts life as a female, and some change into males once they reach about 60 cm. Thick lips and strong peg-like teeth, plus a second set of grinding teeth in the throat, let them crush shells and spiny urchins. After heavy spearfishing in the 1960s, spearing them was later stopped, and they are now so used to divers that they often swim right up to have a look.',
    spot: 'Look for a big, curious blue or brown fish with thick lips that swims over and follows you around the reef – watch it crunch an urchin or crab.',
    threats: 'Historically overfished by spearfishers; slow growth and late sex change make it vulnerable to fishing pressure and warming seas.',
    sources: [
      'IUCN Red List – Achoerodus viridis (Near Threatened)',
      'NSW DPI – Eastern Blue Groper line fishing prohibition',
      'Australian Museum – Eastern Blue Groper'
    ]
  },
  {
    id: 'redmorwong',
    common: 'Red morwong',
    sci: 'Cheilodactylus fuscus',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 65 cm',
    depth: '1–30 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A bottom-feeding predator that sifts invertebrates from the reef and sand, linking small animals to bigger predators.',
    interactions: [
      'Eats worms, crabs, amphipods, snails and small bivalves picked from the bottom',
      'Rests in groups on the same rocks day after day (site attachment)',
      'Preyed on by larger predators such as wobbegongs and grey nurse sharks'
    ],
    didYouKnow: 'Red morwong often rest propped up on their thick, finger-like lower pectoral fins, as if leaning on their elbows.',
    fieldNotes: 'Red morwong live in groups of a few to around 100 fish that break up at night, and they are most active at dawn and dusk. Adults have small home ranges and return to the same resting spots, so a local population can be fished out quickly. Males have bigger bony bumps on the head than females.',
    spot: 'Look for reddish-orange fish with pale stripes resting motionless on rocks and kelp edges – they only move off when you get very close.',
    threats: 'Spearfishing and line fishing; because they stay in one place and grow slowly, local populations are easily overfished.',
    sources: [
      'FishBase – Cheilodactylus fuscus',
      'Australian Museum – Red Morwong',
      'Reef Life Survey – Cheilodactylus fuscus'
    ]
  },
  {
    id: 'mado',
    common: 'Mado',
    sci: 'Atypichthys strigatus',
    group: 'fish',
    feeding: 'omnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 25 cm',
    depth: '1–30 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'One of the most common fish on NSW reefs; it eats plankton and small invertebrates and is food for many predators.',
    interactions: [
      'Picks zooplankton and small invertebrates from the water and reef',
      'Schools with other small fish around boulders for safety in numbers',
      'Hunted by yellowtail kingfish, snapper and wobbegongs'
    ],
    didYouKnow: 'Mado are found only in the south-west Pacific – mainly south-eastern Australia, plus Lord Howe Island, Norfolk Island and northern New Zealand.',
    fieldNotes: 'Mado are easy to recognise by their yellow-and-black horizontal stripes and deep, flattened bodies. They hang around boulders, wharf pylons and ledges in loose groups. Because they eat both plankton and bottom-living animals, they are a flexible link in the reef food web.',
    spot: 'Look for loose schools of small yellow-and-black striped fish hovering around boulders.',
    threats: 'Generally common; affected by loss of reef habitat and pollution near cities.',
    sources: [
      'FishBase – Atypichthys strigatus',
      'Australian Museum – Mado',
      'Reef Life Survey – Atypichthys strigatus'
    ]
  },
  {
    id: 'luderick',
    common: 'Luderick (blackfish)',
    sci: 'Girella tricuspidata',
    group: 'fish',
    feeding: 'herbivore',
    trophic: 'Primary consumer (adults)',
    size: 'Up to about 70 cm, usually 30–40 cm',
    depth: '0–20 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A grazer that crops algae off rocks, helping control seaweed growth on shallow reefs and in estuaries.',
    interactions: [
      'Grazes green and red algae from rocks (and seagrass in estuaries)',
      'Competes with sea urchins and other grazers for algae',
      'Hunted by kingfish, wobbegongs and other large predators'
    ],
    didYouKnow: 'Anglers catch luderick using green weed as bait – one of the few fish in Australia caught on a seaweed bait.',
    fieldNotes: 'Juvenile luderick eat small invertebrates, but adults switch mainly to algae – their small, three-pointed teeth (tricuspidata means "three points") are made for nipping seaweed. They move between estuaries and coastal reefs, and adults travel to ocean bars and headlands to spawn. Luderick can live for more than 20 years.',
    spot: 'Look for small schools of dark grey fish with thin vertical bars grazing algae off the rocks in the shallows.',
    threats: 'Fishing pressure and loss of estuary habitat such as seagrass beds.',
    sources: [
      'FishBase – Girella tricuspidata',
      'Australian Museum – Luderick',
      'NSW DPI – Luderick fishing guide'
    ]
  },
  {
    id: 'kingfish',
    common: 'Yellowtail kingfish',
    sci: 'Seriola lalandi',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Tertiary consumer',
    size: 'Up to 2.5 m',
    depth: '3–300 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'A fast, schooling predator that hunts baitfish and squid along the reef edge.',
    interactions: [
      'Preys on small fish such as mado and yellowtail scad, plus squid',
      'Hunts in schools, herding prey together',
      'Large adults can be eaten by sharks'
    ],
    didYouKnow: 'Yellowtail kingfish are now farmed in sea cages in South Australia – an example of Australian aquaculture.',
    fieldNotes: 'Kingfish are powerful, streamlined fish in the same family as trevally (Carangidae), with a bright yellow tail and a gold stripe along the side. Young fish school tightly, while very large adults may roam alone or in small groups. They are a prized catch for recreational fishers, so NSW has size and bag limits to protect breeding stocks.',
    spot: 'Look out along the reef edge for a fast school of silver fish with bright yellow tails patrolling past you.',
    threats: 'Heavy recreational and commercial fishing; generally widespread and secure.',
    sources: [
      'IUCN Red List – Seriola lalandi',
      'FishBase – Seriola lalandi',
      'NSW DPI – Yellowtail kingfish'
    ]
  },
  {
    id: 'oldwife',
    common: 'Old wife',
    sci: 'Enoplosus armatus',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Usually under 25 cm, up to 50 cm',
    depth: '1–90 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'Eats small crustaceans and worms around kelp and rocks, and is the only living member of its family.',
    interactions: [
      'Feeds on small crustaceans, worms and zooplankton',
      'Uses venomous dorsal spines to defend itself from predators',
      'Shelters in and around golden kelp (Ecklonia radiata)'
    ],
    didYouKnow: 'The old wife is the only living species in the family Enoplosidae, and it is found only in southern Australia.',
    fieldNotes: 'Its bold black-and-white bars help break up its outline among kelp stalks. The tall dorsal fins carry sharp spines with mild venom that can give a painful sting, so it should never be handled. Adults are often seen in pairs, while juveniles may form small groups.',
    spot: 'Look for pairs of black-and-white striped fish with tall fins hovering near the kelp.',
    threats: 'Habitat loss and occasional bycatch; generally secure.',
    sources: [
      'IUCN Red List 2019 – Enoplosus armatus',
      'FishBase – Enoplosus armatus',
      'Australian Museum – Old Wife'
    ]
  },
  {
    id: 'snapper',
    common: 'Australasian snapper',
    sci: 'Chrysophrys auratus',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Tertiary consumer',
    size: 'Up to 1.3 m',
    depth: '0–200 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'A roaming predator of the sand–reef edge that eats crabs, urchins, molluscs and small fish.',
    interactions: [
      'Eats crabs, sea urchins, molluscs, worms and small fish',
      'Helps keep urchin numbers in check alongside gropers and lobsters',
      'Hunted when young by larger fish and sharks'
    ],
    didYouKnow: 'Snapper can live for around 40 years – scientists have confirmed their age using radiocarbon from 1950s–60s nuclear tests locked in their ear bones (otoliths).',
    fieldNotes: 'Snapper are pinkish-silver with bright blue spots that fade as they grow. Large old snapper develop a bulging hump on the forehead and fleshy lips. They are one of the most important recreational fish in Australia, so their populations are carefully managed with size and bag limits.',
    spot: 'Look for a pink fish with blue spots wandering slowly over the sand at the edge of the reef.',
    threats: 'Fishing pressure has depleted some stocks; managed with size and bag limits.',
    sources: [
      'IUCN Red List – Chrysophrys auratus',
      'FishBase – Chrysophrys auratus',
      'Status of Australian Fish Stocks – Snapper'
    ]
  },
  {
    id: 'easternbluedevil',
    common: 'Eastern blue devil',
    sci: 'Paraplesiops bleekeri',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 40 cm',
    depth: '3–30 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A shy cave-dwelling predator that ambushes small fish and crustaceans in ledges and crevices.',
    interactions: [
      'Ambushes small fish and crustaceans near its shelter',
      'Shares caves and ledges with rock lobsters and Port Jackson sharks',
      'Hides deep in crevices from larger predators'
    ],
    didYouKnow: 'The eastern blue devil is found only along the coast of eastern Australia, and it is a shy reef fish that stays near one cave. Please leave it be: look, but do not touch.',
    fieldNotes: 'Its deep blue body with white bands and yellow-orange tail and fins make it one of the most colourful fish on NSW reefs. It is territorial and stays in or near the same cave or ledge for long periods. Its bright colours make it attractive to aquarium collectors, so the kind thing is to leave it in its cave.',
    spot: 'Peer into dark ledges for a shy, bright blue fish with white bands – it slips back into the crevice if you get too close.',
    threats: 'Collection for aquariums and disturbance of cave habitat.',
    sources: [
      'FishBase – Paraplesiops bleekeri',
      'Australian Museum – Eastern Blue Devilfish'
    ]
  },
  {
    id: 'weedyseadragon',
    common: 'Weedy (common) seadragon',
    sci: 'Phyllopteryx taeniolatus',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 46 cm',
    depth: '0–50 m',
    status: 'Vulnerable (IUCN 2025)',
    statusCode: 'VU',
    role: 'A small, slow predator that sucks up tiny crustaceans such as mysid shrimps among the kelp and weed.',
    interactions: [
      'Sucks up mysid shrimps and amphipods through its tube-shaped snout',
      'Relies on kelp and weed beds for camouflage and shelter',
      'Its leaf-like appendages mimic seaweed to avoid predators'
    ],
    didYouKnow: 'Like seahorses, it is the male seadragon that carries the eggs – stuck to a brood patch under his tail – until they hatch.',
    fieldNotes: 'Seadragons are found only in southern Australian waters. The female lays up to about 250 eggs onto the underside of the male\'s tail, where they develop for around a month before hatching. In 2025 the IUCN changed its status from Least Concern to Vulnerable because of declines linked to warming seas and loss of kelp and weed habitat.',
    spot: 'Search slowly through the kelp and weed for what looks like a drifting piece of seaweed – then notice it has an eye and a long snout.',
    threats: 'Loss of kelp and seagrass habitat, marine heatwaves, storms that wash animals ashore, and collection. Please leave seadragons be: look, but do not touch.',
    sources: [
      'IUCN Red List – Phyllopteryx taeniolatus (Vulnerable)',
      'FishBase – Phyllopteryx taeniolatus',
      'Australian Museum – Weedy Seadragon'
    ]
  },
  {
    id: 'greynurse',
    common: 'Grey nurse shark',
    sci: 'Carcharias taurus',
    group: 'shark',
    feeding: 'carnivore',
    trophic: 'Apex / tertiary consumer',
    size: 'Up to 3.2 m',
    depth: '0–190 m (usually 10–40 m off NSW)',
    status: 'Critically Endangered (east coast population Critically Endangered under the EPBC Act)',
    statusCode: 'CR',
    role: 'A top predator that eats fish, rays, squid and smaller sharks, helping regulate the reef food web.',
    interactions: [
      'Preys on fish such as snapper and kingfish, plus rays, squid and smaller sharks',
      'Gathers in rocky gutters and caves, sharing them with other reef animals',
      'Accidentally hooked by fishers (bycatch) – a major threat'
    ],
    didYouKnow: 'Grey nurse sharks gulp air at the surface and hold it in their stomach so they can hover almost motionless in the water.',
    fieldNotes: 'Despite its ragged, protruding teeth, the grey nurse shark is docile and not considered dangerous to divers. Breeding is extremely slow: inside each of the mother\'s two uteruses the first embryo to develop eats its siblings, so only two pups are born, usually every two years. The east coast population fell by more than 90% after spearfishing and fishing in the mid-1900s, and it is now rare. If you ever hook one, release it carefully and leave it be.',
    spot: 'Look in the rocky gutters for a big, bronze-grey shark with ragged teeth slowly patrolling and hovering almost still.',
    threats: 'Accidental hooking by line fishing, shark-control nets and very slow breeding.',
    sources: [
      'IUCN Red List – Carcharias taurus (Critically Endangered)',
      'DCCEEW – Carcharias taurus (east coast population) EPBC listing',
      'NSW DPI – Grey nurse shark'
    ]
  },
  {
    id: 'portjackson',
    common: 'Port Jackson shark',
    sci: 'Heterodontus portusjacksoni',
    group: 'shark',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to 1.65 m',
    depth: '0–275 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'A bottom-feeding shark that crushes sea urchins, crabs and molluscs, helping control urchin numbers.',
    interactions: [
      'Crushes sea urchins (including Centrostephanus rodgersii), crabs and molluscs',
      'Shares caves and gutters with wobbegongs and blue devils',
      'Its eggs are eaten by snails and other predators'
    ],
    didYouKnow: 'Port Jackson sharks lay spiral, corkscrew-shaped egg cases, which females wedge into rock crevices so they cannot wash away.',
    fieldNotes: 'Its front teeth are small and pointed for gripping, while the back teeth are flat plates for crushing shells and urchin spines. Unlike most sharks it can pump water over its gills while resting still on the bottom. Many adults return to the same reefs every winter and spring to breed, travelling hundreds of kilometres between seasons.',
    spot: 'Look in caves and gutters for a sandy-coloured shark with a harness-like dark pattern resting on the bottom.',
    threats: 'Bycatch in trawl and line fisheries; otherwise common and widespread.',
    sources: [
      'IUCN Red List 2015 – Heterodontus portusjacksoni',
      'Australian Museum – Port Jackson Shark',
      'FishBase – Heterodontus portusjacksoni'
    ]
  },
  {
    id: 'wobbegong',
    common: 'Spotted wobbegong',
    sci: 'Orectolobus maculatus',
    group: 'shark',
    feeding: 'carnivore',
    trophic: 'Tertiary consumer',
    size: 'Usually 1.5–1.8 m, up to about 3 m',
    depth: '0–220 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'An ambush predator that lies hidden on the reef and snaps up fish, octopus and crustaceans that come too close.',
    interactions: [
      'Ambushes fish such as luderick, plus octopus, crabs and rock lobsters',
      'Its camouflage relies on blending into rocks and weed',
      'Can bite divers who touch or step on it (defence)'
    ],
    didYouKnow: '"Wobbegong" is thought to come from an Aboriginal word meaning "shaggy beard" – describing the frilly skin flaps around its mouth.',
    fieldNotes: 'Its blotchy pattern and the fleshy lobes around its mouth break up its outline so well that prey swim right up to it. Wobbegongs mostly hunt at night, lunging with a sudden snap. Females give birth to around 20–37 live pups after a pregnancy of almost a year.',
    spot: 'Look very carefully at the rocks – a patterned, flattened shark lies perfectly still, camouflaged against the reef.',
    threats: 'Commercial and recreational fishing; it was assessed as Near Threatened until 2015, when better management led to Least Concern.',
    sources: [
      'IUCN Red List 2015 – Orectolobus maculatus',
      'Australian Museum – Spotted Wobbegong',
      'Huveneers et al. 2007 – Reproductive biology of wobbegong sharks in NSW'
    ]
  },
  {
    id: 'fiddlerray',
    common: 'Eastern fiddler ray',
    sci: 'Trygonorrhina fasciata',
    group: 'ray',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to about 1.2 m',
    depth: '0–180 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'Feeds on crabs, worms and molluscs buried in the sand at the reef edge, stirring up sediment as it hunts.',
    interactions: [
      'Digs crabs, worms, prawns and molluscs out of the sand',
      'Eaten by larger sharks such as wobbegongs and grey nurse sharks',
      'Fish follow it to snap up animals it disturbs'
    ],
    didYouKnow: 'Despite its name, the fiddler ray is more closely related to guitarfish than to stingrays – and it has no stinging spine.',
    fieldNotes: 'It is named for its violin-like shape and the bold pattern of brown and blue lines on its back. Like other rays it breathes through spiracles behind the eyes while lying on the sand. It is harmless to people and is found only in south-eastern Australia.',
    spot: 'Look on the sand next to the reef for a violin-shaped ray resting on the bottom – get too close and it glides away.',
    threats: 'Bycatch in prawn trawls and line fishing; generally common.',
    sources: [
      'IUCN Red List 2015 – Trygonorrhina fasciata',
      'Australian Museum – Eastern Fiddler Ray',
      'Reef Life Survey – Trygonorrhina fasciata'
    ]
  },
  {
    id: 'octopus',
    common: 'Gloomy octopus',
    sci: 'Octopus tetricus',
    group: 'invertebrate',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Arm span up to about 2 m',
    depth: '0–70 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'A clever predator of crabs, shellfish and lobsters, and itself food for sharks, gropers and seals.',
    interactions: [
      'Preys on crabs, abalone and other molluscs, drilling or prising them open',
      'Hunted by wobbegongs, blue gropers and fur seals',
      'Piles shells outside its den, creating habitat used by other animals'
    ],
    didYouKnow: 'In Jervis Bay, NSW, scientists discovered two sites nicknamed "Octopolis" and "Octlantis" where many gloomy octopuses live together in dens.',
    fieldNotes: 'Octopuses change colour and skin texture in a fraction of a second using thousands of pigment cells called chromatophores, controlled directly by nerves. They have three hearts and blue, copper-based blood. Gloomy octopuses grow fast and live only about one to two years; females die soon after their eggs hatch.',
    spot: 'Look for a pile of empty shells outside a crevice – an octopus will be sitting in its den, changing colour as you watch.',
    threats: 'Fishing (it is caught for bait and food); generally common.',
    sources: [
      'IUCN Red List – Octopus tetricus',
      'Scheel et al. 2017, Marine and Freshwater Behaviour and Physiology – Octlantis',
      'Australian Museum – Gloomy Octopus'
    ]
  },
  {
    id: 'urchin',
    common: 'Long-spined sea urchin',
    sci: 'Centrostephanus rodgersii',
    group: 'invertebrate',
    feeding: 'herbivore',
    trophic: 'Primary consumer',
    size: 'Body (test) up to about 12 cm across, plus long spines',
    depth: '0–50 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A native grazer that, at high numbers, eats kelp down to bare rock and creates "urchin barrens".',
    interactions: [
      'Grazes golden kelp (Ecklonia radiata) and other seaweeds',
      'Eaten by eastern blue gropers, eastern rock lobsters and Port Jackson sharks',
      'Competes with abalone for food and space'
    ],
    didYouKnow: 'Carried south by the warming East Australian Current, this NSW urchin has spread to Tasmania, where millions now create barrens on reefs that were once kelp forest.',
    fieldNotes: 'By day the urchin hides in crevices; at night it comes out to graze, often returning to the same hole. In parts of NSW, barrens grazed bare by this urchin cover large areas of shallow reef, with only a pink crust of coralline algae left. Its larvae need water above about 12 °C to develop, so as the EAC has pushed warmer water south, the urchin has been able to settle further down the coast.',
    spot: 'Look for black urchins with very long spines grazing the kelp – and patches of bare pink rock where they have cleared it.',
    threats: 'Not threatened – it is itself a threat to kelp forests where its predators have been fished out.',
    sources: [
      'Ling et al. 2009, Global Change Biology – Climate-driven range extension of Centrostephanus rodgersii',
      'Redmap – Sea urchin overgrazing and ocean warming',
      'Andrew & O\'Neill 2000, Marine and Freshwater Research – Barrens habitat in NSW'
    ]
  },
  {
    id: 'abalone',
    common: 'Blacklip abalone',
    sci: 'Haliotis rubra',
    group: 'invertebrate',
    feeding: 'herbivore',
    trophic: 'Primary consumer',
    size: 'Shell up to about 20 cm',
    depth: '0–40 m',
    status: 'Vulnerable',
    statusCode: 'VU',
    role: 'Grazes drifting pieces of kelp and algae trapped against the rock.',
    interactions: [
      'Catches drift kelp and algae under its foot',
      'Competes with long-spined urchins for food and space',
      'Eaten by octopuses, rock lobsters and stingrays'
    ],
    didYouKnow: 'The row of holes in an abalone shell lets water flow out after it has passed over the gills – old holes close over as new ones form.',
    fieldNotes: 'An abalone clamps onto rock with a huge muscular foot so strong that it is very hard to prise off. It is a snail (gastropod) with a single, ear-shaped shell lined with shiny mother-of-pearl. Abalone are one of Australia\'s most valuable seafoods, so fishing for them is carefully managed. Check DPIRD before you ever collect one.',
    spot: 'Look closely at the rock surface for an oval, ear-shaped shell clinging tight, its black-edged foot frill showing around the rim.',
    threats: 'Overfishing and poaching, disease, marine heatwaves and loss of kelp to urchin barrens.',
    sources: [
      'IUCN Red List 2021 – Haliotis rubra (Vulnerable)',
      'Peters et al. 2024, PLOS ONE – Abalones at risk: a global Red List assessment',
      'NSW DPI – Abalone'
    ]
  },
  {
    id: 'rocklobster',
    common: 'Eastern rock lobster',
    sci: 'Sagmariasus verreauxi',
    group: 'invertebrate',
    feeding: 'omnivore',
    trophic: 'Secondary consumer',
    size: 'Up to about 60 cm body length',
    depth: '0–200 m',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'A large scavenger and predator of urchins, molluscs and crabs, helping keep urchin numbers under control.',
    interactions: [
      'Preys on sea urchins, abalone, crabs and other invertebrates',
      'Shelters in crevices alongside eastern blue devils and octopuses',
      'Eaten by octopuses, wobbegongs and blue gropers'
    ],
    didYouKnow: 'The eastern rock lobster may be the longest lobster in the world, and its larvae drift in the open ocean for many months before settling on a reef.',
    fieldNotes: 'It has no big claws – instead it defends itself with long, spiny antennae and can make a loud rasping sound by rubbing them. Adults hide in crevices by day and come out at night to feed. In NSW, rock lobsters are managed with size limits (check DPIRD for the current rules).',
    spot: 'Look into crevices for a pair of long, spiny antennae poking out – the lobster is hiding behind them.',
    threats: 'Fishing pressure; managed fishery in NSW.',
    sources: [
      'IUCN Red List – Sagmariasus verreauxi',
      'NSW DPI – Eastern rock lobster',
      'Australian Museum – Eastern Rock Lobster'
    ]
  },
  {
    id: 'cunjevoi',
    common: 'Cunjevoi (sea squirt)',
    sci: 'Pyura praeputialis',
    group: 'invertebrate',
    feeding: 'filter feeder',
    trophic: 'Primary consumer',
    size: 'Individuals up to about 15 cm tall; forms dense mats',
    depth: '0–5 m (intertidal and shallow subtidal)',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'Forms dense beds on rocky shores, filtering plankton from the water and providing shelter for small animals.',
    interactions: [
      'Filters phytoplankton and detritus from the water',
      'Its mats shelter worms, crabs and small molluscs',
      'Eaten by blue gropers; also collected by people for fishing bait'
    ],
    didYouKnow: 'Cunjevoi are chordates – their swimming larvae have a notochord, which makes them closer relatives of fish and humans than of sponges or corals.',
    fieldNotes: 'A cunjevoi is a type of sea squirt (ascidian). It sucks water in through one siphon, strains out food and pushes water out through another, and when squeezed it squirts water out of both. Its tough, leathery outer tunic protects it from waves and drying out at low tide.',
    spot: 'Touch the clumps of leathery lumps on the shallow rocks and watch them squirt jets of water.',
    threats: 'Collection for bait and trampling on rock platforms; collection is restricted in NSW protected areas.',
    sources: [
      'Australian Museum – Cunjevoi',
      'Rius & Teske 2011, Marine Biology Research – Pyura praeputialis taxonomy',
      'NSW DPI – Intertidal protected areas'
    ]
  },
  {
    id: 'kelp',
    common: 'Golden kelp',
    sci: 'Ecklonia radiata',
    group: 'algae',
    feeding: 'photosynthetic',
    trophic: 'Producer',
    size: 'Up to about 2 m tall',
    depth: '0–30 m (deeper in clear water)',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'The main habitat-forming kelp of the Great Southern Reef, creating forests that shelter and feed hundreds of species.',
    interactions: [
      'Grazed by long-spined sea urchins and herbivorous fish',
      'Drift pieces feed abalone and other grazers',
      'Its holdfast and canopy shelter fish, seadragons and invertebrates'
    ],
    didYouKnow: 'Australia\'s Great Southern Reef – the rocky kelp-covered reefs along the southern half of the country – stretches for more than 8000 km of coastline.',
    fieldNotes: 'Golden kelp is a brown alga that grips the rock with a root-like holdfast; it does not have true roots, so it gets nutrients from the water. Its canopy shades the reef below and calms the water, changing which species can live underneath. A marine heatwave in 2011 wiped out kelp along more than 100 km of Western Australia\'s coast, and warming has also reduced kelp in northern NSW.',
    spot: 'Swim through the forest of golden-brown kelp swaying back and forth in the surge.',
    threats: 'Marine heatwaves, urchin overgrazing and grazing by tropical fish moving south with warming waters.',
    sources: [
      'Bennett et al. 2016, Marine and Freshwater Research – The Great Southern Reef',
      'Wernberg et al. 2016, Science – Climate-driven regime shift of a temperate marine ecosystem',
      'Vergés et al. 2016, PNAS – Long-term empirical evidence of ocean warming leading to tropicalisation of fish communities'
    ]
  },
  {
    id: 'crayweed',
    common: 'Crayweed',
    sci: 'Phyllospora comosa',
    group: 'algae',
    feeding: 'photosynthetic',
    trophic: 'Producer',
    size: 'Up to about 3 m long',
    depth: '0–15 m',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A large brown seaweed that forms shallow underwater forests, providing food and shelter for abalone, lobsters and fish.',
    interactions: [
      'Provides habitat for abalone, rock lobsters and reef fish',
      'Shares the shallow reef with golden kelp (Ecklonia radiata)',
      'Its drifting fronds feed grazers and beach food webs'
    ],
    didYouKnow: 'Crayweed disappeared from about 70 km of Sydney\'s coast in the 1980s – and nobody noticed for years. Scientists are now bringing it back through "Operation Crayweed".',
    fieldNotes: 'The loss of crayweed has been linked to poorly treated sewage released along Sydney\'s coast before deep ocean outfalls were built in the 1990s. Even after water quality improved, the crayweed did not return on its own. Since the 2010s scientists from UNSW and the Sydney Institute of Marine Science have transplanted fertile crayweed onto bare reefs, where it has reproduced and started new forests.',
    spot: 'Look in the shallows for long, bushy brown seaweed fronds swaying in the surge.',
    threats: 'Pollution, marine heatwaves and urchin grazing; it cannot easily recolonise lost reefs on its own.',
    sources: [
      'Coleman et al. 2008, Journal of Phycology – Absence of a large brown macroalga on urban reefs around Sydney',
      'Operation Crayweed – UNSW and Sydney Institute of Marine Science',
      'Campbell et al. 2014, PLOS ONE – Towards restoration of missing underwater forests'
    ]
  },
  {
    id: 'spongegarden',
    common: 'Sponge garden (demosponges)',
    sci: 'Class Demospongiae',
    group: 'invertebrate',
    feeding: 'filter feeder',
    trophic: 'Primary consumer',
    size: 'From a few centimetres to over 1 m',
    depth: '12–18 m on this reef (much deeper elsewhere)',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'Filters bacteria and plankton from huge volumes of water, recycling nutrients and creating colourful habitat on the deeper reef.',
    interactions: [
      'Filters bacteria and tiny plankton from the water',
      'Provides shelter for small fish, worms and crustaceans',
      'Eaten by some sea slugs (nudibranchs) and specialist fish'
    ],
    didYouKnow: 'Sponges are among the oldest groups of animals on Earth – they have no brain, nerves, muscles or true organs.',
    fieldNotes: 'Sponges pull water in through thousands of tiny pores using beating cells called choanocytes, trap food and release the filtered water through larger openings. They grow where light is too dim for kelp, so they dominate deeper reefs, forming "sponge gardens" in many colours and shapes. Many sponges make chemicals to deter predators, and some of these are studied as possible medicines.',
    spot: 'Swim down to the deeper reef and look for a garden of colourful sponges in all shapes – fans, cups, fingers and blobs – filtering the water.',
    threats: 'Physical damage from anchors and fishing gear, sediment and marine heatwaves.',
    sources: [
      'Australian Museum – Sponges',
      'Reef Life Survey – Sponge gardens',
      'Bell 2008, Estuarine, Coastal and Shelf Science – The functional roles of marine sponges'
    ]
  },
  // ---------------------------------------------------------------- beach, dunes and rock platform (walk mode)
  // Teacher note: conservation statuses for these shore species were written from general knowledge in
  // October 2026 and should be checked against the IUCN Red List and the NSW BC Act schedules before quoting.
  {
    id: 'ghostcrab',
    habitat: 'beach',
    common: 'Smooth-handed ghost crab',
    sci: 'Ocypode cordimanus',
    group: 'invertebrate',
    feeding: 'omnivore',
    trophic: 'Secondary consumer and scavenger',
    size: 'Shell (carapace) up to about 4 cm wide',
    depth: 'Upper beach and foredune toe, in burrows above the high-tide line',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'The main predator and scavenger of the upper beach: it cleans up stranded animals and eats small invertebrates, turtle hatchlings and seeds.',
    interactions: [
      'Scavenges washed-up fish, jellyfish and seaweed wrack',
      'Eaten by shorebirds, silver gulls and foxes',
      'Burrows are crushed by vehicles and trampling, so burrow counts drop on busy beaches'
    ],
    didYouKnow: 'Scientists can survey a whole beach without catching a single crab: they count ghost crab burrow holes, and fewer holes usually means more human disturbance.',
    fieldNotes: 'Ghost crabs are mostly active at night and spend hot days in deep burrows, where the sand stays cool and damp. They breathe with gills, so they must keep them moist; they dash to the swash zone or wick water up from damp sand with tufts of hair near their legs. Their eyes sit on long stalks and give almost all-round vision, which is why they bolt for their burrow long before you get close.',
    spot: 'Look for small round holes with a fan of fresh sand on the dry upper beach. Approach slowly: a pale, sand-coloured crab may sprint sideways and vanish down a hole.',
    threats: 'Beach driving, heavy trampling, beach grooming and coastal development; sea-level rise squeezing the beach against seawalls.',
    sources: [
      'Australian Museum – Ghost crabs (genus Ocypode)',
      'Schlacher and colleagues – ghost crab burrow counts as indicators of human impact on sandy beaches (Griffith University / USC research)'
    ]
  },
  {
    id: 'oystercatcher',
    habitat: 'beach',
    common: 'Australian pied oystercatcher',
    sci: 'Haematopus longirostris',
    group: 'bird',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'About 45–50 cm long',
    depth: 'Swash zone of ocean beaches, estuary sand and mudflats',
    status: 'Endangered in NSW (BC Act); Least Concern globally (IUCN)',
    statusCode: 'EN',
    role: 'A specialist predator of beach shellfish, especially pipis, and a sign of a healthy, undisturbed beach.',
    interactions: [
      'Probes and prises open pipis (Donax deltoides) and other bivalves with its long orange bill',
      'Also eats beach worms, crabs and small fish',
      'Nests are scrapes in the sand, so dogs, foxes, vehicles and people walking above the tide line can destroy eggs'
    ],
    didYouKnow: 'Pied oystercatcher pairs can return to the same stretch of beach to nest year after year – and their eggs look so much like sandy pebbles that people step on them without noticing.',
    fieldNotes: 'You can tell it apart from the all-black sooty oystercatcher (which prefers rock platforms) by its white belly and white wing stripe. Pairs walk along the edge of the swash, stabbing into the wet sand after each wave pulls back. When people or dogs come too close, the adults walk away from the nest, call loudly and may fly off, leaving eggs and chicks exposed to heat and predators.',
    spot: 'Scan the wet sand at the water\'s edge for a black-and-white bird with a long, bright orange-red bill and pink legs. Keep your distance so it keeps feeding.',
    threats: 'Disturbance of nesting birds by people, dogs and vehicles; fox predation; loss of beach habitat; over-harvesting of pipis.',
    sources: [
      'NSW Department of Climate Change, Energy, the Environment and Water – Pied Oystercatcher threatened species profile',
      'BirdLife Australia – Australian Pied Oystercatcher',
      'IUCN Red List – Haematopus longirostris'
    ]
  },
  {
    id: 'silvergull',
    habitat: 'beach',
    common: 'Silver gull',
    sci: 'Chroicocephalus novaehollandiae',
    group: 'bird',
    feeding: 'omnivore',
    trophic: 'Secondary consumer and scavenger',
    size: 'About 40 cm long',
    depth: 'Beaches, rock platforms, estuaries and towns along the whole coast',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'An adaptable scavenger and predator that cleans up the strandline – and takes advantage of human food scraps.',
    interactions: [
      'Eats small fish, crabs, worms, insects and washed-up animals',
      'Steals eggs and chicks of other beach-nesting birds when given the chance',
      'Populations near cities are boosted by rubbish tips and people feeding them'
    ],
    didYouKnow: 'You can age a silver gull by its colours: adults have a red bill, red legs and a red eye ring, while young birds have dark bills and brown mottling on their wings.',
    fieldNotes: 'Silver gulls are the most common gull in Australia. Natural foods give them a balanced diet, but chips and bread do not, and crowds of fed gulls also gang up on shorebirds and their nests. That is why many councils ask beachgoers not to feed them.',
    spot: 'You will hear them before you see them: white birds with grey backs and black wing tips standing on the beach or wheeling overhead.',
    threats: 'Not threatened; it has increased near cities. Plastic ingestion and fishing line entanglement harm individual birds.',
    sources: [
      'BirdLife Australia – Silver Gull',
      'IUCN Red List – Chroicocephalus novaehollandiae (Least Concern)'
    ]
  },
  {
    id: 'spinifex',
    habitat: 'beach',
    common: 'Beach spinifex',
    sci: 'Spinifex sericeus',
    group: 'plant',
    feeding: 'photosynthetic',
    trophic: 'Producer',
    size: 'Leaves up to about 30 cm; runners several metres long',
    depth: 'Foredune and upper beach – the first plants above the high-tide line',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'The pioneer sand-binder of the foredune: its runners trap wind-blown sand and build the dune that shelters every plant behind it.',
    interactions: [
      'Traps sand blown off the beach, slowly building the foredune',
      'Shelters ghost crabs, insects and beach-nesting birds',
      'Damaged by trampling and vehicles, which can start blowouts in the dune'
    ],
    didYouKnow: 'Spinifex plants are either male or female. The female seed heads break off as spiky balls that bounce along the beach in the wind, spreading seed far along the coast.',
    fieldNotes: 'Its silvery leaves are covered in fine hairs that reflect sunlight and reduce water loss, and it tolerates salt spray and being buried by sand – in fact burial stimulates new growth. Runners (stolons) creep across the sand and root at their joints. This is a native grass and should not be confused with the "spinifex" (Triodia) hummock grasses of inland Australia.',
    spot: 'Walk up the beach toward the dune: the silver-green grass with long runners spreading over bare sand is beach spinifex. Use the access track – don\'t walk on the dune.',
    threats: 'Trampling, vehicles, invasive plants such as bitou bush, and erosion during storms.',
    sources: [
      'NSW Department of Primary Industries – Coastal dune management (dune plants)',
      'PlantNET (NSW Flora Online) – Spinifex sericeus'
    ]
  },
  {
    id: 'pigface',
    habitat: 'beach',
    common: 'Pigface',
    sci: 'Carpobrotus glaucescens',
    group: 'plant',
    feeding: 'photosynthetic',
    trophic: 'Producer',
    size: 'Spreading mats up to several metres across; flowers about 5 cm',
    depth: 'Dunes, headlands and cliff tops near the sea',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A salt-tolerant succulent that covers bare sand on the dunes, holding it in place and feeding insects and birds.',
    interactions: [
      'Its bright magenta flowers are visited by native bees and other insects',
      'Fruits are eaten by birds and other animals, which spread the seeds',
      'Helps stabilise sand between spinifex and the shrubs further back'
    ],
    didYouKnow: 'Aboriginal people have long eaten the salty-sweet fruit of pigface, and the juice of the leaves has traditionally been used to soothe stings and burns.',
    fieldNotes: 'Pigface is a succulent: its thick, three-sided leaves store water so it can survive on dry sand and in salt spray. Leaves often turn red when the plant is stressed by drought or cold. The flowers open in the sun and close in the evening.',
    spot: 'Look for low mats of fleshy, finger-like leaves with pink-purple daisy-like flowers on the front and back of the dune.',
    threats: 'Trampling and dune erosion; competition from introduced plants, including other Carpobrotus species.',
    sources: [
      'PlantNET (NSW Flora Online) – Carpobrotus glaucescens',
      'Australian National Botanic Gardens – Aboriginal plant use (Carpobrotus)'
    ]
  },
  {
    id: 'coastalwattle',
    habitat: 'beach',
    common: 'Coastal wattle',
    sci: 'Acacia longifolia subsp. sophorae',
    group: 'plant',
    feeding: 'photosynthetic',
    trophic: 'Producer',
    size: 'Low, spreading shrub, usually 1–3 m tall',
    depth: 'Back of the foredune and the hind dune',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A tough shrub that forms the windbreak behind the foredune and adds nitrogen to poor sandy soils.',
    interactions: [
      'Bacteria in its root nodules fix nitrogen from the air, enriching the sand for other plants',
      'Yellow flower spikes in late winter and spring feed bees and other insects',
      'Seeds are spread by ants and eaten by birds'
    ],
    didYouKnow: 'What look like leaves on this wattle are actually flattened leaf stalks called phyllodes – an adaptation that loses less water than true leaves.',
    fieldNotes: 'Salt-laden onshore winds kill the growing tips facing the sea, so coastal wattle is pruned into low, wedge-shaped thickets that rise toward the land. It is native on the NSW coast and often planted in dune restoration, but it has become an invasive weed where it has been introduced overseas.',
    spot: 'Look behind the foredune for dense, wind-sheared shrubs with long, bright green "leaves" and yellow rod-shaped flowers.',
    threats: 'Clearing for development, fire, and competition from bitou bush.',
    sources: [
      'PlantNET (NSW Flora Online) – Acacia longifolia subsp. sophorae',
      'NSW Department of Primary Industries – Coastal dune management'
    ]
  },
  {
    id: 'coastbanksia',
    habitat: 'beach',
    common: 'Coast banksia',
    sci: 'Banksia integrifolia',
    group: 'plant',
    feeding: 'photosynthetic',
    trophic: 'Producer',
    size: 'Usually 5–15 m tall on the coast (stunted on exposed dunes)',
    depth: 'Hind dunes and headlands, sheltered from the strongest salt winds',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A key tree of the hind-dune woodland: its winter flowers are a vital food source when little else is flowering.',
    interactions: [
      'Pale yellow flower spikes produce nectar for honeyeaters, lorikeets, flying-foxes and possums',
      'Old cones and hollows shelter insects and small animals',
      'Shades and stabilises the older dunes behind the foredune'
    ],
    didYouKnow: 'Coast banksia leaves are dark green on top and silvery-white underneath – when the wind flips them, the whole tree seems to flash silver.',
    fieldNotes: 'Banksias are named after the botanist Joseph Banks, who collected them at Botany Bay in 1770. Unlike many banksias, coast banksia does not need fire to release its seeds. It flowers mainly from late summer to winter, which makes it an important food tree for nectar-feeding birds and mammals in the cooler months.',
    spot: 'Walk over the foredune (on the track!) into the scrub behind: gnarled trees with grey bark, leathery leaves and cylinder-shaped yellow flowers or grey cones.',
    threats: 'Clearing for coastal development, dieback and changed fire regimes.',
    sources: [
      'PlantNET (NSW Flora Online) – Banksia integrifolia',
      'Australian National Botanic Gardens – Banksia integrifolia'
    ]
  },
  {
    id: 'neptunesnecklace',
    habitat: 'rockplatform',
    common: 'Neptune\'s necklace',
    sci: 'Hormosira banksii',
    group: 'algae',
    feeding: 'photosynthetic',
    trophic: 'Producer',
    size: 'Chains of beads up to about 30 cm long',
    depth: 'Mid-shore of rock platforms, exposed at low tide',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'The main canopy seaweed of the mid-shore: its damp mats shade the rock and shelter snails, crabs and small fish at low tide.',
    interactions: [
      'Shelters periwinkles, limpets, crabs and amphipods from drying out at low tide',
      'Grazed by snails and other herbivores',
      'Easily crushed by people walking on rock platforms, and slow to recover'
    ],
    didYouKnow: 'Each bead of Neptune\'s necklace is a hollow, water-filled float – a portable water supply that helps the seaweed survive hours out of water at low tide.',
    fieldNotes: 'Rock platforms show zonation: bands of different species at different heights, set by how long each spot is exposed to air and sun. Neptune\'s necklace dominates the middle zone. Studies on Australian platforms have shown that regular trampling can strip it from the rock, which changes the whole community living underneath.',
    spot: 'At low tide, look for olive-brown chains of shiny beads draped over the rock around the pools.',
    threats: 'Trampling, marine heatwaves during low tides, and sewage and stormwater pollution.',
    sources: [
      'Keough and Quinn 1998, Ecological Applications – Effects of periodic disturbances from trampling on rocky intertidal algal beds',
      'Australian Museum – Rocky shores: zonation'
    ]
  },
  {
    id: 'waratahanemone',
    habitat: 'rockplatform',
    common: 'Waratah anemone',
    sci: 'Actinia tenebrosa',
    group: 'invertebrate',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to about 5 cm across',
    depth: 'Crevices and pool edges on the mid to low shore',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A small predator of the rock platform that catches tiny animals with stinging tentacles when the tide is in.',
    interactions: [
      'Catches small crustaceans, worms and drifting animals with stinging cells (nematocysts)',
      'Fights neighbouring anemones using blue stinging bulbs around its rim',
      'Eaten by some sea slugs, fish and sea stars'
    ],
    didYouKnow: 'At low tide the waratah anemone pulls its tentacles in and becomes a shiny red blob – a trick that stops it drying out until the sea returns.',
    fieldNotes: 'The blue beads around the top of the column are called acrorhagi. They are packed with stinging cells and are used in slow-motion "fights" with other anemones that are not clones of itself. Young anemones are brooded inside the parent and released fully formed, so neighbouring anemones are often clones.',
    spot: 'Look in damp cracks and around the edges of rock pools for glossy, dark red jelly-like blobs. Look, don\'t touch.',
    threats: 'Trampling and collecting; heat stress during low tides in heatwaves.',
    sources: [
      'Australian Museum – Waratah anemone (Actinia tenebrosa)',
      'Ayre and Grosberg – clonal aggression and acrorhagi in Actinia tenebrosa (research summaries)'
    ]
  },
  {
    id: 'bluelinedoctopus',
    habitat: 'rockplatform',
    common: 'Blue-lined octopus (a blue-ringed octopus)',
    sci: 'Hapalochlaena fasciata',
    group: 'invertebrate',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Body about 4–5 cm; arm span up to about 15 cm',
    depth: 'Rock pools and shallow reef, southern Queensland to southern NSW',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A small, highly venomous predator of rock pools that hunts crabs and shrimps at night.',
    interactions: [
      'Hunts crabs and shrimps, paralysing them with venomous saliva',
      'Hides in crevices, empty shells and even rubbish such as cans and bottles',
      'Its venom comes from bacteria that live in its salivary glands'
    ],
    didYouKnow: 'Its venom contains tetrodotoxin, which can paralyse a person within minutes – there is no antivenom, but people survive if someone gives rescue breathing (CPR) until help arrives. Call 000.',
    fieldNotes: 'When calm it is a dull, mottled yellow-brown and hard to see. When disturbed, iridescent blue lines suddenly brighten as a warning (this is called aposematic colouring). Bites usually happen when people pick up shells or the octopus itself, often without feeling a sting. Never put your hands into crevices or pick up shells in rock pools.',
    spot: 'Look into the rock pools without touching anything. If you see small electric-blue lines flash, back away slowly.',
    threats: 'Not considered threatened; affected by habitat damage and collection for the aquarium trade.',
    sources: [
      'Australian Museum – Blue-lined octopus (Hapalochlaena fasciata)',
      'Australian Resuscitation Council / NSW Health – first aid for blue-ringed octopus bites'
    ]
  },
  // ---------------------------------------------------------------- line fishing (beach, rocks, jet ski)
  // Teacher note: size/bag limits are in src/fishing/catches.js — check current NSW DPI rules before quoting.
  {
    id: 'australiansalmon',
    habitat: 'fishing',
    common: 'Australian salmon',
    sci: 'Arripis trutta',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to about 80 cm, usually 30–60 cm',
    depth: 'Surf beaches, rocky headlands and estuary mouths',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A fast schooling predator of baitfish along surf beaches — and a favourite sport fish of beach anglers.',
    interactions: [
      'Hunts pilchards, anchovies and other small baitfish in the surf',
      'Eaten by sharks, seals, dolphins and seabirds',
      'Big schools move along the coast in autumn and winter to spawn'
    ],
    didYouKnow: 'Despite the name, Australian salmon are not related to true salmon — early European settlers named them for their shape and fight.',
    fieldNotes: 'Schools of salmon cruise just behind the breaking waves, and from the beach you can sometimes see them as dark patches in the face of a wave. They are often caught and released, because many people find the dark flesh less tasty; handling them quickly with wet hands gives released fish the best chance.',
    spot: 'Cast from the beach into the gutter (deeper channel) just behind the breakers.',
    threats: 'Commercial and recreational fishing pressure on spawning schools.',
    sources: ['NSW DPI – Australian salmon fact sheet', 'FishBase – Arripis trutta']
  },
  {
    id: 'tailor',
    habitat: 'fishing',
    common: 'Tailor',
    sci: 'Pomatomus saltatrix',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary/tertiary consumer',
    size: 'Up to about 1 m, usually 30–50 cm',
    depth: 'Surf beaches, rock platforms and estuaries',
    status: 'Vulnerable (IUCN, global)',
    statusCode: 'VU',
    role: 'A fierce predator with razor-sharp teeth that chops through schools of baitfish at dawn and dusk.',
    interactions: [
      'Attacks schools of pilchards and other baitfish, often in a feeding frenzy',
      'Eaten by sharks, dolphins and larger fish',
      'Migrates north along the NSW coast to spawn off Fraser Island (K\'gari) in late winter'
    ],
    didYouKnow: 'Tailor got their name from their sharp teeth, which snip through fishing line like a tailor\'s scissors.',
    fieldNotes: 'The same species is called bluefish in the USA. Tailor feed hardest at dawn and dusk and their numbers are watched closely, which is why there is a legal minimum length — it gives each fish a chance to spawn before it can be kept.',
    spot: 'Fish the beach or rock platform at dawn or dusk when tailor chase baitfish close to shore.',
    threats: 'Fishing pressure, especially on the spawning migration.',
    sources: ['NSW DPI – Tailor fact sheet', 'IUCN Red List – Pomatomus saltatrix (Vulnerable)']
  },
  {
    id: 'sandwhiting',
    habitat: 'fishing',
    common: 'Sand whiting',
    sci: 'Sillago ciliata',
    group: 'fish',
    feeding: 'carnivore',
    trophic: 'Secondary consumer',
    size: 'Up to about 50 cm, usually 25–35 cm',
    depth: 'Sandy beaches, sand flats and estuaries',
    status: 'Not Evaluated',
    statusCode: 'NE',
    role: 'A bottom feeder that probes the sand for worms, pipis and small crustaceans in the swash zone.',
    interactions: [
      'Digs beach worms, yabbies and small shellfish from the sand',
      'Eaten by tailor, flathead, seabirds and dolphins',
      'Shares the shallows with ghost crabs and pipis'
    ],
    didYouKnow: 'Whiting feed in water so shallow that their backs sometimes break the surface as they chase worms up the beach.',
    fieldNotes: 'Sand whiting have a pointed snout made for digging. Anglers catch them with live beach worms and pipis, which links fishing directly to the health of the beach: no worms or pipis, no whiting.',
    spot: 'Cast a short distance into the shallow gutters along the sandy beach.',
    threats: 'Loss of beach and estuary habitat; fishing pressure.',
    sources: ['NSW DPI – Sand whiting fact sheet', 'FishBase – Sillago ciliata']
  },
  {
    id: 'yellowfinbream',
    habitat: 'fishing',
    common: 'Yellowfin bream',
    sci: 'Acanthopagrus australis',
    group: 'fish',
    feeding: 'omnivore',
    trophic: 'Secondary consumer',
    size: 'Up to about 60 cm, usually 25–35 cm',
    depth: 'Estuaries, beaches and rocky reefs',
    status: 'Least Concern',
    statusCode: 'LC',
    role: 'An adaptable fish of rocks, beaches and estuaries that eats almost anything — the classic NSW angler\'s fish.',
    interactions: [
      'Eats crabs, worms, shellfish, small fish and some algae',
      'Moves from estuaries to surf beaches and rocky headlands to spawn in winter',
      'Eaten by larger fish, dolphins and seabirds'
    ],
    didYouKnow: 'Bream can live for over 20 years, and many start life as males before some change into females.',
    fieldNotes: 'Bream are wary and smart — big ones are famous for stealing bait without getting hooked. Their yellow pectoral and anal fins give them their name. Releasing undersize bream quickly lets them reach breeding size.',
    spot: 'Fish the washes beside rocks and the edges of the rock platform.',
    threats: 'Estuary habitat loss and water pollution; fishing pressure.',
    sources: ['NSW DPI – Yellowfin bream fact sheet', 'IUCN Red List – Acanthopagrus australis']
  }
];
