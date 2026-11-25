// Golden transcripts: the generalised engine must reproduce the baseline (commit e2b0360) exactly.
// Every field the baseline produced in each output and state is compared with deepStrictEqual.
// Fields added by Assignment 002B (for example state.completed or summary.parentNotice) are allowed.
import test from 'node:test';
import assert from 'node:assert/strict';
import lesson from '../curriculum/6-1.json' with {type: 'json'};
import * as controller from '../engine/controller.js';
import golden from './golden/area-6-1.baseline.json' with {type: 'json'};
import {scenarios, runScenario} from './golden/scenarios.js';

function project(actual, expected) {
  if (expected === null || typeof expected !== 'object') return actual;
  if (Array.isArray(expected)) return Array.isArray(actual) ? expected.map((e, i) => project(actual[i], e)) : actual;
  if (actual === null || typeof actual !== 'object') return actual;
  return Object.fromEntries(Object.keys(expected).map(k => [k, project(actual[k], expected[k])]));
}
// JSON round trip drops undefined values exactly as the recorded baseline did.
const plain = x => JSON.parse(JSON.stringify(x));

test('golden fixture covers every scenario', () => {
  assert.deepEqual(golden.transcripts.map(t => t.name), scenarios.map(s => s.name));
  assert.ok(golden.transcripts.reduce((n, t) => n + t.turns.length, 0) >= 100);
});
for (const [i, scenario] of scenarios.entries()) {
  test(`golden transcript: ${scenario.name}`, () => {
    const turns = plain(runScenario(controller, lesson, scenario));
    const expected = golden.transcripts[i].turns;
    assert.equal(turns.length, expected.length);
    turns.forEach((turn, n) => assert.deepStrictEqual(project(turn, expected[n]), expected[n], `turn ${n + 1}: ${JSON.stringify(expected[n].input).slice(0, 80)}`));
  });
}

// Worker compatibility: replay the golden scenarios through the protected Worker and its Durable
// Object coordinator (in-memory storage). Outputs must match the baseline exactly as in the browser.
import {createHmac} from 'node:crypto';
import worker, {TutorSessions} from '../cloudflare/tutor-worker/worker.js';
const secret = 'z'.repeat(48);
for (const [i, scenario] of scenarios.entries()) {
  test(`golden transcript through Worker: ${scenario.name}`, async t => {
    let clock = Date.now();
    t.mock.method(Date, 'now', () => (clock += 1000)); // stay clear of the 300 ms answer throttle
    const jti = 'goldenWorker' + String(i).padStart(10, '0');
    const payload = Buffer.from(JSON.stringify({lesson: '6-1', jti, exp: Math.floor(Date.now() / 1000) + 3500})).toString('base64url');
    const token = payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
    const data = new Map();
    const ctx = {blockConcurrencyWhile: fn => fn(), storage: {get: async k => structuredClone(data.get(k)), put: async (k, v) => data.set(k, structuredClone(v)), setAlarm: async () => {}, getAlarm: async () => null, list: async () => data, delete: async k => data.delete(k)}};
    const env = {SESSION_SIGNING_SECRET: secret, ALLOWED_ORIGINS: 'https://allowed.test', AI_ENABLED: 'false'};
    const coordinator = new TutorSessions(ctx, env); env.TUTOR_SESSIONS = {idFromName: () => 1, get: () => coordinator};
    const expected = golden.transcripts[i].turns;
    for (const [n, turn] of expected.entries()) {
      const body = {...turn.input, requestId: `goldenRequest${i}x${String(n).padStart(6, '0')}`};
      const response = await worker.fetch(new Request('https://tutor.test/api/tutor', {method: 'POST', headers: {origin: 'https://allowed.test', 'content-type': 'application/json', authorization: 'Bearer ' + token}, body: JSON.stringify(body)}), env);
      const got = await response.json();
      if (turn.error) { assert.ok(response.status >= 400, `turn ${n + 1} should be rejected`); continue; }
      assert.equal(response.status, 200, `turn ${n + 1}: ${JSON.stringify(got)}`);
      assert.deepStrictEqual(project(got, turn.output), turn.output, `turn ${n + 1}`);
      assert.deepStrictEqual(project(data.get('s:' + jti).state, turn.state), turn.state, `turn ${n + 1} saved state`);
    }
  });
}
