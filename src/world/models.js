// Hand-shaped model sets (built in Blender by tools/blender/*.py, exported as .glb with vertex colours).
// Used by the stylised look: each site can map its coral/rock generators and fish species to named meshes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const cache = new Map();

/** Load a .glb and return Map(name -> BufferGeometry with position, normal, color), transforms baked in. */
export async function loadModelSet(url) {
  if (cache.has(url)) return cache.get(url);
  const gltf = await new GLTFLoader().loadAsync(url);
  const out = new Map();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    if (g.attributes.color && g.attributes.color.itemSize === 4) {
      // Drop alpha so the colours merge with our 3-component vertex colours.
      const c = g.attributes.color, rgb = new Float32Array(c.count * 3);
      for (let i = 0; i < c.count; i++) { rgb[i * 3] = c.getX(i); rgb[i * 3 + 1] = c.getY(i); rgb[i * 3 + 2] = c.getZ(i); }
      g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    out.set(o.name, g);
  });
  cache.set(url, out);
  return out;
}
