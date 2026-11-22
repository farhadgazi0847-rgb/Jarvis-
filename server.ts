import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_TEXT = 'gemini-4-hydrogen';
const MODEL_TEXT_FALLBACK = 'gemini-3.1-flash-lite';
const MODEL_TTS = 'gemini-3.8-flash-lite-tts';
const MODEL_TRANSCRIBE = 'gemini-3.5-transcribe';
let searchGroundingCooldownUntil = 0;

function getAiClient(apiVersion?: string, timeoutMs = 45000): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const jarvisFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'control_android_device',
    description:
      'Dispatch an Android smartphone device control action such as opening an app, opening settings, sending SMS, making a phone call, controlling media playback, adjusting device settings, reading notifications, opening a website, launching Google Maps, or launching the camera.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description:
            'One of: open_app, open_settings, send_sms, make_call, control_media, adjust_setting, read_notifications, open_website, launch_maps, launch_camera',
        },
        target: {
          type: Type.STRING,
          description:
            'Target app name, phone number/contact, setting name, URL, or Maps destination.',
        },
        message: {
          type: Type.STRING,
          description: 'SMS message body if action is send_sms.',
        },
        value: {
          type: Type.STRING,
          description: 'Value for setting or media control (e.g. play, pause, next, on, off, 70).',
        },
        reason: {
          type: Type.STRING,
          description: 'Short explanation to the user of why this device action is being requested.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_notes_tasks',
    description: 'Create or manage user notes and smart tasks in the JARVIS workspace.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        operation: {
          type: Type.STRING,
          description: 'One of: add_note, add_task, complete_task',
        },
        title: {
          type: Type.STRING,
          description: 'Title of the note or task.',
        },
        content: {
          type: Type.STRING,
          description: 'Body text for a note.',
        },
        priority: {
          type: Type.STRING,
          description: 'Task priority: low, medium, or high.',
        },
      },
      required: ['operation', 'title'],
    },
  },
  {
    name: 'manage_alarms_reminders',
    description: 'Set an alarm or reminder at a specific 24-hour HH:MM time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        label: {
          type: Type.STRING,
          description: 'Alarm or reminder description.',
        },
        time: {
          type: Type.STRING,
          description: '24-hour time formatted as HH:MM (e.g. 07:30 or 18:45).',
        },
      },
      required: ['label', 'time'],
    },
  },
  {
    name: 'manage_calendar',
    description: 'Schedule a calendar event with title, date, and time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Event title.' },
        date: { type: Type.STRING, description: 'YYYY-MM-DD date string.' },
        time: { type: Type.STRING, description: 'HH:MM 24-hour time string.' },
        location: { type: Type.STRING, description: 'Optional location.' },
      },
      required: ['title', 'date', 'time'],
    },
  },
  {
    name: 'calculate_expression',
    description: 'Evaluate a mathematical expression accurately.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        expression: {
          type: Type.STRING,
          description: 'Arithmetic expression such as "245 * 18 + 90" or "sqrt(144)".',
        },
      },
      required: ['expression'],
    },
  },
  {
    name: 'save_user_preference',
    description:
      'Store a user-approved preference or personal fact in JARVIS memory when the user explicitly asks JARVIS to remember it.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fact: { type: Type.STRING, description: 'The preference or fact to remember.' },
        category: {
          type: Type.STRING,
          description: 'One of: preference, contact, routine, general',
        },
      },
      required: ['fact', 'category'],
    },
  },
];

function safeEvalServerMath(expr: string): { ok: boolean; value?: number; error?: string } {
  const cleaned = expr.trim().replace(/\s+/g, '');
  if (!cleaned || !/^[0-9+\-*/%^().a-zA-Z]+$/.test(cleaned)) {
    return { ok: false, error: 'Unsupported characters in math expression.' };
  }
  try {
    const normalized = cleaned
      .replace(/\bpi\b/gi, String(Math.PI))
      .replace(/\be\b/gi, String(Math.E))
      .replace(/\bsqrt\(/gi, 'Math.sqrt(')
      .replace(/\babs\(/gi, 'Math.abs(')
      .replace(/\^/g, '**');
    if (/[^0-9+\-*/%().Mathsqrtabs\s*]/.test(normalized)) {
      return { ok: false, error: 'Disallowed expression token.' };
    }
    const fn = new Function(`"use strict"; return (${normalized});`);
    const val = fn();
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return { ok: false, error: 'Result is not finite.' };
    }
    return { ok: true, value: Math.round(val * 1e10) / 1e10 };
  } catch {
    return { ok: false, error: 'Invalid mathematical syntax.' };
  }
}

function buildSystemInstruction(params: {
  language: string;
  personality: string;
  memories: Array<{ fact: string; category: string }>;
  permissions: Record<string, boolean>;
  currentTimeIso: string;
}): string {
  const personalityTone =
    params.personality === 'concise'
      ? 'Be crisp, tactical, and ultra-concise like a cockpit flight computer.'
      : params.personality === 'warm'
      ? 'Be warm, encouraging, attentive, and natural while remaining intelligent and capable.'
      : 'Embody JARVIS: composed, articulate, subtly witty, proactive, and deeply competent.';

  const languageRule =
    params.language === 'bn'
      ? 'Always respond in natural Bengali (বাংলা) script unless the user explicitly asks for another language.'
      : params.language === 'hi'
      ? 'Always respond in natural Hindi (हिन्दी) Devanagari script unless the user explicitly asks for another language.'
      : params.language === 'en'
      ? 'Always respond in clear English unless the user explicitly asks for another language.'
      : 'Automatically detect the user language: reply in Bengali (বাংলা) if they speak/write Bengali or Banglish, reply in Hindi (हिन्दी) if they speak/write Hindi or Hinglish, and reply in English otherwise. Understand mixed Banglish and Hinglish seamlessly.';

  const memoryBlock =
    params.memories.length > 0
      ? params.memories.map((m) => `- [${m.category}] ${m.fact}`).join('\n')
      : '- No stored user preferences yet.';

  const permissionSummary = Object.entries(params.permissions)
    .map(([k, v]) => `${k}: ${v ? 'GRANTED' : 'DENIED'}`)
    .join(', ');

  return [
    'You are JARVIS AI, an advanced multilingual personal AI assistant.',
    personalityTone,
    languageRule,
    `Current local timestamp: ${params.currentTimeIso}.`,
    `Active Android runtime permissions: ${permissionSummary}.`,
    'User-approved memory facts:',
    memoryBlock,
    'Operational rules:',
    '1. Use googleSearch whenever the user asks about live news, weather, current events, facts after training, or web lookups. Never fabricate search results or URLs.',
    '2. Use control_android_device for phone actions (open apps, settings, SMS, calls, media, notifications, websites, Google Maps, camera). For sensitive actions (send_sms, make_call, read_notifications), explain clearly that explicit user confirmation is required before execution.',
    '3. Use manage_notes_tasks, manage_alarms_reminders, manage_calendar, calculate_expression, and save_user_preference when appropriate.',
    '4. Briefly explain what tool or action you triggered without using robotic code-comment formatting.',
    '5. Keep replies concise, crisp, and voice-ready (1-3 clear sentences unless detailed breakdown is explicitly asked).',
  ].join('\n');
}

function needsLiveWebSearch(message: string): boolean {
  return /\b(news|weather|forecast|latest|today|current|price|stock|score|match|search|google|find online|who is|what happened|breaking|khobor|abohawa|khabar|mausam)\b|(খবর|আবহাওয়া|আজকের|সর্বশেষ|खबर|मौसम|ताज़ा|आज की)/i.test(
    message
  );
}

function isTransientError(err: unknown): boolean {
  const raw = err instanceof Error ? `${err.name} ${err.message}` : String(err || '');
  const lower = raw.toLowerCase();
  return (
    raw.includes('503') ||
    raw.includes('504') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('DEADLINE_EXCEEDED') ||
    lower.includes('deadline') ||
    lower.includes('timeout') ||
    lower.includes('aborted') ||
    lower.includes('etimedout')
  );
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err || '');
  return raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED');
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries && isTransientError(err)) {
        const delayMs = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function extractCleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'Upstream AI request failed.');
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Raw message is plain text
  }
  return raw;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Upstream AI request failed.');
  const cleanMsg = extractCleanErrorMessage(err);
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return { status: 503, message: 'GEMINI_API_KEY is not configured. Please check Settings > Secrets.' };
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message:
        'Gemini service is temporarily experiencing high demand (503 UNAVAILABLE). Please retry in a few seconds.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Gemini API quota limit reached (429 RESOURCE_EXHAUSTED). Please check your API plan or quota in Settings > Secrets.',
    };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'Gemini API key was rejected (403/400). Please verify your key in Settings > Secrets.',
    };
  }
  if (raw.includes('404') || raw.includes('NOT_FOUND')) {
    return {
      status: 404,
      message: cleanMsg || 'Requested Gemini model was not found (404).',
    };
  }
  if (
    raw.includes('504') ||
    raw.includes('DEADLINE_EXCEEDED') ||
    cleanMsg.toLowerCase().includes('deadline')
  ) {
    return {
      status: 504,
      message:
        'Gemini response took too long (deadline expired). Please retry—fast fallback is ready.',
    };
  }
  if (raw.includes('400') || raw.includes('INVALID_ARGUMENT')) {
    return { status: 400, message: cleanMsg };
  }
  return { status: 500, message: cleanMsg };
}

function extractGroundingSources(response: unknown): Array<{ title: string; uri: string }> {
  const resp = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      };
    }>;
  };
  const chunks = resp?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set<string>();
  const sources: Array<{ title: string; uri: string }> = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        uri,
        title: chunk.web?.title || uri,
      });
    }
  }
  return sources;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  // Main JARVIS intelligence endpoint (Chat + Tool Calling + Google Search Grounding)
  app.post('/api/jarvis/chat', async (req, res) => {
    try {
      const {
        message,
        history = [],
        language = 'auto',
        personality = 'classic',
        memories = [],
        permissions = {},
        fastMode = true,
        currentTimeIso = new Date().toISOString(),
      } = req.body || {};

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      const primaryAi = getAiClient(undefined, 15000);
      const fallbackAi = getAiClient(undefined, 45000);
      const systemInstruction = buildSystemInstruction({
        language,
        personality,
        memories,
        permissions,
        currentTimeIso,
      });

      const formattedHistory = Array.isArray(history)
        ? history.slice(-6).map((item: { role: string; text: string }) => ({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(item.text || '').slice(0, 360) }],
          }))
        : [];

      const contents = [
        ...formattedHistory,
        { role: 'user', parts: [{ text: message }] },
      ];

      const hybridTools = [
        { googleSearch: {} },
        { functionDeclarations: jarvisFunctionDeclarations },
      ];
      const functionOnlyTools = [{ functionDeclarations: jarvisFunctionDeclarations }];

      const useSearch =
        Date.now() > searchGroundingCooldownUntil && needsLiveWebSearch(message);
      let activeModel = fastMode ? MODEL_TEXT_FALLBACK : MODEL_TEXT;
      let activeTools: unknown[] = useSearch ? hybridTools : functionOnlyTools;
      let useHybridConfig = useSearch;
      let firstResponse;

      try {
        firstResponse = await primaryAi.models.generateContent({
          model: activeModel,
          contents,
          config: {
            systemInstruction,
            ...(activeModel === MODEL_TEXT
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            tools: activeTools as Array<{ googleSearch?: Record<string, never>; functionDeclarations?: FunctionDeclaration[] }>,
            ...(useHybridConfig ? { toolConfig: { includeServerSideToolInvocations: true } } : {}),
          },
        });
      } catch (primaryErr) {
        if (!isQuotaOrRateLimitError(primaryErr) && !isTransientError(primaryErr)) {
          throw primaryErr;
        }
        if (useSearch && isQuotaOrRateLimitError(primaryErr)) {
          searchGroundingCooldownUntil = Date.now() + 60_000;
          activeTools = functionOnlyTools;
          useHybridConfig = false;
          try {
            firstResponse = await primaryAi.models.generateContent({
              model: activeModel,
              contents,
              config: {
                systemInstruction,
                ...(activeModel === MODEL_TEXT
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                tools: functionOnlyTools,
              },
            });
          } catch (funcErr) {
            if (!isQuotaOrRateLimitError(funcErr) && !isTransientError(funcErr)) {
              throw funcErr;
            }
            activeModel = activeModel === MODEL_TEXT_FALLBACK ? MODEL_TEXT : MODEL_TEXT_FALLBACK;
            firstResponse = await withRetry(() =>
              fallbackAi.models.generateContent({
                model: activeModel,
                contents,
                config: {
                  systemInstruction,
                  ...(activeModel === MODEL_TEXT
                    ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                    : {}),
                  tools: functionOnlyTools,
                },
              })
            );
          }
        } else {
          // Primary model busy/timed-out -> switch cleanly to alternate model with 45s budget
          activeModel = activeModel === MODEL_TEXT_FALLBACK ? MODEL_TEXT : MODEL_TEXT_FALLBACK;
          activeTools = functionOnlyTools;
          useHybridConfig = false;
          firstResponse = await withRetry(() =>
            fallbackAi.models.generateContent({
              model: activeModel,
              contents,
              config: {
                systemInstruction,
                ...(activeModel === MODEL_TEXT
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                tools: functionOnlyTools,
              },
            })
          );
        }
      }

      const collectedSources = extractGroundingSources(firstResponse);
      const clientActions: Array<{ name: string; args: Record<string, unknown> }> = [];
      const functionCalls = firstResponse.functionCalls || [];

      let finalText = firstResponse.text || '';

      if (functionCalls.length > 0 && firstResponse.candidates?.[0]?.content) {
        const previousContent = firstResponse.candidates[0].content;
        const functionResponses = functionCalls.map((fc) => {
          const args = (fc.args || {}) as Record<string, unknown>;
          clientActions.push({ name: fc.name || 'unknown', args });

          if (fc.name === 'calculate_expression') {
            const calc = safeEvalServerMath(String(args.expression || ''));
            return {
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: calc.ok
                  ? { result: calc.value, expression: args.expression }
                  : { error: calc.error },
              },
            };
          }

          if (fc.name === 'control_android_device') {
            const actionName = String(args.action || '');
            const sensitive = ['send_sms', 'make_call', 'read_notifications'].includes(actionName);
            return {
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: sensitive
                  ? {
                      status: 'awaiting_user_confirmation',
                      action: actionName,
                      target: args.target || '',
                      message: args.message || '',
                    }
                  : {
                      status: 'dispatched_to_device_bridge',
                      action: actionName,
                      target: args.target || '',
                      value: args.value || '',
                    },
              },
            };
          }

          return {
            functionResponse: {
              id: fc.id,
              name: fc.name || 'tool',
              response: { status: 'queued_on_client', ...args },
            },
          };
        });

        const secondContents = [
          ...contents,
          previousContent,
          {
            role: 'user',
            parts: functionResponses,
          },
        ];

        try {
          let secondResponse;
          try {
            secondResponse = await fallbackAi.models.generateContent({
              model: MODEL_TEXT_FALLBACK,
              contents: secondContents,
              config: {
                systemInstruction,
                tools: functionOnlyTools,
              },
            });
          } catch {
            secondResponse = await withRetry(() =>
              fallbackAi.models.generateContent({
                model: activeModel,
                contents: secondContents,
                config: {
                  systemInstruction,
                  ...(activeModel === MODEL_TEXT
                    ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                    : {}),
                  tools: functionOnlyTools,
                },
              })
            );
          }

          finalText = secondResponse.text || finalText;
          for (const s of extractGroundingSources(secondResponse)) {
            if (!collectedSources.some((existing) => existing.uri === s.uri)) {
              collectedSources.push(s);
            }
          }
        } catch {
          if (!finalText) {
            const summaryParts = functionResponses.map((fr) => {
              const respObj = fr.functionResponse.response as Record<string, unknown>;
              const fnName = fr.functionResponse.name;
              if (fnName === 'calculate_expression' && 'result' in respObj) {
                return `Calculation result is ${respObj.result}`;
              }
              if (fnName === 'manage_notes_tasks') {
                const title = String(respObj.title || 'item');
                return `Task "${title}" has been added`;
              }
              if (fnName === 'manage_alarms_reminders') {
                return `Alarm "${String(respObj.label || 'Reminder')}" set for ${String(respObj.time || '')}`;
              }
              if (fnName === 'control_android_device') {
                return `Prepared Android action: ${String(respObj.action || 'command')}`;
              }
              return `${fnName.replace(/_/g, ' ')} processed`;
            });
            finalText = `${summaryParts.join('. ')}.`;
          }
        }
      }

      res.json({
        text: finalText || 'Command processed.',
        sources: collectedSources,
        clientActions,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Dedicated Google Search Grounding endpoint (Web, News, Weather, Images query links)
  app.post('/api/jarvis/search', async (req, res) => {
    try {
      const { query, mode = 'web', language = 'auto' } = req.body || {};
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required.' });
      }

      const primaryAi = getAiClient(undefined, 15000);
      const fallbackAi = getAiClient(undefined, 45000);
      const modeHint =
        mode === 'news'
          ? 'Focus on the latest verified news headlines and key facts.'
          : mode === 'weather'
          ? 'Provide current weather conditions, temperature, humidity/wind if available, and short forecast.'
          : 'Provide a clear, accurate web research summary with verified facts.';

      const langHint =
        language === 'bn'
          ? 'Respond in Bengali (বাংলা).'
          : language === 'hi'
          ? 'Respond in Hindi (हिन्दी).'
          : 'Respond in the same language as the query.';

      let response;
      try {
        response = await primaryAi.models.generateContent({
          model: MODEL_TEXT,
          contents: query,
          config: {
            systemInstruction: `You are JARVIS Search Engine. ${modeHint} ${langHint} Never fabricate sources or facts.`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            tools: [{ googleSearch: {} }],
          },
        });
      } catch (err) {
        if (!isQuotaOrRateLimitError(err) && !isTransientError(err)) {
          throw err;
        }
        response = await withRetry(() =>
          fallbackAi.models.generateContent({
            model: MODEL_TEXT_FALLBACK,
            contents: query,
            config: {
              systemInstruction: `You are JARVIS Search Engine. ${modeHint} ${langHint} Never fabricate sources or facts.`,
              tools: [{ googleSearch: {} }],
            },
          })
        );
      }

      const sources = extractGroundingSources(response);
      res.json({
        summary: response.text || 'No summary returned.',
        sources,
        googleSearchUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        googleImagesUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Multilingual Translator endpoint
  app.post('/api/jarvis/translate', async (req, res) => {
    try {
      const { text, targetLanguage = 'bn' } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text to translate is required.' });
      }
      const primaryAi = getAiClient(undefined, 15000);
      const fallbackAi = getAiClient(undefined, 45000);
      const targetMap: Record<string, string> = {
        en: 'English',
        bn: 'Bengali (বাংলা) with romanized pronunciation in parentheses',
        hi: 'Hindi (हिन्दी) with romanized pronunciation in parentheses',
      };
      const prompt = `Translate the following text into ${targetMap[targetLanguage] || 'English'}. Preserve tone and meaning accurately. Input: "${text}"`;
      let response;
      try {
        response = await primaryAi.models.generateContent({
          model: MODEL_TEXT,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
      } catch (err) {
        if (!isQuotaOrRateLimitError(err) && !isTransientError(err)) {
          throw err;
        }
        response = await withRetry(() =>
          fallbackAi.models.generateContent({
            model: MODEL_TEXT_FALLBACK,
            contents: prompt,
          })
        );
      }
      res.json({ translatedText: response.text || '' });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Gemini Neural Text-to-Speech endpoint (WAV audio output)
  app.post('/api/jarvis/tts', async (req, res) => {
    try {
      const { text, voiceName = 'Charon' } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required for TTS.' });
      }
      const allowedVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const chosenVoice = allowedVoices.includes(voiceName) ? voiceName : 'Charon';

      const ai = getAiClient('v1beta', 20000);
      const clipped = text
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/[*_`#>~]+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 380);
      if (!clipped) {
        return res.status(400).json({ error: 'No speakable text provided.' });
      }
      let response;
      try {
        response = await withRetry(() =>
          ai.models.generateContent({
            model: MODEL_TTS,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: clipped,
                    speechMetadata: {
                      style: 'Calm, intelligent, articulate personal AI assistant',
                    },
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: chosenVoice },
                },
              },
            },
          })
        );
      } catch (ttsErr) {
        const msg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr || '');
        if (
          !msg.includes('INVALID_ARGUMENT') &&
          !msg.includes('Cannot find field') &&
          !msg.includes('404') &&
          !msg.includes('NOT_FOUND')
        ) {
          throw ttsErr;
        }
        // Fallback without speechMetadata or alternate TTS model if gateway rejects field
        response = await withRetry(() =>
          ai.models.generateContent({
            model: MODEL_TTS,
            contents: [{ role: 'user', parts: [{ text: clipped }] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: chosenVoice },
                },
              },
            },
          })
        );
      }

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        return res.status(502).json({ error: 'No audio payload returned from Gemini TTS.' });
      }
      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Audio Transcription endpoint (fallback for browsers without SpeechRecognition)
  app.post('/api/jarvis/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body || {};
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        return res.status(400).json({ error: 'Audio payload is required.' });
      }
      const cleanMimeType = String(mimeType).split(';')[0].trim() || 'audio/webm';
      const primaryTranscribeAi = getAiClient('v1beta', 11000);
      const fallbackTranscribeAi = getAiClient('v1beta', 28000);
      const contents = {
        parts: [
          { inlineData: { mimeType: cleanMimeType, data: audioBase64 } },
          {
            text: 'Transcribe the spoken words accurately in original language (Bengali, Hindi, English, Banglish, or Hinglish). Return only the transcript text.',
          },
        ],
      };
      let response;
      try {
        response = await primaryTranscribeAi.models.generateContent({
          model: MODEL_TRANSCRIBE,
          contents,
        });
      } catch (transcribeErr) {
        const msg = transcribeErr instanceof Error ? transcribeErr.message : String(transcribeErr || '');
        if (
          !msg.includes('404') &&
          !msg.includes('NOT_FOUND') &&
          !isTransientError(transcribeErr) &&
          !isQuotaOrRateLimitError(transcribeErr)
        ) {
          throw transcribeErr;
        }
        try {
          response = await withRetry(() =>
            fallbackTranscribeAi.models.generateContent({
              model: MODEL_TEXT_FALLBACK,
              contents,
            })
          );
        } catch {
          response = await withRetry(() =>
            fallbackTranscribeAi.models.generateContent({
              model: MODEL_TEXT,
              contents,
              config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
            })
          );
        }
      }
      res.json({ transcript: (response.text || '').trim() });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS AI server listening on http://localhost:${PORT}`);
  });
}

startServer();
