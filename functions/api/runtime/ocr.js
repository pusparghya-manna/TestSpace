import { GoogleGenAI, Type } from '@google/genai';

function normalizeOcrAnswer(value, optionCount = 4) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n >= 0 && n < optionCount ? n : null;
  }
  const s = String(value).trim().toUpperCase();
  const letterMap = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
  if (s in letterMap) return letterMap[s] < optionCount ? letterMap[s] : null;
  const asNum = Number(s);
  if (Number.isFinite(asNum)) {
    const n = Math.trunc(asNum);
    if (n >= 1 && n <= optionCount) return n - 1;
    if (n >= 0 && n < optionCount) return n;
  }
  return null;
}

function normalizeOcrQuestion(raw) {
  const options = Array.isArray(raw?.options)
    ? raw.options.map((o) => String(o ?? '').trim()).filter(Boolean).slice(0, 8)
    : [];
  return {
    question: String(raw?.question || '').trim(),
    options,
    answer: normalizeOcrAnswer(raw?.answer, options.length || 4),
    marks: Number(raw?.marks ?? 1) || 1,
    negativeMarks: Number(raw?.negativeMarks ?? 0) || 0,
    explanation: raw?.explanation ? String(raw.explanation) : undefined,
    subject: raw?.subject ? String(raw.subject) : undefined,
    has_image: !!raw?.has_image,
    image_bbox: raw?.image_bbox || null,
  };
}

export async function parseQuestionsFromMedia(fileBase64, mimeType) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured');

  const ai = new GoogleGenAI({ apiKey: geminiKey, httpOptions: { timeout: 180_000 } });
  const modelCandidates = [
    process.env.GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-3.7-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);

  const promptText = `Extract all multiple choice examination questions from this question paper document/image into structured JSON.

CRITICAL RULES:
1. Preserve the exact original question text cleanly.
2. Preserve the exact original option text and order. Always extract options into an array of strings.
3. "answer" must be a 0-based integer index corresponding to the correct option:
   - 0 = Option A / First option
   - 1 = Option B / Second option
   - 2 = Option C / Third option
   - 3 = Option D / Fourth option
   - If the paper includes an answer key or marked answer, convert it to the matching index.
   - If no key is printed, solve the question from the visible text when the answer is clear and academically unambiguous.
4. Default "marks" to 1 unless explicitly specified otherwise.
5. Default "negativeMarks" to 0 unless explicitly specified otherwise.
6. Extract EVERY single question accurately without skipping.
7. Don't include question numbers from the given image. 

IMAGE / DIAGRAM DETECTION (per question — be careful):
For every question, decide if it has a REAL drawn visual (diagram, figure, graph, chart, map, biological drawing, chemical structure, pedigree, Venn circles, labeled organ drawing).

has_image / image_bbox rules:
- NO visual → "has_image": false, "image_bbox": null.
- HAS visual → "has_image": true AND a precise "image_bbox" for THAT question only.

has_image only (bbox is optional and NOT used for final cropping):
- Set has_image true when the question has a real diagram/figure.
- You may omit image_bbox or set it null — a separate localization pass will crop diagrams.
- Prefer correct has_image flags over imperfect boxes.`;

  let response = null;
  let lastErr = null;
  for (const model of modelCandidates) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: promptText }, { inlineData: { mimeType: mimeType || 'image/jpeg', data: fileBase64 } }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    answer: { type: Type.INTEGER },
                    marks: { type: Type.NUMBER },
                    negativeMarks: { type: Type.NUMBER },
                    has_image: { type: Type.BOOLEAN },
                  },
                  required: ['question', 'options', 'has_image'],
                },
              },
            },
            required: ['questions'],
          },
        },
      });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (!/high demand|UNAVAILABLE|503|429|quota|timeout/i.test(msg)) break;
    }
  }
  if (!response) throw new Error(String(lastErr?.message || lastErr || 'Gemini OCR failed'));
  const text = response.text;
  if (!text) throw new Error('Empty OCR response');
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return { questions: parsed.map(normalizeOcrQuestion) };
  return { questions: Array.isArray(parsed?.questions) ? parsed.questions.map(normalizeOcrQuestion) : [] };
}
