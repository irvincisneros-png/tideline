// The words of the teachers' opening, resolved for the current build (pure: no DOM, unit-tested in tests/intro.test.mjs).
// A line is { who: 'mrcisneros' | 'mrwilson', text, alt? } (content/teachers.js). With WILSON_OK false a Mr Wilson line is spoken by Mr Cisneros (its `alt`, if it has one).
import { WILSON_OK, INTRO } from '../content/teachers.js';
import { esc } from './panels.js';

export const TEACHER_NAMES = { mrcisneros: 'Mr Cisneros', mrwilson: 'Mr Wilson' };

/** The line as it is said in this build: { who, text }. */
export function resolveLine(line, wilsonOk = WILSON_OK) {
  if (line.who === 'mrwilson' && !wilsonOk) return { who: 'mrcisneros', text: line.alt ?? line.text };
  return { who: line.who, text: line.text };
}
/** A beat's lines, resolved. beat = a key of INTRO that holds an array (meet, send). */
export const beatLines = (beat, wilsonOk = WILSON_OK) => INTRO[beat].map(l => resolveLine(l, wilsonOk));
/** {name} / {min} / {cm} filled in. The text is data written by the owner, the values are numbers or the (escaped) angler name. */
export const fill = (text, vars = {}) => text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** An inline tip for the catch panel: "<b>Mr Wilson:</b> text" (values escaped by the caller where they are free text). */
export function teacherLine(line, vars = {}, wilsonOk = WILSON_OK) {
  const r = resolveLine(line, wilsonOk);
  return `<b>${esc(TEACHER_NAMES[r.who])}:</b> ${esc(fill(r.text, vars))}`;
}
