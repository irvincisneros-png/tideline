// Shape helpers for sites laid out from a real coastline: smooth paths, polygons and a cached signed-distance field.
// A site traces its shoreline (or a lake edge, or a wall) as a short list of points, and the terrain asks "how far inland am I?" thousands of times,
// so the answer is baked once into a grid (lazily, on the first call) and read back with bilinear interpolation. Pure maths, no DOM, no three.js.

/** Catmull-Rom through the points (open path), `sub` samples per span: a smooth curve through hand-placed points. */
export function smoothPath(pts, sub = 4) {
  const out = [], n = pts.length, P = i => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(pts[n - 1].slice());
  return out;
}
/** Same, but a closed loop (the curve wraps round). */
export function smoothLoop(pts, sub = 4) {
  const n = pts.length, out = [], P = i => pts[((i % n) + n) % n];
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  return out;
}

/** Distance from (x, z) to the segment a-b, and the parameter t (0..1) of the nearest point. */
export function segNearest(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return { d: Math.hypot(x - (ax + dx * t), z - (az + dz * t)), t };
}
/** Is the point inside the polygon (even-odd)? */
export function inPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
/** A walkable path with cumulative lengths: nearest point, the point at a distance along it, and the unit tangent there. */
export class Path {
  constructor(pts) {
    this.pts = pts; this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.length = this.cum[this.cum.length - 1];
  }
  /** { x, z, tx, tz } at arc length s (clamped); (tx, tz) is the unit tangent. */
  at(s) {
    s = Math.max(0, Math.min(this.length, s));
    let i = 1; while (i < this.pts.length - 1 && this.cum[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i], l = this.cum[i] - this.cum[i - 1] || 1, t = (s - this.cum[i - 1]) / l, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx, tz };
  }
  /** { d, s } the distance to the path and the arc length of the nearest point. */
  nearest(x, z) {
    let best = 1e18, bs = 0;
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i], r = segNearest(x, z, a[0], a[1], b[0], b[1]);
      if (r.d < best) { best = r.d; bs = this.cum[i - 1] + (this.cum[i] - this.cum[i - 1]) * r.t; }
    }
    return { d: best, s: bs };
  }
}

/**
 * A signed distance field of a polygon, baked on a grid: positive inside (metres from the edge), negative outside, plus the arc length of the
 * nearest edge point along the polygon (so a feature can be limited to a stretch of the shoreline). `poly` is a closed ring of [x, z].
 * `arcOf` (optional) maps a vertex index to its own arc-length value (default: the running length of the ring).
 */
export class DistField {
  constructor(poly, { half = 200, cell = 0.75 } = {}) {
    this.poly = poly; this.half = half; this.cell = cell; this.n = Math.round((half * 2) / cell) + 1; this.d = null; this.s = null;
    this.cum = [0]; for (let i = 1; i <= poly.length; i++) { const a = poly[i - 1], b = poly[i % poly.length]; this.cum.push(this.cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  }
  bake() {
    const { n, half, cell, poly } = this, d = this.d = new Float32Array(n * n), s = this.s = new Float32Array(n * n), m = poly.length;
    for (let j = 0; j < n; j++) {
      const z = -half + j * cell;
      for (let i = 0; i < n; i++) {
        const x = -half + i * cell; let best = 1e18, bs = 0;
        for (let e = 0; e < m; e++) {
          const a = poly[e], b = poly[(e + 1) % m], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
          let t = l2 > 0 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const px = x - (a[0] + dx * t), pz = z - (a[1] + dz * t), dd = px * px + pz * pz;
          if (dd < best) { best = dd; bs = this.cum[e] + (this.cum[e + 1] - this.cum[e]) * t; }
        }
        d[j * n + i] = (inPoly(x, z, poly) ? 1 : -1) * Math.sqrt(best); s[j * n + i] = bs;
      }
    }
  }
  /** Signed distance (metres; positive inside) at (x, z). Outside the grid it carries on in a straight line from the edge. */
  at(x, z) {
    if (!this.d) this.bake();
    const { n, half, cell, d } = this;
    const cx = Math.max(-half, Math.min(half, x)), cz = Math.max(-half, Math.min(half, z)), fx = (cx + half) / cell, fz = (cz + half) / cell;
    const i = Math.min(n - 2, Math.floor(fx)), j = Math.min(n - 2, Math.floor(fz)), tx = fx - i, tz = fz - j, k = j * n + i;
    const v = (d[k] * (1 - tx) + d[k + 1] * tx) * (1 - tz) + (d[k + n] * (1 - tx) + d[k + n + 1] * tx) * tz;
    const over = Math.hypot(x - cx, z - cz);
    return over > 0 ? v + Math.sign(v || 1) * over : v;
  }
  /** Arc length along the polygon of the nearest edge point (nearest grid cell is fine). */
  arc(x, z) {
    if (!this.s) this.bake();
    const { n, half, cell, s } = this;
    const i = Math.max(0, Math.min(n - 1, Math.round((x + half) / cell))), j = Math.max(0, Math.min(n - 1, Math.round((z + half) / cell)));
    return s[j * n + i];
  }
}
