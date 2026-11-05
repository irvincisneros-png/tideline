// Shared bits for the sites' built things, made in code in the cosy, chunky, flat-shaded, vertex-coloured style of the Blender prop set. A model is a non-indexed BufferGeometry with
// position, normal and color only (the same shape as a loaded .glb set), so props.place('name', x, z, opts) works unchanged. Units are metres; every model sits on y = 0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const colour = h => new THREE.Color(h);
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();

/** Give a primitive its flat colour and place it (position, Euler rotation, scale). Returns a non-indexed geometry with position, normal and color only. */
export function part(geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  M.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz));
  g.applyMatrix4(M);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count, c = new Float32Array(n * 3), k = colour(hex);
  for (let i = 0; i < n; i++) { c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
export const box = (w, h, d, hex, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) => part(new THREE.BoxGeometry(w, h, d), hex, x, y, z, rx, ry, rz);
export const cyl = (r0, r1, h, hex, x = 0, y = 0, z = 0, seg = 10, rx = 0, rz = 0) => part(new THREE.CylinderGeometry(r0, r1, h, seg), hex, x, y, z, rx, 0, rz);
export const ball = (r, hex, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => part(new THREE.SphereGeometry(r, 10, 7), hex, x, y, z, 0, 0, 0, sx, sy, sz);
export const torus = (R, r, hex, x, y, z, rx = Math.PI / 2) => part(new THREE.TorusGeometry(R, r, 6, 14), hex, x, y, z, rx, 0, 0);
export const cone = (r, h, hex, x = 0, y = 0, z = 0, seg = 10) => part(new THREE.ConeGeometry(r, h, seg), hex, x, y, z);

/** Merge parts, then bake a soft light-from-above shade into the colours so the faces read without a lit shader. AO, bevels and the ink outline come on top when the model is placed (world/propBake.js). */
export function finish(parts, shade = 0.26) {
  const geo = mergeGeometries(parts.map(g => (g.index ? g.toNonIndexed() : g)), false);
  geo.computeVertexNormals();
  const n = geo.attributes.normal, c = geo.attributes.color;
  for (let i = 0; i < c.count; i++) {
    const k = 1 - shade + shade * (n.getY(i) * 0.5 + 0.5) * 1.3;
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  return geo;
}

/** A set of triangles from vertex rows, coloured by `colorOf`, each triangle turned to face the way `faceOf(centroid, triangleIndex)` says (so winding mistakes cannot leave a hole). */
function facetGeometry(pos, tris, colorOf, faceOf) {
  const out = [], col = [];
  for (let t = 0; t < tris.length; t += 3) {
    let [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
    const A = pos[a], B = pos[b], C = pos[c];
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const cen = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3], f = faceOf(cen, t / 3);
    if (n[0] * f[0] + n[1] * f[1] + n[2] * f[2] < 0) [b, c] = [c, b];
    const k = colorOf(t / 3, [a, b, c]);
    for (const i of [a, b, c]) { out.push(...pos[i]); col.push(k.r, k.g, k.b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();   // flat (per-face) normals: the triangles are not shared
  return g;
}

/**
 * A lofted surface: `rings` is an array of rows of [x, y, z] points (same count per row; a hull is a row per station along its length, each row running round the cross-section).
 * `color` is a hex or (u, v) => hex, u along the rows (0..1), v along each row (0..1). Faces point away from the middle of their row (`inward: true` flips that), so the shape is solid from every side.
 */
export function loft(rings, color = 0xcccccc, { inward = false, close = false } = {}) {
  const R = rings.length, N = rings[0].length, pos = [], tris = [], cen = [];
  for (const row of rings) { pos.push(...row); const c = [0, 0, 0]; for (const p of row) { c[0] += p[0] / N; c[1] += p[1] / N; c[2] += p[2] / N; } cen.push(c); }
  const at = (i, j) => i * N + j, M2 = close ? N : N - 1;
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < M2; j++) {
    const j2 = (j + 1) % N; tris.push(at(i, j), at(i + 1, j), at(i, j2), at(i, j2), at(i + 1, j), at(i + 1, j2));
  }
  const cf = typeof color === 'function' ? color : () => color;
  const ringOf = t => Math.floor(t / (M2 * 2)), jOf = t => Math.floor((t % (M2 * 2)) / 2);
  return facetGeometry(pos, tris, t => colour(cf((ringOf(t) + 0.5) / (R - 1), (jOf(t) + 0.5) / M2)),
    (c, t) => { const r = cen[Math.min(R - 1, ringOf(t))], s = inward ? -1 : 1; return [(c[0] - r[0]) * s, (c[1] - r[1]) * s, (c[2] - r[2]) * s]; });
}
/** A flat sheet between two edges (arrays of [x, y, z]), facing `up` (+1 up, -1 down). */
export function sheet(left, right, hex, up = 1) {
  const pos = [], tris = [], n = left.length;
  for (let i = 0; i < n; i++) pos.push(left[i], right[i]);
  for (let i = 0; i < n - 1; i++) { const a = i * 2; tris.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const k = colour(hex);
  return facetGeometry(pos, tris, () => k, () => [0, up, 0]);
}
/** A closed polyhedron from a THREE geometry whose vertices are displaced by `jitter(x, y, z) -> [x, y, z]`, flat-shaded and coloured by `colorFn(y01, nx, ny, nz) -> hex`. Used for rocks. */
export function rockGeo(base, jitter, colorFn) {
  const g = base.index ? base.toNonIndexed() : base, p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const [x, y, z] = jitter(v.x, v.y, v.z); p.setXYZ(i, x, y, z); }
  g.computeVertexNormals(); g.computeBoundingBox();
  const bb = g.boundingBox, n = g.attributes.normal, c = new Float32Array(p.count * 3), kk = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, ny = (n.getY(i) + n.getY(i + 1) + n.getY(i + 2)) / 3;
    kk.set(colorFn((cy - bb.min.y) / Math.max(1e-3, bb.max.y - bb.min.y), n.getX(i), ny, n.getZ(i)));
    for (let k = 0; k < 3; k++) { c[(i + k) * 3] = kk.r; c[(i + k) * 3 + 1] = kk.g; c[(i + k) * 3 + 2] = kk.b; }
  }
  g.deleteAttribute('uv');
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/** A triangle fan round the middle of a closed outline, facing the `dir` vector (a flat cap, such as a stern transom). */
export function cap(points, hex, dir) {
  const c = [0, 0, 0]; for (const p of points) { c[0] += p[0] / points.length; c[1] += p[1] / points.length; c[2] += p[2] / points.length; }
  const pos = [c, ...points], tris = []; for (let i = 0; i < points.length; i++) tris.push(0, 1 + i, 1 + ((i + 1) % points.length));
  const k = colour(hex);
  return facetGeometry(pos, tris, () => k, () => dir);
}
/** A thin vertical wall between a lower and an upper edge (arrays of [x, y, z]): `outHex` on the side the `dir` vector points to, `inHex` on the other, so it shows from above on both sides. */
export function wall(low, high, outHex, inHex, dir) {
  const pos = [], tris = [], n = low.length;
  for (let i = 0; i < n; i++) pos.push(low[i], high[i]);
  for (let i = 0; i < n - 1; i++) { const a = i * 2; tris.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const ko = colour(outHex), ki = colour(inHex), inv = [-dir[0], -dir[1], -dir[2]];
  return [facetGeometry(pos, tris, () => ko, () => dir), facetGeometry(pos, tris, () => ki, () => inv)];
}

/**
 * A tapered tube along a path of THREE.Vector3 points (parallel-transport frames): `radii[i]` at each point, `N` sides, `ridge(u, j, angle) -> multiplier` bumps the radius (bark ridges),
 * `colorFn(u, v) -> hex|Color` colours each face (v is the way round: j = floor(v * N)). `cap` closes the far end in that hex colour (a snapped, pale-wood end).
 */
export function tube(pts, radii, N, colorFn = () => 0x888888, { ridge = null, cap: capHex = null } = {}) {
  const T = new THREE.Vector3(), Np = new THREE.Vector3(), B = new THREE.Vector3(), rings = [];
  for (let i = 0; i < pts.length; i++) {
    T.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
    if (i === 0) Np.crossVectors(T, Math.abs(T.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    else { Np.addScaledVector(T, -Np.dot(T)); Np.normalize(); }
    B.crossVectors(T, Np);
    const row = [];
    for (let j = 0; j < N; j++) {
      const a = (j / N) * Math.PI * 2, k = radii[i] * (ridge ? ridge(i / (pts.length - 1), j, a) : 1), c = Math.cos(a) * k, s = Math.sin(a) * k;
      row.push([pts[i].x + Np.x * c + B.x * s, pts[i].y + Np.y * c + B.y * s, pts[i].z + Np.z * c + B.z * s]);
    }
    rings.push(row);
  }
  const parts = [loft(rings, colorFn, { close: true })];
  if (capHex != null) parts.push(cap(rings[rings.length - 1], capHex, [T.x, T.y, T.z]));
  return parts.length > 1 ? mergeGeometries(parts, false) : parts[0];
}
