// TideLine – River species cards: click an animal to read one. Data only, Australian English.
// Australian bass, common carp (an introduced pest) and the shortfin eel; the facts that must match the rules come from fishing/species.js.
// Carp: teach "best practice" (dispatch it humanely and bin it, never move live carp), never "the law" (dataset B2: returning a carp is not taught as an offence).
import { fishCard } from './cards.js';

export const species = [
  fishCard('australianbass', {
    feeding: 'carnivore', trophic: 'Secondary consumer', depth: 'Pools, snags and undercut banks of coastal rivers',
    role: 'A native perch that ambushes shrimps, insects and small fish from cover. It breeds in the brackish water at the river mouth.',
    interactions: ['Eats shrimps, insects and small fish', 'Hides in snags and under overhanging banks', 'Eaten by eels and birds when young'],
    fieldNotes: 'Bass hit a soft plastic worked along the snags at dawn and dusk. When hooked they dive for the timber, so keep the rod up and turn them. Bag 2 (with estuary perch), only 1 over 35 cm, and the river is closed to keeping them from May to August so the fish can spawn.',
    threats: 'Weirs and dams that block their migration, poor water quality, and loss of snags and bank plants.',
  }),
  fishCard('carp', {
    feeding: 'omnivore', trophic: 'Secondary consumer', depth: 'The muddy bottom of still pools',
    role: 'An introduced bottom-feeder. It stirs up the mud while it feeds, clouding the water and uprooting the plants that native fish and their young need.',
    interactions: ['Roots up the bottom for worms, snails and plants', 'Muddy water starves water plants of light', 'Competes with native fish'],
    fieldNotes: 'Carp are strong fighters on a running sinker rig. They are a pest, so there is no size or bag limit. Best practice, which DPIRD encourages, is to dispatch a carp humanely and put it in the bin, and never to move live carp from one water to another.',
    threats: 'It is the threat: carp are an introduced pest that harm river health.',
    sources: ['TideLine species data (NSW DPIRD: no limits for non-native finfish)', 'NSW DPIRD – pest fish (best practice is flagged for checking in the dataset)'],
  }),
  fishCard('shortfineel', {
    feeding: 'carnivore', trophic: 'Secondary consumer', depth: 'Rivers, creeks and estuaries, hiding in snags and holes by day',
    role: 'A snake-like fish that hunts at night for worms, shrimp, insects and small fish.',
    interactions: ['Eats worms, shrimps and small fish at night', 'Hides in snags and holes by day', 'Eaten by birds and larger fish when young'],
    fieldNotes: 'Eels take a worm or fish strip on a running sinker after dark. The minimum is 30 cm for shortfin eels (longfin eels have a 58 cm minimum). Bag limit 10.',
    threats: 'Weirs that block their migration and loss of river habitat.',
  }),
];

/**
 * The freshwater licence note: every line is from the content dataset (C9 the fee, C10 who is exempt, C11 where the fee goes, C12 FishSmart). Shown once when you first fish the river
 * and on the noticeboard by the bank. No fee level is invented; the dataset says "check date".
 */
export const LICENCE = {
  title: 'Freshwater fishing: the fee and the rules',
  lines: [
    'Fishing in NSW needs the recreational fishing fee if you are 18 or over. It is 3 days $7, 1 month $14, 1 year $35 or 3 years $85 (check the current date and amounts on the DPIRD page).',
    'Under 18? You do not pay, but you must still follow every rule: size, bag and closed seasons.',
    'The money goes to the Recreational Fishing Trusts, which pay for habitat, fish stocking and facilities in both saltwater and freshwater.',
    'Rules differ by waterway and season, so check the free FishSmart app or the DPIRD page before you fish.',
  ],
  src: 'dataset C9, C10, C11, C12 (worksheet 2.1.14; DPIRD)',
};
/** The bass and estuary perch closed season (dataset A2 and A3, DPIRD). */
export const BASS_SEASON = {
  months: [4, 5, 6, 7], label: 'May to August',
  text: 'Closed season for Australian bass and estuary perch in rivers and estuaries: May to August, so the fish can spawn. You may still fish, but every bass must be returned (catch and release only). It is open all year in dams.',
  src: 'dataset A2, A3 (DPIRD)',
};
