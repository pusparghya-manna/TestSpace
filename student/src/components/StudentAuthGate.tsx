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
          ? await authApi.login({ email: email.trim(), password })
          : await authApi.register({ email: email.trim(), password, name: name.trim() || undefined });
      setToken(out.token, true);
      onAuthed();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          'linear-gradient(135deg, #e0f2fe 0%, #f8fafc 40%, #f3e8ff 100%)',
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 space-y-4 text-center border border-slate-100"
      >
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt="TestSpace"
          className="w-16 h-16 rounded-2xl object-contain bg-white mx-auto"
          width={64}
          height={64}
        />
        <div>
          <h1 className="text-xl font-bold text-slate-900">TestSpace Student</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to take exams in your browser</p>
        </div>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1 text-sm">
          <button
            type="button"
            className={`rounded-lg py-2 ${mode === 'login' ? 'bg-white shadow font-semibold' : 'text-slate-600'}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`rounded-lg py-2 ${mode === 'register' ? 'bg-white shadow font-semibold' : 'text-slate-600'}`}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>
        {mode === 'register' && (
          <input
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-left text-sm"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        )}
        <input
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-left text-sm"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-left text-sm"
          type="password"
          placeholder="Password (min 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
        {error && (
          <p className="text-red-600 text-sm text-left bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 font-semibold disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
