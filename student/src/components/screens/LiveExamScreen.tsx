import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Grid2X2,
  Clock,
  AlertTriangle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Bookmark,
  Pause,
  Play,
} from 'lucide-react';
import { Exam, ExamAttempt } from '../../types';
import { QuestionImage } from '../QuestionImage';
import { soundManager } from '../../utils/audio';
import { webappApi } from '../../api';
import { AttemptSyncState } from '../../hooks/useAttemptSync';

interface LiveExamScreenProps {
  exam: Exam;
  attempt: ExamAttempt;
  soundEnabled: boolean;
  /** Practice / reattempt (not the official timed window). */
  isPractice?: boolean;
  onUpdateAttempt: (updated: ExamAttempt) => void;
  onOpenReview: () => void;
  onLeaveExam: () => void;
  /** Called when the server deadline is reached; server-persisted answers are authoritative. */
  onTimeUp: () => void;
  onAnswerChange: (questionId: string, value: number | null) => void;
  onIndexChange: (index: number) => void;
  syncState: AttemptSyncState;
  pendingCount: number;
}

export const LiveExamScreen: React.FC<LiveExamScreenProps> = ({
  exam,
  attempt,
  soundEnabled,
  isPractice = false,
  onUpdateAttempt,
  onOpenReview,
  onLeaveExam,
  onTimeUp,
  onAnswerChange,
  onIndexChange,
  syncState,
  pendingCount,
}) => {
  const questions = attempt.questions || exam.questions || [];
  const initialIdx = Math.min(
    attempt.currentQuestionIndex || 0,
    Math.max(0, questions.length - 1)
  );
  const [currentIdx, setCurrentIdx] = useState(initialIdx);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(attempt.secondsLeft);
  const [paused, setPaused] = useState(Boolean(attempt.pausedAt));
  const [pauseBusy, setPauseBusy] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timeUpFired = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  const soundEnabledRef = useRef(soundEnabled);
  const answersRef = useRef(attempt.answers);
  const pausedRef = useRef(false);
  const pauseBusyRef = useRef(false);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    soundEnabledRef.current = soundEnabled;
  }, [onTimeUp, soundEnabled]);

  useEffect(() => {
    answersRef.current = attempt.answers;
  }, [attempt.answers]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const currentQ = questions[currentIdx];

  useEffect(() => {
    setCurrentIdx(
      Math.min(attempt.currentQuestionIndex || 0, Math.max(0, questions.length - 1))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.id]);

  useEffect(() => {
    if (!currentQ) return;
    if (!attempt.visited[currentQ.id]) {
      onUpdateAttempt({
        ...attempt,
        visited: { ...attempt.visited, [currentQ.id]: true },
        currentQuestionIndex: currentIdx,
      });
    }
    onIndexChange(currentIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (pausedRef.current || pauseBusyRef.current) return; // freeze during pause persistence too
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (!timeUpFired.current) {
            timeUpFired.current = true;
            setSubmitting(true);
            onTimeUpRef.current();
          }
          return 0;
        }
        if (soundEnabledRef.current && (s - 1 === 300 || s - 1 === 60)) {
          soundManager.playWarning(true);
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.max(0, Math.floor(secs / 60));
    const s = Math.max(0, secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const isLowTime = secondsLeft <= 300;
  const isCriticalTime = secondsLeft <= 60;

  const handleSelectOption = (optIdx: number) => {
    if (!currentQ || submitting) return;
    soundManager.playSelect(soundEnabled);
    const next = {
      ...attempt,
      answers: { ...attempt.answers, [currentQ.id]: optIdx },
      visited: { ...attempt.visited, [currentQ.id]: true },
    };
    // Keep the auto-submit snapshot current even if the timer ticks before
    // React has committed the parent state update.
    answersRef.current = next.answers;
    onUpdateAttempt(next);
    onAnswerChange(currentQ.id, optIdx);
  };

  const handleClearResponse = () => {
    if (!currentQ) return;
    soundManager.playClick(soundEnabled);
    const answers = { ...attempt.answers };
    delete answers[currentQ.id];
    answersRef.current = answers;
    onUpdateAttempt({ ...attempt, answers });
    onAnswerChange(currentQ.id, null);
  };

  const handleToggleMark = () => {
    if (!currentQ) return;
    soundManager.playClick(soundEnabled);
    const marked = { ...attempt.marked };
    if (marked[currentQ.id]) delete marked[currentQ.id];
    else marked[currentQ.id] = true;
    onUpdateAttempt({ ...attempt, marked });
  };

  const getQuestionState = (idx: number) => {
    const q = questions[idx];
    if (!q) return 'not-visited';
    const hasAnswer = attempt.answers[q.id] !== undefined;
    const isMarked = !!attempt.marked[q.id];
    const isVisited = !!attempt.visited[q.id];
    if (hasAnswer && isMarked) return 'both';
    if (isMarked) return 'marked';
    if (hasAnswer) return 'answered';
    if (isVisited) return 'unanswered';
    return 'not-visited';
  };

  const handlePauseToggle = async () => {
    if (!isPractice || pauseBusy || submitting) return;
    const nextPaused = !paused;
    pauseBusyRef.current = true;
    setPauseBusy(true);
    setPauseError(null);
    setPaused(nextPaused);
    try {
      const state = await webappApi.pause(attempt.id, nextPaused);
      setPaused(state.paused);
      setSecondsLeft(state.secondsLeft);
      onUpdateAttempt({
        ...attempt,
        pausedAt: state.pausedAt,
        pausedSeconds: state.pausedSeconds,
        secondsLeft: state.secondsLeft,
      });
    } catch (err: any) {
      setPaused(!nextPaused);
      setPauseError(err?.message || 'Could not update the practice pause');
    } finally {
      pauseBusyRef.current = false;
      setPauseBusy(false);
    }
  };

  const answeredCount = questions.filter((q) => attempt.answers[q.id] !== undefined).length;
  const markedCount = questions.filter((q) => attempt.marked[q.id]).length;
  const unansweredCount = questions.length - answeredCount;
  const selected = currentQ ? attempt.answers[currentQ.id] : undefined;
  const isMarked = currentQ ? !!attempt.marked[currentQ.id] : false;

  if (!currentQ) {
    return (
      <div className="p-8 text-center glass-card rounded-3xl">
        <p className="text-sm font-semibold text-slate-600">No questions loaded for this exam.</p>
        <button
          onClick={onLeaveExam}
          className="mt-4 px-4 py-2 rounded-xl glass-btn-secondary text-xs font-bold"
        >
          Back to exams
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-[calc(100dvh-7rem)] flex flex-col pb-28 md:pb-24 ${submitting ? 'pointer-events-none opacity-60' : ''}`}>
      {submitting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm">
          <div className="glass-card rounded-2xl px-5 py-4 text-center text-sm font-bold text-slate-800">
            Time up — submitting your answers…
          </div>
        </div>
      )}
      {paused && isPractice && !submitting && (
        <div className="mb-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] font-semibold text-amber-900 flex items-center justify-between gap-2">
          <span>Practice paused — timer frozen. Tap Resume when ready.</span>
          <button
            type="button"
            onClick={() => void handlePauseToggle()}
            disabled={pauseBusy}
            className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold shrink-0 disabled:opacity-60"
          >
            {pauseBusy ? 'Saving…' : 'Resume'}
          </button>
        </div>
      )}
      {pauseError && isPractice && !submitting && (
        <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2 text-[11px] font-semibold text-rose-700">
          {pauseError}
        </div>
      )}
      <header className="sticky top-0 z-30 glass-header -mx-4 px-4 py-2.5 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExitConfirm(true)}
              className="p-2 rounded-2xl glass-btn-secondary text-slate-700"
              title="Pause / Leave"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-xs font-bold text-slate-900 truncate max-w-[140px] md:max-w-[220px]">
                {exam.title}
              </h2>
              <span className="text-[10px] text-slate-400">
                Question {currentIdx + 1} of {questions.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`hidden sm:inline text-[10px] font-semibold ${
                syncState === 'offline' || syncState === 'error' ? 'text-amber-700' : 'text-slate-400'
              }`}
              title={pendingCount ? `${pendingCount} change(s) waiting to sync` : 'Answers sync automatically'}
            >
              {syncState === 'offline' ? 'Offline · saved locally' : pendingCount ? 'Syncing…' : 'Synced'}
            </span>
            {isPractice && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick(soundEnabled);
                  void handlePauseToggle();
                }}
                disabled={pauseBusy}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold border disabled:opacity-60 ${
                  paused
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
                title={paused ? 'Resume practice' : 'Pause practice timer'}
              >
                {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span className="hidden xs:inline sm:inline">{paused ? 'Resume' : 'Pause'}</span>
              </button>
            )}
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-mono font-bold text-xs md:text-sm ${
                paused
                  ? 'bg-slate-200/90 text-slate-600 border border-slate-300'
                  : isCriticalTime
                    ? 'bg-rose-100/90 text-rose-700 border border-rose-300 animate-pulse'
                    : isLowTime
                      ? 'bg-amber-100/90 text-amber-800 border border-amber-300'
                      : 'glass-pill text-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(secondsLeft)}</span>
              {paused ? <span className="text-[10px] font-sans font-bold">PAUSED</span> : null}
            </div>
          </div>

          <button
            onClick={() => setIsPaletteOpen(true)}
            className="p-2 rounded-2xl glass-btn-secondary text-blue-600 text-xs font-bold flex items-center gap-1"
          >
            <Grid2X2 className="w-4 h-4" />
            <span className="text-[11px]">Palette</span>
          </button>
        </div>
        <div className="max-w-4xl mx-auto flex items-center justify-between pt-2 mt-1 border-t border-slate-200/40 text-xs">
          <div className="flex items-center gap-1.5">
            {currentQ.subject && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 font-bold text-[11px]">
                {currentQ.subject}
              </span>
            )}
            <span className="text-[11px] text-slate-400 font-medium">
              +{currentQ.marks ?? 1}
              {(currentQ.negativeMarks ?? 0) > 0 ? ` / -${currentQ.negativeMarks}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleMark}
            className={`flex items-center gap-1 text-[11px] font-bold ${
              isMarked ? 'text-amber-600' : 'text-slate-500'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isMarked ? 'fill-amber-500' : ''}`} />
            {isMarked ? 'Marked' : 'Mark'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto mt-3 space-y-3 flex-1">
        <div className="glass-card rounded-2xl p-4 md:p-5 shadow-xs relative">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Question {currentIdx + 1}
            </span>
          </div>

          <QuestionImage
            imageUrl={currentQ.imageUrl}
            imageFileId={currentQ.imageFileId}
            alt={`Diagram for question ${currentIdx + 1}`}
          />

          <h1 className="font-semibold text-slate-900 leading-relaxed text-sm md:text-base">
            {currentQ.question}
          </h1>

          <div className="mt-4 space-y-2.5">
            {(currentQ.options || []).map((optionText, optIdx) => {
              const isSelected = selected === optIdx;
              return (
                <div
                  key={optIdx}
                  onClick={() => handleSelectOption(optIdx)}
                  className={`group relative flex items-start gap-2.5 p-3 md:p-3.5 rounded-xl border cursor-pointer select-none ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/80 text-blue-950 ring-2 ring-blue-400/30'
                      : 'glass-panel text-slate-800 hover:bg-white/90'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                      isSelected
                        ? 'glass-btn-primary text-white'
                        : 'border border-slate-300/80 glass-pill text-slate-600'
                    }`}
                  >
                    {'ABCD'[optIdx]}
                  </div>
                  <div className="flex-1 text-xs md:text-sm leading-relaxed self-center font-medium">
                    {optionText}
                  </div>
                </div>
              );
            })}
          </div>

          {selected !== undefined && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleClearResponse}
                className="text-xs font-semibold text-rose-600 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear My Selection
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-30 glass-dock py-3 px-4 shadow-lg safe-bottom">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              soundManager.playClick(soundEnabled);
              if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
            }}
            disabled={currentIdx === 0}
            className="px-4 py-2.5 rounded-2xl glass-btn-secondary text-slate-700 disabled:opacity-40 font-bold text-xs md:text-sm flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundManager.playClick(soundEnabled);
              if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1);
              else onOpenReview();
            }}
            className="px-6 py-2.5 rounded-2xl glass-btn-primary text-white font-bold text-xs md:text-sm shadow-xs flex items-center gap-1.5 ml-auto"
          >
            <span>
              {currentIdx === questions.length - 1 ? 'Review & Submit' : 'Save & Next'}
            </span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {isPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40">
          <div className="glass-card rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[calc(100dvh-1rem)] overflow-hidden shadow-xl flex flex-col border border-white/90">
            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/40">
              <div className="flex items-center gap-2">
                <Grid2X2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Question Palette</h3>
              </div>
              <button
                onClick={() => setIsPaletteOpen(false)}
                className="p-1.5 rounded-xl glass-btn-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-3 gap-2 border-b border-slate-200/40 text-center">
              <div className="p-2.5 rounded-2xl glass-pill bg-emerald-50/70">
                <span className="text-[10px] uppercase font-bold text-emerald-700">Answered</span>
                <p className="text-base font-bold text-emerald-700 font-mono">{answeredCount}</p>
              </div>
              <div className="p-2.5 rounded-2xl glass-pill bg-amber-50/70">
                <span className="text-[10px] uppercase font-bold text-amber-700">Marked</span>
                <p className="text-base font-bold text-amber-700 font-mono">{markedCount}</p>
              </div>
              <div className="p-2.5 rounded-2xl glass-pill">
                <span className="text-[10px] uppercase font-bold text-slate-500">Unanswered</span>
                <p className="text-base font-bold text-slate-700 font-mono">{unansweredCount}</p>
              </div>
            </div>
            <div className="p-4 overflow-y-auto overscroll-contain min-h-0 flex-1">
              <div className="grid grid-cols-5 gap-2.5">
                {questions.map((_, idx) => {
                  const state = getQuestionState(idx);
                  let bgClass = 'glass-pill text-slate-700';
                  if (state === 'answered') bgClass = 'bg-emerald-600 text-white font-bold';
                  else if (state === 'marked') bgClass = 'bg-amber-500 text-white font-bold';
                  else if (state === 'both') bgClass = 'bg-purple-600 text-white font-bold';
                  else if (state === 'unanswered')
                    bgClass = 'bg-rose-50 border-2 border-rose-500 text-rose-600 font-bold';
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        soundManager.playClick(soundEnabled);
                        setCurrentIdx(idx);
                        setIsPaletteOpen(false);
                      }}
                      className={`h-10 rounded-2xl flex items-center justify-center font-mono text-sm ${bgClass} ${
                        idx === currentIdx ? 'ring-3 ring-blue-500 ring-offset-2' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-slate-200/40">
              <button
                onClick={() => {
                  setIsPaletteOpen(false);
                  onOpenReview();
                }}
                className="w-full py-2.5 rounded-2xl glass-btn-primary text-white font-bold text-xs"
              >
                Go to Review & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="glass-card rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100/90 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Leave active exam?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Answers are saved on the server. You can resume from Home or Exams.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="py-2.5 rounded-2xl glass-btn-secondary text-slate-700 font-bold text-xs"
              >
                Keep Testing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  onLeaveExam();
                }}
                className="py-2.5 rounded-2xl bg-amber-600 text-white font-bold text-xs"
              >
                Save & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
