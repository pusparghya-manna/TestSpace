import { splitTelegramMessage } from '../utils/telegramSplit.js';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const cases = [4095, 4096, 4097, 10000, 50000];
for (const n of cases) {
  const text = 'x'.repeat(n);
  const parts = splitTelegramMessage(text, 4000);
  assert(parts.every((p) => p.length <= 4000), `chunk too long for n=${n}`);
  assert(parts.join('').replace(/\s/g, '').length >= text.length - parts.length, `content loss n=${n}`);
  console.log(`ok length ${n} -> ${parts.length} chunks`);
}

// newline preference
const lines = Array.from({ length: 200 }, (_, i) => `line ${i} content here`).join('\n');
const parts = splitTelegramMessage(lines, 4000);
assert(parts.length > 1, 'expected multiple');
assert(parts.every((p) => p.length <= 4000), 'newline split too long');
console.log('ok newline split', parts.length);

console.log('telegramSplit tests passed');
