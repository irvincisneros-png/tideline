// The first-run premise card: right after the character creator a brand-new player hears (on the club radio) what the game is about, in four short skippable pages.
// Shown once (progress.tips.firstRun), never to a save that already has catches or Fish Guide entries. A ?play deep link skips it unless ?firstrun=1 (tests and teacher links).
import { esc } from './panels.js';
import { nameOf } from '../core/anglerData.js';

/** Should this player see the premise card? (pure: unit-testable) */
export function firstRunDue(progress, params = new URLSearchParams()) {
  if (progress.tips?.firstRun) return false;
  if (params.has('play') && !params.has('firstrun')) return false;
  return !(progress.catches?.length) && Object.keys(progress.guide?.e ?? {}).length === 0;
}

export const TAGLINE = 'Gotta catch ’em all… and release the small.';

/** The pages of the premise (HTML; {name} is filled in). */
export const PAGES = [
  `G'day {name}, Bev here on the club radio! Welcome to the Illawarra coast. Your goal: <b>complete the Illawarra Fish Guide</b>, every kind of fish on this coast.<br><b>“${TAGLINE}”</b>`,
  `Every fish climbs four tiers in the guide: <b>Seen</b> (you spotted it), <b>Caught</b> (it is on your line), <b>Identified</b> (you solved the key to name it) and <b>Mastered</b> (a measure within 1 cm and the right keep-or-release call).`,
  `You cannot sell your catch in NSW. You earn <b>Club credits</b> from good records: accurate measures, tagging, clean-ups. Spend them on better tackle at Mitra's shop.`,
  `First step: <b>walk to the water</b>, press <kbd>R</kbd> to take out your rod, then hold <kbd>Space</kbd> and let go to cast. Good luck, and release the small ones!`,
];

/** Run the card on the current game. Resolves when it is finished or skipped. */
export async function runFirstRun(game) {
  const p = game.progress;
  p.tips ??= {}; p.tips.firstRun = true; game.persist();   // once, even if they skip it
  const dlg = game.dialogue;
  const who = { ...(game.npcs?.whoOf?.('bev') ?? { name: 'Bev' }), name: 'Bev', role: 'on the club radio' };
  const name = esc(nameOf(p));
  for (let i = 0; i < PAGES.length; i++) {
    const last = i === PAGES.length - 1;
    const text = game.hint(PAGES[i].replaceAll('{name}', name)) + `<div class="fr-dots" aria-hidden="true">${PAGES.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>`;
    const c = await dlg.say({ who, text, choices: last ? ['Let’s go!'] : ['Next', 'Skip'], cancel: last ? 0 : 1 });
    if (!last && c === 1) break;
  }
  dlg.hide();
}
