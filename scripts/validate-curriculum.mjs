// Validates the lesson registry and every registered lesson against the versioned schema.
// Exits non-zero on any error. Never writes files.
import {readFile} from 'node:fs/promises';
import {validateLesson, validateRegistry} from '../engine/schema.js';
const dir = new URL('../curriculum/', import.meta.url);
const registry = JSON.parse(await readFile(new URL('registry.json', dir), 'utf8'));
const problems = validateRegistry(registry).errors.map(e => 'registry: ' + e);
for (const entry of registry.lessons || []) {
  let lesson;
  try { lesson = JSON.parse(await readFile(new URL(entry.file, dir), 'utf8')); } catch (e) { problems.push(`${entry.file}: ${e.message}`); continue; }
  if (lesson.id !== entry.id) problems.push(`${entry.file}: id "${lesson.id}" does not match registry id "${entry.id}"`);
  for (const e of validateLesson(lesson).errors) problems.push(`${entry.file}: ${e}`);
  if (!problems.length) console.log(`OK ${entry.id}: ${lesson.concepts.length} concepts, ${lesson.assessment.length} assessment items`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Curriculum registry and lessons are valid; no files written.');
