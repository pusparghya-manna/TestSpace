/** Shared visual theme for Telegram bot menus (HTML parse_mode). */

export function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Soft section divider */
export const DIV = '────────────────';

export function titleBlock(emoji: string, title: string): string {
  return `<b>${emoji} ${escapeHtml(title)}</b>`;
}

export function subtitle(text: string): string {
  return `<i>${escapeHtml(text)}</i>`;
}

export function line(emoji: string, label: string, value?: string): string {
  if (value === undefined || value === '') {
    return `${emoji} ${escapeHtml(label)}`;
  }
  return `${emoji} <b>${escapeHtml(label)}</b> ${escapeHtml(value)}`;
}

export function kv(label: string, value: string): string {
  return `• <b>${escapeHtml(label)}:</b> ${escapeHtml(value)}`;
}

export function quote(inner: string): string {
  return `<blockquote>${inner}</blockquote>`;
}

/** Option card for MCQ / review */
export function optionBox(letter: string, text: string, selected = false): string {
  const mark = selected ? '●' : '○';
  return `<blockquote>${mark} <b>${escapeHtml(letter)}.</b> ${escapeHtml(text)}</blockquote>`;
}

/** @deprecated no longer shown on menus */
export function brandFooter(): string {
  return '';
}

export function emptyState(emoji: string, title: string, hint: string): string {
  return quote(`${titleBlock(emoji, title)}\n\n${escapeHtml(hint)}`);
}
