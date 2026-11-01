// Heightfield seabed. Each ecosystem supplies a height function and a substrate colour function.
import * as THREE from 'three';
import { patchUnderwater, globalUniforms } from '../ocean/shaders.js';

/** Canvas texture of fine grain + ripples, tiled across the seabed. */
function makeDetailTexture(noise, kind = 'sand', ripple = 1) {
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // Tileable: sample noise on a torus.
    const a = (x / size) * Math.PI * 2, b = (y / size) * Math.PI * 2;
    const nx = Math.cos(a) * 1.6, ny = Math.sin(a) * 1.6, nz = Math.cos(b) * 1.6, nw = Math.sin(b) * 1.6;
    const n = noise.n3(nx * 3 + nz * 0.7, ny * 3 + nw * 0.4, nz * 3 + nw * 3);
    const fine = noise.n3(nx * 14, ny * 14 + nw * 9, nz * 14);
    const rip = kind === 'sand' ? Math.sin((x / size) * Math.PI * 2 * 9 + n * 4) * 0.5 + 0.5 : 0.5;
    let v = 0.78 + n * 0.12 + fine * 0.1 + (rip - 0.5) * 0.12 * ripple;
    v = Math.max(0, Math.min(1, v));
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Tileable rock surface: weathered blotches, soft crack lines and pits (sandstone / platform rock).
 * Returns { tex: grey albedo detail, nrm: slope map (R,G = dH/du, dH/dv) } — slopes are precomputed so relief
 * shading interpolates smoothly instead of stepping per texel.
 */
function makeRockTexture(noise) {
  const size = 256, H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const a = (x / size) * Math.PI * 2, b = (y / size) * Math.PI * 2;
    const p = [Math.cos(a) * 1.6, Math.sin(a) * 1.6, Math.cos(b) * 1.6, Math.sin(b) * 1.6];
    const big = noise.n3(p[0] * 2 + p[2] * 0.5, p[1] * 2 + p[3] * 0.3, p[2] * 2 + p[3] * 2);
    const ridge = 1 - Math.abs(noise.n3(p[0] * 5, p[1] * 5 + p[3] * 3, p[2] * 5));
    const crack = Math.pow(Math.max(0, ridge - 0.8) / 0.2, 1.5);
    const mid = noise.n3(p[0] * 7 + p[3], p[1] * 7, p[2] * 7 + p[3] * 4);
    const pit = Math.max(0, noise.n3(p[0] * 11, p[1] * 11, p[2] * 11 + p[3] * 7) - 0.55) * 1.2;
    H[y * size + x] = 0.74 + big * 0.14 + mid * 0.08 - crack * 0.4 - pit * 0.2;
  }
  // Light blur (wrapping) so cracks and pits have soft edges.
  const B = new Float32Array(size * size), at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) B[y * size + x] = (at(x, y) * 4 + at(x + 1, y) + at(x - 1, y) + at(x, y + 1) + at(x, y - 1)) / 8;
  const bt = (x, y) => B[((y + size) % size) * size + ((x + size) % size)];
  const mk = fill => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const i = (y * size + x) * 4; fill(img.data, i, x, y); img.data[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  };
  const tex = mk((d, i, x, y) => { d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(1, bt(x, y))) * 255; });
  const nrm = mk((d, i, x, y) => {
    const du = (bt(x + 1, y) - bt(x - 1, y)) * 6, dv = (bt(x, y - 1) - bt(x, y + 1)) * 6; // canvas y runs opposite to v
    d[i] = Math.max(0, Math.min(255, 128 + du * 127)); d[i + 1] = Math.max(0, Math.min(255, 128 + dv * 127)); d[i + 2] = 128;
  });
  nrm.colorSpace = THREE.NoColorSpace;
  return { tex, nrm };
}

function bumpFromTexture(tex) {
  // The same grayscale texture doubles as a bump map.
  return tex;
}

export class Terrain {
  /**
   * @param {object} eco - ecosystem with heightAt(x,z), colorAt(x,z,h,slope) -> [r,g,b], size, segments
   */
  constructor(scene, eco, noise, quality) {
    this.eco = eco;
    const size = eco.terrainSize ?? 320;
    const segs = Math.round((eco.terrainSegments ?? 256) * quality.terrainScale);
    this.size = size;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, eco.heightAt(x, z));
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
      const [r, g, b] = eco.colorAt(x, z, h, 1 - nrm.getY(i));
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.baseColors = colors.slice();
    // Optional substrate mask: 0 = sand, 1 = rock (rock texture and relief instead of sand grain and ripples).
    const rockAt = eco.rockAt;
    if (rockAt) {
      const rock = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) rock[i] = rockAt(pos.getX(i), pos.getZ(i), pos.getY(i), 1 - nrm.getY(i));
      geo.setAttribute('aRock', new THREE.BufferAttribute(rock, 1));
    }
    const tex = makeDetailTexture(noise, eco.seabedKind ?? 'sand', eco.ripple ?? 1);
    tex.repeat.set(size / 3.5, size / 3.5);
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, map: tex, bumpMap: bumpFromTexture(tex), bumpScale: globalUniforms.uStyle.value > 0.5 ? 0.35 : 1.5, // stylised: calm surfaces roughness: 0.95, metalness: 0,
    });
    // Break up texture tiling by modulating with a second, larger-scale sample.
    const rock = rockAt ? makeRockTexture(noise) : null, rockTex = rock?.tex;
    mat.onBeforeCompile = (shader) => {
      if (rockTex) {
        shader.uniforms.uRockTex = { value: rockTex }; shader.uniforms.uRockNrm = { value: rock.nrm };
        shader.vertexShader = 'attribute float aRock; varying float vRock;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = aRock;');
        shader.fragmentShader = '#define USE_ROCK\nuniform sampler2D uRockTex; uniform sampler2D uRockNrm; varying float vRock;\n' + shader.fragmentShader;
      }
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        vec4 t1 = texture2D(map, vMapUv);
        vec4 t2 = texture2D(map, vMapUv * 0.23 + vec2(0.31, 0.17));
        vec4 t3 = texture2D(map, vMapUv * 0.061 + vec2(0.7, 0.4));
        vec3 sandDetail = t1.rgb * (0.55 + 0.6 * t2.rgb) * (0.75 + 0.4 * t3.rgb);
        #ifdef USE_ROCK
          float rk = smoothstep(0.15, 0.85, vRock);
          float r1 = texture2D(uRockTex, vMapUv * 0.55).r, r2 = texture2D(uRockTex, vMapUv * 0.13 + vec2(0.2, 0.6)).r;
          vec3 rockDetail = vec3(0.35 + 0.65 * r1) * (0.75 + 0.35 * r2);
          diffuseColor.rgb *= mix(mix(sandDetail, rockDetail * 1.15, rk), vec3(0.82), 0.6 * uStyle);
        #else
          diffuseColor.rgb *= mix(sandDetail, vec3(0.82), 0.6 * uStyle);
        #endif`);
      // Rock relief: perturb the normal with the rock texture's height (screen-space derivatives).
      if (rockTex) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float rk2 = smoothstep(0.15, 0.85, vRock) * (1.0 - 0.75 * uStyle);
          // Slopes from the precomputed map (two scales), applied in world space: uv u runs along +x, v along -z.
          vec2 sl = (texture2D(uRockNrm, vMapUv * 0.55).rg * 2.0 - 1.0) + 0.6 * (texture2D(uRockNrm, vMapUv * 0.13 + vec2(0.2, 0.6)).rg * 2.0 - 1.0);
          vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          vec3 pert = normalize(nW + vec3(-sl.x, 0.0, sl.y) * 0.9);
          normal = normalize(mix(normal, (viewMatrix * vec4(pert, 0.0)).xyz, rk2));
        }`);
      // Wet sand in the swash zone is darker (vertex colour) and glossy: a thin water film reflects the sky.
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.28, smoothstep(0.75, 0.25, vWPos.y) * smoothstep(-0.4, -0.05, vWPos.y));`);
    };
    patchUnderwater(mat, { key: 'terrain' });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);
    this.depthTex = Terrain.depthTexture(eco, size);
  }

  /** Low-res seabed height texture for the water shader (h = r*60-50). */
  static depthTexture(eco, size = 320, res = 128) {
    const data = new Uint8Array(res * res * 4);
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x = -size / 2 + (i + 0.5) / res * size, z = -size / 2 + (j + 0.5) / res * size;
      const h = eco.heightAt(x, z);
      const v = Math.max(0, Math.min(255, ((h + 50) / 60) * 255));
      const k = (j * res + i) * 4;
      data[k] = v; data[k + 1] = v; data[k + 2] = v; data[k + 3] = 255;
    }
    const t = new THREE.DataTexture(data, res, res);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    t.box = new THREE.Vector4(-size / 2, -size / 2, size, size);
    return t;
  }

  heightAt(x, z) { return this.eco.heightAt(x, z); }
  /** Repaint the seabed: fn(x, z, base[r,g,b]) -> [r,g,b] or null to keep the base colour (used by lab scenarios). */
  recolor(fn) {
    const pos = this.mesh.geometry.attributes.position, col = this.mesh.geometry.attributes.color, base = this.baseColors;
    for (let i = 0; i < pos.count; i++) {
      const c = fn(pos.getX(i), pos.getZ(i), [base[i * 3], base[i * 3 + 1], base[i * 3 + 2]]);
      if (c) col.setXYZ(i, c[0], c[1], c[2]); else col.setXYZ(i, base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
    }
    col.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.parent?.remove(this.mesh); }
}
