// The two teachers: their mission radio lines and the opening scene (ui/intro.js). Every line a student reads from them is here, owner-editable.
// WILSON_OK is the one switch for Mr Wilson: while it is false nothing that names or voices him is used (his missions are hidden, his radio
// lines are dropped, he does not stand on the lake and Mr Cisneros says his opening lines in his own voice), so a build can go live without him
// until his consent is confirmed.
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

// ---------------------------------------------------------------------------------------------------------------------------------------
// The teachers' opening ("Day 2"). Short, kind, two sentences at most. No selling of catch and no First Nations content here.
//   { who, text, alt? }  who = 'mrcisneros' | 'mrwilson'. {name} = the player's angler name. With WILSON_OK false a Mr Wilson line is spoken by
//   Mr Cisneros instead (`alt` if given, else `text`), so the opening is complete either way.

/** The tutorial fish is a yellowfin bream UNDER the legal length (RULES.yellowfinbream.min, 25 cm), so measuring before you decide pays off at once. */
export const TUTORIAL_FISH = { id: 'yellowfinbream', lo: 22, hi: 24 };

export const INTRO = {
  meet: [
    { who: 'mrcisneros', text: "G'day {name}, I'm Mr Cisneros! Your goal is to complete the Illawarra Fish Guide: every kind of fish on this coast." },
    { who: 'mrwilson', text: "Mr Wilson here. This is your rod, a running sinker rig, a tub of prawns and your measuring board.", alt: 'Here is your rod, a running sinker rig, a tub of prawns and your measuring board.' },
    { who: 'mrwilson', text: "I've tied this knot for you. The next one's yours, in Mission 2.", alt: "I've tied this knot for you. You'll tie your own a little later." },
    { who: 'mrcisneros', text: 'Our motto: “Gotta catch ’em all… and release the small.” Walk to the glowing ring on the shore and let’s catch one.' },
  ],
  /** Inline tips in the catch panel (never a dialogue over a modal). {min} = the legal length, {cm} = what the student measured. */
  tips: {
    measure: { who: 'mrwilson', text: 'Mouth closed, snout on the 0 stop, then slide the marker to the tail tip. Read it carefully.', alt: 'Mouth closed, snout on the 0 stop, then slide the marker to the tail tip. Read it carefully.' },
    decide: { who: 'mrwilson', text: 'The board says a yellowfin bream must be {min} cm to keep. Yours measured {cm} cm.', alt: 'The board says a yellowfin bream must be {min} cm to keep. Yours measured {cm} cm.' },
    release: { who: 'mrwilson', text: 'Wet your hands first, then hold the button to unhook. Be gentle and quick.', alt: 'Wet your hands first, then hold the button to unhook. Be gentle and quick.' },
  },
  /** The student tapped Keep on the undersize fish: nothing is written, they go back to the choice. */
  keepCard: { title: 'Have another look at that board', text: 'This bream is under the legal length, so it cannot go in the esky. Check the rule below, then choose again.' },
  /** The two lines of help on the catch bar for the tutorial fish. */
  fight: ['Hold Space (or press the bar) to lift the green zone.', 'Keep the fish inside the zone to fill the meter. This one cannot get away.'],
  missedStrike: 'Too slow, it let go! Watch the float and strike the moment it dips.',
  send: [
    { who: 'mrcisneros', text: 'Mission 1 is on your screen: measure fish within 1 cm and pass Mitra’s licence quiz. Finish it and you earn a hat.' },
    { who: 'mrwilson', text: 'We’ll call you on the radio when you finish a job. Keep an ear out.', alt: 'I’ll call you on the radio when you finish a job. Keep an ear out.' },
    { who: 'mrcisneros', text: 'One rule for the whole coast: you can’t sell your catch in NSW. Fish are never for sale.' },
    { who: 'mrcisneros', text: 'Club credits come from good records instead: careful measures, tags and clean-ups. Spend them at Mitra’s shop.' },
  ],
};

/** Shown (one line) when the student tries something the opening has switched off. */
export const INTRO_HINTS = {
  walk: 'Stay by the lake corner for this first fish. You can explore afterwards.',
  map: 'The map opens once your first fish is logged.',
  home: 'You can head home once your first fish is logged.',
  tackle: 'Your tackle is set for this fish. You can change it afterwards.',
  rod: 'Keep your rod out for this one. You are nearly there.',
  rodFar: 'Walk to the glowing ring on the shore first.',
  talk: 'Finish this first fish, then come and chat.',
};
/** The goal line shown while the student has nothing else on screen. */
export const INTRO_GOALS = {
  walk: 'Walk to the glowing ring on the shore',
  rod: 'Press R to take out your rod',
};

/** Bev’s first radio call (the old premise card, moved here): fired once, the first time the student is ready to fish after the opening. */
export const BEV_CALL = [
  "G'day {name}, Bev here on the club radio! I run the club comps over at Bellambi, so look out for me.",
  'Every fish climbs four tiers in the Fish Guide: <b>Seen</b> (you spotted it), <b>Caught</b> (it is on your line), <b>Identified</b> (you solved the key to name it) and <b>Mastered</b> (a measure within 1 cm and the right keep-or-release call).',
];
