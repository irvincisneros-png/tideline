// TideLine — game orchestrator: title -> walk the shore -> rod fishing (cast, strike, fight, keep or release).
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Input } from './core/input.js';
import { Audio } from './audio/index.js';
import { TouchControls, detectTouch } from './ui/touch.js';
import { loadSettings, saveSettings, TIERS } from './core/settings.js';
import { loadProgress, saveProgress, resetProgress, progressCSV } from './core/save.js';
import { globalUniforms } from './ocean/shaders.js';
import { Environment } from './ocean/environment.js';
import { Particles } from './world/particles.js';
import { World } from './world/world.js';
import { Walker } from './land/walker.js';
import { Fishing } from './fishing/fishing.js';
import { judge, RULES } from './fishing/catches.js';
import { snapshot } from './ui/snapshot.js';
import { Panels, esc } from './ui/panels.js';
import { ECOSYSTEMS, ecoById } from './ecosystems/index.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);

class Game {
  constructor() {
    this.settings = loadSettings();
    this.quality = TIERS[this.settings.quality];
    this.progress = loadProgress();
    const canvas = $('#gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.quality.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pixelRatio));
    this.stylised = this.settings.style === 'stylised';
    // Neutral tone mapping keeps the stylised palette saturated (ACES pushes bright colours toward white).
    this.renderer.toneMapping = this.stylised ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
    globalUniforms.uStyle.value = this.stylised ? 1 : 0;
    globalUniforms.uFull.value = this.settings.quality === 'low' ? 0 : 1;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Soft sun shadows (high/ultra only): grounds rocks, plants and animals.
    this.renderer.shadowMap.enabled = !!this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCF honours shadow.radius (PCFSoft ignores it)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 7000);
    this.input = new Input(canvas);
    this.audio = new Audio(); this.audio.volume = this.settings.volume;
    this.panels = new Panels(this);
    this.env = new Environment(this.scene, this.renderer, this.quality);
    this.fx = new Particles(this.scene, this.quality);
    this.world = new World(this.scene, this.renderer, this.env, this.fx, this.quality);
    this.walker = new Walker(this.camera, this.input, this.settings);
    if (!this.camera.parent) this.scene.add(this.camera); // the rod and the held fish are children of the camera
    this.fishing = new Fishing(this);
    this.mode = 'loading';
    this.eco = ecoById(params.get('eco')) ?? ECOSYSTEMS[0];
    this.frame = 0; this.time = 0;
    this.setupComposer();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.input.onLockChange = locked => $('#click-to-play').classList.toggle('hidden', locked || this.mode !== 'land' || this.panels.isOpen);
    this.input.onLockFail = () => { $('#click-to-play').classList.add('hidden'); this.toast('Mouse capture is blocked here — drag with the left mouse button to look around; click an animal for its card.'); };
    this.bindMenu();
    this.bindKeys();
    // Browsers only allow audio after a user gesture: start on the first click or key press anywhere.
    const wake = () => this.audio.start();
    addEventListener('pointerdown', wake, true); addEventListener('keydown', wake, true);
    // Soft tick for every button.
    document.addEventListener('click', e => { if (e.target.closest?.('button:not([disabled])') && !e.target.closest('#touch')) this.audio.play('click'); }, true);
    // Phones / tablets: on-screen joystick, look-drag and buttons.
    this.touch = detectTouch() ? new TouchControls(this) : null;
  }

  setupComposer() {
    if (!this.quality.bloom) { this.composer = null; return; }
    // The composer renders into its own target: give it MSAA, otherwise high/ultra lose antialiasing entirely.
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.quality.antialias ? 4 : 0 });
    if (this.stylised) rt.depthTexture = new THREE.DepthTexture(1, 1); // read by the outline pass
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.35, 0.5, 0.86);
    this.composer.addPass(this.bloom);
    if (this.stylised) {
      // Colour grade: a little more saturation and contrast, teal-tinted shadows, gentle vignette.
      // Ink outlines where depth jumps (silhouettes), fading with distance and fog; then the colour grade.
      this.gradePass = new ShaderPass({
        uniforms: { tDiffuse: { value: null }, tDepth: { value: rt.depthTexture }, uRes: { value: new THREE.Vector2(1, 1) }, cameraNear: { value: this.camera.near }, cameraFar: { value: this.camera.far }, uUnder: globalUniforms.uUnderwater, uFogDensity: globalUniforms.uFogDensity },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        defines: { OUTLINE: '0.7' }, // thin ink outlines on silhouettes (0 = off)
        fragmentShader: `#include <packing>
          uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 uRes; uniform float cameraNear; uniform float cameraFar; uniform float uUnder; uniform float uFogDensity; varying vec2 vUv;
          float vz(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            vec2 px = 1.0 / uRes;
            float z = vz(vUv), zl = vz(vUv - vec2(px.x, 0.0)), zr = vz(vUv + vec2(px.x, 0.0)), zd = vz(vUv - vec2(0.0, px.y)), zu = vz(vUv + vec2(0.0, px.y));
            // Second difference ignores smooth slopes (ground at grazing angles) and catches real silhouettes.
            float lap = abs(zl + zr + zd + zu - 4.0 * z) / max(z, 0.1);
            // Fade outlines with the same fog that hides the object, so nothing fogged-out leaves a ghost line.
            float vis = uUnder > 0.5 ? exp(-pow(uFogDensity * z * 1.6, 2.0)) : 1.0 - smoothstep(25.0, 70.0, z);
            float edge = smoothstep(0.09, 0.18, lap) * vis;
            c = mix(c, c * vec3(0.22, 0.36, 0.42), edge * OUTLINE); // dark teal, not black
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(l), c, 1.22);
            c = mix(c * vec3(0.92, 1.0, 1.06), c, smoothstep(0.0, 0.6, l));
            vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.55;
            gl_FragColor = vec4(max(c, 0.0), 1.0);
          }`,
      });
      this.composer.addPass(this.gradePass);
    }
    this.composer.addPass(new OutputPass());
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
    if (this.gradePass) this.gradePass.uniforms.uRes.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
  }

  async start() {
    const bar = $('#load-bar'), msg = $('#load-msg');
    await this.world.load(this.eco, (f, m) => { bar.style.width = `${f * 100}%`; msg.textContent = m; });
    this.audio.setSite(this.eco); this.setupShadows();
    await this.warmUp();
    $('#loading').classList.remove('show');
    this.clock = new THREE.Clock();
    this.enterMenu();
    if (params.has('play')) this.startLand(null); // skip the title (tests, teacher links)
    this.renderer.setAnimationLoop(() => this.loop());
  }

  // ------------------------------------------------------------------ menu
  bindMenu() {
    const cards = $('#eco-cards');
    cards.innerHTML = ECOSYSTEMS.map(e => `<button class="eco-card ${e.id === this.eco.id ? 'sel' : ''}" data-id="${e.id}">
      <b>${esc(e.name)}</b><small>${esc(e.place)} — ${esc(e.blurb)}</small><span class="chip">${e.speciesInfo.length} species</span></button>`).join('');
    cards.querySelectorAll('.eco-card').forEach(b => b.onclick = () => this.switchEco(b.dataset.id));
    $('#btn-play').onclick = () => { this.audio.start(); this.startLand(null); };
    $('#btn-journal').onclick = () => this.panels.journal(this.eco, ECOSYSTEMS, this.progress);
    $('#btn-settings').onclick = () => this.openSettings();
    $('#btn-help').onclick = () => this.panels.help();
    this.updateProgressSummary();
  }
  async switchEco(id) {
    if (id === this.eco.id || this.loading) return;
    this.loading = true; // the frame loop idles while the old site is torn down and the new one built
    this.eco = ecoById(id);
    $('#loading').classList.add('show'); $('#menu').classList.remove('show');
    try {
      await this.world.load(this.eco, (f, m) => { $('#load-bar').style.width = `${f * 100}%`; $('#load-msg').textContent = m; });
      this.audio.setSite(this.eco); this.setupShadows();
      await this.warmUp();
    } finally { this.loading = false; }
    $('#loading').classList.remove('show');
    this.bindMenu();
    this.enterMenu();
  }
  /** Compile every shader the site needs before it is shown. Done all at once with the browser's parallel compiler,
   *  so the page keeps responding; otherwise Windows (Direct3D) can stall for 20 s on the first frame. Hidden objects
   *  (culled reef tiles, the jet ski, far animals) are briefly shown so they don't hitch later when they appear. */
  async warmUp() {
    $('#load-msg').textContent = 'Warming up the graphics…';
    const hidden = [];
    this.scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    // Compile against the buffer the scene is really drawn into (the post-processing target, linear colour) or the
    // shader variants won't match and get rebuilt on the first frame anyway.
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.composer ? this.composer.readBuffer : null);
    try { await this.renderer.compileAsync(this.scene, this.camera); }
    catch (e) { console.warn('Shader warm-up failed', e); }
    finally { for (const o of hidden) o.visible = false; this.renderer.setRenderTarget(prev); }
  }
  updateProgressSummary() {
    const n = Object.keys(this.progress.journal).length;
    $('#progress-sum').textContent = `${n} species in your field guide`;
  }
  enterMenu() {
    this.mode = 'menu';
    this.fishing?.stop();
    document.body.classList.remove('land-mode'); $('#prompt').innerHTML = '';
    this.input.wantLock = false; this.input.unlock();
    $('#menu').classList.add('show'); $('#hud').classList.add('hidden');
    $('#click-to-play').classList.add('hidden');
    this.menuT = 0;
    this.updateProgressSummary();
  }

  // ------------------------------------------------------------------ keys
  bindKeys() {
    addEventListener('keydown', e => {
      if (this.panels.isOpen || this.mode !== 'land') return;
      const c = e.code;
      if (c === 'KeyP') this.pauseMenu();
      if (c === 'KeyR' && this.eco.fishing) this.toggleRod();
      if (c === 'KeyJ') this.panels.journal(this.eco, ECOSYSTEMS, this.progress);
    });
  }
  setKeys(list) { $('#keys').innerHTML = list.map(([k, v]) => `<span><kbd>${k}</kbd> ${v}</span>`).join(''); }
  pauseMenu() {
    this.panels.open(`<h2>Paused</h2><p>${esc(this.eco.name)}</p>
      <p><button class="btn primary" id="p-resume">Resume</button> <button class="btn" id="p-help">How to play</button> <button class="btn" id="p-set">Settings</button> <button class="btn ghost" id="p-quit">Quit to title</button></p>`);
    $('#p-resume').onclick = () => this.panels.close();
    $('#p-help').onclick = () => this.panels.help();
    $('#p-set').onclick = () => this.openSettings();
    $('#p-quit').onclick = () => { this.panels.onClose = null; this.panels.close(); this.enterMenu(); };
  }
  openSettings() {
    this.panels.settings(this.settings, (k, v) => {
      if (k === 'resetProgress') { resetProgress(); this.progress = loadProgress(); this.panels.close(); this.updateProgressSummary(); return; }
      this.settings[k] = v; saveSettings(this.settings);
      if (k === 'volume') this.audio.setVolume(v);
      if (k === 'quality' || k === 'style') location.reload();
    });
  }
  /** high/ultra: every opaque lit object casts and receives sun shadows (water, sky and particles use their own shaders). */
  setupShadows() {
    if (!this.quality.shadows) return;
    this.scene.traverse(o => {
      const m = o.material;
      if (!o.isMesh || !m || Array.isArray(m) || !m.isMeshStandardMaterial || m.transparent) return;
      o.receiveShadow = true;
      o.castShadow = o !== this.world.terrain?.mesh && !o.userData.noShadow; // the big seabed mesh and small ground plants only receive
    });
  }
  /** Land is the only play mode; a first-person mode has mouse look, the crosshair and info cards. */
  get firstPerson() { return this.mode === 'land'; }
  lockSoon() { if (this.firstPerson) { $('#click-to-play').classList.toggle('hidden', this.input.locked || this.input.dragLook); } }
  onPanelClosed() {
    if (this.firstPerson) this.lockSoon();
    if (this.mode === 'menu') this.updateProgressSummary();
  }

  // ------------------------------------------------------------------ land (beach, dunes, rock platform, estuary bank)
  startLand(spawn, yaw) {
    const L = this.eco.land;
    this.mode = 'land'; this.modeSince = this.time;
    this.fishing.stop();
    document.body.classList.add('land-mode');
    $('#menu').classList.remove('show'); $('#hud').classList.remove('hidden');
    $('#site-name').textContent = `${this.eco.name} · ${this.eco.place}`;
    if (!spawn) spawn = new THREE.Vector3(L.spawn.x, this.world.groundAt(L.spawn.x, L.spawn.z), L.spawn.z);
    this.walker.spawn(spawn, yaw ?? L.spawn.yaw);
    this.input.wantLock = true;
    this.setKeys([['WASD', 'walk'], ['Shift', 'run'], ['Space', 'jump'], ['R', 'rod'], ['Click', 'info'], ['J', 'field guide'], ['P', 'pause']]);
    this.toast(L.intro);
    if (!this.panels.isOpen) this.lockSoon();
  }
  updateLand(dt, paused) {
    const w = this.walker;
    if (!paused) {
      w.update(dt, this.world, this.eco.land.bounds);
      for (const c of this.input.takeClicks()) {
        if (!this.input.lookActive) continue;
        const hit = this.world.pick(this.camera.position, w.lookDir);
        if (hit) { const sp = this.eco.speciesInfo.find(s => s.id === hit.id); if (sp) this.panels.card(sp, this.progress.journal[`${this.eco.id}:${sp.id}`]); }
      }
    }
    for (const e of w.takeEvents()) {
      if (e === 'step') this.audio.play('footstep');
      else if (e === 'stepWet') this.audio.play('footstep', { wet: true });
      else if (e === 'splash') this.audio.play('smallSplash');
    }
    this.world.waveMesh.update(null, this.time);
    w.noJump = this.fishing.active;
    if (this.fishing.active) { if (!paused) this.fishing.update(dt, this.time, this.input, this.world, this.camera.position.clone()); }
    else $('#prompt').innerHTML = '';
    if (this.frame % 5 === 0 && !paused) {
      const hit = this.input.lookActive ? this.world.pick(this.camera.position, w.lookDir, 12) : null;
      const lbl = $('#target-label');
      if (hit) { const sp = this.eco.speciesInfo.find(s => s.id === hit.id); lbl.innerHTML = sp ? `${esc(sp.common)} <i>· click for info</i>` : ''; lbl.classList.toggle('show', !!sp); }
      else lbl.classList.remove('show');
    }
  }

  // ------------------------------------------------------------------ fishing
  /** Which catch table applies where the player stands (keys of SPOTS in fishing/catches.js). */
  fishingSpot() { return this.eco.fishing?.spotAt?.(this.walker.pos.x, this.walker.pos.z) ?? 'beach'; }
  toggleRod() { this.fishing.toggle(this.fishingSpot()); }
  /** A fish is in your hands: decide to keep or release it (NSW rules). */
  onFishLanded(c, spot, done) {
    const sp = this.catchCard(c.id)?.sp;
    const name = sp ? sp.common : c.id, rule = RULES[c.id];
    const today = new Date().toDateString();
    this.progress.catches ??= [];
    const keptToday = this.progress.catches.filter(x => x.id === c.id && x.kept && new Date(x.time).toDateString() === today).length;
    const verdict = judge(c.id, c.length, keptToday);
    // Log the species in the field guide with a picture of the fish in your hands (grabbed after the next render).
    this.pendingCatch = c;
    const decide = keep => {
      const correct = keep ? verdict.legal : true;
      this.progress.catches.push({ eco: this.eco.id, id: c.id, length: c.length, kept: keep, correct, time: Date.now(), spot });
      this.persist();
      if (keep && !verdict.legal) { this.toast(`⚠ That fish had to go back: ${verdict.reason}`, 'bad'); this.audio.play('wrong'); }
      else if (keep) { this.toast(`You kept a ${c.length} cm ${name}. Kept today: ${keptToday + 1}${rule?.bag ? ` of ${rule.bag}` : ''}.`, 'good'); this.audio.play('correct'); }
      else { this.toast(verdict.legal ? `Released a legal ${name} — catch and release is always allowed.` : `Correct — released. ${verdict.reason}`, 'good'); this.audio.play('correct'); }
      this.panels.close();
    };
    this.panels.open(`<h2>${esc(name)} — ${c.length} cm</h2>
      ${sp ? `<p><i>${esc(sp.sci)}</i> · ${esc(sp.status)}</p>` : ''}
      <p><b>Rule:</b> ${esc(rule?.note ?? 'No specific limit in this game.')}</p>
      <p><b>Kept today:</b> ${keptToday}${rule?.bag ? ` of ${rule.bag}` : ''}</p>
      <p style="color:var(--muted)">Decide: may you keep this fish? (Releasing a legal fish is always allowed.)</p>
      <p><button class="btn primary" id="fx-keep">Keep it</button> <button class="btn" id="fx-release">Release it</button></p>`, () => done());
    $('#fx-keep').onclick = () => decide(true);
    $('#fx-release').onclick = () => decide(false);
  }
  /** Species card for a catch id: this site's first, else any site's (catch tables are shared across sites). */
  catchCard(id) {
    for (const e of [this.eco, ...ECOSYSTEMS]) { const sp = e.speciesInfo.find(s => s.id === id); if (sp) return { sp, eco: e }; }
    return null;
  }
  /** Field-guide entry for a landed fish: first catch adds it, a longer one replaces the picture. */
  storeCatch(c, img) {
    const card = this.catchCard(c.id);
    if (!card) return;
    const { sp } = card, key = `${card.eco.id}:${sp.id}`, prev = this.progress.journal[key];
    const entry = prev ?? { time: Date.now() };
    if (!prev || c.length > (prev.best ?? 0)) { entry.best = c.length; if (img) entry.photo = img; entry.time = Date.now(); }
    this.progress.journal[key] = entry;
    this.persist();
    this.audio.play(prev ? 'betterPhoto' : 'newSpecies');
    if (!prev) this.toast(`📗 New species: ${sp.common} (${sp.sci}). Field notes unlocked — press J.`, 'good');
  }
  persist() { if (!saveProgress(this.progress)) this.toast('Storage is full — some old pictures were not saved.', 'warn'); }
  exportCSV() {
    const csv = progressCSV(this.progress, (e, id) => ecoById(e)?.speciesInfo.find(s => s.id === id));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'tideline-field-data.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ------------------------------------------------------------------ feedback
  toast(text, kind = '') {
    const box = $('#toast');
    const now = performance.now();
    if (this.lastToast === text && now - this.lastToastT < 4000) return; // no duplicate spam
    this.lastToast = text; this.lastToastT = now;
    const el = document.createElement('div');
    el.className = `toast ${kind}`; el.textContent = this.hint(text);
    if (kind === 'warn') this.audio.play('warn');
    box.appendChild(el);
    while (box.children.length > 2) box.firstChild.remove();
    setTimeout(() => el.remove(), 4200 + text.length * 35);
  }
  /** Keyboard hints become button names on touch devices. */
  hint(text) { return this.touch ? this.touch.label(text) : text; }

  // ------------------------------------------------------------------ main loop
  /** Test helper: advance the simulation deterministically (used by automated play-tests). */
  advance(seconds, hook) {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) { hook?.(this); this.loop(1 / 60, i < n - 1); }
  }
  /** Adaptive resolution: drop the render scale on slow machines (school laptops). */
  adapt(raw) {
    this.ft = (this.ft ?? 0.016) * 0.95 + raw * 0.05;
    this.fps = Math.round(1 / this.ft);
    this.slowT = this.ft > 0.034 ? (this.slowT ?? 0) + raw : 0;
    if (this.slowT > 3 && this.renderer.getPixelRatio() > 0.55) {
      this.renderer.setPixelRatio(Math.max(0.5, this.renderer.getPixelRatio() - 0.15));
      this.resize(); this.slowT = 0;
      if (!this.adaptWarned) { this.adaptWarned = true; this.toast('Lowering resolution to keep things smooth. You can change graphics in Settings.'); }
    }
  }
  loop(fixedDt, skipRender = false) {
    if (this.loading) { this.clock.getDelta(); return; }
    const raw = fixedDt ?? this.clock.getDelta();
    if (!fixedDt && raw < 0.25 && document.visibilityState === 'visible') this.adapt(raw);
    const dt = fixedDt ?? Math.min(0.05, raw);
    this.time += dt; this.frame++;
    globalUniforms.uTime.value = this.time;
    this.world.time = this.time;
    const paused = this.panels.isOpen;
    this.input.gameplay = !paused && this.mode === 'land';
    if (this.mode === 'menu') this.updateMenu(dt);
    else if (this.mode === 'land') this.updateLand(dt, paused);
    if (this.world.land) this.world.land.update(dt, this.mode === 'land' ? this.walker : null);
    // Life keeps moving even with panels open.
    if (this.world.life && this.frame % 2 === 0) this.world.life.update(dt * 2, null);
    const cam = this.camera.position;
    const surfaceY = this.world.surfaceAt(cam.x, cam.z);
    const depth = surfaceY - cam.y;
    this.env.update(dt, this.camera, depth);
    this.world.ocean.update(this.camera, depth > 0);
    this.world.reef?.cull(cam, depth > 0 ? 2.6 / this.env.fogDensityBelow + 4 : 150, depth > 0 ? 0.9 / this.env.fogDensityBelow : 40);
    this.world.sky.update(this.camera);
    this.fx.update(dt, this.camera, 0);
    this.audio.update(dt, { mode: this.mode, depth, camera: this.camera, roar: 0, life: this.world.life, eco: this.eco, reefHealth: 1 });
    $('#fx-uw').style.opacity = depth > 0 ? 1 : 0;
    this.touch?.update();
    if (skipRender) { this.input.endFrame(); return; }
    if (this.gradePass) {
      // ShaderPass copies its uniforms, so feed it the live fog and underwater state each frame.
      const u = this.gradePass.material.uniforms;
      u.uFogDensity.value = globalUniforms.uFogDensity.value; u.uUnder.value = globalUniforms.uUnderwater.value;
    }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    if (this.pendingCatch) { const img = snapshot(this.renderer.domElement); this.storeCatch(this.pendingCatch, img); this.pendingCatch = null; }
    this.input.endFrame();
  }

  /** Title screen backdrop: a slow orbit around the site's signature view (eco.menuCam). */
  updateMenu(dt) {
    this.menuT += dt;
    const m = this.eco.menuCam ?? { look: [60, 1, 90], r: 40, y: 6 };
    const a = this.menuT * 0.04;
    this.camera.position.set(m.look[0] + Math.cos(a) * m.r, m.y, m.look[2] + Math.sin(a) * m.r);
    this.camera.lookAt(m.look[0], m.look[1], m.look[2]);
    this.world.waveMesh.update(null, this.time);
  }
}

const game = new Game();
window.__game = game; // debugging hook
game.start().catch(err => {
  console.error(err);
  $('#load-msg').textContent = 'Something went wrong starting TideLine: ' + err.message;
});
