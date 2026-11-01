// Facial hair for the angler, built from code (no Blender part): overlapping soft blobs so a beard reads as chunky, tufty hair rather than a flat plane.
// All coordinates are in the HEAD joint's own frame: the head ellipsoid is centred (0, .19, 0) with radii (.235, .215, .225); the nose tip is about (0, .14, .245),
// the smile sits at y .097-.117, z .2. A beard is a child of the head, so it turns and tilts with the head in every pose (the reeling lean included).
import * as THREE from 'three';

export const BEARD_STYLES = ['none', 'stubble', 'moustache', 'short', 'big'];
export const BEARD_MESHES = { none: [], stubble: ['ang_beardStubble_stubble'], moustache: ['ang_beardMoustache_beard'], short: ['ang_beardShort_beard'], big: ['ang_beardBig_beard'] };

const HC_Y = 0.19, HR = [0.235, 0.215, 0.225];
/** Merge indexed geometries (position, normal, colour). */
function merge(list) {
  const pos = [], nor = [], col = [], idx = [];
  for (const g of list) {
    const base = pos.length / 3, p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.getX(i), c.getY(i), c.getZ(i)); }
    const ix = g.index; for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx); return out;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
/** A lumpy ellipsoid at (x,y,z) with radii (rx,ry,rz), tilted (rot x,y,z), tinted `shade` (1 = the slot colour, lower = darker, for depth). */
function blob(x, y, z, rx, ry, rz, shade = 1, rot = [0, 0, 0], lump = 0.1) {
  const g = new THREE.SphereGeometry(1, 12, 8), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {   // deterministic wobble, so the seam vertices move together
    const a = p.getX(i), b = p.getY(i), c = p.getZ(i), k = 1 + lump * Math.sin(a * 5.1 + b * 2.3 + x * 40) * Math.cos(c * 4.7 + b * 3.9 + y * 37);
    p.setXYZ(i, a * k, b * k, c * k);
  }
  g.computeVertexNormals();
  _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(rx, ry, rz));
  g.applyMatrix4(_m);
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = shade * (0.94 + 0.06 * Math.min(1, Math.max(0, (g.attributes.normal.getY(i) + 1) / 2))); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = t; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/** Where the head surface is at height y and azimuth a (0 = straight ahead, + = the character's left), pushed out by `out`. */
function onHead(y, a, out = 0) {
  const t = (y - HC_Y) / HR[1], s = Math.sqrt(Math.max(0, 1 - t * t));
  return [Math.sin(a) * (HR[0] * s + out), y, Math.cos(a) * (HR[2] * s + out)];
}
/** A moustache: a drooping handlebar of blobs under the nose. thick scales it. */
function moustache(parts, thick = 1, shade = 1) {
  for (const s of [-1, 1]) {
    parts.push(blob(s * 0.032, 0.118, 0.232, 0.04 * thick, 0.026 * thick, 0.03 * thick, shade, [0, 0, s * 0.35]));
    parts.push(blob(s * 0.07, 0.108, 0.222, 0.036 * thick, 0.024 * thick, 0.028 * thick, shade * 0.97, [0, s * 0.4, s * 0.7]));
    parts.push(blob(s * 0.1, 0.092, 0.206, 0.03 * thick, 0.026 * thick, 0.026 * thick, shade * 0.95, [0, s * 0.6, s * 1.0]));
  }
}
/** The jaw beard: sideburns down to the chin. depth = how far it stands off the face, drop = how far it hangs below the chin. */
function jaw(parts, { depth = 0.02, drop = 0, size = 1, top = 0.15 } = {}) {
  const rows = [top, Math.min(0.085, top - 0.04), 0.02, -0.02];
  rows.forEach((y, ri) => {
    const n = ri === 0 ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const a = (ri === 0 ? 1.28 : 1.45) - (ri === 0 ? i * 0.1 : i * (1.45 / (n - 1)) * 0.98);   // from the ear toward the chin
      for (const s of [-1, 1]) {
        if (ri >= 1 && a < 0.08 && s > 0) continue;   // do not double up the middle
        const [x, yy, z] = onHead(y, s * a, depth * 0.6);
        // keep the mouth clear on the short beard (drop = 0): nothing in front of the smile except below it
        if (!drop && Math.abs(x) < 0.07 && yy > 0.04 && z > 0.17) continue;
        const r = (0.05 + ri * 0.006) * size;
        parts.push(blob(x, yy, z, r, r * 1.1, r, 1 - ri * 0.03, [0, s * a, 0]));
      }
    }
  });
  // the chin
  parts.push(blob(0, -0.025 - drop * 0.15, 0.17 + depth, 0.09 * size, 0.07 * size + drop * 0.25, 0.07 * size, 0.96));
  parts.push(blob(0, 0.03, 0.2 + depth * 0.6, 0.075 * size, 0.045 * size, 0.04 * size, 1));
}
const GEO = {};
function build(style) {
  const parts = [];
  if (style === 'moustache') moustache(parts, 1.1);
  else if (style === 'short') { jaw(parts, { depth: 0.018, size: 0.9 }); moustache(parts, 0.85, 1.02); }
  else if (style === 'big') {
    jaw(parts, { depth: 0.045, drop: 0.16, size: 1.05, top: 0.13 });
    moustache(parts, 1.3, 1.04);
    // the bushy mass hanging off the chin: stacked, overlapping tufts getting narrower, with a gentle curl at the tip
    const tufts = [[0, -0.06, 0.2, 0.115, 0.085, 0.075, 0.97], [0, -0.13, 0.208, 0.1, 0.085, 0.07, 0.94], [0, -0.2, 0.212, 0.078, 0.08, 0.065, 0.92], [0, -0.265, 0.215, 0.052, 0.07, 0.055, 0.9]];
    for (const [x, y, z, rx, ry, rz, sh] of tufts) parts.push(blob(x, y, z, rx, ry, rz, sh, [0.15, 0, 0], 0.13));
    for (const s of [-1, 1]) {
      parts.push(blob(s * 0.085, -0.08, 0.19, 0.065, 0.09, 0.065, 0.95, [0.1, 0, s * 0.25], 0.13));
      parts.push(blob(s * 0.055, -0.17, 0.2, 0.045, 0.07, 0.05, 0.91, [0.1, 0, s * 0.2], 0.13));
      parts.push(blob(s * 0.19, 0.03, 0.09, 0.055, 0.1, 0.1, 0.95, [0, 0, 0], 0.12));       // cheek fluff by the ears
    }
  } else if (style === 'stubble') {
    // a thin shell hugging the jaw and cheeks, with a hole for the smile
    const segA = 22, segY = 6, pos = [], nor = [], col = [], idx = [];
    const rowY = j => 0.125 - (j / segY) * 0.145, azim = i => -1.5 + (i / segA) * 3.0;
    for (let j = 0; j <= segY; j++) for (let i = 0; i <= segA; i++) {
      const y = rowY(j), a = azim(i), [x, yy, z] = onHead(y, a, 0.008);
      const t = (yy - HC_Y) / HR[1], nx = Math.sin(a) * Math.sqrt(1 - t * t) / HR[0], ny = t / HR[1], nz = Math.cos(a) * Math.sqrt(1 - t * t) / HR[2], l = Math.hypot(nx, ny, nz) || 1;
      pos.push(x, yy, z); nor.push(nx / l, ny / l, nz / l); col.push(1, 1, 1);
    }
    for (let j = 0; j < segY; j++) for (let i = 0; i < segA; i++) {
      const a = azim(i + 0.5), y = rowY(j + 0.5), [x, , z] = onHead(y, a);
      if (Math.abs(x) < 0.07 && y > 0.075 && y < 0.14 && z > 0.17) continue;   // the smile
      if (Math.abs(x) < 0.04 && y > 0.12 && z > 0.2) continue;                  // the nose
      const k = j * (segA + 1) + i; idx.push(k, k + 1, k + segA + 1, k + 1, k + segA + 2, k + segA + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    return g;
  }
  return merge(parts);
}
/** The geometry for a beard mesh name (cached), or null. */
export function beardGeo(name) {
  const style = Object.keys(BEARD_MESHES).find(k => BEARD_MESHES[k].includes(name));
  if (!style) return null;
  return GEO[style] ??= build(style);
}
