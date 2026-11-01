// Portrait busts for the dialogue box: each person's head and shoulders, rendered once from the real Angler rig (the same Blender parts and colours
// they wear in the world) into an offscreen WebGL canvas, then cached as a PNG data URL. A short-lived renderer is made per portrait and released at
// once, so it never competes with the game for WebGL contexts.
import * as THREE from 'three';
import { Angler } from '../land/angler.js';

const SKIP_HULL = /_(face|sun|band|trim|dots|stubble)$/;
const cache = new Map();

/** The portrait for a person (cached by id). models = the tideline_cosy.glb parts; look = angler appearance. Returns a data URL, or null if WebGL fails. */
export function portraitFor(id, models, look, { w = 360, h = 400, lo = false } = {}) {
  if (cache.has(id)) return cache.get(id);
  let url = null, renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa6e4ee, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1d0, 2.3); sun.position.set(1.6, 2.4, 3); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfe9f5, 0.7); fill.position.set(-2.5, 1.2, 1.5); scene.add(fill);
    const angler = new Angler(scene, models, look, { lo });
    angler.root.visible = true; angler.root.rotation.y = 0.28;     // a slight turn toward the speaker's right
    angler.update(1 / 60, 0, { state: 'off' });
    // Ink outline: an inflated back-face copy of every part (the world uses a post effect this little scene does not have).
    const hullMat = new THREE.MeshBasicMaterial({ color: 0x1b4f5b, side: THREE.BackSide });
    hullMat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * 0.0105;'); };
    angler.root.traverse(o => { if (o.isMesh && !SKIP_HULL.test(o.name) && !o.userData.hull) { const hull = new THREE.Mesh(o.geometry, hullMat); hull.userData.hull = true; o.add(hull); } });
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 20);
    cam.position.set(0.03, 1.2, 1.95); cam.lookAt(0, 1.1, 0);
    renderer.render(scene, cam);
    url = renderer.domElement.toDataURL('image/png');
    hullMat.dispose();
  } catch (e) { console.warn('Portrait failed for', id, e); }
  finally { renderer?.dispose(); renderer?.forceContextLoss?.(); }
  cache.set(id, url);
  return url;
}
export const clearPortraits = () => cache.clear();
