// Tips and gossip rotate with the day's tide, time of day and season. A line may carry { tide: [...], time: [...], season: [...] }; it is only told
// when every condition it names matches today. Lines that name more conditions come first, so a tip that fits today's tide and time is told before
// the general ones. `rot` (how many times you have asked this person) walks through the list, so you hear something new each time.
// Pure functions, unit-tested in tests/npc.test.mjs.

export const specificity = line => (line.tide ? 1 : 0) + (line.time ? 1 : 0) + (line.season ? 1 : 0);
export const matches = (line, cond) =>
  (!line.tide || line.tide.includes(cond.tide)) && (!line.time || line.time.includes(cond.time)) && (!line.season || line.season.includes(cond.season));

/** The lines that can be told today, most specific first (stable order within a group). */
export function eligible(lines, cond) {
  return lines.map((l, i) => ({ l, i })).filter(x => matches(x.l, cond)).sort((a, b) => specificity(b.l) - specificity(a.l) || a.i - b.i).map(x => x.l);
}
/** The line for this time you ask: { line, index } or null when there is nothing to tell today. */
export function pickLine(lines, cond, rot = 0) {
  const list = eligible(lines ?? [], cond);
  if (!list.length) return null;
  const index = ((rot % list.length) + list.length) % list.length;
  return { line: list[index], index };
}
