import Tesseract from 'tesseract.js';

export type OcrEngine = 'tesseract' | 'google-vision' | 'claude';

export const ENGINE_META: Record<OcrEngine, { label: string; badge: string; hint: string; needsKey: boolean }> = {
  tesseract: {
    label: 'Tesseract.js',
    badge: 'LOCAL',
    hint: 'offline · grátis · ~85% precisão',
    needsKey: false,
  },
  'google-vision': {
    label: 'Google Vision',
    badge: 'CLOUD',
    hint: 'REST · 1.000 req/mês grátis · ~99%',
    needsKey: true,
  },
  claude: {
    label: 'Claude Haiku',
    badge: 'IA',
    hint: 'LLM · contextual · ~98% precisão',
    needsKey: true,
  },
};

function stripPrefix(base64: string): string {
  return base64.replace(/^data:image\/\w+;base64,/, '');
}

async function runTesseract(base64: string): Promise<string> {
  const { data: { text } } = await Tesseract.recognize(base64, 'eng');
  return text;
}

async function runGoogleVision(base64: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: stripPrefix(base64) },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        }],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.responses?.[0]?.fullTextAnnotation?.text ?? '';
}

async function runClaude(base64: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: stripPrefix(base64) },
          },
          {
            type: 'text',
            text: 'Extract all text visible in this image. Return only the extracted text, preserving line breaks. If no text is found, return empty.',
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

export async function runOcr(
  engine: OcrEngine,
  base64: string,
  apiKey?: string
): Promise<string> {
  if (ENGINE_META[engine].needsKey && !apiKey) {
    throw new Error(`API Key obrigatória para ${ENGINE_META[engine].label}`);
  }

  switch (engine) {
    case 'tesseract':      return runTesseract(base64);
    case 'google-vision':  return runGoogleVision(base64, apiKey!);
    case 'claude':         return runClaude(base64, apiKey!);
  }
}
