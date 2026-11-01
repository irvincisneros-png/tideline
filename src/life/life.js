// Marine life: builds models for every species in an ecosystem and runs their behaviour.
import * as THREE from 'three';
import { buildFish, buildRay } from './fishModel.js';
import { LOOKS } from './looks.js';
import { anemone, cots, seaCucumber, turtle as buildTurtle, giantClam } from '../world/coral.js';
import * as M2 from './models2.js';
import * as FL from '../world/flora.js';
import { patchUnderwater } from '../ocean/shaders.js';
import { mulberry32, clamp } from '../core/noise.js';

// Behaviour parameters per species id. Ecosystems may add entries via registerBehaviour().
export const BEHAVIOUR = {
  clownfish: { type: 'host', speed: 0.25, flee: 1.5 },
  bluetang: { type: 'wander', radius: 5, speed: 0.4, alt: [0.8, 3], flee: 2.5, nearCoral: 'staghorn' },
  moorishidol: { type: 'pair', radius: 12, speed: 0.35, alt: [1, 4], flee: 2.5 },
  cleanerwrasse: { type: 'cleaner', speed: 0.35, flee: 0.8 },
  parrotfish: { type: 'grazer', radius: 18, speed: 0.55, alt: [0.6, 3], flee: 3, client: true },
  humpheadwrasse: { type: 'wander', radius: 28, speed: 0.4, alt: [1.2, 5], flee: 2, curious: true, client: true },
  coraltrout: { type: 'ambush', radius: 6, speed: 0.3, alt: [0.6, 2], flee: 2.5, client: true },
  chromis: { type: 'school', speed: 0.3, alt: [0.4, 1.6], flee: 3, hide: true, groupSize: 35, nearCoral: 'staghorn' },
  trevally: { type: 'vortex', speed: 1.1, alt: [5, 9], flee: 3, groupSize: 60 },
  butterflyfish: { type: 'pair', radius: 10, speed: 0.3, alt: [0.5, 2], flee: 2 },
  angelfish: { type: 'wander', radius: 6, speed: 0.25, alt: [0.5, 2], flee: 4 },
  boxfish: { type: 'wander', radius: 6, speed: 0.15, alt: [0.6, 2.5], flee: 1.5 },
  reefshark: { type: 'patrol', speed: 1.0, flee: 7 },
  manta: { type: 'manta', speed: 0.8, flee: 2.5, client: true },
  bluespottedray: { type: 'rest', speed: 0.8, flee: 2.5 },
  turtle: { type: 'turtle', speed: 0.35, flee: 2.5 },
  giantclam: { type: 'clam' },
  anemone: { type: 'static' },
  cots: { type: 'static' },
  seacucumber: { type: 'crawl', speed: 0.01 },
};
/** A hand-shaped fish model (vertex colours, head +x) scaled to the species' length, with the attributes the fish shader expects. */
function fromModel(src, look) {
  const g = src.clone();
  g.computeBoundingBox();
  const bb = g.boundingBox, L = bb.max.x - bb.min.x;
  g.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -(bb.max.z + bb.min.z) / 2);
  g.scale(look.length / L, look.length / L, look.length / L);
  const n = g.attributes.position.count, fin = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) fin[i * 2 + 1] = -1; // whole model treated as body (no fin translucency)
  g.setAttribute('aFin', new THREE.BufferAttribute(fin, 2));
  return { geometry: g, texture: null, emissive: null, length: look.length };
}
export function registerBehaviour(id, b) { BEHAVIOUR[id] = b; }
const STATIC_GEN = {
  anemone, cots, seacucumber: seaCucumber,
  urchin: FL.urchin, abalone: FL.abalone, cunjevoi: FL.cunjevoi,
  rocklobster: M2.rockLobster, octopus: M2.octopus, seahare: M2.seaHare, seahorse: M2.seahorse, seadragon: M2.seadragon,
  crab: M2.crab, jellyfish: M2.jellyfish, bluebottle: M2.bluebottle, salp: M2.salpChain, siphonophore: M2.siphonophore,
  combjelly: M2.combJelly, vampiresquid: M2.vampireSquid, isopod: M2.isopod, brittlestar: M2.brittleStar,
};
export function registerStatic(id, fn) { STATIC_GEN[id] = fn; }
export function registerLook(id, look) { LOOKS[id] = look; }

const FWD = new THREE.Vector3(1, 0, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function orient(q, dir, roll = 0) {
  // Basis with +x along dir, keeping the fish upright.
  const f = _v.copy(dir).normalize();
  const side = _w.crossVectors(f, _up);
  if (side.lengthSq() < 1e-6) side.set(0, 0, 1);
  side.normalize();
  const up = new THREE.Vector3().crossVectors(side, f).normalize();
  _m.makeBasis(f, up, side);
  q.setFromRotationMatrix(_m);
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(FWD, roll));
  return q;
}

export class Life {
  constructor(scene, eco, terrain, reef, particles, quality, seed = 5, art = null) {
    this.art = art;
    this.scene = scene; this.eco = eco; this.terrain = terrain; this.reef = reef; this.fx = particles;
    this.group = new THREE.Group(); scene.add(this.group);
    this.agents = []; this.kinds = {}; this.rigs = [];
    this.rnd = mulberry32(seed);
    this.time = 0;
    this.station = eco.station ? new THREE.Vector3(eco.station.x, terrain.heightAt(eco.station.x, eco.station.z) + 0.9, eco.station.z) : null;
    this.visit = { client: null, cooldown: 4 };
    this.population = 1; // health-lab scaling of fish abundance
    for (const [id, n0] of Object.entries(eco.life)) {
      // Schools scale with the tier; common reef fish (4–20) get denser too. Rare animals, hosts and statics stay as set.
      const t = BEHAVIOUR[id]?.type ?? 'wander';
      const k = n0 > 20 ? quality.fishScale : n0 >= 4 && ['wander', 'grazer', 'pair', 'patrol', 'school'].includes(t) ? quality.reefFish ?? 1 : 1;
      const n = Math.max(1, Math.round(n0 * k));
      this.spawnSpecies(id, n);
    }
  }

  coralSpots(id) { return this.reef.picks.filter(p => p.id === id); }
  randomSand() {
    const b = this.eco.bounds;
    for (let i = 0; i < 200; i++) {
      const x = b.xMin + this.rnd() * (b.xMax - b.xMin), z = b.zMin + this.rnd() * (b.zMax - b.zMin);
      if (this.eco.reefiness(x, z) < 0.15) return new THREE.Vector3(x, this.terrain.heightAt(x, z), z);
    }
    return new THREE.Vector3(0, this.terrain.heightAt(0, 30), 30);
  }
  randomReef(minDepth = -30, maxDepth = -2) {
    if (this.eco.reefRange) [minDepth, maxDepth] = this.eco.reefRange;
    const b = this.eco.bounds;
    for (let i = 0; i < 300; i++) {
      const x = b.xMin + this.rnd() * (b.xMax - b.xMin), z = b.zMin + this.rnd() * (b.zMax - b.zMin);
      const h = this.terrain.heightAt(x, z);
      if (this.eco.reefiness(x, z) > 0.4 && h > minDepth && h < maxDepth) return new THREE.Vector3(x, h, z);
    }
    return new THREE.Vector3(0, this.terrain.heightAt(0, -20), -20);
  }

  makeInstanced(id, n) {
    const look = LOOKS[id];
    const model = !look.kind && this.art?.fish?.[id] && this.art.models.get(this.art.fish[id]);
    const built = model ? fromModel(model, look) : look.kind ? buildRay(look) : buildFish(look);
    const mat = new THREE.MeshStandardMaterial({ map: built.texture, vertexColors: !!model, roughness: look.metal ? 0.3 : (look.rough ?? 0.42), metalness: look.metal ?? 0.05, side: THREE.DoubleSide });
    if (!look.kind && !look.transparent) mat.alphaToCoverage = true; // soft fin edges (needs MSAA; otherwise fins are simply opaque)
    if (built.emissive) { mat.emissiveMap = built.emissive; mat.emissive = new THREE.Color(0xffffff); mat.emissiveIntensity = look.glowIntensity ?? 2.5; }
    if (look.transparent) { mat.transparent = true; mat.opacity = look.transparent; mat.depthWrite = false; }
    patchUnderwater(mat, { fish: !look.kind, swim: true, swimLength: built.length, flap: !!look.kind || !!look.flap, waveK: look.kind ? 2.5 : (look.waveK ?? 6.0), vertical: !!look.vertical });
    const swim = new Float32Array(n * 2);
    built.geometry.setAttribute('aSwim', new THREE.InstancedBufferAttribute(swim, 2).setUsage(THREE.DynamicDrawUsage));
    const im = new THREE.InstancedMesh(built.geometry, mat, n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    this.group.add(im);
    this.kinds[id] = { mesh: im, swim, length: built.length, look };
    return this.kinds[id];
  }

  spawnSpecies(id, n) {
    const b = BEHAVIOUR[id] ?? { type: 'wander', radius: 8, speed: 0.3, alt: [1, 3], flee: 2 };
    const rnd = this.rnd;
    if (b.type === 'turtle') { for (let i = 0; i < n; i++) this.spawnTurtle(i, id, b); return; }
    if (b.type === 'clam') { for (let i = 0; i < n; i++) this.spawnClam(i); return; }
    if (b.type === 'cloud') { this.spawnCloud(id, b); return; }
    if (['static', 'crawl', 'drift', 'hover'].includes(b.type)) { this.spawnStatic(id, n, b); return; }
    const kind = this.makeInstanced(id, n);
    let groupHome = null, groupId = 0;
    const corals = b.nearCoral ? this.coralSpots(b.nearCoral) : [];
    for (let i = 0; i < n; i++) {
      let home;
      if (b.type === 'host') {
        const an = this.eco.anemones[i % this.eco.anemones.length];
        home = new THREE.Vector3(an[0], this.terrain.heightAt(an[0], an[1]) + 0.25, an[1]);
      } else if (b.type === 'cleaner') {
        home = this.station.clone();
      } else if (b.groupSize) {
        if (i % b.groupSize === 0) {
          groupId++;
          const c = corals.length ? corals[Math.floor(rnd() * corals.length)] : null;
          groupHome = b.at ? new THREE.Vector3(b.at[0] + (rnd() - 0.5) * (b.spread ?? 0), 0, b.at[1] + (rnd() - 0.5) * (b.spread ?? 0))
            : b.type === 'vortex' ? new THREE.Vector3(-10 + rnd() * 20, 0, -62 + rnd() * 10) : c ? new THREE.Vector3(c.x, c.y, c.z) : this.randomReef(-12, -3);
          groupHome.y = b.y !== undefined ? b.y : this.terrain.heightAt(groupHome.x, groupHome.z) + (b.alt[0] + b.alt[1]) / 2;
        }
        home = groupHome.clone();
      } else if (b.type === 'pair' && i % 2 === 1) {
        home = this.agents[this.agents.length - 1].home.clone();
      } else if (b.type === 'rest') {
        home = this.randomSand();
      } else if (b.at) {
        home = new THREE.Vector3(b.at[0] + (rnd() - 0.5) * (b.spread ?? 10), 0, b.at[1] + (rnd() - 0.5) * (b.spread ?? 10));
        home.y = b.y !== undefined ? b.y + (rnd() - 0.5) * 2 : this.terrain.heightAt(home.x, home.z) + (b.alt ? (b.alt[0] + b.alt[1]) / 2 : 2);
      } else if (corals.length) {
        const c = corals[Math.floor(rnd() * corals.length)];
        home = new THREE.Vector3(c.x, c.y + 1, c.z);
      } else {
        home = this.randomReef(-16, -3); home.y += 1.5;
      }
      // Never spawn (or anchor) an animal inside the seabed.
      const clear = (b.alt?.[0] ?? 1) + 0.5;
      home.y = Math.max(home.y, this.terrain.heightAt(home.x, home.z) + clear);
      const pos = home.clone().add(new THREE.Vector3((rnd() - 0.5) * 3, (rnd() - 0.2) * 1, (rnd() - 0.5) * 3));
      pos.y = Math.max(pos.y, this.terrain.heightAt(pos.x, pos.z) + clear);
      if (b.type === 'patrol') { const c = b.center ?? [0, -45]; pos.set(c[0] + Math.cos(i * 2) * 30, b.y ?? -12, c[1] + Math.sin(i * 2) * 25); }
      if (b.type === 'migrate') pos.set(-120 + i * 25, b.y ?? -8, (b.lane ?? 0) + i * 6);
      if (b.type === 'bird') pos.set(home.x, 4, home.z);
      if (b.type === 'manta') pos.set(-30, -8, -60);
      const a = {
        id, b, kind, index: i, home, pos, vel: new THREE.Vector3((rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2), dir: new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize(),
        phase: rnd() * 10, scale: 0.8 + rnd() * 0.35, target: pos.clone(), timer: rnd() * 5, state: 'idle', group: b.groupSize ? groupId : (b.type === 'pair' ? Math.floor(i / 2) : -1),
        cleaning: false, grazing: false, threat: 0, radius: Math.max(0.18, kind.length * 0.55), visible: true, ang: rnd() * 6.28, orbit: 3 + rnd() * 4,
      };
      if (b.type === 'pair' && i % 2 === 1) a.leader = this.agents[this.agents.length - 1];
      if (b.type === 'breather' || b.type === 'migrate') { a.state = 'cruise'; a.timer = (b.breathEvery ?? 40) * (0.3 + rnd()); }
      this.agents.push(a);
    }
  }

  /** Plankton clouds: shimmering motes (no mesh) with an invisible pick target at the centre. */
  spawnCloud(id, b) {
    const n = Math.round((b.count ?? 1200));
    const R = b.radius ?? 6;
    const c = b.at ? new THREE.Vector3(b.at[0], b.y ?? -6, b.at[1]) : this.randomReef(-15, -3).add(new THREE.Vector3(0, 3, 0));
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = R * Math.cbrt(this.rnd()), th = this.rnd() * 6.283, ph = Math.acos(2 * this.rnd() - 1);
      pos[i * 3] = c.x + r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = c.y + r * Math.cos(ph) * 0.6; pos[i * 3 + 2] = c.z + r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: new THREE.Color(...(b.color ?? [0.5, 0.9, 0.5])), size: b.size ?? 0.05, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    this.group.add(pts);
    this.agents.push({ id, b, pos: c, home: c.clone(), vel: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), radius: R * 0.45, scale: 1, static: true, cloud: pts, phase: 0 });
  }

  spawnStatic(id, n, b) {
    const gen = STATIC_GEN[b.gen ?? id];
    if (!gen) return;
    // Cosy look: a hand-shaped model if the site's set has one for this creature.
    const model = this.art?.statics?.[id] && this.art.models.get(this.art.statics[id]);
    const geo = model ? model.clone() : gen(3 + n, b.opts ?? {});
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: b.rough ?? 0.7, side: b.doubleSide ? THREE.DoubleSide : THREE.FrontSide });
    if (b.transparent) { mat.transparent = true; mat.opacity = b.transparent; mat.depthWrite = false; }
    if (b.emissive) { mat.emissive = new THREE.Color(...b.emissive); mat.emissiveIntensity = b.emissiveIntensity ?? 1; }
    patchUnderwater(mat, { sway: id === 'anemone' ? 0.9 : (b.sway ?? 0), pulse: !!b.pulse, key: 'st' + id });
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(im);
    const kind = { mesh: im, length: 0.5 };
    this.kinds[id] = kind;
    const tables = this.coralSpots('tablecoral').concat(this.coralSpots('staghorn'));
    for (let i = 0; i < n; i++) {
      let pos;
      if (id === 'anemone') { const an = this.eco.anemones[i % this.eco.anemones.length]; pos = new THREE.Vector3(an[0], this.terrain.heightAt(an[0], an[1]) - 0.02, an[1]); }
      else if (id === 'cots' && tables.length) {
        const c = tables[Math.floor(this.rnd() * tables.length)];
        pos = new THREE.Vector3(c.x + (this.rnd() - 0.5) * 0.4, c.y + c.r * 0.35, c.z + (this.rnd() - 0.5) * 0.4);
      } else if (b.place) pos = this.placeAt(b.place, b);
      else if (id === 'cots' || b.type === 'static') { pos = this.randomReef(-14, -3); }
      else pos = this.randomSand();
      if (id === 'cots' && !tables.length) pos.y += 0.05;
      const sc = b.scale ? b.scale[0] + this.rnd() * (b.scale[1] - b.scale[0]) : 0.85 + this.rnd() * 0.3;
      const a = { id, b, kind, index: i, pos, home: pos.clone(), dir: new THREE.Vector3(Math.cos(i * 2.4), 0, Math.sin(i * 2.4)), vel: new THREE.Vector3(), scale: sc, radius: (b.radius ?? (id === 'anemone' ? 0.45 : 0.3)), static: true, phase: this.rnd() * 6, timer: 0 };
      this.agents.push(a);
      this.writeMatrix(a);
    }
    im.instanceMatrix.needsUpdate = true;
  }

  /** Where to put a sessile/slow creature: eco-supplied placers first, then generic ones. */
  placeAt(place, b) {
    const custom = this.eco.placers?.[place];
    if (custom) return custom(this.rnd, this.terrain, this);
    const [d0, d1] = b.depth ?? [-14, -2];
    if (place === 'sand') return this.randomSand();
    if (place === 'water' || place === 'surface') {
      const bd = this.eco.bounds;
      const x = bd.xMin + this.rnd() * (bd.xMax - bd.xMin), z = bd.zMin + this.rnd() * (bd.zMax - bd.zMin);
      const g = this.terrain.heightAt(x, z);
      const y = place === 'surface' ? -0.04 : Math.max(g + 1.5, d0 + this.rnd() * (d1 - d0));
      return new THREE.Vector3(x, y, z);
    }
    if (place.startsWith('coral:')) {
      const spots = place.slice(6).split(',').flatMap(k => this.coralSpots(k));
      if (spots.length) { const c = spots[Math.floor(this.rnd() * spots.length)]; return new THREE.Vector3(c.x + (this.rnd() - 0.5) * c.r, c.y + c.r * (b.onTop ?? 0.4), c.z + (this.rnd() - 0.5) * c.r); }
    }
    return this.randomReef(d0, d1);
  }

  spawnTurtle(i, id = 'turtle', b = BEHAVIOUR.turtle) {
    const rig = buildTurtle(10 + i, b.colors);
    for (const m of rig.group.userData.materials) patchUnderwater(m);
    rig.group.scale.setScalar(1.0);
    this.group.add(rig.group);
    const pos = this.randomReef(-9, -3); pos.y += 2;
    if (b.at) { pos.set(b.at[0] + (this.rnd() - 0.5) * 20, b.y ?? (this.terrain.heightAt(b.at[0], b.at[1]) + 1.5), b.at[1] + (this.rnd() - 0.5) * 20); }
    rig.group.scale.setScalar(b.size ?? 1);
    const a = { id, b, rig, pos, home: pos.clone(), vel: new THREE.Vector3(0.2, 0, 0), dir: new THREE.Vector3(1, 0, 0), phase: 0, timer: 20 + i * 25, state: 'cruise', target: pos.clone(), radius: 0.6 * (b.size ?? 1), scale: 1 };
    this.agents.push(a); this.rigs.push(a);
  }
  spawnClam(i) {
    const rig = giantClam(20 + i);
    for (const m of rig.group.userData.materials) patchUnderwater(m);
    const pos = this.randomReef(-10, -3);
    rig.group.position.copy(pos); rig.group.position.y -= 0.12;
    rig.group.rotation.y = this.rnd() * 6.28;
    rig.group.scale.setScalar(1.1 + this.rnd() * 0.4);
    this.group.add(rig.group);
    const a = { id: 'giantclam', b: BEHAVIOUR.giantclam, rig, pos: pos.clone().add(new THREE.Vector3(0, 0.25, 0)), home: pos.clone(), vel: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), open: 1, timer: 0, radius: 0.6, scale: 1, static: true };
    this.agents.push(a); this.rigs.push(a);
  }

  writeMatrix(a) {
    if (!a.kind) return;
    orient(_q, a.dir, a.roll ?? 0);
    const s = a.visible === false ? 0.0001 : a.scale;
    _m.compose(a.pos, _q, _s.set(s, s, s));
    a.kind.mesh.setMatrixAt(a.index, _m);
  }

  /** Steering helpers */
  seek(a, target, speed) {
    const d = _v.subVectors(target, a.pos);
    const dist = d.length();
    if (dist < 1e-3) return new THREE.Vector3();
    const arrive = Math.min(1, dist / 1.5);
    return d.multiplyScalar(speed * arrive / dist);
  }

  update(dt, diver) {
    this.time += dt;
    const rnd = this.rnd;
    const T = this.time;
    const dpos = diver?.pos, dvel = diver?.speed ?? 0, diverActive = !!diver?.active;
    this.updateVisits(dt);
    for (const a of this.agents) {
      a.cleaning = false; a.grazing = false;
      if (a.state !== 'pose') a.roll = 0;
      a.hunting = false; a.escaping = false;
      if (a.static && !a.rig) {
        if (a.b.type === 'crawl') this.crawl(a, dt);
        else if (a.b.type === 'drift') this.drift(a, dt);
        else if (a.b.type === 'hover') this.hover(a, dt);
        continue;
      }
      if (a.rig) { a.b.type === 'turtle' ? this.updateTurtle(a, dt, dpos) : this.updateClam(a, dt, dpos, dvel, diverActive); continue; }
      const b = a.b;
      if (a.visible === false) { this.writeMatrix(a); continue; } // removed by a lab scenario: takes no part in the ecosystem
      let desired = new THREE.Vector3();
      const sp = b.speed;
      // Threat from the diver: faster approach = bigger reaction.
      a.threat = 0;
      if (diverActive && dpos) {
        const d = a.pos.distanceTo(dpos);
        const fr = (b.flee ?? 2) * (0.6 + dvel * 0.5);
        if (d < fr) a.threat = (fr - d) / fr;
      }
      switch (b.type) {
        case 'host': {
          if (rnd() < dt * 0.8) a.target.copy(a.home).add(new THREE.Vector3((rnd() - 0.5) * 0.7, rnd() * 0.35, (rnd() - 0.5) * 0.7));
          desired = this.seek(a, a.threat > 0.2 ? a.home : a.target, sp * (1 + a.threat * 2));
          break;
        }
        case 'wander': case 'grazer': case 'ambush': {
          a.timer -= dt;
          if (a.state === 'leave' && a.timer < 0) a.state = 'idle';
          if (a.state === 'visit' || a.state === 'pose') { desired = this.clientSteer(a, dt); break; }
          if (b.type === 'grazer' && a.state === 'bite') {
            desired = this.seek(a, a.target, 0.2);
            a.grazing = true;
            a.roll = 0;
            if (a.timer <= 0) { a.state = 'idle'; a.timer = 4 + rnd() * 6; this.fx.sandPuff(a.pos.clone().addScaledVector(a.dir, a.kind.length * 0.5), 14); }
            break;
          }
          if (b.type === 'grazer' && a.state === 'toBite') {
            desired = this.seek(a, a.target, sp);
            if (a.pos.distanceTo(a.target) < a.kind.length * 0.7) { a.state = 'bite'; a.timer = 1.6; }
            if (a.timer < -12) a.state = 'idle';
            break;
          }
          if (a.timer <= 0 || a.pos.distanceTo(a.target) < 0.6) {
            a.timer = 3 + rnd() * 6;
            if (b.type === 'grazer' && rnd() < 0.6) {
              const c = this.nearestCoral(a.pos, 10);
              if (c) { a.target.set(c.x, c.y + c.r * 0.45, c.z); a.state = 'toBite'; a.timer = 0; break; }
            }
            const r = b.radius ?? 6;
            a.target.copy(a.home).add(new THREE.Vector3((rnd() - 0.5) * 2 * r, 0, (rnd() - 0.5) * 2 * r));
            const h = this.terrain.heightAt(a.target.x, a.target.z);
            a.target.y = h + b.alt[0] + rnd() * (b.alt[1] - b.alt[0]);
            if (b.type === 'grazer' && rnd() < 0.25) this.fx.sandPuff(a.pos.clone().addScaledVector(a.dir, -a.kind.length * 0.6), 10); // parrotfish produce sand
          }
          desired = this.seek(a, a.target, sp * (b.type === 'ambush' ? (rnd() < 0.003 ? 6 : 1) : 1));
          if (b.curious && diverActive && dpos && a.pos.distanceTo(dpos) < 14 && dvel < 0.6) {
            const toward = this.seek(a, dpos, sp * 0.6); desired.lerp(toward, 0.35);
          }
          break;
        }
        case 'pair': {
          if (a.leader) {
            const off = new THREE.Vector3(-0.35, 0.05, 0.25).applyQuaternion(orient(_q, a.leader.dir));
            desired = this.seek(a, a.leader.pos.clone().add(off), b.speed * 1.4);
          } else {
            a.timer -= dt;
            if (a.timer <= 0 || a.pos.distanceTo(a.target) < 0.6) {
              a.timer = 4 + rnd() * 6;
              a.target.copy(a.home).add(new THREE.Vector3((rnd() - 0.5) * 2 * b.radius, 0, (rnd() - 0.5) * 2 * b.radius));
              a.target.y = this.terrain.heightAt(a.target.x, a.target.z) + b.alt[0] + rnd() * (b.alt[1] - b.alt[0]);
            }
            desired = this.seek(a, a.target, sp);
          }
          break;
        }
        case 'school': case 'vortex': desired = this.schoolSteer(a, dt); break;
        case 'cleaner': desired = this.cleanerSteer(a, dt); break;
        case 'patrol': {
          a.ang += dt * sp / 32;
          const r = 30 + Math.sin(a.ang * 3 + a.index) * 6;
          const pc = b.center ?? [0, -45];
          a.target.set(pc[0] + Math.cos(a.ang + a.index * 2) * r, 0, pc[1] + Math.sin(a.ang + a.index * 2) * r * 0.7);
          a.target.y = Math.max(this.terrain.heightAt(a.target.x, a.target.z) + 2.5, b.y ?? -16);
          desired = this.seek(a, a.target, sp);
          if (a.threat > 0) desired.add(_w.subVectors(a.pos, dpos).setY(0).normalize().multiplyScalar(sp * a.threat * 1.5));
          break;
        }
        case 'manta': desired = this.mantaSteer(a, dt); break;
        case 'baitball': desired = this.baitSteer(a, dt); break;
        case 'hunter': desired = this.hunterSteer(a, dt); break;
        case 'breather': case 'migrate': desired = this.breatherSteer(a, dt, dpos); break;
        case 'bird': desired = this.birdSteer(a, dt); break;
        case 'rest': {
          a.timer -= dt;
          if (a.state !== 'glide' && a.threat > 0.3) {
            a.state = 'glide'; a.timer = 8;
            const away = _w.subVectors(a.pos, dpos).setY(0).normalize().multiplyScalar(7 + rnd() * 5);
            a.target.copy(a.pos).add(away); a.target.y = this.terrain.heightAt(a.target.x, a.target.z) + 0.06;
            this.fx.sandPuff(a.pos, 16);
          }
          if (a.state === 'glide') {
            desired = this.seek(a, a.target, sp);
            desired.y += 0.3 * Math.max(0, 1 - a.pos.distanceTo(a.target) / 6) * 0;
            if (a.pos.distanceTo(a.target) < 0.3 || a.timer < 0) { a.state = 'idle'; this.fx.sandPuff(a.pos, 10); }
          } else desired.set(0, 0, 0);
          break;
        }
      }
      // Flee (except the hiders, which dive into coral, and the rest/host types handled above).
      if (a.threat > 0 && dpos && !['host', 'rest', 'patrol', 'cleaner', 'migrate', 'bird', 'hunter'].includes(b.type)) {
        if (b.hide) desired.add(this.seek(a, a.home.clone().setY(this.terrain.heightAt(a.home.x, a.home.z) + 0.25), sp * 4 * a.threat));
        else desired.add(_w.subVectors(a.pos, dpos).normalize().multiplyScalar(sp * 3 * a.threat));
      }
      // Stay above the seabed, below the surface, inside the site.
      const ground = this.terrain.heightAt(a.pos.x, a.pos.z);
      const minAlt = b.type === 'rest' ? 0.04 : b.type === 'host' ? 0.1 : (b.alt?.[0] ?? 0.8) * 0.6;
      if (a.pos.y < ground + minAlt) desired.y += (ground + minAlt - a.pos.y) * 2;
      const canSurface = b.type === 'bird' || ((b.type === 'breather' || b.type === 'migrate' || b.breathEvery) && (a.state === 'ascend' || a.state === 'breathe'));
      if (!canSurface && a.pos.y > -0.8) desired.y -= (a.pos.y + 0.8) * 2;
      const bd = this.eco.bounds;
      if (a.pos.x < bd.xMin - 15) desired.x += 0.5; if (a.pos.x > bd.xMax + 15) desired.x -= 0.5;
      if (a.pos.z < bd.zMin - 15) desired.z += 0.5; if (a.pos.z > bd.zMax + 15) desired.z -= 0.5;
      // Integrate with inertia
      const accel = b.type === 'school' || b.type === 'vortex' ? 2.5 : 1.6;
      a.vel.lerp(desired, 1 - Math.exp(-accel * dt));
      a.pos.addScaledVector(a.vel, dt);
      if (b.type === 'rest' && a.state !== 'glide') a.pos.y = ground + 0.05;
      const spd = a.vel.length();
      if (spd > 0.03) {
        const nd = a.vel.clone().normalize();
        if (b.type !== 'rest') nd.y = clamp(nd.y, -0.45, 0.45);
        else nd.y = 0;
        a.dir.lerp(nd, 1 - Math.exp(-4 * dt)).normalize();
      }
      if (a.state === 'bite') a.dir.y = -0.5;
      const sw = a.kind.look.swim ?? { freq: 5, amp: 0.7 };
      a.phase += dt * sw.freq * (0.35 + Math.min(2.5, spd / Math.max(0.05, b.speed)) * 0.65);
      a.kind.swim[a.index * 2] = a.phase;
      a.kind.swim[a.index * 2 + 1] = sw.amp * (0.4 + Math.min(1, spd / Math.max(0.05, b.speed)) * 0.6);
      this.writeMatrix(a);
    }
    for (const k of Object.values(this.kinds)) {
      k.mesh.instanceMatrix.needsUpdate = true;
      if (k.swim) k.mesh.geometry.attributes.aSwim.needsUpdate = true;
    }
  }

  /** Jellies, salps, bluebottles: slow drifting with the current inside a home radius. */
  drift(a, dt) {
    const b = a.b;
    a.phase += dt;
    if (!a.wander || this.rnd() < dt * 0.1) a.wander = new THREE.Vector3(this.rnd() - 0.5, (this.rnd() - 0.5) * 0.3, this.rnd() - 0.5).normalize().multiplyScalar(b.speed ?? 0.08);
    a.pos.addScaledVector(a.wander, dt);
    if (a.pos.distanceTo(a.home) > (b.range ?? 12)) a.wander.copy(a.home).sub(a.pos).normalize().multiplyScalar(b.speed ?? 0.08);
    if (b.place === 'surface') a.pos.y = -0.04;
    else { const g = this.terrain.heightAt(a.pos.x, a.pos.z) + 1; if (a.pos.y < g) a.pos.y = g; if (a.pos.y > -0.6) a.pos.y = -0.6; }
    a.dir.set(a.wander.x, 0, a.wander.z).normalize();
    this.writeMatrix(a);
    a.kind.mesh.instanceMatrix.needsUpdate = true;
  }
  /** Seahorses, seadragons: near-motionless bobbing (camouflaged). */
  hover(a, dt) {
    a.phase += dt;
    a.pos.y = a.home.y + Math.sin(a.phase * 0.7) * 0.04;
    a.pos.x = a.home.x + Math.sin(a.phase * 0.23) * (a.b.range ?? 0.15);
    a.dir.set(Math.cos(a.phase * 0.1), 0, Math.sin(a.phase * 0.1));
    this.writeMatrix(a);
    a.kind.mesh.instanceMatrix.needsUpdate = true;
  }
  /** Bait ball: tight swirling sphere that bulges away from predators. */
  baitSteer(a, dt) {
    const c = this.ballCentre ??= a.home.clone();
    if (a.index === 0) {
      // Drift the ball slowly, pushed away from charging hunters.
      c.x = a.home.x + Math.sin(this.time * 0.05) * 6; c.z = a.home.z + Math.cos(this.time * 0.043) * 6;
      c.y = a.home.y + Math.sin(this.time * 0.11) * 1.2;
    }
    const r = _w.subVectors(a.pos, c);
    const dist = r.length() || 1e-3;
    const R = (a.b.radius ?? 2.2) * (0.6 + (a.index % 7) / 10);
    const tangent = new THREE.Vector3(-r.z, (a.index % 3 - 1) * 0.2, r.x).normalize().multiplyScalar(a.b.speed);
    const desired = tangent.add(r.clone().multiplyScalar((R - dist) / dist * 1.2));
    for (const h of this.hunters ?? []) {
      if (h.visible === false) continue;
      const d = a.pos.distanceTo(h.pos);
      if (d < 2.5) { desired.add(_v.subVectors(a.pos, h.pos).normalize().multiplyScalar((2.5 - d) * 3)); if (h.state === 'charge') a.escaping = true; }
    }
    return desired;
  }
  /** Predators working a bait ball: circle, then charge through it. */
  hunterSteer(a, dt) {
    (this.hunters ??= new Set()).add(a);
    const c = this.ballCentre ?? a.home;
    if (a.b.breathEvery) {
      // Dolphins hunt between breaths: every so often break off, surface, breathe, return.
      a.bt = (a.bt ?? a.b.breathEvery * (0.3 + this.rnd())) - dt;
      if (a.bt <= 0 && a.state !== 'ascend' && a.state !== 'breathe') { a.state = 'ascend'; a.target.set(a.pos.x + a.dir.x * 5, -0.25, a.pos.z + a.dir.z * 5); }
      if (a.state === 'ascend' || a.state === 'breathe') {
        const d = this.breatherSteer(a, dt, null);
        if (a.state === 'cruise') { a.state = 'circle'; a.bt = a.b.breathEvery * (0.7 + this.rnd() * 0.6); a.timer = 3; }
        return d;
      }
    }
    a.timer -= dt;
    if (a.state === 'idle' || !a.state) { a.state = 'circle'; a.timer = 3 + this.rnd() * 6; }
    if (a.state === 'circle') {
      a.ang += dt * a.b.speed / (a.orbit + 6);
      a.target.set(c.x + Math.cos(a.ang + a.index) * (a.orbit + 6), c.y + Math.sin(a.ang * 2 + a.index) * 2, c.z + Math.sin(a.ang + a.index) * (a.orbit + 6));
      if (a.timer <= 0) { a.state = 'charge'; a.timer = 4; a.chargeTo = c.clone().add(_v.subVectors(c, a.pos).setY(0).normalize().multiplyScalar(8)); }
      return this.seek(a, a.target, a.b.speed);
    }
    // charge
    if (a.pos.distanceTo(c) < 3) a.hunting = true;
    if (a.timer <= 0 || a.pos.distanceTo(a.chargeTo) < 1) { a.state = 'circle'; a.timer = 4 + this.rnd() * 6; }
    return this.seek(a, a.chargeTo, a.b.speed * 2.6);
  }
  /** Air-breathing animals: cruise (and maybe graze), then rise to the surface to breathe. */
  breatherSteer(a, dt, dpos) {
    const b = a.b;
    a.timer -= dt;
    if (a.state === 'cruise') {
      if (b.type === 'migrate') {
        a.target.set(a.pos.x + 20, b.y ?? -8, b.lane ?? 0);
        if (a.pos.x > (this.eco.bounds.xMax + 60)) { a.pos.x = this.eco.bounds.xMin - 60; }
      } else if (!a.target || a.pos.distanceTo(a.target) < 1.5 || this.rnd() < dt * 0.05) {
        const r = b.radius ?? 20;
        a.target.copy(a.home).add(new THREE.Vector3((this.rnd() - 0.5) * 2 * r, 0, (this.rnd() - 0.5) * 2 * r));
        const g = this.terrain.heightAt(a.target.x, a.target.z);
        a.target.y = b.graze ? g + 0.5 : (b.y ?? Math.min(-2, g + 3 + this.rnd() * 3));
      }
      if (b.graze && a.pos.y < this.terrain.heightAt(a.pos.x, a.pos.z) + 1.0) {
        a.grazing = true;
        if (this.rnd() < dt * 3) this.fx.sandPuff(a.pos.clone().addScaledVector(a.dir, a.kind.length * 0.45).setY(this.terrain.heightAt(a.pos.x, a.pos.z) + 0.1), 6, [0.6, 0.55, 0.45]);
      }
      if (a.timer <= 0) { a.state = 'ascend'; a.target.set(a.pos.x + a.dir.x * 6, -0.25, a.pos.z + a.dir.z * 6); }
      return this.seek(a, a.target, b.speed);
    }
    if (a.state === 'ascend') {
      if (a.pos.y > -0.6) { a.state = 'breathe'; a.timer = b.breathTime ?? 3; if (b.blow) this.fx.sprayBurst(a.pos.clone().setY(0.2), new THREE.Vector3(0, 1, 0), 30, 3); }
      return this.seek(a, a.target, b.speed * 1.2);
    }
    if (a.state === 'breathe') {
      if (a.timer <= 0) { a.state = 'cruise'; a.timer = (b.breathEvery ?? 40) * (0.7 + this.rnd() * 0.6); a.target.y = b.y ?? -6; }
      return new THREE.Vector3(a.dir.x * b.speed * 0.4, 0, a.dir.z * b.speed * 0.4);
    }
    a.state = 'cruise';
    return new THREE.Vector3();
  }
  /** Diving seabird: circles above, plunges into the bait ball, pops back up. */
  birdSteer(a, dt) {
    const c = this.ballCentre ?? a.home;
    a.timer -= dt;
    if (a.state !== 'plunge' && a.state !== 'rise') {
      a.ang += dt * 0.5;
      a.target.set(c.x + Math.cos(a.ang + a.index * 2) * 12, 4 + Math.sin(a.ang + a.index) * 1.5, c.z + Math.sin(a.ang + a.index * 2) * 12);
      if (a.timer <= 0) { a.state = 'plunge'; a.timer = 3; }
      return this.seek(a, a.target, 6);
    }
    if (a.state === 'plunge') {
      if (a.pos.y < 0) a.hunting = true;
      if (a.pos.y < c.y + 1 || a.timer <= 0) { a.state = 'rise'; a.timer = 3; }
      return this.seek(a, c, 7);
    }
    if (a.pos.y > 1.5 || a.timer <= 0) { a.state = 'fly'; a.timer = 8 + this.rnd() * 10; }
    return new THREE.Vector3(a.dir.x, 3, a.dir.z);
  }

  crawl(a, dt) {
    a.pos.addScaledVector(a.dir, a.b.speed * dt);
    if (a.pos.distanceTo(a.home) > 1.5) a.dir.negate();
    a.pos.y = this.terrain.heightAt(a.pos.x, a.pos.z);
    this.writeMatrix(a);
  }

  nearestCoral(p, maxD) {
    let best = null, bd = maxD;
    for (const c of this.reef.picks) {
      if (c.id === 'seafan') continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bd && this.rnd() < 0.7) { bd = d; best = c; }
    }
    return best;
  }

  schoolSteer(a, dt) {
    const b = a.b;
    const sep = new THREE.Vector3(), ali = new THREE.Vector3(), coh = new THREE.Vector3();
    let n = 0;
    for (const o of this.agents) {
      if (o === a || o.group !== a.group || o.id !== a.id || o.visible === false) continue;
      const d = a.pos.distanceTo(o.pos);
      if (d > 2.2) continue;
      n++;
      ali.add(o.vel); coh.add(o.pos);
      if (d < 0.35 * a.kind.length / 0.1 * 0.25 + 0.12) sep.add(_v.subVectors(a.pos, o.pos).multiplyScalar(1 / Math.max(d, 0.05)));
    }
    const desired = new THREE.Vector3();
    if (n) {
      ali.multiplyScalar(1 / n); coh.multiplyScalar(1 / n).sub(a.pos);
      desired.add(ali.multiplyScalar(0.6)).add(coh.multiplyScalar(0.5)).add(sep.multiplyScalar(0.12));
    }
    if (b.type === 'vortex') {
      // Mill around a slowly drifting centre (a classic trevally "tornado").
      const c = a.home.clone(); c.x += Math.sin(this.time * 0.05) * 6; c.z += Math.cos(this.time * 0.04) * 6;
      const r = _w.subVectors(a.pos, c); r.y = 0;
      const dist = r.length();
      const tangent = new THREE.Vector3(-r.z, 0, r.x).normalize().multiplyScalar(b.speed);
      desired.add(tangent).add(r.normalize().multiplyScalar((a.orbit - dist) * 0.4));
      desired.y += (c.y + Math.sin(a.index * 1.7) * 1.8 - a.pos.y) * 0.4;
    } else {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = 2 + this.rnd() * 3; a.target.copy(a.home).add(new THREE.Vector3((this.rnd() - 0.5) * 3, (this.rnd() - 0.3) * 0.8, (this.rnd() - 0.5) * 3));
        a.target.y = Math.max(a.target.y, this.terrain.heightAt(a.target.x, a.target.z) + (b.alt?.[0] ?? 1) + 0.3);
      }
      desired.add(this.seek(a, a.target, b.speed * 0.8));
    }
    return desired;
  }

  /** Cleaning station scheduling: one client at a time poses while cleaners work. */
  updateVisits(dt) {
    if (!this.station) return;
    const v = this.visit;
    if (v.client) {
      v.timer -= dt;
      if (v.timer <= 0 || v.client.threat > 0.7) { v.client.state = 'leave'; v.client.timer = 6; v.client = null; v.cooldown = 4 + this.rnd() * 6; }
      return;
    }
    v.cooldown -= dt;
    if (v.cooldown > 0) return;
    const clients = this.agents.filter(a => a.b.client && a.visible !== false && a.b.type !== 'manta' && a.state !== 'leave' && a.pos.distanceTo(this.station) < 45);
    const manta = this.agents.find(a => a.b.type === 'manta' && a.state === 'circle');
    const c = manta ?? clients[Math.floor(this.rnd() * clients.length)];
    if (!c) return;
    v.client = c; v.timer = c.b.type === 'manta' ? 22 : 14;
    if (c.b.type !== 'manta') { c.state = 'visit'; c.target.copy(this.station).add(new THREE.Vector3((this.rnd() - 0.5) * 1.2, 0.8 + this.rnd() * 0.5, (this.rnd() - 0.5) * 1.2)); }
  }
  clientSteer(a, dt) {
    if (a.state === 'visit') {
      if (a.pos.distanceTo(a.target) < 0.5) a.state = 'pose';
      return this.seek(a, a.target, a.b.speed);
    }
    // Pose: hang almost still, slightly head-down — the classic "please clean me" posture.
    a.roll = Math.sin(this.time) * 0.15;
    return this.seek(a, a.target, 0.05);
  }
  cleanerSteer(a, dt) {
    const v = this.visit;
    const c = v.client;
    if (c && (c.state === 'pose' || c.b.type === 'manta') && c.pos.distanceTo(this.station) < 6) {
      // Move over the client's body, gleaning parasites.
      if (!a.cleanSpot || this.rnd() < dt * 0.6) a.cleanSpot = new THREE.Vector3((this.rnd() - 0.4) * c.kind.length * 0.6, (this.rnd() - 0.5) * c.kind.length * 0.25, (this.rnd() < 0.5 ? -1 : 1) * c.kind.length * 0.12);
      const world = a.cleanSpot.clone().applyQuaternion(orient(_q, c.dir)).add(c.pos);
      const d = a.pos.distanceTo(world);
      if (d < Math.max(0.35, c.kind.length * 0.35)) { a.cleaning = true; c.cleaning = true; }
      return this.seek(a, world, 0.6);
    }
    // Otherwise "dance" at the station to advertise.
    if (this.rnd() < dt * 1.2) a.target.copy(a.home).add(new THREE.Vector3((this.rnd() - 0.5) * 1.0, this.rnd() * 0.4, (this.rnd() - 0.5) * 1.0));
    return this.seek(a, a.target, a.b.speed);
  }
  mantaSteer(a, dt) {
    const st = this.station;
    if (a.state === 'circle') {
      a.timer -= dt;
      a.ang += dt * 0.28;
      a.target.set(st.x + Math.cos(a.ang) * 3.2, st.y + 2.4, st.z + Math.sin(a.ang) * 3.2);
      if (a.timer <= 0) { a.state = 'cruise'; a.ang = 0; }
      return this.seek(a, a.target, 0.5);
    }
    a.ang += dt * a.b.speed / 40;
    const cx = -5, cz = -45;
    a.target.set(cx + Math.cos(a.ang) * 38, -7 + Math.sin(a.ang * 2) * 2, cz + Math.sin(a.ang) * 28);
    if (a.pos.distanceTo(st) < 8 && a.timer <= -60) { a.state = 'circle'; a.timer = 24; }
    a.timer -= dt;
    if (a.timer < -200) a.timer = -60;
    return this.seek(a, a.target, a.b.speed);
  }

  updateTurtle(a, dt, dpos) {
    a.timer -= dt;
    const rnd = this.rnd;
    let target = a.target;
    if (a.state === 'cruise') {
      if (a.pos.distanceTo(target) < 1.5) {
        target.copy(a.home).add(new THREE.Vector3((rnd() - 0.5) * 30, 0, (rnd() - 0.5) * 30));
        target.y = a.b.y !== undefined ? a.b.y + (rnd() - 0.5) * 3 : this.terrain.heightAt(target.x, target.z) + 0.8 + rnd() * 2;
      }
      if (a.timer <= 0) { a.state = 'ascend'; target.set(a.pos.x + a.dir.x * 4, -0.35, a.pos.z + a.dir.z * 4); }
    } else if (a.state === 'ascend') {
      if (a.pos.y > -0.6) { a.state = 'breathe'; a.timer = 4; }
    } else if (a.state === 'breathe') {
      a.cleaning = false;
      if (a.timer <= 0) { a.state = 'cruise'; a.timer = 45 + rnd() * 40; target.copy(a.home); target.y = a.b.y ?? this.terrain.heightAt(target.x, target.z) + 1.5; }
    }
    const desired = a.state === 'breathe' ? new THREE.Vector3(a.dir.x * 0.05, 0, a.dir.z * 0.05) : this.seek(a, target, a.b.speed ?? 0.35);
    if (dpos && a.pos.distanceTo(dpos) < 2.2) desired.add(_w.subVectors(a.pos, dpos).normalize().multiplyScalar(0.4));
    const ground = this.terrain.heightAt(a.pos.x, a.pos.z);
    if (a.pos.y < ground + 0.6) desired.y += 0.5;
    a.vel.lerp(desired, 1 - Math.exp(-1.2 * dt));
    a.pos.addScaledVector(a.vel, dt);
    if (a.vel.lengthSq() > 0.001) { const nd = a.vel.clone().normalize(); nd.y = clamp(nd.y, -0.6, 0.6); a.dir.lerp(nd, 1 - Math.exp(-2 * dt)).normalize(); }
    a.phase += dt * (a.state === 'breathe' ? 0.8 : 1.6 + a.vel.length() * 2);
    const g = a.rig.group;
    g.position.copy(a.pos);
    orient(g.quaternion, a.dir, Math.sin(a.phase) * 0.06);
    const st = Math.sin(a.phase);
    a.rig.flippers.fl.rotation.x = st * 0.7; a.rig.flippers.fr.rotation.x = -st * 0.7;
    a.rig.flippers.fl.rotation.z = Math.cos(a.phase) * 0.3; a.rig.flippers.fr.rotation.z = Math.cos(a.phase) * 0.3;
    a.rig.flippers.rl.rotation.x = Math.sin(a.phase * 0.5) * 0.25; a.rig.flippers.rr.rotation.x = -Math.sin(a.phase * 0.5) * 0.25;
    a.rig.head.position.y = 0.02 + (a.state === 'breathe' ? 0.08 : 0);
  }
  updateClam(a, dt, dpos, dvel, active) {
    const near = active && dpos && dpos.distanceTo(a.pos) < 1.8 && dvel > 0.15;
    if (near) a.timer = 6;
    a.timer -= dt;
    const target = a.timer > 0 ? 0 : 1;
    a.open += (target - a.open) * (1 - Math.exp(-(target < a.open ? 5 : 0.5) * dt));
    const ang = 0.08 + a.open * 0.4;
    a.rig.valves[0].rotation.x = -ang; a.rig.valves[1].rotation.x = ang;
    a.rig.mantle.scale.set(0.6 + a.open * 0.4, 0.06 + a.open * 0.06, 0.1 + a.open * 0.32);
    a.rig.mantle.position.y = 0.1 + a.open * 0.18;
    a.closed = a.open < 0.4;
  }

  /** Scale visible fish abundance (0..1.5) per feeding group — driven by the health lab. */
  setAbundance(fn) {
    const touched = new Set();
    for (const a of this.agents) {
      if (a.cloud) continue;
      const keep = fn(a.id);
      const idx = a.index ?? this.agents.indexOf(a);
      a.visible = ((idx * 0.6180339) % 1) < keep;
      if (a.rig) a.rig.group.visible = a.visible;
      else if (a.static && a.kind) { this.writeMatrix(a); touched.add(a.kind); }
    }
    for (const k of touched) k.mesh.instanceMatrix.needsUpdate = true;
  }
  setCount(id, frac) {
    for (const a of this.agents) if (a.id === id && a.kind) a.visible = ((a.index * 0.6180339) % 1) < frac;
    const k = this.kinds[id];
    if (k && this.agents.some(a => a.id === id && a.static)) {
      for (const a of this.agents) if (a.id === id) this.writeMatrix(a);
      k.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); });
    this.group.parent?.remove(this.group);
  }
}
