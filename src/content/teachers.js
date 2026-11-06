// The two teachers who talk to you on the club radio. This file holds ONLY their mission lines for now (the opening scene is a later job).
// WILSON_OK is the one switch for Mr Wilson: while it is false nothing that names or voices him is used (his missions are hidden and his
// lines are dropped), so a build can go live without him until his consent is confirmed.
export const WILSON_OK = true;

/** Mission radio lines by mission id. A line is a string (spoken by the mission's giver) or { who, text } for another voice. {name} = the player's name. */
export const MISSION_RADIO = {
  'first-lines': [
    'Good work, {name}. Two careful measures and your licence quiz passed. That is how every good angler starts.',
    'A cap for your kit: wear it from the quest log (Q). Keep going, the next job is waiting there too.',
  ],
  'know-tackle': [
    'Wilson here, {name}. A knot you can trust, a float rig that works and a bream mastered. Good tackle is half the job.',
    'Another hat for your kit. Wear it from the quest log (Q).',
  ],
  'the-rules': [
    'Two small fish back in the water with wet hands, and a flathead measured inside its slot. Small fish grow into the big breeders, so well done.',
    'A new hat is in your kit (quest log, Q). See what is next there.',
  ],
  'structure': [
    'Wilson again. You freed your line from a snag without losing your rig. Patience beats pulling.',
    'Wear your new hat from the quest log (Q).',
  ],
  'the-guide': [
    'Five fish named with the key, {name}. That is real science: you looked closely, you tested and you decided.',
    { who: 'mrwilson', text: 'Five species also opens Belmore Basin harbour for you. Plenty of new fish to see there.' },
    'There is a hat in your kit for this one (quest log, Q). The people along the coast have more jobs when you are ready.',
  ],
};
