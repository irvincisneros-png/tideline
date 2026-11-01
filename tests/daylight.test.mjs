// Phase 6: day and night at EVERY site (one shared lighting system, ocean/daylight.js) and the Phase 5 polish: squid eyes set flush, solid trawlers, angular armour rock, painted quay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ECOSYSTEMS } from '../src/ecosystems/index.js';
import { daylightAt, paletteAt, lightingFor, NIGHT, GLOW, hexLinear, lum } from '../src/ocean/daylight.js';
import { START_HOUR, DayConditions } from '../src/fishing/gear.js';
import { buildHarbourModels, } from '../src/world/harbourProps.js';
import { RECTS, AREA } from '../src/world/quayPaint.js';
import { QUAY_Z, QY, harbour } from '../src/ecosystems/harbour.js';
import { buildCephalopod } from '../src/life/cephalopod.js';
import { LOOKS } from '../src/life/looks.js';
import '../src/fishing/catches.js';

const HOURS = { day: 11, dusk: 18.7, night: 23, dawn: 6.2 };

test('every site has time of day: the five sites all opt in to the shared lighting', () => {
  assert.deepEqual(ECOSYSTEMS.map(e => e.id), ['rocky', 'seagrass', 'harbour', 'reef', 'river']);
  for (const e of ECOSYSTEMS) { const L = lightingFor(e); assert.ok(L, `${e.id} has lighting`); assert.ok(L.glow > 0 && L.night.skyTop != null); assert.ok(e.water.sun && e.water.skyTop != null, `${e.id} water palette`); }
  assert.equal(lightingFor({ daylight: false }), null); assert.equal(lightingFor({}), null);
  // only the harbour has lamps; the others have no lamp pools to switch on
  assert.equal(lightingFor(harbour).lamps, true); for (const e of ECOSYSTEMS.filter(e => e.id !== 'harbour')) assert.equal(lightingFor(e).lamps, false, `${e.id} lamps`);
  // a site can tune its night palette
  const tuned = lightingFor({ daylight: { glow: 0.5, night: { skyTop: 0x123456 } } }); assert.equal(tuned.glow, 0.5); assert.equal(tuned.night.skyTop, 0x123456); assert.equal(tuned.night.skyHorizon, NIGHT.skyHorizon);
});
test('at every site: day is bright, night is dark blue but never black, and the transitions are smooth', () => {
  for (const e of ECOSYSTEMS) {
    const L = lightingFor(e), day = paletteAt(e.water, HOURS.day, L), night = paletteAt(e.water, HOURS.night, L);
    assert.ok(day.d.light > 0.99 && night.d.light < 0.01 && night.d.night > 0.99, `${e.id}: light at day / night`);
    // night is blue and dark, but readable (the art bible: never black)
    for (const k of ['skyTop', 'skyHorizon', 'shallow', 'mid', 'deep', 'fog', 'hemiSky']) { const c = night[k]; assert.ok(lum(c) > 0.006, `${e.id} night ${k} is not black (${lum(c).toFixed(4)})`); assert.ok(c[2] >= c[0] * 0.95, `${e.id} night ${k} is blue`); }
    assert.ok(lum(night.skyHorizon) > lum(night.skyTop), `${e.id}: a lighter horizon`);
    assert.ok(lum(night.skyTop) < lum(day.skyTop) && lum(night.hemiSky) < lum(day.hemiSky) && night.sunIntensity < day.sunIntensity, `${e.id}: night is darker than day`);
    assert.ok(night.hemiIntensity >= 0.9, `${e.id}: ambient stays up at night`); assert.ok(night.sunDir[1] > 0.3, 'the moon is up');
    assert.ok(Math.abs(Math.hypot(...night.sunDir) - 1) < 1e-6 && Math.abs(Math.hypot(...day.sunDir) - 1) < 1e-6);
    // light falls smoothly into the evening and rises smoothly at dawn
    let prev = 1; for (let h = 16; h <= 21; h += 0.25) { const l = paletteAt(e.water, h, L).d.light; assert.ok(l <= prev + 1e-9); prev = l; }
    prev = 0; for (let h = 4; h <= 8; h += 0.25) { const l = paletteAt(e.water, h, L).d.light; assert.ok(l >= prev - 1e-9); prev = l; }
    for (let h = 0; h < 24; h += 0.5) { const P = paletteAt(e.water, h, L); for (const k of ['skyTop', 'skyHorizon', 'shallow', 'mid', 'deep', 'fog', 'fogDeep', 'sunColor', 'hemiSky', 'hemiGround']) assert.ok(P[k].every(v => Number.isFinite(v) && v >= 0 && v <= 1.001), `${e.id} ${h}h ${k}`); }
  }
});
test('dusk is a strong, warm sunset at every site: an amber-orange horizon, a rose-violet sky above it, an orange sun, long low light', () => {
  assert.ok(daylightAt(18.7).glow > 0.97, 'the sunset glow peaks around 18:40');
  assert.ok(daylightAt(18).glow > 0.7 && daylightAt(19.5).glow > 0.6 && daylightAt(11).glow < 0.05, 'a long sunset, none at midday');
  assert.equal(GLOW.skyHorizon, 0xff8a42);
  for (const e of ECOSYSTEMS) {
    const L = lightingFor(e), day = paletteAt(e.water, 11, L), dusk = paletteAt(e.water, 18.7, L);
    const [r, g, b] = dusk.skyHorizon; assert.ok(r > g && g > b * 0.9 && r > b * 2, `${e.id}: the horizon is orange (${[r, g, b].map(v => v.toFixed(2))})`);
    assert.ok(dusk.skyHorizon[0] > day.skyHorizon[0] * 0.9 && dusk.skyHorizon[2] < day.skyHorizon[2] * 0.6, `${e.id}: warmer than the day horizon`);
    assert.ok(dusk.skyTop[0] > day.skyTop[0] && dusk.skyTop[2] < day.skyTop[2], `${e.id}: the sky above turns toward rose-violet`);
    assert.ok(dusk.sunColor[0] > dusk.sunColor[1] && dusk.sunColor[1] > dusk.sunColor[2] && dusk.sunColor[0] / dusk.sunColor[2] > 2.2, `${e.id}: an orange sun`);
    assert.ok(dusk.sunDir[1] < day.sunDir[1] * 0.88, `${e.id}: the sun sinks toward the horizon`);
    const flat = paletteAt(e.water, 18.7, { ...L, glow: 0 });   // the same hour with no sunset glow
    assert.ok(dusk.shallow[0] / dusk.shallow[2] > flat.shallow[0] / flat.shallow[2] * 1.05 && dusk.mid[0] > flat.mid[0], `${e.id}: the shallows pick up the sunset`);
  }
  // dawn glows too, and the day starts after sunrise (bright), so a first outing is not dim
  assert.ok(daylightAt(6.2).glow > 0.7 && daylightAt(START_HOUR).light > 0.95 && START_HOUR < 8);
  assert.equal(new DayConditions({}).time, 'dawn'); assert.ok(Math.abs(new DayConditions({}).hour - START_HOUR) < 0.01);
  assert.ok(Math.abs(new DayConditions({ time: 'night' }).hour - 22) < 0.01 && new DayConditions({ time: 'dusk' }).time === 'dusk');
});
test('the shared lighting reproduces the harbour night palette exactly (the old harbour look is the shared look)', () => {
  const n = paletteAt(harbour.water, 23, lightingFor(harbour));
  for (const k of ['skyTop', 'skyHorizon', 'shallow', 'mid', 'deep', 'fog', 'fogDeep', 'hemiSky', 'hemiGround']) { const want = hexLinear(NIGHT[k]); n[k].forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-4, `${k}`)); }
  assert.ok(Math.abs(n.sunIntensity - NIGHT.sunIntensity) < 1e-3 && Math.abs(n.exposure - NIGHT.exposure) < 1e-3);
});

// ---------------------------------------------------------------- the Phase 5 polish
const fakeDocument = () => { const ctx = new Proxy({}, { get: (t, k) => (k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) }); return { createElement: () => ({ getContext: () => ctx, width: 0, height: 0 }) }; };
test('squid eyes are set flush into the head, not bug-eyes sticking out', () => {
  globalThis.document = fakeDocument();
  for (const id of ['squid', 'cuttlefish']) {
    const built = buildCephalopod(LOOKS[id]), p = built.geometry.attributes.position, fin = built.geometry.attributes.aFin;
    const eye = [], body = []; for (let i = 0; i < p.count; i++) (fin.getY(i) === -2 ? eye : fin.getY(i) === -1 && fin.getX(i) === 0 ? body : []).push([p.getX(i), p.getY(i), p.getZ(i)]);
    assert.ok(eye.length > 100 && body.length > 100, `${id}: eye and body vertices exist`);
    const ex = eye.reduce((s, v) => s + v[0], 0) / eye.length, near = body.filter(v => Math.abs(v[0] - ex) < 0.06 * LOOKS[id].length), headZ = Math.max(...near.map(v => Math.abs(v[2]))), eyeZ = Math.max(...eye.map(v => Math.abs(v[2])));
    assert.ok(eyeZ <= headZ * 1.2, `${id}: the eye juts out ${(eyeZ / headZ).toFixed(2)}x the head's half-width (flush is <= 1.2; the old bug-eyes were about 1.33)`);
    assert.ok(eyeZ >= headZ * 0.8, `${id}: and it is set into the side of the head, not buried`);
  }
});
test('trawlers are solid: a curved hull, a deck that faces up, windows, folded outriggers, nets and floats', () => {
  const t = buildHarbourModels().get('trawler_blue'), p = t.attributes.position, n = t.attributes.normal, c = t.attributes.color;
  assert.ok(p.count > 10000, 'a detailed model'); for (let i = 0; i < p.count; i++) assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)));
  // the deck is up-facing surface near deck height across the beam (the old trawler's deck faced down and the boat looked like a wireframe from above)
  let deck = 0, upArea = 0; for (let i = 0; i < p.count; i += 3) { const ny = n.getY(i), y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3; if (ny > 0.9 && y > 0.8 && y < 1.1) deck++; if (ny > 0.5) upArea++; }
  assert.ok(deck > 20 && upArea > 400, `${deck} up-facing deck triangles, ${upArea} up-facing in all`);
  t.computeBoundingBox(); const bb = t.boundingBox; assert.ok(bb.max.x - bb.min.x > 10 && bb.max.z - bb.min.z > 3 && bb.max.y > 5 && bb.min.y < -0.5, 'a hull below the waterline, a mast above');
  // colours: white topsides, a coloured stripe, red antifouling, a glass-blue window, orange floats
  const has = (r, g, b, tol = 0.08) => { for (let i = 0; i < c.count; i++) if (Math.abs(c.getX(i) / r - 1) < tol * 6 && Math.abs(c.getY(i) / g - 1) < tol * 6 && Math.abs(c.getZ(i) / b - 1) < tol * 6) return true; return false; };
  const lin = h => { const k = new THREE.Color(h); return [k.r, k.g, k.b]; };
  let glassish = 0, orange = 0, red = 0; for (let i = 0; i < c.count; i++) { const r = c.getX(i), g = c.getY(i), b = c.getZ(i); if (b > r * 1.5 && b > 0.04 && g > r) glassish++; if (r > g * 1.6 && g > b * 1.5) orange++; if (r > g * 3 && r > b * 3) red++; }
  assert.ok(glassish > 30, 'wheelhouse windows'); assert.ok(orange > 30, 'orange floats'); assert.ok(red > 30, 'red antifouling / name board');
  for (const k of ['trawler_blue', 'trawler_red', 'trawler_green']) assert.ok(buildHarbourModels().has(k));
});
test('breakwall armour rock is angular grey-brown with little moss', () => {
  const m = buildHarbourModels();
  for (let v = 0; v < 3; v++) {
    const g = m.get(`armour_rock_${v}`), p = g.attributes.position, c = g.attributes.color; assert.ok(g, `armour_rock_${v}`); assert.ok(p.count <= 120, 'few flat faces: angular, not a lumpy potato');
    g.computeBoundingBox(); assert.ok(Math.abs(g.boundingBox.min.y) < 1e-6, 'sits on y = 0');
    let green = 0, grey = 0; for (let i = 0; i < c.count; i++) { const r = c.getX(i), gg = c.getY(i), b = c.getZ(i); if (gg > r * 1.08 && gg > b * 1.15) green++; if (Math.abs(r - gg) < 0.1 && r >= b) grey++; }
    assert.ok(green / c.count < 0.12, `rock ${v}: only a trace of moss (${(green / c.count * 100).toFixed(0)}%)`); assert.ok(grey / c.count > 0.7, `rock ${v}: grey-brown`);
    // flat shading: every triangle has one normal (three equal ones)
    const n = g.attributes.normal; for (let i = 0; i < n.count; i += 3) assert.ok(Math.abs(n.getX(i) - n.getX(i + 1)) < 1e-6 && Math.abs(n.getY(i) - n.getY(i + 2)) < 1e-6, 'flat faces');
  }
});
test('the quay is dressed: tables, crates, nets, bowser, kiosk with umbrellas, planters, painted bays; paint sits on the quay', () => {
  const m = buildHarbourModels(); for (const k of ['fuel_bowser', 'kiosk', 'umbrella_table', 'planter', 'net_rack', 'crab_pots', 'wheelie_bins', 'boat_trailer', 'sandwich_board', 'crate_stack', 'net_pile', 'fish_bin']) assert.ok(m.has(k), k);
  for (const r of RECTS) { assert.ok(r.x0 >= AREA.x0 && r.x1 <= AREA.x1 && r.z0 >= AREA.z0 && r.z1 <= AREA.z1, `${r.kind} inside the painted area`); assert.ok(r.z0 >= QUAY_Z + 0.9 - 0.1, `${r.kind} is on the quay, not over the water`); }
  assert.ok(RECTS.some(r => r.kind === 'bays') && RECTS.some(r => r.kind === 'hatch' && r.label === 'DIESEL') && RECTS.some(r => r.kind === 'plaza') && RECTS.some(r => r.kind === 'dashes'));
  assert.ok(harbour.heightAt(0, AREA.z0 + 1) >= QY - 0.2, 'the apron is at quay height');
});
