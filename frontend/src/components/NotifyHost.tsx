import React, { useEffect, useState } from 'react';
import { getToasts, getConfirm, subscribeNotify, resolveConfirm, dismissToast } from '../lib/notify';
import { btnP, btnS } from '../styles/ui';
import { IconCheck, IconAlert, IconInfo, IconClose } from '../icons';

export function NotifyHost() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = subscribeNotify(() => setTick((n) => n + 1));
    return () => { unsub?.(); };
  }, []);

  const toasts = getToasts();
  const confirm = getConfirm();

  return (
    <>
      <div className="fixed top-3 inset-x-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-3">
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? IconCheck : t.kind === 'error' ? IconAlert : IconInfo;
          const colors =
            t.kind === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : t.kind === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-slate-900 text-white border-slate-700';
          return (
            <div
              key={t.id}
              className={`pointer-events-auto max-w-sm w-full rounded-xl border shadow-lg px-3 py-2.5 text-sm font-medium flex items-start gap-2 ${colors}`}
            >
              <Icon className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 leading-snug whitespace-pre-wrap">{t.message}</span>
              <button
                type="button"
                className="opacity-60 hover:opacity-100 shrink-0"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss"
              >
                <IconClose className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => resolveConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-4 space-y-3 border border-slate-200">
            <div className="text-sm font-semibold text-slate-900 leading-snug whitespace-pre-wrap">{confirm.message}</div>
            <div className="flex gap-2 justify-end">
              <button type="button" className={btnS + ' !py-2 text-xs'} onClick={() => resolveConfirm(false)}>
                Cancel
              </button>
              <button type="button" className={btnP + ' !py-2 text-xs'} onClick={() => resolveConfirm(true)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
