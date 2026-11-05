// The living coast: builds the people of the current site, moves them through the day (dawn / day / dusk / night), finds who you can talk to, shows
// "Press E to talk", lets nearby people greet you and react to what you do (an undersize keep, a big legal catch), makes the lifeguard guard the rock
// platform in a big swell, and runs the ambient birds. Dialogue and trades are in talk.js; the people themselves in npc.js; data in content/npcs.js.
import * as THREE from 'three';
import { NPCS, REACT_FALLBACK } from '../content/npcs.js';
import { slotAt, resolveSlot, isAway } from './schedule.js';
import { PLACES, EXTRAS } from './places.js';
import { NPC } from './npc.js';
import { Birds } from './birds.js';
import { Labels } from './labels.js';
import { Talk } from './talk.js';
import { portraitFor } from './portrait.js';
import { questLog, ensureNpc, nextDay, tradeStatus } from './requests.js';
import { pruneFridge } from '../economy/possession.js';
import { sanitizeLook, nameOf } from '../core/anglerData.js';
import { esc } from '../ui/panels.js';
import { PORTRAITS } from '../ui/dialogue.js';
import { platformMask } from '../ecosystems/rocky.js';
import { JETTY, shoreZ } from '../ecosystems/seagrass.js';
import { SPECIES_BY_ID } from '../fishing/species.js';

export const TALK_RANGE = 3.4, REACT_RANGE = 15, GREET_RANGE = 6.5, GREET_COOLDOWN = 160, SWELL_LIMIT = 2.5;
const fmt = (t, name) => t.replaceAll('{name}', esc(name));
const bigCatch = (id, len) => { const sp = SPECIES_BY_ID[id]; return !!sp && len >= sp.length[0] + (sp.length[1] - sp.length[0]) * 0.62; };

export class NPCManager {
  constructor(game) {
    this.game = game; this.npcs = []; this.byId = {}; this.near = null; this.timeKey = null; this.birds = null; this.extras = null;
    this.talk = new Talk(game, this);
    this.labels = new Labels(game.camera);
    this.greeted = {}; this.hold = 0; this.platT = 0; this.warned = false; this.penaltyCool = 0; this.lastHour = null; this.markerT = 0;
  }
  get p() { return this.game.progress; }
  get siteId() { return this.game.eco.id; }

  // ------------------------------------------------------------------ build / tear down
  load(eco) {
    this.dispose();
    const g = this.game;
    // The people are gameplay (the shop, Nell, the quizzes), so they exist in every graphics style and even if the model file failed to load (land/angler.js builds fallback shapes).
    for (const [id, def] of Object.entries(NPCS)) {
      if (!def.sites[eco.id]) continue;
      const npc = new NPC(this, id, def, eco.id);
      this.npcs.push(npc); this.byId[id] = npc;
    }
    this.buildExtras(eco);
    const table = eco.id === 'seagrass' ? { x: JETTY.x + 7.5, z: shoreZ(JETTY.x + 7.5) + 9 } : null;
    this.birds = new Birds(g, table);
    this.timeKey = null; this.greeted = {}; this.platT = 0; this.warned = false;
    this.applyTime(true);
    // Render the portrait busts a little after the site opens (one every 400 ms), so the first conversation is instant.
    clearTimeout(this.prefetch);
    const ids = this.npcs.map(n => n.id), next = () => { const id = ids.shift(); if (id && this.byId[id]) { this.whoOf(id); this.prefetch = setTimeout(next, 400); } };
    this.prefetch = setTimeout(next, 2500);
  }
  /**
   * The club ceremony (ui/ceremony.js): build the whole cast of the coast at once, wherever they usually live, and stand each one at `spots[id]` = { x, z, heading }.
   * They keep their name tags and speech bubbles and do not follow their daily schedules (`this.ceremony`). load(eco) puts the normal people back afterwards.
   */
  loadCast(eco, spots) {
    this.dispose();
    const g = this.game;
    this.ceremony = true;
    for (const [id, def] of Object.entries(NPCS)) {
      const at = spots[id]; if (!at) continue;
      const npc = new NPC(this, id, def, eco.id);
      this.npcs.push(npc); this.byId[id] = npc;
      npc.setSlot({ act: 'standing', points: [{ x: at.x, z: at.z }], heading: at.heading, away: false }, true);
    }
    this.buildExtras(eco);
    this.timeKey = null;
    return true;
  }
  dispose() {
    this.ceremony = false;
    clearTimeout(this.prefetch);
    for (const n of this.npcs) n.dispose();
    this.npcs = []; this.byId = {}; this.near = null;
    this.birds?.dispose(); this.birds = null;
    if (this.extras) { this.extras.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m === this.game.world.props?.mat) continue; m.map?.dispose(); m.dispose(); } } }); this.extras.parent?.remove(this.extras); this.extras = null; }
    document.body.classList.remove('npc-near');
  }

  /** A concrete boat ramp at the lake and the fishing club's notice board on the beach path. */
  buildExtras(eco) {
    const g = this.game, world = g.world, T = world.terrain, grp = this.extras = new THREE.Group(); g.scene.add(grp);
    const standard = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...extra });
    const E = EXTRAS[eco.id];
    if (E?.ramp) {
      const r = E.ramp, nz = Math.round(r.len / 0.1), geo = new THREE.PlaneGeometry(r.w, r.len, 8, nz); geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = r.x + pos.getX(i), z = r.z + pos.getZ(i) + 1.2;
        pos.setXYZ(i, x, T.heightAt(x, z) + 0.06, z);
        const lz = pos.getZ(i) + r.len / 2, groove = Math.abs((lz % 0.8) - 0.4) < 0.07 ? 0.62 : 1, edge = Math.abs(pos.getX(i)) > r.w / 2 - 0.16 ? 0.6 : 1;
        col.set([0.78 * groove * edge, 0.74 * groove * edge, 0.66 * groove * edge], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, world.props.mat);
      m.receiveShadow = true; m.userData.noShadow = true; grp.add(m);
      // A small sign on a post at the top of the ramp.
      const sx = r.x + r.w / 2 + 0.9, sz = r.z + r.len / 2 + 0.6, sy = T.heightAt(sx, sz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 6), standard(0x8a6a45)); post.position.set(sx, sy + 0.75, sz); grp.add(post);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 0.05), standard(0xfff3d2)); sign.position.set(sx, sy + 1.5, sz); sign.rotation.y = Math.PI; grp.add(sign);
    }
    if (E?.board) {
      const b = E.board, y = T.heightAt(b.x, b.z);
      const c = document.createElement('canvas'); c.width = 512; c.height = 320; const x = c.getContext('2d');
      x.fillStyle = '#fff3d2'; x.fillRect(0, 0, 512, 320); x.strokeStyle = '#1f5f6b'; x.lineWidth = 14; x.strokeRect(7, 7, 498, 306);
      x.fillStyle = '#1f5f6b'; x.font = '800 38px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; x.textAlign = 'center';
      x.fillText("ILLAWARRA ANGLERS' CLUB", 256, 66); x.fillStyle = '#c2570a'; x.font = '800 54px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; x.fillText('COMP DAY', 256, 140);
      x.fillStyle = '#1f5f6b'; x.font = '800 32px "Arial Rounded MT Bold", ui-rounded, system-ui, sans-serif'; x.fillText('Catch and release · Weigh-in', 256, 200); x.fillText('Entries open soon', 256, 250); x.fillText('Ask Bev!', 256, 292);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      for (const dx of [-1.0, 1.0]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.3, 7), standard(0x8a6a45)); post.position.set(b.x + dx, y + 1.15, b.z); grp.add(post); }
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.08), [standard(0xa4764a), standard(0xa4764a), standard(0xa4764a), standard(0xa4764a), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), standard(0xa4764a)]);
      board.position.set(b.x, y + 1.6, b.z); board.rotation.x = -0.12; grp.add(board);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 0.5), standard(0xe8553d)); roof.position.set(b.x, y + 2.45, b.z - 0.12); roof.rotation.x = -0.15; grp.add(roof);
      this.collider(world, b.x, y + 1, b.z, 1.9);
    }
    grp.traverse(o => { if (o.isMesh) { o.castShadow = !!g.quality.shadows && !o.userData.noShadow; o.receiveShadow = !!g.quality.shadows; } });
  }
  collider(world, x, y, z, r) {
    const c = { center: new THREE.Vector3(x, y, z), r, pick: { hidden: false } }, k = `${Math.floor(x / 6)},${Math.floor(z / 6)}`;
    if (!world.grid.has(k)) world.grid.set(k, []);
    world.grid.get(k).push(c);
  }

  // ------------------------------------------------------------------ schedule
  applyTime(snap = false) {
    const g = this.game, time = g.cond.time, places = PLACES[this.siteId];
    if (!places) return;
    this.timeKey = time;
    for (const npc of this.npcs) npc.setSlot(resolveSlot(slotAt(npc.def, this.siteId, time), places), snap);
  }
  /** The in-game day counter moves on at midnight and when you head home; failed quizzes can be retried on a new day. */
  bumpDay() { nextDay(this.p); pruneFridge(this.p); this.game.persist(); }

  // ------------------------------------------------------------------ people
  /** The dialogue "who" for a person: name, role and their 3D portrait bust. */
  whoOf(id) {
    const def = NPCS[id], g = this.game;
    return { name: def.name, role: def.role, portrait: PORTRAITS[id]?.portrait, portraitUrl: (() => { try { return portraitFor(id, g.world.models, sanitizeLook(def.look), { props: def.props ?? [], lo: g.settings.quality === 'low' }); } catch { return null; } })() };
  }
  nearestTo(pos, r, filter) {
    let best = null, bd = r;
    for (const n of this.npcs) {
      if (n.away || !n.placed || (filter && !filter(n))) continue;
      const d = Math.hypot(n.pos.x - pos.x, n.pos.z - pos.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  // ------------------------------------------------------------------ per frame
  update(dt, t) {
    const g = this.game;
    if (!this.npcs.length) return;
    const land = g.mode === 'land'; this.hideTags = !land && !this.ceremony;
    const player = g.walker.pos, busy = g.dialogue.isOpen || g.panels.isOpen || g.creatorOpen;
    if (land && !busy) {
      // Midnight rolls the in-game day over.
      const h = g.cond.hour;
      if (this.lastHour != null && h < this.lastHour - 12) this.bumpDay();
      this.lastHour = h;
      if (g.cond.time !== this.timeKey) this.applyTime(false);
    }
    const env = { world: g.world, player, t };
    for (const n of this.npcs) n.update(dt, t, env);
    this.birds?.update(dt, t, player, land);
    if (!land) { this.near = null; document.body.classList.remove('npc-near'); return; }
    // Who is in talking range?
    const near = busy ? null : this.nearestTo(player, g.touch ? TALK_RANGE + 0.6 : TALK_RANGE, n => n.phase !== 'approach' || n.dist < TALK_RANGE);
    if (near !== this.near) { this.near = near; document.body.classList.toggle('npc-near', !!near); }
    this.markerT -= dt;
    if (this.markerT <= 0) { this.markerT = 1.5; this.refreshMarkers(); }
    // Greetings: someone you walk up to says hello by name, now and then.
    if (!busy && this.greetDelay > 0) this.greetDelay -= dt;
    if (!busy && !(this.greetDelay > 0)) {
      for (const n of this.npcs) {
        if (n.away || n.dist > GREET_RANGE || (this.greeted[n.id] && t - this.greeted[n.id] < GREET_COOLDOWN)) continue;
        this.greeted[n.id] = t; this.greetDelay = 1.3;
        const list = n.def.react?.greet ?? REACT_FALLBACK.greet;
        n.say(fmt(list[Math.floor(Math.random() * list.length)], nameOf(this.p)), 3.2);
        break;
      }
    }
    this.guardPlatform(dt);
  }

  /** NPC rows can show '!' (a request on offer) or a tick (something to hand in). */
  refreshMarkers() {
    const p = this.p;
    for (const n of this.npcs) {
      let kind = null;
      for (const t of n.def.trades) {
        const st = tradeStatus(p, t);
        if (st === 'ready' && (t.kind === 'show' || p.npc?.accepted?.[t.id])) { kind = 'ok'; break; }
        if (st === 'new' || (st === 'ready' && t.kind === 'quiz')) kind = kind ?? '!';
      }
      n.setMarker(kind);
    }
    document.body.classList.toggle('quest-ready', questLog(p).ready.length > 0);
  }

  /** "Press E to talk to Mitra" (or '' when nobody is close). */
  promptText() { return this.near ? `Press <kbd>E</kbd> to talk to ${esc(this.near.def.name)}` : ''; }

  async talkNearest() {
    const g = this.game, n = this.near;
    if (!n || g.dialogue.isOpen || g.panels.isOpen || g.mode !== 'land') return;
    if (['bite', 'fight', 'landed', 'charge', 'flying'].includes(g.fishing.state)) { g.toast('Land or lose this fish first, then chat.', 'warn'); return; }
    await this.talk.run(n);
    this.refreshMarkers();
    if (this.ceremonyPending) { const kind = this.ceremonyPending; this.ceremonyPending = null; g.runCeremony(kind); }   // Bev: "start the ceremony" 
  }

  // ------------------------------------------------------------------ reactions
  /** A fish has just been kept or released: nearby people react. info = { id, length, keep, legal, kind, reason }. */
  onCatch(info) {
    const p = this.p, who = this.nearestTo(this.game.walker.pos, REACT_RANGE);
    if (!who) return;
    const R = who.def.react ?? {};
    let text = null;
    if (info.keep && !info.legal) text = (R.illegal?.[info.kind] ?? REACT_FALLBACK.illegal[info.kind] ?? REACT_FALLBACK.illegal.undersize);
    else if (info.legal && bigCatch(info.id, info.length)) { const l = R.cheer ?? REACT_FALLBACK.cheer; text = l[Math.floor(Math.random() * l.length)]; }
    if (!text) return;
    const line = fmt(text, nameOf(p));
    who.say(line, 5.5);
    this.game.toast(`${who.def.name}: "${line}"`, info.keep && !info.legal ? 'warn' : 'good');
  }

  // ------------------------------------------------------------------ the lifeguard and the rock platform
  /** Swell of 2.5 m or more: the lifeguard warns you off the rock platform; if you stay on it, the Steward rating takes a safety mark. */
  guardPlatform(dt) {
    const g = this.game, eco = g.eco, hz = eco.hazard;
    // Bellambi: Sione and the rock platform. Belmore Basin: the co-op fisher (or a plain warning when she is away) and the breakwall (eco.hazard).
    const who = this.siteId === 'rocky' ? this.byId.sione : hz ? this.byId[hz.warner] ?? null : null;
    if (this.siteId !== 'rocky' && !hz) return;
    if (this.siteId === 'rocky' && !who) return;
    const pos = g.walker.pos, swell = g.cond.swell, limit = hz?.swell ?? SWELL_LIMIT;
    const onPlat = hz ? hz.at(pos.x, pos.z) : platformMask(pos.x, pos.z) > 0.35, big = swell >= limit;
    this.penaltyCool = Math.max(0, this.penaltyCool - dt);
    if (!(onPlat && big)) { this.platT = 0; if (!onPlat) this.offT = (this.offT ?? 0) + dt; if (this.offT > 12) this.warned = false; return; }
    this.offT = 0; this.platT += dt;
    const W = who?.def.warn ?? hz?.warnText, line = k => fmt(W[k].replace('{swell}', swell.toFixed(1)), nameOf(this.p));
    const name = who?.def.name ?? 'Harbour notice';
    if (!this.warned) {
      this.warned = true; this.warnT = this.platT;
      const text = line('swell'); who?.say(text, 7); g.toast(`${name}: "${text}"`, 'warn'); g.audio.play('warn');
    } else if (this.platT - this.warnT > 7 && this.penaltyCool <= 0) {
      const st = this.p.steward; st.safety = (st.safety ?? 0) + 1; this.penaltyCool = 25; this.warnT = this.platT;
      const text = line('ignored'); who?.say(text, 7); g.toast(`${name}: "${text}" (Steward rating down: safety mark ${st.safety})`, 'warn'); g.audio.play('wrong');
      g.persist(); g.updateStats();
    }
  }

  // ------------------------------------------------------------------ small helpers for npc.js
  splash(pos, n) { this.game.fx.splash?.(pos, n); }
  audioAt(name, pos) { if (Math.hypot(pos.x - this.game.walker.pos.x, pos.z - this.game.walker.pos.z) < 30) this.game.audio.play(name); }
}
export { ensureNpc };
