// The co-op panel (Nell, Belmore Basin): the commercial chapter. Four tabs: Nets lab, Sell at the co-op, Sustainability, Boat.
// All the rules are in economy/commercial.js (pure); all the words are in content/coop.js. Cream cards, big touch targets, works at 375 px.
//   Nets lab      pick a gear, a mesh size, a BRD and a TED, run a haul, see the target and bycatch, meet the goals
//   Sell          land a commercial haul, sell it at the co-op for CO-OP credits (never Club credits), and see why the rec esky can never be sold
//   Sustainability   the six SAFS statuses, quotas by status, the swaps, GoodFish pointer
//   Boat          on-board technology
import { esc } from './panels.js';
import { COOP, GROUPS, SCENARIOS, GEARS, GEAR_ORDER, BRD_INFO, TED_INFO, MESH_TEXT, MARKET, STATUS, SAFS_NUMBERS, GOODFISH_NOTE, UPGRADES, REC_VS_COM, REC_VS_COM_SRC, NO_SELL_REC } from '../content/coop.js';
import * as C from '../economy/commercial.js';

const TABS = [['lab', '⚙ Nets lab'], ['sell', '🐟 Sell'], ['sustain', '🌿 Sustainability'], ['boat', '🔧 Boat']];
const TONE = { good: '✔', bad: '✖', neutral: '•' };

export function openCoop(game, { tab = 'lab', onClose = null } = {}) {
  const panels = game.panels, p = game.progress;
  const coop = C.ensureCoop(p);
  let cur = tab, msg = '', focus = null, last = null, reply = null;
  const lab = { scenario: 'shelf', gear: coop.method?.gear ?? 'handline', mesh: coop.method?.mesh ?? 60, brd: coop.method?.brd ?? false, ted: coop.method?.ted ?? false, result: null };

  // ---------------------------------------------------------------- nets lab
  /** The mesh diagram: the open gap of the relaxed diamond against the fish cards, drawn to the same scale. */
  const meshSVG = () => {
    const S = 2.2, gap = C.gapOf(lab.mesh), gw = gap * S, cx = 80, cy = 60;
    const diamond = `<path d="M${cx} ${cy - 46} L${cx + 52} ${cy} L${cx} ${cy + 46} L${cx - 52} ${cy} Z" fill="none" stroke="#1f5f6b" stroke-width="3" stroke-linejoin="round"/><circle cx="${cx}" cy="${cy - 46}" r="4" fill="#1f5f6b"/><circle cx="${cx}" cy="${cy + 46}" r="4" fill="#1f5f6b"/><circle cx="${cx - 52}" cy="${cy}" r="4" fill="#1f5f6b"/><circle cx="${cx + 52}" cy="${cy}" r="4" fill="#1f5f6b"/>`;
    const gapBar = `<line x1="${cx - Math.min(gw, 100) / 2}" y1="${cy}" x2="${cx + Math.min(gw, 100) / 2}" y2="${cy}" stroke="#c2570a" stroke-width="5" stroke-linecap="round"/>`;
    const net = GEARS[lab.gear].kind === 'net';
    const cards = [GROUPS.small, GROUPS.young, GROUPS.adult, GROUPS.big].map((g, i) => {
      const w = g.width * S, x = 190, y = 14 + i * 28, through = C.retained(lab.gear, g.width, gap) ? false : true;
      return `<g><rect x="${x}" y="${y}" width="${w}" height="18" rx="9" fill="${through ? '#bfe9d9' : '#f6c9b8'}" stroke="#1f5f6b" stroke-width="2"/><text x="${x + w + 8}" y="${y + 13}" font-size="11" font-weight="800" fill="#1f5f6b">${g.width} mm ${esc(g.name.toLowerCase())}${net ? (through ? ' → escapes' : ' → kept') : ''}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 420 124" class="mesh-svg" role="img" aria-label="A net mesh with a gap of ${gap} millimetres against fish cards ${GROUPS.small.width}, ${GROUPS.young.width}, ${GROUPS.adult.width} and ${GROUPS.big.width} millimetres wide">${net ? diamond + gapBar : ''}${cards}${net ? `<text x="${cx}" y="${cy - 52}" text-anchor="middle" font-size="10" font-weight="800" fill="#c2570a">gap ${gap} mm</text>` : ''}</svg>`;
  };
  const resultHTML = r => {
    const sc = SCENARIOS[r.scenario], gl = C.labGoals(r), max = Math.max(1, ...Object.values(r.counts));
    const bars = Object.entries(r.counts).map(([k, n]) => {
      const tgt = k === sc.target, prot = k === 'protected';
      return `<div class="bar-row ${tgt ? 'tgt' : prot ? 'prot' : ''}"><span>${GROUPS[k].icon} ${esc(C.groupName(r.scenario, k))}</span><div class="bar"><i style="width:${Math.max(n ? 3 : 0, n / max * 100)}%"></i></div><b>${n}</b><em>${tgt ? 'target' : prot ? 'protected' : 'bycatch'}</em></div>`;
    }).join('');
    return `<div class="haul" aria-live="polite">
      <h3>Haul result <small>${esc(GEARS[r.gear].name)}${GEARS[r.gear].kind === 'net' && !GEARS[r.gear].gill ? `, ${r.mesh} mm mesh` : GEARS[r.gear].gill ? `, ${r.mesh} mm mesh` : ''}${r.brd ? ' + BRD' : ''}${r.ted ? ' + TED' : ''} · ${esc(sc.name)}</small></h3>
      <div class="bars">${bars}</div>
      <div class="meters"><div><b>${Math.round(r.bycatchShare * 100)}%</b><span>of the haul is bycatch${r.releasedAlive ? ' (released alive)' : ''}</span></div><div><b>${esc(r.seabed ?? 'Not rated')}</b><span>seabed disturbance</span></div><div><b>${r.targetN}</b><span>${esc(C.groupName(r.scenario, sc.target).toLowerCase())} landed</span></div></div>
      <ul class="goals">${gl.list.map(x => `<li class="${x.ok ? 'ok' : 'no'}">${x.ok ? '✔' : '✖'} ${esc(x.text)} <em>(${x.have})</em></li>`).join('')}</ul>
      ${gl.pass ? '<p class="cert">🎖 <b>Well designed!</b> This method meets every goal. Use it for your hauls.</p>' : ''}
      <ul class="notes">${r.notes.map(n => `<li class="${n.tone}">${TONE[n.tone]} ${esc(n.text)}</li>`).join('')}</ul>
      <p><button class="btn ${gl.pass ? 'primary' : ''}" data-act="use">Use this as my boat’s method</button></p></div>`;
  };
  const labTab = () => {
    const g = GEARS[lab.gear], net = g.kind === 'net';
    return `<p class="coop-sub">Pick a fishing ground, a gear and (for nets) a mesh size, then run a haul. Landing the fish you want while letting the young, the big non-target animals and the protected animals go is what a good commercial fisher aims for.</p>
      <h3>1. Where</h3>
      <div class="pick" role="group" aria-label="Fishing ground">${Object.values(SCENARIOS).map(s => `<button class="pill ${lab.scenario === s.id ? 'on' : ''}" aria-pressed="${lab.scenario === s.id}" data-sc="${s.id}"><b>${esc(s.name)}</b><small>${esc(s.blurb)}</small></button>`).join('')}</div>
      <h3>2. Gear</h3>
      <div class="pick gears" role="group" aria-label="Gear">${GEAR_ORDER.map(id => `<button class="pill ${lab.gear === id ? 'on' : ''}" aria-pressed="${lab.gear === id}" data-gear="${id}"><span class="ico">${GEARS[id].icon}</span><b>${esc(GEARS[id].name)}</b></button>`).join('')}</div>
      <div class="how"><p>${esc(g.how)}</p><p class="levels">Seabed: <b>${esc(g.seabed ?? 'not rated')}</b> · Bycatch: <b>${esc(g.bycatch ?? 'not rated')}</b> <small>(${esc(g.src)})</small></p></div>
      ${net ? `<h3>3. Mesh size <small>${lab.mesh} mm stretched</small></h3>
        <div class="mesh-row"><input type="range" id="lab-mesh" min="10" max="120" step="5" value="${lab.mesh}" aria-label="Mesh size in millimetres"><output>${lab.mesh} mm</output></div>
        <p class="coop-sub">${esc(MESH_TEXT.what)} <small>(${esc(MESH_TEXT.src)}; in this game the open gap is half the stretched size.)</small></p>` : '<h3>3. Mesh size</h3><p class="coop-sub">Hooks and traps have no mesh. The fish cards below show what is hooked or trapped at random in this game.</p>'}
      ${meshSVG()}
      ${g.brd || g.ted ? `<div class="devices">${g.brd ? `<label class="chk"><input type="checkbox" id="lab-brd" ${lab.brd ? 'checked' : ''}> <span><b>${esc(BRD_INFO.name)}</b>${esc(BRD_INFO.text)} <small>(${esc(BRD_INFO.src)})</small></span></label>` : ''}${g.ted ? `<label class="chk"><input type="checkbox" id="lab-ted" ${lab.ted ? 'checked' : ''}> <span><b>${esc(TED_INFO.name)}</b>${esc(TED_INFO.text)} <small>(${esc(TED_INFO.src)})</small></span></label>` : ''}</div>` : ''}
      <p><button class="btn primary" data-act="run">Run the haul</button></p>
      ${lab.result ? resultHTML(lab.result) : ''}
      <p class="fine">${esc(MESH_TEXT.right)} <small>(${esc(MESH_TEXT.src)})</small></p>
      <p class="fine">${esc(COOP.gameNumbers)}</p>`;
  };

  // ---------------------------------------------------------------- sell
  const statusChip = m => `<span class="st ${m.st.tone}">${esc(m.st.label)}</span>`;
  const sellTab = () => {
    const c = C.ensureCoop(p), method = c.method, hold = c.hold, left = C.haulsLeftToday(p), esky = p.esky ?? [];
    const methodTxt = method ? `${GEARS[method.gear].name}${GEARS[method.gear].kind === 'net' ? `, ${method.mesh} mm mesh` : ''}${method.brd ? ' + BRD' : ''}${method.ted ? ' + TED' : ''}` : null;
    const rows = MARKET.map(mk => {
      const m = C.marketInfo(mk.id), q = C.quotaLeft(p, mk.id), closed = m.st.quota <= 0, price = C.priceOf(p, mk.id);
      const why = closed || q <= 0 || !method || left <= 0;
      return `<article class="mk ${closed ? 'closed' : ''}"><header><h4>${esc(m.name)}</h4>${statusChip(m)}</header>
        <p class="mk-line"><span>🏦 ${price.toFixed(1)} each</span><span>Quota left: <b>${closed ? 'closed' : `${q} of ${m.st.quota}`}</b></span></p>
        <p class="mk-note">${esc(m.st.buyers)}</p>
        ${closed || m.st.tone === 'warn' ? (m.swap ? `<p class="swap"><b>Swap:</b> ${esc(m.swap.reason)}</p>` : '') : ''}
        <button class="btn ${why ? '' : 'primary'}" data-haul="${m.id}" ${why ? 'aria-disabled="true"' : ''}>${closed ? 'Closed' : 'Fish for it'}${method && !closed ? ` (${C.haulCost(p, method.gear)} to run)` : ''}</button></article>`;
    }).join('');
    return `<p class="coop-sub">Fish like a licensed commercial fisher: run a haul with your method, land the fish the co-op will take, and sell them. Your hauls are limited to <b>${COOP.haulsPerDay} a day</b> (heading home ends a day) and each fish has a <b>quota</b> that resets every ${COOP.quotaDays} days (${C.quotaDaysLeft(p)} left this quota year). Hauls today: <b>${left}</b> left.</p>
      <p class="method ${method ? '' : 'none'}">Your method: <b>${methodTxt ? esc(methodTxt) : 'not chosen yet'}</b> ${method ? '' : '<button class="link" data-tab="lab">Set it in the Nets lab</button>'}</p>
      ${reply ? `<div class="reply ${reply.tone}" role="status">${reply.html}</div>` : ''}
      <div class="mk-grid">${rows}</div>
      <h3>In your hold ${hold.length ? '' : '<small>(empty)</small>'}</h3>
      ${hold.length ? `<ul class="hold">${hold.map(l => { const m = C.marketInfo(l.species); return `<li><b>${l.qty}</b> ${esc(m.name)} <em>× ${C.priceOf(p, l.species).toFixed(1)} = ${Math.round(C.priceOf(p, l.species) * l.qty)}</em></li>`; }).join('')}</ul>
        <p><button class="btn primary" data-act="sell">Sell at the co-op</button></p>` : '<p class="coop-sub">Run a haul to fill the hold.</p>'}
      <div class="nosell"><h3>🧊 Your esky: ${esky.length} fish <small>recreational catch</small></h3>
        <p><b>${esc(NO_SELL_REC.title)}.</b> ${esc(NO_SELL_REC.text)}</p>
        <p><button class="btn small" data-act="trysell">Try to sell my esky</button></p></div>
      <h3>Recreational or commercial?</h3>
      <div class="vs-wrap"><table class="vs"><thead><tr><th></th><th>Recreational</th><th>Commercial</th></tr></thead><tbody>${REC_VS_COM.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>
      <p class="fine">${esc(REC_VS_COM_SRC)}. ${esc(COOP.note)}</p>`;
  };

  // ---------------------------------------------------------------- sustainability
  const sustainTab = () => `<p class="coop-sub">Every fish stock has a status. The co-op sets a bigger quota and a better price for a sustainable stock, a small quota for one that is under pressure, and no landing at all for a depleted one. Check the stock, not just the species.</p>
      <div class="gauge" role="img" aria-label="316 of 503 stocks sustainable, about 63 percent"><i style="width:${Math.round(SAFS_NUMBERS.sustainable / SAFS_NUMBERS.stocks * 100)}%"></i><span>${SAFS_NUMBERS.sustainable} of ${SAFS_NUMBERS.stocks} stocks sustainable ≈ 63%</span></div>
      <p class="fine">${esc(SAFS_NUMBERS.text)} <small>(${esc(SAFS_NUMBERS.src)})</small></p>
      <h3>The six statuses</h3>
      <ul class="six">${Object.entries(STATUS).map(([k, s]) => `<li><span class="st ${s.tone}">${esc(s.label)}</span> ${esc(s.word)}. <em>Quota ${s.quota || 'none (closed)'} · price ×${s.price}</em></li>`).join('')}</ul>
      <h3>What the co-op sees today</h3>
      <div class="mk-grid">${MARKET.map(mk => { const m = C.marketInfo(mk.id); return `<article class="mk"><header><h4>${esc(m.name)}</h4>${statusChip(m)}</header><p class="mk-note">${esc(m.statusNote)}</p>${m.swap ? `<p class="swap"><b>Swap:</b> ${esc(m.swap.reason)}</p>` : ''}</article>`; }).join('')}</div>
      <p class="fine">${esc(GOODFISH_NOTE)}</p><p class="fine">${esc(COOP.gameNumbers)}</p>`;

  // ---------------------------------------------------------------- boat
  const boatTab = () => `<p class="coop-sub">On-board technology helps a boat find fish and bring them home fresh. Spend co-op credits to fit it out.</p>
      <div class="mk-grid">${UPGRADES.map(u => { const own = !!coop.upgrades[u.id]; return `<article class="mk ${own ? 'owned' : ''}"><header><h4>${u.icon} ${esc(u.name)}</h4><span class="price">🏦 ${u.price}</span></header><p>${esc(u.text)} <small>(${esc(u.src)})</small></p><p class="mk-note"><b>In the game:</b> ${esc(u.fx)}</p>
        <button class="btn ${own ? 'on' : 'primary'}" data-up="${u.id}" ${own ? 'aria-disabled="true"' : ''}>${own ? 'Fitted ✓' : 'Buy'}</button></article>`; }).join('')}</div>`;

  // ---------------------------------------------------------------- shell
  const render = () => {
    const c = C.ensureCoop(p);
    panels.body.innerHTML = `<div class="coop">
      <div class="coop-head"><h2>🚢 ${esc(COOP.name)}</h2><div class="coop-coins" aria-live="polite">${COOP.money.icon} <b>${c.credits}</b> <span>${COOP.money.name}</span></div></div>
      <div class="tabs coop-tabs" role="tablist" aria-label="Co-op sections">${TABS.map(([id, label]) => `<button role="tab" id="ctab-${id}" aria-selected="${id === cur}" class="${id === cur ? 'on' : ''}" data-tab="${id}">${label}</button>`).join('')}</div>
      <p class="shop-msg" id="coop-msg" role="status" aria-live="polite">${esc(msg)}</p>
      <div role="tabpanel" aria-labelledby="ctab-${cur}">${{ lab: labTab, sell: sellTab, sustain: sustainTab, boat: boatTab }[cur]()}</div>
      <p class="shop-foot"><button class="btn primary" id="coop-done">Done</button></p></div>`;
    wire();
    const f = focus && (focus.startsWith('tab:') ? panels.body.querySelector(`#ctab-${focus.slice(4)}`) : panels.body.querySelector(focus));
    (f ?? panels.body.querySelector('.tabs button.on'))?.focus({ preventScroll: true }); focus = null;
  };
  const go = (to, f) => { cur = to; msg = ''; reply = null; focus = f ?? `tab:${to}`; render(); };
  const wire = () => {
    const b = panels.body, q = (s, fn) => b.querySelectorAll(s).forEach(fn);
    q('[data-tab]', t => t.onclick = () => go(t.dataset.tab));
    b.querySelector('.coop-tabs')?.addEventListener('keydown', e => {
      if (e.code !== 'ArrowRight' && e.code !== 'ArrowLeft') return;
      const i = TABS.findIndex(t => t[0] === cur); e.preventDefault(); go(TABS[(i + (e.code === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length][0]);
    });
    b.querySelector('#coop-done').onclick = () => panels.close();
    q('[data-sc]', el => el.onclick = () => { lab.scenario = el.dataset.sc; lab.result = null; focus = `[data-sc="${lab.scenario}"]`; render(); });
    q('[data-gear]', el => el.onclick = () => { lab.gear = el.dataset.gear; lab.result = null; if (!GEARS[lab.gear].brd) lab.brd = false; if (!GEARS[lab.gear].ted) lab.ted = false; focus = `[data-gear="${lab.gear}"]`; render(); });
    const mesh = b.querySelector('#lab-mesh');
    if (mesh) {
      mesh.oninput = () => { lab.mesh = +mesh.value; lab.result = null; mesh.nextElementSibling.textContent = `${lab.mesh} mm`; b.querySelector('.mesh-svg').outerHTML = meshSVG(); b.querySelector('.haul')?.remove(); };
      mesh.onchange = () => { focus = '#lab-mesh'; render(); };
    }
    b.querySelector('#lab-brd')?.addEventListener('change', e => { lab.brd = e.target.checked; lab.result = null; focus = '#lab-brd'; render(); });
    b.querySelector('#lab-ted')?.addEventListener('change', e => { lab.ted = e.target.checked; lab.result = null; focus = '#lab-ted'; render(); });
    q('[data-act]', el => el.onclick = () => act(el.dataset.act));
    q('[data-haul]', el => el.onclick = () => haul(el));
    q('[data-up]', el => el.onclick = () => upgrade(el));
  };
  const act = what => {
    if (what === 'run') {
      lab.result = C.simulateHaul({ scenario: lab.scenario, gear: lab.gear, mesh: lab.mesh, brd: lab.brd, ted: lab.ted });
      const gl = C.markLab(p, lab.result); game.persist();
      if (gl.pass) game.audio.play('correct');
      focus = '.haul h3'; render(); panels.body.querySelector('.haul')?.scrollIntoView({ block: 'nearest' });
    } else if (what === 'use') {
      C.setMethod(p, lab); game.persist(); msg = 'Your boat’s method is set. Go to the Sell tab to run a haul.'; game.audio.play('click'); focus = '[data-act="use"]'; render();
    } else if (what === 'sell') {
      const r = C.sellHold(p); game.persist();
      if (r.ok && r.revenue) { game.audio.play('newSpecies'); reply = { tone: 'good', html: `<b>Sold!</b> ${r.lines.map(l => `${l.qty} ${esc(l.name)} for ${l.amount}`).join(', ')}. <b>${COOP.money.icon} +${r.revenue}</b> ${COOP.money.name}. Remember: the haul cost fuel and crew, and sustainable fish earn the best price.` }; }
      else reply = { tone: 'bad', html: esc(r.text ?? 'Nothing to sell.') };
      focus = '[data-act="sell"]'; render();
    } else if (what === 'trysell') {
      const r = C.refuseEskySale(p);
      reply = { tone: 'bad', html: `<b>✖ No sale.</b> ${esc(r.text)} ${esc(NO_SELL_REC.text)}` }; game.audio.play('wrong'); focus = '[data-act="trysell"]'; render();
    }
  };
  const haul = el => {
    if (el.getAttribute('aria-disabled') === 'true') {
      const m = C.marketInfo(el.dataset.haul), c = C.ensureCoop(p);
      reply = { tone: 'bad', html: esc(m.st.quota <= 0 ? `${m.name} is ${m.st.label.toLowerCase()}. The co-op will not land it: a closure protects the stock while it rebuilds. ${m.swap ? m.swap.reason : ''}` : !c.method ? 'Choose your fishing method in the Nets lab first.' : C.haulsLeftToday(p) <= 0 ? 'The crew has done three hauls today. Head home to start a new day.' : `You have used your quota for ${m.name}. It resets in ${C.quotaDaysLeft(p)} day(s).`) };
      focus = `[data-haul="${el.dataset.haul}"]`; render(); return;
    }
    const r = C.runHaul(p, el.dataset.haul); game.persist();
    if (!r.ok) reply = { tone: 'bad', html: esc(r.text) };
    else {
      const m = C.marketInfo(r.speciesId), h = r.haul;
      game.audio.play('splash');
      reply = { tone: r.landed ? 'good' : 'bad', html: `<b>Haul in!</b> ${r.landed} ${esc(m.name)} landed${r.overQuota ? ` (${r.overQuota} more went back: you hit your quota)` : ''}. Cost ${r.cost} for fuel and crew. Bycatch: ${h.bycatchN} animals${h.releasedAlive ? ' (released alive from the trap)' : ''}${h.protectedN ? `, including ${h.protectedN} protected` : ''}; young fish: ${h.youngN}. Seabed: ${esc(h.seabed ?? 'not rated')}.` };
    }
    focus = `[data-haul="${el.dataset.haul}"]`; render();
  };
  const upgrade = el => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    const r = C.buyUpgrade(p, el.dataset.up);
    if (r.ok) { game.persist(); game.audio.play('newSpecies'); msg = `${UPGRADES.find(u => u.id === el.dataset.up).name} fitted.`; } else msg = r.text ?? '';
    focus = `[data-up="${el.dataset.up}"]`; render();
  };
  panels.open('', () => { onClose?.(); });
  render();
}
