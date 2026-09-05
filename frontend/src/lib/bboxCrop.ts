/** Client-side crop of a page image using OCR bbox (0–1000, 0–1, or pixels). */

export type BBox = { x: number; y: number; width: number; height: number };

export function normalizeBBoxToPixels(
  bbox: BBox,
  imgW: number,
  imgH: number
): { left: number; top: number; width: number; height: number } | null {
  if (!bbox || imgW < 1 || imgH < 1) return null;
  let { x, y, width, height } = bbox;
  if (![x, y, width, height].every((n) => Number.isFinite(Number(n)))) return null;
  x = Number(x);
  y = Number(y);
  width = Number(width);
  height = Number(height);
  if (width <= 0 || height <= 0) return null;

  const maxV = Math.max(Math.abs(x), Math.abs(y), Math.abs(width), Math.abs(height), Math.abs(x + width), Math.abs(y + height));
  if (maxV <= 1.0001) {
    x *= imgW;
    y *= imgH;
    width *= imgW;
    height *= imgH;
  } else if (maxV <= 1000.5) {
    x = (x / 1000) * imgW;
    y = (y / 1000) * imgH;
    width = (width / 1000) * imgW;
    height = (height / 1000) * imgH;
  }

  let left = Math.round(x);
  let top = Math.round(y);
  let w = Math.round(width);
  let h = Math.round(height);
  if (left < 0) {
    w += left;
    left = 0;
  }
  if (top < 0) {
    h += top;
    top = 0;
  }
  if (left >= imgW || top >= imgH) return null;
  if (left + w > imgW) w = imgW - left;
  if (top + h > imgH) h = imgH - top;
  if (w < 4 || h < 4) return null;
  return { left, top, width: w, height: h };
}

/** Expand bbox by factor (e.g. 1.1 = +10%) centered, clamped in 0–1000 space. */
export function expandBBoxNorm1000(bbox: BBox, factor: number): BBox {
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  let w = bbox.width * factor;
  let h = bbox.height * factor;
  w = Math.min(1000, Math.max(20, w));
  h = Math.min(1000, Math.max(20, h));
  let x = cx - w / 2;
  let y = cy - h / 2;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > 1000) x = 1000 - w;
  if (y + h > 1000) y = 1000 - h;
  return { x, y, width: w, height: h };
}

export function cropPageToDataUrl(
  pageImage: HTMLImageElement,
  bbox: BBox,
  mime = 'image/jpeg',
  quality = 0.88
): string | null {
  const box = normalizeBBoxToPixels(bbox, pageImage.naturalWidth, pageImage.naturalHeight);
  if (!box) return null;
  const canvas = document.createElement('canvas');
  canvas.width = box.width;
  canvas.height = box.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(
    pageImage,
    box.left,
    box.top,
    box.width,
    box.height,
    0,
    0,
    box.width,
    box.height
  );
  return canvas.toDataURL(mime, quality);
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load page image'));
    img.src = dataUrl;
  });
}

export async function cropBBoxFromDataUrl(pageDataUrl: string, bbox: BBox): Promise<string | null> {
  const img = await loadImageFromDataUrl(pageDataUrl);
  return cropPageToDataUrl(img, bbox);
}
