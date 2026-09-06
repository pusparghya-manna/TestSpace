import assert from 'node:assert/strict';
import { calculateAttemptScore, secondsLeft, rankOfficialAttempts } from '../lib/scoring.js';
import { normalizeBBox } from '../services/media.js';
import { ownsExam } from '../lib/ownership.js';
import { validateTelegramWebAppData } from '../lib/webappAuth.js';
import crypto from 'node:crypto';

// scoring
{
  const exam = {
    questions: [
      { id: 'q1', answer: 0, marks: 2, negativeMarks: 0.5 },
      { id: 'q2', answer: 1, marks: 1, negativeMarks: 0 },
      { id: 'q3', answer: 2, marks: 1, negativeMarks: 0 },
    ],
  };
  const allCorrect = calculateAttemptScore(exam, { q1: 0, q2: 1, q3: 2 });
  assert.equal(allCorrect.score, 4);
  assert.equal(allCorrect.correctCount, 3);
  const mixed = calculateAttemptScore(exam, { q1: 1, q2: 1 });
  assert.equal(mixed.wrongCount, 1);
  assert.equal(mixed.skippedCount, 1);
  assert.ok(mixed.score <= 1);
}

// bbox
{
  const box = normalizeBBox({ x: 100, y: 100, width: 200, height: 200 }, 1000, 1000);
  assert.ok(box);
  assert.ok(box.width > 10);
  assert.equal(normalizeBBox({ x: 0, y: 0, width: 1000, height: 1000 }, 1000, 1000), null);
}

// ownership
assert.equal(ownsExam({ teacherId: 'alice' }, { username: 'alice' }), true);
assert.equal(ownsExam({ teacherId: 'alice' }, { username: 'bob' }), false);

// webapp auth rejects empty
assert.equal(validateTelegramWebAppData('', 'token'), null);
assert.equal(validateTelegramWebAppData('hash=abc', 'token'), null);

// valid initData
{
  const bot = '123:ABC';
  const user = JSON.stringify({ id: 42, first_name: 'A' });
  const auth_date = String(Math.floor(Date.now() / 1000));
  const params = { user, auth_date, query_id: 'Q' };
  const data = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(bot).digest();
  const hash = crypto.createHmac('sha256', secret).update(data).digest('hex');
  const init = new URLSearchParams({ ...params, hash }).toString();
  const auth = validateTelegramWebAppData(init, bot);
  assert.equal(auth.userId, 42);
}

// rank
{
  const ranked = rankOfficialAttempts([
    { id: '1', status: 'SUBMITTED', isOfficial: true, percentage: 50, score: 5, timeTakenSeconds: 10 },
    { id: '2', status: 'SUBMITTED', isOfficial: true, percentage: 90, score: 9, timeTakenSeconds: 20 },
    { id: '3', status: 'SUBMITTED', isOfficial: false, percentage: 100, score: 10, timeTakenSeconds: 1 },
  ]);
  assert.equal(ranked[0].id, '2');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked.length, 2);
}

// timer pause freeze
{
  const now = Date.now();
  const a = {
    expiresAt: new Date(now + 60_000).toISOString(),
    pausedAt: new Date(now - 5_000).toISOString(),
  };
  const left = secondsLeft(a, now);
  assert.ok(left >= 54 && left <= 66);
}

console.log('parity.unit.test.js: all passed');
