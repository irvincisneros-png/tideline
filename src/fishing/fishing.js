// Rod fishing (beach, rock platform, Lake Illawarra): the angler holds the rod, casts, you wait for a bite, strike, then play the
// fish on the catch bar. Your rig and bait (tackle box, T) and the day's conditions set the wait and what bites (catches.js).
// On the strike the catch bar opens (catchbar.js): hold Space to lift the green zone and keep the fish inside it.
// Seen from the high follow camera: the cast arcs out, a thin dark line sags to a red and white float, a ring marks the landing.
import * as THREE from 'three';
import { pickCatch, waitFor, judge, RULES, FIGHT, SPOTS, SPECIES_BY_ID } from './catches.js';
import { CatchBar } from './catchbar.js';
import { buildFish } from '../life/fishModel.js';
import { LOOKS } from '../life/looks.js';

const $ = s => document.querySelector(s);
const LINE_PTS = 20; // the line is drawn as a ribbon curve so it can sag and bend with the fight
const LINE_W = 0.03;
export const CAST_MIN = 5, CAST_MAX = 20; // metres from the angler at 0 and 100% power

export class Fishing {
  constructor(game) {
    this.game = game;
    this.state = 'off'; // off | ready | charge | flying | wait | bite | fight | landed
    // The line: a camera-facing ribbon (2 vertices per point), dark and thin.
    const pos = new Float32Array(LINE_PTS * 2 * 3), idx = [];
    for (let i = 0; i < LINE_PTS - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); lineGeo.setIndex(idx);
    this.line = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0x1f3239, side: THREE.DoubleSide, fog: false }));
    this.line.frustumCulled = false; this.line.visible = false;
    // The float: red body, white top, a short stalk.
    this.float = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf0442c, roughness: 0.4 }));
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.103, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    top.position.y = 0.002; top.rotation.x = Math.PI; top.position.y = 0;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    stalk.position.y = 0.16;
    this.float.add(body, top, stalk); this.float.visible = false;
    // Ripple ring around the float, and the aim ring shown while winding up.
    this.ripple = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
    this.ripple.rotation.x = -Math.PI / 2; this.ripple.visible = false;
    this.aim = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    this.aim.rotation.x = -Math.PI / 2; this.aim.visible = false;
    this.aimLine = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.12), new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
    this.aimLine.rotation.x = -Math.PI / 2; this.aimLine.visible = false;
    // "!" over the float when a fish bites (readable from high up).
    this.bang = makeBang(); this.bang.visible = false;
    game.scene.add(this.line, this.float, this.ripple, this.aim, this.aimLine, this.bang);
    this.target = new THREE.Vector3(); this.dist = 0; this.power = 0; this.sag = 0.3; this.bend = 0;
    this.bar = new CatchBar(game);
    this.tipW = new THREE.Vector3();
    this.reel = false; this.fightT = 0;
    this.lineDir = new THREE.Vector3(0, 0, 1);   // unit bearing from the angler to the float while a line is out
  }
  get active() { return this.state !== 'off'; }
  get angler() { return this.game.angler; }
  /** 0..1 for the angler pose while a fish is on. */
  /** Signed angle (rad) from the facing to the float, + toward the angler's local +x (the model's left arm): the rod leans toward the fish. */
  get side() { const w = this.game.walker, f = this.float.position; return this.float.visible ? Math.atan2((f.x - w.pos.x) * Math.cos(w.heading) - (f.z - w.pos.z) * Math.sin(w.heading), (f.x - w.pos.x) * Math.sin(w.heading) + (f.z - w.pos.z) * Math.cos(w.heading)) : 0; }
  get act() { return this.state === 'fight' ? this.bar.activity : 0; }

  /** R: take the rod out or put it away. spot: a key of SPOTS (the cast re-checks it where the float lands). */
  toggle(spot) {
    if (this.active) { this.stop(); return; }
    this.spot = spot; this.state = 'ready';
    this.game.toast(`Rod out (${SPOTS[spot].label}). Hold Space to wind up, release to cast. Press T for your tackle box. R puts the rod away.`);
  }
  /** Can the player change tackle right now? Not while a fish is on. */
  get canChangeGear() { return !['bite', 'fight'].includes(this.state); }
  stop() {
    this.bar.stop(); this.angler?.setBend(0);
    this.state = 'off'; this.landT = 0; this.line.visible = false; this.float.visible = false; this.ripple.visible = false; this.aim.visible = false; this.aimLine.visible = false; this.bang.visible = false;
    this.game.walker.frozen = false;
    this.angler?.hold(null); this.disposeHeld();
    $('#prompt').innerHTML = '';
  }

  /** Free the GPU resources of the fish held up for the camera: its geometry, its painted skin texture and its material are made fresh for every landing, so they must be disposed when it is put away. */
  disposeHeld() {
    const h = this.held; this.held = null;
    h?.traverse(o => {
      if (!o.isMesh) return;
      o.geometry?.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m?.map?.dispose(); m?.dispose(); }
    });
  }

  /** Where a cast of this power lands, along the way the angler faces. */
  castTarget(power, out = this.target) {
    const w = this.game.walker, f = w.facing, r = CAST_MIN + power * (CAST_MAX - CAST_MIN);
    return out.set(w.pos.x + f.x * r, 0, w.pos.z + f.z * r);
  }

  update(dt, t, input, world) {
    if (!this.active) return;
    const g = this.game, w = g.walker, ang = g.angler, space = input.down('Space'), hit = input.hit('Space');
    const eye = this._eye ??= new THREE.Vector3(); eye.set(w.pos.x, w.pos.y + 1, w.pos.z);
    ang.rodTip.getWorldPosition(this.tipW);
    const tipW = this.tipW;
    let prompt = '';
    const surf = (x, z) => world.surfaceAt(x, z);
    // On a drifting boat the bait drifts with it: carry the float and the cast target along (g.carry is set each frame by the site, eco.tick).
    if (g.carry && (g.carry.x || g.carry.z) && ['flying', 'wait', 'bite'].includes(this.state)) { this.float.position.x += g.carry.x; this.float.position.z += g.carry.z; this.target.x += g.carry.x; this.target.z += g.carry.z; if (this.from) { this.from.x += g.carry.x; this.from.z += g.carry.z; } }
    // Once the line is out the angler plants their feet and faces the float: the bearing is locked (see lineDir), walk input is ignored.
    w.frozen = ['charge', 'flying', 'wait', 'bite', 'fight', 'landed'].includes(this.state);
    if (this.state === 'flying') this.lineDir.set(this.target.x - w.pos.x, 0, this.target.z - w.pos.z).normalize();
    else if (this.state === 'wait' || this.state === 'bite') { this.lineDir.set(this.float.position.x - w.pos.x, 0, this.float.position.z - w.pos.z); if (this.lineDir.lengthSq() > 0.25) this.lineDir.normalize(); else this.lineDir.copy(w.facing); }
    if (LINE_OUT.includes(this.state)) w.face(this.lineDir.x, this.lineDir.z, dt, 10);
    if (this.state === 'ready' || this.state === 'charge') g.aimAtCursor(dt); // desktop: face the pointer while the rod is out
    this.aim.visible = this.aimLine.visible = this.state === 'charge';
    if (this.state === 'ready') {
      prompt = 'Hold <kbd>Space</kbd> to wind up a cast';
      if (space) { this.state = 'charge'; this.power = 0; }
    } else if (this.state === 'charge') {
      this.power = Math.min(1, this.power + dt * 0.85);
      this.castTarget(this.power, this._aim ??= new THREE.Vector3());
      const a = this._aim, ay = surf(a.x, a.z) + 0.06, dir = w.facing, len = Math.hypot(a.x - w.pos.x, a.z - w.pos.z);
      this.aim.position.set(a.x, ay, a.z); this.aim.scale.setScalar(0.8 + this.power * 0.9 + Math.sin(t * 8) * 0.06);
      this.aimLine.position.set((a.x + w.pos.x) / 2, ay, (a.z + w.pos.z) / 2); this.aimLine.scale.set(len - 1.2, 1, 1); this.aimLine.rotation.z = Math.atan2(dir.z, dir.x);
      prompt = `Casting power ${Math.round(this.power * 100)}% — release <kbd>Space</kbd>`;
      if (!space) {
        this.castTarget(this.power);
        const depth = surf(this.target.x, this.target.z) - world.groundAt(this.target.x, this.target.z);
        if (depth < 0.4) { this.state = 'ready'; g.toast('That cast would land on dry ground — face the water and cast again.', 'warn'); }
        else if (!g.baitReady()) { this.state = 'ready'; g.toast('No bait left in your box. Buy some at Mitra\'s shop, collect your own, or switch to a lure (tackle box, T).', 'warn'); }
        else { this.state = 'flying'; this.flyT = 0; this.from = tipW.clone(); g.audio.play('click'); }
      }
    } else if (this.state === 'flying') {
      this.flyT += dt / 0.75;
      const k = Math.min(1, this.flyT);
      // The tip follows the swing for the first moments, then the float flies a high arc to the target.
      this.float.position.lerpVectors(this.from, this.target, k); this.float.position.y = THREE.MathUtils.lerp(this.from.y, surf(this.target.x, this.target.z), k) + Math.sin(k * Math.PI) * 2.6;
      this.float.visible = true;
      if (k >= 1) {
        this.state = 'wait'; g.audio.play('smallSplash'); g.fx.splash?.(this.float.position, 6); this.dist = this.float.position.distanceTo(eye);
        const spot = g.fishingSpot(this.target);
        if (spot !== this.spot) { this.spot = spot; g.toast(`Fishing: ${SPOTS[spot].label}.`); }
        this.ctx = g.biteContext(this.target); // the tackle and conditions you cast with decide the wait and what bites
        this.waitT = waitFor(this.spot, this.ctx);
      }
    } else if (this.state === 'wait') {
      this.waitT -= dt;
      this.float.position.y = surf(this.float.position.x, this.float.position.z) + Math.sin(t * 2.2) * 0.02;
      prompt = 'Waiting for a bite… (Space reels in to cast again)';
      this.dist = this.float.position.distanceTo(eye);
      if (hit) this.state = 'ready', this.float.visible = false;
      if (this.waitT <= 0) { this.state = 'bite'; this.biteT = 1.3; this.catch = pickCatch(this.spot, this.ctx); g.audio.play('warn'); g.useBait(); }   // the fish takes the bait: one bait is used
    } else if (this.state === 'bite') {
      this.biteT -= dt;
      this.float.position.y = surf(this.float.position.x, this.float.position.z) - 0.08 - Math.abs(Math.sin(t * 18)) * 0.06; // the float dips
      prompt = 'BITE! Press <kbd>Space</kbd> to strike!';
      if (hit) { this.startFight(); }
      else if (this.biteT <= 0) { this.missStrike(); }
    } else if (this.state === 'landed') {
      if (this.landT > 0 && (this.landT -= dt) <= 0) {
        g.onFishLanded(this.landed, this.spot, () => { g.angler.hold(null); this.disposeHeld(); g.walker.frozen = false; this.state = this.state === 'off' ? 'off' : 'ready'; });
      }
    } else if (this.state === 'fight') {
      // The catch bar runs the fight; the line, float and rod follow what the fish does.
      const bar = this.bar;
      bar.update(dt, space);
      this.reel = space || !!bar.held;   // Space, or a finger on the bar on touch
      const act = bar.activity;
      this.fightT += dt;
      const away = this.lineDir;   // fixed at the strike: re-deriving it from the float (which swings sideways) made the bearing drift round and spin the angler
      const d = THREE.MathUtils.lerp(this.dist0, 2.5, bar.meter); // the float comes in as the meter fills
      const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(Math.sin(this.fightT * (1.2 + act * 3)) * Math.min(5, d * 0.18) * (0.4 + act));
      this.float.position.copy(eye).addScaledVector(away, Math.max(1.8, d)).add(side);
      this.float.position.y = surf(this.float.position.x, this.float.position.z) - 0.04 - (bar.s?.mode === 'dive' ? 0.1 : 0);
      if (act > 0.5 && Math.random() < dt * 3) g.fx.splash?.(this.float.position, 4);
      this.sag = 0.04 + 0.2 * (1 - act);
    }
    // Float extras: ripple ring on the water, "!" over a bite.
    const fl = this.float.visible && ['wait', 'bite', 'fight'].includes(this.state);
    this.ripple.visible = fl;
    if (fl) {
      const fp = this.float.position, ph = (t * 0.9) % 1, k = this.state === 'wait' ? 1 : 1.6;
      this.ripple.position.set(fp.x, surf(fp.x, fp.z) + 0.03, fp.z); this.ripple.scale.setScalar((0.8 + ph * 1.4) * k); this.ripple.material.opacity = (1 - ph) * 0.7;
    }
    this.bang.visible = this.state === 'bite';
    if (this.bang.visible) { const fp = this.float.position; this.bang.position.set(fp.x, fp.y + 1.5 + Math.abs(Math.sin(t * 9)) * 0.3, fp.z); }
    // Line from the rod tip to the float / fish.
    this.line.visible = this.float.visible && ['flying', 'wait', 'bite', 'fight'].includes(this.state);
    if (this.line.visible) this.drawLine(tipW, this.float.position);
    $('#prompt').innerHTML = g.hint(prompt);
  }

  /** A thin dark ribbon from the rod tip to the float: sags when slack (and bows a little to the side), pulls straight when a fish works. */
  drawLine(a, b) {
    const p = this.line.geometry.attributes.position, cam = this.game.camera.position;
    const fighting = this.state === 'fight', len = a.distanceTo(b);
    const sag = (['wait', 'bite'].includes(this.state) ? 0.3 : fighting ? this.sag : 0.1) * Math.min(14, len) * 0.2, bow = (fighting ? 0.1 : 0.55) * sag;
    const dx = b.x - a.x, dz = b.z - a.z, ln = Math.hypot(dx, dz) || 1, sx = -dz / ln, sz = dx / ln;
    const prev = this._lp ??= new THREE.Vector3(), cur = new THREE.Vector3(), seg = new THREE.Vector3(), side = new THREE.Vector3(), toCam = new THREE.Vector3();
    for (let i = 0; i < LINE_PTS; i++) {
      const k = i / (LINE_PTS - 1), s4 = 4 * k * (1 - k);
      cur.set(a.x + (b.x - a.x) * k + sx * bow * s4, a.y + (b.y + 0.1 - a.y) * k - sag * s4, a.z + (b.z - a.z) * k + sz * bow * s4);
      // Ribbon width perpendicular to both the line and the view direction.
      seg.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize(); toCam.subVectors(cam, cur).normalize();
      side.crossVectors(seg, toCam).normalize().multiplyScalar(LINE_W * 0.5 * (1 + (1 - k) * 0.6));
      p.setXYZ(i * 2, cur.x - side.x, cur.y - side.y, cur.z - side.z); p.setXYZ(i * 2 + 1, cur.x + side.x, cur.y + side.y, cur.z + side.z);
    }
    p.needsUpdate = true;
  }

  /** A missed strike: the fish took the bait and let go, so the bait is gone. The line comes in and you must bait up (checked again at the cast) and cast again; it never goes back to waiting with the old bait and old tackle context. */
  missStrike() {
    const g = this.game;
    this.state = 'ready'; this.float.visible = false; this.catch = null; this.ctx = null;
    g.toast(g.baitReady() ? 'Too slow — the fish took the bait and let go. Strike as soon as the float dips. Your bait is gone: hold Space to cast again.' : 'Too slow — the fish took the bait and let go, and that was your last bait. Buy or collect more (tackle box, T), or switch to a lure.', 'warn');
  }

  startFight() {
    const c = this.catch, F = FIGHT[c.id] ?? { profile: 'twitch', power: 0.5 }, gs = this.game.gearStats();
    const w = this.game.walker;
    this.lineDir.set(this.float.position.x - w.pos.x, 0, this.float.position.z - w.pos.z); if (this.lineDir.lengthSq() > 0.25) this.lineDir.normalize(); else this.lineDir.copy(w.facing);
    this.state = 'fight'; this.fightT = 0; this.reel = false; this.dist0 = Math.max(6, this.dist); this.sag = 0.2;
    this.bar.start({
      profile: F.profile, power: F.power, gear: c.gear, size: c.length,
      rod: gs.rod, line: gs.line,   // your rod and reel/line (economy/store.js): zone size, how fast the fish tires you out, how well the line holds a bolting fish
      onSave: () => this.game.toast('Strong line held! You turned it just before the reef.', 'good'),
      onLitter: kind => this.game.onLitter(kind),
      onEnd: r => {
        if (r.won) this.land();
        else if (r.reason === 'snag') this.lost('Snagged! The fish dived for structure (reef, rocks, weed) and cut the line. Reef fish bolt for cover: keep the pressure on and turn them before they get there.');
        else this.lost('The fish shook the hook and got away. Keep the fish inside the green zone to wear it out.');
      },
    });
    this.game.audio.play('trick', { combo: 0 });
  }
  lost(msg) {
    this.bar.stop(); this.float.visible = false; this.state = 'ready'; this.game.walker.frozen = false;
    this.game.toast(msg, 'warn'); this.game.audio.play('warn');
  }
  land() {
    const g = this.game, c = this.catch;
    this.bar.stop(); this.float.visible = false; this.state = 'landed';
    g.audio.play('splash');
    // Hold the fish up high, I Just Wanted to Fish style.
    const look = LOOKS[c.id];
    if (look) {
      const built = buildFish({ ...look, length: Math.max(0.5, Math.min(1.2, c.length / 100 * 3)) }); // oversized so it reads from up high
      const mat = new THREE.MeshStandardMaterial({ map: built.texture, roughness: 0.45, side: THREE.DoubleSide });
      const m = new THREE.Mesh(built.geometry, mat);
      m.rotation.set(Math.PI / 2, 0, 0); m.position.set(0.05, 0.1, 0.02); m.castShadow = true;
      const holder = new THREE.Group(); holder.add(m); g.angler.hold(holder); this.held = holder;
    }
    if (SPECIES_BY_ID[c.id]?.habitat === 'invertebrate') g.inkSplash?.(g.walker.pos);   // squid and cuttlefish squirt ink as they come out of the water
    // A moment to admire the catch before the keep-or-release card opens.
    this.landT = 1.2; this.landed = { ...c, ctx: this.ctx };
  }
}

function makeBang() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff3d2'; x.strokeStyle = '#1f5f6b'; x.lineWidth = 8;
  x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.fill(); x.stroke();
  x.fillStyle = '#e8553d'; x.font = '800 84px "Arial Rounded MT Bold", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 64, 70);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
  s.scale.setScalar(1.0); s.renderOrder = 20;
  return s;
}
const LINE_OUT = ['flying', 'wait', 'bite', 'fight', 'landed'];
export { RULES, judge };
