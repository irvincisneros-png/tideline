// The credits screen (title screen, end card). Cream card, same panel as the rest of the game.
import { esc } from './panels.js';
import { CREDITS, VERSION, SEA_COUNTRY_NOTE } from '../content/credits.js';

export function openCredits(game, onClose) {
  game.panels.open(`<div class="credits">
    <h2>Credits</h2>
    <p class="cr-sea" role="note">${esc(SEA_COUNTRY_NOTE)}</p>
    ${CREDITS.map(s => `<section><h3>${esc(s.h)}</h3>${s.lines.map(l => `<p>${esc(l)}</p>`).join('')}</section>`).join('')}
    <p class="muted">TideLine ${esc(VERSION)} · <a href="teacher.html">Teacher page</a></p>
    <p><button class="btn primary" id="cr-ok">Close</button></p></div>`, onClose);
  game.panels.body.querySelector('#cr-ok').onclick = () => game.panels.close();
}
