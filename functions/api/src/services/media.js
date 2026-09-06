/**
 * Image storage & crop pipeline for Appwrite.
 * Prefer Appwrite Storage; optional sharp for crops when available.
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
  const maxV = Math.max(Math.abs(x), Math.abs(y), Math.abs(width), Math.abs(height), Math.abs(x + width), Math.abs(y + height));
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
  // padding
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

export async function cropWithSharp(pageBuffer, bbox) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return null;
  }
  try {
    const meta = await sharp(pageBuffer).metadata();
    const imgW = meta.width || 0;
    const imgH = meta.height || 0;
    const box = normalizeBBox(bbox, imgW, imgH);
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
    };
  } catch (e) {
    console.warn('[media] crop failed', e?.message || e);
    return null;
  }
}

export async function processOcrCrops(pageBase64, questions) {
  const pageBuffer = Buffer.from(pageBase64, 'base64');
  const imageErrors = [];
  const seen = new Set();
  for (const q of questions || []) {
    if (!q.has_image || !q.image_bbox) {
      q.has_image = false;
      q.image_bbox = null;
      continue;
    }
    const key = JSON.stringify(q.image_bbox);
    if (seen.has(key)) {
      imageErrors.push('duplicate diagram bbox — text-only');
      q.has_image = false;
      q.image_bbox = null;
      continue;
    }
    seen.add(key);
    const cropped = await cropWithSharp(pageBuffer, q.image_bbox);
    if (!cropped) {
      // fallback: attach full page reference later if pageFileId provided
      q.image = q.image || null;
      imageErrors.push('crop unavailable — diagram flag kept without crop');
      continue;
    }
    const uploaded = await uploadBase64ToStorage(cropped.buffer.toString('base64'), cropped.mimeType, `crop_${Date.now()}.jpg`);
    q.image = {
      fileId: uploaded.fileId,
      mimeType: cropped.mimeType,
      width: cropped.width,
      height: cropped.height,
      storage: 'appwrite',
    };
    q.imageFileId = uploaded.fileId;
  }
  return { questions, imageErrors };
}
