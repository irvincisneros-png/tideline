// Credits and the data-source notes, shared by the in-game credits screen (ui/credits.js) and mirrored by hand on teacher.html.
export const VERSION = '1.0';
export const SEA_COUNTRY_NOTE = 'Sea Country content pending AEO/AECG review';
export const CREDITS = [
  { h: 'TideLine', lines: ['A cosy fishing game on the Illawarra coast.', 'Made for NSW Stage 5 Aquatic Technology 7–10, option Aquatic harvesting.'] },
  { h: 'Where the facts come from', lines: [
    'Size, bag and possession limits, the fee and the safety rules: NSW DPIRD (Department of Primary Industries and Regional Development) and the Module 2 teacher worksheets.',
    'Stock status: the Status of Australian Fish Stocks reports (SAFS, fish.gov.au), 6th edition.',
    'Seafood choices: the GoodFish guide (Australian Marine Conservation Society). The game points to it and does not copy its ratings.',
    'Limits change. Always check FishSmart or the DPIRD website before you fish.',
  ] },
  { h: 'Sea Country', lines: [`${SEA_COUNTRY_NOTE}.`, 'The Sea Country ranger, her story cards and the cultural fishing quiz use only the Module 2 worksheets and have not yet been checked by the school Aboriginal Education Officer (AEO) or the local Aboriginal Education Consultative Group (AECG). Please check them before a class uses them.'] },
  { h: 'Built with', lines: [
    'The DeepSwell engine: vanilla JavaScript modules and Three.js r169 (MIT licence). There is no build step and nothing leaves the device.',
    'All models, textures, sound effects and portraits are made in code or in Blender for this game. No third-party art.',
    'Music is by other artists, shared under free licences (below). It is streamed only when you play, and can be turned off in Settings.',
    'Cosy art direction inspired by the quiet fishing games we love.',
  ] },
  { h: 'Music', lines: ["Music: 'Indie Meditations' by YannZ (CC BY 4.0, opengameart.org); 'Gone Fishin'', 'Beary Fishy' and 'The Reel Winner' by Memoraphile (CC0); 'Slow Stride' (CC0, opengameart.org)."] },
  { h: 'The people of the coast', lines: ['Mitra, Old Tam, Dr Priya, Ranger Jo, Mika, Sione, Bev, Fatima, Nell and the Fisheries Officer are original characters.'] },
  { h: 'Thank you', lines: ['To every student who releases the small ones.'] },
];
