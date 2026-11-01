// TideLine – Offshore reef species cards: click an animal to read one. Data only, Australian English.
// The reef cards re-use the rocky shore's and the harbour's cards where the animal is the same (blue groper, red morwong, kingfish, snapper, wobbegong, tailor, salmon, trevally, yakka, slimy mackerel) and add
// the reef's own: jackass morwong and bonito. Facts that must match the rules come from fishing/species.js.
// Teacher note: bag and size limits follow DPIRD / worksheet values checked 31 Oct - 1 Nov 2026; check the DPIRD page before class use.
import { fishCard } from './cards.js';
import { species as rocky } from './rocky.js';
import { species as harbour } from './harbour.js';

const FROM_ROCKY = ['bluegroper', 'redmorwong', 'kingfish', 'snapper', 'wobbegong', 'australiansalmon'];
const FROM_HARBOUR = ['silvertrevally', 'yakka', 'slimymackerel', 'tailor'];

export const species = [
  ...FROM_ROCKY.map(id => rocky.find(s => s.id === id)).filter(Boolean),
  ...FROM_HARBOUR.map(id => harbour.find(s => s.id === id)).filter(Boolean),
  fishCard('jackassmorwong', {
    feeding: 'carnivore', trophic: 'Secondary consumer', depth: 'Over reef and rubble edges, about 30 to 100 m (the reef edge here)',
    role: 'A bottom-feeder that picks crabs, worms, small shellfish and squid off the reef edge.',
    interactions: ['Eats crustaceans, worms and small molluscs from the rubble', 'Eaten by larger reef fish and sharks', 'Shares the reef edge with red morwong and snapper'],
    fieldNotes: 'Jackass morwong take cut squid or pilchard on a paternoster rig right on the bottom. They have a long trailing pectoral fin and thick lips. The Eastern stock is now rated DEPLETED, so snapper or kingfish on the same reef are the better stocks to target.',
    threats: 'Overfishing of the Eastern stock; it moved from sustainable to depleted in the 6th edition of the national stock report.',
  }),
  fishCard('bonito', {
    feeding: 'carnivore', trophic: 'Tertiary consumer', depth: 'Open water over and around reefs, near the surface',
    role: 'A fast, schooling predator in the tuna family that chases baitfish such as yakka and pilchards.',
    interactions: ['Hunts yakka, pilchards and squid', 'Works baitfish up to the surface, drawing birds', 'Eaten by larger sharks and marlin'],
    fieldNotes: 'Bonito hit a fast-retrieved metal slug and make a very strong run. Dark stripes along the back, sharp cone-shaped teeth and a tuna-like body tell them from tailor. Bag limit 10, no minimum size.',
    threats: 'Few; widespread and rated sustainable.',
  }),
];
