// Help for a stuck key user (pure functions, no DOM; tests/keyhelp.test.mjs). Three layers, each a little more of a give-away:
//   1. hint level 1: where to look (which 3D view and which part of the fish), without saying the answer
//   2. hint level 2: which option is right for this couplet
//   3. wrongStep(): after a finished key lands on the wrong species, the first couplet where the path left the right one, and why
//   4. walkthrough(): the whole right path, one couplet at a time with the real feature that decides it
// Every reason is built from the species' own FEATURES wording (FEATURE_DEFS), so it can never disagree with the key itself.
import { KEY, FEATURE_DEFS, answerFor } from './key.js';

const DEF = Object.fromEntries(FEATURE_DEFS.map(f => [f.id, f]));
export const VIEW_LABEL = { side: 'Side', top: 'Top', front: 'Front' };

/** Which 3D view shows each feature best, and the part of the fish to look at. `view` may depend on the true value of the species. */
const WHERE = {
  body: { view: v => (v === 'flattened' || v === 'tentacles' ? 'top' : 'side'), part: 'the whole body outline: how thick, thin, deep or flat it is for its length' },
  tail: { view: () => 'side', part: 'the back edge of the tail fin' },
  yellow: { view: () => 'side', part: 'every fin and the tail, looking for a yellow wash' },
  markings: { view: v => (v === 'patchwork' ? 'top' : 'side'), part: 'the back and sides, for dark marks or a pattern' },
  colour: { view: () => 'side', part: 'the main colour of the back and sides' },
  jaw: { view: v => (v === 'blunt' || v === 'thick-lips' || v === 'tentacles' ? 'front' : 'side'), part: 'the snout and the mouth' },
};

/** Where to look for this couplet on this species: { view, viewLabel, part, text }. */
export function whereToLook(couplet, species) {
  const w = WHERE[couplet.feature], view = w.view(species.feat[couplet.feature]);
  return { view, viewLabel: VIEW_LABEL[view], part: w.part, text: `Switch to the ${VIEW_LABEL[view]} view and look at ${w.part}.` };
}

/** The true value of this couplet's feature on this species, as { name, statement } (e.g. { name: 'straight-edged', statement: 'Tail straight-edged (...)' }). */
export function trueFeature(couplet, species) {
  const v = DEF[couplet.feature].values[species.feat[couplet.feature]];
  return { name: v.name, statement: v.a };
}

/** Why `ans` is right at this couplet for this species, in one or two sentences grounded in the species' real feature. */
export function becauseOf(couplet, species, ans = answerFor(couplet, species)) {
  const t = trueFeature(couplet, species);
  return ans === 'a'
    ? `On this fish: ${t.statement}.`
    : `On this fish: ${t.statement}. So it is not ${DEF[couplet.feature].values[couplet.value].name}.`;
}

/** The first couplet on the player's path where their answer differs from the right one, or null when the whole path is right.
 *  path = [{ n, ans }] (the answers in order). Returns { index, n, chosen, correct, label, view, text, retryFrom }. */
export function wrongStep(path, species) {
  for (let i = 0; i < path.length; i++) {
    const c = KEY.couplets[path[i].n], right = answerFor(c, species);
    if (path[i].ans === right) continue;
    const w = whereToLook(c, species), t = trueFeature(c, species);
    return {
      index: i, n: c.n, chosen: path[i].ans, correct: right, label: c.label, where: w,
      chosenText: c[path[i].ans].text, rightText: c[right].text, feature: t,
      text: `You chose ${c.n}${path[i].ans} (${path[i].ans === 'a' ? '' : 'not '}${DEF[c.feature].values[c.value].name}). Look again at ${w.part} in the ${w.viewLabel} view. ${becauseOf(c, species, right)} The right answer here is ${c.n}${right}.`,
    };
  }
  return null;
}

/** The right path as steps: [{ n, label, ans, optionText, where, because }] then the species. Used by "Show me the way". */
export function walkthrough(species) {
  const steps = []; let at = { couplet: KEY.first };
  while (at.couplet) {
    const c = KEY.couplets[at.couplet], ans = answerFor(c, species);
    steps.push({ n: c.n, label: c.label, ans, optionText: c[ans].text, where: whereToLook(c, species), because: becauseOf(c, species, ans) });
    at = c[ans].to;
  }
  return { steps, leaf: at.leaf };
}

/** Hint for a couplet at level 1 (where to look) or 2 (which option): { level, text, option? }. */
export function hintFor(couplet, species, level) {
  const w = whereToLook(couplet, species);
  if (level <= 1) return { level: 1, text: `Hint: ${w.text}`, view: w.view };
  return { level: 2, text: `Hint: ${w.text} The highlighted answer matches what you should see.`, view: w.view, option: answerFor(couplet, species) };
}

/** Full wrong attempts on the same fish after which the walkthrough is offered as the main button. */
export const REVEAL_AFTER = 2;
