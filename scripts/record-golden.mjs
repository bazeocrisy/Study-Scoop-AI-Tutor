// Records golden transcripts by running tests/golden/scenarios.js against a controller and lesson.
// Usage: node scripts/record-golden.mjs <controller.js> <lesson.json> <output.json>
// The committed baseline was recorded against the unmodified engine at commit e2b0360.
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {scenarios, runScenario} from '../tests/golden/scenarios.js';
const [controllerPath, lessonPath, out] = process.argv.slice(2);
if (!controllerPath || !lessonPath || !out) throw Error('Usage: record-golden.mjs <controller.js> <lesson.json> <output.json>');
const controller = await import(pathToFileURL(resolve(controllerPath)).href);
const lesson = JSON.parse(await readFile(lessonPath, 'utf8'));
const transcripts = scenarios.map(s => ({name: s.name, turns: runScenario(controller, lesson, s)}));
await writeFile(out, JSON.stringify({recordedFrom: controllerPath, transcripts}, null, 1) + '\n');
console.log(`Recorded ${transcripts.length} scenarios, ${transcripts.reduce((n, t) => n + t.turns.length, 0)} turns.`);
