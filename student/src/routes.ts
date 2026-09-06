export const TAB_PATH: Record<string, string> = {
  home: '/',
  exams: '/exams',
  details: '/exams',
  live: '/exam/live',
  review: '/exam/review',
  results: '/results',
  answers: '/results/review',
  leaderboard: '/leaderboard',
  profile: '/profile',
};

export function pathForTab(tab: string, extra?: { examId?: string; attemptId?: string }) {
  if (tab === 'details' && extra?.examId) return `/exams/${extra.examId}`;
  if (tab === 'answers' && extra?.attemptId) return `/results/${extra.attemptId}`;
  return TAB_PATH[tab] || '/';
}

export function tabFromPath(pathname: string): { tab: string; examId?: string; attemptId?: string } {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { tab: 'home' };
  if (path === '/exams') return { tab: 'exams' };
  const exam = path.match(/^\/exams\/([^/]+)$/);
  if (exam) return { tab: 'details', examId: exam[1] };
  if (path === '/exam/live') return { tab: 'live' };
  if (path === '/exam/review') return { tab: 'review' };
  if (path === '/results') return { tab: 'results' };
  const att = path.match(/^\/results\/([^/]+)$/);
  if (att) return { tab: 'answers', attemptId: att[1] };
  if (path === '/results/review') return { tab: 'answers' };
  if (path === '/leaderboard') return { tab: 'leaderboard' };
  if (path === '/profile') return { tab: 'profile' };
  if (path === '/login') return { tab: 'home' };
  return { tab: 'home' };
}
