import React from 'react';
import { STATUS_STYLE } from '../../styles/ui';

export function Badge({ s }: { s: string }) {
  const dot: Record<string, string> = {
    LIVE: 'bg-emerald-500',
    SCHEDULED: 'bg-amber-500',
    RESULTS_PUBLISHED: 'bg-blue-500',
    DRAFT: 'bg-slate-400',
    ENDED: 'bg-slate-300',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLE[s] || STATUS_STYLE.DRAFT}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[s] || 'bg-slate-400'} ${s === 'LIVE' ? 'pulse-ring' : ''}`} />
      {s.replace(/_/g, ' ')}
    </span>
  );
}
