import type { Student } from '../types';

export function dedupeStudents(students: Student[]): Student[] {
  const map = new Map<string, Student>();
  for (const s of students) {
    const key = s.telegramUserId ? `tg:${s.telegramUserId}` : `id:${s.id}`;
    if (!map.has(key)) map.set(key, s);
  }
  return [...map.values()];
}

export function initials(name: string): string {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function avatarColor(s: Student): string {
  const n = (s.telegramUserId || s.id || '').toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const colors = ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700'];
  return colors[n % colors.length];
}
