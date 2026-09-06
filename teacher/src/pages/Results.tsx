import React, { useState } from 'react';
import type { Exam, Attempt, Student } from '../types';
import { api } from '../api';
import { toast, toastSuccess, toastError, confirmAsync } from '../lib/notify';
import { inp, btnP, btnS, btnD, card } from '../styles/ui';
import { Sheet } from '../components/ui/Sheet';
import {
  IconCopy, IconDownload, IconArrowLeft, IconMessage, IconSend,
  IconUser, IconHash, IconClock, IconCheck, IconClose, IconTrophy, IconBook
} from '../icons';
import { ActionOverlay } from '../components/ui/ActionOverlay';

export function Results({ exams, attempts, students, onRefresh }: { exams: Exam[]; attempts: Attempt[]; students: Student[]; onRefresh: () => void }) {
  type View = 'exams' | 'pick' | 'official' | 'practice';
  const [view, setView] = useState<View>('exams');
  const [examId, setExamId] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [dmText, setDmText] = useState('');
  const [dmBusy, setDmBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const selectedExam = exams.find((e) => e.id === examId);

  const baseList = attempts.filter((a) => a.examId === examId && (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED'));
  const official = baseList
    .filter((a) => a.isOfficial !== false)
    .slice()
    .sort((a, b) => (b.score - a.score) || (a.timeTakenSeconds - b.timeTakenSeconds));
  const practice = baseList
    .filter((a) => a.isOfficial === false)
    .slice()
    .sort((a, b) => (b.score - a.score) || (a.timeTakenSeconds - b.timeTakenSeconds));

  const list = view === 'official' ? official : view === 'practice' ? practice : [];
  const visible = showAll ? list : list.slice(0, 10);

  const findStudent = (a: Attempt) =>
    students.find((s) => (s.telegramUserId && a.telegramUserId && s.telegramUserId === a.telegramUserId) || s.studentId === a.studentId);

  const openDetail = async (attemptId: string) => {
    // Instant sheet: seed from list data, then hydrate breakdown
    const seed = list.find((a) => a.id === attemptId) || attempts.find((a) => a.id === attemptId);
    const exam = seed ? exams.find((e) => e.id === seed.examId) : undefined;
    setDmText('');
    setDetailLoading(true);
    setDetail({
      attempt: seed || { id: attemptId, studentName: '…' },
      exam: exam ? { id: exam.id, title: exam.title, totalQuestions: exam.totalQuestions } : null,
      breakdown: null,
    });
    try {
      const res = await api(`/api/attempts/${attemptId}/detail`);
      const data = await res.json();
      if (res.ok) setDetail(data);
      else toastError(data.error || 'Failed to load details');
    } catch (e: any) {
      toastError(e?.message || 'Network error');
    } finally {
      setDetailLoading(false);
    }
  };

  const removeAttempt = async (id: string) => {
    if (!(await confirmAsync('Remove from results?'))) return;
    setActionBusy(true);
    try {
      const res = await api(`/api/attempts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error || 'Delete failed');
      }
      setDetail(null);
      toastSuccess('Result removed');
      onRefresh();
    } catch (e: any) {
      toastError(e?.message || 'Delete failed');
    } finally {
      setActionBusy(false);
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!(await confirmAsync('Delete student and all attempts?'))) return;
    setActionBusy(true);
    try {
      const res = await api(`/api/students/${studentId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error || 'Delete failed');
      }
      setDetail(null);
      toastSuccess('Student deleted');
      onRefresh();
    } catch (e: any) {
      toastError(e?.message || 'Delete failed');
    } finally {
      setActionBusy(false);
    }
  };

  const copyText = async () => {
    const lines = list.map((a, i) => {
      const rank = a.rank || i + 1;
      const att = a.isOfficial === false && a.attemptNumber ? ` (attempt #${a.attemptNumber})` : '';
      return `${rank} - ${a.studentName}${att} - ${a.score}`;
    });
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toastSuccess('Copied results text');
    } catch {
      toastError('Could not copy automatically');
    }
  };

  const exportCsv = async () => {
    const res = await api(`/api/results/export?examId=${examId || ''}&practice=${view === 'practice' ? '1' : '0'}`);
    if (!res.ok) {
      // fallback: build client-side CSV if server ignores practice flag
      const rows = ['Rank,Name,Telegram,Score,Max,Percentage,Attempt,Status,TimeSec'];
      list.forEach((a, i) => {
        const stu = findStudent(a);
        rows.push([a.rank || i + 1, a.studentName, stu?.telegramUsername || '', a.score, a.maxScore, a.percentage, a.attemptNumber || 1, a.status, a.timeTakenSeconds].map((x) => `"${x}"`).join(','));
      });
      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const el = document.createElement('a');
      el.href = url;
      el.download = `${view}_${examId || 'exam'}.csv`;
      el.click();
      URL.revokeObjectURL(url);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${view}_${examId || 'exam'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendDm = async (telegramUserId: number) => {
    if (!dmText.trim()) return toastError('Enter a message');
    setDmBusy(true);
    try {
      const res = await api('/api/message', { method: 'POST', body: JSON.stringify({ telegramUserId, message: dmText.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Send failed');
      toastSuccess('Message sent via bot');
      setDmText('');
    } catch (e: any) {
      toastError(e.message || 'Failed');
    } finally {
      setDmBusy(false);
    }
  };

  // —— Main: exam list only ——
  if (view === 'exams') {
    return (
    <>
    <ActionOverlay show={dmBusy} label="Sending…" />
      <div className="space-y-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Results</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Select an exam to view official or practice results</p>
        </div>
        {exams.length === 0 ? (
          <div className={card + ' p-8 text-center text-sm text-slate-500'}>No exams yet</div>
        ) : (
          <div className="space-y-1.5">
            {exams.map((e) => {
              const att = attempts.filter((a) => a.examId === e.id && (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED'));
              const off = att.filter((a) => a.isOfficial !== false).length;
              const prac = att.filter((a) => a.isOfficial === false).length;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { setExamId(e.id); setView('pick'); setShowAll(false); }}
                  className={card + ' p-3 w-full text-left hover:border-blue-300 transition'}
                >
                  <div className="font-semibold text-sm text-slate-900">{e.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {e.subject || '—'} · Official {off} · Practice {prac}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
    );
  }

  // —— Pick official vs practice ——
  if (view === 'pick') {
    return (
    <>
    <ActionOverlay show={dmBusy} label="Sending…" />
      <div className="space-y-3">
        <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 py-2 pr-3" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setView('exams'); }}>
          <IconArrowLeft className="w-4 h-4" /> All exams
        </button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">{selectedExam?.title || 'Exam'}</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Choose result type</p>
        </div>
        <button type="button" className={card + ' p-4 w-full text-left hover:border-blue-300'} onClick={() => { setView('official'); setShowAll(false); }}>
          <div className="font-semibold text-sm">📌 Official Exam Results</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{official.length} submission{official.length === 1 ? '' : 's'} · counts for leaderboard</div>
        </button>
        <button type="button" className={card + ' p-4 w-full text-left hover:border-blue-300'} onClick={() => { setView('practice'); setShowAll(false); }}>
          <div className="font-semibold text-sm">🔁 Practice Results</div>
          <div className="text-[11px] text-slate-500 mt-0.5">{practice.length} attempt{practice.length === 1 ? '' : 's'} · with attempt number</div>
        </button>
      </div>
    </>
    );
  }

  // —— Official or practice list ——
  return (
    <>
    <ActionOverlay show={dmBusy} label="Sending…" />
    <div className="space-y-3">
      <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 py-2 pr-3" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setView('pick'); }}>
        <IconArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{view === 'official' ? 'Official results' : 'Practice results'}</h1>
          <p className="text-[11px] text-slate-500">{selectedExam?.title} · Rank - Name - Marks</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" className={btnS + ' flex-1 !py-1.5 text-[11px]'} onClick={copyText}><IconCopy className="w-3.5 h-3.5" /> Copy text</button>
        <button type="button" className={btnS + ' flex-1 !py-1.5 text-[11px]'} onClick={exportCsv}><IconDownload className="w-3.5 h-3.5" /> Export CSV</button>
      </div>
      <div className="space-y-1.5">
        {list.length === 0 && <div className={card + ' p-6 text-center text-sm text-slate-500'}>No results yet</div>}
        {visible.map((a, i) => {
          const stu = findStudent(a);
          const handle = stu?.telegramUsername;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => openDetail(a.id)}
              className={card + ' p-2.5 w-full text-left flex items-center gap-2 hover:border-blue-300'}
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold shrink-0">{a.rank || i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate text-blue-700">👤 {a.studentName}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {handle ? `💬 ${handle}` : '💬 No username'} · {a.score} marks
                  {view === 'practice' && a.attemptNumber ? ` · Attempt #${a.attemptNumber}` : ''}
                </div>
              </div>
              <div className="font-bold text-sm text-blue-600 shrink-0">{a.percentage}%</div>
            </button>
          );
        })}
      </div>
      {list.length > 10 && (
        <button type="button" className={btnS + ' w-full !py-2 text-xs'} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show top 10' : `Show more (${list.length - 10} more)`}
        </button>
      )}

      {detail && (
        <Sheet
          title={detail.attempt?.studentName || 'Result'}
          subtitle={detail.exam?.title || 'Student attempt'}
          icon={<IconUser className="w-4 h-4" />}
          onClose={() => { setDetail(null); setDetailLoading(false); }}
        >
          <div className="space-y-2.5">
            {/* Summary card */}
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="col-span-2 flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
                  <IconUser className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{detail.attempt.studentName}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-600 truncate">
                  <IconMessage className="w-3 h-3 shrink-0 text-slate-400" />
                  <span className="truncate">{findStudent(detail.attempt)?.telegramUsername || 'No @username'}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-600 truncate">
                  <IconHash className="w-3 h-3 shrink-0 text-slate-400" />
                  {detail.attempt.studentId}
                </div>
                <div className="col-span-2 flex items-center gap-1 text-slate-600">
                  <IconBook className="w-3 h-3 shrink-0 text-slate-400" />
                  <span className="truncate">{detail.exam?.title || '—'}</span>
                </div>
                {detail.attempt.isOfficial === false && (
                  <div className="col-span-2 text-[10px] font-bold text-violet-700 bg-violet-50 rounded-md px-2 py-1 w-fit">
                    Practice{detail.attempt.attemptNumber ? ` · #${detail.attempt.attemptNumber}` : ''}
                  </div>
                )}
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                <div className="rounded-lg bg-blue-50 border border-blue-100 px-2 py-1.5 text-center">
                  <div className="text-[14px] font-bold text-blue-700 leading-none">
                    {detail.attempt.score ?? '—'}/{detail.attempt.maxScore ?? '—'}
                  </div>
                  <div className="text-[9px] font-semibold text-blue-600/80 mt-0.5">Score</div>
                </div>
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-1.5 text-center">
                  <div className="text-[14px] font-bold text-emerald-700 leading-none">
                    {detail.attempt.percentage != null ? `${detail.attempt.percentage}%` : '—'}
                  </div>
                  <div className="text-[9px] font-semibold text-emerald-600/80 mt-0.5">Percent</div>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 text-center">
                  <div className="text-[14px] font-bold text-slate-700 leading-none flex items-center justify-center gap-0.5">
                    <IconClock className="w-3 h-3" />
                    {detail.attempt.timeTakenSeconds != null
                      ? `${Math.floor(detail.attempt.timeTakenSeconds / 60)}m${detail.attempt.timeTakenSeconds % 60}s`
                      : '—'}
                  </div>
                  <div className="text-[9px] font-semibold text-slate-500 mt-0.5">Time</div>
                </div>
              </div>
            </div>

            {/* Message */}
            {(detail.attempt.telegramUserId || findStudent(detail.attempt)?.telegramUserId) && (
              <div className="rounded-xl border border-slate-200 p-2.5 space-y-1.5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Message student</div>
                <div className="flex flex-wrap gap-1.5">
                  {findStudent(detail.attempt)?.telegramUsername && (
                    <a
                      href={`https://t.me/${(findStudent(detail.attempt)!.telegramUsername || '').replace(/^@/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className={btnS + ' !py-1.5 !text-[11px]'}
                    >
                      <IconMessage className="w-3 h-3" /> Open Telegram
                    </a>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <input
                    className={inp + ' !py-1.5 !text-[12px]'}
                    placeholder="Send via bot…"
                    value={dmText}
                    onChange={(e) => setDmText(e.target.value)}
                  />
                  <button
                    type="button"
                    className={btnP + ' !py-1.5 !px-2.5 shrink-0'}
                    disabled={dmBusy || !dmText.trim()}
                    onClick={() =>
                      sendDm(
                        Number(
                          detail.attempt.telegramUserId ||
                            findStudent(detail.attempt)?.telegramUserId
                        )
                      )
                    }
                  >
                    <IconSend className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Breakdown */}
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <IconTrophy className="w-3 h-3" /> Question breakdown
              </div>
              {detailLoading || detail.breakdown == null ? (
                <div className="space-y-1.5" aria-busy="true" aria-label="Loading answers">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 animate-pulse"
                    >
                      <div className="h-2.5 w-16 bg-slate-200 rounded mb-1.5" />
                      <div className="h-3 w-full bg-slate-200 rounded mb-1" />
                      <div className="h-3 w-2/3 bg-slate-200 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-0.5">
                  {(detail.breakdown || []).map((b: any) => {
                    const tone =
                      b.status === 'correct'
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : b.status === 'wrong'
                          ? 'border-red-200 bg-red-50/40'
                          : 'border-slate-200 bg-white';
                    const badge =
                      b.status === 'correct'
                        ? 'bg-emerald-100 text-emerald-700'
                        : b.status === 'wrong'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-500';
                    return (
                      <div key={b.questionId || b.index} className={`rounded-lg border p-2 ${tone}`}>
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[10px] font-bold text-slate-500">Q{b.index}</span>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${badge}`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="text-[12px] font-medium text-slate-800 leading-snug line-clamp-3">
                          {b.question}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-600 space-y-0.5">
                          {b.status !== 'skipped' && (
                            <div>
                              Your: {typeof b.selected === 'number' ? String.fromCharCode(65 + b.selected) : '—'}
                              {b.options?.[b.selected] != null ? ` · ${b.options[b.selected]}` : ''}
                            </div>
                          )}
                          <div className="text-emerald-700">
                            Correct: {typeof b.correctAnswer === 'number' ? String.fromCharCode(65 + b.correctAnswer) : '—'}
                            {b.options?.[b.correctAnswer] != null ? ` · ${b.options[b.correctAnswer]}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-1.5 pt-0.5">
              <button
                type="button"
                className={btnD + ' flex-1 !py-2 !text-[11px] border border-red-100 rounded-lg'}
                disabled={actionBusy}
                aria-busy={actionBusy}
                onClick={() => removeAttempt(detail.attempt.id)}
              >
                Remove result
              </button>
              {findStudent(detail.attempt) && (
                <button
                  type="button"
                  className={btnD + ' flex-1 !py-2 !text-[11px] border border-red-100 rounded-lg'}
                  disabled={actionBusy}
                  aria-busy={actionBusy}
                  onClick={() => removeStudent(findStudent(detail.attempt)!.id)}
                >
                  Delete student
                </button>
              )}
            </div>
          </div>
        </Sheet>
      )}
    </div>
    </>
  );
}
