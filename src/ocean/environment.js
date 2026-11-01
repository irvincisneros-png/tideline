// Lighting, fog, sky colours and underwater light shafts; switches look as the camera crosses the surface.
import * as THREE from 'three';
import { globalUniforms, noiseGLSL } from './shaders.js';
import { makeNoise } from '../core/noise.js';

export class Environment {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
    this.sun.position.copy(globalUniforms.uSunDir.value).multiplyScalar(100);
    this.hemi = new THREE.HemisphereLight(0xbfe6ff, 0x3a6a70, 1.1);
    scene.add(this.sun, this.hemi, this.sun.target);
    if (quality.shadows) {
      // A shadow box that follows the camera: sharp contact shadows near the player, none far away (fog hides it).
      const sh = this.sun.shadow;
      sh.mapSize.set(quality.shadows, quality.shadows);
      Object.assign(sh.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 160 });
      sh.camera.updateProjectionMatrix();
      sh.bias = -0.0004; sh.normalBias = 0.04; sh.radius = 2.5;
      sh.intensity = 0.6; // water scatters plenty of light into shadows
      this.shadowRange = 24;
    }
    this.fog = new THREE.FogExp2(0xbfe6f5, 0.0012);
    scene.fog = this.fog;
    this.fogAbove = new THREE.Color(); this.fogBelow = new THREE.Color(); this.fogDeep = new THREE.Color();
    this.shafts = quality.shafts ? this.makeShafts() : null;
    if (this.shafts) scene.add(this.shafts);
    this.island = null;
    this.renderer = renderer;
    this.envRT = null;
  }

  apply(eco) {
    const w = eco.water;
    globalUniforms.uAbsorb.value.set(...w.absorb);
    globalUniforms.uShallowTint.value.set(w.shallow);
    globalUniforms.uWaterTint.value.set(w.mid);
    globalUniforms.uDeepTint.value.set(w.deep);
    globalUniforms.uSkyTop.value.set(w.skyTop);
    globalUniforms.uSkyHorizon.value.set(w.skyHorizon);
    globalUniforms.uSunDir.value.set(...w.sun).normalize();
    this.sun.position.copy(globalUniforms.uSunDir.value).multiplyScalar(100);
    this.fogAbove.set(w.skyHorizon); this.fogBelow.set(w.fog); this.fogDeep.set(w.fogDeep);
    this.fogDensityBelow = w.fogDensity;
    globalUniforms.uCaustics.value = w.caustics ?? 1;
    this.hemi.color.set(w.hemiSky ?? 0xbfe6ff); this.hemi.groundColor.set(w.hemiGround ?? 0x3a6a70);
    this.envBelow = w.envBelow ?? 0.3;
    this.shaftsOn = w.shafts ?? 1;
    // Cosy look: sun rays at every sunlit site (softer where the water is green and murky), a bit stronger overall.
    if (globalUniforms.uStyle.value > 0.5 && (w.sunIntensity ?? 2.6) > 0) this.shaftsOn = Math.max(this.shaftsOn, 0.5) * 1.8;
    this.sun.color.set(w.sunColor ?? 0xfff2dd);
    this.sunBase = this.sun.intensity = w.sunIntensity ?? 2.6;
    this.hemiBase = this.hemi.intensity = w.ambient ?? 1.1;
    this.fogDepthScale = w.fogDepthScale ?? 25;
    this.buildEnvMap();
    if (this.island) { this.scene.remove(this.island); this.island.geometry.dispose(); this.island = null; }
    if (eco.island) this.island = this.makeIsland(eco.island, eco.islandKind);
  }

  buildEnvMap() {
    // Simple gradient environment for reflections on wetsuits, boards and fish.
    const pm = new THREE.PMREMGenerator(this.renderer);
    const sc = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 32, 16);
    const top = globalUniforms.uSkyTop.value, hor = globalUniforms.uSkyHorizon.value, deep = globalUniforms.uDeepTint.value;
    const col = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < geo.attributes.position.count; i++) {
      const y = geo.attributes.position.getY(i) / 10;
      const c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.5)) : hor.clone().lerp(deep, Math.min(1, -y * 3));
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    this.envRT?.dispose();
    this.envRT = pm.fromScene(sc, 0.02);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.6;
    pm.dispose(); geo.dispose();
  }

  makeIsland({ x, z, r, h }, kind = 'cay') {
    const noise = makeNoise(3);
    const geo = new THREE.CircleGeometry(r, 96, 0, Math.PI * 2);
    // Turn into a low mound with a sand fringe and vegetated centre (a coral cay or headland).
    const g2 = new THREE.PlaneGeometry(r * 2.4, r * 2.4, 120, 120); g2.rotateX(-Math.PI / 2);
    const p = g2.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), pz = p.getZ(i);
      const d = Math.hypot(px, pz * 1.6) / r;
      const n = noise.fbm2(px * 0.02, pz * 0.02, 4);
      let y = (1 - d + n * 0.35);
      y = y > 0 ? Math.pow(y, kind === 'headland' ? 0.7 : 1.6) * h * (kind === 'headland' ? 3 : 1) : y * 8;
      p.setY(i, y);
      const sand = y < 1.4;
      const c = sand ? [0.93, 0.88, 0.74] : kind === 'headland' ? [0.28 + n * 0.1, 0.36, 0.2] : [0.2 + n * 0.08, 0.42 + n * 0.1, 0.18];
      col.set(c, i * 3);
    }
    geo.dispose();
    g2.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g2.computeVertexNormals();
    const m = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    m.position.set(x, -0.5, z);
    this.scene.add(m);
    return m;
  }

  makeShafts() {
    const g = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: globalUniforms.uTime, uOpacity: { value: 0 }, uCam: { value: new THREE.Vector3() } },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `${noiseGLSL} uniform float uTime; uniform float uOpacity; uniform vec3 uCam; varying vec2 vUv; varying vec3 vW;
        void main(){
          float n = fbm(vec2(vUv.x * 6.0 + vW.x * 0.05, uTime * 0.15 + vW.z * 0.05));
          float a = smoothstep(0.35, 0.8, n) * (1.0 - smoothstep(0.0, 1.0, abs(vUv.x - 0.5) * 2.0));
          a *= smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
          float dist = length(vW - uCam);
          a *= smoothstep(1.5, 5.0, dist) * (1.0 - smoothstep(18.0, 30.0, dist));
          gl_FragColor = vec4(vec3(0.85, 0.97, 1.0), a * uOpacity * 0.075);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.shaftMat = mat;
    for (let i = 0; i < 16; i++) {
      const w = 1.5 + Math.random() * 3, hgt = 30;
      const geo = new THREE.PlaneGeometry(w, hgt);
      geo.translate(0, -hgt / 2, 0);
      const m = new THREE.Mesh(geo, mat);
      m.userData.off = new THREE.Vector3((Math.random() - 0.5) * 36, 0, (Math.random() - 0.5) * 36);
      m.frustumCulled = false;
      g.add(m);
    }
    return g;
  }

  /** camera depth below the local surface (positive underwater) */
  update(dt, camera, depth) {
    const u = depth > 0 ? 1 : 0;
    globalUniforms.uUnderwater.value = u;
    if (globalUniforms.uStyle.value > 0.5) {
      const G = globalUniforms;
      if (u) {
        G.uStyleSky.value.copy(this.fogBelow).multiplyScalar(2.6).lerp(new THREE.Color(1, 1, 1), 0.45); // bright, clear shallows
        G.uStyleGround.value.copy(this.fogBelow).lerp(G.uShallowTint.value, 0.5).multiplyScalar(this.sunBase > 0 ? 1.1 : 0.9);
        G.uStyleSun.value.set(0.62, 0.6, 0.5).multiplyScalar(Math.min(1, this.sunBase / 2.4));
        G.uStyleRim.value.copy(this.fogBelow).multiplyScalar(1.6);
      } else {
        G.uStyleSky.value.copy(G.uSkyTop.value).lerp(new THREE.Color(1, 1, 1), 0.45).multiplyScalar(0.62);
        G.uStyleGround.value.set(0.42, 0.36, 0.28);
        G.uStyleSun.value.set(0.82, 0.74, 0.6).multiplyScalar(Math.min(1, this.sunBase / 2.4));
        G.uStyleRim.value.set(0.35, 0.42, 0.5);
      }
    }
    if (u) {
      const k = Math.min(1, depth / (this.fogDepthScale ?? 25));
      globalUniforms.uFogColor.value.copy(this.fogBelow).lerp(this.fogDeep, k);
      // Cosy art style: bright, clear turquoise water (the deep-sea site keeps its darkness).
      const cosyBright = globalUniforms.uStyle.value > 0.5 && this.sunBase > 0;
      if (cosyBright) globalUniforms.uFogColor.value.lerp(globalUniforms.uShallowTint.value, 0.4 * (1 - k * 0.6));
      this.fog.color.copy(globalUniforms.uFogColor.value);
      this.fog.density = this.fogDensityBelow * (1 + k * 0.4) * (cosyBright ? 0.7 : 1);
      globalUniforms.uFogDensity.value = this.fog.density;
      this.scene.background = this.fog.color;
      this.renderer.toneMappingExposure = globalUniforms.uStyle.value > 0.5 ? 1.05 : 0.85;
      this.sun.intensity = this.sunBase * 0.75; this.hemi.intensity = this.hemiBase * 0.6; this.scene.environmentIntensity = this.envBelow;
    } else {
      this.renderer.toneMappingExposure = this.exposureAbove ?? 0.82; // keeps bright sand and white surf from clipping to grey-white
      this.sun.intensity = this.sunBase; this.hemi.intensity = this.hemiBase; this.scene.environmentIntensity = 0.6;
      this.fog.color.copy(this.fogAbove);
      this.fog.density = 0.0011;
      globalUniforms.uFogColor.value.copy(this.fogBelow);
      globalUniforms.uFogDensity.value = this.fogDensityBelow;
      this.scene.background = null;
    }
    if (this.shadowRange) {
      // Snap to shadow texels so edges don't crawl as the camera moves.
      this.sun.castShadow = this.sunBase > 0;
      const step = (this.shadowRange * 2) / this.sun.shadow.mapSize.x;
      const t = this.sun.target.position.set(Math.round(camera.position.x / step) * step, Math.round(camera.position.y / step) * step, Math.round(camera.position.z / step) * step);
      this.sun.position.copy(globalUniforms.uSunDir.value).multiplyScalar(80).add(t);
    }
    if (this.shafts) {
      this.shafts.visible = !!u && this.shaftsOn > 0;
      this.shaftMat.uniforms.uOpacity.value = u ? Math.max(0, 1 - depth / 30) * this.shaftsOn : 0;
      this.shaftMat.uniforms.uCam.value.copy(camera.position);
      const sd = globalUniforms.uSunDir.value;
      const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(sd.x * 0.35, 1, sd.z * 0.35).normalize());
      for (const m of this.shafts.children) {
        const o = m.userData.off;
        let x = o.x, z = o.z;
        // keep shafts in a box around the camera
        x = camera.position.x + ((((x - camera.position.x) % 36) + 54) % 36) - 18;
        z = camera.position.z + ((((z - camera.position.z) % 36) + 54) % 36) - 18;
        m.position.set(x, -0.2, z);
        m.quaternion.copy(tilt);
        m.rotateY(Math.atan2(camera.position.x - x, camera.position.z - z));
      }
    }
  }
}
