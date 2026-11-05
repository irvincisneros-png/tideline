// Hand-placed landmarks built from the Blender prop set (tools/blender/tideline.py): jetty, tinnie, bait-shop hut, fish-cleaning
// table, lifeguard tower, hero trees, pelicans, esky and bucket. Sites list them in `eco.props`; this class builds the meshes.
// On the low tier (no sun shadows) every tall prop also gets a soft blob contact shadow so the sand still reads as sunlit.
import * as THREE from 'three';
import { patchUnderwater, globalUniforms } from '../ocean/shaders.js';
import { bakeModel } from './propBake.js';

let blobTex = null;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

/** The Blender set gets the same finish as the code-built props, once per model (the loader keeps its geometry between sites). */
const done = new WeakMap();
const BUTT = { wharf_deck: 'z', jetty_deck: 'z' };   // lengths of deck laid end to end
const finished = (g, name) => { let f = done.get(g); if (!f) done.set(g, f = bakeModel(g, { butt: BUTT[name] })); return f; };

export class Props {
  constructor(scene, models, terrain, quality, world) {
    this.scene = scene; this.models = models; this.terrain = terrain; this.quality = quality; this.world = world;
    this.group = new THREE.Group(); scene.add(this.group);
    this.mat = patchUnderwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), { key: 'prop', cutaway: true, ink: true });
    this.anim = []; this.blobs = [];
    this.byName = {};
  }
  /**
   * Place a model. opts: { y (absolute) | float (sit on the water surface) | sink, rot (radians), scale, shadow: radius of the low-tier blob, tall: height for blob offset }.
   * Returns the mesh (null if the model is missing).
   */
  place(name, x, z, opts = {}) {
    const raw = this.models.get(name);
    if (!raw) { console.warn('Prop model missing:', name); return null; }
    const geo = finished(raw, name);
    const m = new THREE.Mesh(geo, opts.color != null ? this.tinted(opts.color) : this.mat);
    const s = opts.scale ?? 1;
    m.scale.setScalar(s); m.rotation.y = opts.rot ?? 0;
    const gy = this.terrain.heightAt(x, z);
    m.position.set(x, opts.y ?? (opts.float ? 0 : gy - (opts.sink ?? 0)), z);
    m.name = name; m.userData.prop = name;
    m.receiveShadow = m.castShadow = true;
    this.group.add(m);
    (this.byName[name] ??= []).push(m);
    if (opts.shadow) this.blobs.push({ x, z, y: opts.y ?? gy, r: opts.shadow * s, tall: opts.tall ?? 0, rot: opts.rot ?? 0 });
    return m;
  }
  /** A material that tints the model's own colours (e.g. grey boulders turned warm sandstone). */
  tinted(c) {
    const col = c instanceof THREE.Color ? c : new THREE.Color(c), key = col.getHexString() + col.r.toFixed(2) + col.g.toFixed(2);
    this.tints ??= {};
    return (this.tints[key] ??= patchUnderwater(new THREE.MeshStandardMaterial({ vertexColors: true, color: col, roughness: 0.9, metalness: 0 }), { key: 'prop', cutaway: true, ink: true }));
  }
  /** A pelican (or other bird) idling on a post: slow turns of the head, a ruffle now and then. */
  idle(mesh, amp = 0.35) { this.anim.push({ mesh, rot: mesh.rotation.y, ph: Math.random() * 6, amp, y: mesh.position.y }); }
  update(dt, t) {
    for (const a of this.anim) { a.mesh.rotation.y = a.rot + Math.sin(t * 0.35 + a.ph) * a.amp; a.mesh.position.y = a.y + Math.max(0, Math.sin(t * 0.8 + a.ph * 2) - 0.92) * 0.2; }
    for (const f of this.floaters ?? []) { // boats ride the swell
      f.mesh.position.y = this.world.surfaceAt(f.mesh.position.x, f.mesh.position.z) + f.y + Math.sin(t * 1.1 + f.ph) * 0.03;
      f.mesh.rotation.z = Math.sin(t * 0.9 + f.ph) * 0.03; f.mesh.rotation.x = Math.cos(t * 0.7 + f.ph) * 0.02;
    }
  }
  /** A boat or buoy that sits on the water and bobs. */
  floater(mesh, y = 0) { (this.floaters ??= []).push({ mesh, y, ph: Math.random() * 6 }); }
  /** The blobs that sit on the terrain, for the baked ground shade; the ones on decks and piers stay as blob meshes. */
  takeGroundBlobs() {
    const on = b => { const g = this.terrain.heightAt(b.x, b.z); return b.y <= g + 0.3 && g > 0.05; };
    const ground = this.blobs.filter(on); this.blobs = this.blobs.filter(b => !on(b));
    return ground;
  }
  /** Call after placing everything: builds the blob shadows (low tier only). */
  finish() {
    const list = this.blobs;
    if (!list.length || this.quality.shadows) return;
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x1d5f70, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
    const im = new THREE.InstancedMesh(geo, mat, list.length); im.frustumCulled = false; im.renderOrder = 1;
    const sd = globalUniforms.uSunDir.value, off = new THREE.Vector2(-sd.x, -sd.z).normalize().multiplyScalar(1);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    list.forEach((b, i) => {
      const len = b.r * (1 + b.tall * 0.04), ox = off.x * b.tall * 0.35, oz = off.y * b.tall * 0.35;
      const gy = this.terrain.heightAt(b.x + ox, b.z + oz);
      e.set(0, Math.atan2(off.x, off.y), 0); q.setFromEuler(e);
      m.compose(v.set(b.x + ox, Math.max(gy, b.y > 0.5 ? gy : -0.04) + 0.05, b.z + oz), q, s.set(b.r * 2, 1, len * 2.2));
      im.setMatrixAt(i, m);
    });
    this.group.add(im); this.blobMesh = im;
  }
  dispose() {
    this.group.parent?.remove(this.group);
    this.blobMesh?.geometry.dispose(); this.blobMesh?.material.dispose();
    this.mat.dispose(); for (const m of Object.values(this.tints ?? {})) m.dispose();
  }
}
