import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { firebaseConfigured, firebaseResetPassword, firebaseResetRequest, firebaseVerifyResetCode } from '../firebase';
import { inp, btnP, card } from '../styles/ui';

function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-full flex items-center justify-center bg-slate-50 px-5 py-10"><div className="w-full max-w-md"><div className="text-center mb-6"><img src="/logo.png" alt="TestSpace logo" className="mx-auto w-20 h-20 rounded-2xl object-contain mb-3" /><h1 className="text-2xl font-extrabold text-slate-900">TestSpace</h1></div>{children}<p className="text-center text-xs text-slate-400 mt-5"><Link to="/login" className="font-bold text-blue-600 hover:text-blue-800">Back to sign in</Link></p></div></div>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setDone(false);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!firebaseConfigured) return setError('Password recovery is not configured yet. Please contact support.');
    setBusy(true);
    try { await firebaseResetRequest(email); setDone(true); } catch { setDone(true); } finally { setBusy(false); }
  };
  return <Shell><div className={card + ' p-6 shadow-xl shadow-slate-200/60'}><h2 className="text-xl font-extrabold text-slate-900">Reset your password</h2><p className="text-sm text-slate-600 mt-2 mb-5">Enter the email connected to your account. If it exists, we’ll send a secure reset link.</p>{done ? <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">Check your inbox for the password reset link. If you do not see it, check your spam folder.</div> : <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-bold text-slate-800">Email address<input className={inp + ' mt-2'} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" /></label>{error && <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700" role="alert">{error}</p>}<button className={btnP + ' w-full disabled:opacity-60'} disabled={busy}>{busy ? 'Sending secure link…' : 'Send reset link'}</button></form>}</div></Shell>;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get('oobCode') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!firebaseConfigured || !code) { setError('This reset link is invalid or has expired.'); setBusy(false); return; } firebaseVerifyResetCode(code).then(setEmail).catch(() => setError('This reset link is invalid or has expired.')).finally(() => setBusy(false)); }, [code]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try { await firebaseResetPassword(code, password); setDone(true); setTimeout(() => navigate('/login'), 1600); } catch { setError('This reset link is invalid or has expired. Request a new link and try again.'); } finally { setBusy(false); }
  };
  return <Shell><div className={card + ' p-6 shadow-xl shadow-slate-200/60'}><h2 className="text-xl font-extrabold text-slate-900">Choose a new password</h2>{email && <p className="text-sm text-slate-600 mt-2">Updating the password for <strong>{email}</strong>.</p>}{busy && !error ? <p className="mt-5 text-sm text-slate-500" role="status">Checking reset link…</p> : done ? <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">Password updated. Returning you to sign in…</div> : <form onSubmit={submit} className="space-y-4 mt-5"><label className="block text-sm font-bold text-slate-800">New password<input className={inp + ' mt-2'} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required placeholder="At least 8 characters" /></label><label className="block text-sm font-bold text-slate-800">Confirm password<input className={inp + ' mt-2'} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required placeholder="Repeat your password" /></label>{error && <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700" role="alert">{error}</p>}<button className={btnP + ' w-full disabled:opacity-60'} disabled={busy}>{busy ? 'Updating password…' : 'Update password'}</button></form>}</div></Shell>;
}
