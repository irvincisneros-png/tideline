// TideLine – Belmore Basin (Wollongong harbour) species cards: click an animal to read one. Data only, Australian English.
// The line-caught fish cards re-use the Lake's cards where the animal is the same (bream, luderick, trevally, mullet, garfish, mulloway, tailor) and add the
// harbour's own: southern calamari (squid), cuttlefish, yellowtail scad (yakka) and slimy mackerel. Facts that must match the rules come from fishing/species.js.
// Teacher note: bag and size limits follow DPIRD / worksheet values checked 31 Oct - 1 Nov 2026; check the DPIRD page before class use.
import { SPECIES_BY_ID } from '../fishing/species.js';
import { species as lake } from './seagrass.js';

const STOCK_CODE = { sustainable: 'LC', recovering: 'NT', depleting: 'VU', depleted: 'EN', undefined: 'DD' };
function fishCard(id, o) {
  const s = SPECIES_BY_ID[id];
  return {
    id, habitat: 'fishing', common: s.name, sci: s.sci, group: o.group ?? 'fish', status: s.statusNote, statusCode: STOCK_CODE[s.status] ?? 'DD',
    size: o.size ?? `Usually ${s.length[0]}–${s.length[1]} cm`, ...o,
    didYouKnow: o.didYouKnow ?? s.fact, spot: o.spot ?? s.idFeature,
    sources: o.sources ?? ['TideLine species data (NSW DPIRD size and bag limits)', 'NSW DPIRD – recreational fishing species guide'],
  };
}

const SHARED = ['yellowfinbream', 'luderick', 'silvertrevally', 'seamullet', 'garfish', 'mulloway', 'tailor'];

export const species = [
  ...SHARED.map(id => lake.find(s => s.id === id)).filter(Boolean),
  fishCard('squid', {
    group: 'invertebrate', feeding: 'carnivore', trophic: 'Secondary consumer', size: 'Total length usually 14–38 cm', depth: 'Mid-water at the wharf, drawn up into the lamp light at dusk and night',
    role: 'A fast, intelligent mollusc that hunts small fish and prawns, and is food for kingfish, mulloway and seabirds.',
    interactions: ['Eats baitfish such as yakka, and prawns', 'Is drawn up to the lamp light by the baitfish that gather there', 'Escapes by jet propulsion and a cloud of ink'],
    fieldNotes: 'Southern calamari are caught on a squid jig (spikes only, no barbed hook) at dusk and night, under the wharf lamps. They pulse gently, then jet backwards, so ease off when you feel the squeeze. The bag limit of 20 counts squid and cuttlefish together.',
    threats: 'Loss of seagrass and weed where they lay eggs; fishing pressure.',
  }),
  fishCard('cuttlefish', {
    group: 'invertebrate', feeding: 'carnivore', trophic: 'Secondary consumer', size: 'Total length usually 15–45 cm', depth: 'Over sand and weed in the basin, at dusk and night',
    role: 'A camouflage expert that creeps over the sand and weed ambushing prawns, crabs and small fish.',
    interactions: ['Eats crabs, prawns and small fish', 'Changes colour and texture in a blink to match the bottom', 'Eaten by larger fish, dolphins and seals'],
    fieldNotes: 'Cuttlefish take a squid jig too. They share the squid bag limit of 20. They carry a chalky cuttlebone inside the body to control how they float.',
    threats: 'Loss of weed and seagrass habitat; fishing pressure.',
  }),
  fishCard('yakka', {
    feeding: 'carnivore', trophic: 'Secondary consumer', depth: 'In schools around the wharf pylons, up in the lamp light at night',
    role: 'A small schooling fish that eats plankton and is the main food of kingfish, mulloway and squid at the wharf.',
    interactions: ['Eats plankton drifting past the pylons', 'Gathers in the wharf lamps because plankton does', 'Eaten by squid, kingfish, mulloway, tailor and birds'],
    fieldNotes: 'Yakka are caught on a small hook with prawn or pilchard and kept alive as bait for bigger fish. The bag limit is 50, with no minimum size. Tough, bony scutes along the lateral line are how you tell a scad from a mackerel.',
    threats: 'Few: they are plentiful, but they are an important link in the food web, so taking too many affects the fish that eat them.',
  }),
  fishCard('slimymackerel', {
    feeding: 'carnivore', trophic: 'Secondary consumer', depth: 'In schools in open water along the wharf and the breakwall',
    role: 'A fast schooling fish that eats plankton and small fish, and is eaten by tuna, kingfish and dolphins.',
    interactions: ['Eats plankton and tiny fish', 'Eaten by kingfish, bonito and sharks', 'Forms big schools that herd baitfish'],
    fieldNotes: 'Slimy mackerel are oily and make excellent bait. Bag limit 50, no minimum size. Wavy dark lines on a blue-green back separate them from the yakka.',
    threats: 'Few, but they are a key food for bigger fish.',
  }),
];
