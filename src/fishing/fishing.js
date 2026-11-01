// Rod fishing (beach, rock platform, estuary bank): cast, wait for a bite, strike, then fight the fish on the line.
// Fight: hold Space to reel. Tension rises while you reel against a running fish and falls when you ease off.
// Too much tension snaps the line; a fish that runs out all your line is lost. Reel while it rests.
import * as THREE from 'three';
import { pickCatch, judge, RULES, FIGHT, SPOTS } from './catches.js';
import { buildFish } from '../life/fishModel.js';
import { LOOKS } from '../life/looks.js';

const $ = s => document.querySelector(s);
const MAX_LINE = 60; // metres of line on the reel

export class Fishing {
  constructor(game) {
    this.game = game;
    this.state = 'off'; // off | ready | charge | flying | wait | bite | fight | landed
    this.rod = makeRod();
    game.camera.add(this.rod);
    this.rod.visible = false;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf8f8f0, transparent: true, opacity: 0.8 }));
    this.line.frustumCulled = false; this.line.visible = false;
    this.float = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff4020, roughness: 0.4 }));
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    top.position.y = 0.02; this.float.add(top); this.float.visible = false;
    game.scene.add(this.line, this.float);
    this.target = new THREE.Vector3(); this.tension = 0; this.dist = 0; this.power = 0;
    this.hud = document.createElement('div'); this.hud.id = 'fish-hud'; this.hud.className = 'hidden';
    this.hud.innerHTML = `<div class="fh-label">Tension</div><div class="fh-track"><i id="fh-tension"></i><b class="fh-danger"></b></div>
      <div class="fh-label">Line out <span id="fh-dist">0 m</span></div><div class="fh-track"><i id="fh-line"></i></div><div id="fh-state"></div>`;
    $('#hud').appendChild(this.hud);
  }
  get active() { return this.state !== 'off'; }

  /** R: take the rod out or put it away. spot: a key of SPOTS ('beach' | 'rock' | 'estuary'). */
  toggle(spot) {
    if (this.active) { this.stop(); return; }
    this.spot = spot; this.state = 'ready'; this.rod.visible = true;
    this.game.toast(`Rod out (${SPOTS[spot].label}). Hold Space to wind up, release to cast. R puts the rod away.`);
  }
  stop() {
    this.state = 'off'; this.rod.visible = false; this.line.visible = false; this.float.visible = false; this.hud.classList.add('hidden');
    if (this.held) { this.game.camera.remove(this.held); this.held = null; }
    $('#prompt').innerHTML = '';
  }

  update(dt, t, input, world, eye) {
    if (!this.active) return;
    const g = this.game, space = input.down('Space'), hit = input.hit('Space');
    this.rod.updateMatrixWorld(); const tipW = new THREE.Vector3(0, 0.95, 0).applyMatrix4(this.rodTip.matrixWorld);
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
      if (k >= 1) { this.state = 'wait'; this.waitT = 3 + Math.random() * 7; g.audio.play('smallSplash'); g.fx.splash?.(this.float.position, 6); this.dist = this.float.position.distanceTo(eye); }
    } else if (this.state === 'wait') {
      this.waitT -= dt;
      this.float.position.y = surf(this.float.position.x, this.float.position.z) + Math.sin(t * 2.2) * 0.02;
      prompt = 'Waiting for a bite… (Space reels in to cast again)';
      if (hit) this.state = 'ready', this.float.visible = false;
      if (this.waitT <= 0) { this.state = 'bite'; this.biteT = 1.3; this.catch = pickCatch(this.spot); g.audio.play('warn'); }
    } else if (this.state === 'bite') {
      this.biteT -= dt;
      this.float.position.y = surf(this.float.position.x, this.float.position.z) - 0.08 - Math.abs(Math.sin(t * 18)) * 0.06; // the float dips
      prompt = 'BITE! Press <kbd>Space</kbd> to strike!';
      if (hit) { this.startFight(); }
      else if (this.biteT <= 0) { this.state = 'wait'; this.waitT = 3 + Math.random() * 5; g.toast('Too slow — the fish took the bait and let go. Strike as soon as the float dips.', 'warn'); }
    } else if (this.state === 'fight') {
      const f = this.fight;
      f.phaseT -= dt;
      if (f.phaseT <= 0) { f.running = !f.running && f.stamina > 0; f.phaseT = f.running ? 1 + Math.random() * 1.8 : 1.2 + Math.random() * 1.5; }
      if (f.running) f.stamina -= dt;
      const pull = f.running ? f.pull : 0.08;
      if (space) { this.tension += (f.running ? 0.9 * pull + 0.15 : 0.15) * dt * 1.6; this.dist -= (f.running ? 0.6 : 3.2 + (1 - pull) * 2) * dt; }
      else { this.tension -= 0.7 * dt; if (f.running) this.dist += pull * 4.5 * dt; }
      this.tension = Math.max(0, this.tension);
      // The fish swims about at the end of the line; the line follows it.
      const away = this.float.position.clone().sub(eye).setY(0).normalize();
      f.swayT += dt * (f.running ? 2.2 : 0.8);
      const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(Math.sin(f.swayT) * Math.min(6, this.dist * 0.2));
      this.float.position.copy(eye).addScaledVector(away, Math.max(1.5, this.dist)).add(side);
      this.float.position.y = surf(this.float.position.x, this.float.position.z) - 0.05;
      if (f.running && Math.random() < dt * 3) g.fx.splash?.(this.float.position, 4);
      prompt = f.running ? 'The fish is RUNNING — ease off (let go of Space)' : 'It\'s resting — reel in! (hold <kbd>Space</kbd>)';
      if (this.tension >= 1) { this.lost('Snap! The line broke — too much tension while the fish was running.'); }
      else if (this.dist > MAX_LINE) { this.lost('The fish ran off all your line and got away.'); }
      else if (this.dist <= 2) { this.land(); }
      this.rod.rotation.x = THREE.MathUtils.damp(this.rod.rotation.x, 0.25 + this.tension * 0.6, 8, dt);
      this.rod.rotation.z = Math.sin(t * 9) * 0.04 * this.tension;
      $('#fh-tension').style.width = `${Math.min(100, this.tension * 100)}%`;
      $('#fh-tension').classList.toggle('hot', this.tension > 0.75);
      $('#fh-line').style.width = `${Math.min(100, (this.dist / MAX_LINE) * 100)}%`;
      $('#fh-dist').textContent = `${Math.round(this.dist)} m`;
      $('#fh-state').textContent = f.running ? 'RUNNING' : 'resting';
    } else if (this.state === 'landed') {
      if (this.held) { this.held.rotation.z = Math.sin(t * 7) * 0.25; }
    }
    // Line from the rod tip to the float / fish.
    this.line.visible = this.float.visible && ['flying', 'wait', 'bite', 'fight'].includes(this.state);
    if (this.line.visible) { const p = this.line.geometry.attributes.position; p.setXYZ(0, tipW.x, tipW.y, tipW.z); p.setXYZ(1, this.float.position.x, this.float.position.y + 0.04, this.float.position.z); p.needsUpdate = true; }
    $('#prompt').innerHTML = g.hint(prompt);
  }

  startFight() {
    const c = this.catch, F = FIGHT[c.id] ?? { pull: 0.5, stamina: 6 };
    const sizeK = c.length / 40;
    this.fight = { pull: Math.min(1, F.pull * (0.75 + 0.35 * sizeK)), stamina: F.stamina * (0.7 + 0.4 * sizeK), running: true, phaseT: 1.5, swayT: 0 };
    this.tension = 0.2; this.state = 'fight';
    this.hud.classList.remove('hidden');
    this.game.audio.play('trick', { combo: 0 });
    this.game.toast('Fish on! Let it run, then reel while it rests. Watch the tension.');
  }
  lost(msg) {
    this.hud.classList.add('hidden'); this.float.visible = false; this.state = 'ready';
    this.game.toast(msg, 'warn'); this.game.audio.play('warn');
  }
  land() {
    const g = this.game, c = this.catch;
    this.hud.classList.add('hidden'); this.float.visible = false; this.state = 'landed';
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
    g.onFishLanded(c, this.spot, () => { if (this.held) { g.camera.remove(this.held); this.held = null; } this.state = this.state === 'off' ? 'off' : 'ready'; });
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
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.014, 1.9, 8), blank); shaft.position.y = 1.1; pivot.add(shaft);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 16), reelM); reel.rotation.z = Math.PI / 2; reel.position.set(0, 0.1, 0.04); pivot.add(reel);
  const tip = new THREE.Group(); tip.position.y = 1.1; pivot.add(tip);
  g.userData.tip = tip;
  return Object.assign(g, {});
}
Object.defineProperty(Fishing.prototype, 'rodTip', { get() { return this.rod.userData.tip; } });
export { RULES, judge };
