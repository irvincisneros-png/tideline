// A conversation, played in the portrait dialogue box (ui/dialogue.js). The menu: Ask about... (topics), Any tips?, Heard any gossip?, Jobs and trades.
// All the words are data in content/npcs.js; this file is the flow:
//   tips and gossip rotate with today's tide, time and season (lines.js); a gossip line marks its fish Seen in the Fish Guide (guide.markSeen(id, 'gossip'))
//   "show me" trades are checked against the Fish Guide and logbook (requests.js); quiz trades ask 1-3 questions from the worksheet bank (content/quiz.js)
//   and give the reward only if every answer is right, otherwise explain the answer and try again on the next in-game day.
import { QUIZ_BY_N } from '../content/quiz.js';
import { ITEMS, CARDS } from '../content/items.js';
import * as G from '../fishing/guide.js';
import { SPECIES_BY_ID } from '../fishing/species.js';
import { pickLine } from './lines.js';
import { tradeStatus, progressOf, accept, complete, failQuiz, ensureNpc } from './requests.js';
import { grant, rewardName } from './inventory.js';
import { nameOf } from '../core/anglerData.js';
import { esc } from '../ui/panels.js';
import { payMission, missionCoins, enterComp, compStanding, payLitter, litterUnpaid, today as econToday, compOfDay, RIVALS } from '../economy/coins.js';
import { RATES, COIN } from '../content/shop.js';
import { addBait } from '../economy/store.js';
import { hasLicence, coopEligible, coopProgress, grantLicence, START_ADVANCE } from '../economy/commercial.js';
import { endingStatus, pendingCeremony, ensureEnding } from '../fishing/ending.js';
import { COOP } from '../content/coop.js';

const shuffle = (a, rnd = Math.random) => { const o = a.map((v, i) => ({ v, i })); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };

export class Talk {
  constructor(game, mgr) { this.game = game; this.mgr = mgr; }
  get p() { return this.game.progress; }
  fmt(t) { return t.replaceAll('{name}', esc(nameOf(this.p))); }
  cond() { const c = this.game.cond; return { tide: c.tide, time: c.time, season: c.season }; }

  async run(npc) {
    const g = this.game, p = this.p, dlg = g.dialogue, def = npc.def, st = ensureNpc(p);
    const who = this.mgr.whoOf(npc.id);
    npc.talking = true; npc.faceAt = g.walker.pos; npc.clearBubble();
    g.audio.play('click');
    try {
      let greeting;
      if (!st.met[npc.id]) {
        for (const line of def.intro) await dlg.say({ who, text: this.fmt(line) });
        st.met[npc.id] = Date.now(); g.persist();
        greeting = 'What can I do for you?';
      } else {
        const rot = st.rot[`hi:${npc.id}`] = (st.rot[`hi:${npc.id}`] ?? 0) + 1;
        greeting = this.fmt(def.greet[rot % def.greet.length]);
      }
      for (;;) {
        const opts = this.menu(npc);
        const i = await dlg.say({ who, text: greeting, choices: opts.map(o => o.label), cancel: opts.length - 1 });
        greeting = 'Anything else?';
        const o = opts[i];
        if (o.id === 'bye') break;
        await this[o.id](npc, who, o);
      }
      await dlg.say({ who, text: this.fmt('See you, {name}!'), button: 'Bye!' });
    } finally {
      dlg.hide(); npc.talking = false; npc.faceAt = null; g.persist();
      this.mgr.greeted[npc.id] = g.time;
    }
  }

  menu(npc) {
    const def = npc.def, p = this.p, out = [];
    if (def.topics.length) out.push({ id: 'topics', label: 'Ask about…' });
    if (def.tips.length) out.push({ id: 'tip', label: 'Any tips?' });
    if (def.gossip.length) out.push({ id: 'gossip', label: 'Heard any gossip?' });
    if (def.trades.length) {
      const st = def.trades.map(t => tradeStatus(p, t)), flag = st.some(s => s === 'ready') ? ' (ready ✓)' : st.some(s => s === 'new') ? ' (new)' : '';
      out.push({ id: 'trades', label: `Jobs and trades${flag}` });
    }
    if (npc.id === 'mitra') out.push({ id: 'shop', label: 'Shop' });
    if (npc.id === 'bev') { out.push({ id: 'comp', label: "Today's club comp" }); out.push({ id: 'awards', label: pendingCeremony(p) ? '\ud83c\udfc6 Awards night is ready!' : 'Awards night' }); }
    if (npc.id === 'nell' && (hasLicence(p) || coopEligible(p))) out.push({ id: 'coop', label: hasLicence(p) ? '\ud83d\udea2 The co-op' : '\ud83d\udea2 Co-op licence' });
    if (npc.id === 'fatima') out.push({ id: 'tally', label: 'Clean-up tally' });
    if (npc.id === 'mitra' && (p.esky?.length ?? 0) > 0) out.push({ id: 'sell', label: 'Sell my fish' });
    out.push({ id: 'bye', label: 'Bye' });
    return out;
  }

  // ------------------------------------------------------------------ topics
  async topics(npc, who) {
    const dlg = this.game.dialogue, def = npc.def;
    for (;;) {
      const i = await dlg.say({ who, text: 'What would you like to know?', choices: [...def.topics.map(t => t.q), 'Back'], cancel: def.topics.length });
      if (i >= def.topics.length) return;
      const topic = def.topics[i];
      await dlg.sequence(who, topic.a.map(l => this.fmt(l)), 'Thanks');
      if (topic.grants) this.grantReward(topic.grants);
    }
  }
  /** Mitra: the lesson she gives when you try to sell your catch (the law, and how you really earn credits), then the offer of the shop. */
  async sell(npc, who) {
    const dlg = this.game.dialogue, t = npc.def.topics.find(x => x.q.startsWith('Can I sell'));
    await dlg.say({ who, text: this.fmt('Sell it? Ah, {name}, I wish I could buy it, but I cannot.') });
    await dlg.sequence(who, t.a.slice(0, -1).map(l => this.fmt(l)), 'Right');
    const i = await dlg.say({ who, text: this.fmt(t.a.at(-1)), choices: ['Show me the shop', 'Maybe later'], cancel: 1 });
    if (i === 0) await this.shop(npc, who);
  }
  /** Mitra's tackle shop (also reachable from the "Shop" option): the dialogue steps aside while the shop panel is open. */
  async shop(npc, who) {
    const g = this.game;
    await g.dialogue.say({ who, text: this.fmt(`Come in, {name}. You have <b>${COIN.icon} ${this.p.coins ?? 0} ${COIN.name}</b>. Take your time.`), button: 'Have a look' });
    g.dialogue.hide();
    await g.openShop({ from: 'mitra' });
  }
  /** Bev: today's comp. Entry is free; the result is settled when you head home and pays by place. */
  async comp(npc, who) {
    const g = this.game, p = this.p, dlg = g.dialogue, day = p.npc.day, c = compOfDay(day), e = econToday(p);
    const prizes = RATES.compPrizes;
    if (e.compDone?.day === day) {
      const d = e.compDone;
      await dlg.say({ who, text: this.fmt(`You already fished today's comp, {name}: <b>${esc(d.title)}</b>. You came ${ordinal(d.place)} with ${d.score} ${esc(d.unit)}${d.prize ? ` and won ${d.prize} credits` : ''}. A new comp starts tomorrow.`), button: 'Thanks' });
      return;
    }
    const st = compStanding(p);
    const info = `Today's comp: <b>${esc(c.title)}</b>.<br>${esc(c.blurb)}<br><small class="dlg-note">Prizes: 1st ${prizes[0]}, 2nd ${prizes[1]}, 3rd ${prizes[2]}, everyone else who competes ${prizes[3]} (if you score). The board is settled when you head home. Rivals today: ${RIVALS.map((n, i) => `${n} ${st.rivals[i]}`).join(', ')} ${esc(c.unit)}.</small>`;
    if (st.entered) {
      await dlg.say({ who, text: this.fmt(`${info}<br><br>You are in, {name}! Your score so far: <b>${st.score} ${esc(c.unit)}</b>, which would put you ${ordinal(st.place)} right now${st.prize ? ` (${st.prize} credits)` : ''}.`), button: 'Back to it' });
      return;
    }
    const i = await dlg.say({ who, text: this.fmt(info), choices: ['Enter the comp (free)', 'Not today'], cancel: 1 });
    if (i === 0) {
      enterComp(p); g.persist();
      g.toast(`🏆 Entered: ${c.title}. Your catches from now count. Head home to settle the board.`, 'good');
      await dlg.say({ who, text: this.fmt('You are on the board, {name}! Fish clean and measure carefully. Head home when you are done and I will settle the board.'), button: 'Let us go' });
    }
  }
  /** Bev: awards night. Says what it takes; once you qualify (or have been before) she starts the ceremony. */
  async awards(npc, who) {
    const g = this.game, p = this.p, dlg = g.dialogue, st = endingStatus(p), e = ensureEnding(p), pend = pendingCeremony(p);
    if (pend || e.awards || e.milestone) {
      const kind = pend ?? (e.awards ? 'awards' : 'milestone');
      const i = await dlg.say({ who, text: this.fmt(pend ? (kind === 'awards' ? "It's time, {name}! Everyone is at the club tonight. Shall we start awards night?" : 'Every fish caught, {name}! The club wants to celebrate. Shall we?') : "Want to see the ceremony again, {name}? Everyone loved it."), choices: ['Start the ceremony', 'Not now'], cancel: 1 });
      if (i === 0) { dlg.hide(); this.mgr.ceremonyPending = kind; }
      return;
    }
    await dlg.say({ who, text: this.fmt(`Awards night happens when you have <b>Mastered all ${st.total} kinds of fish</b> (you have ${st.mastered}) and the bay is healthy: <b>Bay Health ${st.bayNeed.toFixed(1)}% or more</b> (it is ${G.bayText(st.bay)} now: fish stocks plus a Steward bonus). Release fish with wet hands, tag them, pull litter out of the water and keep only legal fish.<br><small class="dlg-note">Catch every kind of fish (${st.caught} of ${st.total} so far) and the club will hold a smaller celebration first.</small>`), button: 'Got it' });
  }
  /** Nell: the co-op licence (the commercial chapter) and the co-op panel. */
  async coop(npc, who) {
    const g = this.game, p = this.p, dlg = g.dialogue;
    if (!hasLicence(p)) {
      await dlg.sequence(who, [
        this.fmt("{name}, you've caught every kind of fish in the guide and the club has celebrated it. You've earned a look at my side of the deck."),
        'A co-op licence is permission to fish commercially. With it you can use nets, lines and traps, land a haul at the co-op and sell it. That is the only place in this whole game where a fish can be sold. Recreational fish never can.',
        `The catch: quotas, closures, rules about nets and bycatch, and a stock status that decides what I can land. You also get ${START_ADVANCE} ${COOP.money.name} to start. They are for the co-op only, not for Mitra's shop.`,
      ], 'Go on');
      const i = await dlg.say({ who, text: 'Want the licence?', choices: ['Sign the licence', 'Not yet'], cancel: 1 });
      if (i !== 0) return;
      const r = grantLicence(p);
      if (!r.ok) return;
      g.persist(); g.audio.play('newSpecies'); g.toast(`\ud83d\udea2 Co-op licence signed! ${START_ADVANCE} ${COOP.money.name} to start.`, 'good');
    }
    await dlg.say({ who, text: this.fmt('Right, {name}. Nets lab first, then a haul, then the co-op counter. Have a look.'), button: 'Open the co-op' });
    dlg.hide();
    await g.openCoop();
  }

  /** Fatima: pays credits for the pieces of litter you have pulled out of the water (the green zone catches it on the catch bar). */
  async tally(npc, who) {
    const g = this.game, p = this.p, dlg = g.dialogue, total = p.steward?.litter ?? 0;
    if (!total) { await dlg.say({ who, text: this.fmt(`Nothing on your tally yet, {name}. Next time a fish is on, steer the green zone over any tangled line or plastic bag that drifts down the bar. I pay ${RATES.litterPiece} credits a piece, up to ${RATES.litterDailyCap} pieces a day.`), button: 'Will do' }); return; }
    const r = payLitter(p);
    if (r.pieces) {
      g.persist(); g.earned(r.amount);
      g.toast(`🪙 +${r.amount} credits: ${r.pieces} piece${r.pieces > 1 ? 's' : ''} of litter`, 'good');
      await dlg.say({ who, text: this.fmt(`Let me tick those off... <b>${r.pieces} piece${r.pieces > 1 ? 's' : ''}</b> of litter. That is <b>${r.amount} credits</b>. Thank you, {name}: every piece out of the water is one less thing for a turtle or a bird to swallow.${r.unpaid ? ` I can only pay ${RATES.litterDailyCap} a day, so ${r.unpaid} more will keep until tomorrow.` : ''}`), button: 'My pleasure' });
    } else await dlg.say({ who, text: this.fmt(r.capped ? `That is my ${RATES.litterDailyCap} pieces for today, {name}. Come back tomorrow for the rest.` : `Everything on your tally is already paid, {name}. Bring me more!`), button: 'Okay' });
  }

  // ------------------------------------------------------------------ tips and gossip
  async tip(npc, who) {
    const st = ensureNpc(this.p), key = `tip:${npc.id}`;
    const r = pickLine(npc.def.tips, this.cond(), st.rot[key] ?? 0);
    st.rot[key] = (st.rot[key] ?? 0) + 1;
    await this.game.dialogue.say({ who, text: this.fmt(r ? r.line.t : 'Nothing new today. Ask me again later.'), button: 'Thanks' });
  }
  async gossip(npc, who) {
    const g = this.game, p = this.p, st = ensureNpc(p), key = `gos:${npc.id}`;
    const r = pickLine(npc.def.gossip, this.cond(), st.rot[key] ?? 0);
    st.rot[key] = (st.rot[key] ?? 0) + 1;
    if (!r) { await g.dialogue.say({ who, text: 'Nothing new on the grapevine today. Ask me again later.', button: 'Okay' }); return; }
    const id = r.line.species, fresh = G.markSeen(p, id, 'gossip');
    let text = this.fmt(r.line.t);
    if (fresh) {
      g.persist(); g.audio.play('newSpecies');
      g.toast(`📗 Added to your guide: Seen — ${SPECIES_BY_ID[id].name}`, 'good');
      text += `<br><small class="dlg-note">📗 Added to your guide: Seen (${esc(SPECIES_BY_ID[id].name)}). Press <kbd>J</kbd> to see where and when.</small>`;
      text = g.hint(text);
    }
    await g.dialogue.say({ who, text, button: 'Thanks for the tip' });
  }

  // ------------------------------------------------------------------ trades
  async trades(npc, who) {
    const g = this.game, p = this.p, dlg = g.dialogue, def = npc.def;
    for (;;) {
      const list = def.trades.filter(t => tradeStatus(p, t) !== 'done');
      if (!list.length) { await dlg.say({ who, text: this.fmt("You've done everything I asked, {name}. Thank you!"), button: 'Great' }); return; }
      const label = t => { const s = tradeStatus(p, t); return `${t.title}${s === 'ready' ? ' ✓' : s === 'wait' ? ' (tomorrow)' : s === 'active' ? ' (in progress)' : ''}`; };
      const i = await dlg.say({ who, text: 'Here is what I have for you:', choices: [...list.map(label), 'Back'], cancel: list.length });
      if (i >= list.length) return;
      const done = await this[list[i].kind === 'quiz' ? 'quizTrade' : 'showTrade'](npc, who, list[i]);
      if (done) return;
    }
  }

  async showTrade(npc, who, trade) {
    const g = this.game, p = this.p, dlg = g.dialogue, pr = progressOf(trade.need, p), st = tradeStatus(p, trade);
    if (st === 'ready') {
      await dlg.say({ who, text: this.fmt(`Let me see… <b>${esc(pr.text)}</b>. ${pr.done ? 'Yes, your records show it.' : ''}`), button: 'Here you go' });
      await this.reward(npc, who, trade);
      return true;
    }
    if (st === 'new') {
      const i = await dlg.say({ who, text: this.fmt(trade.ask), choices: ['I will do it', 'Maybe later'] });
      if (i === 0) { accept(p, trade.id); g.persist(); g.toast(`📜 New request from ${npc.def.name}: ${trade.title}. Press Q for your quest log.`, 'good'); await dlg.say({ who, text: 'Good luck! Come back when you have done it.', button: 'Will do' }); }
      return false;
    }
    await dlg.say({ who, text: `${this.fmt(trade.ask)}<br><br><b>So far:</b> ${pr.have} of ${pr.need}.`, button: 'Okay' });
    return false;
  }

  async quizTrade(npc, who, trade) {
    const g = this.game, p = this.p, dlg = g.dialogue, st = tradeStatus(p, trade);
    if (st === 'wait') { await dlg.say({ who, text: this.fmt('Not today, {name}. Think it over and ask me again tomorrow. A new day starts after your next outing, or at midnight.'), button: 'Okay' }); return false; }
    const i = await dlg.say({ who, text: this.fmt(trade.ask), choices: [`Ask me (${trade.quiz.length} question${trade.quiz.length > 1 ? 's' : ''})`, 'Not now'] });
    if (i !== 0) return false;
    accept(p, trade.id);
    for (let k = 0; k < trade.quiz.length; k++) {
      const q = QUIZ_BY_N[trade.quiz[k]], order = shuffle(q.options);
      const pick = await dlg.say({ who, text: `<small class="dlg-note">Question ${k + 1} of ${trade.quiz.length} · ${esc(q.src)}</small><br>${esc(q.q)}`, choices: order.map(o => o.v) });
      if (order[pick].i !== q.answer) {
        failQuiz(p, trade.id); g.persist(); g.audio.play('wrong');
        await dlg.say({ who, text: `Not quite. The answer is <b>${esc(q.options[q.answer])}</b>. Have another think about it and ask me again tomorrow. A new day starts after your next outing, or at midnight.`, button: 'Okay' });
        return true;
      }
      g.audio.play('correct');
    }
    await this.reward(npc, who, trade);
    return true;
  }

  async reward(npc, who, trade) {
    const g = this.game, p = this.p;
    complete(p, trade.id);
    const coins = payMission(p, trade);   // modest credits on top of the item
    if (ITEMS[trade.reward]?.unlocks?.bait) addBait(p, ITEMS[trade.reward].unlocks.bait, 10);   // a bait reward comes with a starter tub
    const isNew = grant(p, trade.reward), name = rewardName(trade.reward), item = ITEMS[trade.reward], card = CARDS[trade.reward];
    g.persist(); g.audio.play('newSpecies'); g.earned(coins);
    g.toast(`🎁 ${name} and 🪙 ${coins} credits`, 'good');
    let extra = '';
    if (item?.unlocks?.rig || item?.unlocks?.bait) extra = ` Unlocked in your tackle box (<kbd>T</kbd>).`;
    else if (item?.kind === 'hat') extra = ` Wear it from your quest log (<kbd>Q</kbd>).`;
    else if (card) extra = ' Read it in the Fish Guide (<kbd>J</kbd>), Sea Country tab.';
    await g.dialogue.say({ who, text: g.hint(this.fmt(trade.done) + `<br><br><b>You received: ${esc(name)}</b> and <b>${coins} credits</b>.${extra}`), button: 'Thank you!' });
    return isNew;
  }
  /** A topic that hands over a Sea Country card. */
  grantReward(id) {
    const g = this.game;
    if (grant(this.p, id)) { g.persist(); g.audio.play('newSpecies'); g.toast(`📗 New Sea Country card: ${CARDS[id].title}. Read it in the Fish Guide (J).`, 'good'); }
  }
}

const ordinal = n => ['', '1st', '2nd', '3rd'][n] ?? `${n}th`;
