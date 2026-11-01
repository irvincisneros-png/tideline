// Which sites are open? A site may list `unlock: { type, n, label }` (a request `need`, see npc/requests.js progressOf), or a combination:
//   { type: 'all', label, parts: [{ type: 'rod', minTier: 2, short }, { type: 'identifiedCount', n: 8, short }] }   every part must be met.
// Belmore Basin opens once five species are Identified; the offshore reef needs the Estuary spin rod (or better) AND eight species Identified; the river needs six.
// Pure: the picker shows the requirement and a progress count, and switchEco refuses a locked site. A deep link (?eco=reef, used by teachers and the tests) opens any site.
import { progressOf } from '../npc/requests.js';
import { owns } from '../economy/store.js';
import { SHOP } from '../content/shop.js';

/** The best rod tier you own (1 = the starter rod). */
export function rodTier(progress) {
  return SHOP.filter(i => i.cat === 'rod' && owns(progress, i)).reduce((m, i) => Math.max(m, i.tier), 1);
}
/** How far along one requirement is: { have, need, done, text }. Adds the `rod` kind (own a rod of at least minTier) to the request needs. */
export function partProgress(part, progress) {
  if (part.type === 'rod') {
    const have = rodTier(progress), done = have >= part.minTier, item = SHOP.find(i => i.cat === 'rod' && i.tier === part.minTier);
    return { have: done ? 1 : 0, need: 1, done, text: `Own the ${item?.name ?? 'a better rod'} or better${done ? '' : ' (buy it at Mitra\'s shop)'}` };
  }
  return progressOf(part, progress);
}

/** { locked, have, need, text, label, detail, progressText, parts } for a site: locked is false when it has no requirement or every part is met. */
export function siteLock(progress, eco) {
  const u = eco?.unlock;
  if (!u) return { locked: false, have: 1, need: 1, text: '', label: '', detail: '', progressText: '', parts: [] };
  if (u.type === 'all') {
    const parts = u.parts.map(pt => { const pr = partProgress(pt, progress); return { ...pr, short: pt.short ?? pr.text }; });
    const have = parts.filter(x => x.done).length, need = parts.length, text = u.label ?? parts.map(x => x.text).join(' and ');
    return { locked: have < need, have, need, text, label: text, detail: parts.map(x => `${x.done ? '✔' : '✖'} ${x.short}${x.need > 1 ? ` (${x.have} of ${x.need})` : ''}`).join(' · '),
      progressText: parts.map(x => `${x.short}: ${x.need > 1 ? `${x.have} of ${x.need}` : x.done ? 'done' : 'not yet'}`).join('; '), parts };
  }
  const pr = progressOf(u, progress), text = u.label ?? pr.text;
  return { locked: !pr.done, have: pr.have, need: pr.need, text, label: text, detail: `${text} (${pr.have} of ${pr.need})`, progressText: `${pr.have} of ${pr.need}`, parts: [{ ...pr, short: text }] };
}
