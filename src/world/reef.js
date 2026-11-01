// Places procedural corals over the seabed as instanced meshes and records pick spheres.
import * as THREE from 'three';
import { staghorn, bushCoral, plateCoral, barrelSponge, softTree, tableCoral, brainCoral, porites, leatherCoral, seaFan, rock } from './coral.js';
import { patchUnderwater } from '../ocean/shaders.js';
import { mulberry32 } from '../core/noise.js';
import { LOD } from './lod.js';
import { foliageAtlas } from './foliage.js';

const GENERATORS = {
  staghorn: { fn: staghorn, variants: 4, scale: [0.9, 1.6], radius: 0.9, sink: 0.05, rough: 0.7, cluster: 7 },
  bushcoral: { fn: bushCoral, variants: 3, scale: [0.8, 1.4], radius: 0.5, sink: 0.04, rough: 0.7, cluster: 5, as: 'staghorn' },
  platecoral: { fn: plateCoral, variants: 3, scale: [0.9, 1.6], radius: 0.6, sink: 0.04, rough: 0.75, cluster: 3, as: 'tablecoral' },
  sponge: { fn: barrelSponge, variants: 2, scale: [0.8, 1.6], radius: 0.4, sink: 0.03, rough: 0.9 },
  softtree: { fn: softTree, variants: 3, scale: [0.8, 1.5], radius: 0.4, sink: 0.02, rough: 0.6, sway: 0.35, cluster: 3, as: 'leathercoral' },
  tablecoral: { fn: tableCoral, variants: 3, scale: [0.9, 1.5], radius: 1.1, sink: 0.05, rough: 0.75, sat: 1.15 },
  braincoral: { fn: brainCoral, variants: 3, scale: [0.6, 1.6], radius: 0.5, sink: 0.05, rough: 0.8 },
  porites: { fn: porites, variants: 3, scale: [0.8, 2.4], radius: 0.95, sink: 0.12, rough: 0.85 },
  leathercoral: { fn: leatherCoral, variants: 2, scale: [0.8, 1.5], radius: 0.45, sink: 0.02, rough: 0.7, sway: 0.25 },
  seafan: { fn: seaFan, variants: 2, scale: [1.4, 2.4], radius: 0.8, sink: 0.02, rough: 0.7, sway: 0.03, upright: true },
  rock: { fn: rock, variants: 3, scale: [0.6, 1.8], radius: 0.5, sink: 0.15, rough: 0.95 },
  // Temperate / other ecosystems register more generators via addGenerator().
};
const TILE = 16; // metres per culling tile
export function addGenerator(name, def) { GENERATORS[name] = def; }

/** Boost vertex-colour saturation: water strips colour with depth, so corals start out vivid. */
function saturate(geo, sat, val) {
  const c = geo.attributes.color; if (!c) return geo;
  const col = new THREE.Color(), hsl = {};
  for (let i = 0; i < c.count; i++) {
    col.setRGB(c.getX(i), c.getY(i), c.getZ(i)); col.getHSL(hsl);
    col.setHSL(hsl.h, Math.min(1, hsl.s * sat), hsl.l * val);
    c.setXYZ(i, col.r, col.g, col.b);
  }
  return geo;
}

/**
 * Baked ambient occlusion in the vertex colours: the core and base of a colony and the undersides of plates and
 * branches get less skylight than the outer tips. Cheap (load time only) and works on every quality tier.
 */
function bakeAO(geo, strength = 1) {
  const p = geo.attributes.position, n = geo.attributes.normal, c = geo.attributes.color;
  if (!c || !n) return geo;
  geo.computeBoundingBox();
  const bb = geo.boundingBox, R = Math.max(1e-3, Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z)), H = Math.max(1e-3, bb.max.y);
  for (let i = 0; i < p.count; i++) {
    const out = Math.hypot(p.getX(i), p.getZ(i)) / R, up = Math.max(0, p.getY(i)) / H;
    const open = Math.min(1, Math.max(out, up * 0.9) * 1.25);          // how exposed this point is
    const facing = 0.5 + 0.5 * n.getY(i);                              // 0 = facing the seabed
    const ao = (0.5 + 0.5 * open * open * (3 - 2 * open)) * (0.62 + 0.38 * facing);
    const k = 1 - (1 - ao) * strength;
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  return geo;
}

export class Reef {
  constructor(scene, eco, terrain, quality, seed = 11, art = null) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.picks = []; // {x,y,z,r,id}
    this.meshes = [];
    this.byKind = {}; // kind -> [{ im, mats }] for lab-driven visibility
    const rnd = mulberry32(seed);
    const rules = [...eco.coral, ...(eco.rocks === 0 ? [] : [['rock', eco.rocks ?? 160, (x, z) => eco.reefiness(x, z)]])];
    const b = eco.bounds;
    for (const [kind, count0, weightFn] of rules) {
      const gen = GENERATORS[kind];
      if (!gen) continue;
      // Rocks are collision obstacles: keep their density near the old ultra level so swimming stays easy on every tier.
      const count = Math.round(count0 * (gen.fn === rock || gen.land ? Math.min(1.5, quality.coralScale) : quality.coralScale));
      const names = art?.coral?.[kind]?.filter(n => art.models.has(n));
      const build = names?.length
        ? i => bakeAO(art.models.get(names[i % names.length]).clone(), 0.5) // hand-shaped model: its palette is final, only soft AO
        : i => bakeAO(saturate(gen.fn(1000 + i * 17 + seed), gen.sat ?? (kind === 'rock' ? 1.1 : 1.45), kind === 'rock' ? 0.85 : 0.9), gen.ao ?? 1);
      const geos = Array.from({ length: gen.variants }, (_, i) => build(i));
      // The same colonies with fewer segments, drawn for distant tiles (identical shape: generators seed their own randomness).
      LOD.k = 0.4;
      const buildLo = names?.length ? i => { const g = art.models.get(names[i % names.length] + '_lo'); return g ? bakeAO(g.clone(), 0.5) : build(i); } : build;
      const geosLo = Array.from({ length: gen.variants }, (_, i) => buildLo(i));
      LOD.k = 1;
      const placements = geos.map(() => []);
      let tries = 0;
      let cx = 0, cz = 0, left = 0;
      let placed = 0;
      while (placed < count && tries++ < count * 60) {
        let x, z;
        if (gen.cluster && left > 0) { x = cx + (rnd() - 0.5) * 2 * (1 + gen.cluster * 0.35); z = cz + (rnd() - 0.5) * 2 * (1 + gen.cluster * 0.35); }
        else if (gen.region) { const R = gen.region; x = R.xMin + rnd() * (R.xMax - R.xMin); z = R.zMin + rnd() * (R.zMax - R.zMin); }
        else { x = b.xMin - 10 + rnd() * (b.xMax - b.xMin + 20); z = b.zMin - 10 + rnd() * (b.zMax - b.zMin + 20); }
        const h = terrain.heightAt(x, z);
        const reef = eco.reefiness(x, z);
        const w = weightFn(x, z, h) * (kind === 'rock' || gen.land ? 1 : 0.15 + reef); // land plants follow their own habitat weights
        if (rnd() > w) continue;
        if (h > (gen.maxH ?? -1.9) || h < (gen.minH ?? -1e9)) continue; // keep clear of the surface (unless the plant grows out of it)
        // Slope check — sit on reasonably flat ground.
        const e = 0.6;
        const sx = terrain.heightAt(x + e, z) - terrain.heightAt(x - e, z), sz = terrain.heightAt(x, z + e) - terrain.heightAt(x, z - e);
        if (Math.hypot(sx, sz) / (2 * e) > (kind === 'rock' ? 1.4 : 0.8)) continue;
        const s = gen.scale[0] + rnd() * (gen.scale[1] - gen.scale[0]);
        placements[Math.floor(rnd() * gen.variants)].push({ x, z, y: h - gen.sink * s, s, rot: rnd() * Math.PI * 2, n: [sx, sz] });
        placed++;
        if (gen.cluster) { if (left <= 0) { cx = x; cz = z; left = gen.cluster; } else left--; }
      }
      geos.forEach((geo, vi) => {
        const list = placements[vi];
        if (!list.length) return;
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: gen.rough, metalness: 0, side: gen.upright || gen.doubleSide || gen.foliage ? THREE.DoubleSide : THREE.FrontSide });
        // Leaf-card plants: painted foliage atlas, alpha-cut (soft edges with MSAA); shadows inherit the cut-out.
        if (gen.foliage) { mat.map = foliageAtlas(); mat.alphaTest = 0.45; mat.alphaToCoverage = true; }
        // Only reef-building/soft corals with zooxanthellae bleach (not sea fans, sponges or rock).
        patchUnderwater(mat, { coral: gen.bleaches ?? !['rock', 'seafan', 'sponge'].includes(kind), sway: gen.sway ?? 0, transl: gen.transl ?? 0, detail: !gen.foliage, detailScale: gen.detailScale ?? 38 });
        const name = (gen.as ?? kind) + vi;
        const q = new THREE.Quaternion(), e3 = new THREE.Euler();
        // Per-instance data, generated in placement order (keeps the random stream identical).
        const all = list.map((p, i) => {
          // Tilt slightly with the slope (except upright sea fans, which face into the current).
          e3.set(gen.upright ? 0 : -p.n[1] * 0.3, p.rot, gen.upright ? 0 : p.n[0] * 0.3);
          q.setFromEuler(e3);
          const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s * (0.85 + rnd() * 0.3), p.s));
          // Colony-to-colony colour variation (hue shifts as well as brightness).
          const v = 0.8 + rnd() * 0.35, hueShift = rnd();
          const tint = new THREE.Color(v * (hueShift < 0.33 ? 1.1 : 0.92), v * (hueShift > 0.66 ? 1.08 : 0.95), v * (hueShift > 0.33 && hueShift < 0.66 ? 1.12 : 0.9));
          const bleach = 0.15 + rnd() * 0.8; // individual colony thresholds -> patchy bleaching
          p.pick = kind !== 'rock' ? { x: p.x, y: p.y + gen.radius * p.s * 0.5, z: p.z, r: gen.radius * p.s * 0.8, id: gen.as ?? kind, kind: 'coral', soft: !!gen.soft } : null;
          if (p.pick) this.picks.push(p.pick);
          return { p, m, tint, bleach, gi: i };
        });
        // Split into spatial tiles: each tile is its own InstancedMesh, so tiles off-screen, lost in the fog or
        // outside the shadow box are skipped instead of drawing every colony on the site each frame.
        const tiles = new Map();
        for (const e of all) { const k = `${Math.floor(e.p.x / TILE)},${Math.floor(e.p.z / TILE)}`; if (!tiles.has(k)) tiles.set(k, []); tiles.get(k).push(e); }
        const lo = geosLo[vi].attributes.position.count < geo.attributes.position.count * 0.8 ? geosLo[vi] : null;
        for (const items of tiles.values()) {
          const bleach = new THREE.InstancedBufferAttribute(Float32Array.from(items, e => e.bleach), 1);
          let near = null;
          for (const src of lo ? [geo, lo] : [geo]) {
            const g = new THREE.BufferGeometry(); // shares the variant's vertex buffers; only the instance data differs
            g.setIndex(src.index); for (const [k, at] of Object.entries(src.attributes)) g.setAttribute(k, at);
            g.setAttribute('aBleach', bleach);
            const im = new THREE.InstancedMesh(g, mat, items.length); im.name = name; im.userData.noShadow = !!gen.noShadow;
            items.forEach((e, i) => { im.setMatrixAt(i, e.m); im.setColorAt(i, e.tint); });
            im.instanceMatrix.needsUpdate = true;
            im.computeBoundingSphere();
            if (near) { near.userData.lo = im; im.userData.isLo = true; } else near = im;
            (this.byKind[gen.as ?? kind] ??= []).push({ im, mats: items.map(e => e.m), ids: items.map(e => e.gi), picks: items.map(e => e.p.pick) });
            this.group.add(im);
            this.meshes.push(im);
          }
        }
      });
    }
  }
  /** Show only a fraction (0..1) of a habitat-forming kind, e.g. kelp lost to urchin barrens. */
  setKindFraction(kind, f) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const { im, mats, ids, picks } of this.byKind[kind] ?? []) {
      mats.forEach((m, i) => {
        const show = ((ids[i] * 0.6180339) % 1) < f;
        im.setMatrixAt(i, show ? m : zero);
        if (picks[i]) picks[i].hidden = !show; // removed habitat can't be photographed, clicked or bumped into
      });
      im.instanceMatrix.needsUpdate = true;
    }
  }
  /** Show instances of a kind only where keep(x, z, i) is true (e.g. kelp cleared inside a spreading barren). */
  setKindWhere(kind, keep) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0), v = new THREE.Vector3();
    for (const { im, mats, picks } of this.byKind[kind] ?? []) {
      mats.forEach((m, i) => {
        v.setFromMatrixPosition(m);
        const show = keep(v.x, v.z, i);
        im.setMatrixAt(i, show ? m : zero);
        if (picks[i]) picks[i].hidden = !show;
      });
      im.instanceMatrix.needsUpdate = true;
    }
  }
  /** Hide whole tiles beyond the visible range (underwater fog makes them invisible anyway). */
  cull(camPos, range, lodRange = Infinity) {
    const above = camPos.y > 0.3;
    for (const im of this.meshes) {
      if (im.userData.isLo) continue;
      const bs = im.boundingSphere, d = bs ? bs.center.distanceTo(camPos) - bs.radius : 0;
      // Seen from above the water, submerged tiles fade into the water colour within a few tens of metres.
      const submerged = bs && bs.center.y + bs.radius < -0.5;
      const inRange = d < (above && submerged ? 45 : range), lo = im.userData.lo;
      im.visible = inRange && !(lo && d > lodRange);
      if (lo) lo.visible = inRange && d > lodRange;
    }
  }
  dispose() {
    for (const m of this.meshes) { m.geometry.dispose(); m.material.dispose(); }
    this.group.parent?.remove(this.group);
  }
}
