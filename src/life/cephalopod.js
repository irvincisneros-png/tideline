// Squid and cuttlefish models (look.cephalopod = 'squid' | 'cuttle'). Same contract as buildFish: head toward +x, dorsal +y, units metres,
// returns { geometry, texture, emissive, length }. Built from: a tapering mantle (pointed tail for a squid, an oval for a cuttlefish), a rounder head
// with two big glossy eyes, eight tapering arms that fan out and curl at the tips, two long thin tentacles with paddle-shaped clubs, and fins
// (a diamond pair on a squid, a rippling skirt all round a cuttlefish). Skins are painted on a canvas: chromatophore dots, bars and sheen.
// opts.flatTail lays everything flat (top-down brag mat). The texture rows are: body (0-0.76), fins (0.78-0.86), arms (0.88-0.94), eyes (0.95-1).
import * as THREE from 'three';

const TAU = Math.PI * 2;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Canvas fraction (0 top .. 1 bottom) -> uv.y. */
const vOf = f => 1 - f;

function paintSkin(look, W = 512, H = 512) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'), img = ctx.createImageData(W, H), p = look.paint;
  const put = (i, col) => { img.data[i] = Math.min(255, col[0] * 255); img.data[i + 1] = Math.min(255, col[1] * 255); img.data[i + 2] = Math.min(255, col[2] * 255); img.data[i + 3] = 255; };
  for (let py = 0; py < H; py++) {
    const f = (py + 0.5) / H;
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / W, i = (py * W + px) * 4;
      if (f < 0.77) { const phi = (f / 0.76) * TAU; put(i, p.body(u, Math.cos(phi), phi < Math.PI ? 1 : -1)); }
      else if (f < 0.87) put(i, p.fin ? p.fin(u, 'fin', (f - 0.78) / 0.08) : p.body(u, 0.3, 1));
      else if (f < 0.945) put(i, p.arm ? p.arm(u, (f - 0.88) / 0.06) : p.body(0.95, 0.3, 1));
      else put(i, u < 0.33 ? [0.04, 0.04, 0.06] : u < 0.66 ? (p.iris ?? [0.86, 0.78, 0.45]) : [1, 1, 1]);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

export function buildCephalopod(look, opts = {}) {
  const L = look.length, cuttle = look.cephalopod === 'cuttle', flat = !!opts.flatTail;
  const mantleEnd = cuttle ? 0.52 : 0.58, headEnd = mantleEnd + 0.07;
  const x0 = -L / 2, xHead = x0 + headEnd * L, m = mantleEnd / headEnd;
  const R = look.depth * L * 0.5 * (flat ? 0.6 : 1), W = look.width * L * 0.5;
  const pos = [], uv = [], idx = [], fin = [];
  const vert = (p, u, f, a = 0, b = -1) => { pos.push(p.x, p.y, p.z); uv.push(u, vOf(f)); fin.push(a, b); return pos.length / 3 - 1; };

  // ---- the mantle and head: rings along x, a superellipse cross-section
  const RINGS = 48, SEG = 24;
  const mantle = t => cuttle
    ? Math.pow(Math.sin(Math.PI * (0.03 + 0.94 * t)), 0.5) * 1.0
    : Math.pow(Math.sin(Math.min(1, t / 0.82) * Math.PI / 2), 0.85) * (1 - 0.12 * sstep(0.84, 1, t));
  const rEnd = mantle(1);
  const prof = u => {
    if (u <= m) return mantle(u / m);
    const s = (u - m) / (1 - m);
    return rEnd * (1 + (cuttle ? 0.35 : 0.3) * Math.sin(Math.PI * Math.min(1, s * 0.9))) * (1 - 0.68 * Math.pow(s, 2.4));
  };
  const rad = [];
  for (let r = 0; r <= RINGS; r++) {
    const u = r / RINGS, close = u > 0.965 ? Math.sqrt(Math.max(0, (1 - u) / 0.035)) : 1, pr = prof(u) * close;
    rad.push(pr);
    for (let s = 0; s <= SEG; s++) {
      const phi = (s / SEG) * TAU, c = Math.cos(phi), sn = Math.sin(phi);
      const bulge = cuttle ? 1 : 1 + 0.08 * Math.max(0, c) * sstep(0.2, 0.6, u); // a soft ridge along the back of a squid
      pos.push(x0 + u * headEnd * L, c * R * pr * bulge * (cuttle ? 0.62 : 1), sn * W * pr * (cuttle ? 1.25 : 1));
      uv.push(u * 0.998, vOf((s / SEG) * 0.76)); fin.push(0, -1);
    }
  }
  for (let r = 0; r < RINGS; r++) for (let s = 0; s < SEG; s++) { const a = r * (SEG + 1) + s, b = a + SEG + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const headU = m + (1 - m) * 0.35, headR = prof(headU), rowX = u => x0 + u * headEnd * L;
  const headRy = R * (cuttle ? 0.62 : 1) * headR, headRz = W * (cuttle ? 1.25 : 1) * headR;
  const endRy = R * (cuttle ? 0.62 : 1) * prof(0.955), endRz = W * (cuttle ? 1.25 : 1) * prof(0.955);

  // ---- tubes (arms, tentacles): a swept ring with a radius profile, frames from the path
  const tube = (path, radius, rings, seg, uvOf, fAt, flatten = 1) => {
    const pts = Array.from({ length: rings + 1 }, (_, i) => path(i / rings)), start = pos.length / 3;
    for (let i = 0; i <= rings; i++) {
      const k = i / rings, t = (pts[Math.min(rings, i + 1)].clone().sub(pts[Math.max(0, i - 1)])).normalize();
      let ref = Math.abs(t.y) > 0.9 ? V(0, 0, 1) : V(0, 1, 0);
      const bnorm = new THREE.Vector3().crossVectors(t, ref).normalize(), nrm = new THREE.Vector3().crossVectors(bnorm, t).normalize();
      const rr = radius(k);
      for (let j = 0; j < seg; j++) {
        const q = (j / seg) * TAU, cx = Math.cos(q) * rr, cy = Math.sin(q) * rr * flatten;
        const [uu, vv] = uvOf(k, j / seg);
        vert(pts[i].clone().addScaledVector(nrm, cx).addScaledVector(bnorm, cy), uu, vv);
      }
    }
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
      const a = start + i * seg + j, a1 = start + i * seg + (j + 1) % seg, b = a + seg, b1 = a1 + seg;
      idx.push(a, b, a1, a1, b, b1);
    }
  };

  // ---- eight arms: fan out round the mouth, longest underneath, tips curling
  const armL = (cuttle ? 0.16 : 0.22) * L, r0 = (cuttle ? 0.034 : 0.022) * L;
  for (let i = 0; i < 8; i++) {
    const th = ((i + 0.5) / 8) * TAU, cy = Math.cos(th), sz = Math.sin(th);
    const len = armL * (0.72 + 0.28 * (0.5 - 0.5 * Math.cos(th))) * (1 + (i % 2) * 0.04); // the dorsal pair is the shortest, the ventral pair the longest
    const root = V(xHead - 0.006 * L, cy * endRy * 0.55, sz * endRz * 0.55);
    const wob = i * 1.7;
    tube(k => {
      const fwd = len * k * (0.97 - 0.12 * k), out = len * (0.04 + 0.42 * Math.pow(k, 1.5)), curl = len * 0.26 * Math.sin(k * Math.PI * 1.15 + wob) * k, droop = flat ? 0 : len * 0.2 * k * k;
      return V(root.x + fwd, root.y + cy * out * (flat ? 0.2 : 1) + (-sz) * curl * (flat ? 0.2 : 1) - droop, root.z + sz * out * (flat ? 1.6 : 1) + cy * curl * (flat ? 1.6 : 1));
    }, k => r0 * Math.pow(1 - k, 0.78) + 0.0012 * L, 12, 8, (k, a) => [0.15 + 0.7 * k, 0.885 + 0.055 * a], null, cuttle ? 0.85 : 1);
  }
  // ---- two long tentacles: thin stalks with a paddle at the end, trailing in an S-curve
  const tentL = (1 - headEnd) * L - 0.002 * L, rs = 0.0085 * L;
  for (const side of [-1, 1]) {
    const root = V(xHead - 0.004 * L, -0.12 * endRy, side * endRz * 0.7);
    tube(k => {
      const wave = tentL * 0.1 * Math.sin(k * Math.PI * 2.2 + (side > 0 ? 0 : 1.6)) * (0.25 + k), out = tentL * 0.1 * k * k, droop = flat ? 0 : tentL * 0.1 * k;
      return V(root.x + tentL * k * 0.98, root.y - droop + (flat ? 0 : wave * 0.4), root.z + side * out + (flat ? wave : wave * 0.6));
    }, k => { const club = k > 0.74 ? Math.sin(Math.PI * Math.min(1, (k - 0.74) / 0.26)) ** 0.7 : 0; return Math.max(0.0012 * L, rs * (1 - 0.35 * k) + 0.0145 * L * club) * (k > 0.985 ? 0.4 : 1); },
    18, 8, (k, a) => [0.1 + 0.85 * k, 0.885 + 0.055 * a], null, 1);
  }

  // ---- fins: a pair of diamonds on the back half of a squid's mantle; a rippling skirt right round a cuttlefish
  const finSheet = (side, kA, kB, widthFn, y0, n) => {
    const start = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const k = i / n, tm = kA + (kB - kA) * k, u = tm * m, pr = mantle(tm), w = widthFn(k);
      const bx = rowX(u), by = (cuttle ? 0.0 : y0) * R, bz = side * W * pr * (cuttle ? 1.22 : 0.97);
      const rip = cuttle ? Math.sin(k * 20 + side) * 0.012 * L : Math.sin(k * 5) * 0.004 * L;
      vert(V(bx, by, bz), u, 0.8, k, 0);
      vert(V(bx - w * 0.28 * L, by + (flat ? 0 : rip + 0.01 * L), bz + side * w * L), u, 0.85, k, 1);
    }
    for (let i = 0; i < n; i++) { const a = start + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  for (const side of [-1, 1]) {
    if (cuttle) finSheet(side, 0.08, 0.97, k => 0.075 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + k * 0.96)), 0.7) + 0.008, 0, 26);
    else finSheet(side, 0.06, 0.64, k => 0.17 * (k < 0.5 ? Math.pow(k / 0.5, 0.9) : Math.pow((1 - k) / 0.5, 0.9)) + 0.004, 0.1, 22);
  }

  // ---- eyes: flush with the head, set into it like a lens in a socket (a dark rim, a flat gold-silver iris, a black pupil and a small white highlight), not bug-eyes on stalks.
  // Each is a flattened ball (`fz` squashes it across the head) whose outer face barely clears the skin.
  const ball = (cx, cy, cz, r, u, f, fz = 1, segW = 16, segH = 10) => {
    const start = pos.length / 3;
    for (let a = 0; a <= segH; a++) for (let b = 0; b <= segW; b++) {
      const pa = (a / segH) * Math.PI, pb = (b / segW) * TAU;
      vert(V(cx + Math.cos(pa) * r * 0.95, cy + Math.sin(pa) * Math.cos(pb) * r, cz + Math.sin(pa) * Math.sin(pb) * r * fz), u, f, 0, -2);
    }
    for (let a = 0; a < segH; a++) for (let b = 0; b < segW; b++) { const p0 = start + a * (segW + 1) + b, p1 = p0 + segW + 1; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
  };
  const re = Math.max(headRy, headRz) * (cuttle ? 0.5 : 0.42), ex = rowX(headU) + 0.004 * L, ey = headRy * 0.12;
  for (const side of [-1, 1]) {
    const ez = side * headRz * 0.9;
    ball(ex, ey, ez, re * 0.98, 0.16, 0.97, 0.32);                                                  // the socket: a dark rim round the eye
    ball(ex, ey, ez + side * re * 0.05, re * 0.8, 0.5, 0.97, 0.42);                                // the iris, a flat disc
    ball(ex + re * 0.1, ey, ez + side * re * 0.23, re * 0.5, 0.16, 0.97, 0.4);                     // the pupil
    ball(ex + re * 0.28, ey + re * 0.24, ez + side * re * 0.42, re * 0.14, 0.84, 0.97, 0.4, 8, 5); // the highlight
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aFin', new THREE.Float32BufferAttribute(fin, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geometry: geo, texture: paintSkin(look), emissive: null, length: L };
}
