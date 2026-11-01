// The tackle shop's rules: what you own, what you have equipped, what is locked, buying, bait stock and collecting bait, and the gear stats the rest of the game reads.
// Pure functions on the saved progress object (no DOM). Unit-tested in tests/economy.test.mjs.
import { SHOP_BY_ID, COLLECT, COLLECT_HOLD_MAX, BAIT_CAP, SHY_SPECIES } from '../content/shop.js';
import { spendCoins, today, ensureEcon } from './coins.js';
import { progressOf } from '../npc/requests.js';
import { grant, hasItem } from '../npc/inventory.js';

export function ensureShop(p) {
  const s = p.shop ??= {};
  s.owned ??= {}; s.equip ??= {}; s.worn ??= {}; s.bait ??= {};
  s.equip.rod ??= 'rod-1'; s.equip.line ??= 'line-std';
  return s;
}
export const baitCount = (p, id) => ensureShop(p).bait[id] ?? 0;
export function addBait(p, id, n) { const b = ensureShop(p).bait; b[id] = Math.min(BAIT_CAP, (b[id] ?? 0) + n); return b[id]; }
/** One bait is used when a fish takes it (a bite). Returns how many are left. */
export function useBait(p, id) { const b = ensureShop(p).bait; b[id] = Math.max(0, (b[id] ?? 0) - 1); return b[id]; }

/** Owned: a starter item, anything bought, or (for items the coast's people also give you) the inventory item. */
export function owns(p, item) {
  if (typeof item === 'string') item = SHOP_BY_ID[item];
  if (!item || item.bait) return false;
  return !!item.starter || !!ensureShop(p).owned[item.id] || (!!item.grants && hasItem(p, item.grants));
}
export const equipped = (p, item) => { const s = ensureShop(p); return item.cat === 'rod' || item.cat === 'line' ? s.equip[item.cat] === item.id : item.slot ? s.worn[item.slot] === item.id : false; };

/** Is the guide progress behind this item met? { have, need, done, text } or null when there is no requirement. */
export const lockOf = (p, item) => (item.req ? progressOf(item.req, p) : null);

/** Can you buy it right now? { ok, reason }. */
export function canBuy(p, item) {
  if (typeof item === 'string') item = SHOP_BY_ID[item];
  if (!item) return { ok: false, reason: 'No such item.' };
  ensureEcon(p);
  if (!item.bait && owns(p, item)) return { ok: false, reason: 'You already own this.' };
  const lock = lockOf(p, item);
  if (lock && !lock.done) return { ok: false, reason: `Locked: ${lock.text} (you have ${lock.have} of ${lock.need}).`, locked: true };
  if (item.bait && baitCount(p, item.bait) >= BAIT_CAP) return { ok: false, reason: 'Your bait tub is full.' };
  if (p.coins < item.price) return { ok: false, reason: `You need ${item.price - p.coins} more credits.`, poor: true };
  return { ok: true, reason: '' };
}
/** Buy an item. Bait packs add to your bait stock; gear and tools become yours (and the matching inventory item is granted). Returns { ok, reason, item }. */
export function buy(p, id) {
  const item = SHOP_BY_ID[id], c = canBuy(p, item ?? id);
  if (!c.ok) return { ...c, item };
  if (!spendCoins(p, item.price)) return { ok: false, reason: 'Not enough credits.', item };
  const s = ensureShop(p);
  if (item.bait) { addBait(p, item.bait, item.qty); if (item.grants) grant(p, item.grants); }
  else {
    s.owned[item.id] = Date.now();
    if (item.grants) grant(p, item.grants);
    if (item.cat === 'rod' || item.cat === 'line') s.equip[item.cat] = item.id;   // a new rod or line goes straight on
  }
  return { ok: true, reason: '', item };
}
/** Equip an owned rod or line. */
export function equip(p, id) {
  const item = SHOP_BY_ID[id];
  if (!item || !owns(p, item) || !(item.cat === 'rod' || item.cat === 'line')) return false;
  ensureShop(p).equip[item.cat] = id; return true;
}
/** Wear (or take off) an owned cosmetic. Returns the look to apply, or null. */
export function wear(p, id) {
  const item = SHOP_BY_ID[id];
  if (!item?.slot || !owns(p, item)) return null;
  const s = ensureShop(p);
  if (s.worn[item.slot] === id) { delete s.worn[item.slot]; return { off: true, item }; }
  s.worn[item.slot] = id; return { look: item.look, item };
}

// ------------------------------------------------------------------ the stats the game reads
/**
 * What your gear does. rod: { zoneMul, drainMul, speedMul }  line: { save, turnMul, shy }  plus the conservation tools.
 * fishing.js passes these to the catch bar and the bite model; nothing about the rods or lines is hard-coded there.
 */
export function gearStats(p) {
  const s = ensureShop(p);
  const rod = SHOP_BY_ID[s.equip.rod]?.rod && owns(p, s.equip.rod) ? SHOP_BY_ID[s.equip.rod] : SHOP_BY_ID['rod-1'];
  const line = SHOP_BY_ID[s.equip.line]?.line && owns(p, s.equip.line) ? SHOP_BY_ID[s.equip.line] : SHOP_BY_ID['line-std'];
  return {
    rodId: rod.id, lineId: line.id, rodName: rod.name, lineName: line.name,
    rod: { ...rod.rod }, line: { ...line.line },
    shy: line.line.shy,
    fineMat: owns(p, 'tool-finemat'), net: owns(p, 'tool-landingnet'), weight: hasItem(p, 'tool-releaseweight'),
  };
}
export { SHY_SPECIES };

// ------------------------------------------------------------------ collecting bait (free, but only at the right spot and inside the daily limit)
/** Can you collect this bait here? { ok, reason, per, left, limit }. */
export function canCollect(p, bait, site) {
  const c = COLLECT[bait];
  if (!c) return { ok: false, reason: 'You cannot collect that.' };
  const e = today(p), got = e.collected[bait] ?? 0;
  const info = { per: c.per, limit: c.limit, got };
  if (c.item && !hasItem(p, c.item)) return { ...info, ok: false, reason: `You need ${c.need}.` };
  if (!c.sites.includes(site)) return { ...info, ok: false, reason: `Collect it at ${c.where}.` };
  const room = c.limit != null ? c.limit - got : Infinity;
  if (room <= 0) return { ...info, ok: false, reason: `You have collected your daily limit (${c.limit}). ${c.rule}` };
  if (baitCount(p, bait) >= (c.limit != null ? BAIT_CAP : COLLECT_HOLD_MAX)) return { ...info, ok: false, reason: 'Your bait tub is full.' };
  return { ...info, ok: true, reason: '', left: room };
}
export function collect(p, bait, site) {
  const c = canCollect(p, bait, site);
  if (!c.ok) return c;
  const e = today(p), n = Math.min(c.per, c.left === Infinity ? c.per : c.left);
  e.collected[bait] = (e.collected[bait] ?? 0) + n;
  addBait(p, bait, n);
  return { ...c, ok: true, got: e.collected[bait], added: n };
}
/** A bait is ready to use: unlocked (see inventory.js) and you have some. Lures need none. */
export const baitReady = (p, bait) => baitCount(p, bait) > 0;
