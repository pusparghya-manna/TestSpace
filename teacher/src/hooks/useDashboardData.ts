import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getToken, clearToken } from '../api';
import type { Exam, Attempt, SystemSettings, AuditLog, Student } from '../types';

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      res.headers.get('content-type')?.includes('text/html')
        ? 'API returned HTML instead of JSON. Check VITE_API_URL points to the Appwrite Function.'
        : 'Invalid JSON from server'
    );
  }
}

export type DashboardData = {
  exams: Exam[];
  students: Student[];
  attempts: Attempt[];
  settings: SystemSettings;
  auditLogs: AuditLog[];
};

const defaultSettings: SystemSettings = {
  telegramBotToken: '',
  webhookUrl: '',
  botUsername: '@testspace_bot',
  botActive: true,
  autoPublishResults: true,
  systemNotice: '',
};

export const dashboardKeys = {
  all: ['dashboard'] as const,
  data: ['dashboard', 'data'] as const,
  summary: ['dashboard', 'summary'] as const,
  exams: ['exams'] as const,
  students: ['students'] as const,
  results: ['results'] as const,
  settings: ['settings'] as const,
};

/** @deprecated use dashboardKeys.data */
export const dashboardQueryKey = dashboardKeys.data;

async function parseJson(res: Response) {
  return safeJson(res);
}

async function fetchDashboard(): Promise<DashboardData> {
  if (!getToken()) throw new Error('UNAUTHORIZED');
  const res = await api('/api/data');
  if (res.status === 401) {
    clearToken();
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) {
    const d = await parseJson(res);
    throw new Error((d as any).error || `Failed to load (${res.status})`);
  }
  const d = await safeJson(res);
  return {
    exams: d.exams || [],
    students: d.students || [],
    attempts: d.attempts || [],
    settings: d.settings || defaultSettings,
    auditLogs: d.auditLogs || [],
  };
}

export function useDashboardData(enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.data,
    queryFn: fetchDashboard,
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: (n, err) => {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') return false;
      return n < 2;
    },
  });
}

export function useInvalidateDashboard() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: dashboardKeys.all });
    void qc.invalidateQueries({ queryKey: dashboardKeys.exams });
    void qc.invalidateQueries({ queryKey: dashboardKeys.students });
    void qc.invalidateQueries({ queryKey: dashboardKeys.results });
    void qc.invalidateQueries({ queryKey: dashboardKeys.settings });
  };
}

/** Page-focused: exams list (falls back to dashboard cache slice). */
export function useExamsQuery(enabled: boolean) {
  const dash = useDashboardData(enabled);
  return useQuery({
    queryKey: dashboardKeys.exams,
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      if (!getToken()) throw new Error('UNAUTHORIZED');
      const res = await api('/api/exams');
      if (res.status === 401) {
        clearToken();
        throw new Error('UNAUTHORIZED');
      }
      if (res.ok) {
        const d = await safeJson(res);
        return (d.exams || d) as Exam[];
      }
      // Fallback: dashboard bundle
      const full = await fetchDashboard();
      return full.exams;
    },
    initialData: dash.data?.exams,
    initialDataUpdatedAt: dash.dataUpdatedAt,
  });
}

export function useStudentsQuery(enabled: boolean) {
  const dash = useDashboardData(enabled);
  return useQuery({
    queryKey: dashboardKeys.students,
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      if (!getToken()) throw new Error('UNAUTHORIZED');
      const res = await api('/api/students');
      if (res.status === 401) {
        clearToken();
        throw new Error('UNAUTHORIZED');
      }
      if (res.ok) {
        const d = await safeJson(res);
        return (d.students || d) as Student[];
      }
      const full = await fetchDashboard();
      return full.students;
    },
    initialData: dash.data?.students,
    initialDataUpdatedAt: dash.dataUpdatedAt,
  });
}

export function useResultsQuery(enabled: boolean) {
  const dash = useDashboardData(enabled);
  return useQuery({
    queryKey: dashboardKeys.results,
    enabled,
    staleTime: 20_000,
    queryFn: async () => {
      if (!getToken()) throw new Error('UNAUTHORIZED');
      const res = await api('/api/results');
      if (res.status === 401) {
        clearToken();
        throw new Error('UNAUTHORIZED');
      }
      if (res.ok) {
        const d = await safeJson(res);
        return {
          attempts: (d.attempts || []) as Attempt[],
          exams: (d.exams || []) as Exam[],
        };
      }
      const full = await fetchDashboard();
      return { attempts: full.attempts, exams: full.exams };
    },
    initialData: dash.data
      ? { attempts: dash.data.attempts, exams: dash.data.exams }
      : undefined,
    initialDataUpdatedAt: dash.dataUpdatedAt,
  });
}
