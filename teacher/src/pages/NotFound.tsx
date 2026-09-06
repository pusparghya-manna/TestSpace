import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Custom 404 — pure CSS/SVG recreation of the product illustration
 * (no external photo). Responsive for phone / tablet / desktop.
 */
export function NotFound() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#f0f5ff] flex items-center justify-center px-4 py-10">
      {/* Soft radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 38%, rgba(147,197,253,0.45) 0%, rgba(240,245,255,0) 70%)',
        }}
      />

      {/* Clouds */}
      <Cloud className="absolute top-[8%] left-[8%] w-16 sm:w-24 opacity-70" />
      <Cloud className="absolute top-[12%] right-[10%] w-20 sm:w-28 opacity-60" />
      <Cloud className="absolute top-[28%] left-[18%] w-10 sm:w-14 opacity-40" />

      {/* Stars */}
      <Sparkle className="absolute top-[18%] left-[28%] w-3 h-3 text-blue-300/80" />
      <Sparkle className="absolute top-[22%] right-[30%] w-2.5 h-2.5 text-indigo-300/70" />
      <Sparkle className="absolute top-[35%] right-[18%] w-2 h-2 text-blue-200" />

      {/* Decorative plant (left) */}
      <svg
        className="absolute bottom-[18%] left-[4%] sm:left-[10%] w-16 sm:w-24 h-auto opacity-80 text-indigo-200"
        viewBox="0 0 80 120"
        fill="none"
        aria-hidden
      >
        <path
          d="M40 120 V50"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <ellipse cx="28" cy="48" rx="18" ry="28" fill="currentColor" opacity="0.7" transform="rotate(-25 28 48)" />
        <ellipse cx="52" cy="42" rx="16" ry="26" fill="currentColor" opacity="0.55" transform="rotate(20 52 42)" />
        <ellipse cx="40" cy="30" rx="14" ry="22" fill="currentColor" opacity="0.45" />
      </svg>

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
        {/* 404 + robot */}
        <div className="relative flex items-center justify-center w-full select-none mb-2 sm:mb-0">
          <span
            className="text-[5.5rem] sm:text-[8rem] font-black leading-none tracking-tight bg-clip-text text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(160deg, #93c5fd 0%, #60a5fa 40%, #818cf8 100%)',
              textShadow: '0 12px 40px rgba(99,102,241,0.25)',
              WebkitTextStroke: '0px transparent',
              filter: 'drop-shadow(0 8px 24px rgba(96,165,250,0.35))',
            }}
          >
            4
          </span>

          {/* Robot bubble (replaces middle 0) */}
          <div className="relative mx-1 sm:mx-2 w-[5.5rem] h-[5.5rem] sm:w-28 sm:h-28 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95), rgba(191,219,254,0.55) 55%, rgba(147,197,253,0.35))',
                boxShadow:
                  '0 0 0 3px rgba(255,255,255,0.6), 0 12px 32px rgba(59,130,246,0.2), inset 0 -6px 16px rgba(147,197,253,0.4)',
              }}
            />
            <Robot className="relative w-12 h-12 sm:w-16 sm:h-16" />
            {/* question mark */}
            <span className="absolute -top-1 right-2 text-blue-400 text-lg sm:text-xl font-bold drop-shadow-sm">
              ?
            </span>
          </div>

          <span
            className="text-[5.5rem] sm:text-[8rem] font-black leading-none tracking-tight bg-clip-text text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(200deg, #93c5fd 0%, #60a5fa 40%, #818cf8 100%)',
              filter: 'drop-shadow(0 8px 24px rgba(96,165,250,0.35))',
            }}
          >
            4
          </span>
        </div>

        {/* Glass card */}
        <div
          className="relative w-full max-w-sm mx-auto -mt-1 sm:-mt-2 rounded-2xl px-6 py-5 sm:py-6 text-center border border-white/70"
          style={{
            background: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow:
              '0 20px 50px rgba(99,102,241,0.12), 0 4px 16px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Oops! Page not found
          </h1>
          <p className="mt-2 text-[12px] sm:text-sm text-slate-500 leading-relaxed max-w-[260px] mx-auto">
            The page you&apos;re looking for doesn&apos;t exist
            <br />
            or has been moved.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-8 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
            style={{
              background: 'linear-gradient(90deg, #3b82f6 0%, #4f46e5 100%)',
              boxShadow: '0 10px 24px rgba(59,130,246,0.35)',
            }}
          >
            <HomeIcon className="w-4 h-4" />
            Go to Home
          </Link>
        </div>

        {/* Bottom props: books + open book + lamp + pencils */}
        <div className="relative w-full max-w-md h-28 sm:h-32 mt-4 sm:mt-6 pointer-events-none">
          <BooksStack className="absolute left-2 sm:left-6 bottom-2 w-16 sm:w-20" />
          <OpenBook className="absolute left-1/2 -translate-x-1/2 bottom-0 w-28 sm:w-36" />
          <PencilCup className="absolute right-14 sm:right-20 bottom-3 w-8 sm:w-10" />
          <Lamp className="absolute right-2 sm:right-6 bottom-6 w-14 sm:w-18" />
        </div>
      </div>
    </div>
  );
}

function Cloud({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 60" fill="none" aria-hidden>
      <ellipse cx="40" cy="38" rx="28" ry="16" fill="#dbeafe" />
      <ellipse cx="68" cy="32" rx="32" ry="20" fill="#e0e7ff" />
      <ellipse cx="90" cy="40" rx="22" ry="14" fill="#dbeafe" />
    </svg>
  );
}

function Sparkle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0 L13.5 9 L22 12 L13.5 15 L12 24 L10.5 15 L2 12 L10.5 9 Z" />
    </svg>
  );
}

function Robot({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      {/* antenna */}
      <line x1="32" y1="6" x2="32" y2="14" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3" fill="#60a5fa" />
      {/* head */}
      <rect x="14" y="14" width="36" height="28" rx="12" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
      {/* face plate */}
      <rect x="18" y="20" width="28" height="16" rx="8" fill="#1e293b" />
      {/* eyes */}
      <circle cx="26" cy="28" r="3.2" fill="#e2e8f0" />
      <circle cx="38" cy="28" r="3.2" fill="#e2e8f0" />
      <circle cx="26.5" cy="28.5" r="1.2" fill="#334155" />
      <circle cx="38.5" cy="28.5" r="1.2" fill="#334155" />
      {/* sad mouth */}
      <path d="M28 34 Q32 31 36 34" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* body / paper */}
      <rect x="22" y="44" width="20" height="14" rx="3" fill="#fff" stroke="#cbd5e1" strokeWidth="1.2" />
      <line x1="26" y1="49" x2="38" y2="49" stroke="#cbd5e1" strokeWidth="1.2" />
      <line x1="26" y1="52" x2="36" y2="52" stroke="#e2e8f0" strokeWidth="1.2" />
      {/* arms holding paper */}
      <path d="M18 40 Q14 48 22 50" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M46 40 Q50 48 42 50" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function BooksStack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 70" fill="none" aria-hidden>
      <rect x="8" y="48" width="64" height="14" rx="2" fill="#a5b4fc" />
      <rect x="10" y="34" width="60" height="14" rx="2" fill="#818cf8" />
      <rect x="12" y="20" width="56" height="14" rx="2" fill="#c7d2fe" />
      {/* bookmark */}
      <path d="M55 20 V40 L60 36 L65 40 V20" fill="#7c3aed" opacity="0.85" />
      <rect x="12" y="22" width="4" height="10" rx="1" fill="#e0e7ff" opacity="0.6" />
    </svg>
  );
}

function OpenBook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 70" fill="none" aria-hidden>
      <path
        d="M70 12 C55 8 20 10 12 16 V58 C25 52 55 52 70 58 C85 52 115 52 128 58 V16 C120 10 85 8 70 12 Z"
        fill="#e0e7ff"
        stroke="#a5b4fc"
        strokeWidth="1.5"
      />
      <path d="M70 12 V58" stroke="#818cf8" strokeWidth="1.5" />
      <path d="M70 12 C55 18 55 52 70 58 C85 52 85 18 70 12 Z" fill="#c7d2fe" opacity="0.5" />
      {/* lines */}
      <line x1="28" y1="28" x2="55" y2="28" stroke="#94a3b8" strokeWidth="1.2" opacity="0.5" />
      <line x1="28" y1="34" x2="52" y2="34" stroke="#94a3b8" strokeWidth="1.2" opacity="0.4" />
      <line x1="28" y1="40" x2="55" y2="40" stroke="#94a3b8" strokeWidth="1.2" opacity="0.35" />
      <line x1="85" y1="28" x2="112" y2="28" stroke="#94a3b8" strokeWidth="1.2" opacity="0.5" />
      <line x1="85" y1="34" x2="110" y2="34" stroke="#94a3b8" strokeWidth="1.2" opacity="0.4" />
      <line x1="85" y1="40" x2="112" y2="40" stroke="#94a3b8" strokeWidth="1.2" opacity="0.35" />
    </svg>
  );
}

function Lamp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 60 90" fill="none" aria-hidden>
      {/* glow */}
      <ellipse cx="42" cy="48" rx="14" ry="10" fill="#bfdbfe" opacity="0.55" />
      {/* arm */}
      <path d="M18 78 Q18 50 36 42" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* base */}
      <ellipse cx="18" cy="80" rx="12" ry="4" fill="#c7d2fe" />
      {/* head */}
      <path d="M28 28 Q48 20 52 40 Q40 48 28 40 Z" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
      <circle cx="44" cy="36" r="3" fill="#93c5fd" opacity="0.5" />
    </svg>
  );
}

function PencilCup({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 50" fill="none" aria-hidden>
      <rect x="8" y="22" width="24" height="24" rx="3" fill="#e0e7ff" stroke="#a5b4fc" strokeWidth="1.2" />
      <rect x="12" y="8" width="4" height="20" rx="1" fill="#93c5fd" />
      <rect x="18" y="4" width="4" height="24" rx="1" fill="#c4b5fd" />
      <rect x="24" y="10" width="4" height="18" rx="1" fill="#60a5fa" />
      <path d="M12 8 L14 4 L16 8" fill="#fbbf24" />
      <path d="M18 4 L20 1 L22 4" fill="#fbbf24" />
    </svg>
  );
}
