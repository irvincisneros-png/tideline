// The quest log (key Q): requests you have accepted (who, where, what, progress), what is ready to hand in, quizzes waiting for tomorrow, the completed
// list, and your kit (gear and hats from the people of the coast; hats can be worn from here).
import { questLog, ensureNpc } from '../npc/requests.js';
import { ITEMS, CARDS } from '../content/items.js';
import { NPCS } from '../content/npcs.js';
import { ensureInventory, ownedItems, rewardName } from '../npc/inventory.js';
import { esc } from './panels.js';

const reward = id => esc(rewardName(id));

function card(e, kind) {
  const def = NPCS[e.npc], t = e.trade, pr = e.progress;
  const what = t.kind === 'quiz'
    ? `Quiz: ${t.quiz.length} question${t.quiz.length > 1 ? 's' : ''} from your worksheets. All right to win it.`
    : esc(pr.text);
  const bar = pr && pr.need > 1 ? `<div class="meter"><i style="width:${Math.round(pr.have / pr.need * 100)}%"></i></div><small>${pr.have} of ${pr.need}</small>` : '';
  const state = kind === 'ready' ? (t.kind === 'quiz' ? 'Ready: ask me' : 'Ready to hand in') : kind === 'wait' ? 'Try again tomorrow' : kind === 'done' ? 'Done' : 'In progress';
  return `<li class="quest ${kind}">
    <div class="q-head"><b>${esc(t.title)}</b><span class="q-state">${state}</span></div>
    <div class="q-who">${esc(def.name)} · ${esc(def.where)}</div>
    <div class="q-what">${what}</div>${bar}
    <div class="q-rew">Reward: ${reward(t.reward)}</div>
    ${kind === 'ready' ? `<div class="q-hint">Talk to ${esc(def.name)} (<kbd>E</kbd>) and choose Jobs and trades.</div>` : ''}
  </li>`;
}

export function openQuestLog(game) {
  const p = game.progress, panels = game.panels;
  const render = () => {
    const q = questLog(p), inv = ensureInventory(p), n = ensureNpc(p);
    const sec = (title, list, kind, empty) => `<h3>${title}</h3>${list.length ? `<ul class="quests">${list.map(e => card(e, kind)).join('')}</ul>` : `<p class="muted">${empty}</p>`}`;
    const hats = ownedItems(p, 'hat'), gear = ownedItems(p).filter(id => ITEMS[id].kind !== 'hat');
    panels.body.innerHTML = `<div class="questlog">
      <h2>📜 Quest log</h2>
      <p class="sub">Day ${n.day}. Talk to the people along the shore: ask about "Jobs and trades". Anything you have already done in your Fish Guide or logbook counts.</p>
      ${sec('Ready', q.ready, 'ready', 'Nothing to hand in yet.')}
      ${sec('In progress', q.active, 'active', 'No requests in progress. Find a person with a <b>!</b> over their head.')}
      ${q.waiting.length ? sec('Try again tomorrow', q.waiting, 'wait', '') : ''}
      <h3>Your kit</h3>
      ${gear.length || hats.length ? `<ul class="kit">${gear.map(id => `<li><b>${esc(ITEMS[id].name)}</b><span>${esc(ITEMS[id].blurb)}</span></li>`).join('')}
        ${hats.map(id => `<li class="hat"><b>${esc(ITEMS[id].name)}</b><span>${esc(ITEMS[id].blurb)}</span><button class="btn small" data-hat="${id}">${inv.worn === id ? 'Take off' : 'Wear it'}</button></li>`).join('')}</ul>` : '<p class="muted">Empty so far. You start with the paternoster, running sinker and unweighted rigs, and prawn and beach worm bait.</p>'}
      ${(Object.keys(inv.cards).length) ? `<p class="muted">${Object.keys(inv.cards).length} Sea Country card${Object.keys(inv.cards).length > 1 ? 's' : ''} in the Fish Guide (<kbd>J</kbd>), Sea Country tab.</p>` : ''}
      ${q.done.length ? `<h3>Completed (${q.done.length})</h3><ul class="quests done">${q.done.map(e => `<li class="quest done"><div class="q-head"><b>${esc(e.trade.title)}</b><span class="q-state">✔ ${esc(NPCS[e.npc].name)}</span></div><div class="q-rew">${reward(e.trade.reward)}</div></li>`).join('')}</ul>` : ''}
      <p><button class="btn primary" id="q-done">Done</button></p>
    </div>`;
    panels.body.querySelector('#q-done').onclick = () => panels.close();
    panels.body.querySelectorAll('[data-hat]').forEach(b => b.onclick = () => {
      const id = b.dataset.hat, look = ITEMS[id].hat;
      if (inv.worn === id) { game.setAppearance(inv.before ?? { hatStyle: 'bucket', hat: 0xe9d9a6 }); inv.worn = null; }
      else { if (!inv.worn) inv.before = { hatStyle: game.angler.look.hatStyle, hat: game.angler.look.hat }; game.setAppearance(look); inv.worn = id; }
      game.persist(); render();
    });
  };
  panels.open('', null);
  render();
}
