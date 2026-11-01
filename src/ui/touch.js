// On-screen controls for phones and tablets. Every button "presses" the same keyboard keys the desktop game
// uses (synthetic keydown/keyup on window), so walking, fishing and UI code need no touch-specific paths.
// Left thumb joystick (WASD, push to the edge to run), drag anywhere else to turn the camera, pinch to zoom, tap a creature for its card.
// Right thumb: Space (cast / strike / reel / jump) and the rod, journal and pause buttons.

/** True on phones/tablets (or with ?touch=1 for testing; ?touch=0 forces desktop controls). */
export function detectTouch() {
  const q = new URLSearchParams(location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const noHover = !matchMedia('(hover: hover)').matches;
  return coarse || (navigator.maxTouchPoints > 0 && noHover);
}

const press = (code, type) => dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));

// Button labels used when rewriting on-screen hints like "(hold W)" or "press Q".
const LABELS = { B: 'the ⚓ button', Space: 'the big button', R: '🎣', T: '🧰', J: '📗', L: '📒', H: '🏠', P: '⏸', E: 'the 💬 button', Q: '📜', W: 'the joystick', Shift: 'push the joystick to the edge' };

export class TouchControls {
  constructor(game) {
    this.game = game; this.input = game.input;
    this.held = new Set();
    document.body.classList.add('touch');
    this.input.touch = true;
    this.input.dragLook = true; // look by dragging; never ask for pointer lock
    this.build();
    // Stop pinch-zoom / double-tap zoom / long-press menus fighting the controls.
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('dblclick', e => e.preventDefault());
    document.addEventListener('contextmenu', e => { if (e.target.closest('#touch')) e.preventDefault(); });
  }

  build() {
    const root = this.root = document.createElement('div');
    root.id = 'touch';
    root.innerHTML = `
      <div class="t-look" id="t-look"></div>
      <div class="t-top">
        <button data-key="KeyT" class="t-land" aria-label="Tackle box">🧰</button>
        <button data-key="KeyJ" class="t-land" aria-label="Fish guide">📗</button>
        <button data-key="KeyQ" class="t-land" aria-label="Quest log">📜</button>
        <button data-key="KeyL" class="t-land" aria-label="Logbook">📒</button>
        <button data-key="KeyH" class="t-land" aria-label="Head home">🏠</button>
        <button data-key="KeyP" aria-label="Pause">⏸</button>
      </div>
      <div class="t-stick t-land" id="t-stick" aria-label="Walk joystick"><div class="t-knob" id="t-knob"></div></div>
      <div class="t-pad t-land">
        <div class="t-row"><button data-key="KeyB" class="t-sm t-land t-anchor" aria-label="Anchor or lift the anchor">⚓</button><button data-key="KeyE" class="t-sm t-talk" aria-label="Talk">💬</button><button data-key="KeyR" class="t-sm" aria-label="Fishing rod">🎣</button></div>
        <div class="t-row"><button data-key="Space" class="t-big" aria-label="Cast, strike, reel or jump">CAST</button></div>
      </div>
      <div id="t-rotate"><div>↻<br>Turn your phone sideways to play</div></div>`;
    document.body.appendChild(root);
    for (const b of root.querySelectorAll('button[data-key]')) this.bindButton(b, b.dataset.key);
    this.bindStick(root.querySelector('#t-stick'), root.querySelector('#t-knob'));
    this.bindLook(root.querySelector('#t-look'));
    // Full screen (Android/iPad; iPhone Safari can't, so the button stays hidden there).
    const fs = document.querySelector('#btn-fullscreen'), de = document.documentElement;
    if (fs && (de.requestFullscreen || de.webkitRequestFullscreen)) {
      fs.classList.remove('hidden');
      fs.onclick = async () => {
        try { await (de.requestFullscreen ?? de.webkitRequestFullscreen).call(de); await screen.orientation?.lock?.('landscape'); } catch { /* not allowed here */ }
      };
    }
  }

  key(code, down) {
    if (down === this.held.has(code)) return;
    if (down) this.held.add(code); else this.held.delete(code);
    press(code, down ? 'keydown' : 'keyup');
  }
  bindButton(el, code) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.game.audio.start();
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      el.classList.add('on');
      this.key(code, true);
    });
    const up = () => { el.classList.remove('on'); this.key(code, false); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('click', e => e.preventDefault()); // no double "click" sound / focus jumps
  }
  /** Analog stick → WASD (+ Shift when pushed right to the edge). */
  bindStick(base, knob) {
    let id = null, cx = 0, cy = 0;
    const R = () => base.clientWidth * 0.42;
    const set = (dx, dy) => {
      const r = R(), len = Math.hypot(dx, dy), k = len > r ? r / len : 1;
      dx *= k; dy *= k;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / r, ny = dy / r, m = Math.hypot(nx, ny);
      this.key('KeyW', ny < -0.35); this.key('KeyS', ny > 0.35);
      this.key('KeyA', nx < -0.35); this.key('KeyD', nx > 0.35);
      this.key('ShiftLeft', m > 0.95);
    };
    base.addEventListener('pointerdown', e => {
      e.preventDefault(); this.game.audio.start();
      id = e.pointerId; try { base.setPointerCapture(id); } catch { /* synthetic */ }
      const b = base.getBoundingClientRect(); cx = b.left + b.width / 2; cy = b.top + b.height / 2;
      base.classList.add('on'); set(e.clientX - cx, e.clientY - cy);
    });
    base.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
    const end = e => { if (e.pointerId !== id) return; id = null; base.classList.remove('on'); set(0, 0); };
    base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  }
  /** Drag to turn the camera, pinch to zoom; a quick tap = click (species info card). */
  bindLook(el) {
    const ptrs = new Map();
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); this.game.audio.start();
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    });
    // One finger: turn the camera round the angler. Two fingers: pinch to zoom.
    const gap = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    el.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      if (ptrs.size >= 2) {
        const before = gap(); p.x = e.clientX; p.y = e.clientY;
        const after = gap(); if (before > 10) this.input.pinch -= (after - before) / 40; // fingers apart = zoom in (a smaller camera distance)
        return;
      }
      const s = 2.2 * (900 / Math.max(500, innerWidth)); // a swipe across the screen is about a half turn of the camera
      this.input.mx += (e.clientX - p.x) * s; this.input.my += (e.clientY - p.y) * s;
      p.x = e.clientX; p.y = e.clientY;
    });
    const end = e => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      ptrs.delete(e.pointerId);
      if (e.type === 'pointerup' && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 12 && performance.now() - p.t < 350) this.input.clicks.push({ button: 0, x: e.clientX, y: e.clientY });
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  /** Called every frame: show the right control set and release everything when gameplay stops. */
  update() {
    const g = this.game;
    const mode = g.panels.isOpen ? 'panel' : g.mode;
    if (mode !== this.mode) {
      this.mode = mode;
      this.root.dataset.mode = mode;
      document.body.dataset.mode = g.mode;
      if (mode !== 'land') this.releaseAll();
    }
    const anc = g.eco?.toggleAnchor ? '1' : '0';   // the ⚓ button only on the boat
    if (this.root.dataset.anchor !== anc) this.root.dataset.anchor = anc;
    // Phone turned upright mid-game: pause behind the 'turn sideways' screen.
    if (g.mode === 'land' && !g.panels.isOpen && innerHeight > innerWidth) { this.releaseAll(); g.pauseMenu(); }
  }
  releaseAll() { for (const c of [...this.held]) this.key(c, false); this.input.clear(); }

  /** Rewrite keyboard hints ("(hold Space)", "<kbd>R</kbd>", "Press J") into the matching button names. */
  label(text) {
    if (!text) return text;
    const L = LABELS, name = k => L[k] ?? k;
    return text
      .replace(/\((hold )?(Space|Shift|[A-Z])\)/g, (m, hold, k) => L[k] ? `(${hold ? 'hold ' : ''}${name(k)})` : m)
      .replace(/<kbd>(Space|Shift|[A-Z])<\/kbd>/g, (m, k) => L[k] ? `<b>${name(k)}</b>` : m)
      .replace(/\b([Pp])ress (Space|[A-Z])\b/g, (m, p, k) => L[k] ? `${p === 'P' ? 'T' : 't'}ap ${name(k)}` : m)
      .replace(/\b([Hh])old (Space|Shift|[A-Z])\b/g, (m, h, k) => L[k] ? `${h}old ${name(k)}` : m)
      .replace(/[Cc]lick to look around/g, 'Drag anywhere to look around')
      .replace(/\bClick\b/g, 'Tap').replace(/\bclick\b/g, 'tap');
  }
}
