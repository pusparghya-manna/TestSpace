/**
 * Image storage & crop pipeline for Appwrite.
 * Prefer pure-JS (jimp) because Appwrite blocks sharp install-scripts.
 */

const endpoint = () => (process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1').replace(/\/$/, '');
const project = () => process.env.APPWRITE_PROJECT_ID || process.env.APPWRITE_FUNCTION_PROJECT_ID || '';
const key = () => process.env.APPWRITE_API_KEY || '';
const bucket = () => process.env.APPWRITE_BUCKET_ID || '';

async function storageFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${endpoint()}${path}`, {
    method,
    headers: {
      'X-Appwrite-Project': project(),
      'X-Appwrite-Key': key(),
      ...headers,
    },
    body,
  });
  return res;
}

export function normalizeBBox(bbox, imgWidth, imgHeight) {
  if (!bbox || imgWidth < 1 || imgHeight < 1) return null;
  let { x, y, width, height } = bbox;
  if (![x, y, width, height].every((n) => Number.isFinite(Number(n)))) return null;
  x = Number(x);
  y = Number(y);
  width = Number(width);
  height = Number(height);
  if (width <= 0 || height <= 0) return null;
  const maxV = Math.max(
    Math.abs(x),
    Math.abs(y),
    Math.abs(width),
    Math.abs(height),
    Math.abs(x + width),
    Math.abs(y + height)
  );
  if (maxV <= 1.0001) {
    x *= imgWidth;
    y *= imgHeight;
    width *= imgWidth;
    height *= imgHeight;
  } else if (maxV <= 1000.5) {
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
  if (w > imgWidth * 0.96 && h > imgHeight * 0.85) return null;
  if (w > imgWidth * 0.35 && h < imgHeight * 0.06) return null;
  const pad = 4;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  w = Math.min(imgWidth - left, w + pad * 2);
  h = Math.min(imgHeight - top, h + pad * 2);
  return { left, top, width: w, height: h };
}

export async function uploadBase64ToStorage(fileBase64, mimeType = 'image/jpeg', name = 'upload.jpg') {
  if (!bucket()) throw new Error('APPWRITE_BUCKET_ID not configured');
  const bin = Buffer.from(fileBase64, 'base64');
  if (bin.length < 32) throw new Error('Image too small or invalid');
  if (bin.length > 12_000_000) throw new Error('Image too large');
  const form = new FormData();
  const blob = new Blob([bin], { type: mimeType });
  form.append('fileId', 'unique()');
  form.append('file', blob, name);
  const res = await storageFetch(`/storage/buckets/${bucket()}/files`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Storage upload failed (${res.status})`);
  return {
    fileId: data.$id,
    bucketId: bucket(),
    mimeType,
    size: bin.length,
    name: data.name || name,
  };
}

export async function getStorageFileBuffer(fileId) {
  const res = await storageFetch(`/storage/buckets/${bucket()}/files/${fileId}/download`);
  if (!res.ok) throw new Error(`File not found (${res.status})`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function cropBuffer(pageBuffer, bbox) {
  // 1) jimp (pure JS — no install scripts)
  try {
    const { Jimp } = await import('jimp');
    const image = await Jimp.read(pageBuffer);
    const imgW = image.bitmap.width;
    const imgH = image.bitmap.height;
    const box = normalizeBBox(bbox, imgW, imgH);
    if (!box) return null;
    const cropped = image.crop({ x: box.left, y: box.top, w: box.width, h: box.height });
    const out = await cropped.getBuffer('image/jpeg');
    return { buffer: out, mimeType: 'image/jpeg', width: box.width, height: box.height, engine: 'jimp' };
  } catch (e) {
    console.warn('[media] jimp crop failed', e?.message || e);
  }
  // 2) sharp if available
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(pageBuffer).metadata();
    const box = normalizeBBox(bbox, meta.width || 0, meta.height || 0);
    if (!box) return null;
    const out = await sharp(pageBuffer)
      .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
      .jpeg({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: out.data,
      mimeType: 'image/jpeg',
      width: out.info.width,
      height: out.info.height,
      engine: 'sharp',
    };
  } catch (e) {
    console.warn('[media] sharp crop failed', e?.message || e);
  }
  return null;
}

/**
 * Process OCR questions with diagram bboxes.
 * Returns questions with image.fileId when crop succeeded.
 * Sets cropStatus: 'ok' | 'unavailable' | 'skipped' — never pretends success.
 */
export async function processOcrCrops(pageBase64, questions) {
  const pageBuffer = Buffer.from(pageBase64, 'base64');
  const imageErrors = [];
  const seen = new Set();
  let engine = null;
  for (const q of questions || []) {
    if (!q.has_image || !q.image_bbox) {
      q.has_image = false;
      q.image_bbox = null;
      q.cropStatus = 'skipped';
      continue;
    }
    const key = JSON.stringify(q.image_bbox);
    if (seen.has(key)) {
      imageErrors.push('duplicate diagram bbox — text-only');
      q.has_image = false;
      q.image_bbox = null;
      q.cropStatus = 'skipped';
      continue;
    }
    seen.add(key);
    const cropped = await cropBuffer(pageBuffer, q.image_bbox);
    if (!cropped) {
      q.cropStatus = 'unavailable';
      imageErrors.push('crop unavailable — diagram flag kept without fileId');
      // Do NOT invent a fileId
      continue;
    }
    engine = cropped.engine;
    try {
      const uploaded = await uploadBase64ToStorage(
        cropped.buffer.toString('base64'),
        cropped.mimeType,
        `crop_${Date.now()}.jpg`
      );
      q.image = {
        fileId: uploaded.fileId,
        mimeType: cropped.mimeType,
        width: cropped.width,
        height: cropped.height,
        storage: 'appwrite',
        engine: cropped.engine,
      };
      q.imageFileId = uploaded.fileId;
      q.cropStatus = 'ok';
    } catch (e) {
      q.cropStatus = 'unavailable';
      imageErrors.push(`storage upload failed: ${e?.message || e}`);
    }
  }
  return { questions, imageErrors, cropEngine: engine || null };
}
