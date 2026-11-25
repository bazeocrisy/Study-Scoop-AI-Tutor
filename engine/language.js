// Lesson-agnostic interpretation of what a child typed or said.
// Nothing here knows about any subject; lessons may add unit words through `lesson.language.units`.

export const normalize = x => String(x ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = {twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90};
const NUMBER_WORD = new RegExp(`\\b(?:${[...ONES, ...Object.keys(TENS), 'hundred', 'fourty'].join('|')})\\b`);

// Generic measurement and answer words that may follow a number ("12 square units", "4 inches").
const GENERIC_UNITS = ['square units', 'square unit', 'units', 'unit', 'square centimeters', 'square inches', 'square feet', 'centimeters', 'inches', 'feet', 'meters'];
// Phrases a child commonly puts before an answer ("I think it is 8", "the area is 12", "my answer is ten").
const LEAD = /^(?:(?:um|uh|umm|so|well|okay|ok|i think|i guess|maybe)\s+)*(?:(?:the \w+|my answer|the answer|it|that) is\s+|its\s+|thats\s+)?/;

function wordsToNumber(text) {
  const t = text.split(' ').filter(Boolean);
  if (t.length === 1) {
    if (ONES.includes(t[0])) return ONES.indexOf(t[0]);
    if (t[0] in TENS) return TENS[t[0]];
    if (t[0] === 'hundred') return 100;
  }
  if (t.length === 2) {
    if ((t[0] === 'one' || t[0] === 'a') && t[1] === 'hundred') return 100;
    if (t[0] in TENS && ONES.indexOf(t[1]) >= 1 && ONES.indexOf(t[1]) <= 9) return TENS[t[0]] + ONES.indexOf(t[1]);
  }
  return NaN;
}

// Returns a whole number, or NaN when the response is not exactly one non-negative whole number.
// Negative values, decimals, ranges and lists are never reduced to a convenient digit.
export function numeric(x, units = []) {
  const raw = String(x ?? '');
  if (/(^|[^a-z0-9])[−–—-]\s*\d/i.test(raw) || /\d\s*[−–—-]\s*\d/.test(raw) || /\d\.\d/.test(raw)) return NaN;
  let s = normalize(raw);
  if (/\b(negative|minus)\b/.test(s)) return NaN;
  s = s.replace(LEAD, '');
  for (const u of [...units, ...GENERIC_UNITS].map(normalize).sort((p, q) => q.length - p.length)) {
    if (s.endsWith(' ' + u)) { s = s.slice(0, -u.length - 1); break; }
  }
  if (/^\d+$/.test(s)) return Number(s);
  return wordsToNumber(s);
}

// True when the text mentions any number at all (digits or number words).
export const mentionsNumber = x => /\d/.test(String(x ?? '')) || NUMBER_WORD.test(normalize(x));

// Natural command phrases. A command must be the whole utterance (after polite filler is removed),
// so an explanation such as "squares help us count" is never mistaken for a help request.
const FILLER = /\b(?:please|um|umm|uh|okay|ok|teacher|hey|just)\b/g;
const PATTERNS = [
  ['finished', /^(?:im|i am)? ?(?:all )?(?:finished|done)$/],
  ['skip', /^(?:can i |could i |i want to |i wanna |lets )?skip(?: this| this one| this problem| it| that| the problem| this question)?$/],
  ['repeat', /^(?:(?:can|could|would|will) you )?(?:repeat(?: that| it| the question| yourself)?|say (?:that|it|the question) again|say that one more time|one more time|what did you say|what was the question|i didnt hear(?: you| that)?|pardon|come again)$/],
  ['pause', /^(?:pause|wait|hold on|hang on|wait a (?:minute|second|moment)|give me a (?:minute|second|moment)|(?:im|i am)? ?still thinking|let me think|stop talking|be quiet for a (?:minute|second))$/],
  ['resume', /^(?:resume|continue|keep going|go on|go ahead|im ready|i am ready|unpause)$/],
  ['stop', /^(?:stop|stop listening)$/],
  ['help', /^(?:help|help me|i need help|i need some help|(?:can|could|will|would) you help(?: me)?|(?:im|i am) stuck|(?:im|i am) confused|i (?:do not|dont) (?:understand|get it|get this|know how)|i dont know what to do|show me another example|another example|(?:can|could) you show me|show me how|explain (?:it|that|this)(?: again)?|why do we do that|why|i dont know|i do not know)$/]
];

export function command(x) {
  const s = normalize(x).replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  for (const [intent, re] of PATTERNS) if (re.test(s)) return intent;
  return null;
}

// Utterances that carry no answer content: affirmations, hesitation, or nothing but filler.
const NON_ANSWERS = /^(?:yes|yeah|yep|no|nope|okay|ok|sure|i know|maybe|hmm|um|uh|umm|so|well|right|alright)$/;

// Decides whether a response should be graded at all.
// Returns {status:'answer'} or {status:'unclear', reason} so the controller can ask again instead of grading.
export function clarity(message, expectation) {
  const s = normalize(message);
  const content = s.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (!content) return {status: 'unclear', reason: 'no-answer'};
  if (expectation.type === 'number') {
    if (Number.isFinite(numeric(message, expectation.units))) return {status: 'answer'};
    return {status: 'unclear', reason: mentionsNumber(message) ? 'unclear-number' : 'needs-number'};
  }
  if (NON_ANSWERS.test(content)) return {status: 'unclear', reason: 'no-answer'};
  if (expectation.type === 'choice' && expectation.options?.length) {
    // "inside or boundary": names a correct choice and a different choice together.
    const has = t => normalize(t) && (' ' + s + ' ').includes(' ' + normalize(t) + ' ');
    const accepted = (expectation.accepted || []).map(normalize);
    const right = accepted.some(has);
    const wrong = expectation.options.filter(o => !accepted.includes(normalize(o))).some(has);
    if (right && wrong) return {status: 'unclear', reason: 'several-choices'};
  }
  return {status: 'answer'};
}
