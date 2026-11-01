// The Illawarra Fish Guide (key J): a grid of every species across both spots, per-spot completion counters, a tier on every entry
// (Seen / Caught / Identified / Mastered), the Bay Health meter and the Steward rating in the header. "Gotta catch 'em all... and release the small."
import { SPECIES, SPECIES_BY_ID, SPOT_INFO, REGIONS, speciesInRegion, whereWhen } from '../fishing/species.js';
import { stockOf, RULES } from '../fishing/catches.js';
import * as G from '../fishing/guide.js';
import { guideCSV } from '../core/save.js';
import { esc } from './panels.js';
import { fishPicture } from './fishView.js';
import { mountKey } from './keyUI.js';

const TIER_CLASS = { unseen: 'unseen', seen: 'seen', caught: 'caught', identified: 'ident', mastered: 'master' };
const pips = tier => { const n = G.TIERS.indexOf(tier); return `<span class="pips" role="img" aria-label="${G.TIER_LABEL[tier]}">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`; };
const pct = v => `${Math.round(v)}%`;

/** Fill each <img data-pic> with a render of the species (a flat silhouette when data-sil is set), a few per tick so the panel stays responsive. */
function fillPictures(root) {
  const todo = [...root.querySelectorAll('img[data-pic]')];
  const next = () => {
    const el = todo.shift();
    if (!el) return;
    if (el.isConnected) {
      try { el.src = fishPicture(el.dataset.pic, { silhouette: el.dataset.sil === '1', w: +(el.dataset.w ?? 360), h: +(el.dataset.h ?? 200) }); el.classList.add('ready'); } catch (e) { console.warn('fish picture', e); }
      setTimeout(next, 0);
    }
  };
  setTimeout(next, 0);
}

export function openGuide(game, { focus = null, back = null, region = 'all' } = {}) {
  const p = game.progress, panels = game.panels, body = panels.body;
  let keyCtl = null;
  const dispose = () => { keyCtl?.dispose(); keyCtl = null; };
  const wasOpen = panels.isOpen;
  panels.open('', () => dispose(), { locked: !!back, flow: 'guide' });
  void wasOpen;

  // ------------------------------------------------------------ the grid
  const renderList = (reg = region) => {
    dispose();
    const counts = G.regionCounts(p), total = SPECIES.length;
    const doneAll = SPECIES.filter(s => G.atLeast(G.tierOf(p, s.id), 'identified')).length;
    const list = reg === 'all' ? SPECIES : speciesInRegion(reg);
    const bay = G.bayHealth(p), st = G.stewardRating(p), comp = G.completion(p);
    body.innerHTML = `
      ${back ? '<p><button class="btn small" id="g-back">← Back to the decision</button></p>' : ''}
      <h2>Illawarra Fish Guide</h2>
      <p class="tagline">Gotta catch 'em all… and release the small.</p>
      <div class="g-stats">
        <div class="g-stat"><b>Guide complete</b><div class="meter"><i style="width:${comp}%"></i></div><span>${comp}%</span></div>
        <div class="g-stat"><b>Bay Health</b><div class="meter bay ${bay < 45 ? 'low' : ''}"><i style="width:${bay}%"></i></div><span>${pct(bay)} · ${G.bayLabel(bay)}</span></div>
        <div class="g-stat"><b>Steward rating</b><span class="stars big">${G.starsText(st.value)}</span><span>${st.value.toFixed(1)} of 5</span></div>
      </div>
      <div class="tabs" role="tablist">
        <button data-reg="all" class="${reg === 'all' ? 'on' : ''}">All ${doneAll}/${total}</button>
        ${counts.map(c => `<button data-reg="${c.key}" class="${reg === c.key ? 'on' : ''}">${esc(c.label)} ${c.done}/${c.total}</button>`).join('')}
      </div>
      <p class="muted tiers-key">${['seen', 'caught', 'identified', 'mastered'].map((t, i) => `<span class="tk"><i class="t${i + 1}"></i>${G.TIER_LABEL[t]}</span>`).join('')}<span class="tk">Counters show fish Identified or better.</span></p>
      <div class="gguide-grid">${list.map(s => cell(s)).join('')}</div>
      <p class="g-foot"><button class="btn small" id="g-csv">Export Fish Guide (CSV)</button></p>`;
    body.querySelectorAll('[data-reg]').forEach(b => { b.onclick = () => { region = b.dataset.reg; renderList(region); }; });
    body.querySelectorAll('.gcell').forEach(b => { b.onclick = () => renderEntry(b.dataset.id); });
    body.querySelector('#g-back')?.addEventListener('click', () => { dispose(); back(); });
    body.querySelector('#g-csv').onclick = () => game.exportGuideCSV();
    fillPictures(body);
  };
  const cell = s => {
    const t = G.tierOf(p, s.id), e = G.entryOf(p, s.id), flag = G.needsRekey(p, s.id), id = s.id;
    const named = G.atLeast(t, 'identified'), sub = t === 'unseen' ? 'Not seen yet' : t === 'seen' ? 'Seen: where and when?' : t === 'caught' ? (G.keyedAs(p, id) ? `Keyed as ${G.keyedAs(p, id)}` : 'Key it to name it') : t === 'identified' ? `Longest ${e.best ?? '?'} cm` : 'Mastered';
    let ph;
    if (t === 'unseen') ph = '<span class="q">?</span>';
    else if (t === 'seen') ph = `<img data-pic="${id}" data-sil="1" alt="" width="360" height="200">`;
    else if (t === 'caught') ph = e?.photo ? `<img class="photo" src="${e.photo}" alt="Your catch">` : `<img data-pic="${id}" data-sil="1" alt="" width="360" height="200">`;
    else ph = `<img data-pic="${id}" alt="" width="360" height="200">`;
    return `<button class="gcell ${TIER_CLASS[t]} ${flag ? 'flagged' : ''}" data-id="${id}" aria-label="${esc(G.labelOf(p, id))}, ${G.TIER_LABEL[t]}${flag ? ', does not match, re-key it' : ''}">
      <div class="gph">${ph}${flag ? '<span class="gflag" title="Does not match: re-key it">⚠</span>' : ''}${t === 'mastered' ? '<span class="gstar">★</span>' : ''}</div>
      <div class="gnm"><b>${esc(G.labelOf(p, id))}</b><small>${esc(sub)}</small>${pips(t)}</div></button>`;
  };

  // ------------------------------------------------------------ one entry
  const renderEntry = id => {
    dispose();
    const s = SPECIES_BY_ID[id], t = G.tierOf(p, id), e = G.entryOf(p, id) ?? {}, flag = G.needsRekey(p, id);
    const named = G.atLeast(t, 'identified'), master = t === 'mastered';
    const rule = RULES[id];
    const photo = e.photo ? `<img class="gd-photo" src="${e.photo}" alt="Your catch photo">` : '';
    const sil = (sil, w = 520, h = 260) => `<img class="gd-pic" data-pic="${id}" ${sil ? 'data-sil="1"' : ''} data-w="${w}" data-h="${h}" alt="${sil ? 'Silhouette' : esc(s.name)}" width="${w}" height="${h}">`;
    let main = '';
    if (t === 'unseen') {
      main = `<div class="gd-hero"><div class="gd-unk">?</div></div><p>You have not spotted this fish yet. Keep an eye out for dark shapes swimming in the shallows near you: when a school passes close, it shows up here.</p>`;
    } else if (t === 'seen') {
      main = `<div class="gd-hero">${sil(true)}</div>
        <div class="dyk"><b>Where and when</b> ${esc(whereWhen(s))}</div><p>You have seen this fish but not caught one. Catch it to start working out what it is.</p>`;
    } else if (t === 'caught') {
      const as = G.keyedAs(p, id);
      main = `<div class="gd-hero">${photo || sil(true)}</div>
        <p>You have caught this fish but not identified it.${as ? ` You keyed it as <b>${esc(as)}</b>.` : ''}</p>
        <p><button class="btn primary" id="g-rekey">${as ? 'Re-key it' : 'Key it now'}</button></p>
        <div class="dyk"><b>Where and when</b> ${esc(whereWhen(s))}</div>`;
    } else {
      main = `<div class="gd-hero two">${sil(false)}${photo}</div>
        <div class="facts"><div><b>Look for</b>${esc(s.idFeature)}</div><div><b>Habitat</b>${esc(s.habitat)} · ${esc(Object.keys(s.spots).map(k => SPOT_INFO[k].label).join(', '))}</div>
          ${s.feat?.closer ? `<div><b>Look closer</b>${esc(s.feat.closer)}</div>` : ''}<div><b>Longest catch</b>${e.best ?? '?'} cm</div></div>`;
    }
    if (flag) main = `<div class="flagbox"><b>⚠ This doesn't match.</b> ${esc(flag)} <button class="btn small" id="g-rekey">Re-key it</button></div>` + main.replace(/<p><button class="btn primary" id="g-rekey">[^<]*<\/button><\/p>/, '');
    // Mastery checklist (identified fish).
    const meas = e.meas ?? { n: 0, acc: 0 }, dec = e.dec ?? { ok: 0 };
    const check = (ok, text) => `<li class="${ok ? 'ok' : ''}"><span>${ok ? '✔' : '○'}</span>${text}</li>`;
    const list = t !== 'unseen' && t !== 'seen' ? `<h3>Mastery</h3><ul class="mastery">
        ${check(e.ident, 'Identified: solved the key and named it correctly')}
        ${check(meas.acc > 0, `An accurate measure, within 1 cm (${meas.acc} of ${meas.n} so far)`)}
        ${check(dec.ok > 0, s.rules.protected ? 'A correct release (protected: it can never be kept)' : 'A correct keep or release decision')}</ul>` : '';
    // Mastered: stock status, swap, rules and the fact.
    let secrets = '';
    if (master) {
      const sw = s.swap ? SPECIES_BY_ID[s.swap.id] : null;
      secrets = `<h3>Mastered: what you know now</h3>
        <div class="facts">
          <div><b>Stock status</b>${esc(s.statusNote)}</div>
          <div><b>Rules</b>${esc(rule.note)}</div></div>
        <div class="stockrows">${Object.keys(s.spots).map(k => { const v = stockOf(p.stock, k, id); return `<div><span>${esc(SPOT_INFO[k].label)}</span><div class="meter ${v < 45 ? 'low' : ''}"><i style="width:${v}%"></i></div><em>${Math.round(v)}</em></div>`; }).join('')}</div>
        ${sw ? `<div class="dyk"><b>Sustainable swap: ${esc(sw.name)}</b> ${esc(s.swap.reason)}</div>` : ''}
        <div class="dyk"><b>Did you know?</b> ${esc(s.fact)}</div>`;
    } else if (named) {
      secrets = `<h3>Locked until Mastered</h3><div class="locked">🔒 Stock status, the sustainable swap, the rules and the fun fact open when you master this fish.</div>`;
    }
    const title = named ? `${esc(s.name)} <span class="sci">${esc(s.sci)}</span>` : esc(G.labelOf(p, id));
    body.innerHTML = `
      <p><button class="btn small" id="g-list">← All fish</button></p>
      <h2>${title}</h2>
      <p class="g-tier">${pips(t)} <b>${G.TIER_LABEL[t]}</b>${e.caught ? ` · caught ${e.caught.count} time${e.caught.count > 1 ? 's' : ''}` : ''}</p>
      ${main}${list}${secrets}`;
    body.querySelector('#g-list').onclick = () => renderList(region);
    body.querySelector('#g-rekey')?.addEventListener('click', () => renderKey(id));
    fillPictures(body);
    panels.modal.querySelector('.panel').scrollTop = 0;
  };

  // ------------------------------------------------------------ re-key from the guide (stored photo + the 3D model)
  const renderKey = id => {
    dispose();
    const e = G.entryOf(p, id);
    keyCtl = mountKey(body, {
      id, title: `Re-key: ${G.labelOf(p, id)}`, photo: e?.photo,
      sub: 'Use your catch photo and the 3D fish to work through the key again.',
      cancelLabel: 'Cancel', onCancel: () => renderEntry(id),
      onConfirm: leaf => {
        const res = G.recordKey(p, id, leaf, 'guide');
        game.persist(); game.updateStats();
        game.toast(res.correct ? `Identified: ${SPECIES_BY_ID[id].name}. It matches now.` : `Logged as ${SPECIES_BY_ID[leaf].name}. Check the 3D fish against your answers.`, res.correct ? 'good' : 'warn');
        if (res.correct) game.audio.play('newSpecies');
        renderEntry(id);
      },
    });
  };

  if (focus) renderEntry(focus); else renderList(region);
}

/** One row per species for the Fish Guide CSV export. */
export function guideRows(p) {
  return SPECIES.map(s => { const e = G.entryOf(p, s.id), t = G.tierOf(p, s.id); return [G.atLeast(t, 'identified') ? s.name : G.labelOf(p, s.id), G.atLeast(t, 'identified') ? s.sci : '', G.TIER_LABEL[t], e?.best ?? '', e?.meas?.acc ?? 0, e?.dec?.ok ?? 0]; });
}
export { guideCSV };
