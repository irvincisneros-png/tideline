// Which sites are open? A site may list `unlock: { type, n, label }` (a request `need`, see npc/requests.js progressOf): Belmore Basin opens once five species are
// Identified in the Fish Guide. Pure: the picker shows the requirement and a progress count, and switchEco refuses a locked site. A deep link (?eco=harbour, used by
// teachers and the tests) opens any site.
import { progressOf } from '../npc/requests.js';

/** { locked, have, need, text, label } for a site: locked is false when it has no requirement or the requirement is met. */
export function siteLock(progress, eco) {
  const u = eco?.unlock;
  if (!u) return { locked: false, have: 1, need: 1, text: '', label: '' };
  const pr = progressOf(u, progress);
  return { locked: !pr.done, have: pr.have, need: pr.need, text: u.label ?? pr.text, label: u.label ?? pr.text };
}
