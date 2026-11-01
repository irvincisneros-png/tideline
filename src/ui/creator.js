// Character creator: a cosy cream full-screen form beside (above, on a phone) a live 3D preview of the angler on a little sand-and-jetty
// plinth with turquoise water behind. Opens on first play, and from Settings -> "Edit my angler".
//   new Creator(game).open({ first, onDone })
// The preview is its own small WebGL scene (the real Angler class with the real Blender parts), so what you pick is exactly what you get in the world.
// Keyboard: Tab through the groups, arrow keys choose inside a group, Enter on Done. Works down to 375 px wide.
import * as THREE from 'three';
import { Angler } from '../land/angler.js';
import { PALETTES, STYLES, SECTIONS, NAME_MAX, checkName, displayName, lookOf, randomLook, makeAngler, swatchName } from '../core/anglerData.js';
import { esc } from './panels.js';

const hex = v => `#${v.toString(16).padStart(6, '0')}`;

// ------------------------------------------------------------------ the 3D stage
function gradientTexture(stops, h = 256) {
  const c = document.createElement('canvas'); c.width = 4; c.height = h;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, h);
  for (const [t, col] of stops) grad.addColorStop(t, col);
  g.fillStyle = grad; g.fillRect(0, 0, 4, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function waterTexture() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); g.fillStyle = '#5fdccf'; g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = (i * 97) % s, y = (i * 53) % s, w = 18 + (i * 7) % 22;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 5, x + w, y); g.stroke();
    g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x - s + w / 2, y - 5, x - s + w, y); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 70); t.anisotropy = 4; return t;
}
const SKIP_HULL = /_(face|sun|band|trim|dots|stubble)$/;

export class AnglerStage {
  /** host: an element to fill. models: the tideline_cosy.glb parts. look: the starting look. */
  constructor(host, models, look, { lo = false, reducedMotion = false } = {}) {
    this.host = host; this.reducedMotion = reducedMotion;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, lo ? 1.25 : 2));
    r.toneMapping = THREE.NeutralToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = r.domElement; this.canvas.className = 'cc-canvas'; host.appendChild(this.canvas);
    this.canvas.setAttribute('aria-label', 'Your angler. Drag to turn them round.'); this.canvas.setAttribute('role', 'img');
    const scene = this.scene = new THREE.Scene();
    scene.background = gradientTexture([[0, '#8fd3ea'], [0.55, '#cdeef0'], [1, '#e8f8f2']]);
    scene.fog = new THREE.Fog(0xcdeee9, 9, 48);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa6e4ee, 1.55));
    const sun = new THREE.DirectionalLight(0xfff1d0, 2.3); sun.position.set(2.5, 4.5, 3.5); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfe9f5, 0.6); fill.position.set(-3, 1.5, -2); scene.add(fill);
    this.toDispose = [];
    const own = o => { this.toDispose.push(o); return o; };
    // Water: a big plane with soft light ripples, drifting slowly.
    this.waterTex = own(waterTexture());
    const water = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), own(new THREE.MeshBasicMaterial({ map: this.waterTex, color: 0xffffff })));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.34; scene.add(water);
    // The plinth: a round sand island with a darker wet rim and a soft foam ring.
    const sandTop = own(new THREE.MeshStandardMaterial({ color: 0xf6e4b6, roughness: 1 })), sandSide = own(new THREE.MeshStandardMaterial({ color: 0xe8cb92, roughness: 1 }));
    const island = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.5, 0.36, 40), [sandSide, sandTop, sandSide]); island.position.y = -0.18; scene.add(island);
    const wet = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.56, 0.08, 40), own(new THREE.MeshStandardMaterial({ color: 0xd9b777, roughness: 1 }))); wet.position.y = -0.3; scene.add(wet);
    this.foam = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.95, 56), own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })));
    this.foam.rotation.x = -Math.PI / 2; this.foam.position.y = -0.325; scene.add(this.foam);
    this.foam2 = this.foam.clone(); this.foam2.material = this.foam.material.clone(); this.toDispose.push(this.foam2.material); scene.add(this.foam2);
    // A little jetty running out behind: planks, stringers and posts.
    const wood = [0xb98f5c, 0xc79c68, 0xad8450, 0xbf9560].map(c => own(new THREE.MeshStandardMaterial({ color: c, roughness: 1 })));
    const dark = own(new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 }));
    const jetty = new THREE.Group(); scene.add(jetty);
    for (let i = 0; i < 11; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.31), wood[i % 4]); p.position.set(0, 0.0, -1.2 - i * 0.345); jetty.add(p); this.toDispose.push(p.geometry); }
    for (const x of [-0.62, 0.62]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 3.9), dark); b.position.set(x, -0.08, -3.1); jetty.add(b); this.toDispose.push(b.geometry); }
    for (const z of [-1.7, -3.1, -4.6]) for (const x of [-0.78, 0.78]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.2, 10), dark); post.position.set(x, 0.22, z); jetty.add(post); this.toDispose.push(post.geometry);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 6), dark); cap.position.set(x, 0.84, z); cap.scale.y = 0.55; jetty.add(cap); this.toDispose.push(cap.geometry);
    }
    // Props from the same Blender set: an esky and a bucket by the angler.
    const vc = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    for (const [n, x, z, ry, s] of [['esky', -0.8, 0.3, 0.5, 0.8], ['bucket', 0.8, 0.2, -0.4, 0.85]]) {
      const g = models.get(n); if (!g) continue;
      const m = new THREE.Mesh(g, vc); m.position.set(x, 0, z); m.rotation.y = ry; m.scale.setScalar(s); scene.add(m); this.addHull(m, 0.012);
    }
    // The angler, and a soft contact shadow.
    this.angler = new Angler(scene, models, look, { lo });
    this.angler.root.visible = true; this.angler.root.position.set(0, 0, 0.1);
    this.angler.rod.scale.setScalar(0.5);   // a shorter rod in the preview so the whole thing stays in the picture
    const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sg = sc.getContext('2d'), rg = sg.createRadialGradient(32, 32, 2, 32, 32, 30);
    rg.addColorStop(0, 'rgba(31,95,107,0.45)'); rg.addColorStop(1, 'rgba(31,95,107,0)'); sg.fillStyle = rg; sg.fillRect(0, 0, 64, 64);
    const shTex = own(new THREE.CanvasTexture(sc)); const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), own(new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false })));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.004, 0.1); scene.add(shadow);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);
    this.yaw = 0.55; this.auto = !reducedMotion; this.t = 0; this.last = performance.now(); this.focusPoint = new THREE.Vector3(0, 0.82, 0);
    this.setLook(look);
    this.bind();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    const loop = () => { this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }
  /** Dark-teal "ink" outline: an inflated back-face copy (the game's own outline pass is a post effect that this little scene does not have). */
  addHull(mesh, w = 0.011) {
    if (!this.hullMat) {
      this.hullMat = new THREE.MeshBasicMaterial({ color: 0x1b4f5b, side: THREE.BackSide });
      this.hullMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${w.toFixed(4)};`); };
      this.toDispose.push(this.hullMat);
    }
    const h = new THREE.Mesh(mesh.geometry, this.hullMat); h.userData.hull = true; mesh.add(h);
  }
  hullAll() {
    this.angler.root.traverse(o => { if (o.isMesh && !o.userData.hull && !o.userData.hulled && !SKIP_HULL.test(o.name)) { o.userData.hulled = true; this.addHull(o); } });
  }
  setLook(look) { this.angler.setAppearance(look); this.hullAll(); }
  bind() {
    const c = this.canvas; let drag = null;
    c.style.touchAction = 'pan-y';
    c.addEventListener('pointerdown', e => { drag = { x: e.clientX, id: e.pointerId }; c.setPointerCapture(e.pointerId); this.auto = false; c.style.touchAction = 'none'; });
    c.addEventListener('pointermove', e => { if (drag) { this.yaw += (e.clientX - drag.x) * 0.013; drag.x = e.clientX; } });
    const up = () => { drag = null; c.style.touchAction = 'pan-y'; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }
  turn(d) { this.auto = false; this.yaw += d; }
  resize() {
    const w = Math.max(80, this.host.clientWidth), h = Math.max(80, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    const cam = this.camera; cam.aspect = w / h; cam.updateProjectionMatrix();
    // Fit the plinth, the hat and the rod: the larger of the height fit and the width fit.
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), dist = Math.max(2.4 / 2 / t, 2.3 / 2 / (t * cam.aspect));
    const el = THREE.MathUtils.degToRad(13);
    cam.position.set(0, this.focusPoint.y + 0.15 + Math.sin(el) * dist, Math.cos(el) * dist); cam.lookAt(this.focusPoint.x, this.focusPoint.y + 0.15, 0);
  }
  frame() {
    const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    if (this.auto) this.yaw = 0.5 + Math.sin(this.t * 0.7) * 0.28;   // a gentle sway around a 3/4 front view: always facing the camera, never showing their back
    this.angler.root.rotation.y = this.yaw;
    this.angler.update(dt, this.t, { state: 'ready', phi: 1.4, reducedMotion: this.reducedMotion });
    this.waterTex.offset.set(this.t * 0.004, this.t * 0.006);
    const k = (this.t * 0.35) % 1, k2 = (this.t * 0.35 + 0.5) % 1;
    this.foam.scale.setScalar(1 + k * 0.12); this.foam.material.opacity = 0.55 * (1 - k);
    this.foam2.scale.setScalar(1 + k2 * 0.12); this.foam2.material.opacity = 0.55 * (1 - k2);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    cancelAnimationFrame(this.raf); this.ro?.disconnect();
    for (const o of this.toDispose) o.dispose?.();
    for (const m of Object.values(this.angler.mats)) m.dispose(); this.angler.fixed.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.canvas.remove();
  }
}

// ------------------------------------------------------------------ the form
export class Creator {
  constructor(game) {
    this.game = game;
    const el = this.el = document.createElement('div');
    el.id = 'creator'; el.className = 'creator hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'cc-title');
    document.body.appendChild(el);
    el.addEventListener('keydown', e => this.onKey(e));
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }

  /** opts.first: the first-run version (no Cancel; Esc does nothing). opts.onDone(angler): called after Done. */
  open({ first = false, onDone = null } = {}) {
    const g = this.game; if (this.isOpen) return;
    this.first = first; this.onDone = onDone; this.returnFocus = document.activeElement;
    const saved = g.progress.angler;
    this.name = saved?.name ?? ''; this.look = lookOf(saved);
    this.before = { name: this.name, look: { ...this.look } };
    this.render();
    this.el.classList.remove('hidden'); document.body.classList.add('creator-open');
    g.creatorOpen = true; g.input.clear(); g.input.unlock(); g.audio?.play?.('panelOpen');
    const host = this.el.querySelector('.cc-stage-host');
    this.stage = new AnglerStage(host, g.world.models, this.look, { lo: g.settings.quality === 'low', reducedMotion: !!g.settings.reducedMotion || !!matchMedia?.('(prefers-reduced-motion: reduce)').matches });
    // On a phone, do not pop the keyboard up straight away: focus the heading instead.
    requestAnimationFrame(() => this.el.querySelector(g.touch ? '#cc-title' : '#cc-name')?.focus({ preventScroll: true }));
  }
  close() {
    this.stage?.dispose(); this.stage = null;
    this.el.classList.add('hidden'); this.el.innerHTML = ''; document.body.classList.remove('creator-open');
    this.game.creatorOpen = false;
    if (this.returnFocus?.isConnected) this.returnFocus.focus?.({ preventScroll: true });
  }

  render() {
    const sec = SECTIONS.map(s => {
      const hidden = s.when && !s.when(this.look) ? ' hidden' : '';
      const items = s.kind === 'swatch'
        ? (s.matchHair ? `<button type="button" class="cc-sw cc-match" role="radio" data-key="${s.key}" data-v="null" aria-checked="${this.look[s.key] === null}" aria-label="${esc(s.label)}: same as hair" title="Same as hair" style="--c:${hex(this.look.hair)}"><i></i><b aria-hidden="true">=</b></button>` : '') + PALETTES[s.key].map(c => `<button type="button" class="cc-sw" role="radio" data-key="${s.key}" data-v="${c.v}" aria-checked="${this.look[s.key] === c.v}" aria-label="${esc(s.label)}: ${esc(c.name)}" title="${esc(c.name)}" style="--c:${hex(c.v)}"><i></i></button>`).join('')
        : STYLES[s.key].map(c => `<button type="button" class="cc-pill" role="radio" data-key="${s.key}" data-v="${c.id}" aria-checked="${this.look[s.key] === c.id}">${esc(c.name)}</button>`).join('');
      return `<fieldset class="cc-row cc-${s.kind}${hidden}" data-row="${s.key}"><legend id="cc-l-${s.key}">${esc(s.label)}<em class="cc-cur" aria-hidden="true"></em></legend><div class="cc-group" role="radiogroup" aria-labelledby="cc-l-${s.key}">${items}</div></fieldset>`;
    }).join('');
    this.el.innerHTML = `
      <div class="cc-wrap">
        <div class="cc-stage">
          <div class="cc-stage-host"></div>
          <div class="cc-turn"><button type="button" class="btn small" id="cc-left" aria-label="Turn the angler left">⟲</button><button type="button" class="btn small" id="cc-right" aria-label="Turn the angler right">⟳</button></div>
          <div class="cc-hello" id="cc-hello" aria-hidden="true"></div>
        </div>
        <div class="cc-panel">
          <h2 id="cc-title" tabindex="-1">${this.first ? 'Make your angler' : 'Edit my angler'}</h2>
          <p class="cc-sub">${this.first ? 'Pick how you look on the water. You can change it any time in Settings.' : 'Change anything you like, then press Done.'}</p>
          <div class="cc-scroll" id="cc-scroll">
            <fieldset class="cc-row cc-name"><legend><label for="cc-name">Your name</label></legend>
              <input id="cc-name" type="text" maxlength="${NAME_MAX}" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="Angler" value="${esc(this.name)}" aria-describedby="cc-name-msg">
              <small id="cc-name-msg" class="cc-msg" role="status" aria-live="polite">Up to ${NAME_MAX} letters. It is used in your logbook.</small></fieldset>
            ${sec}
          </div>
          <div class="cc-foot">
            <button type="button" class="btn" id="cc-random">🎲 Randomise</button>
            ${this.first ? '' : '<button type="button" class="btn ghost" id="cc-cancel">Cancel</button>'}
            <button type="button" class="btn primary" id="cc-done">Done</button>
          </div>
          <p class="cc-live" id="cc-live" role="status" aria-live="polite"></p>
        </div>
      </div>`;
    const q = s => this.el.querySelector(s);
    this.refreshText();
    q('#cc-name').addEventListener('input', e => { this.name = e.target.value; this.checkName(false); this.refreshText(); });
    q('#cc-left').onclick = () => this.stage?.turn(-0.5); q('#cc-right').onclick = () => this.stage?.turn(0.5);
    q('#cc-random').onclick = () => { this.look = { ...this.look, ...randomLook() }; this.refreshSelection(); this.stage?.setLook(this.look); this.say('Random look picked.'); };
    q('#cc-done').onclick = () => this.done();
    q('#cc-cancel')?.addEventListener('click', () => this.cancel());
    this.el.querySelectorAll('.cc-group').forEach(grp => {
      grp.addEventListener('click', e => { const b = e.target.closest('[role=radio]'); if (b) this.choose(b); });
      grp.addEventListener('keydown', e => this.groupKey(e, grp));
    });
    this.refreshSelection();
  }
  say(t) { const l = this.el.querySelector('#cc-live'); if (l) { l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); } }
  refreshText() {
    const h = this.el.querySelector('#cc-hello'); if (h) h.textContent = this.name.trim() ? `Hi, ${displayName(this.name)}!` : 'Hi there!';
  }
  checkName(report) {
    const r = checkName(this.name), msg = this.el.querySelector('#cc-name-msg'), inp = this.el.querySelector('#cc-name');
    inp.setAttribute('aria-invalid', r.ok ? 'false' : 'true'); msg.classList.toggle('bad', !r.ok);
    msg.textContent = r.ok ? `Up to ${NAME_MAX} letters. It is used in your logbook.` : r.reason;
    if (!r.ok && report) inp.focus();
    return r;
  }
  choose(b) {
    const key = b.dataset.key, isColour = b.classList.contains('cc-sw');
    this.look[key] = isColour ? (b.dataset.v === 'null' ? null : +b.dataset.v) : b.dataset.v;
    this.refreshSelection(); this.stage?.setLook(this.look);
    this.say(`${SECTIONS.find(s => s.key === key).label}: ${isColour ? swatchName(key, this.look[key]) : b.textContent}.`);
  }
  refreshSelection() {
    for (const s of SECTIONS) {
      const row = this.el.querySelector(`[data-row="${s.key}"]`);
      row.classList.toggle('hidden', !!(s.when && !s.when(this.look)));
      row.querySelector('.cc-match')?.style.setProperty('--c', hex(this.look.hair));
      row.querySelectorAll('[role=radio]').forEach(b => {
        const on = String(this.look[s.key]) === b.dataset.v;
        b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1;
      });
      const cur = row.querySelector('.cc-cur');
      cur.textContent = s.kind === 'swatch' ? swatchName(s.key, this.look[s.key]) : STYLES[s.key].find(c => c.id === this.look[s.key])?.name ?? '';
    }
  }
  groupKey(e, grp) {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!k) return;
    const items = [...grp.querySelectorAll('[role=radio]')], i = items.findIndex(b => b.getAttribute('aria-checked') === 'true'), n = items[(i + k + items.length) % items.length];
    e.preventDefault(); n.focus(); this.choose(n);
  }
  onKey(e) {
    if (e.key === 'Escape' && !this.first) { e.preventDefault(); e.stopPropagation(); this.cancel(); return; }
    if (e.key === 'Enter' && e.target.id === 'cc-name') { e.preventDefault(); this.done(); return; }
    if (e.key === 'Tab') {   // keep Tab inside the dialog
      const f = [...this.el.querySelectorAll('button:not([tabindex="-1"]), input, [tabindex="0"]')].filter(b => !b.disabled && b.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  cancel() { this.close(); }
  done() {
    const r = this.checkName(true);
    if (!r.ok) { this.el.querySelector('#cc-scroll').scrollTop = 0; return; }
    const g = this.game, a = makeAngler(r.name, this.look);
    this.close();
    g.applyAngler(a);
    this.onDone?.(a);
  }
}
