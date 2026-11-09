// One person on the coast: the customisable angler rig with a fixed look, props, a name tag and a daily routine.
//   standing / sitting / fishing: walk to a named place and settle (fishers cast, wait, sometimes strike and land a fish, reel in and cast again)
//   walking: ping-pong along a path with a pause at each end        away: not on the coast right now (hidden)
// The manager (manager.js) gives each NPC its slot as the in-game time of day changes and calls update() every frame.
import * as THREE from 'three';
import { Angler } from '../land/angler.js';
import { damp, clamp, mulberry32 } from '../core/noise.js';
import { turnToward } from '../land/walker.js';
import { pathPosition } from './schedule.js';
import { buildProps } from './props.js';
import { buildFish } from '../life/fishModel.js';
import { LOOKS } from '../life/looks.js';
import '../fishing/fishLooks.js';

const WALK = 1.35, LINE_PTS = 14, CULL = 80;
const _v = new THREE.Vector3(), _tip = new THREE.Vector3(), _a = new THREE.Vector3(), _cam = new THREE.Vector3();
const fishCache = new Map();
const heldFish = id => {
  let m = fishCache.get(id);
  if (!m) {
    const look = LOOKS[id]; if (!look) return null;
    const built = buildFish({ ...look, length: 0.62 });
    m = { geometry: built.geometry, material: new THREE.MeshStandardMaterial({ map: built.texture, roughness: 0.45, side: THREE.DoubleSide }) };
    fishCache.set(id, m);
  }
  const mesh = new THREE.Mesh(m.geometry, m.material); mesh.rotation.set(Math.PI / 2, 0, 0); mesh.position.set(0.05, 0.1, 0.02);
  const g = new THREE.Group(); g.add(mesh); return g;
};
let floatParts = null;
const floatMesh = () => {
  floatParts ??= {
    body: new THREE.SphereGeometry(0.1, 12, 8), mat: new THREE.MeshStandardMaterial({ color: 0xf0442c, roughness: 0.4 }),
    top: new THREE.SphereGeometry(0.103, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.42), white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
  };
  const g = new THREE.Group(), b = new THREE.Mesh(floatParts.body, floatParts.mat), t = new THREE.Mesh(floatParts.top, floatParts.white);
  t.rotation.x = Math.PI; g.add(b, t); return g;
};

export class NPC {
  constructor(mgr, id, def, siteId) {
    this.mgr = mgr; this.id = id; this.def = def; this.siteId = siteId;
    const g = mgr.game, scene = g.scene;
    this.body = new Angler(scene, g.world.models, def.look, { lo: g.settings.quality === 'low', shadows: !!g.quality.shadows });
    this.root = this.body.root; this.root.visible = false; this.root.name = `npc-${id}`;
    this.scale = def.scale ?? 1; this.root.scale.setScalar(this.scale);
    this.body.rod.visible = false;
    if (def.look.rod != null) this.body.setAppearance({ rod: def.look.rod });
    this.extras = buildProps(def.props ?? [], this.body, g.world.models, g.world.props.mat);
    this.rnd = mulberry32(id.length * 977 + id.charCodeAt(0));
    this.pos = new THREE.Vector3(); this.heading = Math.PI; this.speed = 0;
    this.res = null; this.away = true; this.phase = 'idle'; this.placed = false;
    this.talking = false; this.faceAt = null;
    this.s = 0; this.dir = 1; this.pause = 0; this.sit = 0;
    this.fishes = Object.values(def.sites).some(s => Object.values(s).some(x => x.act === 'fishing'));
    this.tipPos = new THREE.Vector3();   // the rod tip while the line is out (lineSeg)
    this.fish = { phase: 'rest', t: 0, wait: 0, power: 0, target: new THREE.Vector3(), floatPos: new THREE.Vector3(), got: null };
    if (this.fishes) this.buildLine();
    this.el = mgr.labels.make(def.name, def.role); this.bubbleT = 0; this.markerKind = null;
    this.phaseSeed = this.rnd() * 6.28;
  }

  buildLine() {
    const scene = this.mgr.game.scene, pos = new Float32Array(LINE_PTS * 2 * 3), idx = [];
    for (let i = 0; i < LINE_PTS - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setIndex(idx);
    this.line = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1f3239, side: THREE.DoubleSide, fog: false }));
    this.line.frustumCulled = false; this.line.visible = false;
    this.float = floatMesh(); this.float.visible = false;
    scene.add(this.line, this.float);
  }
  drawLine(a, b, sag) {
    const p = this.line.geometry.attributes.position, cam = this.mgr.game.camera.position;
    const dx = b.x - a.x, dz = b.z - a.z, ln = Math.hypot(dx, dz) || 1, sx = -dz / ln, sz = dx / ln;
    for (let i = 0; i < LINE_PTS; i++) {
      const k = i / (LINE_PTS - 1), s4 = 4 * k * (1 - k);
      _v.set(a.x + dx * k + sx * sag * 0.3 * s4, a.y + (b.y + 0.1 - a.y) * k - sag * s4, a.z + dz * k + sz * sag * 0.3 * s4);
      _a.set(dx, b.y - a.y, dz).normalize(); _cam.subVectors(cam, _v).normalize();
      _a.cross(_cam).normalize().multiplyScalar(0.016 * (1 + (1 - k) * 0.6));
      p.setXYZ(i * 2, _v.x - _a.x, _v.y - _a.y, _v.z - _a.z); p.setXYZ(i * 2 + 1, _v.x + _a.x, _v.y + _a.y, _v.z + _a.z);
    }
    p.needsUpdate = true;
  }

  // ------------------------------------------------------------------ schedule
  /** Take a resolved slot (schedule.resolveSlot). snap: appear at the place at once (site load / first frame) instead of walking there. */
  setSlot(res, snap = false) {
    this.res = res;
    if (res.away) { this.away = true; this.root.visible = false; this.hideFishing(); return; }
    const wasAway = this.away; this.away = false;
    const p0 = res.points[0], path = res.act === 'walking' && res.points.length > 1;
    this.len = 0;
    if (path) for (let i = 0; i < res.points.length - 1; i++) this.len += Math.hypot(res.points[i + 1].x - res.points[i].x, res.points[i + 1].z - res.points[i].z);
    if (snap || !this.placed || wasAway) {
      if (path) { this.s = this.rnd() * this.len; this.dir = this.rnd() < 0.5 ? 1 : -1; const q = pathPosition(res.points, this.s); this.pos.set(q.x, 0, q.z); this.heading = (q.heading ?? 0) + (this.dir < 0 ? Math.PI : 0); this.phase = 'path'; }
      else { this.pos.set(p0.x, 0, p0.z); this.heading = res.heading ?? this.heading; this.phase = 'settled'; }
      this.placed = true;
      this.fish.phase = 'rest'; this.fish.t = 0.5 + this.rnd() * 3;
    } else this.phase = 'approach';
    this.pause = 0;
    if (this.root.visible === false) this.root.visible = true;
  }
  hideFishing() { if (this.line) { this.line.visible = false; this.float.visible = false; } if (this.body.holding) this.body.hold(null); }

  get act() { return this.res?.act ?? 'away'; }

  // ------------------------------------------------------------------ per frame
  /** env: { world, player (Vector3), t, shown (show the name tag) } */
  update(dt, t, env) {
    if (this.away) { this.hideLabels(); return; }
    const world = env.world, res = this.res;
    // Movement
    let speed = 0, mx = 0, mz = 0, face = null;
    if (this.talking && this.faceAt) { face = Math.atan2(this.faceAt.x - this.pos.x, this.faceAt.z - this.pos.z); }
    else if (this.phase === 'approach') {
      const tgt = res.act === 'walking' && res.points.length > 1 ? res.points[0] : res.points[0];
      const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { this.phase = res.act === 'walking' && res.points.length > 1 ? 'path' : 'settled'; this.s = 0; this.dir = 1; }
      else { mx = dx / d; mz = dz / d; speed = WALK; }
    } else if (this.phase === 'path') {
      if (this.pause > 0) this.pause -= dt;
      else {
        this.s += this.dir * WALK * dt; speed = WALK;
        if (this.s >= this.len) { this.s = this.len; this.dir = -1; this.pause = 2 + this.rnd() * 3; }
        else if (this.s <= 0) { this.s = 0; this.dir = 1; this.pause = 2 + this.rnd() * 3; }
        const q = pathPosition(res.points, this.s), h = (q.heading ?? this.heading) + (this.dir < 0 ? Math.PI : 0);
        mx = Math.sin(h); mz = Math.cos(h);
        this.pos.x = q.x; this.pos.z = q.z; speed = this.pause > 0 ? 0 : WALK;
      }
    }
    if (this.phase !== 'path' && speed > 0) { this.pos.x += mx * speed * dt; this.pos.z += mz * speed * dt; }
    if (speed > 0 && !this.talking) face = Math.atan2(mx, mz);
    else if (face == null && (this.phase === 'settled' || this.pause > 0)) {
      if (res.heading != null) {
        const scan = this.def.props?.includes('binoculars') ? Math.sin(t * 0.35 + this.phaseSeed) * 0.55 : 0;
        face = res.heading + scan;
      }
    }
    if (face != null) this.heading = turnToward(this.heading, face, (speed > 0 ? 9 : 4) * dt);
    this.speed = damp(this.speed, speed, 8, dt);
    this.pos.y = world.walkAt(this.pos.x, this.pos.z);

    // Distance culling: far-away people are hidden and skipped.
    const dp = Math.hypot(this.pos.x - env.player.x, this.pos.z - env.player.z);
    this.dist = dp;
    const far = dp > CULL;
    this.root.visible = !far;
    if (far) { this.hideLabels(); if (this.line) this.line.visible = this.float.visible = false; return; }

    // Pose
    const settled = this.phase === 'settled' && !this.talking && this.speed < 0.2;
    let state = 'off', power = 0, act = 0;
    if (res.act === 'fishing' && settled) { const f = this.fishStep(dt, t, world); state = f.state; power = f.power; act = f.act; }
    else { this.hideFishing(); if (this.fish.phase !== 'rest') { this.fish.phase = 'rest'; this.fish.t = 0.6; } }
    this.root.position.copy(this.pos); this.root.rotation.y = this.heading;
    this.body.update(dt, t, { speed: this.speed, state, power, act, reducedMotion: this.mgr.game.settings.reducedMotion });
    if (this.fish.phase === 'rest' && state === 'off') this.body.rod.visible = false;
    this.applySit(dt, res.act === 'sitting' && settled);

    // Labels (HTML over the canvas): the name tag on approach, a request marker, and a speech bubble
    // The name shows only close up (about talking distance and a bit); a request marker can be seen from across the beach, on its own.
    const L = this.mgr.labels, top = 1.62 * this.scale, shown = (dp < 6.5 || this.talking) && !this.mgr.hideTags, marked = !!this.markerKind && (dp < 40 || this.talking) && !this.mgr.hideTags;
    this.el.tag.classList.toggle('show', shown); this.el.mark.classList.toggle('show', marked);
    if (shown && !L.place(this.el.tag, this.pos.x, this.pos.y + top + 0.35, this.pos.z, 0, 0, 60)) this.el.mark.style.visibility = 'hidden';
    else if (marked) L.place(this.el.mark, this.pos.x, this.pos.y + top + 0.35, this.pos.z, shown ? 22 : 0, shown ? this.el.tag.offsetWidth / 2 + 2 : 0, 50);
    if (this.bubbleT > 0 && this.mgr.hideTags) this.clearBubble();
    if (this.bubbleT > 0) {
      this.bubbleT -= dt;
      L.place(this.el.bubble, this.pos.x, this.pos.y + top + 0.35, this.pos.z, 54, 0, 165);
      this.el.bubble.classList.toggle('show', this.bubbleT > 0.4);
      if (this.bubbleT <= 0) this.clearBubble();
    }
  }
  hideLabels() { this.el.tag.classList.remove('show'); this.el.mark.classList.remove('show'); if (this.bubbleT > 0) this.clearBubble(); }

  /** Sitting: thighs forward, knees bent, hips dropped onto the stool. Applied after the body's own pose update. */
  applySit(dt, on) {
    this.sit = damp(this.sit, on ? 1 : 0, 6, dt);
    const k = this.sit, J = this.body.joints;
    if (this.extras.stool) this.extras.stool.visible = k > 0.5;
    if (k < 0.01) return;
    J.hips.position.y -= 0.255 * k;
    for (const s of ['L', 'R']) { J['thigh' + s].rotation.x = THREE.MathUtils.lerp(J['thigh' + s].rotation.x, -1.5, k); J['knee' + s].rotation.x = THREE.MathUtils.lerp(J['knee' + s].rotation.x, 1.45, k); }
    J.armL.rotation.x = THREE.MathUtils.lerp(J.armL.rotation.x, -0.7, k * 0.8); J.armR.rotation.x = THREE.MathUtils.lerp(J.armR.rotation.x, -0.7, k * 0.8);
  }

  // ------------------------------------------------------------------ the fishing routine
  /** Cast -> wait -> (bite -> fight -> land a fish) or (reel in) -> rest -> cast again. Returns the angler pose { state, power, act }. */
  fishStep(dt, t, world) {
    const F = this.fish, body = this.body;
    F.t -= dt;
    let state = 'ready', power = 0, act = 0;
    const tip = body.rodTip.getWorldPosition(_tip); this.tipPos.copy(tip);
    const cast = this.def.cast ?? 9;
    const surf = (x, z) => world.surfaceAt(x, z);
    switch (F.phase) {
      case 'rest':
        state = 'ready'; this.line.visible = this.float.visible = false;
        if (F.t <= 0) { F.phase = 'charge'; F.t = 0.9; F.power = 0; }
        break;
      case 'charge':
        F.power = clamp(1 - F.t / 0.9, 0, 1) * 0.85; state = 'charge'; power = F.power;
        if (F.t <= 0) {
          const h = this.heading, r = cast * (0.8 + this.rnd() * 0.45);
          F.target.set(this.pos.x + Math.sin(h) * r, 0, this.pos.z + Math.cos(h) * r); F.target.y = surf(F.target.x, F.target.z);
          F.from = tip.clone(); F.phase = 'flying'; F.t = 0.8;
        }
        break;
      case 'flying': {
        state = 'flying'; const k = clamp((0.8 - F.t - 0.2) / 0.6, 0, 1);   // rides the tip through the snap, then flies
        if (F.t > 0.6) F.from.copy(tip);
        F.floatPos.lerpVectors(F.from, F.target, k); F.floatPos.y = THREE.MathUtils.lerp(F.from.y, F.target.y, k) + Math.sin(k * Math.PI) * 2.2;
        this.float.visible = true;
        if (F.t <= 0) { F.phase = 'wait'; F.t = 5 + this.rnd() * 7; F.bite = this.rnd() < 0.62; this.mgr.splash(F.target, 5); }
        break;
      }
      case 'wait':
        state = 'wait'; F.floatPos.copy(F.target); F.floatPos.y = surf(F.target.x, F.target.z) + Math.sin(t * 2.2 + this.phaseSeed) * 0.02;
        if (F.t <= 0) { if (F.bite) { F.phase = 'bite'; F.t = 0.9; } else { F.phase = 'reel'; F.t = 1.1; } }
        break;
      case 'bite':
        state = 'bite'; F.floatPos.copy(F.target); F.floatPos.y = surf(F.target.x, F.target.z) - 0.08 - Math.abs(Math.sin(t * 18)) * 0.06;
        if (F.t <= 0) { F.phase = 'fight'; F.t = 3.2 + this.rnd() * 1.6; F.total = F.t; }
        break;
      case 'fight': {
        state = 'fight'; act = 0.55 + 0.45 * Math.sin(t * 5.1);
        const k = clamp(1 - F.t / F.total, 0, 1), fx = this.pos.x + (F.target.x - this.pos.x) * (1 - k * 0.8), fz = this.pos.z + (F.target.z - this.pos.z) * (1 - k * 0.8);
        F.floatPos.set(fx + Math.sin(t * 4) * 0.5 * (1 - k), surf(fx, fz) - 0.04, fz + Math.cos(t * 3.4) * 0.5 * (1 - k));
        if (act > 0.7 && this.rnd() < dt * 3) this.mgr.splash(F.floatPos, 3);
        if (F.t <= 0) {
          F.phase = 'landed'; F.t = 2.6; this.float.visible = false; this.line.visible = false;
          const list = this.def.catches?.[this.siteId] ?? ['yellowfinbream'], id = list[Math.floor(this.rnd() * list.length)];
          F.got = id; const obj = heldFish(id); if (obj) body.hold(obj);
          this.mgr.audioAt('splash', this.pos);
          if (this.rnd() < 0.5) this.say('Got one!', 2.4);
        }
        break;
      }
      case 'landed':
        state = 'landed'; this.line.visible = this.float.visible = false;
        if (F.t <= 0) { body.hold(null); F.got = null; F.phase = 'rest'; F.t = 1 + this.rnd() * 2.5; }
        break;
      case 'reel':
        state = 'ready'; { const k = clamp(1 - F.t / 1.1, 0, 1); F.floatPos.lerpVectors(F.target, tip, k * 0.95); F.floatPos.y = surf(F.floatPos.x, F.floatPos.z) + 0.05 + k * 1.2; }
        if (F.t <= 0) { F.phase = 'rest'; F.t = 0.8 + this.rnd() * 2; this.float.visible = false; this.line.visible = false; }
        break;
    }
    if (this.float.visible || ['flying', 'wait', 'bite', 'fight', 'reel'].includes(F.phase)) {
      const showing = ['flying', 'wait', 'bite', 'fight', 'reel'].includes(F.phase);
      this.float.visible = this.line.visible = showing;
      if (showing) {
        this.float.position.copy(F.floatPos);
        this.drawLine(tip, F.floatPos, ['wait', 'bite'].includes(F.phase) ? 0.5 : F.phase === 'fight' ? 0.12 : 0.25);
      }
    }
    return { state, power, act };
  }

  /** The line this person has in the water as { a: rod tip, b: float } (x, z used) while they wait on a bite, else null: what your cast is checked against (fishing/snags.js crosses). */
  lineSeg() { const F = this.fish; return this.fishes && !this.away && this.root.visible && F.phase === 'wait' ? { a: this.tipPos, b: F.floatPos } : null; }

  // ------------------------------------------------------------------ labels, talking
  say(text, secs = 4.2) {
    this.el.bubble.innerHTML = text.replace(/<[^>]+>/g, '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    this.bubbleT = secs; this.el.bubble.classList.add('show');
  }
  clearBubble() { this.bubbleT = 0; this.el.bubble.classList.remove('show'); }
  /** '!' = a request on offer, 'ok' = something to hand in, null = nothing. */
  setMarker(kind) {
    if (kind === this.markerKind) return;
    this.markerKind = kind;
    this.el.mark.textContent = kind === 'ok' ? '✓' : '!'; this.el.mark.dataset.kind = kind ?? '';
  }
  dispose() {
    this.mgr.labels.remove(this.el);
    if (this.line) { this.line.geometry.dispose(); this.line.material.dispose(); this.line.parent?.remove(this.line); this.float.parent?.remove(this.float); }
    this.body.hold(null);
    this.root.traverse(o => { if (o.isMesh && o.userData.ownGeo) o.geometry.dispose(); });
    for (const m of Object.values(this.body.mats)) m.dispose();
    this.root.parent?.remove(this.root);
  }
}
