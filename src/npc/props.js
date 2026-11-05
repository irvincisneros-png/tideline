// What people carry and wear besides the angler's hat and clothes: an apron, a clipboard, binoculars, a rescue tube, a litter picker, a bait tub...
// Built from simple rounded shapes in cosy colours and attached to the angler rig's joints (src/land/angler.js), so the same body is a bait-shop
// owner, a lifeguard or a clean-up volunteer. `buildProps(names, body, models)` returns { dispose, sitProps } and adds meshes to the body's joints.
import * as THREE from 'three';

const mats = new Map();
const mat = (c, rough = 0.8) => { const k = `${c}|${rough}`; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 })); return mats.get(k); };
const box = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); return m; };
const cyl = (r0, r1, h, c, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat(c));
function rounded(w, h, d, r, c) {
  // A box with softened corners made from a capsule-ish extrusion: cheap and chunky.
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, mat(c));
}

/** Each builder gets (body, models) and returns { parent: joint name | 'root', obj, sit?: [...] }. Positions are in the joint's local frame (y up the body, +z in front). */
const BUILDERS = {
  apron(b) {
    const g = new THREE.Group();
    g.add(rounded(0.3, 0.4, 0.02, 0.05, 0xfff3d2)); g.children[0].position.set(0, 0, 0);
    g.add(box(0.2, 0.1, 0.022, 0xff8a5c, 0, -0.08, 0.012));     // pocket
    g.add(box(0.34, 0.03, 0.04, 0xfff3d2, 0, 0.19, -0.02));      // neck strap across the chest
    g.position.set(0, 0.2, 0.158);
    return [{ parent: 'torso', obj: g }];
  },
  clipboard(b) {
    const g = new THREE.Group();
    g.add(rounded(0.2, 0.27, 0.018, 0.02, 0xa4764a), box(0.17, 0.23, 0.012, 0xfff9e8, 0, -0.005, 0.012), box(0.06, 0.03, 0.024, 0xd8dee2, 0, 0.125, 0.016));
    for (const y of [0.05, 0, -0.05, -0.1]) g.add(box(0.12, 0.008, 0.004, 0x35b3ad, 0, y, 0.02));
    g.position.set(0.0, -0.3, 0.16); g.rotation.set(-0.35, 0, 0);
    return [{ parent: 'elbowL', obj: g }];
  },
  binoculars(b) {
    const g = new THREE.Group();
    for (const x of [-0.045, 0.045]) { const t = cyl(0.036, 0.042, 0.13, 0x3b525c); t.rotation.x = Math.PI / 2; t.position.set(x, 0, 0); g.add(t); const l = cyl(0.044, 0.044, 0.02, 0x23272b); l.rotation.x = Math.PI / 2; l.position.set(x, 0, 0.07); g.add(l); }
    g.add(box(0.1, 0.03, 0.05, 0x3b525c, 0, 0, -0.01));
    g.position.set(0, 0.36, 0.17);
    return [{ parent: 'torso', obj: g }];
  },
  rescuetube(b) {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.42, 4, 10), mat(0xe8553d)); t.rotation.z = 0.15; g.add(t);
    const stripe = cyl(0.064, 0.064, 0.07, 0xfff3d2); stripe.position.y = 0.04; stripe.rotation.z = 0.15; g.add(stripe);
    const strap = box(0.04, 0.5, 0.012, 0xf4c84a, 0, 0, 0.065); strap.rotation.z = 0.15; g.add(strap);
    g.position.set(-0.27, 0.12, -0.04);
    return [{ parent: 'torso', obj: g }];
  },
  litterpicker(b) {
    const g = new THREE.Group();
    const stick = cyl(0.016, 0.016, 1.45, 0x35b3ad, 6); stick.position.y = -0.2; g.add(stick);
    const claw = box(0.1, 0.05, 0.03, 0xe8553d, 0, -0.93, 0.0); g.add(claw);
    g.add(box(0.03, 0.09, 0.03, 0xe8553d, -0.045, -0.97, 0), box(0.03, 0.09, 0.03, 0xe8553d, 0.045, -0.97, 0));
    g.position.set(0.0, -0.28, 0.05); g.rotation.set(0.5, 0, 0);
    return [{ parent: 'elbowR', obj: g }];
  },
  sack(b) {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 9), mat(0x5fcf7a)); s.scale.set(0.9, 1.2, 0.8); g.add(s);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 8), mat(0x2f8f52)); knot.position.y = 0.27; g.add(knot);
    for (const [x, y, z, c] of [[0.1, 0.05, 0.14, 0xf0715a], [-0.08, -0.1, 0.15, 0xf6f1e6]]) g.add(box(0.08, 0.06, 0.04, c, x, y, z));   // litter peeking out
    g.position.set(0, 0.0, -0.3);
    return [{ parent: 'torso', obj: g }];
  },
  baittub(b) {
    const g = new THREE.Group();
    const tub = cyl(0.17, 0.14, 0.22, 0x35b3ad, 14); tub.position.y = 0.11; g.add(tub);
    const lid = cyl(0.18, 0.18, 0.03, 0xfff3d2, 14); lid.position.y = 0.235; g.add(lid);
    g.add(box(0.1, 0.03, 0.03, 0x1f5f6b, 0, 0.255, 0.1));
    g.position.set(0.6, 0, 0.35);
    return [{ parent: 'root', obj: g }];
  },
  thermos(b) {
    const g = new THREE.Group();
    const f = cyl(0.045, 0.045, 0.2, 0xe8553d, 10); f.position.y = 0.1; g.add(f);
    const cap = cyl(0.05, 0.05, 0.05, 0xfff3d2, 10); cap.position.y = 0.22; g.add(cap);
    g.position.set(-0.6, 0, 0.3);
    return [{ parent: 'root', obj: g }];
  },
  bucket(b, models, propMat) {
    const geo = models?.get('bucket');
    if (!geo) return [];
    const m = new THREE.Mesh(geo, propMat); m.scale.setScalar(0.7); m.position.set(0.7, 0, 0.2);
    return [{ parent: 'root', obj: m }];
  },
  crate(b) {
    // A blue fish crate by the feet, with a fish tail poking out.
    const g = new THREE.Group();
    g.add(box(0.5, 0.3, 0.36, 0x3d86c4, 0, 0.15, 0), box(0.54, 0.05, 0.4, 0x2d6f9c, 0, 0.31, 0), box(0.12, 0.05, 0.1, 0xc9d6dc, 0.1, 0.35, 0.02));
    g.position.set(0.62, 0, 0.18);
    return [{ parent: 'root', obj: g }];
  },
  stool(b) {
    // Shown only while sitting (set in NPC): a little folding stool under the hips.
    const g = new THREE.Group();
    g.add(box(0.36, 0.04, 0.3, 0x35b3ad, 0, 0.22, 0));
    for (const [x, z] of [[-0.14, -0.1], [0.14, -0.1], [-0.14, 0.1], [0.14, 0.1]]) { const l = box(0.025, 0.22, 0.025, 0x4a5560, x, 0.11, z); g.add(l); }
    g.position.set(0, 0, -0.02); g.visible = false;
    return [{ parent: 'root', obj: g, name: 'stool' }];
  },
};

/**
 * Where a prop goes in a dialogue bust, so it is in frame even if the world has it on the ground or low in a hand: [x, y, z, rx, ry, rz, scale] on the torso (y up the body, +z in front).
 * A prop missing from this list stays where it is (it already sits on the chest).
 */
const BUST = {
  binoculars: [0, 0.2, 0.2, 0.15, 0, 0, 1.3],
  clipboard: [0.19, 0.17, 0.2, -0.15, -0.1, -0.16, 1.05],
  rescuetube: [-0.24, 0.22, 0.08, 0, 0, 0.42, 1],
  litterpicker: [0.34, -0.4, 0.12, 0, 0, Math.PI, 1],
  sack: [-0.32, 0.32, -0.16, 0, 0, 0.3, 0.72],
  baittub: [0.2, 0.0, 0.25, 0.42, 0, 0, 0.72],
  thermos: [-0.2, -0.02, 0.24, 0.12, 0, 0.1, 1.3],
  bucket: [0.24, 0.0, 0.25, 0.4, 0, 0, 0.5],
  crate: [0.02, -0.02, 0.3, 0.4, 0, 0, 0.66],
};

/** Add the named props to a body (an Angler). Returns { stool } so the NPC can show the stool when it sits down. `bust` lays them out for a dialogue portrait (no stool). */
export function buildProps(names, body, models, propMat, { bust = false } = {}) {
  const out = {};
  for (const n of bust ? names : [...names, 'stool']) {
    const b = BUILDERS[n];
    if (!b) { console.warn('Unknown NPC prop', n); continue; }
    for (const built of b(body, models, propMat)) {
      const { obj, name } = built, B = bust && BUST[n];
      let parent = built.parent;
      if (B) { parent = 'torso'; obj.position.set(B[0], B[1], B[2]); obj.rotation.set(B[3], B[4], B[5]); obj.scale.setScalar(B[6]); }
      (parent === 'root' ? body.root : body.joints[parent]).add(obj);
      obj.traverse(o => { if (o.isMesh) { o.castShadow = body.shadowOn; o.userData.noOutline = true; } });
      if (name) out[name] = obj;
    }
  }
  return out;
}
