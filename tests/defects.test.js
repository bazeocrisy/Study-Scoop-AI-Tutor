// Phase 2 (Assignment 002B): regression tests for every defect confirmed in docs/DIVISION-DISCOVERY-AUDIT.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import lesson from '../curriculum/6-1.json' with {type: 'json'};
import {initialState, transition, numeric, command, summary} from '../engine/controller.js';
import {voiceTurn} from '../engine/voice-turn.js';

const clone = x => structuredClone(x);
const say = (s, message, extra = {}) => transition(s, {action: 'answer', revision: s.revision, message, ...extra}, lesson);
const act = (s, action) => transition(s, {action, revision: s.revision}, lesson);
const at = (index, phase = 'teach') => ({...initialState(), started: true, phase, index});
const conceptId = s => lesson.concepts[s.index].id;
const RIGHT = {inside: 'inside', unit: '1', count: '15', partial: '12', irregular: '10', make: 'My figure is ready', edge: '4'};
const RIGHT_EXTRA = {partial: {filled: [5, 6, 7, 9, 10, 11]}, make: {cells: [0, 1, 2, 3, 4, 5, 6, 7]}};
const WRONG = {inside: 'boundary', unit: '2', count: '14', partial: '11', irregular: '9', make: 'My figure is ready', edge: '5'};
const WRONG_EXTRA = {make: {cells: [0]}};
// Answers the current teaching concept correctly (including reasoning follow-ups).
function pass(s) {
  const c = lesson.concepts[s.index];
  if (c.check.kind === 'reason') { s = say(s, 'Because the pieces must cover everything').state; return say(s, c.followUp.answer).state; }
  return say(s, RIGHT[c.id], RIGHT_EXTRA[c.id]).state;
}
function fail(s) {
  const c = lesson.concepts[s.index];
  if (c.check.kind === 'reason') { if (!s.checkVariant) s = say(s, 'Because the pieces must cover everything').state; return say(s, c.followUp.options.find(o => o !== c.followUp.answer)); }
  return say(s, WRONG[c.id], WRONG_EXTRA[c.id]);
}
function toAssessment() { let s = act(initialState(), 'start').state; while (s.phase === 'teach') s = pass(s); return s; }

// --- Defect 1: help requests were graded as answers during independent work ---
const HELP = ['I need help', 'Can you help me?', 'help me please', "I'm stuck", "I don't get it", "I don't know", 'I am confused', 'show me how', 'explain it again', 'I need some help'];
test('help requests in assessment are never recorded or graded, and reveal nothing', () => {
  const s = toAssessment();
  for (const phrase of HELP) {
    const r = say(s, phrase);
    assert.equal(r.state.index, 0, phrase);
    assert.equal(r.state.records.length, 0, phrase);
    assert.match(r.output.speech, /independent turn/, phrase);
    assert.ok(!r.output.speech.includes(String(lesson.assessment[0].answer)), phrase);
    assert.ok(!r.output.speech.includes(lesson.assessment[0].feedback), phrase);
  }
  for (const phrase of HELP) assert.equal(voiceTurn('', phrase).action, 'help', `voice: ${phrase}`);
  assert.deepEqual(voiceTurn('twelve', 'skip this one'), {draft: 'skip this one', action: 'answer'});
  for (const [phrase, action] of [['hold on', 'pause'], ['keep going', 'resume'], ['say it again please', 'repeat']]) assert.equal(voiceTurn('draft', phrase).action, action, phrase);
});

// --- Defect 2: only exact command phrases were recognised ---
test('natural command phrases map to pause, repeat, help, resume, stop and skip', () => {
  const expected = {
    pause: ['hold on', 'wait a minute', 'give me a second', 'let me think', "I'm still thinking", 'hang on please', 'wait'],
    repeat: ['say it again please', 'what did you say', 'one more time', 'could you repeat the question', 'say that again', 'I didn\'t hear you', 'repeat'],
    help: HELP,
    resume: ['keep going', "I'm ready", 'continue', 'resume', 'go on'],
    stop: ['stop', 'stop listening'],
    skip: ['skip this problem', 'skip', 'can I skip this one', 'skip it'],
    finished: ["I'm finished", 'I am done', 'done']
  };
  for (const [intent, phrases] of Object.entries(expected)) for (const p of phrases) assert.equal(command(p), intent, p);
  for (const answer of ['squares help us count', 'I think it is eight', 'inside', 'wait it is 8', 'the help is inside', 'It misses some of the surface', '15', 'ready', 'help is not needed because squares cover it'])
    assert.equal(command(answer), null, answer);
  let s = at(0);
  s = say(s, 'hold on').state; assert.equal(s.paused, true);
  s = say(s, 'keep going').state; assert.equal(s.paused, false);
  const r = say(s, 'say it again please'); assert.equal(r.state.revision, s.revision); assert.equal(r.output.speech, lesson.concepts[0].teach + ' ' + lesson.concepts[0].check.question);
});

// --- Defect 3: spoken numbers above twenty were not understood ---
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const words = n => n === 100 ? 'one hundred' : n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
test('spoken number words from zero through one hundred', () => {
  for (let n = 0; n <= 100; n++) {
    assert.equal(numeric(words(n)), n, words(n));
    assert.equal(numeric(words(n).replace(' ', '-')), n, words(n).replace(' ', '-'));
    assert.equal(numeric(String(n)), n);
  }
  assert.equal(numeric('a hundred'), 100);
  assert.equal(numeric('Twenty-Four.'), 24);
  assert.equal(numeric('I think it is seventy two'), 72);
  assert.equal(numeric('the quotient is forty two'), 42);
  assert.equal(numeric('81 square units'), 81);
  assert.equal(numeric('ninety nine units'), 99);
  for (const bad of ['twenty twenty', 'five six', 'negative five', 'minus 4', '-5', '12-15', '4.5', 'five or six', 'not 6', 'one hundred one', 'eleventy', 'seventy and two'])
    assert.ok(Number.isNaN(numeric(bad)), bad);
});

// --- Defect 4: ambiguous speech was graded automatically ---
test('ambiguous or empty responses in assessment are asked again, not recorded', () => {
  const s = toAssessment();
  for (const [message, pattern] of [['twelve or fifteen', /one whole number/], ['um', /did not hear/], ['yes', /tell me a number/], ['banana', /tell me a number/], ['-8', /one whole number/], ['okay', /did not hear/], ['8 or 9', /one whole number/]]) {
    const r = say(s, message);
    assert.equal(r.state.records.length, 0, message);
    assert.equal(r.state.index, 0, message);
    assert.equal(r.state.revision, s.revision, message);
    assert.match(r.output.speech, pattern, message);
    assert.match(r.output.speech, /skip this problem/, message);
  }
  let t = say(s, 'twelve or fifteen').state; t = say(t, 'um').state;
  assert.match(say(t, 'uh').output.speech, /tap or type/);
  // A choice item: naming two options is unclear; one option is graded.
  const choice = {...s, index: 1};
  assert.equal(say(choice, 'Leave gaps or use equal unit squares with no gaps or overlaps').state.records.length, 0);
  assert.equal(say(choice, 'Leave gaps').state.records[0].correct, false);
});
test('ambiguous responses in teaching are not graded and do not count as attempts', () => {
  let s = at(0);
  for (const m of ['inside or boundary', 'yes', 'um', 'okay']) {
    const r = say(s, m);
    assert.equal(r.state.attempts, 0, m); assert.equal(r.state.index, 0, m); assert.equal(r.state.assisted.length, 0, m);
  }
  s = at(3); // count: a number is expected
  for (const m of ['fourteen or fifteen', 'I know', 'banana']) { const r = say(s, m); assert.equal(r.state.attempts, 0, m); assert.match(r.output.speech, /number/, m); }
  s = at(2); // reasoning: an affirmation alone is not an explanation
  assert.equal(say(s, 'yes').state.reasoning.length, 0);
  assert.equal(say(s, 'Yes because gaps squares').state.reasoning.length, 1);
});

// --- Defect 5: remediation repeated forever ---
test('wrong answers are bounded: the third wrong answer stops repeating the same explanation', () => {
  let s = at(0), alternativeTurns = 0;
  for (let i = 0; i < 3; i++) { const r = fail(s); s = r.state; if (r.output.speech.includes(lesson.concepts[0].alternative)) alternativeTurns++; }
  assert.equal(alternativeTurns, 2);
  assert.equal(s.unresolved[0].id, 'inside');
  assert.equal(s.attempts, 0);
});
test('a child who never answers correctly reaches a parent review in a bounded number of turns', () => {
  let s = act(initialState(), 'start').state, turns = 0;
  while (s.phase === 'teach' && turns < 200) { s = fail(s).state; turns++; }
  assert.equal(s.phase, 'review');
  assert.ok(turns <= 10, `took ${turns} turns`);
  const sum = summary(s, lesson);
  assert.equal(sum.outcome, 'needs-reteach');
  assert.equal(sum.total, 0);
  assert.deepEqual(sum.unresolved.map(u => u.id), ['inside']);
  assert.equal(sum.notTaught.length, 8, 'every other concept builds on "inside"');
  assert.ok(sum.parentNotice);
});
test('repeated help requests are bounded too', () => {
  let s = at(0);
  for (let i = 0; i < 3; i++) { s = act(s, 'help').state; assert.equal(s.index, 0); }
  const r = act(s, 'help');
  assert.equal(r.state.unresolved[0].reason, 'repeated-help');
  assert.ok(!r.output.speech.startsWith(lesson.concepts[0].alternative));
});

// --- Defect 6: a struggling child must not be moved on to a dependent concept ---
test('after struggling, the tutor reviews the prerequisite, then retries the original idea', () => {
  let s = at(6); // make, requires count
  for (let i = 0; i < 3; i++) s = fail(s).state;
  assert.equal(conceptId(s), 'count');
  assert.deepEqual(s.reviewing, {target: 'make', queue: ['count']});
  const back = pass(s);
  assert.equal(conceptId(back), 'make');
  const r = say(back, RIGHT.make, RIGHT_EXTRA.make);
  assert.equal(conceptId(r.state), 'edge');
  assert.deepEqual(summary(r.state, lesson).resolvedAfterReteach, ['make']);
  assert.equal(summary(r.state, lesson).parentNotice, null);
});
test('a concept that stays hard is set aside, its dependents are skipped, and it is retaught once later', () => {
  let s = at(3); // count; partial, irregular and make depend on it
  for (let i = 0; i < 3; i++) s = fail(s).state; // reviews tiling (reasoning prerequisite)
  assert.equal(conceptId(s), 'tiling');
  s = pass(s); assert.equal(conceptId(s), 'count');
  for (let i = 0; i < 3; i++) s = fail(s).state; // still hard: defer
  const taught = [];
  while (s.phase === 'teach' && conceptId(s) !== 'count') { taught.push(conceptId(s)); s = pass(s); }
  assert.deepEqual(taught, ['edge', 'reason'], 'never partial, irregular or make while count is unresolved');
  assert.equal(s.unresolved.find(u => u.id === 'count').retaught, true);
  for (let i = 0; i < 3; i++) s = fail(s).state;
  assert.equal(s.phase, 'review');
  const sum = summary(s, lesson);
  assert.deepEqual(sum.unresolved.map(u => u.id), ['count']);
  assert.deepEqual(sum.unresolved[0].prerequisitesReviewed, ['tiling']);
  assert.deepEqual(sum.notTaught, ['partial', 'irregular', 'make']);
  assert.equal(sum.records.length, 0, 'no independent assessment of untaught ideas');
});
test('learning an idea on the later reteach unlocks the concepts that depend on it', () => {
  let s = at(3);
  for (let i = 0; i < 3; i++) s = fail(s).state;
  s = pass(s); // tiling review
  for (let i = 0; i < 3; i++) s = fail(s).state; // count deferred
  while (conceptId(s) !== 'count') s = pass(s);
  s = pass(s); // count learned on reteach
  const taught = [];
  while (s.phase === 'teach') { taught.push(conceptId(s)); s = pass(s); }
  assert.deepEqual(taught, ['partial', 'irregular', 'make']);
  assert.equal(s.phase, 'assess');
  assert.deepEqual(summary(s, lesson).resolvedAfterReteach, ['count']);
});
test('if a prerequisite under review is also too hard, both are set aside', () => {
  let s = at(6); // make -> review count
  for (let i = 0; i < 3; i++) s = fail(s).state;
  assert.equal(conceptId(s), 'count');
  for (let i = 0; i < 3; i++) s = fail(s).state;
  assert.equal(conceptId(s), 'edge', 'skips partial and irregular, which need count');
  assert.deepEqual(s.unresolved.map(u => [u.id, u.status]), [['make', 'deferred'], ['count', 'deferred']]);
  assert.equal(s.completed.includes('count'), false);
});

// --- Defect 7: no safe unresolved-learning state or parent notification ---
test('unresolved learning is kept in state, survives a reconnect, and is reported to the parent', () => {
  let s = at(0);
  for (let i = 0; i < 6; i++) s = fail(s).state;
  const restarted = transition(clone(s), {action: 'start'}, lesson);
  const sum = restarted.output.summary;
  assert.equal(sum.outcome, 'needs-reteach');
  assert.match(sum.parentNotice, /not marked as learned/);
  assert.equal(sum.unresolved[0].name, lesson.concepts[0].name);
  assert.equal(say(restarted.state, 'inside').state.phase, 'review', 'review is final for this session');
});
test('lessons may opt in to assessing after unresolved ideas; the assessment stays independent', () => {
  const opt = clone(lesson); opt.remediation.assessWhenUnresolved = true;
  let s = {...initialState(), started: true};
  for (let i = 0; i < 6; i++) s = transition(s, {action: 'answer', revision: s.revision, message: 'boundary'}, opt).state;
  assert.equal(s.phase, 'assess');
  assert.equal(s.records.length, 0);
  assert.equal(summary(s, opt).parentNotice !== null, true);
});

// --- Defect 8: assessment integrity is preserved ---
test('assessment integrity: first answer locked, no feedback until review, natural skip recorded as skipped', () => {
  let s = toAssessment();
  const r = say(s, 'nine');
  assert.equal(r.state.records[0].correct, false);
  assert.ok(!/correct|wrong|not right|try again/i.test(r.output.speech));
  assert.equal(r.output.summary, null);
  s = say(r.state, 'can I skip this one').state;
  assert.equal(s.records[1].skipped, true);
  assert.equal(s.records[1].correct, false);
  assert.equal(s.index, 2);
  assert.throws(() => transition(s, {action: 'answer', revision: s.revision - 1, message: '8'}, lesson), /Stale/);
});
