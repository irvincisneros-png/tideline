// The dichotomous key: a binary key built from the per-species visible features in species.js (FEATURES).
// Every couplet is "a" or "b" about ONE feature ("1a Body flattened from top to bottom -> 2 / 1b Body not flattened -> 5").
// The key is generated, never hand-written, so it grows when species are added: at each step it picks the question that splits the
// remaining species most evenly (ties go to the feature order below, then the value order), so the same species always give the same key.
// tests/key.test.mjs: every species reaches its own leaf, the key is deterministic, and no path is longer than 7 couplets.
import { SPECIES } from './species.js';

/** Feature order (ties in the splitter go to the earlier feature) and the wording of each possible answer. `a` is the statement for
 *  "has this value", `b` the statement for "does not". `look` is the help line shown under the couplet. */
export const FEATURE_DEFS = [
  { id: 'body', label: 'Body shape', look: 'Turn the fish and look at it from above, from the side and head-on. A torpedo is plump and thick through the middle; a long, slim fish looks thin for its length (skinnier than a tailor or a mackerel).', values: {
    flattened: { a: 'Body flattened from top to bottom (wider than it is deep, like a doormat)', b: 'Body not flattened from top to bottom', name: 'flattened' },
    torpedo: { a: 'Body torpedo-shaped: plump and muscular, thick through the middle and tapering to the tail (like a tailor or a tuna)', b: 'Body not torpedo-shaped', name: 'torpedo-shaped' },
    deep: { a: 'Body deep and oval, flattened from side to side', b: 'Body not deep and oval', name: 'deep and oval' },
    slim: { a: 'Body long and slim, like a pencil: thin for its length, much skinnier than a torpedo-shaped fish', b: 'Body not long and pencil-slim', name: 'long and slim' },
    snake: { a: 'Body long and snake-like, with the fins running along it', b: 'Body not snake-like', name: 'snake-like' },
    tentacles: { a: 'Soft tube of a body with arms and tentacles (no bones, no scales)', b: 'Body has bones and scales, no tentacles', name: 'tentacled' },
  } },
  { id: 'tail', label: 'Tail', look: 'Look at the back edge of the tail fin.', values: {
    forked: { a: 'Tail forked: a V-shaped notch in the back edge', b: 'Tail not forked', name: 'forked' },
    truncate: { a: 'Tail straight-edged (the back edge is cut square)', b: 'Tail not straight-edged', name: 'straight-edged' },
    rounded: { a: 'Tail rounded, like a paddle', b: 'Tail not rounded', name: 'rounded' },
    none: { a: 'No separate tail fin (the fins run along the sides)', b: 'A tail fin is present', name: 'no tail fin' },
  } },
  { id: 'yellow', label: 'Yellow on the fins', look: 'Check every fin and the tail for a yellow wash.', values: {
    tail: { a: 'Yellow tail', b: 'Tail not yellow', name: 'yellow-tailed' },
    fins: { a: 'Yellow on the fins behind the head and belly (the tail is not yellow)', b: 'Fins not yellow', name: 'yellow-finned' },
    none: { a: 'No yellow on the fins or the tail', b: 'Some yellow on the fins or the tail', name: 'no yellow' },
  } },
  { id: 'markings', label: 'Markings', look: 'Look along the back and sides for dark marks or a pattern.', values: {
    stripes: { a: 'Stripes running along the body', b: 'No stripes along the body', name: 'striped' },
    bars: { a: 'Dark bars running up and down the sides', b: 'No up-and-down bars', name: 'barred' },
    spots: { a: 'Many spots or blotches over the back and sides', b: 'Not covered in spots or blotches', name: 'spotted' },
    blotch: { a: 'A single dark spot near the gill cover', b: 'No single dark spot by the gill cover', name: 'one spot' },
    patchwork: { a: 'Skin patterned like a patchwork carpet', b: 'Skin not carpet-patterned', name: 'carpet-patterned' },
    none: { a: 'Plain, no markings', b: 'Marked with spots, bars, stripes or a pattern', name: 'plain' },
  } },
  { id: 'colour', label: 'Colour', look: 'What is the main colour of the back and sides?', values: {
    silver: { a: 'Silvery body', b: 'Body not silvery', name: 'silvery' },
    sandy: { a: 'Sandy or brownish body, camouflaged', b: 'Body not sandy', name: 'sandy' },
    red: { a: 'Pink to red or orange body', b: 'Body not pink, red or orange', name: 'red' },
    dark: { a: 'Dark body, olive-black to grey', b: 'Body not dark', name: 'dark' },
    blue: { a: 'Blue body', b: 'Body not blue', name: 'blue' },
    brown: { a: 'Olive-brown body', b: 'Body not olive-brown', name: 'olive-brown' },
    pink: { a: 'Pale pink, see-through body', b: 'Body not pale pink', name: 'pale pink' },
  } },
  { id: 'jaw', label: 'Jaws and head', look: 'Look at the snout and mouth from the side.', values: {
    beak: { a: 'Lower jaw drawn out into a long beak', b: 'No long beak', name: 'beaked' },
    pointed: { a: 'Long, pointed snout with a small mouth', b: 'Snout not long and pointed', name: 'pointed snout' },
    blunt: { a: 'Short, blunt, rounded head with a small mouth', b: 'Head not blunt and rounded', name: 'blunt head' },
    large: { a: 'Big mouth that reaches back to the eye', b: 'Mouth not big', name: 'big mouth' },
    small: { a: 'Small mouth, well in front of the eye', b: 'Mouth not small', name: 'small mouth' },
    'thick-lips': { a: 'Thick, fleshy lips', b: 'Lips not thick', name: 'thick lips' },
    tentacles: { a: 'Mouth ringed by arms', b: 'Mouth not ringed by arms', name: 'arms around mouth' },
  } },
];
const DEF = Object.fromEntries(FEATURE_DEFS.map(f => [f.id, f]));
const valueOrder = f => Object.keys(DEF[f].values);

/** Build the key for a list of species ({ id, feat }). Returns { couplets: {n: couplet}, first: 1, depth, leaves: {id: depth} }.
 *  couplet = { n, feature, value, a: { text, to }, b: { text, detail, to }, ids }, where `to` is { couplet: n } or { leaf: speciesId }. */
export function buildKey(species) {
  const list = [...species].sort((x, y) => (x.id < y.id ? -1 : 1));
  const byId = Object.fromEntries(list.map(s => [s.id, s]));
  const couplets = {}, leaves = {}; let counter = 0, depth = 0;
  const build = (ids, d) => {
    if (ids.length === 1) { leaves[ids[0]] = d - 1; depth = Math.max(depth, d - 1); return { leaf: ids[0] }; }
    let best = null;
    FEATURE_DEFS.forEach((f, fi) => {
      valueOrder(f.id).forEach((v, vi) => {
        const A = ids.filter(id => byId[id].feat[f.id] === v);
        if (!A.length || A.length === ids.length) return;
        // Splits that keep the bigger side under 3/4 of the species count as equally good, so the usual reading order of a field key
        // (body shape first, then the tail, the fins, markings, colour and the head) decides; otherwise the more even split wins.
        const ratio = Math.max(A.length, ids.length - A.length) / ids.length;
        const cost = (ratio <= 0.75 ? 0 : 1 + Math.floor((ratio - 0.75) * 40)) * 1000 + fi * 10 + vi;
        if (!best || cost < best.cost) best = { cost, f, v, A };
      });
    });
    if (!best) throw new Error(`Species ${ids.join(', ')} cannot be told apart by their features`);
    const n = ++counter, rest = ids.filter(id => !best.A.includes(id)), txt = DEF[best.f.id].values[best.v];
    const others = [...new Set(rest.map(id => byId[id].feat[best.f.id]))].map(v => DEF[best.f.id].values[v].name);
    const c = couplets[n] = {
      n, feature: best.f.id, value: best.v, ids, look: best.f.look, label: best.f.label,
      a: { text: txt.a, to: null },
      b: { text: txt.b, detail: others.length > 1 ? `${others.slice(0, -1).join(', ')} or ${others.at(-1)}` : others[0], to: null },
    };
    // Numbers are given in reading order: everything under 'a' is numbered before 'b'.
    const sub = (set) => { const r = build(set, d + 1); return typeof r === 'number' ? { couplet: r } : r; };
    c.a.to = sub(best.A);
    c.b.to = sub(rest);
    return n;
  };
  const first = build(list.map(s => s.id), 1);
  return { couplets, first, depth, leaves };
}

export const KEY = buildKey(SPECIES);

/** Which answer ('a' or 'b') is true for this species at this couplet. */
export const answerFor = (couplet, species) => (species.feat[couplet.feature] === couplet.value ? 'a' : 'b');

/** Follow a list of answers from the start: returns { leaf } when it ends, else { couplet } for the next question. */
export function walk(key, answers) {
  let at = { couplet: key.first };
  for (const a of answers) { if (!at.couplet) break; at = key.couplets[at.couplet][a].to; }
  return at;
}

/** The answers that lead to this species (what a careful player picks). */
export function pathTo(key, species) {
  const out = []; let at = { couplet: key.first };
  while (at.couplet) { const a = answerFor(key.couplets[at.couplet], species); out.push(a); at = key.couplets[at.couplet][a].to; }
  return out;
}
