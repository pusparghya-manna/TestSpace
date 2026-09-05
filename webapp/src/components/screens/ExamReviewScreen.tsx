import React, { useState } from 'react';
import { ArrowLeft, AlertTriangle, Send } from 'lucide-react';
import { Exam, ExamAttempt } from '../../types';

interface ExamReviewScreenProps {
  exam: Exam;
  attempt: ExamAttempt;
  onReturnToLive: () => void;
  onJumpToQuestion: (idx: number) => void;
  onFinalSubmit: () => void;
}

export const ExamReviewScreen: React.FC<ExamReviewScreenProps> = ({
  exam,
  attempt,
  onReturnToLive,
  onJumpToQuestion,
  onFinalSubmit,
}) => {
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const questions = attempt.questions || exam.questions || [];
  const answeredCount = questions.filter(
    (q) => attempt.answers[q.id] !== undefined && attempt.answers[q.id] !== null
  ).length;
  const markedCount = questions.filter((q) => attempt.marked[q.id]).length;
  const unansweredCount = questions.length - answeredCount;

  const getQuestionState = (idx: number) => {
    const q = questions[idx];
    if (!q) return 'not-visited';
    const hasAnswer = attempt.answers[q.id] !== undefined && attempt.answers[q.id] !== null;
    const isMarked = !!attempt.marked[q.id];
    const isVisited = !!attempt.visited[q.id];
    if (hasAnswer && isMarked) return 'both';
    if (isMarked) return 'marked';
    if (hasAnswer) return 'answered';
    if (isVisited) return 'unanswered';
    return 'not-visited';
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onReturnToLive}
          className="p-2 rounded-2xl glass-btn-secondary text-slate-700 hover:text-slate-900 transition"
          aria-label="Return to exam"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Pre-Submission Audit
          </span>
          <h1 className="text-xl font-bold text-slate-900">Review your exam</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-4 rounded-3xl glass-pill bg-emerald-50/70 border-emerald-200/70 shadow-xs">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Answered
          </span>
          <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{answeredCount}</p>
        </div>
        <div className="p-4 rounded-3xl glass-pill bg-amber-50/70 border-amber-200/70 shadow-xs">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
            Marked Review
          </span>
          <p className="text-2xl font-black text-amber-700 mt-1 font-mono">{markedCount}</p>
        </div>
        <div className="p-4 rounded-3xl glass-pill bg-rose-50/70 border-rose-200/70 shadow-xs">
          <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
            Unanswered
          </span>
          <p className="text-2xl font-black text-rose-700 mt-1 font-mono">{unansweredCount}</p>
        </div>
        <div className="p-4 rounded-3xl glass-card shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</span>
          <p className="text-2xl font-black text-slate-900 mt-1 font-mono">{questions.length}</p>
        </div>
      </div>

      {unansweredCount > 0 && (
        <div className="rounded-3xl glass-pill bg-amber-50/80 border-amber-300/80 p-4 flex gap-3 items-start shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-0.5">
            <p className="font-bold">You have {unansweredCount} unanswered questions.</p>
            <p className="text-amber-800/90">
              Tap a question square below to jump back and answer before submitting.
            </p>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl p-4 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-3">Question Navigator</h3>
        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
          {questions.map((q, idx) => {
            const state = getQuestionState(idx);
            let bgClass = 'glass-pill text-slate-700';
            if (state === 'answered') {
              bgClass = 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-xs';
            } else if (state === 'marked') {
              bgClass = 'bg-amber-500 border-amber-500 text-white font-bold shadow-xs';
            } else if (state === 'both') {
              bgClass = 'bg-purple-600 border-purple-600 text-white font-bold shadow-xs';
            } else if (state === 'unanswered') {
              bgClass = 'bg-rose-50 border-2 border-rose-500 text-rose-600 font-bold';
            }
            return (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => onJumpToQuestion(idx)}
                className={`h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold ${bgClass}`}
                title={`Jump to question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={onReturnToLive}
          className="py-2.5 px-3 rounded-xl glass-btn-secondary text-slate-700 font-bold text-xs"
        >
          Return to Exam
        </button>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5"
        >
          <Send className="w-4 h-4" />
          Submit Exam
        </button>
      </div>

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="glass-card rounded-2xl w-full max-w-sm p-4 shadow-xl space-y-3 border-white">
            <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Submit your exam?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              You cannot change answers after submission. Score and solutions come from the live
              quiz database.
            </p>
            <div className="p-3.5 rounded-2xl glass-pill text-xs space-y-1.5 border-slate-200/50">
              <div className="flex justify-between">
                <span className="text-slate-500">Answered questions:</span>
                <span className="font-bold text-emerald-600">
                  {answeredCount} of {questions.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Marked for review:</span>
                <span className="font-bold text-amber-600">{markedCount}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="py-2.5 rounded-2xl glass-btn-secondary text-slate-700 font-bold text-xs"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubmitModal(false);
                  onFinalSubmit();
                }}
                className="py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Yes, Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
