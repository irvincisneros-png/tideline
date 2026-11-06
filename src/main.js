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
import { loadProgress, saveProgress, resetProgress, logbookCSV, guideCSV } from './core/save.js';
import { globalUniforms } from './ocean/shaders.js';
import { Environment } from './ocean/environment.js';
import { Particles } from './world/particles.js';
import { World } from './world/world.js';
import { Walker } from './land/walker.js';
import { CameraRig } from './land/cameraRig.js';
import { Angler } from './land/angler.js';
import { Shoals } from './life/shoals.js';
import { Fishing } from './fishing/fishing.js';
import { SPECIES_BY_ID, SPOT_INFO } from './fishing/catches.js';
import * as G from './fishing/guide.js';
import { Dialogue } from './ui/dialogue.js';
import { CatchFlow } from './ui/catchFlow.js';
import { openGuide, guideRows } from './ui/fishGuideUI.js';
import { openLogbook } from './ui/logbookUI.js';
import { Outing } from './ui/outing.js';
import { Footprints } from './world/beachProps.js';
import { Creator } from './ui/creator.js';
import { lookOf, nameOf } from './core/anglerData.js';
import { DayConditions, RIGS, BAITS, tackleBoxHTML } from './fishing/gear.js';
import { Panels, esc } from './ui/panels.js';
import { ECOSYSTEMS, ecoById } from './ecosystems/index.js';
import { siteLock } from './ecosystems/unlock.js';
import { NPCManager } from './npc/manager.js';
import { rigUnlocked, baitUnlocked, lockHint } from './npc/inventory.js';
import { openQuestLog } from './ui/questLog.js';
import { runBoatTrip } from './ui/boatTrip.js';
import { openShop, showRecaptureLetter } from './ui/shop.js';
import { gearStats, baitCount, useBait, collect } from './economy/store.js';
import { lureMod } from './economy/effects.js';
import { ensureEcon, recaptureLetter } from './economy/coins.js';
import { COIN, COLLECT } from './content/shop.js';
import { openCoop } from './ui/coop.js';
import { runCeremony, updateCeremony } from './ui/ceremony.js';
import { openCredits } from './ui/credits.js';
import { openMap, MiniMap } from './ui/mapUI.js';
import { pendingCeremony } from './fishing/ending.js';
import { firstRunDue, runFirstRun } from './ui/firstRun.js';
import { ensureMissions, advanceMissions, hudInfo, radioLines, speakerOf, helloDue, markHello, HELLO_LINE } from './npc/missions.js';
import { ITEMS } from './content/items.js';

const $ = s => document.querySelector(s);
/** Which Fish Guide region (fishing/species.js REGIONS) each site belongs to. */
const REGION_OF = { rocky: 'bellambi', seagrass: 'lake', harbour: 'harbour', reef: 'reef', river: 'river' };
const params = new URLSearchParams(location.search);

class Game {
  constructor() {
    this.settings = loadSettings();
    this.quality = TIERS[this.settings.quality];
    this.progress = loadProgress();
    ensureMissions(this.progress);   // an older save: finished missions are marked done and their hats given silently, no scenes
    this.missionQueue = []; this.missionsDirty = true;
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
    this.audio = new Audio(); this.audio.volume = this.settings.volume; this.audio.music.configure({ enabled: this.settings.musicOn, volume: this.settings.musicVolume });
    this.panels = new Panels(this);
    this.dialogue = new Dialogue(this);
    this.catchFlow = new CatchFlow(this);
    this.creator = new Creator(this); this.creatorOpen = false;
    this.outing = new Outing(this);
    this.npcs = new NPCManager(this);
    this.env = new Environment(this.scene, this.renderer, this.quality);
    this.fx = new Particles(this.scene, this.quality);
    this.world = new World(this.scene, this.renderer, this.env, this.fx, this.quality);
    this.walker = new Walker(this.input, this.settings);
    this.rig = new CameraRig(this.camera, this.input, this.settings);
    this.listener = { position: new THREE.Vector3(), matrixWorld: this.camera.matrixWorld }; // sound is heard from the angler, not the camera boom
    this.focus = new THREE.Vector3(); // what the camera looks at (the sun's shadow box follows it)
    this.fishing = new Fishing(this);
    // The day: tide, time, season and swell cycle with in-game time (?season=winter&time=dusk&tide=low&swell=1.5 for testing).
    this.cond = new DayConditions({ season: params.get('season') ?? undefined, month: params.has('month') ? Number(params.get('month')) - 1 : undefined, time: params.get('time') ?? undefined, tide: params.get('tide') ?? undefined, swell: params.has('swell') ? Number(params.get('swell')) : undefined, flow: params.get('flow') ?? undefined });
    this.gear = { rig: 'runningsinker', bait: 'prawn', ...this.progress.gear };
    if (!RIGS[this.gear.rig] || !rigUnlocked(this.progress, this.gear.rig)) this.gear.rig = 'runningsinker';   // a rig you have not earned yet is not in your box
    if (!RIGS[this.gear.rig].lure && (!BAITS[this.gear.bait] || !baitUnlocked(this.progress, this.gear.bait))) this.gear.bait = 'prawn';
    ensureEcon(this.progress);
    this.mode = 'loading';
    this.eco = ecoById(params.get('eco')) ?? ECOSYSTEMS[0];
    this.cond.setFresh(this.eco.fresh);   // a river has flow, not tide and swell
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
    this.mini = new MiniMap(this);   // the optional corner minimap (Settings)
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
    window.__tlBoot?.set(0.3, 'Filling the tide pools…');   // the scripts have arrived (index.html showed their progress); the world is next
    await this.world.load(this.eco, (f, m) => { bar.style.width = `${30 + f * 70}%`; msg.textContent = m; });
    this.audio.setSite(this.eco); this.makeAngler(); this.setupShadows();
    await this.warmUp();
    $('#loading').classList.remove('show');
    this.clock = new THREE.Clock();
    this.enterMenu();
    // ?play skips the title (tests, teacher links) and the creator too (add ?creator to see it).
    if (params.has('ceremony')) runCeremony(this, params.get('ceremony') === 'milestone' ? 'milestone' : 'awards', { preview: true });   // ?ceremony=awards|milestone: the club ceremony straight away (teachers, tests)
    else if (params.has('play')) { if (params.has('creator') && !this.progress.angler) this.creator.open({ first: true, onDone: () => { this.startLand(null); this.firstRun(); } }); else { this.startLand(null); this.firstRun(); } }
    this.renderer.setAnimationLoop(() => this.loop());
  }

  // ------------------------------------------------------------------ menu
  bindMenu() {
    const cards = $('#eco-cards');
    cards.innerHTML = this.ecoCardsHTML();
    cards.querySelectorAll('.eco-card').forEach(b => b.onclick = () => this.switchEco(b.dataset.id, true));
    $('#btn-play').onclick = () => { this.audio.start(); this.beginPlay(); };
    $('#btn-new').onclick = () => this.newGame();
    $('#btn-credits').onclick = () => openCredits(this);
    $('#btn-awards').onclick = () => { this.audio.start(); const k = pendingCeremony(this.progress); if (k) runCeremony(this, k); };
    $('#btn-angler').onclick = () => this.creator.open({});
    $('#btn-journal').onclick = () => this.openGuide();
    $('#btn-logbook').onclick = () => openLogbook(this);
    $('#btn-settings').onclick = () => this.openSettings();
    $('#btn-help').onclick = () => this.panels.help();
    $('#home-btn').onclick = () => this.outing.ask();
    $('#quest-btn').onclick = () => this.questLog();
    $('#mission-btn').onclick = () => this.questLog();
    $('#view-btn').onclick = () => this.cycleView();
    this.updateProgressSummary();
  }
  /** The site picker: a card per site with its Fish Guide counter; a locked site shows what it needs ("Identify 5 species, 3 of 5"). */
  ecoCardsHTML() {
    const rc = Object.fromEntries(G.regionCounts(this.progress).map(c => [c.key, c])), regionOf = REGION_OF;
    return ECOSYSTEMS.map(e => {
      const c = rc[regionOf[e.id]], lock = siteLock(this.progress, e);
      const chip = lock.locked ? `🔒 ${lock.detail}` : c ? `${c.label} ${c.done}/${c.total}` : '';
      return `<button class="eco-card ${e.id === this.eco.id ? 'sel' : ''} ${lock.locked ? 'locked' : ''}" data-id="${e.id}" ${lock.locked ? 'aria-disabled="true"' : ''}>
      <b>${esc(e.name)}</b><small>${esc(e.place)} — ${esc(e.blurb)}</small>${chip ? `<span class="chip">${esc(chip)}</span>` : ''}</button>`;
    }).join('');
  }
  /** Start fishing: the first time (or on an older save with no angler yet) the character creator opens first. */
  beginPlay() {
    const go = () => { if (!this.progress.angler) this.creator.open({ first: true, onDone: () => { this.startLand(null); this.firstRun(); } }); else { this.startLand(null); this.firstRun(); } };
    // A site you reach by boat (the offshore reef) starts with the safety beat (lifejacket, trip log) and the run out of the harbour; a ?play deep link skips it.
    if (this.eco.travel && !params.has('play')) runBoatTrip(this).then(trip => { if (trip) { this.pendingTrip = trip; go(); } });
    else go();
  }
  /** The short skippable premise card for a brand-new player (ui/firstRun.js): once, never on a save with catches; a ?play link only with ?firstrun=1. */
  firstRun() { if (firstRunDue(this.progress, params)) runFirstRun(this); }
  /** Done in the character creator: save { name, ...look } and dress the angler in the world. */
  applyAngler(a) {
    this.progress.angler = a;
    this.angler.setAppearance(lookOf(a));
    this.persist();
    $('#btn-angler')?.setAttribute('title', `Edit ${a.name || 'my angler'}`);
    if (this.mode === 'menu') this.angler.update(1 / 60, this.time, { state: 'off' });
  }
  async switchEco(id, fromPicker = false) {
    if (id === this.eco.id || this.loading) return;
    const lock = siteLock(this.progress, ecoById(id));
    if (fromPicker && lock.locked) { this.toast(`${ecoById(id).name} opens when you ${lock.text.charAt(0).toLowerCase()}${lock.text.slice(1)} (${lock.progressText} so far). Catch fish and solve the key to get there.`, 'warn'); return; }
    await this.loadSite(id);
    this.bindMenu();
    this.enterMenu();
  }
  /** Tear down the current site and build another (the picker, and the club ceremony on Bellambi beach). The caller decides what mode comes next. */
  async loadSite(id) {
    if (this.loading) return;
    this.loading = true; // the frame loop idles while the old site is torn down and the new one built
    this.eco = ecoById(id); this.cond.setFresh(this.eco.fresh);
    $('#loading').classList.add('show'); $('#menu').classList.remove('show');
    try {
      await this.world.load(this.eco, (f, m) => { $('#load-bar').style.width = `${f * 100}%`; $('#load-msg').textContent = m; });
      this.audio.setSite(this.eco); this.makeAngler(); this.setupShadows();
      await this.warmUp();
    } finally { this.loading = false; }
    $('#loading').classList.remove('show');
  }
  /** Has this device played before? (a Fish Guide entry, a logbook row or a made angler) */
  hasProgress() { const p = this.progress; return !!(p.catches?.length || p.angler || Object.keys(p.guide?.e ?? {}).length); }
  /** Title screen: New game. Asks first, because it deletes the Fish Guide and logbook on this device. */
  newGame() {
    this.panels.open(`<h2>Start a new game?</h2>
      <p>This deletes your Fish Guide, logbook, esky, credits and angler on this device and starts again from the beginning.</p>
      <p class="muted">Want to keep your records? Export your logbook first (Logbook, then Export CSV).</p>
      <p><button class="btn primary" id="ng-yes">Delete and start again</button> <button class="btn" id="ng-no">Keep my game</button></p>`);
    $('#ng-no').onclick = () => this.panels.close();
    $('#ng-yes').onclick = () => { resetProgress(); this.progress = loadProgress(); ensureEcon(this.progress); ensureMissions(this.progress); this.missionQueue = []; this.missionsDirty = true; this.gear = { rig: 'runningsinker', bait: 'prawn' }; this.panels.close(); this.updateProgressSummary(); this.bindMenu(); };
  }
  /** The co-op panel (Nell): resolves when it closes. */
  openCoop(opts = {}) { return new Promise(res => openCoop(this, { ...opts, onClose: res })); }
  /** Start a club ceremony ('awards' | 'milestone'). */
  runCeremony(kind) { return runCeremony(this, kind); }
  /** After an outing: is a ceremony waiting? */
  pendingCeremony() { return pendingCeremony(this.progress); }
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
    const p = this.progress, st = G.stewardRating(p), bay = G.bayHealth(p);
    const rc = Object.fromEntries(G.regionCounts(p).map(c => [c.key, c]));
    document.querySelectorAll('.eco-card').forEach(card => {
      const e = ecoById(card.dataset.id), c = rc[REGION_OF[card.dataset.id]], lock = siteLock(p, e), chip = card.querySelector('.chip');
      card.classList.toggle('locked', lock.locked); if (lock.locked) card.setAttribute('aria-disabled', 'true'); else card.removeAttribute('aria-disabled');
      if (chip) chip.textContent = lock.locked ? `🔒 ${lock.detail}` : c ? `${c.label} ${c.done}/${c.total}` : '';
    });
    const has = this.hasProgress(), pend = pendingCeremony(p);
    $('#btn-play').textContent = has ? 'Continue' : 'Start fishing';
    $('#btn-new').classList.toggle('hidden', !has);
    $('#btn-awards').classList.toggle('hidden', !pend);
    $('#btn-awards').textContent = pend === 'milestone' ? '🎉 Club celebration' : '🏆 Awards night';
    $('#progress-sum').textContent = `Fish Guide ${G.completion(p)}% · Steward ${st.value.toFixed(1)}★ · Bay Health ${G.bayText(bay)}`;
  }
  /** The Illawarra Fish Guide (J). opts: { focus: species id, back: callback (shows a Back button and locks the panel), region }. */
  openGuide(opts = {}) { openGuide(this, opts); }
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
      if (e.code === 'KeyM' && this.mapOpen && this.panels.isOpen) { this.panels.close(); return; }   // M opens and closes the map
      if (this.panels.isOpen || this.dialogue.isOpen || this.creatorOpen || this.mode !== 'land') return;
      const c = e.code;
      if (c === 'KeyP') this.pauseMenu();
      if (c === 'KeyR' && this.eco.fishing) this.toggleRod();
      if (c === 'KeyT' && this.eco.fishing) this.tackleBox();
      if (c === 'KeyJ') this.openGuide();
      if (c === 'KeyM') this.openMap();
      if (c === 'KeyL') openLogbook(this);
      if (c === 'KeyH') this.outing.ask();
      if (c === 'KeyE') this.npcs.talkNearest();
      if (c === 'KeyB' && this.eco.toggleAnchor) this.eco.toggleAnchor(this);
      if (c === 'KeyQ') this.questLog();
      if (c === 'KeyV' && !e.repeat) this.cycleView();
    });
  }
  /** V / the View button: glide to the next camera preset (Diorama, Low, Over the shoulder). */
  cycleView() {
    if (this.mode !== 'land') return;
    this.rig.cyclePreset(this.walker.heading);
    this.toast(`View: ${this.rig.presetLabel}`);
    this.audio.play('click');
    return this.rig.preset;
  }
  questLog() { openQuestLog(this); }
  /** The map (M): this place, or the whole coast (tab 'region'). */
  openMap(tab = 'site') { openMap(this, tab); }
  setKeys(list) { $('#keys').innerHTML = list.map(([k, v]) => `<span><kbd>${k}</kbd> ${v}</span>`).join(''); }
  pauseMenu() {
    this.panels.open(`<h2>Paused</h2><p>${esc(this.eco.name)}</p>
      <p><button class="btn primary" id="p-resume">Resume</button> <button class="btn" id="p-map">🗺 Map</button> <button class="btn" id="p-help">How to play</button> <button class="btn" id="p-set">Settings</button> <button class="btn ghost" id="p-quit">Quit to title</button></p>`);
    $('#p-resume').onclick = () => this.panels.close();
    $('#p-map').onclick = () => this.openMap();
    $('#p-help').onclick = () => this.panels.help();
    $('#p-set').onclick = () => this.openSettings();
    $('#p-quit').onclick = () => { this.panels.onClose = null; this.panels.close(); this.enterMenu(); };
  }
  openSettings() {
    this.panels.settings(this.settings, (k, v) => {
      if (k === 'editAngler') { this.panels.close(true); this.creator.open({}); return; }
      if (k === 'resetProgress') { resetProgress(); this.progress = loadProgress(); ensureMissions(this.progress); this.missionQueue = []; this.missionsDirty = true; this.panels.close(); this.updateProgressSummary(); return; }
      this.settings[k] = v; saveSettings(this.settings);
      if (k === 'minimap') this.mini?.update(1);
      if (k === 'volume') this.audio.setVolume(v);
      if (k === 'musicOn') this.audio.music.configure({ enabled: v });
      if (k === 'musicVolume') this.audio.music.configure({ volume: v });
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
    if (!this.angler) this.angler = new Angler(this.scene, this.world.models, lookOf(this.progress.angler), { lo: this.settings.quality === 'low', shadows: !!this.quality.shadows });
    this.angler.castShadows(!!this.quality.shadows);
    this.shoals?.dispose();
    this.shoals = new Shoals(this.scene, this.quality);
    this.prints?.dispose();
    this.prints = new Footprints(this.scene, this.world); // footprints trail behind the angler on dry sand
    // A school of a species passing within 8 m marks it Seen in the Fish Guide (an NPC's gossip calls guide.markSeen(id, 'gossip') too: npc/talk.js).
    this.npcs.load(this.eco);   // the people of this site (src/npc/): built with the angler so the shader warm-up covers them
    this.shoals.onSeen = (id, src) => { if (G.markSeen(this.progress, id, src)) { this.persist(); this.toast('📗 You spotted a kind of fish you have not seen before. Check the Fish Guide (J) for where and when to find it.', 'good'); } };
  }
  /** Test and console hook: game.setAppearance({ skin, hairStyle, hatStyle, ... }) dresses the angler and saves it with the current name. */
  setAppearance(a) { const look = this.angler.setAppearance(a); this.progress.angler = { ...(this.progress.angler ?? {}), name: this.progress.angler?.name ?? '', ...look }; this.persist(); return look; }
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
    this.setKeys([['WASD', 'walk'], ['Shift', 'run'], ['Drag / Z / C', 'look around'], ['F / G', 'tilt'], ['V', 'view'], ['Wheel', 'zoom'], ['R', 'rod'], ['T', 'tackle'], ['Space', 'cast / work lure / strike'], ...(this.eco.toggleAnchor ? [['B', 'anchor']] : []), ['E', 'talk'], ['Q', 'quests'], ['M', 'map'], ['J', 'fish guide'], ['L', 'logbook'], ['H', 'head home'], ['P', 'pause']]);
    this.outing.start();
    if (this.pendingTrip && this.progress.outing) { this.progress.outing.trip = this.pendingTrip.text; this.persist(); this.pendingTrip = null; }
    this.updateStats(); this.updateMissionHud();
    this.toast(L.intro);
    this.eco.onStart?.(this);   // a site's opening card (the river's freshwater licence note)
    // A tag recapture letter, now and then, from a fish you tagged on an earlier day.
    const letter = recaptureLetter(this.progress);
    if (letter) { this.persist(); this.updateStats(); setTimeout(() => { if (this.mode === 'land' && !this.panels.isOpen && !this.dialogue.isOpen) showRecaptureLetter(this, letter); }, 2500); }
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
    this.eco.tick?.(this, paused ? 0 : dt);   // a site with moving parts (the offshore reef's drifting boat and fish finder)
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
    if (this.frame % 30 === 0) this.missionPump();
    if (f.active) {
      if (!paused) f.update(dt, this.time, this.input, this.world);
      const talk = !paused && ['ready', 'wait'].includes(f.state) ? this.npcs.promptText() : '';
      if (talk) $('#prompt').innerHTML += '<br>' + this.hint(talk);
    }
    else {
      const hz = this.eco.land.home, near = hz && Math.hypot(w.pos.x - hz.x, w.pos.z - hz.z) < hz.r;
      const talk = !paused ? this.npcs.promptText() : '';
      $('#prompt').innerHTML = this.hint([talk, near && !paused ? `Press <kbd>H</kbd> to head home from ${hz.label}` : ''].filter(Boolean).join('<br>')); w.frozen = false;
    }
    // Camera: follows the angler, frames the float too while a line is out.
    const also = f.active && f.float.visible && ['wait', 'retrieve', 'bite', 'fight', 'flying'].includes(f.state) ? f.float.position : null;
    this.rig.update(dt, this.world, w.pos, also, !paused, { fight: f.active && f.state === 'fight', line: f.lineDir, heading: w.heading });
    this.focus.copy(this.rig.focus);
    // The angler: stand, walk and fish.
    const a = this.angler;
    a.place(w.pos, w.heading);
    const lineOut = f.active && ['flying', 'wait', 'retrieve', 'bite', 'fight', 'landed'].includes(f.state);   // feet planted while a line is out: no walk cycle
    a.update(dt, this.time, { speed: lineOut ? 0 : w.speed, state: f.active ? f.state : 'off', power: f.power, act: f.act, reel: (f.state === 'fight' || f.state === 'retrieve') && f.reel, fightT: f.fightT, side: lineOut ? f.side : 0, look: lineOut ? f.lookAt() : null, reducedMotion: this.settings.reducedMotion });
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
  biteContext(target) {
    const gs = this.gearStats(), colour = this.progress.inventory?.lure ?? 'pink', t = target ?? this.walker.pos;
    return this.cond.context(this.gear, (spot, id) => this.progress.stock?.[`${spot}:${id}`], { shy: gs.shy, lureMod: lureMod(colour, this.cond.clarity, this.cond.time), lit: this.eco.litAt?.(t.x, t.z) ?? 0,
      depth: this.eco.depthAt?.(t.x, t.z), arch: this.eco.archAt?.(t.x, t.z, this.eco.state?.t ?? this.time)?.id });   // the reef: how deep the bait is (barotrauma) and the fish finder's mark under it
  }
  /** What your rod, line and tools do (economy/store.js): the catch bar and the bite model read these, nothing is hard-coded in fishing.js. */
  gearStats() { return gearStats(this.progress); }
  /** A fish takes a bait: one is used up. Returns how many are left (lures use none). */
  useBait() {
    if (RIGS[this.gear.rig].lure) return Infinity;
    const id = this.gear.bait, n = useBait(this.progress, id);
    if (n <= 0) {
      const next = Object.keys(BAITS).find(b => baitUnlocked(this.progress, b) && baitCount(this.progress, b) > 0);
      if (next) { this.gear.bait = this.lastBait = next; this.toast(`That was your last ${BAITS[id].name.toLowerCase()}. Switched to ${BAITS[next].name.toLowerCase()}. Buy more at Mitra's shop, or collect your own.`, 'warn'); }
      else this.toast(`That was your last ${BAITS[id].name.toLowerCase()}. Buy bait at Mitra's shop or collect your own (tackle box, T), or switch to a lure.`, 'warn');
      this.saveGear();
    } else this.persist();
    this.updateChip();
    return n;
  }
  /** Can you cast with the bait in your box? (A rig with bait and none left stays on the bank.) */
  baitReady() { return RIGS[this.gear.rig].lure || baitCount(this.progress, this.gear.bait) > 0; }
  /** Credits just paid: save, refresh the HUD chip and give it a little pulse. The payment itself is in economy/coins.js (only listed sources can pay). */
  earned(amount) {
    this.persist(); this.updateStats();
    if (amount > 0) { const el = $('#stat-chip'); el?.classList.remove('pulse'); void el?.offsetWidth; el?.classList.add('pulse'); this.audio.play('newSpecies'); }
  }
  /** The tackle shop (Mitra's bait hut, or her talk menu). Resolves when the panel closes. */
  openShop(opts = {}) { return new Promise(res => openShop(this, { ...opts, onClose: res })); }
  /** Small HUD chip: tide, time, season, swell, and the rig and bait in the tackle box. */
  updateChip() {
    const chip = $('#cond-chip');
    if (!chip) return;
    const r = RIGS[this.gear.rig], b = RIGS[this.gear.rig].lure ? '' : ` + ${BAITS[this.gear.bait]?.name ?? 'no bait'}`;
    const html = `<b>${this.cond.chip()}${this.eco.chipExtra?.(this) ?? ''}</b><span>Tackle: ${r.name}${b}</span>`;
    if (chip.dataset.v !== html) { chip.dataset.v = html; chip.innerHTML = html; }
  }
  /** T: open the tackle box (rig and bait). Not while a fish is on. */
  tackleBox() {
    if (!this.fishing.canChangeGear) { this.toast('Land or lose this fish first, then change your tackle.', 'warn'); return; }
    const render = () => {
      this.panels.body.innerHTML = tackleBoxHTML(this.gear, this.progress, this.eco.id, this.cond);
      const lockedMsg = (kind, id, name) => { this.panels.body.querySelector(kind === 'rig' ? '#tb-desc' : '#tb-note').innerHTML = `🔒 <b>${esc(name)}</b> is locked. ${esc(lockHint(this.progress, kind, id))}.`; };
      for (const b of this.panels.body.querySelectorAll('.tb-lurecol')) b.onclick = () => { this.progress.inventory.lure = b.dataset.lure; this.persist(); render(); };
      for (const b of this.panels.body.querySelectorAll('.tb-rig')) b.onclick = () => {
        if (!rigUnlocked(this.progress, b.dataset.rig)) { lockedMsg('rig', b.dataset.rig, RIGS[b.dataset.rig].name); return; }
        this.gear.rig = b.dataset.rig;
        if (RIGS[this.gear.rig].lure) this.gear.bait = 'none';
        else if (!BAITS[this.gear.bait]) this.gear.bait = this.lastBait ?? 'prawn';
        this.saveGear(); render(); this.panels.body.querySelector(`.tb-rig[data-rig="${this.gear.rig}"]`)?.focus({ preventScroll: true });
      };
      for (const b of this.panels.body.querySelectorAll('[data-collect]')) b.onclick = () => {
        const id = b.dataset.collect, r = collect(this.progress, id, this.eco.id);
        if (r.ok) { this.persist(); this.toast(`Collected ${r.added} ${BAITS[id].name.toLowerCase()}${r.limit ? ` (${r.got} of ${r.limit} today)` : ''}.`, 'good'); }
        render(); this.panels.body.querySelector(`[data-collect="${id}"]`)?.focus({ preventScroll: true });
      };
      for (const b of this.panels.body.querySelectorAll('.tb-bait:not(.tb-lurecol)')) b.onclick = () => {
        if (!baitUnlocked(this.progress, b.dataset.bait)) { lockedMsg('bait', b.dataset.bait, BAITS[b.dataset.bait].name); return; }
        if (baitCount(this.progress, b.dataset.bait) <= 0) { this.panels.body.querySelector('#tb-note').innerHTML = `You have no ${esc(BAITS[b.dataset.bait].name.toLowerCase())} left. ${COLLECT[b.dataset.bait] ? 'Collect some below (free, inside the daily limit)' : 'Buy more at Mitra\'s shop'}.`; return; }
        this.gear.bait = this.lastBait = b.dataset.bait; this.saveGear(); render(); this.panels.body.querySelector(`.tb-bait[data-bait="${this.gear.bait}"]`)?.focus({ preventScroll: true }); };
      this.panels.body.querySelector('#tb-done').onclick = () => this.panels.close();
    };
    this.tackleOpen = true;
    this.panels.open(tackleBoxHTML(this.gear, this.progress, this.eco.id, this.cond), () => { this.tackleOpen = false; this.toast(`Tackle set: ${RIGS[this.gear.rig].name}${RIGS[this.gear.rig].lure ? '' : ' + ' + (BAITS[this.gear.bait]?.name ?? 'no bait')}. It applies to your next cast.`); });
    render();
  }
  saveGear() { this.progress.gear = { ...this.gear }; this.persist(); }
  /** The catch bar's zone touched a piece of litter. */
  onLitter(kind) {
    const st = this.progress.steward ??= { points: 0, litter: 0 };
    st.points++; st.litter++; this.persist();
    this.audio.play('correct');
    this.toast(kind === 'line'
      ? `Tangled line collected! Lost fishing line traps and drowns birds, turtles and fish. Steward points: ${st.points}. Fatima's clean-up tally pays credits for litter.`
      : `Plastic bag collected! Turtles mistake bags for jellyfish and eat them. Steward points: ${st.points}. Fatima's clean-up tally pays credits for litter.`, 'good');
  }
  /** A fish is in your hands: identify it (key), measure it (brag mat), decide keep or release, write it to the logbook (ui/catchFlow.js). */
  onFishLanded(c, spot, done) {
    this.catchFlow.run(c, spot, done);
  }
  /**
   * A squid or cuttlefish squirts ink as it is landed: dark splotches splash across the screen (and fade), and ink spots the deck round the angler's feet
   * (a flat decal that fades over about 40 s). Cephalopods ink to escape a predator, which is why the splash is a quick burst.
   */
  inkSplash(pos) {
    const el = document.getElementById('ink-splash') ?? (() => { const d = document.createElement('div'); d.id = 'ink-splash'; d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d); return d; })();
    // Each splotch is a ragged star-shaped splat (a random polygon with a few long drips) plus a sprinkle of small round droplets.
    const splat = () => {   // an organic splat: a lumpy round body (two sine waves) with three or four long drips
      const n = 44, p1 = Math.random() * 6.28, p2 = Math.random() * 6.28, drips = Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => Math.random() * 6.28), pts = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 6.2832; let r = 0.56 + 0.1 * Math.sin(3 * a + p1) + 0.06 * Math.sin(7 * a + p2);
        for (const d of drips) { const da = Math.abs(((a - d + Math.PI) % 6.2832 + 6.2832) % 6.2832 - Math.PI); r += 0.34 * Math.exp(-(da * da) / 0.012); }
        pts.push(`${(50 + Math.cos(a) * r * 50).toFixed(1)}% ${(50 + Math.sin(a) * r * 50).toFixed(1)}%`);
      }
      return `polygon(${pts.join(',')})`;
    };
    const blobs = Array.from({ length: 6 }, () => { const s = 130 + Math.random() * 270, x = 8 + Math.random() * 84, y = 8 + Math.random() * 84; return `<i style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;clip-path:${splat()};transform:translate(-50%,-50%) rotate(${Math.random() * 360}deg)"></i>`; });
    const drops = Array.from({ length: 22 }, () => { const s = 6 + Math.random() * 26, x = Math.random() * 100, y = Math.random() * 100; return `<i class="d" style="left:${x}%;top:${y}%;width:${s}px;height:${s * (0.8 + Math.random() * 0.5)}px"></i>`; });
    el.innerHTML = blobs.concat(drops).join('');
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.inkT); this.inkT = setTimeout(() => el.classList.remove('show'), 2800);
    // the deck (or the ground): a flat splat of ink under and around the angler
    this.inkDecals ??= [];
    if (!this.inkTex) {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      g.fillStyle = 'rgba(38,22,62,0.92)';
      for (let i = 0; i < 26; i++) { const a = Math.random() * 6.283, r = Math.pow(Math.random(), 0.7) * 100, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r, s = 4 + Math.random() * (28 - r * 0.18); g.beginPath(); g.ellipse(x, y, s, s * (0.5 + Math.random() * 0.5), Math.random() * 3, 0, 6.283); g.fill(); }
      g.beginPath(); g.ellipse(128, 128, 36, 28, 0.4, 0, 6.283); g.fill();
      this.inkTex = new THREE.CanvasTexture(c); this.inkTex.colorSpace = THREE.SRGBColorSpace;
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.inkTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false }));
    m.position.set(pos.x, this.world.walkAt(pos.x, pos.z) + 0.045, pos.z); m.rotation.y = Math.random() * 6.28; m.renderOrder = 3;
    this.scene.add(m); this.inkDecals.push({ m, age: 0 });
    while (this.inkDecals.length > 4) { const d = this.inkDecals.shift(); this.scene.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); }
  }
  updateInk(dt) {
    for (const d of this.inkDecals ?? []) { d.age += dt; d.m.material.opacity = Math.max(0, 1 - Math.max(0, d.age - 20) / 25); d.m.visible = d.m.material.opacity > 0.01; }
  }
  /** HUD chips: the esky and the Steward rating. */
  updateStats() {
    this.missionsDirty = true;
    const p = this.progress, esky = p.esky ?? [], bad = esky.filter(x => !x.legal).length, st = G.stewardRating(p);
    const el = $('#stat-chip');
    if (!el) return;
    const html = `<b>🧊 Esky ${esky.length}${bad ? ` <i class="bad">⚠ ${bad} illegal</i>` : ''} <span class="coin" title="${COIN.name}">${COIN.icon} ${p.coins ?? 0}</span></b><span>Steward ${G.starsText(st.value)} ${st.value.toFixed(1)}</span>`;
    if (el.dataset.v !== html) { el.dataset.v = html; el.innerHTML = html; el.classList.toggle('has-bad', bad > 0); }
  }
  // ------------------------------------------------------------------ missions (npc/missions.js): the HUD line and the radio hand-ins
  /** The one HUD line under the chips: the pinned request, else the current mission's next step. Written only when the text changes. */
  updateMissionHud() {
    const el = $('#mission-btn');
    if (!el) return;
    const h = hudInfo(this.progress), key = (h.pinned ? 'P' : 'M') + h.text;
    if (el.dataset.v === key) return;
    el.dataset.v = key;
    el.classList.toggle('hidden', !h.text); el.classList.toggle('pinned', h.pinned);
    el.querySelector('.m-text').textContent = h.text; el.querySelector('.m-ico').textContent = h.pinned ? '📌' : '🎯';
    el.title = h.text; el.setAttribute('aria-label', `${h.pinned ? 'Your pinned request' : 'Your mission'}: ${h.text}. Tap to open the quest log`);
  }
  /** Is it a quiet moment for a radio call? On land with the rod put away or ready (not casting, waiting, on a bite or fighting), and nothing open. */
  missionSafe() {
    return this.mode === 'land' && !this.loading && !this.panels.isOpen && !this.dialogue.isOpen && !this.creatorOpen && ['ready', 'off'].includes(this.fishing.state) && this.time - this.modeSince > 2.5;
  }
  /** About twice a second (and only if something changed): finish any missions the player has just completed, refresh the HUD line, and play queued radio calls when it is safe. */
  missionPump() {
    const p = this.progress;
    if (this.missionsDirty) {
      this.missionsDirty = false;
      const done = advanceMissions(p);
      if (done.length) { this.persist(); this.missionsDirty = false; this.missionQueue.push(...done); }
      this.updateMissionHud();
    }
    if (this.radioBusy || !this.missionSafe()) return;
    if (this.missionQueue.length) this.playRadio(this.missionQueue.shift());
    else if (helloDue(p, this.eco.id)) this.playHello();
  }
  /** The voice for a radio call: a teacher's SVG bust, or one of the coast's people with their rendered portrait. */
  radioWho(id) { const s = speakerOf(id); return s.npc ? { ...(this.npcs?.whoOf(s.npc) ?? {}), name: s.name, role: s.role } : s; }
  /** A finished mission's radio lines (its hat was given when it was marked done; this only tells the player). */
  async playRadio(m) {
    this.radioBusy = true;
    try {
      const dlg = this.dialogue, lines = radioLines(m, esc(nameOf(this.progress)));
      this.audio.play('missionDone');
      for (let i = 0; i < lines.length; i++) await dlg.say({ who: this.radioWho(lines[i].who), text: this.hint(lines[i].text), button: i === lines.length - 1 ? 'Thanks!' : 'Continue' });
      dlg.hide();
      this.toast(`🧢 Mission done: ${m.title}. New hat: ${ITEMS[m.reward]?.name}. Wear it from the quest log (Q).`, 'good');
    } finally { this.radioBusy = false; this.missionsDirty = true; }
  }
  /** The one welcome call for a save that played before missions existed. */
  async playHello() {
    this.radioBusy = true; markHello(this.progress); this.persist();
    try {
      const dlg = this.dialogue;
      await dlg.say({ who: this.radioWho('mrcisneros'), text: this.hint(HELLO_LINE.replaceAll('{name}', esc(nameOf(this.progress)))), button: 'Thanks!' });
      dlg.hide();
    } finally { this.radioBusy = false; }
  }
  persist() { this.missionsDirty = true; if (this.noSave) return; if (!saveProgress(this.progress)) this.toast('Storage is full — some old pictures were not saved.', 'warn'); }
  download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  /** The logbook as a CSV file. */
  exportCSV() { this.download('tideline-logbook.csv', logbookCSV(this.progress, k => SPOT_INFO[k]?.label ?? k)); }
  exportGuideCSV() { this.download('tideline-fish-guide.csv', guideCSV(this.progress, guideRows)); }

  // ------------------------------------------------------------------ feedback
  toast(text, kind = '') {
    const box = $('#toast');
    const now = performance.now();
    if (this.lastToast === text && now - this.lastToastT < 4000) return; // no duplicate spam
    this.lastToast = text; this.lastToastT = now;
    const el = document.createElement('div');
    el.className = `toast ${kind}`; el.textContent = this.hint(text);
    for (const old of box.children) if (old.textContent === el.textContent) return;   // the same message is still on screen (a long one lives longer than the 4 s window): never stack it twice
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
    const paused = this.panels.isOpen || this.dialogue.isOpen || this.creatorOpen;
    this.input.gameplay = !paused && this.mode === 'land';
    if (document.body.dataset.mode !== this.mode) document.body.dataset.mode = this.mode;   // CSS hooks (the ceremony hides the HUD and shrinks the name tags)
    if (this.mode === 'menu') this.updateMenu(dt);
    else if (this.mode === 'land') this.updateLand(dt, paused);
    else if (this.mode === 'ceremony') updateCeremony(this, dt);
    if (this.world.land) this.world.land.update(dt, this.mode === 'land' ? this.walker : null);
    // Life keeps moving even with panels open.
    if (this.world.life && this.frame % 2 === 0) this.world.life.update(dt * 2, null);
    const cam = this.camera.position;
    const surfaceY = this.world.surfaceAt(cam.x, cam.z);
    const depth = surfaceY - cam.y;
    if (this.env.daylightOn) this.env.setDaylight(this.cond.hour);   // dusk glow, the dark-blue night and the wharf lamps (ocean/daylight.js)
    this.env.update(dt, this.camera, depth, this.mode === 'land' ? this.focus : null);
    globalUniforms.uPlayer.value.set(this.walker.pos.x, this.mode === 'land' ? this.walker.pos.y : -999, this.walker.pos.z);
    this.world.props?.update(dt, this.time);
    this.npcs.update(dt, this.time);
    this.world.harbour?.update(dt, this.time, this.cond);
    this.updateInk(dt);
    this.shoals?.update(dt, this.time, this.world, this.mode === 'land' ? this.walker : null, this.eco, this.cond.time);
    this.prints?.update(dt, this.mode === 'land' ? this.walker : null, this.eco.rockAt);
    this.world.ocean.update(this.camera, depth > 0);
    this.world.reef?.cull(cam, depth > 0 ? 2.6 / this.env.fogDensityBelow + 4 : 150, depth > 0 ? 0.9 / this.env.fogDensityBelow : 40);
    this.world.sky.update(this.camera);
    this.fx.update(dt, this.camera, 0);
    this.listener.position.copy(this.mode === 'land' ? this.walker.pos : cam);
    this.audio.update(dt, { mode: this.mode, depth, camera: this.listener, roar: 0, life: this.world.life, eco: this.eco, reefHealth: 1, time: this.cond.time, dialogue: this.dialogue.isOpen, fight: this.fishing?.state === 'fight', panel: this.panels.isOpen });
    $('#fx-uw').style.opacity = depth > 0 ? 1 : 0;
    { const el = $('#fx-sunset'), v = this.env.daylightOn ? Math.min(1, this.env.glow * (1 - this.env.night * 0.5)) * 0.95 : 0; if (el && Math.abs((this.sunV ?? -1) - v) > 0.01) { this.sunV = v; el.style.opacity = v.toFixed(2); } }   // the sunset wash
    this.touch?.update();
    this.mini?.update(dt);
    if (skipRender || this.creatorOpen) { this.input.endFrame(); return; }   // the creator covers the whole screen: no need to draw the world behind it
    if (this.gradePass) {
      // ShaderPass copies its uniforms, so feed it the live fog and underwater state each frame.
      const u = this.gradePass.material.uniforms;
      u.uFogDensity.value = globalUniforms.uFogDensity.value; u.uUnder.value = globalUniforms.uUnderwater.value;
    }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  /** Title screen backdrop: the same high camera, slowly swinging round the angler at the water's edge (eco.menuCam: { yaw, swing, pitch, dist, lift }). */
  updateMenu(dt) {
    this.menuT += dt;
    const m = { yaw: 0, swing: 0.35, pitch: 0.78, dist: 17, lift: 0, ...this.eco.menuCam };
    const rig = this.rig, p = this.walker.pos;
    rig.yaw = m.yaw + Math.sin(this.menuT * 0.07) * m.swing; rig.pitch = m.pitch; rig.dist = rig.zoom = m.dist;
    rig.focus.set(p.x, p.y + 0.9 + m.lift, p.z);
    rig.apply(this.world, 0, true);
    this.focus.copy(rig.focus);
    // Slide the picture so the angler sits to the right of the title panel (above it on a portrait phone).
    const w = innerWidth, h = innerHeight, wide = w > h * 1.1;
    this.camera.setViewOffset(w, h, wide ? -w * 0.2 : 0, wide ? 0 : h * 0.2, w, h); this.viewOffset = true;
    this.eco.tick?.(this, 0);
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
