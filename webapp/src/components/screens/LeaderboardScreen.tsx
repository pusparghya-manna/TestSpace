import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Clock, ChevronDown, Check } from 'lucide-react';
import { ExamAttempt, Exam, LeaderboardRow } from '../../types';
import { webappApi } from '../../api';

interface LeaderboardScreenProps {
  pastResults: ExamAttempt[];
  exams?: Exam[];
  currentUserName: string;
  onSelectExamResult?: (attempt: ExamAttempt) => void;
}


type ExamOption = {
  id: string;
  title: string;
  score?: number;
  maxScore?: number;
  rank?: number | null;
  accuracy?: number;
};

/** Custom in-app dropdown (avoids native mobile select UI). */
function ExamSelectDropdown({
  options,
  value,
  onChange,
}: {
  options: ExamOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const metaLine = (opt: ExamOption) => {
    const parts: string[] = [];
    if (opt.rank != null) parts.push(`Rank #${opt.rank}`);
    if (opt.score !== undefined) {
      parts.push(`${opt.score}${opt.maxScore != null ? `/${opt.maxScore}` : ''} pts`);
    }
    return parts.join(' · ');
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="lb-exam-label"
        onClick={() => setOpen((v) => !v)}
        className={`w-full glass-card rounded-2xl px-4 py-3 text-left flex items-center gap-3 transition border ${
          open
            ? 'border-blue-400/80 ring-2 ring-blue-500/20 shadow-md'
            : 'border-slate-200/60 hover:border-slate-300'
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">
            {selected?.title || 'Select an exam'}
          </p>
          {selected && metaLine(selected) ? (
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
              {metaLine(selected)}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby="lb-exam-label"
          className="absolute z-30 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200/70 bg-white/95 backdrop-blur-md shadow-xl shadow-slate-900/10 py-1.5"
        >
          {options.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <li key={opt.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition ${
                    isSelected
                      ? 'bg-blue-50/90 text-blue-900'
                      : 'hover:bg-slate-50 text-slate-900'
                  }`}
                >
                  <span
                    className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300'
                    }`}
                  >
                    {isSelected ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold truncate">{opt.title}</span>
                    {metaLine(opt) ? (
                      <span className="block text-[11px] text-slate-500 font-medium mt-0.5">
                        {metaLine(opt)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  pastResults,
  exams = [],
  currentUserName,
}) => {
  // The exam catalog is the source of truth for the selector. Previously, any
  // completed result caused the selector to be built only from pastResults,
  // hiding every other exam returned by the teacher/student session.
  const resultByExam = new Map<string, ExamAttempt>();
  for (const result of pastResults) {
    if (!resultByExam.has(result.examId)) resultByExam.set(result.examId, result);
  }
  const examOptions: ExamOption[] = [];
  const seenExamIds = new Set<string>();
  for (const exam of exams) {
    if (seenExamIds.has(exam.id)) continue;
    seenExamIds.add(exam.id);
    const result = resultByExam.get(exam.id);
    examOptions.push({
      id: exam.id,
      title: exam.title,
      score: result?.score,
      maxScore: result?.maxScore,
      rank: result?.rank,
      accuracy: result?.accuracy,
    });
  }
  // Keep result-only entries visible for older attempts whose exam is no
  // longer present in the current catalog response.
  for (const result of pastResults) {
    if (seenExamIds.has(result.examId)) continue;
    seenExamIds.add(result.examId);
    examOptions.push({
      id: result.examId,
      title: result.examTitle || 'Exam',
      score: result.score,
      maxScore: result.maxScore,
      rank: result.rank,
      accuracy: result.accuracy,
    });
  }

  const [selectedExamId, setSelectedExamId] = useState<string>(examOptions[0]?.id || '');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [examTitle, setExamTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedExamId && examOptions[0]?.id) {
      setSelectedExamId(examOptions[0].id);
    }
  }, [examOptions, selectedExamId]);

  useEffect(() => {
    if (!selectedExamId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await webappApi.leaderboard(selectedExamId);
        if (cancelled) return;
        setRows(data.rows || []);
        setExamTitle(data.exam?.title || '');
      } catch (e: any) {
        if (cancelled) return;
        setRows([]);
        setError(e?.message || 'Leaderboard unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedExamId]);

  const selectedMeta = examOptions.find((e) => e.id === selectedExamId);
  const top3 = rows.slice(0, 3);
  const me = rows.find((r) => r.isMe);

  if (examOptions.length === 0) {
    return (
      <div className="space-y-4 pb-8">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
            Rankings & Standings
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Exam Leaderboard</h1>
        </div>
        <div className="glass-card rounded-3xl p-8 text-center">
          <Trophy className="w-8 h-8 text-blue-400 mx-auto" />
          <h3 className="font-bold text-slate-900 mt-2">No leaderboards yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Complete an exam to view rankings from the live database.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
          Rankings & Standings
        </span>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Exam Leaderboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Live ranks from your teacher&apos;s published leaderboards.
        </p>
      </div>

      <section className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500" id="lb-exam-label">
          Select exam
        </label>
        <ExamSelectDropdown
          options={examOptions}
          value={selectedExamId}
          onChange={setSelectedExamId}
        />
      </section>

      {selectedMeta && (
        <section className="glass-card rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Leaderboard
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                {examTitle || selectedMeta.title}
              </h2>
            </div>
            {(me?.rank ?? selectedMeta.rank) != null && (
              <span className="px-3 py-1 text-xs font-bold rounded-full glass-btn-primary text-white shadow-xs">
                Rank #{me?.rank ?? selectedMeta.rank}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mt-3">
            <div className="p-3 rounded-2xl glass-pill bg-blue-50/60 border-blue-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Your Rank</span>
              <p className="text-base md:text-lg font-black text-blue-600 font-mono mt-0.5">
                {me?.rank ?? selectedMeta.rank ?? '—'}
              </p>
            </div>
            <div className="p-3 rounded-2xl glass-pill">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Your Score</span>
              <p className="text-base md:text-lg font-black text-slate-900 font-mono mt-0.5">
                {me?.score ?? selectedMeta.score ?? '—'}
              </p>
            </div>
            <div className="p-3 rounded-2xl glass-pill bg-emerald-50/60 border-emerald-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Accuracy</span>
              <p className="text-base md:text-lg font-black text-emerald-600 font-mono mt-0.5">
                {me?.percentage != null
                  ? `${me.percentage}%`
                  : selectedMeta.accuracy != null
                    ? `${selectedMeta.accuracy}%`
                    : '—'}
              </p>
            </div>
          </div>
        </section>
      )}

      {loading && (
        <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading leaderboard">
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div className="h-4 w-40 rounded bg-slate-200/80" />
            <div className="h-3 w-56 rounded bg-slate-200/60" />
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="h-16 rounded-2xl bg-slate-200/70" />
              <div className="h-16 rounded-2xl bg-slate-200/70" />
              <div className="h-16 rounded-2xl bg-slate-200/70" />
            </div>
          </div>
          <div className="glass-card rounded-2xl p-4 space-y-2">
            <div className="h-10 rounded-xl bg-slate-200/70" />
            <div className="h-10 rounded-xl bg-slate-200/60" />
            <div className="h-10 rounded-xl bg-slate-200/50" />
          </div>
        </div>
      )}
      {error && (
        <div className="glass-card rounded-2xl p-4 text-xs text-amber-800 border border-amber-200">
          {error}
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Top Rankers
            </h2>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {[top3[1], top3[0], top3[2]].map((entry, i) => {
                if (!entry) return <div key={i} />;
                const place = entry.rank;
                const isFirst = place === 1;
                return (
                  <div
                    key={entry.rank}
                    className={`glass-card rounded-2xl p-3.5 text-center flex flex-col justify-between shadow-xs ${
                      isFirst
                        ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/80 via-white/80 to-amber-50/40 -translate-y-1'
                        : ''
                    }`}
                  >
                    <div>
                      <span className="text-base mb-1 block">
                        {place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        {place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'}
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                        {entry.isMe ? `${currentUserName} (You)` : entry.name}
                      </h3>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-200/40">
                      <p className="text-xs font-mono font-bold text-slate-800">{entry.score}</p>
                      <span className="text-[10px] text-emerald-600 font-mono font-semibold">
                        {entry.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass-card rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Complete Scoreboard</h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">{rows.length} ranked</span>
            </div>
            <div className="divide-y divide-slate-100/80">
              {rows.map((entry) => {
                const isMe = entry.isMe;
                const displayName = isMe ? `${currentUserName} (You)` : entry.name;
                return (
                  <div
                    key={`${entry.rank}-${entry.name}`}
                    className={`p-3 flex items-center justify-between gap-2 ${
                      isMe
                        ? 'bg-blue-50/70 border-l-4 border-blue-600 font-semibold'
                        : 'hover:bg-white/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          entry.rank === 1
                            ? 'bg-amber-100 text-amber-700'
                            : entry.rank === 2
                              ? 'bg-slate-200 text-slate-700'
                              : entry.rank === 3
                                ? 'bg-amber-100/60 text-amber-800'
                                : isMe
                                  ? 'glass-btn-primary text-white'
                                  : 'glass-pill text-slate-600'
                        }`}
                      >
                        {entry.rank}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-xs md:text-sm font-bold truncate ${
                            isMe ? 'text-blue-900' : 'text-slate-900'
                          }`}
                        >
                          {displayName}
                        </p>
                        {entry.timeTakenSeconds != null && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {Math.floor(entry.timeTakenSeconds / 60)}m{' '}
                            {entry.timeTakenSeconds % 60}s
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs md:text-sm font-bold font-mono text-slate-900">
                        {entry.score}
                        {entry.maxScore != null ? ` / ${entry.maxScore}` : ''}
                      </p>
                      <span className="text-[10px] text-emerald-600 font-mono font-semibold">
                        {entry.percentage}% Acc
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {!loading && !error && rows.length === 0 && selectedExamId && (
        <div className="glass-card rounded-3xl p-6 text-center text-xs text-slate-500">
          No published ranks for this exam yet.
        </div>
      )}
    </div>
  );
};
