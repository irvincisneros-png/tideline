// Renders the share images the page's <meta> tags point at: assets/icon-180.png (apple touch icon, from assets/favicon.svg) and assets/og.png (1200x630 Open Graph card:
// a game screenshot with the logo and the tagline on a cream card). Usage: node tools/make-share-images.mjs [path/to/background.png]
import { getPlaywright } from '../tests/playtest/harness.mjs';
import { readFileSync } from 'node:fs';

const pw = getPlaywright();
const bgFile = process.argv[2] ?? 'playtest-shots/final/og-background.png';
const bg = 'data:image/png;base64,' + readFileSync(bgFile).toString('base64');
const svg = readFileSync('assets/favicon.svg', 'utf8');
const browser = await pw.chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 180, height: 180 } });
await page.setContent(`<body style="margin:0;background:#fff3d2"><div style="width:180px;height:180px">${svg.replace('<svg ', '<svg width="180" height="180" ')}</div></body>`);
await page.screenshot({ path: 'assets/icon-180.png', clip: { x: 0, y: 0, width: 180, height: 180 } });
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<body style="margin:0;width:1200px;height:630px;position:relative;overflow:hidden;font-family:'Arial Rounded MT Bold','Trebuchet MS',system-ui,sans-serif">
  <img src="${bg}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
  <div style="position:absolute;right:36px;bottom:36px;width:540px;background:#fff3d2;border:6px solid #1f5f6b;border-radius:34px;padding:26px 34px 28px;box-shadow:0 10px 0 rgba(31,95,107,.45)">
    <div style="font-size:104px;line-height:1;font-weight:800;color:#1f5f6b;letter-spacing:.01em">Tide<span style="color:#ff8a5c">Line</span></div>
    <div style="margin-top:14px;font-size:34px;line-height:1.2;font-weight:800;color:#c2570a">Gotta catch ’em all… and release the small.</div>
    <div style="margin-top:14px;font-size:23px;line-height:1.3;font-weight:700;color:#14434d">A cosy 3D fishing game on the Illawarra coast for NSW Aquatic Technology, Years 7–10.</div>
  </div></body>`);
await page.screenshot({ path: 'assets/og.png' });
await browser.close();
console.log('wrote assets/icon-180.png and assets/og.png');
