// The knot mini-game in the real game, opened directly (nothing is wired into the tackle box yet): tie the uni knot to a Hold.
//   desktop (default, 1280x720): keyboard only (Space and Tab) · mobile (844x390 touch) · narrow (375x812 touch)
// Usage: python3 devserver.py 8451 &  then  URL=http://localhost:8451/ node tests/playtest/knots.mjs [mobile|narrow]   -> playtest-shots/knots[-mobile|-narrow]/*.png
import { launch } from './harness.mjs';
import { KNOTS } from '../../src/content/knots.js';
const kind = process.argv[2] ?? 'desktop', touch = kind !== 'desktop';
const out = 'playtest-shots/knots' + (touch ? `-${kind}` : '');
const t = await launch({ query: 'eco=harbour&quality=low&play=1&time=day', outDir: out, ...(kind === 'mobile' ? { mobile: true } : kind === 'narrow' ? { phone: { w: 375, h: 812 } } : { width: 1280, height: 720 }) });
const { page } = t;
const failedUrls = []; page.on('response', r => { if (r.status() >= 400) failedUrls.push(`${r.status()} ${r.url()}`); });
let fails = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) fails++; };
await t.wait(1000);
await page.evaluate(() => { const g = window.__game; g.panels.close?.(); if (document.body.classList.contains('touch')) document.body.dataset.touchOn = '1'; });
const cdp = touch ? await page.context().newCDPSession(page) : null;
const touchAt = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const box = async sel => { const b = await page.locator(sel).boundingBox(); return { x: b.x, y: b.y, w: b.width, h: b.height, cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; };
const open = (opts = {}) => page.evaluate(async o => { const m = await import(new URL('src/ui/knotUI.js', location.href).href); window.__done = undefined; m.openKnot(window.__game, { ...o, onDone: r => { window.__done = { r }; } }); }, { id: 'uni', mode: 'full', reason: 'board', ...opts });
const phase = () => page.evaluate(() => document.querySelector('.kn-result') ? 'result' : document.querySelector('.kn-opts') ? 'quiz' : document.querySelector('#kn-act-l')?.textContent === 'Pull test' ? 'test' : document.querySelector('#kn-act') ? 'steps' : 'none');
const best = () => page.evaluate(() => window.__game.progress.skills.knots.uni);

// gestures: keyboard (Space) or touch
const tapAct = async () => (touch ? (await box('#kn-act'), page.touchscreen.tap((await box('#kn-act')).cx, (await box('#kn-act')).cy)) : t.tap('Space'));
const holdAct = async ms => {
  if (!touch) return t.hold('Space', ms);
  const b = await box('#kn-act'); await touchAt('touchStart', b.cx, b.cy); await t.wait(ms); await touchAt('touchEnd');
};
const dragBead = async step => {
  const s = await box('#kn-stage'), at = p => [s.x + p[0] * s.w, s.y + p[1] * s.h];
  const [fx, fy] = at(step.from), [tx, ty] = at(step.to);
  await touchAt('touchStart', fx, fy);
  for (let i = 1; i <= 8; i++) { await touchAt('touchMove', fx + (tx - fx) * i / 8, fy + (ty - fy) * i / 8); await t.wait(30); }
  await touchAt('touchEnd');
};
async function doSteps(steps, { dry = false } = {}) {
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    await t.wait(520); // the picture crossfades and the next step shows
    const say = await page.$eval('#kn-say', e => e.textContent);
    if (i === 2 && !dry) await t.shot(`3-step-wraps-${kind}`);
    if (st.gesture === 'drag') { if (touch) await dragBead(st); else await holdAct(1100); }
    else if (st.gesture === 'taps') { for (let n = 0; n < st.n; n++) { await tapAct(); await t.wait(60); if (n === 2 && st.wrap && !dry) await t.shot(`4-step-wraps-3-of-6-${kind}`); } }
    else if (st.gesture === 'wet') { if (dry) await page.click('#kn-sec'); else await tapAct(); }
    else await holdAct(1700);
    if (i === 0) console.log('step 1 text:', say);
  }
}

// ---- 1. a first, dry attempt: Slip, the best is stored as a slip, then a free retry that holds
await open();
await t.wait(500);
check(await phase() === 'quiz', 'the which-knot choice comes first');
await t.shot(`1-quiz-${kind}`);
await page.click('.kn-opt[data-k="blood"]');   // wrong on purpose
const why = await page.$eval('#kn-why', e => e.textContent);
console.log('wrong pick says:', why);
check(/not the job/.test(why) && /Blood knot/.test(why), 'a wrong pick says why in one line');
await page.click('.kn-opt[data-k="uni"]');
await t.wait(500);
check(await phase() === 'steps', 'the right pick starts the steps');
await doSteps(KNOTS.uni.steps, { dry: true });
await t.wait(500);
check(await phase() === 'test', 'after the last step: the pull test');
await tapAct(); await t.wait(1900);
check(await phase() === 'result', 'the result card shows');
let r = await best(); console.log('after the dry tie', JSON.stringify(r));
check(r.best === 'slip' && r.n === 1, 'a dry knot slips and is recorded');
await t.shot(`5-result-slip-${kind}`);
const slipText = await page.$eval('.kn-result', e => e.textContent); console.log('slip card:', slipText);
check(/Slip/.test(slipText) && /not wetted/.test(slipText), 'the slip card names Slip and the reason');

// ---- 2. the free retry: wet it properly, all six wraps: Hold
await page.click('#kn-again'); await t.wait(500);
check(await phase() === 'steps', 'the retry goes straight back to the steps (no quiz)');
await doSteps(KNOTS.uni.steps);
await t.wait(500);
check(await phase() === 'test', 'second tie reaches the pull test');
await t.shot(`6-pull-test-${kind}`);
await tapAct(); await t.wait(500); await t.shot(`7-tug-${kind}`); await t.wait(1500);
check(await phase() === 'result', 'second result card');
r = await best(); console.log('after the wet tie', JSON.stringify(r));
check(r.best === 'hold' && r.n === 2, 'p.skills.knots.uni.best === hold (n = 2)');
const card = await page.$eval('.panel', e => e.textContent);
console.log('result card:', card.replace(/\s+/g, ' ').slice(0, 420));
check(/Hold/.test(card) && /Practised × 2/.test(card) && /worksheet 2\.1\.6/.test(card) && /Source: Animated Knots/.test(card), 'card: Hold, practised × 2, worksheet line, source credit');
await t.shot(`8-result-hold-${kind}`);
await page.click('#kn-done'); await t.wait(300);
check(await page.evaluate(() => window.__done?.r) === 'hold', 'onDone received hold when the panel closed');

// ---- 3. quick re-tie after a Hold, the card, and ?knots=off
await open({ mode: 'quick', reason: 'retie' }); await t.wait(500);
check(await phase() === 'steps', 'quick: no quiz, straight to the steps');
const quick = KNOTS.uni.steps.filter(s => s.quick);
await t.shot(`9-quick-${kind}`);
await doSteps(quick); await t.wait(500);
check(await phase() === 'test', 'quick: gesture plus wrap taps, then the pull test');
await tapAct(); await t.wait(1900);
check(await phase() === 'result' && (await best()).n === 3, 'quick tie records a practice');
await page.click('#kn-done'); await t.wait(300);
await page.evaluate(async () => { const m = await import(new URL('src/ui/knotUI.js', location.href).href); m.openKnotCard(window.__game, 'blood'); }); await t.wait(500);
await t.shot(`10-knot-card-${kind}`);
check(/Where it is used/.test(await page.$eval('.panel', e => e.textContent)), 'knot card shows where it is used');
await page.keyboard.press('Escape'); await t.wait(300);
const off = await page.evaluate(async () => { const m = await import(new URL('src/ui/knotUI.js', location.href).href), g = window.__game; g.settings.knots = 'off'; let got = null; g.progress.skills.knots.palomar = undefined; m.openKnot(g, { id: 'palomar', onDone: r => { got = r; } }); const open = !!document.querySelector('#kn'); g.settings.knots = undefined; return { got, open, best: g.progress.skills.knots.palomar }; });
console.log('knots=off', JSON.stringify(off));
check(off.got === 'hold' && !off.open && off.best.best === 'hold', 'settings.knots=off: onDone(hold) at once, no panel, progress recorded');
const lazy = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /assets\/knots\//.test(e.name)).map(e => e.name.split('/').pop()));
check(lazy.every(n => /^(uni|blood)-/.test(n)), 'only the opened knots\' stills were fetched: ' + [...new Set(lazy.map(n => n.split('-')[0]))].join(','));
const errs = t.errors.filter(e => !/favicon/.test(e));   // the browser's own favicon.ico probe 404s on Pages
console.log('errors', JSON.stringify(errs.slice(0, 5)), 'failed requests', JSON.stringify(failedUrls.slice(0, 5)));
check(errs.length === 0, 'no console errors');
console.log(fails ? `${fails} FAILED` : 'ALL OK');
await t.close();
process.exit(fails ? 1 : 0);
