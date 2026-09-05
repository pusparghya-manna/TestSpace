const MAX_EDGE = 1600;
const MAX_BYTES = 6_500_000;

function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This photo format is not supported by the browser. Please use JPG or PNG.'));
    };
    image.src = url;
  });
}

/** Prepare a photo for OCR without exceeding the API's base64 request limit. */
export async function prepareImageForOcr(file: File): Promise<{ base64: string; mimeType: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const image = await loadImage(file);
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, MAX_EDGE / Math.max(1, longestEdge));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  if (scale === 1 && file.size <= MAX_BYTES && file.type !== 'image/heic' && file.type !== 'image/heif') {
    return { base64: await readAsBase64(file), mimeType: file.type || 'image/jpeg' };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the image for OCR.');
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  if (!blob) throw new Error('Could not encode the image for OCR.');
  if (blob.size > MAX_BYTES) {
    throw new Error('Photo is still too large after compression. Please crop it or choose a smaller image.');
  }

  return { base64: await readAsBase64(blob), mimeType: 'image/jpeg' };
}
