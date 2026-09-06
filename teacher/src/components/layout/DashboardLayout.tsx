import React, { useMemo, useRef, useState, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { clearToken } from '../../api';
import {
  IconHome, IconExam, IconResults, IconSettings, IconBell, IconLogout
} from '../../icons';
import { NotifPanel } from '../NotifPanel';
import { NotifyHost } from '../NotifyHost';
import { buildNotifications } from '../../lib/notifications';
import { dedupeStudents } from '../../lib/students';
import {
  useDashboardData,
  useInvalidateDashboard,
  dashboardKeys,
} from '../../hooks/useDashboardData';
import { HomeSkeleton, PageSkeleton } from '../ui/HomeSkeleton';

const nav = [
  { to: '/', label: 'Home', Icon: IconHome, end: true },
  { to: '/exams', label: 'Exams', Icon: IconExam, end: false },
  { to: '/results', label: 'Results', Icon: IconResults, end: true },
  { to: '/settings', label: 'Settings', Icon: IconSettings, end: true },
] as const;

function RouteFallback() {
  // Prefer homepage skeleton for initial load / route suspense
  return <HomeSkeleton />;
}

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { data, isLoading, isError, error, isFetching } = useDashboardData(true);
  const invalidate = useInvalidateDashboard();
  const [showNotif, setShowNotif] = useState(false);
  const [notifSeenAt, setNotifSeenAt] = useState(() => {
    try {
      return localStorage.getItem('quiz_notif_seen') || '';
    } catch {
      return '';
    }
  });
  const bellRef = useRef<HTMLButtonElement>(null);

  const exams = data?.exams || [];
  const students = data?.students || [];
  const attempts = data?.attempts || [];
  const settings = data?.settings || {
    telegramBotToken: '',
    webhookUrl: '',
    botUsername: '@testspace_bot',
    botActive: true,
    autoPublishResults: true,
    systemNotice: '',
  };
  const logs = data?.auditLogs || [];

  const notifications = useMemo(
    () => buildNotifications(dedupeStudents(students), attempts, exams),
    [students, attempts, exams]
  );
  const unread = notifications.filter((n) => !notifSeenAt || n.at > notifSeenAt).length;

  const openNotif = () => {
    setShowNotif((v) => !v);
    if (!showNotif) {
      const now = new Date().toISOString();
      setNotifSeenAt(now);
      try {
        localStorage.setItem('quiz_notif_seen', now);
      } catch {
        /* ignore */
      }
    }
  };

  const logout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'https://testspace-api.appwrite.network'}/api/auth/logout`, { method: 'POST', credentials: 'omit' });
    } catch {
      // Local cleanup still happens if the network is unavailable.
    }
    clearToken();
    qc.clear();
    navigate('/login', { replace: true });
  };

  const outletCtx = {
    exams,
    students,
    attempts,
    settings,
    logs,
    onRefresh: invalidate,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <NotifyHost />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/logo.svg"
              alt="TestSpace"
              className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="font-bold text-[13px] text-slate-900 leading-tight">
                TestSpace
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                ref={bellRef}
                type="button"
                onClick={openNotif}
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition ${
                  showNotif
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
                aria-label="Notifications"
              >
                <IconBell className="w-[18px] h-[18px]" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {showNotif && (
                <NotifPanel
                  notifications={notifications}
                  onClose={() => setShowNotif(false)}
                  anchorRef={bellRef}
                />
              )}
            </div>
            <button
              type="button"
              onClick={logout}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Logout"
            >
              <IconLogout className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-3 safe-pb">
        {isLoading && exams.length === 0 ? (
          location.pathname === '/' || location.pathname === '' ? (
            <HomeSkeleton />
          ) : (
            <PageSkeleton />
          )
        ) : isError && exams.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-600">
            <p className="mb-3">{(error as Error)?.message || 'Failed to load'}</p>
            <button
              type="button"
              className="text-blue-600 font-semibold"
              onClick={() => invalidate()}
            >
              Retry
            </button>
          </div>
        ) : (
          <Suspense fallback={<RouteFallback />}>
            <Outlet context={outletCtx} key={location.pathname} />
          </Suspense>
        )}
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'max(var(--safe-bottom), 6px)' }}
        aria-label="Main"
      >
        <div className="max-w-3xl mx-auto flex">
          {nav.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onMouseEnter={() => {
                // Warm query cache when user hovers a tab
                void qc.prefetchQuery({
                  queryKey: dashboardKeys.data,
                  staleTime: 30_000,
                });
              }}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition ${
                  isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export type DashboardOutletContext = {
  exams: import('../../types').Exam[];
  students: import('../../types').Student[];
  attempts: import('../../types').Attempt[];
  settings: import('../../types').SystemSettings;
  logs: import('../../types').AuditLog[];
  onRefresh: () => void;
};
