import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, X, Info } from 'lucide-react';

interface DiagramRendererProps {
  type?: 'prism' | 'circuit' | 'cell' | 'molecule' | 'parabola' | 'lens';
  title?: string;
  isExpandedModal?: boolean;
  onCloseModal?: () => void;
}

export const DiagramRenderer: React.FC<DiagramRendererProps> = ({
  type = 'prism',
  title = 'Optical Prism Refraction Diagram',
  isExpandedModal = false,
  onCloseModal
}) => {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(prev => Math.min(2.2, prev + 0.25));
  const handleZoomOut = () => setZoom(prev => Math.max(0.75, prev - 0.25));
  const handleReset = () => setZoom(1);

  const renderSVG = () => {
    switch (type) {
      case 'prism':
      default:
        return (
          <svg
            viewBox="0 0 440 240"
            className="w-full h-full select-none transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
            aria-label="Triangular glass prism ray diagram"
          >
            {/* Background subtle grid */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeOpacity="0.04" strokeWidth="1" />
              </pattern>
              <linearGradient id="prismFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.22" />
              </linearGradient>
              <marker id="arrowRed" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" fill="#ef4444" />
              </marker>
              <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" fill="#2563eb" />
              </marker>
              <marker id="arrowGreen" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" fill="#10b981" />
              </marker>
            </defs>

            <rect width="440" height="240" fill="url(#grid)" />

            {/* Base line */}
            <line x1="40" y1="195" x2="400" y2="195" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" />

            {/* Glass Prism ABC */}
            <polygon
              points="100,195 220,45 340,195"
              fill="url(#prismFill)"
              stroke="#2563eb"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />

            {/* Prism Vertex Labels */}
            <text x="220" y="34" fill="currentColor" textAnchor="middle" className="font-bold text-sm" fillOpacity="0.85">A (Apex / P)</text>
            <text x="88" y="210" fill="currentColor" textAnchor="middle" className="font-bold text-xs" fillOpacity="0.7">B</text>
            <text x="352" y="210" fill="currentColor" textAnchor="middle" className="font-bold text-xs" fillOpacity="0.7">C</text>

            {/* Surface 1 Normal line (Dotted) */}
            <line x1="105" y1="92" x2="195" y2="165" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="96" y="85" fill="#64748b" className="text-[10px] font-mono">N₁</text>

            {/* Surface 2 Normal line (Dotted) */}
            <line x1="335" y1="92" x2="245" y2="165" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="344" y="85" fill="#64748b" className="text-[10px] font-mono">N₂</text>

            {/* Incident Light Ray (Red) */}
            <line
              x1="45"
              y1="165"
              x2="150"
              y2="128"
              stroke="#ef4444"
              strokeWidth="2.5"
              markerEnd="url(#arrowRed)"
            />
            <text x="65" y="145" fill="#ef4444" className="text-[11px] font-bold">Incident Ray</text>

            {/* Refracted Light Ray inside prism (Blue) */}
            <line
              x1="150"
              y1="128"
              x2="290"
              y2="128"
              stroke="#2563eb"
              strokeWidth="2.5"
              markerEnd="url(#arrowBlue)"
            />
            <text x="220" y="120" fill="#2563eb" textAnchor="middle" className="text-[10px] font-semibold">Refracted Ray</text>

            {/* Emergent Light Ray outside prism (Green) */}
            <line
              x1="290"
              y1="128"
              x2="395"
              y2="165"
              stroke="#10b981"
              strokeWidth="2.5"
              markerEnd="url(#arrowGreen)"
            />
            <text x="365" y="145" fill="#10b981" className="text-[11px] font-bold">Emergent Ray</text>

            {/* Media tags */}
            <rect x="48" y="55" width="60" height="20" rx="4" fill="#e2e8f0" fillOpacity="0.8" />
            <text x="78" y="69" fill="#334155" textAnchor="middle" className="text-[10px] font-medium">Air (n₁=1)</text>

            <rect x="190" y="160" width="60" height="20" rx="4" fill="#dbeafe" fillOpacity="0.9" />
            <text x="220" y="174" fill="#1e40af" textAnchor="middle" className="text-[10px] font-semibold">Glass (n₂&gt;1)</text>
          </svg>
        );
    }
  };

  if (isExpandedModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600"></span>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base">
                {title}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleZoomOut}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={onCloseModal}
                className="p-1.5 ml-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 bg-slate-50/60 dark:bg-slate-950/40 flex items-center justify-center min-h-[300px] overflow-hidden">
            {renderSVG()}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              Optical Ray Analysis: Normal N₁ and N₂ drawn perpendicular to prism faces.
            </span>
            <span className="font-mono">{Math.round(zoom * 100)}% zoom</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50/80 dark:bg-slate-900/40 my-3.5">
      {/* Header controls bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          Reference Diagram (Zoomable)
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-400 px-1">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title="Reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {onCloseModal ? (
            <button
              type="button"
              onClick={onCloseModal}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              title="Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* SVG Canvas stage */}
      <div className="h-52 md:h-60 flex items-center justify-center p-2 overflow-hidden bg-slate-50 dark:bg-slate-950/50">
        {renderSVG()}
      </div>
    </div>
  );
};
