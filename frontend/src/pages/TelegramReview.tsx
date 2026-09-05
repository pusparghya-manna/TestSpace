import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

type QStatus = 'correct' | 'wrong' | 'unattempted';

interface ReviewQuestion {
  index: number;
  id: string;
  question: string;
  options: string[];
  correctIndex: number | null;
  selectedIndex: number | null;
  status: QStatus;
  imageUrl?: string | null;
}

interface ReviewPayload {
  exam: { id: string; title: string; subject: string };
  attempt: {
    id: string;
    score: number;
    maxScore: number;
    percentage: number;
    studentName?: string;
  };
  summary: {
    total: number;
    correct: number;
    wrong: number;
    unattempted: number;
    score: number;
    maxScore: number;
    accuracy: number;
  };
  questions: ReviewQuestion[];
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        themeParams?: Record<string, string>;
        colorScheme?: string;
        MainButton?: { hide: () => void };
        BackButton?: { show: () => void; hide: () => void; onClick: (cb: () => void) => void };
      };
    };
  }
}

function letter(i: number) {
  return String.fromCharCode(65 + i);
}

function statusLabel(s: QStatus): string {
  if (s === 'correct') return 'Correct';
  if (s === 'wrong') return 'Wrong';
  return 'Skipped';
}

export default function TelegramReview() {
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [gridCollapsed, setGridCollapsed] = useState(false);
  const gridCollapsedRef = useRef(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  /** Ignore scroll-driven expand/collapse after any grid height change (layout shift). */
  const ignoreScrollUntil = useRef(0);
  const pinnedOpen = useRef(false);
  const pinnedClosed = useRef(false);

  const attemptId = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get('a') || q.get('attemptId') || '';
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    try {
      tg?.ready();
      tg?.expand();
      tg?.MainButton?.hide();
      const ae = document.activeElement as HTMLElement | null;
      if (ae && typeof ae.blur === 'function') ae.blur();
    } catch {
      /* ignore */
    }

    async function load() {
      if (!attemptId) {
        setError('Missing attempt id');
        setLoading(false);
        return;
      }
      const initData = window.Telegram?.WebApp?.initData || '';
      if (!initData) {
        setError('Open this page from the Telegram bot (Review answers button).');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/telegram/webapp-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData, attemptId }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((json as { error?: string }).error || 'Failed to load review');
          setLoading(false);
          return;
        }
        setData(json as ReviewPayload);
      } catch {
        setError('Network error loading review');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [attemptId]);


  const settleScroll = (ms = 550) => {
    ignoreScrollUntil.current = Date.now() + ms;
  };

  /** Change grid open/closed and block scroll handler until layout settles. */
  const setCollapsed = (next: boolean, opts?: { pinClosed?: boolean; pinOpen?: boolean }) => {
    if (gridCollapsedRef.current === next) return;
    gridCollapsedRef.current = next;
    pinnedOpen.current = !!opts?.pinOpen;
    pinnedClosed.current = !!opts?.pinClosed;
    settleScroll(550);
    setGridCollapsed(next);
  };

  const onScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      const prev = lastScrollY.current;
      const delta = y - prev;
      const now = Date.now();

      // After any expand/collapse — ignore layout-shift scroll noise
      if (now < ignoreScrollUntil.current) {
        lastScrollY.current = y;
        ticking.current = false;
        return;
      }

      // Near top: expand unless user just hid the grid
      if (y < 48) {
        if (!pinnedClosed.current && gridCollapsedRef.current) {
          setCollapsed(false);
        }
        lastScrollY.current = y;
        ticking.current = false;
        return;
      }

      // Clear "just hid" once user scrolls down into content
      if (pinnedClosed.current && delta > 20 && y > 100) {
        pinnedClosed.current = false;
      }

      // User explicitly opened grid: only collapse on clear downward scroll
      if (pinnedOpen.current) {
        if (delta > 28) {
          setCollapsed(true, { pinClosed: true });
        }
        lastScrollY.current = y;
        ticking.current = false;
        return;
      }

      // Don't auto-expand while pinned closed
      if (pinnedClosed.current) {
        lastScrollY.current = y;
        ticking.current = false;
        return;
      }

      // Auto-hide while reading questions (scroll down)
      if (delta > 18 && y > 110 && !gridCollapsedRef.current) {
        setCollapsed(true, { pinClosed: true });
      }
      // Auto-show when scrolling up with clear intent
      else if (delta < -22 && gridCollapsedRef.current) {
        setCollapsed(false, { pinOpen: true });
      }

      lastScrollY.current = y;
      ticking.current = false;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onScroll]);

  const openGrid = () => {
    setCollapsed(false, { pinOpen: true });
  };

  const closeGrid = () => {
    setCollapsed(true, { pinClosed: true });
  };

  const jumpTo = (index: number) => {
    const el = document.getElementById(`q-${index}`);
    if (el) {
      setCollapsed(true, { pinClosed: true });
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div style={s.shell}>
        <div style={s.loadingCard} role="status" aria-live="polite" aria-busy="true">
          <div style={s.loadingLogo} aria-hidden>▦</div>
          <div style={s.skeletonLineWide} />
          <div style={s.skeletonLine} />
          <div style={s.skeletonBlock} />
          <div style={s.skeletonBlock} />
          <span style={s.loadingLabel}>Loading solutions</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={s.shell}>
        <div style={s.centerCard}>
          <b style={{ fontSize: 16 }}>Could not open review</b>
          <p style={{ marginTop: 8, color: '#64748b', fontSize: 14 }}>{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const { summary, exam, attempt } = data;
  const scorePct = Math.round(attempt.percentage ?? summary.accuracy ?? 0);

  return (
    <div style={s.shell}>
      <header style={s.header}>
        <div style={s.headerTop}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={s.headerTitleRow}>
              <span style={s.headerIcon}>📋</span>
              <h1 style={s.headerTitle}>Review Answers</h1>
            </div>
            <p style={s.examName}>{exam.title}</p>
          </div>
          <div style={s.headerActions}>
            <div style={s.scoreBadge}>
              <span style={s.scoreStar}>⭐</span>
              <div>
                <div style={s.scoreNums}>
                  {summary.score} / {summary.maxScore}
                </div>
                <div style={s.scorePct}>Score ({scorePct}%)</div>
              </div>
            </div>
            <button type="button" style={s.paletteBtn} onClick={openGrid} aria-label="Open question palette">
              <span aria-hidden>▦</span>
              <span>Palette</span>
            </button>
          </div>
        </div>

      </header>

      {/* Sticky collapsible question grid */}
      <div style={s.gridSticky}>
        {gridCollapsed ? (
          <button
            type="button"
            style={s.compactBar}
            onClick={openGrid}
            aria-expanded={false}
          >
              <span style={s.compactBarLeft}>☰ Questions · {data.questions.length}</span>
            <span style={s.compactBarRight}>Show grid ▾</span>
          </button>
        ) : (
          <div style={s.gridPanel}>
              <div style={s.gridPanelHead}>
              <div>
                <span style={s.gridHint}>Tap a number to jump · scroll down to hide</span>
                <div style={s.gridLegend} aria-label="Question status legend">
                  <span><i style={{ ...s.legendDot, background: '#16a34a' }} /> Correct {summary.correct}</span>
                  <span><i style={{ ...s.legendDot, background: '#dc2626' }} /> Wrong {summary.wrong}</span>
                  <span><i style={{ ...s.legendDot, background: '#94a3b8' }} /> Skipped {summary.unattempted}</span>
                </div>
              </div>
              <button type="button" style={s.collapseBtn} onClick={closeGrid}>
                Hide ▴
              </button>
            </div>
            <div style={s.grid}>
              {data.questions.map((q) => {
                const bg =
                  q.status === 'correct'
                    ? '#dcfce7'
                    : q.status === 'wrong'
                      ? '#fee2e2'
                      : '#f1f5f9';
                const color =
                  q.status === 'correct'
                    ? '#15803d'
                    : q.status === 'wrong'
                      ? '#b91c1c'
                      : '#64748b';
                const border =
                  q.status === 'correct'
                    ? '#86efac'
                    : q.status === 'wrong'
                      ? '#fca5a5'
                      : '#e2e8f0';
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => jumpTo(q.index)}
                    style={{
                      ...s.gridBtn,
                      background: bg,
                      color,
                      borderColor: border,
                    }}
                    aria-label={`Go to question ${q.index + 1}`}
                  >
                    {q.index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <main style={s.main}>
        {data.questions.map((q) => {
          const bookmarked = !!bookmarks[q.id];
          return (
            <article key={q.id} id={`q-${q.index}`} style={s.qCard}>
              <div style={s.qHead}>
                <div style={s.qHeadLeft}>
                  <span style={s.qNum}>Q{q.index + 1}</span>
                  <span
                    style={{
                      ...s.statusPill,
                      background:
                        q.status === 'correct'
                          ? '#dcfce7'
                          : q.status === 'wrong'
                            ? '#fee2e2'
                            : '#fef3c7',
                      color:
                        q.status === 'correct'
                          ? '#15803d'
                          : q.status === 'wrong'
                            ? '#b91c1c'
                            : '#b45309',
                    }}
                  >
                    {q.status === 'correct' && '✅ '}
                    {q.status === 'wrong' && '❌ '}
                    {q.status === 'unattempted' && '○ '}
                    {statusLabel(q.status)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBookmark(q.id)}
                  style={{
                    ...s.bookmarkBtn,
                    color: bookmarked ? '#2563eb' : '#94a3b8',
                  }}
                  aria-label="Bookmark"
                >
                  {bookmarked ? '🔖' : '📑'} Bookmark
                </button>
              </div>

              {q.imageUrl ? (
                <img
                  src={q.imageUrl}
                  alt={`Q${q.index + 1} diagram`}
                  style={{
                    width: '100%',
                    maxHeight: 220,
                    objectFit: 'contain',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    marginBottom: 10,
                  }}
                />
              ) : null}
              <p style={s.qText}>{q.question}</p>

              <div style={s.opts}>
                {(q.options || []).map((opt, oi) => {
                  const isCorrect = q.correctIndex != null && q.correctIndex === oi;
                  const isSelected = q.selectedIndex != null && q.selectedIndex === oi;
                  const isWrongPick = isSelected && q.status === 'wrong';

                  let optStyle: CSSProperties = { ...s.opt };
                  if (isCorrect) {
                    optStyle = {
                      ...optStyle,
                      background: '#dcfce7',
                      borderColor: '#86efac',
                      color: '#14532d',
                    };
                  } else if (isWrongPick) {
                    optStyle = {
                      ...optStyle,
                      background: '#fee2e2',
                      borderColor: '#fca5a5',
                      color: '#7f1d1d',
                    };
                  }

                  return (
                    <div key={oi} style={optStyle}>
                      <span style={s.optMark}>
                        {isCorrect ? '✅' : isWrongPick ? '❌' : '○'}
                      </span>
                      <span style={s.optBody}>
                        <b>{letter(oi)}.</b> {opt}
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}

      </main>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Bengali", "Hind Siliguri", sans-serif',
    WebkitFontSmoothing: 'antialiased',
  },
  centerCard: {
    margin: 24,
    padding: 20,
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
    textAlign: 'center',
    color: '#0f172a',
  },
  header: {
    background: '#fff',
    padding: '14px 14px 12px',
    borderBottom: '1px solid #e2e8f0',
  },
  headerTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: { fontSize: 18 },
  headerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#0f172a',
  },
  examName: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#64748b',
    lineHeight: 1.35,
    wordBreak: 'break-word',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 6,
    flexShrink: 0,
  },
  scoreBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 14,
    padding: '8px 12px',
    flexShrink: 0,
  },
  paletteBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    borderRadius: 12,
    padding: '7px 9px',
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    whiteSpace: 'nowrap',
  },
  scoreStar: { fontSize: 18 },
  scoreNums: {
    fontSize: 15,
    fontWeight: 800,
    color: '#92400e',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  scorePct: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: 600,
  },
  loadingCard: {
    margin: 24,
    padding: 20,
    background: '#fff',
    borderRadius: 16,
    border: '1px solid #e2e8f0',
    boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
  },
  loadingLogo: {
    width: 42,
    height: 42,
    display: 'grid',
    placeItems: 'center',
    margin: '0 auto 16px',
    borderRadius: 12,
    background: '#dbeafe',
    color: '#2563eb',
    fontSize: 20,
    fontWeight: 800,
    animation: 'reviewPulse 1.35s ease-in-out infinite',
  },
  skeletonLineWide: {
    height: 12,
    width: '76%',
    borderRadius: 999,
    background: '#cbd5e1',
    animation: 'reviewPulse 1.35s ease-in-out infinite',
  },
  skeletonLine: {
    height: 10,
    width: '48%',
    marginTop: 9,
    borderRadius: 999,
    background: '#e2e8f0',
    animation: 'reviewPulse 1.35s ease-in-out infinite',
  },
  skeletonBlock: {
    height: 44,
    width: '100%',
    marginTop: 12,
    borderRadius: 10,
    background: '#f1f5f9',
    animation: 'reviewPulse 1.35s ease-in-out infinite',
  },
  loadingLabel: {
    display: 'block',
    marginTop: 16,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#475569',
  },
  gridSticky: {
    position: 'sticky',
    top: 0,
    zIndex: 40,
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  compactBar: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 14px',
    border: 'none',
    background: '#fff',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
  },
  compactBarLeft: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f172a',
  },
  compactBarRight: {
    fontSize: 12,
    fontWeight: 600,
    color: '#2563eb',
  },
  gridPanel: {
    padding: '8px 10px 10px',
    background: '#fff',
  },
  gridPanelHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  gridLegend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 10px',
    marginTop: 5,
    fontSize: 10,
    fontWeight: 600,
    color: '#64748b',
  },
  legendDot: {
    display: 'inline-block',
    width: 7,
    height: 7,
    borderRadius: 999,
    marginRight: 3,
  },
  gridHint: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 1.3,
  },
  collapseBtn: {
    border: 'none',
    background: 'transparent',
    color: '#2563eb',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '4px 0',
    whiteSpace: 'nowrap',
    WebkitTapHighlightColor: 'transparent',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
    gap: 5,
    width: '100%',
    boxSizing: 'border-box',
  },
  gridBtn: {
    width: '100%',
    minWidth: 0,
    aspectRatio: '1',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  main: {
    padding: '12px 12px 48px',
  },
  qCard: {
    background: '#fff',
    borderRadius: 13,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
    padding: '10px 11px 9px',
    marginBottom: 8,
  },
  qHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 7,
  },
  qHeadLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  qNum: {
    fontSize: 13,
    fontWeight: 800,
    color: '#0f172a',
  },
  statusPill: {
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 999,
    padding: '2px 7px',
    whiteSpace: 'nowrap',
  },
  bookmarkBtn: {
    border: 'none',
    background: 'transparent',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 0',
    whiteSpace: 'nowrap',
    WebkitTapHighlightColor: 'transparent',
  },
  qText: {
    margin: '0 0 8px',
    fontSize: 13,
    lineHeight: 1.42,
    color: '#0f172a',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  },
  opts: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  opt: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 7,
    padding: '7px 9px',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    fontSize: 12,
    lineHeight: 1.35,
  },
  optMark: {
    flexShrink: 0,
    fontSize: 14,
    lineHeight: 1.4,
  },
  optBody: {
    minWidth: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  },
};
