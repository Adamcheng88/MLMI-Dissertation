











const STEP_ORDER = [
  'instructions',
  'info_sheet',
  'consent',
  'demographics',
  'tutorial',
  'task',
  'surveys',
  'complete',
];

function nextStep(step) {
  const idx = STEP_ORDER.indexOf(step);
  if (idx === -1 || idx === STEP_ORDER.length - 1) return step;
  return STEP_ORDER[idx + 1];
}

function stepIndex(step) {
  return STEP_ORDER.indexOf(step);
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}




function nextCondition(previousCondition) {
  return previousCondition === 'real' ? 'baseline' : 'real';
}




function generateAssignment(questionIds = [], previousCondition = null) {
  return {
    condition: nextCondition(previousCondition),
    questionOrder: shuffle(questionIds),
  };
}


function summarizeAssignment(assignment) {
  if (!assignment || !assignment.condition) return '';
  return assignment.condition === 'real' ? 'Effective' : 'Baseline';
}

module.exports = {
  STEP_ORDER,
  nextStep,
  stepIndex,
  shuffle,
  nextCondition,
  generateAssignment,
  summarizeAssignment,
};
