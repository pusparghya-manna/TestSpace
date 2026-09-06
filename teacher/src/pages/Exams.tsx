import React, { useState } from 'react';
import type { Exam, Question, ExamStatus } from '../types';
import { api, getToken } from '../api';
import { inp, btn, btnP, btnS, btnD, card, inpIconWrap, inpBare, labelReq } from '../styles/ui';
import { Field } from '../components/ui/Field';
import { Sheet } from '../components/ui/Sheet';
import { ActionOverlay } from '../components/ui/ActionOverlay';
import { Badge } from '../components/ui/Badge';
import { toDatetimeLocalIST, fromDatetimeLocalIST, formatIST } from '../lib/time';
import { effectiveExamStatus } from '../lib/examStatus';
import { emptyQuestion, normalizeAnswer } from '../lib/exam';
import { prepareImageForOcr } from '../lib/image';
import { cropBBoxFromDataUrl, expandBBoxNorm1000, type BBox } from '../lib/bboxCrop';
import { DiagramCropEditor } from '../components/DiagramCropEditor';
import { toast, toastSuccess, toastError, confirmAsync } from '../lib/notify';
import {
  IconPlus, IconTrash, IconEdit, IconCheck, IconUpload, IconShare, IconInfo,
  IconCalendar, IconCopy, IconFileText, IconSparkles, IconClose, IconSearch,
  IconChevronDown, IconClock, IconExam, IconUsers, IconBook, IconHash,
  IconShuffle, IconMinus, IconBookmark, IconUser, IconEye
} from '../icons';

export function Exams({ exams, botUsername, onRefresh, defaultOpenNew = false }: { exams: Exam[]; botUsername: string; onRefresh: () => void; defaultOpenNew?: boolean }) {
  const [shareLink, setShareLink] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(!!defaultOpenNew);
  const [editId, setEditId] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'questions' | 'review'>('info');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionLabel, setActionLabel] = useState('Loading…');
  const [form, setForm] = useState({
    title: '', subject: '', className: '', testNumber: '', startDate: '',
    durationMinutes: 60, negativeMarking: 0, status: 'DRAFT' as ExamStatus,
    randomizeQuestions: false, randomizeOptions: false,
  });
  const [qs, setQs] = useState<Question[]>([]);
  const [qMode, setQMode] = useState<'list' | 'manual' | 'json' | 'ocr'>('list');
  const [editQ, setEditQ] = useState<Question | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrQueue, setOcrQueue] = useState<{ id: string; name: string; status: 'pending' | 'running' | 'done' | 'error'; error?: string; file?: File }[]>([]);
  const [ocrProgress, setOcrProgress] = useState({ done: 0, total: 0 });
  const [draftBanner, setDraftBanner] = useState<string | null>(null);
  // Key off editId (not form.id — form has no id field)
  const draftKey = editId ? `exam_draft_${editId}` : 'exam_draft_new';
  const skipDraftSave = React.useRef(false);

  const readDraft = React.useCallback(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return null;
      return d as { form?: typeof form; qs?: Question[]; step?: typeof step; savedAt?: number };
    } catch {
      return null;
    }
  }, [draftKey]);

  const writeDraft = React.useCallback(
    (payload: { form: typeof form; qs: Question[]; step: typeof step }) => {
      try {
        // Never clobber a non-empty draft with an empty shell
        const existing = readDraft();
        const hasContent =
          (payload.qs && payload.qs.length > 0) ||
          !!(payload.form?.title && String(payload.form.title).trim());
        if (!hasContent && existing && ((existing.qs && existing.qs.length > 0) || existing.form?.title)) {
          return;
        }
        localStorage.setItem(
          draftKey,
          JSON.stringify({ ...payload, savedAt: Date.now() })
        );
      } catch { /* quota */ }
    },
    [draftKey, readDraft]
  );

  const clearDraft = React.useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch { /* */ }
  }, [draftKey]);

  // Persist while sheet is open
  React.useEffect(() => {
    if (!open || skipDraftSave.current) return;
    writeDraft({ form, qs, step });
  }, [form, qs, step, open, writeDraft]);

  const [ocrPhase, setOcrPhase] = useState<'idle' | 'extract' | 'diagrams' | 'done'>('idle');
  const [ocrPageDataUrl, setOcrPageDataUrl] = useState<string | null>(null);
  const [ocrPageMime, setOcrPageMime] = useState('image/jpeg');
  const [imgBusy, setImgBusy] = useState(false);
  const [cropEditorOpen, setCropEditorOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const examLink = (id: string) => {
    return `https://testspace-student.appwrite.network/?exam=${encodeURIComponent(id)}`;
  };

  const formatShareDateParts = (iso: string | undefined) => {
    if (!iso) return { date: '—', time: '—' };
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { date: '—', time: '—' };
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const dayPeriod = (get('dayPeriod') || '').toUpperCase();
    return {
      date: `${get('day')} ${get('month')} ${get('year')}`.trim(),
      time: `${get('hour')}:${get('minute')} ${dayPeriod}`.trim(),
    };
  };

  const buildExamShareMessage = (exam: Exam, link: string) => {
    const { date, time } = formatShareDateParts(exam.startDate);
    const duration = `${exam.durationMinutes || 0} min`;
    const marks = exam.totalMarks ?? 0;
    const subject = (exam.subject || 'General').trim() || 'General';
    const title = (exam.title || 'Exam').trim() || 'Exam';
    return (
      `📝 ${title}\n` +
      `📚 ${subject} • 🎯 ${marks} Marks\n` +
      `⏱️ ${duration} • 📅 ${date} • 🕐 ${time}\n\n` +
      `🔗 Join: ${link}`
    );
  };

  const copyLink = async (id: string) => {
    const link = examLink(id);
    const exam = exams.find((e) => e.id === id);
    const message = exam ? buildExamShareMessage(exam, link) : `🔗 Join: ${link}`;
    setShareLink(link);
    setShareMessage(message);
    // System share sheet (WhatsApp, Telegram, etc.) when the browser supports it
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: exam?.title ? `${exam.title} — TestSpace` : 'Exam — TestSpace',
          text: message,
        });
      }
    } catch {
      /* user cancelled system share — panel still available */
    }
    try {
      await navigator.clipboard.writeText(message);
      toastSuccess('Share message ready below (also copied)');
    } catch {
      toastSuccess('Share message ready below — use Copy or Share');
    }
  };

  const systemShare = async (message: string) => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Exam — TestSpace',
          text: message,
        });
        return;
      }
      toastSuccess('System share not supported on this device — use Copy');
    } catch {
      /* cancelled */
    }
  };


  const filtered = exams.filter((e) => {
    const s = search.toLowerCase();
    return !s || e.title.toLowerCase().includes(s) || e.subject?.toLowerCase().includes(s);
  });

  const emptyForm = () => ({
    title: '', subject: '', className: '', testNumber: '',
    startDate: toDatetimeLocalIST(new Date().toISOString()),
    durationMinutes: 60, negativeMarking: 0, status: 'DRAFT' as ExamStatus,
    randomizeQuestions: false, randomizeOptions: false,
  });

  const reset = () => {
    skipDraftSave.current = true;
    setForm(emptyForm());
    setQs([]);
    setStep('info');
    setQMode('list');
    setEditId(null);
    setEditQ(null);
    setDraftBanner(null);
    setOcrQueue([]);
    setOcrProgress({ done: 0, total: 0 });
    setTimeout(() => { skipDraftSave.current = false; }, 0);
  };

  const applyDraft = (d: { form?: typeof form; qs?: Question[]; step?: typeof step }) => {
    if (d.form) setForm((prev) => ({ ...prev, ...d.form }));
    if (Array.isArray(d.qs) && d.qs.length) setQs(d.qs);
    if (d.step === 'info' || d.step === 'questions' || d.step === 'review') setStep(d.step);
    const n = Array.isArray(d.qs) ? d.qs.length : 0;
    if (n > 0) setDraftBanner(`Draft restored — ${n} question${n === 1 ? '' : 's'} kept`);
  };

  const startCreate = () => {
    skipDraftSave.current = true;
    setEditId(null);
    setEditQ(null);
    setQMode('list');
    setOcrQueue([]);
    setOcrProgress({ done: 0, total: 0 });
    // Always try restore new-exam draft
    let restored = false;
    try {
      const raw = localStorage.getItem('exam_draft_new');
      if (raw) {
        const d = JSON.parse(raw);
        const hasQs = Array.isArray(d?.qs) && d.qs.length > 0;
        const hasTitle = !!(d?.form?.title && String(d.form.title).trim());
        if (hasQs || hasTitle) {
          setForm({ ...emptyForm(), ...(d.form || {}) });
          setQs(hasQs ? d.qs : []);
          setStep(d.step === 'questions' || d.step === 'review' || d.step === 'info' ? d.step : hasQs ? 'questions' : 'info');
          setDraftBanner(hasQs ? `Draft restored — ${d.qs.length} question${d.qs.length === 1 ? '' : 's'}` : 'Draft form restored');
          restored = true;
        }
      }
    } catch { /* */ }
    if (!restored) {
      setForm(emptyForm());
      setQs([]);
      setStep('info');
      setDraftBanner(null);
    }
    setOpen(true);
    setTimeout(() => { skipDraftSave.current = false; }, 0);
  };

  const startEdit = (exam: Exam) => {
    skipDraftSave.current = true;
    setEditId(exam.id);
    const serverQs = (exam.questions || []).map((q) => {
      const opts = [...(q.options || ['', '', '', ''])].slice(0, 4);
      return {
        ...q,
        options: opts,
        imagePreview: q.imagePreview || null,
      };
    });
    const serverForm = {
      title: exam.title, subject: exam.subject || '', className: exam.className || '',
      testNumber: exam.testNumber || '', startDate: toDatetimeLocalIST(exam.startDate) || '',
      durationMinutes: exam.durationMinutes || 60, negativeMarking: exam.negativeMarking || 0,
      status: exam.status, randomizeQuestions: !!exam.randomizeQuestions, randomizeOptions: !!exam.randomizeOptions,
    };
    // Prefer local draft for this exam if it has more/newer questions
    let usedDraft = false;
    try {
      const raw = localStorage.getItem(`exam_draft_${exam.id}`);
      if (raw) {
        const d = JSON.parse(raw);
        const draftQs: Question[] = Array.isArray(d?.qs) ? d.qs : [];
        if (draftQs.length > serverQs.length) {
          setForm({ ...serverForm, ...(d.form || {}) });
          setQs(draftQs);
          setStep(d.step === 'questions' || d.step === 'review' || d.step === 'info' ? d.step : 'questions');
          setDraftBanner(`Unsaved draft restored — ${draftQs.length} questions`);
          usedDraft = true;
        }
      }
    } catch { /* */ }
    if (!usedDraft) {
      setForm(serverForm);
      setQs(serverQs);
      setStep('info');
      setDraftBanner(null);
    }
    setOcrPageDataUrl(null);
    setQMode('list');
    setOpen(true);
    setTimeout(() => { skipDraftSave.current = false; }, 0);
  };

  const saveExam = async () => {
    if (!form.title.trim()) return toastError('Title required');
    if (qs.length === 0) return toastError('Add at least one question');
    setActionLabel(editId ? 'Saving exam…' : 'Creating exam…');
    setSaving(true);
    try {
      const questionsReady = await commitPendingCrops(qs);
      setQs(questionsReady);
      // Do not send local previews / draft bboxes to API
      const questionsForApi = questionsReady.map(({ imagePreview, image_bbox, ...rest }) => rest);
      const body = {
        title: form.title.trim(),
        subject: form.subject,
        className: form.className,
        testNumber: form.testNumber,
        startDate: form.startDate ? fromDatetimeLocalIST(form.startDate) : new Date().toISOString(),
        durationMinutes: Number(form.durationMinutes),
        negativeMarking: Number(form.negativeMarking),
        randomizeQuestions: form.randomizeQuestions,
        randomizeOptions: form.randomizeOptions,
        resultVisibility: 'PUBLISHED',
        leaderboardVisibility: 'PUBLISHED',
        questions: questionsForApi,
        totalQuestions: questionsForApi.length,
        totalMarks: questionsForApi.reduce((s, q) => s + (Number(q.marks) || 1), 0),
      };
      const res = editId
        ? await api(`/api/exams/${editId}`, { method: 'PUT', body: JSON.stringify(body), timeoutMs: 120_000 })
        : await api('/api/exams', { method: 'POST', body: JSON.stringify(body), timeoutMs: 120_000 });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Save failed');
      }
      const saved = await res.json().catch(() => ({}));
      const newId = saved.id || editId;
      try {
        localStorage.removeItem(editId ? `exam_draft_${editId}` : 'exam_draft_new');
        if (newId && newId !== editId) localStorage.removeItem(`exam_draft_${newId}`);
      } catch { /* */ }
      setDraftBanner(null);
      setOpen(false);
      onRefresh();
      if (newId) {
        setTimeout(() => copyLink(String(newId)), 300);
      }
    } catch (e: any) {
      toastError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const delExam = async (id: string) => {
    const exam = exams.find((e) => e.id === id);
    const label = exam?.title ? `"${exam.title}"` : 'this exam';
    if (!(await confirmAsync(`Delete ${label}? This cannot be undone. Tap Delete only if you are sure.`))) return;
    setActionLabel('Deleting exam…');
    setDeleting(true);
    try {
      const res = await api(`/api/exams/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Delete failed');
      }
      toastSuccess('Exam deleted');
      onRefresh();
    } catch (e: any) {
      toastError(e?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };


  const exportQuestionsTxt = (list: Question[] = qs) => {
    const lines: string[] = [];
    list.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.question || ''}`);
      (q.options || []).slice(0, 4).forEach((opt, oi) => {
        lines.push(`${String.fromCharCode(65 + oi)}. ${opt || ''}`);
      });
      const ans = q.answer == null ? '' : String.fromCharCode(65 + q.answer);
      lines.push(`Answer Option ${ans}`);
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(form.title || 'questions').replace(/[^\w\-]+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addManual = () => {
    const q = emptyQuestion();
    setEditQ(q);
    setQMode('manual');
  };

  const saveManualQ = () => {
    if (!editQ || !editQ.question.trim()) return toastError('Question text required');
    setQs((prev) => {
      const i = prev.findIndex((x) => x.id === editQ.id);
      if (i >= 0) { const n = [...prev]; n[i] = editQ; return n; }
      return [...prev, editQ];
    });
    setEditQ(null);
    setQMode('list');
  };

  const importJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const list: any[] = Array.isArray(parsed) ? parsed : parsed.questions || [];
      const mapped: Question[] = list.map((item, i) => ({
        id: item.id || `Q_${Date.now()}_${i}`,
        question: item.question || item.text || '',
        options: (item.options || ['', '', '', '']).slice(0, 4),
        answer: normalizeAnswer(item.answer, 4),
        marks: item.marks ?? 1,
        negativeMarks: item.negativeMarks ?? 0,
        subject: item.subject || form.subject,
        explanation: item.explanation || '',
      }));
      setQs((prev) => [...prev, ...mapped.filter((q) => q.question)]);
      setJsonText('');
      setQMode('list');
      setToastMsg(`Added ${mapped.length} questions`);
      setTimeout(() => setToastMsg(''), 2000);
    } catch {
      toastError('Invalid JSON');
    }
  };

  const onOcr = async (file: File) => {
    setOcrBusy(true);
    setOcrPhase('extract');
    setToastMsg('');
    try {
      const prepared = await prepareImageForOcr(file);
      const pageDataUrl = `data:${prepared.mimeType};base64,${prepared.base64}`;
      setOcrPageDataUrl(pageDataUrl);
      setOcrPageMime(prepared.mimeType);
      setOcrPhase('diagrams');
      const res = await api('/api/ocr/parse', {
        method: 'POST',
        body: JSON.stringify({ fileBase64: prepared.base64, mimeType: prepared.mimeType }),
        timeoutMs: 180_000,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OCR failed');
      const list: any[] = Array.isArray(data) ? data : data.questions || data.parsed || [];
      const mapped: Question[] = [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const bbox =
          item.image_bbox && item.has_image !== false ? (item.image_bbox as BBox) : null;
        let preview: string | null = null;
        if (bbox) {
          try {
            preview = await cropBBoxFromDataUrl(pageDataUrl, bbox);
          } catch {
            preview = null;
          }
        }
        mapped.push({
          id: `Q_OCR_${Date.now()}_${i}`,
          question: item.question || item.text || '',
          options: (item.options || ['', '', '', '']).slice(0, 4),
          answer: normalizeAnswer(
            item.answer ?? item.correctAnswer ?? item.correct_option ?? item.correctOption,
            4
          ),
          marks: item.marks ?? 1,
          negativeMarks: item.negativeMarks ?? 0,
          subject: item.subject || form.subject,
          explanation: item.explanation || '',
          image_bbox: bbox,
          imagePreview: preview,
          image: undefined,
        });
      }
      const validQuestions = mapped.filter((q) => q.question.trim());
      setQs((prev) => [...prev, ...validQuestions]);
      setQMode('list');
      setToastMsg(`OCR added ${validQuestions.length} questions — review diagrams, then save exam`);
      setTimeout(() => setToastMsg(''), 4000);
    } catch (e: any) {
      toastError(e.message || 'OCR failed');
      throw e;
    } finally {
      setOcrBusy(false);
      setOcrPhase('idle');
    }
  };

  const processOneOcrFile = async (file: File, subjectHint: string): Promise<{ count: number; pageDataUrl: string; mime: string }> => {
    const prepared = await prepareImageForOcr(file);
    const pageDataUrl = `data:${prepared.mimeType};base64,${prepared.base64}`;
    // Fire OCR network call immediately (parallel-safe; no shared mutable state during request)
    const res = await api('/api/ocr/parse', {
      method: 'POST',
      body: JSON.stringify({ fileBase64: prepared.base64, mimeType: prepared.mimeType }),
      timeoutMs: 180_000,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'OCR failed');
    const list: any[] = Array.isArray(data) ? data : data.questions || data.parsed || [];
    const mapped: Question[] = [];
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const bbox =
        item.image_bbox && item.has_image !== false ? (item.image_bbox as BBox) : null;
      let preview: string | null = null;
      if (bbox) {
        try {
          preview = await cropBBoxFromDataUrl(pageDataUrl, bbox);
        } catch {
          preview = null;
        }
      }
      mapped.push({
        id: `Q_OCR_${stamp}_${i}`,
        question: item.question || item.text || '',
        options: (item.options || ['', '', '', '']).slice(0, 4),
        answer: normalizeAnswer(
          item.answer ?? item.correctAnswer ?? item.correct_option ?? item.correctOption,
          4
        ),
        marks: item.marks ?? 1,
        negativeMarks: item.negativeMarks ?? 0,
        subject: item.subject || subjectHint,
        explanation: item.explanation || '',
        image_bbox: bbox,
        imagePreview: preview,
        image: undefined,
      });
    }
    const validQuestions = mapped.filter((q) => q.question.trim());
    if (validQuestions.length) {
      setQs((prev) => [...prev, ...validQuestions]);
    }
    return { count: validQuestions.length, pageDataUrl, mime: prepared.mimeType };
  };

  // Shared running set so adding more images mid-flight stays parallel (up to CONCURRENCY)
  const ocrRunningRef = React.useRef(0);
  const ocrPendingRef = React.useRef<{ id: string; name: string; file: File }[]>([]);
  const OCR_CONCURRENCY = 3;

  const pumpOcrQueue = async () => {
    const subjectHint = form.subject;
    while (ocrPendingRef.current.length > 0 && ocrRunningRef.current < OCR_CONCURRENCY) {
      const item = ocrPendingRef.current.shift()!;
      ocrRunningRef.current += 1;
      setOcrBusy(true);
      setOcrPhase('extract');
      setOcrQueue((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'running' } : x)));
      // Do NOT await here — launch job and continue pumping
      (async () => {
        try {
          const { count, pageDataUrl, mime } = await processOneOcrFile(item.file, subjectHint);
          // Keep last page for expand/crop tools
          setOcrPageDataUrl(pageDataUrl);
          setOcrPageMime(mime);
          setOcrQueue((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'done' } : x)));
          if (count > 0) {
            setToastMsg((m) => {
              /* progressive feedback handled below */
              return m;
            });
          }
        } catch (e: any) {
          setOcrQueue((prev) =>
            prev.map((x) =>
              x.id === item.id ? { ...x, status: 'error', error: e?.message || 'OCR failed' } : x
            )
          );
        } finally {
          ocrRunningRef.current -= 1;
          setOcrProgress((p) => ({ ...p, done: p.done + 1 }));
          // Pump more from pending
          void pumpOcrQueue();
          if (ocrRunningRef.current === 0 && ocrPendingRef.current.length === 0) {
            setOcrBusy(false);
            setOcrPhase('done');
            setQMode('list');
            setOcrQueue((prev) => {
              const doneCount = prev.filter((x) => x.status === 'done').length;
              if (doneCount > 0) {
                setToastMsg(`OCR finished ${doneCount} image(s) — review questions, then save exam`);
                setTimeout(() => setToastMsg(''), 5000);
              }
              return prev;
            });
          }
        }
      })();
    }
  };

  const onOcrFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) return;
    const items = arr.map((f, i) => ({
      id: `ocr_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      name: f.name || `Image ${i + 1}`,
      status: 'pending' as const,
      file: f,
    }));
    setOcrQueue((prev) => [...prev, ...items]);
    setOcrProgress((p) => ({
      done: p.done,
      total: p.total + items.length,
    }));
    // If starting fresh batch, reset counters when previous fully idle
    if (ocrRunningRef.current === 0 && ocrPendingRef.current.length === 0) {
      setOcrProgress({ done: 0, total: items.length });
    }
    for (const it of items) {
      ocrPendingRef.current.push({ id: it.id, name: it.name, file: it.file! });
    }
    setOcrBusy(true);
    setOcrPhase('extract');
    // Launch up to OCR_CONCURRENCY jobs in parallel immediately
    void pumpOcrQueue();
  };

  const retryOcrItem = async (id: string) => {
    const item = ocrQueue.find((x) => x.id === id);
    if (!item?.file) return;
    setOcrQueue((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'pending', error: undefined } : x)));
    ocrPendingRef.current.push({ id: item.id, name: item.name, file: item.file });
    setOcrProgress((p) => ({ done: p.done, total: Math.max(p.total, p.done + 1) }));
    setOcrBusy(true);
    void pumpOcrQueue();
  };

  const applyCropFromEditor = async (bbox: BBox) => {
    if (!editQ || !ocrPageDataUrl) return;
    setImgBusy(true);
    try {
      const preview = await cropBBoxFromDataUrl(ocrPageDataUrl, bbox);
      setEditQ({ ...editQ, image_bbox: bbox, imagePreview: preview, image: undefined });
      setCropEditorOpen(false);
    } catch (e: any) {
      toastError(e.message || 'Could not apply crop');
    } finally {
      setImgBusy(false);
    }
  };

  const expandDiagram = async (factor: number) => {
    if (!editQ?.image_bbox || !ocrPageDataUrl) {
      return toastError(
        'Expand/Shrink only works right after Photo OCR (original page needed). Use Replace to change the diagram.'
      );
    }
    setImgBusy(true);
    try {
      const next = expandBBoxNorm1000(editQ.image_bbox, factor);
      const preview = await cropBBoxFromDataUrl(ocrPageDataUrl, next);
      setEditQ({
        ...editQ,
        image_bbox: next,
        imagePreview: preview,
        image: undefined,
      });
    } catch (e: any) {
      toastError(e.message || 'Could not expand diagram');
    } finally {
      setImgBusy(false);
    }
  };

  const replaceQuestionPhoto = async (file: File) => {
    if (!editQ) return;
    setImgBusy(true);
    try {
      const b64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await api('/api/ocr/upload-image', {
        method: 'POST',
        body: JSON.stringify({ fileBase64: b64, mimeType: file.type || 'image/jpeg' }),
        timeoutMs: 60_000,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const localPreview = `data:${file.type || 'image/jpeg'};base64,${b64}`;
      setEditQ({
        ...editQ,
        image: data.image,
        imagePreview: localPreview,
        image_bbox: null,
      });
      toastSuccess('New photo uploaded');
    } catch (e: any) {
      toastError(e.message || 'Photo upload failed');
    } finally {
      setImgBusy(false);
    }
  };

  const telegramMediaUrl = (fileId: string) => {
    const t = getToken();
    return `/api/media/telegram/${encodeURIComponent(fileId)}${t ? `?token=${encodeURIComponent(t)}` : ''}`;
  };

  const loadTelegramPreview = async (fileId: string): Promise<string | null> => {
    try {
      const res = await api(`/api/media/telegram/${encodeURIComponent(fileId)}`);
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  };

  const openEditQuestion = (q: Question) => {
    const fileId = q.image?.fileId;
    const preview =
      q.imagePreview ||
      (fileId ? telegramMediaUrl(fileId) : null);
    setEditQ({
      ...q,
      options: [...(q.options || [])],
      imagePreview: preview,
    });
    setQMode('manual');
  };

  const commitPendingCrops = async (list: Question[]): Promise<Question[]> => {
    if (!ocrPageDataUrl) return list;
    const need = list.filter((q) => q.image_bbox && !q.image?.fileId);
    if (need.length === 0) return list;
    const base64 = ocrPageDataUrl.split(',')[1] || '';
    const res = await api('/api/ocr/commit-crops', {
      method: 'POST',
      body: JSON.stringify({
        fileBase64: base64,
        mimeType: ocrPageMime,
        items: need.map((q) => ({
          tempId: q.id,
          has_image: true,
          image_bbox: q.image_bbox,
        })),
      }),
      timeoutMs: 120_000,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save diagrams');
    const byId = new Map<string, any>();
    for (const it of data.items || []) byId.set(String(it.tempId), it);
    return list.map((q) => {
      const it = byId.get(q.id);
      if (!it?.image?.fileId) return q;
      return {
        ...q,
        image: {
          fileId: String(it.image.fileId),
          mimeType: it.image.mimeType,
          width: it.image.width,
          height: it.image.height,
        },
      };
    });
  };

  return (
    <>
    <ActionOverlay show={saving || deleting} label={actionLabel} />
    {cropEditorOpen && editQ?.image_bbox && ocrPageDataUrl ? (
      <DiagramCropEditor
        pageDataUrl={ocrPageDataUrl}
        initialBBox={editQ.image_bbox}
        onApply={(b) => void applyCropFromEditor(b)}
        onClose={() => setCropEditorOpen(false)}
      />
    ) : null}
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">Exams</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{exams.length} total</p>
        </div>
        <button type="button" className={btnP + ' !py-1.5 !px-2.5 text-[11px]'} onClick={startCreate}>
          <IconPlus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconSearch className="w-3.5 h-3.5" /></span>
        <input className={inp + ' pl-9'} placeholder="Search exams…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100" aria-label="Clear search">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {shareLink && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-blue-800">
              <IconShare className="w-3.5 h-3.5" /> Share with students
            </div>
            <button type="button" className="text-[10px] font-bold text-slate-500 px-2 py-1 rounded-md hover:bg-white/80" onClick={() => { setShareLink(''); setShareMessage(''); }}>Close</button>
          </div>
          <div className="bg-white rounded-lg border border-blue-100 px-2.5 py-2 whitespace-pre-wrap text-slate-800 font-medium select-all leading-relaxed">{shareMessage || shareLink}</div>
          <div className="flex gap-2">
            <button
              type="button"
              className={btnP + ' flex-1 !py-1.5 text-[11px]'}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareMessage || shareLink);
                  toastSuccess('Copied to clipboard');
                } catch {
                  toastError('Could not copy — select the message and copy manually');
                }
              }}
            >
              <IconCopy className="w-3.5 h-3.5" /> Copy message
            </button>
            <button
              type="button"
              className={btnS + ' flex-1 !py-1.5 text-[11px]'}
              onClick={() => systemShare(shareMessage || shareLink)}
            >
              <IconShare className="w-3.5 h-3.5" /> Share via apps
            </button>
          </div>
          <p className="text-[10px] text-blue-700/80 flex items-center gap-1"><IconInfo className="w-3 h-3 shrink-0" />Share this message with students. Only the join link starts the exam.</p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className={card + ' p-6 text-center text-sm text-slate-500'}>
            <div className="mx-auto w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-1.5"><IconExam className="w-5 h-5" /></div>
            No exams {search ? 'match your search' : 'yet'}. Tap <strong>New</strong> to create one.
          </div>
        )}
        {filtered.map((exam) => (
          <div key={exam.id} className={card + ' p-3 hover:shadow-md hover:shadow-slate-200/60 transition'}>
            <div className="flex items-start gap-2.5">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px] text-slate-900 leading-snug">{exam.title}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-1">
                  {exam.subject ? <span className="inline-flex items-center gap-1"><IconBook className="w-3 h-3" />{exam.subject}</span> : null}
                  {exam.className ? <span className="inline-flex items-center gap-1"><IconUsers className="w-3 h-3" />{exam.className}</span> : null}
                  <span className="inline-flex items-center gap-1"><IconFileText className="w-3 h-3" />{exam.totalQuestions || exam.questions?.length || 0} Qs</span>
                  <span className="inline-flex items-center gap-1"><IconClock className="w-3 h-3" />{exam.durationMinutes}m</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1"><IconCalendar className="w-3 h-3" />Starts: {formatIST(exam.startDate)}</div>
                <div className="mt-1.5"><Badge s={effectiveExamStatus(exam)} /></div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button type="button" className="inline-flex items-center gap-1 px-2 h-8 rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50 text-[9px] font-bold" onClick={() => copyLink(exam.id)} aria-label="Share">
                  <IconShare className="w-3 h-3" /> Share
                </button>
                <button type="button" className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:border-slate-300" onClick={() => startEdit(exam)} aria-label="Edit">
                  <IconEdit className="w-3.5 h-3.5" />
                </button>
                <button type="button" className="w-8 h-8 rounded-lg border border-red-100 flex items-center justify-center text-red-500 hover:bg-red-50" onClick={() => delExam(exam.id)} aria-label="Delete">
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Sheet
          title={editId ? 'Edit exam' : 'New exam'}
          subtitle={editId ? 'Update exam details' : 'Create a new examination'}
          icon={<IconEdit className="w-4 h-4" />}
          onClose={() => setOpen(false)}
        >
          {/* Stepper — matches design, responsive */}
          <div className="mb-3">
            <div className="flex items-start justify-between gap-1 sm:gap-2 relative">
              <div className="absolute top-4 left-[12%] right-[12%] h-0.5 bg-slate-100 -z-0 hidden xs:block sm:block" aria-hidden />
              {([
                { id: 'info' as const, n: 1, label: 'Info', sub: 'Basic details' },
                { id: 'questions' as const, n: 2, label: 'Questions', sub: 'Add and manage' },
                { id: 'review' as const, n: 3, label: 'Review', sub: 'Preview exam' },
              ]).map((s) => {
                const active = step === s.id;
                const done =
                  (s.id === 'info' && (step === 'questions' || step === 'review')) ||
                  (s.id === 'questions' && step === 'review');
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
                    className="relative z-[1] flex-1 flex flex-col items-center text-center min-w-0"
                  >
                    <span
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold border-2 transition ${
                        active
                          ? 'bg-white border-blue-600 text-blue-600 shadow-sm shadow-blue-600/20'
                          : done
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-200 text-slate-400'
                      }`}
                    >
                      {done && !active ? <IconCheck className="w-4 h-4" /> : s.n}
                    </span>
                    <span className={`mt-1 text-[10px] sm:text-[11px] font-bold truncate w-full ${active ? 'text-blue-600' : 'text-slate-600'}`}>
                      {s.label}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 truncate w-full hidden sm:block">
                      {s.sub}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 h-0.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{
                  width: step === 'info' ? '33%' : step === 'questions' ? '66%' : '100%',
                }}
              />
            </div>
          </div>

          {step === 'info' && (
            <div className="space-y-2.5 sm:space-y-3">
              {draftBanner && (
                <div className="flex items-center justify-between gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="font-medium">{draftBanner}</span>
                  <button type="button" className="text-[11px] font-bold text-amber-900 underline shrink-0" onClick={() => setDraftBanner(null)}>Dismiss</button>
                </div>
              )}
              <div>
                <label className={labelReq}>
                  Exam title <span className="text-red-500">*</span>
                </label>
                <div className={inpIconWrap}>
                  <IconBookmark className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    className={inpBare}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Biology Unit Test 3"
                  />
                </div>
              </div>

              <div>
                <label className={labelReq}>
                  Subject <span className="text-red-500">*</span>
                </label>
                <div className={inpIconWrap}>
                  <IconBook className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    className={inpBare}
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Biology"
                    list="exam-subjects"
                  />
                  <IconChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
                <datalist id="exam-subjects">
                  <option value="Biology" />
                  <option value="Physics" />
                  <option value="Chemistry" />
                  <option value="Mathematics" />
                  <option value="English" />
                  <option value="History" />
                  <option value="Geography" />
                  <option value="Computer Science" />
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className={labelReq}>
                    Class / group <span className="text-red-500">*</span>
                  </label>
                  <div className={inpIconWrap}>
                    <IconUser className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      className={inpBare}
                      value={form.className}
                      onChange={(e) => setForm({ ...form, className: e.target.value })}
                      placeholder="12"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelReq}>
                    Test code <span className="text-red-500">*</span>
                  </label>
                  <div className={inpIconWrap}>
                    <IconHash className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      className={inpBare}
                      value={form.testNumber}
                      onChange={(e) => setForm({ ...form, testNumber: e.target.value })}
                      placeholder="0A"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelReq}>
                  Start time <span className="text-red-500">*</span>
                </label>
                <div className={inpIconWrap}>
                  <IconCalendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="datetime-local"
                    className={inpBare + ' [color-scheme:light]'}
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className={labelReq}>
                    Duration (minutes) <span className="text-red-500">*</span>
                  </label>
                  <div className={inpIconWrap}>
                    <IconClock className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="number"
                      min={1}
                      className={inpBare}
                      value={form.durationMinutes}
                      onChange={(e) => setForm({ ...form, durationMinutes: +e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelReq}>Negative marking</label>
                  <div className={inpIconWrap}>
                    <IconMinus className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="number"
                      step="0.25"
                      min={0}
                      className={inpBare}
                      value={form.negativeMarking}
                      onChange={(e) => setForm({ ...form, negativeMarking: +e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-0.5">
                <label
                  className={`flex items-center gap-2 cursor-pointer rounded-lg border px-2.5 py-2 transition ${
                    form.randomizeQuestions
                      ? 'border-blue-400 bg-blue-50/70 ring-1 ring-blue-200'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.randomizeQuestions}
                    onChange={(e) => setForm({ ...form, randomizeQuestions: e.target.checked })}
                    className="w-3.5 h-3.5 accent-blue-600 rounded shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1 text-[12px] font-bold text-slate-800">
                      <IconShuffle className="w-3 h-3 text-blue-600" />
                      Shuffle questions
                    </span>
                    <span className="block text-[9px] text-slate-500 leading-tight">
                      Random question order
                    </span>
                  </span>
                </label>
                <label
                  className={`flex items-center gap-2 cursor-pointer rounded-lg border px-2.5 py-2 transition ${
                    form.randomizeOptions
                      ? 'border-blue-400 bg-blue-50/70 ring-1 ring-blue-200'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.randomizeOptions}
                    onChange={(e) => setForm({ ...form, randomizeOptions: e.target.checked })}
                    className="w-3.5 h-3.5 accent-blue-600 rounded shrink-0"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1 text-[12px] font-bold text-slate-800">
                      <IconShuffle className="w-3 h-3 text-slate-500" />
                      Shuffle options
                    </span>
                    <span className="block text-[9px] text-slate-500 leading-tight">
                      Random option order
                    </span>
                  </span>
                </label>
              </div>

              <button
                type="button"
                className="w-full mt-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[13px] py-2.5 shadow-sm shadow-blue-600/20 active:scale-[0.99] transition"
                onClick={() => setStep('questions')}
              >
                Next: Questions →
              </button>
            </div>
          )}

          {step === 'questions' && (
            <div className="space-y-3">
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                {([
                  { id: 'list', label: 'List' },
                  { id: 'ocr', label: 'Photo' },
                  { id: 'manual', label: 'Manual' },
                  { id: 'json', label: 'JSON' },
                ] as const).map((m) => (
                  <button key={m.id} type="button" onClick={() => { setQMode(m.id); if (m.id === 'manual') addManual(); }}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition ${qMode === m.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    {m.label}
                  </button>
                ))}
              </div>

              {draftBanner && (
                <div className="flex items-center justify-between gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="font-medium">{draftBanner}</span>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-amber-900 underline shrink-0"
                    onClick={() => {
                      clearDraft();
                      setDraftBanner(null);
                      if (!editId) {
                        setQs([]);
                        setForm(emptyForm());
                        setStep('info');
                      }
                    }}
                  >
                    Discard
                  </button>
                </div>
              )}
              {toastMsg && <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2"><IconCheck className="w-3.5 h-3.5 shrink-0" />{toastMsg}</div>}

              {qMode === 'list' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-slate-700 inline-flex items-center gap-1.5"><IconFileText className="w-3.5 h-3.5 text-blue-500" />{qs.length} questions</span>
                    <div className="flex gap-1.5">
                      {qs.length > 0 && (
                        <button type="button" className={btnS + ' !py-1 text-[12px]'} onClick={() => exportQuestionsTxt()} title="Export questions as TXT">Export TXT</button>
                      )}
                      <button type="button" className={btnS + ' !py-1 text-[12px]'} onClick={addManual}><IconPlus className="w-3.5 h-3.5" /> Add</button>
                    </div>
                  </div>
                  {qs.length === 0 && <p className="text-sm text-slate-500 text-center py-5">No questions yet. Use Photo, Manual, or JSON.</p>}
                  <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-0.5">
                    {qs.map((q, i) => (
                      <div key={q.id} className="border border-slate-200 rounded-lg p-2.5 hover:border-slate-300 transition">
                        <div className="text-[10px] text-slate-400 font-semibold mb-0.5">Q{i + 1} · Ans {q.answer == null ? 'Not provided' : String.fromCharCode(65 + q.answer)} · {q.marks} mark{(q.imagePreview || q.image?.fileId) ? ' · Diagram' : ''}</div>
                        <div className="flex gap-2 items-start">
                          {(q.imagePreview || q.image?.fileId) ? (
                            <img
                              src={q.imagePreview || (q.image?.fileId ? telegramMediaUrl(q.image.fileId) : '')}
                              alt={`Q${i + 1} diagram`}
                              className="w-16 h-16 object-contain rounded-md border border-slate-200 bg-slate-50 shrink-0"
                            />
                          ) : null}
                          <div className="text-[13px] font-medium text-slate-800 line-clamp-2 min-w-0 flex-1">{q.question}</div>
                        </div>
                        <div className="flex gap-1.5 mt-1.5">
                          <button type="button" className={btnS + ' !py-1 text-[11px]'} onClick={() => void openEditQuestion(q)}><IconEdit className="w-3 h-3" /> Edit</button>
                          <button type="button" className={btnD + ' text-[11px]'} onClick={async () => { if (await confirmAsync(`Remove question ${i + 1}? Select and confirm only if you intend to delete it.`)) setQs((p) => p.filter((x) => x.id !== q.id)); }}><IconTrash className="w-3 h-3" /> Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" className={btnS + ' flex-1'} onClick={() => setStep('info')}>← Back</button>
                    <button type="button" className={btnP + ' flex-1'} onClick={() => setStep('review')}>Review →</button>
                  </div>
                </>
              )}

              {qMode === 'manual' && editQ && (
                <div className="space-y-2.5">
                  {(editQ.imagePreview || editQ.image_bbox || editQ.image?.fileId) ? (
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white overflow-hidden">
                        {editQ.imagePreview ? (
                          <img
                            src={editQ.imagePreview}
                            alt="Diagram"
                            className="w-full h-[100px] object-contain bg-slate-50"
                          />
                        ) : (
                          <div className="h-[100px] flex items-center justify-center text-[11px] text-slate-400">Loading…</div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0 w-[72px]">
                        <button
                          type="button"
                          disabled={imgBusy || !editQ.image_bbox || !ocrPageDataUrl}
                          title={!ocrPageDataUrl ? 'Expand is available right after Photo OCR on this page' : 'Expand crop area'}
                          onClick={() => expandDiagram(1.12)}
                          className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-white h-[30px] px-1 text-[9px] font-semibold text-slate-700 disabled:opacity-35 disabled:text-slate-400"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                          <span className="leading-none">Expand</span>
                        </button>
                        <button
                          type="button"
                          disabled={imgBusy || !editQ.image_bbox || !ocrPageDataUrl}
                          title={!ocrPageDataUrl ? 'Shrink is available right after Photo OCR on this page' : 'Shrink crop area'}
                          onClick={() => expandDiagram(0.9)}
                          className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-white h-[30px] px-1 text-[9px] font-semibold text-slate-700 disabled:opacity-35 disabled:text-slate-400"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
                          <span className="leading-none">Shrink</span>
                        </button>
                        <label
                          className={
                            'flex flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-white h-[30px] px-1 text-[9px] font-semibold text-slate-700 cursor-pointer ' +
                            (imgBusy ? 'opacity-35 pointer-events-none' : '')
                          }
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                          <span className="leading-none">{imgBusy ? '…' : 'Replace'}</span>
                          <input type="file" accept="image/*" className="hidden" disabled={imgBusy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void replaceQuestionPhoto(f); e.target.value = ''; }} />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {editQ.image_bbox && ocrPageDataUrl ? (
                    <button
                      type="button"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-semibold text-slate-600"
                      disabled={imgBusy}
                      onClick={() => setCropEditorOpen(true)}
                    >
                      Adjust crop area
                    </button>
                  ) : null}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-600">Question</span>
                      <span className="text-[10px] text-slate-400 tabular-nums">{(editQ.question || '').length}/500</span>
                    </div>
                    <textarea
                      className={inp + ' min-h-[48px] !py-2 text-[13px] leading-snug rounded-xl'}
                      maxLength={500}
                      value={editQ.question}
                      onChange={(e) => setEditQ({ ...editQ, question: e.target.value })}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-600">Options</span>
                      <span className="text-[10px] text-slate-400">Select correct answer</span>
                    </div>
                    <div className="space-y-1.5">
                      {['A', 'B', 'C', 'D'].map((L, i) => {
                        const selected = editQ.answer === i;
                        return (
                          <div
                            key={L}
                            role="button"
                            tabIndex={0}
                            onClick={() => setEditQ({ ...editQ, answer: i })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setEditQ({ ...editQ, answer: i });
                              }
                            }}
                            className={
                              'w-full flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left cursor-pointer ' +
                              (selected
                                ? 'border-emerald-400/80 bg-emerald-50/90'
                                : 'border-slate-200 bg-white')
                            }
                          >
                            <span
                              className={
                                'shrink-0 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ' +
                                (selected ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500')
                              }
                            >
                              {L}
                            </span>
                            <input
                              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[12px] text-slate-800 placeholder:text-slate-400"
                              value={editQ.options[i] || ''}
                              placeholder={`Option ${L}`}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const opts = [...editQ.options];
                                opts[i] = e.target.value;
                                setEditQ({ ...editQ, options: opts });
                              }}
                            />
                            <span
                              className={
                                'shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ' +
                                (selected ? 'border-emerald-500' : 'border-slate-300')
                              }
                            >
                              {selected ? <span className="w-2 h-2 rounded-full bg-emerald-500" /> : null}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">Correct answer</div>
                      <select
                        className={inp + ' appearance-none !py-2 text-[13px] rounded-xl'}
                        value={editQ.answer == null ? '' : editQ.answer}
                        onChange={(e) =>
                          setEditQ({
                            ...editQ,
                            answer: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      >
                        <option value="">Not provided</option>
                        {[0, 1, 2, 3].map((i) => (
                          <option key={i} value={i}>{String.fromCharCode(65 + i)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">Marks</div>
                      <input
                        type="number"
                        className={inp + ' !py-2 text-[13px] rounded-xl'}
                        value={editQ.marks}
                        onChange={(e) => setEditQ({ ...editQ, marks: +e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-slate-700"
                      onClick={() => {
                        setEditQ(null);
                        setCropEditorOpen(false);
                        setQMode('list');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-[13px] font-semibold inline-flex items-center justify-center gap-1"
                      onClick={saveManualQ}
                    >
                      <IconCheck className="w-3.5 h-3.5" />
                      Save question
                    </button>
                  </div>
                </div>
              )}

              {qMode === 'json' && (
                <div className="space-y-2.5">
                  <p className="text-[11px] text-slate-500">Paste an array of questions with fields: question, options[], answer (0–3), marks</p>
                  <textarea className={inp + ' min-h-[150px] font-mono text-[13px]'} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder='[{"question":"...","options":["A","B","C","D"],"answer":0}]' />
                  <div className="flex gap-2">
                    <button type="button" className={btnS + ' flex-1'} onClick={() => setQMode('list')}>Cancel</button>
                    <button type="button" className={btnP + ' flex-1'} onClick={importJson}>Import</button>
                  </div>
                </div>
              )}

              {qMode === 'ocr' && (
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-center">
                    <div className="mx-auto w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 mb-1.5">
                      {ocrBusy ? (
                        <span className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-hidden />
                      ) : (
                        <IconSparkles className="w-5 h-5" />
                      )}
                    </div>
                    {ocrBusy ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-slate-700">
                          Processing images in background ({ocrProgress.done}/{ocrProgress.total})…
                        </p>
                        <div className="h-1.5 w-full max-w-[220px] mx-auto rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: ocrProgress.total ? `${Math.round((ocrProgress.done / ocrProgress.total) * 100)}%` : '30%' }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-500">You can add more images while work continues.</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">Upload one or more photos of questions.</p>
                    )}
                  </div>
                  {ocrQueue.length > 0 && (
                    <ul className="space-y-1.5 max-h-36 overflow-y-auto text-left">
                      {ocrQueue.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]">
                          <span className="truncate flex-1 font-medium text-slate-700">{item.name}</span>
                          {item.status === 'pending' && <span className="text-slate-400">Queued</span>}
                          {item.status === 'running' && <span className="text-blue-600 font-semibold">OCR…</span>}
                          {item.status === 'done' && <span className="text-emerald-600 font-semibold">Done</span>}
                          {item.status === 'error' && (
                            <span className="flex items-center gap-1 text-amber-700 font-semibold" title={item.error}>
                              <span aria-hidden>!</span> Failed
                              <button type="button" className="underline ml-1" onClick={() => void retryOcrItem(item.id)}>Retry</button>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className={btnP + ' w-full cursor-pointer'}>
                    <IconUpload className="w-4 h-4" />
                    {ocrBusy ? 'Add more images' : 'Choose photos'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) void onOcrFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button type="button" className={btnS + ' w-full'} onClick={() => setQMode('list')}>Back to list</button>
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3">
              <div className={card + ' p-3.5 space-y-1 text-sm'}>
                <div className="font-bold text-base">{form.title || '(Untitled)'}</div>
                <div className="text-[12px] text-slate-500">{form.subject} · {form.className} · {form.durationMinutes} min</div>
                <div className="pt-1"><Badge s={effectiveExamStatus({ startDate: form.startDate ? fromDatetimeLocalIST(form.startDate) : new Date().toISOString(), durationMinutes: form.durationMinutes })} /></div>
                <div className="text-[12px] text-slate-600 pt-1.5 flex items-center gap-1.5"><IconFileText className="w-3.5 h-3.5 text-blue-500" />{qs.length} questions · {qs.reduce((s, q) => s + (Number(q.marks) || 1), 0)} total marks</div>
              </div>
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-0.5">
                {qs.map((q, i) => (
                  <div key={q.id} className="border border-slate-200 rounded-lg p-2.5 text-[13px]">
                    <div className="font-semibold text-slate-400 text-[11px] mb-0.5">Q{i + 1}</div>
                    <div className="font-medium">{q.question}</div>
                    <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-600">
                      {(q.options || []).map((o, oi) => (
                        <div key={oi} className={`flex items-center gap-1.5 ${oi === q.answer ? 'text-emerald-700 font-semibold' : ''}`}>
                          <span className="w-3.5 h-3.5 rounded-md bg-slate-100 flex items-center justify-center text-[8px] font-bold shrink-0">{String.fromCharCode(65 + oi)}</span>
                          {o || '—'}
                          {oi === q.answer && <IconCheck className="w-3 h-3 text-emerald-600 shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1"><IconInfo className="w-3 h-3 shrink-0" />Status is automatic: Scheduled before start, Live during the window, Results published after it ends.</p>
              <div className="flex gap-2">
                <button type="button" className={btnS + ' flex-1'} onClick={() => setStep('questions')}>← Edit questions</button>
                <button type="button" className={btnP + ' flex-1 inline-flex items-center justify-center gap-2'} disabled={saving || deleting} onClick={saveExam}>
                  {saving ? (editId ? 'Saving…' : 'Creating…') : (editId ? 'Save exam' : 'Create exam')}</button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
    </>
  );
}
