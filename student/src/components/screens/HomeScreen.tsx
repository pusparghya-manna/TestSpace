import React from 'react';
import { Clock, ChevronRight, PlayCircle } from 'lucide-react';
import { Exam, ExamAttempt, UserProfile, OngoingSummary } from '../../types';

interface HomeScreenProps {
  profile: UserProfile;
  ongoingAttempt: ExamAttempt | null;
  ongoingSummary: OngoingSummary | null;
  availableExams: Exam[];
  onNavigate: (tab: string) => void;
  onSelectExam: (exam: Exam) => void;
  onResumeOngoing: () => void;
  isBusy?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  profile,
  ongoingAttempt,
  ongoingSummary,
  availableExams,
  onNavigate,
  onSelectExam,
  onResumeOngoing,
  isBusy = false,
}) => {
  const hasOngoing =
    (ongoingAttempt && !ongoingAttempt.isSubmitted) || !!ongoingSummary;
  const ongoingTitle =
    ongoingAttempt?.examTitle || ongoingSummary?.examTitle || 'Exam in progress';
  const answered =
    ongoingAttempt
      ? Object.keys(ongoingAttempt.answers || {}).length
      : ongoingSummary?.answeredCount || 0;
  const total =
    ongoingAttempt?.questions?.length ||
    ongoingSummary?.totalQuestions ||
    0;
  const minutesLeft = ongoingAttempt
    ? Math.floor(ongoingAttempt.secondsLeft / 60)
    : ongoingSummary
      ? Math.floor(ongoingSummary.secondsLeft / 60)
      : 0;
  const progressPct =
    total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;

  const liveExams = availableExams.filter(
    (e) => e.status === 'LIVE' || e.status === 'SCHEDULED'
  );
  const featured = liveExams[0] || availableExams[0];

  const initials =
    (profile.name || 'ST')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="space-y-4 pb-10">
      <div className="glass-card rounded-2xl p-4 shadow-xs relative overflow-hidden">
        <div className="flex items-center gap-3">
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt="Student profile photo"
              className="w-11 h-11 rounded-xl object-cover shadow-md shadow-blue-500/20"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl glass-btn-primary text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" aria-hidden>
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              Welcome back
            </span>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight truncate">
              {profile.name || 'Student'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
              {[profile.studentId, profile.telegramAccount]
                .filter(Boolean)
                .join(' · ') || 'Linked Telegram student'}
            </p>
          </div>
        </div>
      </div>

      {hasOngoing && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Continue your exam
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-50/80 text-amber-800 border border-amber-200/80">
              Ongoing
            </span>
          </div>
          <div className="glass-card rounded-2xl p-4 shadow-xs border-amber-200/60">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{ongoingTitle}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {answered} of {total || '—'} answered · {minutesLeft} min left
                </p>
              </div>
              <div className="p-2.5 rounded-2xl glass-panel text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
                <span>Attempt progress</span>
                <span className="font-mono font-bold text-amber-600">{progressPct}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-200/60 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onResumeOngoing}
              disabled={isBusy}
              className="mt-3 w-full py-2.5 px-3 rounded-xl glass-btn-primary text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-60 disabled:cursor-wait"
            >
              <PlayCircle className="w-4 h-4" />
              {isBusy ? 'Resuming…' : 'Resume Exam'}
            </button>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm md:text-base font-bold text-slate-900">Available exams</h2>
          <button
            onClick={() => onNavigate('exams')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
          >
            View all
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!featured ? (
          <div className="glass-card rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-slate-600">No exams assigned yet</p>
            <p className="text-xs text-slate-400 mt-1">
              When your teacher publishes a test, it will appear here from the live database.
            </p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-50/90 text-emerald-700 border border-emerald-200/80">
                {featured.status === 'LIVE' ? 'Live now' : featured.status || 'Available'}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                {featured.subject || featured.className || 'Exam'}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-2">{featured.title}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {[featured.subject, featured.className].filter(Boolean).join(' · ')}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              <span className="px-3 py-1 rounded-xl glass-pill text-slate-700 font-semibold">
                {featured.totalQuestions} Questions
              </span>
              <span className="px-3 py-1 rounded-xl glass-pill text-slate-700 font-semibold">
                {featured.durationMinutes} mins
              </span>
              <span className="px-3 py-1 rounded-xl glass-pill text-slate-700 font-semibold font-mono">
                +{featured.totalMarks} Marks
              </span>
            </div>
            <button
              onClick={() => onSelectExam(featured)}
              className="mt-3 w-full py-2 px-3 rounded-lg glass-btn-primary text-white font-bold text-[11px] shadow-xs"
            >
              View & Start
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
