import React, { useState } from 'react';
import { authApi, setToken } from '../api';

export function StudentAuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const out =
        mode === 'login'
          ? await authApi.login({ email, password })
          : await authApi.register({ email, password, name });
      setToken(out.token);
      onAuthed();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen liquid-canvas-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="liquid-orb liquid-orb-1" />
      <div className="liquid-orb liquid-orb-2" />
      <form
        onSubmit={submit}
        className="text-center space-y-4 relative z-10 glass-card p-8 rounded-3xl max-w-sm w-full"
      >
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="TestSpace"
          className="protected-logo w-16 h-16 rounded-2xl object-cover bg-white mx-auto shadow-lg shadow-blue-500/15"
          width="64"
          height="64"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `${import.meta.env.BASE_URL}exam-bot-logo.png`;
          }}
        />
        <h1 className="text-lg font-bold text-slate-900">TestSpace Student</h1>
        <p className="text-sm text-slate-500">Sign in to take exams in your browser</p>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1 text-sm">
          <button
            type="button"
            className={`rounded-lg py-1.5 ${mode === 'login' ? 'bg-white shadow font-semibold' : ''}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`rounded-lg py-1.5 ${mode === 'register' ? 'bg-white shadow font-semibold' : ''}`}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>
        {mode === 'register' && (
          <input
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-left text-sm"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-left text-sm"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-left text-sm"
          type="password"
          placeholder="Password (min 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 text-white rounded-xl py-2.5 font-semibold disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
