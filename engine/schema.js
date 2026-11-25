// Versioned curriculum schema. A lesson that fails validation is never taught.
import {grader, graderKinds} from './graders.js';
import {validateVisual} from './visuals.js';
import {normalize} from './language.js';

export const SCHEMA_VERSION = 1;
export const LESSON_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ITEM_ID = /^[a-zA-Z0-9_-]{1,40}$/;
const TOP_KEYS = ['schemaVersion', 'id', 'title', 'subject', 'grade', 'version', 'source', 'presentation', 'language', 'remediation', 'concepts', 'assessment'];
const CONCEPT_KEYS = ['id', 'name', 'teach', 'alternative', 'visual', 'check', 'followUp', 'example', 'requires'];
const ITEM_KEYS = ['id', 'skill', 'question', 'visual', 'answer', 'kind', 'options', 'feedback'];
const str = x => typeof x === 'string' && x.trim().length > 0;

// Teaching checks reuse assessment graders. A build check's canvas is the concept's own visual.
export const checkItem = concept => ({...concept.check, visual: concept.check.visual ?? concept.visual});

export function validateLesson(lesson) {
  const errors = [];
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) return {ok: false, errors: ['lesson must be an object']};
  if (lesson.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  for (const k of Object.keys(lesson)) if (!TOP_KEYS.includes(k)) errors.push(`unknown lesson field "${k}"`);
  if (!LESSON_ID.test(lesson.id || '')) errors.push('id must be lowercase letters, digits and hyphens');
  for (const k of ['title', 'subject']) if (!str(lesson[k])) errors.push(`${k} is required`);
  if (!Number.isInteger(lesson.grade) || lesson.grade < 0 || lesson.grade > 12) errors.push('grade must be a whole number from 0 to 12');
  if (lesson.presentation !== undefined) {
    if (typeof lesson.presentation !== 'object' || Object.values(lesson.presentation).some(v => typeof v !== 'string')) errors.push('presentation values must be strings');
  }
  if (lesson.language !== undefined && (!Array.isArray(lesson.language.units) || lesson.language.units.some(u => !str(u)))) errors.push('language.units must be a list of words');
  const max = lesson.remediation?.maxAttempts;
  if (lesson.remediation !== undefined && (!Number.isInteger(max) || max < 2 || max > 5)) errors.push('remediation.maxAttempts must be 2 to 5');
  if (lesson.remediation?.assessWhenUnresolved !== undefined && typeof lesson.remediation.assessWhenUnresolved !== 'boolean') errors.push('remediation.assessWhenUnresolved must be true or false');

  if (!Array.isArray(lesson.concepts) || !lesson.concepts.length) errors.push('concepts must be a non-empty list');
  if (!Array.isArray(lesson.assessment) || !lesson.assessment.length) errors.push('assessment must be a non-empty list');
  if (errors.length && (!Array.isArray(lesson.concepts) || !Array.isArray(lesson.assessment))) return {ok: false, errors};

  const seen = new Set();
  lesson.concepts.forEach((c, i) => {
    const w = `concept ${c?.id ?? i + 1}`;
    if (!c || typeof c !== 'object') return errors.push(`${w}: must be an object`);
    for (const k of Object.keys(c)) if (!CONCEPT_KEYS.includes(k)) errors.push(`${w}: unknown field "${k}"`);
    if (!ITEM_ID.test(c.id || '')) errors.push(`${w}: invalid id`);
    if (seen.has(c.id)) errors.push(`${w}: duplicate id`);
    for (const k of ['name', 'teach', 'alternative']) if (!str(c[k])) errors.push(`${w}: ${k} is required`);
    validateVisual(c.visual, w, errors);
    if (!c.example || !str(c.example.text)) errors.push(`${w}: example.text is required`);
    else validateVisual(c.example.visual, `${w} example`, errors);
    const requires = c.requires ?? [];
    if (!Array.isArray(requires)) errors.push(`${w}: requires must be a list`);
    else for (const r of requires) if (!seen.has(r)) errors.push(`${w}: requires "${r}", which is not an earlier concept`);
    seen.add(c.id);
    if (!c.check || !str(c.check.question)) return errors.push(`${w}: check.question is required`);
    const g = grader(c.check.kind);
    if (!g) return errors.push(`${w}: unknown check kind "${c.check.kind}" (known: ${graderKinds().join(', ')})`);
    if (c.check.kind === 'reason') {
      const f = c.followUp;
      if (!f || !str(f.question) || !Array.isArray(f.options) || f.options.length < 2 || !f.options.some(o => normalize(o) === normalize(f.answer)))
        errors.push(`${w}: reasoning checks need a follow-up question whose answer is one of its options`);
    } else {
      if (c.followUp !== undefined) errors.push(`${w}: only reasoning checks may have a follow-up`);
      g.validate(checkItem(c), `${w} check`, errors);
    }
  });

  const ids = new Set();
  lesson.assessment.forEach((q, i) => {
    const w = `assessment ${q?.id ?? i + 1}`;
    if (!q || typeof q !== 'object') return errors.push(`${w}: must be an object`);
    for (const k of Object.keys(q)) if (!ITEM_KEYS.includes(k)) errors.push(`${w}: unknown field "${k}"`);
    if (!ITEM_ID.test(q.id || '')) errors.push(`${w}: invalid id`);
    if (ids.has(q.id) || seen.has(q.id)) errors.push(`${w}: duplicate id`);
    ids.add(q.id);
    if (!str(q.skill)) errors.push(`${w}: skill is required`);
    if (!str(q.question)) errors.push(`${w}: question is required`);
    validateVisual(q.visual, w, errors);
    const g = grader(q.kind);
    if (!g) errors.push(`${w}: unknown kind "${q.kind}" (known: ${graderKinds().join(', ')})`);
    else g.validate(q, w, errors);
  });
  return {ok: errors.length === 0, errors};
}

export function assertLesson(lesson) {
  const {ok, errors} = validateLesson(lesson);
  if (!ok) throw Error('Invalid lesson: ' + errors.slice(0, 10).join('; '));
  return lesson;
}

// Registry: {schemaVersion, default, lessons:[{id, file, title}]}.
export function validateRegistry(registry) {
  const errors = [];
  if (!registry || registry.schemaVersion !== SCHEMA_VERSION) errors.push(`registry schemaVersion must be ${SCHEMA_VERSION}`);
  const list = registry?.lessons;
  if (!Array.isArray(list) || !list.length) errors.push('registry must list at least one lesson');
  else {
    const ids = new Set();
    for (const l of list) {
      if (!LESSON_ID.test(l?.id || '')) errors.push(`registry lesson id "${l?.id}" is invalid`);
      if (ids.has(l?.id)) errors.push(`registry lesson "${l.id}" is listed twice`);
      ids.add(l?.id);
      if (typeof l?.file !== 'string' || !/^[a-z0-9][a-z0-9.-]*\.json$/.test(l.file)) errors.push(`registry lesson "${l?.id}" needs a plain .json file name`);
      if (!str(l?.title)) errors.push(`registry lesson "${l?.id}" needs a title`);
    }
    if (!ids.has(registry.default)) errors.push('registry default must be a listed lesson');
  }
  return {ok: errors.length === 0, errors};
}
