// The player's inventory (progress.inventory) and what it unlocks. Pure functions on the saved progress object.
//   progress.inventory = { have: { itemId: timestamp }, cards: { cardId: timestamp }, worn: itemId | null, lure: colourId | null }
import { ITEMS, CARDS, CARD_ORDER, START_RIGS, START_BAITS } from '../content/items.js';

export const LURE_COLOURS = [
  { id: 'pink', name: 'Pink', css: '#f08aa8' }, { id: 'chartreuse', name: 'Chartreuse', css: '#b8e04a' },
  { id: 'white', name: 'Pearl white', css: '#f6f1e6' }, { id: 'orange', name: 'Orange', css: '#f28c38' },
];

export function ensureInventory(p) {
  p.inventory ??= { have: {}, cards: {}, worn: null, lure: null };
  p.inventory.have ??= {}; p.inventory.cards ??= {};
  return p.inventory;
}
export const hasItem = (p, id) => !!p.inventory?.have?.[id];
export const hasCard = (p, id) => !!p.inventory?.cards?.[id];

/** Reward ids are item ids or card ids. */
export const isCard = id => !!CARDS[id];
export function rewardName(id) { return CARDS[id] ? `Sea Country card: ${CARDS[id].title}` : ITEMS[id]?.name ?? id; }

/** Give an item or a card. Returns true if it is new. */
export function grant(p, id, now = Date.now()) {
  const inv = ensureInventory(p);
  if (CARDS[id]) { if (inv.cards[id]) return false; inv.cards[id] = now; return true; }
  if (!ITEMS[id]) throw new Error(`Unknown reward "${id}"`);
  if (inv.have[id]) return false;
  inv.have[id] = now; return true;
}

const unlockedBy = (kind, id) => Object.entries(ITEMS).find(([, it]) => it.unlocks?.[kind] === id)?.[0] ?? null;
/** Is this rig usable? The starting rigs always are; the rest need the matching item. */
export function rigUnlocked(p, rig) {
  if (START_RIGS.includes(rig)) return true;
  const item = unlockedBy('rig', rig);
  return item ? hasItem(p, item) : false;
}
export function baitUnlocked(p, bait) {
  if (START_BAITS.includes(bait)) return true;
  const item = unlockedBy('bait', bait);
  return item ? hasItem(p, item) : false;
}
/** "Ask Old Tam on the jetty" for a locked rig or bait ('' when it is unlocked or has no source). */
export function lockHint(p, kind, id) {
  if (kind === 'rig' ? rigUnlocked(p, id) : baitUnlocked(p, id)) return '';
  const item = unlockedBy(kind, id);
  return item ? `Ask ${ITEMS[item].ask}` : '';
}
export const earnedCards = p => CARD_ORDER.filter(id => hasCard(p, id));
export const ownedItems = (p, kind) => Object.keys(ITEMS).filter(id => hasItem(p, id) && (!kind || ITEMS[id].kind === kind));
