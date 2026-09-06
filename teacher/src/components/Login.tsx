import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';
import { inp } from '../styles/ui';
import { Field } from './ui/Field';
import { firebaseConfigured, firebaseGoogleLogin, firebaseIdToken } from '../firebase';
import {
  IconEye,
  IconEyeOff,
  IconUser,
  IconAlert,
  IconLock,
  IconLogIn,
  IconUserPlus,
  IconArrowRight,
  IconGoogle,
} from '../icons';

export function Login({ onOk }: { onOk: () => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const go = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { username: u.trim(), password: p }
        : { username: u.trim(), password: p, name: name.trim() || u.trim(), email: email.trim() };
      const res = await api(path, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (mode === 'login' ? 'Invalid credentials' : 'Registration failed'));
      setToken(data.token, remember);
      onOk();
    } catch (e: any) {
      setErr(e.message || 'Unable to continue');
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setErr('');
    if (!firebaseConfigured) {
      setErr('Google sign-in is not configured yet. Use username and password instead.');
      return;
    }
    setGoogleBusy(true);
    try {
      const user = await firebaseGoogleLogin();
      const idToken = await firebaseIdToken(user);
      const res = await api('/api/auth/firebase/exchange', {
        method: 'POST',
        body: JSON.stringify({ idToken, name: user.displayName || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
      setToken(data.token, remember);
      onOk();
    } catch (e: any) {
      setErr(e.message || 'Google sign-in failed');
    } finally {
      setGoogleBusy(false);
    }
  };

  const isLogin = mode === 'login';
  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setErr('');
  };

  return (
    <main className="min-h-[100dvh] overflow-y-auto overscroll-contain bg-[#f5f7fc] px-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[400px] flex-col items-center sm:max-w-[520px]">
        <header className="w-full text-center">
          <img
            src="/logo.svg"
            alt="TestSpace"
            className="mx-auto h-28 w-28 rounded-full object-contain drop-shadow-[0_8px_18px_rgba(37,99,235,0.18)] sm:h-36 sm:w-36"
          />
        </header>

        <section className="mt-4 w-full rounded-xl border border-white bg-white px-3.5 py-3 shadow-[0_10px_32px_rgba(51,65,85,0.1)] sm:mt-6 sm:rounded-2xl sm:px-7 sm:py-6 sm:shadow-[0_16px_44px_rgba(51,65,85,0.12)]">
          <div className="grid grid-cols-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`relative flex items-center justify-center gap-1 py-2 text-[13px] font-extrabold transition sm:gap-2 sm:py-3.5 sm:text-base ${isLogin ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <IconLogIn className="h-3.5 w-3.5 sm:h-5 sm:w-5" /> Sign in
              {isLogin && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-600 sm:h-1" />}
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`relative flex items-center justify-center gap-1 py-2 text-[13px] font-extrabold transition sm:gap-2 sm:py-3.5 sm:text-base ${!isLogin ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <IconUserPlus className="h-3.5 w-3.5 sm:h-5 sm:w-5" /> Register
              {!isLogin && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-600 sm:h-1" />}
            </button>
          </div>

          <form onSubmit={go} className="space-y-2.5 pt-3 sm:space-y-4 sm:pt-5">
            {mode === 'register' && (
              <>
                <Field label="Full name">
                  <div className="relative">
                    <IconUser className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 sm:left-3.5 sm:h-4.5 sm:w-4.5" />
                    <input
                      className={inp + ' rounded-lg border-2 py-2 pl-8 text-[13px] sm:rounded-xl sm:py-3 sm:pl-11 sm:text-[15px]'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      placeholder="Enter your name"
                    />
                  </div>
                </Field>
                <Field label="Email">
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 sm:left-3.5 sm:h-4.5 sm:w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    <input
                      className={inp + ' rounded-lg border-2 py-2 pl-8 text-[13px] sm:rounded-xl sm:py-3 sm:pl-11 sm:text-[15px]'}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                    />
                  </div>
                </Field>
              </>
            )}
            <Field label="Username">
              <div className="relative">
                <IconUser className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 sm:left-3.5 sm:h-4.5 sm:w-4.5" />
                <input
                  className={inp + ' rounded-lg border-2 py-2 pl-8 text-[13px] sm:rounded-xl sm:py-3 sm:pl-11 sm:text-[15px]'}
                  value={u}
                  onChange={(e) => setU(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="off"
                  required
                  placeholder="Enter your username"
                />
              </div>
            </Field>
            <Field label="Password">
              <div className="relative">
                <IconLock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 sm:left-3.5 sm:h-4.5 sm:w-4.5" />
                <input
                  className={inp + ' rounded-lg border-2 py-2 pl-8 pr-9 text-[13px] sm:rounded-xl sm:py-3 sm:pl-11 sm:pr-11 sm:text-[15px]'}
                  type={show ? 'text' : 'password'}
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  placeholder={isLogin ? 'Enter your password' : 'At least 8 characters'}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 sm:right-1.5 sm:h-9 sm:w-9"
                >
                  {show ? <IconEyeOff className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" /> : <IconEye className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />}
                </button>
              </div>
            </Field>

            {isLogin && (
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold sm:text-[13px]">
                <label className="flex cursor-pointer items-center gap-1.5 text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 accent-blue-600 sm:h-4 sm:w-4"
                  />
                  Remember me
                </label>
                <button type="button" onClick={() => navigate('/forgot-password')} className="font-bold text-blue-600 hover:text-blue-800">
                  Forgot password?
                </button>
              </div>
            )}

            {err && (
              <div role="alert" className="flex items-start gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] leading-4 text-red-700 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-[13px]">
                <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" /> <span>{err}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || googleBusy}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-[13px] font-extrabold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 sm:gap-2 sm:rounded-xl sm:py-3 sm:text-[15px]"
            >
              {busy ? (isLogin ? 'Signing in…' : 'Creating account…') : (isLogin ? 'Sign in' : 'Create account')}
              {!busy && <IconArrowRight className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />}
            </button>
          </form>

          {isLogin && (
            <>
              <div className="my-3 flex items-center gap-2 text-[10px] font-bold text-slate-500 sm:my-4 sm:text-[11px]">
                <span className="h-px flex-1 bg-slate-200" /> OR <span className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                type="button"
                disabled={busy || googleBusy}
                onClick={continueWithGoogle}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-[13px] font-bold text-indigo-950 transition hover:border-blue-200 hover:bg-blue-50/40 disabled:pointer-events-none disabled:opacity-60 sm:gap-2.5 sm:rounded-xl sm:py-2.5 sm:text-[15px]"
              >
                <IconGoogle className="h-4 w-4 sm:h-5 sm:w-5" />
                {googleBusy ? 'Connecting to Google…' : 'Continue with Google'}
              </button>
              <p className="mt-3 text-center text-[11px] text-slate-500 sm:mt-4 sm:text-[13px]">
                Don&apos;t have an account?{' '}
                <button type="button" onClick={() => switchMode('register')} className="font-extrabold text-blue-600 hover:text-blue-800">
                  Register
                </button>
              </p>
            </>
          )}
        </section>

        <footer className="w-full shrink-0 pb-2 pt-3 text-center text-[10px] text-slate-500 sm:pb-1 sm:pt-6 sm:text-[13px]">
          <p>© {new Date().getFullYear()} TestSpace</p>
          <nav className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 sm:mt-2 sm:gap-x-3.5">
            <button type="button" onClick={() => navigate('/privacy')} className="hover:text-blue-600">
              Privacy Policy
            </button>
            <span className="text-slate-300">•</span>
            <button type="button" onClick={() => navigate('/terms')} className="hover:text-blue-600">
              Terms of Service
            </button>
            <span className="text-slate-300">•</span>
            <button type="button" onClick={() => navigate('/contact')} className="hover:text-blue-600">
              Contact
            </button>
          </nav>
        </footer>
      </div>
    </main>
  );
}
