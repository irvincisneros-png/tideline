// What happens to a fish once it is landed: identify it with the dichotomous key (first time only), measure it on the brag mat,
// decide keep or release (rules hidden until you commit), then the feedback with the reason for the rule; a release is a quick
// hands-on step (wet hands, hold to unhook, 10 s air time). Everything is written to the logbook, the Fish Guide and the esky.
//   new CatchFlow(game).run(landed, spot, done)      landed = { id, length, gear, ctx }
import { SPECIES_BY_ID, SPOT_INFO } from '../fishing/species.js';
import { judge, RULES, adjustStock, bagGroupIds } from '../fishing/catches.js';
import * as G from '../fishing/guide.js';
import { esc } from './panels.js';
import { mountKey } from './keyUI.js';
import { fishOnMat, fishPhoto } from './fishView.js';
import { nameOf } from '../core/anglerData.js';
import { hasItem } from '../npc/inventory.js';
import { payRecord, payTag } from '../economy/coins.js';
import { releaseSurvival, survivalNote, CUT_LINE, BAROTRAUMA_DEPTH } from '../economy/effects.js';
import { RATES } from '../content/shop.js';
import { pestVerdict, recordPest } from '../fishing/pest.js';

const AIR_LIMIT = 10; // seconds out of the water before it counts as too long
const HOLD_S = 1.4;   // seconds to hold the unhook button

/** Why each kind of rule exists (content dataset section C: C3-C8). */
export const WHY = {
  undersize: 'Small fish have not had the chance to breed yet. Releasing them lets them grow and breed, so there are fish for later.',
  oversize: 'The biggest fish are the best breeders, so the slot limit protects them: release the big ones.',
  bag: 'A bag limit stops too many fish being taken, so there are fish left for everyone.',
  possession: 'The possession limit counts everything you have at any time, fridge and freezer included, so you cannot beat the bag limit by stocking up.',
  protected: 'Protected species are too vulnerable to take. They must be released straight away with the least harm.',
  closed: 'A closed season protects fish while they spawn, so there are more fish next year. Bass and estuary perch may not be kept in rivers and estuaries from May to August.',
  bigbag: 'The biggest fish are the best breeders, so only a few big ones may be kept each day.',
  pest: 'Carp are an introduced pest: they stir up the mud, cloud the water and eat the plants that native fish and their young need. Taking one out of the water helps the river.',
  ok: 'Size, bag and possession limits keep fishing sustainable: enough fish are left to breed.',
};

/** "Yellowfin bream survive release between 72 and 97% of the time (DPIRD); the bar uses the middle, 85%." A single published figure is said plainly. */
export function survivalLine(name, id, sv) {
  const n = survivalNote(id);
  if (!n) return `There is no published DPIRD survival figure for ${esc(name.toLowerCase())} in our sources, so the game starts from a standard ${sv.base}% (an estimate, not a measured value)`;
  return n.single ? `${esc(name)} usually survive release ${n.text} of the time when handled well (DPIRD)`
    : `${esc(name)} usually survive release ${n.text} (DPIRD). The estimate starts from the middle of that range: ${n.mid}%`;
}

export class CatchFlow {
  constructor(game) { this.game = game; this.keyView = null; }
  get p() { return this.game.progress; }
  get panel() { return this.game.panels; }

  run(landed, spot, done) {
    const g = this.game, p = this.p;
    this.c = landed; this.id = landed.id; this.sp = SPECIES_BY_ID[landed.id]; this.spot = spot; this.done = done;
    this.tierBefore = G.tierOf(p, this.id);
    G.recordCatch(p, this.id, { length: landed.length });
    this.entry = G.entryOf(p, this.id);
    G.setPhoto(p, this.id, fishPhoto(this.id), landed.length);   // the Fish Guide picture: a close-up render of the fish itself on the brag mat
    this.measured = null; this.accurate = null; this.decision = null; this.verdict = null;
    this.t0 = performance.now();
    g.panels.open('', null, { locked: true, flow: 'flow' });
    if (G.atLeast(G.tierOf(p, this.id), 'identified')) this.stepMeasure(); else this.stepKey();
  }

  // ---------------------------------------------------------------- display names
  /** The name for this fish right now: its real name once identified, else what the player keyed it as, else "Unknown fish #n". */
  nameNow() {
    const p = this.p, id = this.id;
    if (G.atLeast(G.tierOf(p, id), 'identified')) return this.sp.name;
    const as = G.keyedAs(p, id);
    return as ? `${as} (your key answer)` : G.labelOf(p, id);
  }
  show(html) { this.disposeKey(); this.panel.body.innerHTML = html; this.panel.modal.querySelector('.panel').scrollTop = 0; }
  disposeKey() { this.keyView?.dispose(); this.keyView = null; }

  // ---------------------------------------------------------------- 1. the key
  stepKey() {
    const g = this.game, p = this.p;
    this.disposeKey();
    const n = this.entry.caught.n;
    this.keyView = mountKey(this.panel.body, {
      id: this.id, title: `Unknown fish #${n}`,
      sub: `Nice catch, ${nameOf(p)}! ` + (p.guide.e[this.id]?.keys?.length ? 'You keyed this fish before. Look again, and check each answer against the fish.' : 'Look the fish over, then work through the key. Every question is about something you can see.'),
      onConfirm: leaf => {
        const as = SPECIES_BY_ID[leaf];
        G.recordKey(p, this.id, leaf, 'catch');
        g.persist(); g.audio.play('newSpecies');
        g.toast(`Logged as ${as.name} in your Fish Guide.`, 'good');
        this.stepMeasure();
      },
    });
    this.panel.modal.querySelector('.panel').scrollTop = 0;
  }

  // ---------------------------------------------------------------- 2. the brag mat
  stepMeasure() {
    const g = this.game, p = this.p, len = this.c.length;
    const first = !p.tips?.measure, fine = g.gearStats().fineMat, unit = fine ? 0.5 : 1;   // the fine mat has half-centimetre marks
    const matCm = Math.max(30, Math.ceil((len + 6) / 10) * 10);
    const top = fishOnMat(this.id, ['flattened', 'tentacles'].includes(this.sp.feat?.body));   // flat fish and squid lie flat, seen from above
    this.show(`<div class="flow measure">
      <h2>Measure it</h2>
      <p class="sub">Nice catch, ${esc(nameOf(p))}! ${esc(this.nameNow())}. Mouth closed, snout on the 0 stop, read the tip of the tail.</p>
      ${first ? '<p class="tip">Tip: total length runs from the tip of the snout (mouth closed) to the tip of the tail. Slide the marker to the tail tip.</p>' : ''}
      <div class="mat" id="mat">
        <svg class="mat-ruler" id="mat-ruler" aria-hidden="true"></svg>
        <div class="mat-board" id="mat-board">
          <div class="mat-stop"><span>0</span></div>
          <img class="mat-fish ${top.flip ? 'flip' : ''}" id="mat-fish" alt="Your fish lying on the brag mat" src="${top.url}" draggable="false">
          <div class="mat-true" id="mat-true"><span></span></div>
          <div class="mat-marker" id="mat-marker"><span class="mk-flag" id="mk-flag"></span></div>
        </div>
      </div>
      <div class="mat-readout" aria-live="polite">Your reading: <b id="mr">42</b> cm <span id="mr-res"></span></div>
      <div class="mat-controls">
        <button class="btn" id="m-minus" aria-label="${fine ? 'Half a centimetre less' : 'One centimetre less'}">− ${unit} cm</button>
        <button class="btn" id="m-plus" aria-label="${fine ? 'Half a centimetre more' : 'One centimetre more'}">+ ${unit} cm</button>
        <button class="btn primary" id="m-lock">Lock in my measure</button>
      </div>
      <small class="mat-help">Drag the marker (or tap the mat), then use − / + (or the arrow keys) to line it up exactly.${fine ? ' Your fine measuring mat has half-centimetre marks.' : ''}</small>
    </div>`);
    const b = this.panel.body, board = b.querySelector('#mat-board'), img = b.querySelector('#mat-fish'), marker = b.querySelector('#mat-marker'), ruler = b.querySelector('#mat-ruler');
    const flag = b.querySelector('#mk-flag'), readout = b.querySelector('#mr'), trueLine = b.querySelector('#mat-true');
    let value = Math.round(matCm * 0.55), locked = false, padL = 16, pxcm = 4;
    const draw = () => {
      // Fit the mat to the panel, but never let the fish (big flat ones are wide as well as long) grow taller than about a third of the screen.
      const avail = b.querySelector('#mat').parentElement.clientWidth || 600; padL = 18; const padR = 12;
      pxcm = Math.min((avail - padL - padR) / matCm, Math.max(150, Math.min(260, innerHeight * 0.32)) / (len * top.aspect));
      const W = Math.round(padL + padR + matCm * pxcm);
      const matEl = b.querySelector('#mat'); matEl.style.width = `${W}px`; matEl.style.margin = '0 auto';
      const imgH = len * pxcm * top.aspect, boardH = Math.max(112, Math.round(imgH + 36));
      img.style.left = `${padL}px`; img.style.width = `${len * pxcm}px`; img.style.height = `${imgH}px`;
      board.style.height = `${boardH}px`; img.style.top = `${(boardH - imgH) / 2}px`;
      // Ruler: a tick every cm (every 2 cm when tight), a longer one at 5, the longest with a number every 10.
      const step = pxcm >= 3 ? 1 : 2;
      let svg = `<rect x="0" y="0" width="${W}" height="30" fill="#fff9e8"/><line x1="${padL}" y1="30" x2="${padL + matCm * pxcm}" y2="30" stroke="#1f5f6b" stroke-width="2"/>`;
      for (let cm = 0; cm <= matCm; cm += step) {
        const x = padL + cm * pxcm, major = cm % 10 === 0, mid = cm % 5 === 0;
        svg += `<line x1="${x}" y1="30" x2="${x}" y2="${major ? 12 : mid ? 18 : 23}" stroke="#1f5f6b" stroke-width="${major ? 2.5 : 1.5}"/>`;
        if (major) svg += `<text x="${x}" y="10" text-anchor="middle" font-size="11" font-weight="800" fill="#1f5f6b">${cm}</text>`;
        if (fine && pxcm >= 4 && cm < matCm) svg += `<line x1="${x + pxcm / 2}" y1="30" x2="${x + pxcm / 2}" y2="26" stroke="#1f5f6b" stroke-width="1"/>`;   // the half-centimetre marks
      }
      ruler.setAttribute('viewBox', `0 0 ${W} 32`); ruler.style.height = '32px'; svg && (ruler.innerHTML = svg);
      place();
    };
    const place = () => {
      marker.classList.toggle('flip', value > matCm * 0.7); marker.style.left = `${padL + value * pxcm}px`; flag.textContent = `${value} cm`; readout.textContent = value;
      if (locked) trueLine.style.left = `${padL + len * pxcm}px`;
    };
    const set = v => { if (locked) return; value = Math.max(0, Math.min(matCm, Math.round(v / unit) * unit)); place(); };
    const fromEvent = e => { const r = board.getBoundingClientRect(); set((e.clientX - r.left - padL) / pxcm); };
    let drag = false;
    board.addEventListener('pointerdown', e => { if (locked) return; drag = true; board.setPointerCapture(e.pointerId); fromEvent(e); });
    board.addEventListener('pointermove', e => { if (drag) fromEvent(e); });
    board.addEventListener('pointerup', () => { drag = false; }); board.addEventListener('pointercancel', () => { drag = false; });
    b.querySelector('#m-minus').onclick = () => set(value - unit);
    b.querySelector('#m-plus').onclick = () => set(value + unit);
    const onKey = e => {
      if (locked) return;
      if (e.code === 'ArrowLeft') { e.preventDefault(); set(value - unit); } else if (e.code === 'ArrowRight') { e.preventDefault(); set(value + unit); }
    };
    addEventListener('keydown', onKey);
    this.cleanup = () => removeEventListener('keydown', onKey);
    b.querySelector('#m-lock').onclick = () => {
      if (locked) return;
      locked = true; this.measured = value;
      const diff = value - len, acc = Math.abs(diff) <= G.ACCURATE_CM;
      this.accurate = acc;
      trueLine.classList.add('on'); trueLine.querySelector('span').textContent = `${len} cm`; place();
      board.classList.add('done'); b.querySelector('#m-minus').disabled = b.querySelector('#m-plus').disabled = true;
      const res = acc
        ? (diff === 0 ? 'Spot on!' : `Accurate! Within 1 cm (${diff > 0 ? '+' : ''}${diff}).`)
        : `${Math.abs(diff)} cm ${diff > 0 ? 'too long' : 'too short'}. A miss like that can flip a keep into an illegal fish.`;
      b.querySelector('#mr-res').innerHTML = `<b class="${acc ? 'ok' : 'miss'}">${esc(res)}</b>`;
      b.querySelector('#m-lock').outerHTML = '<button class="btn primary" id="m-next">Continue</button>';
      G.recordMeasure(p, this.id, acc);
      p.tips ??= {}; p.tips.measure = true; g.persist();
      g.audio.play(acc ? 'correct' : 'wrong');
      b.querySelector('#m-next').onclick = () => { this.cleanup?.(); this.stepDecide(); };
      b.querySelector('#m-next').focus();
    };
    // Lay out after the panel has its real width.
    requestAnimationFrame(() => { draw(); });
    this.onResize = () => draw(); addEventListener('resize', this.onResize);
    const prevCleanup = this.cleanup; this.cleanup = () => { prevCleanup(); removeEventListener('resize', this.onResize); };
  }

  // ---------------------------------------------------------------- 3. keep or release
  stepDecide() {
    const p = this.p, id = this.id, mastered = G.tierOf(p, id) === 'mastered';
    const e = G.entryOf(p, id);
    this.show(`<div class="flow decide">
      <h2>Keep it or release it?</h2>
      <div class="fish-chip">${e?.photo ? `<img src="${e.photo}" alt="Your catch">` : ''}<div><b>${esc(this.nameNow())}</b><span>${this.measured} cm (your measure)</span></div></div>
      <p class="sub">The rules are hidden until you commit. Think: what do you remember about the legal length, the bag limit and whether this fish is protected? ${mastered ? 'You have mastered this fish, so you may check its guide entry first.' : ''}</p>
      <div class="decide-actions">
        <button class="btn primary big" id="fx-keep">Keep it</button>
        <button class="btn big" id="fx-release">Release it</button>
      </div>
      ${mastered ? '<p><button class="btn small" id="fx-guide">📗 Open this guide entry</button></p>' : '<p class="muted">No peeking: an entry that is not Mastered stays closed.</p>'}
    </div>`);
    const b = this.panel.body;
    b.querySelector('#fx-keep').onclick = () => this.commit(true);
    b.querySelector('#fx-release').onclick = () => this.commit(false);
    b.querySelector('#fx-guide')?.addEventListener('click', () => this.game.openGuide({ focus: id, back: () => { this.game.panels.open('', null, { locked: true, flow: 'flow' }); this.stepDecide(); } }));
  }
  commit(keep) {
    const g = this.game, p = this.p, id = this.id, c = this.c, rule = RULES[id];
    const today = new Date().toDateString();
    const group = bagGroupIds(id), kept = (p.catches ?? []).filter(x => group.includes(x.id) && x.kept);   // squid and cuttlefish share one bag of 20
    this.keptToday = kept.filter(x => new Date(x.time).toDateString() === today).length;
    const inPossession = kept.filter(x => Date.now() - x.time < 3 * 864e5).length;
    const cx = c.ctx ?? {}, over = rule?.maxOver ? kept.filter(x => new Date(x.time).toDateString() === today && x.length > rule.maxOver.cm).length : 0;
    this.jctx = { month: cx.month, season: cx.season, keptOver: over };   // the closed season and the "only one over 35 cm" rule need the date and what you have kept
    this.verdict = judge(id, c.length, this.keptToday, inPossession, this.jctx);
    const v = this.verdict, legal = v.legal;
    this.keep = keep; this.correct = keep ? legal : !rule?.pest;   // returning a pest fish is allowed but is not best practice (a small Steward cost)
    const kind = v.kind, why = WHY[kind] ?? WHY.ok;
    const flipped = this.measured != null && this.measured !== c.length && judge(id, this.measured, this.keptToday, inPossession, this.jctx).legal !== legal;
    const pest = !!rule?.pest;
    const pv = pest ? pestVerdict(keep) : null;
    const head = pest
      ? { cls: pv.cls, t: pv.title, d: pv.text }
      : keep
      ? (legal ? { cls: 'good', t: '✔ A legal keep', d: 'It goes in the esky.' } : { cls: 'bad', t: '✖ That fish is not legal to keep', d: 'It goes in the esky marked ILLEGAL. The right call was to release it. A Fisheries Officer who checks your esky would fine you.' })
      : (legal ? { cls: 'good', t: '✔ Released: always allowed', d: 'Catch and release is always allowed. You could also have kept this one. (A legal fish released is neutral: Mastery needs a legal keep, or a correct release of a fish you couldn\'t keep.)' } : { cls: 'good', t: '✔ Right call: it had to go back', d: 'It was not legal to keep.' });
    g.audio.play(head.cls === 'good' ? 'correct' : 'wrong');
    if (keep) this.record({});   // a kept fish is written down now (a release is written after the quick-release step)
    this.show(`<div class="flow verdict ${head.cls}">
      <h2>${head.t}</h2>
      <p class="sub"><b>${esc(this.sp.name)}</b> · ${c.length} cm (its true length${this.measured != null && this.measured !== c.length ? `; you measured ${this.measured} cm` : ''}).</p>
      <p>${esc(head.d)}</p>
      <div class="rule-card"><b>The rule</b>${esc(rule?.note ?? 'No specific limit in this game.')}</div>
      ${!legal ? `<div class="rule-card bad"><b>This fish</b>${esc(v.reason)}</div>` : ''}
      <div class="rule-card why"><b>Why the rule exists</b>${esc(why)}</div>
      ${flipped ? `<div class="rule-card"><b>Measuring matters</b>Your reading of ${this.measured} cm would have given a different answer from its true ${c.length} cm. One cm under is still undersize.</div>` : ''}
      ${pest ? `<p class="muted">Pest fish taken out of the river so far: ${p.pest?.removed ?? 0}.</p>` : `<p class="muted">Kept today ${rule?.bagLabel ? `(${esc(rule.bagLabel)})` : 'of this species'}: ${this.keptToday}${rule?.bag ? ` of ${rule.bag}` : ''}.</p>`}
      ${keep ? this.payHTML() : ''}
      <p><button class="btn primary" id="v-next">${keep ? 'Continue' : pest ? 'Put it back' : 'Release it now'}</button></p>
    </div>`);
    const next = this.panel.body.querySelector('#v-next');
    next.onclick = () => { if (!keep && pest) { this.record({}); this.closeFlow(); } else if (keep) this.closeFlow(); else this.stepRelease(); };   // a pest fish that goes back needs no survival card
    next.focus();
  }

  // ---------------------------------------------------------------- 4. the quick release
  stepRelease() {
    const g = this.game, depthM = this.c.ctx?.depth, deep = this.sp.deepWater && (depthM == null || depthM >= BAROTRAUMA_DEPTH), tagKit = hasItem(this.p, 'tool-tagkit'), weightKit = deep && hasItem(this.p, 'tool-releaseweight');
    const net = g.gearStats().net, airMul = net ? 0.65 : 1;   // a knotless landing net keeps the fish in the water while you unhook it: the clock runs slower
    this.show(`<div class="flow release">
      <h2>Quick release</h2>
      <p class="sub">Get ${esc(this.sp.name)} back in the water fast, and gently. The clock is running.</p>
      <div class="air"><div class="air-bar"><i id="air-fill"></i><b></b></div><div class="air-t" id="air-t">0.0 s out of the water · aim for under ${AIR_LIMIT} s</div></div>
      <div class="rel-steps">
        <button class="btn" id="rel-wet" aria-pressed="false">💧 Wet your hands</button>
        ${tagKit ? '<button class="btn" id="rel-tag" aria-pressed="false" title="Tag-and-release: a numbered tag shows scientists where it goes">🏷 Tag it</button>' : ''}
        ${weightKit ? '<button class="btn" id="rel-weight" aria-pressed="false" title="A release weight sinks a deep-water fish back to depth">⚖ Clip on the release weight</button>' : ''}
        <button class="hold" id="rel-hold" aria-label="Hold to unhook the fish"><i id="hold-fill"></i><span>Hold to unhook</span></button>
      </div>
      <p class="muted" id="rel-hint">Dry hands rub off the slime that protects a fish from disease. Wet them first.${net ? ' Your landing net keeps the fish in the water while you unhook it, so the clock runs about a third slower.' : ''}</p>
      ${!deep && this.sp.deepWater && depthM != null ? `<div class="rule-card"><b>Caught at ${depthM.toFixed(1)} m</b>${esc(this.sp.name)} is a deep-water fish, but barotrauma is a concern from about ${BAROTRAUMA_DEPTH} m. Here it is shallower than that, so the gas bladder is unlikely to have swollen and no release weight is needed. Fish deeper and it matters.</div>` : ''}
      ${deep ? `<div class="rule-card"><b>Deep-water fish${depthM != null ? ` · caught at ${depthM.toFixed(1)} m` : ''}</b>${esc(this.sp.name)} come from deep water, where the pressure is much higher. Pulled up fast, their gas bladder can swell (barotrauma). ${weightKit ? 'You have a release weight: clip it on so the fish sinks back to depth.' : 'A release weight returns them to depth (Dr Priya at the dinghy landing has one for a good citizen scientist). For now: unhook gently and be quick.'}</div>` : ''}
    </div>`);
    const b = this.panel.body, wetBtn = b.querySelector('#rel-wet'), hold = b.querySelector('#rel-hold'), fill = b.querySelector('#hold-fill');
    const air = b.querySelector('#air-fill'), airT = b.querySelector('#air-t');
    let tagged = false, weighted = false;
    const toggle = (id, on, label) => { const el = b.querySelector(id); if (el) el.onclick = () => { const v = on(); el.setAttribute('aria-pressed', v); el.classList.toggle('on', v); el.textContent = v ? `${label} ✓` : label; }; };
    toggle('#rel-tag', () => (tagged = !tagged), '🏷 Tag it'); toggle('#rel-weight', () => (weighted = !weighted), '⚖ Clip on the release weight');
    let wet = false, holdT = 0, holding = false, last = performance.now(), done = false;
    const t0 = performance.now();
    wetBtn.onclick = () => { wet = !wet; wetBtn.setAttribute('aria-pressed', wet); wetBtn.classList.toggle('on', wet); wetBtn.textContent = wet ? '💧 Hands wet ✓' : '💧 Wet your hands'; g.audio.play('smallSplash'); };
    const down = () => { holding = true; };
    const up = () => { holding = false; };
    hold.addEventListener('pointerdown', e => { hold.setPointerCapture(e.pointerId); down(); });
    hold.addEventListener('pointerup', up); hold.addEventListener('pointercancel', up);
    const kd = e => { if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && document.activeElement === hold) { e.preventDefault(); down(); } };
    const ku = e => { if (e.code === 'Space' || e.code === 'Enter') up(); };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    const tick = () => {
      if (done) return;
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      const secs = (now - t0) / 1000 * airMul;
      air.style.width = `${Math.min(100, secs / AIR_LIMIT * 100)}%`; air.classList.toggle('late', secs > AIR_LIMIT);
      airT.textContent = `${secs.toFixed(1)} s out of the water · ${secs > AIR_LIMIT ? 'too long! Hurry' : `aim for under ${AIR_LIMIT} s`}`;
      holdT = holding ? holdT + dt : Math.max(0, holdT - dt * 2.5);
      fill.style.width = `${Math.min(100, holdT / HOLD_S * 100)}%`; hold.classList.toggle('on', holding);
      if (holdT >= HOLD_S) { finish(secs); return; }
      this.raf = requestAnimationFrame(tick);
    };
    const finish = secs => {
      done = true; removeEventListener('keydown', kd); removeEventListener('keyup', ku);
      const ok = wet && secs <= AIR_LIMIT;
      g.audio.play(ok ? 'correct' : 'warn'); g.audio.play('splash');
      this.record({ wet, air: +secs.toFixed(1), tagged, weighted: weighted && deep, net });
      const sv = this.result.surv;
      this.show(`<div class="flow release done ${ok ? 'good' : 'bad'}">
        <h2>${ok ? '✔ Back in the water' : '⚠ Released, but it was rough'}</h2>
        <p class="sub">${secs.toFixed(1)} s out of the water · hands ${wet ? 'wet' : 'DRY'}${net ? ' · landing net' : ''}</p>
        <p>${wet ? '' : 'You handled it with dry hands, which strips its protective slime. '}${secs > AIR_LIMIT ? `That was over ${AIR_LIMIT} seconds out of the water: fish cannot breathe in air, and every second counts. ` : ''}${ok ? 'Wet hands and a quick return give it the best chance to swim away strongly. (Most released fish survive when handled well.)' : 'Next time: wet your hands first and be back in the water in under 10 seconds.'}</p>
        <div class="surv"><div class="surv-top"><b>Estimated survival: ${sv.pct}%</b><small>${survivalLine(this.sp.name, this.id, sv)}</small></div>
          <div class="surv-bar" role="img" aria-label="Survival ${sv.pct} percent"><i class="${sv.pct >= 80 ? 'hi' : sv.pct >= 60 ? 'mid' : 'lo'}" style="width:${sv.pct}%"></i></div>
          <ul class="surv-parts">${sv.parts.map(x => `<li class="${x.good ? 'yes' : 'no'}">${x.good ? '✔' : '✖'} ${esc(x.label)}${x.delta ? ` <em>${x.delta > 0 ? '+' : '−'}${Math.abs(x.delta)}%</em>` : ''}</li>`).join('')}</ul>
          ${this.id === CUT_LINE.id ? `<p class="surv-cut">✂ <b>Deeply hooked?</b> ${esc(CUT_LINE.text)} (DPIRD.) This is a separate lesson from the range above.</p>` : ''}
          ${sv.bayBonus ? `<p class="surv-bay">⚖ <b>Bay Health bonus:</b> returning a ${esc(this.sp.name.toLowerCase())} to depth with the release weight saved a fish that would otherwise be lost (+${sv.bayBonus} stock point${sv.bayBonus > 1 ? 's' : ''} for the species here).</p>` : ''}
          ${deep && !sv.bayBonus ? `<p class="surv-bay">${weightKit ? 'You did not clip on the release weight, so the gas bladder swelled.' : 'A release weight would have returned this fish to depth (buy one at Mitra\'s shop, or earn one from Dr Priya).'}</p>` : ''}
        </div>
        ${this.payHTML()}
        <p><button class="btn primary" id="r-next">Continue</button></p></div>`);
      const nx = this.panel.body.querySelector('#r-next'); nx.onclick = () => this.closeFlow(); nx.focus();
    };
    this.raf = requestAnimationFrame(tick);
    this.cleanup = () => { done = true; cancelAnimationFrame(this.raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); };
    requestAnimationFrame(() => wetBtn.focus({ preventScroll: true }));
  }

  // ---------------------------------------------------------------- 5. write it all down (and pay the citizen-science credits)
  /** Write the fish to the logbook, the Fish Guide and the esky, and pay what the record and the tag earn (economy/coins.js). Sets this.result. */
  record({ wet, air, tagged, weighted, net }) {
    this.cleanup?.(); this.cleanup = null; this.disposeKey();
    const g = this.game, p = this.p, id = this.id, c = this.c, ctx = c.ctx ?? {}, v = this.verdict, keep = this.keep;
    const e = G.entryOf(p, id);
    const identified = G.atLeast(G.tierOf(p, id), 'identified');
    const label = identified ? this.sp.name : `Unknown fish #${e.caught.n}`;
    p.catches ??= [];
    const surv = keep ? null : releaseSurvival(id, { wet, air, weighted, net, depth: ctx.depth });
    const row = { eco: g.eco.id, id, label, n: e.caught.n, length: c.length, measured: this.measured, accurate: this.accurate, kept: keep, legal: v.legal, kind: v.kind, correct: this.correct,
      time: Date.now(), spot: this.spot, tide: ctx.tide ?? undefined, flow: ctx.flow, daytime: ctx.time, rig: ctx.rig, bait: ctx.bait, outing: p.outing?.id ?? null, wet, air, deep: (this.sp.deepWater && (ctx.depth == null || ctx.depth >= BAROTRAUMA_DEPTH)) || undefined, depth: ctx.depth != null ? +ctx.depth.toFixed(1) : undefined, pest: this.sp.rules.pest || undefined, tagged: tagged || undefined, weighted: weighted || undefined, net: net || undefined, survival: surv?.pct };
    p.catches.push(row);
    adjustStock(p, this.spot, id, keep ? (v.legal ? -1 : -4) : 1 + (surv?.bayBonus ?? 0));   // a weighted deep-water release is worth a little extra to the bay
    G.recordDecision(p, id, this.correct, G.masteryDecision(keep, v.legal));
    if (this.sp.rules.pest) recordPest(p, keep);                                                                        // a pest fish goes in the bin, not the esky
    else if (keep) (p.esky ??= []).push({ id, label, length: c.length, legal: v.legal, kind: v.kind, reason: v.reason, time: row.time });
    // Credits: a complete accurate record, and a tag-and-release. Never for the fish itself: a kept fish pays the same as a released one.
    const rec = payRecord(p, row, identified), tag = payTag(p, row), total = rec.amount + tag.amount;
    this.result = { rec, tag, surv, total };
    const o = p.outing;
    if (o) {
      o.caught++;
      if (keep && this.sp.rules.pest) o.pests = (o.pests ?? 0) + 1;                         // a pest fish taken out of the river is its own tally, not an esky fish
      else if (keep) { o.kept++; if (v.legal) o.keptLegal++; else o.keptIllegal++; } else o.released++;
      if (this.measured != null) { o.meas++; if (this.accurate) o.acc++; }
      o.credits = (o.credits ?? 0) + total;
      const tier = G.tierOf(p, id);
      if (tier !== this.tierBefore && G.TIERS.indexOf(tier) > G.TIERS.indexOf(this.tierBefore)) o.gains.push({ id, tier });
      if (v.kind === 'protected' && !keep) o.protectedReleased = (o.protectedReleased ?? 0) + 1;
    }
    g.persist(); g.updateStats();
    if (total > 0) { g.earned(total); g.toast(`🪙 +${total} credits: ${[...rec.parts, ...tag.parts].map(x => x[0].toLowerCase()).join(' + ')}`, 'good'); }
    g.npcs?.onCatch({ id, length: c.length, keep, legal: v.legal, kind: v.kind });   // people nearby react: an undersize keep, a big legal catch
    const tier = G.tierOf(p, id);
    if (G.TIERS.indexOf(tier) > G.TIERS.indexOf(this.tierBefore) && tier === 'mastered') g.toast(`📗 Mastered: ${this.sp.name}! Its guide entry now shows its status, swap and rules.`, 'good');
    else if (tier === 'identified' && this.tierBefore !== 'identified') g.toast(`📗 Identified: ${this.sp.name}. Measure it accurately and make the right call to master it.`, 'good');
    // A ceremony has just become due (every fish Caught, or awards night): say so once, and where to find it.
    const due = g.pendingCeremony?.();
    if (due && g.endingToldFor !== due) { g.endingToldFor = due; setTimeout(() => g.toast(due === 'awards' ? '🏆 Awards night is ready! Head home (H) and the club will be waiting on Bellambi beach.' : '🎉 You have caught every kind of fish! Head home (H) for a celebration at the club.', 'good'), 2200); }
    const flag = G.needsRekey(p, id);
    if (flag && !this.flagToasted) g.toast(`📗 Fish Guide: "Unknown fish #${e.caught.n}" does not match. Open the guide (J) to re-key it.`, 'warn');
  }
  /** What this fish earned (or why it earned nothing): shown on the verdict (kept) and release (released) cards. */
  payHTML() {
    const r = this.result;
    if (!r) return '';
    const lines = [...r.rec.parts, ...r.tag.parts];
    const why = [r.rec.why, r.tag.why].filter(Boolean);
    const tagNo = r.tag.tag ? `<li>🏷 Tag <b>${esc(r.tag.tag)}</b> goes in the tagging database. Scientists look for recaptures to see how far fish travel and how fast they grow.</li>` : '';
    return `<div class="pay ${r.total > 0 ? 'got' : 'none'}">
      <div class="pay-head">🪙 <b>${r.total > 0 ? `+${r.total} credits` : 'No credits this time'}</b> <small>Credits come from good records, never from selling fish (you can't sell your catch in NSW).</small></div>
      <ul>${lines.map(([t, n]) => `<li>${esc(t)} <em>+${n}</em></li>`).join('')}${tagNo}${why.map(w => `<li class="why">${esc(w)}</li>`).join('')}</ul>
    </div>`;
  }
  closeFlow() { this.game.panels.close(true); this.done?.(); }
}
export { SPOT_INFO, RATES };
