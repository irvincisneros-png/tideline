# Knot mini-game: wiring edits for the lead

Built and tested in isolation (nothing below is applied yet). New files: `src/content/knots.js`, `src/fishing/knots.js`, `src/ui/knotUI.js`, `knots.css`, `tests/knots.test.mjs`, `tests/playtest/knots.mjs`. Apply the edits in this order. Each is small.

Public API of `src/ui/knotUI.js` (all take the `game` object):
- `openKnot(game, { id, mode: 'full' | 'quick', reason: 'board' | 'retie' | 'mission', onDone(result) })`. `onDone` runs when the panel closes, with the last pull-test result (`'hold' | 'slip' | 'break'`), or `null` if it was closed before a pull test. It records the result itself (`recordKnot`), calls `game.persist()` (which sets `missionsDirty`, so Mission 2 ticks over by itself) and never touches the fight. `?knots=off` / `settings.knots === 'off'` calls `onDone('hold')` at once with no panel and records a Hold without counting a practice. `?knots=quick` forces the quick version; a `'quick'` request for a knot that has never held runs the full version.
- `openKnotCard(game, id, { onBack })`: the diagram, its job, where it is used, practised x n, best result, a "Tie it" button.
- `openKnotsList(game, { onBack })`: all four knots with best result and an Open button (the tackle box "Knots" page).

Pure helpers in `src/fishing/knots.js`: `knotResult`, `resultReason`, `RESULT_WORDS` (the one place the three words live), `recordKnot`, `quickAllowed`, `canPromptRetie`, `markRetie`, `SPARE_TOAST`, `RETIE_GAP_MS`, `knotsMode`, `chooseMode`.

## 1. CSS link (`index.html`, line 27)

After `<link rel="stylesheet" href="styles.css" />` add:

```html
  <link rel="stylesheet" href="knots.css" />
```

(`teacher.html` does not need it.) Add `knots.css` to the service worker / pre-cache list if the game has one.

## 2. `FEATURES.knots = true` (`src/content/missions.js`, line 15)

```js
export const FEATURES = { knots: true, snags: false };
```

(Leave `snags` as the snag agent set it.) Mission 2's first step then stops being hidden. Check `tests/missions.test.mjs` for any assertion that Mission 2 is hidden while `FEATURES.knots` is false; the test flips the object itself, so it should be fine.

## 3. `?knots=full|quick|off` and `settings.knots` (`src/core/settings.js`)

`loadSettings` lives in `src/core/settings.js` (not `main.js`). In `DEFAULTS` add `knots: 'full',` (next to `style`). In `loadSettings`, right after the `style` lines, add:

```js
  const kn = new URLSearchParams(location.search).get('knots');
  if (kn === 'full' || kn === 'quick' || kn === 'off') out.knots = kn; // teacher control: the full guided knot, the 10 s quick re-tie only, or skip the knot game (a Hold is credited)
```

`openKnot` also reads `?knots=` itself through `knotsMode(settings, params)`, so the URL wins even if you skip this edit; the edit makes the setting visible on `game.settings` and saved with the others. Optional: a Settings row (`panels.js`, in `settings()`) with a three-way select, `onChange('knots', value)`.

Add a row to the deep-link table in `teacher.html` (after the `&quality=` row):

```html
        <tr><th><code>&amp;knots=</code></th><td><code>full</code> (default: the guided knot the first time, a 10-second quick re-tie after a Hold), <code>quick</code> (always the quick version) or <code>off</code> (skip the knot game; a Hold is credited so Mission 2 still moves on). The knot never changes how a fish fights. Students should still tie each knot three times for real (worksheet 2.1.6).</td></tr>
```

## 4. Tackle box "Knots" page

`src/fishing/gear.js`, in `tackleBoxHTML`, the actions line (about line 112): add a button before Done.

```js
    <p class="tb-actions"><button class="btn" id="tb-knots">🪢 Knots</button> <button class="btn primary" id="tb-done">Done <kbd>T</kbd></button></p>
```

`src/main.js`: add the import `import { openKnotsList } from './ui/knotUI.js';` and in `tackleBox()` after `this.panels.body.querySelector('#tb-done').onclick = ...` add:

```js
      this.panels.body.querySelector('#tb-knots').onclick = () => {
        this.tackleOpen = false;   // openKnotsList replaces the panel body and its onClose, so the "Tackle set" toast would not fire: clear the flag here
        openKnotsList(this, { onBack: () => this.tackleBox() });
      };
```

Note: `panels.open()` replaces the previous `onClose`, so after going into the Knots page the tackle-box "Tackle set" toast is not shown. That is intended. Never call a knot from a rig or bait change.

## 5. Mr Wilson's knot board (`src/npc/talk.js`)

In `menu(npc)`, next to the other per-NPC entries (about line 72) add:

```js
    if (npc.id === 'mrwilson') out.push({ id: 'knots', label: 'The knot board' });
```

Add the handler method next to `tally` (the dialogue box z-index 35 sits over the modal z-index 30, so hide it first; `openKnotCard`'s `onClose` runs exactly once when the card, or the game its Tie it button opens, closes, and the talk menu then resumes):

```js
  /** Mr Wilson's knot board: pick a knot, open its card, tie it (the board is always the full version). */
  async knots(npc, who) {
    const g = this.game, dlg = g.dialogue;
    const i = await dlg.say({ who, text: this.fmt('Four knots on the board, {name}. Which one will you tie?'), choices: [...KNOT_ORDER.map(id => KNOTS[id].name), 'Back'], cancel: KNOT_ORDER.length });
    if (i >= KNOT_ORDER.length) return;
    dlg.hide();
    await new Promise(done => openKnotCard(g, KNOT_ORDER[i], { onClose: done }));
  }
```

Imports for `talk.js`: `import { KNOTS, KNOT_ORDER } from '../content/knots.js'; import { openKnotCard } from '../ui/knotUI.js';`

Mission 2 can send the student to the board: `mission` is a valid `reason` (`openKnot(game, { id: 'uni', mode: 'full', reason: 'mission' })`) if the radio hand-in wants to open it directly.

## 6. The re-tie hook, `onLineCut(reason)` (`src/main.js`)

The snag agent adds `game.onLineCut(reason)` (called with `'snag'` or `'bolt'`/`'reef'` from the fight). Implement it as follows (imports: `import { openKnot } from './ui/knotUI.js'; import { canPromptRetie, markRetie, chooseMode, knotsMode, SPARE_TOAST } from './fishing/knots.js';`):

```js
  /** A line was cut (snag or reef break-off): offer the re-tie. One prompt per 3 minutes; inside that window the toast says a spare was already tied. Never on a rig change; never in the fight. */
  onLineCut(reason) {
    const p = this.progress, now = Date.now(), setting = knotsMode(this.settings, new URLSearchParams(location.search));
    if (setting === 'off') return;
    if (!canPromptRetie(p, now)) { this.toast(SPARE_TOAST); return; }
    const open = () => {
      if (this.panels.isOpen) { setTimeout(open, 600); return; }   // after the catch flow or any other panel
      markRetie(p, now); this.persist();
      openKnot(this, { id: 'uni', mode: chooseMode({ setting, reason: 'retie', p, id: 'uni' }), reason: 'retie' });
    };
    open();
  }
```

`mode` is 'quick' after a prior Hold of the uni knot, 'full' otherwise. The knot is always the uni (the hook knot); change `id` if a lure rig should ask for the palomar. Closing the panel with Esc counts as done: the player may skip the re-tie, since a knot never affects anything else. If `onLineCut` can fire while a fish is still being unhooked or a toast sequence is running, call it after those finish.

## 7. Existing tests that scan `src/content/*.js` as species files

`tests/content.test.mjs` (line 7) and `tests/audio.test.mjs` (line 41) read every file in `src/content/` and expect `export const species`. `src/content/knots.js` exports `species = []` so both pass untouched. When you next edit those two tests, add `'knots.js'` to their exclusion lists and then delete the `species` export from `src/content/knots.js`.

## 8. Notes

- The pull-test words are only in `RESULT_WORDS` (`src/fishing/knots.js`). The owner has still to confirm Hold / Slip / Break against worksheet 2.1.6 (H/S/B).
- `p.skills.retieAt` (ms timestamp) is the only new save field; `p.skills.knots[id] = { best, n }` is as specified. `migrateProgress` keeps unknown `skills` keys (it spreads `v`), but check `save.js` line 125 still does after the snag agent's edits.
- Results use words only. There is no strength percentage anywhere. The card credits the source, shows the over/under notes in a collapsible, and says "Tie it three times for real (worksheet 2.1.6)".
- Owner still to check every still against the video.
