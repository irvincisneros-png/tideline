// The dichotomous-key panel: the 3D fish (drag to turn, zoom) beside the current couplet as two big cream buttons, a breadcrumb trail of the
// answers so far (tap one to go back to that step), a Back button, and at the end a proposed name to confirm.
// Used by the landing flow (ui/catchFlow.js) and by re-keying from the Fish Guide (ui/fishGuideUI.js).
import { KEY } from '../fishing/key.js';
import { SPECIES_BY_ID } from '../fishing/species.js';
import { FishView } from './fishView.js';
import { esc } from './panels.js';

/**
 * host: element to fill. opts: { id (the real species: only its picture is used), title, sub, photo, cancelLabel, onConfirm(leafId), onCancel }.
 * Returns { dispose }. The player never sees the real name: only the leaf their answers reach.
 */
export function mountKey(host, { id, title, sub, photo, cancelLabel, onConfirm, onCancel }) {
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
  host.querySelectorAll('[data-v]').forEach(b => { b.onclick = () => view.setView(b.dataset.v); });
  host.querySelector('#fv-zi').onclick = () => view.zoomBy(1.25);
  host.querySelector('#fv-zo').onclick = () => view.zoomBy(1 / 1.25);
  const side = host.querySelector('#key-side');
  const path = []; // [{ n, ans }]
  const here = () => { let at = { couplet: KEY.first }; for (const s of path) at = KEY.couplets[s.n][s.ans].to; return at; };
  const render = () => {
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
      const c = KEY.couplets[at.couplet];
      const to = t => (t.leaf ? 'finish: your key says what it is' : `go to ${t.couplet}`);
      const opt = k => `<button class="opt" data-a="${k}"><span class="opt-n">${c.n}${k}</span><span class="opt-t">${esc(c[k].text)}${c[k].detail ? `<small>${esc(c[k].detail)}</small>` : ''}</span><span class="opt-go">→ ${esc(to(c[k].to))}</span></button>`;
      body = `<div class="couplet"><div class="cn">Couplet ${c.n} · ${esc(c.label)}</div>${opt('a')}${opt('b')}<p class="look">${esc(c.look)}</p></div>
        <div class="key-nav"><button class="btn small" id="key-back" ${path.length ? '' : 'disabled'}>← Back</button>${onCancel ? `<button class="btn small ghost" id="key-cancel">${esc(cancelLabel ?? 'Cancel')}</button>` : ''}</div>`;
    }
    side.innerHTML = crumbs + body;
    side.querySelectorAll('.opt').forEach(b => { b.onclick = () => { path.push({ n: here().couplet, ans: b.dataset.a }); render(); }; });
    side.querySelectorAll('.crumb').forEach(b => { b.onclick = () => { path.length = +b.dataset.i; render(); }; });
    side.querySelector('#key-back')?.addEventListener('click', () => { path.pop(); render(); });
    side.querySelector('#key-cancel')?.addEventListener('click', () => onCancel?.());
    side.querySelector('#key-ok')?.addEventListener('click', () => onConfirm?.(here().leaf));
    side.querySelector('.opt, #key-ok')?.focus?.({ preventScroll: true });
  };
  render();
  return { dispose: () => view.dispose(), view };
}
