// The club ceremonies: who speaks, which award they give and what they say about the player's OWN numbers (fishing/ending.js playerStats).
// Every line is a function of the stats so it always quotes the player's real record. Original characters; nothing here teaches a rule.
// Sea Country note: Ranger Jo's line is about looking after fish (releases) in general words only. All Sea Country content still needs review by the school AEO / local AECG.
import { SPECIES_BY_ID } from '../fishing/species.js';

export const TAGLINE = 'Gotta catch ’em all… and release the small.';
export const CLUB = "Illawarra Anglers' Club";
const n = (x, one, many = one === 'fish' ? 'fish' : one + 's') => `${x} ${x === 1 ? one : many}`;
const pct = x => `${Math.round(x)}%`;

/** Awards night: one speech per person. `title` is the award; `line` is what they say. {name} is filled in by the runner. */
export const AWARDS = [
  { npc: 'bev', title: 'Fish Guide Champion', line: s => `Welcome, everyone! Our Fish Guide Champion has Mastered all ${s.total} kinds of fish on this coast. Every one measured, named and handled by the rules. {name}, that is the whole guide!` },
  { npc: 'mitra', title: 'Rules and Rigs', line: s => `I have watched you make ${n(s.correct, 'right call')} out of ${s.fish} catches. Size, bag and rigs: you know them better than some of my regulars. The Rules and Rigs award is yours, {name}.` },
  { npc: 'tam', title: 'Gentle Hands', line: s => `${n(s.releases, 'fish')} put back, and ${s.quickReleases} of them wet-handed and back in the water in ten seconds or less. That is how it is done, {name}. Gentle Hands.` },
  { npc: 'sione', title: 'Safe on the Rocks', line: s => s.safety === 0 ? `Not one safety mark all the way through. You checked the swell and you stayed off the platform when I said so, {name}. Safe on the Rocks.` : `${n(s.safety, 'safety mark')}, and you learned from every one. Lifejacket on, eyes on the swell. Safe on the Rocks, {name}.` },
  { npc: 'fatima', title: 'Clean Coast', line: s => s.litter ? `${n(s.litter, 'piece')} of litter pulled out of the water. Every one is a bird or a turtle that does not get tangled. Clean Coast award, {name}, from the bottom of my bucket!` : `Even without a single piece of litter on the tally, you kept your line out of the water and your rubbish in the bin. Clean Coast award, {name}!` },
  { npc: 'priya', title: 'Citizen Scientist', line: s => `${n(s.accurate, 'measure')} within a centimetre and ${n(s.tags, 'tagged fish', 'tagged fish')} in the database. Good data is how we know the bay is healthy. Citizen Scientist, {name}!` },
  { npc: 'jo', title: 'Looking After the Fish', line: s => `${n(s.releases, 'fish')} went back to swim another day. Looking after the fish means there are fish for the people who come after us. Thank you, {name}.` },
  { npc: 'nell', title: 'Healthy Bay', line: s => `Bay Health is at ${pct(s.bay)}. That is fish for the next generation, and for my trawler and every boat in the basin. Healthy Bay, {name}. When you are ready, come and see me about a co-op licence.` },
  { npc: 'mika', title: 'Best Fishing Buddy', line: s => `You found all ${s.total} kinds of fish, and your biggest was a ${s.best.cm} cm ${s.best.id ? SPECIES_BY_ID[s.best.id].name.toLowerCase() : 'fish'}! I am only a little bit jealous. Best Fishing Buddy, {name}!` },
  { npc: 'officer', title: 'Steward of the Coast', line: s => `A Steward rating of ${s.stars.toFixed(1)} stars${s.fines ? `, even after ${n(s.fines, 'fine')}` : ', and a clean record'}. You follow the rules and you know why they are there. Steward of the Coast, {name}.` },
];

/** The softer ceremony at 100% Caught: four friends, a lighter speech. */
export const MILESTONE = [
  { npc: 'bev', title: 'Every Fish Caught', line: s => `${s.total} kinds of fish, and you have landed every one, {name}! That is the whole Illawarra Fish Guide, caught. Now comes the clever part: name them, measure them and master them.` },
  { npc: 'mika', title: 'Catch-All Champion', line: s => `You caught ${n(s.fish, 'fish', 'fish')} to do it. I only managed a few kinds! Catch-All Champion, {name}.` },
  { npc: 'tam', title: 'Good Hands', line: s => `${n(s.releases, 'fish')} put back so far. Keep doing it: every small fish you release is a bigger fish for next season.` },
  { npc: 'priya', title: 'Scientist’s Thanks', line: s => `${s.identified} of ${s.total} named so far, and ${s.accurate} measures within a centimetre. Keep going: Mastered needs a good measure and the right keep-or-release call.` },
];

/** What is still to do after each ceremony (shown on the end card). */
export function nextSteps(s, bayNeed) {
  const left = s.total - s.mastered;
  const out = [];
  if (left > 0) out.push(`Master ${left} more kind${left === 1 ? '' : 's'} of fish (a name from the key, a measure within 1 cm and the right keep-or-release call).`);
  if (s.bay < bayNeed) out.push(`Lift Bay Health from ${pct(s.bay)} to ${pct(bayNeed)}: release the small ones and stay inside the bag limits.`);
  return out;
}
