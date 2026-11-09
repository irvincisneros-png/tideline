// Keyboard + mouse. Drag with any mouse button to look (pointer lock is not used: it is confusing on school laptops). Game code polls `keys` and drains mouse deltas.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last frame
    this.mx = 0; this.my = 0;
    this.wheel = 0; this.pinch = 0; // zoom: wheel ticks and touch pinch (drained by the camera rig)
    this.mouse = { x: 0, y: 0, t: -99 }; // last pointer position over the canvas (aiming casts at the cursor)
    this.clicks = []; this.locked = false;
    this.wantLock = false;
    this.mouseDown = { 0: false, 2: false };
    this.gameplay = false; // set by the game while surfing/diving with no panel open
    this.dragLook = true;  // look by dragging with any mouse button (a click without a drag is still a click); pointer lock is never asked for
    addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      // Leave Tab/Space/Enter alone for buttons and dialogs so the UI stays keyboard-operable.
      if (!this.gameplay) return;
      const k = e.code;
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseDown = { 0: false, 1: false, 2: false }; this.downAt = null; canvas.classList.remove('dragging'); });
    // Look: pointer lock when available; otherwise drag with the left mouse button (fallback for blocked pointer lock).
    addEventListener('mousemove', e => {
      if (e.target === canvas) { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.t = performance.now(); }
      // The camera turns while the right (or middle) button is held; pointer lock and left-drag are the fallbacks.
      if (this.locked || this.mouseDown[2] || this.mouseDown[1] || (this.dragLook && this.mouseDown[0])) { this.mx += e.movementX; this.my += e.movementY; }
    });
    canvas.addEventListener('wheel', e => { if (!this.gameplay) return; e.preventDefault(); this.wheel += Math.sign(e.deltaY) * Math.min(3, Math.abs(e.deltaY) / 100 + 0.5); }, { passive: false });
    canvas.addEventListener('mousedown', e => {
      this.mouseDown[e.button] = true;
      this.downAt = { x: e.clientX, y: e.clientY };
      canvas.classList.add('dragging');
      if (this.wantLock && !this.locked && !this.dragLook) { this.lock(); return; }
      if (!this.dragLook || this.locked) this.clicks.push({ button: e.button, x: e.clientX, y: e.clientY });
    });
    addEventListener('mouseup', e => {
      this.mouseDown[e.button] = false;
      if (!this.mouseDown[0] && !this.mouseDown[1] && !this.mouseDown[2]) canvas.classList.remove('dragging');
      // Drag-look mode: a click without dragging still counts as a click (photo / info card).
      if (this.gameplay && this.dragLook && !this.locked && this.downAt && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) < 5) this.clicks.push({ button: e.button, x: e.clientX, y: e.clientY });
      this.downAt = null;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; this.onLockChange?.(this.locked); });
  }
  lock() {
    const fail = () => { this.dragLook = true; this.onLockFail?.(); };
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(fail); } catch { fail(); }
  }
  get lookActive() { return this.locked || this.dragLook; }
  clear() { this.keys.clear(); this.pressed.clear(); this.mx = this.my = 0; this.clicks = []; }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  down(...codes) { return codes.some(c => this.keys.has(c)); }
  hit(...codes) { return codes.some(c => this.pressed.has(c)); }
  takeMouse() { const r = [this.mx, this.my]; this.mx = 0; this.my = 0; return r; }
  takeZoom() { const z = this.wheel + this.pinch; this.wheel = this.pinch = 0; return z; }
  takeClicks() { const c = this.clicks; this.clicks = []; return c; }
  endFrame() { this.pressed.clear(); }
}
