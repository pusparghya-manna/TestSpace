import assert from 'node:assert/strict';
import { normalizeOcrAnswer, normalizeOcrQuestion } from '../services/geminiOcr.js';

const answerCases: Array<[unknown, number | null]> = [
  [0, 0],
  [3, 3],
  ['0', 0],
  ['1', 0],
  ['4', 3],
  ['B', 1],
  ['Option C', 2],
  ['Answer: D', 3],
  ['', null],
  [null, null],
  ['unclear', null],
];

for (const [input, expected] of answerCases) {
  assert.equal(normalizeOcrAnswer(input), expected, `answer ${String(input)}`);
}

const normalized = normalizeOcrQuestion({
  question: 'Which option is correct?',
  options: [{ text: 'First' }, 'Second', 'Third', 'Fourth'],
  answer: 'Option C',
  marks: '2',
  negativeMarks: '0.5',
});

assert.deepEqual(normalized.options, ['First', 'Second', 'Third', 'Fourth']);
assert.equal(normalized.answer, 2);
assert.equal(normalized.marks, 2);
assert.equal(normalized.negativeMarks, 0.5);

console.log('ocrNormalization tests passed');
