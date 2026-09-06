import React from 'react';

const Logo: React.FC = () => (
  <img
    src={`${import.meta.env.BASE_URL}exam-bot-logo.png`}
    alt="Exam Bot logo"
    draggable={false}
    onContextMenu={(e) => e.preventDefault()}
    onDragStart={(e) => e.preventDefault()}
    className="protected-logo h-14 w-14 rounded-2xl object-cover bg-white shadow-md shadow-blue-500/15"
    width="56"
    height="56"
    loading="eager"
    decoding="async"
  />
);

const SkeletonBar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-bar rounded-full bg-slate-200/80 ${className}`} aria-hidden="true" />
);

export const LoadingSkeleton: React.FC = () => (
  <div
    className="min-h-[100dvh] liquid-canvas-bg flex items-start justify-center p-3 md:p-5"
    aria-busy="true"
    aria-live="polite"
    aria-label="Loading your examination desk"
  >
    <div className="w-full max-w-4xl">
      <div className="glass-header rounded-2xl p-3 flex items-center gap-3">
        <Logo />
        <div className="flex-1 space-y-2">
          <SkeletonBar className="h-4 w-44" />
          <SkeletonBar className="h-3 w-28" />
        </div>
        <SkeletonBar className="h-8 w-20 rounded-xl" />
      </div>

      <div className="mt-4 space-y-3">
        <section className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <SkeletonBar className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <SkeletonBar className="h-3 w-24" />
              <SkeletonBar className="h-5 w-40" />
              <SkeletonBar className="h-3 w-56 max-w-full" />
            </div>
          </div>
        </section>

        <section className="glass-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SkeletonBar className="h-4 w-32" />
            <SkeletonBar className="h-6 w-16 rounded-full" />
          </div>
          <SkeletonBar className="h-5 w-3/4" />
          <SkeletonBar className="h-3 w-1/2" />
          <div className="flex gap-2 pt-1">
            <SkeletonBar className="h-7 w-24 rounded-lg" />
            <SkeletonBar className="h-7 w-20 rounded-lg" />
            <SkeletonBar className="h-7 w-24 rounded-lg" />
          </div>
          <SkeletonBar className="h-9 w-full rounded-xl" />
        </section>

        <section className="glass-card rounded-2xl p-4 space-y-3">
          <SkeletonBar className="h-4 w-36" />
          <SkeletonBar className="h-3 w-64 max-w-full" />
          <SkeletonBar className="h-10 w-full rounded-xl" />
        </section>
      </div>

    </div>
  </div>
);

export type ActionLoadingKind = 'start' | 'submit' | 'review';

export const ActionLoadingSkeleton: React.FC<{ kind: ActionLoadingKind }> = ({ kind }) => {
  const title =
    kind === 'submit'
      ? 'Submitting your exam'
      : kind === 'review'
        ? 'Loading solutions'
        : 'Preparing your exam';
  const subtitle =
    kind === 'submit'
      ? 'Saving your answers and calculating your result…'
      : kind === 'review'
        ? 'Fetching verified answers and explanations…'
        : 'Loading questions and setting up your attempt…';
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={title}
    >
      <div className="action-loading-card glass-card w-full max-w-sm rounded-3xl p-5 text-center shadow-2xl shadow-slate-900/15">
        <div className="flex justify-center">
          <div className="action-loading-logo rounded-2xl bg-white p-1 shadow-md shadow-blue-500/15">
            <Logo />
          </div>
        </div>
        <h2 className="mt-4 text-base font-extrabold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        <div className="mt-5 space-y-2 text-left">
          <SkeletonBar className="h-3 w-full" />
          <SkeletonBar className="h-3 w-10/12" />
          <SkeletonBar className="h-10 w-full rounded-xl" />
          <SkeletonBar className="h-10 w-11/12 rounded-xl" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-bold text-blue-700">
          <span className="action-loading-dot h-1.5 w-1.5 rounded-full bg-blue-600" />
          Please wait
        </div>
      </div>
    </div>
  );
};
