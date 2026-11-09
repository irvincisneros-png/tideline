// Controller support. Like the touch controls, a pad "presses" the same keys the keyboard game uses (synthetic keydown / keyup on window), so
// walking, fishing and the panels need no pad-specific code. In play: left stick walks, right stick looks, triggers zoom, the face buttons fish.
// With a panel, a conversation or the title screen up: the D-pad or left stick moves the focus to the nearest button that way, confirm clicks it, back is Escape.
// Buttons are read by position (the browser's "standard" layout); only the names printed in hints change with the make of pad.

const press = (code, type, target = window) => target.dispatchEvent(new KeyboardEvent(type, { code, key: KEY_OF[code] ?? code, bubbles: true, cancelable: true }));
const KEY_OF = { Escape: 'Escape', Enter: 'Enter', Space: ' ', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown' };

// Standard layout button numbers.
export const B = { south: 0, east: 1, west: 2, north: 3, l: 4, r: 5, lt: 6, rt: 7, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
/** What is printed on each face button, by family. Nintendo pads confirm with the right-hand button (A), the others with the bottom one. */
export const FAMILIES = {
  xbox: { south: 'A', east: 'B', west: 'X', north: 'Y', select: '⧉', start: '☰', ok: 'south', back: 'east' },
  nintendo: { south: 'B', east: 'A', west: 'Y', north: 'X', select: '−', start: '+', ok: 'east', back: 'south' },
  playstation: { south: '✕', east: '○', west: '□', north: '△', select: 'Share', start: 'Options', ok: 'south', back: 'east' },
};
export function familyOf(id = '') {
  if (/nintendo|pro controller|joy-?con|057e/i.test(id)) return 'nintendo';
  if (/playstation|dualshock|dualsense|054c/i.test(id)) return 'playstation';
  return 'xbox';
}
/** The game's actions as pad buttons: { action: button position }. */
export function layout(family) {
  const f = FAMILIES[family] ?? FAMILIES.xbox;
  return { ok: f.ok, back: f.back, rod: 'west', tackle: 'north', quests: 'l', view: 'r', map: 'select', pause: 'start', guide: 'up', logbook: 'down', home: 'left', anchor: 'right' };
}
// Keyboard hint → the action a pad uses for it (hints are written for the keyboard: "<kbd>Space</kbd>").
const HINT_ACTION = { Space: 'ok', E: 'ok', R: 'rod', T: 'tackle', Q: 'quests', V: 'view', M: 'map', P: 'pause', Esc: 'pause', J: 'guide', L: 'logbook', H: 'home', B: 'anchor' };
const PLAIN = { l: 'L', r: 'R', up: 'D-pad ↑', down: 'D-pad ↓', left: 'D-pad ←', right: 'D-pad →' };
/** The printed name of an action's button on this family of pad ("A", "✕", "D-pad ↑"). */
export function buttonName(family, action) {
  const f = FAMILIES[family] ?? FAMILIES.xbox, pos = layout(family)[action];
  return f[pos] ?? PLAIN[pos] ?? pos;
}
/** Rewrite keyboard hints into pad button names. Pure: (text, family) → text. */
export function padLabel(text, family) {
  if (!text) return text;
  const name = k => HINT_ACTION[k] ? buttonName(family, HINT_ACTION[k]) : null;
  return text
    .replace(/<kbd>WASD<\/kbd>/g, '<kbd>L stick</kbd>').replace(/<kbd>Drag<\/kbd>/g, '<kbd>R stick</kbd>')
    .replace(/<kbd>(Space|Esc|[A-Z])<\/kbd>/g, (m, k) => name(k) ? `<kbd class="pad">${name(k)}</kbd>` : m)
    .replace(/\((hold )?(Space|[A-Z])\)/g, (m, hold, k) => name(k) ? `(${hold ?? ''}${name(k)})` : m)
    .replace(/\b([Pp]ress|[Hh]old|[Tt]ap) (Space|[A-Z])\b/g, (m, v, k) => name(k) ? `${v} ${name(k)}` : m);
}
/** Dead zone and rescale so a stick at rest reads exactly 0. */
export const axis = (v, dead = 0.22) => Math.abs(v) < dead ? 0 : (v - Math.sign(v) * dead) / (1 - dead);
/**
 * Which rectangle is the best move from `from` in direction (dx, dy)? Rectangles are { x, y, w, h }. Returns an index or -1.
 * Prefers things straight ahead: distance along the direction, plus twice the sideways offset.
 */
export function pickInDirection(from, rects, dx, dy) {
  const cx = from.x + from.w / 2, cy = from.y + from.h / 2;
  let best = -1, bestScore = Infinity;
  rects.forEach((r, i) => {
    const ox = r.x + r.w / 2 - cx, oy = r.y + r.h / 2 - cy;
    const along = ox * dx + oy * dy, side = Math.abs(ox * dy) + Math.abs(oy * dx);
    if (along < 4) return;   // not that way (or the same spot)
    // An overlap on the cross axis counts as straight ahead.
    const overlap = dx ? Math.min(r.y + r.h, from.y + from.h) - Math.max(r.y, from.y) : Math.min(r.x + r.w, from.x + from.w) - Math.max(r.x, from.x);
    const score = along + (overlap > 0 ? 0 : side * 2);
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

const FOCUSABLE = 'button, a[href], input, select, summary, [tabindex]:not([tabindex="-1"])';
const LOOK_SPEED = 620, ZOOM_SPEED = 7, REPEAT_FIRST = 0.34, REPEAT = 0.13;

export class Pad {
  constructor(game) {
    this.game = game; this.on = false; this.family = 'xbox';
    this.was = []; this.held = new Map();   // button position → the key it is holding down
    this.stick = new Set(); this.nav = { dir: null, t: 0 };
    // Any real key or mouse movement hands the hints back to the keyboard.
    addEventListener('keydown', e => { if (e.isTrusted) this.setOn(false); });
    addEventListener('mousedown', e => { if (e.isTrusted) this.setOn(false); });
    addEventListener('gamepaddisconnected', () => { this.releaseAll(); this.setOn(false); });
  }
  setOn(on) {
    if (on === this.on) return;
    this.on = on; this.game.padOn = on;
    document.body.classList.toggle('pad', on);
    if (!on) this.releaseAll();
  }
  name(action) { return buttonName(this.family, action); }
  label(text) { return padLabel(text, this.family); }
  read() {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) if (p && p.connected && p.buttons.length >= 10) return p;
    return null;
  }
  key(pos, code, down) {
    if (down) { if (this.held.has(pos)) return; this.held.set(pos, code); press(code, 'keydown'); }
    else { const c = this.held.get(pos); if (c == null) return; this.held.delete(pos); press(c, 'keyup'); }
  }
  walk(code, down) { if (down === this.stick.has(code)) return; if (down) this.stick.add(code); else this.stick.delete(code); press(code, down ? 'keydown' : 'keyup'); }
  releaseAll() { for (const pos of [...this.held.keys()]) this.key(pos, null, false); for (const c of [...this.stick]) this.walk(c, false); }

  update(dt) {
    const p = this.read();
    if (!p) return;
    const g = this.game, L = layout(this.family = familyOf(p.id));
    const now = p.buttons.map(b => b.pressed || b.value > 0.5), was = this.was; this.was = now;
    const lx = axis(p.axes[0] ?? 0), ly = axis(p.axes[1] ?? 0), rx = axis(p.axes[2] ?? 0), ry = axis(p.axes[3] ?? 0);
    if (!this.on) { if (now.some(Boolean) || lx || ly || rx || ry) this.setOn(true); else return; }
    const hit = pos => now[B[pos]] && !was[B[pos]], up = pos => !now[B[pos]] && was[B[pos]];
    if (g.loading) return;

    if (g.input.gameplay) {
      this.nav.dir = null;
      // Walk: the stick becomes WASD; pushed nearly all the way it runs (the touch joystick does the same).
      const m = Math.hypot(lx, ly);
      this.walk('KeyW', ly < -0.35); this.walk('KeyS', ly > 0.35); this.walk('KeyA', lx < -0.35); this.walk('KeyD', lx > 0.35); this.walk('ShiftLeft', m > 0.92);
      g.input.mx += rx * LOOK_SPEED * dt; g.input.my += ry * LOOK_SPEED * 0.6 * dt;
      g.input.wheel += ((p.buttons[B.rt]?.value ?? 0) - (p.buttons[B.lt]?.value ?? 0)) * -ZOOM_SPEED * dt;
      // Confirm: talk when someone is in reach and the rod is away, otherwise it is the fishing button (held for the cast and the reel).
      if (hit(L.ok)) this.key(L.ok, g.npcs.near && !g.fishing.active ? 'KeyE' : 'Space', true);   // (rod out: it always fishes, so you can cast beside someone; put the rod away to talk)
      if (up(L.ok)) this.key(L.ok, null, false);
      const tap = (action, code) => { if (hit(L[action])) { press(code, 'keydown'); press(code, 'keyup'); } };
      tap('rod', 'KeyR'); tap('tackle', 'KeyT'); tap('quests', 'KeyQ'); tap('view', 'KeyV'); tap('map', 'KeyM'); tap('pause', 'KeyP');
      tap('guide', 'KeyJ'); tap('logbook', 'KeyL'); tap('home', 'KeyH'); tap('anchor', 'KeyB');
      if (hit(L.back) && g.fishing.active && g.fishing.state === 'ready') { press('KeyR', 'keydown'); press('KeyR', 'keyup'); }
      return;
    }
    // ---- a panel, a conversation, the creator, the title screen
    this.releaseAll();
    const d = now[B.up] || ly < -0.6 ? 'up' : now[B.down] || ly > 0.6 ? 'down' : now[B.left] || lx < -0.6 ? 'left' : now[B.right] || lx > 0.6 ? 'right' : null;
    if (d !== this.nav.dir) { this.nav.dir = d; this.nav.t = REPEAT_FIRST; if (d) this.move(d); }
    else if (d && (this.nav.t -= dt) <= 0) { this.nav.t = REPEAT; this.move(d); }
    if (ry) { const sc = this.scope()?.closest?.('.panel') ?? this.scope()?.querySelector?.('.panel') ?? this.scope(); if (sc) sc.scrollTop += ry * 900 * dt; }
    if (hit(L.ok)) this.confirm(true);
    if (up(L.ok)) this.confirm(false);
    if (hit(L.back) || (hit(L.pause) && g.panels.isOpen)) { press('Escape', 'keydown'); press('Escape', 'keyup'); }
    if (hit(L.map) && g.mapOpen) { press('KeyM', 'keydown'); press('KeyM', 'keyup'); }
    if (hit(L.tackle) && g.tackleOpen) { press('KeyT', 'keydown'); press('KeyT', 'keyup'); }
  }

  /** The element the pad is steering inside: the conversation, else the open panel, else the creator, else the title screen. */
  scope() {
    const g = this.game, q = s => document.querySelector(s);
    if (g.dialogue.isOpen) return g.dialogue.el;
    if (q('#pb-card')) return q('#pb-card');   // the personal-best card sits over the panel
    if (g.panels.isOpen) return q('#modal');
    if (g.creatorOpen) return g.creator?.el ?? document.body;
    if (g.mode === 'menu') return q('#menu');
    return document.body;
  }
  items(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter(e => !e.disabled && e.getAttribute('aria-hidden') !== 'true' && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  }
  move(dir) {
    const root = this.scope(); if (!root) return;
    const cur = document.activeElement, inside = cur && cur !== document.body && root.contains(cur);
    const code = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir];
    // Sliders, pickers and anything that answers the arrow keys itself (the measuring mat, the 3D fish, the creator's swatch rows) get the arrow.
    if (inside && (cur.matches('input[type=range], select, canvas, [role=slider], [role=radio], [role=tab]') && (dir === 'left' || dir === 'right'))) { press(code, 'keydown', cur); press(code, 'keyup', cur); return; }
    if (!press(code, 'keydown')) { press(code, 'keyup'); return; }   // a panel that handles arrows itself (the measuring mat) took it
    press(code, 'keyup');
    const list = this.items(root); if (!list.length) return;
    if (!inside) { this.focus(list[0]); return; }
    const r = e => { const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
    const others = list.filter(e => e !== cur);
    const i = pickInDirection(r(cur), others.map(r), dir === 'left' ? -1 : dir === 'right' ? 1 : 0, dir === 'up' ? -1 : dir === 'down' ? 1 : 0);
    if (i >= 0) this.focus(others[i]);
  }
  focus(el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  /** Confirm: click the focused control. A hold-button (the release, the knot pull) is held for as long as the pad button is. */
  confirm(down) {
    const root = this.scope(), cur = document.activeElement;
    if (!down) { if (this.holdEl) { this.holdEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 77 })); this.holdEl = null; } return; }
    if (!root || !cur || cur === document.body || !root.contains(cur)) { const first = root && this.items(root)[0]; if (first) this.focus(first); return; }
    if (cur.matches('.hold, #kn-act')) { this.holdEl = cur; cur.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 77 })); return; }
    if (cur.matches('input[type=text], input:not([type])')) return;
    cur.click();
  }
}
