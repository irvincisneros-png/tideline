// One outing = from walking down to the water to heading home. Tracks what happened (caught, kept, released, accuracy, Steward and Bay
// Health change), runs the Fisheries Officer check (about 1 in 3 outings; ?officer=1 forces it, ?officer=0 never) and shows the outing summary.
import { SPECIES_BY_ID, SPOT_INFO } from '../fishing/species.js';
import * as G from '../fishing/guide.js';
import { stockOf } from '../fishing/catches.js';
import { PORTRAITS } from './dialogue.js';
import { WHY } from './catchFlow.js';
import { esc } from './panels.js';

export const OFFICER_CHANCE = 1 / 3;

export class Outing {
  constructor(game) { this.game = game; this.busy = false; }
  get p() { return this.game.progress; }

  /** Begin a new outing (called when you walk onto the shore). Keeps an unfinished one if the page was reloaded mid-outing. */
  start(force = false) {
    const p = this.p;
    if (p.outing && !force) return p.outing;
    p.outing = { id: Date.now(), t0: Date.now(), eco: this.game.eco.id, bay0: G.bayHealth(p), st0: G.stewardRating(p).value, stock0: { ...p.stock },
      caught: 0, kept: 0, keptLegal: 0, keptIllegal: 0, released: 0, meas: 0, acc: 0, gains: [], officer: null };
    this.game.persist();
    return p.outing;
  }

  /** The Head home button / H: ask first, then end the outing. */
  ask() {
    const g = this.game, f = g.fishing;
    if (this.busy) return;
    if (['bite', 'fight', 'landed', 'charge', 'flying'].includes(f.state)) { g.toast('Land or lose this fish first, then head home.', 'warn'); return; }
    const esky = this.p.esky ?? [], bad = esky.filter(x => !x.legal).length;
    g.panels.open(`<h2>Head home?</h2>
      <p>That ends today's outing. ${esky.length ? `You have <b>${esky.length}</b> fish in the esky${bad ? `, <b>${bad} marked ILLEGAL</b>` : ''}.` : 'Your esky is empty: all catch and release.'}</p>
      <p class="muted">Sometimes a Fisheries Officer checks your esky on the way home.</p>
      <p><button class="btn primary" id="home-go">Head home</button> <button class="btn" id="home-stay">Keep fishing</button></p>`);
    g.panels.body.querySelector('#home-go').onclick = () => { g.panels.close(true); this.finish(); };
    g.panels.body.querySelector('#home-stay').onclick = () => g.panels.close();
  }

  async finish() {
    const g = this.game, p = this.p;
    if (this.busy) return; this.busy = true;
    try {
      g.fishing.stop();
      const o = p.outing ?? this.start();
      const force = new URLSearchParams(location.search).get('officer');
      const check = force === '1' || (force !== '0' && Math.random() < OFFICER_CHANCE);
      if (check) o.officer = await this.officer();
      else o.officer = { result: 'none' };
      // Home: legal fish go to the fridge, illegal ones were taken (or never checked); the esky is empty again.
      o.home = (p.esky ?? []).filter(x => x.legal || o.officer.result === 'none').length;
      p.esky = [];
      o.t1 = Date.now(); o.bay1 = G.bayHealth(p); o.st1 = G.stewardRating(p).value;
      g.persist(); g.updateStats();
      this.summary(o);
    } finally { this.busy = false; }
  }

  // ---------------------------------------------------------------- the Fisheries Officer
  async officer() {
    const g = this.game, p = this.p, dlg = g.dialogue, who = PORTRAITS.officer, esky = p.esky ?? [];
    const st = p.steward; const before = G.stewardRating(p).value;
    g.audio.play('click');
    await dlg.say({ who, text: "G'day! I'm a Fisheries Officer. Just a routine check on the way out. Mind if I have a look in your esky?", button: 'Sure, go ahead' });
    let result;
    if (!esky.length) {
      await dlg.say({ who, text: 'Nothing in it at all. Catch and release is great for the bay: every fish you let go can keep breeding. Thanks for looking after the water.' });
      st.checks++; st.clean++; result = { result: 'clean', lost: 0, empty: true };
    } else {
      const bad = esky.filter(x => !x.legal), good = esky.filter(x => x.legal);
      await dlg.say({ who, text: `Right, let's see. ${esky.length} fish. I will measure each one against the rules.` });
      if (good.length) await dlg.say({ who, text: `${good.map(x => `<b>${esc(x.label)}</b> (${x.length} cm)`).join(', ')}: ${good.length === 1 && !bad.length ? 'that one is' : good.length === 1 ? 'that one is' : bad.length ? 'those are' : 'all of them are'} legal. ${bad.length ? '' : 'Good measuring.'}` });
      for (const x of bad) {
        await dlg.say({ who, text: `<b>${esc(x.label)}</b>, ${x.length} cm. ${esc(x.reason)}<br><br><i>Why the rule?</i> ${esc(WHY[x.kind] ?? WHY.ok)}`, button: 'Understood' });
      }
      if (bad.length) {
        st.checks++; st.fines += bad.length;
        const lost = Math.max(0, before - G.stewardRating(p).value);
        await dlg.say({ who, text: `That is a fine for ${bad.length === 1 ? 'that fish' : `those ${bad.length} fish`}. I will take ${bad.length === 1 ? 'it' : 'them'} and it costs you Steward stars (${lost > 0 ? `down ${lost.toFixed(1)}` : 'noted'}). Check the limits before you keep one: <b>FishSmart</b> is a free app with them all.`, button: 'Sorry, officer' });
        g.audio.play('wrong');
        result = { result: 'fine', lost, illegal: bad.length };
      } else {
        st.checks++; st.clean++;
        await dlg.say({ who, text: 'Every fish in here is legal and you are inside your bag limits. Beauty. That is how you keep fishing healthy for everyone. Well done!' });
        g.audio.play('correct');
        result = { result: 'clean', lost: 0 };
      }
    }
    dlg.hide();
    return result;
  }

  // ---------------------------------------------------------------- the outing summary card
  summary(o) {
    const g = this.game, p = this.p;
    const dBay = o.bay1 - o.bay0, dSt = o.st1 - o.st0;
    const sgn = (v, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;
    const accPct = o.meas ? Math.round(o.acc / o.meas * 100) : null;
    const changes = [];
    for (const [k, v] of Object.entries(p.stock ?? {})) {
      const was = o.stock0?.[k] ?? stockOf(null, ...k.split(':')); // seeded value when it had not been touched yet
      if (Math.round(v) !== Math.round(was)) { const [spot, id] = k.split(':'); changes.push({ spot, id, was, now: v }); }
    }
    const off = o.officer ?? { result: 'none' };
    const offTxt = off.result === 'none' ? 'No check this time' : off.result === 'clean' ? 'Check passed: clean esky' : `Fined for ${off.illegal} illegal fish (−${off.lost.toFixed(1)} stars)`;
    g.panels.open(`<div class="flow summary">
      <h2>Outing summary</h2>
      <p class="sub">${esc(g.eco.name)} · ${Math.max(1, Math.round((o.t1 - o.t0) / 60000))} min</p>
      <div class="sum-grid">
        <div class="sum-card"><b>${o.caught}</b><span>fish caught</span></div>
        <div class="sum-card"><b>${o.kept}</b><span>kept${o.kept ? ` (${o.keptLegal} legal${o.keptIllegal ? `, ${o.keptIllegal} illegal` : ''})` : ''}</span></div>
        <div class="sum-card"><b>${o.released}</b><span>released</span></div>
        <div class="sum-card"><b>${accPct == null ? '–' : accPct + '%'}</b><span>measuring accuracy${o.meas ? ` (${o.acc} of ${o.meas})` : ''}</span></div>
      </div>
      <div class="sum-rows">
        <div><span>Steward rating</span><b class="stars">${G.starsText(o.st1)} <em>${o.st1.toFixed(1)}</em> <i class="${dSt >= 0 ? 'up' : 'down'}">${sgn(dSt)}</i></b></div>
        <div><span>Bay Health</span><b>${o.bay0.toFixed(2)}% → ${o.bay1.toFixed(2)}% <i class="${dBay >= 0 ? 'up' : 'down'}">${sgn(dBay, 2)}</i></b></div>
        <div><span>Fisheries Officer</span><b>${esc(offTxt)}</b></div>
      </div>
      ${o.gains.length ? `<h3>Fish Guide</h3><ul class="gains">${o.gains.map(x => `<li>${esc(SPECIES_BY_ID[x.id].name)}: <b>${G.TIER_LABEL[x.tier]}</b></li>`).join('')}</ul>` : ''}
      ${changes.length ? `<h3>Stock health changes</h3><p class="muted">${changes.slice(0, 6).map(c => `${esc(SPECIES_BY_ID[c.id]?.name ?? c.id)} (${esc((SPOT_INFO[c.spot]?.label ?? c.spot).replace('Lake Illawarra ', 'Lake '))}) ${Math.round(c.was)} → ${Math.round(c.now)}`).join(' · ')}</p>` : ''}
      <p class="sum-actions"><button class="btn primary" id="sum-again">Fish again</button> <button class="btn" id="sum-guide">📗 Fish Guide</button> <button class="btn ghost" id="sum-title">Title screen</button></p>
    </div>`, null, { locked: true, flow: 'summary' });
    const b = g.panels.body;
    b.querySelector('#sum-again').onclick = () => { g.panels.close(true); p.outing = null; g.startLand(null); };
    b.querySelector('#sum-title').onclick = () => { g.panels.close(true); p.outing = null; g.persist(); g.enterMenu(); };
    b.querySelector('#sum-guide').onclick = () => g.openGuide({ back: () => this.summary(o) });
  }
}
