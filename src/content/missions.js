// The mission spine: a thin pointer over the coast's existing trades (content/npcs.js). Nothing is ever locked by a mission and a mission pays no
// credits and gives no functional item: it adds ONE cosmetic hat (content/items.js, `mission: true`). A trade step pays the trade's own reward
// when it is handed in to its person, as it always did.
//
//   step  { need: {type, ...}, hint? }   done when progressOf(need, progress).done (derived from the logbook and Fish Guide, never a counter)
//         { trade: tradeId }             done when progress.npc.done[tradeId] is set
//         either may carry requires: 'knots' | 'snags': a mechanic that is not built yet (FEATURES below). A mission with such a step is
//         hidden from the chain until the feature is switched on.
//   mission { id, giver, title, chapter, steps, reward (cosmetic item id), radio: [lines], next }
//   giver   a teacher id (mrcisneros | mrwilson, see GIVERS) or a coast person (an id in NPCS). Ranger Jo is never on the spine.
// Order in MISSIONS is the order of the chain; `next` names the mission that follows (a hidden one is skipped over when the chain is walked).
import { MISSION_RADIO } from './teachers.js';

/** Switch these on when the mechanic exists (knots: Day 4, snags: Day 3 of the build plan). Plain object so tests can flip them. */
export const FEATURES = { knots: false, snags: false };

/** Who speaks on the radio for a giver that is not one of the coast's people. */
export const GIVERS = {
  mrcisneros: { name: 'Mr Cisneros', role: 'on the radio', portrait: { skin: '#b98560', hair: '#2f2118', hat: null, shirt: '#2f5496', collar: '#fff3d2', glasses: false, beard: false } },
  mrwilson: { name: 'Mr Wilson', role: 'on the radio', portrait: { skin: '#e2b896', hair: '#6b4a2f', hat: null, shirt: '#3d7fa8', collar: '#fff3d2', glasses: true, beard: false } },
};

const T = id => MISSION_RADIO[id];

export const MISSIONS = [
  { id: 'first-lines', giver: 'mrcisneros', title: 'First lines', chapter: 1,
    steps: [{ need: { type: 'accurateMeasures', n: 2 }, hint: 'Catch fish and measure each one within 1 cm on the brag mat.' },
            { trade: 'mitra-licence' }],
    reward: 'hat-measuring', radio: T('first-lines'), next: 'know-tackle' },
  { id: 'know-tackle', giver: 'mrwilson', title: 'Know your tackle', chapter: 2,
    steps: [{ need: { type: 'knot', id: 'uni', result: 'hold' }, requires: 'knots', hint: 'Tie a uni knot that holds in the pull test.' },
            { trade: 'tam-bream' },
            { need: { type: 'rigCatch', rig: 'float', label: 'float rig' }, hint: 'Land a fish on the float rig you earned.' }],
    reward: 'hat-tackle', radio: T('know-tackle'), next: 'the-rules' },
  { id: 'the-rules', giver: 'mrcisneros', title: 'The rules', chapter: 3,
    steps: [{ need: { type: 'undersizeRelease', n: 2, maxAir: 10 }, hint: 'Release undersize fish with wet hands, back in the water within 10 seconds.' },
            { trade: 'mitra-flathead' }],
    reward: 'hat-fairgo', radio: T('the-rules'), next: 'structure' },
  { id: 'structure', giver: 'mrwilson', title: 'Structure', chapter: 4,
    steps: [{ need: { type: 'snagFreed', n: 1 }, requires: 'snags', hint: 'Free your rig from a snag by tapping, not pulling.' },
            { trade: 'mika-flathead' }],
    reward: 'hat-structure', radio: T('structure'), next: 'the-guide' },
  { id: 'the-guide', giver: 'mrcisneros', title: 'The Guide', chapter: 5,
    steps: [{ trade: 'bev-ident' }],
    reward: 'hat-guide', radio: T('the-guide'), next: 'coast-rock' },
  // The coast chapters: data only, each one a single trade the person already offers. They speak for themselves on the radio.
  { id: 'coast-rock', giver: 'sione', title: 'Rock safe', chapter: 6, steps: [{ trade: 'sione-rock' }], reward: 'hat-rocksafe', next: 'coast-litter',
    radio: ['Sione from the tower. You passed the rock safety quiz, so you know to stay back when the swell is up.', 'A bucket hat for your kit: wear it from the quest log (Q).'] },
  { id: 'coast-litter', giver: 'fatima', title: 'A cleaner shore', chapter: 7, steps: [{ trade: 'fatima-litter3' }], reward: 'hat-cleanshore', next: 'coast-squid',
    radio: ['Fatima here. Three pieces of litter out of the water. Every piece is one less thing for a bird or a turtle to tangle in.', 'There is a cap in your kit now (quest log, Q).'] },
  { id: 'coast-squid', giver: 'nell', title: 'Lights on the wharf', chapter: 8, steps: [{ trade: 'nell-squid' }], reward: 'hat-wharf', next: 'coast-measure',
    radio: ['Nell at the co-op. You named a squid at the wharf, so you know what to look for under the lamps.', 'A beanie is in your kit (quest log, Q).'] },
  { id: 'coast-measure', giver: 'priya', title: 'Citizen science', chapter: 9, steps: [{ trade: 'priya-measure' }], reward: 'hat-citizen', next: 'coast-tag',
    radio: ['Dr Priya calling. Three accurate measures is data a scientist can use. Thank you.', 'A straw hat is in your kit (quest log, Q).'] },
  { id: 'coast-tag', giver: 'priya', title: 'Tag and release', chapter: 10, steps: [{ trade: 'priya-tag' }], reward: 'hat-tagrelease', next: null,
    radio: ['Priya again. Two tagged fish swimming free with a number on them. Scientists will watch for them.', 'A wide-brim hat is in your kit (quest log, Q).'] },
];

export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map(m => [m.id, m]));
