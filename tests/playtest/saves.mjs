// Scripted saves for the play-tests (phase 7): put the page's progress into a chosen state through the game's own modules, then persist it.
//   await nearComplete(page, { leave: 'carp' })   every species Mastered except `leave` (Identified), healthy stocks, a believable logbook (releases, accurate measures, litter, tags)
//   await finishLast(page, 'carp')                the last Mastery through the Fish Guide functions (key solved + accurate measure + a qualifying decision)
//   await caughtAll(page)                         every species Caught (the milestone), none Mastered
export async function nearComplete(page, { leave = 'carp', bay = 88 } = {}) {
  return page.evaluate(async ([leave, bay]) => {
    const base = new URL('src/', location.href).href, G = await import(base + 'fishing/guide.js'), SP = await import(base + 'fishing/species.js');
    const g = window.__game, p = g.progress;
    p.angler = { name: 'Kai', skin: 0xc58c5e, hairStyle: 'short', hair: 0x4a2f1d, hatStyle: 'straw', hat: 0xe9d9a6, sunnies: 'none', pattern: 'plain', shirt: 0xf0715a, shorts: 0x2f5496, rod: 0x3b525c };
    g.angler.setAppearance(p.angler);
    p.catches = [];
    let t = Date.now() - 1e6;
    for (const s of SP.SPECIES) {
      const e = (p.guide.e[s.id] ??= {});
      e.seen = { t, src: 'test' }; e.caught = { t, n: p.guide.nextN++, count: 3 }; e.ident = true; e.best = s.length[1] - 2;
      if (s.id !== leave) { e.meas = { n: 2, acc: 2 }; e.dec = { ok: 2, bad: 0 }; e.mastered = t; }
      for (let i = 0; i < 4; i++) p.catches.push({ eco: 'rocky', id: s.id, label: s.name, length: s.length[0] + 2, measured: s.length[0] + 2, accurate: i !== 3, kept: false, legal: true, correct: true, time: t += 1000, spot: Object.keys(s.spots)[0], tide: 'rising', daytime: 'day', wet: true, air: 6, tagged: i === 0 && s.id.length % 3 === 0 });
    }
    for (const s of SP.SPECIES) for (const spot of Object.keys(s.spots)) (p.stock ??= {})[`${spot}:${s.id}`] = bay;
    p.steward.litter = 14; p.steward.clean = 3; p.steward.checks = 3; p.steward.fines = 0; p.steward.safety = 0;
    p.econ.tags = Array.from({ length: 9 }, (_, i) => ({ no: `T-${1001 + i}`, id: 'tailor', day: 1, t, length: 30, spot: 'jetty', recaptured: false }));
    p.ending = { milestone: Date.now() - 5e5, awards: null };   // a student this far on has already seen the 100%-Caught celebration
    g.persist(); g.bindMenu(); g.updateProgressSummary();
    return { mastered: SP.SPECIES.filter(s => G.tierOf(p, s.id) === 'mastered').length, total: SP.SPECIES.length, bay: G.bayHealth(p) };
  }, [leave, bay]);
}
export async function finishLast(page, id = 'carp') {
  return page.evaluate(async id => {
    const base = new URL('src/', location.href).href, G = await import(base + 'fishing/guide.js');
    const g = window.__game, p = g.progress;
    G.recordMeasure(p, id, true); G.recordDecision(p, id, true, true); g.persist(); g.updateProgressSummary();
    return G.tierOf(p, id);
  }, id);
}
export async function caughtAll(page) {
  return page.evaluate(async () => {
    const base = new URL('src/', location.href).href, G = await import(base + 'fishing/guide.js'), SP = await import(base + 'fishing/species.js');
    const g = window.__game, p = g.progress;
    p.angler ??= { name: 'Kai', skin: 0xc58c5e, hairStyle: 'short', hair: 0x4a2f1d, hatStyle: 'straw', hat: 0xe9d9a6, sunnies: 'none', pattern: 'plain', shirt: 0xf0715a, shorts: 0x2f5496, rod: 0x3b525c };
    for (const s of SP.SPECIES) G.recordCatch(p, s.id, { length: s.length[0] + 3 });
    p.ending = { milestone: null, awards: null }; g.persist(); g.updateProgressSummary();
    return SP.SPECIES.filter(s => G.tierOf(p, s.id) === 'caught').length;
  });
}
