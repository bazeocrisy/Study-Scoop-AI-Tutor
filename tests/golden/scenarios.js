// Golden transcript scenarios for the Lesson 6-1 area curriculum.
// Each step is one turn; `revision` is filled from the current state unless a step sets it.
// These scenarios deliberately cover behaviour that Assignment 002B must preserve.
// Behaviour that 002B intentionally changes (third wrong answer, natural-language commands,
// ambiguous responses) is covered by tests/defects.test.js instead.

const right = {
  inside: {message: 'inside'},
  unit: {message: 'one'},
  tiling: {message: 'A gap leaves part of the surface uncounted'},
  tilingFollow: {message: 'It misses some of the surface'},
  count: {message: '15 square units'},
  partial: {message: '12', filled: [5, 6, 7, 9, 10, 11]},
  irregular: {message: 'ten'},
  make: {message: 'My figure is ready', cells: [0, 1, 2, 3, 4, 5, 6, 7]},
  edge: {message: '4'},
  reason: {message: 'Squares fit edge to edge with no spaces'},
  reasonFollow: {message: 'Equal unit squares'}
};
const a = step => ({action: 'answer', ...step});
const teachAllCorrect = [
  a(right.inside), a(right.unit), a(right.tiling), a(right.tilingFollow), a(right.count), a(right.partial),
  a(right.irregular), a(right.make), a(right.edge), a(right.reason), a(right.reasonFollow)
];

export const scenarios = [
  {
    name: 'complete lesson, all correct, then review controls',
    steps: [
      {action: 'start'}, ...teachAllCorrect,
      a({message: '8'}),
      a({message: 'Use equal unit squares with no gaps or overlaps'}),
      a({message: '15', filled: [6, 7, 8, 9, 11, 12, 13, 14]}),
      a({message: 'thirteen'}),
      a({message: '1'}),
      a({message: 'My figure is ready', cells: [0, 1, 2, 4, 5, 6]}),
      a({message: '5 units'}),
      a({message: 'Tiling covers the whole inside once. Gaps miss space and overlaps count it twice.'}),
      {action: 'repeat'}, {action: 'start'}, a({message: 'inside'}), {action: 'help'}
    ]
  },
  {
    name: 'wrong answers once or twice in every concept, then correct',
    steps: [
      {action: 'start'},
      a({message: 'boundary'}), a(right.inside),
      a({message: '2'}), a(right.unit),
      a(right.tiling), a({message: 'It measures the whole surface'}), a(right.tilingFollow),
      a({message: '14'}), a({message: 'sixteen'}), a(right.count),
      a({message: '12', filled: []}), a(right.partial),
      a({message: '9'}), a({message: '11'}), a(right.irregular),
      a({message: 'My figure is ready', cells: [0, 1]}), a({message: 'My figure is ready', cells: [0, 1, 2, 3, 8, 9, 10, 11]}), a(right.make),
      a({message: '5'}), a(right.edge),
      a(right.reason), a({message: 'Circles'}), a(right.reasonFollow)
    ]
  },
  {
    name: 'teaching controls: help, repeat, pause, resume, questions, spoken commands',
    steps: [
      {action: 'start'}, {action: 'help'}, {action: 'repeat'}, {action: 'pause'},
      a({message: 'inside'}), {action: 'repeat'}, {action: 'resume'},
      a({message: 'Why does area matter?'}), a({message: 'How do we know?'}), a(right.inside),
      a({message: "I don't understand"}), a({message: "I'm still thinking"}), {action: 'resume'},
      a({message: 'Can you repeat that?'}), a({message: "I'm finished"}), {action: 'stop'}, {action: 'resume'},
      {action: 'question', message: 'what is a unit'}, a(right.unit),
      a(right.tiling), {action: 'repeat'}, {action: 'help'}, a(right.tilingFollow)
    ]
  },
  {
    name: 'independent assessment: no help, commands, wrong, skip and reasoning',
    steps: [
      {action: 'start'}, ...teachAllCorrect,
      {action: 'help'}, {action: 'question', message: 'what is the answer'}, a({message: "I don't understand"}),
      {action: 'repeat'}, {action: 'pause'}, a({message: '8'}), {action: 'resume'}, a({message: "I'm finished"}),
      a({message: '999'}),
      a({message: 'Leave gaps'}),
      a({message: 'skip this problem'}),
      a({message: '13'}),
      a({message: 'one unit'}),
      a({message: 'My figure is ready', cells: [0, 1, 2, 3, 8, 9]}),
      a({message: '5'}),
      a({message: 'How tiling helps is that it covers the inside once.'}),
      a({message: 'inside'})
    ]
  },
  {
    name: 'invalid and stale turns are rejected',
    steps: [
      a({message: 'inside', revision: 0}),
      {action: 'start'},
      a({message: 'inside', revision: 7}),
      {action: 'advance'},
      a({message: 'x'.repeat(501)}),
      a({message: '   '}),
      a({message: 42}),
      a(right.inside)
    ]
  }
];

// Runs one scenario against any controller module exposing initialState/transition.
export function runScenario(controller, lesson, scenario) {
  let state = controller.initialState();
  const turns = [];
  for (const step of scenario.steps) {
    const input = {...step};
    if (input.action !== 'start' && !('revision' in step)) input.revision = state.revision;
    try {
      const result = controller.transition(state, input, lesson);
      state = result.state;
      turns.push({input, output: result.output, needsCoach: !!result.needsCoach, state});
    } catch (e) {
      turns.push({input, error: e.message, state});
    }
  }
  return turns;
}
