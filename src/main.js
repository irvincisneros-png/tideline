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
import { Pad } from './core/gamepad.js';
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
import { collectLostLine, SNAG_TEXT } from './fishing/snags.js';
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
import { Intro, introDue, bevCallDue, markBevCall, bevLines } from './ui/intro.js';
import { ensureMissions, advanceMissions, hudInfo, radioLines, speakerOf, helloDue, markHello, HELLO_LINE } from './npc/missions.js';
import { ITEMS } from './content/items.js';
import { openKnot, openKnotsList } from './ui/knotUI.js';
import { canPromptRetie, markRetie, chooseMode, knotsMode, SPARE_TOAST } from './fishing/knots.js';

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
    this.intro = new Intro(this);
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
    // A new save (or one part-way through the teachers' opening) starts on Lake Illawarra, where the school's corner is; ?eco= always wins.
    this.eco = ecoById(params.get('eco')) ?? (introDue(this.progress, params) ? ecoById('seagrass') : null) ?? ECOSYSTEMS[0];
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
    this.pad = new Pad(this); this.padOn = false;   // a controller, if one is plugged in (core/gamepad.js)
    this.mini = new MiniMap(this);   // the optional corner minimap (Settings)
  }

  setupComposer() {
    // Every tier gets the colour grade (it is the cosy look); bloom and the screen-space ink outline are for high and ultra.
    if (!this.stylised && !this.quality.bloom) { this.composer = null; return; }
    const outline = this.stylised && this.quality.bloom;
    // The composer renders into its own target: give it MSAA, otherwise the antialiased tiers lose antialiasing entirely.
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.quality.antialias ? 4 : 0 });
    if (outline) rt.depthTexture = new THREE.DepthTexture(1, 1); // read by the outline pass
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.quality.bloom) { this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.42, 0.7, 0.8); this.composer.addPass(this.bloom); }
    if (this.stylised) {
      // Ink outlines where depth jumps (silhouettes), then the grade: richer colour, a gentle contrast curve, warm highlights over cool shadows,
      // a warm glow spilling in from the sun's side of the screen, and a soft vignette.
      this.gradePass = new ShaderPass({
        uniforms: { tDiffuse: { value: null }, tDepth: { value: rt.depthTexture ?? null }, uRes: { value: new THREE.Vector2(1, 1) }, cameraNear: { value: this.camera.near }, cameraFar: { value: this.camera.far }, uUnder: { value: 0 }, uFogDensity: { value: 0.03 },
          uSun: { value: new THREE.Vector2(0.5, 1.2) }, uSunAmt: { value: 0 }, uSunCol: { value: new THREE.Color(1, 0.8, 0.55) }, uWarm: { value: 0 }, uNightK: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        defines: { OUTLINE: outline ? '0.7' : '0.0', HAS_DEPTH: outline ? 1 : 0 }, // thin ink outlines on silhouettes (0 = off)
        fragmentShader: `#include <packing>
          uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 uRes; uniform float cameraNear; uniform float cameraFar; uniform float uUnder; uniform float uFogDensity;
          uniform vec2 uSun; uniform float uSunAmt; uniform vec3 uSunCol; uniform float uWarm; uniform float uNightK; varying vec2 vUv;
          float vz(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
          void main(){
            vec3 c = texture2D(tDiffuse, vUv).rgb;
            #if HAS_DEPTH
            vec2 px = 1.0 / uRes;
            float z = vz(vUv), zl = vz(vUv - vec2(px.x, 0.0)), zr = vz(vUv + vec2(px.x, 0.0)), zd = vz(vUv - vec2(0.0, px.y)), zu = vz(vUv + vec2(0.0, px.y));
            // Second difference ignores smooth slopes (ground at grazing angles) and catches real silhouettes.
            float lap = abs(zl + zr + zd + zu - 4.0 * z) / max(z, 0.1);
            // Fade outlines with the same fog that hides the object, so nothing fogged-out leaves a ghost line.
            float vis = uUnder > 0.5 ? exp(-pow(uFogDensity * z * 1.6, 2.0)) : 1.0 - smoothstep(25.0, 70.0, z);
            float edge = smoothstep(0.09, 0.18, lap) * vis;
            c = mix(c, c * vec3(0.22, 0.36, 0.42), edge * OUTLINE); // dark teal, not black
            #endif
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(l), c, 1.3);                                        // richer colour
            float air = 1.0 - uUnder;
            c = mix(c, pow(max(c, 0.0) / 0.22, vec3(1.14)) * 0.22, air);       // contrast about mid grey: deeper shade, brighter sunlit sand (the flat, hazy look was the lack of this)
            l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            // Split tone: cool blue-teal shadows, warm cream highlights (warmer still in the golden hours); moonlight stays blue.
            vec3 hiT = mix(vec3(1.05, 1.0, 0.93), vec3(1.07, 1.0, 0.9), uWarm);
            c *= mix(vec3(0.9, 0.99, 1.08), mix(hiT, vec3(1.0), uNightK), smoothstep(0.03, 0.65, l));
            // Sun glow: warm light spilling across the frame from wherever the sun is (even just off screen), strongest when it is low.
            vec2 sd = (vUv - uSun) * vec2(uRes.x / uRes.y, 1.0);
            float sg = exp(-dot(sd, sd) * 1.1) * uSunAmt * air;
            c += uSunCol * sg * (0.1 + 0.3 * l);
            c = mix(c, c * uSunCol * 1.25, sg * 0.12);
            vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.6;
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
    else if (params.has('play')) { if (params.has('creator') && !this.progress.angler) this.creator.open({ first: true, onDone: () => this.enterLand() }); else this.enterLand(); }
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
    $('#menu-btn').onclick = () => this.pauseMenu();
    $('#mission-btn').onclick = () => this.questLog();
    this.updateEcoBlurb();
    this.updateProgressSummary();
  }
  /** The site picker: a card per site with its Fish Guide counter; a locked site shows what it needs ("Identify 5 species, 3 of 5"). */
  ecoCardsHTML() {
    const rc = Object.fromEntries(G.regionCounts(this.progress).map(c => [c.key, c])), regionOf = REGION_OF;
    return ECOSYSTEMS.map(e => {
      const c = rc[regionOf[e.id]], lock = siteLock(this.progress, e);
      const chip = lock.locked ? `🔒 ${lock.detail}` : c ? `${c.label} ${c.done}/${c.total}` : '';
      return `<button class="eco-card ${e.id === this.eco.id ? 'sel' : ''} ${lock.locked ? 'locked' : ''}" data-id="${e.id}" ${lock.locked ? 'aria-disabled="true"' : ''}>
      <b>${esc(e.name)}</b><small>${esc(e.place)}</small>${chip ? `<span class="chip">${esc(chip)}</span>` : ''}</button>`;
    }).join('');
  }
  /** One line under the site cards about the chosen site (the cards themselves stay small: a name, a place, a counter). */
  updateEcoBlurb() { const el = $('#eco-blurb'); if (el) el.textContent = this.eco.blurb ?? ''; }
  /** Start fishing: the first time (or on an older save with no angler yet) the character creator opens first. */
  beginPlay() {
    const go = async () => {
      // A due opening is on the lake (the school's corner): a new save that picked another site is moved there first. ?eco= keeps the site it names.
      if (introDue(this.progress, params) && this.eco.id !== 'seagrass' && !params.has('eco')) await this.loadSite('seagrass');
      if (!this.progress.angler) this.creator.open({ first: true, onDone: () => this.enterLand() }); else this.enterLand();
    };
    // A site you reach by boat (the offshore reef) starts with the safety beat (lifejacket, trip log) and the run out of the harbour; a ?play deep link skips it.
    if (this.eco.travel && !params.has('play')) runBoatTrip(this).then(trip => { if (trip) { this.pendingTrip = trip; go(); } });
    else go();
  }
  /** Walk onto the shore. A new save (or one part-way through) gets the teachers' opening (ui/intro.js): once, never on a save with catches; a ?play link only with ?intro=1 (?firstrun=1 is an alias). */
  enterLand() {
    this.startLand(null);
    if (introDue(this.progress, params)) this.intro.begin();
  }
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
    this.intro?.abort();   // a half-finished opening is saved at its step: Continue resumes it
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
    // Clicking away to another window pauses, so a wind-up does not cast itself and a fish is not lost while you are not looking.
    addEventListener('blur', () => { if (this.mode === 'land' && this.input.gameplay && !this.loading) this.pauseMenu(); });
    addEventListener('keydown', e => {
      if (e.repeat) return;   // a held key is one press (R would flick the rod in and out, T and M would flap their panels)
      if (e.code === 'KeyT' && this.tackleOpen && this.panels.isOpen) { this.panels.close(); return; }
      if (e.code === 'KeyM' && this.mapOpen && this.panels.isOpen) { this.panels.close(); return; }   // M opens and closes the map
      if (this.panels.isOpen || this.dialogue.isOpen || this.creatorOpen || this.mode !== 'land') return;
      const c = e.code;
      if (c === 'KeyE' && this.intro?.refuse(c)) return;   // the opening switches a few keys off (ui/intro.js lockReason); R, T, M and H check themselves below
      if (c === 'KeyP' || (c === 'Escape' && !e.defaultPrevented)) this.pauseMenu();   // (an Escape that just closed a panel or a dialogue was already handled)
      if (c === 'KeyR' && this.eco.fishing) this.toggleRod();
      if (c === 'KeyT' && this.eco.fishing) this.tackleBox();
      if (c === 'KeyJ') this.openGuide();
      if (c === 'KeyM') this.openMap();
      if (c === 'KeyL') openLogbook(this);
      if (c === 'KeyH') this.askHome();
      if (c === 'KeyE') this.npcs.talkNearest();
      if (c === 'KeyB' && this.eco.toggleAnchor) this.eco.toggleAnchor(this);
      if (c === 'KeyQ') this.questLog();
      if (c === 'KeyV') this.cycleView();
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
  openMap(tab = 'site') { if (this.intro?.refuse('KeyM')) return; if (this.fishing.state === 'snagged') { this.toast('Free your line first, then open the map.', 'warn'); return; } openMap(this, tab); }
  /** The button hints, bottom right: only what matters this second (walking, rod out, line out). The full list is in the pause menu. Written only when it changes. */
  setKeys(list) {
    const html = list.map(([k, v, pre]) => `<span>${pre ? `${pre} ` : ''}<kbd>${k}</kbd> ${v}</span>`).join('');
    const out = this.hint(html), el = $('#keys');
    if (el.dataset.v !== out) { el.dataset.v = out; el.innerHTML = out; }
  }
  hudHints() {
    const f = this.fishing, s = f.active ? f.state : 'off';
    if (s === 'off') return [...(this.movedFar ? [] : [['WASD', 'Move'], ['Drag', 'Look']]), ...(this.nearHome ? [['H', 'Head home']] : []), ...(this.eco.fishing ? [['R', 'Rod']] : []), ['M', 'Map'], ['Esc', 'Menu']];
    if (s === 'ready') return [['Space', 'Cast', 'Hold'], ['T', 'Tackle'], ['R', 'Put away']];
    if (s === 'wait') return [['Space', 'Draw in', 'Hold'], ['Space', 'Wind in', 'Tap']];
    if (s === 'retrieve') return [['Space', 'Twitch', 'Tap'], ['Space', 'Reel', 'Hold']];
    return [];
  }
  /** The pause menu (Esc, P, the menu button, Start on a controller): everything that is not on the HUD lives here. */
  pauseMenu() {
    if (this.mode !== 'land' || this.panels.isOpen || this.dialogue.isOpen || this.creatorOpen) return;
    const p = this.progress, st = G.stewardRating(p), esky = p.esky ?? [], fishing = this.eco.fishing, ready = document.body.classList.contains('quest-ready');
    const tile = (id, ico, label, key, cls = '') => `<button class="pm-tile ${cls}" id="${id}"><i aria-hidden="true">${ico}</i><b>${label}</b>${key ? `<kbd>${key}</kbd>` : ''}</button>`;
    const dev = this.padOn ? 'pad' : this.touch ? 'touch' : 'keys';
    const rows = {
      keys: [['WASD', 'Walk'], ['Shift', 'Run'], ['Drag', 'Look around'], ['Wheel', 'Zoom'], ['Z / C', 'Turn the view'], ['F / G', 'Tilt the view'], ['R', 'Rod out / away'], ['Space', 'Cast, strike, reel'], ['E', 'Talk'], ...(this.eco.toggleAnchor ? [['B', 'Anchor']] : [])],
      pad: [['L stick', 'Walk (push far to run)'], ['R stick', 'Look around'], [{ nintendo: 'ZL / ZR', playstation: 'L2 / R2' }[this.pad.family] ?? 'LT / RT', 'Zoom'], [this.pad.name('rod'), 'Rod out / away'], [this.pad.name('ok'), 'Cast, strike, reel, talk'], [this.pad.name('tackle'), 'Tackle box'], [this.pad.name('back'), 'Back / put the rod away'], ['L / R', 'Quests / camera view'], ['D-pad', '↑ Guide  ↓ Logbook  ← Home' + (this.eco.toggleAnchor ? '  → Anchor' : '')], ['− / +', 'Map / this menu']],
      touch: [['Joystick', 'Walk (push to the edge to run)'], ['Drag', 'Look around'], ['Pinch', 'Zoom'], ['🎣', 'Rod out / away'], ['CAST', 'Cast, strike, reel'], ['💬', 'Talk']],
    }[dev];
    this.panels.open(`<div class="pm">
      <header class="pm-head"><h2>Paused</h2><p>${esc(this.eco.name)} · ${esc(this.eco.place)}</p></header>
      <div class="pm-stats"><span>${esc(this.cond.chip())}${esc(this.eco.chipExtra?.(this) ?? '')}</span><span>🧊 Esky ${esky.length}</span><span class="coin">${COIN.icon} ${p.coins ?? 0}</span><span>Steward ${G.starsText(st.value)} ${st.value.toFixed(1)}</span></div>
      <div class="pm-grid">
        ${tile('p-resume', '▶', 'Resume', 'Esc', 'primary')}
        ${tile('p-map', '🗺', 'Map', 'M')}
        ${tile('p-quests', '📜', 'Quests', 'Q', ready ? 'dot' : '')}
        ${tile('p-guide', '📗', 'Fish Guide', 'J')}
        ${tile('p-log', '📒', 'Logbook', 'L')}
        ${fishing ? tile('p-tackle', '🧰', 'Tackle box', 'T') : ''}
        ${tile('p-view', '🎥', 'Camera view', 'V')}
        ${tile('p-home', '🏠', 'Head home', 'H')}
      </div>
      <div class="pm-controls" aria-label="Controls">${rows.map(([k, v]) => `<span><kbd>${k}</kbd> ${v}</span>`).join('')}</div>
      <p class="pm-foot"><button class="btn small" id="p-help">How to play</button> <button class="btn small" id="p-set">Settings</button> <button class="btn small ghost" id="p-quit">Quit to title</button></p>
    </div>`);
    const away = fn => () => { this.panels.close(); fn(); };
    $('#p-resume').onclick = () => this.panels.close();
    $('#p-map').onclick = () => this.openMap();
    $('#p-quests').onclick = () => this.questLog();
    $('#p-guide').onclick = () => this.openGuide();
    $('#p-log').onclick = () => openLogbook(this);
    if (fishing) $('#p-tackle').onclick = away(() => this.tackleBox());
    $('#p-view').onclick = away(() => this.cycleView());
    $('#p-home').onclick = away(() => this.askHome());
    $('#p-help').onclick = () => this.panels.help();
    $('#p-set').onclick = () => this.openSettings();
    $('#p-quit').onclick = () => { this.panels.onClose = null; this.panels.close(); this.enterMenu(); };
  }
  openSettings() {
    this.panels.settings(this.settings, (k, v) => {
      if (k === 'editAngler') { this.panels.close(true); this.creator.open({}); return; }
      if (k === 'resetProgress') { resetProgress(); this.noSave = true; location.reload(); return; }   // a clean start: the gear, the angler, the site and the opening all come from the blank save
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
    this.showSiteCard();
    if (this.viewOffset) { this.camera.clearViewOffset(); this.viewOffset = false; }
    if (!spawn) spawn = this.placeAnglerAtSpawn();
    this.walker.spawn(spawn, yaw ?? L.spawn.yaw ?? 0);
    this.rig.reset(spawn, yaw ?? L.spawn.yaw ?? 0);
    this.input.wantLock = false; this.input.clear();
    this.movedFar = false; this.walked = 0; this.setKeys(this.hudHints());
    this.outing.start();
    if (this.pendingTrip && this.progress.outing) { this.progress.outing.trip = this.pendingTrip.text; this.persist(); this.pendingTrip = null; }
    this.updateStats(); this.updateMissionHud();
    // The long welcome is read once per place; after that the place name alone fades in and out.
    const tips = this.progress.tips ??= {};
    if (!tips[`site:${this.eco.id}`]) { tips[`site:${this.eco.id}`] = true; this.persist(); const eco = this.eco; setTimeout(() => { if (this.mode === 'land' && this.eco === eco) this.toast(L.intro); }, 4400); }   // after the place name has faded
    this.eco.onStart?.(this);   // a site's opening card (the river's freshwater licence note)
    // A tag recapture letter, now and then, from a fish you tagged on an earlier day.
    const letter = recaptureLetter(this.progress);
    if (letter) { this.persist(); this.updateStats(); const show = () => { if (this.mode !== 'land') return; if (this.panels.isOpen || this.dialogue.isOpen || this.creatorOpen) { setTimeout(show, 1500); return; } showRecaptureLetter(this, letter); }; setTimeout(show, 2500); }   // (the credits are already paid: the letter waits for a quiet moment rather than being dropped)
  }
  /** Arriving somewhere: the place name comes up large for a few seconds, then goes (it is on the map and the pause menu after that). */
  showSiteCard() {
    const el = $('#site-name');
    el.innerHTML = `<b>${esc(this.eco.name)}</b><span>${esc(this.eco.place)}</span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
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
      w.update(dt, this.world, this.intro?.bounds ?? this.eco.land.bounds);
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
    if (!this.movedFar && !paused) { this.walked += w.speed * dt; if (this.walked > 6) this.movedFar = true; }
    if (this.frame % 6 === 0) { this.updateChip(); this.setKeys(paused ? [] : this.hudHints()); document.body.classList.toggle('rod-out', f.active); }
    this.intro?.update(paused ? 0 : dt, this.time);
    if (this.frame % 30 === 0) this.missionPump();
    if (f.active) {
      if (!paused) f.update(dt, this.time, this.input, this.world);
      const talk = !paused && ['ready', 'wait'].includes(f.state) ? this.npcs.promptText() : '';
      if (talk) $('#prompt').innerHTML += '<br>' + this.hint(talk);
    }
    else {
      const hz = this.eco.land.home, near = hz && Math.hypot(w.pos.x - hz.x, w.pos.z - hz.z) < hz.r;
      const talk = !paused ? this.npcs.promptText() : '';
      this.nearHome = !!near;   // (the hint bar offers H here; Head home is always in the pause menu)
      $('#prompt').innerHTML = this.hint(talk); w.frozen = false;
    }
    // Camera: follows the angler, frames the float too while a line is out.
    const also = f.active && f.float.visible && ['wait', 'retrieve', 'snagged', 'bite', 'fight', 'flying'].includes(f.state) ? f.float.position : null;
    this.rig.update(dt, this.world, w.pos, also, !paused, { fight: f.active && f.state === 'fight', line: f.lineDir, heading: w.heading });
    this.focus.copy(this.rig.focus);
    // The angler: stand, walk and fish.
    const a = this.angler;
    a.place(w.pos, w.heading);
    const lineOut = f.active && ['flying', 'wait', 'retrieve', 'snagged', 'bite', 'fight', 'landed'].includes(f.state);   // feet planted while a line is out: no walk cycle
    a.update(dt, this.time, { speed: lineOut ? 0 : w.speed, state: f.active ? (f.state === 'snagged' ? 'wait' : f.state) : 'off', extraBend: f.state === 'snagged' ? f.bendX : 0, power: f.power, act: f.act, reel: (f.state === 'fight' || f.state === 'retrieve') && f.reel, fightT: f.fightT, side: lineOut ? f.side : 0, look: lineOut ? f.lookAt() : null, reducedMotion: this.settings.reducedMotion });
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
  toggleRod() { if (this.intro?.refuse('KeyR')) return; this.fishing.toggle(this.fishingSpot()); }
  /** Head home (H): ask first, then end the outing. */
  askHome() { if (this.intro?.refuse('KeyH')) return; this.outing.ask(); }
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
    const parts = this.cond.chip().split(' · ');   // the HUD shows tide (or flow) and the clock; season and swell are in the pause menu and on the map
    const html = `<b>${parts.slice(0, 2).join(' · ')}<i class="more"> · ${parts.slice(2).join(' · ')}</i>${this.eco.chipExtra?.(this) ?? ''}</b><span class="tackle"><i class="sr">Tackle: </i>${r.name}${b}</span>`;
    if (chip.dataset.v !== html) { chip.dataset.v = html; chip.innerHTML = html; }
  }
  /** T: open the tackle box (rig and bait). Not while a fish is on. */
  tackleBox() {
    if (this.intro?.refuse('KeyT')) return;
    if (!this.fishing.canChangeGear) { const st = this.fishing.state; this.toast(st === 'snagged' ? 'Free your line first (tap Space), then change your tackle.' : ['wait', 'retrieve', 'flying'].includes(st) ? 'Wind your line in first, then change your tackle.' : 'Land or lose this fish first, then change your tackle.', 'warn'); return; }
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
      this.panels.body.querySelector('#tb-knots').onclick = () => {
        this.tackleOpen = false;   // the knots page replaces the panel body and its onClose, so the "Tackle set" toast is not wanted here
        openKnotsList(this, { onBack: () => this.tackleBox() });
      };
    };
    this.tackleOpen = true;
    this.panels.open(tackleBoxHTML(this.gear, this.progress, this.eco.id, this.cond), () => { this.tackleOpen = false; this.toast(`Tackle set: ${RIGS[this.gear.rig].name}${RIGS[this.gear.rig].lure ? '' : ' + ' + (BAITS[this.gear.bait]?.name ?? 'no bait')}. It applies to your next cast.`); });
    render();
  }
  saveGear() { this.progress.gear = { ...this.gear }; this.persist(); }
  /** A line was cut (a snag, or a fish that dived for structure): offer the re-tie. One prompt per 3 minutes; inside that window the toast says a spare was already tied. Never on a rig change, never in a fight. */
  onLineCut(reason) {
    const p = this.progress, now = Date.now(), setting = knotsMode(this.settings, new URLSearchParams(location.search));
    if (setting === 'off') return;
    if (!canPromptRetie(p, now)) { this.toast(SPARE_TOAST); return; }
    const open = () => {
      if (this.mode !== 'land') return;   // quit to the title or went home: no knot card over the menu
      if (this.panels.isOpen || this.dialogue.isOpen || !['off', 'ready'].includes(this.fishing.state) || this.input.down('Space')) { setTimeout(open, 600); return; }   // after the catch flow or any other panel, and never in the middle of a cast
      markRetie(p, now); this.persist();
      openKnot(this, { id: 'uni', mode: chooseMode({ setting, reason: 'retie', p, id: 'uni' }), reason: 'retie' });
    };
    setTimeout(open, 900);   // let the cut-line toast land first
  }
  /** The catch bar's zone touched a piece of litter. */
  onLitter(kind, meta) {
    if (meta?.lost) {   // the line you cut at this site (fishing/snags.js): it comes off the count, and pays nothing and counts for nothing (no credits, no Steward points, no litter tally)
      if (collectLostLine(this.progress, this.eco.id)) { this.persist(); this.audio.play('correct'); this.toast(SNAG_TEXT.lostLine, 'good'); }
      return;
    }
    const st = this.progress.steward ??= { points: 0, litter: 0 };
    st.points++; st.litter++; this.persist();
    this.audio.play('correct');
    this.toast(kind === 'line'
      ? `Tangled line collected! Lost fishing line traps and drowns birds, turtles and fish. Steward points: ${st.points}. Fatima's clean-up tally pays credits for litter.`
      : `Plastic bag collected! Turtles mistake bags for jellyfish and eat them. Steward points: ${st.points}. Fatima's clean-up tally pays credits for litter.`, 'good');
  }
  /** A fish is in your hands: identify it (key), measure it (brag mat), decide keep or release, write it to the logbook (ui/catchFlow.js). */
  onFishLanded(c, spot, done) {
    if (c.tutorial) this.intro?.onLanded();   // the teachers' opening: the same flow, then the send-off
    this.catchFlow.run(c, spot, c.tutorial ? () => { done(); this.intro?.onFlowDone(); } : done);
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
    const html = `<b>🧊 <i class="sr">Esky </i>${esky.length}${bad ? ` <i class="bad">⚠ ${bad} illegal</i>` : ''}</b><b class="coin" title="${COIN.name}">${COIN.icon} ${p.coins ?? 0}</b>`;   // (the Steward stars are in the pause menu)
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
    if (this.radioBusy || this.intro?.active || !this.missionSafe()) return;
    if (this.missionQueue.length) this.playRadio(this.missionQueue.shift());
    else if (bevCallDue(p) && this.fishing.state === 'ready') this.playBev();
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
  /** Bev's first radio call (the old premise card's four tiers): once, the first time the student is ready to fish after the opening. */
  async playBev() {
    this.radioBusy = true; markBevCall(this.progress); this.persist();
    try {
      const dlg = this.dialogue, lines = bevLines(esc(nameOf(this.progress))), who = { ...this.npcs.whoOf('bev'), name: 'Bev', role: 'on the club radio' };
      for (let i = 0; i < lines.length; i++) await dlg.say({ who, text: this.hint(lines[i].text), button: i === lines.length - 1 ? 'Thanks!' : 'Continue' });
      dlg.hide();
    } finally { this.radioBusy = false; }
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
  persist() { this.missionsDirty = true; if (this.noSave) return; const r = saveProgress(this.progress); if (r === 'trimmed') this.toast('Storage is nearly full: some older fish photos were dropped to keep your save.', 'warn'); else if (!r) this.toast('Storage is full: your progress could not be saved. Export your logbook (L) so you keep a copy.', 'bad'); }
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
  hint(text) { return this.padOn ? this.pad.label(text) : this.touch ? this.touch.label(text) : text; }

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
    this.pad.update(dt);
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
      // Where the sun is on screen (it may be off the edge, or behind the camera: then the glow fades out).
      const sd = globalUniforms.uSunDir.value, v = (this._sv ??= new THREE.Vector3()), f = (this._sf ??= new THREE.Vector3());
      const facing = sd.dot(this.camera.getWorldDirection(f));
      v.copy(this.camera.position).addScaledVector(sd, 1000).project(this.camera);
      if (facing > 0.02) u.uSun.value.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
      const e = this.env, gold = e.daylightOn ? e.gold ?? 0 : 0.4, night = e.night ?? 0;
      u.uSunAmt.value = Math.min(1, Math.max(0, (facing - 0.02) / 0.4)) * (0.3 + 0.3 * gold + 0.5 * e.glow) * (1 - 0.75 * night);
      u.uWarm.value = Math.min(1, gold + e.glow) * (1 - night); u.uNightK.value = night;
      u.uSunCol.value.setRGB(1, 0.8 - 0.14 * e.glow, 0.55 - 0.2 * e.glow);
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
