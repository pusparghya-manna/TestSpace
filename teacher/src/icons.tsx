import React from 'react';

type P = { className?: string };
const s = { width: '1em', height: '1em', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const IconHome = ({ className }: P) => <svg {...s} className={className}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/></svg>;
export const IconExam = ({ className }: P) => <svg {...s} className={className}><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>;
export const IconResults = ({ className }: P) => <svg {...s} className={className}><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 17V9"/><path d="M12 17V5"/><path d="M16 17v-6"/></svg>;
export const IconSettings = ({ className }: P) => <svg {...s} className={className}><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>;
export const IconPlus = ({ className }: P) => <svg {...s} className={className}><path d="M12 5v14M5 12h14"/></svg>;
export const IconTrash = ({ className }: P) => <svg {...s} className={className}><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>;
export const IconEdit = ({ className }: P) => <svg {...s} className={className}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
export const IconLogout = ({ className }: P) => <svg {...s} className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>;
export const IconLogIn = ({ className }: P) => <svg {...s} className={className}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>;
export const IconLock = ({ className }: P) => <svg {...s} className={className}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg>;
export const IconUserPlus = ({ className }: P) => <svg {...s} className={className}><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></svg>;
export const IconArrowRight = ({ className }: P) => <svg {...s} className={className}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>;
export const IconCheck = ({ className }: P) => <svg {...s} className={className}><path d="M20 6 9 17l-5-5"/></svg>;
export const IconUpload = ({ className }: P) => <svg {...s} className={className}><path d="M12 16V4"/><path d="M8 8l4-4 4 4"/><path d="M4 20h16"/></svg>;
export const IconEye = ({ className }: P) => <svg {...s} className={className}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
export const IconEyeOff = ({ className }: P) => <svg {...s} className={className}><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-3.2 4.3"/><path d="M6.1 6.1C4 7.8 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.4-1"/></svg>;
export const IconBot = ({ className }: P) => <svg {...s} className={className}><rect x="5" y="8" width="14" height="10" rx="2"/><path d="M12 8V5"/><path d="M9 18v2"/><path d="M15 18v2"/><path d="M9 13h.01"/><path d="M15 13h.01"/></svg>;
export const IconRefresh = ({ className }: P) => <svg {...s} className={className}><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>;
export const IconClose = ({ className }: P) => <svg {...s} className={className}><path d="M18 6 6 18M6 6l12 12"/></svg>;
export const IconChevron = ({ className }: P) => <svg {...s} className={className}><path d="M9 18l6-6-6-6"/></svg>;
export const IconChevronDown = ({ className }: P) => <svg {...s} className={className}><path d="M6 9l6 6 6-6"/></svg>;
export const IconUsers = ({ className }: P) => <svg {...s} className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></svg>;
export const IconLive = ({ className }: P) => <svg {...s} className={className}><circle cx="12" cy="12" r="3"/><path d="M5 5a10 10 0 0 1 0 14"/><path d="M19 5a10 10 0 0 0 0 14"/></svg>;
export const IconBell = ({ className }: P) => <svg {...s} className={className}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;

export const IconUser = ({ className }: P) => <svg {...s} className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
export const IconMessage = ({ className }: P) => <svg {...s} className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
export const IconSend = ({ className }: P) => <svg {...s} className={className}><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>;
export const IconHash = ({ className }: P) => <svg {...s} className={className}><path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="M16 3l-2 18"/></svg>;
export const IconStar = ({ className }: P) => <svg {...s} className={className}><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z"/></svg>;
export const IconClock = ({ className }: P) => <svg {...s} className={className}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>;
export const IconTimer = ({ className }: P) => <svg {...s} className={className}><path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/></svg>;
export const IconTrophy = ({ className }: P) => <svg {...s} className={className}><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 5H4a2 2 0 0 0 0 4h3"/><path d="M17 5h3a2 2 0 0 1 0 4h-3"/></svg>;
export const IconSearch = ({ className }: P) => <svg {...s} className={className}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>;
export const IconCalendar = ({ className }: P) => <svg {...s} className={className}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;
export const IconBook = ({ className }: P) => <svg {...s} className={className}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
export const IconCopy = ({ className }: P) => <svg {...s} className={className}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
export const IconDownload = ({ className }: P) => <svg {...s} className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>;
export const IconTag = ({ className }: P) => <svg {...s} className={className}><path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2c0 .5.2 1 .6 1.4l8.8 8.8a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8z"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none"/></svg>;
export const IconZap = ({ className }: P) => <svg {...s} className={className}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
export const IconTarget = ({ className }: P) => <svg {...s} className={className}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
export const IconShare = ({ className }: P) => <svg {...s} className={className}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>;
export const IconInfo = ({ className }: P) => <svg {...s} className={className}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>;
export const IconArrowLeft = ({ className }: P) => <svg {...s} className={className}><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>;
export const IconSparkles = ({ className }: P) => <svg {...s} className={className}><path d="m12 3 1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/></svg>;
export const IconFileText = ({ className }: P) => <svg {...s} className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>;
export const IconChart = ({ className }: P) => <svg {...s} className={className}><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg>;
export const IconAlert = ({ className }: P) => <svg {...s} className={className}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>;
export const IconPercent = ({ className }: P) => <svg {...s} className={className}><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>;
export const IconFilter = ({ className }: P) => <svg {...s} className={className}><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>;
export const IconExternal = ({ className }: P) => <svg {...s} className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>;

export const IconShuffle = ({ className }: P) => <svg {...s} className={className}><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>;
export const IconMinus = ({ className }: P) => <svg {...s} className={className}><path d="M5 12h14"/></svg>;
export const IconBookmark = ({ className }: P) => <svg {...s} className={className}><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;

/** Official multicolored Google "G" logo (matches design mock) */
export const IconGoogle = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);
