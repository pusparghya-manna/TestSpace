import type { Student, Attempt, Exam } from '../types';

export type Notif = {
  id: string;
  at: string;
  title: string;
  body: string;
  kind: 'student' | 'official' | 'practice' | 'progress';
};

export function buildNotifications(students: Student[], attempts: Attempt[], exams: Exam[]): Notif[] {
  const items: Notif[] = [];
  for (const s of students) {
    const at = s.linkedAt || '';
    if (at) {
      items.push({
        id: `stu_${s.id}`,
        at,
        title: 'New student',
        body: `${s.name}${s.telegramUsername ? ' (' + s.telegramUsername + ')' : ''} joined`,
        kind: 'student'
      });
    }
  }
  for (const a of attempts) {
    const exam = exams.find(e => e.id === a.examId);
    const examTitle = exam?.title || 'Exam';
    if (a.status === 'IN_PROGRESS' && a.startedAt) {
      items.push({
        id: `prog_${a.id}`,
        at: a.startedAt,
        title: 'Exam in progress',
        body: `${a.studentName} started ${examTitle}`,
        kind: 'progress'
      });
    }
    if ((a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED') && a.submittedAt) {
      const practice = a.isOfficial === false;
      items.push({
        id: `sub_${a.id}`,
        at: a.submittedAt,
        title: practice ? 'Practice submitted' : 'Exam submitted',
        body: `${a.studentName} · ${examTitle} · ${a.score}/${a.maxScore} (${a.percentage}%)`,
        kind: practice ? 'practice' : 'official'
      });
    }
  }
  items.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
  return items.slice(0, 80);
}
