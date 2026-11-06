// The knot mini-game panel (Part 2 of the review spec): "which knot" choice, the steps with the picture crossfading, the pull test, the result card;
// plus the knot card and a four-knot list for the tackle box. Pictures are the baked stills in assets/knots/ (only the current knot's are ever requested).
// Structure copied from keyUI.js: it fills game.panels.body, binds on pointer events inside the card (stopping propagation so the touch look layer never sees
// a drag), and tears down in the panel's onClose. Every gesture also works with the one big button (press and hold it) or Space, so keyboard-only play holds.
import { KNOTS, KNOT_ORDER, stepsFor, imgFile } from '../content/knots.js';
import { knotResult, resultReason, RESULT_WORDS, recordKnot, knotsMode, quickAllowed, chooseMode, knotBest, knotCount } from '../fishing/knots.js';
import { esc } from './panels.js';

const IMG_DIR = new URL('../../assets/knots/', import.meta.url);
const url = name => new URL(imgFile(name), IMG_DIR).href;
const lower1 = t => t.charAt(0).toLowerCase() + t.slice(1);
const HOLD_MS = { drag: 900, hold: 1400 }, TUG_MS = 1300;
const isTouch = () => document.body.classList.contains('touch');
const bestText = (p, id) => { const b = knotBest(p, id); return b ? RESULT_WORDS[b] : 'not yet'; };
const SUB = {
  board: job => job,
  retie: () => 'Your line was cut, so tie on again.',
  mission: () => 'Tie it so it holds in the pull test.',
};

/**
 * Open the knot game. opts: { id, mode: 'full' | 'quick', reason: 'board' | 'retie' | 'mission', onDone(result) }.
 * onDone gets the last pull-test result ('hold' | 'slip' | 'break') when the panel closes, or null if it was closed before a pull test.
 * ?knots=off (or settings.knots) calls onDone('hold') at once with no UI and records a Hold (without counting a practice) so missions still progress;
 * ?knots=quick forces the quick version. A 'quick' request for a knot never held before runs the full version.
 */
export function openKnot(game, { id, mode = 'full', reason = 'board', onDone } = {}) {
  const k = KNOTS[id], p = game.progress;
  if (!k) { onDone?.(null); return null; }
  const setting = knotsMode(game.settings, new URLSearchParams(location.search));
  if (setting === 'off') { recordKnot(p, id, 'hold', { count: false }); game.persist?.(); onDone?.('hold'); return null; }
  if (setting === 'quick') mode = 'quick'; else if (mode === 'quick' && !quickAllowed(p, id)) mode = 'full';
  return runKnot(game, id, mode, reason, onDone);
}

function runKnot(game, id, mode, reason, onDone) {
  const k = KNOTS[id], p = game.progress, panels = game.panels, reduced = !!game.settings?.reducedMotion;
  const steps = stepsFor(id, mode);
  const S = { phase: mode === 'full' ? 'quiz' : 'steps', si: 0, taps: 0, wraps: {}, wet: mode === 'quick', busy: false, last: null, drag: null, shown: null };
  const timers = new Set();
  let hold = null, root = null, disposed = false;
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, reduced ? Math.min(ms, 60) : ms); timers.add(t); };
  const q = s => root.querySelector(s);

  // ---- shared pieces
  const head = () => `<div class="kn-head"><h2>${esc(k.name)}</h2><p class="sub">${esc((SUB[reason] ?? SUB.board)(k.job))}</p></div>`;
  const stillNames = () => [...new Set([...steps.flatMap(s => [s.img, ...s.imgs]), k.final])];
  const stageHTML = () => `<div class="kn-stage" id="kn-stage"><div class="kn-imgs" id="kn-imgs">${stillNames().map(n => `<img src="${url(n)}" data-n="${n}" alt="" loading="lazy" decoding="async" draggable="false">`).join('')}</div><i class="kn-target hidden" id="kn-target"></i><i class="kn-bead hidden" id="kn-bead" aria-hidden="true"></i></div>`;
  const show = (name, ghost = false) => {
    S.shown = name;
    root.querySelectorAll('#kn-imgs img').forEach(i => i.classList.toggle('on', i.dataset.n === name));
    q('#kn-stage')?.classList.toggle('ghost', ghost);
  };
  const pos = (el, [x, y]) => { el.style.left = `${x * 100}%`; el.style.top = `${y * 100}%`; };
  const wrapIdx = steps.map((s, i) => (s.wrap ? i : -1)).filter(i => i >= 0);
  const wrapsMade = () => (wrapIdx.length ? Math.min(...wrapIdx.map(i => S.wraps[i] ?? 0)) : undefined);

  // ---- phase: which knot?
  const renderQuiz = () => {
    S.phase = 'quiz';
    root.innerHTML = `${head()}<div class="kn-quiz"><p class="kn-q">${esc(k.quiz)}</p>
      <div class="kn-opts">${KNOT_ORDER.map(o => `<button class="btn kn-opt" data-k="${o}">${esc(KNOTS[o].name)}</button>`).join('')}</div>
      <p class="kn-why" id="kn-why" role="status" aria-live="polite"></p></div>`;
    root.querySelectorAll('.kn-opt').forEach(b => { b.onclick = () => {
      if (b.dataset.k === id) { renderSteps(); return; }
      b.classList.add('wrong'); b.disabled = true;
      q('#kn-why').textContent = `The ${KNOTS[b.dataset.k].name} ${lower1(KNOTS[b.dataset.k].job)}. That is not the job here, so pick again.`;
    }; });
    root.querySelector('.kn-opt')?.focus?.({ preventScroll: true });
  };

  // ---- phase: the steps (and the test, which shares the layout)
  const renderSteps = () => {
    S.phase = 'steps'; S.si = 0; S.wraps = {}; S.wet = mode === 'quick'; S.busy = false;
    root.innerHTML = `${head()}<div class="kn-main">${stageHTML()}<div class="kn-side">
      <p class="kn-say" id="kn-say" aria-live="polite"></p><p class="kn-count" id="kn-count"></p>
      <ol class="kn-strip" aria-label="Steps">${steps.map(() => '<li></li>').join('')}<li class="t"></li></ol>
      <div class="kn-actions"><button class="btn primary big kn-act" id="kn-act" data-own><span id="kn-act-l"></span><small id="kn-act-h"></small></button>
        <button class="btn small ghost kn-sec" id="kn-sec" data-own></button></div></div></div>`;
    bindStage(); bindAct();
    showStep();
  };
  const cur = () => steps[S.si];
  const setStrip = () => root.querySelectorAll('.kn-strip li').forEach((li, i) => { li.className = (li.classList.contains('t') ? 't ' : '') + (i < S.si ? 'done' : i === S.si ? 'cur' : ''); });
  const setAct = (label, hint) => { q('#kn-act-l').textContent = label; q('#kn-act-h').textContent = isTouch() ? '' : hint; };
  const sec = (label, fn) => { const b = q('#kn-sec'); b.hidden = !label; b.textContent = label ?? ''; b.onclick = fn; b.disabled = false; };
  const showStep = () => {
    S.taps = 0; S.busy = false; S.drag = null;
    const s = cur(), bead = q('#kn-bead'), target = q('#kn-target');
    setStrip();
    show(s.img, s.img === s.imgs[0]);
    bead.classList.add('hidden'); target.classList.add('hidden'); bead.classList.remove('drag');
    q('#kn-count').textContent = '';
    q('#kn-say').textContent = s.say;
    sec(null);
    const act = q('#kn-act'); act.style.setProperty('--p', 0);
    if (s.gesture === 'drag') {
      pos(bead, s.from); pos(target, s.to); bead.classList.remove('hidden'); target.classList.remove('hidden');
      q('#kn-say').textContent = `${s.say} Drag the glowing end to the ring, or hold the button.`;
      setAct('Hold to do it', 'or hold Space');
    } else if (s.gesture === 'taps') {
      setAct(s.wrap ? 'Tap to wrap' : 'Tap', s.wrap ? 'or tap Space' : 'or tap Space');
      if (s.wrap) { q('#kn-count').textContent = `Wraps: 0 of ${s.n}`; sec('That is enough', () => finishStep()); q('#kn-sec').disabled = true; }
    } else if (s.gesture === 'wet') {
      setAct('Wet it', 'or tap Space'); sec('Skip wetting', () => { S.wet = false; finishStep(); });
    } else {
      setAct('Hold to pull tight', 'or hold Space');
    }
    act.focus?.({ preventScroll: true });
  };
  const finishStep = () => {
    if (S.busy) return; S.busy = true; holdStop();
    const s = cur(), bead = q('#kn-bead');
    bead.classList.add('hidden'); q('#kn-target').classList.add('hidden');
    if (s.gesture !== 'taps' && !(s.gesture === 'wet' && !S.wet)) show(s.imgs[s.imgs.length - 1]);
    S.si++; setStrip();
    later(() => { S.busy = false; S.si >= steps.length ? showTest() : showStep(); }, 380);
  };
  const tap = () => {
    const s = cur(); S.taps++;
    show(s.imgs[Math.min(S.taps, s.imgs.length) - 1]);
    if (s.wrap) { S.wraps[S.si] = S.taps; q('#kn-count').textContent = `Wraps: ${S.taps} of ${s.n}`; q('#kn-sec').disabled = S.taps >= s.n; }
    if (S.taps >= s.n) finishStep();
  };
  const dropsHTML = '<span class="kn-drops" aria-hidden="true"><i></i><i></i><i></i></span>';
  const wetIt = () => { S.wet = true; q('#kn-stage').insertAdjacentHTML('beforeend', dropsHTML); finishStep(); };

  // hold-to-fill (the big button / Space): drives a bead along its drag, or the pull-tight crossfade
  const holdStop = () => {
    if (!hold) return; cancelAnimationFrame(hold.raf); hold = null;
    const act = q('#kn-act'); act?.style.setProperty('--p', 0);
    if (S.phase === 'steps' && !S.busy) { const s = cur(); if (s?.gesture === 'hold') show(s.img); if (s?.gesture === 'drag') { pos(q('#kn-bead'), s.from); } }
  };
  const holdStart = dur => {
    if (hold || S.busy) return;
    const s = cur(), t0 = performance.now(), act = q('#kn-act'), bead = q('#kn-bead');
    hold = { raf: 0 };
    const tick = () => {
      const f = Math.min(1, (performance.now() - t0) / (reduced ? dur / 3 : dur));
      act.style.setProperty('--p', f);
      if (s.gesture === 'drag') pos(bead, [s.from[0] + (s.to[0] - s.from[0]) * f, s.from[1] + (s.to[1] - s.from[1]) * f]);
      else show(s.imgs[Math.min(s.imgs.length - 1, Math.floor(f * s.imgs.length))]);
      if (f >= 1) { hold = null; act.style.setProperty('--p', 0); finishStep(); } else hold.raf = requestAnimationFrame(tick);
    };
    tick();
  };
  const actDown = () => {
    if (S.phase === 'test') { runTest(); return; }
    if (S.phase !== 'steps' || S.busy) return;
    const s = cur();
    if (s.gesture === 'taps') tap(); else if (s.gesture === 'wet') wetIt(); else holdStart(HOLD_MS[s.gesture]);
  };
  const actUp = () => holdStop();
  function bindAct() {
    const act = q('#kn-act');
    act.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { act.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ } act.classList.add('on'); actDown(); });
    const up = e => { e.stopPropagation(); act.classList.remove('on'); actUp(); };
    act.addEventListener('pointerup', up); act.addEventListener('pointercancel', up); act.addEventListener('lostpointercapture', up);
    // Enter on the focused button (a click with no pointer): hold gestures complete at once, taps and wets act once.
    act.addEventListener('click', e => {
      if (e.detail !== 0) return;
      if (S.phase === 'test') { runTest(); return; }
      const s = S.phase === 'steps' && !S.busy ? cur() : null;
      if (!s) return;
      if (s.gesture === 'drag' || s.gesture === 'hold') { show(s.imgs[s.imgs.length - 1]); finishStep(); } else actDown();
    });
  }

  // dragging the tag-end bead with a finger or the mouse
  function bindStage() {
    const stage = q('#kn-stage'), bead = q('#kn-bead');
    const rel = e => { const r = stage.getBoundingClientRect(); return { r, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
    const near = (r, a, b, rad) => Math.hypot((a[0] - b[0]) * r.width, (a[1] - b[1]) * r.height) <= rad;
    stage.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (S.phase !== 'steps' || S.busy || cur().gesture !== 'drag') return;
      const { r, x, y } = rel(e);
      if (!near(r, [x, y], cur().from, Math.max(46, r.width * 0.1))) return;
      e.preventDefault(); holdStop();
      try { stage.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      S.drag = e.pointerId; bead.classList.add('drag');
    });
    stage.addEventListener('pointermove', e => {
      if (S.drag !== e.pointerId) return;
      e.stopPropagation();
      const { r, x, y } = rel(e), c = [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
      pos(bead, c);
      if (near(r, c, cur().to, Math.max(34, r.width * 0.075))) { S.drag = null; finishStep(); }
    });
    const end = e => { if (S.drag !== e.pointerId) return; S.drag = null; bead.classList.remove('drag'); if (!S.busy) pos(bead, cur().from); };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  }

  // ---- phase: the pull test
  const showTest = () => {
    S.phase = 'test'; S.busy = false;
    setStrip(); q('.kn-strip .t').classList.add('cur');
    show(steps.at(-1).imgs.at(-1));
    q('#kn-say').textContent = 'Tied. Now give it a firm tug: the pull test.';
    q('#kn-count').textContent = ''; sec(null);
    setAct('Pull test', 'or tap Space');
    q('#kn-act').focus?.({ preventScroll: true });
  };
  const runTest = () => {
    if (S.busy) return; S.busy = true;
    const wraps = wrapsMade(), res = knotResult({ knot: id, wraps, wet: S.wet }), why = resultReason({ knot: id, wraps, wet: S.wet });
    recordKnot(p, id, res); game.persist?.();
    S.last = res; S.why = why;
    const imgs = q('#kn-imgs'); imgs.classList.add(`tug-${res}`);
    q('#kn-say').textContent = 'Pulling...';
    later(renderResult, reduced ? 0 : TUG_MS);
  };

  // ---- the result card
  const renderResult = () => {
    S.phase = 'result';
    const res = S.last, ok = res === 'hold', n = knotCount(p, id);
    root.innerHTML = `${head()}<div class="kn-main">
      <div class="kn-stage kn-still"><div class="kn-imgs"><img src="${url(k.final)}" class="on" alt="The finished ${esc(k.name)}" loading="lazy" draggable="false"></div></div>
      <div class="kn-side"><div class="kn-result ${res}" role="status"><div class="kn-word">${esc(RESULT_WORDS[res])}</div><p class="kn-reason">${esc(S.why)}</p></div>
        <p class="kn-meta">Practised × ${n}. Best so far: ${esc(bestText(p, id))}.</p>
        <div class="kn-actions">${ok ? '<button class="btn primary big" id="kn-done" data-own>Done</button><button class="btn small ghost" id="kn-again" data-own>Tie it again</button>'
          : '<button class="btn primary big" id="kn-again" data-own>Try again (free)</button><button class="btn small ghost" id="kn-done" data-own>Done</button>'}</div></div></div>
      ${footHTML(k)}`;
    q('#kn-again').onclick = () => { renderSteps(); };
    q('#kn-done').onclick = () => panels.close(true);
    q(ok ? '#kn-done' : '#kn-again').focus?.({ preventScroll: true });
  };

  // ---- lifecycle
  const onKey = e => {
    if (!root.isConnected) { dispose(); return; }
    if (e.code !== 'Space' || (S.phase !== 'steps' && S.phase !== 'test')) return;
    if (e.target?.closest?.('[data-own]:not(#kn-act)')) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'keydown') { if (!e.repeat) { q('#kn-act')?.classList.add('on'); actDown(); } } else { q('#kn-act')?.classList.remove('on'); actUp(); }
  };
  function dispose() {
    if (disposed) return; disposed = true;
    removeEventListener('keydown', onKey, true); removeEventListener('keyup', onKey, true);
    if (hold) cancelAnimationFrame(hold.raf); hold = null;
    timers.forEach(clearTimeout); timers.clear();
    onDone?.(S.last);
  }
  panels.open('<div class="kn" id="kn"></div>', dispose);
  root = panels.body.querySelector('#kn');
  addEventListener('keydown', onKey, true); addEventListener('keyup', onKey, true);
  if (S.phase === 'quiz') renderQuiz(); else renderSteps();
  return { close: () => panels.close(true) };
}

const footHTML = k => `<div class="kn-foot">
  <p class="kn-real"><b>Tie it three times for real</b> (worksheet ${esc(k.worksheet)}). The game rehearses the knot for the bench. It does not replace it.</p>
  <details class="kn-notes"><summary>Over and under notes</summary><ul>${k.overUnder.map(t => `<li>${esc(t)}</li>`).join('')}</ul></details>
  <p class="kn-src">Source: ${esc(k.source)}.</p></div>`;

/** The knot card: the finished diagram, its job, where it is used, how often you have practised it and your best result, and a Tie it button. onClose(result|null) runs once when the card, or the game it opened, closes. */
export function openKnotCard(game, id, { onBack, onClose } = {}) {
  const k = KNOTS[id], p = game.progress;
  if (!k) return;
  const mode = chooseMode({ setting: knotsMode(game.settings, new URLSearchParams(location.search)), reason: 'board', p, id });
  game.panels.open(`<div class="kn kn-card" id="kn">
    <div class="kn-head"><h2>${esc(k.name)}</h2><p class="sub">${esc(k.job)}</p></div>
    <div class="kn-main"><div class="kn-stage kn-still"><div class="kn-imgs"><img src="${url(k.final)}" class="on" alt="The finished ${esc(k.name)}" loading="lazy" draggable="false"></div></div>
      <div class="kn-side"><p><b>Where it is used:</b> ${esc(k.where)}</p>
        <p class="kn-meta">${k.wraps ? `${esc(k.wraps)} wraps${id === 'blood' ? ' each side' : ''}. ` : ''}Practised × ${knotCount(p, id)}. Best so far: ${esc(bestText(p, id))}.</p>
        <div class="kn-actions"><button class="btn primary big" id="kn-tie" data-own>${mode === 'off' ? 'Mark it done' : 'Tie it'}</button>${onBack ? '<button class="btn small ghost" id="kn-back" data-own>Back</button>' : ''}</div></div></div>
    ${footHTML(k)}</div>`, () => onClose?.(null));
  const b = game.panels.body;
  // Tie it replaces this panel (and its close hook), so onClose runs exactly once: here if the card is closed, or from openKnot's onDone.
  b.querySelector('#kn-tie').onclick = () => openKnot(game, { id, mode, reason: 'board', onDone: onClose });
  b.querySelector('#kn-back')?.addEventListener('click', onBack);
}

/** The tackle box "Knots" page: all four knots with your best result and a button to open each card. */
export function openKnotsList(game, { onBack } = {}) {
  const p = game.progress;
  game.panels.open(`<div class="kn kn-list" id="kn"><div class="kn-head"><h2>Knots</h2><p class="sub">Tie each one here, then three times for real (worksheet 2.1.6).</p></div>
    <ul class="kn-rows">${KNOT_ORDER.map(id => `<li><img src="${url(KNOTS[id].final)}" alt="" loading="lazy" draggable="false">
      <div><b>${esc(KNOTS[id].name)}</b><small>${esc(KNOTS[id].job)}</small><small>Practised × ${knotCount(p, id)}. Best: ${esc(bestText(p, id))}.</small></div>
      <button class="btn small" data-k="${id}">Open</button></li>`).join('')}</ul>
    <p class="kn-actions">${onBack ? '<button class="btn small ghost" id="kn-back" data-own>Back</button>' : ''}</p></div>`);
  const b = game.panels.body;
  b.querySelectorAll('[data-k]').forEach(btn => { btn.onclick = () => openKnotCard(game, btn.dataset.k, { onBack: () => openKnotsList(game, { onBack }) }); });
  b.querySelector('#kn-back')?.addEventListener('click', onBack);
}
