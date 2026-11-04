// The painted surface of Belmore Basin's quay apron, drawn on a canvas and laid over the concrete as one thin textured plane (the terrain's vertex colours are far too coarse for 10 cm paint lines).
// Parking bays (white), a diesel bay with yellow chevron hatching, hatching across the foot of the wharf, a yellow-dashed loading zone, and a paved café plaza with terracotta and cream pavers and grout lines.
// Pure layout data (RECTS) is exported so the tests can check that the paint sits on the quay and clear of the water.
import * as THREE from 'three';
import { patchUnderwater } from '../ocean/shaders.js';
import { T, QROT } from './belmore.js';

// In the QUAY FRAME (world/belmore.js): x along the quay toward the basin mouth, z inland from the water's edge (zo = 40). The decal is turned to match when it is laid.
export const AREA = { x0: -44, x1: 64, z0: 41.4, z1: 68 };
export const PX_PER_M = 16;
/** Everything painted, in metres on the quay. kind: bays (rows of bays), hatch (yellow chevrons), dashes (dashed outline), plaza (pavers). */
export const RECTS = [
  { kind: 'plaza', x0: 17, x1: 41, z0: 46.8, z1: 60 },
  { kind: 'bays', x0: -16, x1: 8, z0: 57, z1: 63, pitch: 3 },
  { kind: 'bays', x0: -30, x1: 10, z0: 61.2, z1: 67, pitch: 3 },
  { kind: 'bays', x0: 46, x1: 61, z0: 57, z1: 63, pitch: 3 },
  { kind: 'hatch', x0: -12, x1: -5.6, z0: 44.4, z1: 50.6, border: true, label: 'DIESEL' },
  { kind: 'hatch', x0: 8.3, x1: 15.7, z0: 41.6, z1: 43.0, border: false },
  { kind: 'dashes', x0: -35, x1: -21, z0: 43.6, z1: 46.6, label: 'LOADING' },
];
const WHITE = '#fbf8ef', YELLOW = '#f2c230', DARK = '#5d6368';

/** Paint the apron on a canvas. Returns the canvas (AREA.x0..x1 across, AREA.z0..z1 down). */
export function paintQuayCanvas() {
  const W = Math.round((AREA.x1 - AREA.x0) * PX_PER_M), H = Math.round((AREA.z1 - AREA.z0) * PX_PER_M);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), X = x => (x - AREA.x0) * PX_PER_M, Z = z => (z - AREA.z0) * PX_PER_M, P = PX_PER_M;
  g.clearRect(0, 0, W, H);
  for (const r of RECTS) {
    if (r.kind === 'plaza') {
      const s = 0.9 * P;
      for (let x = r.x0; x < r.x1; x += 0.9) for (let z = r.z0; z < r.z1; z += 0.9) {
        const k = (Math.floor((x - r.x0) / 0.9) + Math.floor((z - r.z0) / 0.9)) % 2;
        g.fillStyle = k ? '#dfa57a' : '#eed3ab'; g.fillRect(X(x), Z(z), Math.min(s, X(r.x1) - X(x)), Math.min(s, Z(r.z1) - Z(z)));
        g.strokeStyle = '#a8896f'; g.lineWidth = 2; g.strokeRect(X(x) + 1, Z(z) + 1, s - 2, s - 2);
      }
      g.strokeStyle = '#6b4a30'; g.lineWidth = 5; g.strokeRect(X(r.x0), Z(r.z0), X(r.x1) - X(r.x0), Z(r.z1) - Z(r.z0));
    } else if (r.kind === 'bays') {
      g.fillStyle = WHITE;
      for (let x = r.x0; x <= r.x1 + 0.01; x += r.pitch) g.fillRect(X(x) - 0.06 * P, Z(r.z0), 0.12 * P, Z(r.z1) - Z(r.z0));
      g.fillRect(X(r.x0), Z(r.z1) - 0.06 * P, X(r.x1) - X(r.x0), 0.12 * P);
    } else if (r.kind === 'hatch') {
      const x0 = X(r.x0), y0 = Z(r.z0), w = X(r.x1) - x0, h = Z(r.z1) - y0;
      g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip(); g.fillStyle = DARK; g.fillRect(x0, y0, w, h);
      g.fillStyle = YELLOW; for (let d = -h; d < w + h; d += 0.9 * P) { g.beginPath(); g.moveTo(x0 + d, y0 + h); g.lineTo(x0 + d + 0.42 * P, y0 + h); g.lineTo(x0 + d + 0.42 * P + h, y0); g.lineTo(x0 + d + h, y0); g.fill(); }
      g.restore();
      if (r.border) { g.strokeStyle = YELLOW; g.lineWidth = 0.22 * P; g.strokeRect(x0 + 0.11 * P, y0 + 0.11 * P, w - 0.22 * P, h - 0.22 * P); }
      if (r.label) { g.save(); g.fillStyle = '#fff6d2'; g.fillRect(x0 + w / 2 - 1.5 * P, y0 + h / 2 - 0.42 * P, 3 * P, 0.84 * P); g.fillStyle = '#c0392b'; g.font = `800 ${0.62 * P}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r.label, x0 + w / 2, y0 + h / 2); g.restore(); }
    } else if (r.kind === 'dashes') {
      g.strokeStyle = YELLOW; g.lineWidth = 0.2 * P; g.setLineDash([0.9 * P, 0.7 * P]); g.strokeRect(X(r.x0), Z(r.z0), X(r.x1) - X(r.x0), Z(r.z1) - Z(r.z0)); g.setLineDash([]);
      if (r.label) { g.fillStyle = YELLOW; g.font = `800 ${0.7 * P}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r.label, (X(r.x0) + X(r.x1)) / 2, (Z(r.z0) + Z(r.z1)) / 2); }
    }
  }
  return c;
}

/** A plane laid over the apron at height y. Lit like the other props (the cosy light and the night palette), so it never glows at night. */
export function quayDecal(y) {
  const tex = new THREE.CanvasTexture(paintQuayCanvas()); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mat = patchUnderwater(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false }), { key: 'decal' });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(AREA.x1 - AREA.x0, AREA.z1 - AREA.z0).rotateX(-Math.PI / 2), mat);
  const [cx, cz] = T((AREA.x0 + AREA.x1) / 2, (AREA.z0 + AREA.z1) / 2); m.position.set(cx, y, cz); m.rotation.y = QROT; m.renderOrder = 1; m.receiveShadow = true; m.castShadow = false; m.userData.noShadow = true;
  return m;
}
