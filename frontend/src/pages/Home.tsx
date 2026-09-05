import React, { useState, useMemo } from 'react';
import type { Exam, Attempt, Student } from '../types';
import { card, btnP } from '../styles/ui';
import { SectionTitle } from '../components/ui/SectionTitle';
import { dedupeStudents } from '../lib/students';
import {
  IconPlus, IconArrowLeft, IconMessage, IconHash, IconResults, IconStar, IconClock,
  IconUsers, IconLive, IconExam, IconRefresh, IconTag, IconTrophy
} from '../icons';

export function Home({ exams, live, submissions, students, attempts, examList, onExams }: {
  exams: number; live: number; submissions: number; students: Student[]; attempts: Attempt[]; examList: Exam[]; onExams: () => void;
}) {
  const [profile, setProfile] = useState<Student | null>(null);

  const uniqueStudents = useMemo(() => dedupeStudents(students), [students]);

  const performance = (s: Student) => {
    const mine = attempts.filter(a =>
      (a.telegramUserId && s.telegramUserId && a.telegramUserId === s.telegramUserId) || a.studentId === s.studentId
    ).filter(a => a.isOfficial !== false && (a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED'));
    if (!mine.length) return -1;
    return Math.max(...mine.map(a => a.percentage || 0));
  };
  const ranked = uniqueStudents.slice().sort((a, b) => performance(b) - performance(a));
  const studentAttempts = (s: Student) =>
    attempts.filter(a =>
      (a.telegramUserId && s.telegramUserId && a.telegramUserId === s.telegramUserId) || a.studentId === s.studentId
    ).slice().sort((a, b) => new Date(b.submittedAt || b.startedAt).getTime() - new Date(a.submittedAt || a.startedAt).getTime());

  const initials = (name: string) =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

  const rankColor = (i: number) =>
    i === 0 ? 'bg-amber-400 text-amber-950'
      : i === 1 ? 'bg-slate-300 text-slate-700'
        : i === 2 ? 'bg-orange-300 text-orange-950'
          : 'bg-slate-100 text-slate-600';

  const avatarColor = (s: Student) => {
    const colors = ['bg-blue-100 text-blue-700', 'bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700'];
    let h = 0;
    for (const c of s.name) h = (h * 31 + c.charCodeAt(0)) % 997;
    return colors[h % colors.length];
  };

  if (profile) {
    const list = studentAttempts(profile);
    return (
      <div className="space-y-3">
        <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700" onClick={() => setProfile(null)}>
          <IconArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className={card + ' p-2.5 ring-1 ring-slate-200/70 overflow-hidden relative'}>
          <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-blue-50" />
          <div className="relative flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg ${avatarColor(profile)} flex items-center justify-center font-bold text-xs shrink-0 ring-1 ring-white shadow-sm`}>{initials(profile.name)}</div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[13px] text-slate-900 truncate">{profile.name}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 space-y-0.5">
                <div className="flex items-center gap-1"><IconMessage className="w-2.5 h-2.5" />{profile.telegramUsername || '—'}</div>
                <div className="flex items-center gap-1"><IconHash className="w-2.5 h-2.5" />{profile.studentId}</div>
              </div>
            </div>
          </div>
        </div>
        <SectionTitle icon={<IconResults className="w-3.5 h-3.5" />} title="Exams & results" />
        {list.length === 0 && <div className={card + ' p-5 text-center text-sm text-slate-500'}>No attempts yet</div>}
        <div className="space-y-2">
          {list.map((a) => {
            const exam = examList.find((e) => e.id === a.examId);
            const practice = a.isOfficial === false;
            return (
              <div key={a.id} className={card + ' p-3'}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-[13px] text-slate-900 truncate">{exam?.title || a.examId}</div>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${practice ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'}`}>
                    {practice ? <IconRefresh className="w-2.5 h-2.5" /> : <IconTag className="w-2.5 h-2.5" />} {practice ? 'Practice' : 'Official'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{a.status.replace(/_/g, ' ')}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1"><IconStar className="w-3 h-3 text-amber-500" />{a.score}/{a.maxScore} ({a.percentage}%)</span>
                  <span className="inline-flex items-center gap-1"><IconClock className="w-3 h-3" />{Math.floor(a.timeTakenSeconds / 60)}m {a.timeTakenSeconds % 60}s</span>
                  {a.rank ? <span className="inline-flex items-center gap-1"><IconTrophy className="w-3 h-3 text-blue-600" />#{a.rank}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Exams', value: exams, Icon: IconExam, tint: 'from-blue-500 to-indigo-500', chip: 'bg-blue-50 text-blue-600' },
    { label: 'Live', value: live, Icon: IconLive, tint: 'from-emerald-500 to-teal-500', chip: 'bg-emerald-50 text-emerald-600' },
    { label: 'Subs', value: submissions, Icon: IconResults, tint: 'from-amber-500 to-orange-500', chip: 'bg-amber-50 text-amber-600' },
    { label: 'Students', value: ranked.length, Icon: IconUsers, tint: 'from-violet-500 to-purple-500', chip: 'bg-violet-50 text-violet-600' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Home</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">TestSpace</p>
        </div>
        <button type="button" onClick={onExams} className={btnP + ' !py-1.5 !px-2.5 text-[11px]'}><IconPlus className="w-3.5 h-3.5" /> Exam</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statCards.map((c) => (
          <div key={c.label} className={card + ' p-2.5 relative overflow-hidden'}>
            <div className={`absolute -right-5 -top-5 w-12 h-12 rounded-full bg-gradient-to-br ${c.tint} opacity-[0.08]`} />
            <div className={`w-7 h-7 rounded-lg ${c.chip} flex items-center justify-center mb-1.5`}>
              <c.Icon className="w-3.5 h-3.5" />
            </div>
            <div className="text-lg font-bold text-slate-900 leading-none">{c.value}</div>
            <div className="text-[9px] font-semibold text-slate-500 mt-0.5 uppercase tracking-wide">{c.label}</div>
          </div>
        ))}
      </div>

      <SectionTitle icon={<IconTrophy className="w-3.5 h-3.5" />} title="Students · by performance" sub="Tap a student to see exams & results" />
      {ranked.length === 0 ? (
        <div className={card + ' p-6 text-center text-sm text-slate-500'}>
          No students yet
        </div>
      ) : (
        <div className="space-y-1.5">
          {ranked.map((s, i) => {
            const perf = performance(s);
            return (
              <button key={s.id} type="button" onClick={() => setProfile(s)} className={card + ' p-2 w-full text-left flex items-center gap-2 hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/5 transition'}>
                <div className={`w-7 h-7 rounded-full ${rankColor(i)} flex items-center justify-center text-[11px] font-bold shrink-0 ring-1 ring-white shadow-sm`}>{i + 1}</div>
                <div className={`w-8 h-8 rounded-full ${avatarColor(s)} flex items-center justify-center text-[11px] font-bold shrink-0 ring-1 ring-white shadow-sm`}>{initials(s.name)}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[13px] text-slate-900 truncate">{s.name}</div>
                  <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                    <IconMessage className="w-2.5 h-2.5 shrink-0" />{s.telegramUsername || '—'} · <IconHash className="w-2.5 h-2.5 shrink-0" />{s.studentId}
                  </div>
                </div>
                <div className={`text-[11px] font-bold shrink-0 px-1.5 py-0.5 rounded-md ${perf < 0 ? 'text-slate-400' : 'text-blue-600 bg-blue-50'}`}>{perf < 0 ? '—' : `${perf}%`}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
