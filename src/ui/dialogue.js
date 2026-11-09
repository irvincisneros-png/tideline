// Cosy NPC dialogue: a portrait bust at the bottom-left and a cream, rounded dialogue box with a name tag, text, optional choices and a
// Continue button. Reusable for every NPC (the Fisheries Officer first; the bait-shop owner, lifeguard and the others next phase):
//   const dlg = new Dialogue(game);
//   await dlg.say({ who: NPCS.officer, text: 'G\'day!' });                 // resolves when the player presses Continue (Space / Enter works too)
//   const i = await dlg.say({ who, text: 'Which rig?', choices: ['Float', 'Paternoster'] });   // resolves with the choice index
//   await dlg.sequence(who, ['Line one.', 'Line two.']);
// `who` = { name, role?, portrait: { skin, hair, hat, hatColor, shirt, collar, badge, ... } } (see PORTRAITS). Dialogue text lives in data, not code.
import { esc } from './panels.js';

/** Bust portraits are SVG, drawn from a few colours so every NPC is a variation on the same cosy character. */
export function portraitSVG(p = {}) {
  const o = { skin: '#d9a273', hair: '#4a2f1d', hat: 'cap', hatColor: '#2f5496', shirt: '#3d7fa8', collar: '#fff3d2', badge: false, glasses: false, beard: false, ...p };
  const ink = '#1f5f6b';
  const hat = o.hat === 'cap'
    ? `<path d="M34 58c0-22 14-34 30-34s30 12 30 34z" fill="${o.hatColor}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
       <path d="M30 58h70c8 0 12 3 12 6h-52c-12 0-26-2-30-6z" fill="${o.hatColor}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
       ${o.badge ? `<circle cx="64" cy="40" r="7" fill="#ffd66b" stroke="${ink}" stroke-width="3"/>` : ''}`
    : o.hat === 'bucket'
      ? `<path d="M30 60c2-24 16-34 34-34s32 10 34 34z" fill="${o.hatColor}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/><path d="M20 62h88c-2 6-16 8-44 8s-42-2-44-8z" fill="${o.hatColor}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`
      : `<path d="M34 56c0-20 12-30 30-30s30 10 30 30c-10-8-18-10-30-10s-20 2-30 10z" fill="${o.hair}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>`;
  return `<svg class="dlg-bust" viewBox="0 0 128 150" role="img" aria-label="Portrait">
    <path d="M10 150c0-34 22-48 54-48s54 14 54 48z" fill="${o.shirt}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M46 104l18 22 18-22" fill="${o.collar}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
    ${o.badge ? `<rect x="84" y="116" width="14" height="10" rx="3" fill="#ffd66b" stroke="${ink}" stroke-width="3"/>` : ''}
    <rect x="54" y="88" width="20" height="18" rx="6" fill="${o.skin}" stroke="${ink}" stroke-width="4"/>
    <ellipse cx="64" cy="66" rx="30" ry="32" fill="${o.skin}" stroke="${ink}" stroke-width="4"/>
    <ellipse cx="33" cy="68" rx="5" ry="8" fill="${o.skin}" stroke="${ink}" stroke-width="3.5"/><ellipse cx="95" cy="68" rx="5" ry="8" fill="${o.skin}" stroke="${ink}" stroke-width="3.5"/>
    ${o.hat ? hat : ''}
    <circle cx="52" cy="70" r="4.5" fill="${ink}"/><circle cx="76" cy="70" r="4.5" fill="${ink}"/>
    <circle cx="53.5" cy="68.5" r="1.4" fill="#fff"/><circle cx="77.5" cy="68.5" r="1.4" fill="#fff"/>
    <ellipse cx="45" cy="80" rx="6" ry="3.5" fill="#ff8a5c" opacity=".35"/><ellipse cx="83" cy="80" rx="6" ry="3.5" fill="#ff8a5c" opacity=".35"/>
    ${o.glasses ? `<rect x="43" y="63" width="18" height="14" rx="6" fill="none" stroke="${ink}" stroke-width="3"/><rect x="67" y="63" width="18" height="14" rx="6" fill="none" stroke="${ink}" stroke-width="3"/><path d="M61 69h6" stroke="${ink}" stroke-width="3"/>` : ''}
    ${o.beard ? `<path d="M36 76c2 24 14 32 28 32s26-8 28-32c-6 10-14 12-28 12s-22-2-28-12z" fill="${o.hair}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/>` : ''}
    ${o.smile === 'wide' ? `<path d="M46 84q18 22 36 0z" fill="#fff" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/><path d="M52 90q12 7 24 0" fill="none" stroke="#ff8a5c" stroke-width="3" stroke-linecap="round"/>` : `<path d="M54 86q10 8 20 0" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`}
  </svg>`;
}

/** Characters. The Fisheries Officer is the first; add NPCs to src/content/npcs.js next phase and pass them as `who`. */
export const PORTRAITS = {
  officer: { name: 'Fisheries Officer', role: 'NSW DPIRD Fisheries', portrait: { skin: '#c99468', hair: '#3a2a1f', hat: 'cap', hatColor: '#2a5a82', shirt: '#3d7fa8', badge: true, glasses: true } },
  // The two teachers (content/teachers.js): the same looks as their 3D characters in content/npcs.js. This SVG bust is the fallback and the radio portrait.
  mrcisneros: { name: 'Mr Cisneros', role: 'Marine Studies teacher', portrait: { skin: '#b98560', hair: '#2a2020', hat: null, shirt: '#1f2a44', collar: '#fff3d2', smile: 'wide' } },
  mrwilson: { name: 'Mr Wilson', role: 'Marine Studies teacher', portrait: { skin: '#d9a67a', hair: '#3a2a1e', hat: null, shirt: '#2f9a9a', collar: '#fff3d2', glasses: true, beard: true } },
};

export class Dialogue {
  constructor(game) {
    this.game = game;
    const el = this.el = document.createElement('div');
    el.id = 'dialogue'; el.className = 'dlg hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    addEventListener('keydown', e => {
      if (!this.isOpen || !this.resolve) return;
      // A held key must not race through the lines, and the Space that was mid-cast when a radio call came in must not dismiss its first line.
      if (e.repeat || performance.now() - (this.shownAt ?? 0) < 250) { if (['Space', 'Enter'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); } return; }
      if (this.choices) {
        // Choices: press 1-9 to pick one; Escape picks the "cancel" choice (the last one, "Bye" / "Back").
        const n = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
        if (n && +n[1] <= this.choices.length) { e.preventDefault(); e.stopPropagation(); this.finish(+n[1] - 1); }
        else if (e.code === 'Escape' && this.cancel != null) { e.preventDefault(); e.stopPropagation(); this.finish(this.cancel); }
        return;
      }
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); this.finish(0); }
    }, true);
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }

  /** Show one line; resolves with the choice index (0 when there are no choices) once the player continues. */
  say({ who, text, choices = null, button = 'Continue', cancel = null }) {
    return new Promise(resolve => {
      this.resolve = resolve; this.choices = choices; this.cancel = cancel; this.shownAt = performance.now();
      const w = who ?? {};
      // A person from the coast has a rendered 3D bust (npc/portrait.js); the Fisheries Officer's old SVG bust is the fallback.
      const bust = w.portraitUrl ? `<img class="dlg-bust photo" src="${w.portraitUrl}" alt="${esc(w.name ?? 'Portrait')}">` : portraitSVG(w.portrait);
      this.el.innerHTML = `
        <div class="dlg-portrait">${bust}</div>
        <div class="dlg-box">
          <div class="dlg-name">${esc(w.name ?? '')}${w.role ? `<small>${esc(w.role)}</small>` : ''}</div>
          <div class="dlg-text">${text}</div>
          <div class="dlg-actions">${choices ? choices.map((c, i) => `<button class="btn dlg-choice" data-i="${i}">${choices.length > 1 ? `<kbd>${i + 1}</kbd> ` : ''}${esc(c)}</button>`).join('') : `<button class="btn primary dlg-next">${esc(button)}</button>`}</div>
        </div>`;
      this.el.classList.remove('hidden');
      this.game.input?.clear?.();
      this.el.querySelectorAll('button').forEach(b => b.onclick = () => this.finish(+(b.dataset.i ?? 0)));
      requestAnimationFrame(() => this.el.querySelector('button')?.focus({ preventScroll: true }));
    });
  }
  /** Several lines in a row; the last button says `endButton`. */
  async sequence(who, lines, endButton = 'Continue') {
    for (let i = 0; i < lines.length; i++) await this.say({ who, text: lines[i], button: i === lines.length - 1 ? endButton : 'Continue' });
  }
  finish(i) {
    const r = this.resolve; this.resolve = null; this.choices = null; this.cancel = null;
    if (r) r(i);
  }
  /** Close the box (call when the conversation is over). */
  hide() { this.el.classList.add('hidden'); this.el.innerHTML = ''; this.resolve = null; }
}
