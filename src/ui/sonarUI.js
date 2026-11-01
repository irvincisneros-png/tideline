// The fish finder screen (HUD panel) for the offshore reef: a scrolling sonar picture (src/fishing/sonar.js draws nothing: it only makes the pings; this paints them), depth and bottom readouts, the anchor button and a
// "how it works" card. Newest ping at the right, the places the boat has been slide off to the left (dataset E1). Nothing here touches the game state except through the callbacks.
import { HOW_IT_WORKS, MAX_RANGE, BOTTOM_LABEL, TAN_BEAM } from '../fishing/sonar.js';
import { esc } from './panels.js';

const COL_W = 1;            // pixels per ping (the picture scrolls about 5 px a second)
const PALETTE = { water0: '#0c3d57', water1: '#082a45', grid: 'rgba(160,220,240,0.16)', text: '#bfe6f2', hard: '#f0a03a', rubble: '#c98a4a', sand: '#d8c28a', fish: '#ffe36a', fishEdge: '#ff9a3a', dots: '#9fe8ff' };

/** The explanation card: a small diagram (sound pulse, echoes, an arch) and the plain-English steps. */
export function howItWorksHTML() {
  const H = HOW_IT_WORKS;
  const svg = `<svg viewBox="0 0 330 150" class="sn-diagram" role="img" aria-label="A boat sends a cone of sound down; it echoes off a fish and the bottom">
    <rect width="330" height="150" rx="10" fill="#0c3d57"/>
    <rect x="6" y="6" width="150" height="138" rx="8" fill="#0a3350"/>
    <path d="M18 30 h96 l8 -8 l8 8 h6" stroke="#fff4de" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M60 22 l6 -10 h18 l4 10z" fill="#fff4de"/>
    <path d="M76 36 L40 120 H112 Z" fill="rgba(160,230,255,0.18)" stroke="#8fe0ff" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="M30 124 q20 -12 40 -4 t42 -2 t30 8 v18 h-112z" fill="#c98a4a"/>
    <ellipse cx="82" cy="86" rx="9" ry="4.5" fill="#ffe36a" stroke="#ff9a3a" stroke-width="1.4"/>
    <path d="M82 40 q-5 14 0 40 M82 40 q5 14 0 40" stroke="#bfe6f2" stroke-width="1.3" fill="none"/>
    <path d="M76 120 q4 -10 0 -30" stroke="#bfe6f2" stroke-width="1.3" fill="none" stroke-dasharray="3 3"/>
    <text x="18" y="16" font-size="9" fill="#bfe6f2" font-weight="700">sound pulse down</text><text x="94" y="92" font-size="9" fill="#ffe36a" font-weight="700">fish (gas-filled swim bladder)</text><text x="38" y="141" font-size="9" fill="#ffd6a0" font-weight="700">hard bottom</text>
    <path d="M168 120 H322" stroke="#f0a03a" stroke-width="6"/><path d="M168 123 q40 -3 80 2 t74 0" stroke="#c98a4a" stroke-width="3" fill="none" opacity=".7"/>
    <path d="M214 82 q16 -22 36 0" stroke="#ffe36a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M283 76 q14 -16 28 0" stroke="#ffe36a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
    ${Array.from({ length: 26 }, (_, i) => `<circle cx="${182 + (i * 37) % 56}" cy="${52 + (i * 53) % 24}" r="1.4" fill="#9fe8ff"/>`).join('')}
    <text x="170" y="20" font-size="9" fill="#bfe6f2" font-weight="700">the screen scrolls: newest on the right</text><text x="170" y="34" font-size="9" fill="#9fe8ff" font-weight="700">dots: baitfish</text><text x="204" y="112" font-size="9" fill="#ffe36a" font-weight="700">arches: single fish</text><text x="200" y="138" font-size="9" fill="#ffd6a0" font-weight="700">thick line: the bottom</text>
  </svg>`;
  return `<div class="sn-help"><h2>🔊 ${esc(H.title)}</h2>
    ${svg}
    <ol>${H.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <h3>Reading the screen</h3>
    <ul class="sn-read">${H.read.map(([a, b]) => `<li><b>${esc(a)}</b> ${esc(b)}</li>`).join('')}</ul>
    <div class="rule-card"><b>A harvesting technology</b>${esc(H.tech)}</div>
    <p class="muted">${esc(H.tip)}</p>
    <p><button class="btn primary" id="sn-ok">Got it</button></p></div>`;
}

export class SonarPanel {
  /** opts: { onHelp, onAnchor }. Creates the panel inside #hud (hidden until show()). */
  constructor({ onHelp, onAnchor } = {}) {
    this.root = document.createElement('div'); this.root.id = 'sonar'; this.root.className = 'sonar hidden';
    this.root.innerHTML = `<div class="sonar-head"><b>🔊 Fish finder</b><span id="sn-depth" class="sn-depth">– m</span><button id="sn-help" class="btn small" aria-label="How a fish finder works">?</button></div>
      <canvas id="sn-cv" width="300" height="140" aria-label="Fish finder screen"></canvas>
      <div class="sonar-foot"><span id="sn-bottom" class="sn-bottom">–</span><span id="sn-marks" class="sn-marks"></span></div>
      <div class="sonar-foot"><span id="sn-boat" class="sn-boat">Drifting</span><button id="sn-anchor" class="btn small" aria-pressed="false" aria-label="Anchor or lift the anchor (B)">⚓ Anchor <kbd>B</kbd></button></div>`;
    (document.getElementById('hud') ?? document.body).appendChild(this.root);
    this.cv = this.root.querySelector('#sn-cv'); this.g = this.cv.getContext('2d'); this.W = this.cv.width; this.H = this.cv.height;
    this.root.querySelector('#sn-help').onclick = () => onHelp?.();
    this.root.querySelector('#sn-anchor').onclick = () => onAnchor?.();
    this.cols = 0; this.last = null;
    this.clear();
  }
  show(on = true) { this.root.classList.toggle('hidden', !on); }
  dispose() { this.root.remove(); }
  yOf(range) { return Math.min(this.H - 1, (range / MAX_RANGE) * this.H); }
  clear() {
    const g = this.g, gr = g.createLinearGradient(0, 0, 0, this.H); gr.addColorStop(0, PALETTE.water0); gr.addColorStop(1, PALETTE.water1);
    g.fillStyle = gr; g.fillRect(0, 0, this.W, this.H); this.grid();
  }
  grid() {
    const g = this.g; g.strokeStyle = PALETTE.grid; g.lineWidth = 1; g.fillStyle = PALETTE.text; g.font = '700 10px system-ui, sans-serif';
    for (let d = 5; d < MAX_RANGE; d += 5) { const y = Math.round(this.yOf(d)) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(this.W, y); g.stroke(); g.fillText(`${d}`, this.W - 18, y - 2); }
  }
  /** Add one ping: scroll the picture left by one column and paint the new column at the right edge. */
  push(p) {
    const g = this.g, W = this.W, H = this.H, x = W - COL_W - 20;
    this.last = p; this.cols++;
    // scroll the picture (everything left of the depth scale) one column to the left
    g.drawImage(this.cv, COL_W, 0, W - 20 - COL_W, H, 0, 0, W - 20 - COL_W, H);
    // the new column: water, then the bottom
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, PALETTE.water0); gr.addColorStop(1, PALETTE.water1);
    g.fillStyle = gr; g.fillRect(x, 0, COL_W, H);
    g.fillStyle = PALETTE.grid; for (let d = 5; d < MAX_RANGE; d += 5) g.fillRect(x, Math.round(this.yOf(d)), COL_W, 1);   // depth lines every 5 m
    const by = this.yOf(p.depth), col = PALETTE[p.bottom === 'reef' ? 'hard' : p.bottom === 'rubble' ? 'rubble' : 'sand'];
    const band = p.bottom === 'sand' ? 7 : p.bottom === 'rubble' ? 12 : 18;                                                 // a strong echo band just under the bottom line (thicker over hard ground), then a fainter sea floor
    g.fillStyle = col; g.globalAlpha = p.bottom === 'sand' ? 0.6 : 0.95; g.fillRect(x, by, COL_W, Math.min(band, H - by));
    g.globalAlpha = p.bottom === 'sand' ? 0.16 : 0.3; g.fillRect(x, by + band, COL_W, Math.max(0, H - by - band)); g.globalAlpha = 1;
    g.fillStyle = '#fff6c8'; g.fillRect(x, by - (p.bottom === 'sand' ? 1 : 3), COL_W, p.bottom === 'sand' ? 2 : 4);              // the bottom line: thick over hard ground, thin over sand
    if (p.second && by * 2 < H) { g.globalAlpha = 0.45; g.fillStyle = '#ffd89a'; g.fillRect(x, by * 2, COL_W, 2); g.globalAlpha = 1; }   // the second echo (sound bounces bottom - surface - bottom)
    for (const r of p.dots) { g.fillStyle = PALETTE.dots; g.fillRect(x, this.yOf(r), 1, 1); }                                   // baitfish: a cloud of dots
    for (const f of p.fish) {                                                                                                  // a fish: a bright mark, thicker when it is closer to straight below
      if (f.range >= p.depth - 0.25) continue;                                                                                 // an echo from beyond the bottom echo is lost in the sea floor's own echo
      const y = this.yOf(f.range), s = 1 + Math.round(f.strength * 2);
      g.fillStyle = PALETTE.fishEdge; g.fillRect(x - 1, y - s - 1, COL_W + 2, 2 * s + 2); g.fillStyle = PALETTE.fish; g.fillRect(x, y - s, COL_W, 2 * s);
    }
    // the scale and the grid lines are painted over the newest column every time
    g.clearRect(W - 20, 0, 20, H); g.fillStyle = '#082a45'; g.fillRect(W - 20, 0, 20, H); this.scale();
  }
  scale() {
    const g = this.g; g.strokeStyle = PALETTE.grid; g.fillStyle = PALETTE.text; g.font = '700 10px system-ui, sans-serif';
    for (let d = 5; d < MAX_RANGE; d += 5) { const y = Math.round(this.yOf(d)) + 0.5; g.beginPath(); g.moveTo(this.W - 20, y); g.lineTo(this.W, y); g.stroke(); g.fillText(`${d}`, this.W - 17, y - 2); }
    g.fillText('m', this.W - 12, 10);
  }
  /** Update the readouts: depth, bottom, marks under the boat, and the drift / anchor line. */
  readout({ ping, anchored, speed }) {
    const q = s => this.root.querySelector(s);
    if (ping) {
      q('#sn-depth').textContent = `${ping.depth.toFixed(1)} m`;
      q('#sn-bottom').textContent = BOTTOM_LABEL[ping.bottom];
      const n = ping.fish.length, u = ping.fish.filter(f => f.under).length;
      q('#sn-marks').textContent = n ? `${n} mark${n > 1 ? 's' : ''}${u ? ' under the boat' : ''}` : ping.school > 0.2 ? 'baitfish' : 'clear';
    }
    q('#sn-boat').textContent = anchored ? '⚓ Anchored' : `Drifting ${speed.toFixed(1)} m/s`;
    const b = q('#sn-anchor'); b.setAttribute('aria-pressed', anchored); b.classList.toggle('on', anchored);
  }
  get beam() { return TAN_BEAM; }
}
