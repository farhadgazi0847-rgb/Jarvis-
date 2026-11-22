import type {
  AndroidActionRequest,
  AndroidIntentSpec,
  AndroidPermissionKey,
  AndroidPermissionMap,
  DetectedLanguage,
} from '../types/jarvis';

/**
 * Safe recursive-descent arithmetic expression evaluator (no eval/Function).
 * Supports +, -, *, /, %, ^, parentheses, pi, e, and sqrt(...).
 */
export function evaluateMathExpression(
  rawInput: string
): { ok: true; result: number; formatted: string } | { ok: false; error: string } {
  const input = rawInput.trim();
  if (!input) {
    return { ok: false, error: 'Expression cannot be empty.' };
  }

  type Token =
    | { type: 'num'; value: number }
    | { type: 'op'; value: string }
    | { type: 'paren'; value: '(' | ')' }
    | { type: 'ident'; value: string };

  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        if (input[i] === '.') dotCount += 1;
        if (dotCount > 1) {
          return { ok: false, error: 'Invalid numeric literal.' };
        }
        numStr += input[i];
        i += 1;
      }
      const parsed = Number(numStr);
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: 'Numeric overflow or invalid number.' };
      }
      tokens.push({ type: 'num', value: parsed });
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let ident = '';
      while (i < input.length && /[a-zA-Z]/.test(input[i])) {
        ident += input[i].toLowerCase();
        i += 1;
      }
      if (ident === 'pi') {
        tokens.push({ type: 'num', value: Math.PI });
      } else if (ident === 'e') {
        tokens.push({ type: 'num', value: Math.E });
      } else if (ident === 'sqrt' || ident === 'abs') {
        tokens.push({ type: 'ident', value: ident });
      } else {
        return { ok: false, error: `Unsupported symbol "${ident}".` };
      }
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i += 1;
      continue;
    }
    if ('+-*/%^'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    return { ok: false, error: `Unexpected character "${ch}".` };
  }

  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function consume(): Token {
    return tokens[pos++];
  }

  function parseExpression(): number {
    let left = parseTerm();
    while (true) {
      const t = peek();
      if (t?.type === 'op' && (t.value === '+' || t.value === '-')) {
        consume();
        const right = parseTerm();
        left = t.value === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): number {
    let left = parsePower();
    while (true) {
      const t = peek();
      if (t?.type === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        consume();
        const right = parsePower();
        if (t.value === '*') left *= right;
        else if (t.value === '/') {
          if (right === 0) throw new Error('Division by zero.');
          left /= right;
        } else {
          if (right === 0) throw new Error('Modulo by zero.');
          left %= right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  function parsePower(): number {
    const base = parseUnary();
    const t = peek();
    if (t?.type === 'op' && t.value === '^') {
      consume();
      const exp = parsePower();
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number {
    const t = peek();
    if (t?.type === 'op' && (t.value === '+' || t.value === '-')) {
      consume();
      const val = parseUnary();
      return t.value === '-' ? -val : val;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const t = peek();
    if (!t) throw new Error('Unexpected end of expression.');
    if (t.type === 'num') {
      consume();
      return t.value;
    }
    if (t.type === 'ident') {
      const fn = consume().value;
      const open = peek();
      if (open?.type !== 'paren' || open.value !== '(') {
        throw new Error(`Expected "(" after ${fn}.`);
      }
      consume();
      const inner = parseExpression();
      const close = peek();
      if (close?.type !== 'paren' || close.value !== ')') {
        throw new Error('Missing closing parenthesis.');
      }
      consume();
      if (fn === 'sqrt') {
        if (inner < 0) throw new Error('Square root of negative number.');
        return Math.sqrt(inner);
      }
      return Math.abs(inner);
    }
    if (t.type === 'paren' && t.value === '(') {
      consume();
      const inner = parseExpression();
      const close = peek();
      if (close?.type !== 'paren' || close.value !== ')') {
        throw new Error('Missing closing parenthesis.');
      }
      consume();
      return inner;
    }
    throw new Error('Invalid expression syntax.');
  }

  try {
    const result = parseExpression();
    if (pos < tokens.length) {
      return { ok: false, error: 'Unexpected trailing tokens.' };
    }
    if (!Number.isFinite(result)) {
      return { ok: false, error: 'Result is not finite.' };
    }
    const rounded = Math.round(result * 1e10) / 1e10;
    const formatted = Number.isInteger(rounded) ? String(rounded) : String(rounded);
    return { ok: true, result: rounded, formatted };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to evaluate expression.',
    };
  }
}

/**
 * Detects Bengali, Hindi (Devanagari), Banglish, Hinglish, or English from text.
 */
export function detectLanguageHint(text: string): {
  code: DetectedLanguage;
  label: string;
  mixedHint?: 'banglish' | 'hinglish';
} {
  const bengaliChars = (text.match(/[\u0980-\u09FF]/g) || []).length;
  const devanagariChars = (text.match(/[\u0900-\u097F]/g) || []).length;

  if (bengaliChars > 0 && bengaliChars >= devanagariChars) {
    return { code: 'bn', label: 'বাংলা (Bengali)' };
  }
  if (devanagariChars > 0) {
    return { code: 'hi', label: 'हिन्दी (Hindi)' };
  }

  const lower = ` ${text.toLowerCase()} `;
  const banglishTokens = [
    ' ami ',
    ' tumi ',
    ' kemon ',
    ' acho ',
    ' korbo ',
    ' kholo ',
    ' bolo ',
    ' bangla ',
    ' shomoy ',
    ' ki khobor ',
    ' dao ',
    ' pathao ',
  ];
  const hinglishTokens = [
    ' kaise ',
    ' kya ',
    ' karo ',
    ' kholo ',
    ' batao ',
    ' mera ',
    ' mujhe ',
    ' bhejo ',
    ' lagao ',
    ' samay ',
    ' hindi ',
    ' bhai ',
  ];

  const banglishHits = banglishTokens.filter((w) => lower.includes(w)).length;
  const hinglishHits = hinglishTokens.filter((w) => lower.includes(w)).length;

  if (banglishHits > 0 && banglishHits >= hinglishHits) {
    return { code: 'bn', label: 'Banglish -> বাংলা', mixedHint: 'banglish' };
  }
  if (hinglishHits > 0) {
    return { code: 'hi', label: 'Hinglish -> हिन्दी', mixedHint: 'hinglish' };
  }

  return { code: 'en', label: 'English' };
}

/**
 * Checks whether a live speech transcript starts with or contains an active wake phrase.
 */
export function matchesWakeWord(
  transcript: string,
  wakePhrases: string[]
): { matched: boolean; phrase?: string; remainder: string } {
  const cleaned = transcript.trim();
  if (!cleaned) return { matched: false, remainder: '' };

  const normalized = cleaned.toLowerCase().replace(/[.,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  const sortedPhrases = [...wakePhrases]
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const phrase of sortedPhrases) {
    if (phrase === 'js') {
      const regex = /\bjs\b/i;
      const match = regex.exec(normalized);
      if (match && match.index !== undefined) {
        const idx = match.index;
        const after = normalized.slice(idx + phrase.length).trim();
        return { matched: true, phrase, remainder: after };
      }
      continue;
    }

    const idx = normalized.indexOf(phrase);
    if (idx !== -1) {
      const after = normalized.slice(idx + phrase.length).trim();
      return { matched: true, phrase, remainder: after };
    }
  }

  return { matched: false, remainder: cleaned };
}

const APP_PACKAGE_MAP: Record<string, string> = {
  youtube: 'com.google.android.youtube',
  whatsapp: 'com.whatsapp',
  spotify: 'com.spotify.music',
  chrome: 'com.android.chrome',
  camera: 'android.media.action.IMAGE_CAPTURE',
  maps: 'com.google.android.apps.maps',
  gmail: 'com.google.android.gm',
  settings: 'android.settings.SETTINGS',
  calendar: 'com.google.android.calendar',
  clock: 'com.google.android.deskclock',
};

/**
 * Evaluates Android runtime permissions, sensitive-action confirmation requirements,
 * and constructs an explicit Android Intent specification + safe web URI fallback.
 */
export function evaluateDeviceCommandPolicy(
  request: AndroidActionRequest,
  permissions: AndroidPermissionMap
): {
  allowed: boolean;
  requiresConfirmation: boolean;
  missingPermission?: AndroidPermissionKey;
  intentSpec: AndroidIntentSpec;
  reason?: string;
} {
  const target = (request.target || '').trim();
  const message = (request.message || '').trim();
  const value = (request.value || '').trim();

  let intentSpec: AndroidIntentSpec;

  switch (request.action) {
    case 'send_sms': {
      intentSpec = {
        androidAction: 'android.intent.action.SENDTO',
        uriOrPackage: `smsto:${encodeURIComponent(target || 'contact')}`,
        extrasSummary: `sms_body="${message}"`,
        isSensitive: true,
        requiredPermission: 'SEND_SMS',
        webLaunchUrl: target
          ? `sms:${encodeURIComponent(target)}?body=${encodeURIComponent(message)}`
          : undefined,
      };
      break;
    }
    case 'make_call': {
      intentSpec = {
        androidAction: 'android.intent.action.CALL',
        uriOrPackage: `tel:${encodeURIComponent(target || 'unknown')}`,
        extrasSummary: `recipient="${target || 'unspecified'}"`,
        isSensitive: true,
        requiredPermission: 'CALL_PHONE',
        webLaunchUrl: target ? `tel:${encodeURIComponent(target)}` : undefined,
      };
      break;
    }
    case 'read_notifications': {
      intentSpec = {
        androidAction: 'android.service.notification.NotificationListenerService',
        uriOrPackage: 'com.jarvis.assistant/.JarvisNotificationService',
        extrasSummary: 'filter=active_notifications',
        isSensitive: true,
        requiredPermission: 'READ_NOTIFICATIONS',
      };
      break;
    }
    case 'launch_camera': {
      intentSpec = {
        androidAction: 'android.media.action.STILL_IMAGE_CAMERA',
        uriOrPackage: 'com.android.camera',
        extrasSummary: 'mode=photo',
        isSensitive: false,
        requiredPermission: 'CAMERA',
      };
      break;
    }
    case 'launch_maps': {
      const q = encodeURIComponent(target || 'current location');
      intentSpec = {
        androidAction: 'android.intent.action.VIEW',
        uriOrPackage: `geo:0,0?q=${q}`,
        extrasSummary: `destination="${target || 'nearby'}"`,
        isSensitive: false,
        requiredPermission: 'ACCESS_FINE_LOCATION',
        webLaunchUrl: `https://www.google.com/maps/search/?api=1&query=${q}`,
      };
      break;
    }
    case 'open_website': {
      const normalizedUrl = /^https?:\/\//i.test(target) ? target : `https://${target || 'google.com'}`;
      intentSpec = {
        androidAction: 'android.intent.action.VIEW',
        uriOrPackage: normalizedUrl,
        extrasSummary: 'category=BROWSABLE',
        isSensitive: false,
        requiredPermission: null,
        webLaunchUrl: normalizedUrl,
      };
      break;
    }
    case 'open_settings': {
      const settingKey = target.toLowerCase();
      let actionName = 'android.settings.SETTINGS';
      if (settingKey.includes('wifi') || settingKey.includes('wi-fi')) {
        actionName = 'android.settings.WIFI_SETTINGS';
      } else if (settingKey.includes('bluetooth')) {
        actionName = 'android.settings.BLUETOOTH_SETTINGS';
      } else if (settingKey.includes('display') || settingKey.includes('brightness')) {
        actionName = 'android.settings.DISPLAY_SETTINGS';
      } else if (settingKey.includes('sound') || settingKey.includes('volume')) {
        actionName = 'android.settings.SOUND_SETTINGS';
      }
      intentSpec = {
        androidAction: actionName,
        uriOrPackage: 'com.android.settings',
        extrasSummary: `section="${target || 'main'}"`,
        isSensitive: false,
        requiredPermission: null,
      };
      break;
    }
    case 'control_media': {
      intentSpec = {
        androidAction: 'android.media.AudioManager.dispatchMediaKeyEvent',
        uriOrPackage: 'android.media.session.MediaSessionManager',
        extrasSummary: `command="${value || target || 'toggle'}"`,
        isSensitive: false,
        requiredPermission: null,
      };
      break;
    }
    case 'adjust_setting': {
      intentSpec = {
        androidAction: 'android.provider.Settings.System',
        uriOrPackage: 'com.android.settings',
        extrasSummary: `${target || 'setting'}=${value || 'toggle'}`,
        isSensitive: false,
        requiredPermission: null,
      };
      break;
    }
    case 'open_app':
    default: {
      const pkg = APP_PACKAGE_MAP[target.toLowerCase()] || `com.app.${target.toLowerCase().replace(/[^a-z0-9]/g, '') || 'launcher'}`;
      intentSpec = {
        androidAction: 'android.intent.action.MAIN',
        uriOrPackage: pkg,
        extrasSummary: `app="${target || 'Launcher'}"`,
        isSensitive: false,
        requiredPermission: null,
      };
      break;
    }
  }

  if (intentSpec.requiredPermission && !permissions[intentSpec.requiredPermission]) {
    return {
      allowed: false,
      requiresConfirmation: false,
      missingPermission: intentSpec.requiredPermission,
      intentSpec,
      reason: `Android permission ${intentSpec.requiredPermission} is currently disabled.`,
    };
  }

  return {
    allowed: true,
    requiresConfirmation: intentSpec.isSensitive,
    intentSpec,
  };
}

/**
 * Formats an HH:MM 24-hour alarm time into remaining hours/minutes from a reference Date.
 */
export function formatTimeUntilAlarm(hhmm: string, now: Date = new Date()): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return 'Invalid time';

  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hrs === 0) return `in ${mins}m`;
  return `in ${hrs}h ${mins}m`;
}

/**
 * Resolves the BCP-47 speech recognition locale from user preference and browser locale.
 */
export function resolveSpeechRecognitionLocale(
  language: 'auto' | 'en' | 'bn' | 'hi',
  browserLocale: string = 'en-US'
): string {
  if (language === 'bn') return 'bn-BD';
  if (language === 'hi') return 'hi-IN';
  if (language === 'en') return 'en-US';
  const lower = browserLocale.toLowerCase();
  if (lower.startsWith('bn')) return 'bn-BD';
  if (lower.startsWith('hi')) return 'hi-IN';
  return 'en-US';
}

/**
 * Strips codec parameters (e.g. "audio/webm;codecs=opus" -> "audio/webm") for Gemini inlineData.
 */
export function normalizeAudioMimeType(rawMime?: string): string {
  const base = (rawMime || '').split(';')[0].trim().toLowerCase();
  if (!base || !base.startsWith('audio/')) return 'audio/webm';
  return base;
}

export type MicFailureKind =
  | 'permission_denied'
  | 'frame_blocked'
  | 'insecure_context'
  | 'no_device'
  | 'device_busy'
  | 'service_fallback'
  | 'no_speech'
  | 'unknown';

export interface MicFailureClassification {
  kind: MicFailureKind;
  shouldFallbackToRecorder: boolean;
  canRetryPermission: boolean;
  userMessage: string;
}

/**
 * Classifies Web SpeechRecognition / getUserMedia errors into actionable permission or device states.
 */
export function classifyMicrophoneFailure(
  errorNameOrCode: string,
  context: {
    isSecureContext?: boolean;
    isEmbeddedFrame?: boolean;
    frameAllowsMic?: boolean;
  } = {}
): MicFailureClassification {
  const code = (errorNameOrCode || '').trim();
  const lower = code.toLowerCase();

  if (context.isSecureContext === false || lower === 'securityerror') {
    return {
      kind: 'insecure_context',
      shouldFallbackToRecorder: false,
      canRetryPermission: false,
      userMessage:
        'Microphone access requires a secure HTTPS origin. Open the HTTPS app URL to use voice commands.',
    };
  }

  if (context.frameAllowsMic === false) {
    return {
      kind: 'frame_blocked',
      shouldFallbackToRecorder: false,
      canRetryPermission: true,
      userMessage:
        'This embedded frame does not allow microphone access yet. Allow mic access in the host window or open the app in a standalone tab.',
    };
  }

  if (
    lower === 'notallowederror' ||
    lower === 'permissiondeniederror' ||
    lower === 'not-allowed'
  ) {
    return {
      kind: 'permission_denied',
      shouldFallbackToRecorder: false,
      canRetryPermission: true,
      userMessage: context.isEmbeddedFrame
        ? 'Microphone permission was blocked. Click "Grant Mic Access" or allow the microphone in your browser address bar, then retry.'
        : 'Microphone permission is blocked in your browser. Allow microphone access in site settings and click "Retry Mic".',
    };
  }

  if (lower === 'network' || lower === 'service-not-allowed' || lower === 'audio-capture') {
    return {
      kind: 'service_fallback',
      shouldFallbackToRecorder: true,
      canRetryPermission: false,
      userMessage:
        'Switching to direct microphone capture with Gemini audio transcription.',
    };
  }

  if (lower === 'notfounderror' || lower === 'devicesnotfounderror') {
    return {
      kind: 'no_device',
      shouldFallbackToRecorder: false,
      canRetryPermission: false,
      userMessage:
        'No microphone input device was detected. Connect a microphone or type your command below.',
    };
  }

  if (lower === 'notreadableerror' || lower === 'trackstarterror') {
    return {
      kind: 'device_busy',
      shouldFallbackToRecorder: false,
      canRetryPermission: true,
      userMessage:
        'Your microphone is currently in use by another app or tab. Close other audio captures and retry.',
    };
  }

  if (lower === 'no-speech') {
    return {
      kind: 'no_speech',
      shouldFallbackToRecorder: false,
      canRetryPermission: false,
      userMessage: 'No speech detected. Tap Speak and try again.',
    };
  }

  return {
    kind: 'unknown',
    shouldFallbackToRecorder: false,
    canRetryPermission: true,
    userMessage: code
      ? `Microphone error (${code}). Click "Grant Mic Access" or type your command below.`
      : 'Microphone is unavailable in this browser context. You can still type commands below.',
  };
}

const SPEECH_INTENT_PATTERNS = [
  /\b(sunte chai|shunte chai|shonao|sonao|mukhe bolo|kothay bolo|voice e bolo|text korbe na|likhbe na|speak only|voice only|read aloud|read it to me|tell me out loud|speak it|say it out loud|no text)\b/i,
  /(শোনাও|শুনতে চাই|মুখে বলো|লিখবে না|কথায় বলো)/,
  /(सुनाओ|सुनना है|बोलकर बताओ|लिखो मत)/,
  /\b(sunao|sunna hai|bolke batao|likho mat|awaz me bolo)\b/i,
];

/**
 * Detects whether the user's prompt explicitly asks JARVIS to speak rather than write text.
 */
export function detectSpeechIntent(userText: string): boolean {
  const trimmed = (userText || '').trim();
  if (!trimmed) return false;
  return SPEECH_INTENT_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Resolves whether JARVIS should auto-speak the response and whether it should render in compact voice-only mode.
 */
export function shouldAutoSpeak(
  settings: { autoSpeakResponses: boolean; speechOnlyMode: boolean },
  userText: string
): { autoSpeak: boolean; speechOnly: boolean } {
  const explicitSpeechRequest = detectSpeechIntent(userText);
  const speechOnly = Boolean(settings.speechOnlyMode || explicitSpeechRequest);
  const autoSpeak = Boolean(settings.autoSpeakResponses || speechOnly);
  return { autoSpeak, speechOnly };
}

/**
 * Strips markdown/URLs and clips overly long text so TTS generates and starts playing quickly.
 */
export function prepareSpeechText(rawText: string, maxChars = 360): string {
  const cleaned = (rawText || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>~]+/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  const sliced = cleaned.slice(0, maxChars);
  const lastStop = Math.max(sliced.lastIndexOf('।'), sliced.lastIndexOf('.'), sliced.lastIndexOf('!'));
  if (lastStop > maxChars * 0.5) {
    return sliced.slice(0, lastStop + 1).trim();
  }
  return `${sliced.trim()}...`;
}

/**
 * Computes normalized spectral audio level (0..1) and whether active speech is detected for VAD auto-stop.
 */
export function measureSpeechEnergy(
  frequencyBins: ArrayLike<number>,
  speechThreshold = 0.16
): { level: number; isSpeech: boolean } {
  const len = frequencyBins.length || 0;
  if (len === 0) return { level: 0, isSpeech: false };
  let sum = 0;
  const sampleCount = Math.min(len, 16);
  for (let i = 0; i < sampleCount; i++) {
    sum += Number(frequencyBins[i] || 0);
  }
  const avg = sum / sampleCount / 255;
  const level = Math.max(0, Math.min(1, avg));
  return { level, isSpeech: level >= speechThreshold };
}

