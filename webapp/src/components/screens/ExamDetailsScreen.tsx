import React, { useState } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Exam } from '../../types';

interface ExamDetailsScreenProps {
  exam: Exam;
  onBack: () => void;
  onConfirmStart: (exam: Exam) => void;
}

export const ExamDetailsScreen: React.FC<ExamDetailsScreenProps> = ({
  exam,
  onBack,
  onConfirmStart,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const neg = exam.negativeMarking ?? 0;

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-2xl glass-btn-secondary text-slate-700"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Syllabus & Details
          </span>
          <h1 className="text-xl font-bold text-slate-900">Exam overview</h1>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-5 md:p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-50/90 text-blue-700 border border-blue-200/80">
            {exam.status || 'Exam'}
          </span>
          <span className="text-xs text-slate-400 font-semibold">
            {exam.className || exam.subject || ''}
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mt-3">{exam.title}</h2>
        <p className="text-xs text-slate-500 mt-1">
          {[exam.subject, exam.className].filter(Boolean).join(' · ')}
          {exam.startDate
            ? ` · Starts ${new Date(exam.startDate).toLocaleString()}`
            : ''}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="p-3 rounded-2xl glass-pill">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Questions</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block font-mono">
              {exam.totalQuestions}
            </span>
          </div>
          <div className="p-3 rounded-2xl glass-pill">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Duration</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block font-mono">
              {exam.durationMinutes} Min
            </span>
          </div>
          <div className="p-3 rounded-2xl glass-pill">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Marks</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block font-mono">
              {exam.totalMarks}
            </span>
          </div>
          <div className="p-3 rounded-2xl glass-pill">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Marking</span>
            <span className="text-base font-bold text-emerald-600 mt-0.5 block font-mono">
              {neg > 0 ? `+ / -${neg}` : 'No neg.'}
            </span>
          </div>
        </div>
      </div>


      {!showConfirm ? (
        <div className="glass-card rounded-3xl p-5 shadow-xs text-center space-y-3">
          <h3 className="text-base font-bold text-slate-900">Ready when you are</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Ensure you have an uninterrupted {exam.durationMinutes}-minute session.
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full py-3.5 rounded-2xl glass-btn-primary text-white font-bold text-sm shadow-xs"
          >
            Start Exam
          </button>
        </div>
      ) : (
        <div className="glass-card rounded-3xl p-5 shadow-md space-y-3 border-blue-400/60">
          <div className="flex items-center gap-2 text-blue-700">
            <AlertCircle className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">Start this timed exam now?</h3>
          </div>
          <p className="text-xs text-slate-600">
            The {exam.durationMinutes}-minute countdown begins immediately on the server.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => setShowConfirm(false)}
              className="py-3 rounded-2xl glass-btn-secondary text-slate-700 font-bold text-xs"
            >
              Not Yet
            </button>
            <button
              onClick={() => onConfirmStart(exam)}
              className="py-3 rounded-2xl glass-btn-primary text-white font-bold text-xs shadow-xs"
            >
              Yes, Begin Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
