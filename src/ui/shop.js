// Mitra's tackle shop (talk menu -> Shop) and the tag recapture letter. Cream cards, dark-teal outlines, big touch targets, works at 375 px and with the keyboard.
// What things cost, what they do and what unlocks them is data in content/shop.js; the rules (buy, equip, locks, bait stock) are in economy/store.js.
// Credits come from the sources in economy/coins.js and never from selling fish (you cannot sell your catch in NSW): the "Earn credits" tab says so.
import { esc } from './panels.js';
import { SHOP, SHOP_CATS, COIN, RATES, COLLECT } from '../content/shop.js';
import { owns, equipped, lockOf, canBuy, buy, equip, wear, baitCount } from '../economy/store.js';
import { compOfDay, today } from '../economy/coins.js';
import { nameOf } from '../core/anglerData.js';
import { BAITS } from '../fishing/gear.js';

const pct = v => Math.round(Math.abs(v - 1) * 100);
/** The stat chips on a card: what the item changes. */
export function chipsOf(item) {
  const out = [];
  if (item.rod) {
    const r = item.rod;
    if (r.zoneMul > 1) out.push(`Catch zone +${pct(r.zoneMul)}%`);
    if (r.drainMul < 1) out.push(`Meter drains ${pct(r.drainMul)}% slower`);
    if (r.speedMul < 1) out.push(`Fish ${pct(r.speedMul)}% slower`);
    if (!out.length) out.push('Baseline');
  }
  if (item.line) {
    const l = item.line;
    if (l.save > 0) out.push(`${Math.round(l.save * 100)}% to hold a bolting fish`);
    if (l.turnMul < 1) out.push(`Turns a bolter ${pct(l.turnMul)}% sooner`);
    if (l.turnMul > 1) out.push(`Bolters ${pct(l.turnMul)}% harder to turn`);
    if (l.shy > 1) out.push(`Shy fish bite ${pct(l.shy)}% more`);
    if (l.shy < 1) out.push(`Shy fish bite ${pct(l.shy)}% less`);
    if (!out.length) out.push('Baseline');
  }
  if (item.bait) out.push(`${item.qty} bait`);
  return out;
}

export function openShop(game, { onClose = null, tab = 'rod', from = null } = {}) {
  const panels = game.panels, p = game.progress;
  let cur = tab, msg = '', focusKey = null;
  p.tips ??= {};
  // The first time the esky has fish and you open the shop: you cannot sell them.
  const sellTip = (p.esky?.length ?? 0) > 0 && !p.tips.shopSell;
  if (sellTip) { p.tips.shopSell = true; game.persist(); }

  const cardState = item => {
    const ownedNow = owns(p, item), lock = lockOf(p, item), can = canBuy(p, item);
    return { ownedNow, lock, can, locked: !ownedNow && lock && !lock.done };
  };
  const actionFor = item => {
    const st = cardState(item);
    if (item.bait) return { label: `Buy ${item.qty}`, act: 'buy', ok: st.can.ok, why: st.can.reason };
    if (st.ownedNow) {
      if (item.cat === 'rod' || item.cat === 'line') return equipped(p, item) ? { label: 'Equipped ✓', act: 'none', ok: false, on: true } : { label: 'Equip', act: 'equip', ok: true };
      if (item.slot) return equipped(p, item) ? { label: 'Take off', act: 'wear', ok: true, on: true } : { label: 'Wear', act: 'wear', ok: true };
      return { label: 'Owned ✓', act: 'none', ok: false, on: true };
    }
    return { label: st.locked ? '🔒 Locked' : 'Buy', act: 'buy', ok: st.can.ok, why: st.can.reason };
  };
  const card = item => {
    const st = cardState(item), a = actionFor(item), stateCls = st.ownedNow ? (equipped(p, item) ? 'equipped' : 'owned') : st.locked ? 'locked' : '';
    const chips = chipsOf(item);
    return `<article class="shop-card ${stateCls}">
      <header><h3>${esc(item.name)}</h3>${item.tier && item.cat === 'rod' ? `<span class="pip">Tier ${item.tier}</span>` : ''}</header>
      ${chips.length ? `<div class="chips">${chips.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
      <p class="blurb">${esc(item.blurb)}</p>
      ${item.why ? `<p class="why"><b>${item.cat === 'conservation' || item.cat === 'bait' ? 'Why it helps' : 'Good to know'}:</b> ${esc(item.why)}</p>` : ''}
      ${item.bait ? `<p class="have">In your tub: <b>${baitCount(p, item.bait)}</b> ${esc(BAITS[item.bait].name.toLowerCase())}</p>` : ''}
      ${st.locked ? `<p class="lock">🔒 ${esc(st.lock.text)} <b>(${st.lock.have} of ${st.lock.need})</b>. Money alone does not unlock it: learn the fish first.</p>` : ''}
      <footer><span class="price">${item.price ? `${COIN.icon} ${item.price}` : 'Free'}</span>
        <button class="btn ${a.ok && !a.on ? 'primary' : ''} ${a.on ? 'on' : ''}" data-act="${a.act}" data-id="${item.id}" ${a.ok ? '' : 'aria-disabled="true"'} data-why="${esc(a.why ?? '')}">${esc(a.label)}</button></footer>
    </article>`;
  };
  const earnTab = () => {
    const e = today(p), c = compOfDay(p.npc?.day ?? 1);
    const row = (icon, title, pay, text) => `<li><span class="ico">${icon}</span><div><b>${esc(title)}</b> <em>${esc(pay)}</em><p>${text}</p></div></li>`;
    return `<div class="earn">
      <div class="earn-law"><b>You can't sell your catch.</b> In NSW recreational fishers may not sell fish, so no fish ever has a price here. A commercial licence (quotas, nets, bycatch) is a different job. ${COIN.name} are paid for <i>good science and good care</i> instead.</div>
      <ul class="earn-list">
        ${row('📒', 'Logbook record', `${COIN.icon} ${RATES.recordBase}`, `Name the fish with the key, measure it within 1 cm and make the right keep-or-release call. <b>+${RATES.firstSpecies}</b> for the first record of a species, <b>+${RATES.newCombo}</b> for a new spot, tide and time. ${RATES.speciesDailyCap} records of one species count per day. Today: ${Object.values(e.speciesToday).reduce((s, n) => s + n, 0)} paid.`)}
        ${row('🏷', 'Tag and release', `${COIN.icon} ${RATES.tagPay}`, `Use Dr Priya's tag kit on a legal-size fish and release it with wet hands in ${10} s or less (${RATES.tagDailyCap} a day). Now and then a <b>recapture letter</b> arrives on a later day: <b>+${RATES.recapture}</b>. Today: ${e.tagsToday} tagged.`)}
        ${row('🏆', "Bev's club comp", `${COIN.icon} ${RATES.compPrizes.join(' / ')}`, `One comp a day at Bellambi; prizes by place (1st, 2nd, 3rd, then the rest). Today: <b>${esc(c.title)}</b>. Settled when you head home.`)}
        ${row('📜', 'Missions', `${COIN.icon} ${RATES.quizPerQuestion} a question, ${RATES.showBase}+ a job`, 'Requests from the people on the coast pay credits on top of their gear. Check the quest log (Q).')}
        ${row('♻', "Fatima's clean-up tally", `${COIN.icon} ${RATES.litterPiece} a piece`, `Steer the green zone over litter on the catch bar, then hand Fatima your tally (up to ${RATES.litterDailyCap} pieces a day).`)}
      </ul>
      <p class="earn-foot">${COIN.icon} Earned so far: <b>${e.earned}</b> ${COIN.name} · in hand: <b>${p.coins}</b>.</p>
      <p class="earn-foot">Free bait: ${Object.keys(COLLECT).map(id => `${esc(BAITS[id].name.toLowerCase())}${COLLECT[id].limit ? ` (limit ${COLLECT[id].limit} a day)` : ''}`).join(', ')}. Collect it yourself in the tackle box (T) at the right spot.</p>
    </div>`;
  };
  const render = () => {
    const cat = SHOP_CATS.find(c => c.id === cur);
    const list = SHOP.filter(i => i.cat === cur);
    const sub = { rod: 'A better rod widens the green zone or slows the fish. The best ones need you to know your fish.', line: 'A real trade-off: strong line holds a bolting fish but shows up to shy ones; light line gets more bites from shy fish but breaks off.', bait: 'Bought bait. Nippers, beach worms and green weed you collect yourself for free, inside the daily limits (tackle box, T).', conservation: 'Gear that helps the fish you let go.', style: 'Hats, shirts and rod colours. They work with the angler creator.', earn: '' }[cur];
    panels.body.innerHTML = `<div class="shop">
      <div class="shop-head"><h2>🛒 ${from === 'mitra' || !from ? "Mitra's tackle shop" : 'Tackle shop'}</h2><div class="shop-coins" aria-live="polite">${COIN.icon} <b>${p.coins}</b> <span>${COIN.name}</span></div></div>
      ${sellTip ? `<div class="shop-tip" role="note"><b>💡 First time with fish in the esky?</b> You can't sell them: NSW recreational fishers may not sell their catch. Earn credits from <button class="link" data-tab="earn">logbook records, tagging, club comps, missions and litter</button>.</div>` : ''}
      <div class="tabs shop-tabs" role="tablist" aria-label="Shop sections">${SHOP_CATS.map(c => `<button role="tab" id="tab-${c.id}" aria-selected="${c.id === cur}" class="${c.id === cur ? 'on' : ''}" data-tab="${c.id}">${c.icon} ${esc(c.label)}</button>`).join('')}</div>
      ${sub ? `<p class="shop-sub">${esc(sub)}</p>` : ''}
      <p class="shop-msg" id="shop-msg" role="status" aria-live="polite">${esc(msg)}</p>
      ${cur === 'earn' ? earnTab() : `<div class="shop-grid" role="tabpanel" aria-labelledby="tab-${cat.id}">${list.map(card).join('')}</div>`}
      <p class="shop-foot"><button class="btn primary" id="shop-done">Done</button></p>
    </div>`;
    const b = panels.body;
    b.querySelectorAll('[data-tab]').forEach(t => t.onclick = () => { cur = t.dataset.tab; msg = ''; focusKey = `tab:${cur}`; render(); });
    b.querySelector('.shop-tabs')?.addEventListener('keydown', e => {
      if (e.code !== 'ArrowRight' && e.code !== 'ArrowLeft') return;
      const i = SHOP_CATS.findIndex(c => c.id === cur), n = (i + (e.code === 'ArrowRight' ? 1 : -1) + SHOP_CATS.length) % SHOP_CATS.length;
      e.preventDefault(); cur = SHOP_CATS[n].id; msg = ''; focusKey = `tab:${cur}`; render();
    });
    b.querySelectorAll('[data-act]').forEach(btn => btn.onclick = () => act(btn));
    b.querySelector('#shop-done').onclick = () => panels.close();
    const f = focusKey && (focusKey.startsWith('tab:') ? b.querySelector(`#tab-${focusKey.slice(4)}`) : b.querySelector(`[data-id="${focusKey}"]`));
    (f ?? b.querySelector('.tabs button.on'))?.focus({ preventScroll: true });
    focusKey = null;
  };
  const act = btn => {
    const id = btn.dataset.id, item = SHOP.find(i => i.id === id), what = btn.dataset.act;
    focusKey = id;
    if (btn.getAttribute('aria-disabled') === 'true') { msg = btn.dataset.why || ''; render(); return; }
    if (what === 'buy') {
      const r = buy(p, id);
      if (!r.ok) msg = r.reason;
      else {
        game.audio.play('newSpecies'); game.persist(); game.updateStats();
        msg = item.bait ? `Bought ${item.qty} ${BAITS[item.bait].name.toLowerCase()}. You have ${baitCount(p, item.bait)}.` : `Bought: ${item.name}.${item.cat === 'rod' || item.cat === 'line' ? ' It is on your rod now.' : ''}`;
        game.toast(`🛒 ${msg}`, 'good');
        if (item.slot) { wear(p, id); applyLook(item, true); }
      }
    } else if (what === 'equip') { if (equip(p, id)) { game.persist(); msg = `Equipped: ${item.name}. It applies to your next fight.`; game.toast(`🎣 ${msg}`, 'good'); } }
    else if (what === 'wear') {
      const r = wear(p, id);
      if (r?.off) { applyLook(item, false); msg = `Took off ${item.name}.`; }
      else if (r) { applyLook(item, true); msg = `Wearing ${item.name}.`; }
    }
    render();
  };
  /** Cosmetics are the character creator's look data (hatStyle, hat, shirt, pattern, rod): wearing one dresses the angler and saves it like the creator does. */
  const applyLook = (item, on) => {
    const before = p.shop.before ??= {};
    if (on) { before[item.slot] ??= Object.fromEntries(Object.keys(item.look).map(k => [k, game.angler.look[k]])); game.setAppearance(item.look); }
    else if (before[item.slot]) { game.setAppearance(before[item.slot]); delete before[item.slot]; }
    game.persist();
  };
  panels.open('', () => { onClose?.(); });
  render();
}

/** "A letter from the tagging program": a tagged fish from an earlier day has been recaptured. Shows what recaptures tell scientists. */
export function showRecaptureLetter(game, letter) {
  const p = game.progress, panels = game.panels;
  const { tag, species, days, grew, km, place, bonus } = letter;
  panels.open(`<div class="letter">
    <h2>✉ A letter from the tagging program</h2>
    <p class="sub">Tag ${esc(tag.no)}</p>
    <p>Dear ${esc(nameOf(p))},</p>
    <p>Good news! A fisher near <b>${esc(place)}</b> caught the <b>${esc(species.toLowerCase())}</b> you tagged ${days} day${days > 1 ? 's' : ''} ago (it was ${tag.length} cm). It had grown <b>${grew} cm</b> and travelled about <b>${km} km</b> from where you released it. They noted the tag number, measured it, and let it go again.</p>
    <div class="letter-why"><b>What a recapture tells scientists</b>
      <ul><li>How <b>far</b> fish travel, so managers know if one bay's fish belong to another's.</li><li>How <b>fast they grow</b>, which helps set legal sizes.</li><li>That fish <b>survive release</b> when handled well: a tagged fish that comes back is proof.</li></ul></div>
    <p class="pay got"><b>${COIN.icon} +${bonus} credits</b> for a tag recapture. Thank you for being a citizen scientist!</p>
    <p><button class="btn primary" id="letter-done">Great</button></p></div>`);
  panels.body.querySelector('#letter-done').onclick = () => panels.close();
  game.updateStats(); game.audio.play('newSpecies');
}
