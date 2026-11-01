// Rod fishing (beach, rock platform, Lake Illawarra): cast, wait for a bite, strike, then play the fish on the catch bar.
// Your rig and bait (tackle box, T) and the day's conditions set the wait and what bites (catches.js). On the strike the
// catch bar opens (catchbar.js): hold Space to lift the green zone and keep the fish inside it.
import * as THREE from 'three';
import { pickCatch, waitFor, judge, RULES, FIGHT, SPOTS } from './catches.js';
import { CatchBar } from './catchbar.js';
import { buildFish } from '../life/fishModel.js';
import { LOOKS } from '../life/looks.js';

const $ = s => document.querySelector(s);
const LINE_PTS = 16; // the line is drawn as a curve so it can sag and bend with the fight

export class Fishing {
  constructor(game) {
    this.game = game;
    this.state = 'off'; // off | ready | charge | flying | wait | bite | fight | landed
    this.rod = makeRod();
    game.camera.add(this.rod);
    this.rod.visible = false;
    const lineGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: LINE_PTS }, () => new THREE.Vector3()));
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf8f8f0, transparent: true, opacity: 0.8 }));
    this.line.frustumCulled = false; this.line.visible = false;
    this.float = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff4020, roughness: 0.4 }));
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    top.position.y = 0.02; this.float.add(top); this.float.visible = false;
    game.scene.add(this.line, this.float);
    this.target = new THREE.Vector3(); this.dist = 0; this.power = 0; this.sag = 0.3; this.bend = 0;
    this.bar = new CatchBar(game);
  }
  get active() { return this.state !== 'off'; }
  /** Bend the rod: 0 straight .. 1 deep bend (spread along the shaft). */
  setBend(b, t = 0) {
    this.bend = b;
    const segs = this.rod.userData.segs;
    segs.forEach((seg, i) => { seg.rotation.x = b * 0.16 * (i + 1) * 0.6 + (b > 0.5 ? Math.sin(t * 22 + i) * 0.015 * b : 0); });
  }

  /** R: take the rod out or put it away. spot: a key of SPOTS (the cast re-checks it where the float lands). */
  toggle(spot) {
    if (this.active) { this.stop(); return; }
    this.spot = spot; this.state = 'ready'; this.rod.visible = true;
    this.game.toast(`Rod out (${SPOTS[spot].label}). Hold Space to wind up, release to cast. Press T for your tackle box. R puts the rod away.`);
  }
  /** Can the player change tackle right now? Not while a fish is on. */
  get canChangeGear() { return !['bite', 'fight'].includes(this.state); }
  stop() {
    this.bar.stop(); this.setBend(0);
    this.state = 'off'; this.rod.visible = false; this.line.visible = false; this.float.visible = false;
    if (this.held) { this.game.camera.remove(this.held); this.held = null; }
    $('#prompt').innerHTML = '';
  }

  update(dt, t, input, world, eye) {
    if (!this.active) return;
    const g = this.game, space = input.down('Space'), hit = input.hit('Space');
    this.rod.updateMatrixWorld(); const tipW = new THREE.Vector3(0, 0, 0).applyMatrix4(this.rodTip.matrixWorld);
    let prompt = '';
    const surf = (x, z) => world.surfaceAt(x, z);
    if (this.state === 'ready') {
      prompt = 'Hold <kbd>Space</kbd> to wind up a cast';
      this.rod.rotation.x = 0;
      if (space) { this.state = 'charge'; this.power = 0; }
    } else if (this.state === 'charge') {
      this.power = Math.min(1, this.power + dt * 0.8);
      this.rod.rotation.x = 0.9 * this.power;
      prompt = `Casting power ${Math.round(this.power * 100)}% — release <kbd>Space</kbd>`;
      if (!space) {
        const dir = g.camera.getWorldDirection(new THREE.Vector3()); dir.y = 0; dir.normalize();
        this.target.copy(eye).addScaledVector(dir, 8 + this.power * 32);
        const depth = surf(this.target.x, this.target.z) - world.groundAt(this.target.x, this.target.z);
        if (depth < 0.4) { this.state = 'ready'; g.toast('That cast would land on dry ground — face the water and cast again.', 'warn'); }
        else { this.state = 'flying'; this.flyT = 0; this.from = tipW.clone(); this.rod.rotation.x = -0.4; g.audio.play('click'); }
      }
    } else if (this.state === 'flying') {
      this.flyT += dt / 0.8;
      const k = Math.min(1, this.flyT);
      this.float.position.lerpVectors(this.from, this.target, k); this.float.position.y = THREE.MathUtils.lerp(this.from.y, surf(this.target.x, this.target.z), k) + Math.sin(k * Math.PI) * 6;
      this.float.visible = true;
      this.rod.rotation.x = THREE.MathUtils.damp(this.rod.rotation.x, 0, 4, dt);
      if (k >= 1) {
        this.state = 'wait'; g.audio.play('smallSplash'); g.fx.splash?.(this.float.position, 6); this.dist = this.float.position.distanceTo(eye);
        const spot = g.fishingSpot(this.target);
        if (spot !== this.spot) { this.spot = spot; g.toast(`Fishing: ${SPOTS[spot].label}.`); }
        this.ctx = g.biteContext(); // the tackle and conditions you cast with decide the wait and what bites
        this.waitT = waitFor(this.spot, this.ctx);
      }
    } else if (this.state === 'wait') {
      this.waitT -= dt;
      this.float.position.y = surf(this.float.position.x, this.float.position.z) + Math.sin(t * 2.2) * 0.02;
      prompt = 'Waiting for a bite… (Space reels in to cast again)';
      if (hit) this.state = 'ready', this.float.visible = false;
      if (this.waitT <= 0) { this.state = 'bite'; this.biteT = 1.3; this.catch = pickCatch(this.spot, this.ctx); g.audio.play('warn'); }
    } else if (this.state === 'bite') {
      this.biteT -= dt;
      this.float.position.y = surf(this.float.position.x, this.float.position.z) - 0.08 - Math.abs(Math.sin(t * 18)) * 0.06; // the float dips
      prompt = 'BITE! Press <kbd>Space</kbd> to strike!';
      if (hit) { this.startFight(); }
      else if (this.biteT <= 0) { this.state = 'wait'; this.waitT = waitFor(this.spot, this.ctx) * 0.6; g.toast('Too slow — the fish took the bait and let go. Strike as soon as the float dips.', 'warn'); }
    } else if (this.state === 'fight') {
      // The catch bar runs the fight; the line, float and rod follow what the fish does.
      const bar = this.bar;
      bar.update(dt, space);
      const act = bar.activity;
      this.fightT += dt;
      const away = this.float.position.clone().sub(eye).setY(0).normalize();
      const d = THREE.MathUtils.lerp(this.dist0, 2, bar.meter); // the float comes in as the meter fills
      const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(Math.sin(this.fightT * (1.2 + act * 3)) * Math.min(5, d * 0.18) * (0.4 + act));
      this.float.position.copy(eye).addScaledVector(away, Math.max(1.5, d)).add(side);
      this.float.position.y = surf(this.float.position.x, this.float.position.z) - 0.05 - (bar.s?.mode === 'dive' ? 0.1 : 0);
      if (act > 0.5 && Math.random() < dt * 3) g.fx.splash?.(this.float.position, 4);
      this.setBend(0.35 + 0.65 * act, t);
      this.sag = 0.04 + 0.2 * (1 - act);
      this.rod.rotation.x = THREE.MathUtils.damp(this.rod.rotation.x, 0.25 + act * 0.25, 8, dt);
      this.rod.rotation.z = Math.sin(t * 9) * 0.03 * act;
    } else if (this.state === 'landed') {
      if (this.held) { this.held.rotation.z = Math.sin(t * 7) * 0.25; }
    }
    // Line from the rod tip to the float / fish.
    this.line.visible = this.float.visible && ['flying', 'wait', 'bite', 'fight'].includes(this.state);
    if (this.line.visible) {
      // A curve from the rod tip to the float that sags when slack and pulls straight when a fish is working.
      const p = this.line.geometry.attributes.position, fp = this.float.position, sag = (['wait', 'bite'].includes(this.state) ? 0.3 : this.state === 'fight' ? this.sag : 0.08) * Math.min(12, tipW.distanceTo(fp)) * 0.18;
      for (let i = 0; i < LINE_PTS; i++) {
        const k = i / (LINE_PTS - 1), drop = sag * 4 * k * (1 - k);
        p.setXYZ(i, tipW.x + (fp.x - tipW.x) * k, tipW.y + (fp.y + 0.04 - tipW.y) * k - drop, tipW.z + (fp.z - tipW.z) * k);
      }
      p.needsUpdate = true;
    }
    $('#prompt').innerHTML = g.hint(prompt);
  }

  startFight() {
    const c = this.catch, F = FIGHT[c.id] ?? { profile: 'twitch', power: 0.5 };
    this.state = 'fight'; this.fightT = 0; this.dist0 = Math.max(6, this.dist); this.sag = 0.2;
    this.bar.start({
      profile: F.profile, power: F.power, gear: c.gear, size: c.length,
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
    this.bar.stop(); this.setBend(0); this.float.visible = false; this.state = 'ready';
    this.game.toast(msg, 'warn'); this.game.audio.play('warn');
  }
  land() {
    const g = this.game, c = this.catch;
    this.bar.stop(); this.setBend(0); this.float.visible = false; this.state = 'landed';
    g.audio.play('splash');
    // Hold the fish up in front of you, I Just Wanted to Fish style.
    const look = LOOKS[c.id];
    if (look) {
      const built = buildFish({ ...look, length: c.length / 100 });
      const mat = new THREE.MeshStandardMaterial({ map: built.texture, roughness: 0.45, side: THREE.DoubleSide });
      const m = new THREE.Mesh(built.geometry, mat);
      m.rotation.set(0, Math.PI / 2, Math.PI / 2); m.position.set(0, -0.05, -0.75 - c.length / 200);
      const holder = new THREE.Group(); holder.add(m); g.camera.add(holder); this.held = holder;
    }
    g.onFishLanded({ ...c, ctx: this.ctx }, this.spot, () => { if (this.held) { g.camera.remove(this.held); this.held = null; } this.state = this.state === 'off' ? 'off' : 'ready'; });
  }
}

function makeRod() {
  // Rod held in the right hand, pointing forward and up; the tip carries the line.
  const g = new THREE.Group();
  const blank = new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.4 });
  const cork = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.8 });
  const reelM = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.35, metalness: 0.6 });
  const pivot = new THREE.Group(); pivot.position.set(0.36, -0.36, -0.5); pivot.rotation.set(-0.95, 0, -0.12); g.add(pivot); // angled up and away, like holding a rod out
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.3, 10), cork); handle.position.y = 0.0; pivot.add(handle);
  // The blank is three segments, each rotated a bit more than the one below, so the rod can bend under a fish.
  const segs = [], segMat = blank;
  let parent = pivot;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group(); seg.position.y = i === 0 ? 0.15 : 0.63; parent.add(seg);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004 + 0.003 * (2 - i), 0.006 + 0.004 * (3 - i), 0.63, 8), segMat); m.position.y = 0.315; seg.add(m);
    segs.push(seg); parent = seg;
  }
  g.userData.segs = segs;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 16), reelM); reel.rotation.z = Math.PI / 2; reel.position.set(0, 0.1, 0.04); pivot.add(reel);
  const tip = new THREE.Group(); tip.position.y = 0.63; parent.add(tip);
  g.userData.tip = tip;
  return Object.assign(g, {});
}
Object.defineProperty(Fishing.prototype, 'rodTip', { get() { return this.rod.userData.tip; } });
export { RULES, judge };
