// Builds and tears down everything for one ecosystem.
import * as THREE from 'three';
import { Terrain } from './terrain.js';
import { Reef } from './reef.js';
import { Life } from '../life/life.js';
import { LandLife } from '../land/landLife.js';
import { loadModelSet } from './models.js';
import { Ocean, WaveMesh, Sky } from '../ocean/water.js';
import { makeNoise } from '../core/noise.js';
import { globalUniforms } from '../ocean/shaders.js';
import { Props } from './props.js';

const SHARED_MODELS = 'assets/models/tideline_cosy.glb'; // the angler, trees, jetty, boats and huts shared by every site

/** Names in the shared set that the people need whatever the graphics style: the character rig, the rod and the carried props. */
const GAMEPLAY_PARTS = /^(ang_|rod_|bucket$|esky$)/;

const tick = () => new Promise(r => setTimeout(r, 0));

export class World {
  constructor(scene, renderer, env, particles, quality) {
    Object.assign(this, { scene, renderer, env, particles, quality });
    this.sky = new Sky(scene);
    this.eco = null;
  }
  async load(eco, progress = () => {}) {
    this.dispose();
    this.eco = eco; this.extraColliders = [];
    globalUniforms.uBleach.value = 0; globalUniforms.uDead.value = 0;
    progress(0.1, 'Mixing the sea water…');
    this.env.apply(eco);
    await tick();
    progress(0.25, 'Shaping the seabed…');
    const noise = makeNoise(eco.seed ?? 42);
    this.terrain = new Terrain(this.scene, eco, noise, this.quality);
    await tick();
    progress(0.4, 'Filling the ocean…');
    this.ocean = new Ocean(this.scene, { quality: this.quality, depthTex: this.terrain.depthTex, depthBox: this.terrain.depthTex.box });
    this.ocean.setCalm(eco.calm ?? 0.3); // a gentle lap, not a swell: the waterline stays put and the shallows stay clear
    this.waveMesh = new WaveMesh(this.scene, this.ocean, this.quality);
    this.ocean.near.visible = this.ocean.far.visible = eco.surface !== false;
    await tick();
    progress(0.55, eco.growMsg ?? 'Planting the shoreline…');
    // Stylised look: hand-shaped Blender models replace some procedural corals, rocks and fish (if the site has a set).
    let art = null;
    this.models = new Map();
    const stylised = globalUniforms.uStyle.value > 0.5;
    // The people (the angler, Mitra, Nell and everyone else) are gameplay, so their parts load in EVERY graphics style. Only the decorative sets (hand-shaped trees, huts, corals)
    // are for the stylised look. If the .glb cannot be fetched the people are still built, from simple fallback shapes (land/angler.js), so the shop and Nell always exist.
    let shared = null;
    try { shared = await loadModelSet(SHARED_MODELS); } catch (e) { console.warn('Character model set failed to load; using simple fallback people.', e); }
    if (stylised) {
      try {
        const own = eco.cosyModels ? await loadModelSet(eco.cosyModels.url) : new Map();
        this.models = new Map([...own, ...(shared ?? [])]);
        art = { ...(eco.cosyModels ?? { coral: {} }), models: this.models };
      } catch (e) { console.warn('Model set failed to load; using procedural models.', e); this.models = new Map(shared ?? []); }
    } else if (shared) this.models = new Map([...shared].filter(([k]) => GAMEPLAY_PARTS.test(k)));   // realistic style: the character parts and their hand props only
    this.reef = new Reef(this.scene, eco, this.terrain, this.quality, 11, art);
    await tick();
    progress(0.75, 'Painting fish and waking the reef…');
    this.life = new Life(this.scene, eco, this.terrain, this.reef, this.particles, this.quality, 5, art);
    this.land = eco.land ? new LandLife(this.scene, eco, this.terrain, this.quality, 13, art) : null;
    this.props = new Props(this.scene, this.models, this.terrain, this.quality, this);
    eco.decorate?.(this);
    this.props.finish(this.treeBlobs());
    await tick();
    progress(0.9, 'Final touches…');
    // Coarse spatial hash of coral colliders for the diver.
    this.grid = new Map();
    for (const p of this.reef.picks) {
      if (p.r < 0.35 || p.soft) continue; // swim through kelp and seagrass; bump into coral and rock
      const k = `${Math.floor(p.x / 6)},${Math.floor(p.z / 6)}`;
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push({ center: new THREE.Vector3(p.x, p.y, p.z), r: p.r * 0.75, pick: p });
    }
    for (const c of this.extraColliders ?? []) { const k = `${Math.floor(c.center.x / 6)},${Math.floor(c.center.z / 6)}`; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(c); }
    this.bounds = eco.diveBounds ?? eco.bounds;
    progress(1, 'Ready');
  }
  /** Underwater animals plus beach/rock-platform animals. */
  allAgents() { return this.land ? [...this.life.agents, ...this.land.agents] : this.life.agents; }
  surfaceAt(x, z) { return this.ocean.heightAt(x, z, this.time ?? 0); }
  groundAt(x, z) { return this.terrain.heightAt(x, z); }
  /** A solid prop for the walker to bump into (hut, table, hero trees): registered before the collider grid is built. */
  addCollider(x, y, z, r) { (this.extraColliders ??= []).push({ center: new THREE.Vector3(x, y, z), r, pick: { hidden: false } }); }
  /** Where feet stand: the terrain, or a built walkway above it (a jetty deck: eco.deckAt(x, z) -> height or null). */
  walkAt(x, z) { const g = this.terrain.heightAt(x, z), d = this.eco.deckAt?.(x, z); return d != null && d > g ? d : g; }
  /** Soft blob shadows (low tier only) under the trees the reef placed: eco.treeShadows = { kind: [radius, height] }. */
  treeBlobs() {
    if (this.quality.shadows || !this.eco.treeShadows) return [];
    const out = [];
    for (const p of this.reef.picks) { const t = this.eco.treeShadows[p.id]; if (t && !p.hidden) out.push({ x: p.x, z: p.z, y: p.y, r: t[0] * p.s, tall: t[1] * p.s }); }
    return out;
  }
  nearbyColliders(p, r = 3) {
    const out = [];
    const x0 = Math.floor((p.x - r) / 6), x1 = Math.floor((p.x + r) / 6), z0 = Math.floor((p.z - r) / 6), z1 = Math.floor((p.z + r) / 6);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const c = this.grid.get(`${x},${z}`); if (c) for (const e of c) if (!e.pick.hidden) out.push(e); }
    return out;
  }
  /** Ray pick against creatures and corals. Returns { id, agent?, dist } or null. */
  pick(origin, dir, maxDist = 14) {
    let best = null, bt = maxDist;
    const test = (cx, cy, cz, r, hit) => {
      const ox = origin.x - cx, oy = origin.y - cy, oz = origin.z - cz;
      const b = ox * dir.x + oy * dir.y + oz * dir.z;
      const c = ox * ox + oy * oy + oz * oz - r * r;
      const disc = b * b - c;
      if (disc < 0) return;
      const t = -b - Math.sqrt(disc);
      if (t > 0 && t < bt) { bt = t; best = { ...hit, dist: t }; }
    };
    for (const a of this.allAgents()) {
      if (a.visible === false) continue;
      test(a.pos.x, a.pos.y, a.pos.z, Math.max(0.2, a.radius * (a.scale ?? 1)), { id: a.id, agent: a });
    }
    // Corals along the ray (sample grid cells every 2 m).
    const seen = new Set();
    for (let s = 0; s < maxDist; s += 2) {
      const px = origin.x + dir.x * s, pz = origin.z + dir.z * s;
      const k = `${Math.floor(px / 6)},${Math.floor(pz / 6)}`;
      if (seen.has(k)) continue; seen.add(k);
      for (const c of this.grid.get(k) ?? []) if (!c.pick.hidden) test(c.center.x, c.center.y, c.center.z, c.r * 1.1, { id: c.pick.id, coral: c.pick });
    }
    for (const p of this.reef.picks) if (!p.hidden && p.r < 0.35 && Math.hypot(p.x - origin.x, p.z - origin.z) < maxDist) test(p.x, p.y, p.z, p.r, { id: p.id, coral: p });
    // Terrain occlusion
    if (best) for (let s = 0.5; s < best.dist; s += 0.5) { const y = origin.y + dir.y * s; if (y < this.groundAt(origin.x + dir.x * s, origin.z + dir.z * s) - 0.1) return null; }
    return best;
  }
  /** Photo candidates: every visible creature plus nearby coral colonies. */
  photoCandidates(center, range = 16) {
    const out = [];
    for (const a of this.allAgents()) if (a.visible !== false && a.pos.distanceTo(center) < range) out.push({ pos: a.pos, r: Math.max(0.12, a.radius * (a.scale ?? 1)), id: a.id, agent: a });
    for (const p of this.reef.picks) if (!p.hidden && Math.hypot(p.x - center.x, p.z - center.z) < range) out.push({ pos: new THREE.Vector3(p.x, p.y, p.z), r: p.r * 0.8, id: p.id });
    return out;
  }
  dispose() {
    this.terrain?.dispose(); this.reef?.dispose(); this.life?.dispose(); this.land?.dispose(); this.props?.dispose();
    for (const o of [this.ocean?.near, this.ocean?.far, this.waveMesh?.mesh]) if (o) { o.geometry.dispose(); o.material.dispose(); o.parent?.remove(o); }
    this.ocean?.group.parent?.remove(this.ocean.group);
    this.eco?.undecorate?.(this);
    this.terrain = this.reef = this.life = this.land = this.ocean = this.waveMesh = this.props = null;
  }
}
