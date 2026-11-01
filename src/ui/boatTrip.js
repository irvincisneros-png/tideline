// The run out to the offshore reef. Two steps: the safety beat (put on your lifejacket and log your trip), then a short boat-trip scene out of Belmore Basin (past the lighthouse, with the Five Islands
// rising on the horizon). The safety beat is a general tip plus dataset C28 ("Boat: everyone wears a PFD", worksheet 2.1.12) and C26's lifejacket fit check; trip logging is a general safety tip, not a legal claim.
// The weather line comes from the day's conditions (the BOM Coasts and oceans page shows wind, swell, tides and warnings: dataset E1).
// runBoatTrip(game) resolves { text, aboard, back } when the player casts off, or null if they back out.
import { esc } from './panels.js';

export const TRIP_TEXT = {
  jacket: 'Everyone on a boat wears a lifejacket (a PFD). Do the buckles up, make it snug, then do the lift test: lift it by the shoulders and it should not rise above your ears.',
  log: 'Log your trip: who is aboard, where you are going and when you will be back. If something goes wrong, someone knows where to look and when to start worrying.',
  weather: 'Check the swell, wind and tides before you go. The BOM Coasts and oceans page shows wind, swell, tides and warnings.',
};
export const BACK_BY = [['2 hours', 2], ['4 hours', 4], ['Sunset', 8]];

/** The words for the trip log card. */
export function tripText({ aboard, back }) { return `${aboard} aboard, back in ${back.toLowerCase()}`; }

export function runBoatTrip(game) {
  return new Promise(resolve => {
    const g = game, swell = g.cond?.swell ?? 1, big = swell >= 2.5;
    let jacket = false, fit = false, logged = null, aboard = 2, back = BACK_BY[1][0];
    const render = () => {
      const ready = jacket && fit && !!logged;
      g.panels.body.innerHTML = `<div class="flow trip"><h2>⚓ Before you head out</h2>
        <p class="sub">The reef is a boat trip from Belmore Basin. Two quick jobs first.</p>
        <div class="trip-step ${jacket && fit ? 'done' : ''}"><b>1 · Lifejacket on</b><p>${esc(TRIP_TEXT.jacket)}</p>
          <p><button class="btn ${jacket ? 'on' : ''}" id="trip-jacket" aria-pressed="${jacket}">🦺 ${jacket ? 'Lifejacket on ✓' : 'Put on your lifejacket'}</button>
          <button class="btn ${fit ? 'on' : ''}" id="trip-fit" aria-pressed="${fit}" ${jacket ? '' : 'disabled'}>${fit ? 'Fit checked ✓' : 'Buckle up, snug, lift test'}</button></p></div>
        <div class="trip-step ${logged ? 'done' : ''}"><b>2 · Log your trip</b><p>${esc(TRIP_TEXT.log)}</p>
          <p class="trip-form"><label>Aboard <select id="trip-aboard">${[1, 2, 3].map(n => `<option ${n === aboard ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>Back in <select id="trip-back">${BACK_BY.map(([l]) => `<option ${l === back ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <button class="btn ${logged ? 'on' : ''}" id="trip-log">${logged ? '📒 Trip logged ✓' : '📒 Log my trip'}</button></p>
          ${logged ? `<p class="trip-logged">Logged: <b>Offshore reef off Port Kembla</b> · ${esc(logged)}</p>` : ''}</div>
        <div class="trip-step ${big ? 'warn' : ''}"><b>Weather</b><p>Swell today: <b>${swell.toFixed(1)} m</b>. ${big ? 'That is a big swell: a boat trip would be a risky call. Check the forecast before you ever go.' : 'A safe, small swell for the run out.'} ${esc(TRIP_TEXT.weather)}</p></div>
        <p class="trip-actions"><button class="btn primary" id="trip-go" ${ready ? '' : 'aria-disabled="true"'}>Cast off</button> <button class="btn ghost" id="trip-back-btn">Not now</button></p>
        <p class="muted" id="trip-note">${ready ? 'Ready when you are.' : 'Put your lifejacket on and log your trip to cast off.'}</p></div>`;
      const b = g.panels.body, $ = s => b.querySelector(s);
      $('#trip-jacket').onclick = () => { jacket = !jacket; if (!jacket) fit = false; render(); };
      $('#trip-fit').onclick = () => { fit = !fit; render(); };
      $('#trip-aboard').onchange = e => { aboard = Number(e.target.value); logged = null; render(); };
      $('#trip-back').onchange = e => { back = e.target.value; logged = null; render(); };
      $('#trip-log').onclick = () => { logged = tripText({ aboard, back }); render(); };
      $('#trip-go').onclick = () => {
        if (!ready) { $('#trip-note').textContent = !(jacket && fit) ? 'Lifejacket first: put it on and check the fit.' : 'Log your trip first: who is aboard and when you will be back.'; return; }
        g.panels.close(true); g.persist(); playScene(g, aboard).then(() => resolve({ text: logged, aboard, back }));
      };
      $('#trip-back-btn').onclick = () => { g.panels.close(true); resolve(null); };
      $('#trip-jacket').focus?.({ preventScroll: true });
    };
    g.panels.open('', null, { locked: true, flow: 'flow' });
    render();
  });
}

/** The boat trip: a side-on, painted scene on a canvas. About 6 seconds (skippable); under reduced motion it is a quick fade. */
function playScene(g, aboard = 2) {
  return new Promise(resolve => {
    const reduced = !!g.settings?.reducedMotion, DUR = reduced ? 1.4 : 6.2;
    const el = document.createElement('div'); el.id = 'trip-scene'; el.innerHTML = '<canvas></canvas><div class="trip-cap" id="trip-cap"></div><button class="btn ghost small" id="trip-skip">Skip ›</button>';
    document.body.appendChild(el);
    const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), cap = el.querySelector('#trip-cap');
    const fit = () => { cv.width = Math.min(innerWidth, 1280); cv.height = Math.round(cv.width * innerHeight / Math.max(1, innerWidth)); }; fit();
    const t0 = performance.now(); let done = false;
    const CAPS = [[0.0, 'Casting off from Belmore Basin…'], [1.6, 'Out past the breakwall and the lighthouse…'], [3.2, 'The Five Islands off Port Kembla on the horizon…'], [4.8, 'Slowing down over the reef. Watch the fish finder.']];
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); el.classList.add('out'); setTimeout(() => { el.remove(); resolve(); }, 260); };
    el.querySelector('#trip-skip').onclick = finish;
    const ease = x => x * x * (3 - 2 * x);
    let raf;
    const frame = () => {
      const T = (performance.now() - t0) / 1000, k = Math.min(1, T / DUR), W = cv.width, H = cv.height, hz = H * 0.46;
      // sky: blue to a pale horizon, a sun and soft clouds
      let gr = ctx.createLinearGradient(0, 0, 0, hz); gr.addColorStop(0, '#3c86d8'); gr.addColorStop(1, '#d6ecf6'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, hz);
      ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(W * 0.78, hz * 0.34, H * 0.055, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const [cx, cy, r] of [[0.2, 0.22, 0.06], [0.46, 0.14, 0.05], [0.64, 0.3, 0.045]]) { const x = ((cx * W - T * W * 0.01) % (W + 200) + W + 200) % (W + 200) - 100; ctx.beginPath(); ctx.ellipse(x, cy * hz * 2, r * W, r * W * 0.4, 0, 0, 6.283); ctx.ellipse(x + r * W * 0.6, cy * hz * 2 + 4, r * W * 0.7, r * W * 0.32, 0, 0, 6.283); ctx.fill(); }
      // the Five Islands: faint humps that rise as we near them
      const isl = ease(Math.min(1, Math.max(0, (k - 0.25) / 0.6)));
      ctx.fillStyle = '#6b93a8'; for (const [x, w, h] of [[0.52, 0.15, 0.07], [0.64, 0.06, 0.035], [0.72, 0.07, 0.04], [0.8, 0.05, 0.03], [0.44, 0.09, 0.04]]) { const hh = H * h * (0.4 + 0.9 * isl), ww = W * w; ctx.beginPath(); ctx.moveTo(W * x - ww, hz + 2); ctx.quadraticCurveTo(W * x - ww * 0.2, hz - hh * 1.2, W * x + ww, hz + 2); ctx.fill(); }
      // sea
      gr = ctx.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, '#5fc7e8'); gr.addColorStop(0.5, '#2a8fd0'); gr.addColorStop(1, '#0f5aa8'); ctx.fillStyle = gr; ctx.fillRect(0, hz, W, H - hz);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      for (let r = 0; r < 9; r++) { const y = hz + 14 + r * (H - hz) / 9, sp = 0.4 + r * 0.25; ctx.beginPath(); for (let x = 0; x <= W; x += 24) { const yy = y + Math.sin(x * 0.02 + T * sp * 2 + r) * (2 + r * 0.8); x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
      // the harbour sliding away to the left: the breakwall, the lighthouse and the quay line
      const lx = W * (0.3 - 0.55 * ease(Math.min(1, k * 1.15))), wallY = hz + 6;
      ctx.fillStyle = '#9c968a'; ctx.fillRect(lx - W * 0.4, wallY - 10, W * 0.6, 14);
      ctx.fillStyle = '#fbf6ec'; ctx.beginPath(); ctx.moveTo(lx - 20, wallY - 10); ctx.lineTo(lx - 12, wallY - 70); ctx.lineTo(lx + 12, wallY - 70); ctx.lineTo(lx + 20, wallY - 10); ctx.fill();
      ctx.fillStyle = '#d9503c'; ctx.fillRect(lx - 14, wallY - 52, 28, 14); ctx.fillStyle = '#ffeaa8'; ctx.fillRect(lx - 10, wallY - 86, 20, 16); ctx.fillStyle = '#d9503c'; ctx.beginPath(); ctx.moveTo(lx - 13, wallY - 86); ctx.lineTo(lx, wallY - 100); ctx.lineTo(lx + 13, wallY - 86); ctx.fill();
      // the boat: a side-on centre-console bobbing, bow to the right, with spray and a wake
      const bx = W * 0.5, by = H * 0.66 + Math.sin(T * 3.1) * 5, s = H / 500, rot = Math.sin(T * 2.4) * 0.03 - 0.03 * (1 - Math.min(1, k * 4));
      ctx.save(); ctx.translate(bx, by); ctx.rotate(rot); ctx.scale(s, s);
      ctx.fillStyle = '#f4f1e8'; ctx.beginPath(); ctx.moveTo(-150, -30); ctx.lineTo(160, -44); ctx.quadraticCurveTo(190, -20, 120, 20); ctx.lineTo(-140, 20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a8c96'; ctx.beginPath(); ctx.moveTo(-150, -30); ctx.lineTo(160, -44); ctx.lineTo(158, -34); ctx.lineTo(-150, -20); ctx.fill();
      ctx.fillStyle = '#4e5a62'; ctx.fillRect(-140, 10, 255, 10);
      ctx.fillStyle = '#e8f0f2'; ctx.fillRect(-20, -86, 60, 56); ctx.fillStyle = '#7ab0c4'; ctx.beginPath(); ctx.moveTo(40, -84); ctx.lineTo(70, -56); ctx.lineTo(40, -56); ctx.fill(); ctx.fillStyle = '#34444c'; ctx.fillRect(-14, -96, 4, 12);
      ctx.fillStyle = '#ff7a1a'; ctx.fillRect(-12, -70, 22, 14);                                  // the orange lifejackets
      for (let i = 0; i < Math.max(1, Math.min(3, aboard)); i++) { const px = -60 + i * 34, sk = ['#e0a070', '#c58c5e', '#f0c8a0'][i]; ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(px, -56, 9, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(px, -62, 12, 5, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#ff7a1a'; ctx.fillRect(px - 10, -48, 20, 22); }   // everyone aboard, lifejacket on
      ctx.strokeStyle = '#34444c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, -30); ctx.lineTo(-86, -110); ctx.stroke();   // a rod in a holder
      ctx.fillStyle = '#f4f1e8'; ctx.fillRect(-168, -40, 26, 44); ctx.fillStyle = '#34444c'; ctx.fillRect(-166, 4, 12, 26);   // the outboard
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 16; i++) { const a = (T * 3 + i * 0.7) % 3, x = bx - 190 * s - a * 60 * s, y = by + 18 * s + Math.sin(i * 3.1) * 6; ctx.beginPath(); ctx.arc(x, y, Math.max(1, (3 - a) * 2.2), 0, 6.283); ctx.fill(); }
      let text = CAPS[0][1]; for (const [t, c] of CAPS) if (T >= t * (DUR / 6.2)) text = c; cap.textContent = text;
      if (T >= DUR) { finish(); return; }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
