// Fish pictures from the real 3D fish models (life/fishModel.js + the registered looks):
//   FishView      a small interactive viewer (drag to turn the fish, wheel / pinch / buttons to zoom): the inspection panel and re-keying.
//   fishPicture   a cached still (side view, silhouette, colour) for guide cells.
//   fishTopDown   a top-down still scaled so the image width is exactly the fish's length: the brag mat.
// The viewer has its own small WebGL context (made on open, released on close); stills share one off-screen renderer.
import * as THREE from 'three';
import { buildFish } from '../life/fishModel.js';
import { LOOKS } from '../life/looks.js';
import { SPECIES_BY_ID } from '../fishing/species.js';

const models = new Map();
/** The geometry and skin of a species (built once). bbox is in model metres: x runs tail -> snout. */
export function fishModel(id, opts = {}) {
  const key = opts.flatTail ? `${id}|flatTail` : id;
  let m = models.get(key);
  if (m) return m;
  const look = LOOKS[id];
  if (!look) throw new Error(`No look registered for ${id}`);
  const built = buildFish(look, opts);
  built.geometry.computeBoundingBox();
  m = { geometry: built.geometry, texture: built.texture, bbox: built.geometry.boundingBox.clone() };
  models.set(key, m);
  return m;
}
const skin = (m, silhouette) => (silhouette
  ? new THREE.MeshBasicMaterial({ color: 0x1b5560, side: THREE.DoubleSide })
  : new THREE.MeshStandardMaterial({ map: m.texture, roughness: 0.5, metalness: 0, side: THREE.DoubleSide }));
function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe9f5, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1d0, 2.1); sun.position.set(1.5, 3, 2); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfe9f5, 0.8); fill.position.set(-2, 1, -2); scene.add(fill);
}

// ------------------------------------------------------------------ interactive viewer
export class FishView {
  /** host: an element to fill with the canvas. opts.drag / opts.zoom: turn the viewer interactive. */
  constructor(host, id, { spin = true } = {}) {
    this.host = host; this.id = id; this.spin = spin;
    const m = this.m = fishModel(id);
    this.size = m.bbox.getSize(new THREE.Vector3()); this.center = m.bbox.getCenter(new THREE.Vector3());
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement; this.canvas.className = 'fv-canvas'; this.canvas.setAttribute('aria-label', 'Drag to turn the fish; scroll or pinch to zoom');
    host.appendChild(this.canvas);
    this.scene = new THREE.Scene(); lights(this.scene);
    this.mesh = new THREE.Mesh(m.geometry, skin(m, false)); this.mesh.position.copy(this.center).multiplyScalar(-1);
    this.pivot = new THREE.Group(); this.pivot.add(this.mesh); this.scene.add(this.pivot);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
    this.base = (Math.max(this.size.x, this.size.z * 1.4, this.size.y) * 1.55 / Math.tan(THREE.MathUtils.degToRad(16)) * 0.5 + 0.3 * this.size.x) * 0.72;
    this.zoom = 1.3; this.yaw = -0.5; this.pitch = 0.32; this.dirty = true; this.auto = spin; this.t0 = performance.now();
    this.bind();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    const loop = () => { this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }
  bind() {
    const c = this.canvas, pts = new Map();
    let pinch = 0;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); this.auto = false; pinch = 0; });
    c.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      if (pts.size === 2) {
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) this.zoomBy(d / pinch); pinch = d; return;
      }
      this.yaw += (e.clientX - p[0]) * 0.011; this.pitch = THREE.MathUtils.clamp(this.pitch + (e.clientY - p[1]) * 0.009, -1.45, 1.45);
      p[0] = e.clientX; p[1] = e.clientY; this.dirty = true; this.moved = true;
    });
    const up = e => { pts.delete(e.pointerId); pinch = 0; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', e => { e.preventDefault(); this.zoomBy(Math.pow(1.0015, -e.deltaY)); }, { passive: false });
    // Arrow keys turn the fish and +/- zoom when the viewer has focus (keyboard users).
    c.tabIndex = 0;
    c.addEventListener('keydown', e => {
      const k = { ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
      if (k) { e.preventDefault(); this.yaw += k[0]; this.pitch = THREE.MathUtils.clamp(this.pitch + k[1], -1.45, 1.45); this.auto = false; this.dirty = true; }
      else if (e.key === '+' || e.key === '=') this.zoomBy(1.2); else if (e.key === '-') this.zoomBy(1 / 1.2);
    });
  }
  zoomBy(f) { this.zoom = THREE.MathUtils.clamp(this.zoom * f, 0.5, 3.2); this.dirty = true; }
  /** Preset views for the "Top / Side / Front" buttons. */
  setView(name) {
    this.auto = false;
    const v = { side: [-Math.PI / 2, 0.05], top: [-Math.PI / 2, 1.5], front: [0, 0.05], three: [-0.5, 0.32] }[name] ?? [-0.5, 0.32];
    [this.yaw, this.pitch] = v; this.dirty = true;
  }
  resize() {
    const w = Math.max(40, this.host.clientWidth), h = Math.max(40, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.canvas.style.width = '100%'; this.canvas.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.dirty = true;
  }
  frame() {
    if (this.auto) { this.yaw = -0.5 + Math.sin((performance.now() - this.t0) / 2400) * 0.55; this.dirty = true; }
    if (!this.dirty) return;
    this.dirty = false;
    const d = this.base / this.zoom, cp = Math.cos(this.pitch);
    // The camera sits on a sphere round the fish; yaw 0 looks at the fish's flank... head toward the left of the screen.
    this.camera.position.set(Math.sin(this.yaw) * cp * d, Math.sin(this.pitch) * d, -Math.cos(this.yaw) * cp * d);
    this.camera.up.set(0, 1, 0); this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    cancelAnimationFrame(this.raf); this.ro?.disconnect();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.canvas.remove();
    this.mesh.material.dispose();
  }
}

// ------------------------------------------------------------------ stills
let shared = null;
function stillRenderer(w, h) {
  if (!shared) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene(); lights(scene);
    shared = { renderer, scene };
  }
  shared.renderer.setSize(w, h, false);
  return shared;
}
const pictures = new Map();
function snap(id, cam, w, h, silhouette, place) {
  const m = fishModel(id), { renderer, scene } = stillRenderer(w, h);
  const mesh = new THREE.Mesh(m.geometry, skin(m, silhouette)); place?.(mesh);
  scene.add(mesh);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(mesh); mesh.material.dispose();
  return url;
}

/** A still of the fish from the side, head to the left: { silhouette } draws a flat dark shape (for Seen entries). Cached. */
export function fishPicture(id, { silhouette = false, w = 360, h = 200 } = {}) {
  const key = `${id}|side|${silhouette}|${w}x${h}`;
  if (pictures.has(key)) return pictures.get(key);
  const m = fishModel(id), s = m.bbox.getSize(new THREE.Vector3()), c = m.bbox.getCenter(new THREE.Vector3());
  let hw = s.x / 2 * 1.1, hh = hw * h / w;
  if (s.y / 2 * 1.2 > hh) { hh = s.y / 2 * 1.2; hw = hh * w / h; }
  const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 20);
  cam.position.set(c.x, c.y, -5); cam.up.set(0, 1, 0); cam.lookAt(c.x, c.y, 0); // from the far side, so the head points left
  cam.left = -hw; cam.right = hw; cam.updateProjectionMatrix();
  // The camera looks along +z from behind: x runs right-to-left on screen, so the snout (+x) is on the left.
  const url = snap(id, cam, w, h, silhouette);
  pictures.set(key, url); return url;
}

/** The fish as it lies on the brag mat: on its side (the usual way to photograph a catch) with the head to the left, except flat fish
 *  (flathead, wobbegong), which lie on their belly and are seen from above. The image width is the total length, snout tip to tail tip, tail
 *  fully spread: show it `lengthCm` cm wide. Returns { url, aspect (height / width), flip (true when the head is on the right) }. */
export function fishOnMat(id, flat = false, w = 1100) {
  const key = `${id}|mat|${flat}|${w}`;
  if (pictures.has(key)) return pictures.get(key);
  let out;
  if (flat) { const t = fishTopDown(id, w); out = { ...t, flip: true }; }
  else {
    const m = fishModel(id), s = m.bbox.getSize(new THREE.Vector3()), c = m.bbox.getCenter(new THREE.Vector3());
    const aspect = Math.max(0.1, (s.y * 1.1) / s.x), h = Math.round(w * aspect);
    const cam = new THREE.OrthographicCamera(-s.x / 2, s.x / 2, s.y * 0.55, -s.y * 0.55, 0.1, 20);
    cam.position.set(c.x, c.y, -5); cam.up.set(0, 1, 0); cam.lookAt(c.x, c.y, 0);
    out = { url: snap(id, cam, w, h, false), aspect, flip: false };
  }
  pictures.set(key, out); return out;
}

/** A top-down still where the image width is the total length (snout tip to tail tip, tail fully spread). Used by the brag mat: the
 *  caller shows it `lengthCm` cm wide. Returns { url, aspect } (height / width). The snout is on the RIGHT: flip it with CSS to put it on the 0 mark. */
export function fishTopDown(id, w = 1100) {
  const key = `${id}|top|${w}`;
  if (pictures.has(key)) return pictures.get(key);
  // A flat fish's tail lies spread on the mat.
  const m = fishModel(id, { flatTail: SPECIES_BY_ID[id]?.feat?.body === 'flattened' }), s = m.bbox.getSize(new THREE.Vector3()), c = m.bbox.getCenter(new THREE.Vector3());
  // Frame the body, not the wide pectoral wings of a flat fish (they are cropped): only the length matters on the mat.
  const look = LOOKS[id], zExt = Math.min(s.z, (look.width ?? 0.2) * look.length * 1.5);
  const aspect = Math.max(0.1, (zExt * 1.08) / s.x), h = Math.round(w * aspect);
  const cam = new THREE.OrthographicCamera(c.x - s.x / 2, c.x + s.x / 2, c.z + zExt * 0.54, c.z - zExt * 0.54, 0.1, 20);
  cam.position.set(c.x, 5, c.z); cam.up.set(0, 0, -1); cam.lookAt(c.x, 0, c.z);
  const out = { url: snap(id, cam, w, h, false), aspect };
  pictures.set(key, out); return out;
}

// ------------------------------------------------------------------ the catch photo
let photoRig = null;
/** The Fish Guide picture for a landed fish: the real 3D fish model, lying on a cream brag mat with a cm ruler and a soft shadow, seen from a
 *  close three-quarter angle, head to the left (flat fish lie on their bellies, the rest on their side). Rendered off-screen: a JPEG data URL, or
 *  null if the browser cannot make one. */
export function fishPhoto(id, { w = 360, h = 225, flat = null } = {}) {
  try {
    const onBelly = flat ?? SPECIES_BY_ID[id]?.feat?.body === 'flattened';
    const m = fishModel(id, { flatTail: onBelly });
    const size = m.bbox.getSize(new THREE.Vector3()), c = m.bbox.getCenter(new THREE.Vector3());
    const L = size.x;
    if (!photoRig) {
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
      photoRig = { renderer };
    }
    const { renderer } = photoRig;
    renderer.setSize(w, h, false);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcdeee9);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe9f5, 1.7));
    const sun = new THREE.DirectionalLight(0xfff1d0, 2.4); sun.position.set(-L * 0.5, L * 2.2, L * 1.4); sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -L, right: L, top: L, bottom: -L, near: 0.1, far: L * 6 }); sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 5; sun.shadow.bias = -0.0008;
    scene.add(sun);
    // The mat: pale teal with a darker border and a centimetre ruler along the near edge (0 at the left stop).
    const mw = L * 1.5, md = Math.max(size.z, size.y) * 1.9 + L * 0.2;
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * md / mw);
    const g = cv.getContext('2d'); g.fillStyle = '#d9f4ef'; g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = '#1f5f6b'; g.lineWidth = 10; g.strokeRect(5, 5, cv.width - 10, cv.height - 10);
    const pxm = cv.width / mw, left = L * 0.06 * pxm; g.fillStyle = '#1f5f6b'; g.font = '800 26px sans-serif'; g.textAlign = 'center';
    g.fillRect(left - 8, cv.height - 66, 8, 56);
    for (let cm = 0; cm * 0.01 <= mw - L * 0.06; cm++) {
      const x = left + cm * 0.01 * pxm, major = cm % 10 === 0;
      g.fillRect(x, cv.height - 18 - (major ? 30 : cm % 5 === 0 ? 20 : 12), major ? 3 : 2, major ? 30 : cm % 5 === 0 ? 20 : 12);
      if (major && cm > 0) g.fillText(String(cm), x, cv.height - 56);
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const mat = new THREE.Mesh(new THREE.BoxGeometry(mw, 0.012, md), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); mat.receiveShadow = true; scene.add(mat);
    mat.position.set(-L / 2 - L * 0.03 - left / pxm + mw / 2, -0.006, 0);   // the 0 stop sits just in front of the snout
    // The fish: head (the +x end) to the left; on its belly (flat fish) or lying on its side.
    const fish = new THREE.Mesh(m.geometry, skin(m, false)); fish.castShadow = true;
    fish.position.copy(c).multiplyScalar(-1);
    const holder = new THREE.Group(); holder.add(fish); scene.add(holder);
    if (!onBelly) holder.rotation.x = Math.PI / 2;
    const lift = onBelly ? size.y / 2 : size.z / 2;
    const pivot = new THREE.Group(); pivot.add(holder); scene.add(pivot);
    pivot.rotation.y = Math.PI + 0.06; pivot.position.set(0, lift + 0.004, -md * 0.08);
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.01, 20);
    const tan = Math.tan(THREE.MathUtils.degToRad(15)) * (w / h), dist = (L * 1.32 / 2) / tan;
    cam.position.set(L * 0.02, dist * 0.8, dist * 0.62 + md * 0.04); cam.lookAt(L * 0.02, 0, md * 0.02);
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/jpeg', 0.82);
    scene.traverse(o => { o.geometry && o !== fish && o.geometry.dispose?.(); o.material?.dispose?.(); }); tex.dispose();
    return url;
  } catch (e) { console.warn('Catch photo failed', e); return null; }
}
