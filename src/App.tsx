import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cpu,
  Search,
  Smartphone,
  LayoutGrid,
  Settings,
  Volume2,
  BellRing,
  X,
} from 'lucide-react';
import { JarvisCore } from './components/JarvisCore';
import { ChatConsole } from './components/ChatConsole';
import { DeviceControlPanel } from './components/DeviceControlPanel';
import { SearchAndBriefing } from './components/SearchAndBriefing';
import { SmartUtilities } from './components/SmartUtilities';
import { SettingsAndMemory } from './components/SettingsAndMemory';
import { AndroidStudioPlan } from './components/AndroidStudioPlan';
import {
  classifyMicrophoneFailure,
  detectLanguageHint,
  evaluateDeviceCommandPolicy,
  evaluateMathExpression,
  matchesWakeWord,
  measureSpeechEnergy,
  normalizeAudioMimeType,
  prepareSpeechText,
  resolveSpeechRecognitionLocale,
  shouldAutoSpeak,
} from './utils/jarvisLogic';
import type {
  AlarmItem,
  AndroidActionRequest,
  AndroidActionType,
  AndroidDeviceState,
  AndroidPermissionKey,
  AndroidPermissionMap,
  AssistantCoreState,
  BrowserMicPermissionState,
  CalendarEventItem,
  ChatMessage,
  CommandLogEntry,
  JarvisSettings,
  LanguageCode,
  MemoryItem,
  NoteItem,
  PendingActionConfirmation,
  SimulatedNotification,
  TaskItem,
} from './types/jarvis';

type ActiveTab = 'assistant' | 'search' | 'device' | 'utilities' | 'settings' | 'android';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const INITIAL_PERMISSIONS: AndroidPermissionMap = {
  RECORD_AUDIO: true,
  SEND_SMS: true,
  CALL_PHONE: true,
  READ_NOTIFICATIONS: true,
  SET_ALARM: true,
  CAMERA: true,
  ACCESS_FINE_LOCATION: true,
  READ_CALENDAR: true,
};

const INITIAL_SETTINGS: JarvisSettings = {
  language: 'auto',
  voice: 'Kore',
  personality: 'classic',
  wakeWordEnabled: false,
  wakePhrases: ['Hey Jarvis', 'Jarvis', 'JS'],
  autoSpeakResponses: true,
  speechOnlyMode: false,
  fastMode: true,
  offlineFallbackEnabled: true,
};

const INITIAL_DEVICE_STATE: AndroidDeviceState = {
  wifiEnabled: true,
  bluetoothEnabled: true,
  doNotDisturb: false,
  brightness: 78,
  volume: 70,
  mediaPlaying: false,
  mediaTrack: 'Ambient Focus Mix',
  lastOpenedApp: null,
};

const INITIAL_NOTIFICATIONS: SimulatedNotification[] = [
  {
    id: 'n1',
    app: 'Messages',
    sender: 'Alex Rahman',
    preview: 'Are we still meeting at 5:30 PM near Gulshan?',
    time: '10m ago',
    read: false,
  },
  {
    id: 'n2',
    app: 'Calendar',
    sender: 'Design Sync',
    preview: 'Architecture review starts in 45 minutes.',
    time: '25m ago',
    read: false,
  },
  {
    id: 'n3',
    app: 'Weather Alert',
    sender: 'System',
    preview: 'Clear evening skies expected · 26°C',
    time: '1h ago',
    read: true,
  },
];

const INITIAL_TASKS: TaskItem[] = [
  {
    id: 't1',
    title: 'Review JARVIS Kotlin WakeWord ForegroundService',
    completed: false,
    priority: 'high',
    createdAt: 'Today',
  },
  {
    id: 't2',
    title: 'Test Bengali and Hindi voice prompts',
    completed: false,
    priority: 'medium',
    createdAt: 'Today',
  },
];

const INITIAL_NOTES: NoteItem[] = [
  {
    id: 'note1',
    title: 'Multilingual Voice Architecture',
    content: 'Supports English, বাংলা, हिन्दी, Banglish, and Hinglish with automatic detection.',
    createdAt: 'Today',
  },
];

const INITIAL_ALARMS: AlarmItem[] = [
  { id: 'a1', label: 'Morning Briefing', time: '07:30', enabled: true },
];

const INITIAL_EVENTS: CalendarEventItem[] = [
  {
    id: 'e1',
    title: 'JARVIS System Calibration',
    date: new Date().toISOString().slice(0, 10),
    time: '16:30',
    location: 'Studio Lab',
  },
];

const INITIAL_MEMORIES: MemoryItem[] = [
  {
    id: 'm1',
    fact: 'Prefer concise, practical responses with verified sources.',
    category: 'preference',
    createdAt: 'Today',
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-1',
    role: 'assistant',
    text: 'Good day. JARVIS is online and ready. You can speak or type in English, বাংলা (Bengali), हिन्दी (Hindi), Banglish, or Hinglish—ask me to search the web, manage tasks/alarms, calculate, or dispatch Android device actions.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    detectedLanguage: 'en',
  },
];

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('assistant');
  const [now, setNow] = useState(() => new Date());

  // Persistent state (migrate older settings so autoSpeakResponses & speechOnlyMode default properly)
  const [settings, setSettings] = useState<JarvisSettings>(() => {
    const v2 = loadStored<JarvisSettings | null>('jarvis_settings_v2', null);
    if (v2) return { ...INITIAL_SETTINGS, ...v2 };
    const v1 = loadStored<Partial<JarvisSettings> | null>('jarvis_settings_v1', null);
    if (v1) {
      return {
        ...INITIAL_SETTINGS,
        ...v1,
        autoSpeakResponses: true,
        speechOnlyMode: false,
        fastMode: true,
      };
    }
    return INITIAL_SETTINGS;
  });
  const [permissions, setPermissions] = useState<AndroidPermissionMap>(() =>
    loadStored('jarvis_permissions_v1', INITIAL_PERMISSIONS)
  );
  const [deviceState, setDeviceState] = useState<AndroidDeviceState>(() =>
    loadStored('jarvis_device_v1', INITIAL_DEVICE_STATE)
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadStored('jarvis_messages_v1', INITIAL_MESSAGES)
  );
  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    loadStored('jarvis_tasks_v1', INITIAL_TASKS)
  );
  const [notes, setNotes] = useState<NoteItem[]>(() =>
    loadStored('jarvis_notes_v1', INITIAL_NOTES)
  );
  const [alarms, setAlarms] = useState<AlarmItem[]>(() =>
    loadStored('jarvis_alarms_v1', INITIAL_ALARMS)
  );
  const [events, setEvents] = useState<CalendarEventItem[]>(() =>
    loadStored('jarvis_events_v1', INITIAL_EVENTS)
  );
  const [memories, setMemories] = useState<MemoryItem[]>(() =>
    loadStored('jarvis_memories_v1', INITIAL_MEMORIES)
  );
  const [commandLogs, setCommandLogs] = useState<CommandLogEntry[]>(() =>
    loadStored('jarvis_logs_v1', [])
  );
  const [notifications] = useState<SimulatedNotification[]>(INITIAL_NOTIFICATIONS);

  // Runtime interaction state
  const [inputValue, setInputValue] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(() =>
    Array.from({ length: 24 }, () => 0.14)
  );
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);
  const [noticeAction, setNoticeAction] = useState<{ label: string; onClick: () => void } | null>(
    null
  );
  const [browserMicStatus, setBrowserMicStatus] =
    useState<BrowserMicPermissionState>('checking');
  const [triggeredAlarmBanner, setTriggeredAlarmBanner] = useState<AlarmItem | null>(null);

  const showNotice = useCallback(
    (message: string | null, action: { label: string; onClick: () => void } | null = null) => {
      setNoticeBanner(message);
      setNoticeAction(action);
    },
    []
  );

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const wakeRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const speechWaveTimerRef = useRef<number | null>(null);
  const speechSilenceTimerRef = useRef<number | null>(null);
  const latestTranscriptRef = useRef<string>('');
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const speakingTimerRef = useRef<number | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsCooldownUntilRef = useRef<number>(0);
  const ttsCacheRef = useRef<Map<string, { audioBase64: string; mimeType: string }>>(new Map());
  const sendMessageRef = useRef<(rawText?: string) => void>(() => {});
  const toggleMicRef = useRef<() => void>(() => {});

  // Persist changes cleanly
  useEffect(() => {
    localStorage.setItem('jarvis_settings_v2', JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    localStorage.setItem('jarvis_permissions_v1', JSON.stringify(permissions));
  }, [permissions]);
  useEffect(() => {
    localStorage.setItem('jarvis_device_v1', JSON.stringify(deviceState));
  }, [deviceState]);
  useEffect(() => {
    localStorage.setItem('jarvis_messages_v1', JSON.stringify(messages.slice(-40)));
  }, [messages]);
  useEffect(() => {
    localStorage.setItem('jarvis_tasks_v1', JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    localStorage.setItem('jarvis_notes_v1', JSON.stringify(notes));
  }, [notes]);
  useEffect(() => {
    localStorage.setItem('jarvis_alarms_v1', JSON.stringify(alarms));
  }, [alarms]);
  useEffect(() => {
    localStorage.setItem('jarvis_events_v1', JSON.stringify(events));
  }, [events]);
  useEffect(() => {
    localStorage.setItem('jarvis_memories_v1', JSON.stringify(memories));
  }, [memories]);
  useEffect(() => {
    localStorage.setItem('jarvis_logs_v1', JSON.stringify(commandLogs.slice(0, 40)));
  }, [commandLogs]);

  // Monitor real browser microphone permission state & frame policy
  const getMicPolicyContext = useCallback(() => {
    const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : true;
    let isEmbeddedFrame = false;
    try {
      isEmbeddedFrame = window.self !== window.top;
    } catch {
      isEmbeddedFrame = true;
    }
    const docWithPolicy = document as Document & {
      featurePolicy?: { allowsFeature?: (feature: string) => boolean };
      permissionsPolicy?: { allowsFeature?: (feature: string) => boolean };
    };
    const policy = docWithPolicy.permissionsPolicy || docWithPolicy.featurePolicy;
    const frameAllowsMic =
      typeof policy?.allowsFeature === 'function' ? policy.allowsFeature('microphone') : true;
    return { isSecureContext, isEmbeddedFrame, frameAllowsMic };
  }, []);

  const refreshBrowserMicStatus = useCallback(async () => {
    const ctx = getMicPolicyContext();
    if (!ctx.isSecureContext || !navigator.mediaDevices?.getUserMedia || !ctx.frameAllowsMic) {
      setBrowserMicStatus(ctx.frameAllowsMic === false ? 'denied' : 'unsupported');
      return;
    }
    if (!navigator.permissions?.query) {
      setBrowserMicStatus('prompt');
      return;
    }
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      const mapState = (s: PermissionState): BrowserMicPermissionState =>
        s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt';
      setBrowserMicStatus(mapState(status.state));
      status.onchange = () => {
        setBrowserMicStatus(mapState(status.state));
      };
    } catch {
      setBrowserMicStatus('prompt');
    }
  }, [getMicPolicyContext]);

  useEffect(() => {
    refreshBrowserMicStatus();
  }, [refreshBrowserMicStatus]);

  // Live clock + Alarm checker
  useEffect(() => {
    const id = window.setInterval(() => {
      const current = new Date();
      setNow(current);
      const hhmm = current.toTimeString().slice(0, 5);
      setAlarms((prev) => {
        let changed = false;
        const updated = prev.map((a) => {
          if (a.enabled && a.time === hhmm && !a.triggeredToday) {
            changed = true;
            setTriggeredAlarmBanner(a);
            playChimeTone();
            return { ...a, triggeredToday: true };
          }
          return a;
        });
        return changed ? updated : prev;
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const playChimeTone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.52);
    } catch {
      // Ignore if AudioContext blocked prior to gesture
    }
  };

  const hasPendingConfirmation = messages.some((m) => m.confirmationStatus === 'pending');

  const coreState: AssistantCoreState = isThinking
    ? 'thinking'
    : hasPendingConfirmation
    ? 'awaiting_confirmation'
    : micActive
    ? 'listening'
    : isSpeaking
    ? 'speaking'
    : settings.wakeWordEnabled
    ? 'wake_listening'
    : 'idle';

  // Synchronously unlock audio playback inside a user click/submit so async TTS replies play without autoplay blocks
  const unlockAudioPlayback = useCallback(() => {
    try {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio();
      }
      if (!audioUnlockedRef.current) {
        const el = audioPlayerRef.current;
        el.src =
          'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        el.volume = 0.01;
        const p = el.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            el.pause();
            audioUnlockedRef.current = true;
          }).catch(() => {});
        }
      }
    } catch {
      // Ignore unlock restrictions in non-audio contexts
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (speakingTimerRef.current) {
      window.clearInterval(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
    setIsSpeaking(false);
    setAudioLevels(Array.from({ length: 24 }, () => 0.14));
  }, []);

  const speakWithBrowserFallback = useCallback(
    (text: string) => {
      if (!('speechSynthesis' in window)) {
        setIsSpeaking(false);
        return;
      }
      const spoken = prepareSpeechText(text, 400);
      if (!spoken) {
        setIsSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spoken);
      const langHint = detectLanguageHint(spoken).code;
      utterance.lang = langHint === 'bn' ? 'bn-BD' : langHint === 'hi' ? 'hi-IN' : 'en-US';
      utterance.rate = settings.fastMode ? 1.07 : 1.0;
      utterance.onstart = () => {
        setIsSpeaking(true);
        speakingTimerRef.current = window.setInterval(() => {
          setAudioLevels(Array.from({ length: 24 }, () => 0.25 + Math.random() * 0.65));
        }, 110);
      };
      utterance.onend = () => stopSpeaking();
      utterance.onerror = () => stopSpeaking();
      window.speechSynthesis.speak(utterance);
    },
    [settings.fastMode, stopSpeaking]
  );

  const playCachedOrServerAudio = useCallback(
    async (audioBase64: string, mimeType: string) => {
      const audio = audioPlayerRef.current || new Audio();
      audioPlayerRef.current = audio;
      audio.src = `data:${mimeType || 'audio/wav'};base64,${audioBase64}`;
      audio.volume = Math.max(0.1, Math.min(1, deviceState.volume / 100));
      audio.playbackRate = settings.fastMode ? 1.05 : 1.0;
      audio.onended = () => stopSpeaking();
      audio.onerror = () => stopSpeaking();
      await audio.play();
    },
    [deviceState.volume, settings.fastMode, stopSpeaking]
  );

  const speakText = useCallback(
    async (text: string) => {
      stopSpeaking();
      const spoken = prepareSpeechText(text, 380);
      if (!spoken) return;

      if (settings.voice === 'browser' || Date.now() < ttsCooldownUntilRef.current) {
        speakWithBrowserFallback(spoken);
        return;
      }

      const cacheKey = `${settings.voice}:${spoken}`;
      const cached = ttsCacheRef.current.get(cacheKey);
      if (cached) {
        try {
          setIsSpeaking(true);
          speakingTimerRef.current = window.setInterval(() => {
            setAudioLevels(Array.from({ length: 24 }, () => 0.22 + Math.random() * 0.6));
          }, 120);
          await playCachedOrServerAudio(cached.audioBase64, cached.mimeType);
          return;
        } catch {
          // Fall through to live/fallback handling
        }
      }

      try {
        setIsSpeaking(true);
        speakingTimerRef.current = window.setInterval(() => {
          setAudioLevels(Array.from({ length: 24 }, () => 0.22 + Math.random() * 0.6));
        }, 120);

        const controller = new AbortController();
        ttsAbortRef.current = controller;
        const timeoutMs = settings.fastMode ? 3600 : 8500;
        const abortTimer = window.setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch('/api/jarvis/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: spoken, voiceName: settings.voice }),
          signal: controller.signal,
        }).finally(() => {
          window.clearTimeout(abortTimer);
          if (ttsAbortRef.current === controller) {
            ttsAbortRef.current = null;
          }
        });

        if (res.status === 429) {
          ttsCooldownUntilRef.current = Date.now() + 30_000;
        }

        const data = await res.json();
        if (!res.ok || !data.audioBase64) {
          throw new Error(data.error || 'Gemini TTS unavailable');
        }
        if (ttsCacheRef.current.size > 20) {
          const oldest = ttsCacheRef.current.keys().next().value;
          if (oldest) ttsCacheRef.current.delete(oldest);
        }
        ttsCacheRef.current.set(cacheKey, {
          audioBase64: data.audioBase64,
          mimeType: data.mimeType || 'audio/wav',
        });

        await playCachedOrServerAudio(data.audioBase64, data.mimeType || 'audio/wav');
      } catch (err) {
        const errName = err instanceof Error ? err.name : '';
        if (errName === 'NotAllowedError') {
          stopSpeaking();
          showNotice('Browser paused autoplay audio.', {
            label: 'Play Voice Reply',
            onClick: () => {
              unlockAudioPlayback();
              showNotice(null);
              void speakText(spoken);
            },
          });
          return;
        }
        if (settings.offlineFallbackEnabled) {
          speakWithBrowserFallback(spoken);
        } else {
          stopSpeaking();
        }
      }
    },
    [
      settings.voice,
      settings.fastMode,
      settings.offlineFallbackEnabled,
      playCachedOrServerAudio,
      speakWithBrowserFallback,
      stopSpeaking,
      unlockAudioPlayback,
      showNotice,
    ]
  );

  const appendLog = useCallback(
    (entry: Omit<CommandLogEntry, 'id' | 'timestamp'>) => {
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setCommandLogs((prev) => [
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowTime,
          ...entry,
        },
        ...prev,
      ]);
    },
    []
  );

  const applySafeAndroidExecution = useCallback(
    (req: AndroidActionRequest, label: string, intentAction: string, webUrl?: string) => {
      if (req.action === 'adjust_setting') {
        const t = (req.target || '').toLowerCase();
        const val = (req.value || '').toLowerCase();
        if (t.includes('wifi') || t.includes('wi-fi')) {
          setDeviceState((s) => ({ ...s, wifiEnabled: val ? val === 'on' || val === 'true' : !s.wifiEnabled }));
        } else if (t.includes('bluetooth')) {
          setDeviceState((s) => ({
            ...s,
            bluetoothEnabled: val ? val === 'on' || val === 'true' : !s.bluetoothEnabled,
          }));
        } else if (t.includes('dnd') || t.includes('disturb')) {
          setDeviceState((s) => ({ ...s, doNotDisturb: val ? val === 'on' || val === 'true' : !s.doNotDisturb }));
        } else if (t.includes('brightness')) {
          const num = Number(req.value);
          if (Number.isFinite(num)) {
            setDeviceState((s) => ({ ...s, brightness: Math.max(10, Math.min(100, num)) }));
          }
        } else if (t.includes('volume')) {
          const num = Number(req.value);
          if (Number.isFinite(num)) {
            setDeviceState((s) => ({ ...s, volume: Math.max(0, Math.min(100, num)) }));
          }
        }
      } else if (req.action === 'control_media') {
        const val = (req.value || '').toLowerCase();
        setDeviceState((s) => ({
          ...s,
          mediaPlaying: val === 'play' ? true : val === 'pause' ? false : !s.mediaPlaying,
        }));
      } else if (req.action === 'open_app') {
        setDeviceState((s) => ({ ...s, lastOpenedApp: req.target || 'Launcher' }));
      } else if (req.action === 'launch_camera') {
        setDeviceState((s) => ({ ...s, lastOpenedApp: 'Camera' }));
      } else if (req.action === 'open_settings') {
        setDeviceState((s) => ({ ...s, lastOpenedApp: `Settings (${req.target || 'Main'})` }));
      } else if (req.action === 'launch_maps' || req.action === 'open_website') {
        setDeviceState((s) => ({
          ...s,
          lastOpenedApp: req.action === 'launch_maps' ? 'Google Maps' : 'Web Browser',
        }));
        if (webUrl) {
          setNoticeBanner(`Ready to open external link: ${webUrl}`);
        }
      }

      appendLog({
        command: label,
        actionSummary: label,
        status: 'executed',
        intentAction,
      });
    },
    [appendLog]
  );

  const dispatchAndroidCommand = useCallback(
    (
      req: AndroidActionRequest,
      label: string
    ): { pending?: PendingActionConfirmation; toolNote: string } => {
      const policy = evaluateDeviceCommandPolicy(req, permissions);
      if (!policy.allowed) {
        appendLog({
          command: label,
          actionSummary: policy.reason || 'Blocked by missing permission',
          status: 'blocked_permission',
          intentAction: policy.intentSpec.androidAction,
        });
        return {
          toolNote: `Blocked: ${policy.reason} Enable ${policy.missingPermission} in Device Control.`,
        };
      }

      if (policy.requiresConfirmation) {
        const confirmation: PendingActionConfirmation = {
          id: `conf-${Date.now()}`,
          request: req,
          intentSpec: policy.intentSpec,
          explanation:
            req.reason ||
            `Confirm ${req.action.replace('_', ' ')}${req.target ? ` for ${req.target}` : ''}${
              req.message ? `: "${req.message}"` : ''
            }`,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        appendLog({
          command: label,
          actionSummary: `Awaiting confirmation: ${label}`,
          status: 'pending',
          intentAction: policy.intentSpec.androidAction,
        });
        return {
          pending: confirmation,
          toolNote: `Awaiting explicit user confirmation for ${req.action}.`,
        };
      }

      applySafeAndroidExecution(
        req,
        label,
        policy.intentSpec.androidAction,
        policy.intentSpec.webLaunchUrl
      );
      return {
        toolNote: `Dispatched ${policy.intentSpec.androidAction} (${policy.intentSpec.uriOrPackage})`,
      };
    },
    [permissions, appendLog, applySafeAndroidExecution]
  );

  const handleConfirmAction = (messageId: string, approved: boolean) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    const pending = targetMsg?.pendingConfirmation;
    if (!pending) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, confirmationStatus: approved ? 'approved' : 'denied' } : m
      )
    );

    if (approved) {
      if (pending.request.action === 'read_notifications') {
        const summary = notifications
          .map((n) => `${n.app} from ${n.sender}: ${n.preview}`)
          .join('. ');
        const reply: ChatMessage = {
          id: `sys-${Date.now()}`,
          role: 'assistant',
          text: `Here are your latest notifications:\n${notifications
            .map((n) => `• ${n.app} (${n.sender}): ${n.preview}`)
            .join('\n')}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, reply]);
        if (settings.autoSpeakResponses) speakText(summary);
      }
      applySafeAndroidExecution(
        pending.request,
        pending.explanation,
        pending.intentSpec.androidAction,
        pending.intentSpec.webLaunchUrl
      );
      setNoticeBanner(`Executed approved Android intent: ${pending.intentSpec.androidAction}`);
    } else {
      appendLog({
        command: pending.explanation,
        actionSummary: 'Cancelled by user',
        status: 'denied_by_user',
        intentAction: pending.intentSpec.androidAction,
      });
      setNoticeBanner('Sensitive action cancelled.');
    }
  };

  const sendMessage = useCallback(
    async (rawText?: string) => {
      const text = (rawText ?? inputValue).trim();
      if (!text || isThinking) return;

      unlockAudioPlayback();
      const speechDecision = shouldAutoSpeak(settings, text);

      const langInfo = detectLanguageHint(text);
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        detectedLanguage: langInfo.code,
      };

      setMessages((prev) => [...prev, userMsg]);
      if (!rawText || rawText === inputValue) setInputValue('');
      setIsThinking(true);
      showNotice(null);

      try {
        const res = await fetch('/api/jarvis/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
            language: settings.language,
            personality: settings.personality,
            memories: memories.map((m) => ({ fact: m.fact, category: m.category })),
            permissions,
            fastMode: settings.fastMode,
            currentTimeIso: new Date().toISOString(),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'JARVIS server request failed.');
        }

        const toolEvents: string[] = [];
        let pendingConf: PendingActionConfirmation | undefined;

        const actions = Array.isArray(data.clientActions) ? data.clientActions : [];
        for (const act of actions) {
          const args = (act.args || {}) as Record<string, string>;
          if (act.name === 'calculate_expression') {
            const calc = evaluateMathExpression(String(args.expression || ''));
            if (calc.ok) {
              toolEvents.push(`Calculated ${args.expression} = ${calc.formatted}`);
            }
          } else if (act.name === 'manage_notes_tasks') {
            if (args.operation === 'add_note') {
              setNotes((prev) => [
                {
                  id: `note-${Date.now()}`,
                  title: args.title || 'Note',
                  content: args.content || '',
                  createdAt: 'Just now',
                },
                ...prev,
              ]);
              toolEvents.push(`Saved note: ${args.title}`);
            } else if (args.operation === 'add_task') {
              const prio =
                args.priority === 'high' || args.priority === 'low' ? args.priority : 'medium';
              setTasks((prev) => [
                {
                  id: `task-${Date.now()}`,
                  title: args.title || 'Task',
                  completed: false,
                  priority: prio,
                  createdAt: 'Just now',
                },
                ...prev,
              ]);
              toolEvents.push(`Added task: ${args.title}`);
            } else if (args.operation === 'complete_task') {
              setTasks((prev) =>
                prev.map((t) =>
                  t.title.toLowerCase().includes((args.title || '').toLowerCase())
                    ? { ...t, completed: true }
                    : t
                )
              );
              toolEvents.push(`Completed task: ${args.title}`);
            }
          } else if (act.name === 'manage_alarms_reminders') {
            if (!permissions.SET_ALARM) {
              toolEvents.push('Blocked alarm: SET_ALARM permission is disabled.');
            } else {
              setAlarms((prev) => [
                {
                  id: `alarm-${Date.now()}`,
                  label: args.label || 'Reminder',
                  time: args.time || '08:00',
                  enabled: true,
                },
                ...prev,
              ]);
              toolEvents.push(`Armed alarm for ${args.time}: ${args.label}`);
            }
          } else if (act.name === 'manage_calendar') {
            if (!permissions.READ_CALENDAR) {
              toolEvents.push('Blocked calendar: READ_CALENDAR permission is disabled.');
            } else {
              setEvents((prev) => [
                {
                  id: `ev-${Date.now()}`,
                  title: args.title || 'Event',
                  date: args.date || new Date().toISOString().slice(0, 10),
                  time: args.time || '12:00',
                  location: args.location,
                },
                ...prev,
              ]);
              toolEvents.push(`Scheduled event: ${args.title} (${args.date} ${args.time})`);
            }
          } else if (act.name === 'save_user_preference') {
            const cat =
              args.category === 'contact' ||
              args.category === 'routine' ||
              args.category === 'general'
                ? args.category
                : 'preference';
            setMemories((prev) => [
              {
                id: `mem-${Date.now()}`,
                fact: args.fact || '',
                category: cat,
                createdAt: 'Just now',
              },
              ...prev,
            ]);
            toolEvents.push(`Saved preference to memory`);
          } else if (act.name === 'control_android_device') {
            const req: AndroidActionRequest = {
              action: (args.action || 'open_app') as AndroidActionType,
              target: args.target,
              message: args.message,
              value: args.value,
              reason: args.reason,
            };
            const outcome = dispatchAndroidCommand(req, text);
            toolEvents.push(outcome.toolNote);
            if (outcome.pending) {
              pendingConf = outcome.pending;
            }
          }
        }

        const assistantText = String(data.text || 'Done.');
        const replyLang = detectLanguageHint(assistantText).code;
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: assistantText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          detectedLanguage: replyLang,
          sources: Array.isArray(data.sources) ? data.sources : undefined,
          toolEvents: toolEvents.length > 0 ? toolEvents : undefined,
          pendingConfirmation: pendingConf,
          confirmationStatus: pendingConf ? 'pending' : undefined,
          spokenOnly: speechDecision.speechOnly,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        if (speechDecision.autoSpeak) {
          void speakText(assistantText);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to reach JARVIS backend.';
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: `Error: ${msg}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            error: true,
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [
      inputValue,
      isThinking,
      messages,
      settings,
      memories,
      permissions,
      dispatchAndroidCommand,
      speakText,
      unlockAudioPlayback,
      showNotice,
    ]
  );

  const releaseMicResources = useCallback(() => {
    if (speechSilenceTimerRef.current) {
      window.clearTimeout(speechSilenceTimerRef.current);
      speechSilenceTimerRef.current = null;
    }
    if (speechWaveTimerRef.current) {
      window.clearInterval(speechWaveTimerRef.current);
      speechWaveTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mediaRecorderRef.current = null;
    setMicActive(false);
    setInterimTranscript('');
    setAudioLevels(Array.from({ length: 24 }, () => 0.14));
  }, []);

  // Stop active voice capture cleanly without truncating pending MediaRecorder audio
  const stopVoiceCapture = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.stop();
      } catch {
        // Ignore stop errors
      }
      const buffered = latestTranscriptRef.current.trim();
      latestTranscriptRef.current = '';
      releaseMicResources();
      if (buffered) {
        sendMessageRef.current(buffered);
      }
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        // recorder.onstop releases mediaStreamRef and audioContextRef after reading the final Blob
        mediaRecorderRef.current.stop();
        return;
      } catch {
        // Fall through to full release
      }
    }

    releaseMicResources();
  }, [releaseMicResources]);

  const requestBrowserMicAccess = useCallback(
    async (
      stopProbeAfterGrant = true
    ): Promise<
      | { ok: true; stream?: MediaStream }
      | { ok: false; errorMessage: string; canRetryPermission: boolean }
    > => {
      const policyCtx = getMicPolicyContext();
      if (!policyCtx.isSecureContext) {
        setBrowserMicStatus('unsupported');
        const info = classifyMicrophoneFailure('SecurityError', policyCtx);
        return { ok: false, errorMessage: info.userMessage, canRetryPermission: false };
      }
      if (!policyCtx.frameAllowsMic) {
        setBrowserMicStatus('denied');
        const info = classifyMicrophoneFailure('NotAllowedError', policyCtx);
        return { ok: false, errorMessage: info.userMessage, canRetryPermission: true };
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setBrowserMicStatus('unsupported');
        return {
          ok: false,
          errorMessage:
            'Browser microphone API (getUserMedia) is unavailable in this environment.',
          canRetryPermission: false,
        };
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setBrowserMicStatus('granted');
        if (stopProbeAfterGrant) {
          stream.getTracks().forEach((t) => t.stop());
          return { ok: true };
        }
        return { ok: true, stream };
      } catch (err) {
        const errName = err instanceof Error ? err.name : 'NotAllowedError';
        const info = classifyMicrophoneFailure(errName, policyCtx);
        if (info.kind === 'permission_denied' || info.kind === 'frame_blocked') {
          setBrowserMicStatus('denied');
        }
        return {
          ok: false,
          errorMessage: info.userMessage,
          canRetryPermission: info.canRetryPermission,
        };
      }
    },
    [getMicPolicyContext]
  );

  const handleRequestMicFromUI = useCallback(async () => {
    const res = await requestBrowserMicAccess(true);
    if (res.ok) {
      if (!permissions.RECORD_AUDIO) {
        setPermissions((prev) => ({ ...prev, RECORD_AUDIO: true }));
      }
      showNotice('Microphone permission granted. Tap Speak to start voice commands.');
    } else {
      showNotice(
        res.errorMessage,
        res.canRetryPermission
          ? { label: 'Retry Mic Check', onClick: () => void handleRequestMicFromUI() }
          : null
      );
    }
  }, [requestBrowserMicAccess, permissions.RECORD_AUDIO, showNotice]);

  const startLiveAudioVisualizer = useCallback(
    async (
      onVadSilence?: () => void
    ): Promise<
      | { ok: true; stream: MediaStream }
      | { ok: false; errorMessage: string; canRetryPermission: boolean }
    > => {
      const access = await requestBrowserMicAccess(false);
      if (!access.ok || !access.stream) {
        return {
          ok: false,
          errorMessage: access.ok ? 'Unable to open microphone stream.' : access.errorMessage,
          canRetryPermission: access.ok ? true : access.canRetryPermission,
        };
      }

      const stream = access.stream;
      try {
        mediaStreamRef.current = stream;
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);

        let speechDetected = false;
        let lastSpeechAt = performance.now();
        let vadTriggered = false;
        const silenceCutoffMs = settings.fastMode ? 800 : 1200;

        const tick = () => {
          if (!mediaStreamRef.current) return;
          analyser.getByteFrequencyData(buffer);
          const { isSpeech } = measureSpeechEnergy(buffer);
          const nowTs = performance.now();
          if (isSpeech) {
            speechDetected = true;
            lastSpeechAt = nowTs;
          } else if (
            onVadSilence &&
            speechDetected &&
            !vadTriggered &&
            nowTs - lastSpeechAt >= silenceCutoffMs
          ) {
            vadTriggered = true;
            onVadSilence();
          }

          const bars = Array.from({ length: 24 }, (_, idx) => {
            const val = buffer[idx % buffer.length] || 0;
            return Math.max(0.14, Math.min(1, val / 180));
          });
          setAudioLevels(bars);
          animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
        return { ok: true, stream };
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        return {
          ok: false,
          errorMessage: 'Failed to initialize Web Audio visualizer for microphone.',
          canRetryPermission: true,
        };
      }
    },
    [requestBrowserMicAccess, settings.fastMode]
  );

  const startMediaRecorderCapture = useCallback(async () => {
    const visual = await startLiveAudioVisualizer(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    });
    if (!visual.ok) {
      releaseMicResources();
      showNotice(
        visual.errorMessage,
        visual.canRetryPermission
          ? { label: 'Grant Mic Access', onClick: () => void handleRequestMicFromUI() }
          : null
      );
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      releaseMicResources();
      showNotice(
        'MediaRecorder audio capture is unsupported in this browser. You can type your command below.'
      );
      return;
    }

    try {
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(visual.stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const cleanMime = normalizeAudioMimeType(recorder.mimeType);
        const blob = new Blob(chunks, { type: cleanMime });
        releaseMicResources();

        if (blob.size < 200) {
          showNotice('No audio was captured. Speak clearly and try again.');
          return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = String(reader.result || '').split(',')[1];
          if (!base64) return;
          try {
            setIsThinking(true);
            const res = await fetch('/api/jarvis/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64, mimeType: cleanMime }),
            });
            const data = await res.json();
            setIsThinking(false);
            if (res.ok && data.transcript) {
              sendMessageRef.current(data.transcript);
            } else {
              showNotice(data.error || 'Could not transcribe audio.');
            }
          } catch {
            setIsThinking(false);
            showNotice('Audio transcription request failed.');
          }
        };
        reader.readAsDataURL(blob);
      };

      setMicActive(true);
      recorder.start(150);
      showNotice('Listening cleanly — auto-sends as soon as you pause speaking.');
    } catch {
      releaseMicResources();
      showNotice('Failed to start MediaRecorder microphone capture.');
    }
  }, [startLiveAudioVisualizer, releaseMicResources, showNotice, handleRequestMicFromUI]);

  const toggleMicrophone = useCallback(async () => {
    if (micActive) {
      stopVoiceCapture();
      return;
    }
    if (!permissions.RECORD_AUDIO) {
      showNotice('Microphone permission (RECORD_AUDIO) is disabled.', {
        label: 'Enable RECORD_AUDIO',
        onClick: () => {
          setPermissions((prev) => ({ ...prev, RECORD_AUDIO: true }));
          showNotice('RECORD_AUDIO enabled. Tap Speak to start listening.');
        },
      });
      return;
    }

    // Stop wake-word recognizer first so it never contends for the hardware mic
    if (wakeRecognitionRef.current) {
      try {
        wakeRecognitionRef.current.stop();
      } catch {
        // ignore
      }
      wakeRecognitionRef.current = null;
    }

    stopSpeaking();
    unlockAudioPlayback();
    showNotice(null);
    latestTranscriptRef.current = '';

    const policyCtx = getMicPolicyContext();
    if (!policyCtx.isSecureContext || !policyCtx.frameAllowsMic) {
      const info = classifyMicrophoneFailure(
        policyCtx.isSecureContext ? 'NotAllowedError' : 'SecurityError',
        policyCtx
      );
      if (info.kind === 'frame_blocked') setBrowserMicStatus('denied');
      showNotice(
        info.userMessage,
        info.canRetryPermission
          ? { label: 'Grant Mic Access', onClick: () => void handleRequestMicFromUI() }
          : null
      );
      return;
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = resolveSpeechRecognitionLocale(settings.language, navigator.language);

        let finalTranscript = '';
        let handled = false;

        // Animate listening waveform immediately without blocking on a secondary getUserMedia stream
        speechWaveTimerRef.current = window.setInterval(() => {
          setAudioLevels(Array.from({ length: 24 }, () => 0.22 + Math.random() * 0.55));
        }, 120);

        const finalizeSpeechFast = () => {
          if (handled) return;
          const captured = (finalTranscript.trim() || latestTranscriptRef.current).trim();
          if (!captured) return;
          handled = true;
          recognitionRef.current = null;
          latestTranscriptRef.current = '';
          try {
            rec.stop();
          } catch {
            // ignore
          }
          releaseMicResources();
          sendMessageRef.current(captured);
        };

        rec.onresult = (event) => {
          setBrowserMicStatus('granted');
          let interim = '';
          let sawFinal = false;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const chunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += `${chunk} `;
              sawFinal = true;
            } else {
              interim += chunk;
            }
          }
          const combined = `${finalTranscript}${interim}`.trim();
          latestTranscriptRef.current = combined;
          setInterimTranscript(combined);

          if (combined) {
            if (speechSilenceTimerRef.current) {
              window.clearTimeout(speechSilenceTimerRef.current);
            }
            const delayMs = sawFinal
              ? settings.fastMode
                ? 320
                : 600
              : settings.fastMode
              ? 850
              : 1350;
            speechSilenceTimerRef.current = window.setTimeout(finalizeSpeechFast, delayMs);
          }
        };

        rec.onerror = (ev) => {
          if (handled) return;
          handled = true;
          recognitionRef.current = null;
          latestTranscriptRef.current = '';
          releaseMicResources();

          const classified = classifyMicrophoneFailure(ev.error, getMicPolicyContext());
          if (classified.shouldFallbackToRecorder) {
            void startMediaRecorderCapture();
            return;
          }
          if (classified.kind === 'permission_denied' || classified.kind === 'frame_blocked') {
            setBrowserMicStatus('denied');
            showNotice(
              classified.userMessage,
              classified.canRetryPermission
                ? { label: 'Grant Mic Access', onClick: () => void handleRequestMicFromUI() }
                : null
            );
            return;
          }
          showNotice(classified.userMessage);
        };

        rec.onend = () => {
          if (handled) return;
          handled = true;
          recognitionRef.current = null;
          const captured = (finalTranscript.trim() || latestTranscriptRef.current).trim();
          latestTranscriptRef.current = '';
          releaseMicResources();
          if (captured) {
            sendMessageRef.current(captured);
          }
        };

        recognitionRef.current = rec;
        setMicActive(true);
        rec.start();
        return;
      } catch {
        recognitionRef.current = null;
        releaseMicResources();
      }
    }

    await startMediaRecorderCapture();
  }, [
    micActive,
    permissions.RECORD_AUDIO,
    settings.language,
    settings.fastMode,
    stopSpeaking,
    stopVoiceCapture,
    unlockAudioPlayback,
    releaseMicResources,
    handleRequestMicFromUI,
    getMicPolicyContext,
    startMediaRecorderCapture,
    showNotice,
  ]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    toggleMicRef.current = toggleMicrophone;
  }, [toggleMicrophone]);

  // Hands-free wake-word listener lifecycle
  useEffect(() => {
    if (!settings.wakeWordEnabled || !permissions.RECORD_AUDIO || micActive) {
      if (wakeRecognitionRef.current) {
        try {
          wakeRecognitionRef.current.stop();
        } catch {
          // ignore
        }
        wakeRecognitionRef.current = null;
      }
      return;
    }

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
        .webkitSpeechRecognition;

    if (!SpeechRec) {
      showNotice(
        'Continuous wake-word requires Web SpeechRecognition (Chrome/Android WebView) or the native Kotlin JarvisWakeWordService.'
      );
      return;
    }

    let cancelled = false;
    let wakeDebounceTimer: number | null = null;
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = resolveSpeechRecognitionLocale(settings.language, navigator.language);

    rec.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const latest = lastResult?.[0]?.transcript || '';
      const match = matchesWakeWord(latest, settings.wakePhrases);
      if (!match.matched) return;

      if (wakeDebounceTimer) {
        window.clearTimeout(wakeDebounceTimer);
        wakeDebounceTimer = null;
      }

      const executeWakeTrigger = () => {
        if (cancelled) return;
        if (match.remainder) {
          sendMessageRef.current(match.remainder);
        } else {
          showNotice(`Wake phrase "${match.phrase}" detected. Listening...`);
          toggleMicRef.current();
        }
      };

      // Trigger immediately on final result, or wait a brief 420ms grace window on interim speech to capture trailing command
      if (lastResult?.isFinal) {
        executeWakeTrigger();
      } else {
        wakeDebounceTimer = window.setTimeout(executeWakeTrigger, 420);
      }
    };

    rec.onerror = (ev) => {
      // Ignore normal silence/abort timeouts so wake-word stays active
      if (ev.error === 'no-speech' || ev.error === 'aborted') {
        return;
      }
      if (!cancelled) {
        const classified = classifyMicrophoneFailure(ev.error, getMicPolicyContext());
        if (classified.kind === 'permission_denied' || classified.kind === 'frame_blocked') {
          setBrowserMicStatus('denied');
        }
        setSettings((s) => ({ ...s, wakeWordEnabled: false }));
        showNotice(
          `Wake-word paused: ${classified.userMessage}`,
          classified.canRetryPermission
            ? { label: 'Grant Mic Access', onClick: () => void handleRequestMicFromUI() }
            : null
        );
      }
    };

    rec.onend = () => {
      if (!cancelled && settings.wakeWordEnabled && permissions.RECORD_AUDIO) {
        try {
          rec.start();
        } catch {
          // ignore restart error
        }
      }
    };

    try {
      rec.start();
      wakeRecognitionRef.current = rec;
    } catch {
      // ignore
    }

    return () => {
      cancelled = true;
      if (wakeDebounceTimer) window.clearTimeout(wakeDebounceTimer);
      try {
        rec.stop();
      } catch {
        // ignore
      }
      wakeRecognitionRef.current = null;
    };
  }, [
    settings.wakeWordEnabled,
    settings.wakePhrases,
    settings.language,
    permissions.RECORD_AUDIO,
    micActive,
    getMicPolicyContext,
    handleRequestMicFromUI,
    showNotice,
  ]);

  const handleToggleWakeWord = useCallback(async () => {
    if (settings.wakeWordEnabled) {
      setSettings((s) => ({ ...s, wakeWordEnabled: false }));
      return;
    }
    if (!permissions.RECORD_AUDIO) {
      showNotice('Enable RECORD_AUDIO permission before activating Wake Word.', {
        label: 'Enable RECORD_AUDIO',
        onClick: () => {
          setPermissions((prev) => ({ ...prev, RECORD_AUDIO: true }));
          showNotice('RECORD_AUDIO enabled. Toggle Wake Word again to start.');
        },
      });
      return;
    }
    if (browserMicStatus !== 'granted') {
      const probe = await requestBrowserMicAccess(true);
      if (!probe.ok) {
        showNotice(
          probe.errorMessage,
          probe.canRetryPermission
            ? { label: 'Grant Mic Access', onClick: () => void handleRequestMicFromUI() }
            : null
        );
        return;
      }
    }
    showNotice(null);
    setSettings((s) => ({ ...s, wakeWordEnabled: true }));
  }, [
    settings.wakeWordEnabled,
    permissions.RECORD_AUDIO,
    browserMicStatus,
    requestBrowserMicAccess,
    handleRequestMicFromUI,
    showNotice,
  ]);

  const handleRunBriefing = () => {
    setActiveTab('assistant');
    const summaryPrompt = `Give me a personalized Daily Briefing for ${now.toDateString()}. Include today's top world/tech news via Google Search, plus remind me of my ${
      tasks.filter((t) => !t.completed).length
    } open tasks and ${events.length} calendar events.`;
    sendMessage(summaryPrompt);
  };

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'assistant', label: 'Assistant', icon: <Cpu className="h-4 w-4" /> },
    { id: 'search', label: 'Search', icon: <Search className="h-4 w-4" /> },
    { id: 'device', label: 'Device', icon: <Smartphone className="h-4 w-4" /> },
    { id: 'utilities', label: 'Utilities', icon: <LayoutGrid className="h-4 w-4" /> },
    { id: 'android', label: 'Android Plan', icon: <Cpu className="h-4 w-4" /> },
  ];

  const timeFormatted = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateFormatted = now.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-[#06090F] text-slate-100 pb-20 md:pb-6">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-cyan-500/15 bg-[#06090F]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3 sm:px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className="font-display text-lg font-bold tracking-wider text-cyan-300 whitespace-nowrap shrink-0 hover:text-cyan-200"
          >
            JARVIS AI
          </button>

          {/* Zone 2: Concise single-line navigation links */}
          <nav aria-label="Primary sections" className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
                  activeTab === item.id
                    ? 'border-b-2 border-cyan-400 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex min-h-[40px] items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'settings'
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-cyan-500/30 bg-[#0C121E] text-slate-200 hover:border-cyan-400/60'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Active Alarm / System Notice Banners */}
      {triggeredAlarmBanner && (
        <div
          role="alert"
          className="mx-auto mt-3 flex w-full max-w-[1440px] items-center justify-between gap-3 rounded-xl border border-amber-400/50 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-200 sm:px-6"
        >
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-amber-400" />
            <span>
              Alarm Triggered ({triggeredAlarmBanner.time}): {triggeredAlarmBanner.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTriggeredAlarmBanner(null)}
            aria-label="Dismiss alarm alert"
            className="rounded-md p-1 hover:bg-amber-500/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {noticeBanner && (
        <div
          role="status"
          className="mx-auto mt-3 flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6"
        >
          <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/25 px-4 py-2.5 text-xs text-cyan-200">
            <span className="min-w-0 flex-1">{noticeBanner}</span>
            <div className="flex shrink-0 items-center gap-2">
              {noticeAction && (
                <button
                  type="button"
                  onClick={noticeAction.onClick}
                  className="min-h-[30px] rounded-lg border border-amber-400/60 bg-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/30"
                >
                  {noticeAction.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => showNotice(null)}
                aria-label="Dismiss notice"
                className="rounded p-1 hover:bg-cyan-500/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Stage */}
      <main className="mx-auto mt-5 w-full max-w-[1440px] flex-1 px-4 sm:px-6">
        {activeTab === 'assistant' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-stretch">
            {/* Left HUD Column: Clock, Core, Language & Quick Workspace */}
            <aside className="flex flex-col gap-5">
              {/* Current Date & Time */}
              <div className="flex items-center justify-between rounded-2xl border border-cyan-500/20 bg-[#0C121E] px-5 py-4">
                <div>
                  <div className="text-xs text-slate-400">Local Time</div>
                  <div
                    data-testid="hud-clock"
                    className="font-mono text-2xl font-semibold text-cyan-300 tabular-nums"
                  >
                    {timeFormatted}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Date</div>
                  <div className="font-mono text-xs font-medium text-slate-200">{dateFormatted}</div>
                </div>
              </div>

              {/* JARVIS Circular Core */}
              <JarvisCore
                coreState={coreState}
                audioLevels={audioLevels}
                micActive={micActive}
                wakeWordEnabled={settings.wakeWordEnabled}
                isSpeaking={isSpeaking}
                onToggleMic={toggleMicrophone}
                onStopSpeaking={stopSpeaking}
                onToggleWakeWord={handleToggleWakeWord}
              />

              {/* Language Selector & Quick Actions */}
              <div className="rounded-2xl border border-cyan-500/20 bg-[#0C121E] p-4">
                <label
                  htmlFor="hud-language-select"
                  className="mb-2 block text-xs font-medium text-slate-300"
                >
                  Assistant Language
                </label>
                <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Language selector">
                  {(
                    [
                      { code: 'auto', label: 'Auto' },
                      { code: 'en', label: 'EN' },
                      { code: 'bn', label: 'বাংলা' },
                      { code: 'hi', label: 'हिन्दी' },
                    ] as Array<{ code: LanguageCode; label: string }>
                  ).map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, language: lang.code }))}
                      className={`min-h-[38px] rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                        settings.language === lang.code
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                          : 'border-slate-800 bg-[#080D16] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>

                {/* Quick Utility Actions */}
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-cyan-500/15 pt-3">
                  <button
                    type="button"
                    onClick={handleRunBriefing}
                    className="min-h-[40px] rounded-lg border border-cyan-500/25 bg-[#080D16] px-2.5 text-xs font-medium text-slate-200 hover:border-cyan-400/60"
                  >
                    Daily Briefing
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('search')}
                    className="min-h-[40px] rounded-lg border border-cyan-500/25 bg-[#080D16] px-2.5 text-xs font-medium text-slate-200 hover:border-cyan-400/60"
                  >
                    Web Search
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('device')}
                    className="min-h-[40px] rounded-lg border border-cyan-500/25 bg-[#080D16] px-2.5 text-xs font-medium text-slate-200 hover:border-cyan-400/60"
                  >
                    Phone Control
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      speakText(
                        settings.language === 'bn'
                          ? 'নমস্কার, আমি জার্ভিস। আপনার সেবায় প্রস্তুত।'
                          : settings.language === 'hi'
                          ? 'नमस्ते, मैं जार्विस हूँ। आपकी सहायता के लिए तैयार हूँ।'
                          : 'Hello. JARVIS systems are ready to assist you.'
                      )
                    }
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-cyan-500/25 bg-[#080D16] px-2.5 text-xs font-medium text-slate-200 hover:border-cyan-400/60"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Voice Check</span>
                  </button>
                </div>
              </div>
            </aside>

            {/* Right Column: Conversational AI & Tool Console */}
            <ChatConsole
              messages={messages}
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSendMessage={sendMessage}
              onSpeakMessage={speakText}
              onConfirmAction={handleConfirmAction}
              isThinking={isThinking}
              micActive={micActive}
              onToggleMic={toggleMicrophone}
              selectedLanguage={settings.language}
              interimTranscript={interimTranscript}
              autoSpeakResponses={settings.autoSpeakResponses}
              speechOnlyMode={settings.speechOnlyMode}
              fastMode={settings.fastMode}
              onToggleAutoSpeak={() =>
                setSettings((s) => ({
                  ...s,
                  autoSpeakResponses: !s.autoSpeakResponses,
                  speechOnlyMode: s.autoSpeakResponses ? false : s.speechOnlyMode,
                }))
              }
              onToggleSpeechOnly={() =>
                setSettings((s) => ({
                  ...s,
                  speechOnlyMode: !s.speechOnlyMode,
                  autoSpeakResponses: !s.speechOnlyMode ? true : s.autoSpeakResponses,
                }))
              }
              onToggleFastMode={() =>
                setSettings((s) => ({
                  ...s,
                  fastMode: !s.fastMode,
                }))
              }
            />
          </div>
        )}

        {activeTab === 'search' && (
          <SearchAndBriefing
            language={settings.language}
            tasks={tasks}
            alarms={alarms}
            events={events}
            autoSpeakResponses={settings.autoSpeakResponses}
            onRunBriefing={handleRunBriefing}
            onSpeakText={speakText}
          />
        )}

        {activeTab === 'device' && (
          <DeviceControlPanel
            deviceState={deviceState}
            permissions={permissions}
            browserMicStatus={browserMicStatus}
            notifications={notifications}
            commandLogs={commandLogs}
            onTogglePermission={(key: AndroidPermissionKey) =>
              setPermissions((prev) => ({ ...prev, [key]: !prev[key] }))
            }
            onRequestBrowserMic={() => void handleRequestMicFromUI()}
            onUpdateDeviceState={(patch) => setDeviceState((s) => ({ ...s, ...patch }))}
            onDispatchCommand={(req, label) => {
              const out = dispatchAndroidCommand(req, label);
              if (out.pending) {
                const msg: ChatMessage = {
                  id: `confmsg-${Date.now()}`,
                  role: 'assistant',
                  text: `Confirmation needed before executing "${label}".`,
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  pendingConfirmation: out.pending,
                  confirmationStatus: 'pending',
                };
                setMessages((prev) => [...prev, msg]);
                setActiveTab('assistant');
              } else {
                setNoticeBanner(out.toolNote);
              }
            }}
            onReadNotifications={() => {
              if (!permissions.READ_NOTIFICATIONS) {
                setNoticeBanner('Enable READ_NOTIFICATIONS permission first.');
                return;
              }
              const summary = notifications
                .map((n) => `${n.app} from ${n.sender}: ${n.preview}`)
                .join('. ');
              speakText(summary);
            }}
          />
        )}

        {activeTab === 'utilities' && (
          <SmartUtilities
            notes={notes}
            tasks={tasks}
            alarms={alarms}
            events={events}
            onAddNote={(title, content) =>
              setNotes((prev) => [
                { id: `note-${Date.now()}`, title, content, createdAt: 'Just now' },
                ...prev,
              ])
            }
            onDeleteNote={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
            onAddTask={(title, priority) =>
              setTasks((prev) => [
                {
                  id: `task-${Date.now()}`,
                  title,
                  completed: false,
                  priority,
                  createdAt: 'Just now',
                },
                ...prev,
              ])
            }
            onToggleTask={(id) =>
              setTasks((prev) =>
                prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
              )
            }
            onDeleteTask={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
            onAddAlarm={(label, time) =>
              setAlarms((prev) => [
                { id: `alarm-${Date.now()}`, label, time, enabled: true },
                ...prev,
              ])
            }
            onToggleAlarm={(id) =>
              setAlarms((prev) =>
                prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
              )
            }
            onDeleteAlarm={(id) => setAlarms((prev) => prev.filter((a) => a.id !== id))}
            onAddEvent={(title, date, time, location) =>
              setEvents((prev) => [
                { id: `ev-${Date.now()}`, title, date, time, location },
                ...prev,
              ])
            }
            onDeleteEvent={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
            onSpeakText={speakText}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsAndMemory
            settings={settings}
            memories={memories}
            commandLogs={commandLogs}
            browserMicStatus={browserMicStatus}
            onUpdateSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            onToggleWakeWord={() => void handleToggleWakeWord()}
            onRequestBrowserMic={() => void handleRequestMicFromUI()}
            onAddMemory={(fact, category) =>
              setMemories((prev) => [
                { id: `mem-${Date.now()}`, fact, category, createdAt: 'Just now' },
                ...prev,
              ])
            }
            onDeleteMemory={(id) => setMemories((prev) => prev.filter((m) => m.id !== id))}
            onClearHistory={() => {
              setMessages(INITIAL_MESSAGES);
              setCommandLogs([]);
              showNotice('Conversation and command history cleared.');
            }}
            onTestVoice={() =>
              speakText('JARVIS neural voice calibration complete. Ready for your command.')
            }
          />
        )}

        {activeTab === 'android' && <AndroidStudioPlan />}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation (<= 15% mobile viewport cap) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-5 border-t border-cyan-500/20 bg-[#06090F]/95 backdrop-blur-md md:hidden"
      >
        {[
          { id: 'assistant' as ActiveTab, label: 'Core', icon: <Cpu className="h-4 w-4" /> },
          { id: 'search' as ActiveTab, label: 'Search', icon: <Search className="h-4 w-4" /> },
          { id: 'device' as ActiveTab, label: 'Device', icon: <Smartphone className="h-4 w-4" /> },
          { id: 'utilities' as ActiveTab, label: 'Tools', icon: <LayoutGrid className="h-4 w-4" /> },
          { id: 'android' as ActiveTab, label: 'Kotlin', icon: <Cpu className="h-4 w-4" /> },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-1 text-[10px] font-medium ${
              activeTab === item.id ? 'text-cyan-300' : 'text-slate-400'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
