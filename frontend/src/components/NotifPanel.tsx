import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Notif } from '../lib/notifications';
import { relativeTime } from '../lib/time';
import {
  IconUser, IconCheck, IconRefresh, IconZap
} from '../icons';

export function NotifPanel({ notifications, onClose, anchorRef }: { notifications: Notif[]; onClose: () => void; anchorRef: React.RefObject<HTMLElement | null> }) {
  const kindStyle: Record<string, string> = {
    student: 'bg-blue-50 text-blue-600',
    practice: 'bg-violet-50 text-violet-600',
    progress: 'bg-amber-50 text-amber-600',
    official: 'bg-emerald-50 text-emerald-600',
  };
  const kindIcon = (k: Notif['kind']) => k === 'student' ? IconUser : k === 'practice' ? IconRefresh : k === 'progress' ? IconZap : IconCheck;
  const [pos, setPos] = useState<{ left: number; top: number; caretRight: number } | null>(null);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const panelW = Math.min(330, vw - 20);
    let left = r.right - panelW;
    left = Math.max(8, Math.min(left, vw - panelW - 8));
    const top = r.bottom + 8;
    const caretRight = Math.max(4, (left + panelW) - (r.right - 16));
    setPos({ left, top, caretRight });
  }, [anchorRef]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {pos && (
        <div className="fixed z-50 w-[min(330px,calc(100vw_-_20px))] origin-top-right animate-notif-in" style={{ left: pos.left, top: pos.top }}>
          <div className="absolute -top-1.5 w-3 h-3 rotate-45 bg-white border-l border-t border-slate-200 rounded-[2px]" style={{ right: pos.caretRight }} />
          <div className="relative bg-white rounded-xl border border-slate-200 shadow-2xl shadow-slate-900/10 overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700">Notifications</span>
              <span className="text-[10px] text-slate-400">{notifications.length} total</span>
            </div>
            <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-50">
              {notifications.length === 0 && (
                <div className="text-sm text-slate-500 text-center py-8">No activity yet</div>
              )}
              {notifications.map((n) => {
                const KindIcon = kindIcon(n.kind);
                return (
                  <div key={n.id} className="flex gap-2.5 px-3 py-2 hover:bg-slate-50/80">
                    <span className={`w-7 h-7 rounded-lg ${kindStyle[n.kind]} flex items-center justify-center shrink-0 mt-0.5`}>
                      <KindIcon className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-bold text-slate-500">{n.title}</div>
                        <div className="text-[10px] text-slate-400 shrink-0">{relativeTime(n.at)}</div>
                      </div>
                      <div className="text-xs font-medium text-slate-800 mt-0.5 leading-snug">{n.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
