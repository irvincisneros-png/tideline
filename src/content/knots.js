// The four knots of the knot mini-game (Part 2 of docs/specs/2026-11-06-purpose-onboarding-review.md).
// Pictures are the baked stills in assets/knots/ (drawn from the owner's knots.tsx; never AI pictures of knots). `source` and `overUnder` are copied
// verbatim from assets/knots/index.json (tests/knots.test.mjs checks they still match). Pure data: no DOM.
//
// A step is { img, imgs, say, gesture, ... }:
//   img   the still shown before the step is done (the picture of the step before; on a first step it is the same as imgs[0], drawn faint)
//   imgs  stills revealed by doing the step (a `taps` step reveals one per tap; a `hold` step crossfades through them as you pull)
//   gesture 'drag'  drag the tag-end bead from `from` to `to` (image-relative 0..1; or hold the big button)
//           'taps'  tap n times (`wrap: true` counts toward the wraps; `side` names the line it wraps; a "That's enough" button lets you stop early, which is weak)
//           'wet'   the "Wet it" button, or a tap of Space
//           'hold'  pull tight: hold Space or press and hold the button
//   quick: true marks the steps kept in the 10 s re-tie (one gesture plus the wrap taps); everything not marked is skipped and the picture jumps on.
// Every gesture works with the one big button alone.

/** Not a species file; this empty list only keeps the older scans of src/content/*.js (content and audio tests) happy until they list knots.js. */
export const species = [];

export const KNOT_ORDER = ['uni', 'blood', 'palomar', 'surgeon'];
export const imgFile = name => `${name}.webp`;

export const KNOTS = {
  uni: {
    name: 'Uni knot',
    job: 'Ties line to a hook or swivel',
    where: 'Hooks, swivels and lures at the end of your main line. It slides snug against the eye.',
    wraps: 6,
    quiz: 'Which knot ties your line to a hook or swivel, using six wraps through a loop?',
    source: 'Animated Knots (Uni Knot); Vic Dunaway\'s original uni knot instructions (six turns)',
    overUnder: [
      'Eye: standing line OVER the near rim, U-turn in the hole, tag back UNDER the near rim (line wraps the eye wire once).',
      'Loop: tag runs back along the standing line, turns up OVER the standing line, arcs back towards the eye and comes down OVER both lines (closes the loop).',
      'Each of 6 wraps: UNDER (behind) both lines going up, OVER (in front of) both lines coming down, always inside the loop, working away from the eye.',
      'Tight: coils sit round standing line + tag + loop remnant; tag exits at the end away from the eye.',
    ],
    worksheet: '2.1.6',
    final: 'uni-12',
    steps: [
      { img: 'uni-1', imgs: ['uni-1'], say: 'Thread the tag end through the eye of the hook.', gesture: 'drag', from: [0.52, 0.52], to: [0.73, 0.49] },
      { img: 'uni-1', imgs: ['uni-2'], say: 'Lay the tag back along the line to make a loop.', gesture: 'drag', from: [0.74, 0.3], to: [0.62, 0.53], quick: true },
      { img: 'uni-2', imgs: ['uni-3', 'uni-4', 'uni-5', 'uni-6', 'uni-7', 'uni-8'], say: 'Wrap the tag through the loop, round both lines. Tap once for each wrap.', gesture: 'taps', n: 6, wrap: true, quick: true },
      { img: 'uni-8', imgs: ['uni-9'], say: 'Wet the knot before you pull it tight.', gesture: 'wet' },
      { img: 'uni-9', imgs: ['uni-10', 'uni-11'], say: 'Pull the tag so the coils close up, then pull the main line so the knot slides to the eye.', gesture: 'hold' },
      { img: 'uni-11', imgs: ['uni-12'], say: 'Trim the tag end close to the knot.', gesture: 'taps', n: 1 },
    ],
  },
  blood: {
    name: 'Blood knot',
    job: 'Joins two lines of similar thickness',
    where: 'Joining two lengths of line, for example a leader to your main line.',
    wraps: 5,
    quiz: 'Which knot joins two lines together?',
    source: 'Animated Knots (Blood Knot: five to seven turns each side, tags through the centre gap in opposite directions)',
    overUnder: [
      'Tag A wraps line B 5 times going right: OVER B coming down, UNDER B going up.',
      'Tag A returns above its wraps, goes OVER line A, DOWN through the centre gap, UNDER line B.',
      'Tag B wraps line A 5 times going left, same twist direction: OVER A going up, UNDER A coming down.',
      'Tag B returns below its wraps, goes UNDER line B, UP through the same gap, OVER line A. Tags exit in opposite directions.',
    ],
    worksheet: '2.1.6',
    final: 'blood-16',
    steps: [
      { img: 'blood-1', imgs: ['blood-1'], say: 'Lay the two ends side by side so they overlap.', gesture: 'drag', from: [0.12, 0.6], to: [0.31, 0.53] },
      { img: 'blood-1', imgs: ['blood-2', 'blood-3', 'blood-4', 'blood-5', 'blood-6'], say: 'Wrap the first tag round the other line. Tap once for each of the 5 wraps.', gesture: 'taps', n: 5, wrap: true, side: 'first', quick: true },
      { img: 'blood-6', imgs: ['blood-7'], say: 'Bring the first tag back down through the gap in the middle.', gesture: 'drag', from: [0.52, 0.44], to: [0.52, 0.68], quick: true },
      { img: 'blood-7', imgs: ['blood-8', 'blood-9', 'blood-10', 'blood-11', 'blood-12'], say: 'Now wrap the second tag the other way. Tap once for each of its 5 wraps.', gesture: 'taps', n: 5, wrap: true, side: 'second', quick: true },
      { img: 'blood-12', imgs: ['blood-13'], say: 'Bring the second tag back up through the same gap, so the two tags point opposite ways.', gesture: 'drag', from: [0.48, 0.7], to: [0.48, 0.3] },
      { img: 'blood-13', imgs: ['blood-14'], say: 'Wet the knot before you pull it tight.', gesture: 'wet' },
      { img: 'blood-14', imgs: ['blood-15'], say: 'Pull both main lines slowly so the wraps close up on each other.', gesture: 'hold' },
      { img: 'blood-15', imgs: ['blood-16'], say: 'Trim both tags close to the knot.', gesture: 'taps', n: 1 },
    ],
  },
  palomar: {
    name: 'Palomar knot',
    job: 'Ties a hook or lure to line: the strongest simple knot',
    where: 'Hooks and lures on lighter line. It uses a doubled line, so it takes no more than one overhand knot.',
    quiz: 'Which knot ties a hook or lure on using a doubled line and one overhand knot?',
    source: 'Animated Knots (Palomar Knot): double the line, through the eye, overhand, loop over the hook, tighten, trim',
    overUnder: [
      'Doubled line through the eye: OVER the near rim, UNDER the far rim.',
      'Overhand: the doubled line rises and goes round to make a ring above the line, and crosses OVER the incoming line.',
      'The bight end goes UNDER the incoming line into the ring, up through the middle, and out OVER the top of the ring.',
      'Loop over the hook: the bight surrounds the hook\'s bend and passes OVER the shank, so the hook goes through it.',
      'Finished: the bight sits round the shank by the eye (front leg OVER the shank, back leg UNDER).',
    ],
    worksheet: '2.1.6',
    final: 'palomar-6',
    steps: [
      { img: 'palomar-1', imgs: ['palomar-1'], say: 'Double the line and push the loop through the eye of the hook.', gesture: 'drag', from: [0.5, 0.56], to: [0.77, 0.45] },
      { img: 'palomar-1', imgs: ['palomar-2'], say: 'Tie a loose overhand knot in the doubled line.', gesture: 'drag', from: [0.62, 0.55], to: [0.55, 0.16] },
      { img: 'palomar-2', imgs: ['palomar-3'], say: 'Pass the loop right over the hook.', gesture: 'drag', from: [0.55, 0.16], to: [0.87, 0.7], quick: true },
      { img: 'palomar-3', imgs: ['palomar-4'], say: 'Wet the knot before you pull it tight.', gesture: 'wet' },
      { img: 'palomar-4', imgs: ['palomar-5'], say: 'Pull both ends of the line tight.', gesture: 'hold', quick: true },
      { img: 'palomar-5', imgs: ['palomar-6'], say: 'Trim the tag end.', gesture: 'taps', n: 1 },
    ],
  },
  surgeon: {
    name: 'Surgeon\'s loop',
    job: 'Makes a loop in the end of the line, for a lure or dropper',
    where: 'A fixed loop on the end of your line, so a lure or a dropper can swing free.',
    quiz: 'Which knot makes a loop in the end of the line, for a lure or a dropper?',
    source: 'Animated Knots (Surgeon\'s Loop: a double overhand knot tied in a bight)',
    overUnder: [
      'The doubled line goes down and round to make a ring, and crosses OVER the incoming line.',
      'Pass 1: the bight end goes UNDER the incoming line, down through the ring, out OVER the bottom of the ring.',
      'It comes back up BEHIND the bottom of the ring, then pass 2 goes down through the same ring and out OVER the bottom.',
      'Crossings alternate under/over all the way along (5 crossings: a double overhand).',
    ],
    worksheet: '2.1.6',
    final: 'surgeon-6',
    steps: [
      { img: 'surgeon-1', imgs: ['surgeon-1'], say: 'Fold the end of the line back on itself to double it.', gesture: 'drag', from: [0.35, 0.31], to: [0.73, 0.32] },
      { img: 'surgeon-1', imgs: ['surgeon-2'], say: 'Tie an overhand knot with the doubled line, and leave it loose.', gesture: 'drag', from: [0.73, 0.32], to: [0.81, 0.63] },
      { img: 'surgeon-2', imgs: ['surgeon-3'], say: 'Pass the loop through the ring a second time.', gesture: 'drag', from: [0.81, 0.63], to: [0.52, 0.5], quick: true },
      { img: 'surgeon-3', imgs: ['surgeon-4'], say: 'Wet the knot before you pull it tight.', gesture: 'wet' },
      { img: 'surgeon-4', imgs: ['surgeon-5'], say: 'Pull the loop and both lines slowly until the knot is tight.', gesture: 'hold', quick: true },
      { img: 'surgeon-5', imgs: ['surgeon-6'], say: 'Trim the tag end.', gesture: 'taps', n: 1 },
    ],
  },
};

/** Steps used in a mode: 'full' every step, 'quick' the ones marked quick (one gesture plus the wrap taps). */
export const stepsFor = (id, mode) => (mode === 'quick' ? KNOTS[id].steps.filter(s => s.quick) : KNOTS[id].steps);
