import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BBox } from '../lib/bboxCrop';
import { expandBBoxNorm1000 } from '../lib/bboxCrop';
import { btnP, btnS } from '../styles/ui';

type Props = {
  pageDataUrl: string;
  initialBBox: BBox;
  onApply: (bbox: BBox) => void;
  onClose: () => void;
};

/** Interactive crop editor: drag/resize box on page, optional pencil erase (white-out). */
export function DiagramCropEditor({ pageDataUrl, initialBBox, onApply, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<'move' | 'draw'>('move');
  const [bbox, setBBox] = useState(initialBBox);
  const drag = useRef<{
    kind: 'move' | 'resize' | 'draw' | null;
    startX: number;
    startY: number;
    orig: BBox;
  }>({ kind: null, startX: 0, startY: 0, orig: initialBBox });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const maxW = Math.min(360, window.innerWidth - 48);
    const scale = maxW / img.naturalWidth;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);
    // dim outside box
    const bx = (bbox.x / 1000) * w;
    const by = (bbox.y / 1000) * h;
    const bw = (bbox.width / 1000) * w;
    const bh = (bbox.height / 1000) * h;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.clearRect(bx, by, bw, bh);
    ctx.drawImage(img, (bbox.x / 1000) * img.naturalWidth, (bbox.y / 1000) * img.naturalHeight,
      (bbox.width / 1000) * img.naturalWidth, (bbox.height / 1000) * img.naturalHeight,
      bx, by, bw, bh);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    // handles
    const hs = 8;
    const corners = [
      [bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh],
    ];
    ctx.fillStyle = '#3b82f6';
    for (const [hx, hy] of corners) {
      ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    }
  }, [bbox]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      redraw();
    };
    img.src = pageDataUrl;
  }, [pageDataUrl, redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const toNorm = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 1000;
    const y = ((clientY - rect.top) / rect.height) * 1000;
    return { x: Math.max(0, Math.min(1000, x)), y: Math.max(0, Math.min(1000, y)) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = toNorm(e.clientX, e.clientY);
    if (mode === 'draw') {
      drag.current = { kind: 'draw', startX: p.x, startY: p.y, orig: bbox };
      return;
    }
    // near bottom-right = resize
    const brx = bbox.x + bbox.width;
    const bry = bbox.y + bbox.height;
    if (Math.abs(p.x - brx) < 40 && Math.abs(p.y - bry) < 40) {
      drag.current = { kind: 'resize', startX: p.x, startY: p.y, orig: { ...bbox } };
    } else {
      drag.current = { kind: 'move', startX: p.x, startY: p.y, orig: { ...bbox } };
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.kind) return;
    const p = toNorm(e.clientX, e.clientY);
    const d = drag.current;
    if (d.kind === 'move') {
      let nx = d.orig.x + (p.x - d.startX);
      let ny = d.orig.y + (p.y - d.startY);
      nx = Math.max(0, Math.min(1000 - d.orig.width, nx));
      ny = Math.max(0, Math.min(1000 - d.orig.height, ny));
      setBBox({ ...d.orig, x: nx, y: ny });
    } else if (d.kind === 'resize') {
      let nw = Math.max(30, d.orig.width + (p.x - d.startX));
      let nh = Math.max(30, d.orig.height + (p.y - d.startY));
      if (d.orig.x + nw > 1000) nw = 1000 - d.orig.x;
      if (d.orig.y + nh > 1000) nh = 1000 - d.orig.y;
      setBBox({ ...d.orig, width: nw, height: nh });
    } else if (d.kind === 'draw') {
      const x1 = Math.min(d.startX, p.x);
      const y1 = Math.min(d.startY, p.y);
      const x2 = Math.max(d.startX, p.x);
      const y2 = Math.max(d.startY, p.y);
      setBBox({
        x: x1,
        y: y1,
        width: Math.max(30, x2 - x1),
        height: Math.max(30, y2 - y1),
      });
    }
  };

  const onPointerUp = () => {
    drag.current.kind = null;
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-3">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">Edit diagram area</span>
          <button type="button" className="text-slate-400 text-xs" onClick={onClose}>Close</button>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className={(mode === 'move' ? btnP : btnS) + ' !py-1 text-[11px] flex-1'} onClick={() => setMode('move')}>Move / resize</button>
          <button type="button" className={(mode === 'draw' ? btnP : btnS) + ' !py-1 text-[11px] flex-1'} onClick={() => setMode('draw')}>Draw box</button>
        </div>
        <p className="text-[10px] text-slate-500">
          {mode === 'move' ? 'Drag the blue box to move. Drag the bottom-right corner to resize.' : 'Drag on the image to draw a new crop box.'}
        </p>
        <canvas
          ref={canvasRef}
          className="w-full rounded-lg border border-slate-200 touch-none cursor-crosshair bg-slate-100"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="flex gap-1.5">
          <button type="button" className={btnS + ' !py-1.5 text-[11px] flex-1'} onClick={() => setBBox(expandBBoxNorm1000(bbox, 1.1))}>+ Expand</button>
          <button type="button" className={btnS + ' !py-1.5 text-[11px] flex-1'} onClick={() => setBBox(expandBBoxNorm1000(bbox, 0.9))}>− Shrink</button>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" className={btnS + ' flex-1'} onClick={onClose}>Cancel</button>
          <button type="button" className={btnP + ' flex-1'} onClick={() => onApply(bbox)}>Apply crop</button>
        </div>
      </div>
    </div>
  );
}
