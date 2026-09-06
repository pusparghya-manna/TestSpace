import React from 'react';
import { IconClose } from '../../icons';

type Props = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional sticky footer (e.g. primary action) — stays visible while body scrolls */
  footer?: React.ReactNode;
};

/**
 * Compact responsive sheet — fits 100% mobile Chrome zoom.
 * z-index above bottom nav; no extra bottom margin wasted on nav clearance.
 */
export function Sheet({ title, subtitle, icon, onClose, children, footer }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className="relative w-full sm:max-w-md md:max-w-lg flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-100/80"
        style={{
          // Use almost full viewport — sheet covers bottom nav (z-100 > z-40)
          maxHeight: 'min(96dvh, 96vh)',
          height: 'auto',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact header */}
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5 sm:px-4 sm:py-3 rounded-t-2xl shrink-0">
          {icon ? (
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 ring-1 ring-blue-100">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] sm:text-sm font-bold text-slate-900 leading-tight truncate">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[10px] text-slate-500 leading-tight truncate">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0 active:bg-slate-100"
            aria-label="Close"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 sm:px-4 py-2.5 sm:py-3 overflow-y-auto flex-1 overscroll-contain min-h-0">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-slate-100 px-3 sm:px-4 py-2.5 bg-white rounded-b-none sm:rounded-b-2xl">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
