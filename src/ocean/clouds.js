// Three or four big rounded clouds low over the horizon: billboards on a cylinder of sky round the camera, one draw call. The art is painted once on a canvas from overlapping soft puffs,
// each lit from its own top, so the lobes read as chunky cumulus with gentle shading and no noisy edge. The shader tints it by the hour: white by day, peach at the glow, blue-grey by moonlight.
import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { globalUniforms } from './shaders.js';

const CELL_W = 640, CELL_H = 360, DIST = 3200;
const CLOUDS = [   // azimuth (radians), elevation (degrees), width (metres), cell in the art
  [0.5, 9, 1500, 0], [2.3, 6.5, 1800, 1], [3.7, 11, 1300, 2], [5.3, 7, 1650, 1],
];

function paint() {
  const c = document.createElement('canvas'); c.width = CELL_W * 3; c.height = CELL_H;
  const x = c.getContext('2d'), rnd = mulberry32(2024);
  for (let cell = 0; cell < 3; cell++) {
    x.save(); x.translate(cell * CELL_W, 0); x.beginPath(); x.rect(0, 0, CELL_W, CELL_H); x.clip();
    const base = CELL_H * 0.8, puffs = [], n = 13 + cell * 2;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, bell = Math.sin(u * Math.PI), px = CELL_W * (0.14 + 0.72 * u) + (rnd() - 0.5) * 22;
      const r = 34 + bell * (44 + rnd() * 36);
      puffs.push({ x: px, y: base - r * 0.55, r });                                                     // the base row
      if (bell > 0.45) puffs.push({ x: px + (rnd() - 0.5) * 34, y: base - r * 0.8 - bell * (34 + rnd() * 62), r: r * (0.62 + rnd() * 0.26) });   // the cauliflower top
    }
    puffs.sort((a, b) => a.y - b.y);                                                                    // top lobes first; lower ones overlap them
    for (const p of puffs) {
      const g = x.createRadialGradient(p.x - p.r * 0.2, p.y - p.r * 0.34, p.r * 0.12, p.x, p.y, p.r);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(244,244,244,1)'); g.addColorStop(0.9, 'rgba(196,196,196,1)'); g.addColorStop(0.97, 'rgba(186,186,186,0.75)'); g.addColorStop(1, 'rgba(186,186,186,0)');
      x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.2832); x.fill();
    }
    // a soft, flat underside
    x.globalCompositeOperation = 'destination-out';
    const f = x.createLinearGradient(0, base - 14, 0, base + 16); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = f; x.fillRect(0, base - 14, CELL_W, CELL_H);
    x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 2; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export function makeClouds() {
  const pos = [], uv = [], idx = [];
  CLOUDS.forEach(([az, el, w, cell], i) => {
    const ce = Math.cos(el * Math.PI / 180), cx = Math.sin(az) * ce, cy = Math.sin(el * Math.PI / 180), cz = Math.cos(az) * ce, h = w * (CELL_H / CELL_W);
    const rx = Math.cos(az), rz = -Math.sin(az), up = 1;                                                 // right and up of a quad that faces the camera
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      pos.push(cx * DIST + rx * (u - 0.5) * w, cy * DIST + (v - 0.5) * h * up, cz * DIST + rz * (u - 0.5) * w);
      uv.push((cell + u) / 3, v);
    }
    const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const map = paint();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uGlow: globalUniforms.uGlow, uNight: globalUniforms.uNight, uSkyHorizon: globalUniforms.uSkyHorizon, uStyle: globalUniforms.uStyle },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`uniform sampler2D uMap; uniform float uGlow; uniform float uNight; uniform vec3 uSkyHorizon; varying vec2 vUv;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        if (t.a < 0.01) discard;
        float k = t.a > 0.0 ? t.r / t.a : 0.0;
        vec3 lit = mix(vec3(1.06, 1.05, 1.03), vec3(1.25, 0.78, 0.56), uGlow), shade = mix(vec3(0.72, 0.8, 0.93), vec3(0.62, 0.48, 0.66), uGlow);
        vec3 col = mix(shade, lit, smoothstep(0.45, 1.0, k));
        col = mix(col, col * vec3(0.24, 0.3, 0.46), uNight);
        col = mix(col, uSkyHorizon, 0.14 + 0.3 * (1.0 - smoothstep(0.1, 0.5, vUv.y)));              // the far air softens the lower part
        gl_FragColor = vec4(col, t.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = -9; m.userData.noOutline = true; m.userData.noShadow = true; m.name = 'clouds';
  return m;
}
