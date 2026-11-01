// TideLine — game orchestrator: title -> walk the shore -> rod fishing (tackle box, cast, strike, catch bar, keep or release).
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
import { CameraRig } from './land/cameraRig.js';
import { Angler } from './land/angler.js';
import { Shoals } from './life/shoals.js';
import { Fishing } from './fishing/fishing.js';
import { judge, RULES, SPECIES_BY_ID, adjustStock } from './fishing/catches.js';
import { DayConditions, RIGS, BAITS, tackleBoxHTML } from './fishing/gear.js';
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
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.4, 7000);
    this.input = new Input(canvas);
    this.audio = new Audio(); this.audio.volume = this.settings.volume;
    this.panels = new Panels(this);
    this.env = new Environment(this.scene, this.renderer, this.quality);
    this.fx = new Particles(this.scene, this.quality);
    this.world = new World(this.scene, this.renderer, this.env, this.fx, this.quality);
    this.walker = new Walker(this.input, this.settings);
    this.rig = new CameraRig(this.camera, this.input, this.settings);
    this.listener = { position: new THREE.Vector3(), matrixWorld: this.camera.matrixWorld }; // sound is heard from the angler, not the camera boom
    this.focus = new THREE.Vector3(); // what the camera looks at (the sun's shadow box follows it)
    this.fishing = new Fishing(this);
    // The day: tide, time, season and swell cycle with in-game time (?season=winter&time=dusk&tide=low&swell=1.5 for testing).
    this.cond = new DayConditions({ season: params.get('season') ?? undefined, time: params.get('time') ?? undefined, tide: params.get('tide') ?? undefined, swell: params.has('swell') ? Number(params.get('swell')) : undefined });
    this.gear = { rig: 'runningsinker', bait: 'prawn', ...this.progress.gear };
    if (!RIGS[this.gear.rig]) this.gear.rig = 'runningsinker';
    if (!RIGS[this.gear.rig].lure && !BAITS[this.gear.bait]) this.gear.bait = 'prawn';
    this.mode = 'loading';
    this.eco = ecoById(params.get('eco')) ?? ECOSYSTEMS[0];
    this.frame = 0; this.time = 0;
    this.setupComposer();
    addEventListener('resize', () => this.resize());
    this.resize();
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
    this.audio.setSite(this.eco); this.makeAngler(); this.setupShadows();
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
      this.audio.setSite(this.eco); this.makeAngler(); this.setupShadows();
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
    this.menuT = 0;
    this.placeAnglerAtSpawn();
    this.updateProgressSummary();
  }

  // ------------------------------------------------------------------ keys
  bindKeys() {
    addEventListener('keydown', e => {
      if (e.code === 'KeyT' && this.tackleOpen && this.panels.isOpen) { this.panels.close(); return; }
      if (this.panels.isOpen || this.mode !== 'land') return;
      const c = e.code;
      if (c === 'KeyP') this.pauseMenu();
      if (c === 'KeyR' && this.eco.fishing) this.toggleRod();
      if (c === 'KeyT' && this.eco.fishing) this.tackleBox();
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
  /** The angler and the shoals live in the scene across sites; built once, then re-used. Character creation: game.setAppearance({ skin, hair, hat, shirt, shorts }). */
  makeAngler() {
    if (!this.angler) this.angler = new Angler(this.scene, this.world.models, this.progress.look);
    this.angler.castShadows(!!this.quality.shadows);
    this.shoals?.dispose();
    this.shoals = new Shoals(this.scene, this.quality);
  }
  setAppearance(a) { const look = this.angler.setAppearance(a); this.progress.look = look; this.persist(); return look; }
  onPanelClosed() {
    if (this.mode === 'menu') this.updateProgressSummary();
  }

  // ------------------------------------------------------------------ land (beach, dunes, rock platform, estuary bank)
  /** Stand the angler at the site's spawn point (title screen backdrop, and the start of an outing). */
  placeAnglerAtSpawn() {
    const L = this.eco.land;
    const sp = new THREE.Vector3(L.spawn.x, this.world.walkAt(L.spawn.x, L.spawn.z), L.spawn.z);
    this.walker.spawn(sp, L.spawn.yaw ?? 0);
    this.rig.reset(sp, L.spawn.yaw ?? 0);
    this.angler.root.visible = true; this.angler.place(sp, this.walker.heading);
    this.angler.update(1 / 60, this.time, { state: 'off' });
    return sp;
  }
  startLand(spawn, yaw) {
    const L = this.eco.land;
    this.mode = 'land'; this.modeSince = this.time;
    this.fishing.stop();
    document.body.classList.add('land-mode');
    $('#menu').classList.remove('show'); $('#hud').classList.remove('hidden');
    $('#site-name').textContent = `${this.eco.name} · ${this.eco.place}`;
    if (this.viewOffset) { this.camera.clearViewOffset(); this.viewOffset = false; }
    if (!spawn) spawn = this.placeAnglerAtSpawn();
    this.walker.spawn(spawn, yaw ?? L.spawn.yaw ?? 0);
    this.rig.reset(spawn, yaw ?? L.spawn.yaw ?? 0);
    this.input.wantLock = false;
    this.setKeys([['WASD', 'walk'], ['Shift', 'run'], ['Q / E', 'turn camera'], ['Wheel', 'zoom'], ['R', 'rod'], ['T', 'tackle'], ['Space', 'cast / strike / lift'], ['J', 'field guide'], ['P', 'pause']]);
    this.toast(L.intro);
  }
  /** A ray from the camera through a screen point (CSS pixels). */
  mouseRay(x, y) {
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    const r = new THREE.Raycaster(); r.setFromCamera(ndc, this.camera);
    return r.ray;
  }
  /** Desktop: while the rod is out, the angler turns to face the pointer (touch and keyboard keep the walking direction). */
  aimAtCursor(dt) {
    const m = this.input.mouse;
    if (this.touch || performance.now() - m.t > 3500) return;
    const ray = this.mouseRay(m.x, m.y);
    if (ray.direction.y > -0.05) return;
    const k = (0.05 - ray.origin.y) / ray.direction.y, px = ray.origin.x + ray.direction.x * k, pz = ray.origin.z + ray.direction.z * k;
    this.walker.face(px - this.walker.pos.x, pz - this.walker.pos.z, dt);
  }
  updateLand(dt, paused) {
    const w = this.walker, f = this.fishing;
    if (!paused) {
      w.viewYaw = this.rig.yaw;
      w.update(dt, this.world, this.eco.land.bounds);
      for (const c of this.input.takeClicks()) {
        if (c.button !== 0 || c.x == null) continue;
        const ray = this.mouseRay(c.x, c.y), hit = this.world.pick(ray.origin, ray.direction, 80);
        if (hit) { const sp = this.eco.speciesInfo.find(s => s.id === hit.id); if (sp) this.panels.card(sp, this.progress.journal[`${this.eco.id}:${sp.id}`]); }
      }
    }
    for (const e of w.takeEvents()) {
      if (e === 'step') this.audio.play('footstep');
      else if (e === 'stepWet') this.audio.play('footstep', { wet: true });
      else if (e === 'splash') this.audio.play('smallSplash');
    }
    this.world.waveMesh.update(null, this.time);
    if (!paused) this.cond.update(dt);
    if (this.frame % 6 === 0) this.updateChip();
    if (f.active) { if (!paused) f.update(dt, this.time, this.input, this.world); }
    else { $('#prompt').innerHTML = ''; w.frozen = false; }
    // Camera: follows the angler, frames the float too while a line is out.
    const also = f.active && f.float.visible && ['wait', 'bite', 'fight', 'flying'].includes(f.state) ? f.float.position : null;
    this.rig.update(dt, this.world, w.pos, also, !paused);
    this.focus.copy(this.rig.focus);
    // The angler: stand, walk and fish.
    const a = this.angler;
    a.place(w.pos, w.heading);
    a.update(dt, this.time, { speed: w.speed, state: f.active ? f.state : 'off', power: f.power, act: f.act, reducedMotion: this.settings.reducedMotion });
    if (this.frame % 5 === 0 && !paused) {
      const m = this.input.mouse, lbl = $('#target-label');
      const hit = !this.touch && performance.now() - m.t < 2500 ? (() => { const r = this.mouseRay(m.x, m.y); return this.world.pick(r.origin, r.direction, 80); })() : null;
      if (hit) { const sp = this.eco.speciesInfo.find(s => s.id === hit.id); lbl.innerHTML = sp ? `${esc(sp.common)} <i>· click for info</i>` : ''; lbl.style.left = `${m.x}px`; lbl.style.top = `${m.y + 22}px`; lbl.classList.toggle('show', !!sp); }
      else lbl.classList.remove('show');
    }
  }

  // ------------------------------------------------------------------ fishing
  /** Which catch table applies (keys of SPOTS in fishing/catches.js): where the float landed (tx, tz), else where the player stands. */
  fishingSpot(target) {
    const p = this.walker.pos, t = target ?? p;
    return this.eco.fishing?.spotAt?.(p.x, p.z, t.x, t.z) ?? 'beach';
  }
  toggleRod() { this.fishing.toggle(this.fishingSpot()); }
  /** The tackle and conditions the bite model uses (catches.js pickCatch). */
  biteContext() {
    return this.cond.context(this.gear, (spot, id) => this.progress.stock?.[`${spot}:${id}`]);
  }
  /** Small HUD chip: tide, time, season, swell, and the rig and bait in the tackle box. */
  updateChip() {
    const chip = $('#cond-chip');
    if (!chip) return;
    const r = RIGS[this.gear.rig], b = RIGS[this.gear.rig].lure ? '' : ` + ${BAITS[this.gear.bait]?.name ?? 'no bait'}`;
    const html = `<b>${this.cond.chip()}</b><span>Tackle: ${r.name}${b}</span>`;
    if (chip.dataset.v !== html) { chip.dataset.v = html; chip.innerHTML = html; }
  }
  /** T: open the tackle box (rig and bait). Not while a fish is on. */
  tackleBox() {
    if (!this.fishing.canChangeGear) { this.toast('Land or lose this fish first, then change your tackle.', 'warn'); return; }
    const render = () => {
      this.panels.body.innerHTML = tackleBoxHTML(this.gear);
      for (const b of this.panels.body.querySelectorAll('.tb-rig')) b.onclick = () => {
        this.gear.rig = b.dataset.rig;
        if (RIGS[this.gear.rig].lure) this.gear.bait = 'none';
        else if (!BAITS[this.gear.bait]) this.gear.bait = this.lastBait ?? 'prawn';
        this.saveGear(); render(); this.panels.body.querySelector(`.tb-rig[data-rig="${this.gear.rig}"]`)?.focus({ preventScroll: true });
      };
      for (const b of this.panels.body.querySelectorAll('.tb-bait')) b.onclick = () => { this.gear.bait = this.lastBait = b.dataset.bait; this.saveGear(); render(); this.panels.body.querySelector(`.tb-bait[data-bait="${this.gear.bait}"]`)?.focus({ preventScroll: true }); };
      this.panels.body.querySelector('#tb-done').onclick = () => this.panels.close();
    };
    this.tackleOpen = true;
    this.panels.open(tackleBoxHTML(this.gear), () => { this.tackleOpen = false; this.toast(`Tackle set: ${RIGS[this.gear.rig].name}${RIGS[this.gear.rig].lure ? '' : ' + ' + (BAITS[this.gear.bait]?.name ?? 'no bait')}. It applies to your next cast.`); });
    render();
  }
  saveGear() { this.progress.gear = { ...this.gear }; this.persist(); }
  /** The catch bar's zone touched a piece of litter. */
  onLitter(kind) {
    const st = this.progress.steward ??= { points: 0, litter: 0 };
    st.points++; st.litter++; this.persist();
    this.audio.play('correct');
    this.toast(kind === 'line'
      ? `Tangled line collected! Lost fishing line traps and drowns birds, turtles and fish. Steward points: ${st.points}.`
      : `Plastic bag collected! Turtles mistake bags for jellyfish and eat them. Steward points: ${st.points}.`, 'good');
  }
  /** A fish is in your hands: decide to keep or release it (NSW rules). */
  onFishLanded(c, spot, done) {
    const info = SPECIES_BY_ID[c.id], sp = this.catchCard(c.id)?.sp;
    const name = info?.name ?? sp?.common ?? c.id, sci = info?.sci ?? sp?.sci, status = info?.statusNote ?? sp?.status, rule = RULES[c.id];
    const today = new Date().toDateString();
    this.progress.catches ??= [];
    const kept = this.progress.catches.filter(x => x.id === c.id && x.kept);
    const keptToday = kept.filter(x => new Date(x.time).toDateString() === today).length;
    // Possession stand-in until the esky is emptied at the café (phase 1b): fish of this species kept in the last 3 days.
    const inPossession = kept.filter(x => Date.now() - x.time < 3 * 864e5).length;
    const verdict = judge(c.id, c.length, keptToday, inPossession);
    // Log the species in the field guide with a picture of the fish in your hands (grabbed after the next render).
    this.pendingCatch = c;
    const decide = keep => {
      const correct = keep ? verdict.legal : true;
      const ctx = c.ctx ?? {};
      this.progress.catches.push({ eco: this.eco.id, id: c.id, length: c.length, kept: keep, correct, time: Date.now(), spot, tide: ctx.tide, daytime: ctx.time, rig: ctx.rig, bait: ctx.bait });
      // Stock health: good practice nudges it up, taking fish (illegal ones most of all) pulls it down.
      adjustStock(this.progress, spot, c.id, keep ? (verdict.legal ? -1 : -4) : 1);
      this.persist();
      if (keep && !verdict.legal) { this.toast(`⚠ That fish had to go back: ${verdict.reason}`, 'bad'); this.audio.play('wrong'); }
      else if (keep) { this.toast(`You kept a ${c.length} cm ${name}. Kept today: ${keptToday + 1}${rule?.bag ? ` of ${rule.bag}` : ''}.`, 'good'); this.audio.play('correct'); }
      else { this.toast(verdict.legal ? `Released a legal ${name}. Catch and release is always allowed.` : `Correct — released. ${verdict.reason}`, 'good'); this.audio.play('correct'); }
      this.panels.close();
    };
    this.panels.open(`<h2>${esc(name)} — ${c.length} cm</h2>
      ${sci ? `<p><i>${esc(sci)}</i> · ${esc(status ?? '')}</p>` : ''}
      <p><b>Rule:</b> ${esc(rule?.note ?? 'No specific limit in this game.')}</p>
      <p><b>Kept today:</b> ${keptToday}${rule?.bag ? ` of ${rule.bag}` : ''}</p>
      <p style="color:var(--muted)">Decide: may you keep this fish? (Releasing a legal fish is always allowed.)</p>
      <p><button class="btn primary" id="fx-keep">Keep it</button> <button class="btn" id="fx-release">Release it</button></p>`, () => done());
    this.panels.modal.classList.add('dock-bottom'); // the card sits low, so the angler holding the catch stays in view above it
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
    const card = this.catchCard(c.id), info = SPECIES_BY_ID[c.id];
    if (!card && !info) return;
    const sp = card?.sp ?? { id: c.id, common: info.name, sci: info.sci };
    const key = `${card?.eco.id ?? this.eco.id}:${sp.id}`, prev = this.progress.journal[key];
    const entry = prev ?? { time: Date.now() };
    if (!prev || c.length > (prev.best ?? 0)) { entry.best = c.length; if (img) entry.photo = img; entry.time = Date.now(); }
    this.progress.journal[key] = entry;
    this.persist();
    this.audio.play(prev ? 'betterPhoto' : 'newSpecies');
    if (!prev) this.toast(`📗 New species: ${sp.common} (${sp.sci}). Field notes unlocked — press J.`, 'good');
  }
  persist() { if (!saveProgress(this.progress)) this.toast('Storage is full — some old pictures were not saved.', 'warn'); }
  exportCSV() {
    const csv = progressCSV(this.progress, (e, id) => ecoById(e)?.speciesInfo.find(s => s.id === id) ?? (SPECIES_BY_ID[id] && { common: SPECIES_BY_ID[id].name, sci: SPECIES_BY_ID[id].sci }));
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
    this.env.update(dt, this.camera, depth, this.mode === 'land' ? this.focus : null);
    globalUniforms.uPlayer.value.set(this.walker.pos.x, this.mode === 'land' ? this.walker.pos.y : -999, this.walker.pos.z);
    this.world.props?.update(dt, this.time);
    this.shoals?.update(dt, this.time, this.world, this.mode === 'land' ? this.walker : null, this.eco);
    this.world.ocean.update(this.camera, depth > 0);
    this.world.reef?.cull(cam, depth > 0 ? 2.6 / this.env.fogDensityBelow + 4 : 150, depth > 0 ? 0.9 / this.env.fogDensityBelow : 40);
    this.world.sky.update(this.camera);
    this.fx.update(dt, this.camera, 0);
    this.listener.position.copy(this.mode === 'land' ? this.walker.pos : cam);
    this.audio.update(dt, { mode: this.mode, depth, camera: this.listener, roar: 0, life: this.world.life, eco: this.eco, reefHealth: 1 });
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

  /** Title screen backdrop: the same high camera, slowly swinging round the angler at the water's edge (eco.menuCam: { yaw, swing, pitch, dist, lift }). */
  updateMenu(dt) {
    this.menuT += dt;
    const m = { yaw: 0, swing: 0.35, pitch: 0.78, dist: 17, lift: 0, ...this.eco.menuCam };
    const rig = this.rig, p = this.walker.pos;
    rig.yaw = m.yaw + Math.sin(this.menuT * 0.07) * m.swing; rig.pitch = m.pitch; rig.dist = rig.zoom = m.dist;
    rig.focus.set(p.x, p.y + 0.9 + m.lift, p.z);
    rig.apply(this.world);
    this.focus.copy(rig.focus);
    // Slide the picture so the angler sits to the right of the title panel (above it on a portrait phone).
    const w = innerWidth, h = innerHeight, wide = w > h * 1.1;
    this.camera.setViewOffset(w, h, wide ? -w * 0.2 : 0, wide ? 0 : h * 0.2, w, h); this.viewOffset = true;
    this.angler.place(p, this.walker.heading);
    this.angler.update(dt, this.time, { state: 'off' });
    this.world.waveMesh.update(null, this.time);
  }
}

const game = new Game();
window.__game = game; // debugging hook
game.start().catch(err => {
  console.error(err);
  $('#load-msg').textContent = 'Something went wrong starting TideLine: ' + err.message;
});
