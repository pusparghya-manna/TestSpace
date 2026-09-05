export const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SCHEDULED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  LIVE: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  ENDED: 'bg-slate-100 text-slate-500',
  RESULTS_PUBLISHED: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
};

export const inp = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400';
export const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';
export const btnP = btn + ' bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/20 px-3.5 py-2';
export const btnS = btn + ' bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 px-3.5 py-2';
export const btnD = btn + ' text-red-600 hover:bg-red-50 px-2.5 py-1.5';
export const card = 'bg-white rounded-xl border border-slate-200/80 shadow-sm';

/** Field with leading icon — compact for mobile 100% zoom */
export const inpIconWrap = 'flex items-center gap-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 sm:py-2 text-slate-900 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10';
export const inpBare = 'flex-1 min-w-0 bg-transparent outline-none text-[12px] sm:text-[13px] placeholder:text-slate-400';
export const labelReq = 'text-[10px] sm:text-[11px] font-semibold text-slate-600 mb-1 block';
