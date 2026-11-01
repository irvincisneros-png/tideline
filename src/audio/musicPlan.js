// Which music plays where: pure functions (no audio), unit-tested in tests/music.test.mjs.
// Files live in assets/music/ and are only fetched after the first user gesture, one at a time.

/** Track id -> file and title. All loops have a 2 s crossfade baked into the tail so they repeat without a seam. */
export const TRACKS = {
  menu: { file: 'assets/music/menu.m4a', title: 'Beary Fishy (menu)' },
  beach: { file: 'assets/music/beach.m4a', title: 'The Beach' },
  oasis: { file: 'assets/music/oasis.m4a', title: 'The Oasis (Resting Place)' },
  village: { file: 'assets/music/village.m4a', title: 'The Village' },
  raft: { file: 'assets/music/raft.m4a', title: 'The Raft on the Ocean' },
  grassland: { file: 'assets/music/grassland.m4a', title: 'The Grassland' },
  slowstride: { file: 'assets/music/slowstride.m4a', title: 'Slow Stride (night)' },
  gonefishin: { file: 'assets/music/gonefishin.m4a', title: "Gone Fishin' (awards night)" },
  reelwinner: { file: 'assets/music/reelwinner.m4a', title: 'The Reel Winner (jingle)', jingle: true },
};

/** The daytime track for each site (ecosystem id). */
export const SITE_TRACK = { rocky: 'beach', seagrass: 'oasis', harbour: 'village', reef: 'raft', river: 'grassland' };

/**
 * The looping track that should be playing.
 * @param {{ mode: string, site?: string, time?: 'dawn'|'day'|'dusk'|'night' }} s  mode = menu | land | ceremony | loading
 * @returns {string|null} a key of TRACKS, or null for silence (still loading)
 */
export function pickTrack({ mode, site, time } = {}) {
  if (mode === 'ceremony') return 'gonefishin';
  if (mode === 'menu') return 'menu';
  if (mode !== 'land') return null;
  if (time === 'night') return 'slowstride';
  return SITE_TRACK[site] ?? 'beach';
}

/** How loud the music is while things are happening: 1 = full. The lowest applies. */
export function duckLevel({ dialogue = false, fight = false, jingle = false, panel = false } = {}) {
  if (jingle) return 0.2;
  if (dialogue) return 0.4;
  if (fight) return 0.5;
  if (panel) return 0.8;
  return 1;
}

/** Is a new-species jingle due? (the first time a species is caught) */
export const jingleFor = event => (event === 'newSpecies' ? 'reelwinner' : null);
