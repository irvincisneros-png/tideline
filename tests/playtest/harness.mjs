// Play-test harness: real Chromium, real keyboard/mouse input, screenshots + game-state probes.
// Usage (from repo root, with the dev server running on :8451):
//   URL=http://localhost:8451/ node tests/playtest/fishing.mjs
// Playwright is borrowed from a sibling repo's node_modules (no install needed here).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const candidates = [
  process.env.PLAYWRIGHT_PATH,
  path.resolve(import.meta.dirname, '../../../LifeLens/node_modules/playwright'),
  path.resolve(import.meta.dirname, '../../../year7-cells-lab/node_modules/playwright'),
  'playwright',
].filter(Boolean);
let pw;
for (const c of candidates) { try { pw = require(c); break; } catch { /* next */ } }
if (!pw) throw new Error('Playwright not found. Set PLAYWRIGHT_PATH to a node_modules/playwright folder.');

export const getPlaywright = () => pw;
export async function launch({ url = process.env.URL ?? 'http://localhost:8451/', query = '', outDir = 'playtest-shots', width = 1280, height = 800, headless = !process.env.HEADED, mobile = false, phone = null, onPage = null, dpr = 1, path: pagePath = '' } = {}) {
  mkdirSync(outDir, { recursive: true });
  const browser = await pw.chromium.launch({ headless, channel: process.env.PW_CHANNEL ?? 'chrome', args: [process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  // mobile: emulate a phone held sideways (touch events, coarse pointer, high-DPI screen).
  const page = await browser.newPage(phone ? { viewport: { width: phone.w, height: phone.h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : mobile ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width, height }, deviceScaleFactor: dpr });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e.stack ?? e)));
  onPage?.(page);
  await page.goto(url + pagePath + (query ? `?${query}` : ''));
  await page.waitForFunction(() => window.__game && ['menu', 'land', 'ceremony'].includes(window.__game.mode), null, { timeout: 120000 });
  let n = 0;
  const api = {
    page, browser, errors,
    /** Save a screenshot; returns the path. */
    async shot(name) { const p = path.join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`); await page.screenshot({ path: p }); return p; },
    /** Hold a key (KeyboardEvent.code, e.g. 'KeyW', 'Space') for ms milliseconds. */
    async hold(code, ms) { await page.keyboard.down(keyName(code)); await page.waitForTimeout(ms); await page.keyboard.up(keyName(code)); },
    async tap(code) { await page.keyboard.press(keyName(code)); },
    async wait(ms) { await page.waitForTimeout(ms); },
    async click(selector) { await page.click(selector); },
    /** Snapshot of the game state (mode, position, fishing, HUD prompt, toasts). */
    async state() {
      return page.evaluate(() => {
        const g = window.__game, w = g.walker, f = g.fishing;
        return {
          mode: g.mode, fps: g.fps, panelOpen: g.panels.isOpen,
          prompt: document.querySelector('#prompt')?.textContent,
          toasts: [...document.querySelectorAll('.toast')].map(t => t.textContent),
          walker: { pos: w.pos.toArray().map(v => +v.toFixed(1)), heading: +w.heading.toFixed(2), camYaw: +g.rig.yaw.toFixed(2), waterDepth: +w.waterDepth.toFixed(2) },
          fishing: { state: f.state, spot: f.spot, dist: +f.dist.toFixed(1), bar: f.bar.active ? { meter: +f.bar.meter.toFixed(2), fish: f.bar.fy, zone: f.bar.zy, zv: f.bar.zv, profile: f.bar.profile } : null },
          journal: Object.keys(g.progress.journal),
        };
      });
    },
    /** Turn the follow camera round the angler (what Q / E / a right-drag do). */
    async look(yawDelta, pitchDelta = 0) { await page.evaluate(([y, p]) => { const r = window.__game.rig; r.yaw += y; r.pitch = Math.max(0.85, Math.min(1.25, r.pitch + p)); }, [yawDelta, pitchDelta]); },
    /** Move the angler somewhere (feet position, optional facing and camera yaw) and let the camera settle: for screenshots. */
    async teleport(x, z, { heading, camYaw, pitch, zoom } = {}) {
      await page.evaluate(([x, z, h, cy, pi, zm]) => {
        const g = window.__game, w = g.walker; w.pos.set(x, g.world.walkAt(x, z), z); w.vel.set(0, 0, 0);
        if (h != null) w.heading = h; if (cy != null) g.rig.yaw = cy; if (pi != null) g.rig.pitch = pi; if (zm != null) g.rig.zoom = zm;
        g.rig.focus.set(x, w.pos.y + 0.9, z);
      }, [x, z, heading, camYaw, pitch, zoom]);
      await page.waitForTimeout(900);
    },
    /** Click the 3D view at a screen position (opens the species card of an animal there). */
    async clickAt(x, y) { await page.mouse.click(x, y); await page.waitForTimeout(150); },
    async close() { await browser.close(); },
  };
  return api;
}
function keyName(code) {
  const map = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e', KeyF: 'f', KeyJ: 'j', KeyR: 'r', KeyT: 't', KeyP: 'p', KeyC: 'c', Space: ' ', ShiftLeft: 'Shift', Escape: 'Escape' };
  return map[code] ?? code;
}
