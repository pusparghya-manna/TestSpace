import React from 'react';

/** Homepage-shaped skeleton for initial dashboard load (no spinner). */
export function HomeSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-100 mb-2" />
            <div className="h-5 w-10 bg-slate-200 rounded mb-1.5" />
            <div className="h-2.5 w-14 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Section title */}
      <div className="flex items-center justify-between pt-1">
        <div className="space-y-1">
          <div className="h-3.5 w-36 bg-slate-200 rounded" />
          <div className="h-2.5 w-48 bg-slate-100 rounded" />
        </div>
        <div className="h-7 w-16 bg-slate-100 rounded-lg" />
      </div>

      {/* Student rows */}
      <div className="space-y-1.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200/80 bg-white p-2 flex items-center gap-2 shadow-sm"
          >
            <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />
            <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-28 bg-slate-200 rounded" />
              <div className="h-2.5 w-40 bg-slate-100 rounded" />
            </div>
            <div className="h-5 w-10 bg-slate-100 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generic compact page skeleton (exams / results / settings). */
export function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 bg-slate-200 rounded" />
        <div className="h-8 w-20 bg-slate-100 rounded-lg" />
      </div>
      <div className="h-9 w-full bg-slate-100 rounded-lg" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <div className="h-3.5 w-3/4 bg-slate-200 rounded" />
          <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
          <div className="flex gap-2">
            <div className="h-6 w-14 bg-slate-100 rounded" />
            <div className="h-6 w-14 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
