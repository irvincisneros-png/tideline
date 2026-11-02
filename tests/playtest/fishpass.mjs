// Fish model contact sheets: every line-caught species, side view and a head close-up, drawn with the game's own fish material and cosy style.
// Not a pass/fail test. Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/fishpass.mjs <label> [id,id,...]
//   -> playtest-shots/fishpass/<label>-sides.png, <label>-heads.png (and <label>-<id>-head.png for single close-ups)
import { launch } from './harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const label = process.argv[2] ?? 'after';
const only = process.argv[3]?.split(',').filter(Boolean);
const cosy = process.env.COSY !== '0';   // the game's default art style (set COSY=0 for the realistic style)
const out = 'playtest-shots/fishpass';
mkdirSync(out, { recursive: true });
const t = await launch({ query: 'eco=harbour&quality=high&play=1&time=day&swell=1', outDir: out, width: 900, height: 600 });
await t.wait(1000);
const res = await t.page.evaluate(async ([only, cosy]) => {
  const THREE = await import('three');
  const { SPECIES } = await import('/src/fishing/species.js');
  await import('/src/fishing/catches.js'); await import('/src/ecosystems/index.js');
  const { LOOKS } = await import('/src/life/looks.js');
  const { buildFish } = await import('/src/life/fishModel.js');
  const { patchUnderwater, globalUniforms } = await import('/src/ocean/shaders.js');
  globalUniforms.uStyle.value = cosy ? 1 : 0;
  const ids = only ?? SPECIES.map(s => s.id);
  const TW = 440, TH = 270, COLS = 5;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
  renderer.setSize(TW, TH, false); renderer.setPixelRatio(1); renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const tris = {};
  const mk = id => {
    const look = LOOKS[id], b = buildFish(look);
    const mat = new THREE.MeshStandardMaterial({ map: b.texture, roughness: look.metal ? 0.3 : (look.rough ?? 0.42), metalness: look.metal ?? 0.05, side: THREE.DoubleSide, alphaToCoverage: true });
    if (look.emissive != null) { mat.emissive = new THREE.Color(look.emissive); mat.emissiveIntensity = look.emissiveIntensity ?? 0.3; }
    patchUnderwater(mat, { fish: true, swim: false, swimLength: b.length });
    b.geometry.computeBoundingBox();
    tris[id] = (b.geometry.index ? b.geometry.index.count : b.geometry.attributes.position.count) / 3;
    return { mesh: new THREE.Mesh(b.geometry, mat), bb: b.geometry.boundingBox.clone(), look };
  };
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcdeee9);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbfe9f5, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1d0, 2.1); sun.position.set(1.5, 3, -2); scene.add(sun);
  const sheet = (mode) => {
    const rows = Math.ceil(ids.length / COLS);
    const cv = document.createElement('canvas'); cv.width = TW * COLS; cv.height = TH * rows; const g = cv.getContext('2d');
    ids.forEach((id, i) => {
      const { mesh, bb } = mk(id); scene.add(mesh);
      const s = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      let cam;
      if (mode === 'side') {
        let hw = s.x / 2 * 1.08, hh = hw * TH / TW; if (s.y / 2 * 1.25 > hh) { hh = s.y / 2 * 1.25; hw = hh * TW / TH; }
        cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 20); cam.position.set(c.x, c.y, -5); cam.lookAt(c.x, c.y, 0);
      } else {
        // Head close-up, three-quarter view from the front-side, a little above.
        const h = Math.max(s.y, s.z * 0.8, s.x * 0.12) * 1.15;
        const target = new THREE.Vector3(bb.max.x - Math.min(s.x * 0.17, 0.5), c.y * 0.6, 0);
        cam = new THREE.PerspectiveCamera(24, TW / TH, 0.005, 20);
        const d = h * 2.9 + 0.05;
        cam.position.set(target.x + d * 0.62, target.y + d * 0.22, -d * 0.74); cam.lookAt(target);
      }
      renderer.render(scene, cam);
      g.drawImage(renderer.domElement, (i % COLS) * TW, Math.floor(i / COLS) * TH);
      g.fillStyle = '#1f5f6b'; g.font = '700 16px sans-serif'; g.fillText(`${id}  ${Math.round(tris[id])} tris`, (i % COLS) * TW + 8, Math.floor(i / COLS) * TH + 20);
      scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose();
    });
    return cv.toDataURL('image/png');
  };
  const sides = sheet('side'), heads = sheet('head');
  return { sides, heads, tris };
}, [only, cosy]);
writeFileSync(`${out}/${label}-sides.png`, Buffer.from(res.sides.split(',')[1], 'base64'));
writeFileSync(`${out}/${label}-heads.png`, Buffer.from(res.heads.split(',')[1], 'base64'));
console.log('tris', JSON.stringify(res.tris));
console.log('errors', t.errors.slice(0, 5));
await t.close();
