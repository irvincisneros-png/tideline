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

export async function launch({ url = process.env.URL ?? 'http://localhost:8451/', query = '', outDir = 'playtest-shots', width = 1280, height = 800, headless = !process.env.HEADED, mobile = false } = {}) {
  mkdirSync(outDir, { recursive: true });
  const browser = await pw.chromium.launch({ headless, channel: process.env.PW_CHANNEL ?? 'chrome', args: [process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  // mobile: emulate a phone held sideways (touch events, coarse pointer, high-DPI screen).
  const page = await browser.newPage(mobile ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width, height } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e.stack ?? e)));
  await page.goto(url + (query ? `?${query}` : ''));
  await page.waitForFunction(() => window.__game && (window.__game.mode === 'menu' || window.__game.mode === 'land'), null, { timeout: 120000 });
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
          walker: { pos: w.pos.toArray().map(v => +v.toFixed(1)), yaw: +w.yaw.toFixed(2), waterDepth: +w.waterDepth.toFixed(2) },
          fishing: { state: f.state, spot: f.spot, dist: +f.dist.toFixed(1), bar: f.bar.active ? { meter: +f.bar.meter.toFixed(2), fish: f.bar.fy, zone: f.bar.zy, zv: f.bar.zv, profile: f.bar.profile } : null },
          journal: Object.keys(g.progress.journal),
        };
      });
    },
    /** Rotate the walker's view directly (pointer lock is unavailable in headless browsers). */
    async look(yawDelta, pitchDelta = 0) { await page.evaluate(([y, p]) => { const d = window.__game.walker; d.yaw += y; d.pitch = Math.max(-1.45, Math.min(1.45, d.pitch + p)); }, [yawDelta, pitchDelta]); },
    /** Simulate a click in the 3D view (as if the mouse were locked): opens the species card of what you look at. */
    async clickView(button = 0) { await page.evaluate(b => { const g = window.__game; g.input.locked = true; g.input.clicks.push({ button: b }); }, button); await page.waitForTimeout(150); },
    async close() { await browser.close(); },
  };
  return api;
}
function keyName(code) {
  const map = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e', KeyF: 'f', KeyJ: 'j', KeyR: 'r', KeyT: 't', KeyP: 'p', KeyC: 'c', Space: ' ', ShiftLeft: 'Shift', Escape: 'Escape' };
  return map[code] ?? code;
}
