// Leafy shrubs and trees built from "leaf cards": small quads textured with procedurally painted twigs of leaves
// (alpha-cut), arranged in a crown with rounded normals so the canopy shades like a soft volume.
// Atlas cells (3 x 2): 0 = coastal wattle phyllodes + flowers, 1 = banksia leaves, 2 = fine heath foliage,
// 3 = beach spinifex tuft, 4 = (spare), 5 = solid white (trunks and flowers sample it, so their vertex colours show unchanged).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/noise.js';
import { seg, LOD } from './lod.js';

const UP = new THREE.Vector3(0, 1, 0);
const COLS = 3, ROWS = 2;
const WHITE_UV = [5 / 6, 0.25]; // centre of cell 5 (u right, v up)

let atlas = null;
/** The shared foliage atlas (painted once per page). */
export function foliageAtlas() {
  if (atlas) return atlas;
  const S = 256, c = document.createElement('canvas'); c.width = S * COLS; c.height = S * ROWS;
  const g = c.getContext('2d');
  const rnd = mulberry32(5);
  const cell = (i, draw) => { g.save(); g.translate((i % COLS) * S, Math.floor(i / COLS) * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); draw(); g.restore(); };
  const leafShape = (x, y, len, w, ang, fill, vein) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.45, -w, len, 0); g.quadraticCurveTo(len * 0.45, w, 0, 0);
    g.fillStyle = fill; g.fill();
    if (vein) { g.strokeStyle = vein; g.lineWidth = 1; g.beginPath(); g.moveTo(1, 0); g.lineTo(len * 0.92, 0); g.stroke(); }
    g.restore();
  };
  const twig = (x0, y0, x1, y1, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 10, (y0 + y1) / 2, x1, y1); g.stroke(); };
  // 0: coastal wattle: long narrow phyllodes along arching twigs, a few yellow rod flowers.
  cell(0, () => {
    for (let t = 0; t < 3; t++) {
      const x0 = 70 + t * 55, y0 = 250, x1 = 40 + t * 80 + rnd() * 30, y1 = 20 + rnd() * 40;
      twig(x0, y0, x1, y1, 3, '#5a4a32');
      for (let i = 0; i < 16; i++) {
        const k = 0.15 + i / 18, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
        const side = i % 2 ? 1 : -1, ang = -Math.PI / 2 + side * (0.5 + rnd() * 0.5);
        const l = 45 + rnd() * 30, light = 26 + rnd() * 14;
        leafShape(x, y, l, 4.5 + rnd() * 2.5, ang, `hsl(${96 + rnd() * 14}, ${38 + rnd() * 10}%, ${light}%)`, `hsl(100, 30%, ${light + 12}%)`);
        if (rnd() < 0.22) { g.save(); g.translate(x, y); g.rotate(ang + side * 0.4); g.fillStyle = '#f0c419'; g.beginPath(); g.roundRect(4, -3.5, 26, 7, 3.5); g.fill(); g.fillStyle = '#ffe36a'; for (let d = 0; d < 6; d++) { g.beginPath(); g.arc(7 + d * 4, (d % 2) * 2 - 1, 1.6, 0, 7); g.fill(); } g.restore(); }
      }
    }
  });
  // 1: coast banksia: leathery, oblong leaves in whorls, dark green above, silvery-white below.
  cell(1, () => {
    for (let t = 0; t < 4; t++) {
      const cx = 50 + t * 52 + rnd() * 10, cy = 60 + rnd() * 130;
      twig(cx, 256, cx + (rnd() - 0.5) * 20, cy, 3, '#5c544a');
      for (let i = 0; i < 13; i++) {
        const ang = (i / 13) * Math.PI * 2 + rnd() * 0.3, l = 42 + rnd() * 26;
        const under = rnd() < 0.35;
        leafShape(cx, cy, l, 7 + rnd() * 3, ang, under ? `hsl(${80 + rnd() * 20}, 8%, ${68 + rnd() * 10}%)` : `hsl(${105 + rnd() * 15}, ${30 + rnd() * 10}%, ${20 + rnd() * 9}%)`, under ? '#9aa090' : '#4b6440');
      }
    }
  });
  // 2: fine heath foliage (tiny leaves packed on branching twigs).
  cell(2, () => {
    for (let t = 0; t < 7; t++) twig(128 + (rnd() - 0.5) * 60, 256, 30 + rnd() * 196, 30 + rnd() * 150, 2, '#5a5040');
    for (let i = 0; i < 420; i++) {
      const x = 20 + rnd() * 216, y = 18 + rnd() * 200;
      leafShape(x, y, 9 + rnd() * 7, 3 + rnd() * 1.5, rnd() * Math.PI * 2, `hsl(${95 + rnd() * 25}, ${22 + rnd() * 15}%, ${26 + rnd() * 16}%)`);
    }
  });
  // 3: beach spinifex: a tussock of arching, silvery-green, hairy leaves from one base, a couple of spiky seed heads.
  cell(3, () => {
    for (let i = 0; i < 46; i++) {
      const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.4, len = 90 + rnd() * 140, bend = (rnd() - 0.5) * 0.9 + Math.sign(ang + Math.PI / 2) * 0.5;
      const x0 = 128 + (rnd() - 0.5) * 30, y0 = 252;
      const x1 = x0 + Math.cos(ang) * len * 0.6, y1 = y0 + Math.sin(ang) * len * 0.6, x2 = x1 + Math.cos(ang + bend) * len * 0.45, y2 = Math.min(250, y1 + Math.sin(ang + bend) * len * 0.45 + len * 0.15);
      const l = 50 + rnd() * 20;
      g.strokeStyle = `hsl(${85 + rnd() * 25}, ${8 + rnd() * 10}%, ${l}%)`; g.lineWidth = 2.5 + rnd() * 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x1, y1, x2, y2); g.stroke();
      g.strokeStyle = `hsla(70, 20%, ${l + 22}%, 0.6)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x1, y1, x2, y2); g.stroke();
    }
    for (let h = 0; h < 2; h++) { const cx = 80 + rnd() * 100, cy = 60 + rnd() * 60; g.strokeStyle = '#cdbf8e'; g.lineWidth = 1.5; for (let k = 0; k < 26; k++) { const a = rnd() * 6.28, r = 16 + rnd() * 14; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); } }
  });
  cell(5, () => { g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  atlas = tex;
  return tex;
}

/** A leaf card at p facing roughly n, side length s, using atlas cell i. Normals are bent toward `bend` (crown roundness). */
function card(p, n, s, i, tint, rnd, bendFrom, bendK = 0.65, base = 0.35, spin = 1.6) {
  s *= Math.pow(LOD.k, -0.5); // low-detail versions use fewer but larger cards, so distant crowns stay just as full
  const g = new THREE.PlaneGeometry(s, s);
  g.translate(0, s * base, 0); // twig base near the attachment point
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (rnd() - 0.5) * spin));
  g.applyQuaternion(q); g.translate(p.x, p.y, p.z);
  const u0 = (i % COLS) / COLS, v0 = 1 - (Math.floor(i / COLS) + 1) / ROWS; // cell i in UV space (row 0 at the top of the canvas)
  const uv = g.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / COLS, v0 + uv.getY(k) / ROWS);
  const pos = g.attributes.position, nrm = g.attributes.normal, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k).sub(bendFrom).normalize().multiplyScalar(bendK).addScaledVector(n, 1 - bendK).normalize();
    nrm.setXYZ(k, v.x, v.y, v.z);
    col.set(tint, k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g.index ? g.toNonIndexed() : g;
}
/** Opaque part (trunk, flowers) with UVs on the white atlas cell. */
function solid(geo, colFn) {
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(k)) geo.deleteAttribute(k);
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, col = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); col.set(colFn(v), i * 3); uv[i * 2] = WHITE_UV[0]; uv[i * 2 + 1] = WHITE_UV[1]; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
function limb(a, b, r0, r1, col) {
  const len = Math.max(1e-4, a.distanceTo(b));
  const g = new THREE.CylinderGeometry(r1, r0, len, seg(6), 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3().subVectors(b, a).normalize()));
  g.translate(a.x, a.y, a.z);
  return solid(g, () => col);
}

/** Coastal wattle (Acacia longifolia subsp. sophorae): a low, dense, wind-sheared dome of phyllode cards with yellow rods. */
export function wattleShrub(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const W = 1.1 + rnd() * 0.8, H = 0.9 + rnd() * 0.9;             // crown half-width and height
  const centre = new THREE.Vector3(0, H * 0.55, 0);
  for (let s = 0; s < 5; s++) {
    const a = rnd() * 6.28, top = new THREE.Vector3(Math.cos(a) * W * 0.6, H * (0.6 + rnd() * 0.3), Math.sin(a) * W * 0.6);
    parts.push(limb(new THREE.Vector3(0, 0, 0), top, 0.05, 0.02, [0.36, 0.31, 0.24]));
  }
  const n = seg(70, 20);
  for (let i = 0; i < n; i++) {
    // Points biased to the crown surface; the seaward side (-x after random rotation) is clipped lower by salt wind.
    const d = new THREE.Vector3(rnd() - 0.5, rnd() * 0.9, rnd() - 0.5).normalize();
    const r = 0.7 + rnd() * 0.3;
    const p = new THREE.Vector3(d.x * W * r, Math.max(0.1, d.y * H * r * (0.75 + 0.25 * (d.x + 1))), d.z * W * r);
    const nrm = p.clone().sub(centre).normalize().add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.8)).normalize();
    const k = 0.75 + rnd() * 0.35;
    parts.push(card(p, nrm, 0.55 + rnd() * 0.3, 0, [k, k * (0.97 + rnd() * 0.06), k * 0.9], rnd, centre));
  }
  return mergeGeometries(parts);
}

/** Coast banksia (Banksia integrifolia): gnarled grey trunk and limbs, leaf-card whorls at the branch tips, flower spikes and old cones. */
export function banksiaTree(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const bark = [0.44, 0.41, 0.37], tips = [];
  const grow = (p, dir, len, rad, depth) => {
    const mid = p.clone().addScaledVector(dir, len * 0.5).add(new THREE.Vector3((rnd() - 0.5) * len * 0.2, 0, (rnd() - 0.5) * len * 0.2));
    const end = p.clone().addScaledVector(dir, len);
    parts.push(limb(p, mid, rad, rad * 0.86, bark.map(c => c * 0.8)), limb(mid, end, rad * 0.86, rad * 0.7, bark));
    if (depth <= 0) { tips.push({ p: end, dir }); return; }
    const k = depth > 2 ? 2 : 2 + (rnd() < 0.5 ? 1 : 0);
    for (let i = 0; i < k; i++) {
      const nd = dir.clone().applyAxisAngle(new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize(), 0.45 + rnd() * 0.5);
      nd.y = Math.max(0.15, nd.y); nd.normalize();
      grow(end, nd, len * (0.62 + rnd() * 0.2), rad * 0.68, depth - 1);
    }
  };
  const H = 1.3 + rnd() * 1.0;
  grow(new THREE.Vector3(), new THREE.Vector3((rnd() - 0.5) * 0.35, 1, (rnd() - 0.5) * 0.35).normalize(), H, 0.14 + rnd() * 0.05, 4);
  // Whole-crown centre for rounded canopy normals.
  const crown = tips.reduce((a, t) => a.add(t.p), new THREE.Vector3()).multiplyScalar(1 / tips.length);
  for (const { p, dir } of tips) {
    const m = seg(5, 2);
    for (let i = 0; i < m; i++) {
      const nrm = p.clone().sub(crown).normalize().add(new THREE.Vector3(rnd() - 0.5, rnd() * 0.6, rnd() - 0.5)).normalize();
      const k = 0.8 + rnd() * 0.3;
      parts.push(card(p.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.3, (rnd() - 0.3) * 0.3, (rnd() - 0.5) * 0.3)), nrm, 0.7 + rnd() * 0.35, 1, [k, k, k], rnd, crown, 0.55));
    }
    if (rnd() < 0.35) {
      const old = rnd() < 0.5;
      const g = new THREE.CylinderGeometry(0.03, 0.035, 0.12, seg(7, 4), 1);
      g.translate(0, 0.06, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir)); g.translate(p.x, p.y, p.z);
      parts.push(solid(g, () => (old ? [0.36, 0.33, 0.3] : [0.92, 0.86, 0.5])));
    }
  }
  return mergeGeometries(parts);
}

/** Coastal heath filler (low tea-tree / heath shrubs between the wattles): fine-leaved dome. */
export function heathShrub(seed) {
  const rnd = mulberry32(seed);
  const parts = [];
  const W = 0.6 + rnd() * 0.5, H = 0.5 + rnd() * 0.5, centre = new THREE.Vector3(0, H * 0.5, 0);
  parts.push(limb(new THREE.Vector3(), new THREE.Vector3(0, H * 0.6, 0), 0.03, 0.015, [0.38, 0.33, 0.26]));
  const n = seg(26, 8);
  for (let i = 0; i < n; i++) {
    const d = new THREE.Vector3(rnd() - 0.5, rnd() * 0.9 + 0.05, rnd() - 0.5).normalize();
    const p = new THREE.Vector3(d.x * W, d.y * H, d.z * W);
    const k = 0.75 + rnd() * 0.35;
    parts.push(card(p, p.clone().sub(centre).normalize(), 0.4 + rnd() * 0.2, 2, [k, k, k * 0.95], rnd, centre));
  }
  return mergeGeometries(parts);
}

/** Beach spinifex (Spinifex sericeus) as a patch of grass-card tussocks: each tussock is three crossed vertical cards. */
export function spinifexPatch(seed) {
  const rnd = mulberry32(seed);
  const parts = [], up = new THREE.Vector3(0, 1, 0);
  const n = seg(9, 4);
  for (let k = 0; k < n; k++) {
    const c = new THREE.Vector3((rnd() - 0.5) * 3, 0, (rnd() - 0.5) * 3);
    const s = 0.5 + rnd() * 0.35, a0 = rnd() * Math.PI, tone = 0.85 + rnd() * 0.25;
    for (let j = 0; j < 3; j++) {
      const a = a0 + (j / 3) * Math.PI;
      // Vertical card facing horizontally; normals bent up so tussocks light like the ground they cover.
      parts.push(card(c, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), s, 3, [tone, tone, tone * 0.95], rnd, c.clone().add(new THREE.Vector3(0, -1.5, 0)), 0.75, 0.5, 0.15));
    }
  }
  return mergeGeometries(parts);
}
