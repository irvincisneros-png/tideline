// Ocean surface (GPU swell), the breaking set-wave mesh (CPU profile) and the sky dome.
import * as THREE from 'three';
import { globalUniforms, uwFogGLSL, skyGLSL, noiseGLSL } from './shaders.js';
import { SWELLS, PROFILE_N, sampleProfile, swellHeight } from './waveProfile.js';

const swellGLSL = (() => {
  let s = 'uniform float uCalm;\nvec3 swell(vec2 p, float t) {\n  float h = 0.0; vec2 g = vec2(0.0);\n';
  for (const [a, L, dx, dz] of SWELLS) {
    const len = Math.hypot(dx, dz), k = (2 * Math.PI) / L, w = Math.sqrt(9.81 * k);
    const ux = (dx / len).toFixed(4), uz = (dz / len).toFixed(4);
    s += `  { float ph = ${k.toFixed(5)} * dot(p, vec2(${ux}, ${uz})) - ${w.toFixed(5)} * t;
    h += ${a.toFixed(3)} * uCalm * sin(ph); g += ${(a * k).toFixed(5)} * uCalm * cos(ph) * vec2(${ux}, ${uz}); }\n`;
  }
  s += '  return vec3(h, g);\n}\n';
  return s;
})();

/** Tileable detail normal map built from integer-frequency sine waves. */
function makeDetailNormals(size = 256, seed = 7) {
  let a = seed;
  const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  const waves = [];
  for (let i = 0; i < 28; i++) {
    const fx = Math.round((rnd() * 2 - 1) * (2 + i * 0.7)), fy = Math.round((rnd() * 2 - 1) * (2 + i * 0.7));
    if (!fx && !fy) continue;
    waves.push([fx, fy, rnd() * 6.28, 1 / (1 + Math.hypot(fx, fy) * 0.6)]);
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let dx = 0, dy = 0;
    for (const [fx, fy, ph, amp] of waves) {
      const c = Math.cos(((fx * x + fy * y) / size) * 6.2832 + ph) * amp;
      dx += c * fx; dy += c * fy;
    }
    const n = new THREE.Vector3(-dx * 0.05, -dy * 0.05, 1).normalize();
    const i = (y * size + x) * 4;
    data[i] = (n.x * 0.5 + 0.5) * 255; data[i + 1] = (n.y * 0.5 + 0.5) * 255; data[i + 2] = (n.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function waterMaterial({ detail, depthTex, depthBox, waveMesh }) {
  const uniforms = {
    uTime: globalUniforms.uTime, uSunDir: globalUniforms.uSunDir, uSkyTop: globalUniforms.uSkyTop, uSkyHorizon: globalUniforms.uSkyHorizon,
    uDeepTint: globalUniforms.uDeepTint, uShallowTint: globalUniforms.uShallowTint, uWaterTint: globalUniforms.uWaterTint,
    uFogColor: globalUniforms.uFogColor, uFogDensity: globalUniforms.uFogDensity, uUnderwater: globalUniforms.uUnderwater, uStyle: globalUniforms.uStyle,
    uDetail: { value: detail }, uDepth: { value: depthTex }, uDepthBox: { value: depthBox },
    uCalm: { value: 1 }, uHole: { value: new THREE.Vector4(0, 0, 0, 0) }, uHoleOn: { value: 0 }, uWaveH: { value: 2.4 },
  };
  const vertexShader = /* glsl */`
    ${swellGLSL}
    uniform float uTime;
    varying vec3 vWPos; varying vec3 vN; varying float vFoam; varying float vH;
    ${waveMesh ? 'attribute float aFoam; attribute float aHeight;' : ''}
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      ${waveMesh ? `
        vN = normalize(mat3(modelMatrix) * normal);
        vFoam = aFoam; vH = aHeight;
      ` : `
        vec3 sw = swell(wp.xz, uTime);
        wp.y += sw.x;
        vN = normalize(vec3(-sw.y, 1.0, -sw.z));
        vFoam = 0.0; vH = sw.x * 0.5;
      `}
      vWPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const fragmentShader = /* glsl */`
    ${skyGLSL}
    ${uwFogGLSL}
    ${noiseGLSL}
    uniform float uTime; uniform sampler2D uDetail; uniform sampler2D uDepth; uniform vec4 uDepthBox;
    uniform vec3 uDeepTint; uniform vec3 uShallowTint; uniform vec3 uWaterTint; uniform vec3 uFogColor; uniform float uFogDensity;
    uniform float uUnderwater; uniform vec4 uHole; uniform float uHoleOn; uniform float uWaveH;
    varying vec3 vWPos; varying vec3 vN; varying float vFoam; varying float vH;
    void main() {
      ${waveMesh ? '' : `
        // Cut a hole where the set-wave mesh takes over (with a 1 m overlap hidden by identical shading).
        if (uHoleOn > 0.5 && vWPos.x > uHole.x && vWPos.x < uHole.y && vWPos.z > uHole.z && vWPos.z < uHole.w) discard;
      `}
      vec3 V = normalize(cameraPosition - vWPos);
      vec2 uv = vWPos.xz;
      vec3 d1 = texture2D(uDetail, uv * 0.045 + vec2(uTime * 0.012, uTime * 0.02)).xyz * 2.0 - 1.0;
      vec3 d2 = texture2D(uDetail, uv * 0.11 + vec2(-uTime * 0.02, uTime * 0.011)).xyz * 2.0 - 1.0;
      vec3 d3 = texture2D(uDetail, uv * 0.31 + vec2(uTime * 0.03, -uTime * 0.025)).xyz * 2.0 - 1.0;
      vec3 dn = d1 * 0.55 + d2 * 0.35 + d3 * 0.2;
      float distFade = 1.0 / (1.0 + length(cameraPosition - vWPos) * 0.012);
      // Fine ripples: the cosy look keeps more of them, further out (SumbaSurf-like chop).
      float rip = uStyle > 0.5 ? 0.55 * (1.0 / (1.0 + length(cameraPosition - vWPos) * 0.006)) : 0.35 * distFade;
      vec3 N = normalize(vN + vec3(dn.x, 0.0, dn.y) * rip);
      bool below = uUnderwater > 0.5;
      if (!below && dot(N, V) < 0.0) N = -N;
      vec3 col; float alpha = 1.0;
      // Seabed depth under this point (for shallow-reef turquoise).
      vec2 duv = (vWPos.xz - uDepthBox.xy) / uDepthBox.zw;
      float seabed = (duv.x > 0.0 && duv.x < 1.0 && duv.y > 0.0 && duv.y < 1.0) ? texture2D(uDepth, duv).r * 60.0 - 50.0 : -60.0;
      float wdepth = max(0.0, vWPos.y - seabed);
      // Foam texture
      float fn = fbm(uv * 1.3 + vec2(uTime * 0.2, -uTime * 0.35)) * 0.6 + fbm(uv * 4.0 - uTime * 0.4) * 0.4;
      float foam = smoothstep(0.35, 0.75, vFoam * (0.55 + fn));
      foam = max(foam, smoothstep(0.92, 1.0, vFoam));
      if (uStyle > 0.5) foam = smoothstep(0.42, 0.48, foam);           // stylised: crisp white foam shapes
      if (uStyle > 0.5 && !below) {
        // Shore foam: soft white bands lapping where the water meets sand or rock.
        float lap = sin(uTime * 1.1 + vWPos.x * 0.15 + fbm(vWPos.xz * 0.2) * 3.0);
        float shore = smoothstep(0.9, 0.15, wdepth + 0.25 * lap);
        float band = shore * (0.55 + 0.45 * smoothstep(0.45, 0.6, fbm(vWPos.xz * 0.8 + uTime * 0.1)));
        foam = max(foam, band);
      }
      if (!below) {
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 refl = skyColor(R);
        vec3 body = mix(uShallowTint, uWaterTint, smoothstep(1.0, 9.0, wdepth));
        body = mix(body, uDeepTint, smoothstep(8.0, 40.0, wdepth));
        if (uStyle > 0.5) body = mix(mix(uShallowTint * 1.05, uWaterTint, smoothstep(0.5, 10.0, wdepth)), uDeepTint, smoothstep(6.0, 30.0, wdepth));
        vec3 flatBody = body; // the wave mesh fades into exactly this at its base, so there is no seam
        float sss = pow(max(dot(V, -normalize(uSunDir * vec3(1.0, 0.0, 1.0))) * 0.5 + 0.5, 0.0), 3.0);
        float thick = clamp(vH, 0.0, 1.2);
        ${waveMesh ? `
          // Wave face: darker at the base, glowing translucent green toward the thin lip, streaked by water drawn up the face.
          body = mix(uWaterTint * 0.5 + uDeepTint * 0.4, uShallowTint * 0.75, smoothstep(0.15, 1.0, thick));
          body += vec3(0.06, 0.5, 0.38) * sss * smoothstep(0.45, 1.1, thick) * 0.7;
          float streak = fbm(vec2(vWPos.x * 0.45 + vWPos.z * 0.1, thick * 5.0 - uTime * 0.6));
          body *= 0.78 + 0.42 * streak;
          if (uStyle > 0.5) {
            float h = smoothstep(0.04, 1.0, thick);
            body = mix(uDeepTint * 0.85 + uWaterTint * 0.35, uShallowTint * 1.25 + vec3(0.04, 0.1, 0.08), h);
            body += vec3(0.08, 0.42, 0.32) * sss * smoothstep(0.5, 1.1, thick) * 0.9; // light glowing through the thin lip
            // Foam drawn up the face as crisp swirling streaks, and a bright band along the lip.
            float sw = fbm(vec2(vWPos.x * 0.32 + sin(vWPos.z * 0.5 + uTime * 0.4) * 0.7, thick * 3.0 - uTime * 0.5));
            foam = max(foam, smoothstep(0.54, 0.57, sw) * smoothstep(0.2, 0.6, thick) * 0.85);
            foam = max(foam, smoothstep(1.02, 1.12, thick)); // white only right at the pitching lip
          }
          body = mix(flatBody, body, smoothstep(0.02, 0.3, thick));
        ` : `
          body += vec3(0.04, 0.35, 0.3) * sss * thick * 0.6;
        `}
        float diff = max(dot(N, uSunDir), 0.0) * 0.35 + 0.65;
        col = mix(body * diff, refl * 0.85, fres * ${waveMesh ? '(uStyle > 0.5 ? 0.4 : 0.75)' : '1.0'});
        vec3 H = normalize(V + uSunDir);
        col += vec3(1.0, 0.95, 0.85) * (uStyle > 0.5 ? pow(max(dot(N, H), 0.0), 900.0) * 9.0 : pow(max(dot(N, H), 0.0), 600.0) * 6.0); // sun glints
        if (uStyle > 0.5) {
          // Scattered foam flecks drifting on the surface (fade with distance so the horizon stays clean).
          float fl = smoothstep(0.6, 0.66, fbm(uv * 0.7 + vec2(uTime * 0.05, uTime * 0.03))) * smoothstep(0.8, 0.86, vnoise(uv * 22.0 + uTime * 0.3));
          foam = max(foam, fl * 0.75 / (1.0 + length(cameraPosition - vWPos) * 0.03));
        }
        col = mix(col, vec3(0.95, 0.98, 1.0) * (0.75 + 0.25 * max(dot(vN, uSunDir), 0.0)), foam);
        // Aerial haze
        float hz = 1.0 - exp(-length(cameraPosition - vWPos) * (uStyle > 0.5 ? 0.0032 : 0.0016)); // cosy: softer, hazier horizon
        col = mix(col, skyColor(normalize(vec3(-V.x, 0.02, -V.z))), hz);
        // Clear tropical water: see the reef when looking down into the shallows.
        alpha = clamp((uStyle > 0.5 ? 0.6 : 0.42) + fres * 1.3 + smoothstep(3.0, 26.0, wdepth) * 0.6 + foam + hz, 0.0, 1.0);
        ${waveMesh ? 'alpha = mix(alpha, 1.0, smoothstep(uStyle > 0.5 ? 0.3 : 0.12, uStyle > 0.5 ? 0.85 : 0.45, thick));' : ''}
      } else {
        // Looking up from below: Snell's window shows the sky, outside it total internal reflection.
        vec3 Nb = -N;
        float cosI = dot(-V, -Nb);
        float window = smoothstep(0.62, 0.72, cosI);
        vec3 sky = skyColor(normalize(refract(-V, Nb, 1.33) + vec3(0.0, 0.001, 0.0))) * 1.2;
        vec3 tir = uFogColor * 0.8;
        col = mix(tir, sky, window);
        col = mix(col, vec3(0.75, 0.85, 0.85), foam * 0.6);
        float f = 1.0 - exp(-uFogDensity * length(cameraPosition - vWPos));
        col = mix(col, uwFogColor(-V, uFogColor, uSunDir), f * 0.85);
      }
      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  // Stylised look: water doesn't write depth, so the ink-outline pass outlines things under the surface but not waves.
  return new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.DoubleSide, transparent: true });
}

export class Ocean {
  constructor(scene, { quality, depthTex, depthBox }) {
    this.detail = makeDetailNormals();
    this.group = new THREE.Group();
    scene.add(this.group);
    const segs = quality.oceanSegments;
    const nearGeo = new THREE.PlaneGeometry(260, 260, segs, segs); nearGeo.rotateX(-Math.PI / 2);
    this.nearMat = waterMaterial({ detail: this.detail, depthTex, depthBox });
    this.near = new THREE.Mesh(nearGeo, this.nearMat);
    this.near.frustumCulled = false;
    const farGeo = new THREE.RingGeometry(120, 6000, 48, 8); farGeo.rotateX(-Math.PI / 2);
    this.far = new THREE.Mesh(farGeo, waterMaterial({ detail: this.detail, depthTex, depthBox }));
    this.far.position.y = -0.05; this.far.frustumCulled = false;
    this.far.material.uniforms.uCalm.value = 0.35;
    this.group.add(this.near, this.far);
    this.calm = 1;
    this.depthTex = depthTex; this.depthBox = depthBox;
  }
  setHole(box) { // box = [xMin, xMax, zMin, zMax] or null
    const h = this.nearMat.uniforms.uHole.value;
    this.nearMat.uniforms.uHoleOn.value = box ? 1 : 0;
    if (box) h.set(box[0], box[1], box[2], box[3]);
  }
  setCalm(c) { this.calm = c; this.nearMat.uniforms.uCalm.value = c; this.far.material.uniforms.uCalm.value = c * 0.35; }
  update(camera, underwater = false) {
    this.far.visible = !underwater && this.nearMat !== null;
    // Snap the near grid to its own spacing so swell doesn't swim under the camera.
    const step = 260 / this.near.geometry.parameters.widthSegments;
    this.near.position.set(Math.round(camera.position.x / step) * step, 0, Math.round(camera.position.z / step) * step);
    this.far.position.x = camera.position.x; this.far.position.z = camera.position.z;
  }
  heightAt(x, z, t) { return swellHeight(x, z, t, this.calm); }
}

/** CPU-built mesh for the breaking set wave. */
export class WaveMesh {
  constructor(scene, ocean, quality) {
    this.cols = quality.waveColumns;
    this.N = PROFILE_N;
    const nv = this.cols * this.N;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(nv * 3);
    this.foam = new Float32Array(nv);
    this.height = new Float32Array(nv);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aFoam', new THREE.BufferAttribute(this.foam, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aHeight', new THREE.BufferAttribute(this.height, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let c = 0; c < this.cols - 1; c++) for (let i = 0; i < this.N - 1; i++) {
      const a = c * this.N + i, b = a + 1, d = a + this.N, e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
    geo.setIndex(idx);
    this.geo = geo;
    this.mat = waterMaterial({ detail: ocean.detail, depthTex: ocean.depthTex, depthBox: ocean.depthBox, waveMesh: true });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.s = new Float32Array(this.N); this.y = new Float32Array(this.N); this.f = new Float32Array(this.N);
    this.col = {};
    this.ocean = ocean;
  }
  update(wave, t) {
    if (!wave) { this.mesh.visible = false; this.ocean.setHole(null); return; }
    this.mesh.visible = true;
    const W = wave.halfWidth, cols = this.cols;
    const x0 = -W + wave.peakX * 0.3, x1 = W + wave.peakX * 0.3;
    for (let c = 0; c < cols; c++) {
      const x = x0 + (x1 - x0) * (c / (cols - 1));
      const col = wave.column(x, this.col);
      const jitter = col.collapse * Math.sin(x * 0.9 + t * 3.1) * 0.08 * col.H;
      sampleProfile(col.H, col.steep, col.curl, col.collapse, this.s, this.y, this.f, jitter);
      // Flat ends always reach past the ocean's hole (sized for the full wave), even where this column is small.
      this.s[0] = Math.min(this.s[0], -wave.H * 5.4); this.s[this.N - 1] = Math.max(this.s[this.N - 1], wave.H * 7.2);
      for (let i = 0; i < this.N; i++) {
        const k = c * this.N + i;
        const z = wave.z + this.s[i];
        const ce = Math.min(c, cols - 1 - c) / Math.max(1, cols * 0.06); // fade the wave out over its outer 6% so the sides have no cliff
        const edge = (Math.min(i, this.N - 1 - i) < 1 ? 0 : 1) * (ce >= 1 ? 1 : ce * ce * (3 - 2 * ce));
        const sw = swellHeight(x, z, t, this.ocean.calm);
        this.pos[k * 3] = x;
        this.pos[k * 3 + 1] = (this.y[i] * edge) + sw;
        this.pos[k * 3 + 2] = z;
        this.foam[k] = this.f[i];
        this.height[k] = col.H > 0.01 ? (this.y[i] / Math.max(col.H, 0.3)) * (0.5 + col.curl * 0.6) : 0;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aFoam.needsUpdate = true;
    this.geo.attributes.aHeight.needsUpdate = true;
    this.geo.computeVertexNormals();
    const Hs = wave.H * 5.2;
    // Hole slightly inside the mesh footprint so the two surfaces overlap.
    this.ocean.setHole([x0 + 2, x1 - 2, wave.z - Hs + 2, wave.z + wave.H * 7 - 2]);
  }
}

export class Sky {
  constructor(scene) {
    const geo = new THREE.SphereGeometry(5000, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uSunDir: globalUniforms.uSunDir, uSkyTop: globalUniforms.uSkyTop, uSkyHorizon: globalUniforms.uSkyHorizon, uUnderwater: globalUniforms.uUnderwater, uFogColor: globalUniforms.uFogColor, uStyle: globalUniforms.uStyle },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `${skyGLSL}${uwFogGLSL}\nuniform float uUnderwater; uniform vec3 uFogColor; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); vec3 c = uUnderwater > 0.5 ? uwFogColor(d, uFogColor, uSunDir) : skyColor(d); gl_FragColor = vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
  }
  update(camera) { this.mesh.position.copy(camera.position); }
}
