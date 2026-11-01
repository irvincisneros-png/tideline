// The logbook (key L): every fish you have handled, one row each (date, spot, tide, time, species or unknown label, length, your measure,
// kept or released, legal), with the accuracy and the CSV export. Content item C32: records show whether populations are healthy.
import { SPOT_INFO } from '../fishing/species.js';
import { esc } from './panels.js';

const fmtDate = t => new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
const KIND = { undersize: 'undersize', oversize: 'over the slot', bag: 'bag limit', possession: 'possession limit', protected: 'protected' };
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');

export function openLogbook(game) {
  const p = game.progress, rows = [...(p.catches ?? [])].reverse();
  const meas = rows.filter(r => r.measured != null), acc = meas.filter(r => r.accurate).length;
  const kept = rows.filter(r => r.kept).length, illegal = rows.filter(r => r.kept && r.legal === false).length;
  game.panels.open(`<h2>Logbook</h2>
    <p class="sub">${rows.length ? `${rows.length} fish: ${kept} kept, ${rows.length - kept} released. ${meas.length ? `Measuring accuracy: ${acc} of ${meas.length} within 1 cm (${Math.round(acc / meas.length * 100)}%).` : ''}${illegal ? ` ${illegal} illegal keep${illegal > 1 ? 's' : ''}.` : ''}` : 'Nothing logged yet. Every fish you land is written here.'}</p>
    ${rows.length ? `<div class="lb-wrap"><table class="lb">
      <thead><tr><th>Date</th><th>Spot</th><th class="c-tide">Tide</th><th class="c-time">Time</th><th>Fish</th><th>Length</th><th>Your measure</th><th>Kept?</th><th>Legal to keep?</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${fmtDate(r.time)}</td><td>${esc((SPOT_INFO[r.spot]?.label ?? r.spot ?? '').replace('Lake Illawarra ', 'Lake '))}</td><td class="c-tide">${esc(cap(r.tide))}</td><td class="c-time">${esc(cap(r.daytime))}</td>
        <td><b>${esc(r.label ?? r.id)}</b></td><td>${r.length} cm</td>
        <td>${r.measured == null ? '–' : `${r.measured} cm <i class="${r.accurate ? 'ok' : 'miss'}">${r.accurate ? '✔' : '✖'}</i>`}</td>
        <td>${r.kept ? 'Kept' : 'Released'}</td>
        <td class="${r.legal === false ? 'bad' : 'ok'}">${r.legal === undefined ? (r.correct ? 'Yes' : 'No') : r.legal ? 'Yes' : `No (${esc(KIND[r.kind] ?? 'rule')})`}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <p class="g-foot"><button class="btn small" id="lb-csv">Export logbook (CSV)</button></p>`);
  game.panels.body.querySelector('#lb-csv').onclick = () => game.exportCSV();
}
