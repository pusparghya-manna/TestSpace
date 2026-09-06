import { StudentAuthGate } from './components/StudentAuthGate';
import React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pathForTab, tabFromPath } from './routes';
import { AlertCircle } from 'lucide-react';
import { Exam, ExamAttempt, UserProfile, Question, OngoingSummary } from './types';
import { DesktopNavigation, MobileNavigation } from './components/Navigation';
import { HomeScreen } from './components/screens/HomeScreen';
import { ExamsScreen } from './components/screens/ExamsScreen';
import { ExamDetailsScreen } from './components/screens/ExamDetailsScreen';
import { LiveExamScreen } from './components/screens/LiveExamScreen';
import { ExamReviewScreen } from './components/screens/ExamReviewScreen';
import { ResultsScreen } from './components/screens/ResultsScreen';
import { AnswersScreen } from './components/screens/AnswersScreen';
import { LeaderboardScreen } from './components/screens/LeaderboardScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { ActionLoadingSkeleton, LoadingSkeleton, type ActionLoadingKind } from './components/LoadingSkeleton';
import {
  webappApi,
  authApi,
  getToken,
  setToken,
  clearToken,
  getTelegramUser,
  waitForTelegramInitData,
  ApiExamSummary,
  ApiAttempt,
  ApiQuestion,
} from './api';
import { mergePendingAnswers, useAttemptSync } from './hooks/useAttemptSync';

const EMPTY_PROFILE: UserProfile = {
  name: '',
  studentId: '',
  classLevel: '',
  track: '',
  telegramAccount: '',
  avatarColor: '#2563eb',
  theme: 'light',
  soundEnabled: true,
  timerAlerts: true,
  fontSize: 'normal',
};

function mapExam(e: ApiExamSummary): Exam {
  return {
    id: e.id,
    title: (e.title && String(e.title).trim()) || 'Untitled exam',
    subject: e.subject || '',
    className: e.className || '',
    totalQuestions: e.totalQuestions || 0,
    durationMinutes: e.durationMinutes || 60,
    totalMarks: e.totalMarks || 0,
    startDate: e.startDate,
    status: e.status,
    resultVisibility: e.resultVisibility,
    leaderboardVisibility: e.leaderboardVisibility,
    negativeMarking: e.negativeMarking ?? 0,
    questions: [],
  };
}

function mapQuestions(qs: ApiQuestion[]): Question[] {
  return (qs || []).map((q) => ({
    id: q.id,
    question: q.question || '',
    options: Array.isArray(q.options) ? q.options : [],
    marks: q.marks ?? 1,
    negativeMarks: q.negativeMarks ?? 0,
    subject: q.subject,
    imageFileId: q.imageFileId,
    imageUrl: q.imageUrl,
    explanation: q.explanation,
    selectedIndex: q.selectedIndex,
    correctIndex: q.correctIndex,
    status: q.status,
  }));
}

function mapAttemptFromStart(
  attempt: ApiAttempt,
  exam: ApiExamSummary,
  questions: ApiQuestion[],
  secondsLeft: number
): ExamAttempt {
  const qs = mapQuestions(questions);
  const firstId = qs[0]?.id;
  const answers = mergePendingAnswers(attempt.id, { ...(attempt.answers || {}) });
  const visited: Record<string, boolean> = {};
  if (firstId) visited[firstId] = true;
  for (const id of Object.keys(answers)) visited[id] = true;
  return {
    id: attempt.id,
    examId: exam.id,
    examTitle: exam.title,
    className: exam.className,
    answers,
    marked: {},
    visited,
    secondsLeft: Math.max(0, secondsLeft),
    pausedAt: attempt.pausedAt || null,
    pausedSeconds: attempt.pausedSeconds || 0,
    totalDurationSeconds: Math.max(60, (exam.durationMinutes || 60) * 60),
    timeSpentSeconds: attempt.timeTakenSeconds || 0,
    startedAt: attempt.startedAt || new Date().toISOString(),
    isSubmitted: false,
    isOfficial: attempt.isOfficial,
    attemptNumber: attempt.attemptNumber,
    currentQuestionIndex: attempt.currentQuestionIndex || 0,
    questions: qs,
    status: attempt.status,
  };
}

function mapResult(
  r: ApiAttempt & { examTitle?: string; resultVisibility?: string }
): ExamAttempt {
  const correct = r.correctCount ?? 0;
  const wrong = r.wrongCount ?? 0;
  const attempted = correct + wrong;
  return {
    id: r.id,
    examId: r.examId,
    examTitle: r.examTitle && String(r.examTitle) !== String(r.examId) ? r.examTitle : 'Exam',
    answers: { ...(r.answers || {}) },
    marked: {},
    visited: {},
    secondsLeft: 0,
    totalDurationSeconds: r.timeTakenSeconds || 0,
    timeSpentSeconds: r.timeTakenSeconds || 0,
    startedAt: r.startedAt || '',
    submittedAt: r.submittedAt,
    completedAt: r.submittedAt || undefined,
    isSubmitted: true,
    isOfficial: r.isOfficial,
    attemptNumber: r.attemptNumber,
    score: r.score,
    maxScore: r.maxScore,
    percentage: r.percentage,
    correctCount: r.correctCount,
    wrongCount: r.wrongCount,
    skippedCount: r.skippedCount,
    accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
    rank: r.rank,
    status: r.status,
    resultVisibility: r.resultVisibility,
  };
}

const WEBAPP_CACHE_KEY = 'quizbot_webapp_cache_v1';

function readWebappCache(): {
  profile?: UserProfile;
  exams?: Exam[];
  results?: ExamAttempt[];
  ongoingSummary?: OngoingSummary | null;
} | null {
  try {
    const raw = localStorage.getItem(WEBAPP_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeWebappCache(data: {
  profile?: UserProfile;
  exams?: Exam[];
  results?: ExamAttempt[];
  ongoingSummary?: OngoingSummary | null;
}) {
  try {
    const prev = readWebappCache() || {};
    localStorage.setItem(WEBAPP_CACHE_KEY, JSON.stringify({ ...prev, ...data, updatedAt: Date.now() }));
  } catch {
    /* quota / private mode */
  }
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(() => {
    try { return Boolean(localStorage.getItem('ts_student_token') || sessionStorage.getItem('ts_student_token')); }
    catch { return false; }
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inTelegram, setInTelegram] = useState(() => {
    try { return Boolean(localStorage.getItem('ts_student_token') || sessionStorage.getItem('ts_student_token')); }
    catch { return false; }
  });
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [availableExams, setAvailableExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [ongoingAttempt, setOngoingAttempt] = useState<ExamAttempt | null>(null);
  const [ongoingSummary, setOngoingSummary] = useState<OngoingSummary | null>(null);
  const [pastResults, setPastResults] = useState<ExamAttempt[]>([]);
  const [selectedResultAttempt, setSelectedResultAttempt] = useState<ExamAttempt | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
  const [currentTab, setCurrentTab] = useState(() => tabFromPath(window.location.pathname).tab);

  const goTab = useCallback((tab: string, extra?: { examId?: string; attemptId?: string }) => {
    setCurrentTab(tab);
    const next = pathForTab(tab, extra);
    if (window.location.pathname !== next) {
      // Main tabs replace history so back isn't needed twice
      const replace = ['home', 'exams', 'results', 'leaderboard', 'profile'].includes(tab);
      navigate(next, { replace });
    }
  }, [navigate]);

  useEffect(() => {
    const parsed = tabFromPath(location.pathname);
    setCurrentTab((prev) => (prev === parsed.tab ? prev : parsed.tab));
    if (parsed.examId) {
      setSelectedExam((prev) => {
        if (prev?.id === parsed.examId) return prev;
        return availableExams.find((e) => e.id === parsed.examId) || prev;
      });
    }
  }, [location.pathname, availableExams]);

  // Teacher messages → in-app banner + browser notification
  useEffect(() => {
    if (!inTelegram) return;
    let cancelled = false;
    let known = new Set<string>();
    try {
      const raw = localStorage.getItem('ts_known_notifs');
      if (raw) known = new Set(JSON.parse(raw));
    } catch {}

    const requestPerm = async () => {
      try {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'default') {
            await Notification.requestPermission();
          }
        }
      } catch {
        /* ignored */
      }
    };

    const poll = async () => {
      try {
        const { notifications } = await webappApi.notifications();
        if (cancelled) return;
        const list = notifications || [];
        const unread = list.filter((n) => !known.has(n.id));
        if (!unread.length) return;
        for (const n of unread) {
          known.add(n.id);
          setTeacherMessage(n.message);
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              const note = new Notification('TestSpace', {
                body: n.message,
                icon: `${window.location.origin}/logo.svg`,
                tag: n.id,
              });
              note.onclick = () => {
                window.focus();
                note.close();
              };
            }
          } catch {
            /* browser blocked */
          }
        }
        try {
          localStorage.setItem('ts_known_notifs', JSON.stringify([...known].slice(-300)));
        } catch {}
        await webappApi.markNotificationsRead(unread.map((n) => n.id)).catch(() => {});
      } catch {
        /* offline / unauthorized */
      }
    };

    void requestPerm().then(poll);
    const timer = window.setInterval(poll, 12000);
    const onFocus = () => { void poll(); };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [inTelegram]);

  const [teacherMessage, setTeacherMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notStartedAt, setNotStartedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionLoadingKind | null>(null);
  const actionLockRef = useRef(false);

  const handleBackendFinalized = useCallback(
    (serverAttempt: ApiAttempt) => {
      const completed = mapResult({
        ...serverAttempt,
        examTitle: selectedExam?.title || 'Exam',
      });
      setPastResults((prev) => [completed, ...prev.filter((p) => p.id !== completed.id)]);
      setSelectedResultAttempt(completed);
      setOngoingAttempt(null);
      setOngoingSummary(null);
      setBusy(false);
      setActionLoading(null);
      goTab('results');
    },
    [selectedExam?.title]
  );

  const attemptSync = useAttemptSync({
    attempt: ongoingAttempt,
    onFinalized: handleBackendFinalized,
  });

  const refreshResults = useCallback(async () => {
    const { results } = await webappApi.results();
    const mapped = (results || []).map(mapResult);
    setPastResults(mapped);
    writeWebappCache({ results: mapped });
  }, []);

  const refreshExams = useCallback(async () => {
    const { exams } = await webappApi.exams();
    const mapped = (exams || []).map(mapExam);
    setAvailableExams(mapped);
    writeWebappCache({ exams: mapped });
    return mapped;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = readWebappCache();
    if (cached) {
      if (cached.profile) setProfile(cached.profile);
      if (cached.exams) setAvailableExams(cached.exams);
      if (cached.results) setPastResults(cached.results);
      if (cached.ongoingSummary !== undefined) setOngoingSummary(cached.ongoingSummary ?? null);
      setIsLoading(false);
    }
    (async () => {
      const hasToken = Boolean(getToken());
      setInTelegram(hasToken);
      if (!hasToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        let session;
        let sessionError: any;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            session = await webappApi.session();
            sessionError = null;
            break;
          } catch (err: any) {
            sessionError = err;
            const transient = /503|still starting|initializing|failed to fetch/i.test(String(err?.message || err));
            if (!transient || attempt === 2) break;
            await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
          }
        }
        if (sessionError || !session) throw sessionError || new Error('Failed to load session');
        if (cancelled) return;
        const displayName =
          session.student?.name ||
          [session.user?.firstName, session.user?.lastName].filter(Boolean).join(' ') ||
          'Student';
        const sid =
          session.student?.studentId ||
          session.student?.id ||
          (session.student as any)?.email ||
          'student';
        setProfile({
          name: displayName,
          studentId: sid,
          classLevel: session.student?.className || '',
          track: (session.student as any)?.email || session.user?.username || '',
          telegramAccount: (session.student as any)?.email || session.user?.username || '',
          telegramUserId: undefined,
          avatarColor: '#2563eb',
          theme: 'light',
          soundEnabled: true,
          timerAlerts: true,
          fontSize: 'normal',
          photoUrl: (session.user as any)?.photo_url || (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.photo_url) || null,
        });
        if (session.ongoing) setOngoingSummary(session.ongoing);
        writeWebappCache({
          profile: {
            name: displayName,
            studentId: sid,
            classLevel: session.student?.className || '',
            track: (session.student as any)?.email || session.user?.username || '',
            telegramAccount: (session.student as any)?.email || session.user?.username || '',
            telegramUserId: undefined,
            avatarColor: '#2563eb',
            theme: 'light',
            soundEnabled: true,
            timerAlerts: true,
            fontSize: 'normal',
            photoUrl: (session.user as any)?.photo_url || null,
          },
          ongoingSummary: session.ongoing || null,
        });
        const examList = await refreshExams();
        try {
          await refreshResults();
        } catch {
          /* none yet */
        }

        const hash = window.location.hash || '';
        const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
        const params = new URLSearchParams(window.location.search || hashQuery);
        const reviewAttemptId = params.get('a');
        const linkedExamId = params.get('exam');

        if (linkedExamId && !reviewAttemptId) {
          let linkedExam = examList.find((exam) => exam.id === linkedExamId) || null;
          if (!linkedExam) {
            try {
              const { exam } = await webappApi.examDetail(linkedExamId);
              linkedExam = mapExam(exam);
            } catch {
              linkedExam = null;
            }
          }
          if (linkedExam && !cancelled) {
            setAvailableExams((prev) =>
              prev.some((e) => e.id === linkedExam!.id) ? prev : [linkedExam!, ...prev]
            );
            setSelectedExam(linkedExam);
            goTab('details', { examId: linkedExam.id });
          }
        }
        if (reviewAttemptId) {
          try {
            const data = await webappApi.review(reviewAttemptId);
            if (!cancelled) {
              setReviewQuestions(mapQuestions(data.questions));
              setSelectedResultAttempt(
                mapResult({ ...data.attempt, examTitle: data.exam.title })
              );
              setSelectedExam({
                id: data.exam.id,
                title: data.exam.title,
                subject: data.exam.subject || '',
                className: '',
                totalQuestions: data.questions.length,
                durationMinutes: 0,
                totalMarks: data.attempt.maxScore || 0,
                status: 'RESULTS_PUBLISHED',
              });
              goTab('answers');
            }
          } catch {
            /* ignore deep link errors */
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          // Stale/invalid JWT often looks like a blank shell — force re-auth
          clearToken();
          setInTelegram(false);
          setLoadError(err?.message || 'Session expired. Please sign in again.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshExams, refreshResults]);

  const handleStartExam = async (
    exam: Exam,
    forceNew = false,
    resumeExisting = false
  ) => {
    if (busy || actionLockRef.current) return;
    actionLockRef.current = true;
    setActionError(null);
    setNotStartedAt(null);
    setBusy(true);
    setActionLoading('start');
    try {
      // The backend owns the scheduled-start check and returns the exact ISO
      // start time for a dedicated modal when the window is still closed.
      const data = await webappApi.startExam(exam.id, forceNew);
      if (data.attempt.status !== 'IN_PROGRESS') {
        const completed = mapResult({ ...data.attempt, examTitle: data.exam.title });
        setPastResults((prev) => [completed, ...prev.filter((p) => p.id !== completed.id)]);
        setSelectedResultAttempt(completed);
        setOngoingAttempt(null);
        setOngoingSummary(null);
        goTab('results');
        void refreshResults().catch(() => {});
        return;
      }
      if (!data.questions?.length) {
        throw new Error('This exam has no questions yet. Ask your teacher to publish questions.');
      }
      const mapped = mapAttemptFromStart(
        data.attempt,
        data.exam,
        data.questions,
        data.secondsLeft
      );
      setSelectedExam({
        ...mapExam(data.exam),
        questions: mapped.questions,
      });
      setOngoingAttempt(mapped);
      setOngoingSummary(null);
      goTab('live');
    } catch (err: any) {
      if (err?.code === 'EXAM_NOT_STARTED') {
        setNotStartedAt(err.startTime || exam.startDate || null);
        setActionError(null);
      } else {
        setActionError(err?.message || 'Failed to start exam');
      }
    } finally {
      setBusy(false);
      setActionLoading(null);
      actionLockRef.current = false;
    }
  };

  const handleResumeOngoing = async () => {
    const examId = ongoingAttempt?.examId || ongoingSummary?.examId;
    if (!examId) return;
    const exam =
      availableExams.find((e) => e.id === examId) ||
      ({
        id: examId,
        title: ongoingSummary?.examTitle || ongoingAttempt?.examTitle || 'Exam',
        subject: '',
        className: '',
        totalQuestions: ongoingSummary?.totalQuestions || 0,
        durationMinutes: 60,
        totalMarks: 0,
        status: 'LIVE',
      } as Exam);
    await handleStartExam(exam, false, true);
  };

  const handleFinalSubmit = async () => {
    if (!ongoingAttempt || actionLockRef.current) return;
    actionLockRef.current = true;
    const snapshot = ongoingAttempt;
    setActionError(null);
    setBusy(true);
    setActionLoading('submit');
    // Leave live UI immediately so the student sees one consistent skeleton.
    setOngoingSummary(null);
    try {
      // Flush only the queued deltas. If the backend expiry sweep has already
      // completed the attempt, reuse that response instead of submitting twice.
      const synced = await attemptSync.flush();
      const attempt = synced && synced.status !== 'IN_PROGRESS'
        ? synced
        : (await webappApi.submit(snapshot.id)).attempt;
      const completed = mapResult({
        ...attempt,
        examTitle: snapshot.examTitle,
      });
      setPastResults((prev) => [completed, ...prev.filter((p) => p.id !== completed.id)]);
      setSelectedResultAttempt(completed);
      setOngoingAttempt(null);
      goTab('results');
      // Refresh list in background — do not block result screen
      void refreshResults().catch(() => {});
    } catch (err: any) {
      // Restore attempt so student can retry submit
      setOngoingAttempt(snapshot);
      setActionError(err?.message || 'Failed to submit exam');
      goTab('review');
    } finally {
      setBusy(false);
      setActionLoading(null);
      actionLockRef.current = false;
    }
  };

  const handleReviewAnswers = async (attempt: ExamAttempt) => {
    setActionError(null);
    setBusy(true);
    setActionLoading('review');
    try {
      const data = await webappApi.review(attempt.id);
      setReviewQuestions(mapQuestions(data.questions));
      setSelectedResultAttempt(mapResult({ ...data.attempt, examTitle: data.exam.title }));
      setSelectedExam({
        id: data.exam.id,
        title: data.exam.title,
        subject: data.exam.subject || '',
        className: '',
        totalQuestions: data.questions.length,
        durationMinutes: 0,
        totalMarks: data.attempt.maxScore || 0,
        status: 'RESULTS_PUBLISHED',
        questions: mapQuestions(data.questions),
      });
      goTab('answers');
    } catch (err: any) {
      setActionError(err?.message || 'Could not load solutions (results may be unpublished)');
    } finally {
      setBusy(false);
      setActionLoading(null);
    }
  };

  const handleUpdateName = async (newName: string) => {
    setProfile((p) => ({ ...p, name: newName }));
    try {
      const { student } = await webappApi.updateProfile(newName);
      setProfile((p) => ({
        ...p,
        name: student.name || newName,
        studentId: student.studentId || p.studentId,
        classLevel: student.className || p.classLevel,
      }));
    } catch (err: any) {
      setActionError(err?.message || 'Could not save name');
    }
  };

  const isLiveExamDesk = currentTab === 'live';

  if (!inTelegram) {
    return (
      <StudentAuthGate
        onAuthed={() => {
          setInTelegram(true);
          window.location.reload();
        }}
      />
    );
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }


  return (
    <div className="app-shell compact-ui min-h-[100dvh] liquid-canvas-bg text-slate-900 flex flex-col relative overflow-x-clip">
      <div className="liquid-orb liquid-orb-1" />
      <div className="liquid-orb liquid-orb-2" />
      <div className="liquid-orb liquid-orb-3" />
      <div className="liquid-orb liquid-orb-4" />

      {!isLiveExamDesk && (
        <header className="sticky top-0 z-30 glass-header px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div
              onClick={() => goTab('home')}
              className="flex items-center gap-3 cursor-pointer select-none group"
            >
              <img
                src={`${import.meta.env.BASE_URL}logo.svg`}
                alt="TestSpace logo"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
                className="protected-logo w-16 h-16 md:w-20 md:h-20 rounded-2xl object-contain bg-white shadow-md shadow-blue-500/20"
                width="40"
                height="40"
                loading="eager"
                decoding="async"
              />
              <div>
                <h1 className="text-sm md:text-base font-bold text-slate-900 leading-tight">
                  TestSpace
                </h1>
              </div>
            </div>
            <DesktopNavigation
              currentTab={currentTab}
              onSelectTab={(tab) => {
                if (tab === 'results') setSelectedResultAttempt(null);
                goTab(tab);
              }}
              hasOngoing={
                !!(ongoingAttempt && !ongoingAttempt.isSubmitted) || !!ongoingSummary
              }
            />
          </div>
        </header>
      )}

      <main className="app-content flex-1 w-full max-w-4xl mx-auto p-3 md:p-5 pb-24 md:pb-8 relative z-10">
        {loadError && (
          <div className="mb-4 glass-card rounded-2xl p-4 border border-rose-200/60 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-slate-900">Could not load data</p>
              <p className="text-xs text-slate-600 mt-0.5">{loadError}</p>
            </div>
          </div>
        )}
        
        {teacherMessage && (
          <div className="mb-4 glass-card rounded-2xl p-3 border border-blue-200/70 flex gap-3 items-start">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Message from teacher</p>
              <p className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap">{teacherMessage}</p>
            </div>
            <button
              type="button"
              className="text-xs font-bold text-slate-500 shrink-0"
              onClick={() => setTeacherMessage(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {actionError && (
          <div className="mb-4 glass-card rounded-2xl p-3 border border-rose-200/60 text-xs text-rose-700 font-semibold">
            {actionError}
          </div>
        )}
        {currentTab === 'home' && (
          <HomeScreen
            profile={profile}
            ongoingAttempt={ongoingAttempt}
            ongoingSummary={ongoingSummary}
            availableExams={availableExams}
            onNavigate={goTab}
            onSelectExam={(exam) => {
              setSelectedExam(exam);
              goTab('details', { examId: exam.id });
            }}
                        onResumeOngoing={handleResumeOngoing}
            isBusy={busy}
          />
        )}
        {currentTab === 'exams' && (
          <ExamsScreen
            exams={availableExams}
            pastResults={pastResults}
            ongoingAttempt={ongoingAttempt}
            ongoingSummary={ongoingSummary}
            onSelectExam={(exam) => {
              setSelectedExam(exam);
              goTab('details', { examId: exam.id });
            }}
            onStartExamDirect={(exam) => handleStartExam(exam, true)}
            onResumeOngoing={handleResumeOngoing}
            isBusy={busy}
          />
        )}

        {currentTab === 'details' && selectedExam && (
          <ExamDetailsScreen
            exam={selectedExam}
            onBack={() => goTab('exams')}
            onConfirmStart={(exam) => handleStartExam(exam, false)}
          />
        )}

        {currentTab === 'live' && ongoingAttempt && (
          <LiveExamScreen
            exam={
              selectedExam ||
              ({
                id: ongoingAttempt.examId,
                title: ongoingAttempt.examTitle,
              } as Exam)
            }
            attempt={ongoingAttempt}
            soundEnabled={profile.soundEnabled}
            isPractice={ongoingAttempt.isOfficial === false}
            onUpdateAttempt={setOngoingAttempt}
            onOpenReview={() => goTab('review')}
            onLeaveExam={() => goTab('exams')}
            onTimeUp={() => void handleFinalSubmit()}
            onAnswerChange={attemptSync.recordAnswer}
            onIndexChange={attemptSync.recordIndex}
            syncState={attemptSync.state}
            pendingCount={attemptSync.pendingCount}
          />
        )}

        {currentTab === 'review' && ongoingAttempt && (
          <ExamReviewScreen
            exam={
              selectedExam ||
              ({
                id: ongoingAttempt.examId,
                title: ongoingAttempt.examTitle,
              } as Exam)
            }
            attempt={ongoingAttempt}
            onReturnToLive={() => goTab('live')}
            onJumpToQuestion={(idx) => {
              setOngoingAttempt((a) =>
                a ? { ...a, currentQuestionIndex: idx } : a
              );
              goTab('live');
            }}
            onFinalSubmit={handleFinalSubmit}
          />
        )}

        {currentTab === 'results' && (
          <ResultsScreen
            pastResults={pastResults}
            exams={availableExams}
            selectedAttempt={selectedResultAttempt}
            onSelectAttempt={setSelectedResultAttempt}
            onReviewAnswers={handleReviewAnswers}
            onReattempt={(exam) => handleStartExam(exam, true)}
            onGoExams={() => goTab('exams')}
          />
        )}

        {currentTab === 'answers' && (
          <AnswersScreen
            examTitle={selectedResultAttempt?.examTitle || selectedExam?.title || 'Exam'}
            questions={reviewQuestions}
            onBackToResults={() => goTab('results')}
          />
        )}

        {currentTab === 'leaderboard' && (
          <LeaderboardScreen
            pastResults={pastResults}
            exams={availableExams}
            currentUserName={profile.name || 'You'}
            onSelectExamResult={(attempt) => {
              setSelectedResultAttempt(attempt);
              goTab('results');
            }}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileScreen profile={profile} onUpdateName={handleUpdateName} />
        )}
      </main>

      {notStartedAt && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4" role="dialog" aria-modal="true" aria-labelledby="exam-not-started-title">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 id="exam-not-started-title" className="text-base font-extrabold text-slate-900">This exam hasn’t started</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">The server will allow the exam to begin at:</p>
              <p className="mt-2 rounded-2xl glass-pill px-3 py-2 text-sm font-bold text-slate-900">
                {new Date(notStartedAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNotStartedAt(null)}
              className="w-full rounded-2xl glass-btn-primary py-2.5 text-xs font-bold text-white"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {actionLoading && <ActionLoadingSkeleton kind={actionLoading} />}

      {!isLiveExamDesk && (
        <MobileNavigation
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab === 'results') setSelectedResultAttempt(null);
            goTab(tab);
          }}
          hasOngoing={
            !!(ongoingAttempt && !ongoingAttempt.isSubmitted) || !!ongoingSummary
          }
        />
      )}
    </div>
  );
}
