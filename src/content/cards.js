// A species card for a line-caught animal: the facts that must match the rules (size, status, ID feature) come from fishing/species.js, so they can never disagree with the catch tables.
// Used by the Offshore Reef and the River (the older sites have their own copies of this helper). Data only, Australian English.
import { SPECIES_BY_ID } from '../fishing/species.js';

export const STOCK_CODE = { sustainable: 'LC', recovering: 'NT', depleting: 'VU', depleted: 'EN', undefined: 'DD' };
export function fishCard(id, o) {
  const s = SPECIES_BY_ID[id];
  return {
    id, habitat: 'fishing', common: s.name, sci: s.sci, group: o.group ?? 'fish', status: s.statusNote, statusCode: STOCK_CODE[s.status] ?? 'DD',
    size: o.size ?? `Usually ${s.length[0]}–${s.length[1]} cm`, ...o,
    didYouKnow: o.didYouKnow ?? s.fact, spot: o.spot ?? s.idFeature,
    sources: o.sources ?? ['TideLine species data (NSW DPIRD size and bag limits)', 'NSW DPIRD – recreational fishing species guide'],
  };
}
