// The finish every built prop gets, once, on every tier and with no extra pass or draw call. It runs on a model's flat triangles and returns one geometry holding:
//  - ambient occlusion in the vertex colours (a cool teal tint of the colour, darker under eaves, in inside corners and at the ground, from short rays through a coarse voxel copy of the model);
//  - aEdge: metres to each of the triangle's convex creases, for a thin lighter bevel along hard edges in the shader;
//  - the ink outline: a second copy of the triangles, wound backwards, flagged aInk = 1, that the vertex shader pushes out along a smooth normal (ocean/shaders.js, opts.ink).
// Props.place() applies it to every placed model, code-built or from the Blender set; the town bakes each house before merging them.
import * as THREE from 'three';

const MAX_HULL = 9000, CREASE = Math.cos(42 * Math.PI / 180), BIG = 1;       // triangles above this skip the outline; faces meeting at more than 42 degrees are a crease
const key = (x, y, z) => `${Math.round(x * 500)},${Math.round(y * 500)},${Math.round(z * 500)}`;

/** Rays from each vertex through a voxel copy of the model; below y = 0 is the ground. Darkens `col` in place. */
function occlusion(pos, nrm, col, strength) {
  const n = pos.length / 3, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos[i * 3 + a]); max[a] = Math.max(max[a], pos[i * 3 + a]); }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 0.01), cell = Math.max(0.05, span / 56);
  const nx = Math.ceil((max[0] - min[0]) / cell) + 3, ny = Math.ceil((max[1] - min[1]) / cell) + 3, nz = Math.ceil((max[2] - min[2]) / cell) + 3, grid = new Uint8Array(nx * ny * nz);
  const idx = (x, y, z) => { const i = Math.floor((x - min[0]) / cell) + 1, j = Math.floor((y - min[1]) / cell) + 1, k = Math.floor((z - min[2]) / cell) + 1; return i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? -1 : i + nx * (j + ny * k); };
  for (let t = 0; t < n; t += 3) {
    const a = t * 3, b = a + 3, c = a + 6;
    const L = Math.max(Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]), Math.hypot(pos[a] - pos[c], pos[a + 1] - pos[c + 1], pos[a + 2] - pos[c + 2]), Math.hypot(pos[c] - pos[b], pos[c + 1] - pos[b + 1], pos[c + 2] - pos[b + 2]));
    const m = Math.min(60, Math.ceil(L / cell) + 1);
    for (let u = 0; u <= m; u++) for (let v = 0; v <= m - u; v++) {
      const p = u / m, q = v / m, r = 1 - p - q, g = idx(pos[a] * p + pos[b] * q + pos[c] * r, pos[a + 1] * p + pos[b + 1] * q + pos[c + 1] * r, pos[a + 2] * p + pos[b + 2] * q + pos[c + 2] * r);
      if (g >= 0) grid[g] = 1;
    }
  }
  const T = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), D = new THREE.Vector3(), reach = Math.min(1.6, Math.max(cell * 9, span * 0.3));
  const cache = new Map();
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    N.set(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
    const ck = key(x, y, z) + key(N.x, N.y, N.z);
    let ao = cache.get(ck);
    if (ao === undefined) {
      T.set(Math.abs(N.y) > 0.9 ? 1 : 0, Math.abs(N.y) > 0.9 ? 0 : 1, 0).cross(N).normalize(); B.crossVectors(N, T);
      let hits = 0;
      for (let r = 0; r < 7; r++) {
        if (r === 0) D.copy(N);
        else { const a = (r - 1) * Math.PI / 3 + 0.3; D.copy(N).multiplyScalar(0.62).addScaledVector(T, Math.cos(a) * 0.78).addScaledVector(B, Math.sin(a) * 0.78).normalize(); }
        const ox = x + N.x * cell * 1.3, oy = y + N.y * cell * 1.3, oz = z + N.z * cell * 1.3;
        for (let s = 0, d = cell * 2; s < 5; s++, d = d * 1.55 + cell) {
          if (d > reach) break;
          const px = ox + D.x * d, py = oy + D.y * d, pz = oz + D.z * d, g = idx(px, py, pz);
          if (py < 0 || (g >= 0 && grid[g])) { hits += 1 - s * 0.14; break; }
        }
      }
      ao = Math.min(1, hits / 3.2); cache.set(ck, ao);
    }
    const k = ao * strength;                                                                   // never grey: red goes first, blue last
    col[i * 3] *= 1 - k * 0.74; col[i * 3 + 1] *= 1 - k * 0.56; col[i * 3 + 2] *= 1 - k * 0.42;
  }
}

/** aEdge for flat triangles: per vertex, the distance in metres to each of the triangle's edges that is a convex crease (BIG for any other edge, so it never reads as near). */
function creases(pos, nrm, cut) {
  const n = pos.length / 3, edges = new Map(), out = new Float32Array(n * 3).fill(BIG);
  const ek = (a, b) => { const p = key(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]), q = key(pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]); return p < q ? p + '|' + q : q + '|' + p; };
  const cen = t => [(pos[t * 3] + pos[t * 3 + 3] + pos[t * 3 + 6]) / 3, (pos[t * 3 + 1] + pos[t * 3 + 4] + pos[t * 3 + 7]) / 3, (pos[t * 3 + 2] + pos[t * 3 + 5] + pos[t * 3 + 8]) / 3];
  for (let t = 0; t < n; t += 3) for (let e = 0; e < 3; e++) {
    const k = ek(t + (e + 1) % 3, t + (e + 2) % 3); let l = edges.get(k); if (!l) edges.set(k, l = []); l.push([t, e]);   // edge e is opposite vertex e of the triangle
  }
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), AB = new THREE.Vector3();
  for (const l of edges.values()) {
    if (l.length < 2) continue;                                                                  // an open rim (a sheet's edge): left plain
    for (let i = 0; i < l.length; i++) {
      const [t, e] = l[i], na = [nrm[t * 3], nrm[t * 3 + 1], nrm[t * 3 + 2]], ca = cen(t);
      let hard = false, flat = false;
      for (let j = 0; j < l.length; j++) if (j !== i) {
        const u = l[j][0], cb = cen(u), dot = na[0] * nrm[u * 3] + na[1] * nrm[u * 3 + 1] + na[2] * nrm[u * 3 + 2];
        if (cut(t) || cut(u)) continue;                                                             // the butted end of a repeated piece
        if (dot > 0.985) flat = true;                                                               // another face carries on level: two boxes butted together, no real edge here
        else if (dot < CREASE && (cb[0] - ca[0]) * na[0] + (cb[1] - ca[1]) * na[1] + (cb[2] - ca[2]) * na[2] < 0) hard = true;   // the other face falls away behind this one: convex
      }
      if (!hard || flat) continue;
      const a = t + e, b = t + (e + 1) % 3, c = t + (e + 2) % 3;
      A.fromArray(pos, a * 3); B.fromArray(pos, b * 3); C.fromArray(pos, c * 3);
      const h = AB.subVectors(B, C).length() > 1e-5 ? A.sub(B).cross(AB.subVectors(C, B)).length() / AB.length() : 0;   // the height of vertex e above that edge
      // edge e: 0 at its two ends, h at the opposite vertex
      for (const v of [t, t + 1, t + 2]) out[v * 3 + e] = v === a ? h : 0;
    }
  }
  return out;
}

/**
 * One finished geometry from a model: AO in the colours, aEdge, and the outline hull merged in. `strength` is how dark the occlusion goes. `butt` ('z') names the axis a repeated piece
 * (a length of deck) is laid along: the faces at both ends of that axis meet the next piece, so they get no bevel and no outline. Geometry with no vertex colours is returned as it is.
 */
export function bakeModel(src, { strength = 0.62, butt = null } = {}) {
  if (src.userData.baked || !src.attributes.color) return src;
  const g = src.index ? src.toNonIndexed() : src.clone();
  g.computeVertexNormals();
  const pos = g.attributes.position.array, nrm = g.attributes.normal.array, col = g.attributes.color.array.slice(), n = pos.length / 3, tris = n / 3;
  occlusion(pos, nrm, col, strength);
  let cut = () => false;
  if (butt) {
    const c = butt === 'z' ? 2 : 0; let lo = Infinity, hi = -Infinity;
    for (let i = c; i < pos.length; i += 3) { lo = Math.min(lo, pos[i]); hi = Math.max(hi, pos[i]); }
    cut = t => Math.abs(nrm[t * 9 + c]) > 0.9 && (Math.abs(pos[t * 9 + c] - lo) < 0.02 || Math.abs(pos[t * 9 + c] - hi) < 0.02);
  }
  const edge = creases(pos, nrm, t => cut(Math.floor(t / 3))), hull = tris <= MAX_HULL, m = hull ? n * 2 : n;
  const P = new Float32Array(m * 3), Nn = new Float32Array(m * 3), Co = new Float32Array(m * 3), Ed = new Float32Array(m * 3), Ink = new Float32Array(m);
  P.set(pos); Nn.set(nrm); Co.set(col); Ed.set(edge);
  if (hull) {
    const sum = new Map();
    for (let i = 0; i < n; i++) {
      const k = key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), fk = key(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
      let s = sum.get(k); if (!s) sum.set(k, s = { v: [0, 0, 0], seen: new Set() });
      if (!s.seen.has(fk)) { s.seen.add(fk); s.v[0] += nrm[i * 3]; s.v[1] += nrm[i * 3 + 1]; s.v[2] += nrm[i * 3 + 2]; }
    }
    // A face hard against another (two boxes butted end to end) is inside the model: no outline there, or a line of ink shows along the joint.
    const faces = new Map();
    for (let i = 0; i < n; i++) { const k = key(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); let f = faces.get(k); if (!f) faces.set(k, f = new Set()); f.add(key(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2])); }
    const buried = t => { const b = key(-nrm[t * 9], -nrm[t * 9 + 1], -nrm[t * 9 + 2]); for (const v of [t * 3, t * 3 + 1, t * 3 + 2]) if (!faces.get(key(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])).has(b)) return false; return true; };
    for (let t = 0; t < tris; t++) {
      if (buried(t) || cut(t)) continue;                                                                    // left degenerate (all zero): nothing draws
      const order = [t * 3, t * 3 + 2, t * 3 + 1];                                                // wound backwards, so only the part sticking out past the silhouette draws
      order.forEach((v, c) => {
        const w = n + t * 3 + c, s = sum.get(key(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])).v, l = Math.hypot(s[0], s[1], s[2]) || 1;
        P[w * 3] = pos[v * 3]; P[w * 3 + 1] = pos[v * 3 + 1]; P[w * 3 + 2] = pos[v * 3 + 2];
        Nn[w * 3] = s[0] / l; Nn[w * 3 + 1] = s[1] / l; Nn[w * 3 + 2] = s[2] / l;
        Ink[w] = 1;
      });
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); out.setAttribute('color', new THREE.BufferAttribute(Co, 3));
  out.setAttribute('aEdge', new THREE.BufferAttribute(Ed, 3)); out.setAttribute('aInk', new THREE.BufferAttribute(Ink, 1));
  out.userData.baked = true;
  return out;
}
