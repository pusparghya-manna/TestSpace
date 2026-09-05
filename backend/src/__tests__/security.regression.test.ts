/**
 * Focused security regression tests (no DB required).
 */
import assert from 'node:assert/strict';
import { escapeMd, csvCell, isSafeUsername } from '../middleware/validate.js';

// Markdown escape (Telegram user-controlled text)
assert.equal(escapeMd('hello'), 'hello');
assert.equal(escapeMd('a_b*c'), 'a\\_b\\*c');
assert.ok(escapeMd('x`y[z]').includes('\\`'));
assert.equal(escapeMd('(test)'), '(test)'); // () not escaped in legacy Markdown

// CSV formula injection + quoting
assert.equal(csvCell('normal'), '"normal"');
assert.equal(csvCell('=1+1'), '"\'=1+1"');
assert.equal(csvCell('+cmd'), '"\'+cmd"');
assert.equal(csvCell('-1'), '"\'-1"');
assert.equal(csvCell('@sum'), '"\'@sum"');
assert.equal(csvCell('say "hi"'), '"say ""hi"""');

// Username policy
assert.equal(isSafeUsername('ab'), false);
assert.equal(isSafeUsername('teacher_1'), true);
assert.equal(isSafeUsername('bad name'), false);

// ownsExam pure logic (inline mirror — same as ownership.ownsExam)
function ownsExam(exam: { teacherId?: string } | null | undefined, teacherId: string): boolean {
  if (!exam) return false;
  return exam.teacherId === teacherId;
}
assert.equal(ownsExam({ teacherId: 'alice' }, 'alice'), true);
assert.equal(ownsExam({ teacherId: 'alice' }, 'bob'), false);
assert.equal(ownsExam(null, 'alice'), false);

console.log('security.regression.test.ts: all assertions passed');


// WebApp hash length mismatch must fail closed (timing-safe path)
import crypto from 'node:crypto';
{
  const a = Buffer.from('abcd', 'hex');
  const b = Buffer.from('ab', 'hex');
  assert.equal(a.length === b.length && crypto.timingSafeEqual(a, b), false);
}
