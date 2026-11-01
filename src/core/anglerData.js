// Character creator data: the palettes and choices, a friendly-name filter, and helpers to clean up a saved look or roll a random one.
// Pure (no DOM, no three.js), so it is unit-tested in tests/angler.test.mjs. The meshes behind each choice live in land/angler.js.
import { DEFAULT_LOOK } from '../land/angler-defaults.js';

const sw = (v, name) => ({ v, name });
export const PALETTES = {
  skin: [sw(0xf6d7bd, 'Very light'), sw(0xefc19c, 'Light'), sw(0xe0a97c, 'Light olive'), sw(0xc58c5e, 'Medium'), sw(0xa66a42, 'Tan'), sw(0x8a5230, 'Brown'), sw(0x6b3d24, 'Dark brown'), sw(0x4d2b1a, 'Deep brown')],
  hair: [sw(0x2a2020, 'Black'), sw(0x4a2f1d, 'Dark brown'), sw(0x7a4e2c, 'Brown'), sw(0xa4482a, 'Auburn'), sw(0xe0bf6a, 'Blonde'), sw(0xc9ced2, 'Silver'), sw(0x35b3ad, 'Sea teal'), sw(0xf08aa8, 'Bubblegum')],
  hat: [sw(0xe9d9a6, 'Sand'), sw(0xfaf6ea, 'White'), sw(0xf0715a, 'Coral'), sw(0x35b3ad, 'Teal'), sw(0x2f5496, 'Navy'), sw(0xf4c84a, 'Sunny yellow'), sw(0x8fbf8a, 'Sage'), sw(0x4a5560, 'Charcoal')],
  shirt: [sw(0xf0715a, 'Coral'), sw(0x5fb3d6, 'Sky blue'), sw(0xf4c84a, 'Sunny yellow'), sw(0x7fcfa8, 'Mint'), sw(0xb79be0, 'Lilac'), sw(0xf6f1e6, 'White'), sw(0x2f5496, 'Navy'), sw(0x2f9a9a, 'Teal')],
  shorts: [sw(0x2f5496, 'Navy'), sw(0xc9b27a, 'Khaki'), sw(0x4a5560, 'Charcoal'), sw(0x2f9a9a, 'Teal'), sw(0xe0645a, 'Coral'), sw(0x7d8f4a, 'Olive'), sw(0x6f92c4, 'Denim'), sw(0xf2eee2, 'White')],
  rod: [sw(0x3b525c, 'Slate'), sw(0xd9503f, 'Red'), sw(0x2fb3ad, 'Teal'), sw(0xf2b93b, 'Yellow'), sw(0x8bc34a, 'Lime'), sw(0xf08aa8, 'Pink'), sw(0x23272b, 'Black'), sw(0xf28c38, 'Orange')],
};
const st = (id, name) => ({ id, name });
export const STYLES = {
  hairStyle: [st('short', 'Short'), st('long', 'Long'), st('pony', 'Ponytail'), st('buzz', 'Buzz'), st('curly', 'Curly'), st('bun', 'Bun')],
  hatStyle: [st('none', 'No hat'), st('bucket', 'Bucket hat'), st('cap', 'Cap'), st('straw', 'Straw hat'), st('beanie', 'Beanie'), st('wide', 'Wide-brim')],
  pattern: [st('plain', 'Plain'), st('stripes', 'Stripes'), st('flowers', 'Flowers'), st('fishing', 'Fishing shirt')],
  sunnies: [st('none', 'None'), st('round', 'Round'), st('sport', 'Sporty')],
};
/** The form, in order. kind 'swatch' = colours (key into PALETTES), 'pills' = named styles (key into STYLES). `when` hides a row. */
export const SECTIONS = [
  { key: 'skin', label: 'Skin tone', kind: 'swatch' },
  { key: 'hairStyle', label: 'Hair style', kind: 'pills' },
  { key: 'hair', label: 'Hair colour', kind: 'swatch' },
  { key: 'hatStyle', label: 'Hat', kind: 'pills' },
  { key: 'hat', label: 'Hat colour', kind: 'swatch', when: l => l.hatStyle !== 'none' },
  { key: 'sunnies', label: 'Sunnies', kind: 'pills' },
  { key: 'pattern', label: 'Shirt style', kind: 'pills' },
  { key: 'shirt', label: 'Shirt colour', kind: 'swatch' },
  { key: 'shorts', label: 'Shorts or pants colour', kind: 'swatch' },
  { key: 'rod', label: 'Rod colour', kind: 'swatch' },
];

export const NAME_MAX = 16;
// A small local list. Strong words are blocked anywhere in the name (after un-leeting); the others only as a whole word, so real names
// such as Dick, Cockburn or Essex are fine.
const STRONG = ['fuck', 'shit', 'cunt', 'nigg', 'fagg', 'bitch', 'slut', 'whore', 'twat', 'wank', 'bollock', 'dickhead', 'arsehole', 'asshole', 'pussy', 'rapist', 'paedo', 'pedo', 'nazi', 'hitler'];
const WHOLE = ['dick', 'cock', 'prick', 'piss', 'arse', 'ass', 'tit', 'tits', 'boob', 'boobs', 'fag', 'bastard', 'retard', 'spaz', 'rape', 'porn', 'sex', 'kkk', 'damn', 'crap', 'sod', 'turd'];
const INNOCENT = ['scunthorpe', 'penistone', 'shiitake', 'shitake', 'cockburn', 'hancock', 'assam', 'sussex', 'essex', 'middlesex'];   // contain a blocked string but are fine
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '+': 't' };
const unleet = s => s.toLowerCase().replace(/[0-9@$!+]/g, c => LEET[c]);
/** Tidy and check a name. Returns { ok, name, reason }. An empty name is allowed (it becomes "Angler"). */
export function checkName(raw) {
  const name = String(raw ?? '').replace(/[\u0000-\u001f<>"&]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  let flat = unleet(name).replace(/[^a-z]/g, '');
  for (const w of INNOCENT) flat = flat.split(w).join('');                      // "f u c k", "f.u.c.k", "fvck" no, but spaced and dotted yes
  const words = unleet(name).split(/[^a-z]+/).filter(Boolean);
  if (STRONG.some(w => flat.includes(w)) || words.some(w => WHOLE.includes(w))) return { ok: false, name, reason: 'Please pick a friendly name that is fine for the whole class.' };
  return { ok: true, name, reason: '' };
}
export const displayName = n => (n && n.trim() ? n.trim() : 'Angler');

const values = key => PALETTES[key].map(c => c.v);
const ids = key => STYLES[key].map(s => s.id);
/** Fill in anything missing or invalid in a saved look from the defaults. */
export function sanitizeLook(look = {}) {
  const out = { ...DEFAULT_LOOK };
  for (const k of Object.keys(PALETTES)) {
    const v = look?.[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 0xffffff) out[k] = v;
  }
  for (const k of Object.keys(STYLES)) if (ids(k).includes(look?.[k])) out[k] = look[k];
  return out;
}
/** A random look (rng: () => [0, 1)). Pass a seeded rng in tests. */
export function randomLook(rng = Math.random) {
  const pick = a => a[Math.floor(rng() * a.length) % a.length];
  const out = {};
  for (const k of Object.keys(PALETTES)) out[k] = pick(values(k));
  for (const k of Object.keys(STYLES)) out[k] = pick(ids(k));
  return out;
}
/** The saved record: { name, ...look }. A save with no `angler` field has not been through the creator yet. */
export const makeAngler = (name, look) => ({ name: checkName(name).name, ...sanitizeLook(look) });
export function lookOf(angler) { return sanitizeLook(angler ?? {}); }
export const nameOf = p => displayName(p?.angler?.name);
export const swatchName = (key, v) => PALETTES[key].find(c => c.v === v)?.name ?? '';
