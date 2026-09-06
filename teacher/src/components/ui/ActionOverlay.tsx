/** Full-screen dim + skeleton feedback for slow actions. */
export function ActionOverlay({
  show,
  label = 'Loading…',
}: {
  show: boolean;
  label?: string;
}) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/35 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="mx-4 w-full max-w-xs rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-xl">
        <div className="mx-auto h-11 w-11 rounded-2xl bg-blue-100 animate-pulse" aria-hidden="true" />
        <div className="mx-auto mt-4 h-3 w-40 rounded-full bg-slate-200 animate-pulse" aria-hidden="true" />
        <div className="mx-auto mt-2 h-2.5 w-28 rounded-full bg-slate-100 animate-pulse" aria-hidden="true" />
        <div className="mt-5 space-y-2" aria-hidden="true">
          <div className="h-3 w-full rounded-full bg-slate-200 animate-pulse" />
          <div className="h-3 w-10/12 rounded-full bg-slate-100 animate-pulse" />
          <div className="h-9 w-full rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-9 w-11/12 rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <p className="mt-4 text-center text-[11px] font-semibold text-slate-500">{label}</p>
      </div>
    </div>
  );
}
