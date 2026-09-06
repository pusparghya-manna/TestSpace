import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, clearToken, mediaUrl } from './api';
import { firebaseConfigured, googleLogin, idToken } from './firebase';

type Screen = 'auth' | 'home' | 'exam' | 'results' | 'review' | 'profile';

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(getToken() ? 'home' : 'auth');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [student, setStudent] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [review, setReview] = useState<any>(null);

  const loadHome = useCallback(async () => {
    const me = await api.me();
    setStudent(me.student);
    const list = await api.exams();
    setExams(list.exams || []);
    setScreen('home');
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    loadHome().catch(() => {
      clearToken();
      setScreen('auth');
    });
  }, [loadHome]);

  // Timer
  useEffect(() => {
    if (screen !== 'exam' || !session?.attempt) return;
    const end = new Date(session.attempt.expiresAt || session.attempt.endsAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000) - Number(session.attempt.pausedSeconds || 0));
      // If paused, freeze using server secondsLeft when available
      if (session.attempt.pausedAt) return;
      setSecondsLeft(left);
      if (left <= 0) {
        // auto-submit
        api.submit(session.attempt.id, session.attempt.answers || {}).then(async () => {
          const res = await api.results();
          setResults(res.attempts || []);
          setSession(null);
          setScreen('results');
        });
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [screen, session]);

  const doAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const out =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.register({ email, password, name });
      setToken(out.token);
      setStudent(out.student);
      await loadHome();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const doGoogle = async () => {
    setError('');
    if (!firebaseConfigured) {
      setError('Google sign-in is not configured. Set VITE_FIREBASE_* env vars.');
      return;
    }
    setBusy(true);
    try {
      const user = await googleLogin();
      const token = await idToken(user);
      const out = await api.google(token);
      setToken(out.token);
      setStudent(out.student);
      await loadHome();
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const startExam = async (examId: string, practice: boolean) => {
    setBusy(true);
    setError('');
    try {
      const out = await api.start(examId, { practice });
      setSession(out);
      setIndex(0);
      setSecondsLeft(out.secondsLeft ?? (out.exam?.durationMinutes || 60) * 60);
      setScreen('exam');
    } catch (err: any) {
      setError(err.message || 'Could not start exam');
    } finally {
      setBusy(false);
    }
  };

  const selectOption = async (opt: number) => {
    if (!session?.questions?.[index] || !session?.attempt) return;
    const q = session.questions[index];
    const answers = { ...(session.attempt.answers || {}), [q.id]: opt };
    setSession({ ...session, attempt: { ...session.attempt, answers } });
    try {
      await api.sync({
        attemptId: session.attempt.id,
        changes: [{ questionId: q.id, selectedIndex: opt }],
        currentQuestionIndex: index,
      });
    } catch {
      /* offline-tolerant local keep */
    }
  };

  const submit = async () => {
    if (!session?.attempt) return;
    setBusy(true);
    try {
      await api.submit(session.attempt.id, session.attempt.answers || {});
      const res = await api.results();
      setResults(res.attempts || []);
      setSession(null);
      setScreen('results');
    } catch (err: any) {
      setError(err.message || 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const openReview = async (attemptId: string) => {
    setBusy(true);
    try {
      const data = await api.review(attemptId);
      setReview(data);
      setScreen('review');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    clearToken();
    setStudent(null);
    setSession(null);
    setScreen('auth');
  };

  const answeredCount = useMemo(() => {
    if (!session?.attempt?.answers) return 0;
    return Object.keys(session.attempt.answers).length;
  }, [session]);

  if (screen === 'auth') {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <form onSubmit={doAuth} className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 space-y-3">
          <div className="text-center">
            <img src="/logo.png" alt="TestSpace" className="mx-auto h-16 w-16 rounded-full object-contain" />
            <h1 className="text-xl font-bold mt-2">TestSpace Student</h1>
            <p className="text-sm text-slate-500">Sign in to take exams</p>
          </div>
          <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-lg p-1 text-sm">
            <button type="button" className={`rounded-md py-1.5 ${mode === 'login' ? 'bg-white shadow font-semibold' : ''}`} onClick={() => setMode('login')}>
              Login
            </button>
            <button type="button" className={`rounded-md py-1.5 ${mode === 'register' ? 'bg-white shadow font-semibold' : ''}`} onClick={() => setMode('register')}>
              Register
            </button>
          </div>
          {mode === 'register' && (
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="w-full border rounded-lg px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="w-full border rounded-lg px-3 py-2" type="password" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button disabled={busy} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-60">
            {busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
          <div className="relative text-center text-xs text-slate-400">
            <span className="bg-white px-2 relative z-10">or</span>
            <div className="absolute inset-x-0 top-1/2 border-t" />
          </div>
          <button type="button" disabled={busy} onClick={doGoogle} className="w-full border rounded-lg py-2.5 font-medium hover:bg-slate-50">
            Continue with Google
          </button>
        </form>
      </main>
    );
  }

  if (screen === 'exam' && session) {
    const q = session.questions[index];
    const selected = session.attempt?.answers?.[q?.id];
    const img = mediaUrl(q?.imageFileId);
    return (
      <main className="min-h-screen bg-slate-50 max-w-lg mx-auto">
        <header className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
          <div className="min-w-0">
            <div className="font-semibold truncate">{session.exam?.title}</div>
            <div className="text-xs text-slate-500">
              Q {index + 1}/{session.questions.length} · Answered {answeredCount}
            </div>
          </div>
          <div className={`font-mono text-sm px-2 py-1 rounded ${secondsLeft < 60 ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>
            {formatTime(secondsLeft)}
          </div>
        </header>
        <div className="p-4 space-y-3">
          <p className="font-medium text-slate-900">{q?.question}</p>
          {img && <img src={img} alt="" className="max-h-48 rounded-lg border object-contain bg-white" />}
          <div className="space-y-2">
            {(q?.options || []).map((opt: string, i: number) => (
              <button
                key={i}
                type="button"
                onClick={() => selectOption(i)}
                className={`w-full text-left border rounded-xl px-3 py-3 ${selected === i ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'bg-white'}`}
              >
                <span className="text-xs text-slate-400 mr-2">{String.fromCharCode(65 + i)}.</span>
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="fixed bottom-0 inset-x-0 max-w-lg mx-auto bg-white border-t p-3 flex gap-2">
          <button type="button" disabled={index === 0} className="flex-1 border rounded-lg py-2 disabled:opacity-40" onClick={() => setIndex((i) => i - 1)}>
            Prev
          </button>
          {index < session.questions.length - 1 ? (
            <button type="button" className="flex-1 bg-blue-600 text-white rounded-lg py-2" onClick={() => setIndex((i) => i + 1)}>
              Next
            </button>
          ) : (
            <button type="button" disabled={busy} className="flex-1 bg-green-600 text-white rounded-lg py-2" onClick={submit}>
              Submit
            </button>
          )}
        </div>
        {error && <p className="text-red-600 text-sm p-4">{error}</p>}
      </main>
    );
  }

  if (screen === 'review' && review) {
    return (
      <main className="min-h-screen bg-slate-50 max-w-lg mx-auto p-4">
        <button type="button" className="text-sm text-blue-600 mb-3" onClick={() => setScreen('results')}>
          ← Back
        </button>
        <h1 className="text-xl font-bold mb-1">{review.exam?.title}</h1>
        <p className="text-sm text-slate-500 mb-4">
          Score {review.attempt?.score}/{review.attempt?.maxScore} ({review.attempt?.percentage}%)
        </p>
        <ul className="space-y-3">
          {(review.questions || []).map((q: any, i: number) => (
            <li key={q.id} className={`rounded-xl border p-3 bg-white ${q.status === 'correct' ? 'border-green-300' : q.status === 'wrong' ? 'border-red-300' : ''}`}>
              <div className="text-xs text-slate-400 mb-1">Q{i + 1} · {q.status}</div>
              <div className="font-medium">{q.question}</div>
              <div className="text-sm mt-1 text-slate-600">Your answer: {q.selectedIndex != null ? q.options?.[q.selectedIndex] : '—'}</div>
              <div className="text-sm text-green-700">Correct: {q.options?.[q.correctIndex]}</div>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  if (screen === 'results') {
    return (
      <main className="min-h-screen bg-slate-50 max-w-lg mx-auto p-4">
        <header className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Results</h1>
          <button type="button" className="text-sm text-blue-600" onClick={() => setScreen('home')}>
            Home
          </button>
        </header>
        <ul className="space-y-2">
          {results.map((a) => (
            <li key={a.id} className="bg-white rounded-xl border p-3 flex justify-between items-center">
              <div>
                <div className="font-medium text-sm">{a.examId}</div>
                <div className="text-slate-600 text-sm">
                  {a.score}/{a.maxScore} ({a.percentage}%) · {a.practice ? 'Practice' : 'Official'}
                </div>
              </div>
              <button type="button" className="text-xs border rounded-lg px-2 py-1" onClick={() => openReview(a.id)}>
                Review
              </button>
            </li>
          ))}
          {!results.length && <p className="text-slate-500 text-sm">No results yet.</p>}
        </ul>
      </main>
    );
  }

  if (screen === 'profile') {
    return (
      <main className="min-h-screen bg-slate-50 max-w-lg mx-auto p-4">
        <button type="button" className="text-sm text-blue-600 mb-3" onClick={() => setScreen('home')}>
          ← Home
        </button>
        <div className="bg-white rounded-2xl border p-4 space-y-2">
          <h1 className="text-xl font-bold">Profile</h1>
          <p className="text-sm"><span className="text-slate-500">Name:</span> {student?.name}</p>
          <p className="text-sm"><span className="text-slate-500">Email:</span> {student?.email}</p>
          <button type="button" className="w-full mt-4 border border-red-300 text-red-600 rounded-lg py-2" onClick={logout}>
            Logout
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 max-w-lg mx-auto p-4 pb-20">
      <header className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-xl font-bold">TestSpace</h1>
          <p className="text-sm text-slate-500">{student?.name || student?.email}</p>
        </div>
        <button type="button" className="text-sm text-blue-600" onClick={() => setScreen('profile')}>
          Profile
        </button>
      </header>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <h2 className="font-semibold mb-2">Available exams</h2>
      <ul className="space-y-2">
        {exams.map((ex) => (
          <li key={ex.id} className="bg-white rounded-xl border p-3">
            <div className="font-medium">{ex.title}</div>
            <div className="text-xs text-slate-500 mb-2">
              {ex.subject || 'General'} · {ex.durationMinutes} min · {ex.status}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy} className="flex-1 bg-blue-600 text-white text-sm rounded-lg py-1.5" onClick={() => startExam(ex.id, false)}>
                Start official
              </button>
              <button type="button" disabled={busy} className="flex-1 border text-sm rounded-lg py-1.5" onClick={() => startExam(ex.id, true)}>
                Practice
              </button>
            </div>
          </li>
        ))}
        {!exams.length && <p className="text-slate-500 text-sm">No published exams yet.</p>}
      </ul>
      <button
        type="button"
        className="fixed bottom-4 inset-x-4 max-w-lg mx-auto border bg-white rounded-xl py-2 shadow"
        onClick={async () => {
          const res = await api.results();
          setResults(res.attempts || []);
          setScreen('results');
        }}
      >
        My results
      </button>
    </main>
  );
}
