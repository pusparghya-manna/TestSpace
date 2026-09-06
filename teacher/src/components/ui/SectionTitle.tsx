import React from 'react';

export function SectionTitle({ icon, title, sub }: { icon?: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex items-end justify-between gap-2 pt-1">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && <span className="text-blue-600 shrink-0">{icon}</span>}
        <h2 className="font-bold text-sm text-slate-800 truncate">{title}</h2>
      </div>
      {sub && <span className="text-[10px] text-slate-400 shrink-0">{sub}</span>}
    </div>
  );
}
