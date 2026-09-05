import sharp from 'sharp';

export type ImageBBox = { x: number; y: number; width: number; height: number };

export type CroppedQuestionImage = {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
};

/**
 * Convert OCR bbox → pixel extract box on the source page image.
 *
 * Preferred space (from Gemini prompt): normalized 0–1000 on each axis
 *   pixel = (value / 1000) * imageDimension
 *
 * Also accepts:
 *   - 0–1 fractions
 *   - absolute pixels when values clearly exceed 1000 or match image size
 *
 * The old heuristic treated many real pixel boxes as 0–1000 and scaled them
 * into random regions of the page — that is fixed here.
 */
export function normalizeBBox(
  bbox: ImageBBox,
  imgWidth: number,
  imgHeight: number
): { left: number; top: number; width: number; height: number } | null {
  if (!bbox || imgWidth < 1 || imgHeight < 1) return null;
  let { x, y, width, height } = bbox;
  if (![x, y, width, height].every((n) => Number.isFinite(Number(n)))) return null;
  x = Number(x);
  y = Number(y);
  width = Number(width);
  height = Number(height);
  if (width <= 0 || height <= 0) return null;

  const maxV = Math.max(Math.abs(x), Math.abs(y), Math.abs(width), Math.abs(height), Math.abs(x + width), Math.abs(y + height));

  // 1) Unit fractions 0–1
  if (maxV <= 1.0001) {
    x *= imgWidth;
    y *= imgHeight;
    width *= imgWidth;
    height *= imgHeight;
  }
  // 2) Values above 1000 → absolute pixels on the original bitmap
  else if (maxV > 1000.5) {
    // pixels — no scale
  }
  // 3) Default: normalized 0–1000 (required by OCR prompt)
  else {
    x = (x / 1000) * imgWidth;
    y = (y / 1000) * imgHeight;
    width = (width / 1000) * imgWidth;
    height = (height / 1000) * imgHeight;
  }

  let left = Math.round(x);
  let top = Math.round(y);
  let w = Math.round(width);
  let h = Math.round(height);

  if (w < 12 || h < 12) return null;
  if (left < 0) {
    w += left;
    left = 0;
  }
  if (top < 0) {
    h += top;
    top = 0;
  }
  if (left >= imgWidth || top >= imgHeight) return null;
  if (left + w > imgWidth) w = imgWidth - left;
  if (top + h > imgHeight) h = imgHeight - top;
  if (w < 12 || h < 12) return null;

  // Reject only near-entire-page crops (single question should never be the whole page)
  if (w > imgWidth * 0.96 && h > imgHeight * 0.85) return null;

  // Reject thin horizontal strips (usually option text, not a diagram)
  if (w > imgWidth * 0.35 && h < imgHeight * 0.06) return null;
  if (w > 0 && h / w < 0.12 && w > imgWidth * 0.25) return null;

  // Reject tiny incomplete crops
  if (w < imgWidth * 0.04 || h < imgHeight * 0.03) return null;

  // Small safety padding only (do not enlarge into neighboring diagrams)
  const padX = Math.max(2, Math.round(w * 0.025));
  const padY = Math.max(2, Math.round(h * 0.025));
  left = Math.max(0, left - padX);
  top = Math.max(0, top - padY);
  w = Math.min(imgWidth - left, w + padX * 2);
  h = Math.min(imgHeight - top, h + padY * 2);

  if (w < 16 || h < 16) return null;
  return { left, top, width: w, height: h };
}

export async function cropQuestionImage(
  pageBuffer: Buffer,
  bbox: ImageBBox
): Promise<CroppedQuestionImage | null> {
  try {
    const meta = await sharp(pageBuffer).metadata();
    const imgW = meta.width || 0;
    const imgH = meta.height || 0;
    const box = normalizeBBox(bbox, imgW, imgH);
    if (!box) {
      console.warn('[ocr-image] bbox rejected', { bbox, imgW, imgH });
      return null;
    }
    console.log('[ocr-image] crop', { bbox, imgW, imgH, box });

    const out = await sharp(pageBuffer)
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    if (!out.data?.length) return null;
    return {
      buffer: out.data,
      mimeType: 'image/jpeg',
      width: out.info.width,
      height: out.info.height,
    };
  } catch (e) {
    console.warn('[ocr-image] crop failed:', (e as Error)?.message || e);
    return null;
  }
}

/** Upload cropped image to private Telegram storage channel; returns file_id. */
export async function uploadToTelegramStorage(
  buffer: Buffer,
  mimeType: string,
  filename = 'question.jpg'
): Promise<{ fileId: string; width?: number; height?: number } | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_MEDIA_STORAGE_CHAT_ID || '';
  if (!token) {
    console.warn('[ocr-image] TELEGRAM_BOT_TOKEN missing — cannot store media');
    return null;
  }
  if (!chatId) {
    console.warn('[ocr-image] TELEGRAM_MEDIA_STORAGE_CHAT_ID missing — cannot store media');
    return null;
  }
  if (buffer.length > 9_500_000) {
    console.warn('[ocr-image] crop too large for Telegram');
    return null;
  }

  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('disable_notification', 'true');
    const blob = new Blob([buffer], { type: mimeType || 'image/jpeg' });
    form.append('photo', blob, filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!data?.ok) {
      console.warn('[ocr-image] Telegram upload failed:', data?.description || res.status);
      return null;
    }
    const photos = data.result?.photo || [];
    const best = photos[photos.length - 1];
    const fileId = best?.file_id;
    if (!fileId) return null;
    return {
      fileId: String(fileId),
      width: best?.width,
      height: best?.height,
    };
  } catch (e) {
    console.warn('[ocr-image] upload error:', (e as Error)?.message || e);
    return null;
  }
}

/**
 * Process OCR questions: crop has_image bboxes from the page and attach image.fileId.
 * Failures on individual questions are recorded; text import continues.
 */
export async function attachCroppedImagesToOcrQuestions(
  pageBase64: string,
  mimeType: string,
  questions: any[]
): Promise<{ questions: any[]; imageErrors: string[] }> {
  const imageErrors: string[] = [];
  if (!Array.isArray(questions) || questions.length === 0) {
    return { questions: questions || [], imageErrors };
  }

  let pageBuffer: Buffer;
  try {
    pageBuffer = Buffer.from(pageBase64, 'base64');
  } catch {
    return {
      questions,
      imageErrors: ['Invalid page image data — skipped all image crops'],
    };
  }

  const usedBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  const isDuplicateBox = (bbox: any): boolean => {
    const x = Number(bbox?.x);
    const y = Number(bbox?.y);
    const w = Number(bbox?.width);
    const h = Number(bbox?.height);
    if (![x, y, w, h].every(Number.isFinite)) return false;
    return usedBoxes.some(
      (b) =>
        Math.abs(b.x - x) < 25 &&
        Math.abs(b.y - y) < 25 &&
        Math.abs(b.w - w) < 25 &&
        Math.abs(b.h - h) < 25
    );
  };

  // Prepare slots; process image questions with limited concurrency
  const out: any[] = questions.map((q) => ({ ...q }));
  const jobs: Array<{ i: number; label: string }> = [];
  for (let i = 0; i < out.length; i++) {
    const q = out[i];
    const label = q.question_number != null ? `Q${q.question_number}` : `item ${i + 1}`;
    if (!q.has_image || !q.image_bbox) {
      q.has_image = false;
      q.image_bbox = null;
      continue;
    }
    if (isDuplicateBox(q.image_bbox)) {
      imageErrors.push(`${label}: duplicate diagram bbox — imported as text-only`);
      q.has_image = false;
      q.image_bbox = null;
      continue;
    }
    usedBoxes.push({
      x: Number(q.image_bbox.x),
      y: Number(q.image_bbox.y),
      w: Number(q.image_bbox.width),
      h: Number(q.image_bbox.height),
    });
    jobs.push({ i, label });
  }

  const concurrency = 4;
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      if (!job) break;
      const q = out[job.i];
      try {
        const cropped = await cropQuestionImage(pageBuffer, q.image_bbox);
        if (!cropped) {
          imageErrors.push(`${job.label}: invalid/empty crop — imported as text-only`);
          q.has_image = false;
          q.image_bbox = null;
          continue;
        }
        const uploaded = await uploadToTelegramStorage(
          cropped.buffer,
          cropped.mimeType,
          `ocr_${job.i}.jpg`
        );
        if (!uploaded?.fileId) {
          imageErrors.push(`${job.label}: Telegram media upload failed — imported as text-only`);
          q.has_image = false;
          q.image_bbox = null;
          continue;
        }
        q.image = {
          fileId: uploaded.fileId,
          mimeType: cropped.mimeType,
          width: uploaded.width || cropped.width,
          height: uploaded.height || cropped.height,
        };
      } catch (e: any) {
        imageErrors.push(`${job.label}: ${e?.message || 'crop/upload failed'}`);
        q.has_image = false;
        q.image_bbox = null;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, jobs.length)) }, () => worker()));

  return { questions: out, imageErrors };
}
