// Modal panels. Each opener renders into #modal-body; game pauses look controls while open.
import { TIERS } from '../core/settings.js';

const $ = (s, r = document) => r.querySelector(s);
export const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Panels {
  constructor(game) {
    this.game = game;
    this.modal = $('#modal'); this.body = $('#modal-body');
    $('#modal-close').addEventListener('click', () => this.close());
    this.modal.addEventListener('mousedown', e => { if (e.target === this.modal) this.close(); });
    addEventListener('keydown', e => { if (e.code === 'Escape' && this.isOpen) { e.preventDefault(); this.close(); } });
    this.onClose = null;
  }
  get isOpen() { return !this.modal.classList.contains('hidden'); }
  /** opts.locked: a step in the landing flow (key, measure, decide): Esc, the X and a click outside do nothing until it is finished. */
  open(html, onClose, opts = {}) {
    if (!this.isOpen) { this.returnFocus = document.activeElement; this.game.audio.play('panelOpen'); }
    this.locked = !!opts.locked; this.modal.classList.toggle('flow-lock', this.locked); document.body.classList.toggle('flow-open', this.locked);
    this.modal.querySelector('.panel').dataset.flow = opts.flow ?? '';
    this.body.innerHTML = html;
    this.modal.classList.remove('hidden');
    this.game.input.clear();
    requestAnimationFrame(() => (this.body.querySelector('button, [href], input, select, summary') ?? $('#modal-close')).focus());
    this.game.input.unlock();
    this.onClose = onClose ?? null;
    this.body.scrollTop = 0; this.modal.querySelector('.panel').scrollTop = 0;
  }
  close(force = false) {
    if (!this.isOpen || (this.locked && !force)) return;
    this.locked = false; this.modal.classList.remove('flow-lock'); document.body.classList.remove('flow-open');
    this.modal.classList.add('hidden'); this.modal.classList.remove('dock-bottom');
    this.body.innerHTML = '';
    this.game.audio.play('panelClose');
    const cb = this.onClose; this.onClose = null;
    cb?.();
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    this.game.onPanelClosed();
  }

  // ---------------------------------------------------------------- species card
  card(sp, entry, onBack) {
    const photo = entry?.photo ? `style="background-image:url(${entry.photo})"` : '';
    const unlocked = !!entry;
    const html = `
      <div class="card-top">
        <div>
          <div class="card-photo" ${photo}>${entry?.photo ? '' : '🎣 Catch this species<br>to add it to your field guide'}</div>
          ${entry?.best ? `<p class="stars" title="Longest catch">Longest catch: ${entry.best} cm</p>` : ''}
        </div>
        <div>
          <h2>${esc(sp.common)} <span class="status ${esc(sp.statusCode)}" title="IUCN Red List">${esc(sp.status)}</span></h2>
          <div class="sci">${esc(sp.sci)}</div>
          <div class="facts">
            <div><b>Size</b>${esc(sp.size)}</div><div><b>${sp.habitat ? 'Where' : 'Depth'}</b>${esc(sp.depth)}</div>
            <div><b>Feeding</b>${esc(sp.feeding)}</div><div><b>Trophic level</b>${esc(sp.trophic)}</div>
          </div>
        </div>
      </div>
      <h3>Role in the ecosystem</h3><p>${esc(sp.role)}</p>
      <h3>Interactions</h3><ul class="inter">${(sp.interactions || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      <div class="dyk"><b>Did you know?</b> ${esc(sp.didYouKnow)}</div>
      <h3>Watch for</h3><p>${esc(sp.spot)}</p>
      <h3>Field notes</h3>
      ${unlocked ? `<p>${esc(sp.fieldNotes)}</p>` : `<div class="locked">🔒 Catch this species to unlock detailed field notes.</div>`}
      <h3>Threats</h3><p>${esc(sp.threats)}</p>
      <p class="sources">Sources: ${(sp.sources || []).map(esc).join('; ')}</p>
      ${onBack ? '<p><button class="btn small" id="card-back">← Back to journal</button></p>' : ''}`;
    this.open(html);
    if (onBack) $('#card-back', this.body).onclick = onBack;
  }

  // ---------------------------------------------------------------- settings / help
  settings(settings, onChange) {
    const html = `<h2>Settings</h2>
      <div class="settings-row"><span>My angler<br><small style="color:var(--muted)">Change your name, hair, hat, clothes and rod colour.</small></span><button class="btn small" id="set-angler">Edit my angler</button></div>
      <div class="settings-row"><span>Graphics quality<br><small style="color:var(--muted)">Lower this on school laptops. Changes reload the site.</small></span>
        <select id="set-q">${Object.entries(TIERS).map(([k, t]) => `<option value="${k}" ${settings.quality === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
      <div class="settings-row"><span>Graphics style<br><small style="color:var(--muted)">Cosy: soft, colourful, hand-shaped models. Realistic: the original look. Changes reload the site.</small></span>
        <select id="set-style"><option value="stylised" ${settings.style !== 'realistic' ? 'selected' : ''}>Cosy (default)</option><option value="realistic" ${settings.style === 'realistic' ? 'selected' : ''}>Realistic</option></select></div>
      <div class="settings-row"><span>Camera turn speed</span><input id="set-sens" type="range" min="0.3" max="2.5" step="0.1" value="${settings.sensitivity}"></div>
      <div class="settings-row"><span>Invert camera tilt</span><input id="set-inv" type="checkbox" ${settings.invertY ? 'checked' : ''}></div>
      <div class="settings-row"><span>Fight camera<br><small style="color:var(--muted)">Ease the camera lower and side-on while a fish is on, so you can see the angler reel.</small></span><input id="set-fight" type="checkbox" ${settings.fightCam !== false ? 'checked' : ''}></div>
      <div class="settings-row"><span>Volume</span><input id="set-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></div>
      <div class="settings-row"><span>Music<br><small style="color:var(--muted)">Relaxing tracks for each site, streamed as you go.</small></span><input id="set-music-on" type="checkbox" ${settings.musicOn !== false ? 'checked' : ''} aria-label="Music on"></div>
      <div class="settings-row"><span>Music volume</span><input id="set-music-vol" type="range" min="0" max="1" step="0.05" value="${settings.musicVolume ?? 0.5}"></div>
      <div class="settings-row"><span>Corner minimap<br><small style="color:var(--muted)">A small map in the top-left corner while you play. Press M for the full map.</small></span><input id="set-mini" type="checkbox" ${settings.minimap ? 'checked' : ''}></div>
      <div class="settings-row"><span>Reduced motion (steadier camera)</span><input id="set-rm" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}></div>
      <p style="margin-top:16px"><button class="btn small" id="set-reset">Reset all progress</button></p>`;
    this.open(html);
    const ch = (k, v) => onChange(k, v);
    $('#set-angler').onclick = () => ch('editAngler', true);
    $('#set-q').onchange = e => ch('quality', e.target.value);
    $('#set-style').onchange = e => ch('style', e.target.value);
    $('#set-sens').oninput = e => ch('sensitivity', +e.target.value);
    $('#set-inv').onchange = e => ch('invertY', e.target.checked);
    $('#set-fight').onchange = e => ch('fightCam', e.target.checked);
    $('#set-vol').oninput = e => ch('volume', +e.target.value);
    $('#set-music-on').onchange = e => ch('musicOn', e.target.checked);
    $('#set-music-vol').oninput = e => ch('musicVolume', +e.target.value);
    $('#set-mini').onchange = e => ch('minimap', e.target.checked);
    $('#set-rm').onchange = e => ch('reducedMotion', e.target.checked);
    $('#set-reset').onclick = () => { if (confirm('Delete your Fish Guide, logbook and esky on this device?')) ch('resetProgress', true); };
  }
  help() {
    this.open(`<h2>How to play</h2>
      <div class="help-grid">
        <div><h3>🚶 Walking</h3><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk (up the screen is forward) · <kbd>Shift</kbd> run · <kbd>Z</kbd><kbd>C</kbd> turn the camera · mouse wheel zooms · hold the right mouse button and drag (or <kbd>F</kbd> lower, <kbd>G</kbd> higher) to tilt from top-down to a low view of the horizon and sunset · <kbd>V</kbd> or the View button cycles Diorama, Low and Over the shoulder. While a fish is on, the camera eases low and side-on (turn it off in Settings).<br>Click an animal for its card. Wading stops at chest depth. Walk out along the jetty at Lake Illawarra.</p></div>
        <div><h3>🎣 Fishing</h3><p><kbd>T</kbd> tackle box: pick a rig and bait · <kbd>R</kbd> rod out (or away) · hold <kbd>Space</kbd> to wind up, release to cast · <kbd>Space</kbd> to strike when the float dips.<br>Then the <b>catch bar</b>: hold <kbd>Space</kbd> to lift the green zone, let go to let it fall. Keep the fish inside it to fill the meter. Pick up floating litter with the zone for steward points. Reef fish bolt for the reef line at the bottom!</p></div>
        <div><h3>🔎 Identify, measure, decide</h3><p>Land a fish you do not know yet and you get the <b>dichotomous key</b>: turn the 3D fish and answer the two-choice questions until it names the fish. Then <b>measure</b> it on the brag mat (snout to tail tip, within 1 cm is Accurate). Then decide: <b>keep or release?</b> The rules stay hidden until you choose.</p></div>
        <div><h3>💬 People of the coast</h3><p>Walk up to someone (their name tag appears) and press <kbd>E</kbd> to talk. Ask about the rules, get tips and gossip (gossip adds a fish to your guide as Seen), and take on <b>jobs and trades</b>: show them what you have done, or answer a few quiz questions, and they give you tackle, tools, hats or Sea Country cards. <kbd>Q</kbd> opens your <b>quest log</b>.</p></div>
        <div><h3>🪙 Club credits and the shop</h3><p>You cannot sell your catch in NSW, so credits are paid for good science and good care: accurate <b>logbook records</b>, <b>tag-and-release</b> (Dr Priya's kit), Bev's <b>club comp</b>, jobs for the coast's people and litter for Fatima's tally. Spend them at <b>Mitra's tackle shop</b> (talk to her, choose Shop): rods, line, bait, gear that helps the fish and style.</p></div>
        <div><h3>🧊 Esky and heading home</h3><p>Kept fish go in your esky (illegal ones are marked). <kbd>H</kbd> (or Head home in the menu) ends the outing: sometimes a Fisheries Officer checks your esky. Then you see your outing summary.<br><b>One day for everything:</b> a fishing day ends when you head home after fishing (or at midnight on the game clock). Bag limits, the "one bass over 35 cm" count, bait collecting limits and daily credit caps all reset together, but fish you took home are in your fridge and still count toward your possession limit for three days. A run-down fish stock recovers slowly, a few points a day: recovery takes time.</p></div>
        <div><h3>🏆 The ending and the co-op</h3><p>Catch every kind of fish for a club celebration. <b>Master</b> them all and lift <b>Bay Health</b> to 73% for awards night (good practice does it: well-handled releases, tagging, litter pulled out, legal keeps only) on Bellambi beach, then keep playing. After the club's celebration or awards night, Nell at Belmore Basin offers a <b>co-op licence</b>: a nets lab, hauls and the only place a fish can be sold.</p></div>
        <div><h3>🗺 Map</h3><p><kbd>M</kbd> (or the 🗺 button) opens the map of the place you are in: you, the people, the shop, the fishing spots (an orange <b>?</b> means a fish you have not caught there yet) and the danger zones in a big swell. The second tab shows the whole Illawarra coast and which places are still locked. Settings can turn on a small corner minimap.</p></div>
        <div><h3>📗 Fish Guide and 📒 Logbook</h3><p><kbd>J</kbd> opens the Illawarra Fish Guide: Seen, Caught, Identified, Mastered. <kbd>L</kbd> opens your logbook (CSV export). <kbd>Esc</kbd> opens the menu: map, quests, guide, logbook, tackle, settings. A game controller works too: its buttons are listed in the menu.</p></div>
        ${document.body.classList.contains('touch') ? `<div><h3>📱 Touch controls</h3><p>Left joystick to walk (push to the edge to run), drag anywhere to turn the camera (drag up and down, or with two fingers, to tilt), pinch to zoom, 🎥 changes the view, tap an animal for its card. CAST is the big button: hold to wind up, release to cast, tap to strike. In the catch bar, hold the big button (or press and hold the bar) to lift the zone. 🎣 rod · 🧰 tackle box · 📗 fish guide · 📒 logbook · 🏠 head home · ⏸ pause.</p></div>` : ''}
      </div>`);
  }
}
