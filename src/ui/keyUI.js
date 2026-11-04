// The dichotomous-key panel: the 3D fish (drag to turn, zoom) beside the current couplet as two big cream buttons, a breadcrumb trail of the
// answers so far (tap one to go back to that step), a Back button, an escalating Hint button, and at the end a proposed name to confirm.
// If the confirmed name is wrong, it shows the couplet where the path went wrong (fishing/keyHelp.js) and offers a retry from there; after two
// wrong runs on the same fish (or on request) it walks through the right path. Any help makes the run "assisted" (see fishing/guide.js recordKey).
// Used by the landing flow (ui/catchFlow.js) and by re-keying from the Fish Guide (ui/fishGuideUI.js).
import { KEY } from '../fishing/key.js';
import { wrongStep, walkthrough, hintFor, REVEAL_AFTER } from '../fishing/keyHelp.js';
import { SPECIES_BY_ID } from '../fishing/species.js';
import { FishView } from './fishView.js';
import { esc } from './panels.js';

/**
 * host: element to fill. opts: { id (the real species: its picture, and the help text, are built from it), title, sub, photo, cancelLabel,
 *   onConfirm(leafId, { assisted, revealed }), onCancel, onHelp('hint'|'miss'|'reveal') (the caller records it), misses (wrong full runs so far on this fish), noHelp (no hints or walkthrough) }.
 * Returns { dispose, view }. The player never sees the real name unless they ask for the walkthrough: only the leaf their answers reach.
 */
export function mountKey(host, { id, title, sub, photo, cancelLabel, onConfirm, onCancel, onHelp, misses: priorMisses = 0, noHelp = false }) {
  host.innerHTML = `
    <h2>${esc(title)}</h2>
    <p class="sub">${esc(sub ?? 'Look the fish over, then work through the key. Every question is about something you can see.')}</p>
    <div class="key-grid">
      <div class="fv-wrap">
        <div class="fv" id="fv"></div>
        <div class="fv-tools" role="group" aria-label="Fish view">
          <button class="btn small" data-v="side">Side</button><button class="btn small" data-v="top">Top</button><button class="btn small" data-v="front">Front</button>
          <button class="btn small" id="fv-zo" aria-label="Zoom out">－</button><button class="btn small" id="fv-zi" aria-label="Zoom in">＋</button>
        </div>
        <small class="fv-hint">Drag to turn it · scroll or pinch to zoom</small>
        ${photo ? `<img class="key-photo" src="${photo}" alt="Your catch photo">` : ''}
      </div>
      <div class="key-side" id="key-side"></div>
    </div>`;
  const view = new FishView(host.querySelector('#fv'), id);
  const real = SPECIES_BY_ID[id];
  const viewBtns = [...host.querySelectorAll('[data-v]')];
  const setView = v => { view.setView(v); viewBtns.forEach(b => b.classList.toggle('on', b.dataset.v === v)); };
  viewBtns.forEach(b => { b.onclick = () => setView(b.dataset.v); });
  host.querySelector('#fv-zi').onclick = () => view.zoomBy(1.25);
  host.querySelector('#fv-zo').onclick = () => view.zoomBy(1 / 1.25);
  const side = host.querySelector('#key-side');
  const path = []; // [{ n, ans }]
  const hints = {}; // couplet number -> hint level used so far (0, 1, 2)
  let mode = 'key', walk = null, walkAt = 0, missInfo = null, misses = priorMisses, assisted = false;
  const here = () => { let at = { couplet: KEY.first }; for (const s of path) at = KEY.couplets[s.n][s.ans].to; return at; };
  const help = kind => { assisted = true; onHelp?.(kind); };
  const wireCommon = () => {
    side.querySelector('#key-cancel')?.addEventListener('click', () => onCancel?.());
    side.querySelector('.opt, #key-ok, #miss-retry, #walk-next, #walk-done')?.focus?.({ preventScroll: true });
  };

  // ---- the plain key: breadcrumb + couplet (or the proposed name)
  const renderKey = () => {
    const crumbs = path.length
      ? `<div class="crumbs" aria-label="Your answers so far">${path.map((s, i) => `<button class="crumb" data-i="${i}" title="Go back to couplet ${s.n}">${s.n}${s.ans}</button>`).join('<span>›</span>')}</div>`
      : '<div class="crumbs"><span class="crumb-empty">Your answers will show here</span></div>';
    const at = here();
    let body;
    if (at.leaf) {
      const sp = SPECIES_BY_ID[at.leaf];
      body = `<div class="leaf"><div class="cn">Your key says</div><div class="leaf-name">${esc(sp.name)}</div><div class="sci">${esc(sp.sci)}</div>
        <p>Does that match the fish in front of you? If not, go back and check the last answers.</p>
        <div class="leaf-actions"><button class="btn primary" id="key-ok">Yes, that is my fish</button><button class="btn" id="key-back">← Back one step</button></div></div>`;
    } else {
      const c = KEY.couplets[at.couplet], lvl = hints[c.n] ?? 0, h = lvl ? hintFor(c, real, lvl) : null;
      const to = t => (t.leaf ? 'finish: your key says what it is' : `go to ${t.couplet}`);
      const opt = k => `<button class="opt${h?.option === k ? ' hinted' : ''}" data-a="${k}"><span class="opt-n">${c.n}${k}</span><span class="opt-t">${esc(c[k].text)}${c[k].detail ? `<small>${esc(c[k].detail)}</small>` : ''}${h?.option === k ? '<small class="hint-tag">Hint: this one matches the fish</small>' : ''}</span><span class="opt-go">→ ${esc(to(c[k].to))}</span></button>`;
      const hintBtn = noHelp ? '' : `<button class="btn small hint-btn" id="key-hint" ${lvl >= 2 ? 'disabled' : ''}>${lvl === 0 ? 'Hint' : lvl === 1 ? 'Another hint' : 'Hint used'}</button>`;
      body = `<div class="couplet"><div class="cn">Couplet ${c.n} · ${esc(c.label)}</div>${opt('a')}${opt('b')}
        ${h ? `<p class="hint-box" role="status">${esc(h.text)}</p>` : `<p class="look">${esc(c.look)}</p>`}</div>
        <div class="key-nav"><button class="btn small" id="key-back" ${path.length ? '' : 'disabled'}>← Back</button>${hintBtn}${onCancel ? `<button class="btn small ghost" id="key-cancel">${esc(cancelLabel ?? 'Cancel')}</button>` : ''}</div>`;
    }
    side.innerHTML = crumbs + body;
    side.querySelectorAll('.opt').forEach(b => { b.onclick = () => { path.push({ n: here().couplet, ans: b.dataset.a }); render(); }; });
    side.querySelectorAll('.crumb').forEach(b => { b.onclick = () => { path.length = +b.dataset.i; render(); }; });
    side.querySelector('#key-back')?.addEventListener('click', () => { path.pop(); render(); });
    side.querySelector('#key-hint')?.addEventListener('click', () => {
      const n = here().couplet, lvl = Math.min(2, (hints[n] ?? 0) + 1);
      hints[n] = lvl; help('hint');
      const h = hintFor(KEY.couplets[n], real, lvl); setView(h.view);
      render();
      side.querySelector('#key-hint')?.focus?.({ preventScroll: true });
    });
    side.querySelector('#key-ok')?.addEventListener('click', () => {
      const leaf = here().leaf;
      if (leaf === id) { onConfirm?.(leaf, { assisted, revealed: false }); return; }
      misses++; missInfo = wrongStep(path, real); onHelp?.('miss'); mode = 'miss'; render();
    });
    wireCommon();
  };

  // ---- the key said the wrong species: where it went wrong, and what to do next
  const renderMiss = () => {
    const m = missInfo, wrong = SPECIES_BY_ID[here().leaf], c = KEY.couplets[m.n];
    setView(m.where.view);
    const canWalk = !noHelp, walkFirst = canWalk && misses >= REVEAL_AFTER;
    side.innerHTML = `<div class="miss" role="alert">
        <div class="cn">Not quite</div>
        <div class="miss-title">Your key says <b>${esc(wrong.name)}</b>, but that is not this fish.</div>
        <div class="miss-where">Your path went off at <b>couplet ${m.n} · ${esc(m.label)}</b></div>
        <p class="miss-why">${esc(m.text)}</p>
        <p class="look">${esc(c.look)}</p>
        <div class="leaf-actions">
          <button class="btn ${walkFirst ? '' : 'primary'}" id="miss-retry">Try again from couplet ${m.n}</button>
          ${canWalk ? `<button class="btn ${walkFirst ? 'primary' : ''}" id="miss-walk">Show me the way</button>` : ''}
          <button class="btn small ghost" id="miss-keep">Keep my answer for now</button>
        </div>
        ${walkFirst ? '<p class="muted miss-note">You have been through the key a few times on this fish. Let the walkthrough show you each step.</p>' : ''}
      </div>`;
    side.querySelector('#miss-retry').onclick = () => { assisted = true; path.length = m.index; mode = 'key'; render(); };
    side.querySelector('#miss-walk')?.addEventListener('click', () => { help('reveal'); walk = walkthrough(real); walkAt = 0; mode = 'walk'; render(); });
    side.querySelector('#miss-keep').onclick = () => onConfirm?.(here().leaf, { assisted, revealed: false });
    wireCommon();
  };

  // ---- "Show me the way": the right path, one couplet at a time, then the name
  const renderWalk = () => {
    const total = walk.steps.length;
    if (walkAt >= total) {
      setView('side');
      side.innerHTML = `<div class="leaf"><div class="cn">The way through the key</div><div class="leaf-name">${esc(real.name)}</div><div class="sci">${esc(real.sci)}</div>
        <p>${esc(real.idFeature)}</p>
        <p class="muted">${walk.steps.map(s => `${s.n}${s.ans}`).join(' › ')}. You still have to measure it and decide whether to keep it. Key the next one without help to earn Mastery.</p>
        <div class="leaf-actions"><button class="btn primary" id="walk-done">Log it as ${esc(real.name)}</button><button class="btn" id="walk-prev">← Last step</button></div></div>`;
    } else {
      const s = walk.steps[walkAt];
      setView(s.where.view);
      side.innerHTML = `<div class="crumbs"><span class="crumb-empty">Step ${walkAt + 1} of ${total}</span></div>
        <div class="walk"><div class="cn">Couplet ${s.n} · ${esc(s.label)}</div>
          <div class="opt hinted static"><span class="opt-n">${s.n}${s.ans}</span><span class="opt-t">${esc(s.optionText)}</span></div>
          <p class="walk-look"><b>Look:</b> ${esc(s.where.text)}</p>
          <p class="walk-why">${esc(s.because)}</p>
          <div class="leaf-actions"><button class="btn primary" id="walk-next">${walkAt + 1 === total ? 'Name the fish →' : 'Next couplet →'}</button><button class="btn" id="walk-prev" ${walkAt ? '' : 'disabled'}>← Back</button></div></div>`;
    }
    side.querySelector('#walk-next')?.addEventListener('click', () => { walkAt++; render(); });
    side.querySelector('#walk-prev')?.addEventListener('click', () => { walkAt = Math.max(0, walkAt - 1); render(); });
    side.querySelector('#walk-done')?.addEventListener('click', () => onConfirm?.(id, { assisted: true, revealed: true }));
    wireCommon();
  };

  const render = () => (mode === 'miss' ? renderMiss() : mode === 'walk' ? renderWalk() : renderKey());
  render();
  return { dispose: () => view.dispose(), view };
}
