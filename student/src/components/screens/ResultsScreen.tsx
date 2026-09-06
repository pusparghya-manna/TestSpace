import React from 'react';
import {
  Clock,
  RotateCcw,
  BookOpen,
  ChevronRight,
  ArrowLeft,
  Trophy,
  BarChart2,
} from 'lucide-react';
import { Exam, ExamAttempt } from '../../types';

interface ResultsScreenProps {
  pastResults: ExamAttempt[];
  exams: Exam[];
  selectedAttempt: ExamAttempt | null;
  onSelectAttempt: (attempt: ExamAttempt | null) => void;
  onReviewAnswers: (attempt: ExamAttempt, exam: Exam) => void;
  onReattempt: (exam: Exam, isPractice?: boolean) => void;
  onGoExams: () => void;
}

function accuracyOf(a: ExamAttempt): number {
  if (a.accuracy != null) return a.accuracy;
  const c = a.correctCount ?? 0;
  const w = a.wrongCount ?? 0;
  const t = c + w;
  return t > 0 ? Math.round((c / t) * 100) : 0;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  pastResults,
  exams,
  selectedAttempt,
  onSelectAttempt,
  onReviewAnswers,
  onReattempt,
  onGoExams,
}) => {
  if (!selectedAttempt) {
    return (
      <div className="space-y-4 pb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            Your Exam Results ({pastResults.length})
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tap any completed exam for score breakdown and solutions.
          </p>
        </div>

        {pastResults.length === 0 ? (
          <div className="glass-card rounded-3xl p-8 text-center shadow-xs">
            <Trophy className="w-8 h-8 text-blue-400 mx-auto" />
            <h3 className="font-bold text-slate-900 text-base mt-2">No completed exams yet</h3>
            <p className="text-xs text-slate-500 mt-1">
              Finish an assigned exam to see scores and ranks from your teacher&apos;s database.
            </p>
            <button
              onClick={onGoExams}
              className="mt-4 px-4 py-2 rounded-2xl glass-btn-primary text-white font-bold text-xs shadow-xs"
            >
              Browse Assigned Exams
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {pastResults.map((attempt, idx) => {
              const score = attempt.score;
              const maxScore = attempt.maxScore;
              const acc = accuracyOf(attempt);
              const completedDate = attempt.submittedAt || attempt.completedAt
                ? new Date(attempt.submittedAt || attempt.completedAt || '').toLocaleDateString(
                    'en-US',
                    { day: 'numeric', month: 'short' }
                  )
                : 'Completed';
              const matchedExam =
                exams.find((e) => e.id === attempt.examId) ||
                ({
                  id: attempt.examId,
                  title: attempt.examTitle,
                  subject: '',
                  className: attempt.className || '',
                  totalQuestions: 0,
                  durationMinutes: 60,
                  totalMarks: maxScore || 0,
                  status: 'RESULTS_PUBLISHED',
                } as Exam);

              return (
                <div
                  key={`${attempt.id || attempt.examId}-${idx}`}
                  className="glass-card rounded-2xl p-3.5 shadow-xs"
                >
                  <div onClick={() => onSelectAttempt(attempt)} className="cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Evaluated
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {attempt.examTitle}
                        </h3>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium shrink-0">
                        {completedDate}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2.5 text-xs">
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        {score !== undefined && maxScore !== undefined ? (
                          <span className="font-bold text-slate-900 font-mono">
                            {score} / {maxScore} pts
                          </span>
                        ) : (
                          <span className="text-slate-400">Score hidden</span>
                        )}
                        <span>•</span>
                        <span className="text-emerald-600 font-semibold font-mono">{acc}% Acc</span>
                        {attempt.rank != null && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-blue-600 font-mono">
                              Rank #{attempt.rank}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-blue-600 flex items-center gap-0.5">
                        Details <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/40">
                    <button
                      onClick={() => onSelectAttempt(attempt)}
                      className="py-2 px-2.5 rounded-xl glass-btn-secondary text-blue-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      View Result
                    </button>
                    <button
                      onClick={() => onReattempt(matchedExam, true)}
                      className="py-2 px-2.5 rounded-xl glass-btn-primary text-white font-bold text-[11px] shadow-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reattempt
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const correct = selectedAttempt.correctCount ?? 0;
  const wrong = selectedAttempt.wrongCount ?? 0;
  const skipped = selectedAttempt.skippedCount ?? 0;
  const totalScore = selectedAttempt.score ?? 0;
  const maxScore = selectedAttempt.maxScore ?? 0;
  const accuracy = accuracyOf(selectedAttempt);
  const timeUsedSeconds = selectedAttempt.timeSpentSeconds || 0;
  const timeUsedMinutes = Math.floor(timeUsedSeconds / 60);
  const timeUsedSecsRemainder = timeUsedSeconds % 60;
  const matchedExam =
    exams.find((e) => e.id === selectedAttempt.examId) ||
    ({
      id: selectedAttempt.examId,
      title: selectedAttempt.examTitle,
      subject: '',
      className: selectedAttempt.className || '',
      totalQuestions: correct + wrong + skipped,
      durationMinutes: 60,
      totalMarks: maxScore,
      status: 'RESULTS_PUBLISHED',
    } as Exam);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onSelectAttempt(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl glass-btn-secondary text-slate-800 text-xs font-bold transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Results</span>
        </button>
        <span className="text-xs font-bold text-slate-400 truncate max-w-[180px]">
          {selectedAttempt.examTitle}
        </span>
      </div>

      <div className="glass-card rounded-2xl p-4 md:p-5 shadow-xs text-center relative overflow-hidden">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
          Your Recorded Score
        </span>
        {selectedAttempt.score !== undefined ? (
          <div className="mt-2 flex items-baseline justify-center gap-1.5 font-mono">
            <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
              {totalScore}
            </span>
            <span className="text-xl md:text-2xl font-bold text-slate-400">/ {maxScore}</span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500 font-semibold">
            Results not published yet by your teacher.
          </p>
        )}
        <p className="text-xs font-semibold text-slate-500 mt-2 flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          Time spent: {timeUsedMinutes}m {timeUsedSecsRemainder}s
          {selectedAttempt.rank != null ? ` · Rank #${selectedAttempt.rank}` : ''}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-left">
          <div className="p-3.5 rounded-2xl glass-pill bg-emerald-50/60 border-emerald-200/60">
            <span className="text-[10px] uppercase font-bold text-emerald-600 block">Correct</span>
            <span className="text-xl font-bold text-slate-900 mt-0.5 block font-mono">{correct}</span>
          </div>
          <div className="p-3.5 rounded-2xl glass-pill bg-rose-50/60 border-rose-200/60">
            <span className="text-[10px] uppercase font-bold text-rose-600 block">Incorrect</span>
            <span className="text-xl font-bold text-slate-900 mt-0.5 block font-mono">{wrong}</span>
          </div>
          <div className="p-3.5 rounded-2xl glass-pill bg-slate-50/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Skipped</span>
            <span className="text-xl font-bold text-slate-900 mt-0.5 block font-mono">{skipped}</span>
          </div>
          <div className="p-3.5 rounded-2xl glass-pill bg-blue-50/60 border-blue-200/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Accuracy</span>
            <span className="text-xl font-bold text-slate-900 mt-0.5 block font-mono">
              {accuracy}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={() => onReviewAnswers(selectedAttempt, matchedExam)}
          className="py-2.5 px-3 rounded-xl glass-btn-primary text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5"
        >
          <BookOpen className="w-4 h-4" />
          Review Solutions
        </button>
        <button
          onClick={() => onReattempt(matchedExam, true)}
          className="py-2.5 px-3 rounded-xl glass-btn-secondary text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          Reattempt
        </button>
      </div>
    </div>
  );
};
