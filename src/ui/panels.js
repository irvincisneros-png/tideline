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
  open(html, onClose) {
    if (!this.isOpen) { this.returnFocus = document.activeElement; this.game.audio.play('panelOpen'); }
    this.body.innerHTML = html;
    this.modal.classList.remove('hidden');
    this.game.input.clear();
    requestAnimationFrame(() => (this.body.querySelector('button, [href], input, select, summary') ?? $('#modal-close')).focus());
    this.game.input.unlock();
    this.onClose = onClose ?? null;
    this.body.scrollTop = 0; this.modal.querySelector('.panel').scrollTop = 0;
  }
  close() {
    if (!this.isOpen) return;
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

  // ---------------------------------------------------------------- field guide (journal)
  journal(eco, ecos, progress, startTab = 'species') {
    const render = (ecoId, tab) => {
      const e = ecos.find(x => x.id === ecoId);
      const list = e.speciesInfo;
      const have = list.filter(s => progress.journal[`${e.id}:${s.id}`]);
      const groups = ['all', ...new Set(list.map(s => s.group))];
      const total = ecos.reduce((a, x) => a + x.speciesInfo.length, 0);
      const got = Object.keys(progress.journal).length;
      const filtered = tab === 'all' || tab === 'species' ? list : list.filter(s => s.group === tab);
      this.body.innerHTML = `
        <h2>Field guide</h2>
        <p>${got} of ${total} species logged across all spots. Catch a fish to add it; tap any entry for its card.</p>
        <div class="tabs">${ecos.map(x => `<button data-eco="${x.id}" class="${x.id === ecoId ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div>
        <div class="tabs">${groups.map(g => `<button data-tab="${g}" class="${(tab === g || (tab === 'species' && g === 'all')) ? 'on' : ''}">${g === 'all' ? 'All' : esc(g)}</button>`).join('')}
          <span style="margin-left:auto;color:var(--muted);font-size:13px">${have.length}/${list.length} at ${esc(e.name)}</span></div>
        <div class="journal-grid">${filtered.map(s => {
          const j = progress.journal[`${e.id}:${s.id}`];
          return `<button class="jcell ${j ? '' : 'unk'}" data-id="${s.id}" data-e="${e.id}">
            <div class="ph" ${j?.photo ? `style="background-image:url(${j.photo})"` : ''}>${j?.photo ? '' : '?'}</div>
            <div class="nm">${j ? esc(s.common) : esc(s.common)}<small>${j ? `Longest: ${j.best ?? '?'} cm` : 'Not yet caught'}</small></div></button>`;
        }).join('')}</div>
        <p style="margin-top:16px"><button class="btn small" id="j-csv">Export field guide + catch log (CSV)</button></p>`;
      this.body.querySelectorAll('[data-eco]').forEach(b => b.onclick = () => render(b.dataset.eco, 'all'));
      this.body.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => render(ecoId, b.dataset.tab));
      this.body.querySelectorAll('.jcell').forEach(b => b.onclick = () => {
        const ec = ecos.find(x => x.id === b.dataset.e);
        const sp = ec.speciesInfo.find(s => s.id === b.dataset.id);
        this.card(sp, progress.journal[`${ec.id}:${sp.id}`], () => render(ecoId, tab));
      });
      $('#j-csv', this.body).onclick = () => this.game.exportCSV();
    };
    this.open('');
    render(eco.id, 'all');
  }

  // ---------------------------------------------------------------- settings / help
  settings(settings, onChange) {
    const html = `<h2>Settings</h2>
      <div class="settings-row"><span>Graphics quality<br><small style="color:var(--muted)">Lower this on school laptops. Changes reload the site.</small></span>
        <select id="set-q">${Object.entries(TIERS).map(([k, t]) => `<option value="${k}" ${settings.quality === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
      <div class="settings-row"><span>Graphics style<br><small style="color:var(--muted)">Cosy: soft, colourful, hand-shaped models. Realistic: the original look. Changes reload the site.</small></span>
        <select id="set-style"><option value="stylised" ${settings.style !== 'realistic' ? 'selected' : ''}>Cosy (default)</option><option value="realistic" ${settings.style === 'realistic' ? 'selected' : ''}>Realistic</option></select></div>
      <div class="settings-row"><span>Camera turn speed</span><input id="set-sens" type="range" min="0.3" max="2.5" step="0.1" value="${settings.sensitivity}"></div>
      <div class="settings-row"><span>Invert camera tilt</span><input id="set-inv" type="checkbox" ${settings.invertY ? 'checked' : ''}></div>
      <div class="settings-row"><span>Volume</span><input id="set-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></div>
      <div class="settings-row"><span>Reduced motion (steadier camera)</span><input id="set-rm" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}></div>
      <p style="margin-top:16px"><button class="btn small" id="set-reset">Reset all progress</button></p>`;
    this.open(html);
    const ch = (k, v) => onChange(k, v);
    $('#set-q').onchange = e => ch('quality', e.target.value);
    $('#set-style').onchange = e => ch('style', e.target.value);
    $('#set-sens').oninput = e => ch('sensitivity', +e.target.value);
    $('#set-inv').onchange = e => ch('invertY', e.target.checked);
    $('#set-vol').oninput = e => ch('volume', +e.target.value);
    $('#set-rm').onchange = e => ch('reducedMotion', e.target.checked);
    $('#set-reset').onclick = () => { if (confirm('Delete your field guide and catch log on this device?')) ch('resetProgress', true); };
  }
  help() {
    this.open(`<h2>How to play</h2>
      <div class="help-grid">
        <div><h3>🚶 Walking</h3><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk (up the screen is forward) · <kbd>Shift</kbd> run · <kbd>Q</kbd><kbd>E</kbd> turn the camera · mouse wheel zooms.<br>Click an animal for its card. Wading stops at chest depth. Walk out along the jetty at Lake Illawarra.</p></div>
        <div><h3>🎣 Fishing</h3><p><kbd>T</kbd> tackle box: pick a rig and bait · <kbd>R</kbd> rod out (or away) · hold <kbd>Space</kbd> to wind up, release to cast · <kbd>Space</kbd> to strike when the float dips.<br>Then the <b>catch bar</b>: hold <kbd>Space</kbd> to lift the green zone, let go to let it fall. Keep the fish inside it to fill the meter. Pick up floating litter with the zone for steward points. Reef fish bolt for the reef line at the bottom!</p></div>
        <div><h3>📏 Keep or release?</h3><p>Every fish you land is judged against NSW size and bag limits. Decide whether you may keep it. Releasing a legal fish is always allowed.</p></div>
        <div><h3>📗 Field guide</h3><p><kbd>J</kbd> opens your field guide: every species you have caught, with its card. <kbd>P</kbd> pauses.</p></div>
        ${document.body.classList.contains('touch') ? `<div><h3>📱 Touch controls</h3><p>Left joystick to walk (push to the edge to run), drag anywhere to turn the camera, pinch to zoom, tap an animal for its card. CAST is the big button: hold to wind up, release to cast, tap to strike. In the catch bar, hold the big button (or press and hold the bar) to lift the zone. 🎣 rod · 🧰 tackle box · 📗 field guide · ⏸ pause.</p></div>` : ''}
      </div>`);
  }
}
