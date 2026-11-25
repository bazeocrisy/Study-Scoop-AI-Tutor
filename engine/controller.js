// Pure lesson controller shared by the browser demo and the authoritative Worker.
// It knows the instructional flow (teach -> assess -> review), never the subject: lesson content,
// visuals and graders come from the curriculum and from engine/graders.js and engine/visuals.js.
import {normalize, numeric, command, clarity} from './language.js';
import {grader} from './graders.js';
import {incomplete, gridConnected} from './visuals.js';
import {checkItem} from './schema.js';

export {normalize, numeric, command};

const DEFAULT_MAX_ATTEMPTS = 3;
const maxAttempts = lesson => lesson.remediation?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
const QUESTION = /^(why|how|what does|can you explain|could you explain)\b/i;

export function initialState() {
  return {
    phase: 'teach', index: 0, revision: 0, attempts: 0, assisted: [], records: [], reasoning: [], paused: false, started: false, checkVariant: false,
    // Added by Assignment 002B for safe remediation. Older saved states are upgraded on their next turn.
    completed: [], helps: 0, unclear: 0, unresolved: [], reviewing: null, outcome: null
  };
}

const item = (s, l) => s.phase === 'review' ? null : s.phase === 'assess' ? l.assessment[s.index] : l.concepts[s.index];
const conceptIndex = (l, id) => l.concepts.findIndex(c => c.id === id);
const currentQuestion = (s, q) => s.checkVariant ? q.followUp.question : q.check.question;

export function view(s, l, speech) {
  const q = item(s, l);
  return {
    phase: s.phase, index: s.index, revision: s.revision, paused: s.paused, started: s.started,
    title: q?.name || (s.phase === 'review' ? 'Your learning story' : 'Your independent turn'),
    speech: speech ?? (s.phase === 'teach' ? q.teach + ' ' + currentQuestion(s, q) : q?.question || ''),
    question: s.phase === 'teach' ? currentQuestion(s, q) : q?.question,
    options: s.checkVariant ? q.followUp.options : q?.check?.options || q?.options || null,
    visual: q?.visual || null,
    kind: s.checkVariant ? 'exact' : q?.check?.kind || q?.kind,
    progress: s.phase === 'teach' ? `${s.index + 1} of ${l.concepts.length} teaching ideas` : s.phase === 'assess' ? `${s.index + 1} of ${l.assessment.length} independent problems` : 'Lesson complete',
    summary: s.phase === 'review' ? summary(s, l) : null
  };
}

const NOTICE = 'Some ideas still need teaching. They were not marked as learned. Please go over them with your child before the next lesson.';
export function summary(s, l) {
  const scored = s.records.filter(r => r.correct !== null);
  const open = (s.unresolved || []).filter(u => u.status !== 'resolved');
  return {
    correct: scored.filter(r => r.correct).length, total: scored.length, assistedConcepts: s.assisted, reasoning: s.reasoning,
    records: s.records.map(r => ({...r, expected: l.assessment.find(q => q.id === r.id)?.answer, feedback: l.assessment.find(q => q.id === r.id)?.feedback})),
    judgment: 'A single lesson is limited evidence. Review the explanation with a parent and revisit these skills on another day before claiming mastery.',
    outcome: s.outcome || 'assessed',
    unresolved: open.map(u => ({id: u.id, name: l.concepts.find(c => c.id === u.id)?.name, reason: u.reason, prerequisitesReviewed: u.prerequisitesReviewed, retaught: u.retaught})),
    notTaught: s.outcome === 'needs-reteach' ? l.concepts.filter(c => !(s.completed || []).includes(c.id) && !open.some(u => u.id === c.id)).map(c => c.id) : [],
    resolvedAfterReteach: (s.unresolved || []).filter(u => u.status === 'resolved').map(u => u.id),
    parentNotice: open.length ? NOTICE : null
  };
}

// --- Backward-compatible helpers (exported API of the 6-1 prototype) ---
// Grid size always comes from the item's own visual. This 3 x 4 canvas is used only when a caller
// passes a build item with no visual at all, which the curriculum schema rejects.
const LEGACY_BUILD_CANVAS = {rows: ['....', '....', '....'], visible: ['....', '....', '....'], mode: 'build'};
export const completeTiling = (v, filled) => !incomplete({...v, mode: 'partial'}, {filled});
export const connected = (cells, cols) => gridConnected(cells, cols);
export function grade(q, message, cells, filled) {
  if (incomplete(q.visual, {filled})) return false;
  const g = grader(q.kind);
  if (!g) return normalize(message) === normalize(q.answer);
  const subject = q.kind === 'build' && !q.visual ? {...q, visual: LEGACY_BUILD_CANVAS} : q;
  return g.grade(subject, {message, cells, filled});
}

// --- Teaching sequence with prerequisite-aware, bounded remediation ---
// Entry status: reviewing-prerequisite -> retrying -> resolved, or deferred -> (retaught once) -> resolved | unresolved.
const entryFor = (s, id) => s.unresolved.find(u => u.id === id);
const settled = (s, id) => s.completed.includes(id);
const nextConcept = (s, l) => l.concepts.findIndex(c => !settled(s, c.id) && !entryFor(s, c.id) && (c.requires || []).every(r => settled(s, r)));

function startConcept(s, l, index, lead) {
  s.index = index; s.attempts = 0; s.helps = 0; s.unclear = 0; s.checkVariant = false;
  const c = l.concepts[index];
  return lead + c.teach + ' ' + c.check.question;
}

// Chooses what comes after a concept is learned or set aside. A concept whose prerequisites are
// not learned is never started.
function advance(s, l, lead) {
  const n = nextConcept(s, l);
  if (n >= 0) return startConcept(s, l, n, lead);
  const later = s.unresolved.find(u => u.status === 'deferred' && !u.retaught && (l.concepts[conceptIndex(l, u.id)].requires || []).every(r => settled(s, r)));
  if (later) {
    later.retaught = true;
    const same = l.concepts[s.index]?.id === later.id && s.phase === 'teach';
    return startConcept(s, l, conceptIndex(l, later.id), same ? 'Let us start this idea again from the beginning. ' : lead + 'Now let us look again at an idea from earlier. ');
  }
  s.checkVariant = false; s.attempts = 0; s.helps = 0; s.unclear = 0;
  for (const u of s.unresolved) if (u.status === 'deferred') u.status = 'unresolved';
  if (s.unresolved.some(u => u.status !== 'resolved') && !l.remediation?.assessWhenUnresolved) {
    s.phase = 'review'; s.index = 0; s.outcome = 'needs-reteach';
    return 'We worked hard today. Some ideas need more time, so we will stop here. Your parent can see what to practice next.';
  }
  s.phase = 'assess'; s.index = 0;
  return 'You have worked through the teaching. Now solve these on your own. I will save feedback until you finish. ' + l.assessment[0].question;
}

// Called when a child reaches the attempt or help limit on the current concept.
// First reviews the concept's learned prerequisites, then sets it aside to reteach later.
function struggle(s, l, q, reason) {
  s.completed = s.completed.filter(id => id !== q.id);
  let entry = entryFor(s, q.id);
  if (!entry) { entry = {id: q.id, reason, status: 'deferred', prerequisitesReviewed: [], retaught: false}; s.unresolved.push(entry); }
  entry.reason = reason;
  if (s.reviewing) {
    // A prerequisite under review was also too hard: set aside both; dependents stay locked.
    entry.status = 'deferred';
    const target = entryFor(s, s.reviewing.target);
    if (target) target.status = 'deferred';
    s.reviewing = null;
    return advance(s, l, 'We will come back to these ideas later. ');
  }
  if (entry.retaught) { entry.status = 'unresolved'; return advance(s, l, 'We will practice this idea again another day. '); }
  const review = (q.requires || []).filter(r => settled(s, r) && !entry.prerequisitesReviewed.includes(r));
  if (review.length) {
    entry.prerequisitesReviewed.push(...review);
    entry.status = 'reviewing-prerequisite';
    s.reviewing = {target: q.id, queue: review};
    return startConcept(s, l, conceptIndex(l, review[0]), 'Let us go back to an idea that helps with this one. ');
  }
  entry.status = 'deferred';
  return advance(s, l, 'We will come back to this idea later. ');
}

function learned(s, l, q) {
  if (!s.completed.includes(q.id)) s.completed.push(q.id);
  const entry = entryFor(s, q.id);
  if (entry) entry.status = 'resolved';
  if (s.reviewing) {
    s.reviewing.queue = s.reviewing.queue.filter(id => id !== q.id);
    if (s.reviewing.queue.length) return startConcept(s, l, conceptIndex(l, s.reviewing.queue[0]), 'That matches this idea. ');
    const target = s.reviewing.target;
    s.reviewing = null;
    entryFor(s, target).status = 'retrying';
    return startConcept(s, l, conceptIndex(l, target), 'That matches this idea. Now let us try this idea again. ');
  }
  return advance(s, l, 'That matches this idea. ');
}

function unclearSpeech(s, reason, question) {
  const ask = reason === 'needs-number' ? 'Please tell me a number.'
    : reason === 'several-choices' ? 'I heard more than one answer. Please choose one answer.'
    : reason === 'unclear-number' ? 'I am not sure which number you mean. Please say one whole number.'
    : 'I did not hear an answer yet.';
  return ask + (s.unclear >= 2 ? ' You can also tap or type your answer.' : '') + ' ' + question;
}

export function transition(state, input, lesson) {
  const s = structuredClone(state);
  for (const [k, v] of Object.entries(initialState())) if (s[k] === undefined) s[k] = v;
  // A state with no completion record comes from the linear prototype (or an older saved session),
  // where every concept before the current one had been answered correctly.
  if (!s.completed.length && !s.unresolved.length && (s.index > 0 || s.phase !== 'teach'))
    s.completed = lesson.concepts.slice(0, s.phase === 'teach' ? s.index : lesson.concepts.length).map(c => c.id);
  if (!input || typeof input.action !== 'string') throw Error('Invalid action');
  if (input.action !== 'start' && input.revision !== s.revision) throw Error('Stale turn');
  if (input.message !== undefined && (typeof input.message !== 'string' || input.message.length > 500)) throw Error('Invalid message');
  const action = input.action;
  if (!['start', 'answer', 'help', 'repeat', 'pause', 'resume', 'stop', 'question'].includes(action)) throw Error('Invalid action');
  if (action === 'start') { s.started = true; return {state: s, output: view(s, lesson)}; }
  if (!s.started) throw Error('Start instruction first');
  if (s.phase === 'review') return {state: s, output: view(s, lesson, 'You finished. Your parent can review your work below.')};

  let a = (action === 'answer' ? command(input.message) : null) || action;
  if (s.phase === 'teach' && a === 'answer' && QUESTION.test(input.message)) a = 'question';
  if (s.phase === 'teach' && a === 'skip') a = 'help'; // teaching is never skipped; struggling earns help
  const q = item(s, lesson);

  if (a === 'pause' || a === 'stop') { s.paused = true; s.revision++; return {state: s, output: view(s, lesson, 'Take your time. Use Resume when you are ready.')}; }
  if (a === 'resume') { s.paused = false; s.revision++; return {state: s, output: view(s, lesson)}; }
  if (s.paused) return {state: s, output: view(s, lesson, 'I am paused. Use Resume when you are ready.')};
  if (a === 'repeat') return {state: s, output: view(s, lesson)};
  if (a === 'finished') return {state: s, output: view(s, lesson, 'Send your answer when you are ready. You may also say: skip this problem.')};

  if (a === 'help' || a === 'question') {
    // Independent work: a help request is never recorded or graded as an answer.
    if (s.phase === 'assess') return {state: s, output: view(s, lesson, 'This is your independent turn. I can repeat the question, but I will save help until the review. You may say: skip this problem.')};
    if (!s.assisted.includes(q.id)) s.assisted.push(q.id);
    s.revision++; s.helps++;
    if (s.helps > maxAttempts(lesson)) return {state: s, output: view(s, lesson, struggle(s, lesson, q, 'repeated-help'))};
    return {state: s, output: {...view(s, lesson, q.alternative + ' ' + q.example.text + ' ' + currentQuestion(s, q)), example: q.example}, needsCoach: a === 'question'};
  }
  if (typeof input.message !== 'string' || !input.message.trim()) throw Error('Empty response');
  const response = {message: input.message, cells: input.cells, filled: input.filled};

  if (s.phase === 'assess') {
    const skip = a === 'skip';
    if (!skip) {
      const clear = clarity(input.message, grader(q.kind).expects(q, lesson));
      if (clear.status === 'unclear' && q.kind !== 'build') {
        s.unclear++;
        return {state: s, output: view(s, lesson, unclearSpeech(s, clear.reason, q.question) + ' You may also say: skip this problem.')};
      }
    }
    s.unclear = 0;
    const correct = q.kind === 'reason' ? null : skip ? false : grade(q, input.message, input.cells, input.filled);
    s.records.push({id: q.id, skill: q.skill, response: input.message, cells: q.kind === 'build' ? input.cells || [] : undefined, filled: q.visual?.mode === 'partial' ? input.filled || [] : undefined, correct, independent: true, skipped: skip});
    if (q.kind === 'reason') s.reasoning.push({id: q.id, response: input.message, status: skip ? 'skipped' : 'parent-review'});
    s.index++; s.revision++;
    if (s.index >= lesson.assessment.length) { s.phase = 'review'; s.index = 0; s.outcome = 'assessed'; return {state: s, output: view(s, lesson, 'You finished your independent work. Let us review it with your parent.')}; }
    return {state: s, output: view(s, lesson, 'Answer saved. ' + lesson.assessment[s.index].question)};
  }

  // Teaching. An open explanation is kept unverified and followed by a concept check.
  if (!s.checkVariant && q.check.kind === 'reason') {
    if (clarity(input.message, {type: 'text'}).status === 'unclear') { s.unclear++; return {state: s, output: view(s, lesson, unclearSpeech(s, 'no-answer', currentQuestion(s, q)))}; }
    s.unclear = 0; s.reasoning.push({id: q.id, response: input.message, status: 'unverified'}); s.checkVariant = true; s.revision++;
    return {state: s, output: view(s, lesson, 'Thank you for explaining. I will keep your explanation for your parent. Let us check the idea another way. ' + q.followUp.question)};
  }
  const check = s.checkVariant ? {kind: 'exact', accepted: [q.followUp.answer], options: q.followUp.options} : checkItem(q);
  let good = grader(check.kind).grade(check, response, lesson) === true;
  // Unclear speech is asked again, never graded or counted as an attempt.
  if (!good && check.kind !== 'build') {
    const clear = clarity(input.message, grader(check.kind).expects(check, lesson));
    if (clear.status === 'unclear') { s.unclear++; return {state: s, output: view(s, lesson, unclearSpeech(s, clear.reason, currentQuestion(s, q)))}; }
  }
  s.unclear = 0;
  if (incomplete(q.visual, response)) good = false;
  s.revision++;
  if (!good) {
    s.attempts++;
    if (!s.assisted.includes(q.id)) s.assisted.push(q.id);
    if (s.attempts >= maxAttempts(lesson)) return {state: s, output: view(s, lesson, struggle(s, lesson, q, 'repeated-incorrect'))};
    return {state: s, output: {...view(s, lesson, (s.attempts > 1 ? 'Let us use a different picture in our minds. ' : 'Let us work on that together. ') + q.alternative + ' ' + q.example.text + ' ' + currentQuestion(s, q)), example: q.example}};
  }
  return {state: s, output: view(s, lesson, learned(s, lesson, q))};
}
