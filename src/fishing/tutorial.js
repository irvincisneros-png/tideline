// The tutorial fish of the teachers' opening (ui/intro.js): the same yellowfin bream every time, but 22 to 24 cm (random in that band), which is inside the
// species' range and UNDER the legal length, so measuring before you decide pays off in the first minute and the right call is a wet-handed release.
// Pure: the unit tests call it (tests/intro.test.mjs). Nothing here changes a rule or a species number.
import { TUTORIAL_FISH } from '../content/teachers.js';

export const TUTORIAL_BITE_S = [1.6, 3.4];   // seconds from the splash to the bite: always inside the 4 s budget
export const TUTORIAL_MIN_DEPTH = 0.1;       // m of water a tutorial cast needs (the shore flats are shallow close in)

/** The tutorial fish as the fishing code expects a catch: { id, length, gear, tutorial }. rnd: () => [0, 1). */
export function tutorialCatch(rnd = Math.random) {
  const { id, lo, hi } = TUTORIAL_FISH;
  return { id, length: lo + Math.floor(rnd() * (hi - lo + 1)), gear: 1, tutorial: true };
}
/** How long the tutorial bite takes. */
export const tutorialWait = (rnd = Math.random) => TUTORIAL_BITE_S[0] + rnd() * (TUTORIAL_BITE_S[1] - TUTORIAL_BITE_S[0]);
