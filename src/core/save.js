// Local progress: field-guide journal and the catch log. No accounts, nothing leaves the device.
const KEY = 'tideline.progress.v1';
// stock: stock health (0-100) per 'spot:species', seeded from NSW stock status when first needed. steward: litter pulled out of the water. gear: last rig and bait.
const blank = () => ({ journal: {}, catches: [], stock: {}, steward: { points: 0, litter: 0 }, gear: null });

export function loadProgress() {
  try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return blank(); }
}
export function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); return true; }
  catch {
    // Quota: drop the oldest photos and retry once.
    try {
      const entries = Object.entries(p.journal).sort((a, b) => (a[1].time ?? 0) - (b[1].time ?? 0));
      for (const [, e] of entries.slice(0, Math.ceil(entries.length / 2))) delete e.photo;
      localStorage.setItem(KEY, JSON.stringify(p)); return true;
    } catch { return false; }
  }
}
export function resetProgress() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

/** CSV export of the field guide and catch log for the class. */
export function progressCSV(p, speciesById) {
  const rows = [['type', 'site', 'species', 'scientific name', 'length cm', 'kept', 'legal decision', 'date']];
  for (const [key, e] of Object.entries(p.journal)) {
    const [eco, id] = key.split(':');
    const s = speciesById(eco, id);
    rows.push(['journal', eco, s?.common ?? id, s?.sci ?? '', '', '', '', new Date(e.time ?? Date.now()).toISOString().slice(0, 10)]);
  }
  for (const c of p.catches ?? []) {
    const s = speciesById(c.eco, c.id);
    rows.push(['catch', c.eco, s?.common ?? c.id, s?.sci ?? '', c.length, c.kept ? 'kept' : 'released', c.correct ? 'correct' : 'wrong', new Date(c.time).toISOString().slice(0, 10)]);
  }
  return rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}
