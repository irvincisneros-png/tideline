// Cast and reel animation playtest: a close three-quarter camera on the angler through a wind-up, the snap, the follow-through, then working a lure
// and (if a fish takes it) the fight. Probes the rig: the float rides the tip until release, the rod whips back through the snap, the torso winds
// and unwinds, and the left hand sits on the reel knob while winding. Frames go to playtest-shots/cast-anim.
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/cast-anim.mjs [high|low]
import { launch } from './harness.mjs';
const quality = process.argv[2] ?? 'high';
const t = await launch({ query: `eco=seagrass&quality=${quality}&play=1&time=day&tide=rising&season=summer&camyaw=${process.argv[3] ?? ''}`, outDir: `playtest-shots/cast-anim/${quality}${process.argv[3] ? '-' + process.argv[3] : ''}`, width: 1280, height: 720 });
const log = [], fail = msg => { log.push(['FAIL', msg]); ok = false; };
let ok = true;
const ev = f => t.page.evaluate(f);
const probe = () => ev(() => {
  const g = window.__game, a = g.angler, f = g.fishing, J = a.joints, T = window.THREE_ || null;
  const w = o => { const v = o.getWorldPosition(new o.position.constructor()); return v; };
  a.root.updateWorldMatrix(true, true);
  const knob = w(a.knob), hand = J.elbowL.localToWorld(new a.ikT.constructor(0, -0.3, 0)), tip = w(a.rodTip);
  return { state: f.state, castT: +a.castT.toFixed(2), phi: +a.rodPhi.toFixed(2), twist: +J.torso.rotation.y.toFixed(2), lean: +J.torso.rotation.x.toFixed(2), step: +a.stepS.toFixed(2),
    whip: +a.whip.x.toFixed(3), bend: +a.bend.toFixed(2), ikW: +a.ikW.toFixed(2), handKnob: +hand.distanceTo(knob).toFixed(3), floatTip: f.float.visible ? +f.float.position.distanceTo(tip).toFixed(2) : null,
    headY: +J.head.rotation.y.toFixed(2), hat: +J.headTop.rotation.x.toFixed(3), crank: +a.crankPivot.rotation.x.toFixed(2) };
});
await t.wait(1500);
await ev(() => { const w = window.__game.walker; w.heading = Math.PI; });
for (let i = 0; i < 80; i++) { await t.hold('KeyW', 250); if ((await t.state()).walker.waterDepth > 0.15) break; }
await ev(() => { const g = window.__game; g.gear.rig = 'softplastic'; g.progress.lureTip = true; });
await t.tap('KeyR'); await t.wait(400);
// Close three-quarter camera from the angler's left-front, then freeze the rig so it stays there.
await ev(() => {
  const g = window.__game, w = g.walker, h = w.heading, cam = g.camera;
  g.rig.update = () => {};   // freeze the follow camera and place it low, 3.4 m off the angler's left-front shoulder
  const ax = w.pos.x, az = w.pos.z, yaw = h + (+new URLSearchParams(location.search).get("camyaw") || 2.3);
  cam.position.set(ax + Math.sin(yaw) * 3.0, w.pos.y + 1.4, az + Math.cos(yaw) * 3.0);
  cam.lookAt(ax + Math.sin(h) * 0.6, w.pos.y + 1.0, az + Math.cos(h) * 0.6);
  for (const e of document.querySelectorAll('#prompt, #toast, #hud, .hud')) e.style.visibility = 'hidden';
});
await t.wait(300);
await t.shot('ready');
// Wind up.
await t.page.keyboard.down(' '); await t.wait(1150);
const wound = await probe(); await t.shot('wound-up');
if (!(wound.phi > 1.5)) fail(`wind-up did not take the rod back (phi ${wound.phi})`);
if (!(wound.twist < -0.15)) fail(`wind-up did not wind the torso (twist ${wound.twist})`);
// Release: sample the snap fast.
await t.page.keyboard.up(' ');
const frames = [];
for (let i = 0; i < 16; i++) { frames.push(await probe()); if ([1, 3, 5, 8, 12, 15].includes(i)) await t.shot(`cast-${String(i).padStart(2, '0')}`); await t.wait(45); }
const maxHat = Math.max(...frames.map(f => Math.abs(f.hat))), minWhip = Math.min(...frames.map(f => f.whip)), maxTwist = Math.max(...frames.map(f => f.twist)), maxStep = Math.max(...frames.map(f => f.step));
const held = frames.filter(f => f.castT < 0.18 && f.floatTip != null), flew = frames.filter(f => f.castT > 0.4 && f.floatTip != null);
log.push(['cast', JSON.stringify({ minWhip, maxHat, maxTwist, maxStep, heldFrames: held.length, heldMaxGap: Math.max(0, ...held.map(f => f.floatTip)), flewMin: Math.min(9, ...flew.map(f => f.floatTip)) })]);
if (!(minWhip < -0.12)) fail(`the rod did not whip back through the snap (min whip ${minWhip})`);
if (!(maxTwist > 0.08)) fail(`the torso did not unwind past centre (max twist ${maxTwist})`);
if (!(maxStep > 0.5)) fail(`no lunge (max step ${maxStep})`);
if (!(maxHat > 0.02)) fail(`the hat did not lag the head through the snap (max ${maxHat})`);
if (held.length && Math.max(...held.map(f => f.floatTip)) > 0.35) fail('the rig left the tip before release');
if (flew.length && Math.min(...flew.map(f => f.floatTip)) < 1) fail('the rig did not fly after release');
await t.wait(900); await t.shot('settled');
// Work the lure: hold to reel, check the hand is on the knob and the crank turns.
const before = await probe(); await t.page.keyboard.down(' '); await t.wait(900); const mid = await probe(); await t.shot('reeling'); await t.wait(500); const after = await probe(); await t.page.keyboard.up(' ');
log.push(['reel', JSON.stringify({ state: mid.state, ikW: mid.ikW, handKnob: mid.handKnob, crankTurned: +(after.crank - mid.crank).toFixed(2), bend: mid.bend, headY: mid.headY })]);
if (mid.state === 'retrieve') {
  if (!(mid.ikW > 0.9)) fail(`reel IK not blended in (${mid.ikW})`);
  if (!(mid.handKnob < 0.09)) fail(`left hand is ${mid.handKnob} m from the reel knob`);
  if (Math.abs(after.crank - mid.crank) < 0.5) fail('the crank did not turn while winding');
} else log.push(['note', `not in retrieve after the cast: ${mid.state}`]);
await t.wait(400); await t.shot('paused');
// A twitch-pause rhythm for a few seconds: if a fish strikes, strike back and shoot the fight.
let fought = false;
for (let i = 0; i < 14 && !fought; i++) {
  await t.page.keyboard.down(' '); await t.wait(90); await t.page.keyboard.up(' '); await t.wait(1300);
  const p = await probe();
  if (p.state === 'bite') { await t.tap('Space'); await t.wait(500); await t.shot('strike'); await t.page.keyboard.down(' '); await t.wait(700); const fp = await probe(); await t.shot('fight-reeling'); await t.page.keyboard.up(' '); log.push(['fight', JSON.stringify(fp)]); if (fp.state === 'fight' && fp.handKnob > 0.1) fail(`fight: hand ${fp.handKnob} m off the knob`); fought = true; }
  if (p.state === 'ready') break;
}
if (!fought) log.push(['note', 'no strike came during the short retrieve (fine: the fight pose was not checked)']);
const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) fail('console: ' + errs.slice(0, 3).join(' | '));
for (const l of log) console.log(...l);
console.log(ok ? 'cast-anim ok' : 'cast-anim FAILED');
await t.close(); process.exit(ok ? 0 : 1);
