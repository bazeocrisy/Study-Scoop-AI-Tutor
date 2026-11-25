// Pluggable graders. A grader validates its curriculum data, says what kind of response it expects
// (so unclear speech can be caught before grading), and grades deterministically.
// grade() returns true, false, or null (null = not machine-graded; kept for a parent to review).
import {normalize, numeric} from './language.js';
import {visualSpec} from './visuals.js';

const registry = new Map();
export function registerGrader(name, grader) {
  if (registry.has(name)) throw Error(`Grader already registered: ${name}`);
  registry.set(name, grader);
}
export const graderKinds = () => [...registry.keys()];
export const grader = kind => registry.get(kind);

const isWhole = n => Number.isInteger(n) && n >= 0;

// One whole-number answer: assessment `answer`.
registerGrader('number', {
  validate(item, where, errors) { if (!isWhole(item.answer)) errors.push(`${where}: number answer must be a whole number`); },
  expects: (item, lesson) => ({type: 'number', units: lesson?.language?.units || []}),
  grade: (item, r, lesson) => numeric(r.message, lesson?.language?.units || []) === item.answer
});

// Exact text (usually a choice). Assessment uses `answer`; teaching checks use an `accepted` list,
// which is compared numerically when any accepted value is a number (the original 6-1 rule).
const acceptedOf = item => item.accepted ?? (item.answer === undefined || item.answer === null ? [] : [String(item.answer)]);
const numericAccepted = (item, lesson) => {
  const values = acceptedOf(item).map(x => numeric(x, lesson?.language?.units || [])).filter(Number.isFinite);
  return values.length ? values : null;
};
registerGrader('exact', {
  validate(item, where, errors) {
    const accepted = acceptedOf(item);
    if (!accepted.length || accepted.some(x => typeof x !== 'string' || !normalize(x))) errors.push(`${where}: exact answer needs at least one non-empty accepted answer`);
    if (item.options !== undefined && item.options !== null) {
      if (!Array.isArray(item.options) || item.options.length < 2 || item.options.some(o => typeof o !== 'string')) errors.push(`${where}: options must list at least two strings`);
      else if (!item.options.some(o => accepted.map(normalize).includes(normalize(o)))) errors.push(`${where}: no option matches an accepted answer`);
    }
  },
  expects: (item, lesson) => numericAccepted(item, lesson)
    ? {type: 'number', units: lesson?.language?.units || []}
    : {type: 'choice', options: item.options || [], accepted: acceptedOf(item)},
  grade(item, r, lesson) {
    const values = numericAccepted(item, lesson);
    if (values) return values.includes(numeric(r.message, lesson?.language?.units || []));
    return acceptedOf(item).some(x => normalize(x) === normalize(r.message));
  }
});

// Build a connected figure of `answer` squares on the item's own grid canvas.
registerGrader('build', {
  validate(item, where, errors) {
    if (!isWhole(item.answer) || item.answer < 1) errors.push(`${where}: build answer must be a positive whole number`);
    const v = item.visual;
    if (!v || visualSpec(v)?.capacity?.(v) === undefined || v.mode !== 'build') return errors.push(`${where}: build needs a build-mode grid visual`);
    if (visualSpec(v).capacity(v) < item.answer) errors.push(`${where}: build canvas is smaller than the requested answer`);
  },
  expects: () => ({type: 'any'}),
  grade: (item, r) => visualSpec(item.visual).buildIsValid(item.visual, r.cells, item.answer)
});

// Open explanation: never auto-graded.
registerGrader('reason', {
  validate() {},
  expects: () => ({type: 'text'}),
  grade: () => null
});
