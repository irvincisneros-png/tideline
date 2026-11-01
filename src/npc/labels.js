// The little cream labels that float over people, drawn as HTML over the canvas (crisp text, not run through the bloom and colour grading):
// the name tag (shown as you approach), the "!" / tick marker for a request, and speech bubbles. Positions are projected from the world each frame.
import * as THREE from 'three';
import { esc } from '../ui/panels.js';

const _v = new THREE.Vector3();

export class Labels {
  constructor(camera) {
    this.camera = camera;
    this.root = document.createElement('div'); this.root.id = 'npc-labels'; this.root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.root);
  }
  /** Build the three elements for one person. */
  make(name, role) {
    const mk = (cls, html = '') => { const e = document.createElement('div'); e.className = `npc-label ${cls}`; e.innerHTML = html; this.root.appendChild(e); return e; };
    return { tag: mk('npc-tag', `<b>${esc(name)}</b><small>${esc(role ?? '')}</small>`), mark: mk('npc-mark'), bubble: mk('npc-bubble') };
  }
  /** Put element `el` above world point (x, y, z); `lift` pixels extra. Hidden when behind the camera or off screen. */
  place(el, x, y, z, lift = 0, dx = 0, minY = 0) {
    _v.set(x, y, z).project(this.camera);
    const on = _v.z < 1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.15;
    if (!on) { el.style.visibility = 'hidden'; return false; }
    el.style.visibility = 'visible';
    el.style.transform = `translate(${Math.round((_v.x * 0.5 + 0.5) * innerWidth + dx)}px, ${Math.round(Math.max(minY, (-_v.y * 0.5 + 0.5) * innerHeight - lift))}px) translate(-50%, -100%)`;   // minY keeps a label below the HUD bar when its person is at the top edge
    return true;
  }
  remove(els) { for (const e of Object.values(els)) e.remove(); }
  dispose() { this.root.remove(); }
}
