// The club ceremonies: an evening on Bellambi beach by the Illawarra Anglers' Club, bunting and lanterns, the whole cast of the coast in a half circle round you.
// Each person steps up and gives an award that quotes YOUR numbers (content/ceremony.js, fishing/ending.js playerStats), then an end card with the tagline.
//   'awards'    awards night, the real ending (100% Mastered + Bay Health)       'milestone'  a softer ceremony at 100% Caught
// After either one the player keeps playing: the end card's "Keep fishing" puts you back on the beach in the morning.
import * as THREE from 'three';
import { AWARDS, MILESTONE, TAGLINE, CLUB, nextSteps } from '../content/ceremony.js';
import { playerStats, markCeremony, endingStatus, BAY_THRESHOLD } from '../fishing/ending.js';
import { coopEligible } from '../economy/commercial.js';
import { openCredits } from './credits.js';
import { esc } from './panels.js';
import { nameOf } from '../core/anglerData.js';
import { START_HOUR } from '../fishing/gear.js';

const SITE = 'rocky', STAGE = { x: -4, z: 104 }, EVENING = 18.65;
const $ = s => document.querySelector(s);
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const glow = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });

/** Where each person stands: a half circle on the inland side of the stage, all facing the player on the podium. */
export function castSpots(ids, S = STAGE) {
  const tall = innerWidth < innerHeight * 0.8;   // a portrait phone: a tighter half circle so everyone fits across the narrow screen
  const n = ids.length, R = tall ? 3.3 : n > 5 ? 4.6 : 3.4, span = tall ? (n > 5 ? 2.3 : 1.7) : n > 5 ? 2.5 : 1.7, out = {};
  ids.forEach((id, i) => {
    const a = n === 1 ? 0 : -span / 2 + span * i / (n - 1), x = S.x + Math.sin(a) * R, z = S.z + Math.cos(a) * R;
    out[id] = { x, z, heading: Math.atan2(S.x - x, S.z - z) };
  });
  return out;
}

/** The set: a podium, a banner between two poles, bunting, fairy lights, lanterns and a table of trophies. */
function buildStage(game) {
  const g = game, W = g.world, grp = new THREE.Group(), S = STAGE, y0 = x => W.walkAt(x, S.z + 6), disposables = [];
  const keep = o => { disposables.push(o); return o; };
  const tall = innerWidth < innerHeight * 0.8, bannerZ = S.z + 8.2, poleX = tall ? 4.0 : 6.2, topY = 4.1;
  const yAt = (x, z) => W.walkAt(x, z);
  // podium
  const pod = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.15, 1.3, 0.28, 24)), keep(std(0xfff3d2)));
  pod.position.set(S.x, yAt(S.x, S.z) + 0.14, S.z); grp.add(pod);
  const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(1.2, 0.07, 8, 32)), keep(std(0x2fb4b0)));
  rim.rotation.x = Math.PI / 2; rim.position.set(S.x, yAt(S.x, S.z) + 0.29, S.z); grp.add(rim);
  // poles
  for (const sx of [-1, 1]) {
    const x = S.x + sx * poleX, base = yAt(x, bannerZ);
    const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.09, 0.12, topY + 0.4, 8)), keep(std(0x8a6a45)));
    pole.position.set(x, base + (topY + 0.4) / 2 - 0.2, bannerZ); grp.add(pole);
    const knob = new THREE.Mesh(keep(new THREE.SphereGeometry(0.17, 12, 8)), keep(glow(0xffd66b)));
    knob.position.set(x, base + topY + 0.25, bannerZ); grp.add(knob);
    // a lantern post at each end of the half circle
    const lx = S.x + sx * (tall ? 3.9 : 5.8), lz = S.z + 1.6, lb = yAt(lx, lz);
    const lp = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 6)), keep(std(0x5a4430)));
    lp.position.set(lx, lb + 0.85, lz); grp.add(lp);
    const lamp = new THREE.Mesh(keep(new THREE.SphereGeometry(0.22, 12, 10)), keep(glow(0xffc873)));
    lamp.position.set(lx, lb + 1.8, lz); grp.add(lamp);
  }
  // banner
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#fff3d2'; x.fillRect(0, 0, 1024, 256);
  x.strokeStyle = '#1f5f6b'; x.lineWidth = 16; x.strokeRect(8, 8, 1008, 240);
  x.fillStyle = '#1f5f6b'; x.textAlign = 'center';
  x.font = '800 54px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; x.fillText(CLUB.toUpperCase(), 512, 84);
  x.fillStyle = '#c2570a'; x.font = '800 100px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; x.fillText('AWARDS NIGHT', 512, 190);
  const tex = keep(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const banner = new THREE.Mesh(keep(new THREE.PlaneGeometry(poleX * 2 - 0.4, 1.55)), keep(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false })));
  banner.position.set(S.x, yAt(S.x, bannerZ) + topY - 0.75, bannerZ - 0.02); banner.rotation.y = Math.PI; grp.add(banner);
  // bunting and fairy lights along a sagging line between the pole tops
  const line = (x0, x1, sag) => Array.from({ length: 30 }, (_, i) => { const k = i / 29; return new THREE.Vector3(x0 + (x1 - x0) * k, yAt(S.x, bannerZ) + topY + 0.38 - sag * 4 * k * (1 - k), bannerZ - 0.3); });
  const pts = line(S.x - poleX, S.x + poleX, 0.28), cols = [0xff7f6b, 0xffd66b, 0x6fd1c7, 0xfff3d2, 0x7fb2f0];
  const flags = [], idx = [], colr = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i], b = pts[i + 1], m = a.clone().lerp(b, 0.5), col = new THREE.Color(cols[i % cols.length]);
    const k = flags.length / 3; flags.push(a.x, a.y, a.z, b.x, b.y, b.z, m.x, m.y - 0.34, m.z); idx.push(k, k + 1, k + 2); for (let j = 0; j < 3; j++) colr.push(col.r, col.g, col.b);
  }
  const bg = keep(new THREE.BufferGeometry()); bg.setAttribute('position', new THREE.Float32BufferAttribute(flags, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); bg.setIndex(idx);
  const bunting = new THREE.Mesh(bg, keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }))); grp.add(bunting);
  const bulb = keep(new THREE.SphereGeometry(0.075, 8, 6)), bulbMat = keep(glow(0xffe3a0));
  const fairy = line(S.x - poleX, S.x + poleX, 0.5);
  for (let i = 0; i < fairy.length; i += 2) { const b = new THREE.Mesh(bulb, bulbMat); b.position.copy(fairy[i]); b.position.y -= 1.9; b.position.z += 0.1; grp.add(b); }
  // trophy table behind the half circle
  const tx = S.x, tz = S.z + 6.6, ty = yAt(tx, tz);
  const top = new THREE.Mesh(keep(new THREE.BoxGeometry(3.4, 0.1, 1.1)), keep(std(0xfff3d2))); top.position.set(tx, ty + 0.95, tz); grp.add(top);
  const cloth = new THREE.Mesh(keep(new THREE.BoxGeometry(3.45, 0.7, 1.12)), keep(std(0x2fb4b0))); cloth.position.set(tx, ty + 0.55, tz); grp.add(cloth);
  const gold = keep(std(0xf2c14e, { metalness: 0.5, roughness: 0.35 }));
  for (let i = 0; i < 5; i++) {
    const cx = tx - 1.3 + i * 0.65, s = i === 2 ? 1.5 : 1;
    const cup = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.17 * s, 0.09 * s, 0.26 * s, 14)), gold); cup.position.set(cx, ty + 1.15 + 0.1 * s, tz); grp.add(cup);
    const stem = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.03, 0.03, 0.16 * s, 6)), gold); stem.position.set(cx, ty + 1.05, tz); grp.add(stem);
  }
  // soft warm light on non-low tiers (the lanterns themselves are bright flat colours, so bloom picks them up)
  if (!g.settings || g.settings.quality !== 'low') for (const sx of [-1, 1]) { const l = new THREE.PointLight(0xffc27a, 38, 14, 2); l.position.set(S.x + sx * 3.4, yAt(S.x, S.z) + 3.2, S.z + 2.4); grp.add(l); }
  grp.traverse(o => { if (o.isMesh) { o.castShadow = !!g.quality.shadows && o.material.isMeshStandardMaterial; o.receiveShadow = false; o.userData.noShadow = !o.material.isMeshStandardMaterial; } });
  g.scene.add(grp);
  return { grp, dispose() { grp.parent?.remove(grp); for (const d of disposables) d.dispose?.(); } };
}

const medals = () => $('#cer-medals') ?? (() => { const d = document.createElement('div'); d.id = 'cer-medals'; d.setAttribute('aria-label', 'Awards given'); document.body.appendChild(d); return d; })();
function banner(text, sub) {
  const el = $('#cer-banner') ?? (() => { const d = document.createElement('div'); d.id = 'cer-banner'; d.setAttribute('role', 'status'); document.body.appendChild(d); return d; })();
  el.innerHTML = `<b>${text}</b>${sub ? `<small>${sub}</small>` : ''}`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  return el;
}

/**
 * Run a ceremony. kind: 'awards' | 'milestone'. Resolves with 'play' (keep fishing) or 'title'. Marks the ceremony as shown in the save.
 * `opts.instant` skips the speeches' typing waits (tests); the player still presses Continue on each award.
 */
export async function runCeremony(game, kind = 'awards', opts = {}) {
  const g = game, p = g.progress, awards = kind === 'awards' ? AWARDS : MILESTONE;
  if (g.ceremonyRunning) return 'busy';
  g.ceremonyRunning = true;
  try {
    g.fishing.stop(); g.panels.close(true); g.dialogue.hide();
    $('#menu').classList.remove('show'); $('#hud').classList.add('hidden'); document.body.classList.remove('land-mode');
    if (g.eco.id !== SITE) await g.loadSite(SITE);
    // The evening: dusk glow and lanterns. The clock is frozen for the ceremony.
    const day = Math.floor(g.cond.minutes / 1440);
    g.cond.minutes = day * 1440 + EVENING * 60;
    const ids = awards.map(a => a.npc), spots = castSpots(ids);
    g.npcs.loadCast(g.eco, spots);
    const stage = buildStage(g);
    g.mode = 'ceremony'; g.input.wantLock = false; g.input.unlock();
    const S = STAGE, ph = g.world.walkAt(S.x, S.z) + 0.28;
    g.walker.spawn(new THREE.Vector3(S.x, ph, S.z), 0);
    g.angler.root.visible = true; g.angler.place(new THREE.Vector3(S.x, ph, S.z), 0); g.angler.update(1 / 60, g.time, { state: 'off' });
    g.cer = { S, look: new THREE.Vector3(S.x, ph + 1.5, S.z + 1.4), want: new THREE.Vector3(S.x, ph + 1.5, S.z + 1.4), t: 0, ph };
    if (g.viewOffset) { g.camera.clearViewOffset(); g.viewOffset = false; }
    $('#loading').classList.remove('show');
    const mb = medals(); mb.innerHTML = ''; mb.classList.add('show');
    const s = playerStats(p), name = nameOf(p);
    g.audio.play('newSpecies');
    banner(kind === 'awards' ? 'Awards night' : 'A club celebration', `${CLUB}, Bellambi beach`);
    await wait(opts.instant ? 50 : 1800);
    const speak = async (a, i) => {
      const npc = g.npcs.byId[a.npc]; if (npc) g.cer.want.set(npc.pos.x * 0.55 + S.x * 0.45, ph + 1.5, npc.pos.z * 0.45 + (S.z + 1.4) * 0.55);
      const who = g.npcs.whoOf(a.npc), text = a.line(s).replaceAll('{name}', esc(name));
      await g.dialogue.say({ who, text: `<div class="cer-award"><span>🏅</span> <b>${esc(a.title)}</b></div>${text}`, button: i === awards.length - 1 ? 'Thank you!' : 'Thank you' });
      g.audio.play('newSpecies');
      mb.insertAdjacentHTML('beforeend', `<i title="${esc(a.title)}" aria-label="${esc(a.title)}">🏅</i>`);
    };
    for (let i = 0; i < awards.length; i++) await speak(awards[i], i);
    g.dialogue.hide();
    g.cer.want.set(S.x, ph + 1.5, S.z + 1.4);
    markCeremony(p, kind); g.persist();
    const choice = await endCard(g, kind, s);
    // clean up the set
    mb.classList.remove('show'); $('#cer-banner')?.classList.remove('show');
    stage.dispose(); g.npcs.dispose(); g.cer = null;
    if (choice === 'title') { g.npcs.load(g.eco); g.enterMenu(); }
    else {
      // Keep fishing: the next morning on the beach (the ceremony night passes).
      g.cond.minutes = (day + 1) * 1440 + START_HOUR * 60;
      g.npcs.load(g.eco); g.npcs.bumpDay();
      g.startLand(null);   // (an outing already in progress carries on; the head-home summary clears it)
    }
    return choice;
  } finally { g.ceremonyRunning = false; }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/** The end card: the tagline, your numbers, what is left to do, then Keep fishing / Credits / Title. */
function endCard(g, kind, s) {
  const p = g.progress, st = endingStatus(p), steps = nextSteps(s, BAY_THRESHOLD), offer = coopEligible(p);
  return new Promise(resolve => {
    const done = v => { g.panels.close(true); resolve(v); };
    const html = `<div class="flow endcard ${kind}">
      <h2>${kind === 'awards' ? '🏆 Awards night' : '🎉 Every fish caught!'}</h2>
      <p class="tagline">${esc(TAGLINE)}</p>
      <p class="sub">${esc(s.name)}${kind === 'awards' ? ', Steward of the Illawarra coast' : ''}</p>
      <div class="sum-grid">
        <div class="sum-card"><b>${s.mastered}/${s.total}</b><span>Mastered</span></div>
        <div class="sum-card"><b>${Math.round(s.bay)}%</b><span>Bay Health</span></div>
        <div class="sum-card"><b>${s.releases}</b><span>released</span></div>
        <div class="sum-card"><b>${s.accurate}</b><span>accurate measures</span></div>
        <div class="sum-card"><b>${s.litter}</b><span>litter pieces</span></div>
        <div class="sum-card"><b>${s.tags}</b><span>fish tagged</span></div>
      </div>
      ${kind === 'milestone' ? `<p>You have caught every kind of fish in the guide. Awards night is still to come: it needs all ${s.total} fish <b>Mastered</b> and Bay Health at <b>${BAY_THRESHOLD}%</b> or more.</p>` : '<p>The club thanks you for looking after the fish. The coast is still here to explore, so keep fishing, and keep releasing the small ones.</p>'}
      ${steps.length ? `<ul class="next">${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${offer ? '<p class="coop-offer">🚢 <b>Nell has an offer for you:</b> a co-op licence for the commercial chapter. Find her at Belmore Basin harbour.</p>' : ''}
      <p class="sum-actions"><button class="btn primary" id="end-play">Keep fishing</button> <button class="btn" id="end-credits">Credits</button> <button class="btn ghost" id="end-title">Title screen</button></p></div>`;
    const show = () => {
      g.panels.open(html, null, { locked: true, flow: 'ending' });
      const b = g.panels.body;
      b.querySelector('#end-play').onclick = () => done('play');
      b.querySelector('#end-title').onclick = () => done('title');
      b.querySelector('#end-credits').onclick = () => { g.panels.close(true); openCredits(g, show); };
    };
    show();
  });
}

/** Per frame while mode === 'ceremony': a slow, gentle diorama camera on the half circle, easing toward whoever is speaking. */
export function updateCeremony(game, dt) {
  const g = game, c = g.cer; if (!c) return;
  c.t += dt; c.look.lerp(c.want, 1 - Math.exp(-2.4 * dt));
  const rig = g.rig, sway = g.settings.reducedMotion ? 0 : Math.sin(c.t * 0.15) * 0.16;
  rig.yaw = Math.PI + sway; rig.pitch = innerWidth < innerHeight ? 0.72 : 0.52; rig.dist = rig.zoom = innerWidth < innerHeight ? 29 : 15.5;
  rig.focus.copy(c.look); rig.apply(g.world);
  g.focus.copy(rig.focus);
  g.angler.update(dt, g.time, { state: 'off' });
}
