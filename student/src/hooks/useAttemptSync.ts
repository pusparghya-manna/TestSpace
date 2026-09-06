import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiAttempt, webappApi } from '../api';
import { ExamAttempt } from '../types';

const STORAGE_KEY = 'quizbot_attempt_sync_queue_v1';
const SYNC_INTERVAL_MS = 5000;

type PendingEntry = {
  value: number | null;
  revision: number;
};

type PendingAttempt = {
  answers: Record<string, PendingEntry>;
  currentQuestionIndex?: { value: number; revision: number };
};

type PendingStore = Record<string, PendingAttempt>;

export type AttemptSyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

function readStore(): PendingStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: PendingStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Private browsing or quota exhaustion must not interrupt the exam.
  }
}

function nextRevision(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function ensureAttempt(store: PendingStore, attemptId: string): PendingAttempt {
  if (!store[attemptId]) store[attemptId] = { answers: {} };
  if (!store[attemptId].answers) store[attemptId].answers = {};
  return store[attemptId];
}

export function queueAnswerChange(attemptId: string, questionId: string, value: number | null) {
  if (!attemptId || !questionId) return;
  const store = readStore();
  const attempt = ensureAttempt(store, attemptId);
  attempt.answers[questionId] = { value, revision: nextRevision() };
  writeStore(store);
}

export function queueIndexChange(attemptId: string, index: number) {
  if (!attemptId) return;
  const store = readStore();
  const attempt = ensureAttempt(store, attemptId);
  attempt.currentQuestionIndex = { value: Math.max(0, index), revision: nextRevision() };
  writeStore(store);
}

export function getPendingAnswerChanges(attemptId: string): Record<string, number | null> {
  const pending = readStore()[attemptId]?.answers || {};
  return Object.fromEntries(Object.entries(pending).map(([qid, item]) => [qid, item.value]));
}

export function mergePendingAnswers(attemptId: string, serverAnswers: Record<string, number> = {}) {
  const merged = { ...serverAnswers };
  for (const [questionId, value] of Object.entries(getPendingAnswerChanges(attemptId))) {
    if (value === null) delete merged[questionId];
    else merged[questionId] = value;
  }
  return merged;
}

function pendingFor(attemptId: string) {
  const store = readStore();
  const attempt = store[attemptId];
  if (!attempt) return null;
  const answers: Record<string, number | null> = {};
  const answerRevisions: Record<string, number> = {};
  for (const [questionId, item] of Object.entries(attempt.answers || {})) {
    answers[questionId] = item.value;
    answerRevisions[questionId] = item.revision;
  }
  return {
    answers,
    answerRevisions,
    currentQuestionIndex: attempt.currentQuestionIndex?.value,
    indexRevision: attempt.currentQuestionIndex?.revision,
  };
}

function removeSynced(attemptId: string, snapshot: NonNullable<ReturnType<typeof pendingFor>>) {
  const store = readStore();
  const attempt = store[attemptId];
  if (!attempt) return;
  for (const [questionId, revision] of Object.entries(snapshot.answerRevisions)) {
    if (attempt.answers?.[questionId]?.revision === revision) delete attempt.answers[questionId];
  }
  if (
    snapshot.indexRevision !== undefined &&
    attempt.currentQuestionIndex?.revision === snapshot.indexRevision
  ) {
    delete attempt.currentQuestionIndex;
  }
  if (!Object.keys(attempt.answers || {}).length && !attempt.currentQuestionIndex) delete store[attemptId];
  writeStore(store);
}

interface UseAttemptSyncOptions {
  attempt: ExamAttempt | null;
  onFinalized?: (attempt: ApiAttempt) => void;
}

export function useAttemptSync({ attempt, onFinalized }: UseAttemptSyncOptions) {
  const [state, setState] = useState<AttemptSyncState>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const attemptRef = useRef(attempt);
  const inFlightRef = useRef<Promise<ApiAttempt | null> | null>(null);
  const finalizedAttemptRef = useRef<string | null>(null);
  const onFinalizedRef = useRef(onFinalized);

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

  useEffect(() => {
    onFinalizedRef.current = onFinalized;
  }, [onFinalized]);

  const updatePendingCount = useCallback((attemptId: string) => {
    const pending = pendingFor(attemptId);
    setPendingCount(
      pending ? Object.keys(pending.answers).length + (pending.currentQuestionIndex === undefined ? 0 : 1) : 0
    );
  }, []);

  const flush = useCallback(async (): Promise<ApiAttempt | null> => {
    const current = attemptRef.current;
    if (!current || current.isSubmitted) return null;
    if (inFlightRef.current) return inFlightRef.current;

    const snapshot = pendingFor(current.id);
    const online = typeof navigator === 'undefined' || navigator.onLine;
    if (!online) {
      setState('offline');
      updatePendingCount(current.id);
      throw new Error('You are offline. Your answers are stored on this device and will sync automatically.');
    }

    const request = (async () => {
      setState('syncing');
      try {
        // Empty syncs are intentional heartbeats: they let the backend tell the
        // client when a server-side expiry finalizer has completed the attempt.
        const response = await webappApi.syncAttempt(
          current.id,
          snapshot?.answers || {},
          snapshot?.currentQuestionIndex
        );
        if (snapshot) removeSynced(current.id, snapshot);
        updatePendingCount(current.id);
        setState('synced');
        if (
          response.attempt &&
          response.attempt.status !== 'IN_PROGRESS' &&
          finalizedAttemptRef.current !== response.attempt.id
        ) {
          finalizedAttemptRef.current = response.attempt.id;
          onFinalizedRef.current?.(response.attempt);
        }
        return response.attempt || null;
      } catch (error) {
        const message = String((error as any)?.message || error);
        setState(/offline|network|fetch|load failed|timeout/i.test(message) ? 'offline' : 'error');
        updatePendingCount(current.id);
        throw error;
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = request;
    return request;
  }, [updatePendingCount]);

  const recordAnswer = useCallback(
    (questionId: string, value: number | null) => {
      const current = attemptRef.current;
      if (!current) return;
      queueAnswerChange(current.id, questionId, value);
      updatePendingCount(current.id);
    },
    [updatePendingCount]
  );

  const recordIndex = useCallback(
    (index: number) => {
      const current = attemptRef.current;
      if (!current) return;
      queueIndexChange(current.id, index);
      updatePendingCount(current.id);
    },
    [updatePendingCount]
  );

  useEffect(() => {
    const current = attempt;
    if (!current) {
      setState('idle');
      setPendingCount(0);
      return;
    }
    finalizedAttemptRef.current = current.isSubmitted ? current.id : null;
    updatePendingCount(current.id);
    const timer = window.setInterval(() => {
      void flush().catch(() => {});
    }, SYNC_INTERVAL_MS);
    const onOnline = () => void flush().catch(() => {});
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void flush().catch(() => {});
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);
    void flush().catch(() => {});
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [attempt?.id, attempt?.isSubmitted, flush, updatePendingCount]);

  return { state, pendingCount, recordAnswer, recordIndex, flush };
}
