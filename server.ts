import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const TEXT_MODEL = 'gemini-4-hydrogen';
const TEXT_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const TTS_MODEL = 'gemini-3.8-flash-lite-tts';

const getApiKey = (): string => {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return '';
  return key;
};

let cachedClient: GoogleGenAI | null = null;
let cachedKey = '';

function getAiClient(): GoogleGenAI {
  const key = getApiKey();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  if (!cachedClient || cachedKey !== key) {
    cachedClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    cachedKey = key;
  }
  return cachedClient;
}

function isTransientUpstreamError(err: unknown): boolean {
  const errObj = err as { status?: number; message?: string };
  const status = Number(errObj?.status || 0);
  const msg = errObj?.message || '';
  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE')
  );
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      if (!isTransientUpstreamError(err) || i === maxRetries) throw err;
      const delay = 400 * Math.pow(2, i) + Math.random() * 120;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}

function formatGeminiErrorMessage(err: unknown): string {
  const raw = String((err as { message?: string })?.message || err || 'Commentary service unavailable');
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // Plain error message string
  }
  return raw;
}

interface CommentaryRequestBody {
  eventType?: string;
  summary?: string;
  trackName?: string;
  mapName?: string;
  raceTimeSec?: number;
  recentLines?: string[];
}

function sanitizeSpokenLine(raw: string): string {
  return raw
    .replace(/[*_`#[\]()"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      commentaryAvailable: Boolean(getApiKey()),
    });
  });

  app.post('/api/commentary', async (req: Request, res: Response) => {
    const key = getApiKey();
    if (!key) {
      res.status(503).json({
        ok: false,
        code: 'MISSING_API_KEY',
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    const body = (req.body || {}) as CommentaryRequestBody;
    const eventType = String(body.eventType || '').trim();
    const summary = String(body.summary || '').trim();
    if (!eventType || !summary) {
      res.status(400).json({
        ok: false,
        code: 'BAD_REQUEST',
        error: 'eventType and summary are required.',
      });
      return;
    }

    const trackName = String(body.trackName || 'Race Course').trim();
    const mapName = String(body.mapName || 'Arena').trim();
    const raceTimeSec = Number.isFinite(body.raceTimeSec) ? Number(body.raceTimeSec) : 0;
    const recentLines = Array.isArray(body.recentLines)
      ? body.recentLines.slice(-4).map((l) => String(l).trim()).filter(Boolean)
      : [];

    try {
      const ai = getAiClient();

      const prompt = [
        `Territory: ${mapName} | Track: ${trackName} | Clock: ${raceTimeSec.toFixed(1)}s`,
        `Physics Event Type: ${eventType}`,
        `Telemetry: ${summary}`,
        recentLines.length > 0
          ? `Avoid repeating phrasing from recent lines: ${recentLines.join(' / ')}`
          : '',
        'Deliver one crisp broadcast commentary line now.',
      ]
        .filter(Boolean)
        .join('\n');

      const systemInstruction =
        'You are a sharp, professional live motorsports and marble-racing broadcast announcer. Write exactly ONE vivid spoken sentence (7 to 14 words max) reacting to the physics telemetry event. Refer to competitors naturally by their color (e.g. "The red ball", "Cobalt Blue") and the corner, ramp, gate, or finish line mentioned. Plain spoken English only: no emojis, no quotes, no markdown, no stage directions.';

      const requestLine = (model: string, useThinking: boolean) =>
        ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction,
            temperature: 0.85,
            maxOutputTokens: 400,
            ...(useThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          },
        });

      let textResponse;
      try {
        textResponse = await generateWithRetry(() => requestLine(TEXT_MODEL, true), 1);
      } catch (primaryErr: unknown) {
        if (!isTransientUpstreamError(primaryErr)) throw primaryErr;
        textResponse = await generateWithRetry(() => requestLine(TEXT_FALLBACK_MODEL, false), 1);
      }

      const line = sanitizeSpokenLine(textResponse.text || '');
      if (!line) {
        res.status(502).json({
          ok: false,
          code: 'EMPTY_TEXT',
          error: 'Commentary model returned empty text.',
        });
        return;
      }

      const ttsResponse = await generateWithRetry(() =>
        ai.models.generateContent({
          model: TTS_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: line,
                  speechMetadata: {
                    style: 'Energetic, crisp live sports broadcast commentator',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Fenrir' },
              },
            },
          },
        })
      );

      const parts = ttsResponse.candidates?.[0]?.content?.parts || [];
      const audioPart = parts.find((p) => Boolean(p.inlineData?.data));
      if (!audioPart?.inlineData?.data) {
        res.status(502).json({
          ok: false,
          code: 'EMPTY_AUDIO',
          error: 'TTS model returned no audio data.',
          text: line,
        });
        return;
      }

      res.json({
        ok: true,
        text: line,
        audioBase64: audioPart.inlineData.data,
        mimeType: audioPart.inlineData.mimeType || 'audio/wav',
      });
    } catch (err: unknown) {
      const e = err as { status?: number };
      const message = formatGeminiErrorMessage(err);
      console.error('Commentary API error:', message);
      const statusCode = e?.status && e.status >= 400 && e.status < 600 ? e.status : 502;
      res.status(statusCode).json({
        ok: false,
        code: 'UPSTREAM_ERROR',
        error: message,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Marble Rush 3D server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
