import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Check,
  X,
  Grid2X2,
} from 'lucide-react';
import { Question } from '../../types';
import { QuestionImage } from '../QuestionImage';

interface AnswersScreenProps {
  examTitle: string;
  questions: Question[];
  onBackToResults: () => void;
}

export const AnswersScreen: React.FC<AnswersScreenProps> = ({
  examTitle,
  questions,
  onBackToResults,
}) => {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const correctCount = questions.filter((q) => q.status === 'correct').length;
  const wrongCount = questions.filter((q) => q.status === 'wrong').length;
  const skippedCount = questions.filter(
    (q) => q.status === 'unattempted' || !q.status
  ).length;

  const jumpTo = (id: string) => {
    setPaletteOpen(false);
    requestAnimationFrame(() => {
      const el = cardRefs.current[id];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    if (!paletteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  const statusOf = (q: Question) => {
    if (q.status === 'correct') return 'correct' as const;
    if (q.status === 'wrong') return 'wrong' as const;
    return 'skipped' as const;
  };

  return (
    <div className="space-y-3 pb-12 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <button
          onClick={onBackToResults}
          className="p-2 rounded-2xl glass-btn-secondary text-slate-700 hover:text-slate-900 transition"
          aria-label="Back to results"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg md:text-xl font-bold text-slate-900">Answer Review</h1>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{examTitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="p-2 rounded-2xl glass-btn-secondary text-blue-600 flex items-center gap-1 shrink-0"
          title="Question palette"
        >
          <Grid2X2 className="w-4 h-4" />
          <span className="text-[11px] font-bold hidden sm:inline">Palette</span>
        </button>
      </div>

      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 px-0.5">
        <span className="text-emerald-700">{correctCount} correct</span>
        <span>·</span>
        <span className="text-rose-700">{wrongCount} incorrect</span>
        <span>·</span>
        <span>{skippedCount} skipped</span>
        <span className="text-slate-400">· {questions.length} total</span>
      </div>

      <div className="space-y-2.5">
        {questions.map((q, idx) => {
          const st = statusOf(q);
          const isSkipped = st === 'skipped';
          const isCorrect = st === 'correct';
          const userAns = q.selectedIndex;
          const correctAns = q.correctIndex;

          return (
            <article
              key={q.id || idx}
              ref={(el) => {
                if (q.id) cardRefs.current[q.id] = el;
              }}
              id={`review-q-${q.id || idx}`}
              className="glass-card rounded-2xl p-3 md:p-3.5 shadow-xs space-y-2.5 scroll-mt-20"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                    Q{idx + 1}
                    {q.subject ? ` · ${q.subject}` : ''}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg glass-pill text-slate-600">
                    +{q.marks ?? 1}
                    {(q.negativeMarks ?? 0) > 0 ? ` / -${q.negativeMarks}` : ''}
                  </span>
                </div>
                {isSkipped ? (
                  <span className="px-2 py-0.5 rounded-full glass-pill text-slate-600 text-[10px] font-bold">
                    Skipped
                  </span>
                ) : isCorrect ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Correct
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold flex items-center gap-0.5">
                    <X className="w-3 h-3" /> Incorrect
                  </span>
                )}
              </div>

              <QuestionImage imageUrl={q.imageUrl} imageFileId={q.imageFileId} />

              <h2 className="font-semibold text-slate-900 text-xs md:text-sm leading-snug">
                {q.question}
              </h2>

              <div
                className={`p-2.5 rounded-xl border text-xs font-medium ${
                  isSkipped
                    ? 'border-slate-200/60 glass-panel text-slate-500'
                    : isCorrect
                      ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
                      : 'border-rose-300 bg-rose-50/70 text-rose-950'
                }`}
              >
                <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">
                  Your Answer
                </span>
                <p className="font-semibold leading-snug">
                  {isSkipped || userAns === null || userAns === undefined ? (
                    'Skipped / Not answered'
                  ) : (
                    <>
                      <span className="font-bold mr-1">{'ABCD'[userAns]}.</span>
                      {q.options?.[userAns] ?? ''}
                    </>
                  )}
                </p>
              </div>

              {correctAns !== null && correctAns !== undefined && (
                <div className="p-2.5 rounded-xl border border-emerald-300/80 bg-emerald-50/50 text-xs">
                  <span className="text-[9px] uppercase font-bold text-emerald-700 block mb-0.5">
                    Correct Answer
                  </span>
                  <p className="font-bold text-emerald-950 leading-snug">
                    <span className="mr-1">{'ABCD'[correctAns]}.</span>
                    {q.options?.[correctAns] ?? ''}
                  </p>
                </div>
              )}

              {q.explanation ? (
                <div className="p-2.5 rounded-xl glass-card-subtle text-xs space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                    Explanation
                  </span>
                  <p className="text-slate-700 leading-snug">{q.explanation}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="pt-1">
        <button
          onClick={onBackToResults}
          className="w-full py-3 rounded-2xl glass-btn-secondary text-slate-700 font-bold text-xs transition"
        >
          Back to Score & Analytics
        </button>
      </div>

      {paletteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="glass-card rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[75dvh] overflow-hidden shadow-xl flex flex-col border border-white/90"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/40">
              <div className="flex items-center gap-2">
                <Grid2X2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Question Palette</h3>
              </div>
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="text-[11px] font-bold text-slate-500 px-2 py-1 rounded-lg glass-btn-secondary"
              >
                Close
              </button>
            </div>
            <div className="px-4 py-2 flex gap-3 text-[10px] font-semibold border-b border-slate-200/40">
              <span className="flex items-center gap-1 text-emerald-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" /> Correct ({correctCount})
              </span>
              <span className="flex items-center gap-1 text-rose-700">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-600" /> Incorrect ({wrongCount})
              </span>
              <span className="flex items-center gap-1 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-400" /> Skipped ({skippedCount})
              </span>
            </div>
            <div className="p-3 overflow-y-auto overscroll-contain min-h-0 flex-1">
              <div className="grid grid-cols-6 gap-2">
                {questions.map((q, idx) => {
                  const st = statusOf(q);
                  const bg =
                    st === 'correct'
                      ? 'bg-emerald-600 text-white'
                      : st === 'wrong'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-700';
                  return (
                    <button
                      key={q.id || idx}
                      type="button"
                      onClick={() => jumpTo(q.id)}
                      className={`h-9 rounded-xl flex items-center justify-center font-mono text-xs font-bold ${bg}`}
                      title={`Q${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};