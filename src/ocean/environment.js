// Lighting, fog, sky colours and underwater light shafts; switches look as the camera crosses the surface.
import * as THREE from 'three';
import { globalUniforms, noiseGLSL } from './shaders.js';
import { paletteAt, lightingFor } from './daylight.js';

/** Night and dusk values for the stylised lighting (ambient from above / below, the key light, the rim light): moonlit blue, bright enough to read. */
const NIGHT_STYLE = { sky: [0.23, 0.33, 0.6], ground: [0.12, 0.16, 0.32], sun: [0.27, 0.37, 0.72], rim: [0.24, 0.38, 0.7] };

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
    this.night = 0; this.glow = 0; this.daylightOn = false; this.tmp = new THREE.Color();
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
    globalUniforms.uClear.value = w.clear ?? 0; globalUniforms.uHaze.value = w.haze ?? 0.06;
    this.hemi.color.set(w.hemiSky ?? 0xbfe6ff); this.hemi.groundColor.set(w.hemiGround ?? 0x3a6a70);
    this.envBelow = w.envBelow ?? 0.3;
    this.shaftsOn = w.shafts ?? 1;
    // Cosy look: sun rays at every sunlit site (softer where the water is green and murky), a bit stronger overall.
    if (globalUniforms.uStyle.value > 0.5 && (w.sunIntensity ?? 2.6) > 0) this.shaftsOn = Math.max(this.shaftsOn, 0.5) * 1.8;
    this.sun.color.set(w.sunColor ?? 0xfff2dd);
    this.sunBase = this.sun.intensity = w.sunIntensity ?? 2.6;
    this.hemiBase = this.hemi.intensity = w.ambient ?? 1.1;
    this.fogDepthScale = w.fogDepthScale ?? 25;
    this.exposureAbove = w.exposure ?? 0.82;
    // Remember the site's own (day) water block so setDaylight can blend it toward dusk and night (ocean/daylight.js).
    this.waterDef = w; this.lightCfg = lightingFor(eco);
    this.daylightOn = !!this.lightCfg; this.night = 0; this.glow = 0;
    globalUniforms.uNight.value = 0; globalUniforms.uLampOn.value = 0;
    this.buildEnvMap();
  }

  /**
   * Set the time of day (hour 0-24) for a site with eco.daylight: blends the site's day palette toward the dusk glow and the dark-blue night, dims and tints the sun
   * (the moon at night), and switches the wharf lamps on and off. Call every frame before update(). Returns the daylightAt() state.
   */
  setDaylight(hour) {
    const cfg = this.lightCfg ?? lightingFor({ daylight: true }), P = paletteAt(this.waterDef, hour, cfg), d = P.d, G = globalUniforms, k = d.night;
    const put = (c, rgb) => c.setRGB(rgb[0], rgb[1], rgb[2]);
    put(G.uSkyTop.value, P.skyTop); put(G.uSkyHorizon.value, P.skyHorizon);
    put(G.uShallowTint.value, P.shallow); put(G.uWaterTint.value, P.mid); put(G.uDeepTint.value, P.deep);
    put(this.fogBelow, P.fog); put(this.fogDeep, P.fogDeep);
    this.fogAbove.copy(G.uSkyHorizon.value);
    put(this.sun.color, P.sunColor); this.sunBase = P.sunIntensity;
    put(this.hemi.color, P.hemiSky); put(this.hemi.groundColor, P.hemiGround);
    this.hemiBase = P.hemiIntensity; this.exposureAbove = P.exposure;
    G.uSunDir.value.set(...P.sunDir);
    G.uNight.value = k; G.uLampOn.value = cfg.lamps ? d.lamps : 0; this.night = k; this.glow = Math.min(1, d.glow * cfg.glow); G.uGlow.value = this.glow * (1 - k * 0.8);
    return d;
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
  update(dt, camera, depth, focus = null) {
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
        // Warm golden key light, cool teal-blue shadows, a bright sky fill: lit surfaces land near their own colour (cream stays cream),
        // shadowed ones fall to a cool tint of it. (Kept under 1.0 in total so the tone mapper doesn't wash the colours out.)
        G.uStyleSky.value.copy(G.uSkyTop.value).lerp(new THREE.Color(0.6, 0.85, 0.95), 0.5).multiplyScalar(0.5);
        G.uStyleGround.value.set(0.46, 0.4, 0.3);
        G.uStyleSun.value.set(0.86, 0.74, 0.52).multiplyScalar(Math.min(1, this.sunBase / 2.4));
        G.uStyleRim.value.set(0.35, 0.42, 0.5);
        if (this.daylightOn) {
          // Dusk: a warmer, lower key light; night: moonlit blue everywhere (kept bright enough to read, never black).
          // The blue only takes over once it is properly dark (kk), so early dusk keeps its warm amber light on the ground and the walls.
          const k = this.night, kk = Math.min(1, Math.max(0, (k - 0.3) / 0.7)), warm = this.glow * (1 - kk), ns = NIGHT_STYLE;
          G.uStyleSun.value.lerp(this.tmp.setRGB(1.05, 0.56, 0.24), Math.min(1, warm * 1.0)).multiplyScalar(1 - 0.35 * kk);
          G.uStyleSky.value.lerp(this.tmp.setRGB(0.8, 0.5, 0.5), warm * 0.62);            // a rosy-peach ambient from the sky at sunset
          G.uStyleGround.value.lerp(this.tmp.setRGB(0.52, 0.34, 0.3), warm * 0.6);        // and warm light bounced back up off the ground
          G.uStyleSky.value.lerp(this.tmp.setRGB(...ns.sky), kk); G.uStyleGround.value.lerp(this.tmp.setRGB(...ns.ground), kk);
          G.uStyleSun.value.lerp(this.tmp.setRGB(...ns.sun), kk); G.uStyleRim.value.lerp(this.tmp.setRGB(...ns.rim), kk);
        }
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
      this.sun.shadow.intensity = 0.6 + 0.28 * this.glow * (1 - this.night);   // low warm sun: longer, firmer shadows
      const step = (this.shadowRange * 2) / this.sun.shadow.mapSize.x;
      const fp = focus ?? camera.position;
      const t = this.sun.target.position.set(Math.round(fp.x / step) * step, Math.round(fp.y / step) * step, Math.round(fp.z / step) * step);
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
