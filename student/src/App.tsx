import React, { useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken } from './api';

export default function App() {
  const [screen, setScreen] = useState<'auth'|'home'|'exam'|'results'>(getToken() ? 'home' : 'auth');
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [student, setStudent] = useState<any>(null);
  const [exams, setExams] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (!getToken()) return;
    api.me().then((m: any) => { setStudent(m.student); setScreen('home'); return api.exams(); })
      .then((e: any) => setExams(e.exams || [])).catch(() => clearToken());
  }, []);

  const auth = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const out: any = mode === 'login' ? await api.login({ email, password }) : await api.register({ email, password, name });
      setToken(out.token); setStudent(out.student); setScreen('home');
      setExams(((await api.exams()) as any).exams || []);
    } catch (err: any) { setError(err.message); }
  };

  if (screen === 'auth') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
        <form onSubmit={auth} className="w-full max-w-sm bg-white p-6 rounded-2xl shadow space-y-3">
          <h1 className="text-xl font-bold text-center">TestSpace Student</h1>
          <div className="flex gap-4 text-sm justify-center">
            <button type="button" onClick={() => setMode('login')}>Login</button>
            <button type="button" onClick={() => setMode('register')}>Register</button>
          </div>
          {mode==='register' && <input className="w-full border rounded px-3 py-2" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />}
          <input className="w-full border rounded px-3 py-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input className="w-full border rounded px-3 py-2" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button className="w-full bg-blue-600 text-white rounded py-2">{mode==='login'?'Login':'Register'}</button>
        </form>
      </main>
    );
  }

  if (screen === 'exam' && session) {
    const q = session.questions?.[index];
    return (
      <main className="max-w-lg mx-auto p-4">
        <h2 className="font-bold mb-2">{session.exam?.title}</h2>
        <p className="mb-3">{q?.question}</p>
        {(q?.options||[]).map((o: string, i: number) => (
          <button key={i} type="button" className="block w-full border rounded p-2 mb-2 text-left"
            onClick={async () => {
              const answers = { ...(session.attempt.answers||{}), [q.id]: i };
              setSession({ ...session, attempt: { ...session.attempt, answers }});
              try { await api.sync({ attemptId: session.attempt.id, changes: [{ questionId: q.id, selectedIndex: i }] }); } catch {}
            }}>{o}</button>
        ))}
        <div className="flex gap-2 mt-4">
          <button type="button" disabled={index===0} onClick={()=>setIndex(index-1)} className="flex-1 border rounded py-2">Prev</button>
          {index < (session.questions?.length||1)-1
            ? <button type="button" onClick={()=>setIndex(index+1)} className="flex-1 bg-blue-600 text-white rounded py-2">Next</button>
            : <button type="button" className="flex-1 bg-green-600 text-white rounded py-2" onClick={async ()=>{
                await api.submit(session.attempt.id, session.attempt.answers);
                setResults(((await api.results()) as any).attempts||[]);
                setScreen('results');
              }}>Submit</button>}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <header className="flex justify-between mb-4">
        <div><h1 className="text-xl font-bold">TestSpace</h1><p className="text-sm text-slate-500">{student?.email}</p></div>
        <button type="button" onClick={()=>{clearToken(); setScreen('auth');}}>Logout</button>
      </header>
      <h2 className="font-semibold mb-2">Exams</h2>
      {exams.map((ex: any) => (
        <div key={ex.id} className="bg-white border rounded-xl p-3 mb-2 flex justify-between">
          <div><div className="font-medium">{ex.title}</div><div className="text-xs text-slate-500">{ex.subject}</div></div>
          <button type="button" className="bg-blue-600 text-white text-sm px-3 py-1 rounded" onClick={async ()=>{
            try {
              const out: any = await api.start(ex.id, { practice: true });
              // if backend doesn't have start yet, show error
              setSession(out); setIndex(0); setScreen('exam');
            } catch (e: any) { setError(e.message); }
          }}>Start</button>
        </div>
      ))}
      {screen==='results' && results.map((a: any)=>(
        <div key={a.id} className="border rounded p-2 mb-2">Score {a.score}/{a.maxScore}</div>
      ))}
    </main>
  );
}
