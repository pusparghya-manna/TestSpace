/**
 * Split text for Telegram's ~4096 character limit.
 * Prefer newlines, then spaces, then hard split. Unicode-safe (code-point aware).
 */
export function splitTelegramMessage(text: string, maxLength = 4000): string[] {
  if (text == null) return [''];
  const s = String(text);
  if (s.length <= maxLength) return [s];

  const chunks: string[] = [];
  let remaining = s;

  while (remaining.length > maxLength) {
    let slice = remaining.slice(0, maxLength);
    let breakAt = -1;

    const nl = slice.lastIndexOf('\n');
    if (nl >= Math.floor(maxLength * 0.4)) breakAt = nl + 1;

    if (breakAt < 0) {
      const sp = slice.lastIndexOf(' ');
      if (sp >= Math.floor(maxLength * 0.4)) breakAt = sp + 1;
    }

    if (breakAt < 0) {
      // Avoid splitting surrogate pairs
      breakAt = maxLength;
      if (breakAt > 0 && breakAt < remaining.length) {
        const code = remaining.charCodeAt(breakAt - 1);
        if (code >= 0xd800 && code <= 0xdbff) breakAt -= 1;
      }
    }

    const part = remaining.slice(0, breakAt).trimEnd();
    chunks.push(part.length ? part : remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining.length) chunks.push(remaining);
  return chunks.length ? chunks : [''];
}
