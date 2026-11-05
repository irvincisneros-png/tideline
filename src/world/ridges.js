// The Illawarra escarpment on the skyline, and the land between the site and its foot. One mesh and one draw call: a low-poly plain running out from the edge of the terrain,
// then long layered ridge ribbons, each further away and hazier than the last, so the skyline reads as blue distance, not as an island. Far enough out that it is off an overhead shot.
// Colours are mixed in the shader toward the live horizon colour, so the ridges follow dawn, dusk and night.
import * as THREE from 'three';
import { makeNoise } from '../core/noise.js';
import { globalUniforms } from '../ocean/shaders.js';

const LAYERS = [           // radius, height, wobble, how far along the haze (0 near .. 1 far)
  [640, 36, 16, 0.2], [930, 92, 24, 0.42], [1340, 172, 30, 0.62], [1900, 250, 26, 0.8],
];
const RAD = Math.PI / 180;

/** eco.ridge = { arc: [from, to] }: degrees of atan2(z, x) the ridges run through, inland from the site (the plain follows wherever the terrain's edge is land). */
export function makeRidges(scene, eco, terrain, sunDir) {
  const noise = makeNoise(4242), [a0, a1] = eco.ridge.arc, half = terrain.size / 2;
  const pos = [], idx = [], col = [], attr = [];   // attr: x = height up the ribbon (0..1), y = haze (0..1), z = gully shade (-1..1)
  const vert = (x, y, z, c, up, haze, sh) => { pos.push(x, y, z); col.push(c[0], c[1], c[2]); attr.push(up, haze, sh); return pos.length / 3 - 1; };
  // ---- the ribbons
  LAYERS.forEach(([R, H, W, haze], li) => {
    const n = Math.round((a1 - a0) * RAD * R / 16);
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = (a0 + (a1 - a0) * u) * RAD, ca = Math.cos(a), sa = Math.sin(a), k = a * R * 0.0036;
      const ends = Math.min(1, Math.min(u, 1 - u) / 0.06);                                                          // sinks away at each end of the arc, no cut edge
      const lump = noise.fbm2(k * 0.9 + li * 7.3, li * 3.1, 3), roll = noise.n2(k * 3.4, li * 5.7);
      const top = (H + lump * W * 2.4 + roll * W * 0.35) * (0.25 + 0.75 * ends * ends * (3 - 2 * ends)) + Math.sin(k * 0.37 + li) * W * 0.3;
      const spur = noise.fbm2(k * 2.2, li * 9.1 + 2, 2);                                                            // broad light and dark spurs
      const r = R + Math.sin(k * 1.3 + li * 2) * R * 0.018;
      for (const [up, y] of [[0, -6], [0.45, top * 0.5], [0.8, top * 0.84], [1, top]]) vert(r * ca, y, r * sa, [0.3, 0.46, 0.36], up, haze, spur);
      if (i < n) { const b = pos.length / 3 - 4; for (let q = 0; q < 3; q++) idx.push(b + q, b + q + 1, b + q + 4, b + q + 1, b + q + 5, b + q + 4); }
    }
  });
  // ---- the plain: rays out from the terrain's edge wherever that edge is land (or inside the ridge arc, so the far shore of a lake or a bay closes the view)
  const STEPS = [0, 7, 26, 90, 200, 420, 760], RAYS = 360, rows = STEPS.length, base = pos.length / 3, land = [];
  const y0 = 0.6, far = [0.42, 0.56, 0.38], near = [0.5, 0.62, 0.38];
  for (let i = 0; i <= RAYS; i++) {
    const a = (i / RAYS) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), e = half / Math.max(Math.abs(ca), Math.abs(sa)) - 0.5;   // the ray meets the square here, just inside
    const ex = e * ca, ez = e * sa, h = eco.heightAt(ex, ez), deg = ((a / RAD) - a0 + 720) % 360;
    const inArc = deg <= a1 - a0;
    land[i] = h > 0.15 ? 2 : inArc ? 1 : 0;
    const edge = h > 0.15 ? eco.colorAt(ex, ez, h, 0) : null;
    STEPS.forEach((s, j) => {
      const t = j / (rows - 1), d = e + s, rise = noise.fbm2(ca * d * 0.004 + 3, sa * d * 0.004, 3);
      const y = j === 0 ? (h > 0.15 ? h : y0) : Math.max(y0, (h > 0.15 ? h : y0) * (1 - t) + t * 8 + rise * 14 * t);
      const c = edge ?? (j < 1 ? [0.86, 0.8, 0.62] : near), k = Math.sqrt(t);     // a thin far beach, then scrub
      vert(ca * d, y, sa * d, [c[0] + (far[0] - c[0]) * k, c[1] + (far[1] - c[1]) * k, c[2] + (far[2] - c[2]) * k], 1, t * 0.2, rise * 0.5);
    });
  }
  for (let i = 0; i < RAYS; i++) if (land[i] && land[i + 1]) for (let j = 0; j < rows - 1; j++) {
    const a = base + i * rows + j, b = a + rows;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aRidge', new THREE.Float32BufferAttribute(attr, 3));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uSkyHorizon: globalUniforms.uSkyHorizon, uSkyTop: globalUniforms.uSkyTop, uNight: globalUniforms.uNight, uStyleSun: globalUniforms.uStyleSun },
    vertexShader: /* glsl */`attribute vec3 aRidge; attribute vec3 color; varying vec3 vR; varying vec3 vC; varying vec3 vW;
      void main() { vR = aRidge; vC = color; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`uniform vec3 uSkyHorizon; uniform vec3 uSkyTop; uniform float uNight; uniform vec3 uStyleSun; varying vec3 vR; varying vec3 vC; varying vec3 vW;
      void main() {
        float haze = vR.y, up = vR.x;
        // Painted forest, gently lit spurs; cooler and dimmer with the light of the hour.
        vec3 col = vC * (1.0 + vR.z * 0.2) * mix(vec3(1.0), uStyleSun * 1.5, 0.5) * mix(1.0, 0.35, uNight);
        // Atmosphere: each layer is a flatter, bluer tint of the sky than the one in front, and mist pools at its foot so the next ridge's crisp top stands against it.
        vec3 air = mix(uSkyHorizon, uSkyTop, 0.34);
        col = mix(col, air, clamp(haze, 0.0, 0.95));
        col = mix(col, uSkyHorizon, (1.0 - smoothstep(0.05, 0.72, up)) * 0.72);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.userData.noOutline = true; m.userData.noShadow = true; m.name = 'ridges';
  scene.add(m);
  return m;
}
