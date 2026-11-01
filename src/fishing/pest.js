// The carp flow: an introduced pest fish. Pure (no DOM), unit-tested in tests/river.test.mjs.
// Teach BEST PRACTICE, never law (owner's spec, dataset B2): the dataset says returning a carp is NOT taught as an offence in NSW; DPIRD encourages keeping and humane disposal, and never moving live carp. The wording is
// kept inside that: "best practice", "DPIRD encourages", no "must", no "illegal". (The best-practice line is tagged [DPIRD-search] in the dataset: flagged for checking before classroom release.)
export const PEST_RULE = 'An introduced pest fish: no size or bag limit in NSW. Best practice is to keep it out of the water: dispatch it humanely and bin it, and never move live carp between waters.';

/** What the verdict card says when you keep (take it out of the river) or return a pest fish: { cls, title, text, steward }. */
export function pestVerdict(keep) {
  return keep
    ? { cls: 'good', title: '✔ Best practice: it comes out of the river', text: 'A pest fish does not go in the esky for the table and it never goes back alive. Dispatch it humanely and put it in the bin, and never move live carp from one water to another.', steward: true }
    : { cls: 'warn', title: 'Back in the water: not best practice', text: 'Carp have no size or bag limit, but DPIRD encourages anglers to keep and humanely dispose of pest fish, because a carp that goes back keeps muddying the river. This is best practice, not a size or bag rule, and other states have different rules. Check the DPIRD page for your waterway.', steward: false };
}
/** Count a pest fish on the save: progress.pest = { removed, returned }. Returns the record. */
export function recordPest(progress, keep) {
  const p = progress.pest ??= { removed: 0, returned: 0 };
  if (keep) p.removed++; else p.returned++;
  return p;
}
/** The words that may never appear in the carp card: the owner's decision is "best practice, not law". */
export const FORBIDDEN_PEST_WORDS = [/\billegal\b/i, /\bit is the law\b/i, /\bmust not be returned\b/i, /\boffence\b/i, /\bfine[ds]?\b/i];
