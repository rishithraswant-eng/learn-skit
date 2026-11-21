import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

async function createAppContext(initialState = {}) {
  const state = {
    box: {},
    mcq: {},
    position: {},
    last: null,
    ...initialState
  };

  const sampleModule = {
    id: 'M01',
    title: 'Test Module',
    cards: [
      ['Prompt 1', 'Answer 1'],
      ['Prompt 2', 'Answer 2'],
      ['Prompt 3', 'Answer 3'],
      ['Prompt 4', 'Answer 4']
    ],
    cardIds: ['M01-c0', 'M01-c1', 'M01-c2', 'M01-c3'],
    mcq: [
      ['Question 1', ['A', 'B', 'C', 'D'], 0, 'Hint 1', 'Solution 1', '', '', 'E', false, false],
      ['Question 2', ['A', 'B', 'C', 'D'], 1, 'Hint 2', 'Solution 2', '', '', 'M', false, false]
    ],
    questionIds: ['M01-q0', 'M01-q1']
  };

  const subjects = [
    {
      slug: 'evs',
      title: 'Environmental Studies',
      short: 'EVS',
      modules: [sampleModule]
    }
  ];

  const putCalls = [];
  const LearnSkit = {
    state,
    start: fn => fn('ready'),
    retryRpcs: () => {},
    put(kind, item_id, payload) {
      putCalls.push({ kind, item_id, payload });
      if (['box', 'mcq', 'position'].includes(kind)) {
        state[kind][item_id] = payload;
      }
    }
  };

  const window = {
    SUBJECTS: subjects,
    LearnSkit,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const mockEl = () => ({
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => mockEl(),
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    focus: () => {},
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} }
  });
  const doc = {
    querySelector: selector => selector === 'header.top' ? null : mockEl(),
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  const context = {
    window,
    document: doc,
    SUBJECTS: subjects,
    LearnSkit,
    StudyWorkspace: { stop: () => {}, controls: () => '', bindControls: () => {}, applyTheme: () => {} },
    matchMedia: () => ({ matches: false }),
    navigator: { serviceWorker: { register: async () => {} } },
    addEventListener: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    sessionStorage: { getItem: () => null, setItem: () => {} },
    location: { hash: '#/', replace: () => {}, search: '', pathname: '/' }
  };

  vm.runInNewContext(await read('js/app.js'), context);

  return {
    window,
    module: sampleModule,
    state,
    putCalls,
    StudyProgress: context.window.StudyProgress
  };
}

test('progress is 0% when nothing is completed', async () => {
  const { StudyProgress, module } = await createAppContext();
  assert.equal(StudyProgress.modPct(module), 0);
  assert.equal(StudyProgress.allPct(), 0);
});

test('progress is 50% when all cards are read and 0 questions answered', async () => {
  const { StudyProgress, module, state } = await createAppContext();
  // Mark all 4 cards as read in box
  state.box['M01-c0'] = 0;
  state.box['M01-c1'] = 0;
  state.box['M01-c2'] = 0;
  state.box['M01-c3'] = 0;

  assert.equal(StudyProgress.modPct(module), 50);
  assert.equal(StudyProgress.allPct(), 50);
});

test('progress is 50% when all questions are answered and 0 cards read', async () => {
  const { StudyProgress, module, state } = await createAppContext();
  // Mark all 2 questions answered
  state.mcq['M01-q0'] = { ok: true };
  state.mcq['M01-q1'] = { ok: false };

  assert.equal(StudyProgress.modPct(module), 50);
  assert.equal(StudyProgress.allPct(), 50);
});

test('progress is 100% when all cards are read and all questions answered', async () => {
  const { StudyProgress, module, state } = await createAppContext();
  state.box['M01-c0'] = 0;
  state.box['M01-c1'] = 0;
  state.box['M01-c2'] = 0;
  state.box['M01-c3'] = 0;
  state.mcq['M01-q0'] = { ok: true };
  state.mcq['M01-q1'] = { ok: true };

  assert.equal(StudyProgress.modPct(module), 100);
  assert.equal(StudyProgress.allPct(), 100);
});

test('progress is distributed proportionally (2 cards of 4 + 2 mcq of 2 = 25% + 50% = 75%)', async () => {
  const { StudyProgress, module, state } = await createAppContext();
  state.box['M01-c0'] = 0;
  state.box['M01-c1'] = 0;
  state.mcq['M01-q0'] = { ok: true };
  state.mcq['M01-q1'] = { ok: true };

  assert.equal(StudyProgress.modPct(module), 75);
  assert.equal(StudyProgress.allPct(), 75);
});

test('progress recovers cards read from saved position (last card reached)', async () => {
  const { StudyProgress, module, state } = await createAppContext();
  // Position is at the last card M01-c3
  state.position['M01:cards'] = 'M01-c3';
  state.mcq['M01-q0'] = { ok: true };
  state.mcq['M01-q1'] = { ok: true };

  // All 4 cards should be considered read because user navigated up to the last card
  assert.equal(StudyProgress.modPct(module), 100);
  assert.equal(state.box['M01-c0'], 0);
  assert.equal(state.box['M01-c3'], 0);
});

test('progress recovers practice answers from saved practice-run', async () => {
  const { StudyProgress, module, state } = await createAppContext();
  state.box['M01-c0'] = 0;
  state.box['M01-c1'] = 0;
  state.box['M01-c2'] = 0;
  state.box['M01-c3'] = 0;
  // Answers saved inside practice-run but not yet in state.mcq
  state.position['practice-run:M01'] = {
    answers: {
      'M01-q0': { selected: 0, ok: true },
      'M01-q1': { selected: 1, ok: true }
    }
  };

  assert.equal(StudyProgress.modPct(module), 100);
  assert.ok(state.mcq['M01-q0']);
  assert.ok(state.mcq['M01-q1']);
});
