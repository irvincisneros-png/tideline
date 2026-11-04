// Real-places playtest: for each site that is modelled on a real place (Bellambi, Belmore Basin, Windang, the Five Islands) save the in-game map (This place tab),
// a few in-world views from different cameras and a high overhead shot (north up, to compare with the satellite view), into playtest-shots/realsites/.
// Usage: node tests/playtest/realsites.mjs [rocky,harbour,seagrass,reef] [shots: map,views,over]   (dev server on :8451; one playtest at a time)
import { launch } from './harness.mjs';
const sites = (process.argv[2] ?? 'rocky,harbour,seagrass,reef').split(','), parts = (process.argv[3] ?? 'map,views,over').split(',');
const OUT = 'playtest-shots/realsites';
// where to stand and look: { x, z, yaw (camera: 0 looks toward -z), pitch, zoom }. Overhead: the world point under the camera, its height, and the world direction that is "north" (up the picture).
const VIEWS = {
  rocky: {
    views: [['tower-beach', 'tower', { yawToSea: true, pitch: 0.55, zoom: 9 }], ['cove-ramp', 'ramp', { yawToSea: true, pitch: 0.6, zoom: 11 }], ['platform-tip', 'platform', { yawToSea: true, pitch: 0.7, zoom: 12 }], ['rockpool', 'rockpool', { yawToSea: true, pitch: 0.8, zoom: 12 }]],
    over: { at: [12, -8], h: 330, up: [-1, 0, 0] },
    close: [['platform', 0, -46, 85], ['rockpool', -34, 26, 55], ['cove', 2, -10, 110], ['ramp', 0, -21, 38]],
  },
  harbour: {
    views: [['wharf', 'wharf', { pitch: 0.7, zoom: 12 }], ['basin-mouth', 'basin', { pitch: 0.6, zoom: 11 }], ['breakwater', 'breakwater', { pitch: 0.55, zoom: 10 }], ['cove-beach', 'cove', { pitch: 0.6, zoom: 11 }]],
    over: { at: [-5, -10], h: 290, up: [0, 0, -1] },
    close: [['basin', 5, -12, 110], ['lighthouse', -25, -78, 60], ['cove', -95, 30, 100]],
  },
  seagrass: {
    views: [['jetty', 'jetty', { pitch: 0.6, zoom: 11 }], ['flats', 'flats', { pitch: 0.7, zoom: 12 }], ['shore', 'shore', { pitch: 0.55, zoom: 10 }], ['south', 'south', { pitch: 0.6, zoom: 11 }]],
    over: { at: [10, -20], h: 330, up: [1, 0, 0] },
    close: [['bar', 80, -10, 90], ['jetty', 16, 20, 80], ['south', -50, -20, 100]],
  },
  reef: {
    views: [['islands', 'boat', { pitch: 0.46, zoom: 9 }], ['west-port-kembla', 'west', { pitch: 0.46, zoom: 9 }], ['north', 'north', { pitch: 0.5, zoom: 10 }]],
    over: { at: [-600, -250], h: 1500, up: [0, 0, -1] },
  },
};
// named standing points per site, computed inside the page from the site's own modules: { key: { x, z, seaYaw } } (seaYaw: the camera yaw that looks at the water)
const POINTS = {
  rocky: async () => {
    const B = await import('/src/world/bellambi.js'), at = (s, off) => { const b = B.beachAt(s, off); return { x: b.x, z: b.z, seaYaw: Math.atan2(-b.nx, -b.nz) }; };
    return { tower: at(B.S_TOWER, 6), ramp: at(B.S_RAMP, 5), platform: at(B.S_TIP, -5), rockpool: at(B.S_POOL, 1) };
  },
  seagrass: async () => {
    const S = await import('/src/ecosystems/seagrass.js'), at = (x, z, yaw = 0) => ({ x, z, yaw });
    return { jetty: at(S.JETTY.x, S.JETTY.z0 - 12), flats: at(30, S.shoreZ(30) - 4), shore: at(-8, S.shoreZ(-8) + 6), south: at(-42, S.shoreZ(-42) + 4, 0) };
  },
  harbour: async () => {
    const B = await import('/src/world/belmore.js'), at = (x, z, yaw) => ({ x, z, yaw }), q = (a, b, yaw) => { const [x, z] = B.T(a, b); return at(x, z, yaw); };
    const p = B.CREST.at(70), c = B.fromPx(180, 418);
    return { wharf: q(12, 36, B.QROT), basin: q(40, 41, B.QROT + 0.9), breakwater: at(p.x, p.z, Math.atan2(-p.tx, -p.tz)), cove: at(c[0], c[1] - 3, Math.PI) };
  },
  reef: async () => { const R = await import('/src/ecosystems/reef.js'); const b = { x: R.state.x, z: R.state.z + 1.2 }; return { boat: { ...b, yaw: 0.5 }, west: { ...b, yaw: 1.45 }, north: { ...b, yaw: 0 } }; },
};
let fail = 0;
for (const site of sites) {
  const t = await launch({ query: `eco=${site}&quality=${process.env.Q ?? 'high'}&play=1&time=day&swell=1&tide=rising&season=summer`, outDir: OUT, width: 1280, height: 800 });
  await t.wait(2500);
  await t.page.evaluate(() => { window.__game.panels.close?.(true); document.querySelector('#toast').innerHTML = ''; });
  await t.wait(300);
  if (parts.includes('map')) {
    await t.tap('KeyM'); await t.wait(1200);
    if (!await t.page.evaluate(() => window.__game.mapOpen)) { console.log('FAIL map did not open', site); fail++; }
    await t.page.evaluate(() => { document.querySelector('#mt-site')?.click(); }); await t.wait(500);
    await t.page.screenshot({ path: `${OUT}/${site}-map.png` });
    if (site === 'seagrass') { await t.page.click('#mt-region'); await t.wait(500); await t.page.screenshot({ path: `${OUT}/illawarra-coast-map.png` }); await t.page.click('#mt-site'); await t.wait(300); }   // the coast tab is the same at every site: once
    await t.tap('KeyM'); await t.wait(400);
  }
  if (parts.includes('views')) {
    const pts = await t.page.evaluate(POINTS[site]);
    for (const [name, key, o] of VIEWS[site].views) {
      const p = pts[key];
      if (!p) { console.log('no point', site, key); continue; }
      const yaw = o.yawToSea ? p.seaYaw : (o.yaw ?? p.yaw ?? 0);
      await t.page.evaluate(([x, z, yaw, pitch, zoom]) => {
        const g = window.__game, w = g.walker; w.pos.set(x, g.world.walkAt(x, z), z); w.vel.set(0, 0, 0); w.viewYaw = yaw; w.heading = Math.PI + yaw;
        g.rig.yaw = yaw; g.rig.pitch = g.rig.pitchGoal = pitch; g.rig.zoom = g.rig.dist = zoom; g.rig.focus.set(x, w.pos.y + 0.9, z);
      }, [p.x, p.z, yaw, o.pitch, o.zoom]);
      await t.wait(1800);
      await t.page.screenshot({ path: `${OUT}/${site}-view-${name}.png` });
    }
  }
  if (parts.includes('over')) {
    const o = VIEWS[site].over;
    await t.page.evaluate(({ at, h, up }) => {
      const g = window.__game; g.rig.update = () => {};
      const c = g.camera; c.up.set(up[0], up[1], up[2]); c.position.set(at[0], h, at[1]); c.fov = 42; c.updateProjectionMatrix(); c.lookAt(at[0], 0, at[1]);
      document.querySelectorAll('#hud, .hud, #prompt, #toast').forEach(e => { e.style.visibility = 'hidden'; });
    }, o);
    await t.wait(1500);
    await t.page.screenshot({ path: `${OUT}/${site}-overhead.png` });
  }
  if (parts.includes('close')) for (const [name, x, z, h] of VIEWS[site].close ?? []) {   // closer overheads of one feature
    const o = VIEWS[site].over;
    await t.page.evaluate(({ x, z, h, up }) => {
      const g = window.__game; g.rig.update = () => {};
      const c = g.camera; c.up.set(up[0], up[1], up[2]); c.position.set(x, h, z); c.fov = 42; c.updateProjectionMatrix(); c.lookAt(x, 0, z);
      document.querySelectorAll('#hud, .hud, #prompt, #toast').forEach(e => { e.style.visibility = 'hidden'; });
    }, { x, z, h, up: o.up });
    await t.wait(1200);
    await t.page.screenshot({ path: `${OUT}/${site}-top-${name}.png` });
  }
  const errs = t.errors.filter(e => !/favicon/.test(e)); if (errs.length) { console.log('ERRORS', site, errs.slice(0, 4)); fail++; }
  await t.close();
}
console.log(fail ? `${fail} problem(s)` : 'realsites ok'); process.exit(fail ? 1 : 0);
