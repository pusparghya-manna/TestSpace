import { GoogleGenAI, Type } from '@google/genai';

export function normalizeOcrAnswer(value: unknown, optionCount = 4): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= 0 && value < optionCount ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (numeric === 0) return 0;
    if (numeric >= 1 && numeric <= optionCount) return numeric - 1;
    return null;
  }

  const numberMatch = raw.match(/(?:OPTION|CHOICE|ANSWER)?\s*[:#-]?\s*([1-9]\d*)\b/i);
  if (numberMatch) {
    const numeric = Number(numberMatch[1]);
    return numeric >= 1 && numeric <= optionCount ? numeric - 1 : null;
  }

  const letterMatch = raw.match(/(?:OPTION|CHOICE|ANSWER)?\s*[:#-]?\s*([A-Z])\b/i);
  if (!letterMatch) return null;
  const index = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
  return index >= 0 && index < optionCount ? index : null;
}

export function normalizeOcrQuestion(raw: any): any {
  const options = Array.isArray(raw?.options)
    ? raw.options.map((option: unknown) =>
        typeof option === 'string' ? option : option && typeof option === 'object' && 'text' in option
          ? String((option as any).text ?? '')
          : String(option ?? '')
      ).slice(0, 4)
    : [];
  const answerValue = raw?.answer ?? raw?.correctAnswer ?? raw?.correct_option ?? raw?.correctOption;
  const normalized: any = {
    ...raw,
    question: String(raw?.question ?? raw?.text ?? '').trim(),
    options,
    answer: normalizeOcrAnswer(answerValue, options.length || 4),
    marks: Number.isFinite(Number(raw?.marks)) && Number(raw.marks) > 0 ? Number(raw.marks) : 1,
    negativeMarks: Number.isFinite(Number(raw?.negativeMarks)) && Number(raw.negativeMarks) >= 0 ? Number(raw.negativeMarks) : 0,
    explanation: raw?.explanation == null ? null : String(raw.explanation),
    subject: raw?.subject == null ? null : String(raw.subject),
  };
  return normalized;
}

export async function parseQuestionsFromMedia(fileBase64: string, mimeType: string): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'QuizBotByTestSpace',
      },
      timeout: 180_000,
    },
  });

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

  const modelCandidates = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
  ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i) as string[];

  const imagePart = {
    inlineData: {
      mimeType: mimeType || 'image/jpeg',
      data: fileBase64,
    },
  };

  let response: any = null;
  let lastErr: any = null;
  for (const model of modelCandidates) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: {
          parts: [imagePart, { text: promptText }],
        },
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
                    question_number: { type: Type.NUMBER },
                    question: { type: Type.STRING, description: 'Preserved question text' },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'List of option choices in order A,B,C,D...',
                    },
                    answer: {
                      type: Type.INTEGER,
                      nullable: true,
                      description:
                        '0-based index of the correct option; return null only when unreadable or genuinely ambiguous',
                    },
                    marks: { type: Type.NUMBER },
                    negativeMarks: { type: Type.NUMBER },
                    explanation: { type: Type.STRING, nullable: true },
                    subject: { type: Type.STRING, nullable: true },
                    has_image: {
                      type: Type.BOOLEAN,
                      description:
                        'True only if this question has a real visual (diagram/photo/graph/chart/map/figure). False for text-only questions.',
                    },
                    image_bbox: {
                      type: Type.OBJECT,
                      nullable: true,
                      description:
                        'Pixel bbox of ONLY the diagram/photo on the original image (not question text, not options, not question number). null when has_image is false.',
                      properties: {
                        x: {
                          type: Type.NUMBER,
                          description: 'Left edge on 0–1000 scale (0=left of original page)',
                        },
                        y: {
                          type: Type.NUMBER,
                          description: 'Top edge on 0–1000 scale (0=top of original page)',
                        },
                        width: {
                          type: Type.NUMBER,
                          description: 'Width on 0–1000 scale (diagram only, not full question)',
                        },
                        height: {
                          type: Type.NUMBER,
                          description: 'Height on 0–1000 scale (diagram only, not full question)',
                        },
                      },
                      required: ['x', 'y', 'width', 'height'],
                    },
                  },
                  required: ['question', 'options', 'has_image'],
                },
              },
            },
            required: ['questions'],
          },
        },
      });
      console.log('[ocr] Gemini model used:', model);
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e || '');
      const busy =
        /high demand|UNAVAILABLE|503|429|resource exhausted|quota|timed out|timeout|unavailable/i.test(
          msg
        );
      console.warn('[ocr] model failed:', model, msg.slice(0, 180));
      if (!busy) {
        // Non-retryable (bad key, invalid arg) — stop early
        break;
      }
    }
  }
  if (!response) {
    const detail = String(lastErr?.message || lastErr || 'unknown error');
    if (/high demand|UNAVAILABLE|503/i.test(detail)) {
      throw new Error(
        'Gemini is busy (high demand). Please try Photo OCR again in a minute. If this keeps happening, the model may be overloaded.'
      );
    }
    throw new Error(detail || 'Gemini OCR failed');
  }

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from Gemini OCR');
  }
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return { questions: parsed.map(normalizeOcrQuestion) };
  return {
    ...parsed,
    questions: Array.isArray(parsed?.questions) ? parsed.questions.map(normalizeOcrQuestion) : [],
  };
}


function ocrModelCandidates(): string[] {
  return [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
  ].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i) as string[];
}

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'QuizBotByTestSpace' },
      timeout: 180_000,
    },
  });
}

export type DiagramBBoxResult = {
  question_index: number;
  question_number: number | null;
  image_bbox: { x: number; y: number; width: number; height: number } | null;
};

/**
 * Second-pass: locate correct diagram bboxes for questions marked has_image.
 * Does not extract text. Uses full-page image + question list for disambiguation.
 */
export async function locateDiagramBboxes(
  fileBase64: string,
  mimeType: string,
  diagramQuestions: Array<{
    index: number;
    question_number?: number | null;
    question?: string;
    options?: string[];
  }>
): Promise<DiagramBBoxResult[]> {
  if (!diagramQuestions.length) return [];

  const ai = createGeminiClient();
  const imagePart = {
    inlineData: {
      mimeType: mimeType || 'image/jpeg',
      data: fileBase64,
    },
  };

  const catalog = diagramQuestions
    .map((q) => {
      const num = q.question_number != null ? `Q${q.question_number}` : `index ${q.index}`;
      const stem = String(q.question || '').slice(0, 160).replace(/\s+/g, ' ');
      const opts = (q.options || [])
        .slice(0, 4)
        .map((o, i) => `${String.fromCharCode(65 + i)}:${String(o || '').slice(0, 40)}`)
        .join(' | ');
      return `- ${num} (question_index=${q.index}): "${stem}" Options: ${opts}`;
    })
    .join('\n');

  const prompt = `You are a precise diagram localizer for exam papers.

TASK: For EACH listed question below, find the diagram/figure on the FULL PAGE image that belongs to that question and return its bounding box.

QUESTIONS THAT NEED DIAGRAMS:
${catalog}

RULES:
1. Analyze the complete page layout. Diagrams for adjacent questions must not be mixed up.
2. image_bbox must cover the COMPLETE visual for that question: drawing, labels (A/B/C/X/Y…), arrows, lines, markers, and connected parts needed to understand it.
3. Do NOT include the question stem text, option list (a)(b)(c)(d), or other questions' diagrams.
4. On many papers the figure is to the RIGHT of the options — box the figure, not the text.
5. Each question_index must get its own unique box when figures are different.
6. If a question has no clear diagram on the page, set image_bbox to null for that entry.
7. COORDINATES: normalized 0–1000 on the FULL page (x=0,y=0 top-left; x=1000 right; y=1000 bottom). Never raw pixels of another resolution.
8. Do not generate, redraw, or describe the image — only return bboxes.

Return JSON only.`;

  const modelCandidates = ocrModelCandidates();
  let response: any = null;
  let lastErr: any = null;

  for (const model of modelCandidates) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              diagrams: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question_index: { type: Type.INTEGER },
                    question_number: { type: Type.NUMBER, nullable: true },
                    image_bbox: {
                      type: Type.OBJECT,
                      nullable: true,
                      properties: {
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        width: { type: Type.NUMBER },
                        height: { type: Type.NUMBER },
                      },
                      required: ['x', 'y', 'width', 'height'],
                    },
                  },
                  required: ['question_index'],
                },
              },
            },
            required: ['diagrams'],
          },
        },
      });
      console.log('[ocr] diagram localization model:', model);
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e || '');
      console.warn('[ocr] diagram locate failed:', model, msg.slice(0, 180));
      if (!/high demand|UNAVAILABLE|503|429|resource exhausted|quota|timed out|timeout|unavailable/i.test(msg)) {
        break;
      }
    }
  }

  if (!response) {
    throw new Error(
      String(lastErr?.message || lastErr || 'Diagram localization failed')
    );
  }

  const text = response.text;
  if (!text) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const rows = Array.isArray(parsed?.diagrams) ? parsed.diagrams : Array.isArray(parsed) ? parsed : [];
  return rows.map((r: any) => ({
    question_index: Number(r.question_index),
    question_number: r.question_number != null ? Number(r.question_number) : null,
    image_bbox:
      r.image_bbox &&
      Number.isFinite(Number(r.image_bbox.x)) &&
      Number.isFinite(Number(r.image_bbox.y)) &&
      Number.isFinite(Number(r.image_bbox.width)) &&
      Number.isFinite(Number(r.image_bbox.height))
        ? {
            x: Number(r.image_bbox.x),
            y: Number(r.image_bbox.y),
            width: Number(r.image_bbox.width),
            height: Number(r.image_bbox.height),
          }
        : null,
  }));
}


export type QuestionLayoutItem = {
  question_number: number | null;
  type: 'image' | 'text';
  /** Normalized 0–1000 absolute box on full page */
  bbox: { x1: number; y1: number; x2: number; y2: number };
};

/**
 * Layout-only pass: detect each question block + classify image vs text.
 * AI returns coordinates only — backend crops with Sharp.
 */
export async function analyzePageLayout(
  fileBase64: string,
  mimeType: string
): Promise<QuestionLayoutItem[]> {
  const ai = createGeminiClient();
  const imagePart = {
    inlineData: {
      mimeType: mimeType || 'image/jpeg',
      data: fileBase64,
    },
  };

  const prompt = `Analyze this full examination page image.

For EVERY distinct multiple-choice question on the page, return:
1. question_number — printed number if visible, else null
2. type — "image" if the question has a diagram/figure/drawing needed to answer it; otherwise "text"
3. bbox — the exact bounding box of the COMPLETE question block as {x1,y1,x2,y2}

bbox rules (normalized 0–1000 on the FULL page):
- (x1,y1) = top-left of this question block
- (x2,y2) = bottom-right of this question block
- Include: question number, stem text, ALL options (a/b/c/d), and any diagram/labels that belong to THIS question
- Do NOT include neighboring questions
- Boxes must not significantly overlap other questions
- x1 < x2, y1 < y2, all values between 0 and 1000

Order questions top-to-bottom (then left-to-right if two columns).

Do NOT extract option text here. Do NOT generate or crop images. Coordinates only.`;

  const modelCandidates = ocrModelCandidates();
  let response: any = null;
  let lastErr: any = null;

  for (const model of modelCandidates) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, { text: prompt }] },
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
                    question_number: { type: Type.NUMBER, nullable: true },
                    type: { type: Type.STRING, description: 'image or text' },
                    bbox: {
                      type: Type.OBJECT,
                      properties: {
                        x1: { type: Type.NUMBER },
                        y1: { type: Type.NUMBER },
                        x2: { type: Type.NUMBER },
                        y2: { type: Type.NUMBER },
                      },
                      required: ['x1', 'y1', 'x2', 'y2'],
                    },
                  },
                  required: ['type', 'bbox'],
                },
              },
            },
            required: ['questions'],
          },
        },
      });
      console.log('[ocr] layout analysis model:', model);
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e || '');
      console.warn('[ocr] layout analysis failed:', model, msg.slice(0, 180));
      if (!/high demand|UNAVAILABLE|503|429|resource exhausted|quota|timed out|timeout|unavailable/i.test(msg)) {
        break;
      }
    }
  }

  if (!response) {
    throw new Error(String(lastErr?.message || lastErr || 'Layout analysis failed'));
  }

  const text = response.text;
  if (!text) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const rows = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const out: QuestionLayoutItem[] = [];
  for (const r of rows) {
    const b = r?.bbox;
    if (!b) continue;
    let x1 = Number(b.x1);
    let y1 = Number(b.y1);
    let x2 = Number(b.x2);
    let y2 = Number(b.y2);
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
    // normalize order
    if (x2 < x1) [x1, x2] = [x2, x1];
    if (y2 < y1) [y1, y2] = [y2, y1];
    x1 = Math.max(0, Math.min(1000, x1));
    y1 = Math.max(0, Math.min(1000, y1));
    x2 = Math.max(0, Math.min(1000, x2));
    y2 = Math.max(0, Math.min(1000, y2));
    if (x2 - x1 < 5 || y2 - y1 < 5) continue;
    const typ = String(r.type || '').toLowerCase() === 'image' ? 'image' : 'text';
    out.push({
      question_number: r.question_number != null && Number.isFinite(Number(r.question_number))
        ? Number(r.question_number)
        : null,
      type: typ,
      bbox: { x1, y1, x2, y2 },
    });
  }
  return out;
}

/** Convert x1,y1,x2,y2 (0–1000) → {x,y,width,height} for Sharp normalizeBBox */
export function bboxXYXYToXYWH(b: { x1: number; y1: number; x2: number; y2: number }) {
  return {
    x: b.x1,
    y: b.y1,
    width: Math.max(1, b.x2 - b.x1),
    height: Math.max(1, b.y2 - b.y1),
  };
}
