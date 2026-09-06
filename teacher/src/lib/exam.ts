import type { Question } from '../types';

/** Convert an OCR/JSON answer value to a zero-based option index. */
export function normalizeAnswer(value: unknown, optionCount = 4): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= 0 && value < optionCount ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (numeric === 0) return 0;
    if (numeric >= 1 && numeric <= optionCount) return numeric - 1;
    return null;
  }

  const numberMatch = raw.match(/(?:OPTION|CHOICE|ANSWER)?\s*[:#-]?\s*([1-9]\d*)\b/i);
  if (numberMatch) {
    const numeric = Number(numberMatch[1]);
    return numeric >= 1 && numeric <= optionCount ? numeric - 1 : null;
  }

  const letter = raw.replace(/[.)\]:-].*$/, '').trim().toUpperCase();
  if (/^[A-Z]$/.test(letter)) {
    const index = letter.charCodeAt(0) - 65;
    return index >= 0 && index < optionCount ? index : null;
  }

  const match = raw.match(/(?:OPTION|CHOICE|ANSWER)?\s*[:#-]?\s*([A-Z])\b/i);
  if (match) {
    const index = match[1].toUpperCase().charCodeAt(0) - 65;
    return index >= 0 && index < optionCount ? index : null;
  }

  return null;
}

export const emptyQuestion = (): Question => ({
  id: `Q_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  question: '',
  options: ['', '', '', ''],
  answer: 0,
  marks: 1,
  negativeMarks: 0,
});
