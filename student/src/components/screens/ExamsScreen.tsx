import React from 'react';
import { PlayCircle, RotateCcw } from 'lucide-react';
import { Exam, ExamAttempt, OngoingSummary } from '../../types';

interface ExamsScreenProps {
  exams: Exam[];
  pastResults: ExamAttempt[];
  ongoingAttempt: ExamAttempt | null;
  ongoingSummary: OngoingSummary | null;
  onSelectExam: (exam: Exam) => void;
  onStartExamDirect: (exam: Exam, isPractice?: boolean) => void;
  onResumeOngoing: () => void;
  isBusy?: boolean;
}

function isActive(status: string) {
  return status === 'LIVE' || status === 'SCHEDULED';
}

function isPast(status: string) {
  return status === 'ENDED' || status === 'RESULTS_PUBLISHED';
}

export const ExamsScreen: React.FC<ExamsScreenProps> = ({
  exams,
  pastResults,
  ongoingAttempt,
  ongoingSummary,
  onSelectExam,
  onStartExamDirect,
  onResumeOngoing,
  isBusy = false,
}) => {
  const assigned = exams.filter((e) => isActive(e.status));
  const past = exams.filter((e) => isPast(e.status));
  const other = exams.filter((e) => !isActive(e.status) && !isPast(e.status));
  const hasOngoing =
    (ongoingAttempt && !ongoingAttempt.isSubmitted) || !!ongoingSummary;

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Teacher Given Exams</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Live data from your teacher&apos;s exam database.
        </p>
      </div>

      {hasOngoing && (
        <button
          type="button"
          onClick={onResumeOngoing}
          disabled={isBusy}
          className="w-full glass-card rounded-2xl p-4 border border-amber-200/70 text-left disabled:opacity-60 disabled:cursor-wait"
        >
          <span className="text-[10px] font-bold uppercase text-amber-700">Ongoing</span>
          <p className="text-sm font-bold text-slate-900 mt-0.5">
            {ongoingAttempt?.examTitle || ongoingSummary?.examTitle}
          </p>
          <p className="text-xs text-blue-600 font-semibold mt-1">{isBusy ? 'Resuming…' : 'Tap to resume →'}</p>
        </button>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Active exams ({assigned.length})
        </h2>
        {assigned.length === 0 ? (
          <div className="glass-card rounded-2xl p-5 text-center text-xs text-slate-500">
            No live or scheduled exams right now.
          </div>
        ) : (
          assigned.map((exam) => (
            <div key={exam.id} className="glass-card rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50/90 text-emerald-700 border border-emerald-200/80">
                  {exam.status}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {exam.startDate
                    ? new Date(exam.startDate).toLocaleString()
                    : 'Available'}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-2">{exam.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {[exam.subject, exam.className].filter(Boolean).join(' · ')}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px]">
                <span className="px-3 py-1 rounded-xl glass-pill text-slate-700 font-semibold">
                  {exam.totalQuestions} Questions
                </span>
                <span className="px-3 py-1 rounded-xl glass-pill text-slate-700 font-semibold">
                  {exam.durationMinutes} mins
                </span>
                <span className="px-3 py-1 rounded-xl glass-pill text-slate-700 font-semibold font-mono">
                  +{exam.totalMarks} Marks
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200/40">
                <button
                  onClick={() => onSelectExam(exam)}
                  className="w-full py-2 px-3 rounded-lg glass-btn-primary text-white font-bold text-[11px] shadow-xs flex items-center justify-center gap-1.5"
                >
                  <PlayCircle className="w-4 h-4" />
                  Start Exam
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {(past.length > 0 || other.length > 0) && (
        <section className="space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Past / other ({past.length + other.length})
          </h2>
          {[...past, ...other].map((exam) => {
            const attempt = pastResults.find((r) => r.examId === exam.id);
            return (
              <div key={exam.id} className="glass-card-subtle rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md glass-pill text-slate-600 shrink-0">
                      {exam.status}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 truncate">{exam.title}</h3>
                  </div>
                  {attempt?.score !== undefined && (
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 font-mono shrink-0">
                      {attempt.score}/{attempt.maxScore}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span>{exam.totalQuestions} Qs</span>
                    <span>•</span>
                    <span>{exam.durationMinutes}m</span>
                    <span>•</span>
                    <span className="font-mono">+{exam.totalMarks}</span>
                    {attempt?.rank != null && (
                      <>
                        <span>•</span>
                        <span className="font-bold text-amber-600">Rank #{attempt.rank}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-200/40">
                  <button
                    onClick={() => onStartExamDirect(exam, true)}
                    className="w-full py-2 px-3 rounded-lg glass-btn-primary text-white font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reattempt
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};
